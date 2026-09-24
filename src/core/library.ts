import { formatTime, type LibraryTags, type ReelProject, type Shot } from './types.js';

/**
 * 素材库标签：照用户的「实拍素材打标」模板，只给 B-roll 镜头打。
 *
 * 这里全是纯函数（没有文件、网络），界面预览和真正放进 Eagle 用的是同一套规则，
 * 界面上看到的文件名、标签，就是 Eagle 里会出现的。
 */

export const PENDING = '待人工确认';

// 「你来判断」的四项，只能从这些里选
export const FRAME_TYPES = ['人物近景', '人物全景', '合影', '空镜', '截图'];
export const SCENES = ['专业', '行程', '生活', '形象'];
export const TONES = ['专业', '亲和', '高能', '松弛'];
export const USES = ['封面', '片头', '口播B-roll', '信任背书', '朋友圈'];
export const CONFIDENCES = ['高', '中', '低'];

// 「你不许猜」的三项：AI 不碰，只有人手动选
export const RELATIONS = ['学员', '客户', '同行'];
export const IDENTITIES = ['是本人', '不是本人'];

export function emptyLibrary(): LibraryTags {
  return { uses: [], subScene: '', summary: '', note: '', relation: PENDING, identity: PENDING, event: PENDING };
}

const oneOf = (v: unknown, list: string[]) => (typeof v === 'string' && list.includes(v.trim()) ? v.trim() : undefined);

