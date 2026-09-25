import type { Section, TemplateMeta, TemplateTimeline } from '../form';
import type { IconBubblesProps } from './IconBubbles';

const FPS = 30;

export type BubbleRowParams = { icon: string; text: string; at: number; speed: number };

export type IconBubblesParams = {
  background: string;
  rows: BubbleRowParams[];
  exitAt: number;
  vignette: boolean;
  duration: number;
};

const A = '/template-assets/icon-bubbles';

export const defaultParams: IconBubblesParams = {
  background: `${A}/grid-paper.jpg`,
  // 原片：三行分别在第 0、79、146 帧出来；前两行每秒打 15 个字，最后一行慢慢「想」
  rows: [
    { icon: `${A}/magnifier.png`, text: '抱歉，为搜索到相关信息...', at: 0, speed: 15 },
    { icon: `${A}/brain.png`, text: '我无法解答您的问题', at: 2.63, speed: 15 },
    { icon: `${A}/aitile.png`, text: '......正在生成中', at: 4.87, speed: 3.5 },
  ],
  // 原片第 266 帧整列开始往左滑走，314 帧结束
  exitAt: 8.87,
  vignette: true,
  duration: 10.47,
};

const frames = (sec: number) => Math.round(sec * FPS);
const MAX_ROWS = 4;

export function toProps(p: IconBubblesParams): IconBubblesProps {
  return {
    background: p.background,
    rows: p.rows.slice(0, MAX_ROWS).map((r) => ({ icon: r.icon, text: r.text, at: frames(r.at), step: FPS / Math.max(0.5, r.speed) })),
    exitAt: frames(p.exitAt),
    vignette: p.vignette !== false,
    durationInFrames: Math.max(1, frames(p.duration)),
  };
}

const form: Section[] = [
  {
    title: '画面',
    fields: [
      { kind: 'media', key: 'background', label: '背景', hint: '横图或视频；原片是一张网格纸' },
      { kind: 'toggle', key: 'vignette', label: '四周暗角' },
    ],
  },
  {
    title: '每一行',
    fields: [
      {
        kind: 'list', key: 'rows', label: '行', itemLabel: '第',
        fields: [
          { kind: 'image', key: 'icon', label: '图标', hint: '透明底的 png 最好，放在深色条的左头上' },
          { kind: 'text', key: 'text', label: '打出来的字' },
          { kind: 'number', key: 'at', label: '第几秒出来', min: 0, max: 60, step: 0.1, unit: '秒', half: true },
          { kind: 'number', key: 'speed', label: '每秒打几个字', min: 1, max: 30, step: 0.5, half: true, hint: '5 以下会带一个闪的光标，像在「想」' },
        ],
        newItem: (items) => {
          const last = items[items.length - 1] as BubbleRowParams | undefined;
          return { icon: `${A}/aitile.png`, text: '新的一行', at: Math.round(((last?.at ?? 0) + 2.2) * 10) / 10, speed: 15 };
        },
      },
    ],
  },
  {
    title: '收尾',
    fields: [
      { kind: 'number', key: 'exitAt', label: '第几秒整列滑走', min: 0, max: 60, step: 0.1, unit: '秒', half: true, hint: '往左下歪着滑出去，1.6 秒后淡掉' },
      { kind: 'number', key: 'duration', label: '视频时长', min: 1, max: 60, step: 0.1, unit: '秒', half: true },
    ],
  },
];

const snap = (t: number) => Math.round((Math.round(t * FPS) / FPS) * 100) / 100;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** 一行打完要多久（秒）：出来 0.6 秒后开始打字 */
export function rowEnd(r: BubbleRowParams): number {
  return r.at + 0.6 + Array.from(r.text).length / Math.max(0.5, r.speed);
}

export const timeline: TemplateTimeline = {
  tracks: (raw) => {
    const p = raw as unknown as IconBubblesParams;
    return [
      {
        id: 'camera', label: '镜头', kind: 'camera',
        items: [{ id: 'cam', label: '慢慢推近 → 滑走', start: 0, end: p.duration, phases: [{ label: '滑走', start: p.exitAt, end: Math.min(p.duration, p.exitAt + 1.6) }], select: { section: '收尾' }, drag: { end: true } }],
      },
      {
        id: 'elements', label: '元素', kind: 'element',
        items: p.rows.slice(0, MAX_ROWS).map((r, i) => ({
          id: `row-${i}`, label: r.text, start: r.at, end: Math.min(p.duration, rowEnd(r)), select: { list: 'rows', index: i }, drag: { move: true },
        })),
      },
    ];
  },
  apply: (raw, itemId, _edge, start, end) => {
    const p = raw as unknown as IconBubblesParams;
    if (itemId === 'cam') return { ...raw, duration: clamp(snap(end), 1, 60) };
    const m = /^row-(\d+)$/.exec(itemId);
    if (m) {
      const i = Number(m[1]);
      return { ...raw, rows: p.rows.map((r, k) => (k === i ? { ...r, at: clamp(snap(start), 0, 60) } : r)) };
    }
    return raw;
  },
};

export const meta: TemplateMeta = {
  id: 'icon-bubbles',
  name: '图标 · 深色条打字',
  description: '网格纸上一行行「图标 + 深色条」，条里的字一个一个弹出来，镜头慢慢推近；最后整列歪着往左滑走',
  origin: '复刻自一条讲 AI 幻觉的视频里的一个镜头，和原片的相似度 90.2%',
  width: 1280,
  height: 720,
  fps: FPS,
  posterFrame: 250,
  form,
  defaultParams: defaultParams as unknown as Record<string, unknown>,
  timeline,
};
