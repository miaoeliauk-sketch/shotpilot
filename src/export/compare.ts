import { spawn } from 'node:child_process';
import { FFMPEG, run } from '../analyze/ffmpeg.js';
import { probeMedia } from '../analyze/probe.js';

/**
 * 比对时遮掉的区域（按原片像素坐标）。
 *
 * 用来排除不属于复刻范围的东西，最常见的是口播字幕：它是后期加的，复刻不做，
 * 但原片里烧进去了——不遮掉的话那一块永远对不上，把真正的问题淹没。
 * 两边同一位置都涂黑，于是那一块误差恒为 0。
 */
export interface MaskRect { x: number; y: number; w: number; h: number }

/** 解析 "x,y,宽,高"。写错就直接报错，不猜。 */
export function parseMask(text: string): MaskRect {
  const parts = text.split(',').map((v) => Number(v.trim()));
  const [x, y, w, h] = parts;
  if (parts.length !== 4 || parts.some((v) => !Number.isFinite(v)) || (w ?? 0) <= 0 || (h ?? 0) <= 0) {
    throw new Error(`遮罩格式应为 x,y,宽,高（例如 0,610,1280,90），收到「${text}」`);
  }
  return { x: x as number, y: y as number, w: w as number, h: h as number };
}

/** 生成 ffmpeg 的涂黑滤镜链。没有遮罩时返回 null 滤镜（原样通过）。 */
export function maskChain(masks: MaskRect[]): string {
  if (masks.length === 0) return 'null';
  return masks
    .map((m) => `drawbox=x=${Math.round(m.x)}:y=${Math.round(m.y)}:w=${Math.round(m.w)}:h=${Math.round(m.h)}:color=black:t=fill`)
    .join(',');
}

/**
 * 渲染结果与原片的逐帧比对。
 *
 * 这是让复刻能**收敛**的关键。没有可测量的目标，agent 改完只能问自己"像了吗"，
 * 于是越改越飘——这一轮把标题挪对了，下一轮又把动效改坏了，没人知道整体是变好还是变差。
 *
 * 用 ffmpeg 的 SSIM 滤镜逐帧打分：SSIM 衡量结构相似度（亮度/对比度/结构三项综合），
 * 比单纯的像素差更接近人眼判断，而且是每帧一个数，能精确指出**哪几帧最不像**。
 * agent 拿着那几个帧号回帧序列里对照，就能针对性改，而不是全局瞎调。
 */

export interface FrameScore {
  /** 帧号，从 1 开始，与帧序列文件名对应 */
  frame: number;
  ssim: number;
}

export interface CompareReport {
  /** 分格漂移检测结果，见 detectDrift。比对时未做分格检测则为 null。 */
  drift: DriftReport | null;
  /** 全片平均 SSIM，0–1，越大越像 */
  meanSsim: number;
  minSsim: number;
  frameCount: number;
  /** 最不像的若干帧，agent 应该优先看这些 */
  worstFrames: FrameScore[];
  /** 是否达到可交付标准 */
  passed: boolean;
  threshold: { mean: number; min: number };
}

export interface DriftTile {
  row: number;
  col: number;
  /** 九宫格方位，给人读 */
  region: string;
  head: number;
  tail: number;
  increase: number;
}

export interface DriftReport {
  drifting: boolean;
  maxIncrease: number;
  tiles: DriftTile[];
}

/** 判为漂移的误差增量阈值（0–255，在 320×180 缩略图上算）。
 *  实测：投影静止的错误版本最大增量 +13.7，正确版本 +1.6。取 4 留足余量。 */
export const DRIFT_THRESHOLD = 4;

const REGION_NAMES = [
  ['左上', '上方', '右上'],
  ['左侧', '中央', '右侧'],
  ['左下', '下方', '右下'],
];

