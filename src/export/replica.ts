import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { FFMPEG, runOrThrow } from '../analyze/ffmpeg.js';
import { type ReelProject, type Shot } from '../core/types.js';
import { labelOf } from '../core/vocabulary.js';

/**
 * 复刻包：喂给 coding agent 去还原一个镜头的全部素材。
 *
 * 设计出发点是「复刻」而非「生成」——第一指标是**像**，不是创意。
 * 所以包里每一样东西都服务于还原精度：
 *
 *   - **逐帧序列**是核心。单张关键帧看不出元素怎么入场、怎么移动、怎么缩放、怎么退出，
 *     而动效恰恰是最难口头描述、最需要逐帧观察的部分。
 *   - **原片片段**是验收基准。没有它就没法做渲染比对，agent 只能凭感觉改，越改越飘。
 *   - **槽位定义**决定产出是一次性复刻还是可复用的预设。
 */

/**
 * 镜头可安全截取的时长：终点往回让半帧。
 *
 * 镜头终点就是下一个镜头第一帧的时间戳（场景检测给的是切点）。
 * 若直接用 end - start 当 -t，再经 toFixed(3) 四舍五入，时长可能多出零点几毫秒，
 * 刚好把下一个镜头的第一帧也截进来——实测一条 2.17 秒的镜头因此多了一帧完全无关的画面，
 * 复刻比对时这一帧整张都算错。让半帧（30fps 下 16.7ms）远大于任何舍入误差，
 * 又不会丢掉本镜头的最后一帧。
 */
export function safeClipDuration(shot: Pick<Shot, 'start' | 'end'>, fps: number): number {
  const raw = Math.max(0, shot.end - shot.start);
  if (!Number.isFinite(fps) || fps <= 0) return raw;
  return Math.max(0, raw - 0.5 / fps);
}

export interface ReplicaOptions {
  /** 帧序列的采样率。10fps 足够看清动效，又不会让 agent 被几百张图淹没。 */
  fps?: number;
  /** 帧宽度。文字位置和图片比例在 720 宽下已经能精确量取。 */
  width?: number;
}

/** 抽出镜头的逐帧序列。动效分析全靠它。 */
async function extractFrameSequence(
  videoPath: string, shot: Shot, outDir: string, opts: Required<ReplicaOptions>, sourceFps: number,
): Promise<number> {
  await mkdir(outDir, { recursive: true });
  const duration = safeClipDuration(shot, sourceFps);
  await runOrThrow(FFMPEG, [
    '-hide_banner', '-nostats', '-loglevel', 'error',
    '-ss', shot.start.toFixed(3),
    '-t', duration.toFixed(3),
    '-i', videoPath,
    '-vf', `fps=${opts.fps},scale=${opts.width}:-2`,
    '-y', join(outDir, 'f%04d.png'),
  ], { timeoutMs: 10 * 60_000 });
  return Math.max(1, Math.round(duration * opts.fps));
}

/** 裁出原片这一段。渲染比对的基准，没有它整个迭代闭环就断了。 */
async function extractClip(videoPath: string, shot: Shot, outPath: string, sourceFps: number): Promise<void> {
  await runOrThrow(FFMPEG, [
    '-hide_banner', '-nostats', '-loglevel', 'error',
    '-ss', shot.start.toFixed(3),
    '-t', safeClipDuration(shot, sourceFps).toFixed(3),
    '-i', videoPath,
    // 重新编码而不是 -c copy：copy 会从最近的关键帧开始，头几帧可能不是我们要的那一段
    '-c:v', 'libx264', '-preset', 'fast', '-crf', '18',
    // 只管画面，不带音轨
    '-an',
    '-y', outPath,
  ], { timeoutMs: 10 * 60_000 });
}