/** 放进文件名的片段：去掉访达不认的字符和下划线（下划线是文件名公式的分隔符） */
function part(v: string, max: number): string {
  return v.replace(/[\\/:*?"<>|_\n\r\t]/g, '').trim().slice(0, max);
}

function text(v: unknown, max: number): string {
  return typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max) : '';
}

/**
 * 校验标签。前端改的、AI 回的都当不可信数据：
 * 选项类不在清单里就丢掉，文字限制长度，「待人工确认」那三项只认清单里的值或手写的事件。
 */
export function sanitizeLibrary(raw: unknown): LibraryTags {
  const out = emptyLibrary();
  if (typeof raw !== 'object' || raw === null) return out;
  const o = raw as Record<string, unknown>;
  out.frameType = oneOf(o.frameType, FRAME_TYPES);
  out.scene = oneOf(o.scene, SCENES);
  out.tone = oneOf(o.tone, TONES);
  out.uses = Array.isArray(o.uses) ? [...new Set(o.uses.map((u) => oneOf(u, USES)).filter((u): u is string => !!u))] : [];
  out.subScene = part(text(o.subScene, 20), 12);
  out.summary = part(text(o.summary, 40), 30);
  out.note = text(o.note, 400);
  out.relation = oneOf(o.relation, RELATIONS) ?? PENDING;
  out.identity = oneOf(o.identity, IDENTITIES) ?? PENDING;
  out.event = text(o.event, 40) || PENDING;
  out.confidence = oneOf(o.confidence, CONFIDENCES);
  if (o.source === 'ai' || o.source === 'ai-edited' || o.source === 'manual') out.source = o.source;
  if (typeof o.taggedAt === 'string') out.taggedAt = o.taggedAt;
  return out;
}

/** 人在界面上改了标签：来源变成「人工」或「AI 打完人改过」，AI 的把握度留着 */
export function applyManualEdit(prev: LibraryTags | undefined, incoming: unknown): LibraryTags {
  const next = sanitizeLibrary(incoming);
  next.confidence = prev?.confidence;
  next.source = prev?.source === 'ai' || prev?.source === 'ai-edited' ? 'ai-edited' : 'manual';
  next.taggedAt = prev?.taggedAt;
  return next;
}

/**
 * AI 打完的结果并进去：只动「你来判断」那几项和描述，
 * 关系、身份、具体事件保留人已经确认的，没确认就是「待人工确认」。
 */
export function applyAiTags(prev: LibraryTags | undefined, ai: unknown): LibraryTags {
  const base = prev ?? emptyLibrary();
  const got = sanitizeLibrary(ai);
  return {
    ...got,
    relation: base.relation || PENDING,
    identity: base.identity || PENDING,
    event: base.event || PENDING,
    source: 'ai',
    taggedAt: new Date().toISOString(),
  };
}

export function isTagged(lib: LibraryTags | undefined): boolean {
  return !!lib && !!(lib.frameType || lib.scene || lib.tone || lib.summary);
}

/** 这个镜头是这条视频里的第几个 B-roll（从 1 开始），用作文件名的序号 */
export function brollNumber(project: ReelProject, shot: Shot): number {
  const brolls = project.shots.filter((s) => s.roll === 'b-roll').sort((a, b) => a.start - b.start);
  const i = brolls.findIndex((s) => s.id === shot.id);
  return i === -1 ? brolls.length + 1 : i + 1;
}

function ymd(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '00000000';
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * 文件名：日期_场景大类-子场景_一句话描述_序号
 * 日期用拉片那天。合影属于「关系类」，子场景先填「关系-待确认」，人确认了关系才换成「关系-学员」这种。
 */
export function libraryName(project: ReelProject, shot: Shot): string {
  const lib = shot.library ?? emptyLibrary();
  const big = lib.scene ?? '待定';
  const sub = lib.frameType === '合影'
    ? (RELATIONS.includes(lib.relation) ? `关系-${lib.relation}` : '关系-待确认')
    : (lib.subScene || '待定');
  const desc = lib.summary || '待描述';
  const seq = String(brollNumber(project, shot)).padStart(2, '0');
  return `${ymd(project.createdAt)}_${big}-${sub}_${desc}_${seq}`;
}

/**
 * Eagle 里的标签。每类前面带上类别名：「专业」在场景倾向和基调里都有，不带分不清。
 * 可用途照模板写成「建议:封面」。三项里只要有一项还没确认，就多打一个「待人工确认」，在 Eagle 里一筛就出来。
 */
export function libraryTags(lib: LibraryTags): string[] {
  const tags = ['B-roll'];
  if (lib.frameType) tags.push(`画面:${lib.frameType}`);
  if (lib.scene) tags.push(`场景:${lib.scene}`);
  if (lib.tone) tags.push(`基调:${lib.tone}`);
  for (const u of lib.uses) tags.push(`建议:${u}`);
  tags.push(`关系:${lib.relation || PENDING}`);
  tags.push(`身份:${lib.identity || PENDING}`);
  tags.push(`事件:${lib.event || PENDING}`);
  if (lib.confidence) tags.push(`把握度:${lib.confidence}`);
  if ([lib.relation, lib.identity, lib.event].some((v) => !v || v === PENDING)) tags.push(PENDING);
  return tags;
}

/** 我们自己打的标签都带这些开头；更新 Eagle 里的素材时只换这些，用户在 Eagle 里自己加的标签不动 */
export const OUR_TAG_PREFIXES = ['画面:', '场景:', '基调:', '建议:', '关系:', '身份:', '事件:', '把握度:'];
export const OUR_PLAIN_TAGS = ['B-roll', PENDING];

export function isOurTag(tag: string): boolean {
  return OUR_PLAIN_TAGS.includes(tag) || OUR_TAG_PREFIXES.some((p) => tag.startsWith(p));
}

/** Eagle 里的注释：就是模板的那段结果，最后加一行来源 */
export function libraryAnnotation(project: ReelProject, shot: Shot): string {
  const lib = shot.library ?? emptyLibrary();
  const uses = lib.uses.map((u) => `建议:${u}`).join('、');
  return [
    `文件名：${libraryName(project, shot)}`,
    `画面类型：${lib.frameType ?? '待定'}`,
    `场景倾向：${lib.scene ?? '待定'}`,
    `基调：${lib.tone ?? '待定'}`,
    `可用途：${uses || '待定'}`,
    `关系：${lib.relation || PENDING}`,
    `身份：${lib.identity || PENDING}`,
    `具体事件：${lib.event || PENDING}`,
    `备注：${lib.note || '（还没写）'}`,
    `把握度（高/中/低）：${lib.confidence ?? '—（人工填写）'}`,
    '',
    `来源：${project.title} ${formatTime(shot.start)}–${formatTime(shot.end)}（${shot.id}）`,
  ].join('\n');
}
