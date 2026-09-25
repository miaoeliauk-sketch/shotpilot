import { describe, expect, it } from 'vitest';
import * as wm from '../templates/src/word-magnifier/params';
import { bgCamera, charIn, fgCamera, rollingNumber } from '../templates/src/word-magnifier/WordMagnifier';

const raw = (p: unknown) => p as Record<string, unknown>;

describe('压窄大字 · 灰圆 · 放大镜数字', () => {
  it('默认按原片：444 帧，第 58 帧出圆、第 306 帧换放大镜', () => {
    const p = wm.toProps(wm.defaultParams);
    expect([p.durationInFrames, p.bubblesAt, p.magnifierAt]).toEqual([444, 58, 306]);
    expect(p.bubbles).toHaveLength(2);
  });

  it('开头只有字和册子放大 1.75 倍，70 帧后和墙用同一个镜头', () => {
    expect(fgCamera(0).s).toBeCloseTo(1.755, 3);
    expect(bgCamera(0).s).toBeLessThan(1.05);
    expect(fgCamera(120)).toEqual(bgCamera(120));
    expect(bgCamera(200)).toEqual({ s: 1, x: 640, y: 360 });
    expect(bgCamera(440).s).toBeGreaterThan(1.07);
  });

  it('字从虚到实；数字从 0 滚到目标，滚完就是原样', () => {
    expect(charIn(5, 6, 10)).toBe(0);
    expect(charIn(16, 6, 10)).toBe(1);
    expect(rollingNumber(100, 100, '1700').text).toBe('0');
    expect(Number(rollingNumber(106, 100, '1700').text)).toBeGreaterThan(1000);
    expect(rollingNumber(112, 100, '1700')).toEqual({ text: '1700', blur: 0 });
    expect(rollingNumber(105, 100, '三成')).toEqual({ text: '三成', blur: 0 });
  });

  it('拖时间轴改圆和放大镜出来的时间', () => {
    const a = wm.timeline.apply(raw(wm.defaultParams), 'magnifier', 'move', 9, 14) as unknown as wm.WordMagnifierParams;
    expect(a.magnifierAt).toBe(9);
    const b = wm.timeline.apply(raw(wm.defaultParams), 'bubbles', 'move', 3, 9) as unknown as wm.WordMagnifierParams;
    expect(b.bubblesAt).toBe(3);
  });
});