/** 镜头的结构化描述，给 agent 读。 */
export function shotManifest(project: ReelProject, shot: Shot, frameCount: number, opts: Required<ReplicaOptions>) {
  const a = shot.annotation;
  return {
    generator: 'shotpilot@0.1.0',
    shot: {
      id: shot.id,
      sourceFile: project.source.filename,
      startInSource: Number(shot.start.toFixed(3)),
      endInSource: Number(shot.end.toFixed(3)),
      duration: Number((shot.end - shot.start).toFixed(3)),
      roll: shot.roll,
      rollLabel: labelOf('roll', shot.roll),
    },
    canvas: {
      width: project.source.width,
      height: project.source.height,
      fps: project.source.fps,
      aspectRatio: project.source.height > 0
        ? Number((project.source.width / project.source.height).toFixed(4))
        : null,
    },
    frames: {
      dir: 'frames/',
      pattern: 'f%04d.png',
      count: frameCount,
      fps: opts.fps,
      /** 第 n 张帧对应镜头内的秒数 = (n - 1) / fps */
      note: '帧号从 1 开始；帧 n 对应镜头内时间 (n-1)/fps 秒',
    },
    annotation: {
      shotSize: labelOf('shotSize', a.shotSize) || null,
      cameraMove: labelOf('cameraMove', a.cameraMove) || null,
      composition: (a.composition ?? []).map((c) => labelOf('composition', c)),
      lighting: (a.lighting ?? []).map((l) => labelOf('lighting', l)),
      angle: labelOf('angle', a.angle) || null,
      transitionIn: labelOf('transitionIn', a.transitionIn) || null,
    },
    elements: shot.elements,
    effects: shot.effects,
    note: shot.note,
    brollContent: shot.brollContent ?? null,
    /** 可替换槽位。空数组表示还没标，agent 应在第一步里提议槽位划分。 */
    slots: shot.slots ?? [],
  };
}

