import type { Section, TemplateMeta, TemplateTimeline } from '../form';
import type { WordMagnifierProps } from './WordMagnifier';

const FPS = 30;

export type BubbleParams = { title: string; line1: string; line2: string; script: string };

export type WordMagnifierParams = {
  background: string;
  word1: string;
  word2: string;
  book: string;
  bookTilt: number;
  bubbles: BubbleParams[];
  number: string;
  bubblesAt: number;
  magnifierAt: number;
  vignette: boolean;
  duration: number;
};

const A = '/template-assets/word-magnifier';

export const defaultParams: WordMagnifierParams = {
  background: `${A}/grey-wall.jpg`,
  word1: '案例',
  word2: '统计',
  book: `${A}/book.png`,
  bookTilt: -8,
  bubbles: [
    { title: '正式', line1: '当庭戳穿', line2: '写进判决书里', script: 'Expose' },
    { title: '私下', line1: '私下翻车', line2: '没曝光的小案', script: 'Privately' },
  ],
  number: '1700',
  // 原片：第 58 帧出第一个圆、第 306 帧圆淡掉换放大镜，一共 444 帧
  bubblesAt: 1.93,
  magnifierAt: 10.2,
  vignette: true,
  duration: 14.8,
};

const frames = (sec: number) => Math.round(sec * FPS);

export function toProps(p: WordMagnifierParams): WordMagnifierProps {
  return {
    background: p.background,
    word1: p.word1.trim(),
    word2: p.word2.trim(),
    book: p.book,
    bookTilt: p.bookTilt,
    bubbles: p.bubbles.slice(0, 2),
    number: p.number.trim(),
    bubblesAt: frames(p.bubblesAt),
    magnifierAt: frames(p.magnifierAt),
    vignette: p.vignette !== false,
    durationInFrames: Math.max(1, frames(p.duration)),
  };
}

const form: Section[] = [
  {
    title: '大字',
    fields: [
      { kind: 'text', key: 'word1', label: '第一组', half: true, hint: '两个字最好' },
      { kind: 'text', key: 'word2', label: '第二组', half: true, hint: '两个字最好' },
      { kind: 'image', key: 'book', label: '飞进来的册子', hint: '透明底的 png，竖的，盖在第一组字的右半边' },
      { kind: 'number', key: 'bookTilt', label: '册子斜多少', min: -30, max: 30, step: 1, unit: '°' },
      { kind: 'media', key: 'background', label: '背景', hint: '横图，原片是一面有窗影的灰墙' },
      { kind: 'toggle', key: 'vignette', label: '四周暗角' },
    ],
  },
  {
    title: '两个灰圆',
    fields: [
      {
        kind: 'list', key: 'bubbles', label: '圆（最多 2 个）', itemLabel: '圆',
        fields: [
          { kind: 'text', key: 'title', label: '大字', half: true },
          { kind: 'text', key: 'script', label: '英文手写', half: true, placeholder: '留空不要' },
          { kind: 'text', key: 'line1', label: '第一行小字', half: true },
          { kind: 'text', key: 'line2', label: '第二行小字', half: true },
        ],
        newItem: () => ({ title: '新词', line1: '一句说明', line2: '第二行说明', script: '' }),
      },
      { kind: 'number', key: 'bubblesAt', label: '第几秒出第一个圆', min: 0, max: 60, step: 0.1, unit: '秒', hint: '第二个晚 0.67 秒' },
    ],
  },
  {
    title: '放大镜',
    fields: [
      { kind: 'text', key: 'number', label: '镜片里的数字', hint: '纯数字会从 0 滚上去' },
      { kind: 'number', key: 'magnifierAt', label: '第几秒出放大镜', min: 0, max: 60, step: 0.1, unit: '秒', half: true, hint: '圆同时淡掉' },
      { kind: 'number', key: 'duration', label: '视频时长', min: 1, max: 60, step: 0.1, unit: '秒', half: true },
    ],
  },
];

const snap = (t: number) => Math.round((Math.round(t * FPS) / FPS) * 100) / 100;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export const timeline: TemplateTimeline = {
  tracks: (raw) => {
    const p = raw as unknown as WordMagnifierParams;
    return [
      {
        id: 'camera', label: '镜头', kind: 'camera',
        items: [{ id: 'cam', label: '拉远 → 推近', start: 0, end: p.duration, phases: [{ label: '拉远', start: 1.67, end: Math.min(p.duration, 2.33) }], select: { section: '大字' }, drag: { end: true } }],
      },
      {
        id: 'elements', label: '元素', kind: 'element',
        items: [
          { id: 'words', label: `${p.word1} ${p.word2}`, start: 0.2, end: Math.min(p.duration, 1.9), select: { section: '大字' }, drag: {} },
          { id: 'bubbles', label: p.bubbles.map((b) => b.title).join(' · ') || '灰圆', start: p.bubblesAt, end: Math.min(p.duration, p.magnifierAt + 0.6), select: { section: '两个灰圆' }, drag: { move: true } },
          { id: 'magnifier', label: `放大镜 · ${p.number}`, start: p.magnifierAt, end: p.duration, select: { section: '放大镜' }, drag: { move: true } },
        ],
      },
    ];
  },
  apply: (raw, itemId, _edge, start, end) => {
    if (itemId === 'cam') return { ...raw, duration: clamp(snap(end), 1, 60) };
    if (itemId === 'bubbles') return { ...raw, bubblesAt: clamp(snap(start), 0, 60) };
    if (itemId === 'magnifier') return { ...raw, magnifierAt: clamp(snap(start), 0, 60) };
    return raw;
  },
};

export const meta: TemplateMeta = {
  id: 'word-magnifier',
  name: '压窄大字 · 灰圆 · 放大镜数字',
  description: '灰墙上两组压窄的大字一个个淡进来、一本册子飞进来；拉远后右边两个灰圆各一句说明；最后放大镜移进来，镜片里的大数字滚上去',
  origin: '复刻自一条讲 AI 幻觉的视频里的一个镜头，和原片的相似度 87.0%',
  width: 1280,
  height: 720,
  fps: FPS,
  posterFrame: 420,
  form,
  defaultParams: defaultParams as unknown as Record<string, unknown>,
  timeline,
};
