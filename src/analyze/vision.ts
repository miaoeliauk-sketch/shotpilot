import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { FFMPEG, run } from './ffmpeg.js';
import { isValidTerm } from '../core/vocabulary.js';
import { loadSettings } from '../core/settings.js';
import type { RollKind } from '../core/vocabulary.js';
import type { Shot, ShotAnnotation, TemplateFit } from '../core/types.js';

/**
 * AI 自动初判景别 / 运镜 / 构图 / 光线 / 机位。
 *
 * 两条硬约束贯穿这个模块：
 *   1. **运镜必须多帧才能判断**。单帧看不出推拉摇移，所以每个镜头抽首/中/尾三帧一起送。
 *   2. **AI 只填空位，绝不覆盖人工标注**。人改过的字段在 annotationSource 里标成 manual
 *      或 ai-edited，这里一律跳过——批量跑第二轮时不会把人的活儿冲掉。
 *
 * provider 走 OpenAI 兼容的 chat completions 接口，所以自带 key、第三方网关、
 * 本地 vLLM/Ollama 都能接，不锁死在某一家。
 */

export interface VisionConfig {
  baseUrl: string;
  apiKey: string;
  model: string;
  /** 每个镜头抽几帧。低于 2 就判不了运镜，所以下限是 2。 */
  framesPerShot: number;
  /** 送进模型的帧宽度。512 足够判景别构图，再大只是烧钱。 */
  frameWidth: number;
  timeoutMs: number;
}

export function visionConfigFromEnv(): VisionConfig | null {
  const apiKey = process.env.SHOTPILOT_VISION_API_KEY;
  if (!apiKey) return null;
  const frames = Number(process.env.SHOTPILOT_VISION_FRAMES ?? 3);
  return {
    baseUrl: (process.env.SHOTPILOT_VISION_BASE_URL ?? 'https://api.openai.com/v1').replace(/\/+$/, ''),
    apiKey,
    model: process.env.SHOTPILOT_VISION_MODEL ?? 'gpt-4o-mini',
    framesPerShot: Math.max(2, Number.isFinite(frames) ? frames : 3),
    frameWidth: 512,
    timeoutMs: 120_000,
  };
}

/**
 * 当前能用的看图模型：界面「设置」里填的优先（Mac 软件里只能这样填），没填就看环境变量。
 */
export async function visionConfig(): Promise<VisionConfig | null> {
  const v = (await loadSettings()).vision;
  if (v?.apiKey && v.baseUrl && v.model) {
    return { baseUrl: v.baseUrl.replace(/\/+$/, ''), apiKey: v.apiKey, model: v.model, framesPerShot: 3, frameWidth: 512, timeoutMs: 120_000 };
  }
  return visionConfigFromEnv();
}

const SYSTEM_PROMPT = `你是影视摄影分析助手。用户会给你同一个镜头里按时间顺序抽取的若干帧。
请判断这个镜头的归类和摄影参数，只返回 JSON，不要任何解释文字。

字段与可选值（必须严格从中选取，不确定就省略该字段）：
- roll: 镜头归类，四选一：
  a-roll（主线画面：人物对着镜头讲话、口播）
  b-roll（补充画面：没有人对镜头讲话，用来铺垫、示意、展示）
  overlay（叠加层：截图、图表、画中画压在人物画面上）
  title（字卡：画面主体就是文字）
- templateFit: true 或 false。画面主要是电脑能「画」出来的（文字、图形、图标、插画、图片的摆放缩放和动效、图表、转场特效）填 true；
  主要是摄像机拍的真实画面（真人、实景、实物）填 false
- templateReason: 10 个字以内的中文理由，比如「图形文字动画」「插画加对话气泡」「真人口播」「实景拍摄」
- shotSize: extreme-wide | wide | full | medium-full | medium | medium-close | close | closeup | extreme-closeup | insert
- cameraMove: static | push-in | pull-out | pan | tilt | track | follow | crane | handheld | orbit | zoom | whip
- composition: 数组，可多选：center | rule-of-thirds | symmetry | frame-in-frame | leading-lines | negative-space | over-shoulder | diagonal | fill-frame
- focalLength: ultra-wide | wide | normal | short-tele | tele | macro
- lighting: 数组，可多选：front | side | back | rim | top | soft | hard | low-key | high-key | natural | practical | mixed-color
- angle: eye-level | high | low | birds-eye | dutch | pov
- elements: 数组，画面里的关键物件或主体，中文短词，最多 5 个
- confidence: 对象，为上面每个你填了的字段给 0–1 的置信度

判断 cameraMove 时必须比较多帧之间的差异：画面整体平移是"移"或"摇"，主体变大是"推"，
变小是"拉"，边缘有抖动且无规律是"手持"，几帧完全一致是"固定"。

只输出 JSON 对象。`;

