import type { Section, TemplateMeta, TemplateTimeline } from '../form';
import type { DocPortraitCountProps } from './DocPortraitCount';

const FPS = 30;

export type DocPortraitCountParams = {
  wall: string;
  doc: string;
  caption: string;
  person: string;
  personBlur: number;
  count: number;
  label: string;
  cardTitle: string;
  cardSub: string;
  docOutAt: number;
  countAt: number;
  cardsAt: number;
  duration: number;
};

export const defaultParams: DocPortraitCountParams = {
  wall: '/template-assets/doc-portrait-count/wall.jpg',
  doc: '/template-assets/doc-portrait-count/sample-doc.jpg',
  caption: '一份判决书的第一页',
  person: '/template-assets/doc-portrait-count/sample-person.png',
  personBlur: 3,
  count: 30,
  label: '从业资历',
  cardTitle: '假判案例',
  cardSub: 'Fake case',
  // 原片：第 142 帧文件滑走、182 帧出数字、346 帧飞纸片，一共 440 帧
  docOutAt: 4.73,
  countAt: 6.07,
  cardsAt: 11.53,
  duration: 14.67,
};

const frames = (sec: number) => Math.round(sec * FPS);

export function toProps(p: DocPortraitCountParams): DocPortraitCountProps {
  return {
    wall: p.wall,
    doc: p.doc,
    caption: p.caption.trim(),
    person: p.person,
    personBlur: Math.max(0, p.personBlur),
    count: Math.max(0, Math.round(p.count)),
    label: p.label,
    cardTitle: p.cardTitle,
    cardSub: p.cardSub,
    docOutAt: frames(p.docOutAt),
    countAt: frames(p.countAt),
    cardsAt: frames(p.cardsAt),
    durationInFrames: Math.max(1, frames(p.duration)),
  };
}

const form: Section[] = [
  {
    title: '文件',
    fields: [
      { kind: 'media', key: 'doc', label: '文件截图', hint: '横图（约 2:1），斜着滑进来' },
      { kind: 'text', key: 'caption', label: '上面一行小字', placeholder: '留空不要' },
      { kind: 'number', key: 'docOutAt', label: '第几秒滑走', min: 1, max: 60, step: 0.1, unit: '秒' },
      { kind: 'media', key: 'wall', label: '墙', hint: '浅色的墙或背景图' },
    ],
  },
  {
    title: '人物和数字',
    fields: [
      { kind: 'media', key: 'person', label: '人物', hint: '透明底的人物图，放在左边；文件滑走以后露出来' },
      { kind: 'number', key: 'personBlur', label: '人物虚化', min: 0, max: 12, step: 0.5, unit: 'px', hint: '0 就是不虚' },
      { kind: 'number', key: 'count', label: '数到几', min: 0, max: 9999, step: 1, half: true },
      { kind: 'text', key: 'label', label: '数字旁边的字', half: true },
      { kind: 'number', key: 'countAt', label: '第几秒出数字', min: 0, max: 60, step: 0.1, unit: '秒' },
    ],
  },
  {
    title: '纸片',
    fields: [
      { kind: 'text', key: 'cardTitle', label: '纸片上的字', half: true },
      { kind: 'text', key: 'cardSub', label: '纸片上的英文', half: true },
      { kind: 'number', key: 'cardsAt', label: '第几秒飞纸片', min: 0, max: 60, step: 0.1, unit: '秒', half: true },
      { kind: 'number', key: 'duration', label: '视频时长', min: 1, max: 60, step: 0.1, unit: '秒', half: true },
    ],
  },
];

const snap = (t: number) => Math.round((Math.round(t * FPS) / FPS) * 100) / 100;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export const timeline: TemplateTimeline = {
  tracks: (raw) => {
    const p = raw as unknown as DocPortraitCountParams;
    return [
      {
        id: 'camera', label: '画面', kind: 'camera',
        items: [
          { id: 'doc', label: '文件', start: 0, end: Math.min(p.duration, p.docOutAt + 1.4), phases: [{ label: '滑进来', start: 0, end: 2.33 }, { label: '滑走', start: p.docOutAt, end: Math.min(p.duration, p.docOutAt + 1.4) }], select: { section: '文件' }, drag: {} },
          { id: 'person', label: '人物', start: p.docOutAt, end: p.duration, select: { section: '人物和数字' }, drag: { end: true } },
        ],
      },
      {
        id: 'elements', label: '元素', kind: 'element',
        items: [
          { id: 'count', label: `${p.count} ${p.label}`, start: p.countAt, end: p.duration, select: { section: '人物和数字' }, drag: { move: true } },
          { id: 'cards', label: `纸片 · ${p.cardTitle}`, start: p.cardsAt, end: Math.min(p.duration, p.cardsAt + 1.2), select: { section: '纸片' }, drag: { move: true } },
        ],
      },
    ];
  },
  apply: (raw, itemId, _edge, start, end) => {
    const p = raw as unknown as DocPortraitCountParams;
    if (itemId === 'person') return { ...raw, duration: clamp(snap(end), p.docOutAt + 0.5, 60) };
    if (itemId === 'count') return { ...raw, countAt: clamp(snap(start), 0, 60) };
    if (itemId === 'cards') return { ...raw, cardsAt: clamp(snap(start), 0, 60) };
    return raw;
  },
};

export const meta: TemplateMeta = {
  id: 'doc-portrait-count',
  name: '文件截图 → 人物 · 金色数字 · 纸片',
  description: '灰墙窗影上一张文件截图斜着滑进来；文件虚掉滑走，露出后面的人物，金色大数字从 0 数上去，一排纸片飞出来',
  origin: '复刻自一条新闻解读视频里的一段，和原片的相似度 81.7%',
  width: 1280,
  height: 720,
  fps: FPS,
  posterFrame: 420,
  form,
  defaultParams: defaultParams as unknown as Record<string, unknown>,
  timeline,
};
