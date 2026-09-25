import type { Section, TemplateMeta, TemplateTimeline } from '../form';
import { defaultParams as tweetDefaults } from '../tweet-translate/params';
import type { ArticleMarkerProps } from './ArticleMarker';

const FPS = 30;

export type ArticleMarkerParams = {
  paragraphs: { text: string }[];
  markParagraph: number;
  avatar: string;
  name: string;
  handle: string;
  postParagraphs: { text: string }[];
  postLines: { text: string; highlight: string }[];
  highlightColor: string;
  pullBack: boolean;
  markAt: number;
  markSeconds: number;
  zoomSeconds: number;
  duration: number;
};

export const defaultParams: ArticleMarkerParams = {
  paragraphs: [
    { text: '这个项目从去年开始就一直有传闻，外界对它的样子一直猜个不停。' },
    { text: '最近，有关「口袋」硬件的消息越来越多。' },
    { text: '今天一早，一位数码博主透露了关于「口袋」硬件项目的最新细节。' },
    { text: '该硬件已被确认是一款取代耳机的特殊音频产品，内部代号为「Sweetpea」（甜豌豆）。' },
    { text: '据他所说，在制造端，工厂已接到通知，要求在 2028 年第四季度前为五款设备做好量产准备。其余尚未全部揭晓，但一款家居设备和一款手写笔仍在研发考量中。' },
  ],
  markParagraph: 3,
  avatar: tweetDefaults.avatar,
  name: tweetDefaults.name,
  handle: tweetDefaults.handle,
  postParagraphs: tweetDefaults.paragraphs,
  postLines: tweetDefaults.lines.map((l) => ({ text: l.text, highlight: l.highlight })),
  highlightColor: tweetDefaults.highlightColor,
  pullBack: true,
  // 原片：第 34 帧开始涂黑、同时开始推近，推 54 帧；一共 134 帧
  markAt: 1.13,
  markSeconds: 1.67,
  zoomSeconds: 1.8,
  duration: 4.47,
};

const frames = (sec: number) => Math.round(sec * FPS);

export function toProps(p: ArticleMarkerParams): ArticleMarkerProps {
  const paragraphs = p.paragraphs.map((x) => x.text).filter((t) => t.trim() !== '');
  return {
    paragraphs,
    markParagraph: Math.min(Math.max(0, Math.round(p.markParagraph)), Math.max(0, paragraphs.length - 1)),
    post: {
      avatar: p.avatar,
      name: p.name,
      handle: p.handle,
      paragraphs: p.postParagraphs.map((x) => x.text).filter((t) => t.trim() !== ''),
      anchorParagraph: 1,
      lines: p.postLines.filter((l) => l.text.trim() !== '').map((l) => ({ text: l.text, highlight: l.highlight.trim(), at: 0 })),
      highlightColor: p.highlightColor,
    },
    pullBack: p.pullBack,
    markAt: frames(p.markAt),
    markFrames: Math.max(1, p.markSeconds * FPS),
    zoomAt: frames(p.markAt),
    zoomFrames: Math.max(1, p.zoomSeconds * FPS),
    durationInFrames: Math.max(1, frames(p.duration)),
  };
}