interface ChatResponse {
  choices?: Array<{ message?: { content?: string } }>;
  error?: { message?: string };
}

/** 从镜头里均匀抽帧并转成 base64 data URL */
export async function extractShotFrames(
  videoPath: string,
  shot: Shot,
  cfg: VisionConfig,
): Promise<string[]> {
  const dir = await mkdtemp(join(tmpdir(), 'shotpilot-frames-'));
  try {
    const duration = shot.end - shot.start;
    const frames: string[] = [];
    for (let i = 0; i < cfg.framesPerShot; i++) {
      // 避开首尾各 10%，那里常是转场残影
      const ratio = cfg.framesPerShot === 1 ? 0.5 : 0.1 + (0.8 * i) / (cfg.framesPerShot - 1);
      const seek = shot.start + duration * ratio;
      const out = join(dir, `f${i}.jpg`);
      const res = await run(FFMPEG, [
        '-hide_banner', '-nostats', '-loglevel', 'error',
        '-ss', seek.toFixed(3), '-i', videoPath,
        '-frames:v', '1', '-vf', `scale=${cfg.frameWidth}:-2`, '-q:v', '5',
        '-y', out,
      ], { timeoutMs: 60_000 });
      if (res.code !== 0) continue;
      const buf = await readFile(out);
      frames.push(`data:image/jpeg;base64,${buf.toString('base64')}`);
    }
    return frames;
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

type Sanitized = {
  annotation: ShotAnnotation;
  elements: string[];
  confidence: Record<string, number>;
  roll?: Exclude<RollKind, 'unset'>;
  templateFit?: { fit: boolean; reason: string };
};

/** 模型返回的东西一律当不可信数据校验，非法枚举值直接丢弃而不是写进项目。 */
export function sanitizeAnnotation(raw: unknown): Sanitized {
  const out: ShotAnnotation = {};
  const confidence: Record<string, number> = {};
  let elements: string[] = [];
  if (typeof raw !== 'object' || raw === null) return { annotation: out, elements, confidence };
  const obj = raw as Record<string, unknown>;
  const roll = typeof obj.roll === 'string' && obj.roll !== 'unset' && isValidTerm('roll', obj.roll)
    ? (obj.roll as Exclude<RollKind, 'unset'>)
    : undefined;
  const templateFit = typeof obj.templateFit === 'boolean'
    ? { fit: obj.templateFit, reason: typeof obj.templateReason === 'string' ? obj.templateReason.trim().slice(0, 20) : '' }
    : undefined;

  const single = (field: 'shotSize' | 'cameraMove' | 'focalLength' | 'angle') => {
    const v = obj[field];
    if (typeof v === 'string' && isValidTerm(field, v)) (out[field] as string) = v;
  };
  single('shotSize');
  single('cameraMove');
  single('focalLength');
  single('angle');

  const multi = (field: 'composition' | 'lighting') => {
    const v = obj[field];
    if (!Array.isArray(v)) return;
    const kept = v.filter((x): x is string => typeof x === 'string' && isValidTerm(field, x));
    if (kept.length > 0) (out[field] as string[]) = [...new Set(kept)];
  };
  multi('composition');
  multi('lighting');

  if (Array.isArray(obj.elements)) {
    elements = obj.elements.filter((x): x is string => typeof x === 'string' && x.trim().length > 0).slice(0, 5);
  }

  if (typeof obj.confidence === 'object' && obj.confidence !== null) {
    for (const [k, v] of Object.entries(obj.confidence as Record<string, unknown>)) {
      if (typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 1) confidence[k] = v;
    }
  }

  return { annotation: out, elements, confidence, roll, templateFit };
}

/**
 * 把 AI 的判断并进镜头。硬规则：人标过的不动。
 *   - 画面参数：annotationSource 是 manual / ai-edited 的字段跳过
 *   - 归类：没标过（unset），或者上次也是 AI 标的，才改；老项目里人手标的归类没有来源记录，也当人标的
 *   - 适不适合做模板：没判过或者上次是 AI 判的，才改
 */
export function mergeAiResult(shot: Shot, got: Sanitized): Shot {
  const nextAnnotation: ShotAnnotation = { ...shot.annotation };
  const nextSource = { ...shot.annotationSource };
  const nextConfidence = { ...(shot.aiConfidence ?? {}) };
  for (const [field, value] of Object.entries(got.annotation)) {
    const key = field as keyof ShotAnnotation;
    const src = nextSource[key];
    if (src === 'manual' || src === 'ai-edited') continue;
    (nextAnnotation[key] as unknown) = value;
    nextSource[key] = 'ai';
    const c = got.confidence[field];
    if (typeof c === 'number') (nextConfidence[key] as number) = c;
  }
  const next: Shot = {
    ...shot,
    annotation: nextAnnotation,
    annotationSource: nextSource,
    aiConfidence: nextConfidence,
    elements: shot.elements.length > 0 ? shot.elements : got.elements,
  };
  if (got.roll && (shot.roll === 'unset' || shot.rollSource === 'ai')) {
    next.roll = got.roll;
    next.rollSource = 'ai';
  }
  if (got.templateFit && (!shot.templateFit || shot.templateFit.source === 'ai')) {
    const fit: TemplateFit = { ...got.templateFit, source: 'ai' };
    next.templateFit = fit;
  }
  return next;
}

/** 从模型回复里抠出 JSON。模型常把 JSON 包在 ```json 围栏里，这里两种都能吃。 */
export function extractJson(content: string): unknown {
  const fenced = /```(?:json)?\s*([\s\S]*?)```/.exec(content);
  const candidate = fenced?.[1] ?? content;
  const start = candidate.indexOf('{');
  const end = candidate.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) throw new Error('模型回复里没有找到 JSON');
  return JSON.parse(candidate.slice(start, end + 1));
}

function callVisionModel(frames: string[], cfg: VisionConfig): Promise<unknown> {
  return chatJson(cfg, SYSTEM_PROMPT, `这是同一个镜头按时间顺序的 ${frames.length} 帧，请分析。`, frames, 500);
}

/** 发一段提示词加几张图给看图模型，把回复里的 JSON 抠出来。其他 AI 功能（素材库打标）也走这里 */
export async function chatJson(cfg: VisionConfig, system: string, userText: string, frames: string[], maxTokens: number): Promise<unknown> {
  const content = await chat(cfg, system, [
    { type: 'text', text: userText },
    ...frames.map((url) => ({ type: 'image_url', image_url: { url } })),
  ], maxTokens);
  return extractJson(content);
}

/** 测一下 Key 和模型名填得对不对：发一句话，不带图，花费几乎为零 */
export async function testVision(cfg: VisionConfig): Promise<void> {
  await chat({ ...cfg, timeoutMs: 30_000 }, '只回复 OK 两个字母。', [{ type: 'text', text: 'ping' }], 5);
}

async function chat(cfg: VisionConfig, system: string, userContent: unknown[], maxTokens: number): Promise<string> {
  const body = {
    model: cfg.model,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: userContent },
    ],
    temperature: 0,
    max_tokens: maxTokens,
  };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), cfg.timeoutMs);
  try {
    const res = await fetch(`${cfg.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${cfg.apiKey}` },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const text = await res.text();
    let data: ChatResponse = {};
    try { data = JSON.parse(text) as ChatResponse; } catch { /* 不是 JSON，下面按错误处理 */ }
    if (!res.ok) {
      if (res.status === 401 || res.status === 403) throw new Error(`看图 AI 不认这个 Key（${res.status}）：${data.error?.message ?? '检查一下 Key 有没有复制全'}`);
      if (res.status === 404) throw new Error(`看图 AI 的地址或模型名不对（404）：${data.error?.message ?? text.slice(0, 120)}`);
      throw new Error(`看图 AI 返回 ${res.status}：${data.error?.message ?? text.slice(0, 160)}`);
    }
    const content = data.choices?.[0]?.message?.content;
    if (typeof content !== 'string') throw new Error('看图 AI 的回复是空的');
    return content;
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') throw new Error('看图 AI 太久没回复，稍后再试');
    if (err instanceof TypeError) throw new Error(`连不上看图 AI（${cfg.baseUrl}）：检查地址和网络`);
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

export interface AutoAnnotateProgress {
  (done: number, total: number, shotId: string, error?: string): void;
}

/**
 * 批量 AI 初判。串行跑，因为视觉接口普遍有并发限制，
 * 而且拉片不是实时任务，稳比快重要。
 */
export async function autoAnnotate(
  videoPath: string,
  shots: Shot[],
  cfg: VisionConfig,
  onProgress?: AutoAnnotateProgress,
): Promise<Shot[]> {
  const result: Shot[] = [];
  let done = 0;

  for (const shot of shots) {
    let updated = shot;
    try {
      const frames = await extractShotFrames(videoPath, shot, cfg);
      if (frames.length > 0) {
        const raw = await callVisionModel(frames, cfg);
        updated = mergeAiResult(shot, sanitizeAnnotation(raw));
      }
      onProgress?.(++done, shots.length, shot.id);
    } catch (err) {
      // 单个镜头失败不中断整批——拉片跑到一半全废是最让人恼火的
      onProgress?.(++done, shots.length, shot.id, err instanceof Error ? err.message : String(err));
    }
    result.push(updated);
  }
  return result;
}
