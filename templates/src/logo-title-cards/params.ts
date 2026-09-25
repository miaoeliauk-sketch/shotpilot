import type { Section, TemplateMeta, TemplateTimeline } from '../form';
import type { LogoTitleCardsProps } from './LogoTitleCards';

const FPS = 30;

export type LogoTitleCardsParams = {
  background: string;
  logo: string;
  title: string;
  gold: string;
  tag: string;
  headline: string;
  signature: string;
  cardTitle: string;
  cardSub: string;
  cardsAt: number;
  discAt: number;
  duration: number;
};

export const defaultParams: LogoTitleCardsParams = {
  background: '/template-assets/logo-title-cards/sample-bg.jpg',
  logo: '/template-assets/logo-title-cards/logo.png',
  title: '从业30年',
  gold: '30',
  tag: '老牌律师',
  headline: '送上被告',
  signature: 'Thirty years in the law',
  cardTitle: '假判案例',
  cardSub: 'Fake case',
  // 原片：第 92 帧飞纸片、第 170 帧出深灰圆，一共 279 帧
  cardsAt: 3.07,
  discAt: 5.67,
  duration: 9.3,
};

const frames = (sec: number) => Math.round(sec * FPS);

export function toProps(p: LogoTitleCardsParams): LogoTitleCardsProps {
  return {
    background: p.background,
    logo: p.logo,
    title: p.title,
    gold: p.gold.trim(),
    tag: p.tag,
    headline: p.headline,
    signature: p.signature,
    cardTitle: p.cardTitle,
    cardSub: p.cardSub,
    cardsAt: frames(p.cardsAt),
    discAt: frames(p.discAt),
    durationInFrames: Math.max(1, frames(p.duration)),
  };
}

const form: Section[] = [
  {
    title: '画面',
    fields: [
      { kind: 'media', key: 'background', label: '人物照片', hint: '横图，人物在左下；左上会盖一块 logo 方块' },
      { kind: 'image', key: 'logo', label: 'logo', hint: '方图，放在白色圆角方块里' },
    ],
  },
  {
    title: '文字',
    fields: [
      { kind: 'text', key: 'title', label: '标题', hint: '从 logo 后面滑出来' },
      { kind: 'text', key: 'gold', label: '标题里变金色的字', placeholder: '留空不变', hint: '必须是标题里的字，比如数字' },
      { kind: 'text', key: 'tag', label: '右边小字', half: true },
      { kind: 'text', key: 'headline', label: '右边大字', half: true },
      { kind: 'text', key: 'signature', label: '手写英文', placeholder: '留空不要' },
    ],
  },
  {
    title: '纸片',
    fields: [
      { kind: 'text', key: 'cardTitle', label: '纸片上的字', half: true },
      { kind: 'text', key: 'cardSub', label: '纸片上的英文', half: true },
      { kind: 'number', key: 'cardsAt', label: '第几秒飞纸片', min: 0, max: 60, step: 0.1, unit: '秒', half: true },
      { kind: 'number', key: 'discAt', label: '第几秒出深灰圆', min: 0, max: 60, step: 0.1, unit: '秒', half: true },
      { kind: 'number', key: 'duration', label: '视频时长', min: 1, max: 60, step: 0.1, unit: '秒' },
    ],
  },
];

const snap = (t: number) => Math.round((Math.round(t * FPS) / FPS) * 100) / 100;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export const timeline: TemplateTimeline = {
  tracks: (raw) => {
    const p = raw as unknown as LogoTitleCardsParams;
    return [
      { id: 'camera', label: '镜头', kind: 'camera', items: [{ id: 'cam', label: '拉远再推近', start: 0, end: p.duration, phases: [{ label: '拉远', start: 0, end: Math.min(p.duration, 1.33) }], select: { section: '画面' }, drag: { end: true } }] },
      {
        id: 'elements', label: '元素', kind: 'element',
        items: [
          { id: 'title', label: p.title, start: 0, end: Math.min(p.duration, 2.33), select: { section: '文字' }, drag: {} },
          { id: 'cards', label: `纸片 · ${p.cardTitle}`, start: p.cardsAt, end: Math.min(p.duration, p.cardsAt + 1.07), select: { section: '纸片' }, drag: { move: true } },
          { id: 'disc', label: '深灰圆', start: p.discAt, end: Math.min(p.duration, p.discAt + 0.53), select: { section: '纸片' }, drag: { move: true } },
        ],
      },
    ];
  },
  apply: (raw, itemId, _edge, start, end) => {
    if (itemId === 'cam') return { ...raw, duration: clamp(snap(end), 1, 60) };
    if (itemId === 'cards') return { ...raw, cardsAt: clamp(snap(start), 0, 60) };
    if (itemId === 'disc') return { ...raw, discAt: clamp(snap(start), 0, 60) };
    return raw;
  },
};

export const meta: TemplateMeta = {
  id: 'logo-title-cards',
  name: '人物 + logo 挡脸 · 标题滑出 · 纸片堆',
  description: '人物照片上一块 logo 方块挡住脸，标题从方块后面滑出来、外面画一个细线框，右边大字从虚到实；一叠纸片从手里一张张飞出来',
  origin: '复刻自一条新闻解读视频里的一个镜头，和原片的相似度 84.1%',
  width: 1280,
  height: 720,
  fps: FPS,
  posterFrame: 250,
  form,
  defaultParams: defaultParams as unknown as Record<string, unknown>,
  timeline,
};
