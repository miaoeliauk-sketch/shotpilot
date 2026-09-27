import type { Section, TemplateMeta, TemplateTimeline } from '../form';
import { ORIGIN_FOCUS, type PixelLabel, type TableRow, type WebComparePixelsProps } from './WebComparePixels';

const FPS = 30;

export type WebComparePixelsParams = {
  page: string;
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  title: string;
  head1: string;
  head2: string;
  head3: string;
  rows: TableRow[];
  total: number;
  labels: PixelLabel[];
  duration: number;
};

export const defaultParams: WebComparePixelsParams = {
  page: '/template-assets/web-compare-pixels/page.svg',
  startX: Math.round(ORIGIN_FOCUS.start[0] * 1000) / 10,
  startY: Math.round(ORIGIN_FOCUS.start[1] * 1000) / 10,
  endX: Math.round(ORIGIN_FOCUS.end[0] * 1000) / 10,
  endY: Math.round(ORIGIN_FOCUS.end[1] * 1000) / 10,
  title: 'Model Lens 综合智能指数 (Intelligence Index)',
  head1: '数据项',
  head2: '数据得分',
  head3: '14项正面对比',
  rows: [
    { name: 'Model A 智能指数得分', score: '57', scoreUnit: '分', count: '6', countUnit: '项目', up: false },
    { name: 'Model B 智能指数得分', score: '60', scoreUnit: '分', count: '8', countUnit: '项目', up: true },
  ],
  total: 14,
  labels: [
    { text: 'MODEL A', wins: 6, pill: '长链路' },
    { text: 'Model B', wins: 8, pill: '推理' },
  ],
  // 原片 679 帧
  duration: 22.63,
};

const frames = (sec: number) => Math.round(sec * FPS);
const pct = (v: number, fallback: number) => (Number.isFinite(Number(v)) ? Math.min(100, Math.max(0, Number(v))) / 100 : fallback);

export function toProps(p: WebComparePixelsParams): WebComparePixelsProps {
  const total = Math.max(2, Math.min(20, Math.round(Number(p.total) || 14)));
  return {
    page: p.page ?? '',
    focusStart: [pct(p.startX, ORIGIN_FOCUS.start[0]), pct(p.startY, ORIGIN_FOCUS.start[1])],
    focusEnd: [pct(p.endX, ORIGIN_FOCUS.end[0]), pct(p.endY, ORIGIN_FOCUS.end[1])],
    title: (p.title ?? '').trim(),
    headers: [(p.head1 ?? '').trim(), (p.head2 ?? '').trim(), (p.head3 ?? '').trim()],
    rows: p.rows.slice(0, 2).map((r) => ({
      name: (r.name ?? '').trim(), score: (r.score ?? '').trim(), scoreUnit: (r.scoreUnit ?? '').trim(),
      count: (r.count ?? '').trim(), countUnit: (r.countUnit ?? '').trim(), up: r.up === true,
    })),
    total,
    labels: p.labels.slice(0, 2).map((l) => ({ text: (l.text ?? '').trim(), wins: Math.max(0, Math.min(total, Math.round(Number(l.wins) || 0))), pill: (l.pill ?? '').trim() })),
    durationInFrames: Math.max(frames(20), frames(p.duration)),
  };
}

