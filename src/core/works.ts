import { mkdir, readFile, readdir, rename, rm, unlink, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { createHash, randomUUID } from 'node:crypto';
import { extname, join } from 'node:path';
import { dataDir } from './paths.js';
import { probeMedia } from '../analyze/probe.js';

/**
 * 「我的作品」：用某个模板做的一条视频的参数。
 *
 * 只存简单参数（表单里填的那些），不存换算后的组件参数：
 * 以后模板的换算改进了（比如曲线测得更准），老作品重新导出就自动用上新的。
 */
export interface Work {
  id: string;
  name: string;
  templateId: string;
  params: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  /** 最近一次导出的视频文件路径 */
  lastRender?: string;
}

function workPath(id: string): string {
  if (!/^[A-Za-z0-9_-]+$/.test(id)) throw new Error(`非法作品 id：${id}`);
  return join(dataDir('works'), `${id}.json`);
}

export async function listWorks(): Promise<Work[]> {
  const dir = dataDir('works');
  if (!existsSync(dir)) return [];
  const works: Work[] = [];
  for (const f of await readdir(dir)) {
    if (!f.endsWith('.json')) continue;
    try {
      works.push(JSON.parse(await readFile(join(dir, f), 'utf8')) as Work);
    } catch {
      // 单个文件坏了不影响列出其他作品
    }
  }
  return works.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function loadWork(id: string): Promise<Work> {
  const p = workPath(id);
  if (!existsSync(p)) throw new Error(`作品不存在：${id}`);
  return JSON.parse(await readFile(p, 'utf8')) as Work;
}

/** 原子写盘：先写临时文件再改名，写到一半断电也不会留下半个 JSON */
export async function saveWork(work: Work): Promise<Work> {
  const p = workPath(work.id);
  await mkdir(dataDir('works'), { recursive: true });
  const next = { ...work, updatedAt: new Date().toISOString() };
  const tmp = `${p}.${process.pid}.tmp`;
  await writeFile(tmp, JSON.stringify(next, null, 2), 'utf8');
  await rename(tmp, p);
  return next;
}

export async function createWork(templateId: string, name: string, params: Record<string, unknown>): Promise<Work> {
  const now = new Date().toISOString();
  return saveWork({ id: randomUUID(), name: name.trim() || '未命名作品', templateId, params, createdAt: now, updatedAt: now });
}

export async function deleteWork(id: string): Promise<void> {
  await rm(workPath(id), { force: true });
}

// ── 素材（用户上传的图片、视频）────────────────────────────────────────

const IMAGE_EXTS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif']);
const VIDEO_EXTS = new Set(['.mp4', '.mov', '.m4v', '.webm']);

/**
 * 保存一张上传的图片或一段视频，返回站内地址。
 * 按内容取名：同一个文件传两次只存一份，作品里的地址也不会因为改了原文件名而失效。
 *
 * 视频的地址后面带上时长（#dur=秒）：模板要按它循环播放，
 * 而预览和导出时都拿不到文件本身，只有这个地址。# 后面的部分不会发给服务器，不影响取文件。
 */
export async function saveAsset(data: Buffer, originalName: string): Promise<string> {
  const ext = extname(originalName).toLowerCase();
  const video = VIDEO_EXTS.has(ext);
  if (!IMAGE_EXTS.has(ext) && !video) throw new Error('只支持 JPG、PNG、WebP、GIF 图片，或 MP4、MOV、WebM 视频');
  const name = `${createHash('sha1').update(data).digest('hex').slice(0, 16)}${ext === '.jpeg' ? '.jpg' : ext === '.m4v' ? '.mp4' : ext}`;
  const dir = dataDir('assets');
  await mkdir(dir, { recursive: true });
  const target = join(dir, name);
  const fresh = !existsSync(target);
  if (fresh) await writeFile(target, data);
  if (!video) return `/files/assets/${name}`;
  try {
    const media = await probeMedia(target);
    return `/files/assets/${name}#dur=${Math.round(media.duration * 1000) / 1000}`;
  } catch {
    if (fresh) await unlink(target).catch(() => undefined);
    throw new Error('这个视频打不开，换一个 MP4 或 MOV 试试');
  }
}
