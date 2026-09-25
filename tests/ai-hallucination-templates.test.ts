import { describe, expect, it } from 'vitest';
import * as iconWords from '../templates/src/icon-red-words/params';
import { bandEdge, iconPose, wordProgress } from '../templates/src/icon-red-words/IconRedWords';

const raw = (p: unknown) => p as Record<string, unknown>;

describe('白色图标 · 两边红字', () => {
  it('默认按原片：164 帧，第 26 帧出左边、第 84 帧出右边', () => {
    const p = iconWords.toProps(iconWords.defaultParams);
    expect([p.durationInFrames, p.leftAt, p.rightAt]).toEqual([164, 26, 84]);
    expect(p.vignette).toBe(true);
  });

  it('图标从下面翻上来，45 帧后停在 (667, 318)、顺时针歪 16.4°', () => {
    const start = iconPose(0);
    expect(start.y).toBeGreaterThan(720);
    expect(start.rot).toBeLessThan(-20);
    expect(start.opacity).toBeLessThan(0.5);
    const end = iconPose(60);
    expect([end.x, end.y, end.rot, end.s, end.tilt, end.opacity]).toEqual([667, 318, 16.4, 1, 0, 1]);
    expect(iconPose(160).s).toBeLessThan(1);
  });

  it('红字 1 − e^(−t/14) 淡进来，34 帧基本到位；暗带从字前 8 帧开始扫', () => {
    expect(wordProgress(26, 26)).toBe(0);
    expect(wordProgress(40, 26)).toBeCloseTo(1 - Math.exp(-1), 5);
    expect(wordProgress(60, 26)).toBeGreaterThan(0.9);
    expect(bandEdge(10, 18, -330)).toBe(-330);
    expect(bandEdge(28, 18, -330)).toBe(-160);
  });

  it('右边的字留空就不出，时间轴上也没有它；拖动左边的字改出现时间', () => {
    const tracks = iconWords.timeline.tracks(raw({ ...iconWords.defaultParams, right: ' ' }));
    expect(tracks[1]!.items.map((i) => i.id)).toEqual(['left']);
    expect(iconWords.toProps({ ...iconWords.defaultParams, right: ' ' }).right).toBe('');
    const moved = iconWords.timeline.apply(raw(iconWords.defaultParams), 'left', 'move', 1.5, 2.6) as unknown as iconWords.IconRedWordsParams;
    expect(moved.leftAt).toBe(1.5);
  });
});
