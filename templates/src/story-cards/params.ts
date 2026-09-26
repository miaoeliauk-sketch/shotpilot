import type { Section, TemplateMeta, TemplateTimeline } from '../form';
import type { StoryCard, StoryCardsProps } from './StoryCards';

const FPS = 30;

export type StoryCardsParams = { cards: StoryCard[]; center: string; centerAt: number; duration: number };

const A = '/template-assets/story-cards';

export const defaultParams: StoryCardsParams = {
  cards: [
    { image: `${A}/family-car.jpg`, text: '暑假一家五口出去玩五天', at: 0 },
    { image: `${A}/elder.jpg`, text: '老人坐不了早班机', at: 2.5 },
    { image: `${A}/slide.jpg`, text: '孩子非要去游乐园', at: 3.73 },
    { image: `${A}/calculator.jpg`, text: '预算卡死在10000元', at: 5.27 },
    { image: `${A}/phone-chat.jpg`, text: '家庭群里酒店链接\n攻略、想吃的店', at: 7 },
  ],
  center: '总结行程',
  // 原片：第 305 帧黑圆长出来，一共 397 帧
  centerAt: 10.17,
  duration: 13.23,
};

const frames = (sec: number) => Math.round(sec * FPS);

export function toProps(p: StoryCardsParams): StoryCardsProps {
  return {
    cards: p.cards.slice(0, 5).map((c) => ({ image: c.image, text: c.text.trim(), at: frames(c.at) })),
    center: p.center.trim(),
    centerAt: frames(p.centerAt),
    durationInFrames: Math.max(frames(4), frames(p.duration)),
  };
}

const form: Section[] = [
  {
    title: '卡片',
    fields: [
      {
        kind: 'list', key: 'cards', label: '卡片（最多 5 张：上、右上、左上、左下、右下）', itemLabel: '卡片',
        fields: [
          { kind: 'image', key: 'image', label: '图', hint: '黑白照片最像原片；第 1、4 张图在下面，其它在左边' },
          { kind: 'text', key: 'text', label: '一句话', hint: '一个字一个字打出来；可以换行' },
          { kind: 'number', key: 'at', label: '第几秒滑进来', min: 0, max: 60, step: 0.1, unit: '秒', hint: '第 1 张一开始就在' },
        ],
        newItem: (items) => ({ image: `${A}/slide.jpg`, text: '新的一句话', at: Number((items[items.length - 1] as StoryCard | undefined)?.at ?? 0) + 1.5 }),
      },
    ],
  },
  {
    title: '中间的圆',
    fields: [
      { kind: 'text', key: 'center', label: '圆里的字', placeholder: '留空不要圆和线' },
      { kind: 'number', key: 'centerAt', label: '第几秒圆长出来', min: 0, max: 60, step: 0.1, unit: '秒', hint: '之后 1.1 秒起细线一根根连到卡片' },
      { kind: 'number', key: 'duration', label: '视频时长', min: 4, max: 60, step: 0.1, unit: '秒', hint: '最后 0.57 秒整个往上甩走' },
    ],
  },
];

const snap = (t: number) => Math.round((Math.round(t * FPS) / FPS) * 100) / 100;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export const timeline: TemplateTimeline = {
  tracks: (raw) => {
    const p = raw as unknown as StoryCardsParams;
    return [
      { id: 'camera', label: '镜头', kind: 'camera', items: [{ id: 'cam', label: '特写 → 拉远', start: 0, end: p.duration, phases: [{ label: '拉远', start: 1.33, end: 6 }, { label: '甩走', start: p.duration - 0.57, end: p.duration }], select: { section: '中间的圆' }, drag: { end: true } }] },
      {
        id: 'elements', label: '元素', kind: 'element',
        items: [
          ...p.cards.slice(0, 5).map((c, i) => ({ id: `card-${i}`, label: c.text.replace(/\n/g, ' '), start: c.at, end: Math.min(p.duration, c.at + 0.73 + Array.from(c.text).length * 0.117), select: { list: 'cards', index: i }, drag: { move: i > 0 } })),
          ...(p.center ? [{ id: 'center', label: p.center, start: p.centerAt, end: p.duration, select: { section: '中间的圆' }, drag: { move: true } }] : []),
        ],
      },
    ];
  },
  apply: (raw, itemId, _edge, start, end) => {
    const p = raw as unknown as StoryCardsParams;
    if (itemId === 'cam') return { ...raw, duration: clamp(snap(end), 4, 60) };
    if (itemId === 'center') return { ...raw, centerAt: clamp(snap(start), 0, 60) };
    const m = /^card-(\d+)$/.exec(itemId);
    if (m) {
      const i = Number(m[1]);
      return { ...raw, cards: p.cards.map((c, k) => (k === i ? { ...c, at: clamp(snap(start), 0, 60) } : c)) };
    }
    return raw;
  },
};

export const meta: TemplateMeta = {
  id: 'story-cards',
  name: '图文卡片一张张滑进来 · 中间黑圆连线',
  description: '浅灰纸上一张张「图 + 一句话」的圆角卡片：先是一张的特写、字一个个打出来，镜头拉远，其它卡片从四周斜着滑进来；最后中间黑圆长大、细线连到每张卡片',
  origin: '复刻自一条讲编程评测榜单的视频里的一个镜头，和原片的相似度 85.5%',
  width: 1280,
  height: 720,
  fps: FPS,
  posterFrame: 370,
  form,
  defaultParams: defaultParams as unknown as Record<string, unknown>,
  timeline,
};
