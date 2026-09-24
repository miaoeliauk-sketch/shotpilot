import { FFMPEG, run } from './ffmpeg.js';
import type { Shot } from '../core/types.js';

export interface DetectOptions {
  /** 只检测这个时间之后（秒）。用于对单个镜头做局部重切。 */
  from?: number;
  /** 只检测到这个时间为止（秒）。 */
  to?: number;
  /**
   * 场景变化阈值 0–1。低了会把镜头内的快速运动误判成切点，
   * 高了会漏掉相似画面之间的切换。0.3 对短视频（快剪、强色彩）实测比较稳。
   */
  threshold?: number;
  /**
   * 最短镜头时长（秒）。短视频里 3 帧一切的闪剪很常见，
   * 但标注时不需要那么细——太碎的镜头会合并到前一个。
   */
  minShotDuration?: number;
  timeoutMs?: number;
}

export interface Cut {
  /** 切点时间（秒），即新镜头的起点 */
  time: number;
  /** ffmpeg 给出的场景变化分数，留着让界面显示"这刀有多确定" */
  score: number;
}

const PTS_TIME = /pts_time:([0-9]*\.?[0-9]+)/;
const SCENE_SCORE = /lavfi\.scene_score=([0-9]*\.?[0-9]+)/;

/**
 * 用 ffmpeg 的 scene 滤镜找切点。
 *
 * metadata=print 会把每个候选帧的 pts_time 和 scene_score 打到 stdout，
 * 成对出现（先 frame 行后 score 行），所以按顺序配对解析。
 */
export async function detectCuts(videoPath: string, opts: DetectOptions = {}): Promise<Cut[]> {
  const threshold = opts.threshold ?? 0.3;
  if (threshold <= 0 || threshold >= 1) {
    throw new Error(`场景阈值必须在 0 和 1 之间，收到 ${threshold}`);
  }

  // -ss / -to 放在 -i 之前做输入端裁剪，只解码需要的那一段。
  // 对全片来说省不了多少，但局部重切时能把几分钟的解码缩到几秒。
  const rangeArgs: string[] = [];
  if (typeof opts.from === 'number' && opts.from > 0) rangeArgs.push('-ss', opts.from.toFixed(3));
  if (typeof opts.to === 'number' && opts.to > 0) rangeArgs.push('-to', opts.to.toFixed(3));

  const res = await run(FFMPEG, [
    '-hide_banner', '-nostats',
    ...rangeArgs,
    '-i', videoPath,
    '-filter_complex', `select='gt(scene,${threshold})',metadata=print:file=-`,
    '-an', '-f', 'null', '-',
  ], { timeoutMs: opts.timeoutMs ?? 30 * 60_000 });

  // scene 滤镜没有匹配帧时 ffmpeg 仍然正常退出，stdout 为空——那是"一镜到底"，不是错误。
  if (res.code !== 0) {
    const tail = res.stderr.trim().split('\n').slice(-6).join('\n');
    throw new Error(`场景检测失败（退出码 ${res.code}）\n${tail}`);
  }

  const cuts: Cut[] = [];
  let pendingTime: number | null = null;

  for (const line of res.stdout.split('\n')) {
    const timeMatch = PTS_TIME.exec(line);
    if (timeMatch?.[1] !== undefined) {
      pendingTime = Number(timeMatch[1]);
      continue;
    }
    const scoreMatch = SCENE_SCORE.exec(line);
    if (scoreMatch?.[1] !== undefined && pendingTime !== null) {
      cuts.push({ time: pendingTime, score: Number(scoreMatch[1]) });
      pendingTime = null;
    }
  }

  // 输入端裁剪后 ffmpeg 的 pts_time 从 0 重新计时，
  // 必须把起点偏移加回去，否则局部重切出来的切点会全部错位到片头。
  const offset = typeof opts.from === 'number' && opts.from > 0 ? opts.from : 0;
  return cuts
    .map((c) => ({ ...c, time: c.time + offset }))
    .sort((a, b) => a.time - b.time);
}

/**
 * 把切点变成镜头区间。
 *
 * 过短的镜头并入前一个：短视频里闪剪、抖动误判都会产生一堆 0.1 秒的碎片，
 * 那些不是"镜头"，标注它们纯属浪费时间。
 */
