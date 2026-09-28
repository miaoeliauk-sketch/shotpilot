import type { Section, TemplateMeta, TemplateTimeline } from '../form';
import type { NewsPageHighlightProps } from './NewsPageHighlight';

const FPS = 30;

export type NewsPageHighlightParams = {
  site: string;
  channel: string;
  crumbs: string;
  headline: string;
  author: string;
  follow: string;
  lead: string;
  mark: string;
  tail: string;
  markColor: string;
  duration: number;
};

export const defaultParams: NewsPageHighlightParams = {
  site: '新知网',
  channel: '科技',
  crumbs: '科技 > 人工智能 > 正文',
  headline: 'Open Hub CEO发声：开源模型正赢得AI竞赛，闭源将落后',
  author: '新知网科技',
  follow: '关注',
  lead: '外媒',
  mark: '看清AI新格局',
  tail: '之后',
  markColor: '#eef600',
  // 原片 127 帧
  duration: 4.23,
};

const frames = (sec: number) => Math.round(sec * FPS);

export function toProps(p: NewsPageHighlightParams): NewsPageHighlightProps {
  return {
    site: (p.site ?? '').trim(),
    channel: (p.channel ?? '').trim(),
    crumbs: (p.crumbs ?? '').split(/[>＞]/).map((s) => s.trim()).filter(Boolean),
    headline: (p.headline ?? '').trim(),
    author: (p.author ?? '').trim(),
    follow: (p.follow ?? '').trim(),
    lead: (p.lead ?? '').trim(),
    mark: (p.mark ?? '').trim(),
    tail: (p.tail ?? '').trim(),
    markColor: p.markColor || '#eef600',
    durationInFrames: Math.max(frames(3.6), frames(p.duration)),
  };
}

const form: Section[] = [
  {
    title: '网页',
    fields: [
      { kind: 'text', key: 'site', label: '左上角的网站名', half: true },
      { kind: 'text', key: 'channel', label: '红底频道块', half: true, placeholder: '留空不要' },
      { kind: 'text', key: 'crumbs', label: '面包屑（用 > 隔开）' },
      { kind: 'text', key: 'headline', label: '大标题', hint: '镜头从标题开头往右扫到第一行末尾；太长会自动换行' },
      { kind: 'text', key: 'author', label: '作者名', half: true },
      { kind: 'text', key: 'follow', label: '红色按钮上的字', half: true, placeholder: '留空不要' },
    ],
  },
  {
    title: '大字 + 荧光笔',
    fields: [
      { kind: 'text', key: 'lead', label: '前面的字（不涂）', half: true },
      { kind: 'text', key: 'tail', label: '后面的字（不涂）', half: true },
      { kind: 'text', key: 'mark', label: '要涂荧光笔的字', hint: '最后镜头推近到这段字，它正好占满画面宽；字多会自动缩小' },
      { kind: 'color', key: 'markColor', label: '荧光笔颜色', half: true },
      { kind: 'number', key: 'duration', label: '视频时长', min: 3.6, max: 30, step: 0.1, unit: '秒', half: true },
    ],
  },
];

export const timeline: TemplateTimeline = {
  tracks: (raw) => {
    const p = raw as unknown as NewsPageHighlightParams;
    return [
      {
        id: 'camera', label: '镜头', kind: 'camera',
        items: [
          { id: 'page', label: '扫标题', start: 0, end: 2.2, phases: [{ label: '往右扫', start: 0, end: 1.6 }, { label: '标题收掉', start: 1.6, end: 1.73 }], select: { section: '网页' }, drag: {} },
          { id: 'big', label: p.mark || '大字', start: 2.2, end: p.duration, phases: [{ label: '滚上来', start: 1.8, end: 2.27 }, { label: '推近', start: 2.3, end: 3.33 }, { label: '荧光笔', start: 2.86, end: 3.35 }], select: { section: '大字 + 荧光笔' }, drag: { end: true } },
        ],
      },
    ];
  },
  apply: (raw, itemId, edge, _start, end) => {
    if (itemId === 'big' && edge === 'end') return { ...raw, duration: Math.min(30, Math.max(3.6, Math.round(end * FPS) / FPS)) };
    return raw;
  },
};

export const meta: TemplateMeta = {
  id: 'news-page-highlight',
  name: '新闻页扫标题 · 大字滚上来 · 荧光笔',
  description: '一张新闻网页，镜头从标题开头往右扫过去，标题区从下往上收掉，下面一行大字滚上来，硬切推近到其中一段，黄色荧光笔从左往右涂过去；屏幕网格、重暗角、边上红蓝错色',
  origin: '复刻自一条讲中美 AI 竞争的视频里的一个镜头，和原片的相似度 87.0%',
  width: 1280,
  height: 720,
  fps: FPS,
  posterFrame: 110,
  form,
  defaultParams: defaultParams as unknown as Record<string, unknown>,
  timeline,
};
