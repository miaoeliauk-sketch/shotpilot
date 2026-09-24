import { spawn } from 'node:child_process';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { createReadStream, createWriteStream, existsSync, mkdirSync, statSync } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import { readFile } from 'node:fs/promises';
import { extname, join, parse, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { analyzeVideo, resplit } from '../analyze/pipeline.js';
import { downloadVideo, extractUrl } from '../analyze/fetch.js';
import { buildReplicaPackage, replicaDirName } from '../export/replica.js';
import { detectCuts, mergeWithPrevious, splitShot, splitShotByCuts } from '../analyze/shots.js';
import { generateThumbnailFor, generateThumbnails } from '../analyze/thumbnails.js';
import { autoAnnotate, visionConfigFromEnv } from '../analyze/vision.js';
import { checkToolchain } from '../analyze/ffmpeg.js';
import { listProjects, loadProject, saveProject, thumbsDir } from '../core/project.js';
import { DIMENSIONS } from '../core/vocabulary.js';
import { toMarkdown } from '../export/notes.js';
import { toHandoffJson } from '../export/handoff.js';
import { renderTemplate } from '../export/render.js';
import { dataDir, dataRoot, ensureAppDataDirs } from '../core/paths.js';
import { safeFileName } from '../core/names.js';
import { createWork, deleteWork, listWorks, loadWork, saveAsset, saveWork } from '../core/works.js';
import type { ReelProject, Shot } from '../core/types.js';

const WEB_ROOT = resolve(fileURLToPath(new URL('../../web', import.meta.url)));
const TEMPLATE_PUBLIC = resolve(fileURLToPath(new URL('../../templates/public', import.meta.url)));
const PORT = Number(process.env.SHOTPILOT_PORT ?? 5174);

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.mp4': 'video/mp4',
  '.mov': 'video/quicktime',
  '.webm': 'video/webm',
  '.mkv': 'video/x-matroska',
};

/**
 * 在访达里显示。目录就打开它；文件就打开所在目录并选中它（open -R），
 * 不能对文件直接 open：那会用默认程序（QuickTime）播放，而不是在访达里显示。
 * 只在 Mac 上做；其他系统静默跳过。
 */
function revealInFinder(target: string): void {
  if (process.platform !== 'darwin') return;
  try {
    const isFile = existsSync(target) && statSync(target).isFile();
    spawn('open', isFile ? ['-R', target] : [target], { stdio: 'ignore', detached: true }).unref();
  } catch {
    // 打不开访达不影响导出本身
  }
}

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

/**
 * 用户数据和模板示例图。只允许读指定目录里的单层文件名，挡住 .. 穿越。
 * /files/assets/…  上传的图片；/files/renders/…  导出的视频；/template-assets/…  模板自带的示例图
 */
function serveDataFile(req: IncomingMessage, res: ServerResponse, pathname: string): boolean {
  let base: string | null = null;
  let rel = '';
  const m = /^\/files\/(assets|renders)\/(.+)$/.exec(pathname);
  if (m?.[1] && m[2]) {
    base = dataDir(m[1] as 'assets' | 'renders');
    rel = decodeURIComponent(m[2]);
    if (rel.includes('/') || rel.includes('\\')) { sendError(res, 400, '非法文件名'); return true; }
  } else if (pathname.startsWith('/template-assets/')) {
    base = TEMPLATE_PUBLIC;
    rel = decodeURIComponent(pathname.slice('/template-assets/'.length));
  }
  if (!base) return false;
  const target = resolve(base, rel);
  if (!target.startsWith(base + '/')) { sendError(res, 403, '路径越界'); return true; }
  streamFile(req, res, target);
  return true;
}

/** 上传图片用：原始字节，不是 JSON */
async function readRawBody(req: IncomingMessage, limit: number): Promise<Buffer> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    size += (chunk as Buffer).length;
    if (size > limit) throw new Error(`文件太大（超过 ${Math.round(limit / 1024 / 1024)}MB）`);
    chunks.push(chunk as Buffer);
  }
  return Buffer.concat(chunks);
}

/** 同一时间只导出一条：渲染会占满 CPU，并发只会一起变慢 */
let rendering = false;

