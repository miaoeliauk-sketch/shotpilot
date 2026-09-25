import type { Section, TemplateMeta, TemplateTimeline } from '../form';
import type { CardTagsProps, SideTag } from './CardTags';

const FPS = 30;

export type CardPageParams = { image: string; fill: boolean; watermark: string; caption: string; at: number; scroll: boolean };
export type CardLabelParams = { text: string; page: number; x: number; y: number; dark: boolean; at: number };
export type SideTagParams = { text: string; sub: string; accent: string; glow: boolean; slot: SideTag['slot']; at: number };

export type CardTagsParams = {
  background: string;
  pages: CardPageParams[];
  labels: CardLabelParams[];
  tags: SideTagParams[];
  exitAt: number;
  duration: number;
};

const A = '/template-assets/card-tags';

export const defaultParams: CardTagsParams = {
  background: `${A}/studio.jpg`,
  // 原片：第 66 帧换第二页（淡入）、第 150 帧往上滚到第三页，第 166 帧卡片甩出去，一共 200 帧
  pages: [
    { image: '/template-assets/icon-bubbles/brain.png', fill: false, watermark: '反幻觉', caption: 'AI 味是因为 AI 还不够聪明', at: 0, scroll: false },
    { image: '/template-assets/icon-bubbles/brain.png', fill: false, watermark: '反幻觉', caption: '等它再进化就好了', at: 2.2, scroll: false },
    { image: `${A}/robot.png`, fill: false, watermark: '', caption: 'AI 味不是因为它笨', at: 5, scroll: true },
  ],
  labels: [
    { text: 'AI不够聪明?', page: 1, x: 410, y: 229, dark: false, at: 0 },
    { text: '彻底去除AI味', page: 2, x: 415, y: 330, dark: true, at: 2.33 },
    { text: '性能提升120%', page: 2, x: 160, y: 120, dark: true, at: 2.47 },
    { text: 'XX模型新版本', page: 2, x: 650, y: 120, dark: true, at: 2.6 },
    { text: '他是不是太自私了', page: 3, x: 215, y: 270, dark: false, at: 5.1 },
    { text: '这季度搞砸了', page: 3, x: 230, y: 340, dark: false, at: 5.2 },
  ],
  tags: [
    { text: '把话接下去', sub: 'Continue speaking', accent: '', glow: false, slot: 'middle', at: 0 },
    { text: '把后面补完整', sub: '', accent: '补', glow: true, slot: 'bottom', at: 1.4 },
    { text: '幻觉的根源', sub: '', accent: '', glow: false, slot: 'top', at: 4.57 },
  ],
  exitAt: 5.53,
  duration: 6.67,
};

const frames = (sec: number) => Math.round(sec * FPS);

export function toProps(p: CardTagsParams): CardTagsProps {
  const pages = p.pages.slice(0, 4).map((pg, i) => ({ ...pg, at: i === 0 ? 0 : frames(pg.at) }));
  return {
    background: p.background,
    pages,
    // 表单里页数从 1 数起
    labels: p.labels.filter((l) => l.text.trim()).map((l) => ({ ...l, page: Math.max(0, Math.round(l.page) - 1), at: frames(l.at) })),
    tags: p.tags.slice(0, 3).filter((t) => t.text.trim()).map((t) => ({ ...t, accent: t.accent ?? '', at: frames(t.at) })),
    exitAt: frames(p.exitAt),
    durationInFrames: Math.max(1, frames(p.duration)),
  };
}

