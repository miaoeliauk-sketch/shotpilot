import { describe, expect, it } from 'vitest';
import { replicaInstructions, safeClipDuration, shotManifest } from '../src/export/replica.js';
import { emptyShot } from '../src/analyze/shots.js';
import type { ReelProject } from '../src/core/types.js';

function project(): ReelProject {
  const shot = {
    ...emptyShot(0, 5, 16), roll: 'b-roll' as const,
    annotation: { shotSize: 'insert' as const, cameraMove: 'push-in' as const },
    elements: ['标题文字', '产品图'],
    note: '辉光文字 + 图片缩放入场',
    slots: [{ id: 'title', kind: 'text' as const, label: '主标题', originalValue: '原来的标题' }],
  };
  return {
    version: 1, id: 'p1', title: 'ref',
    source: { path: '/tmp/ref.mp4', filename: 'ref.mp4', duration: 60, width: 1280, height: 720, fps: 30, hasAudio: true, size: 1 },
    shots: [shot],
    words: [
      { text: '这', start: 5.2, end: 5.5 }, { text: '周', start: 5.5, end: 5.8 },
      { text: '末', start: 5.8, end: 6.1 }, { text: '外', start: 40, end: 40.3 },
    ],
    audio: null, note: '', createdAt: '', updatedAt: '',
  };
}

describe('shotManifest', () => {
  const m = () => shotManifest(project(), project().shots[0]!, 110, { fps: 10, width: 720 });

  it('带上画布尺寸和宽高比，供 Remotion 建 composition', () => {
    expect(m().canvas).toMatchObject({ width: 1280, height: 720, fps: 30 });
    expect(m().canvas.aspectRatio).toBeCloseTo(1.7778, 3);
  });

  it('口播时间戳转成镜头内相对时间，agent 不用自己减偏移', () => {
    const words = m().narration.words;
    expect(words[0]).toMatchObject({ text: '这', start: 0.2 });
    // 落在镜头外的词不该混进来
    expect(words.every((w) => w.start >= 0)).toBe(true);
    expect(words).toHaveLength(3);
  });

  it('枚举翻成中文标签，agent 读得懂', () => {
    expect(m().annotation.shotSize).toBe('空镜/插入');
    expect(m().annotation.cameraMove).toBe('推');
  });

  it('带上槽位定义', () => {
    expect(m().slots).toHaveLength(1);
    expect(m().slots[0]).toMatchObject({ id: 'title', kind: 'text' });
  });

  it('帧序列信息足以把帧号换算回时间', () => {
    expect(m().frames).toMatchObject({ count: 110, fps: 10, pattern: 'f%04d.png' });
  });
});

describe('replicaInstructions', () => {
  const doc = () => replicaInstructions(project(), project().shots[0]!, 110, { fps: 10, width: 720 });

  it('三步法齐全', () => {
    expect(doc()).toContain('第一步：把画面摆对');
    expect(doc()).toContain('第二步：把动效做对');
    expect(doc()).toContain('第三步：渲染比对');
  });

  it('写明画布尺寸与时长，避免 agent 猜', () => {
    expect(doc()).toContain('1280×720');
    expect(doc()).toContain('11.00 秒');
  });

  it('给出可量化的验收标准，而不是「做得像一点」', () => {
    expect(doc()).toContain('SSIM ≥ 0.90');
    expect(doc()).toContain('pnpm compare');
  });

  it('明确要求区分结构与内容槽', () => {
    expect(doc()).toContain('哪些元素是结构');
    expect(doc()).toContain('内容槽');
  });

  it('带上口播原文', () => {
    expect(doc()).toContain('这周末');
  });
});

describe('safeClipDuration', () => {
  it('终点往回让半帧，避免截进下一个镜头的第一帧', () => {
    // 实测镜头：终点是无限小数，toFixed(3) 会把时长向上舍入越过切点
    const shot = { start: 70.466667, end: 72.633333 };
    const raw = shot.end - shot.start;
    expect(Number(raw.toFixed(3))).toBeGreaterThan(raw);          // 复现：舍入后越界
    const safe = safeClipDuration(shot, 30);
    expect(Number(safe.toFixed(3))).toBeLessThan(raw);             // 修复后：舍入后仍在界内
    expect(raw - safe).toBeCloseTo(1 / 60, 6);                     // 只让半帧
  });

  it('不会丢掉本镜头的最后一帧', () => {
    // 3 秒 @30fps = 90 帧，最后一帧时间戳 2.9667；让半帧后终点 2.9833 仍大于它
    const safe = safeClipDuration({ start: 0, end: 3 }, 30);
    expect(safe).toBeGreaterThan(89 / 30);
  });

  it('帧率未知时退回原始时长', () => {
    expect(safeClipDuration({ start: 1, end: 3 }, 0)).toBe(2);
    expect(safeClipDuration({ start: 1, end: 3 }, NaN)).toBe(2);
  });

  it('时长不会变成负数', () => {
    expect(safeClipDuration({ start: 5, end: 5.01 }, 30)).toBe(0);
  });
});
