import type { Section, TemplateMeta, TemplateTimeline } from '../form';
import type { Cutout, ScoreRow, TitleScoreTableProps } from './TitleScoreTable';

const FPS = 30;

export type TitleScoreTableParams = {
  word1: string;
  word2: string;
  word3: string;
  english: string;
  leftImage: string;
  leftX: number;
  leftY: number;
  leftWidth: number;
  rightImage: string;
  rightX: number;
  rightY: number;
  rightWidth: number;
  tableTitle: string;
  tableTitleCjk: string;
  rows: ScoreRow[];
  highlight: number;
  highlightColor: string;
  floaters: boolean;
  duration: number;
};

export const defaultParams: TitleScoreTableParams = {
  word1: '长',
  word2: '链路',
  word3: '测试',
  english: 'Long link testing',
  leftImage: '/template-assets/title-score-table/gear-small.png',
  leftX: 217,
  leftY: 410,
  leftWidth: 150,
  rightImage: '/template-assets/title-score-table/gear-big.png',
  rightX: 765,
  rightY: 325,
  rightWidth: 200,
  tableTitle: 'SWE Marathon',
  tableTitleCjk: '长链路测试',
  rows: [
    { name: 'Model A', value: '42.0', heavy: true },
    { name: 'Model B', value: '35.0', heavy: true },
    { name: 'Model C', value: '39.0', heavy: false },
  ],
  highlight: 2,
  highlightColor: '#d7a908',
  floaters: true,
  // 原片 239 帧
  duration: 7.97,
};

const frames = (sec: number) => Math.round(sec * FPS);

export function toProps(p: TitleScoreTableParams): TitleScoreTableProps {
  const cut = (image: string, x: number, y: number, width: number): Cutout => ({ image: image ?? '', x: Number(x) || 0, y: Number(y) || 0, width: Math.max(20, Number(width) || 100) });
  return {
    words: [(p.word1 ?? '').trim(), (p.word2 ?? '').trim(), (p.word3 ?? '').trim()],
    english: (p.english ?? '').trim(),
    left: cut(p.leftImage, p.leftX, p.leftY, p.leftWidth),
    right: cut(p.rightImage, p.rightX, p.rightY, p.rightWidth),
    tableTitle: (p.tableTitle ?? '').trim(),
    tableTitleCjk: (p.tableTitleCjk ?? '').trim(),
    rows: p.rows.slice(0, 3).map((r) => ({ name: (r.name ?? '').trim(), value: (r.value ?? '').trim(), heavy: r.heavy !== false })),
    highlight: Math.max(0, Math.min(3, Math.round(Number(p.highlight) || 0))),
    highlightColor: p.highlightColor || '#d7a908',
    floaters: p.floaters === false ? 'none' : 'on',
    durationInFrames: Math.max(frames(4.2), frames(p.duration)),
  };
}

const form: Section[] = [
  {
    title: '大标题',
    fields: [
      { kind: 'text', key: 'word1', label: '第一段（最大）', half: true },
      { kind: 'text', key: 'word2', label: '第二段', half: true },
      { kind: 'text', key: 'word3', label: '第三段（最小）', half: true },
      { kind: 'text', key: 'english', label: '下面的红色英文', half: true, placeholder: '留空不要' },
    ],
  },
  {
    title: '装饰图',
    fields: [
      { kind: 'image', key: 'leftImage', label: '左边的装饰图', hint: '透明底 PNG（原片是手托着齿轮），从下面升上来；表格那段也拿它当边上虚化的装饰' },
      { kind: 'number', key: 'leftX', label: '左上角（横）', min: -400, max: 1280, step: 1, unit: '像素', half: true },
      { kind: 'number', key: 'leftY', label: '左上角（竖）', min: -400, max: 720, step: 1, unit: '像素', half: true },
      { kind: 'number', key: 'leftWidth', label: '宽', min: 20, max: 1280, step: 1, unit: '像素', half: true },
      { kind: 'image', key: 'rightImage', label: '右边的装饰图' },
      { kind: 'number', key: 'rightX', label: '左上角（横）', min: -400, max: 1280, step: 1, unit: '像素', half: true },
      { kind: 'number', key: 'rightY', label: '左上角（竖）', min: -400, max: 720, step: 1, unit: '像素', half: true },
      { kind: 'number', key: 'rightWidth', label: '宽', min: 20, max: 1280, step: 1, unit: '像素', half: true },
    ],
  },
  {
    title: '分数表',
    fields: [
      { kind: 'text', key: 'tableTitle', label: '表格标题（英文斜体部分）', half: true, placeholder: '留空不要' },
      { kind: 'text', key: 'tableTitleCjk', label: '表格标题（后面的中文）', half: true, placeholder: '留空不要' },
      {
        kind: 'list', key: 'rows', label: '三行（最多 3 行）', itemLabel: '行',
        fields: [
          { kind: 'text', key: 'name', label: '名字', half: true },
          { kind: 'text', key: 'value', label: '分数', half: true },
          { kind: 'toggle', key: 'heavy', label: '名字用粗体', half: true },
        ],
        newItem: () => ({ name: '新的一行', value: '0.0', heavy: false }),
      },
      { kind: 'number', key: 'highlight', label: '前几行的分数刷黄', min: 0, max: 3, step: 1, half: true },
      { kind: 'color', key: 'highlightColor', label: '刷黄的颜色', half: true },
      { kind: 'toggle', key: 'floaters', label: '表格边上飘几个虚化的装饰图', half: true },
      { kind: 'number', key: 'duration', label: '视频时长', min: 4.2, max: 60, step: 0.1, unit: '秒', half: true, hint: '最短到刷黄结束' },
    ],
  },
];

export const timeline: TemplateTimeline = {
  tracks: (raw) => {
    const p = raw as unknown as TitleScoreTableParams;
    return [
      {
        id: 'camera', label: '镜头', kind: 'camera',
        items: [
          { id: 'title', label: `${p.word1}${p.word2}${p.word3}`, start: 0, end: 1.07, phases: [{ label: '滑进来', start: 0, end: 0.93 }], select: { section: '大标题' }, drag: {} },
          { id: 'whip', label: '往下甩', start: 1.07, end: 2.67, select: { section: '大标题' }, drag: {} },
          { id: 'table', label: p.tableTitle || '分数表', start: 2.67, end: p.duration, phases: [{ label: '刷黄', start: 3.57, end: 3.87 }], select: { section: '分数表' }, drag: { end: true } },
        ],
      },
    ];
  },
  apply: (raw, itemId, edge, _start, end) => {
    if (itemId === 'table' && edge === 'end') return { ...raw, duration: Math.min(60, Math.max(4.2, Math.round(end * FPS) / FPS)) };
    return raw;
  },
};

export const meta: TemplateMeta = {
  id: 'title-score-table',
  name: '错落宋体大标题 · 镜头下甩 · 分数表刷黄',
  description: '灰纸上一行大小错落的宋体大标题从四面滑进来，红色英文一个个字母打出来，两边的装饰图（原片是手托齿轮）升上来；镜头一路往下甩到一张三行分数表，名字和分数一行行打出来，最后几格刷上黄色',
  origin: '复刻自一条讲大模型评测的视频，和原片的相似度 82.8%',
  width: 1280,
  height: 720,
  fps: FPS,
  posterFrame: 140,
  form,
  defaultParams: defaultParams as unknown as Record<string, unknown>,
  timeline,
};

