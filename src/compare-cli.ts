import { resolve } from 'node:path';
import { buildDiffVideo, compareVideos, formatReport } from './export/compare.js';

/** 渲染结果与原片的逐帧比对。复刻迭代闭环的验收环节。 */

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i !== -1 ? process.argv[i + 1] : undefined;
}

const USAGE = `
渲染结果与原片比对

  pnpm compare --rendered <渲染出的.mp4> --original <原片片段.mp4> [--fps 10]
                [--mean 0.9] [--min 0.8] [--diff <差异视频.mp4>]

逐帧计算 SSIM，指出最不像的几帧和对应的帧文件；并分格检测「越往后越不像」的局部漂移。

退出码：0 通过 · 2 SSIM 未达标 · 3 SSIM 达标但有局部漂移（有动效没还原）
两边分辨率不同会自动缩放对齐，不影响判断。

--diff 会额外生成三联对比视频（原片 | 复刻 | 差异）。差异图里亮的地方就是对不上的地方。
纯色背景上的元素错位很难被 SSIM 罚到分，这种情况**一定要看差异视频**。
`;

async function main(): Promise<void> {
  const rendered = arg('rendered');
  const original = arg('original');
  if (!rendered || !original) { console.log(USAGE); process.exitCode = 1; return; }

  const threshold = {
    mean: arg('mean') ? Number(arg('mean')) : 0.9,
    min: arg('min') ? Number(arg('min')) : 0.8,
  };

  const report = await compareVideos(resolve(rendered), resolve(original), { threshold });
  console.log(formatReport(report, arg('fps') ? Number(arg('fps')) : 10));

  const diffOut = arg('diff');
  if (diffOut) {
    await buildDiffVideo(resolve(rendered), resolve(original), resolve(diffOut));
    console.log(`\n三联对比视频：${resolve(diffOut)}（左 原片 · 中 复刻 · 右 差异）`);
  }

  // 非零退出方便 agent 在脚本里判断要不要继续迭代：
  //   2 = SSIM 未达标
  //   3 = SSIM 达标但有局部漂移——总分会掩盖这个问题，所以单独给一个退出码，
  //       不让「总分过了」的版本被当成完成品交出去
  if (!report.passed) process.exitCode = 2;
  else if (report.drift?.drifting) process.exitCode = 3;
}

main().catch((err) => {
  console.error(`\n错误：${err instanceof Error ? err.message : String(err)}`);
  process.exitCode = 1;
});
