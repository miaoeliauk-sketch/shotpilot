import type { Section, TemplateMeta, TemplateTimeline } from '../form';
import type { ChatGuestProps, ChatLine } from './ChatGuest';

const FPS = 30;

export type ChatLineParams = { text: string; at: number; x: number; y: number; align: ChatLine['align'] };

export type ChatGuestParams = {
  presenter: string;
  guest: string;
  logo: string;
  lines: ChatLineParams[];
  vignette: boolean;
  duration: number;
};

export const defaultParams: ChatGuestParams = {
  presenter: '/template-assets/ticket-percent/presenter.jpg',
  guest: '/template-assets/chat-guest/guest.png',
  logo: '/template-assets/people-labels/logo.png',
  // 原片：三条对话条在第 16、84、88 帧出来，一共 360 帧
  lines: [
    { text: '为什么和实际比例不同', at: 0.53, x: 663, y: 147, align: 'right' },
    { text: '正在整理赔付承诺书', at: 2.8, x: 27, y: 261, align: 'left' },
    { text: '赔付xxx元，x月x日到账...', at: 2.93, x: 93, y: 386, align: 'left' },
  ],
  vignette: true,
  duration: 12,
};

const frames = (sec: number) => Math.round(sec * FPS);
const MAX_LINES = 5;

export function toProps(p: ChatGuestParams): ChatGuestProps {
  return {
    presenter: p.presenter,
    guest: p.guest,
    logo: p.logo,
    lines: p.lines.slice(0, MAX_LINES).filter((l) => l.text.trim()).map((l) => ({ ...l, at: frames(l.at) })),
    vignette: p.vignette !== false,
    durationInFrames: Math.max(1, frames(p.duration)),
  };
}

const form: Section[] = [
  {
    title: '画面',
    fields: [
      { kind: 'media', key: 'presenter', label: '人物照片', hint: '和「口播人物 · 提问 · 两个百分比」用同一张就能接上' },
      { kind: 'image', key: 'guest', label: '左边滑进来的人', hint: '透明底的 png；不放就只有 logo 方块' },
      { kind: 'image', key: 'logo', label: '挡脸的 logo', hint: '放在白色方块里' },
      { kind: 'toggle', key: 'vignette', label: '四周暗角' },
      { kind: 'number', key: 'duration', label: '视频时长', min: 1, max: 60, step: 0.1, unit: '秒' },
    ],
  },
  {
    title: '对话条',
    fields: [
      {
        kind: 'list', key: 'lines', label: '对话条（最多 5 条）', itemLabel: '第',
        fields: [
          { kind: 'text', key: 'text', label: '字' },
          { kind: 'number', key: 'at', label: '第几秒出来', min: 0, max: 60, step: 0.1, unit: '秒', half: true },
          {
            kind: 'select', key: 'align', label: '往哪边长', half: true,
            options: [{ value: 'left', label: '从左往右' }, { value: 'right', label: '从右往左' }],
          },
          { kind: 'number', key: 'x', label: '起点横向位置', min: -400, max: 1400, step: 1, half: true, hint: '往右长就是左边，往左长就是右边' },
          { kind: 'number', key: 'y', label: '上边位置', min: -50, max: 760, step: 1, half: true },
        ],
        newItem: (items) => {
          const last = items[items.length - 1] as ChatLineParams | undefined;
          return { text: '新的一句', at: Math.round(((last?.at ?? 0) + 1) * 10) / 10, x: 93, y: Math.min(700, (last?.y ?? 260) + 120), align: 'left' };
        },
      },
    ],
  },
];

const snap = (t: number) => Math.round((Math.round(t * FPS) / FPS) * 100) / 100;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export const timeline: TemplateTimeline = {
  tracks: (raw) => {
    const p = raw as unknown as ChatGuestParams;
    return [
      { id: 'camera', label: '镜头', kind: 'camera', items: [{ id: 'cam', label: '慢慢推近', start: 0, end: p.duration, select: { section: '画面' }, drag: { end: true } }] },
      {
        id: 'elements', label: '元素', kind: 'element',
        items: p.lines.slice(0, MAX_LINES).map((l, i) => ({
          id: `line-${i}`, label: l.text, start: l.at, end: Math.min(p.duration, l.at + 0.33 + (Array.from(l.text).length * 2.3) / FPS), select: { list: 'lines', index: i }, drag: { move: true },
        })),
      },
    ];
  },
  apply: (raw, itemId, _edge, start, end) => {
    const p = raw as unknown as ChatGuestParams;
    if (itemId === 'cam') return { ...raw, duration: clamp(snap(end), 1, 60) };
    const m = /^line-(\d+)$/.exec(itemId);
    if (m) {
      const i = Number(m[1]);
      return { ...raw, lines: p.lines.map((l, k) => (k === i ? { ...l, at: clamp(snap(start), 0, 60) } : l)) };
    }
    return raw;
  },
};

export const meta: TemplateMeta = {
  id: 'chat-guest',
  name: '口播人物 · logo 挡脸 · 对话条',
  description: '虚化的口播人物照片，左边滑进来一个脸上盖着 logo 的人，旁边一条条深色对话条长出来、一个字一个字打出来，镜头慢慢推近',
  origin: '复刻自一条讲 AI 幻觉的视频里的一个镜头，和原片的相似度 92.6%',
  width: 1280,
  height: 720,
  fps: FPS,
  posterFrame: 300,
  form,
  defaultParams: defaultParams as unknown as Record<string, unknown>,
  timeline,
};
