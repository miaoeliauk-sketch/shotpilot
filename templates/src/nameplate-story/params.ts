import type { Section, TemplateMeta, TemplateTimeline } from '../form';
import type { NameplateStoryProps } from './NameplateStory';

const FPS = 30;

export type NameplateStoryParams = {
  logo1: string;
  name1: string;
  count: string;
  logo2: string;
  name2: string;
  quotes: { before: string; key: string; after: string }[];
  date: string;
  body1: string;
  body2: string;
  underline: string;
  decor: string;
  countAt: number;
  whipAt: number;
  brushAt: number;
  duration: number;
};

export const defaultParams: NameplateStoryParams = {
  logo1: '/template-assets/nameplate-story/logo-1.png',
  name1: 'Nimbus',
  count: '40+',
  logo2: '/template-assets/nameplate-story/logo-2.png',
  name2: 'Leafy',
  quotes: [
    { before: '这些人临走前，还拿', key: 'U盘', after: '' },
    { before: '就连 ', key: 'AirDrop', after: ' 也拿走' },
    { before: '还拷贝 ', key: '数据', after: ' 还有法律吗！' },
  ],
  date: '2024年2月',
  body1: '两家公司达成和解协议，Nimbus 同意接受对',
  body2: '其系统的审查以删除任何对方的机密信息',
  underline: '达成和解协议',
  decor: '/template-assets/nameplate-story/decor.png',
  // 原片：第 96 帧出人数、第 150 帧横甩、第 372 帧墨刷，一共 468 帧
  countAt: 3.2,
  whipAt: 5,
  brushAt: 12.4,
  duration: 15.6,
};

const frames = (sec: number) => Math.round(sec * FPS);

export function toProps(p: NameplateStoryParams): NameplateStoryProps {
  const countAt = Math.max(1, frames(p.countAt));
  const whipAt = Math.max(countAt + 1, frames(p.whipAt));
  const brushAt = Math.max(whipAt + 1, frames(p.brushAt));
  return {
    wallLight: '/template-assets/nameplate-story/wall-light.jpg',
    wallDark: '/template-assets/nameplate-story/wall-dark.jpg',
    logo1: p.logo1,
    name1: p.name1,
    logo2: p.logo2,
    name2: p.name2,
    count: p.count,
    quotes: p.quotes.slice(0, 3),
    date: p.date,
    body: [p.body1, p.body2],
    underline: p.underline.trim(),
    decor: p.decor,
    countAt,
    whipAt,
    brushAt,
    durationInFrames: Math.max(1, frames(p.duration)),
  };
}

const form: Section[] = [
  {
    title: '第一块铭牌',
    fields: [
      { kind: 'image', key: 'logo1', label: 'logo', hint: '方图最好，放在白色小方块里' },
      { kind: 'text', key: 'name1', label: '名字', hint: '英文最好看，一个字母一个字母掉下来' },
      { kind: 'text', key: 'count', label: '右边的大数字', hint: '比如 40+，旁边配一排排小人' },
      { kind: 'number', key: 'countAt', label: '第几秒出数字', min: 0.5, max: 60, step: 0.1, unit: '秒' },
    ],
  },
  {
    title: '第二块铭牌',
    fields: [
      { kind: 'image', key: 'logo2', label: 'logo' },
      { kind: 'text', key: 'name2', label: '名字' },
      {
        kind: 'list', key: 'quotes', label: '引语', itemLabel: '第',
        hint: '最多三行，每行中间的关键词特别大',
        fields: [
          { kind: 'text', key: 'before', label: '前面' },
          { kind: 'text', key: 'key', label: '关键词' },
          { kind: 'text', key: 'after', label: '后面', placeholder: '可以留空' },
        ],
        newItem: () => ({ before: '新的一句', key: '重点', after: '' }),
      },
      { kind: 'number', key: 'whipAt', label: '第几秒横甩过去', min: 0.5, max: 60, step: 0.1, unit: '秒' },
    ],
  },
  {
    title: '日期页',
    fields: [
      { kind: 'text', key: 'date', label: '日期' },
      { kind: 'text', key: 'body1', label: '正文第一行' },
      { kind: 'text', key: 'body2', label: '正文第二行' },
      { kind: 'text', key: 'underline', label: '画橙色线的词', hint: '必须是第一行里的字', placeholder: '留空不画' },
      { kind: 'image', key: 'decor', label: '右边的配图', hint: '透明底的图最好，会有点虚' },
      { kind: 'number', key: 'brushAt', label: '第几秒墨刷转场', min: 1, max: 60, step: 0.1, unit: '秒', half: true },
      { kind: 'number', key: 'duration', label: '视频时长', min: 1, max: 60, step: 0.1, unit: '秒', half: true },
    ],
  },
];

const snap = (t: number) => Math.round((Math.round(t * FPS) / FPS) * 100) / 100;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export const timeline: TemplateTimeline = {
  tracks: (raw) => {
    const p = raw as unknown as NameplateStoryParams;
    return [
      {
        id: 'camera', label: '镜头', kind: 'camera',
        items: [
          { id: 'plate1', label: p.name1 || '第一块铭牌', start: 0, end: p.whipAt, phases: [{ label: '往右推', start: p.countAt, end: Math.min(p.whipAt, p.countAt + 0.53) }], select: { section: '第一块铭牌' }, drag: { end: true } },
          { id: 'plate2', label: p.name2 || '第二块铭牌', start: p.whipAt, end: p.brushAt, phases: [{ label: '横甩', start: p.whipAt, end: Math.min(p.brushAt, p.whipAt + 1.3) }], select: { section: '第二块铭牌' }, drag: { end: true } },
          { id: 'dark', label: '日期页', start: p.brushAt, end: p.duration, phases: [{ label: '墨刷', start: p.brushAt, end: Math.min(p.duration, p.brushAt + 0.67) }], select: { section: '日期页' }, drag: { end: true } },
        ],
      },
      { id: 'count', label: '大数字', kind: 'element', items: [{ id: 'count', label: p.count, start: p.countAt, end: p.whipAt, select: { section: '第一块铭牌' }, drag: { move: true } }] },
    ];
  },
  apply: (raw, itemId, _edge, start, end) => {
    const p = raw as unknown as NameplateStoryParams;
    if (itemId === 'plate1') return { ...raw, whipAt: clamp(snap(end), p.countAt + 0.5, p.brushAt - 0.5) };
    if (itemId === 'plate2') return { ...raw, brushAt: clamp(snap(end), p.whipAt + 0.5, p.duration - 0.3) };
    if (itemId === 'dark') return { ...raw, duration: clamp(snap(end), p.brushAt + 0.3, 60) };
    if (itemId === 'count') return { ...raw, countAt: clamp(snap(start), 0.5, p.whipAt - 0.5) };
    return raw;
  },
};

export const meta: TemplateMeta = {
  id: 'nameplate-story',
  name: '公司铭牌 · 人数 · 引语 · 墨刷日期页',
  description: '镜头摇下来落在一块公司铭牌上，名字一个字母一个字母掉下来，右边出一排排小人和大数字；横甩到第二块铭牌，红线扭着画下来、三行引语打出来；墨刷转场到深色日期页',
  origin: '复刻自一条科技解读视频里的一段，和原片的相似度 82.8%',
  width: 1280,
  height: 720,
  fps: FPS,
  posterFrame: 340,
  form,
  defaultParams: defaultParams as unknown as Record<string, unknown>,
  timeline,
};
