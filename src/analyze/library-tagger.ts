import { chatJson, extractShotFrames, type VisionConfig } from './vision.js';
import { FRAME_TYPES, SCENES, TONES, USES } from '../core/library.js';
import type { Shot } from '../core/types.js';

/**
 * AI 给 B-roll 打素材标签。提示词照用户的「实拍素材打标助手」模板写，
 * 只让 AI 判断看图能看出来的四项和描述；关系、身份、具体事件根本不问它（见 core/library.ts 的 applyAiTags）。
 */

export const LIBRARY_PROMPT = `你是实拍素材打标助手。用户会给你同一个视频镜头里按时间顺序抽的几帧画面。
只根据画面里看得到的东西判断，只输出一个 JSON 对象，不要任何解释。

【你来判断（看图能看出来的）】
- 画面类型：从 ${FRAME_TYPES.join(' / ')} 里选一个
- 场景倾向：从 ${SCENES.join(' / ')} 里选一个（只从画面能看出来的角度选）
- 基调：从 ${TONES.join(' / ')} 里选一个
- 可用途：从 ${USES.join(' / ')} 里选一个或几个

【你不许猜】
- 不判断关系（学员/客户/同行）、不判断画面里是不是本人、不判断是哪次活动
- 哪怕画面明显是合影，也只标「合影」，绝不判断对方是谁

【文件名要用的两段】
- 子场景：2 到 6 个字，概括画面里的场景，比如 讲台、会议室、机场、咖啡店、办公桌
- 一句话描述：15 个字以内，只写画面里看得到的

【备注】客观画面描述 + 建议可用途，不许编画面里没有的（身份、地名、情绪故事），100 字以内

JSON 格式：
{"画面类型":"","场景倾向":"","基调":"","可用途":[""],"子场景":"","一句话描述":"","备注":"","把握度":"高/中/低 选一个"}`;

/** 模型回的中文键名换成程序里的字段名；值的合法性由 sanitizeLibrary 再把一次关 */
export function mapLibraryReply(raw: unknown): Record<string, unknown> {
  const o = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<string, unknown>;
  const uses = o['可用途'];
  return {
    frameType: o['画面类型'],
    scene: o['场景倾向'],
    tone: o['基调'],
    // 模型偶尔照抄「建议:封面」或者回一个用顿号连起来的字符串，都认
    uses: (Array.isArray(uses) ? uses : typeof uses === 'string' ? uses.split(/[、,，\s]+/) : [])
      .map((u) => (typeof u === 'string' ? u.replace(/^建议[:：]/, '').trim() : u)),
    subScene: o['子场景'],
    summary: o['一句话描述'],
    note: o['备注'],
    confidence: typeof o['把握度'] === 'string' ? (o['把握度'] as string).trim().slice(0, 1) : undefined,
  };
}

/** 给一个镜头抽 3 帧，问看图模型，返回（还没校验的）标签 */
export async function autoTagShot(videoPath: string, shot: Shot, cfg: VisionConfig): Promise<Record<string, unknown>> {
  const frames = await extractShotFrames(videoPath, shot, cfg);
  if (frames.length === 0) throw new Error(`${shot.id} 抽不出画面`);
  const raw = await chatJson(cfg, LIBRARY_PROMPT, `这是同一个镜头按时间顺序的 ${frames.length} 帧，按要求打标。`, frames, 600);
  return mapLibraryReply(raw);
}
