import type { Section, TemplateMeta, TemplateTimeline } from '../form';
import type { PersonCardData } from '../person-card/PersonCard';
import type { CompanyCardsProps } from './CompanyCards';

const FPS = 30;

export type CompanyCardsParams = {
  background: string;
  company: string;
  nameAbove: string;
  nameBelow: string;
  signature: string;
  signatureColor: string;
  cards: PersonCardData[];
  whipAt: number;
  card2At: number;
  pushAt: number;
  duration: number;
};

export const defaultParams: CompanyCardsParams = {
  background: '/template-assets/company-cards/sample-bg.jpg',
  company: 'Masimo',
  nameAbove: '*麦斯莫医疗',
  nameBelow: '美国医疗技术公司',
  signature: 'Masimo',
  signatureColor: '#3a5ad8',
  cards: [
    { name: '迈克尔·奥赖利', english: "Michael O'Reilly", role: '首席医疗官', roleEnglish: 'Chief Medical Officer', image: '/template-assets/person-card/sample-syringe.png' },
    { name: '马塞洛·拉梅戈', english: 'Marcelo Lamego', role: '技术负责人', roleEnglish: 'Marcelo Lamego', image: '/template-assets/person-card/sample-syringe.png' },
  ],
  // 原片：第 110 帧开始横甩、第 206 帧第二张卡片、第 268 帧开始推近
  whipAt: 3.67,
  card2At: 6.87,
  pushAt: 8.93,
  duration: 9.87,
};

const frames = (sec: number) => Math.round(sec * FPS);

export function toProps(p: CompanyCardsParams): CompanyCardsProps {
  const durationInFrames = Math.max(1, frames(p.duration));
  return {
    background: p.background,
    company: p.company,
    nameAbove: p.nameAbove,
    nameBelow: p.nameBelow,
    signature: p.signature,
    signatureColor: p.signatureColor,
    cards: p.cards.slice(0, 2),
    whipAt: frames(p.whipAt),
    card2At: frames(p.card2At),
    pushAt: Math.min(durationInFrames, frames(p.pushAt)),
    durationInFrames,
  };
}

const cardFields = [
  { kind: 'text' as const, key: 'name', label: '名字', hint: '6 个字以内最好看' },
  { kind: 'text' as const, key: 'english', label: '英文名', placeholder: '留空不要' },
  { kind: 'text' as const, key: 'role', label: '职位（橙色标签）', half: true },
  { kind: 'text' as const, key: 'roleEnglish', label: '职位英文', half: true, placeholder: '留空不要' },
  { kind: 'image' as const, key: 'image', label: '左边斜插的配图', hint: '透明底的 PNG，竖长的物件最好（原片是一支针筒）' },
];

export const PERSON_CARD_LIST = {
  kind: 'list' as const, key: 'cards', label: '人物', itemLabel: '人物', hint: '最多两张',
  fields: cardFields,
  newItem: () => ({ name: '新人物', english: '', role: '职位', roleEnglish: '', image: '/template-assets/person-card/sample-syringe.png' }),
};

const form: Section[] = [
  {
    title: '公司名',
    fields: [
      { kind: 'text', key: 'company', label: '公司名大字', hint: '英文最好看' },
      { kind: 'text', key: 'nameAbove', label: '左上小字', placeholder: '留空不要', half: true },
      { kind: 'text', key: 'nameBelow', label: '下面一行', placeholder: '留空不要', half: true },
      { kind: 'text', key: 'signature', label: '手写签名', placeholder: '留空不要', half: true },
      { kind: 'color', key: 'signatureColor', label: '签名颜色', half: true },
    ],
  },
  { title: '人物卡片', fields: [PERSON_CARD_LIST] },
  {
    title: '时间和背景',
    fields: [
      { kind: 'media', key: 'background', label: '背景', hint: '浅色的纸或墙' },
      { kind: 'number', key: 'whipAt', label: '第几秒甩到人物', min: 0.5, max: 60, step: 0.1, unit: '秒', half: true },
      { kind: 'number', key: 'card2At', label: '第二张第几秒出来', min: 0.5, max: 60, step: 0.1, unit: '秒', half: true },
      { kind: 'number', key: 'pushAt', label: '第几秒开始推近', min: 0.5, max: 60, step: 0.1, unit: '秒', half: true, hint: '比视频时长晚就不推' },
      { kind: 'number', key: 'duration', label: '视频时长', min: 1, max: 60, step: 0.1, unit: '秒', half: true },
    ],
  },
];

const snap = (t: number) => Math.round((Math.round(t * FPS) / FPS) * 100) / 100;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export const timeline: TemplateTimeline = {
  tracks: (raw) => {
    const p = raw as unknown as CompanyCardsParams;
    const tracks: ReturnType<TemplateTimeline['tracks']> = [{
      id: 'camera', label: '镜头', kind: 'camera',
      items: [
        { id: 'title', label: `公司名 ${p.company}`, start: 0, end: p.whipAt, phases: [{ label: '横甩', start: p.whipAt, end: Math.min(p.duration, p.whipAt + 0.73) }], select: { section: '公司名' }, drag: { end: true } },
        { id: 'cards', label: '人物卡片', start: p.whipAt, end: p.duration, phases: p.pushAt < p.duration ? [{ label: '推近', start: p.pushAt, end: p.duration }] : undefined, select: { section: '时间和背景' }, drag: { end: true } },
      ],
    }];
    if (p.cards.length > 1) {
      tracks.push({ id: 'card2', label: '第二张', kind: 'element', items: [{ id: 'card2', label: p.cards[1]!.name || '第二张卡片', start: p.card2At, end: p.duration, select: { list: 'cards', index: 1 }, drag: { move: true } }] });
    }
    return tracks;
  },
  apply: (raw, itemId, _edge, start, end) => {
    const p = raw as unknown as CompanyCardsParams;
    if (itemId === 'title') {
      const whipAt = clamp(snap(end), 0.5, p.duration - 0.5);
      const d = whipAt - p.whipAt;
      return { ...raw, whipAt, card2At: snap(p.card2At + d), pushAt: snap(p.pushAt + d), duration: clamp(snap(p.duration + d), 1, 60) };
    }
    if (itemId === 'cards') return { ...raw, duration: clamp(snap(end), p.whipAt + 0.5, 60) };
    if (itemId === 'card2') return { ...raw, card2At: clamp(snap(start), p.whipAt, 60) };
    return raw;
  },
};

export const meta: TemplateMeta = {
  id: 'company-cards',
  name: '公司名大字 · 横甩到人物卡片',
  description: '公司名一个字母一个字母浮出来、配手写签名，镜头推近后横甩到人物卡片：名字逐字出现、橙色职位标签',
  origin: '复刻自一条新闻解读视频里的两个镜头，和原片的相似度 88.4%（背景用原片画面比）',
  width: 1280,
  height: 720,
  fps: FPS,
  posterFrame: 250,
  form,
  defaultParams: defaultParams as unknown as Record<string, unknown>,
  timeline,
};