const form: Section[] = [
  {
    title: '画面',
    fields: [
      { kind: 'media', key: 'background', label: '背景（口播画面）', hint: '视频最好；卡片在的时候会压暗' },
      { kind: 'number', key: 'exitAt', label: '第几秒卡片甩出去', min: 0, max: 60, step: 0.1, unit: '秒', half: true },
      { kind: 'number', key: 'duration', label: '视频时长', min: 1, max: 60, step: 0.1, unit: '秒', half: true },
    ],
  },
  {
    title: '卡片',
    fields: [
      {
        kind: 'list', key: 'pages', label: '卡片的每一页', itemLabel: '第',
        fields: [
          { kind: 'media', key: 'image', label: '图片' },
          { kind: 'toggle', key: 'fill', label: '铺满卡片', hint: '关掉就放在中间（透明底的图更好看）' },
          { kind: 'text', key: 'watermark', label: '水印大字', half: true, placeholder: '留空不要' },
          { kind: 'text', key: 'caption', label: '底下一行小字', half: true, placeholder: '留空不要' },
          { kind: 'number', key: 'at', label: '第几秒换到这一页', min: 0, max: 60, step: 0.1, unit: '秒', half: true },
          { kind: 'toggle', key: 'scroll', label: '往上滚着换页', half: true, hint: '关掉就是淡入淡出' },
        ],
        newItem: (items) => {
          const last = items[items.length - 1] as CardPageParams | undefined;
          return { image: `${A}/robot.png`, fill: false, watermark: '', caption: '', at: Math.round(((last?.at ?? 0) + 2) * 10) / 10, scroll: true };
        },
      },
      {
        kind: 'list', key: 'labels', label: '卡片上的小标签', itemLabel: '标签',
        fields: [
          { kind: 'text', key: 'text', label: '字' },
          { kind: 'number', key: 'page', label: '贴在第几页', min: 1, max: 4, step: 1, half: true },
          { kind: 'toggle', key: 'dark', label: '黑底白字', half: true, hint: '关掉是白纸黑字' },
          { kind: 'number', key: 'x', label: '横向位置', min: 0, max: 826, step: 1, half: true, hint: '卡片里，0 在左边' },
          { kind: 'number', key: 'y', label: '纵向位置', min: 0, max: 446, step: 1, half: true, hint: '卡片里，0 在上边' },
          { kind: 'number', key: 'at', label: '第几秒出来', min: 0, max: 60, step: 0.1, unit: '秒' },
        ],
        newItem: (items) => {
          const last = items[items.length - 1] as CardLabelParams | undefined;
          return { text: '新标签', page: last?.page ?? 1, x: 413, y: 223, dark: true, at: Math.round(((last?.at ?? 0) + 0.5) * 10) / 10 };
        },
      },
    ],
  },
  {
    title: '右边词条',
    fields: [
      {
        kind: 'list', key: 'tags', label: '词条（最多 3 个）', itemLabel: '词条',
        fields: [
          { kind: 'text', key: 'text', label: '字', half: true },
          { kind: 'text', key: 'sub', label: '英文小字', half: true, placeholder: '留空不要', hint: '只有橙色方块有' },
          { kind: 'text', key: 'accent', label: '标红的字', half: true, placeholder: '留空不标', hint: '词条里的字，比如「补」' },
          { kind: 'toggle', key: 'glow', label: '发光字', half: true, hint: '关掉是橙色方块' },
          {
            kind: 'select', key: 'slot', label: '放在哪', half: true,
            options: [{ value: 'top', label: '上' }, { value: 'middle', label: '中' }, { value: 'bottom', label: '下' }],
          },
          { kind: 'number', key: 'at', label: '第几秒出来', min: 0, max: 60, step: 0.1, unit: '秒' },
        ],
        newItem: (items) => {
          const last = items[items.length - 1] as SideTagParams | undefined;
          return { text: '新词条', sub: '', accent: '', glow: false, slot: 'top', at: Math.round(((last?.at ?? 0) + 1) * 10) / 10 };
        },
      },
    ],
  },
];

const snap = (t: number) => Math.round((Math.round(t * FPS) / FPS) * 100) / 100;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export const timeline: TemplateTimeline = {
  tracks: (raw) => {
    const p = raw as unknown as CardTagsParams;
    return [
      {
        id: 'camera', label: '卡片', kind: 'camera',
        items: [{ id: 'card', label: '卡片', start: 0, end: Math.min(p.duration, p.exitAt + 0.8), phases: [{ label: '甩出去', start: p.exitAt, end: Math.min(p.duration, p.exitAt + 0.8) }], select: { section: '画面' }, drag: { end: true } }],
      },
      {
        id: 'elements', label: '元素', kind: 'element',
        items: [
          ...p.pages.slice(1, 4).map((pg, i) => ({ id: `page-${i + 1}`, label: `第 ${i + 2} 页`, start: pg.at, end: Math.min(p.duration, pg.at + 0.27), select: { list: 'pages', index: i + 1 }, drag: { move: true } })),
          ...p.tags.slice(0, 3).map((t, i) => ({ id: `tag-${i}`, label: t.text, start: t.at, end: Math.min(p.duration, p.exitAt + 0.9), select: { list: 'tags', index: i }, drag: { move: true } })),
        ],
      },
    ];
  },
  apply: (raw, itemId, _edge, start, end) => {
    const p = raw as unknown as CardTagsParams;
    if (itemId === 'card') return { ...raw, exitAt: clamp(snap(end - 0.8), 0, 60) };
    let m = /^page-(\d+)$/.exec(itemId);
    if (m) {
      const i = Number(m[1]);
      return { ...raw, pages: p.pages.map((pg, k) => (k === i ? { ...pg, at: clamp(snap(start), 0, 60) } : pg)) };
    }
    m = /^tag-(\d+)$/.exec(itemId);
    if (m) {
      const i = Number(m[1]);
      return { ...raw, tags: p.tags.map((t, k) => (k === i ? { ...t, at: clamp(snap(start), 0, 60) } : t)) };
    }
    return raw;
  },
};

export const meta: TemplateMeta = {
  id: 'card-tags',
  name: '口播压暗 · 斜卡片 · 橙色词条',
  description: '口播画面压暗，左上一张斜放的纸卡片（可以换几页、贴小标签），右边橙色词条一个个弹出来；最后卡片甩出去、画面亮回来',
  origin: '复刻自一条讲 AI 幻觉的视频里的一个镜头，和原片的相似度 84.3%',
  width: 1280,
  height: 720,
  fps: FPS,
  posterFrame: 140,
  form,
  defaultParams: defaultParams as unknown as Record<string, unknown>,
  timeline,
};
