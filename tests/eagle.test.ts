import { createServer, type Server } from 'node:http';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { EagleError, ROOT_FOLDER, eagleInfo, sendShot, type EagleConn } from '../src/export/eagle.js';
import { applyAiTags } from '../src/core/library.js';
import { emptyShot } from '../src/analyze/shots.js';
import type { ReelProject } from '../src/core/types.js';

/**
 * 一个假的 Eagle：按 Eagle 本机接口的样子回话（{status:'success', data}），
 * 记下收到的请求，验证我们建文件夹、放素材、更新标签的顺序和内容。
 */
type Item = { id: string; name: string; tags: string[]; annotation: string; url: string; folders: string[]; isDeleted: boolean; path?: string };
type Folder = { id: string; name: string; children: Folder[] };

function fakeEagle(opts: { token?: string } = {}) {
  const folders: Folder[] = [];
  const items: Item[] = [];
  const calls: string[] = [];
  let seq = 0;
  const find = (list: Folder[], id: string): Folder | undefined => {
    for (const f of list) { if (f.id === id) return f; const hit = find(f.children, id); if (hit) return hit; }
    return undefined;
  };
  const server = createServer(async (req, res) => {
    const url = new URL(req.url ?? '/', 'http://x');
    const chunks: Buffer[] = [];
    for await (const c of req) chunks.push(c as Buffer);
    const body = chunks.length ? JSON.parse(Buffer.concat(chunks).toString()) : {};
    calls.push(`${req.method} ${url.pathname}`);
    const ok = (data?: unknown) => { res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify({ status: 'success', data })); };
    if (opts.token && url.searchParams.get('token') !== opts.token) {
      res.writeHead(401, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ status: 'error', message: 'token is invalid' }));
      return;
    }
    switch (url.pathname) {
      case '/api/application/info': return ok({ version: '4.0.0' });
      case '/api/folder/list': return ok(folders);
      case '/api/folder/create': {
        const f = { id: `F${++seq}`, name: body.folderName, children: [] };
        (body.parent ? find(folders, body.parent)!.children : folders).push(f);
        return ok(f);
      }
      case '/api/item/addFromPath': {
        items.push({ id: `I${++seq}`, name: body.name, tags: body.tags, annotation: body.annotation, url: body.website, folders: [body.folderId], isDeleted: false, path: body.path });
        return ok();
      }
      case '/api/item/list': {
        const f = url.searchParams.get('folders');
        const k = url.searchParams.get('keyword') ?? '';
        return ok(items.filter((it) => (!f || it.folders.includes(f)) && it.name.includes(k)));
      }
      case '/api/item/info': {
        const it = items.find((x) => x.id === url.searchParams.get('id'));
        if (!it) { res.writeHead(200); res.end(JSON.stringify({ status: 'error', data: 'item not found' })); return; }
        return ok(it);
      }
      case '/api/item/update': {
        const it = items.find((x) => x.id === body.id)!;
        Object.assign(it, { tags: body.tags ?? it.tags, annotation: body.annotation ?? it.annotation, name: body.name ?? it.name });
        return ok(it);
      }
      default: res.writeHead(404); res.end('{}');
    }
  });
  return { server, folders, items, calls };
}

function project(): ReelProject {
  const shot = {
    ...emptyShot(0, 4.4, 13.5), roll: 'b-roll' as const,
    library: applyAiTags(undefined, { frameType: '空镜', scene: '行程', tone: '松弛', uses: ['朋友圈'], subScene: '机场', summary: '登机口前的落地窗', note: '空镜。建议:朋友圈', confidence: '高' }),
  };
  return {
    version: 1, id: 'p1', title: '出差vlog', sourceUrl: 'https://v.douyin.com/abc/',
    source: { path: '/tmp/x.mp4', filename: 'x.mp4', duration: 20, width: 1280, height: 720, fps: 30, hasAudio: false, size: 1 },
    shots: [shot], note: '', createdAt: '2026-09-24T10:00:00', updatedAt: '',
  };
}

