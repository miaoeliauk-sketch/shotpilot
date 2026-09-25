import type { Section, TemplateMeta, TemplateTimeline } from '../form';
import type { VerdictParagraph, VerdictTitleProps } from './VerdictTitle';

const FPS = 30;

export type VerdictTitleParams = {
  background: string;
  title1: string;
  title2: string;
  english: string;
  paragraphs: VerdictParagraph[];
  gold: string;
  titleAt: number;
  typeAt: number;
  /** 每秒打几个字 */
  typeSpeed: number;
  arcAt: number;
  duration: number;
};

export const defaultParams: VerdictTitleParams = {
  background: '/template-assets/verdict-title/sample.jpg',
  title1: '维持原判:苹果因 Apple Watch 专利侵权',
  title2: '需赔 Masimo 约 6.34 亿美元',
  english: 'Original verdict upheld: Apple to pay Masimo approximately $634 million for Apple Watch patent infringement',
  paragraphs: [
    {
      text: '美国加州中区联邦地区法院法官詹姆斯·塞尔纳（James V. Selna）于当地时间 7 月 20 日作出裁决，驳回苹果公司要求推翻陪审团此前裁定的 6.34 亿美元（注：现汇率约合 42.97亿元人民币）专利侵权赔偿的请求，同时拒绝了苹果提出的重审动议。',
      highlight: '于当地时间 7 月 20 日作出裁决，驳回苹果公司要求推翻陪审团此前裁定的 6.34 亿美元',
    },
    {
      text: '该案的根源可追溯至 2020 年初，当时 Masimo 公司起诉苹果，指控其窃取与脉搏血氧测定法及其他光学健康监测技术相关的商业机密，并侵犯了相关专利。此后，双方的诉讼战不断升级。',
      highlight: '当时 Masimo 公司起诉苹果，指控其窃取与脉搏血氧测定法及其他光学健康监测技术相关的商业机密，并侵犯了相关专利。',
    },
  ],
  gold: '#fdcb41',
  // 原片：第 0 帧标题开始、第 19 帧开始打字、第 74 帧右边弧线亮起
  titleAt: 0,
  typeAt: 0.63,
  typeSpeed: 135,
  arcAt: 2.47,
  duration: 4.3,
};

const frames = (sec: number) => Math.round(sec * FPS);

export function toProps(p: VerdictTitleParams): VerdictTitleProps {
  return {
    background: p.background,
    title1: p.title1,
    title2: p.title2,
    english: p.english,
    paragraphs: p.paragraphs.filter((x) => x.text.trim() !== ''),
    gold: p.gold,
    titleAt: frames(p.titleAt),
    typeAt: frames(p.typeAt),
    charsPerFrame: Math.min(20, Math.max(0.1, p.typeSpeed / FPS)),
    arcAt: frames(p.arcAt),
    durationInFrames: Math.max(1, frames(p.duration)),
  };
}

export function typingSeconds(p: VerdictTitleParams): number {
  const chars = p.paragraphs.reduce((n, x) => n + Array.from(x.text).length, 0);
  return chars / Math.max(1, p.typeSpeed) + (Math.max(0, p.paragraphs.length - 1) * 3) / FPS;
}

const form: Section[] = [
  {
    title: '标题',
    fields: [
      { kind: 'text', key: 'title1', label: '第一行（白）' },
      { kind: 'text', key: 'title2', label: '第二行（金）' },
      { kind: 'text', key: 'english', label: '英文小字', placeholder: '留空不要' },
      { kind: 'color', key: 'gold', label: '金色', hint: '第二行标题、弧线和正文重点都用它' },
      { kind: 'number', key: 'titleAt', label: '第几秒出标题', min: 0, max: 60, step: 0.1, unit: '秒' },
    ],
  },
  {
    title: '正文',
    fields: [
      {
        kind: 'list', key: 'paragraphs', label: '段落', itemLabel: '段落',
        hint: '一段接一段打出来。两段、每段两三行最合适',
        fields: [
          { kind: 'text', key: 'text', label: '这一段' },
          { kind: 'text', key: 'highlight', label: '重点句', placeholder: '留空不标', hint: '必须和这一段里的某一句完全一样；会加粗、变金色' },
        ],
        newItem: () => ({ text: '新的一段正文', highlight: '' }),
      },
      { kind: 'number', key: 'typeAt', label: '第几秒开始打字', min: 0, max: 60, step: 0.1, unit: '秒', half: true },
      { kind: 'number', key: 'typeSpeed', label: '每秒打几个字', min: 5, max: 300, step: 5, unit: '字', half: true },
    ],
  },
  {
    title: '背景',
    fields: [
      { kind: 'media', key: 'background', label: '背景', hint: '深色的图或视频' },
      { kind: 'number', key: 'arcAt', label: '第几秒亮起弧线', min: 0, max: 60, step: 0.1, unit: '秒' },
      { kind: 'number', key: 'duration', label: '视频时长', min: 1, max: 60, step: 0.1, unit: '秒' },
    ],
  },
];

const snap = (t: number) => Math.round((Math.round(t * FPS) / FPS) * 100) / 100;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export const timeline: TemplateTimeline = {
  tracks: (raw) => {
    const p = raw as unknown as VerdictTitleParams;
    return [
      { id: 'title', label: '标题', kind: 'element', items: [{ id: 'title', label: p.title1 || '标题', start: p.titleAt, end: p.duration, phases: [{ label: '闪出', start: p.titleAt, end: Math.min(p.duration, p.titleAt + 0.55) }], select: { section: '标题' }, drag: { move: true, end: true } }] },
      { id: 'type', label: '正文', kind: 'element', items: [{ id: 'type', label: '打字', start: p.typeAt, end: Math.min(p.duration, p.typeAt + typingSeconds(p)), select: { section: '正文' }, drag: { move: true, end: true } }] },
      { id: 'arc', label: '弧线', kind: 'element', items: [{ id: 'arc', label: '金色弧线亮起', start: p.arcAt, end: Math.min(p.duration, p.arcAt + 0.4), select: { section: '背景' }, drag: { move: true } }] },
    ];
  },
  apply: (raw, itemId, edge, start, end) => {
    const p = raw as unknown as VerdictTitleParams;
    if (itemId === 'title') {
      if (edge === 'end') return { ...raw, duration: clamp(snap(end), 1, 60) };
      return { ...raw, titleAt: clamp(snap(start), 0, 60) };
    }
    if (itemId === 'type') {
      if (edge === 'end') {
        const chars = p.paragraphs.reduce((n, x) => n + Array.from(x.text).length, 0);
        const secs = Math.max(0.2, end - p.typeAt - (Math.max(0, p.paragraphs.length - 1) * 3) / FPS);
        return { ...raw, typeSpeed: clamp(Math.round(chars / secs / 5) * 5, 5, 300) };
      }
      return { ...raw, typeAt: clamp(snap(start), 0, 60) };
    }
    if (itemId === 'arc') return { ...raw, arcAt: clamp(snap(start), 0, 60) };
    return raw;
  },
};

export const meta: TemplateMeta = {
  id: 'verdict-title',
  name: '深色判决标题 · 正文打字',
  description: '深色背景上白金两行标题闪出来、字距慢慢松开，一道金色弧线，下面两段正文快速打出来，重点句变金',
  origin: '复刻自一条新闻解读视频里的一个镜头，和原片的相似度 80.7%',
  width: 1280,
  height: 720,
  fps: FPS,
  posterFrame: 110,
  form,
  defaultParams: defaultParams as unknown as Record<string, unknown>,
  timeline,
};
