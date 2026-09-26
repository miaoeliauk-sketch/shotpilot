import type { Section, TemplateMeta, TemplateTimeline } from '../form';
import type { PageLabel, PageScrollLabelsProps } from './PageScrollLabels';

const FPS = 30;

export type PageScrollLabelsParams = {
  page: string;
  pageHeight: number;
  labels: PageLabel[];
  focusX: number;
  focusY: number;
  labelsAt: number;
  duration: number;
};

export const defaultParams: PageScrollLabelsParams = {
  page: '/template-assets/page-scroll-labels/page.jpg',
  pageHeight: 2012,
  labels: [
    { text: '持续数小时的真实编程任务，考验最前沿的编程智能体。', x: 272, y: 126 },
    { text: '长时测试', x: 272, y: 172 },
  ],
  focusX: 542,
  focusY: 170,
  // 原片：第 81 帧标签长出来，一共 167 帧
  labelsAt: 2.7,
  duration: 5.57,
};

const frames = (sec: number) => Math.round(sec * FPS);

export function toProps(p: PageScrollLabelsParams): PageScrollLabelsProps {
  return {
    page: p.page,
    pageHeight: Math.max(720, Number(p.pageHeight) || 720),
    labels: p.labels.slice(0, 3).map((l) => ({ text: l.text.trim(), x: Number(l.x) || 0, y: Number(l.y) || 0 })),
    focusX: Number(p.focusX) || 640,
    focusY: Number(p.focusY) || 200,
    labelsAt: frames(p.labelsAt),
    durationInFrames: Math.max(frames(4), frames(p.duration)),
  };
}

const form: Section[] = [
  {
    title: '网页',
    fields: [
      { kind: 'image', key: 'page', label: '网页长截图', hint: '深色的长截图效果最好；宽度会缩放到 1280' },
      { kind: 'number', key: 'pageHeight', label: '截图缩到宽 1280 后的高度', min: 720, max: 12000, step: 1, unit: '像素', hint: '比如原图 2560×4024，就填 2012；从最底下滚到顶' },
      { kind: 'number', key: 'focusX', label: '最后推近到哪（横）', min: 0, max: 1280, step: 1, unit: '像素', half: true },
      { kind: 'number', key: 'focusY', label: '最后推近到哪（竖）', min: 0, max: 12000, step: 1, unit: '像素', half: true, hint: '推近 1.8 倍，这个点到画面中间' },
    ],
  },
  {
    title: '标签',
    fields: [
      {
        kind: 'list', key: 'labels', label: '标签（最多 3 条）', itemLabel: '标签',
        fields: [
          { kind: 'text', key: 'text', label: '文字' },
          { kind: 'number', key: 'x', label: '位置（横）', min: 0, max: 1280, step: 1, unit: '像素', half: true },
          { kind: 'number', key: 'y', label: '位置（竖）', min: 0, max: 12000, step: 1, unit: '像素', half: true },
        ],
        newItem: (items) => ({ text: '新标签', x: 272, y: Number((items[items.length - 1] as PageLabel | undefined)?.y ?? 132) + 47 }),
      },
      { kind: 'number', key: 'labelsAt', label: '第几秒标签长出来', min: 0, max: 60, step: 0.1, unit: '秒' },
      { kind: 'number', key: 'duration', label: '视频时长', min: 4, max: 60, step: 0.1, unit: '秒', hint: '最后 0.47 秒整页往上甩走' },
    ],
  },
];

const snap = (t: number) => Math.round((Math.round(t * FPS) / FPS) * 100) / 100;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export const timeline: TemplateTimeline = {
  tracks: (raw) => {
    const p = raw as unknown as PageScrollLabelsParams;
    return [
      { id: 'camera', label: '镜头', kind: 'camera', items: [{ id: 'cam', label: '滚到顶 → 推近', start: 0, end: p.duration, phases: [{ label: '滚动', start: 0, end: 2.23 }, { label: '推近', start: 2.23, end: 3.9 }, { label: '甩走', start: p.duration - 0.47, end: p.duration }], select: { section: '网页' }, drag: { end: true } }] },
      { id: 'elements', label: '元素', kind: 'element', items: [{ id: 'labels', label: p.labels.map((l) => l.text).join(' / '), start: p.labelsAt, end: p.duration, select: { section: '标签' }, drag: { move: true } }] },
    ];
  },
  apply: (raw, itemId, _edge, start, end) => {
    if (itemId === 'cam') return { ...raw, duration: clamp(snap(end), 4, 60) };
    if (itemId === 'labels') return { ...raw, labelsAt: clamp(snap(start), 0, 60) };
    return raw;
  },
};

export const meta: TemplateMeta = {
  id: 'page-scroll-labels',
  name: '长网页滚到顶 · 推近 · 翻译标签',
  description: '一张很长的深色网页截图从最底下快速往上滚到顶，停住后镜头推近，两条浅灰标签（中文翻译）从左往右长出来，最后整页往上甩走',
  origin: '复刻自一条讲编程评测榜单的视频里的一个镜头，和原片的相似度 86.9%',
  width: 1280,
  height: 720,
  fps: FPS,
  posterFrame: 130,
  form,
  defaultParams: defaultParams as unknown as Record<string, unknown>,
  timeline,
};