const form: Section[] = [
  {
    title: '网页截图',
    fields: [
      { kind: 'image', key: 'page', label: '网页长截图', hint: '越清楚越好：开头会放大到 8 倍看细节' },
      { kind: 'number', key: 'startX', label: '开头特写对准（横）', min: 0, max: 100, step: 0.1, unit: '%', half: true, hint: '从左往右第几 %' },
      { kind: 'number', key: 'startY', label: '开头特写对准（竖）', min: 0, max: 100, step: 0.1, unit: '%', half: true, hint: '从上往下第几 %' },
      { kind: 'number', key: 'endX', label: '最后推近对准（横）', min: 0, max: 100, step: 0.1, unit: '%', half: true },
      { kind: 'number', key: 'endY', label: '最后推近对准（竖）', min: 0, max: 100, step: 0.1, unit: '%', half: true },
    ],
  },
  {
    title: '对比表',
    fields: [
      { kind: 'text', key: 'title', label: '表格标题', placeholder: '留空不要' },
      { kind: 'text', key: 'head1', label: '表头第一格', half: true },
      { kind: 'text', key: 'head2', label: '表头第二格', half: true },
      { kind: 'text', key: 'head3', label: '表头第三格', half: true },
      {
        kind: 'list', key: 'rows', label: '两行', itemLabel: '行',
        fields: [
          { kind: 'text', key: 'name', label: '名字', hint: '英文部分会用窄体' },
          { kind: 'text', key: 'score', label: '分数', half: true },
          { kind: 'text', key: 'scoreUnit', label: '分数单位', half: true },
          { kind: 'text', key: 'count', label: '右边的数', half: true },
          { kind: 'text', key: 'countUnit', label: '右边的单位', half: true },
          { kind: 'toggle', key: 'up', label: '绿色向上箭头（关掉是红色向下）' },
        ],
        newItem: () => ({ name: '新的一行', score: '0', scoreUnit: '分', count: '0', countUnit: '项目', up: true }),
      },
    ],
  },
  {
    title: '像素标签',
    fields: [
      { kind: 'number', key: 'total', label: '一共几个方块', min: 2, max: 20, step: 1, half: true, hint: '排成上下两排' },
      {
        kind: 'list', key: 'labels', label: '左右两个标签', itemLabel: '标签',
        fields: [
          { kind: 'text', key: 'text', label: '名字', half: true },
          { kind: 'number', key: 'wins', label: '几个方块涂橙色', min: 0, max: 20, step: 1, half: true },
          { kind: 'text', key: 'pill', label: '下面胶囊里的字', placeholder: '留空不要' },
        ],
        newItem: () => ({ text: 'NEW', wins: 7, pill: '' }),
      },
      { kind: 'number', key: 'duration', label: '视频时长', min: 20, max: 60, step: 0.1, unit: '秒', half: true },
    ],
  },
];

export const timeline: TemplateTimeline = {
  tracks: (raw) => {
    const p = raw as unknown as WebComparePixelsParams;
    return [
      {
        id: 'camera', label: '镜头', kind: 'camera',
        items: [
          { id: 'page', label: '网页截图', start: 0, end: 4.13, phases: [{ label: '拉远', start: 1, end: 2.3 }, { label: '上移推近', start: 2.37, end: 3.43 }, { label: '往右甩', start: 3.43, end: 4.13 }], select: { section: '网页截图' }, drag: {} },
          { id: 'table', label: p.title || '对比表', start: 4.13, end: 12, phases: [{ label: '表格长出来', start: 5.6, end: 7 }], select: { section: '对比表' }, drag: {} },
          { id: 'pixels', label: '像素标签', start: 12, end: p.duration, phases: [{ label: '胶囊', start: 15.53, end: 16 }], select: { section: '像素标签' }, drag: { end: true } },
        ],
      },
    ];
  },
  apply: (raw, itemId, edge, _start, end) => {
    if (itemId === 'pixels' && edge === 'end') return { ...raw, duration: Math.min(60, Math.max(20, Math.round(end * FPS) / FPS)) };
    return raw;
  },
};

export const meta: TemplateMeta = {
  id: 'web-compare-pixels',
  name: '网页截图推拉 · 暗色对比表 · 像素方块标签',
  description: '网页长截图从柱状图特写拉远、上移到页首推近，镜头一甩斜切进暗场；两行对比表一格格长出来、字一个个打出来；下面两个像素方块标签（赢几项涂几个橙色），再弹出胶囊',
  origin: '复刻自一条讲大模型评测的视频，和原片的相似度 89.6%',
  width: 1280,
  height: 720,
  fps: FPS,
  posterFrame: 520,
  form,
  defaultParams: defaultParams as unknown as Record<string, unknown>,
  timeline,
};
