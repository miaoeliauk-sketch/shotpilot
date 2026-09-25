import type { Section, TemplateMeta, TemplateTimeline } from '../form';
import type { OfficeTagsProps } from './OfficeTags';

const FPS = 30;

export type OfficeTagsParams = {
  close: string;
  wide: string;
  cutAt: number;
  title: string;
  titleColor: string;
  tags: { text: string; sub: string; at: number }[];
  tagColor: string;
  vignette: boolean;
  duration: number;
};

export const defaultParams: OfficeTagsParams = {
  close: '/template-assets/office-tags/sample-close.jpg',
  wide: '/template-assets/office-tags/sample-wide.jpg',
  // 原片：第 66 帧切全景，右边标签第 104 帧、左边第 114 帧，一共 270 帧
  cutAt: 2.2,
  title: '跳槽.',
  titleColor: '#7a7a7a',
  tags: [
    { text: '调查中', sub: 'Under investigation', at: 3.8 },
    { text: '调查中', sub: 'Under investigation', at: 3.47 },
  ],
  tagColor: '#e25a22',
  vignette: true,
  duration: 9,
};

const frames = (sec: number) => Math.round(sec * FPS);

export function toProps(p: OfficeTagsParams): OfficeTagsProps {
  return {
    close: p.close,
    wide: p.wide,
    cutAt: Math.max(1, frames(p.cutAt)),
    title: p.title,
    titleColor: p.titleColor,
    tags: p.tags.slice(0, 2).map((t) => ({ text: t.text, sub: t.sub, at: frames(t.at) })),
    tagColor: p.tagColor,
    vignette: p.vignette,
    durationInFrames: Math.max(1, frames(p.duration)),
  };
}

const form: Section[] = [
  {
    title: '画面',
    fields: [
      { kind: 'media', key: 'close', label: '镜头一：近景', hint: '横图，会从右往左滑进来（左右各多留一点）' },
      { kind: 'media', key: 'wide', label: '镜头二：全景', hint: '横图，右上方留出墙面放大字，右边中间放标签' },
      { kind: 'number', key: 'cutAt', label: '第几秒切全景', min: 0.3, max: 30, step: 0.1, unit: '秒' },
      { kind: 'toggle', key: 'vignette', label: '四周暗角', hint: '图本身已经有暗角就关掉' },
    ],
  },
  {
    title: '大字和标签',
    fields: [
      { kind: 'text', key: 'title', label: '墙上的大字', hint: '两三个字最合适，灰色印在墙上' },
      { kind: 'color', key: 'titleColor', label: '大字颜色', half: true },
      { kind: 'color', key: 'tagColor', label: '标签字颜色', half: true },
      {
        kind: 'list', key: 'tags', label: '标签', itemLabel: '标签',
        hint: '最多两张：第一张在左、第二张在右，各自钉上去以后拉出红线',
        fields: [
          { kind: 'text', key: 'text', label: '大字' },
          { kind: 'text', key: 'sub', label: '下面的小字', placeholder: '留空不要' },
          { kind: 'number', key: 'at', label: '第几秒钉上', min: 0, max: 60, step: 0.1, unit: '秒' },
        ],
        newItem: () => ({ text: '调查中', sub: 'Under investigation', at: 4 }),
      },
      { kind: 'number', key: 'duration', label: '视频时长', min: 1, max: 60, step: 0.1, unit: '秒' },
    ],
  },
];

const snap = (t: number) => Math.round((Math.round(t * FPS) / FPS) * 100) / 100;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export const timeline: TemplateTimeline = {
  tracks: (raw) => {
    const p = raw as unknown as OfficeTagsParams;
    return [
      {
        id: 'camera', label: '镜头', kind: 'camera',
        items: [
          { id: 'close', label: '近景横移', start: 0, end: Math.min(p.duration, p.cutAt), select: { section: '画面' }, drag: { end: true } },
          { id: 'wide', label: '全景拉远', start: p.cutAt, end: p.duration, phases: [{ label: '对焦', start: p.cutAt, end: Math.min(p.duration, p.cutAt + 0.47) }], select: { section: '画面' }, drag: { end: true } },
        ],
      },
      {
        id: 'tags', label: '标签', kind: 'element',
        items: p.tags.slice(0, 2).map((t, i) => ({
          id: `tag-${i}`, label: `${i === 0 ? '左' : '右'} · ${t.text}`, start: t.at, end: Math.min(p.duration, t.at + 0.67),
          phases: [{ label: '淡进', start: t.at, end: Math.min(p.duration, t.at + 0.27) }], select: { list: 'tags', index: i }, drag: { move: true },
        })),
      },
    ];
  },
  apply: (raw, itemId, _edge, start, end) => {
    const p = raw as unknown as OfficeTagsParams;
    if (itemId === 'close') return { ...raw, cutAt: clamp(snap(end), 0.3, p.duration - 0.3) };
    if (itemId === 'wide') return { ...raw, duration: clamp(snap(end), p.cutAt + 0.3, 60) };
    const m = /^tag-(\d+)$/.exec(itemId);
    if (m) return { ...raw, tags: p.tags.map((t, j) => (j === Number(m[1]) ? { ...t, at: clamp(snap(start), 0, 60) } : t)) };
    return raw;
  },
};

export const meta: TemplateMeta = {
  id: 'office-tags',
  name: '场景拼贴 · 墙上大字 · 钉标签拉红线',
  description: '近景图横移进来，切到全景慢慢拉远、对焦；墙上印着灰色大字，两张牛皮纸标签钉上去，红线从图钉拉出画面',
  origin: '复刻自一条科技解读视频里的一个镜头，和原片的相似度 87.1%',
  width: 1280,
  height: 720,
  fps: FPS,
  posterFrame: 200,
  form,
  defaultParams: defaultParams as unknown as Record<string, unknown>,
  timeline,
};
