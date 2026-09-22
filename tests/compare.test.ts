import { describe, expect, it } from 'vitest';
import { formatReport, parseSsimLog, summarize } from '../src/export/compare.js';

const SAMPLE = `n:1 Y:0.815279 U:0.770129 V:0.749061 All:0.796718 (6.919008)
n:2 Y:0.915658 U:0.870368 V:0.849162 All:0.897027 (6.925618)
n:3 Y:0.995758 U:0.990502 V:0.989087 All:0.993104 (6.927257)
垃圾行，应被忽略
`;

describe('parseSsimLog', () => {
  it('解析 ffmpeg ssim 的逐帧输出', () => {
    const scores = parseSsimLog(SAMPLE);
    expect(scores).toEqual([
      { frame: 1, ssim: 0.796718 },
      { frame: 2, ssim: 0.897027 },
      { frame: 3, ssim: 0.993104 },
    ]);
  });

  it('忽略无法解析的行，不整体失败', () => {
    expect(parseSsimLog('completely unrelated\n')).toEqual([]);
  });
});

describe('summarize', () => {
  it('算平均值、最低值，并按最不像排序', () => {
    const r = summarize(parseSsimLog(SAMPLE));
    expect(r.frameCount).toBe(3);
    expect(r.meanSsim).toBeCloseTo(0.8956, 3);
    expect(r.minSsim).toBeCloseTo(0.7967, 3);
    expect(r.worstFrames[0]?.frame).toBe(1);
  });

  it('平均值达标但有单帧崩掉时判为未通过', () => {
    // 一帧崩了也不能算过——复刻里一帧错位就很扎眼
    const scores = [
      { frame: 1, ssim: 0.99 }, { frame: 2, ssim: 0.99 },
      { frame: 3, ssim: 0.99 }, { frame: 4, ssim: 0.50 },
    ];
    const r = summarize(scores);
    expect(r.meanSsim).toBeGreaterThan(0.85);
    expect(r.passed).toBe(false);
  });

  it('全部达标时判为通过', () => {
    const r = summarize([{ frame: 1, ssim: 0.95 }, { frame: 2, ssim: 0.93 }]);
    expect(r.passed).toBe(true);
  });

  it('没有任何帧时报错而不是返回 NaN', () => {
    expect(() => summarize([])).toThrow(/没有解析到/);
  });
});

describe('formatReport', () => {
  it('未达标时列出最差帧和对应的帧文件名', () => {
    const out = formatReport(summarize(parseSsimLog(SAMPLE)), 10);
    expect(out).toContain('❌ 未达标');
    expect(out).toContain('frames/f0001.png');
    expect(out).toContain('0.00s');
  });

  it('达标时不再列最差帧，避免噪音', () => {
    const out = formatReport(summarize([{ frame: 1, ssim: 0.97 }]));
    expect(out).toContain('✅ 达标');
    expect(out).not.toContain('优先看这些');
  });
});
