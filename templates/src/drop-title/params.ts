import type { Section, TemplateMeta, TemplateTimeline } from '../form';
import type { DropTitleProps } from './DropTitle';

const FPS = 30;
/** 4 个字从第一个开始到全部停稳约 1.1 秒 */
const SETTLE_SECONDS = 32 / FPS;

export type DropTitleParams = {
  background: string;
  dim: number;
  title: string;
  subtitle: string;
  color: string;
  startAt: number;
  duration: number;
};

export const defaultParams: DropTitleParams = {
  background: '/template-assets/drop-title/sample.jpg',
  dim: 0,
  title: '竞业协议',
  subtitle: 'Non-competition Agreement',
  color: '#f4f4f5',
  // 原片第 3 帧开始
  startAt: 0.1,
  duration: 3.93,
};

export function toProps(p: DropTitleParams): DropTitleProps {
  return {
    background: p.background,
    dim: Math.min(0.9, Math.max(0, p.dim / 100)),
    title: p.title,
    subtitle: p.subtitle,
    color: p.color,
    startAt: Math.round(p.startAt * FPS),
    durationInFrames: Math.max(1, Math.round(p.duration * FPS)),
  };
}

const form: Section[] = [
  {
    title: '标题',
    fields: [
      { kind: 'text', key: 'title', label: '大标题', hint: '4 个字最好看，字多了会自动缩小' },
      { kind: 'text', key: 'subtitle', label: '下面的英文', placeholder: '留空不要' },
      { kind: 'color', key: 'color', label: '文字颜色' },
      { kind: 'number', key: 'startAt', label: '第几秒出字', min: 0, max: 60, step: 0.1, unit: '秒' },
    ],
  },
  {
    title: '背景',
    fields: [
      { kind: 'media', key: 'background', label: '背景', hint: '横版图片或视频，暗一点的更好，白字才显眼' },
      { kind: 'number', key: 'dim', label: '背景压暗', min: 0, max: 90, step: 5, unit: '%' },
      { kind: 'number', key: 'duration', label: '视频时长', min: 1, max: 60, step: 0.1, unit: '秒' },
    ],
  },
];

const snap = (t: number) => Math.round((Math.round(t * FPS) / FPS) * 100) / 100;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export const timeline: TemplateTimeline = {
  tracks: (raw) => {
    const p = raw as unknown as DropTitleParams;
    return [{
      id: 'title', label: '标题', kind: 'element',
      items: [{
        id: 'title', label: p.title || '（还没写）', start: p.startAt, end: p.duration,
        phases: [{ label: '逐字落下', start: p.startAt, end: Math.min(p.duration, p.startAt + SETTLE_SECONDS) }],
        select: { section: '标题' }, drag: { move: true, end: true },
      }],
    }];
  },
  apply: (raw, _itemId, edge, start, end) => {
    const p = raw as unknown as DropTitleParams;
    if (edge === 'end') return { ...raw, duration: clamp(snap(end), p.startAt + 0.5, 60) };
    return { ...raw, startAt: clamp(snap(start), 0, Math.max(0, p.duration - 0.5)) };
  },
};

export const meta: TemplateMeta = {
  id: 'drop-title',
  name: '白色大标题 · 逐字砸下',
  description: '暗色视频背景上，白色大标题一个字一个字从放大、模糊里砸下来，下面一行英文',
  origin: '复刻自一条新闻解读视频里的一个标题镜头，和原片的相似度 89.4%（背景用原片画面比）',
  width: 1280,
  height: 720,
  fps: FPS,
  posterFrame: 60,
  form,
  defaultParams: defaultParams as unknown as Record<string, unknown>,
  timeline,
};
