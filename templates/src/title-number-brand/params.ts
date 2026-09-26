import type { Section, TemplateMeta, TemplateTimeline } from '../form';
import type { TitleNumberBrandProps } from './TitleNumberBrand';

const FPS = 30;

export type TitleNumberBrandParams = {
  aroll: string;
  top: string;
  mid: string;
  big: string;
  side: string;
  number: string;
  unit: string;
  unitSub: string;
  note: string;
  script: string;
  brand: string;
  accent: string;
  backText: string;
  moonA: string;
  moonB: string;
  numberAt: number;
  brandAt: number;
  brandEnd: number;
  duration: number;
};

export const defaultParams: TitleNumberBrandParams = {
  // 口播画面（A-roll）默认不放：开头的大标题直接出现在深色底上；放了就垫在标题下面，品牌名之后再切回来
  aroll: '',
  top: '地球上',
  mid: '参数最',
  big: '大',
  side: '开源模型',
  number: '28000',
  unit: '亿',
  unitSub: '个参数',
  note: '*大语言模型（LLM）内部的\n权重和偏置',
  script: 'Weights',
  brand: 'KIMI',
  accent: 'K3',
  backText: '月之暗面',
  moonA: '/template-assets/title-number-brand/moon.png',
  moonB: '/template-assets/title-number-brand/moon.png',
  // 原片：第 100 帧换成数字、第 173 帧切到品牌名、第 298 帧回到口播
  numberAt: 3.33,
  brandAt: 5.77,
  brandEnd: 9.93,
  duration: 10,
};

const frames = (sec: number) => Math.round(sec * FPS);

export function toProps(p: TitleNumberBrandParams): TitleNumberBrandProps {
  const t = (s: string | undefined) => (s ?? '').trim();
  const top = t(p.top);
  const mid = t(p.mid);
  const big = t(p.big);
  const side = t(p.side);
  // 标题四个字都空着：不要开头那段，直接从数字开始，后面的时间一起往前挪
  const shift = top || mid || big || side ? 0 : frames(p.numberAt);
  const numberAt = frames(p.numberAt) - shift;
  const brandAt = Math.max(numberAt + 30, frames(p.brandAt) - shift);
  const brandEnd = Math.max(brandAt + 60, frames(p.brandEnd) - shift);
  return {
    aroll: p.aroll ?? '',
    top, mid, big, side,
    number: t(p.number),
    unit: t(p.unit),
    unitSub: t(p.unitSub),
    note: (p.note ?? '').split('\n').map((l) => l.trim()).filter(Boolean).slice(0, 2).join('\n'),
    script: t(p.script),
    brand: t(p.brand),
    accent: t(p.accent),
    backText: t(p.backText),
    moonA: p.moonA,
    moonB: p.moonB,
    numberAt,
    brandAt,
    brandEnd,
    // 最短放到品牌名结束；放了口播画面，可以拉长让口播接着放
    durationInFrames: Math.max(brandEnd + 2, frames(p.duration) - shift),
  };
}

const form: Section[] = [
  {
    title: '口播画面',
    fields: [
      { kind: 'media', key: 'aroll', label: '口播画面（A-roll，可以不放）', hint: '留空：开头的大标题直接出现在深色底上，接着就是数字和品牌名。放了：标题垫在口播上面，品牌名之后切回口播' },
      { kind: 'number', key: 'duration', label: '视频时长', min: 3, max: 60, step: 0.1, unit: '秒', hint: '最短到品牌名结束；放了口播画面可以拉长，后面接着放口播' },
    ],
  },
  {
    title: '开头大标题',
    fields: [
      { kind: 'text', key: 'top', label: '第一行（一个字一个字蹦出来）', half: true, placeholder: '留空不要' },
      { kind: 'text', key: 'mid', label: '第二行小字', half: true, placeholder: '留空不要' },
      { kind: 'text', key: 'big', label: '左下大字（青色）', half: true, placeholder: '留空不要' },
      { kind: 'text', key: 'side', label: '右边竖长的字', half: true, placeholder: '留空不要' },
    ],
  },
  {
    title: '超大数字',
    fields: [
      { kind: 'text', key: 'number', label: '数字', half: true },
      { kind: 'text', key: 'unit', label: '单位大字', half: true, placeholder: '留空不要' },
      { kind: 'text', key: 'unitSub', label: '单位后面的小字', half: true, placeholder: '留空不要' },
      { kind: 'text', key: 'script', label: '手写体英文', half: true, placeholder: '留空不要' },
      { kind: 'text', key: 'note', label: '注释（最多两行，换行分开）', placeholder: '留空不要' },
      { kind: 'number', key: 'numberAt', label: '第几秒换成数字', min: 0, max: 60, step: 0.1, unit: '秒', hint: '开头大标题四处都留空时，一开始就是数字' },
    ],
  },
  {
    title: '品牌名',
    fields: [
      { kind: 'text', key: 'brand', label: '品牌名（白色）', half: true },
      { kind: 'text', key: 'accent', label: '后半截（蓝色发光）', half: true, placeholder: '留空不要' },
      { kind: 'text', key: 'backText', label: '背后很淡的大字', placeholder: '留空不要' },
      { kind: 'image', key: 'moonA', label: '右上的圆形图', half: true, hint: '原片是月亮，透明底的圆形 png' },
      { kind: 'image', key: 'moonB', label: '左下的圆形图', half: true },
      { kind: 'number', key: 'brandAt', label: '第几秒切到品牌名', min: 0, max: 60, step: 0.1, unit: '秒', half: true },
      { kind: 'number', key: 'brandEnd', label: '第几秒结束', min: 0, max: 60, step: 0.1, unit: '秒', half: true, hint: '结束前 0.9 秒镜头推近' },
    ],
  },
];

