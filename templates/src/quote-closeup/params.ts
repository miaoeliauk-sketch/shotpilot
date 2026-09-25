import type { Section, TemplateMeta, TemplateTimeline } from '../form';
import { defaultParams as postDefaults, postSections, toProps as postToProps } from '../post-translate/params';
import type { PostTranslateProps } from '../post-translate/PostTranslate';

const FPS = 30;

/** 和「帖子截图 · 翻译黑条」用同一份帖子内容（后面虚着的就是那张帖子） */
export type QuoteCloseupParams = Omit<typeof postDefaults, 'flySeconds' | 'barAt' | 'barSeconds' | 'closeup' | 'closeAt'> & {
  duration: number;
};

export const defaultParams: QuoteCloseupParams = {
  header: postDefaults.header,
  parentAvatar: postDefaults.parentAvatar,
  parentName: postDefaults.parentName,
  parentHandle: postDefaults.parentHandle,
  parentTime: postDefaults.parentTime,
  parentText: postDefaults.parentText,
  replies: postDefaults.replies,
  reposts: postDefaults.reposts,
  likes: postDefaults.likes,
  views: postDefaults.views,
  postAvatar: postDefaults.postAvatar,
  postName: postDefaults.postName,
  postHandle: postDefaults.postHandle,
  postText: postDefaults.postText,
  postDate: postDefaults.postDate,
  postViews: postDefaults.postViews,
  translateLabel: postDefaults.translateLabel,
  translation: postDefaults.translation,
  // 原片：52 帧滑到句尾停住，一共 53 帧
  closeSeconds: 1.73,
  duration: 1.77,
};

export function toProps(p: QuoteCloseupParams): PostTranslateProps {
  const base = postToProps({ ...postDefaults, ...p, closeup: true, closeAt: 0 });
  return { ...base, closeOnly: true, durationInFrames: Math.max(1, Math.round(p.duration * FPS)) };
}

const form: Section[] = [
  {
    title: '金句',
    fields: [
      { kind: 'text', key: 'translation', label: '黑条上的字', hint: '镜头贴着黑条，从句首滑到句尾' },
      { kind: 'number', key: 'closeSeconds', label: '滑多久停住', min: 0.3, max: 10, step: 0.1, unit: '秒', half: true },
      { kind: 'number', key: 'duration', label: '视频时长', min: 0.5, max: 60, step: 0.1, unit: '秒', half: true },
    ],
  },
  ...postSections.map((s) => ({ ...s, title: `背景 · ${s.title}` })),
];

const snap = (t: number) => Math.round((Math.round(t * FPS) / FPS) * 100) / 100;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export const timeline: TemplateTimeline = {
  tracks: (raw) => {
    const p = raw as unknown as QuoteCloseupParams;
    return [
      {
        id: 'camera', label: '镜头', kind: 'camera',
        items: [{ id: 'slide', label: '黑条特写', start: 0, end: p.duration, phases: [{ label: '横移', start: 0, end: Math.min(p.duration, p.closeSeconds) }], select: { section: '金句' }, drag: { end: true } }],
      },
    ];
  },
  apply: (raw, itemId, _edge, _start, end) => {
    if (itemId === 'slide') return { ...raw, duration: clamp(snap(end), 0.5, 60) };
    return raw;
  },
};

export const meta: TemplateMeta = {
  id: 'quote-closeup',
  name: '翻译金句 · 特写横移',
  description: '镜头贴在一条黑底白字的金句上，从很虚对上焦，从句首一路滑到句尾停住；后面是虚掉的帖子截图',
  origin: '复刻自一条科技解读视频里的一个镜头，和原片的相似度 88.3%',
  width: 1280,
  height: 720,
  fps: FPS,
  posterFrame: 45,
  form,
  defaultParams: defaultParams as unknown as Record<string, unknown>,
  timeline,
};
