import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { analyzeVideo, resplit } from '../analyze/pipeline.js';
import { detectCuts, mergeWithPrevious, splitShot, splitShotByCuts } from '../analyze/shots.js';
import { generateThumbnailFor, generateThumbnails } from '../analyze/thumbnails.js';
import { autoAnnotate, visionConfigFromEnv } from '../analyze/vision.js';
import { checkToolchain } from '../analyze/ffmpeg.js';
import { listProjects, loadProject, saveProject, thumbsDir } from '../core/project.js';
import { DIMENSIONS } from '../core/vocabulary.js';
import { toMarkdown } from '../export/notes.js';
import { toHandoffJson, toSvml } from '../export/svml.js';
import type { ReelProject, Shot } from '../core/types.js';

const WEB_ROOT = resolve(fileURLToPath(new URL('../../web', import.meta.url)));
const PORT = Number(process.env.SHOTPILOT_PORT ?? 5174);

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.jpg': 'image/jpeg',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.mp4': 'video/mp4',
  '.mov': 'video/quicktime',
  '.webm': 'video/webm',
  '.mkv': 'video/x-matroska',
};

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body);
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'content-length': Buffer.byteLength(payload) });
  res.end(payload);
}

function sendError(res: ServerResponse, status: number, message: string): void {
  sendJson(res, status, { error: message });
}

async function readBody(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    size += (chunk as Buffer).length;
    // 标注数据不该有兆级体积，超了说明有问题，早点掐掉
    if (size > 8 * 1024 * 1024) throw new Error('请求体过大');
    chunks.push(chunk as Buffer);
  }
  if (chunks.length === 0) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    throw new Error('请求体不是合法 JSON');
  }
}

/**
 * 带 Range 的视频流。
 *
 * 这是拉片工具的命脉：没有 Range，浏览器只能整段下载，拖时间线会卡到不可用。
 * 支持 Range 之后可以任意跳转，逐帧比对镜头才成立。
 */
function streamFile(req: IncomingMessage, res: ServerResponse, filePath: string): void {
  if (!existsSync(filePath)) return sendError(res, 404, `文件不存在：${filePath}`);

  const stat = statSync(filePath);
  const mime = MIME[extname(filePath).toLowerCase()] ?? 'application/octet-stream';
  const range = req.headers.range;

  if (!range) {
    res.writeHead(200, { 'content-type': mime, 'content-length': stat.size, 'accept-ranges': 'bytes' });
    createReadStream(filePath).pipe(res);
    return;
  }

  const match = /bytes=(\d*)-(\d*)/.exec(range);
  if (!match) {
    res.writeHead(416, { 'content-range': `bytes */${stat.size}` });
    res.end();
    return;
  }
  const startRaw = match[1];
  const endRaw = match[2];
  const start = startRaw ? Number(startRaw) : 0;
  const end = endRaw ? Math.min(Number(endRaw), stat.size - 1) : stat.size - 1;

  if (!Number.isFinite(start) || start > end || start >= stat.size) {
    res.writeHead(416, { 'content-range': `bytes */${stat.size}` });
    res.end();
    return;
  }

  res.writeHead(206, {
    'content-type': mime,
    'content-range': `bytes ${start}-${end}/${stat.size}`,
    'accept-ranges': 'bytes',
    'content-length': end - start + 1,
  });
  createReadStream(filePath, { start, end }).pipe(res);
}

/** 静态文件。挡住 .. 穿越，只允许读 web 目录内的东西。 */
async function serveStatic(req: IncomingMessage, res: ServerResponse, pathname: string): Promise<void> {
  const rel = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
  const target = resolve(WEB_ROOT, rel);
  if (!target.startsWith(WEB_ROOT)) return sendError(res, 403, '路径越界');
  if (!existsSync(target)) return sendError(res, 404, '页面不存在');
  streamFile(req, res, target);
}

