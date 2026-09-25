import type { Section, TemplateMeta, TemplateTimeline } from '../form';
import type { CirclePhotosProps } from './CirclePhotos';

const FPS = 30;

export type CircleItemParams = { image: string; label: string; at: number };

export type CirclePhotosParams = {
  background: string;
  items: CircleItemParams[];
  vignette: boolean;
  duration: number;
};

const A = '/template-assets/circle-photos';

export const defaultParams: CirclePhotosParams = {
  background: '/template-assets/icon-bubbles/grid-paper.jpg',
  // 原片：三张圆分别在第 0、16、46 帧落下来，一共 116 帧
  items: [
    { image: `${A}/envelope.jpg`, label: '完整', at: 0 },
    { image: `${A}/letter.jpg`, label: '流畅', at: 0.53 },
    { image: `${A}/ticket.jpg`, label: '格式', at: 1.53 },
  ],
  vignette: true,
  duration: 3.87,
};

const frames = (sec: number) => Math.round(sec * FPS);
const MAX_ITEMS = 4;

export function toProps(p: CirclePhotosParams): CirclePhotosProps {
  return {
    background: p.background,
    items: p.items.slice(0, MAX_ITEMS).map((it) => ({ image: it.image, label: it.label.trim(), at: frames(it.at) })),
    vignette: p.vignette !== false,
    durationInFrames: Math.max(1, frames(p.duration)),
  };
}

const form: Section[] = [
  {
    title: '画面',
    fields: [
      { kind: 'media', key: 'background', label: '背景', hint: '横图或视频；原片是一张网格纸' },
      { kind: 'toggle', key: 'vignette', label: '四周暗角' },
      { kind: 'number', key: 'duration', label: '视频时长', min: 1, max: 60, step: 0.1, unit: '秒' },
    ],
  },
  {
    title: '圆形图片',
    fields: [
      {
        kind: 'list', key: 'items', label: '图片', itemLabel: '第',
        fields: [
          { kind: 'media', key: 'image', label: '图片', hint: '会裁成圆形，主体放中间；最多 4 张，三张时中间那张最大' },
          { kind: 'text', key: 'label', label: '标签', half: true, placeholder: '留空不要', hint: '白字，两边自动加红色引号' },
          { kind: 'number', key: 'at', label: '第几秒落下来', min: 0, max: 60, step: 0.1, unit: '秒', half: true },
        ],
        newItem: (items) => {
          const last = items[items.length - 1] as CircleItemParams | undefined;
          return { image: `${A}/envelope.jpg`, label: '新标签', at: Math.round(((last?.at ?? 0) + 0.8) * 10) / 10 };
        },
      },
    ],
  },
];

const snap = (t: number) => Math.round((Math.round(t * FPS) / FPS) * 100) / 100;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export const timeline: TemplateTimeline = {
  tracks: (raw) => {
    const p = raw as unknown as CirclePhotosParams;
    return [
      { id: 'camera', label: '镜头', kind: 'camera', items: [{ id: 'cam', label: '慢慢拉远', start: 0, end: p.duration, select: { section: '画面' }, drag: { end: true } }] },
      {
        id: 'elements', label: '元素', kind: 'element',
        items: p.items.slice(0, MAX_ITEMS).map((it, i) => ({
          id: `item-${i}`, label: it.label || `图片 ${i + 1}`, start: it.at, end: Math.min(p.duration, it.at + 0.53), select: { list: 'items', index: i }, drag: { move: true },
        })),
      },
    ];
  },
  apply: (raw, itemId, _edge, start, end) => {
    const p = raw as unknown as CirclePhotosParams;
    if (itemId === 'cam') return { ...raw, duration: clamp(snap(end), 1, 60) };
    const m = /^item-(\d+)$/.exec(itemId);
    if (m) {
      const i = Number(m[1]);
      return { ...raw, items: p.items.map((it, k) => (k === i ? { ...it, at: clamp(snap(start), 0, 60) } : it)) };
    }
    return raw;
  },
};

export const meta: TemplateMeta = {
  id: 'circle-photos',
  name: '圆形图片 · 红引号标签',
  description: '网格纸上几张圆形图片一张张落下来，底下压着带红色引号的白字标签，镜头慢慢拉远',
  origin: '复刻自一条讲 AI 幻觉的视频里的一个镜头，和原片的相似度 92.6%',
  width: 1280,
  height: 720,
  fps: FPS,
  posterFrame: 100,
  form,
  defaultParams: defaultParams as unknown as Record<string, unknown>,
  timeline,
};
