import type {
  BrollNeed, CameraAngle, CameraMove, Composition,
  FocalLength, Lighting, RollKind, ShotSize, Transition,
} from './vocabulary.js';

/** 存盘格式版本。破坏性改动时 +1，并在 project.ts 里加迁移。 */
export const PROJECT_VERSION = 1;

export interface SourceMedia {
  /** 原始视频的绝对路径。视频不复制进项目目录，只引用。 */
  path: string;
  filename: string;
  /** 秒 */
  duration: number;
  width: number;
  height: number;
  fps: number;
  hasAudio: boolean;
  /** 字节 */
  size: number;
  /** ffprobe 原始字段，留着以备后续需要而不用重新探测 */
  container?: string;
  videoCodec?: string;
  audioCodec?: string;
}

/** 一个镜头上的结构化标注。全部可空——没标 ≠ 标了"无"。 */
export interface ShotAnnotation {
  shotSize?: ShotSize;
  cameraMove?: CameraMove;
  /** 构图可叠加，比如「三分法 + 留白」 */
  composition?: Composition[];
  focalLength?: FocalLength;
  /** 需要精确值时填，和 focalLength 档位并存 */
  focalLengthMm?: number;
  lighting?: Lighting[];
  angle?: CameraAngle;
  transitionIn?: Transition;
  brollNeed?: BrollNeed;
}

/**
 * 标注的来源。区分人工和 AI 是刚需：
 * AI 初判可以批量覆盖，人工改过的绝不能被下一轮 AI 覆盖掉。
 */
export type AnnotationSource = 'manual' | 'ai' | 'ai-edited';

/**
 * 可替换槽位。
 *
 * 这是「复刻」和「预设」的分界线：
 *   - 只复刻 = 把这条视频重做一遍，用完就扔
 *   - 标出槽位 = 区分开「结构」（构图、运动节奏、图层关系）和「内容」（这行字、这张图），
 *     换掉槽位内容就是下一条视频，花一次时间能一直复用
 *
 * 结构留在 Remotion 代码里，槽位是代码里暴露出来的 props。
 */
export interface Slot {
  id: string;
  kind: SlotKind;
  /** 这个槽位是什么，写给人和 agent 看，例如「主标题」「背景图」「强调色」 */
  label: string;
  /** 原片里这个位置的内容。复刻时当参照，换内容时当对照。 */
  originalValue?: string;
  /** 额外约束，例如「最多 12 字，超了会撞到右边的图」 */
  constraint?: string;
}

export type SlotKind = 'text' | 'image' | 'video' | 'color' | 'number';

export interface Shot {
  /** 稳定 id，形如 s001。重新切分时保留人工标注靠它对齐。 */
  id: string;
  index: number;
  /** 秒 */
  start: number;
  end: number;
  /** 相对项目目录的缩略图路径 */
  thumbnail?: string;
  roll: RollKind;
  annotation: ShotAnnotation;
  /** 每个维度各自的来源，粒度到字段，这样 AI 只覆盖它自己填的 */
  annotationSource: Partial<Record<keyof ShotAnnotation, AnnotationSource>>;
  /** AI 初判的置信度，字段级 */
  aiConfidence?: Partial<Record<keyof ShotAnnotation, number>>;
  /** 用到的特效，自由 tag（特效名目太杂，不做枚举） */
  effects: string[];
  /** 画面里的元素/道具，自由 tag */
  elements: string[];
  /** 逐镜备注——逐字稿里明确要的「针对每个分镜进行备注标注」 */
  note: string;
  /** B-roll 的具体内容描述，服务于后续复刻 */
  brollContent?: string;
  /** 是否人工确认过。批量 AI 标注后用来筛未审的镜头。 */
  reviewed: boolean;
  /** 复刻时哪些元素是可替换的。只对打算复刻的镜头（B-roll/叠加层/字卡）才有意义。 */
  slots?: Slot[];
  /** 这个镜头是否要复刻。挑出来做复刻包时用它筛选。 */
  replicate?: boolean;
  /** 素材库标签（B-roll 放进 Eagle 用），格式见 core/library.ts */
  library?: LibraryTags;
  /** 放进 Eagle 的记录。镜头边界变了（补刀、合并）就对不上了，要重新放 */
  eagle?: EagleRecord;
}

/**
 * 素材库标签，照用户给的「实拍素材打标」模板：
 * 画面类型、场景倾向、基调、可用途由 AI 看画面判断（人可以改）；
 * 关系、身份、具体事件 AI 一律不碰，默认「待人工确认」，只有人手动改。
 */
export interface LibraryTags {
  frameType?: string;
  scene?: string;
  tone?: string;
  uses: string[];
  /** 文件名里「场景大类-子场景」的子场景，比如 讲台、机场 */
  subScene: string;
  /** 文件名里的一句话描述 */
  summary: string;
  /** 客观画面描述 + 建议可用途 */
  note: string;
  relation: string;
  identity: string;
  event: string;
  /** AI 的把握度：高 / 中 / 低 */
  confidence?: string;
  /** 谁填的：AI 打的、AI 打完人改过、人工填的 */
  source?: 'ai' | 'ai-edited' | 'manual';
  taggedAt?: string;
}

export interface EagleRecord {
  itemId?: string;
  name: string;
  sentAt: string;
  start: number;
  end: number;
}

export interface ReelProject {
  version: number;
  id: string;
  title: string;
  /** 从链接下载的视频记下原链接，放进 Eagle 时填在「网址」里 */
  sourceUrl?: string;
  source: SourceMedia;
  shots: Shot[];
  /** 整片级别的备注 */
  note: string;
  createdAt: string;
  updatedAt: string;
}

export function shotDuration(shot: Shot): number {
  return Math.max(0, shot.end - shot.start);
}

/** 秒 → mm:ss.S，界面和导出统一走这个，避免各处格式不一 */
export function formatTime(seconds: number): string {
  const safe = Number.isFinite(seconds) && seconds > 0 ? seconds : 0;
  const m = Math.floor(safe / 60);
  const s = safe - m * 60;
  return `${String(m).padStart(2, '0')}:${s.toFixed(1).padStart(4, '0')}`;
}
