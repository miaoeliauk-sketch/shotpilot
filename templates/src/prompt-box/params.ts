import type { Section, TemplateMeta, TemplateTimeline } from '../form';
import type { PromptBoxProps } from './PromptBox';

const FPS = 30;

export type PromptBoxParams = { prompt: string; note: string; duration: number };

export const defaultParams: PromptBoxParams = {
  prompt: '帮我做一个购物车页面，要求响应式布局，\n有商品列表和结算按钮。',
  note: '*相同需求 不同模型 各做比较',
  // 原片 162 帧
  duration: 5.4,
};

const frames = (sec: number) => Math.round(sec * FPS);

export function toProps(p: PromptBoxParams): PromptBoxProps {
  return {
    lines: p.prompt.split('\n').map((l) => l.trim()).filter(Boolean).slice(0, 2),
    note: p.note.trim(),
    durationInFrames: Math.max(1, frames(p.duration)),
  };
}

const form: Section[] = [
  {
    title: '提示词',
    fields: [
      { kind: 'text', key: 'prompt', label: '提示词（两行，换行分开）', hint: '每行最多 19 个字左右；一个字一个字打出来' },
      { kind: 'text', key: 'note', label: '后面的灰色小字', placeholder: '留空不要' },
      { kind: 'number', key: 'duration', label: '视频时长', min: 1, max: 30, step: 0.1, unit: '秒', hint: '原片 5.4 秒，最后 0.4 秒快速推近' },
    ],
  },
];

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export const timeline: TemplateTimeline = {
  tracks: (raw) => {
    const p = raw as unknown as PromptBoxParams;
    const n = Array.from(p.prompt.replace(/\n/g, '')).length;
    return [
      { id: 'camera', label: '镜头', kind: 'camera', items: [{ id: 'cam', label: '特写扫过 → 拉开 → 推近', start: 0, end: p.duration, phases: [{ label: '特写', start: 0, end: 1 }], select: { section: '提示词' }, drag: { end: true } }] },
      { id: 'elements', label: '元素', kind: 'element', items: [{ id: 'type', label: '打字', start: 0, end: Math.min(p.duration, n / 0.6 / FPS), select: { section: '提示词' }, drag: {} }] },
    ];
  },
  apply: (raw, itemId, _edge, _start, end) => (itemId === 'cam' ? { ...raw, duration: clamp(Math.round(end * FPS) / FPS, 1, 30) } : raw),
};

export const meta: TemplateMeta = {
  id: 'prompt-box',
  name: '提示词框 · 特写扫过 · 打字',
  description: '墨绿底上一个圆角提示词框：镜头先贴着框的左上角扫过、慢慢亮起来，再拉开看全框；提示词一个字一个字打出来，框线沿上下两边爬过去再收掉',
  origin: '复刻自一条讲开源大模型的视频里的一个镜头，和原片的相似度 94.2%',
  width: 1280,
  height: 720,
  fps: FPS,
  posterFrame: 80,
  form,
  defaultParams: defaultParams as unknown as Record<string, unknown>,
  timeline,
};
