import { describe, expect, it } from 'vitest';
import * as ts from '../templates/src/two-sides/params';
import { camera as tsCamera, redProgress, tilePose } from '../templates/src/two-sides/TwoSides';
import * as pp from '../templates/src/poster-pair/params';
import { cameraScale as ppCamera, mergePose, typedMiddle } from '../templates/src/poster-pair/PosterPair';
import * as ne from '../templates/src/not-equal/params';
import { cameraScale as neCamera, wordsIn, wordsPose } from '../templates/src/not-equal/NotEqual';

const raw = (p: unknown) => p as Record<string, unknown>;

describe('中间图标 · 左右两段说明 · 红字结尾', () => {
  it('默认按原片：800 帧，254 推到左边、396 切右边、536 切回全景、594/650 出红字', () => {
    const p = ts.toProps(ts.defaultParams);
    expect([p.durationInFrames, p.leftAt, p.rightAt, p.backAt, p.redAt, p.redAt + p.redGap]).toEqual([800, 254, 396, 536, 594, 650]);
    expect(p.left.lines).toHaveLength(3);
  });

  it('镜头：第 200 帧 1 倍，切到左边、右边特写，再切回全景', () => {
    expect(tsCamera(200, 254, 396, 536)).toEqual({ s: 1, x: 640, y: 360 });
    expect(tsCamera(254, 254, 396, 536).s).toBeCloseTo(1.6931, 4);
    expect(tsCamera(254, 254, 396, 536).x).toBeGreaterThan(1000);
    expect(tsCamera(396, 254, 396, 536).x).toBeLessThan(200);
    expect(tsCamera(540, 254, 396, 536).s).toBeCloseTo(0.9986, 3);
    // 推到左边的时间改了，前面全景的曲线跟着伸缩
    expect(tsCamera(400, 508, 700, 900)).toEqual(tsCamera(200, 254, 396, 536));
  });

  it('切镜头的时间不会倒着来；图标从下面翻上来；红字按 1 − e^(−t/14) 亮起来', () => {
    const p = ts.toProps({ ...ts.defaultParams, rightAt: 1, backAt: 0.5 });
    expect(p.rightAt).toBeGreaterThan(p.leftAt);
    expect(p.backAt).toBeGreaterThan(p.rightAt);
    expect(tilePose(0).y).toBeGreaterThan(700);
    expect(tilePose(60).rot).toBe(12);
    expect(redProgress(594, 594)).toBe(0);
    expect(redProgress(608, 594)).toBeCloseTo(1 - Math.exp(-1), 5);
  });

  it('拖时间轴：全景块的尾巴改推到左边的时间', () => {
    const moved = ts.timeline.apply(raw(ts.defaultParams), 'wide', 'end', 0, 7) as unknown as ts.TwoSidesParams;
    expect(moved.leftAt).toBe(7);
  });
});

describe('两张海报卡片 · 合在一起 · 右边大字', () => {
  it('默认按原片：315 帧，第 128 帧合在一起，右边三行在 148、226、262 帧', () => {
    const p = pp.toProps(pp.defaultParams);
    expect(p.durationInFrames).toBe(315);
    expect(p.mergeAt).toBe(128);
    expect(p.lines.map((l) => l.at)).toEqual([148, 226, 262]);
    expect([p.left.tone, p.right.tone]).toEqual(['cream', 'peach']);
  });

  it('右卡片往左滑 560、往下 26，左卡片歪 −6°；镜头 120 帧 1 倍、越推越慢', () => {
    expect(mergePose(100, 128)).toEqual({ dx: 0, dy: 0, rot: -0 });
    const end = mergePose(160, 128);
    expect(end.dx).toBe(-560);
    expect(end.dy).toBeCloseTo(26, 5);
    expect(end.rot).toBeCloseTo(-6, 5);
    expect(ppCamera(120)).toBe(1);
    expect(ppCamera(300) - ppCamera(260)).toBeLessThan(ppCamera(200) - ppCamera(160));
  });

  it('中间那句从第 72 帧起每 4 帧打一个字；空的行不出', () => {
    expect(typedMiddle(71, '同一套')).toBe(0);
    expect(typedMiddle(76, '同一套')).toBe(2);
    expect(typedMiddle(200, '同一套')).toBe(3);
    const p = pp.toProps({ ...pp.defaultParams, lines: [{ before: '', big: ' ', after: '', at: 1 }, { before: '', big: '留', after: '', at: 2 }] });
    expect(p.lines).toHaveLength(1);
  });
});

describe('大字 A ≠ B · 两张海报卡片', () => {
  it('默认按原片：174 帧，第 104 帧盖上卡片', () => {
    const p = ne.toProps(ne.defaultParams);
    expect([p.durationInFrames, p.cardsAt]).toEqual([174, 104]);
    expect(p.leftCard.title).toBe('搜错文件');
  });

  it('镜头：大字慢慢拉远，盖卡片时跳回 1.023 倍；开头每个字从 1.38 倍缩回来', () => {
    expect(neCamera(60, 104)).toBe(1);
    expect(neCamera(103, 104)).toBeLessThan(0.95);
    expect(neCamera(104, 104)).toBeCloseTo(1.0229, 4);
    expect(neCamera(120, 208)).toBe(neCamera(60, 104));
    expect(wordsPose(0).s).toBeCloseTo(1.38, 5);
    expect(wordsPose(60)).toEqual({ s: 1, spread: 1, ne: 1 });
    expect(wordsIn(0)).toBe(0);
    expect(wordsIn(24)).toBe(1);
  });

  it('拖时间轴：大字块的尾巴改盖卡片的时间', () => {
    const moved = ne.timeline.apply(raw(ne.defaultParams), 'words', 'end', 0, 2.5) as unknown as ne.NotEqualParams;
    expect(moved.cardsAt).toBe(2.5);
  });
});
