import type { Section, TemplateMeta, TemplateTimeline } from '../form';
import type { DocHighlightProps } from './DocHighlight';

const FPS = 30;
/** 原片：推近 14 帧，荧光笔 11 帧 */
const PUSH_SECONDS = 14 / FPS;
const MARKER_SECONDS = 11 / FPS;

export type DocHighlightParams = {
  background: string;
  title: string;
  subtitle: string;
  paragraphs: { text: string }[];
  highlight: string;
  highlightColor: string;
  /** 第几秒切到特写（推近在它前面 0.5 秒开始） */
  cutAt: number;
  highlightAt: number;
  duration: number;
};

export const defaultParams: DocHighlightParams = {
  background: '/template-assets/doc-highlight/sample-wall.jpg',
  title: '苹果状告OpenAI',
  subtitle: 'Apple sues OpenAI',
  paragraphs: [
    { text: '当地时间7月10日，科技巨头苹果公司起诉AI新贵OpenAI，指控后者为拓展竞争性硬件业务而窃取了苹果的商业秘密。' },
    { text: '法院文书显示，该诉讼由美国加利福尼亚北区联邦地区法院圣何塞分院受理，原告苹果公司起诉两名前苹果员工Chang Lu和Tan Tang，OpenAI基金会与OpenAI公共利益公司，以及OpenAI硬件子公司io Products。' },
    { text: '起诉书称，苹果公司累计投入数千亿资金，数十年来在iPhone、MacBook等产品上积累的设计和工艺，是公司最核心的机密。' },
  ],
  highlight: '原告苹果公司起诉两名前苹果员工Chang Lu和Tan Tang，OpenAI基金会与OpenAI公共利益公司',
  highlightColor: '#edc004',
  // 原片第 73 帧切、第 89 帧开始划
  cutAt: 2.43,
  highlightAt: 2.97,
  duration: 5.13,
};

const frames = (sec: number) => Math.round(sec * FPS);

export function toProps(p: DocHighlightParams): DocHighlightProps {
  const cutAt = Math.max(15, frames(p.cutAt));
  return {
    background: p.background,
    title: p.title,
    subtitle: p.subtitle,
    paragraphs: p.paragraphs.map((x) => x.text).filter((t) => t.trim() !== ''),
    highlight: p.highlight.trim(),
    highlightColor: p.highlightColor,
    riseAt: 0,
    pushAt: cutAt - 15,
    cutAt,
    highlightAt: frames(p.highlightAt),
    scratches: 0.8,
    durationInFrames: Math.max(cutAt + 1, frames(p.duration)),
  };
}

const form: Section[] = [
  {
    title: '文件',
    fields: [
      { kind: 'text', key: 'title', label: '标题' },
      { kind: 'text', key: 'subtitle', label: '标题下的小字', placeholder: '比如英文标题（留空不要）' },
      {
        kind: 'list', key: 'paragraphs', label: '正文', itemLabel: '段落',
        hint: '特写镜头对着第二段的中间，重点句最好放在第二段',
        fields: [{ kind: 'text', key: 'text', label: '这一段' }],
        newItem: () => ({ text: '新的一段正文' }),
      },
    ],
  },
  {
    title: '荧光笔',
    fields: [
      { kind: 'text', key: 'highlight', label: '划重点的句子', hint: '必须和正文里的某一句完全一样；跨行也可以，每行一道' },
      { kind: 'color', key: 'highlightColor', label: '荧光笔颜色' },
      { kind: 'number', key: 'highlightAt', label: '第几秒开始划', min: 0, max: 60, step: 0.1, unit: '秒' },
    ],
  },
  {
    title: '镜头和背景',
    fields: [
      { kind: 'media', key: 'background', label: '墙面背景', hint: '纸后面的墙，横版图片或视频' },
      { kind: 'number', key: 'cutAt', label: '第几秒切特写', min: 0.5, max: 60, step: 0.1, unit: '秒', hint: '纸升起来、推近，然后切到正文特写' },
      { kind: 'number', key: 'duration', label: '视频时长', min: 1, max: 60, step: 0.1, unit: '秒' },
    ],
  },
];

const snap = (t: number) => Math.round((Math.round(t * FPS) / FPS) * 100) / 100;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export const timeline: TemplateTimeline = {
  tracks: (raw) => {
    const p = raw as unknown as DocHighlightParams;
    return [
      {
        id: 'camera', label: '镜头', kind: 'camera',
        items: [
          {
            id: 'wide', label: '纸升起 · 推近', start: 0, end: p.cutAt,
            phases: [{ label: '推近', start: Math.max(0, p.cutAt - PUSH_SECONDS - 1 / FPS), end: p.cutAt }],
            select: { section: '镜头和背景' }, drag: { end: true },
          },
          { id: 'close', label: '正文特写', start: p.cutAt, end: p.duration, select: { section: '镜头和背景' }, drag: { end: true } },
        ],
      },
      {
        id: 'marker', label: '荧光笔', kind: 'element',
        items: [{
          id: 'marker', label: p.highlight || '（还没写）', start: p.highlightAt, end: p.highlightAt + MARKER_SECONDS,
          select: { section: '荧光笔' }, drag: { move: true },
        }],
      },
    ];
  },
  apply: (raw, itemId, _edge, start, end) => {
    const p = raw as unknown as DocHighlightParams;
    if (itemId === 'wide') {
      // 切的时间变了，荧光笔跟着挪，保持切过去以后多久开始划
      const cutAt = clamp(snap(end), 0.5, Math.min(60, p.duration - 0.1));
      return { ...raw, cutAt, highlightAt: clamp(snap(p.highlightAt + cutAt - p.cutAt), 0, 60) };
    }
    if (itemId === 'close') return { ...raw, duration: clamp(snap(end), p.cutAt + 0.1, 60) };
    if (itemId === 'marker') return { ...raw, highlightAt: clamp(snap(start), 0, 60) };
    return raw;
  },
};

export const meta: TemplateMeta = {
  id: 'doc-highlight',
  name: '新闻稿 · 荧光笔划重点',
  description: '旧墙上升起一张新闻稿，镜头推近后切到正文特写，黄色荧光笔划过重点句',
  origin: '复刻自一条新闻解读视频里的一个镜头，和原片的相似度 79.7%（墙面用原片画面比）',
  width: 1280,
  height: 720,
  fps: FPS,
  posterFrame: 120,
  form,
  defaultParams: defaultParams as unknown as Record<string, unknown>,
  timeline,
};
