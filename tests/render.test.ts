import { afterEach, describe, expect, it } from 'vitest';
import { absolutizeUrls, safeFileName } from '../src/export/render';
import { dataDir } from '../src/core/paths';

describe('导出：站内地址补全', () => {
  it('只补 /files/ 和 /template-assets/ 开头的字符串，其他原样', () => {
    const out = absolutizeUrls({
      image: '/files/assets/a.jpg',
      nested: { list: ['/template-assets/x/s.jpg', '/other', 'https://e.com/a.png'] },
      n: 3,
      flag: true,
    }, 'http://127.0.0.1:5174');
    expect(out).toEqual({
      image: 'http://127.0.0.1:5174/files/assets/a.jpg',
      nested: { list: ['http://127.0.0.1:5174/template-assets/x/s.jpg', '/other', 'https://e.com/a.png'] },
      n: 3,
      flag: true,
    });
  });

  it('文件名去掉访达不允许的字符，空名给默认值', () => {
    expect(safeFileName('第一条/草稿:v2')).toBe('第一条_草稿_v2');
    expect(safeFileName('   ')).toBe('未命名作品');
  });
});

describe('数据文件夹', () => {
  const saved = { data: process.env.SHOTPILOT_DATA, projects: process.env.SHOTPILOT_PROJECTS };
  afterEach(() => {
    if (saved.data === undefined) delete process.env.SHOTPILOT_DATA; else process.env.SHOTPILOT_DATA = saved.data;
    if (saved.projects === undefined) delete process.env.SHOTPILOT_PROJECTS; else process.env.SHOTPILOT_PROJECTS = saved.projects;
  });

  it('Mac 软件里用中文子文件夹', () => {
    process.env.SHOTPILOT_DATA = '/Users/me/Documents/ShotPilot';
    delete process.env.SHOTPILOT_PROJECTS;
    expect(dataDir('renders')).toBe('/Users/me/Documents/ShotPilot/导出的视频');
    expect(dataDir('projects')).toBe('/Users/me/Documents/ShotPilot/拉片项目');
  });

  it('单项环境变量优先', () => {
    process.env.SHOTPILOT_DATA = '/Users/me/Documents/ShotPilot';
    process.env.SHOTPILOT_PROJECTS = '/Volumes/外置/项目';
    expect(dataDir('projects')).toBe('/Volumes/外置/项目');
  });

  it('开发时在当前目录下，沿用英文名', () => {
    delete process.env.SHOTPILOT_DATA;
    delete process.env.SHOTPILOT_PROJECTS;
    expect(dataDir('replicaOut')).toBe(`${process.cwd()}/replica-out`);
  });
});
