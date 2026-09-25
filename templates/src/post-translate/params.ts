import type { Section, TemplateMeta, TemplateTimeline } from '../form';
import type { PostTranslateProps } from './PostTranslate';

const FPS = 30;

export type PostTranslateParams = {
  header: string;
  parentAvatar: string;
  parentName: string;
  parentHandle: string;
  parentTime: string;
  parentText: string;
  replies: string;
  reposts: string;
  likes: string;
  views: string;
  postAvatar: string;
  postName: string;
  postHandle: string;
  postText: string;
  postDate: string;
  postViews: string;
  translateLabel: string;
  translation: string;
  /** 卡片滑进来用几秒 */
  flySeconds: number;
  barAt: number;
  barSeconds: number;
  closeup: boolean;
  closeAt: number;
  /** 特写里黑条滑多久停住 */
  closeSeconds: number;
  duration: number;
};

export const defaultParams: PostTranslateParams = {
  header: '帖子',
  parentAvatar: '/template-assets/post-translate/avatar-1.png',
  parentName: 'tech daily',
  parentHandle: '@techdaily',
  parentTime: '10小时',
  parentText: "The startup wasn't afraid of the big labs but it is terrified of Apple. You can tell by all the posts today",
  replies: '97',
  reposts: '131',
  likes: '4,595',
  views: '53万',
  postAvatar: '/template-assets/post-translate/avatar-2.png',
  postName: 'Alex Chen',
  postHandle: '@alexchen',
  postText: 'we are not afraid of apple, but we have tremendous respect for them. s-tier company.',
  postDate: '上午4:03 · 2026年7月12日',
  postViews: '58.4万',
  translateLabel: '显示翻译',
  translation: '"我们不怕苹果，但我们非常尊重他们。他们是顶级公司"。',
  // 原片：第 1–60 帧滑进来、第 51 帧起刷黑条（73 帧刷完）、第 140 帧切特写、特写 52 帧停稳
  flySeconds: 1.98,
  barAt: 1.71,
  barSeconds: 2.44,
  closeup: true,
  closeAt: 4.67,
  closeSeconds: 1.73,
  duration: 6.43,
};

const frames = (sec: number) => Math.round(sec * FPS);

export function toProps(p: PostTranslateParams): PostTranslateProps {
  return {
    header: p.header,
    parent: { name: p.parentName, handle: p.parentHandle, avatar: p.parentAvatar, time: p.parentTime, text: p.parentText, replies: p.replies, reposts: p.reposts, likes: p.likes, views: p.views },
    post: { name: p.postName, handle: p.postHandle, avatar: p.postAvatar, text: p.postText, date: p.postDate, views: p.postViews },
    translateLabel: p.translateLabel,
    translation: p.translation.trim(),
    flyAt: 0,
    flyFrames: Math.max(1, p.flySeconds * FPS),
    barAt: frames(p.barAt),
    barFrames: Math.max(1, p.barSeconds * FPS),
    closeAt: p.closeup ? frames(p.closeAt) : -1,
    closeFrames: Math.max(1, p.closeSeconds * FPS),
    durationInFrames: Math.max(1, frames(p.duration)),
  };
}

/** 两个模板共用的帖子表单 */
export const postSections: Section[] = [
  {
    title: '上面那条',
    fields: [
      { kind: 'image', key: 'parentAvatar', label: '头像' },
      { kind: 'text', key: 'parentName', label: '名字', half: true },
      { kind: 'text', key: 'parentHandle', label: '账号', half: true },
      { kind: 'text', key: 'parentText', label: '内容', hint: '被回复的那条帖子，一两行最好' },
      { kind: 'text', key: 'parentTime', label: '多久以前', half: true, placeholder: '比如 10小时' },
      { kind: 'text', key: 'replies', label: '评论数', half: true },
      { kind: 'text', key: 'reposts', label: '转发数', half: true },
      { kind: 'text', key: 'likes', label: '点赞数', half: true },
      { kind: 'text', key: 'views', label: '浏览数', half: true },
    ],
  },
  {
    title: '主帖',
    fields: [
      { kind: 'image', key: 'postAvatar', label: '头像' },
      { kind: 'text', key: 'postName', label: '名字', half: true },
      { kind: 'text', key: 'postHandle', label: '账号', half: true },
      { kind: 'text', key: 'postText', label: '内容（原文）', hint: '翻译黑条压在它上面一行' },
      { kind: 'text', key: 'postDate', label: '发布时间', half: true },
      { kind: 'text', key: 'postViews', label: '浏览量', half: true },
    ],
  },
];