const snap = (t: number) => Math.round((Math.round(t * FPS) / FPS) * 100) / 100;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export const timeline: TemplateTimeline = {
  tracks: (raw) => {
    const p = raw as unknown as TitleNumberBrandParams;
    const hasTitle = Boolean((p.top + p.mid + p.big + p.side).trim());
    const shift = hasTitle ? 0 : p.numberAt;
    const n = p.numberAt - shift;
    const b = p.brandAt - shift;
    const e = p.brandEnd - shift;
    const end = Math.max(e + 2 / FPS, p.duration - shift);
    return [
      {
        id: 'camera', label: '镜头', kind: 'camera',
        items: [
          ...(hasTitle ? [{ id: 'title', label: '大标题', start: 0, end: n, phases: [{ label: '拉远', start: 0, end: 2 }], select: { section: '开头大标题' }, drag: {} }] : []),
          { id: 'number', label: `${p.number}${p.unit}`, start: n, end: b, phases: [{ label: '缩回来', start: n, end: n + 0.63 }], select: { section: '超大数字' }, drag: { start: hasTitle } },
          { id: 'brand', label: `${p.brand}${p.accent ? ` · ${p.accent}` : ''}`, start: b, end: e, phases: [{ label: '从虚到实', start: b, end: b + 1.57 }, { label: '推近', start: e - 0.92, end: e }], select: { section: '品牌名' }, drag: { start: true, end: true } },
          ...(p.aroll && end > e + 0.1 ? [{ id: 'outro', label: '回到口播', start: e, end, select: { section: '口播画面' }, drag: { end: true } }] : []),
        ],
      },
    ];
  },
  apply: (raw, itemId, edge, start, end) => {
    const p = raw as unknown as TitleNumberBrandParams;
    const hasTitle = Boolean((p.top + p.mid + p.big + p.side).trim());
    const shift = hasTitle ? 0 : p.numberAt;
    if (itemId === 'number' && edge === 'start') return { ...raw, numberAt: clamp(snap(start), 0.5, p.brandAt - 1) };
    if (itemId === 'brand') {
      if (edge === 'start') return { ...raw, brandAt: clamp(snap(start + shift), p.numberAt + 1, p.brandEnd - 2) };
      if (edge === 'end') {
        const brandEnd = clamp(snap(end + shift), p.brandAt + 2, 60);
        return { ...raw, brandEnd, duration: Math.max(p.duration, brandEnd + 0.07) };
      }
    }
    if (itemId === 'outro') return { ...raw, duration: clamp(snap(end + shift), p.brandEnd + 0.07, 60) };
    return raw;
  },
};

export const meta: TemplateMeta = {
  id: 'title-number-brand',
  name: '开场大标题 · 超大数字 · 发光品牌名',
  description: '开头一组斑驳的大标题（可以垫口播画面，也可以不垫，直接出现在深色底上）→ 深蓝底上一串超大数字一位接一位缩回来、后面跟单位和注释 → 黑底两个月亮、背后一排淡淡的大字，中间的品牌名从虚到实',
  origin: '复刻自一条讲开源大模型发布的视频，和原片的相似度 89.4%',
  width: 1280,
  height: 720,
  fps: FPS,
  posterFrame: 250,
  form,
  defaultParams: defaultParams as unknown as Record<string, unknown>,
  timeline,
};
