import type { Section, TemplateMeta, TemplateTimeline } from '../form';
import type { TwoSidesProps } from './TwoSides';

const FPS = 30;

export type TwoSidesParams = {
  background: string;
  tileText: string;
  tileImage: string;
  leftTitle: string;
  leftText: string;
  leftImage: string;
  leftRed: string;
  rightTitle: string;
  rightText: string;
  rightImage: string;
  rightRed: string;
  leftAt: number;
  rightAt: number;
  backAt: number;
  redAt: number;
  redGap: number;
  vignette: boolean;
  duration: number;
};

export const defaultParams: TwoSidesParams = {
  background: '/template-assets/icon-bubbles/grid-paper.jpg',
  tileText: 'AI',
  tileImage: '',
  leftTitle: '知道答案',
  leftText: '有标准答案，准确信息\n来源，填补结合就是真\n实靠谱的答案',
  leftImage: '/template-assets/icon-bubbles/magnifier.png',
  leftRed: '事实',
  rightTitle: '不知道答案',
  rightText: '冷门且小众或不清楚的\n答案，会作答但答案不\n一定真实可靠',
  rightImage: '/template-assets/icon-bubbles/brain.png',
  rightRed: '编造',
  // 原片：254 帧推到左边、396 帧切到右边、536 帧切回全景、594 帧出红字（右边晚 56 帧），一共 800 帧
  leftAt: 8.47,
  rightAt: 13.2,
  backAt: 17.87,
  redAt: 19.8,
  redGap: 1.87,
  vignette: true,
  duration: 26.67,
};

const frames = (sec: number) => Math.round(sec * FPS);
const lines = (t: string) => t.split('\n').map((l) => l.trimEnd()).filter((l) => l.length > 0).slice(0, 4);

export function toProps(p: TwoSidesParams): TwoSidesProps {
  const leftAt = Math.max(1, frames(p.leftAt));
  const rightAt = Math.max(leftAt + 1, frames(p.rightAt));
  const backAt = Math.max(rightAt + 1, frames(p.backAt));
  return {
    background: p.background,
    tileText: p.tileText,
    tileImage: p.tileImage,
    left: { title: p.leftTitle, lines: lines(p.leftText), image: p.leftImage, red: p.leftRed.trim() },
    right: { title: p.rightTitle, lines: lines(p.rightText), image: p.rightImage, red: p.rightRed.trim() },
    leftAt,
    rightAt,
    backAt,
    redAt: frames(p.redAt),
    redGap: frames(p.redGap),
    vignette: p.vignette !== false,
    durationInFrames: Math.max(1, frames(p.duration)),
  };
}

const sideFields = (k: 'left' | 'right', name: string) => [
  { kind: 'text' as const, key: `${k}Title`, label: `${name}标题`, half: true },
  { kind: 'text' as const, key: `${k}Red`, label: `${name}结尾红字`, half: true, placeholder: '留空不要' },
  { kind: 'text' as const, key: `${k}Text`, label: `${name}说明`, hint: '三行最合适，每行 10 个字左右，用回车换行' },
  { kind: 'image' as const, key: `${k}Image`, label: `${name}小图`, hint: '透明底的 png' },
];

const form: Section[] = [
  {
    title: '中间图标',
    fields: [
      { kind: 'text', key: 'tileText', label: '图标上的字', half: true },
      { kind: 'image', key: 'tileImage', label: '图标图片', half: true, hint: '放了就用图片代替字' },
      { kind: 'media', key: 'background', label: '背景', hint: '横图或视频，原片是一张灰色网格纸' },
      { kind: 'toggle', key: 'vignette', label: '四周暗角' },
    ],
  },
  { title: '左边', fields: sideFields('left', '左边') },
  { title: '右边', fields: sideFields('right', '右边') },
  {
    title: '镜头和结尾',
    fields: [
      { kind: 'number', key: 'leftAt', label: '第几秒推到左边', min: 0, max: 60, step: 0.1, unit: '秒', half: true },
      { kind: 'number', key: 'rightAt', label: '第几秒切到右边', min: 0, max: 60, step: 0.1, unit: '秒', half: true },
      { kind: 'number', key: 'backAt', label: '第几秒切回全景', min: 0, max: 60, step: 0.1, unit: '秒', half: true },
      { kind: 'number', key: 'redAt', label: '第几秒出红字', min: 0, max: 60, step: 0.1, unit: '秒', half: true },
      { kind: 'number', key: 'redGap', label: '右边红字晚几秒', min: 0, max: 10, step: 0.1, unit: '秒', half: true },
      { kind: 'number', key: 'duration', label: '视频时长', min: 1, max: 60, step: 0.1, unit: '秒', half: true },
    ],
  },
];

const snap = (t: number) => Math.round((Math.round(t * FPS) / FPS) * 100) / 100;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export const timeline: TemplateTimeline = {
  tracks: (raw) => {
    const p = raw as unknown as TwoSidesParams;
    return [
      {
        id: 'camera', label: '镜头', kind: 'camera',
        items: [
          { id: 'wide', label: '全景', start: 0, end: p.leftAt, select: { section: '镜头和结尾' }, drag: { end: true } },
          { id: 'left', label: `左边 · ${p.leftTitle}`, start: p.leftAt, end: p.rightAt, select: { section: '左边' }, drag: { end: true } },
          { id: 'right', label: `右边 · ${p.rightTitle}`, start: p.rightAt, end: p.backAt, select: { section: '右边' }, drag: { end: true } },
          { id: 'back', label: '全景', start: p.backAt, end: p.duration, select: { section: '镜头和结尾' }, drag: { end: true } },
        ],
      },
      {
        id: 'elements', label: '元素', kind: 'element',
        items: [
          ...(p.leftRed.trim() ? [{ id: 'redL', label: p.leftRed, start: p.redAt, end: Math.min(p.duration, p.redAt + 1.2), select: { section: '左边' }, drag: { move: true } }] : []),
          ...(p.rightRed.trim() ? [{ id: 'redR', label: p.rightRed, start: p.redAt + p.redGap, end: Math.min(p.duration, p.redAt + p.redGap + 1.2), select: { section: '右边' }, drag: { move: true } }] : []),
        ],
      },
    ];
  },
  apply: (raw, itemId, _edge, start, end) => {
    const p = raw as unknown as TwoSidesParams;
    if (itemId === 'wide') return { ...raw, leftAt: clamp(snap(end), 0.1, p.rightAt - 0.1) };
    if (itemId === 'left') return { ...raw, rightAt: clamp(snap(end), p.leftAt + 0.1, p.backAt - 0.1) };
    if (itemId === 'right') return { ...raw, backAt: clamp(snap(end), p.rightAt + 0.1, 60) };
    if (itemId === 'back') return { ...raw, duration: clamp(snap(end), 1, 60) };
    if (itemId === 'redL') return { ...raw, redAt: clamp(snap(start), 0, 60) };
    if (itemId === 'redR') return { ...raw, redGap: clamp(snap(start - p.redAt), 0, 10) };
    return raw;
  },
};

export const meta: TemplateMeta = {
  id: 'two-sides',
  name: '中间图标 · 左右两段说明 · 红字结尾',
  description: '中间一块白色图标，左右各一段说明和一个小图；镜头推到左边、切到右边、再拉回全景，最后背景变暗变虚，左右两个红字发着光亮起来',
  origin: '复刻自一条讲 AI 幻觉的视频里的一个镜头，和原片的相似度 81.5%',
  width: 1280,
  height: 720,
  fps: FPS,
  posterFrame: 200,
  form,
  defaultParams: defaultParams as unknown as Record<string, unknown>,
  timeline,
};