/** agent 的入口指令。按「摆位 → 动效 → 比对迭代」三步组织。 */
export function replicaInstructions(project: ReelProject, shot: Shot, frameCount: number, opts: Required<ReplicaOptions>): string {
  const dur = (shot.end - shot.start).toFixed(2);
  return `# 复刻任务：${shot.id}

把 \`clip.mp4\` 这一段的**画面**用 [Remotion](https://www.remotion.dev) 还原成代码。

**第一指标是像。** 不是好看，不是创意，是跟原片对得上。

## 范围：只复刻画面

- **不管声音。** 背景音乐、人声都不做，\`clip.mp4\` 也不带音轨。
- **不复刻口播字幕。** 跟着说话滚动的那行字幕是后期加的，不属于这个镜头的设计。
  原片里如果有，比对时用 \`--mask\` 把字幕区域遮掉（见第三步）。
- **画面设计里的文字要复刻。** 标题、字卡、文字框、标签这些是画面的一部分，照常还原。

## 素材

| 文件 | 内容 |
| --- | --- |
| \`clip.mp4\` | 原片这一段（${dur} 秒），**验收基准** |
| \`frames/f0001.png\` … \`f${String(frameCount).padStart(4, '0')}.png\` | 逐帧序列，${opts.fps}fps。帧 n 对应镜头内 (n-1)/${opts.fps} 秒 |
| \`shot.json\` | 画布尺寸、时长、画面标注、槽位定义 |

画布：**${project.source.width}×${project.source.height}**，原片 ${project.source.fps.toFixed(2)}fps，时长 **${dur} 秒**。

## 第一步：把画面摆对

翻 \`frames/\` 找到画面最完整、元素最齐的那一帧作为基准帧，然后：

1. 列出画面里的每个元素：文字、图片、图形、装饰、背景
2. 量出每个元素的**位置和尺寸**，用相对画布的百分比表示（换分辨率才不会错位）
3. 记录字体特征：字重、字号相对画布高度的比例、字间距、颜色、描边/阴影/辉光
4. 记录层级关系：谁压在谁上面
5. 用 Remotion 把静态版本写出来，**先不做任何动画**
6. 渲染这一帧，跟基准帧比对，位置对不上就改，直到静态画面能对齐

**这一步结束时必须明确：哪些元素是结构（固定不动），哪些是内容槽（可替换）。**
\`shot.json\` 的 \`slots\` 字段若非空，按它来；若为空，你来提议划分并写进代码的 props。

## 第二步：把动效做对

对每个元素，从帧序列里读出：

- **入场**：第几帧开始出现，从哪个方向/状态进来，用了多少帧
- **运动**：位置、缩放、旋转、透明度随帧号怎么变
- **缓动曲线**：匀速？先快后慢？有没有回弹？—— 逐帧取值，别猜
- **退出**：第几帧开始消失，怎么消失

还要记录：元素之间的**先后关系**（谁先进谁后进、间隔几帧）、整段的**转场节奏**。

用 Remotion 的 \`useCurrentFrame()\` 和 \`interpolate()\` 实现，帧号直接对应帧序列的编号。

## 第三步：渲染比对，迭代到像

\`\`\`bash
npx remotion render <composition> out.mp4
\`\`\`

然后用 ShotPilot 的比对工具打分：

\`\`\`bash
pnpm compare --rendered out.mp4 --original clip.mp4
\`\`\`

原片里有口播字幕的话，加 \`--mask x,y,宽,高\` 把字幕区域遮掉（坐标按原片像素，可以写多个），
不然那一块永远对不上，会干扰判断。例如字幕在画面底部：

\`\`\`bash
pnpm compare --rendered out.mp4 --original clip.mp4 --mask 0,610,${project.source.width},90
\`\`\`

它会逐帧算 SSIM 并告诉你**哪几帧差最多**。拿着那几帧的帧号回到 \`frames/\` 里对照，
针对性地改位置或曲线，再渲染再比。**不要凭感觉改**——每轮都要看分数有没有涨。

目标：平均 SSIM ≥ 0.90，且没有单帧低于 0.80。达不到就继续迭代。

**但 SSIM 达标不等于像。** 大面积平坦背景会把全幅分数撑高——实测案例在投影方向错误、
黑边也不对的时候，全幅 SSIM 就已经 0.976 了。一定要：

- 用 \`--diff\` 生成三联对比视频，**看**差异图里哪里亮
- 按区域（背景 / 主体 / 装饰 / 文字）分别算误差，别只看一个总分
- 看报告里有没有「局部越往后越不像」，有就说明有动效没还原（这时退出码是 3）

## 常见陷阱

这四个都在真实复刻里踩过：

1. **别假设它是静止的。** 边框不动不代表投影不动。拟合完看误差随帧号怎么变——线性增长就是有东西在动。
2. **别假设元素之间有关系。** 看起来同心的两个圆，实测中心差 1px、半径也不是估的那个。每个元素独立测量。
3. **找边缘别用亮度阈值。** 抗锯齿会让阈值法系统性地低估尺寸。沿法线方向找亮度变化最陡的位置。
4. **字形对不上时，像素指标会偏爱画得更淡。** 字体不同，笔画天然错位，多画一笔会被扣两次分，
   所以误差最低的候选往往又细又空。这种时候按肉眼选，并说明原因。

## 交付

1. Remotion 组件代码，槽位暴露成 props
2. 渲染出的 mp4
3. 比对报告（最终 SSIM）
4. 一句话说明：换哪些 props 可以把这个镜头复用到下一条视频
`;
}

export interface BuildResult {
  dir: string;
  frameCount: number;
}

/** 为一个镜头生成完整的复刻包。 */
export async function buildReplicaPackage(
  project: ReelProject,
  shot: Shot,
  outputRoot: string,
  options: ReplicaOptions = {},
): Promise<BuildResult> {
  const opts: Required<ReplicaOptions> = {
    fps: options.fps ?? 10,
    width: options.width ?? 720,
  };

  const dir = join(outputRoot, `replica-${shot.id}`);
  await mkdir(dir, { recursive: true });

  const fps = project.source.fps;
  const frameCount = await extractFrameSequence(project.source.path, shot, join(dir, 'frames'), opts, fps);
  await extractClip(project.source.path, shot, join(dir, 'clip.mp4'), fps);

  const manifest = shotManifest(project, shot, frameCount, opts);
  await writeFile(join(dir, 'shot.json'), JSON.stringify(manifest, null, 2), 'utf8');
  await writeFile(join(dir, 'README.md'), replicaInstructions(project, shot, frameCount, opts), 'utf8');

  return { dir, frameCount };
}
