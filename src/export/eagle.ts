import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { extractClip } from './replica.js';
import { emptyLibrary, isOurTag, libraryAnnotation, libraryName, libraryTags } from '../core/library.js';
import { safeFileName } from '../core/names.js';
import type { EagleRecord, ReelProject, Shot } from '../core/types.js';

/**
 * 把 B-roll 放进 Eagle。
 *
 * 走 Eagle 自带的本机接口（Eagle 开着时监听 localhost:41595），所以放的时候 Eagle 必须开着。
 * 在 Eagle 里的样子：「ShotPilot 素材库 / 视频名」文件夹，名称是模板的文件名，
 * 标签是模板的各项，注释是模板的整段结果。
 *
 * 同一个镜头再放一次是「更新」而不是再放一份：先按上次记下的 id 找，找不到再按名称找。
 * 更新时只换我们自己打的标签（都带「画面:」「场景:」这种开头），用户在 Eagle 里自己加的标签留着。
 */

export const ROOT_FOLDER = 'ShotPilot 素材库';
export const DEFAULT_EAGLE_URL = 'http://localhost:41595';

export type EagleConn = { baseUrl: string; token?: string };

export class EagleError extends Error {
  constructor(public code: 'not-running' | 'token' | 'failed', message: string) {
    super(message);
  }
}

type Folder = { id: string; name: string; children?: Folder[] };
type Item = { id: string; name: string; tags?: string[]; annotation?: string; url?: string; isDeleted?: boolean };

async function call<T>(conn: EagleConn, method: 'GET' | 'POST', path: string, params: Record<string, string> = {}, body?: unknown): Promise<T> {
  const url = new URL(path, conn.baseUrl);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  if (conn.token) url.searchParams.set('token', conn.token);
  let res: Response;
  try {
    res = await fetch(url, {
      method,
      headers: body === undefined ? undefined : { 'content-type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(20_000),
    });
  } catch {
    throw new EagleError('not-running', 'Eagle 没有打开。先打开 Eagle，再点一次');
  }
  const text = await res.text();
  let json: { status?: string; data?: unknown; message?: unknown } | null = null;
  try { json = JSON.parse(text); } catch { /* 不是 JSON，按错误处理 */ }
  if (json?.status === 'success') return json.data as T;
  const message = typeof json?.message === 'string' ? json.message : typeof json?.data === 'string' ? json.data : text.slice(0, 160);
  if (res.status === 401 || res.status === 403 || /token|令牌|unauthori[sz]ed/i.test(message)) {
    throw new EagleError('token', 'Eagle 要求填 API 令牌。在 Eagle 的设置里找到令牌（Token），拷贝后粘到 ShotPilot 的「设置」里');
  }
  throw new EagleError('failed', `Eagle 返回错误：${message || res.status}`);
}

/** Eagle 开着没有、版本多少 */
export async function eagleInfo(conn: EagleConn): Promise<{ version?: string }> {
  return call(conn, 'GET', '/api/application/info');
}

function findFolder(list: Folder[], name: string): Folder | undefined {
  return list.find((f) => f.name === name);
}

function findById(list: Folder[], id: string): Folder | undefined {
  for (const f of list) {
    if (f.id === id) return f;
    const hit = findById(f.children ?? [], id);
    if (hit) return hit;
  }
  return undefined;
}

/** 找到名字对的文件夹，没有就建一个。parentId 不给就在最外层找 */
export async function ensureFolder(conn: EagleConn, name: string, parentId?: string): Promise<string> {
  const all = await call<Folder[]>(conn, 'GET', '/api/folder/list');
  const scope = parentId ? findById(all ?? [], parentId)?.children ?? [] : all ?? [];
  const hit = findFolder(scope, name);
  if (hit) return hit.id;
  const created = await call<Folder>(conn, 'POST', '/api/folder/create', {}, parentId ? { folderName: name, parent: parentId } : { folderName: name });
  return created.id;
}

async function findItemByName(conn: EagleConn, folderId: string, name: string): Promise<Item | undefined> {
  const items = await call<Item[]>(conn, 'GET', '/api/item/list', { folders: folderId, keyword: name, limit: '50' });
  return (items ?? []).find((it) => it.name === name && !it.isDeleted);
}

async function itemInfo(conn: EagleConn, id: string): Promise<Item | undefined> {
  try {
    const it = await call<Item>(conn, 'GET', '/api/item/info', { id });
    return it && !it.isDeleted ? it : undefined;
  } catch (err) {
    // 用户在 Eagle 里删掉了：当它不存在，重新放一份
    if (err instanceof EagleError && err.code === 'failed') return undefined;
    throw err;
  }
}

/** Eagle 收文件是异步的，放完要等一下才查得到 id */
async function waitForItem(conn: EagleConn, folderId: string, name: string, tries = 10, delayMs = 400): Promise<Item | undefined> {
  for (let i = 0; i < tries; i++) {
    const hit = await findItemByName(conn, folderId, name);
    if (hit) return hit;
    await new Promise((r) => setTimeout(r, delayMs));
  }
  return undefined;
}

export type SendResult = { record: EagleRecord; action: 'added' | 'updated' };

/**
 * 放一个镜头。已经放过（边界没变）就更新名称、标签和注释；没放过才剪片段、加进去。
 * clipsDir 是剪出来的 mp4 放的地方（Eagle 会拷一份进自己的素材库）。
 */
export async function sendShot(
  conn: EagleConn,
  project: ReelProject,
  shot: Shot,
  clipsDir: string,
  makeClip: (file: string) => Promise<void> = (file) => extractClip(project.source.path, shot, file, project.source.fps),
): Promise<SendResult> {
  const name = libraryName(project, shot);
  const tags = libraryTags(shot.library ?? emptyLibrary());
  const annotation = libraryAnnotation(project, shot);
  const website = project.sourceUrl ?? '';
  const rootId = await ensureFolder(conn, ROOT_FOLDER);
  const folderId = await ensureFolder(conn, safeFileName(project.title, '未命名视频'), rootId);
  const record = (itemId?: string): EagleRecord => ({ itemId, name, sentAt: new Date().toISOString(), start: shot.start, end: shot.end });

  const sameBounds = !!shot.eagle && Math.abs(shot.eagle.start - shot.start) < 1e-3 && Math.abs(shot.eagle.end - shot.end) < 1e-3;
  let existing = sameBounds && shot.eagle?.itemId ? await itemInfo(conn, shot.eagle.itemId) : undefined;
  if (!existing) existing = await findItemByName(conn, folderId, name);

  if (existing) {
    const keep = (existing.tags ?? []).filter((t) => !isOurTag(t));
    // 注释如果被用户在 Eagle 里改写过（不是我们的格式开头），就不覆盖
    const ours = !existing.annotation || existing.annotation.startsWith('文件名：');
    await call(conn, 'POST', '/api/item/update', {}, {
      id: existing.id,
      name,
      tags: [...new Set([...keep, ...tags])],
      ...(ours ? { annotation } : {}),
      ...(website ? { url: website } : {}),
    });
    return { record: record(existing.id), action: 'updated' };
  }

  await mkdir(clipsDir, { recursive: true });
  const file = join(clipsDir, `${safeFileName(name, shot.id)}.mp4`);
  await makeClip(file);
  await call(conn, 'POST', '/api/item/addFromPath', {}, { path: file, name, website, tags, annotation, folderId });
  const added = await waitForItem(conn, folderId, name);
  return { record: record(added?.id), action: 'added' };
}
