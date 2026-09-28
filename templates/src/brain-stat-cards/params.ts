import type { Section, TemplateMeta, TemplateTimeline } from '../form';
import type { BrainStatCardsProps, StatCard, StatGroup } from './BrainStatCards';

const FPS = 30;

export type BrainStatCardsParams = {
  image: string;
  title: string;
  word: string;
  question: string;
  answer: string;
  label1: string;
  label1Sub: string;
  cards1: StatCard[];
  label2: string;
  label2Sub: string;
  cards2: StatCard[];
  fabric: boolean;
  texture: string;
  duration: number;
};

export const defaultParams: BrainStatCardsParams = {
  image: '/template-assets/brain-stat-cards/brain.png',
  title: 'MODELX',
  word: '幻觉率',
  question: '李白是什么时候的诗人？',
  answer: '李白是宋朝的诗人。',
  label1: '幻觉率',
  label1Sub: 'illusion rate',
  cards1: [
    { name: 'Model A', sub: '幻觉率 (Hallucination Rate)', value: '39', up: false, gold: false },
    { name: 'Model B', sub: '幻觉率 (Hallucination Rate)', value: '51', up: false, gold: true },
  ],
  label2: '正确率',
  label2Sub: 'accuracy rate',
  cards2: [
    { name: 'Model A', sub: '正确率 (Accuracy)', value: '33', up: false, gold: false },
    { name: 'Model B', sub: '正确率 (Accuracy)', value: '46', up: true, gold: true },
  ],
  fabric: true,
  texture: '',
  // 原片 427 帧
  duration: 14.23,
};

const frames = (sec: number) => Math.round(sec * FPS);

export function toProps(p: BrainStatCardsParams): BrainStatCardsProps {
  const card = (c: StatCard | undefined, gold: boolean): StatCard => ({
    name: (c?.name ?? '').trim(), sub: (c?.sub ?? '').trim(), value: (c?.value ?? '').trim(), up: c?.up === true, gold: c ? c.gold === true : gold,
  });
  const group = (label: string, sub: string, cards: StatCard[]): StatGroup => ({
    label: (label ?? '').trim(), labelSub: (sub ?? '').trim(), cards: [card(cards[0], false), card(cards[1], true)],
  });
  return {
    image: p.image ?? '',
    title: (p.title ?? '').trim(),
    word: (p.word ?? '').trim(),
    question: (p.question ?? '').trim(),
    answer: (p.answer ?? '').trim(),
    groups: [group(p.label1, p.label1Sub, p.cards1 ?? []), group(p.label2, p.label2Sub, p.cards2 ?? [])],
    texture: p.fabric === false ? 'none' : p.texture ?? '',
    durationInFrames: Math.max(frames(11.5), frames(p.duration)),
  };
}

const cardFields = [
  { kind: 'text', key: 'name', label: '名字', half: true },
  { kind: 'text', key: 'value', label: '百分数（不带 %）', half: true },
  { kind: 'text', key: 'sub', label: '名字下面的小字' },
  { kind: 'toggle', key: 'up', label: '箭头朝上', half: true },
  { kind: 'toggle', key: 'gold', label: '金色卡片（关掉是蓝色）', half: true },
] as const;

const form: Section[] = [
  {
    title: '大脑',
    fields: [
      { kind: 'image', key: 'image', label: '中间的图', hint: '透明底 PNG 最好（原片是一个大脑），开头会转着推近' },
      { kind: 'text', key: 'title', label: '左上的粗斜体英文', half: true },
      { kind: 'text', key: 'word', label: '右下的斜体大字', half: true },
      { kind: 'text', key: 'question', label: '第一条对话标签', placeholder: '留空不要' },
      { kind: 'text', key: 'answer', label: '第二条对话标签', placeholder: '留空不要' },
    ],
  },
  {
    title: '卡片',
    fields: [
      { kind: 'text', key: 'label1', label: '第一组的标签', half: true },
      { kind: 'text', key: 'label1Sub', label: '标签下的小英文', half: true },
      { kind: 'list', key: 'cards1', label: '第一组两张小卡（左、右）', itemLabel: '卡', fields: [...cardFields], newItem: () => ({ name: '新的卡', sub: '', value: '0', up: false, gold: true }) },
      { kind: 'text', key: 'label2', label: '第二组的标签', half: true },
      { kind: 'text', key: 'label2Sub', label: '标签下的小英文', half: true },
      { kind: 'list', key: 'cards2', label: '第二组两张大卡（左、右）', itemLabel: '卡', fields: [...cardFields], newItem: () => ({ name: '新的卡', sub: '', value: '0', up: true, gold: true }) },
      { kind: 'number', key: 'duration', label: '视频时长', min: 11.5, max: 60, step: 0.1, unit: '秒', half: true },
      { kind: 'toggle', key: 'fabric', label: '画面盖一层细布纹', half: true },
      { kind: 'image', key: 'texture', label: '换成自己的纹理图（可选）', hint: '1280×720 灰度图，中灰不变、亮的变亮、暗的变暗；留空用自带的细布纹' },
    ],
  },
];

export const timeline: TemplateTimeline = {
  tracks: (raw) => {
    const p = raw as unknown as BrainStatCardsParams;
    return [
      {
        id: 'camera', label: '镜头', kind: 'camera',
        items: [
          { id: 'brain', label: p.word || '大脑', start: 0, end: 5.1, phases: [{ label: '转正推近', start: 0, end: 1.87 }, { label: '对话标签', start: 2.93, end: 4.87 }], select: { section: '大脑' }, drag: {} },
          { id: 'cards', label: '卡片', start: 5.1, end: p.duration, phases: [{ label: '小卡', start: 5.47, end: 7.2 }, { label: '拉远', start: 8.67, end: 9.67 }, { label: '大卡', start: 9, end: 11 }], select: { section: '卡片' }, drag: { end: true } },
        ],
      },
    ];
  },
  apply: (raw, itemId, edge, _start, end) => {
    if (itemId === 'cards' && edge === 'end') return { ...raw, duration: Math.min(60, Math.max(11.5, Math.round(end * FPS) / FPS)) };
    return raw;
  },
};

export const meta: TemplateMeta = {
  id: 'brain-stat-cards',
  name: '转正的大脑 · 对话标签 · 挂着的数据卡片',
  description: '灰纸上一张图（原片是大脑）转着推近，左上粗斜体英文、右下斜体大字打出来；两条深色对话标签飞进来打字，垂下两根线到黑球；镜头顺着往下甩，四张深色数据卡片一张张显影，最后拉远看全',
  origin: '复刻自一条讲大模型幻觉率的视频，和原片的相似度 87.3%',
  width: 1280,
  height: 720,
  fps: FPS,
  posterFrame: 400,
  form,
  defaultParams: defaultParams as unknown as Record<string, unknown>,
  timeline,
};
