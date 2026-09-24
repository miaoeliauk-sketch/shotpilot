import type { Section, TemplateMeta, TemplateTimeline } from '../form';
import type { ProductBubblesProps } from './ProductBubbles';

const FPS = 30;
const PUSH_SECONDS = 45 / FPS;

export type ProductBubblesParams = {
  background: string;
  product: string;
  title: string;
  bubbles: { label: string; sub: string }[];
  focus: string;
  textColor: string;
  pushAt: number;
  duration: number;
};

export const defaultParams: ProductBubblesParams = {
  background: '/template-assets/product-bubbles/sample-bg.jpg',
  product: '/template-assets/product-bubbles/sample-product.png',
  title: 'Apple Watch',
  bubbles: [
    { label: '心脏', sub: '心率监测' },
    { label: '日常', sub: '日常健康记录' },
    { label: '血氧', sub: '血氧监测功能' },
  ],
  focus: '2',
  textColor: '#3e2c1a',
  // 原片第 45 帧开始推
  pushAt: 1.5,
  duration: 3.7,
};

export function toProps(p: ProductBubblesParams): ProductBubblesProps {
  return {
    background: p.background,
    product: p.product,
    title: p.title,
    bubbles: p.bubbles.slice(0, 3),
    focus: Number(p.focus) || 0,
    textColor: p.textColor,
    pushAt: Math.round(p.pushAt * FPS),
    durationInFrames: Math.max(1, Math.round(p.duration * FPS)),
  };
}

const form: Section[] = [
  {
    title: '产品',
    fields: [
      { kind: 'text', key: 'title', label: '产品大字', hint: '英文最好看，会自动拉成窄高的字' },
      { kind: 'image', key: 'product', label: '产品图', hint: '去掉背景的透明 PNG，放在大字中间' },
    ],
  },
  {
    title: '功能圆球',
    fields: [
      {
        kind: 'list', key: 'bubbles', label: '圆球', itemLabel: '圆球',
        hint: '最多 3 个，按出现顺序：右边、右下、右上（最大那个）',
        fields: [
          { kind: 'text', key: 'label', label: '大字', hint: '两个字最好' },
          { kind: 'text', key: 'sub', label: '小字', placeholder: '留空不要' },
        ],
        newItem: () => ({ label: '功能', sub: '' }),
      },
      {
        kind: 'select', key: 'focus', label: '镜头推向',
        options: [{ value: '0', label: '第 1 个球' }, { value: '1', label: '第 2 个球' }, { value: '2', label: '第 3 个球（原片）' }],
      },
      { kind: 'color', key: 'textColor', label: '大字颜色' },
    ],
  },
  {
    title: '镜头和背景',
    fields: [
      { kind: 'media', key: 'background', label: '背景', hint: '原片是一张米色方格纸' },
      { kind: 'number', key: 'pushAt', label: '第几秒开始推近', min: 0.5, max: 60, step: 0.1, unit: '秒' },
      { kind: 'number', key: 'duration', label: '视频时长', min: 1, max: 60, step: 0.1, unit: '秒' },
    ],
  },
];

const snap = (t: number) => Math.round((Math.round(t * FPS) / FPS) * 100) / 100;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export const timeline: TemplateTimeline = {
  tracks: (raw) => {
    const p = raw as unknown as ProductBubblesParams;
    return [{
      id: 'camera', label: '镜头', kind: 'camera',
      items: [
        { id: 'intro', label: '拉远 · 圆球长出来', start: 0, end: p.pushAt, select: { section: '功能圆球' }, drag: { end: true } },
        {
          id: 'push', label: '推向圆球', start: p.pushAt, end: p.duration,
          phases: [{ label: '推近', start: p.pushAt, end: Math.min(p.duration, p.pushAt + PUSH_SECONDS) }],
          select: { section: '镜头和背景' }, drag: { end: true },
        },
      ],
    }];
  },
  apply: (raw, itemId, _edge, _start, end) => {
    const p = raw as unknown as ProductBubblesParams;
    if (itemId === 'intro') return { ...raw, pushAt: clamp(snap(end), 0.5, p.duration - 0.1) };
    if (itemId === 'push') return { ...raw, duration: clamp(snap(end), p.pushAt + 0.1, 60) };
    return raw;
  },
};

export const meta: TemplateMeta = {
  id: 'product-bubbles',
  name: '产品大字 · 功能圆球推近',
  description: '产品名大字配产品图，三个功能圆球依次长出来，镜头推向其中一个',
  origin: '复刻自一条新闻解读视频里的一个镜头，和原片的相似度 85.7%',
  width: 1280,
  height: 720,
  fps: FPS,
  posterFrame: 42,
  form,
  defaultParams: defaultParams as unknown as Record<string, unknown>,
  timeline,
};