/**
 * 分格检测「越往后越不像」。
 *
 * 为什么不直接看全幅 SSIM 的首尾趋势：实测案例里投影在旋转、复刻是静止的，
 * 投影区误差从 0.55 涨到 13.4，可全幅 SSIM 首尾反而是**上升**的——
 * 字幕在中途换成了更短的句子，字幕区误差下降，把投影区的恶化整个盖住了。
 * 画面不同区域的误差会朝相反方向变，平均一下就互相抵消。所以必须分格各看各的。
 *
 * 只报「增量」不报「减量」：误差变小（比如换了更短的字幕）不是问题。
 *
 * @param ref  原片逐帧灰度，每帧 w*h
 * @param rend 复刻逐帧灰度
 */
export function detectDrift(
  ref: Float32Array[], rend: Float32Array[], w: number, h: number,
  grid = { cols: 8, rows: 6 }, threshold = DRIFT_THRESHOLD,
): DriftReport {
  const n = Math.min(ref.length, rend.length);
  if (n < 6) return { drifting: false, maxIncrease: 0, tiles: [] };
  const tw = Math.floor(w / grid.cols);
  const th = Math.floor(h / grid.rows);
  const third = Math.floor(n / 3);

  const tileErr = (frame: number, row: number, col: number): number => {
    const a = ref[frame] as Float32Array;
    const b = rend[frame] as Float32Array;
    let sum = 0;
    for (let y = row * th; y < (row + 1) * th; y++) {
      for (let x = col * tw; x < (col + 1) * tw; x++) sum += Math.abs((a[y * w + x] ?? 0) - (b[y * w + x] ?? 0));
    }
    return sum / (tw * th);
  };

  const tiles: DriftTile[] = [];
  let maxIncrease = 0;
  for (let row = 0; row < grid.rows; row++) {
    for (let col = 0; col < grid.cols; col++) {
      let head = 0, tail = 0;
      for (let f = 0; f < third; f++) head += tileErr(f, row, col);
      for (let f = n - third; f < n; f++) tail += tileErr(f, row, col);
      head /= third; tail /= third;
      const increase = tail - head;
      maxIncrease = Math.max(maxIncrease, increase);
      if (increase > threshold) {
        const ry = Math.min(2, Math.floor((row + 0.5) / grid.rows * 3));
        const rx = Math.min(2, Math.floor((col + 0.5) / grid.cols * 3));
        tiles.push({
          row, col, region: REGION_NAMES[ry]?.[rx] ?? '',
          head: Number(head.toFixed(1)), tail: Number(tail.toFixed(1)), increase: Number(increase.toFixed(1)),
        });
      }
    }
  }
  tiles.sort((a, b) => b.increase - a.increase);
  return { drifting: tiles.length > 0, maxIncrease: Number(maxIncrease.toFixed(1)), tiles };
}

/** 把视频解码成缩小的逐帧灰度。二进制输出，不能走 run()（它按字符串收集 stdout）。 */
export function decodeGray(
  path: string, w = 320, h = 180,
  base?: { width: number; height: number; masks: MaskRect[] },
): Promise<Float32Array[]> {
  // 有 base 时先统一缩放到原片尺寸，再按原片坐标涂黑遮罩区，最后缩小——
  // 两个视频分辨率不同也能用同一套遮罩坐标
  const pre = base ? `scale=${base.width}:${base.height},${maskChain(base.masks)},` : '';
  return new Promise((resolve, reject) => {
    const child = spawn(FFMPEG, [
      '-hide_banner', '-loglevel', 'error', '-i', path,
      '-vf', `${pre}scale=${w}:${h}:flags=area,format=gray`, '-f', 'rawvideo', '-',
    ], { stdio: ['ignore', 'pipe', 'pipe'] });
    const chunks: Buffer[] = [];
    let stderr = '';
    child.stdout.on('data', (d: Buffer) => chunks.push(d));
    child.stderr.on('data', (d) => { stderr += d.toString(); });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code !== 0) { reject(new Error(`解码失败：${stderr.trim().split('\n').slice(-3).join('\n')}`)); return; }
      const buf = Buffer.concat(chunks);
      const frameSize = w * h;
      const frames: Float32Array[] = [];
      for (let off = 0; off + frameSize <= buf.length; off += frameSize) {
        frames.push(Float32Array.from(buf.subarray(off, off + frameSize)));
      }
      resolve(frames);
    });
  });
}

