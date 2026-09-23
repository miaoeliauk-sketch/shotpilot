import { describe, expect, it } from 'vitest';
import { toMarkdown } from '../src/export/notes.js';
import { toHandoffJson } from '../src/export/handoff.js';
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

  it('带上逐镜备注和 B-roll 内容', () => {
    const md = toMarkdown(project());
    expect(md).toContain('开场钩子');
    expect(md).toContain('B-roll 内容：产品特写');
  });

  it('只管画面：不出现声音和口播相关内容', () => {
    const md = toMarkdown(project());
    expect(md).not.toMatch(/BGM|BPM|口播|音频/);
  });
});

describe('toHandoffJson', () => {
  it('带上镜头时长、画面标注和中文标签', () => {
    const data = JSON.parse(toHandoffJson(project()));
    expect(data.shots[0].duration).toBe(3);
    expect(data.shots[0].annotation.shotSize).toBe('medium-close');
    expect(data.shots[0].labels.shotSize).toBe('中近景');
  });

  it('不含转写和音频字段', () => {
    const data = JSON.parse(toHandoffJson(project()));
    expect(data).not.toHaveProperty('words');
    expect(data).not.toHaveProperty('audio');
    expect(data.shots[0]).not.toHaveProperty('text');
  });
});
