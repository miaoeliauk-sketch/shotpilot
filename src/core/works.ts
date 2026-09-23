import { mkdir, readFile, readdir, rename, rm, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { createHash, randomUUID } from 'node:crypto';
import { extname, join } from 'node:path';
import { dataDir } from './paths.js';

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

// ── 素材（用户上传的图片）──────────────────────────────────────────────

const IMAGE_EXTS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif']);

/**
 * 保存一张上传的图片，返回站内地址。
 * 按内容取名：同一张图传两次只存一份，作品里的地址也不会因为改了原文件名而失效。
 */
export async function saveAsset(data: Buffer, originalName: string): Promise<string> {
  const ext = extname(originalName).toLowerCase();
  if (!IMAGE_EXTS.has(ext)) throw new Error('只支持 JPG、PNG、WebP、GIF 图片');
  const name = `${createHash('sha1').update(data).digest('hex').slice(0, 16)}${ext === '.jpeg' ? '.jpg' : ext}`;
  const dir = dataDir('assets');
  await mkdir(dir, { recursive: true });
  const target = join(dir, name);
  if (!existsSync(target)) await writeFile(target, data);
  return `/files/assets/${name}`;
}
