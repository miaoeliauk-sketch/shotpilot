import type { Section, TemplateMeta, TemplateTimeline } from '../form';
import type { MarathonTitleProps } from './MarathonTitle';

const FPS = 30;

export type MarathonTitleParams = { background: string; title: string; tagline: string; dim: number; whip: boolean; vignette: boolean; duration: number };

export const defaultParams: MarathonTitleParams = {
  background: '/template-assets/chrome-title/dark-desk.jpg',
  title: 'SWE Marathon',
  tagline: '超长周期软件工程智能体的评测基准',
  dim: 0.8,
  whip: true,
  vignette: true,
  // 原片 133 帧
  duration: 4.43,
};

const frames = (sec: number) => Math.round(sec * FPS);

export function toProps(p: MarathonTitleParams): MarathonTitleProps {
  return {
    background: p.background,
    title: p.title.trim(),
    tagline: p.tagline.trim(),
    dim: Math.min(1, Math.max(0.2, p.dim ?? 0.8)),
    whip: p.whip !== false,
    vignette: p.vignette !== false,
    durationInFrames: Math.max(frames(p.whip !== false ? 3.8 : 3.5), frames(p.duration)),
  };
}

const form: Section[] = [
  {
    title: '画面',
    fields: [
      { kind: 'media', key: 'background', label: '背景', hint: '暗一点的视频或图片（原片是一段昏暗的写代码画面）' },
      { kind: 'number', key: 'dim', label: '背景亮度', min: 0.2, max: 1, step: 0.05 },
      { kind: 'toggle', key: 'vignette', label: '四周暗角' },
      { kind: 'toggle', key: 'whip', label: '结尾整个往下甩走', hint: '接下一个镜头用；关掉就停在最后' },
      { kind: 'number', key: 'duration', label: '视频时长', min: 3.5, max: 30, step: 0.1, unit: '秒' },
    ],
  },
  {
    title: '文字',
    fields: [
      { kind: 'text', key: 'title', label: '大标题', hint: '英文或数字最好看（金属拉丝字）' },
      { kind: 'text', key: 'tagline', label: '上面的小字', placeholder: '留空不要' },
    ],
  },
];

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export const timeline: TemplateTimeline = {
  tracks: (raw) => {
    const p = raw as unknown as MarathonTitleParams;
    return [
      { id: 'camera', label: '镜头', kind: 'camera', items: [{ id: 'cam', label: '落下来 → 放大', start: 0, end: p.duration, phases: [{ label: '落下', start: 0.27, end: 1 }, { label: '放大', start: 2.67, end: 3.5 }, ...(p.whip ? [{ label: '甩走', start: p.duration - 0.33, end: p.duration }] : [])], select: { section: '画面' }, drag: { end: true } }] },
      { id: 'elements', label: '元素', kind: 'element', items: [{ id: 'title', label: p.title, start: 0.27, end: p.duration, select: { section: '文字' }, drag: {} }, ...(p.tagline ? [{ id: 'tag', label: p.tagline, start: 3, end: p.duration, select: { section: '文字' }, drag: {} }] : [])] },
    ];
  },
  apply: (raw, itemId, _edge, _start, end) => (itemId === 'cam' ? { ...raw, duration: clamp(Math.round(end * FPS) / FPS, 3.5, 30) } : raw),
};

export const meta: TemplateMeta = {
  id: 'marathon-title',
  name: '金属大标题落下 · 烟雾扫过 · 往下甩走',
  description: '暗暗的视频画面上，一行金属拉丝的大标题从上面落下来、一团烟雾从左往右扫过；然后标题放大、上面淡出一行小字，最后整个画面往下甩走',
  origin: '复刻自一条讲编程评测榜单的视频里的一个镜头，和原片的相似度 93.8%',
  width: 1280,
  height: 720,
  fps: FPS,
  posterFrame: 120,
  form,
  defaultParams: defaultParams as unknown as Record<string, unknown>,
  timeline,
};
