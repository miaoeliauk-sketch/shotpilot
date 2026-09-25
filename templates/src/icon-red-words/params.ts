import type { Section, TemplateMeta, TemplateTimeline } from '../form';
import type { IconRedWordsProps } from './IconRedWords';

const FPS = 30;

export type IconRedWordsParams = {
  background: string;
  iconText: string;
  iconImage: string;
  left: string;
  right: string;
  leftAt: number;
  rightAt: number;
  vignette: boolean;
  duration: number;
};

export const defaultParams: IconRedWordsParams = {
  background: '/template-assets/icon-red-words/wall.jpg',
  iconText: 'AI',
  iconImage: '',
  left: '故意',
  right: '无意',
  // 原片：第 26 帧出左边的字、第 84 帧出右边的字，一共 164 帧
  leftAt: 0.87,
  rightAt: 2.8,
  vignette: true,
  duration: 5.47,
};

const frames = (sec: number) => Math.round(sec * FPS);

export function toProps(p: IconRedWordsParams): IconRedWordsProps {
  return {
    background: p.background,
    iconText: p.iconText,
    iconImage: p.iconImage,
    left: p.left.trim(),
    right: p.right.trim(),
    leftAt: frames(p.leftAt),
    rightAt: frames(p.rightAt),
    vignette: p.vignette !== false,
    durationInFrames: Math.max(1, frames(p.duration)),
  };
}

const form: Section[] = [
  {
    title: '画面',
    fields: [
      { kind: 'media', key: 'background', label: '背景', hint: '横图或视频，整张铺满；原片是一面有窗影的灰墙' },
      { kind: 'text', key: 'iconText', label: '图标上的字', half: true, hint: '白色圆角方块里的字' },
      { kind: 'image', key: 'iconImage', label: '图标图片', half: true, hint: '放了就用图片代替上面的字，方图最好' },
      { kind: 'toggle', key: 'vignette', label: '四周暗角' },
    ],
  },
  {
    title: '红字',
    fields: [
      { kind: 'text', key: 'left', label: '左边的字', half: true, placeholder: '留空不要' },
      { kind: 'text', key: 'right', label: '右边的字', half: true, placeholder: '留空不要' },
      { kind: 'number', key: 'leftAt', label: '第几秒出左边', min: 0, max: 60, step: 0.1, unit: '秒', half: true },
      { kind: 'number', key: 'rightAt', label: '第几秒出右边', min: 0, max: 60, step: 0.1, unit: '秒', half: true },
      { kind: 'number', key: 'duration', label: '视频时长', min: 1, max: 60, step: 0.1, unit: '秒' },
    ],
  },
];

const snap = (t: number) => Math.round((Math.round(t * FPS) / FPS) * 100) / 100;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export const timeline: TemplateTimeline = {
  tracks: (raw) => {
    const p = raw as unknown as IconRedWordsParams;
    return [
      { id: 'camera', label: '图标', kind: 'camera', items: [{ id: 'icon', label: `图标 · ${p.iconText || '图片'}`, start: 0, end: p.duration, phases: [{ label: '翻上来', start: 0, end: Math.min(p.duration, 1.5) }], select: { section: '画面' }, drag: { end: true } }] },
      {
        id: 'elements', label: '元素', kind: 'element',
        items: [
          ...(p.left.trim() ? [{ id: 'left', label: p.left, start: p.leftAt, end: Math.min(p.duration, p.leftAt + 1.13), select: { section: '红字' }, drag: { move: true } }] : []),
          ...(p.right.trim() ? [{ id: 'right', label: p.right, start: p.rightAt, end: Math.min(p.duration, p.rightAt + 1.13), select: { section: '红字' }, drag: { move: true } }] : []),
        ],
      },
    ];
  },
  apply: (raw, itemId, _edge, start, end) => {
    if (itemId === 'icon') return { ...raw, duration: clamp(snap(end), 1, 60) };
    if (itemId === 'left') return { ...raw, leftAt: clamp(snap(start), 0, 60) };
    if (itemId === 'right') return { ...raw, rightAt: clamp(snap(start), 0, 60) };
    return raw;
  },
};

export const meta: TemplateMeta = {
  id: 'icon-red-words',
  name: '白色图标 · 两边红字',
  description: '白色圆角图标从下面翻上来、立住后歪一点；左右两边的红字发着光先后淡进来，身后一条暗带跟着扫出来',
  origin: '复刻自一条讲 AI 幻觉的视频里的两个镜头，和原片的相似度 93.6%',
  width: 1280,
  height: 720,
  fps: FPS,
  posterFrame: 150,
  form,
  defaultParams: defaultParams as unknown as Record<string, unknown>,
  timeline,
};
