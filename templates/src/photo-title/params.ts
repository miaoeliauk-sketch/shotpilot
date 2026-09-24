import type { Section, TemplateMeta, TemplateTimeline } from '../form';
import type { PhotoTitleProps } from './PhotoTitle';

const FPS = 30;
/** 标题从开始到全部出齐大约 1.2 秒 */
const TITLE_SECONDS = 36 / FPS;

export type PhotoTitleParams = {
  photo1: string;
  photo2: string;
  grayscale: boolean;
  lead: string;
  word1: string;
  connector: string;
  word2: string;
  english1: string;
  english2: string;
  flashAt: number;
  titleAt: number;
  duration: number;
};

export const defaultParams: PhotoTitleParams = {
  photo1: '/template-assets/photo-title/sample-1.jpg',
  photo2: '/template-assets/photo-title/sample-2.jpg',
  grayscale: true,
  lead: '苹果的',
  word1: '偷',
  connector: '和',
  word2: '被偷',
  english1: 'Stealing',
  english2: 'The Apples',
  // 原片第 46 帧最亮、第 56 帧标题开始
  flashAt: 1.53,
  titleAt: 1.87,
  duration: 6.53,
};

export function toProps(p: PhotoTitleParams): PhotoTitleProps {
  const flashAt = Math.max(4, Math.round(p.flashAt * FPS));
  return {
    photo1: p.photo1,
    photo2: p.photo2,
    grayscale: p.grayscale,
    lead: p.lead,
    word1: p.word1,
    connector: p.connector,
    word2: p.word2,
    english1: p.english1,
    english2: p.english2,
    flashAt,
    titleAt: Math.max(flashAt + 2, Math.round(p.titleAt * FPS)),
    durationInFrames: Math.max(flashAt + 10, Math.round(p.duration * FPS)),
  };
}

const form: Section[] = [
  {
    title: '标题',
    fields: [
      { kind: 'text', key: 'lead', label: '左上的小字', placeholder: '比如：苹果的' },
      { kind: 'text', key: 'word1', label: '主词', hint: '一个字最好，会加宽加粗，故障闪现', half: true },
      { kind: 'text', key: 'connector', label: '连接的字', hint: '比如：和', half: true },
      { kind: 'text', key: 'word2', label: '括号里的词', hint: '两个字最好，一个字一个字出来' },
      { kind: 'text', key: 'english1', label: '英文第一行', half: true },
      { kind: 'text', key: 'english2', label: '英文第二行', half: true },
      { kind: 'number', key: 'titleAt', label: '第几秒出标题', min: 0, max: 60, step: 0.1, unit: '秒' },
    ],
  },
  {
    title: '照片',
    fields: [
      { kind: 'media', key: 'photo1', label: '开场照片', hint: '闪白之前那一张' },
      { kind: 'media', key: 'photo2', label: '标题背景', hint: '闪白之后那一张，右半边留给主体，左边放字' },
      { kind: 'toggle', key: 'grayscale', label: '变成黑白', hint: '原片是黑白老照片的感觉' },
      { kind: 'number', key: 'flashAt', label: '第几秒闪白切换', min: 0.2, max: 60, step: 0.1, unit: '秒' },
      { kind: 'number', key: 'duration', label: '视频时长', min: 1, max: 60, step: 0.1, unit: '秒' },
    ],
  },
];

const snap = (t: number) => Math.round((Math.round(t * FPS) / FPS) * 100) / 100;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export const timeline: TemplateTimeline = {
  tracks: (raw) => {
    const p = raw as unknown as PhotoTitleParams;
    return [
      {
        id: 'camera', label: '镜头', kind: 'camera',
        items: [
          { id: 'photo1', label: '开场照片', start: 0, end: p.flashAt, select: { section: '照片' }, drag: { end: true } },
          { id: 'photo2', label: '标题背景', start: p.flashAt, end: p.duration, select: { section: '照片' }, drag: { end: true } },
        ],
      },
      {
        id: 'title', label: '标题', kind: 'element',
        items: [{
          id: 'title', label: `${p.lead}${p.word1}${p.connector}${p.word2}`, start: p.titleAt, end: p.duration,
          phases: [{ label: '逐个出现', start: p.titleAt, end: Math.min(p.duration, p.titleAt + TITLE_SECONDS) }],
          select: { section: '标题' }, drag: { move: true },
        }],
      },
    ];
  },
  apply: (raw, itemId, _edge, start, end) => {
    const p = raw as unknown as PhotoTitleParams;
    if (itemId === 'photo1') {
      // 闪白挪了，标题跟着挪，保持切过去以后多久出字
      const flashAt = clamp(snap(end), 0.2, p.duration - 0.2);
      return { ...raw, flashAt, titleAt: clamp(snap(p.titleAt + flashAt - p.flashAt), 0, 60) };
    }
    if (itemId === 'photo2') return { ...raw, duration: clamp(snap(end), p.flashAt + 0.4, 60) };
    if (itemId === 'title') return { ...raw, titleAt: clamp(snap(start), p.flashAt, 60) };
    return raw;
  },
};

export const meta: TemplateMeta = {
  id: 'photo-title',
  name: '闪白切换 · 竖排大字标题',
  description: '黑白照片闪白切到第二张，左边一组大字标题逐个出现：主词故障闪现，其余带拖影淡入，底下画一条细线',
  origin: '复刻自一条新闻解读视频的开场，和原片的相似度 82.8%（照片用原片画面比）',
  width: 1280,
  height: 720,
  fps: FPS,
  posterFrame: 150,
  form,
  defaultParams: defaultParams as unknown as Record<string, unknown>,
  timeline,
};