/** 只允许改这些字段，防止前端随手把 id/start/end 覆盖掉造成数据错乱。 */
const EDITABLE_SHOT_FIELDS = new Set([
  'roll', 'annotation', 'effects', 'elements', 'note', 'brollContent', 'reviewed',
]);

function applyShotPatch(shot: Shot, patch: Record<string, unknown>): Shot {
  const next: Shot = { ...shot };
  const source = { ...shot.annotationSource };

  for (const [key, value] of Object.entries(patch)) {
    if (!EDITABLE_SHOT_FIELDS.has(key)) continue;
    if (key === 'annotation' && typeof value === 'object' && value !== null) {
      const incoming = value as Record<string, unknown>;
      next.annotation = { ...shot.annotation, ...incoming } as Shot['annotation'];
      // 人改过的字段标记来源，之后 AI 批量标注不会覆盖它
      for (const field of Object.keys(incoming)) {
        const prev = shot.annotationSource[field as keyof Shot['annotation']];
        source[field as keyof Shot['annotation']] = prev === 'ai' ? 'ai-edited' : 'manual';
      }
      continue;
    }
    (next as unknown as Record<string, unknown>)[key] = value;
  }
  next.annotationSource = source;
  return next;
}

async function handleApi(req: IncomingMessage, res: ServerResponse, url: URL): Promise<boolean> {
  const parts = url.pathname.split('/').filter(Boolean); // ['api', 'projects', id, ...]
  if (parts[0] !== 'api') return false;

  if (parts[1] === 'health') {
    sendJson(res, 200, await checkToolchain());
    return true;
  }

  if (parts[1] === 'vocabulary') {
    sendJson(res, 200, {
      dimensions: DIMENSIONS,
      visionConfigured: visionConfigFromEnv() !== null,
    });
    return true;
  }

  if (parts[1] !== 'projects') return false;

  // GET /api/projects
  if (parts.length === 2 && req.method === 'GET') {
    sendJson(res, 200, await listProjects());
    return true;
  }

  // POST /api/projects  —— 新建并分析
  if (parts.length === 2 && req.method === 'POST') {
    const body = (await readBody(req)) as Record<string, unknown>;
    const videoPath = typeof body.path === 'string' ? body.path : '';
    if (!videoPath) { sendError(res, 400, '缺少 path'); return true; }
    if (!existsSync(videoPath)) { sendError(res, 400, `找不到视频：${videoPath}`); return true; }

    // 分析很慢，用 SSE 把进度推给前端，而不是让用户对着转圈猜
    res.writeHead(200, {
      'content-type': 'text/event-stream; charset=utf-8',
      'cache-control': 'no-cache',
      connection: 'keep-alive',
    });
    const emit = (event: string, data: unknown) => {
      res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    };
    try {
      const project = await analyzeVideo(videoPath, {
        title: typeof body.title === 'string' ? body.title : undefined,
        threshold: typeof body.threshold === 'number' ? body.threshold : undefined,
        minShotDuration: typeof body.minShotDuration === 'number' ? body.minShotDuration : undefined,
        transcribe: body.transcribe === 'whisperx' || body.transcribe === 'subtitles' ? body.transcribe : 'none',
        subtitlePath: typeof body.subtitlePath === 'string' ? body.subtitlePath : undefined,
        language: typeof body.language === 'string' ? body.language : undefined,
      }, (stage, detail) => emit('progress', { stage, detail }));
      emit('done', { id: project.id });
    } catch (err) {
      emit('failed', { message: err instanceof Error ? err.message : String(err) });
    }
    res.end();
    return true;
  }

  const id = parts[2];
  if (!id) return false;

  let project: ReelProject;
  try {
    project = await loadProject(id);
  } catch (err) {
    sendError(res, 404, err instanceof Error ? err.message : '项目不存在');
    return true;
  }

  // GET /api/projects/:id
  if (parts.length === 3 && req.method === 'GET') {
    sendJson(res, 200, project);
    return true;
  }

  // PATCH /api/projects/:id  —— 改整片级字段
  if (parts.length === 3 && req.method === 'PATCH') {
    const body = (await readBody(req)) as Record<string, unknown>;
    if (typeof body.title === 'string') project.title = body.title;
    if (typeof body.note === 'string') project.note = body.note;
    await saveProject(project);
    sendJson(res, 200, { ok: true });
    return true;
  }

  // GET /api/projects/:id/video
  if (parts[3] === 'video') {
    if (!existsSync(project.source.path)) {
      sendError(res, 410, `源视频已不在原位置：${project.source.path}`);
      return true;
    }
    streamFile(req, res, project.source.path);
    return true;
  }

  // GET /api/projects/:id/thumbs/:file
  if (parts[3] === 'thumbs' && parts[4]) {
    const file = parts[4];
    if (!/^[A-Za-z0-9_.-]+$/.test(file)) { sendError(res, 400, '非法文件名'); return true; }
    streamFile(req, res, join(thumbsDir(id), file));
    return true;
  }

  // PATCH /api/projects/:id/shots/:shotId
  if (parts[3] === 'shots' && parts[4] && req.method === 'PATCH') {
    const shotId = parts[4];
    const index = project.shots.findIndex((s) => s.id === shotId);
    if (index === -1) { sendError(res, 404, `镜头不存在：${shotId}`); return true; }
    const patch = (await readBody(req)) as Record<string, unknown>;
    project.shots[index] = applyShotPatch(project.shots[index] as Shot, patch);
    await saveProject(project);
    sendJson(res, 200, project.shots[index]);
    return true;
  }

  // POST /api/projects/:id/shots/:shotId/split  —— 在播放位置手动补一刀
  if (parts[3] === 'shots' && parts[4] && parts[5] === 'split' && req.method === 'POST') {
    const body = (await readBody(req)) as Record<string, unknown>;
    const time = typeof body.time === 'number' ? body.time : NaN;
    try {
      project.shots = splitShot(project.shots, parts[4], time);
      // 只为新出现的那一半抽帧，整片重跑没必要
      const fresh = project.shots.find((s) => Math.abs(s.start - time) < 1e-6);
      if (fresh) {
        const withThumb = await generateThumbnailFor(project.source.path, fresh, thumbsDir(id));
        project.shots = project.shots.map((s) => (s.id === withThumb.id ? withThumb : s));
      }
      await saveProject(project);
      sendJson(res, 200, { shots: project.shots });
    } catch (err) {
      sendError(res, 400, err instanceof Error ? err.message : '拆分失败');
    }
    return true;
  }

  // POST /api/projects/:id/shots/:shotId/autosplit —— 只对这个镜头用更低阈值重新检测
  if (parts[3] === 'shots' && parts[4] && parts[5] === 'autosplit' && req.method === 'POST') {
    const body = (await readBody(req)) as Record<string, unknown>;
    const threshold = typeof body.threshold === 'number' ? body.threshold : 0.08;
    const target = project.shots.find((s) => s.id === parts[4]);
    if (!target) { sendError(res, 404, `镜头不存在：${parts[4]}`); return true; }
    try {
      const cuts = await detectCuts(project.source.path, {
        threshold,
        from: target.start,
        to: target.end,
      });
      const before = project.shots.length;
      project.shots = splitShotByCuts(project.shots, target.id, cuts);
      const added = project.shots.length - before;
      if (added > 0) {
        // 只给新增的段落抽帧：原镜头的首段沿用旧缩略图，边界没变
        project.shots = await generateThumbnails(project.source.path, project.shots, thumbsDir(id));
        await saveProject(project);
      }
      sendJson(res, 200, { shots: project.shots, added, detected: cuts.length, threshold });
    } catch (err) {
      sendError(res, 500, err instanceof Error ? err.message : '局部重切失败');
    }
    return true;
  }

  // POST /api/projects/:id/shots/:shotId/merge  —— 并入上一个镜头
  if (parts[3] === 'shots' && parts[4] && parts[5] === 'merge' && req.method === 'POST') {
    try {
      project.shots = mergeWithPrevious(project.shots, parts[4]);
      await saveProject(project);
      sendJson(res, 200, { shots: project.shots });
    } catch (err) {
      sendError(res, 400, err instanceof Error ? err.message : '合并失败');
    }
    return true;
  }

  // POST /api/projects/:id/resplit
  if (parts[3] === 'resplit' && req.method === 'POST') {
    const body = (await readBody(req)) as Record<string, unknown>;
    try {
      const next = await resplit(project, {
        threshold: typeof body.threshold === 'number' ? body.threshold : undefined,
        minShotDuration: typeof body.minShotDuration === 'number' ? body.minShotDuration : undefined,
      });
      sendJson(res, 200, { shotCount: next.shots.length });
    } catch (err) {
      sendError(res, 500, err instanceof Error ? err.message : '重新切分失败');
    }
    return true;
  }

  // POST /api/projects/:id/autoannotate
  if (parts[3] === 'autoannotate' && req.method === 'POST') {
    const cfg = visionConfigFromEnv();
    if (!cfg) {
      sendError(res, 400, '未配置视觉模型。请设置环境变量 SHOTPILOT_VISION_API_KEY（可选 _BASE_URL / _MODEL）后重启。');
      return true;
    }
    const body = (await readBody(req)) as Record<string, unknown>;
    const onlyUnreviewed = body.onlyUnreviewed !== false;
    const targets = onlyUnreviewed ? project.shots.filter((s) => !s.reviewed) : project.shots;

    res.writeHead(200, { 'content-type': 'text/event-stream; charset=utf-8', 'cache-control': 'no-cache', connection: 'keep-alive' });
    const emit = (event: string, data: unknown) => res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    try {
      const annotated = await autoAnnotate(project.source.path, targets, cfg, (done, total, shotId, error) => {
        emit('progress', { done, total, shotId, error });
      });
      const byId = new Map(annotated.map((s) => [s.id, s]));
      project.shots = project.shots.map((s) => byId.get(s.id) ?? s);
      await saveProject(project);
      emit('done', { annotated: annotated.length });
    } catch (err) {
      emit('failed', { message: err instanceof Error ? err.message : String(err) });
    }
    res.end();
    return true;
  }

  // GET /api/projects/:id/export/:format
  if (parts[3] === 'export' && parts[4]) {
    const format = parts[4];
    const safeTitle = project.title.replace(/[^\w一-鿿-]/g, '_');
    const send = (body: string, mime: string, filename: string) => {
      res.writeHead(200, {
        'content-type': mime,
        'content-disposition': `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
      });
      res.end(body);
    };
    if (format === 'md') return send(toMarkdown(project), 'text/markdown; charset=utf-8', `${safeTitle}-拉片笔记.md`), true;
    if (format === 'svml') return send(toSvml(project), 'application/xml; charset=utf-8', `${safeTitle}.svml`), true;
    if (format === 'json') return send(toHandoffJson(project), 'application/json; charset=utf-8', `${safeTitle}-handoff.json`), true;
    sendError(res, 400, `未知导出格式：${format}`);
    return true;
  }

  return false;
}

const server = createServer((req, res) => {
  const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);
  handleApi(req, res, url)
    .then((handled) => {
      if (handled) return;
      return serveStatic(req, res, url.pathname);
    })
    .catch((err) => {
      if (res.headersSent) { res.end(); return; }
      sendError(res, 500, err instanceof Error ? err.message : '服务端错误');
    });
});

server.listen(PORT, '127.0.0.1', async () => {
  const health = await checkToolchain();
  console.log(`\n  ShotPilot 拉片工作台  →  http://127.0.0.1:${PORT}\n`);
  console.log(`  ${health.ok ? '✓' : '✗'} ${health.message}`);
  console.log(`  ${visionConfigFromEnv() ? '✓ 视觉模型已配置（AI 自动标注可用）' : '· 未配置视觉模型，AI 自动标注不可用（设 SHOTPILOT_VISION_API_KEY 启用）'}\n`);
});
