import type { Section, TemplateMeta, TemplateTimeline } from '../form';
import type { RecordSheetProps } from './RecordSheet';

const FPS = 30;

export type SheetFieldParams = { label: string; value: string; at: number };

export type RecordSheetParams = {
  background: string;
  title1: string;
  title2: string;
  photo: string;
  fields: SheetFieldParams[];
  enterAt: number;
  vignette: boolean;
  duration: number;
};

export const defaultParams: RecordSheetParams = {
  background: '/template-assets/word-magnifier/grey-wall.jpg',
  title1: 'CASE FILE RECORD',
  title2: 'ARCHIVE DEPARTMENT',
  photo: '',
  // 原片：四栏分别在飞进来后第 16、26、50、70 帧开始写，一共 152 帧
  fields: [
    { label: 'NAME', value: 'XXX', at: 0.53 },
    { label: 'ID NUMBER', value: 'XXX', at: 0.87 },
    { label: 'AGE', value: 'XXX', at: 1.67 },
    { label: 'GENDER', value: 'XXX', at: 2.33 },
  ],
  enterAt: 0,
  vignette: true,
  duration: 5.07,
};

const frames = (sec: number) => Math.round(sec * FPS);

export function toProps(p: RecordSheetParams): RecordSheetProps {
  const enterAt = frames(p.enterAt);
  return {
    background: p.background,
    title1: p.title1,
    title2: p.title2,
    photo: p.photo,
    // 表单里「第几秒开始写」从视频开头算，组件里从飞进来那一帧算
    fields: p.fields.slice(0, 4).map((f) => ({ label: f.label, value: f.value, at: frames(f.at) - enterAt })),
    enterAt,
    vignette: p.vignette !== false,
    durationInFrames: Math.max(1, frames(p.duration)),
  };
}

const form: Section[] = [
  {
    title: '表格',
    fields: [
      { kind: 'text', key: 'title1', label: '标题第一行', half: true },
      { kind: 'text', key: 'title2', label: '标题第二行', half: true },
      { kind: 'image', key: 'photo', label: '照片', hint: '放在左边的照片框里，会变成黑白；不放就是一块黑' },
      { kind: 'media', key: 'background', label: '背景', hint: '表格飞进来之前看到的画面' },
      { kind: 'number', key: 'enterAt', label: '第几秒飞进来', min: 0, max: 60, step: 0.1, unit: '秒', half: true },
      { kind: 'number', key: 'duration', label: '视频时长', min: 1, max: 60, step: 0.1, unit: '秒', half: true },
      { kind: 'toggle', key: 'vignette', label: '四周暗角' },
    ],
  },
  {
    title: '填写的内容',
    fields: [
      {
        kind: 'list', key: 'fields', label: '前四栏', itemLabel: '第',
        fields: [
          { kind: 'text', key: 'label', label: '栏目名', half: true },
          { kind: 'text', key: 'value', label: '写上去的字', half: true },
          { kind: 'number', key: 'at', label: '第几秒开始写', min: 0, max: 60, step: 0.1, unit: '秒', hint: '每 0.27 秒写一个字' },
        ],
        newItem: (items) => {
          const last = items[items.length - 1] as SheetFieldParams | undefined;
          return { label: 'NOTE', value: 'XXX', at: Math.round(((last?.at ?? 0) + 0.8) * 10) / 10 };
        },
      },
    ],
  },
];

const snap = (t: number) => Math.round((Math.round(t * FPS) / FPS) * 100) / 100;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export const timeline: TemplateTimeline = {
  tracks: (raw) => {
    const p = raw as unknown as RecordSheetParams;
    return [
      { id: 'camera', label: '镜头', kind: 'camera', items: [{ id: 'cam', label: '飞进来 → 慢慢推近', start: p.enterAt, end: p.duration, phases: [{ label: '飞进来', start: p.enterAt, end: Math.min(p.duration, p.enterAt + 0.53) }], select: { section: '表格' }, drag: { move: true } }] },
      {
        id: 'elements', label: '元素', kind: 'element',
        items: p.fields.slice(0, 4).map((f, i) => ({ id: `field-${i}`, label: `${f.label} ${f.value}`, start: f.at, end: Math.min(p.duration, f.at + (Array.from(f.value).length * 8) / FPS), select: { list: 'fields', index: i }, drag: { move: true } })),
      },
    ];
  },
  apply: (raw, itemId, _edge, start) => {
    const p = raw as unknown as RecordSheetParams;
    if (itemId === 'cam') {
      const d = clamp(snap(start), 0, 60) - p.enterAt;
      return { ...raw, enterAt: p.enterAt + d, fields: p.fields.map((f) => ({ ...f, at: snap(f.at + d) })) };
    }
    const m = /^field-(\d+)$/.exec(itemId);
    if (m) {
      const i = Number(m[1]);
      return { ...raw, fields: p.fields.map((f, k) => (k === i ? { ...f, at: clamp(snap(start), 0, 60) } : f)) };
    }
    return raw;
  },
};

export const meta: TemplateMeta = {
  id: 'record-sheet',
  name: '旧档案表 · 飞进来 · 一栏栏填写',
  description: '一张发黄的旧档案表从左下角转着飞进来、铺满画面，前四栏一个字一个字写上内容，镜头慢慢推近',
  origin: '复刻自一条讲 AI 幻觉的视频里的一个镜头，和原片的相似度 82.3%',
  width: 1280,
  height: 720,
  fps: FPS,
  posterFrame: 140,
  form,
  defaultParams: defaultParams as unknown as Record<string, unknown>,
  timeline,
};
