import type { Section, TemplateMeta, TemplateTimeline } from '../form';
import type { CompareRow, CompareTableProps, Trend } from './CompareTable';

const FPS = 30;

export type CompareTableParams = {
  head: string;
  colA: string;
  colB: string;
  rows: CompareRow[];
  note: string;
  duration: number;
};

export const defaultParams: CompareTableParams = {
  head: '对比项',
  colA: 'Kimi K3',
  colB: 'Claude Fable 5',
  rows: [
    { label: '评测平台', a: 'Frontend Code Arena', aTrend: 'none', b: 'Frontend Code Arena', bTrend: 'none' },
    { label: '竞技场得分', a: '1679 分', aTrend: 'up', b: '1631 分', bTrend: 'down' },
    { label: '竞技场胜率', a: '76%', aTrend: 'up', b: '63%', bTrend: 'down' },
  ],
  note: '在 Program Bench（多步骤编程任务）和 Terminal-Bench 2.1（终端编程与Agent工作流）等测试中，\nK3 也以 77.8% 和 88.3% 的得分超过了 Fable 5 的 76.8% 和 84.6%',
  // 原片 89 帧
  duration: 2.97,
};

const frames = (sec: number) => Math.round(sec * FPS);
const trend = (t: unknown): Trend => (t === 'up' || t === 'down' ? t : 'none');

export function toProps(p: CompareTableParams): CompareTableProps {
  return {
    head: p.head.trim(),
    colA: p.colA.trim(),
    colB: p.colB.trim(),
    rows: p.rows.slice(0, 3).map((r) => ({ label: r.label.trim(), a: r.a.trim(), aTrend: trend(r.aTrend), b: r.b.trim(), bTrend: trend(r.bTrend) })),
    note: p.note.split('\n').map((l) => l.trim()).filter(Boolean).slice(0, 2),
    durationInFrames: Math.max(1, frames(p.duration)),
  };
}

const TRENDS = [{ value: 'none', label: '不要箭头' }, { value: 'up', label: '绿色上箭头' }, { value: 'down', label: '红色下箭头' }];

const form: Section[] = [
  {
    title: '表头',
    fields: [
      { kind: 'text', key: 'head', label: '左上角', half: true },
      { kind: 'text', key: 'colA', label: '第一列', half: true },
      { kind: 'text', key: 'colB', label: '第二列', half: true, hint: '最后是数字的话会加粗' },
    ],
  },
  {
    title: '表格',
    fields: [
      {
        kind: 'list', key: 'rows', label: '行（最多 3 行）', itemLabel: '第',
        fields: [
          { kind: 'text', key: 'label', label: '行名', half: true },
          { kind: 'text', key: 'a', label: '第一列', half: true },
          { kind: 'select', key: 'aTrend', label: '第一列箭头', half: true, options: TRENDS },
          { kind: 'text', key: 'b', label: '第二列', half: true },
          { kind: 'select', key: 'bTrend', label: '第二列箭头', half: true, options: TRENDS },
        ],
        newItem: () => ({ label: '新的一行', a: '数值', aTrend: 'none', b: '数值', bTrend: 'none' }),
      },
      { kind: 'text', key: 'note', label: '下面的注释（最多两行，换行分开）', placeholder: '留空不要' },
      { kind: 'number', key: 'duration', label: '视频时长', min: 1.5, max: 30, step: 0.1, unit: '秒' },
    ],
  },
];

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export const timeline: TemplateTimeline = {
  tracks: (raw) => {
    const p = raw as unknown as CompareTableParams;
    return [
      { id: 'camera', label: '镜头', kind: 'camera', items: [{ id: 'cam', label: '慢慢推近', start: 0, end: p.duration, select: { section: '表格' }, drag: { end: true } }] },
      { id: 'elements', label: '元素', kind: 'element', items: [{ id: 'cells', label: '一格格亮起来', start: 0.07, end: 1.1, select: { section: '表格' }, drag: {} }, ...(p.note.trim() ? [{ id: 'note', label: '注释', start: 1, end: 1.4, select: { section: '表格' }, drag: {} }] : [])] },
    ];
  },
  apply: (raw, itemId, _edge, _start, end) => (itemId === 'cam' ? { ...raw, duration: clamp(Math.round(end * FPS) / FPS, 1.5, 30) } : raw),
};

export const meta: TemplateMeta = {
  id: 'compare-table',
  name: '对比表 · 一格格亮起来 · 涨跌箭头',
  description: '墨绿底上一张两列对比表：表头和每一格一个接一个从虚到实亮起来，数值后面跟绿色上箭头或红色下箭头，最后两行小字注释扫出来',
  origin: '复刻自一条讲开源大模型的视频里的一个镜头，和原片的相似度 89.8%',
  width: 1280,
  height: 720,
  fps: FPS,
  posterFrame: 63,
  form,
  defaultParams: defaultParams as unknown as Record<string, unknown>,
  timeline,
};
