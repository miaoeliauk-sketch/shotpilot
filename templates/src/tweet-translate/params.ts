import type { Section, TemplateMeta, TemplateTimeline } from '../form';
import type { TweetTranslateProps } from './TweetTranslate';

const FPS = 30;

export type TweetTranslateParams = {
  avatar: string;
  name: string;
  handle: string;
  paragraphs: { text: string }[];
  anchorParagraph: number;
  lines: { text: string; highlight: string; at: number }[];
  highlightColor: string;
  /** 一条黑条刷完用几秒 */
  wipeSeconds: number;
  duration: number;
};

export const defaultParams: TweetTranslateParams = {
  avatar: '/template-assets/tweet-translate/avatar.png',
  name: 'tech insider',
  handle: '@techinsider',
  paragraphs: [
    { text: 'Hearing fresh detail on the "Pocket" hardware project from last week report. Now confirmed it is a small audio device to replace earbuds, internal code name is **"Sweetpea"**' },
    { text: 'On manufacturing, the factory has been told to prepare for a total of 5 devices by Q4 2028. Not all known but a home style device and a pen are still considered' },
    { text: 'However many sources repeated the same thing: Sweetpea is now at the front of the line. **The release has been told to be near September, volume projection 40-50m first year.** Only this device is currently known.' },
  ],
  anchorParagraph: 1,
  lines: [
    { text: '从上一份报告中获悉关于"口袋"硬件项目的最新细节，', highlight: '', at: 0.17 },
    { text: '内部研发中，代号为“甜豌豆”', highlight: '甜豌豆', at: 1.92 },
  ],
  highlightColor: '#eaf960',
  // 原片：第 5、58 帧开始刷，每条 52 帧刷完，一共 118 帧
  wipeSeconds: 1.73,
  duration: 3.93,
};

const frames = (sec: number) => Math.round(sec * FPS);

export function toProps(p: TweetTranslateParams): TweetTranslateProps {
  return {
    avatar: p.avatar,
    name: p.name,
    handle: p.handle,
    paragraphs: p.paragraphs.map((x) => x.text).filter((t) => t.trim() !== ''),
    anchorParagraph: Math.max(0, Math.round(p.anchorParagraph)),
    lines: p.lines.filter((l) => l.text.trim() !== '').map((l) => ({ text: l.text, highlight: l.highlight.trim(), at: l.at * FPS })),
    highlightColor: p.highlightColor,
    wipeFrames: Math.max(1, p.wipeSeconds * FPS),
    durationInFrames: Math.max(1, frames(p.duration)),
  };
}

const form: Section[] = [
  {
    title: '翻译黑条',
    fields: [
      {
        kind: 'list', key: 'lines', label: '翻译', itemLabel: '第',
        hint: '一行一条黑条，从上往下排，各自在设定的时间从左往右刷出来',
        fields: [
          { kind: 'text', key: 'text', label: '这一行' },
          { kind: 'text', key: 'highlight', label: '重点词', placeholder: '留空不标', hint: '必须是这一行里的字，会变成下面的颜色' },
          { kind: 'number', key: 'at', label: '第几秒开始刷', min: 0, max: 60, step: 0.1, unit: '秒' },
        ],
        newItem: (items) => ({ text: '新的一行翻译', highlight: '', at: Math.round(((Number(items[items.length - 1]?.at ?? 0) || 0) + 1.8) * 10) / 10 }),
      },
      { kind: 'color', key: 'highlightColor', label: '重点词颜色', half: true },
      { kind: 'number', key: 'wipeSeconds', label: '一条刷完用几秒', min: 0.3, max: 10, step: 0.1, unit: '秒', half: true },
      { kind: 'number', key: 'anchorParagraph', label: '盖在第几段上', min: 0, max: 20, step: 1, hint: '从 0 数；黑条从这一段第一行开始往下排' },
    ],
  },
  {
    title: '英文原文',
    fields: [
      {
        kind: 'list', key: 'paragraphs', label: '段落', itemLabel: '段落',
        hint: '字很大、右边超出画面，像贴近截图拍的。两个星号包起来的字是粗体：**像这样**',
        fields: [{ kind: 'text', key: 'text', label: '这一段' }],
        newItem: () => ({ text: 'New paragraph' }),
      },
      { kind: 'image', key: 'avatar', label: '头像', hint: '在左上角，只露出一点' },
      { kind: 'text', key: 'name', label: '名字', half: true },
      { kind: 'text', key: 'handle', label: '账号', half: true },
      { kind: 'number', key: 'duration', label: '视频时长', min: 1, max: 60, step: 0.1, unit: '秒' },
    ],
  },
];

const snap = (t: number) => Math.round((Math.round(t * FPS) / FPS) * 100) / 100;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export const timeline: TemplateTimeline = {
  tracks: (raw) => {
    const p = raw as unknown as TweetTranslateParams;
    return [
      { id: 'camera', label: '镜头', kind: 'camera', items: [{ id: 'drift', label: '慢慢往右下漂', start: 0, end: p.duration, select: { section: '英文原文' }, drag: { end: true } }] },
      {
        id: 'bars', label: '翻译黑条', kind: 'element',
        items: p.lines.map((l, i) => ({
          id: `bar-${i}`, label: l.text || '（还没写）', start: l.at, end: Math.min(p.duration, l.at + p.wipeSeconds),
          select: { list: 'lines', index: i }, drag: { move: true },
        })),
      },
    ];
  },
  apply: (raw, itemId, _edge, start, end) => {
    const p = raw as unknown as TweetTranslateParams;
    if (itemId === 'drift') return { ...raw, duration: clamp(snap(end), 1, 60) };
    const m = /^bar-(\d+)$/.exec(itemId);
    if (m) {
      const i = Number(m[1]);
      return { ...raw, lines: p.lines.map((l, j) => (j === i ? { ...l, at: clamp(snap(start), 0, 60) } : l)) };
    }
    return raw;
  },
};

export const meta: TemplateMeta = {
  id: 'tweet-translate',
  name: '英文原文特写 · 翻译黑条',
  description: '贴近拍的英文帖子原文慢慢漂，一行一行刷出黑底白字的中文翻译，重点词变色；两边有景深、四周暗角',
  origin: '复刻自一条科技解读视频里的一个镜头，和原片的相似度 75.8%',
  width: 1280,
  height: 720,
  fps: FPS,
  posterFrame: 112,
  form,
  defaultParams: defaultParams as unknown as Record<string, unknown>,
  timeline,
};