const form: Section[] = [
  ...postSections,
  {
    title: '翻译黑条',
    fields: [
      { kind: 'text', key: 'translation', label: '翻译', hint: '黑底白字，从左往右刷出来。一句话最合适，太长会自动缩小' },
      { kind: 'text', key: 'translateLabel', label: '左边的蓝字', placeholder: '留空不要' },
      { kind: 'number', key: 'barAt', label: '第几秒开始刷', min: 0, max: 60, step: 0.1, unit: '秒', half: true },
      { kind: 'number', key: 'barSeconds', label: '刷完用几秒', min: 0.3, max: 10, step: 0.1, unit: '秒', half: true },
    ],
  },
  {
    title: '镜头',
    fields: [
      { kind: 'number', key: 'flySeconds', label: '卡片滑进来用几秒', min: 0.3, max: 5, step: 0.1, unit: '秒' },
      { kind: 'toggle', key: 'closeup', label: '结尾切到黑条特写', hint: '镜头一下子贴到黑条上，从句首滑到句尾' },
      { kind: 'number', key: 'closeAt', label: '第几秒切特写', min: 0, max: 60, step: 0.1, unit: '秒', half: true, enabledWhen: (v) => v.closeup === true },
      { kind: 'number', key: 'closeSeconds', label: '特写滑多久', min: 0.3, max: 10, step: 0.1, unit: '秒', half: true, enabledWhen: (v) => v.closeup === true },
      { kind: 'number', key: 'duration', label: '视频时长', min: 1, max: 60, step: 0.1, unit: '秒' },
    ],
  },
];

const snap = (t: number) => Math.round((Math.round(t * FPS) / FPS) * 100) / 100;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export const timeline: TemplateTimeline = {
  tracks: (raw) => {
    const p = raw as unknown as PostTranslateParams;
    const cardEnd = p.closeup ? Math.min(p.duration, p.closeAt) : p.duration;
    const camera = [
      { id: 'card', label: '帖子截图', start: 0, end: cardEnd, phases: [{ label: '滑进来', start: 0, end: Math.min(cardEnd, p.flySeconds) }], select: { section: '镜头' }, drag: p.closeup ? { end: true } : {} },
    ];
    if (p.closeup && p.closeAt < p.duration) {
      camera.push({ id: 'close', label: '黑条特写', start: p.closeAt, end: p.duration, phases: [{ label: '横移', start: p.closeAt, end: Math.min(p.duration, p.closeAt + p.closeSeconds) }], select: { section: '镜头' }, drag: { end: true } });
    }
    return [
      { id: 'camera', label: '镜头', kind: 'camera', items: camera },
      { id: 'bar', label: '翻译黑条', kind: 'element', items: [{ id: 'bar', label: p.translation || '（还没写）', start: p.barAt, end: Math.min(p.duration, p.barAt + p.barSeconds), select: { section: '翻译黑条' }, drag: { move: true, end: true } }] },
    ];
  },
  apply: (raw, itemId, edge, start, end) => {
    const p = raw as unknown as PostTranslateParams;
    if (itemId === 'card') return { ...raw, closeAt: clamp(snap(end), 0.5, p.duration) };
    if (itemId === 'close') return { ...raw, duration: clamp(snap(end), p.closeAt + 0.2, 60) };
    if (itemId === 'bar') {
      if (edge === 'end') return { ...raw, barSeconds: clamp(snap(end - p.barAt), 0.3, 10) };
      return { ...raw, barAt: clamp(snap(start), 0, 60) };
    }
    return raw;
  },
};

export const meta: TemplateMeta = {
  id: 'post-translate',
  name: '帖子截图 · 翻译黑条',
  description: '深色背景上一张帖子截图斜着滑进来，原文上面刷出一条黑底白字的中文翻译；结尾可以一刀切到黑条特写，从句首滑到句尾',
  origin: '复刻自一条科技解读视频里的两个连着的镜头，和原片的相似度 92.0%',
  width: 1280,
  height: 720,
  fps: FPS,
  posterFrame: 130,
  form,
  defaultParams: defaultParams as unknown as Record<string, unknown>,
  timeline,
};
