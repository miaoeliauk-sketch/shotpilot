import { FFMPEG, run } from './ffmpeg.js';
import type { Shot } from '../core/types.js';

export interface DetectOptions {
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

  const res = await run(FFMPEG, [
    '-hide_banner', '-nostats',
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

  return cuts.sort((a, b) => a.time - b.time);
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
    (s) => s.reviewed || s.note || s.roll !== 'unset' ||
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
    };
  });
}
