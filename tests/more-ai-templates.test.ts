import { describe, expect, it } from 'vitest';
import * as ts from '../templates/src/two-sides/params';
import { camera as tsCamera, redProgress, tilePose } from '../templates/src/two-sides/TwoSides';

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
