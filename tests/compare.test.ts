import { describe, expect, it } from 'vitest';
import { detectDrift, formatReport, maskChain, parseMask, parseSsimLog, summarize } from '../src/export/compare.js';

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

describe('detectDrift（分格漂移检测）', () => {
  const W = 32, H = 18;
  /** 造一段视频：每帧灰度 = base，并允许指定某块区域逐帧变化 */
  const video = (n: number, paint: (f: number, x: number, y: number) => number) =>
    Array.from({ length: n }, (_, f) => {
      const a = new Float32Array(W * H);
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) a[y * W + x] = paint(f, x, y);
      return a;
    });
  const grid = { cols: 4, rows: 3 };

  it('局部区域越来越不像时报警，并说出在哪', () => {
    const ref = video(30, () => 200);
    // 右上角那块在复刻里是静止的，而原片逐帧变暗——模拟投影在转
    const refMoving = video(30, (f, x, y) => (x >= 24 && y < 6 ? 200 - f * 1.5 : 200));
    const r = detectDrift(refMoving, ref, W, H, grid, 4);
    expect(r.drifting).toBe(true);
    expect(r.tiles[0]?.region).toBe('右上');
  });

  it('另一区域同时变好时依然能抓住——这是全幅指标漏掉的场景', () => {
    // 右上越来越差，同时下方（字幕区）越来越好，全幅平均几乎不变
    const refV = video(30, (f, x, y) => (x >= 24 && y < 6 ? 200 - f * 1.5 : y >= 12 ? 200 : 200));
    const rend = video(30, (f, x, y) => (y >= 12 ? 200 - (30 - f) * 1.5 : 200));
    const r = detectDrift(refV, rend, W, H, grid, 4);
    expect(r.drifting).toBe(true);
    expect(r.tiles.some((t) => t.region === '右上')).toBe(true);
    // 变好的区域不报
    expect(r.tiles.every((t) => !t.region.includes('下'))).toBe(true);
  });

  it('误差恒定（哪怕很大）时不报——那是静态偏差，不是漂移', () => {
    const r = detectDrift(video(30, () => 200), video(30, () => 150), W, H, grid, 4);
    expect(r.drifting).toBe(false);
  });

  it('帧数太少时不判断', () => {
    expect(detectDrift(video(4, () => 0), video(4, () => 255), W, H, grid).drifting).toBe(false);
  });
});

describe('formatReport 漂移提示', () => {
  it('有漂移时即使总分达标也会提示', () => {
    const r = summarize([{ frame: 1, ssim: 0.99 }, { frame: 2, ssim: 0.99 }]);
    r.drift = { drifting: true, maxIncrease: 13.7, tiles: [{ row: 3, col: 5, region: '右侧', head: 1.8, tail: 15.5, increase: 13.7 }] };
    const out = formatReport(r, 30);
    expect(out).toContain('✅ 达标');
    expect(out).toContain('局部越往后越不像');
    expect(out).toContain('右侧');
  });
});

describe('遮罩', () => {
  it('解析 x,y,宽,高', () => {
    expect(parseMask('0,610,1280,90')).toEqual({ x: 0, y: 610, w: 1280, h: 90 });
    expect(parseMask(' 10, 20 ,30,40 ')).toEqual({ x: 10, y: 20, w: 30, h: 40 });
  });

  it('格式不对直接报错，不猜', () => {
    expect(() => parseMask('0,610,1280')).toThrow(/x,y,宽,高/);
    expect(() => parseMask('a,b,c,d')).toThrow(/x,y,宽,高/);
    expect(() => parseMask('0,0,0,90')).toThrow(/x,y,宽,高/);
  });

  it('生成涂黑滤镜链；没有遮罩时原样通过', () => {
    expect(maskChain([])).toBe('null');
    expect(maskChain([{ x: 0, y: 610, w: 1280, h: 90 }])).toBe('drawbox=x=0:y=610:w=1280:h=90:color=black:t=fill');
    expect(maskChain([{ x: 1, y: 2, w: 3, h: 4 }, { x: 5, y: 6, w: 7, h: 8 }]).split(',drawbox')).toHaveLength(2);
  });
});
