import type { Section, TemplateMeta, TemplateTimeline } from '../form';
import type { TornCardsProps } from './TornCards';

const FPS = 30;

export type TornCardsParams = {
  background: string;
  cards: { image: string; size: number; at: number }[];
  duration: number;
};

export const defaultParams: TornCardsParams = {
  background: '/template-assets/torn-cards/sample-bg.jpg',
  // 原片：第 3 帧第一张进来，第 72 帧第二张进来；卡片边长占画面高度的百分比（534、392 像素）
  cards: [
    { image: '/template-assets/torn-cards/sample-1.png', size: 74, at: 0.1 },
    { image: '/template-assets/torn-cards/sample-2.png', size: 55, at: 2.4 },
  ],
  duration: 5.33,
};

export function toProps(p: TornCardsParams): TornCardsProps {
  const cards = [...p.cards].sort((a, b) => a.at - b.at);
  return {
    background: p.background,
    cards: cards.map((c) => ({ image: c.image, size: (Math.min(95, Math.max(20, c.size)) / 100) * 720, at: Math.round(c.at * FPS) })),
    durationInFrames: Math.max(1, Math.round(p.duration * FPS)),
  };
}

const form: Section[] = [
  {
    title: '卡片',
    fields: [
      {
        kind: 'list', key: 'cards', label: '卡片', itemLabel: '卡片',
        hint: '第一张从左下角斜着转进来，之后每张从右边滑进来，前一张往左甩出去',
        fields: [
          { kind: 'image', key: 'image', label: '图片', hint: '白底或透明底的产品图最好看' },
          { kind: 'number', key: 'size', label: '大小', min: 20, max: 95, step: 1, unit: '%', half: true, hint: '占画面高度' },
          { kind: 'number', key: 'at', label: '第几秒进来', min: 0, max: 60, step: 0.1, unit: '秒', half: true },
        ],
        newItem: (items) => {
          const last = items[items.length - 1] as { at?: number } | undefined;
          return { image: '/template-assets/torn-cards/sample-2.png', size: 54, at: Math.round(((last?.at ?? 0) + 2.3) * 10) / 10 };
        },
      },
    ],
  },
  {
    title: '背景',
    fields: [
      { kind: 'media', key: 'background', label: '背景', hint: '暗色、做旧的底图或视频' },
      { kind: 'number', key: 'duration', label: '视频时长', min: 1, max: 60, step: 0.1, unit: '秒' },
    ],
  },
];

const snap = (t: number) => Math.round((Math.round(t * FPS) / FPS) * 100) / 100;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export const timeline: TemplateTimeline = {
  tracks: (raw) => {
    const p = raw as unknown as TornCardsParams;
    const sorted = p.cards.map((c, i) => ({ c, i })).sort((a, b) => a.c.at - b.c.at);
    return sorted.map(({ c, i }, k) => {
      const next = sorted[k + 1];
      const end = next ? next.c.at : p.duration;
      return {
        id: `card-${i}`, label: `卡片 ${k + 1}`, kind: 'element' as const,
        items: [{
          id: `card-${i}`, label: k === 0 ? '斜着转进来' : '从右边滑进来', start: c.at, end: Math.max(c.at, end),
          phases: next ? [{ label: '甩出去', start: Math.max(c.at, next.c.at - 0.8), end: next.c.at }] : undefined,
          select: { list: 'cards', index: i }, drag: { move: true },
        }],
      };
    });
  },
  apply: (raw, itemId, _edge, start) => {
    const p = raw as unknown as TornCardsParams;
    const i = Number(/^card-(\d+)$/.exec(itemId)?.[1] ?? -1);
    if (!p.cards[i]) return raw;
    return { ...raw, cards: p.cards.map((c, j) => (j === i ? { ...c, at: clamp(snap(start), 0, 60) } : c)) };
  },
};

export const meta: TemplateMeta = {
  id: 'torn-cards',
  name: '撕纸边产品卡片 · 依次切换',
  description: '暗色做旧背景上，撕纸毛边的产品图卡片：第一张斜着转进来，之后每张从右边滑进来，前一张往左甩出去',
  origin: '复刻自一条新闻解读视频里的一个镜头，和原片的相似度 92.0%（卡片里的图用原片画面比）',
  width: 1280,
  height: 720,
  fps: FPS,
  posterFrame: 45,
  form,
  defaultParams: defaultParams as unknown as Record<string, unknown>,
  timeline,
};