describe('放进 Eagle', () => {
  let fake: ReturnType<typeof fakeEagle>;
  let conn: EagleConn;
  let clips: string;
  const listen = async (f: ReturnType<typeof fakeEagle>) => {
    await new Promise<void>((r) => f.server.listen(0, '127.0.0.1', () => r()));
    const addr = f.server.address() as { port: number };
    return `http://127.0.0.1:${addr.port}`;
  };
  const fakeClip = async (file: string) => { await writeFile(file, 'mp4'); };

  beforeEach(async () => {
    fake = fakeEagle();
    conn = { baseUrl: await listen(fake) };
    clips = await mkdtemp(join(tmpdir(), 'clips-'));
  });
  afterEach(() => new Promise<void>((r) => (fake.server as Server).close(() => r())));

  it('第一次放：建「ShotPilot 素材库 / 视频名」文件夹，名称、标签、注释、网址都带上，记下 id', async () => {
    const p = project();
    const r = await sendShot(conn, p, p.shots[0]!, clips, fakeClip);
    expect(r.action).toBe('added');
    expect(fake.folders[0]!.name).toBe(ROOT_FOLDER);
    expect(fake.folders[0]!.children[0]!.name).toBe('出差vlog');
    const it = fake.items[0]!;
    expect(it.name).toBe('20260924_行程-机场_登机口前的落地窗_01');
    expect(it.folders).toEqual([fake.folders[0]!.children[0]!.id]);
    expect(it.tags).toEqual(expect.arrayContaining(['B-roll', '画面:空镜', '场景:行程', '基调:松弛', '建议:朋友圈', '关系:待人工确认', '待人工确认']));
    expect(it.annotation.startsWith('文件名：20260924_行程-机场_登机口前的落地窗_01')).toBe(true);
    expect(it.url).toBe('https://v.douyin.com/abc/');
    expect(it.path?.endsWith('.mp4')).toBe(true);
    expect(r.record.itemId).toBe(it.id);
  });

  it('再放一次是更新，不会多一份；用户在 Eagle 里自己加的标签留着，旧的自动标签换掉', async () => {
    const p = project();
    const first = await sendShot(conn, p, p.shots[0]!, clips, fakeClip);
    fake.items[0]!.tags.push('我喜欢');
    const shot = { ...p.shots[0]!, eagle: first.record, library: { ...p.shots[0]!.library!, tone: '专业', relation: '同行' } };
    const second = await sendShot(conn, p, shot, clips, fakeClip);
    expect(second.action).toBe('updated');
    expect(fake.items).toHaveLength(1);
    expect(fake.items[0]!.tags).toContain('我喜欢');
    expect(fake.items[0]!.tags).toContain('基调:专业');
    expect(fake.items[0]!.tags).not.toContain('基调:松弛');
    expect(fake.items[0]!.tags).toContain('关系:同行');
    expect(fake.folders).toHaveLength(1);
    expect(fake.folders[0]!.children).toHaveLength(1);
  });

  it('用户在 Eagle 里删掉了：重新放一份', async () => {
    const p = project();
    const first = await sendShot(conn, p, p.shots[0]!, clips, fakeClip);
    fake.items.splice(0, 1);
    const again = await sendShot(conn, p, { ...p.shots[0]!, eagle: first.record }, clips, fakeClip);
    expect(again.action).toBe('added');
    expect(fake.items).toHaveLength(1);
  });

  it('Eagle 没开：给一句能看懂的话', async () => {
    await expect(eagleInfo({ baseUrl: 'http://127.0.0.1:9' })).rejects.toMatchObject({ code: 'not-running' });
  });

  it('Eagle 要令牌：没填时提示去设置里填，填了就能用', async () => {
    const locked = fakeEagle({ token: 'secret' });
    const base = await listen(locked);
    await expect(eagleInfo({ baseUrl: base })).rejects.toBeInstanceOf(EagleError);
    await expect(eagleInfo({ baseUrl: base })).rejects.toMatchObject({ code: 'token' });
    await expect(eagleInfo({ baseUrl: base, token: 'secret' })).resolves.toMatchObject({ version: '4.0.0' });
    await new Promise<void>((r) => locked.server.close(() => r()));
  });
});