const form: Section[] = [
  {
    title: '文章正文',
    fields: [
      {
        kind: 'list', key: 'paragraphs', label: '段落', itemLabel: '段落',
        hint: '网页文章的正文，一段一段往下排',
        fields: [{ kind: 'text', key: 'text', label: '这一段' }],
        newItem: () => ({ text: '新的一段正文' }),
      },
      { kind: 'number', key: 'markParagraph', label: '涂黑第几段', min: 0, max: 20, step: 1, hint: '从 0 数；涂这一段的第一行，镜头也推到它上面' },
    ],
  },
  {
    title: '下面嵌的帖子',
    fields: [
      { kind: 'image', key: 'avatar', label: '头像' },
      { kind: 'text', key: 'name', label: '名字', half: true },
      { kind: 'text', key: 'handle', label: '账号', half: true },
      {
        kind: 'list', key: 'postParagraphs', label: '英文原文', itemLabel: '段落',
        hint: '两个星号包起来的字是粗体：**像这样**',
        fields: [{ kind: 'text', key: 'text', label: '这一段' }],
        newItem: () => ({ text: 'New paragraph' }),
      },
      {
        kind: 'list', key: 'postLines', label: '帖子上的翻译黑条', itemLabel: '第',
        hint: '接「英文原文特写 · 翻译黑条」那个镜头用：开头拉远时能看到',
        fields: [
          { kind: 'text', key: 'text', label: '这一行' },
          { kind: 'text', key: 'highlight', label: '重点词', placeholder: '留空不标' },
        ],
        newItem: () => ({ text: '新的一行翻译', highlight: '' }),
      },
      { kind: 'color', key: 'highlightColor', label: '重点词颜色' },
    ],
  },
  {
    title: '时间',
    fields: [
      { kind: 'toggle', key: 'pullBack', label: '开头从帖子特写拉远', hint: '关掉就一开始就是整篇文章' },
      { kind: 'number', key: 'markAt', label: '第几秒开始涂黑、推近', min: 0, max: 60, step: 0.1, unit: '秒' },
      { kind: 'number', key: 'markSeconds', label: '涂黑用几秒', min: 0.3, max: 10, step: 0.1, unit: '秒', half: true },
      { kind: 'number', key: 'zoomSeconds', label: '推近用几秒', min: 0.3, max: 10, step: 0.1, unit: '秒', half: true },
      { kind: 'number', key: 'duration', label: '视频时长', min: 1, max: 60, step: 0.1, unit: '秒' },
    ],
  },
];

const snap = (t: number) => Math.round((Math.round(t * FPS) / FPS) * 100) / 100;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export const timeline: TemplateTimeline = {
  tracks: (raw) => {
    const p = raw as unknown as ArticleMarkerParams;
    const camera = [];
    if (p.pullBack) camera.push({ id: 'pull', label: '拉远', start: 0, end: Math.min(p.markAt, 1), select: { section: '时间' }, drag: {} });
    camera.push({ id: 'zoom', label: '推近', start: p.markAt, end: Math.min(p.duration, p.markAt + p.zoomSeconds), select: { section: '时间' }, drag: { move: true, end: true } });
    return [
      { id: 'camera', label: '镜头', kind: 'camera', items: camera },
      { id: 'mark', label: '涂黑', kind: 'element', items: [{ id: 'mark', label: p.paragraphs[p.markParagraph]?.text || '（还没选）', start: p.markAt, end: Math.min(p.duration, p.markAt + p.markSeconds), select: { section: '文章正文' }, drag: { move: true, end: true } }] },
      { id: 'end', label: '结尾', kind: 'element', items: [{ id: 'end', label: '停在这句话上', start: Math.min(p.duration, p.markAt + p.zoomSeconds), end: p.duration, select: { section: '时间' }, drag: { end: true } }] },
    ];
  },
  apply: (raw, itemId, edge, start, end) => {
    const p = raw as unknown as ArticleMarkerParams;
    if (itemId === 'zoom' || itemId === 'mark') {
      if (edge === 'end') {
        const key = itemId === 'zoom' ? 'zoomSeconds' : 'markSeconds';
        return { ...raw, [key]: clamp(snap(end - p.markAt), 0.3, 10) };
      }
      return { ...raw, markAt: clamp(snap(start), 0, 60) };
    }
    if (itemId === 'end') return { ...raw, duration: clamp(snap(end), 1, 60) };
    return raw;
  },
};

export const meta: TemplateMeta = {
  id: 'article-marker',
  name: '文章截图 · 黑条涂重点 · 推近',
  description: '镜头从文章里嵌的帖子拉远到整篇文章，一句话被黑条从左往右涂黑、字变白，镜头同时推到这句话上',
  origin: '复刻自一条科技解读视频里的一个镜头，和原片的相似度 79.3%',
  width: 1280,
  height: 720,
  fps: FPS,
  posterFrame: 100,
  form,
  defaultParams: defaultParams as unknown as Record<string, unknown>,
  timeline,
};
