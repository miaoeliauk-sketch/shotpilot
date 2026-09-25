import type { Section, TemplateMeta, TemplateTimeline } from '../form';
import type { PointingInterviewProps } from './PointingInterview';

const FPS = 30;
const BUBBLE_SECONDS = 18 / FPS;

export type BubbleParams = { text: string; side: 'left' | 'right' | 'top'; at: number };

export type PointingInterviewParams = {
  wall: string;
  figure: string;
  line1: string;
  line1b: string;
  line2: string;
  keyword: string;
  panelColor: string;
  scene2: string;
  people: string;
  bigWord: string;
  bubbles: BubbleParams[];
  textAt: number;
  panelAt: number;
  switchAt: number;
  duration: number;
};

/** 对话框放在哪（场景二的坐标，第 300 帧量的） */
const SLOTS: Record<BubbleParams['side'], { x: number; y: number; width: number; small?: boolean }> = {
  right: { x: 753, y: 250, width: 306 },
  left: { x: 135, y: 319, width: 304 },
  top: { x: 447, y: 118, width: 304, small: true },
};

export const defaultParams: PointingInterviewParams = {
  wall: '/template-assets/doc-highlight/sample-wall.jpg',
  figure: '/template-assets/pointing-interview/sample-figure.png',
  line1: '他们把',
  line1b: '招人',
  line2: '做成了一条',
  keyword: '流水线',
  panelColor: '#13132a',
  scene2: '/template-assets/pointing-interview/sample-scene.jpg',
  people: '/template-assets/pointing-interview/sample-people.png',
  bigWord: '面试',
  bubbles: [
    { text: '你知道那个某某供应商....', side: 'right', at: 5.8 },
    { text: '你知道那个某某项目吗...', side: 'left', at: 6.13 },
    { text: '你看看能不能临走前想办法把XXXX资料带出来？', side: 'top', at: 8.73 },
  ],
  // 原片：第 28 帧出字、第 85 帧竖条落下、第 156 帧转场
  textAt: 0.93,
  panelAt: 2.83,
  switchAt: 5.2,
  duration: 11.1,
};

const frames = (sec: number) => Math.round(sec * FPS);

export function toProps(p: PointingInterviewParams): PointingInterviewProps {
  return {
    wall: p.wall,
    figure: p.figure,
    line1: p.line1,
    line1b: p.line1b,
    line2: p.line2,
    keyword: p.keyword,
    panelColor: p.panelColor,
    scene2: p.scene2,
    people: p.people,
    bigWord: p.bigWord,
    bubbles: p.bubbles.map((b) => ({ text: b.text, ...SLOTS[b.side] ?? SLOTS.right, at: frames(b.at) })),
    textAt: frames(p.textAt),
    panelAt: frames(p.panelAt),
    switchAt: frames(p.switchAt),
    durationInFrames: Math.max(frames(p.switchAt) + 13, frames(p.duration)),
  };
}

const form: Section[] = [
  {
    title: '场景一：指向的人物',
    fields: [
      { kind: 'image', key: 'figure', label: '人物', hint: '抠好图的透明 PNG，人在左下、手往右指' },
      { kind: 'media', key: 'wall', label: '墙面背景' },
      { kind: 'text', key: 'line1', label: '第一行大字', half: true },
      { kind: 'text', key: 'line1b', label: '旁边的斜体字', half: true },
      { kind: 'text', key: 'line2', label: '第二行小字', half: true },
      { kind: 'text', key: 'keyword', label: '竖条上的关键词', half: true },
      { kind: 'color', key: 'panelColor', label: '竖条颜色' },
      { kind: 'number', key: 'textAt', label: '第几秒出字', min: 0, max: 60, step: 0.1, unit: '秒', half: true },
      { kind: 'number', key: 'panelAt', label: '第几秒落竖条', min: 0, max: 60, step: 0.1, unit: '秒', half: true },
    ],
  },
  {
    title: '场景二：对话',
    fields: [
      { kind: 'image', key: 'people', label: '人物插图', hint: '抠好图的透明 PNG，比如面试的两个人' },
      { kind: 'media', key: 'scene2', label: '墙面背景' },
      { kind: 'text', key: 'bigWord', label: '背景大字', hint: '两个字最好' },
      {
        kind: 'list', key: 'bubbles', label: '对话框', itemLabel: '对话框',
        fields: [
          { kind: 'text', key: 'text', label: '内容' },
          {
            kind: 'select', key: 'side', label: '放在哪', half: true,
            options: [{ value: 'right', label: '右边' }, { value: 'left', label: '左边' }, { value: 'top', label: '上面（可两行）' }],
          },
          { kind: 'number', key: 'at', label: '第几秒出来', min: 0, max: 60, step: 0.1, unit: '秒', half: true },
        ],
        newItem: (items) => {
          const last = items[items.length - 1] as BubbleParams | undefined;
          return { text: '新的一句话', side: 'right', at: Math.round(((last?.at ?? 6) + 1) * 10) / 10 };
        },
      },
    ],
  },
  {
    title: '时间',
    fields: [
      { kind: 'number', key: 'switchAt', label: '第几秒转到场景二', min: 0.5, max: 60, step: 0.1, unit: '秒' },
      { kind: 'number', key: 'duration', label: '视频时长', min: 1, max: 60, step: 0.1, unit: '秒' },
    ],
  },
];