export function buildShots(cuts: Cut[], duration: number, opts: DetectOptions = {}): Shot[] {
  const minDur = opts.minShotDuration ?? 0.4;
  if (!Number.isFinite(duration) || duration <= 0) {
    throw new Error(`视频时长无效：${duration}`);
  }

  const boundaries = [0];
  for (const cut of cuts) {
    if (cut.time <= 0 || cut.time >= duration) continue;
    const last = boundaries[boundaries.length - 1] ?? 0;
    // 与上一个边界太近就丢弃，等价于把这个碎片并入前一个镜头
    if (cut.time - last >= minDur) boundaries.push(cut.time);
  }
  boundaries.push(duration);

  // 末尾镜头如果太短，把倒数第二个边界撤掉，避免收尾出现一个碎片
  if (boundaries.length >= 3) {
    const last = boundaries[boundaries.length - 1] as number;
    const prev = boundaries[boundaries.length - 2] as number;
    if (last - prev < minDur) boundaries.splice(boundaries.length - 2, 1);
  }

  const shots: Shot[] = [];
  for (let i = 0; i < boundaries.length - 1; i++) {
    const start = boundaries[i] as number;
    const end = boundaries[i + 1] as number;
    shots.push(emptyShot(i, start, end));
  }
  return shots;
}

export function emptyShot(index: number, start: number, end: number): Shot {
  return {
    id: `s${String(index + 1).padStart(3, '0')}`,
    index,
    start,
    end,
    roll: 'unset',
    annotation: {},
    annotationSource: {},
    effects: [],
    elements: [],
    note: '',
    reviewed: false,
  };
}

/**
 * 重新切分后保留已有标注。
 *
 * 调阈值重切是常态（第一次切太碎或太粗），如果每次重切都把标注清空，
 * 这个工具就没法用了。按时间重叠把旧标注迁移到新镜头：
 * 每个新镜头继承与它重叠最多的那个旧镜头的标注。
 */
export function carryOverAnnotations(oldShots: Shot[], newShots: Shot[]): Shot[] {
  const annotated = oldShots.filter(
    (s) => s.reviewed || s.note || s.roll !== 'unset' || !!s.library ||
      s.effects.length > 0 || s.elements.length > 0 ||
      Object.keys(s.annotation).length > 0,
  );
  if (annotated.length === 0) return newShots;

  return newShots.map((shot) => {
    let best: Shot | null = null;
    let bestOverlap = 0;
    for (const old of annotated) {
      const overlap = Math.min(shot.end, old.end) - Math.max(shot.start, old.start);
      if (overlap > bestOverlap) {
        bestOverlap = overlap;
        best = old;
      }
    }
    // 重叠不足新镜头的一半就不继承，避免把标注张冠李戴
    if (!best || bestOverlap < (shot.end - shot.start) / 2) return shot;
    return {
      ...shot,
      roll: best.roll,
      annotation: { ...best.annotation },
      annotationSource: { ...best.annotationSource },
      aiConfidence: best.aiConfidence ? { ...best.aiConfidence } : undefined,
      effects: [...best.effects],
      elements: [...best.elements],
      note: best.note,
      brollContent: best.brollContent,
      reviewed: best.reviewed,
      library: best.library ? { ...best.library, uses: [...best.library.uses] } : undefined,
    };
  });
}

/**
 * 重排镜头编号与序号。
 *
 * 手动拆分/合并之后必须跑一遍，否则胶片条上会出现 s007、s007、s008 这种重复编号。
 * 缩略图按起始时间命名（见 thumbnails.ts），所以重排 id 不需要动任何文件。
 */
export function renumber(shots: Shot[]): Shot[] {
  return [...shots]
    .sort((a, b) => a.start - b.start)
    .map((shot, index) => ({ ...shot, index, id: `s${String(index + 1).padStart(3, '0')}` }));
}

/** 手动补刀/合并的最小镜头长度。比自动切分的 0.4 更宽松——人工是有意为之，不该被拦。 */
export const MIN_MANUAL_SHOT = 0.1;

/**
 * 在指定时间把一个镜头拆成两个。
 *
 * 场景检测永远抓不到"同一个人、同一个背景、只换了机位"这类切换，
 * 而调低阈值只会让别处切碎。手动补刀才是正解：自动切 90%，剩下 10% 人补。
 *
 * 标注归属规则：**前半段保留全部标注和已审状态，后半段只继承 A/B-roll 归类**。
 * 理由是你发现漏刀时，之前标的那些描述的是你当时看到的画面，也就是前半段；
 * 而 A/B-roll 归类跨越整段大概率不变，继承下来能省一次按键。
 */
