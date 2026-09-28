import { describe, expect, it } from 'vitest';
import { smoothTrack } from '../templates/src/curve';

describe('smoothTrack：过关键帧的平滑曲线', () => {
  const xs = [0, 4, 10, 12, 20];
  const ys = [0, 10, 40, 42, 42];

  it('正好经过每个关键帧，两头外面保持端点', () => {
    xs.forEach((x, i) => expect(smoothTrack(x, xs, ys)).toBeCloseTo(ys[i]!, 9));
    expect(smoothTrack(-5, xs, ys)).toBe(0);
    expect(smoothTrack(30, xs, ys)).toBe(42);
  });

  it('关键帧之间不冲过头（单调数据还是单调的）', () => {
    let prev = -Infinity;
    for (let x = 0; x <= 20; x += 0.25) {
      const y = smoothTrack(x, xs, ys);
      expect(y).toBeGreaterThanOrEqual(prev - 1e-9);
      expect(y).toBeLessThanOrEqual(42 + 1e-9);
      prev = y;
    }
  });

  it('速度连续：关键帧两边的速度差不多，不像直线插值那样突变', () => {
    const v = (x: number) => (smoothTrack(x + 0.01, xs, ys) - smoothTrack(x - 0.01, xs, ys)) / 0.02;
    expect(Math.abs(v(4 + 0.02) - v(4 - 0.02))).toBeLessThan(0.1);
    expect(Math.abs(v(10 + 0.02) - v(10 - 0.02))).toBeLessThan(0.1);
  });

  it('extendRight：最后一个关键帧往后按那一刻的速度继续走', () => {
    const a = [0, 10, 20];
    const b = [0, 10, 30];
    const end = smoothTrack(20, a, b);
    const v = end - smoothTrack(19.99, a, b);
    expect(smoothTrack(25, a, b, true)).toBeCloseTo(end + (v / 0.01) * 5, 1);
    expect(smoothTrack(25, a, b)).toBe(30);
  });

  it('两个关键帧时就是直线', () => {
    expect(smoothTrack(5, [0, 10], [0, 100])).toBeCloseTo(50, 9);
  });
});