// ffmpeg ssim 滤镜的输出行形如：
// n:1 Y:0.987654 U:0.99 V:0.99 All:0.981234 (17.123456)
const SSIM_LINE = /n:(\d+).*?All:([0-9]*\.?[0-9]+)/;

export function parseSsimLog(raw: string): FrameScore[] {
  const scores: FrameScore[] = [];
  for (const line of raw.split('\n')) {
    const m = SSIM_LINE.exec(line);
    if (!m?.[1] || !m[2]) continue;
    const ssim = Number(m[2]);
    if (!Number.isFinite(ssim)) continue;
    scores.push({ frame: Number(m[1]), ssim });
  }
  return scores;
}

export function summarize(
  scores: FrameScore[],
  threshold = { mean: 0.9, min: 0.8 },
  worstCount = 8,
): CompareReport {
  if (scores.length === 0) {
    throw new Error('没有解析到任何帧的 SSIM。两个视频可能分辨率不同或时长为零。');
  }
  const sum = scores.reduce((acc, s) => acc + s.ssim, 0);
  const meanSsim = sum / scores.length;
  const sorted = [...scores].sort((a, b) => a.ssim - b.ssim);
  const minSsim = sorted[0]?.ssim ?? 0;

  return {
    drift: null,
    meanSsim: Number(meanSsim.toFixed(4)),
    minSsim: Number(minSsim.toFixed(4)),
    frameCount: scores.length,
    worstFrames: sorted.slice(0, worstCount).map((s) => ({ frame: s.frame, ssim: Number(s.ssim.toFixed(4)) })),
    passed: meanSsim >= threshold.mean && minSsim >= threshold.min,
    threshold,
  };
}

/**
 * 比对两个视频。
 *
 * 两边分辨率不同时把渲染结果缩放到原片尺寸再比——复刻常常按不同分辨率渲染，
 * 因为分辨率不同就拒绝比对，等于把最常见的情况挡在门外。
 */
export async function compareVideos(
  renderedPath: string,
  originalPath: string,
  opts: { threshold?: { mean: number; min: number }; masks?: MaskRect[] } = {},
): Promise<CompareReport> {
  const masks = opts.masks ?? [];
  const chain = maskChain(masks);
  const res = await run(FFMPEG, [
    '-hide_banner', '-nostats',
    '-i', renderedPath,
    '-i', originalPath,
    // 先把复刻版缩放到原片尺寸，再按原片坐标涂黑遮罩区，最后比
    '-lavfi', `[0:v]setpts=PTS-STARTPTS[a];[1:v]setpts=PTS-STARTPTS[b];[a][b]scale2ref=flags=bicubic[a2][b2];[a2]${chain}[a3];[b2]${chain}[b3];[a3][b3]ssim=stats_file=-`,
    '-f', 'null', '-',
  ], { timeoutMs: 15 * 60_000 });

  if (res.code !== 0) {
    const tail = res.stderr.trim().split('\n').slice(-6).join('\n');
    throw new Error(`比对失败（退出码 ${res.code}）\n${tail}`);
  }

  // ssim 的 stats_file=- 写到 stdout，汇总行在 stderr
  const scores = parseSsimLog(res.stdout || res.stderr);
  const report = summarize(scores, opts.threshold);

  // 漂移检测也要遮掉同样的区域，否则字幕换句会被当成「越往后越不像」
  const { width, height } = await probeMedia(originalPath);
  const base = { width, height, masks };
  const [ref, rend] = await Promise.all([decodeGray(originalPath, 320, 180, base), decodeGray(renderedPath, 320, 180, base)]);
  report.drift = detectDrift(ref, rend, 320, 180);
  return report;
}

