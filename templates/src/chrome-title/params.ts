import type { Section, TemplateMeta, TemplateTimeline } from '../form';
import type { ChromeTitleProps } from './ChromeTitle';

const FPS = 30;

export type ChromeTitleParams = {
  background: string;
  title: string;
  top: string;
  sub: string;
  dim: number;
  vignette: boolean;
  duration: number;
};

export const defaultParams: ChromeTitleParams = {
  background: '/template-assets/chrome-title/dark-desk.jpg',
  title: '解决问题',
  top: '真正困难',
  sub: 'Truly difficult',
  dim: 0.8,
  vignette: true,
  // 原片 76 帧
  duration: 2.53,
};

const frames = (sec: number) => Math.round(sec * FPS);

export function toProps(p: ChromeTitleParams): ChromeTitleProps {
  return {
    background: p.background,
    title: p.title.trim(),
    top: p.top.trim(),
    sub: p.sub.trim(),
    dim: Math.min(1, Math.max(0.2, p.dim ?? 0.8)),
    vignette: p.vignette !== false,
    durationInFrames: Math.max(1, frames(p.duration)),
  };
}

const form: Section[] = [
  {
    title: '画面',
    fields: [
      { kind: 'media', key: 'background', label: '背景', hint: '暗一点的视频或图片效果最好（原片是一段昏暗的操作电脑的画面）' },
      { kind: 'number', key: 'dim', label: '背景亮度', min: 0.2, max: 1, step: 0.05, hint: '1 = 原样，越小越暗' },
      { kind: 'toggle', key: 'vignette', label: '四周暗角' },
      { kind: 'number', key: 'duration', label: '视频时长', min: 0.5, max: 30, step: 0.1, unit: '秒', hint: '标题一直慢慢放大' },
    ],
  },
  {
    title: '文字',
    fields: [
      { kind: 'text', key: 'title', label: '大标题', hint: '四五个字最好看' },
      { kind: 'text', key: 'top', label: '上面的小字', half: true, placeholder: '留空不要' },
      { kind: 'text', key: 'sub', label: '下面的英文', half: true, placeholder: '留空不要' },
    ],
  },
];

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export const timeline: TemplateTimeline = {
  tracks: (raw) => {
    const p = raw as unknown as ChromeTitleParams;
    return [
      { id: 'camera', label: '镜头', kind: 'camera', items: [{ id: 'cam', label: '慢慢放大', start: 0, end: p.duration, select: { section: '画面' }, drag: { end: true } }] },
      { id: 'elements', label: '元素', kind: 'element', items: [{ id: 'title', label: p.title, start: 0, end: p.duration, select: { section: '文字' }, drag: {} }] },
    ];
  },
  apply: (raw, itemId, _edge, _start, end) => {
    if (itemId === 'cam') return { ...raw, duration: clamp(Math.round(end * FPS) / FPS, 0.5, 30) };
    return raw;
  },
};

export const meta: TemplateMeta = {
  id: 'chrome-title',
  name: '金属拉丝大标题',
  description: '暗暗的视频画面上一行金属拉丝质感的斜体大标题，上面一行疏排小字、下面一行等宽英文，整组慢慢放大',
  origin: '复刻自一条讲开源大模型的视频里的一个镜头，和原片的相似度 92.4%',
  width: 1280,
  height: 720,
  fps: FPS,
  posterFrame: 40,
  form,
  defaultParams: defaultParams as unknown as Record<string, unknown>,
  timeline,
};
