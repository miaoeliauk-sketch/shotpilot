import { FFMPEG, run } from '../analyze/ffmpeg.js';

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
  opts: { threshold?: { mean: number; min: number } } = {},
): Promise<CompareReport> {
  const res = await run(FFMPEG, [
    '-hide_banner', '-nostats',
    '-i', renderedPath,
    '-i', originalPath,
    '-lavfi', '[0:v]setpts=PTS-STARTPTS[a];[1:v]setpts=PTS-STARTPTS[b];[a][b]scale2ref=flags=bicubic[a2][b2];[a2][b2]ssim=stats_file=-',
    '-f', 'null', '-',
  ], { timeoutMs: 15 * 60_000 });

  if (res.code !== 0) {
    const tail = res.stderr.trim().split('\n').slice(-6).join('\n');
    throw new Error(`比对失败（退出码 ${res.code}）\n${tail}`);
  }

  // ssim 的 stats_file=- 写到 stdout，汇总行在 stderr
  const scores = parseSsimLog(res.stdout || res.stderr);
  return summarize(scores, opts.threshold);
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
): Promise<void> {
  const res = await run(FFMPEG, [
    '-hide_banner', '-nostats', '-loglevel', 'error',
    '-i', originalPath,
    '-i', renderedPath,
    '-filter_complex',
    [
      // 把复刻版缩放到原片尺寸，否则无法逐像素相减
      '[1:v]scale2ref=flags=bicubic[rep][orig]',
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