const snap = (t: number) => Math.round((Math.round(t * FPS) / FPS) * 100) / 100;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export const timeline: TemplateTimeline = {
  tracks: (raw) => {
    const p = raw as unknown as PointingInterviewParams;
    return [
      {
        id: 'camera', label: '镜头', kind: 'camera',
        items: [
          { id: 'sceneA', label: '指向的人物', start: 0, end: p.switchAt, select: { section: '场景一：指向的人物' }, drag: { end: true } },
          {
            id: 'sceneB', label: '对话场景', start: p.switchAt, end: p.duration,
            phases: [{ label: '笔刷转场', start: p.switchAt, end: Math.min(p.duration, p.switchAt + 12 / FPS) }],
            select: { section: '场景二：对话' }, drag: { end: true },
          },
        ],
      },
      {
        id: 'text', label: '标题', kind: 'element',
        items: [
          { id: 'text', label: `${p.line1}${p.line1b}${p.line2}${p.keyword}`, start: p.textAt, end: p.switchAt, select: { section: '场景一：指向的人物' }, drag: { move: true } },
          { id: 'panel', label: '竖条落下', start: p.panelAt, end: p.switchAt, select: { section: '场景一：指向的人物' }, drag: { move: true } },
        ],
      },
      ...p.bubbles.map((b, i) => ({
        id: `bubble-${i}`, label: `对话框 ${i + 1}`, kind: 'element' as const,
        items: [{
          id: `bubble-${i}`, label: b.text || '（还没写）', start: b.at, end: p.duration,
          phases: [{ label: '展开', start: b.at, end: Math.min(p.duration, b.at + BUBBLE_SECONDS) }],
          select: { list: 'bubbles', index: i }, drag: { move: true },
        }],
      })),
    ];
  },
  apply: (raw, itemId, _edge, start, end) => {
    const p = raw as unknown as PointingInterviewParams;
    if (itemId === 'sceneA') {
      // 转场挪了，场景二里的对话框跟着挪
      const switchAt = clamp(snap(end), 0.5, p.duration - 0.6);
      const d = switchAt - p.switchAt;
      return { ...raw, switchAt, bubbles: p.bubbles.map((b) => ({ ...b, at: clamp(snap(b.at + d), 0, 60) })) };
    }
    if (itemId === 'sceneB') return { ...raw, duration: clamp(snap(end), p.switchAt + 0.6, 60) };
    if (itemId === 'text') return { ...raw, textAt: clamp(snap(start), 0, p.switchAt) };
    if (itemId === 'panel') return { ...raw, panelAt: clamp(snap(start), 0, p.switchAt) };
    const i = Number(/^bubble-(\d+)$/.exec(itemId)?.[1] ?? -1);
    const b = p.bubbles[i];
    if (!b) return raw;
    return { ...raw, bubbles: p.bubbles.map((x, j) => (j === i ? { ...x, at: clamp(snap(start), p.switchAt, 60) } : x)) };
  },
};

export const meta: TemplateMeta = {
  id: 'pointing-interview',
  name: '指向人物标题 · 对话场景',
  description: '人物指向一组逐字刷出的标题，深色竖条落下衬出关键词；笔刷转场到对话场景，对话框依次展开打字',
  origin: '复刻自一条新闻解读视频里的两个镜头，和原片的相似度 84.8%（人物用原片抠图比）',
  width: 1280,
  height: 720,
  fps: FPS,
  posterFrame: 130,
  form,
  defaultParams: defaultParams as unknown as Record<string, unknown>,
  timeline,
};
