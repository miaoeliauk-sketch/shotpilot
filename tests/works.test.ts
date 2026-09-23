import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { existsSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createWork, deleteWork, listWorks, loadWork, saveAsset, saveWork } from '../src/core/works';

let dir = '';
const saved = process.env.SHOTPILOT_DATA;
beforeAll(async () => { dir = await mkdtemp(join(tmpdir(), 'sp-works-')); process.env.SHOTPILOT_DATA = dir; });
afterAll(async () => {
  if (saved === undefined) delete process.env.SHOTPILOT_DATA; else process.env.SHOTPILOT_DATA = saved;
  await rm(dir, { recursive: true, force: true });
});

describe('我的作品', () => {
  it('新建、改名、列出、删除', async () => {
    const w = await createWork('dialogue-shot', '  第一条  ', { duration: 5 });
    expect(w.name).toBe('第一条');
    expect((await loadWork(w.id)).params).toEqual({ duration: 5 });
    await saveWork({ ...w, name: '改过的' });
    expect((await listWorks()).map((x) => x.name)).toContain('改过的');
    await deleteWork(w.id);
    expect(await listWorks()).toHaveLength(0);
  });

  it('空名字给默认名', async () => {
    const w = await createWork('avatar-card', '', {});
    expect(w.name).toBe('未命名作品');
    await deleteWork(w.id);
  });

  it('非法 id 直接拒绝，挡住路径穿越', async () => {
    await expect(loadWork('../../etc/passwd')).rejects.toThrow('非法作品 id');
  });
});

describe('上传的图片', () => {
  it('按内容取名：同一张图只存一份', async () => {
    const data = Buffer.from('fake-png-bytes');
    const a = await saveAsset(data, '头像.PNG');
    const b = await saveAsset(data, '改了名字.png');
    expect(a).toBe(b);
    expect(a).toMatch(/^\/files\/assets\/[0-9a-f]{16}\.png$/);
    expect(readdirSync(join(dir, '素材'))).toHaveLength(1);
  });

  it('.jpeg 统一成 .jpg', async () => {
    expect(await saveAsset(Buffer.from('x'), 'a.jpeg')).toMatch(/\.jpg$/);
  });

  it('不是图片就拒绝', async () => {
    await expect(saveAsset(Buffer.from('x'), 'a.mp4')).rejects.toThrow('只支持');
    expect(existsSync(join(dir, '素材', 'a.mp4'))).toBe(false);
  });
});
