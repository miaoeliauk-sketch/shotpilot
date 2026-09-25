import type { Section, TemplateMeta, TemplateTimeline } from '../form';
import type { NotEqualProps } from './NotEqual';

const FPS = 30;

export type NotEqualParams = {
  background: string;
  left: string;
  right: string;
  cardsAt: number;
  leftTitle: string;
  leftSub: string;
  leftLetters: string;
  leftImage: string;
  rightTitle: string;
  rightSub: string;
  rightLetters: string;
  rightImage: string;
  vignette: boolean;
  duration: number;
};

export const defaultParams: NotEqualParams = {
  background: '/template-assets/word-magnifier/grey-wall.jpg',
  left: '联网',
  right: '成功',
  // 原片：第 104 帧两张卡片盖上来，一共 174 帧
  cardsAt: 3.47,
  leftTitle: '搜错文件',
  leftSub: 'Searched the wrong file',
  leftLetters: 'STF',
  leftImage: '/template-assets/icon-bubbles/magnifier.png',
  rightTitle: '过时资料',
  rightSub: 'Outdated information',
  rightLetters: 'OI',
  rightImage: '/template-assets/icon-bubbles/brain.png',
  vignette: true,
  duration: 5.8,
};

const frames = (sec: number) => Math.round(sec * FPS);

export function toProps(p: NotEqualParams): NotEqualProps {
  return {
    background: p.background,
    left: p.left.trim(),
    right: p.right.trim(),
    cardsAt: Math.max(1, frames(p.cardsAt)),
    leftCard: { title: p.leftTitle, sub: p.leftSub, letters: p.leftLetters, image: p.leftImage, tone: 'cream' },
    rightCard: { title: p.rightTitle, sub: p.rightSub, letters: p.rightLetters, image: p.rightImage, tone: 'peach' },
    vignette: p.vignette !== false,
    durationInFrames: Math.max(1, frames(p.duration)),
  };
}

const cardFields = (k: 'left' | 'right', name: string) => [
  { kind: 'text' as const, key: `${k}Title`, label: `${name}标题`, half: true },
  { kind: 'text' as const, key: `${k}Letters`, label: `${name}顶上的大字母`, half: true, placeholder: '留空不要' },
  { kind: 'text' as const, key: `${k}Sub`, label: `${name}英文小字`, placeholder: '留空不要' },
  { kind: 'image' as const, key: `${k}Image`, label: `${name}图片`, hint: '透明底的 png' },
];

const form: Section[] = [
  {
    title: '大字',
    fields: [
      { kind: 'text', key: 'left', label: '≠ 左边', half: true, hint: '两个字最好' },
      { kind: 'text', key: 'right', label: '≠ 右边', half: true, hint: '两个字最好' },
      { kind: 'media', key: 'background', label: '背景', hint: '原片是一面灰墙' },
      { kind: 'toggle', key: 'vignette', label: '四周暗角' },
    ],
  },
  {
    title: '卡片',
    fields: [
      { kind: 'number', key: 'cardsAt', label: '第几秒盖上卡片', min: 0.1, max: 60, step: 0.1, unit: '秒', half: true },
      { kind: 'number', key: 'duration', label: '视频时长', min: 1, max: 60, step: 0.1, unit: '秒', half: true },
      ...cardFields('left', '左卡片'),
      ...cardFields('right', '右卡片'),
    ],
  },
];

const snap = (t: number) => Math.round((Math.round(t * FPS) / FPS) * 100) / 100;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export const timeline: TemplateTimeline = {
  tracks: (raw) => {
    const p = raw as unknown as NotEqualParams;
    return [
      {
        id: 'camera', label: '镜头', kind: 'camera',
        items: [
          { id: 'words', label: `${p.left} ≠ ${p.right}`, start: 0, end: p.cardsAt, select: { section: '大字' }, drag: { end: true } },
          { id: 'cards', label: `${p.leftTitle} · ${p.rightTitle}`, start: p.cardsAt, end: p.duration, select: { section: '卡片' }, drag: { end: true } },
        ],
      },
    ];
  },
  apply: (raw, itemId, _edge, start, end) => {
    const p = raw as unknown as NotEqualParams;
    if (itemId === 'words') return { ...raw, cardsAt: clamp(snap(end), 0.1, p.duration - 0.1) };
    if (itemId === 'cards') return { ...raw, duration: clamp(snap(end), p.cardsAt + 0.1, 60) };
    return raw;
  },
};

export const meta: TemplateMeta = {
  id: 'not-equal',
  name: '大字 A ≠ B · 两张海报卡片',
  description: '灰墙上一排很高的压窄大字「A ≠ B」，中间的 ≠ 发红光；之后大字变虚，两张海报卡片盖在两边',
  origin: '复刻自一条讲 AI 幻觉的视频里的一个镜头，和原片的相似度 85.3%',
  width: 1280,
  height: 720,
  fps: FPS,
  posterFrame: 150,
  form,
  defaultParams: defaultParams as unknown as Record<string, unknown>,
  timeline,
};