async function handleTemplateApi(req: IncomingMessage, res: ServerResponse, parts: string[]): Promise<boolean> {
  // ── 我的作品 ──
  if (parts[1] === 'works') {
    const id = parts[2];
    if (!id && req.method === 'GET') { sendJson(res, 200, await listWorks()); return true; }
    if (!id && req.method === 'POST') {
      const body = (await readBody(req)) as Record<string, unknown>;
      if (typeof body.templateId !== 'string' || typeof body.params !== 'object' || body.params === null) {
        sendError(res, 400, '缺少模板或参数'); return true;
      }
      const name = typeof body.name === 'string' ? body.name : '';
      sendJson(res, 200, await createWork(body.templateId, name, body.params as Record<string, unknown>));
      return true;
    }
    if (!id) return false;
    try {
      if (req.method === 'GET') { sendJson(res, 200, await loadWork(id)); return true; }
      if (req.method === 'PUT') {
        const body = (await readBody(req)) as Record<string, unknown>;
        const work = await loadWork(id);
        if (typeof body.name === 'string') work.name = body.name.trim() || work.name;
        if (typeof body.params === 'object' && body.params !== null) work.params = body.params as Record<string, unknown>;
        sendJson(res, 200, await saveWork(work));
        return true;
      }
      if (req.method === 'DELETE') { await deleteWork(id); sendJson(res, 200, { ok: true }); return true; }
    } catch (err) {
      sendError(res, 404, err instanceof Error ? err.message : '作品不存在');
      return true;
    }
    return false;
  }

  // ── 上传图片 ──  POST /api/assets，请求头 x-filename 带原文件名（URL 编码）
  if (parts[1] === 'assets' && req.method === 'POST') {
    try {
      const name = decodeURIComponent(String(req.headers['x-filename'] ?? 'image.png'));
      const data = await readRawBody(req, 60 * 1024 * 1024);
      if (data.length === 0) { sendError(res, 400, '没有收到图片'); return true; }
      sendJson(res, 200, { url: await saveAsset(data, name) });
    } catch (err) {
      sendError(res, 400, err instanceof Error ? err.message : '上传失败');
    }
    return true;
  }

  // ── 导出视频 ──  POST /api/render {compositionId, inputProps, name, workId?}，SSE 推进度
  if (parts[1] === 'render' && req.method === 'POST') {
    const body = (await readBody(req)) as Record<string, unknown>;
    if (typeof body.compositionId !== 'string' || typeof body.inputProps !== 'object' || body.inputProps === null) {
      sendError(res, 400, '缺少模板或参数'); return true;
    }
    if (rendering) { sendError(res, 409, '正在导出另一条视频，等它完成再试'); return true; }
    rendering = true;
    res.writeHead(200, { 'content-type': 'text/event-stream; charset=utf-8', 'cache-control': 'no-cache', connection: 'keep-alive' });
    const emit = (event: string, data: unknown) => res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    try {
      const file = await renderTemplate({
        compositionId: body.compositionId,
        inputProps: body.inputProps as Record<string, unknown>,
        name: typeof body.name === 'string' ? body.name : '未命名作品',
        origin: `http://127.0.0.1:${PORT}`,
      }, (message, percent) => emit('progress', { message, percent }));
      if (typeof body.workId === 'string') {
        try {
          const work = await loadWork(body.workId);
          work.lastRender = file;
          await saveWork(work);
        } catch { /* 作品被删了也不影响导出结果 */ }
      }
      revealInFinder(file);
      emit('done', { file, url: `/files/renders/${encodeURIComponent(file.split('/').pop() ?? '')}` });
    } catch (err) {
      emit('failed', { message: err instanceof Error ? err.message : String(err) });
    } finally {
      rendering = false;
    }
    res.end();
    return true;
  }

  // ── 在访达里显示 ──  只允许用户数据目录里的东西。{kind:'root'} 打开整个 ShotPilot 文件夹
  if (parts[1] === 'reveal' && req.method === 'POST') {
    const body = (await readBody(req)) as Record<string, unknown>;
    if (body.kind === 'root') {
      revealInFinder(dataRoot());
      sendJson(res, 200, { ok: true });
      return true;
    }
    const target = typeof body.path === 'string' ? resolve(body.path) : dataDir('renders');
    const allowed = (['renders', 'works', 'assets', 'replicaOut', 'projects', 'downloads'] as const).map((k) => dataDir(k));
    if (!allowed.some((dir) => target === dir || target.startsWith(dir + '/'))) { sendError(res, 403, '只能打开 ShotPilot 自己的文件夹'); return true; }
    revealInFinder(target);
    sendJson(res, 200, { ok: true });
    return true;
  }

  return false;
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

  if (await handleTemplateApi(req, res, parts)) return true;

  // POST /api/videos —— 把拖进窗口的视频存进「下载的视频」，返回路径，再走正常的新建拉片
  if (parts[1] === 'videos' && req.method === 'POST') {
    const raw = decodeURIComponent(String(req.headers['x-filename'] ?? 'video.mp4'));
    const { name, ext } = parse(raw);
    if (!/^\.(mp4|mov|m4v|webm|mkv)$/i.test(ext)) {
      sendError(res, 400, '只能拖入视频文件（mp4、mov、m4v、webm、mkv）');
      return true;
    }
    const dir = dataDir('downloads');
    mkdirSync(dir, { recursive: true });
    const base = safeFileName(name, '视频');
    let target = join(dir, `${base}${ext.toLowerCase()}`);
    // 同名的不覆盖，后面加编号
    for (let n = 2; existsSync(target); n++) target = join(dir, `${base}-${n}${ext.toLowerCase()}`);
    try {
      await pipeline(req, createWriteStream(target));
      sendJson(res, 200, { path: target });
    } catch (err) {
      sendError(res, 500, err instanceof Error ? `保存视频失败：${err.message}` : '保存视频失败');
    }
    return true;
  }

  // GET /api/replica-candidates —— 所有项目里标成 B-roll / 叠加层 / 字卡的镜头，以及复刻包导出过没有
  if (parts[1] === 'replica-candidates' && req.method === 'GET') {
    const outRoot = dataDir('replicaOut');
    const rows: unknown[] = [];
    for (const summary of await listProjects()) {
      let project: ReelProject;
      try { project = await loadProject(summary.id); } catch { continue; }
      for (const shot of project.shots) {
        if (shot.roll !== 'b-roll' && shot.roll !== 'overlay' && shot.roll !== 'title') continue;
        const dir = join(outRoot, replicaDirName(project, shot));
        rows.push({
          projectId: project.id,
          projectTitle: project.title,
          shotId: shot.id,
          index: shot.index,
          roll: shot.roll,
          start: shot.start,
          end: shot.end,
          thumbnail: shot.thumbnail,
          exportedDir: existsSync(dir) ? dir : null,
        });
      }
    }
    sendJson(res, 200, rows);
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
    const input = typeof body.path === 'string' ? body.path.trim() : '';
    if (!input) { sendError(res, 400, '请粘贴视频链接，或填视频文件的完整路径'); return true; }
    // 输入里有链接（哪怕是一整段抖音分享文案）就走下载；否则当本地路径
    const url = extractUrl(input);
    // 本地路径常被拖进来时带上引号或转义空格，顺手清掉
    const localPath = input.replace(/^['"]|['"]$/g, '').replace(/\\ /g, ' ');
    if (!url && !existsSync(localPath)) { sendError(res, 400, `找不到视频：${localPath}`); return true; }

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
      let videoPath = localPath;
      let title = typeof body.title === 'string' ? body.title : undefined;
      if (url) {
        emit('progress', { stage: 'download', detail: url });
        const got = await downloadVideo(url, (msg) => emit('progress', { stage: 'download', detail: msg }));
        videoPath = got.path;
        title = title ?? (got.title || undefined);
        emit('progress', { stage: 'download', detail: `已下载：${got.path}` });
      }
      const project = await analyzeVideo(videoPath, {
        title,
        threshold: typeof body.threshold === 'number' ? body.threshold : undefined,
        minShotDuration: typeof body.minShotDuration === 'number' ? body.minShotDuration : undefined,
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

  // POST /api/projects/:id/replica —— 在网页里导出复刻包，不用去终端
  if (parts[3] === 'replica' && req.method === 'POST') {
    const body = (await readBody(req)) as Record<string, unknown>;
    const targets = typeof body.shotId === 'string'
      ? project.shots.filter((s) => s.id === body.shotId)
      : project.shots.filter((s) => s.roll === 'b-roll' || s.roll === 'overlay' || s.roll === 'title');
    if (targets.length === 0) {
      sendError(res, 400, typeof body.shotId === 'string'
        ? `镜头不存在：${body.shotId}`
        : '还没有标为 B-roll / 叠加层 / 字卡的镜头。先按 X 或 V 标出要复刻的镜头。');
      return true;
    }
    const outRoot = dataDir('replicaOut');
    res.writeHead(200, { 'content-type': 'text/event-stream; charset=utf-8', 'cache-control': 'no-cache', connection: 'keep-alive' });
    const emit = (event: string, data: unknown) => res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    try {
      const dirs: string[] = [];
      for (const [i, shot] of targets.entries()) {
        emit('progress', { done: i, total: targets.length, shotId: shot.id });
        const r = await buildReplicaPackage(project, shot, outRoot);
        dirs.push(r.dir);
      }
      // 在访达里直接打开：一个镜头就打开它的包，多个就打开外层目录
      const reveal = dirs.length === 1 ? (dirs[0] as string) : outRoot;
      revealInFinder(reveal);
      emit('done', { dirs, revealed: reveal });
    } catch (err) {
      emit('failed', { message: err instanceof Error ? err.message : String(err) });
    }
    res.end();
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
    if (format === 'json') return send(toHandoffJson(project), 'application/json; charset=utf-8', `${safeTitle}-拉片数据.json`), true;
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
      if (serveDataFile(req, res, url.pathname)) return;
      return serveStatic(req, res, url.pathname);
    })
    .catch((err) => {
      if (res.headersSent) { res.end(); return; }
      sendError(res, 500, err instanceof Error ? err.message : '服务端错误');
    });
});

ensureAppDataDirs();

server.listen(PORT, '127.0.0.1', async () => {
  const health = await checkToolchain();
  console.log(`\n  ShotPilot 拉片工作台  →  http://127.0.0.1:${PORT}\n`);
  console.log(`  ${health.ok ? '✓' : '✗'} ${health.message}`);
  console.log(`  ${visionConfigFromEnv() ? '✓ 视觉模型已配置（AI 自动标注可用）' : '· 未配置视觉模型，AI 自动标注不可用（设 SHOTPILOT_VISION_API_KEY 启用）'}\n`);
});
