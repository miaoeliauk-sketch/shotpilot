import { describe, expect, it } from 'vitest';
import { detectOnsets, estimateBpm, segmentAudio, toDb } from '../src/analyze/audio.js';
import type { Word } from '../src/core/types.js';

/** 造一条每 beatSec 秒出现一次尖峰的包络，模拟鼓点 */
function pulseEnvelope(durationSec: number, beatSec: number): Float32Array {
  const hz = 100;
  const env = new Float32Array(durationSec * hz);
  for (let i = 0; i < env.length; i++) env[i] = 0.05;
  for (let t = 0; t < durationSec; t += beatSec) {
    const idx = Math.round(t * hz);
    if (idx < env.length) env[idx] = 0.9;
  }
  return env;
}

describe('toDb', () => {
  it('满幅为 0 dBFS', () => expect(toDb(1)).toBeCloseTo(0, 5));
  it('半幅约 -6 dBFS', () => expect(toDb(0.5)).toBeCloseTo(-6.02, 1));
  it('零值钳到 -100 而不是 -Infinity', () => expect(toDb(0)).toBe(-100));
});

describe('detectOnsets / estimateBpm', () => {
  it('从 120 BPM 的脉冲里测出 120', () => {
    const onsets = detectOnsets(pulseEnvelope(20, 0.5));
    expect(onsets.length).toBeGreaterThan(8);
    expect(estimateBpm(onsets)).toBeGreaterThanOrEqual(118);
    expect(estimateBpm(onsets)).toBeLessThanOrEqual(122);
  });

  it('起音太少时返回 null 而不是编一个数字', () => {
    expect(estimateBpm([1, 2])).toBeNull();
  });

  it('节奏完全不规律时返回 null', () => {
    expect(estimateBpm([0, 0.3, 1.7, 2.1, 5.9, 6.3, 11.2, 19.4, 25.1])).toBeNull();
  });

  it('包络过短时不报错，返回空数组', () => {
    expect(detectOnsets(new Float32Array(10))).toEqual([]);
  });
});

describe('segmentAudio', () => {
  const loud = (n: number) => { const e = new Float32Array(n); e.fill(0.3); return e; };

  it('有词的区间标成人声+音乐，无词的有声区间标成音乐', () => {
    const words: Word[] = [{ text: '喂', start: 0, end: 2 }];
    const segments = segmentAudio(loud(500), words, 5);
    expect(segments[0]?.kind).toBe('speech-music');
    expect(segments.some((s) => s.kind === 'music')).toBe(true);
  });

  it('没有转写时只能标成音乐，并且不谎称是人声', () => {
    const segments = segmentAudio(loud(300), [], 3);
    expect(segments.every((s) => s.kind !== 'speech' && s.kind !== 'speech-music')).toBe(true);
  });

  it('静音区间被识别出来', () => {
    const env = new Float32Array(400);
    env.fill(0.3, 0, 200);
    env.fill(0.0001, 200, 400);
    const segments = segmentAudio(env, [], 4);
    expect(segments.some((s) => s.kind === 'silence')).toBe(true);
  });

  it('空包络返回空数组', () => {
    expect(segmentAudio(new Float32Array(0), [], 0)).toEqual([]);
  });
});
