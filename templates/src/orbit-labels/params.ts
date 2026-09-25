import type { Section, TemplateMeta, TemplateTimeline } from '../form';
import type { OrbitLabel, OrbitLabelsProps } from './OrbitLabels';

const FPS = 30;
const LABEL_SECONDS = 18 / FPS;

export type OrbitLabelsParams = {
  background: string;
  centerImage: string;
  word1: string;
  word1English: string;
  word2: string;
  labels: OrbitLabel[];
  accent: string;
  centerAt: number;
  duration: number;
};

export const defaultParams: OrbitLabelsParams = {
  background: '/template-assets/orbit-labels/sample-bg.jpg',
  centerImage: '/template-assets/orbit-labels/sample-center.png',
  word1: '人才',
  word1English: 'talent',
  word2: '流动',
  // 原片第 63、135、201 帧（这里存秒）
  labels: [
    { text: '技能经验流动', english: 'Free flow of talents', side: 'right', at: 2.1 },
    { text: '就职其他公司', english: 'Employed by other companies', side: 'left', at: 4.5 },
    { text: '“小破”公司', english: 'new company', side: 'top', at: 6.7 },
  ],
  accent: '#4f68e0',
  centerAt: 0.33,
  duration: 15,
};

const frames = (sec: number) => Math.round(sec * FPS);

export function toProps(p: OrbitLabelsParams): OrbitLabelsProps {
  return {
    background: p.background,
    centerImage: p.centerImage,
    word1: p.word1,
    word1English: p.word1English,
    word2: p.word2,
    labels: p.labels.map((l) => ({ ...l, at: frames(l.at) })),
    accent: p.accent,
    centerAt: frames(p.centerAt),
    durationInFrames: Math.max(1, frames(p.duration)),
  };
}

const form: Section[] = [
  {
    title: '中心',
    fields: [
      { kind: 'image', key: 'centerImage', label: '中心配图', hint: '抠好图的透明 PNG，比如人物 + 道具' },
      { kind: 'text', key: 'word1', label: '大方框里的字', half: true },
      { kind: 'text', key: 'word1English', label: '下面的英文', half: true },
      { kind: 'text', key: 'word2', label: '小方框里的字' },
      { kind: 'number', key: 'centerAt', label: '第几秒出现', min: 0, max: 60, step: 0.1, unit: '秒' },
    ],
  },
  {
    title: '周围的标签',
    fields: [
      {
        kind: 'list', key: 'labels', label: '标签', itemLabel: '标签',
        hint: '按出现顺序排。椭圆会从第一个标签开始，顺时针画到最后一个',
        fields: [
          { kind: 'text', key: 'text', label: '大字' },
          { kind: 'text', key: 'english', label: '英文', placeholder: '留空不要' },
          {
            kind: 'select', key: 'side', label: '放在哪', half: true,
            options: [{ value: 'right', label: '右边' }, { value: 'left', label: '左边' }, { value: 'top', label: '上面' }, { value: 'bottom', label: '下面' }],
          },
          { kind: 'number', key: 'at', label: '第几秒出来', min: 0, max: 60, step: 0.1, unit: '秒', half: true },
        ],
        newItem: (items) => {
          const last = items[items.length - 1] as OrbitLabel | undefined;
          return { text: '新标签', english: '', side: 'bottom', at: Math.round(((last?.at ?? 2) + 2) * 10) / 10 };
        },
      },
      { kind: 'color', key: 'accent', label: '标签的蓝色' },
    ],
  },
  {
    title: '背景',
    fields: [
      { kind: 'media', key: 'background', label: '背景', hint: '浅色的墙或纸，原片是带大方格的浅灰墙' },
      { kind: 'number', key: 'duration', label: '视频时长', min: 1, max: 60, step: 0.1, unit: '秒', hint: '镜头在 13 秒左右拉远到位' },
    ],
  },
];

const snap = (t: number) => Math.round((Math.round(t * FPS) / FPS) * 100) / 100;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export const timeline: TemplateTimeline = {
  tracks: (raw) => {
    const p = raw as unknown as OrbitLabelsParams;
    return [
      {
        id: 'center', label: '中心', kind: 'element',
        items: [{ id: 'center', label: `${p.word1}${p.word2}`, start: p.centerAt, end: p.duration, select: { section: '中心' }, drag: { move: true, end: true } }],
      },
      ...p.labels.map((l, i) => ({
        id: `label-${i}`, label: `标签 ${i + 1}`, kind: 'element' as const,
        items: [{
          id: `label-${i}`, label: l.text || '（还没写）', start: l.at, end: p.duration,
          phases: [{ label: '出现', start: l.at, end: Math.min(p.duration, l.at + LABEL_SECONDS) }],
          select: { list: 'labels', index: i }, drag: { move: true },
        }],
      })),
    ];
  },
  apply: (raw, itemId, edge, start, end) => {
    const p = raw as unknown as OrbitLabelsParams;
    if (itemId === 'center') {
      if (edge === 'end') return { ...raw, duration: clamp(snap(end), 1, 60) };
      return { ...raw, centerAt: clamp(snap(start), 0, 60) };
    }
    const i = Number(/^label-(\d+)$/.exec(itemId)?.[1] ?? -1);
    if (!p.labels[i]) return raw;
    return { ...raw, labels: p.labels.map((l, j) => (j === i ? { ...l, at: clamp(snap(start), 0, 60) } : l)) };
  },
};

export const meta: TemplateMeta = {
  id: 'orbit-labels',
  name: '中心配图 · 环绕标签',
  description: '中心一张配图配两块方框字，周围的关键词标签依次出现，一个椭圆把它们串起来，镜头慢慢拉远',
  origin: '复刻自一条新闻解读视频里的一个镜头，和原片的相似度 87.0%（背景用原片画面比）',
  width: 1280,
  height: 720,
  fps: FPS,
  posterFrame: 300,
  form,
  defaultParams: defaultParams as unknown as Record<string, unknown>,
  timeline,
};
