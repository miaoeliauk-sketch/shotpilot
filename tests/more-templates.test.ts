import { describe, expect, it } from 'vitest';
import * as doc from '../templates/src/doc-highlight/params';
import { highlightSegments } from '../templates/src/doc-highlight/DocHighlight';
import * as bubbles from '../templates/src/product-bubbles/params';
import { camera, SLOTS } from '../templates/src/product-bubbles/ProductBubbles';
import * as photo from '../templates/src/photo-title/params';
import * as pointing from '../templates/src/pointing-interview/params';
import { TEMPLATES } from '../templates/src/registry';
import type { BodyChar } from '../templates/src/text-layout';

const raw = (p: unknown) => p as Record<string, unknown>;

describe('模板注册表', () => {
  it('每个模板 id 不重复，默认参数都能换算出正的时长', () => {
    const ids = TEMPLATES.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const t of TEMPLATES) expect(t.toProps(t.defaultParams).durationInFrames).toBeGreaterThan(0);
  });

  it('默认时长复现各自的原片', () => {
    const frames = Object.fromEntries(TEMPLATES.map((t) => [t.id, t.toProps(t.defaultParams).durationInFrames]));
    expect(frames['doc-highlight']).toBe(154);
    expect(frames['product-bubbles']).toBe(111);
    expect(frames['photo-title']).toBe(196);
    expect(frames['pointing-interview']).toBe(333);
  });
});

describe('新闻稿荧光笔', () => {
  it('默认按原片：第 73 帧切特写、推近提前 15 帧、第 89 帧开始划', () => {
    const p = doc.toProps(doc.defaultParams);
    expect([p.cutAt, p.pushAt, p.highlightAt]).toEqual([73, 58, 89]);
  });

  it('荧光笔按行分段：同一行连成一条，换行另起一条', () => {
    const c = (x: number, center: number, highlight = true): BodyChar => ({ ch: '字', x, center, width: 30, paragraph: 0, index: 0, line: 0, highlight });
    const segs = highlightSegments([c(0, 100, false), c(30, 100), c(60, 100), c(0, 150), c(30, 150, false)]);
    expect(segs).toEqual([{ x0: 30, x1: 90, center: 100 }, { x0: 0, x1: 30, center: 150 }]);
  });

  it('拖长远景段，荧光笔跟着往后挪', () => {
    const next = doc.timeline.apply(raw(doc.defaultParams), 'wide', 'end', 0, 3) as unknown as doc.DocHighlightParams;
    expect(next.cutAt).toBeCloseTo(3, 5);
    // 2.97 + 0.57 = 3.54，对齐到整帧是 3.53
    expect(next.highlightAt).toBeCloseTo(3.53, 5);
  });
});

describe('产品圆球', () => {
  it('推之前镜头对着画面中间，推完停在目标球附近、放大 2.17 倍', () => {
    const target = SLOTS[2]!;
    const before = camera(44, 45, target);
    expect(before.s).toBeCloseTo(1, 5);
    const after = camera(45 + 60, 45, target);
    expect(after.s).toBeCloseTo(2.1657, 3);
    expect(Math.hypot(after.x - target.x, after.y - target.y)).toBeLessThan(30);
  });

  it('最多三个球，镜头推向的球号不会越界', () => {
    const p = bubbles.toProps({ ...bubbles.defaultParams, bubbles: [...bubbles.defaultParams.bubbles, { label: '多', sub: '' }] });
    expect(p.bubbles).toHaveLength(3);
  });
});

describe('闪白切换 · 竖排标题', () => {
  it('默认按原片：第 46 帧闪白最亮、第 56 帧出标题', () => {
    const p = photo.toProps(photo.defaultParams);
    expect([p.flashAt, p.titleAt]).toEqual([46, 56]);
  });

  it('标题不会早于闪白；挪闪白时标题跟着挪', () => {
    expect(photo.toProps({ ...photo.defaultParams, titleAt: 0 }).titleAt).toBe(48);
    const next = photo.timeline.apply(raw(photo.defaultParams), 'photo1', 'end', 0, 2.53) as unknown as photo.PhotoTitleParams;
    expect(next.titleAt).toBeCloseTo(2.87, 5);
  });
});

describe('指向人物 · 对话场景', () => {
  it('对话框按「放在哪」换算成场景二里的位置', () => {
    const p = pointing.toProps(pointing.defaultParams);
    expect(p.bubbles.map((b) => [b.x, b.y])).toEqual([[750, 250], [130, 318], [447, 118]]);
    expect(p.switchAt).toBe(156);
  });

  it('挪转场时，对话框一起挪；对话框不能拖到转场之前', () => {
    const next = pointing.timeline.apply(raw(pointing.defaultParams), 'sceneA', 'end', 0, 6.2) as unknown as pointing.PointingInterviewParams;
    expect(next.bubbles[0]!.at).toBeCloseTo(6.8, 5);
    const moved = pointing.timeline.apply(raw(pointing.defaultParams), 'bubble-1', 'move', 1, 2) as unknown as pointing.PointingInterviewParams;
    expect(moved.bubbles[1]!.at).toBeCloseTo(5.2, 5);
  });
});