export function splitShot(shots: Shot[], shotId: string, time: number): Shot[] {
  const target = shots.find((s) => s.id === shotId);
  if (!target) throw new Error(`镜头不存在：${shotId}`);
  if (!Number.isFinite(time)) throw new Error(`切分时间无效：${time}`);
  if (time - target.start < MIN_MANUAL_SHOT || target.end - time < MIN_MANUAL_SHOT) {
    throw new Error(
      `切分点离镜头边界太近（需要距两端各至少 ${MIN_MANUAL_SHOT} 秒）。` +
      `当前镜头 ${target.start.toFixed(2)}–${target.end.toFixed(2)}，切分点 ${time.toFixed(2)}`,
    );
  }

  const first: Shot = { ...target, end: time };
  const second: Shot = {
    ...emptyShot(0, time, target.end),
    // 归类大概率跨段不变，继承下来省一次按键；其余标注留空等人工确认
    roll: target.roll,
  };

  const next = shots.flatMap((s) => (s.id === shotId ? [first, second] : [s]));
  return renumber(next);
}

/**
 * 把一个镜头并入它前面那个（撤销多余的刀）。
 *
 * 前一个镜头是合并后的"头"，保留它的标注；被并入的那个只把
 * 元素、特效、备注这些累加性的信息带过去，不覆盖已有判断。
 */
export function mergeWithPrevious(shots: Shot[], shotId: string): Shot[] {
  const index = shots.findIndex((s) => s.id === shotId);
  if (index === -1) throw new Error(`镜头不存在：${shotId}`);
  if (index === 0) throw new Error('第一个镜头前面没有镜头可以合并');

  const prev = shots[index - 1] as Shot;
  const current = shots[index] as Shot;

  const merged: Shot = {
    ...prev,
    end: current.end,
    // 累加性信息合并去重；判断性标注（景别/运镜等）以前一个为准，不被覆盖
    elements: [...new Set([...prev.elements, ...current.elements])],
    effects: [...new Set([...prev.effects, ...current.effects])],
    note: [prev.note, current.note].map((n) => n.trim()).filter(Boolean).join('\n'),
    brollContent: prev.brollContent || current.brollContent,
    // 边界变了，之前的"已审"不再成立
    reviewed: false,
  };

  const next = shots.filter((_, i) => i !== index - 1 && i !== index);
  next.splice(index - 1, 0, merged);
  return renumber(next);
}

/**
 * 在一个镜头内部按更低的阈值重新检测，把它切成若干段。
 *
 * 存在的理由：同一条片子里不同内容需要差一个数量级的阈值。
 * 口播段落人一动整帧都在变，场景分数很高；录屏演示只有鼠标和局部 UI 在变，
 * 占整帧不到 5%，分数被稀释到 0.0x 量级。全局用一个阈值必然顾此失彼——
 * 调低了口播段碎成渣，调高了录屏段一刀不切。所以只对选中的镜头单独降阈值。
 *
 * 前半段保留原标注，后续各段只继承 A/B-roll 归类，规则与手动补刀一致。
 */
export function splitShotByCuts(shots: Shot[], shotId: string, cuts: Cut[]): Shot[] {
  const target = shots.find((s) => s.id === shotId);
  if (!target) throw new Error(`镜头不存在：${shotId}`);

  const inside = cuts
    .map((c) => c.time)
    .filter((t) => t - target.start >= MIN_MANUAL_SHOT && target.end - t >= MIN_MANUAL_SHOT)
    .sort((a, b) => a - b);

  // 相邻切点太近的丢弃，避免切出一堆碎片
  const kept: number[] = [];
  for (const t of inside) {
    const last = kept[kept.length - 1] ?? target.start;
    if (t - last >= MIN_MANUAL_SHOT) kept.push(t);
  }
  if (kept.length === 0) return shots;

  const boundaries = [target.start, ...kept, target.end];
  const pieces: Shot[] = [];
  for (let i = 0; i < boundaries.length - 1; i++) {
    const start = boundaries[i] as number;
    const end = boundaries[i + 1] as number;
    pieces.push(
      i === 0
        ? { ...target, end }
        : { ...emptyShot(0, start, end), roll: target.roll },
    );
  }

  return renumber(shots.flatMap((s) => (s.id === shotId ? pieces : [s])));
}