/** 把报告渲染成给人和 agent 都好读的文本。 */
export function formatReport(report: CompareReport, fps = 10): string {
  const lines: string[] = [];
  lines.push(report.passed ? '## ✅ 达标' : '## ❌ 未达标，继续迭代');
  lines.push('');
  lines.push(`- 平均 SSIM：**${report.meanSsim}**（目标 ≥ ${report.threshold.mean}）`);
  lines.push(`- 最低单帧：**${report.minSsim}**（目标 ≥ ${report.threshold.min}）`);
  lines.push(`- 比对帧数：${report.frameCount}`);
  lines.push('');

  if (report.drift?.drifting) {
    const where = [...new Set(report.drift.tiles.map((t) => t.region))].join('、');
    lines.push('### ⚠️ 局部越往后越不像');
    lines.push('');
    lines.push(`画面**${where}**的误差随时间持续变大（最大增量 +${report.drift.maxIncrease}）。`);
    lines.push('原片那里很可能有东西在**缓慢运动**（投影旋转、缓慢推拉、颜色渐变），而复刻是静止的。');
    lines.push('逐帧拟合那个区域的元素，看它的参数怎么随帧号变。');
    lines.push('');
    lines.push('> 这个问题全幅 SSIM 看不出来：其他区域的变化（比如字幕换句）会把它掩盖掉，');
    lines.push('> 即使总分「达标」也要看这一节。');
    lines.push('');
  }

  if (!report.passed) {
    lines.push('### 最不像的几帧 —— 优先看这些');
    lines.push('');
    lines.push('| 帧号 | SSIM | 镜头内时间 | 对照文件 |');
    lines.push('| ---: | ---: | ---: | --- |');
    for (const f of report.worstFrames) {
      const seconds = ((f.frame - 1) / fps).toFixed(2);
      lines.push(`| ${f.frame} | ${f.ssim} | ${seconds}s | \`frames/f${String(f.frame).padStart(4, '0')}.png\` |`);
    }
    lines.push('');
    lines.push('拿这些帧号回 `frames/` 里逐一对照，看是位置偏了还是动效曲线不对，改完重新渲染再比。');
  }
  return lines.join('\n');
}

/**
 * 生成三联对比视频：原片 | 复刻 | 差异。
 *
 * 为什么光有 SSIM 不够：SSIM 是全帧平均，而 B-roll 的典型形态是「文字压在纯色底上」——
 * 标题偏了 20px，但画面 80% 是没变化的纯色背景，分数照样能到 0.97 蒙混过关。
 * 差异图把变化区域点亮，agent 一眼就能看出是哪个元素错位，而不是对着一个数字瞎猜。
 */
export async function buildDiffVideo(
  renderedPath: string,
  originalPath: string,
  outPath: string,
  masks: MaskRect[] = [],
): Promise<void> {
  const chain = maskChain(masks);
  const res = await run(FFMPEG, [
    '-hide_banner', '-nostats', '-loglevel', 'error',
    '-i', originalPath,
    '-i', renderedPath,
    '-filter_complex',
    [
      // 把复刻版缩放到原片尺寸，否则无法逐像素相减
      '[1:v]scale2ref=flags=bicubic[rep0][orig0]',
      // 遮罩区在三格里都涂黑，一眼看出哪块不参与比对
      `[orig0]${chain}[orig]`,
      `[rep0]${chain}[rep]`,
      '[orig]split=2[o1][o2]',
      '[rep]split=2[r1][r2]',
      // 差异层转灰度再提对比度：黑 = 完全一致，越亮 = 差得越多，无歧义。
      // 保留彩色会让平坦区域的微小色差染出一片颜色，反而看不出真正错位的边缘在哪。
      '[o2][r2]blend=all_mode=difference,format=gray,eq=brightness=0.02:contrast=4[diff]',
      '[o1][r1][diff]hstack=inputs=3[out]',
    ].join(';'),
    '-map', '[out]',
    '-c:v', 'libx264', '-preset', 'fast', '-crf', '20',
    '-y', outPath,
  ], { timeoutMs: 15 * 60_000 });

  if (res.code !== 0) {
    const tail = res.stderr.trim().split('\n').slice(-6).join('\n');
    throw new Error(`生成差异视频失败（退出码 ${res.code}）\n${tail}`);
  }
}
