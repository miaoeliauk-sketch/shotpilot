import type { Section, TemplateMeta, TemplateTimeline } from '../form';
import type { BigNumberProps } from './BigNumber';

const FPS = 30;
/** 原片开头数字已经落了 4 帧；「第几秒出现」= 0 时和原片一样 */
const NUMBER_LEAD = 4;
const NUMBER_SECONDS = 34 / FPS;
const SUFFIX_SECONDS = 40 / FPS;

export type BigNumberParams = {
  background: string;
  dim: number;
  title: string;
  subtitle: string;
  number: string;
  suffix: string;
  mainColor: string;
  lightColor: string;
  numberAt: number;
  suffixAt: number;
  duration: number;
};

export const defaultParams: BigNumberParams = {
  background: '/template-assets/big-number/sample.jpg',
  dim: 0,
  title: '前苹果员工就职 OpenAI 人数',
  subtitle: 'Number of former Apple employees employed at OpenAI',
  number: '400',
  suffix: '+',
  mainColor: '#f5a64d',
  lightColor: '#fffcc2',
  numberAt: 0,
  // 原片第 21 帧
  suffixAt: 0.7,
  duration: 4.93,
};

export function toProps(p: BigNumberParams): BigNumberProps {
  return {
    background: p.background,
    dim: Math.min(0.9, Math.max(0, p.dim / 100)),
    title: p.title,
    subtitle: p.subtitle,
    number: p.number || ' ',
    suffix: p.suffix,
    mainColor: p.mainColor,
    lightColor: p.lightColor,
    titleColor: '#fdf8f7',
    numberAt: p.numberAt * FPS - NUMBER_LEAD,
    suffixAt: p.suffixAt * FPS,
    durationInFrames: Math.max(1, Math.round(p.duration * FPS)),
  };
}

const form: Section[] = [
  {
    title: '数字',
    fields: [
      { kind: 'text', key: 'number', label: '数字', hint: '越短越好看，3–4 位最合适' },
      { kind: 'text', key: 'suffix', label: '数字后面的符号', placeholder: '比如 + 或 %（留空不要）' },
      { kind: 'number', key: 'numberAt', label: '第几秒落下', min: 0, max: 60, step: 0.1, unit: '秒', half: true },
      { kind: 'number', key: 'suffixAt', label: '符号第几秒出来', min: 0, max: 60, step: 0.1, unit: '秒', half: true, enabledWhen: (v) => Boolean(v.suffix) },
      { kind: 'color', key: 'mainColor', label: '主色', hint: '数字四周和外发光的颜色', half: true },
      { kind: 'color', key: 'lightColor', label: '高光色', hint: '数字中间亮的那一块', half: true },
    ],
  },
  {
    title: '标题',
    fields: [
      { kind: 'text', key: 'title', label: '顶部标题' },
      { kind: 'text', key: 'subtitle', label: '标题下的小字', placeholder: '比如英文翻译（留空不要）' },
    ],
  },
  {
    title: '背景',
    fields: [
      { kind: 'media', key: 'background', label: '背景', hint: '横版图片或视频。原片是一段压暗的敲键盘视频' },
      { kind: 'number', key: 'dim', label: '背景压暗', min: 0, max: 90, step: 5, unit: '%', hint: '背景太亮时调高，数字更显眼' },
      { kind: 'number', key: 'duration', label: '视频时长', min: 1, max: 60, step: 0.1, unit: '秒' },
    ],
  },
];

const snap = (t: number) => Math.round((Math.round(t * FPS) / FPS) * 100) / 100;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export const timeline: TemplateTimeline = {
  tracks: (raw) => {
    const p = raw as unknown as BigNumberParams;
    const items = [{
      id: 'number', label: `数字 ${p.number}`, start: p.numberAt, end: p.duration,
      phases: [{ label: '落下', start: p.numberAt, end: Math.min(p.duration, p.numberAt + NUMBER_SECONDS - NUMBER_LEAD / FPS) }],
      select: { section: '数字' }, drag: { move: true, end: true },
    }];
    const tracks = [{ id: 'number', label: '数字', kind: 'element' as const, items }];
    if (p.suffix) {
      tracks.push({
        id: 'suffix', label: '符号', kind: 'element' as const,
        items: [{
          id: 'suffix', label: `符号 ${p.suffix}`, start: p.suffixAt, end: p.duration,
          phases: [{ label: '出现', start: p.suffixAt, end: Math.min(p.duration, p.suffixAt + SUFFIX_SECONDS) }],
          select: { section: '数字' }, drag: { move: true, end: true },
        }],
      });
    }
    return tracks;
  },
  apply: (raw, itemId, edge, start, end) => {
    const p = raw as unknown as BigNumberParams;
    if (edge === 'end') return { ...raw, duration: clamp(snap(end), 1, 60) };
    if (itemId === 'number') return { ...raw, numberAt: clamp(snap(start), 0, Math.max(0, p.duration - 0.5)) };
    if (itemId === 'suffix') return { ...raw, suffixAt: clamp(snap(start), 0, Math.max(0, p.duration - 0.1)) };
    return raw;
  },
};

export const meta: TemplateMeta = {
  id: 'big-number',
  name: '金色发光大数字',
  description: '金色大数字从上方落下、由虚变实，加号随后弹出，整组居中；顶部一行标题，背景可以放视频',
  origin: '复刻自一条新闻解读视频里的一个数字镜头，和原片的相似度 90.3%（背景用原片画面比）',
  width: 1280,
  height: 720,
  fps: FPS,
  posterFrame: 60,
  form,
  defaultParams: defaultParams as unknown as Record<string, unknown>,
  timeline,
};
