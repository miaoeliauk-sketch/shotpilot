import type { Section, TemplateMeta, TemplateTimeline } from '../form';
import type { ClauseTypewriterProps } from './ClauseTypewriter';

const FPS = 30;

export type ClauseTypewriterParams = {
  background: string;
  title1: string;
  title2: string;
  subtitle: string;
  body: string;
  highlight: string;
  highlightColor: string;
  titleAt: number;
  typeAt: number;
  /** 每秒打几个字 */
  typeSpeed: number;
  highlightAt: number;
  duration: number;
};

export const defaultParams: ClauseTypewriterParams = {
  background: '/template-assets/clause-typewriter/sample.jpg',
  title1: '加利福尼亚州限制竞争法“胜过”',
  title2: '《联邦保护商业秘密法》',
  subtitle: "California's competition law 'surpasses'  Federal Protection of Trade Secrets Act",
  body: '第16600条，该条规定“任何禁止他人从事任何类型的合法职业、商业或营业的合同是无效的”。法院认定本案中的不得拉拢条款——类似于加利福尼亚州最高法院认定无效的不得拉拢条款。',
  highlight: '任何禁止他人从事任何类型的合法职业、商业或营业的合同是无效的',
  highlightColor: '#d17f4c',
  // 原片：第 3 帧出标题、第 23 帧开始打字、第 76 帧划重点
  titleAt: 0.1,
  typeAt: 0.77,
  typeSpeed: 20,
  highlightAt: 2.53,
  duration: 5.2,
};

const frames = (sec: number) => Math.round(sec * FPS);

export function toProps(p: ClauseTypewriterParams): ClauseTypewriterProps {
  return {
    background: p.background,
    title1: p.title1,
    title2: p.title2,
    subtitle: p.subtitle,
    body: p.body,
    highlight: p.highlight.trim(),
    highlightColor: p.highlightColor,
    titleAt: frames(p.titleAt),
    typeAt: frames(p.typeAt),
    framesPerChar: FPS / Math.min(60, Math.max(2, p.typeSpeed)),
    highlightAt: frames(p.highlightAt),
    durationInFrames: Math.max(1, frames(p.duration)),
  };
}

/** 打完所有字要多少秒 */
export function typingSeconds(p: ClauseTypewriterParams): number {
  return Array.from(p.body).length / Math.min(60, Math.max(2, p.typeSpeed));
}

const form: Section[] = [
  {
    title: '标题',
    fields: [
      { kind: 'text', key: 'title1', label: '标题第一行' },
      { kind: 'text', key: 'title2', label: '标题第二行', placeholder: '留空就只有一行' },
      { kind: 'text', key: 'subtitle', label: '英文小字', placeholder: '留空不要' },
      { kind: 'number', key: 'titleAt', label: '第几秒出标题', min: 0, max: 60, step: 0.1, unit: '秒' },
    ],
  },
  {
    title: '条文',
    fields: [
      { kind: 'text', key: 'body', label: '正文', hint: '会一个字一个字打出来，自动换行，最好不超过三行' },
      { kind: 'text', key: 'highlight', label: '划重点的句子', hint: '必须和正文里的某一句完全一样；会加粗，后面垫一道笔刷' },
      { kind: 'color', key: 'highlightColor', label: '笔刷颜色' },
      { kind: 'number', key: 'typeAt', label: '第几秒开始打字', min: 0, max: 60, step: 0.1, unit: '秒', half: true },
      { kind: 'number', key: 'typeSpeed', label: '每秒打几个字', min: 2, max: 60, step: 1, unit: '字', half: true },
      { kind: 'number', key: 'highlightAt', label: '第几秒划重点', min: 0, max: 60, step: 0.1, unit: '秒' },
    ],
  },
  {
    title: '背景',
    fields: [
      { kind: 'media', key: 'background', label: '背景', hint: '横版图片或视频，灰一点、旧一点的照片最像原片' },
      { kind: 'number', key: 'duration', label: '视频时长', min: 1, max: 60, step: 0.1, unit: '秒' },
    ],
  },
];

const snap = (t: number) => Math.round((Math.round(t * FPS) / FPS) * 100) / 100;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export const timeline: TemplateTimeline = {
  tracks: (raw) => {
    const p = raw as unknown as ClauseTypewriterParams;
    return [
      {
        id: 'title', label: '标题', kind: 'element',
        items: [{ id: 'title', label: p.title1 || '标题', start: p.titleAt, end: p.duration, phases: [{ label: '浮现', start: p.titleAt, end: Math.min(p.duration, p.titleAt + 0.6) }], select: { section: '标题' }, drag: { move: true } }],
      },
      {
        id: 'type', label: '打字', kind: 'element',
        items: [{ id: 'type', label: '条文', start: p.typeAt, end: Math.min(p.duration, p.typeAt + typingSeconds(p)), select: { section: '条文' }, drag: { move: true, end: true } }],
      },
      {
        id: 'highlight', label: '划重点', kind: 'element',
        items: [{ id: 'highlight', label: p.highlight || '（还没写）', start: p.highlightAt, end: Math.min(p.duration, p.highlightAt + 0.9), select: { section: '条文' }, drag: { move: true } }],
      },
    ];
  },
  apply: (raw, itemId, edge, start, end) => {
    const p = raw as unknown as ClauseTypewriterParams;
    if (itemId === 'title') return { ...raw, titleAt: clamp(snap(start), 0, 60) };
    if (itemId === 'highlight') return { ...raw, highlightAt: clamp(snap(start), 0, 60) };
    if (itemId === 'type') {
      if (edge === 'end') {
        // 拖右边那头：改打字速度，让最后一个字正好在这里打完
        const secs = Math.max(0.2, end - p.typeAt);
        return { ...raw, typeSpeed: clamp(Math.round(Array.from(p.body).length / secs), 2, 60) };
      }
      return { ...raw, typeAt: clamp(snap(start), 0, 60) };
    }
    return raw;
  },
};

export const meta: TemplateMeta = {
  id: 'clause-typewriter',
  name: '条文打字 · 笔刷划重点',
  description: '老照片背景上标题从模糊里浮出来，条文一个字一个字打出来，重点句加粗、垫一道橙色笔刷',
  origin: '复刻自一条新闻解读视频里的一个镜头，和原片的相似度 84.5%（背景用原片画面比）',
  width: 1280,
  height: 720,
  fps: FPS,
  posterFrame: 140,
  form,
  defaultParams: defaultParams as unknown as Record<string, unknown>,
  timeline,
};
