import { describe, expect, it } from 'vitest';
import { toMarkdown } from '../src/export/notes.js';
import { toHandoffJson, toSvml } from '../src/export/svml.js';
import { emptyShot } from '../src/analyze/shots.js';
import type { ReelProject } from '../src/core/types.js';

function project(): ReelProject {
  const s1 = { ...emptyShot(0, 0, 3), roll: 'a-roll' as const, annotation: { shotSize: 'medium-close' as const, cameraMove: 'static' as const }, note: '开场钩子' };
  const s2 = { ...emptyShot(1, 3, 6), roll: 'b-roll' as const, brollContent: '产品特写' };
  return {
    version: 1,
    id: 'abcd1234-0000-0000-0000-000000000000',
    title: '测试片',
    source: { path: '/tmp/a.mp4', filename: 'a.mp4', duration: 6, width: 1080, height: 1920, fps: 30, hasAudio: true, size: 1000 },
    shots: [s1, s2],
    words: [{ text: '你', start: 0.1, end: 0.4 }, { text: '好', start: 0.4, end: 0.8 }],
    audio: { segments: [], beats: [], bpm: 120, method: 'test' },
    note: '整片备注',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  };
}

describe('toMarkdown', () => {
  it('包含标题、结构速览和逐镜拆解', () => {
    const md = toMarkdown(project());
    expect(md).toContain('# 拉片笔记：测试片');
    expect(md).toContain('## 结构速览');
    expect(md).toContain('### s001');
    expect(md).toContain('平均镜头时长 **3.00 秒**');
  });

  it('把枚举 slug 翻成中文标签', () => {
    const md = toMarkdown(project());
    expect(md).toContain('中近景');
    expect(md).toContain('固定');
    expect(md).not.toContain('medium-close');
  });

  it('把镜头内的词拼成口播引文', () => {
    expect(toMarkdown(project())).toContain('> 你好');
  });
});

describe('toSvml', () => {
  it('首行是已验证的处理指令，import 先于 body', () => {
    const svml = toSvml(project());
    const lines = svml.split('\n');
    expect(lines[0]).toBe('<?svml using="@hypit/markup@1"?>');
    expect(svml.indexOf('<import')).toBeLessThan(svml.indexOf('<script'));
  });

  it('B-roll 用不同的段落标签', () => {
    const svml = toSvml(project());
    expect(svml).toContain('<broll ');
    expect(svml).toContain('<segment ');
  });

  it('口播文本带角色提示', () => {
    expect(toSvml(project())).toContain('<HOST>你好');
  });

  it('转义 XML 特殊字符，避免产出非法文档', () => {
    const p = project();
    p.shots[0]!.note = 'a < b & c > d';
    const svml = toSvml(p);
    expect(svml).toContain('a &lt; b &amp; c &gt; d');
  });
});

describe('toHandoffJson', () => {
  it('带上镜头文本、时长和词级时间戳', () => {
    const data = JSON.parse(toHandoffJson(project()));
    expect(data.shots[0].text).toBe('你好');
    expect(data.shots[0].duration).toBe(3);
    expect(data.words).toHaveLength(2);
  });
});
