import type { Section, TemplateMeta, TemplateTimeline } from '../form';
import type { PersonCardData } from '../person-card/PersonCard';
import { PERSON_CARD_LIST, defaultParams as companyDefaults } from '../company-cards/params';
import type { CardsNoteProps } from './CardsNote';

const FPS = 30;

export type CardsNoteParams = {
  background: string;
  cards: PersonCardData[];
  line1: string;
  line2: string;
  line3: string;
  typeAt: number;
  threadColor: string;
  duration: number;
};

export const defaultParams: CardsNoteParams = {
  background: '/template-assets/company-cards/sample-bg.jpg',
  cards: companyDefaults.cards,
  line1: 'Apple Watch Series 6',
  line2: '首次配备了血氧传感器',
  line3: '和“血氧”App',
  // 原片开头第一行已经快打完了：打字其实在开头之前 16 帧就开始了
  typeAt: -0.53,
  threadColor: '#d42a2a',
  duration: 2.6,
};

export function toProps(p: CardsNoteParams): CardsNoteProps {
  return {
    background: p.background,
    cards: p.cards.slice(0, 2),
    lines: [p.line1, p.line2, p.line3].filter((l) => l.trim() !== ''),
    typeAt: Math.round(p.typeAt * FPS),
    threadColor: p.threadColor,
    durationInFrames: Math.max(1, Math.round(p.duration * FPS)),
  };
}

const form: Section[] = [
  {
    title: '中间的字',
    fields: [
      { kind: 'text', key: 'line1', label: '第一行', hint: '英文会变成细斜体' },
      { kind: 'text', key: 'line2', label: '第二行' },
      { kind: 'text', key: 'line3', label: '第三行', placeholder: '留空不要' },
      { kind: 'number', key: 'typeAt', label: '第几秒开始打字', min: -3, max: 60, step: 0.1, unit: '秒', hint: '负数表示开场时已经打了一部分' },
    ],
  },
  { title: '人物卡片', fields: [PERSON_CARD_LIST] },
  {
    title: '其他',
    fields: [
      { kind: 'color', key: 'threadColor', label: '红线颜色' },
      { kind: 'media', key: 'background', label: '背景' },
      { kind: 'number', key: 'duration', label: '视频时长', min: 1, max: 60, step: 0.1, unit: '秒' },
    ],
  },
];

const snap = (t: number) => Math.round((Math.round(t * FPS) / FPS) * 100) / 100;

export const timeline: TemplateTimeline = {
  tracks: (raw) => {
    const p = raw as unknown as CardsNoteParams;
    return [{ id: 'type', label: '打字', kind: 'element', items: [{ id: 'type', label: [p.line1, p.line2, p.line3].join(' '), start: Math.max(0, p.typeAt), end: p.duration, select: { section: '中间的字' }, drag: { move: true, end: true } }] }];
  },
  apply: (raw, _itemId, edge, start, end) => {
    const p = raw as unknown as CardsNoteParams;
    if (edge === 'end') return { ...raw, duration: Math.min(60, Math.max(1, snap(end))) };
    return { ...raw, typeAt: Math.min(60, Math.max(-3, snap(start - (p.typeAt < 0 ? 0 : 0)))) };
  },
};

export const meta: TemplateMeta = {
  id: 'cards-note',
  name: '两张人物卡片 · 中间打字',
  description: '两张人物卡片的特写，一根红线把它们连起来，中间一段字一个字一个字打出来',
  origin: '复刻自一条新闻解读视频里的一个镜头，和原片的相似度 75.5%（原片的针筒是实拍照片，卡片是实物翻拍）',
  width: 1280,
  height: 720,
  fps: FPS,
  posterFrame: 70,
  form,
  defaultParams: defaultParams as unknown as Record<string, unknown>,
  timeline,
};
