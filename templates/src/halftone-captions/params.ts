import type { Section, TemplateMeta, TemplateTimeline } from '../form';
import type { Caption, HalftoneCaptionsProps } from './HalftoneCaptions';

const FPS = 30;

export type HalftoneCaptionsParams = {
  captions: Caption[];
  dim: number;
  vignette: boolean;
  duration: number;
};

export const defaultParams: HalftoneCaptionsParams = {
  // 原片：第一个字从头开始（第 4–20 帧淡进来），第 45、67 帧硬切换字，一共 172 帧
  captions: [
    { text: '前沿工程', english: 'Frontier Engineering', media: '/template-assets/halftone-captions/bg-1.jpg', at: 0 },
    { text: '依赖推理', english: 'Dependency reasoning', media: '/template-assets/halftone-captions/bg-2.jpg', at: 1.5 },
    { text: '专业知识', english: 'professional knowledge', media: '/template-assets/halftone-captions/bg-3.jpg', at: 2.23 },
  ],
  dim: 0.3,
  vignette: true,
  duration: 5.73,
};

const frames = (sec: number) => Math.round(sec * FPS);

export function toProps(p: HalftoneCaptionsParams): HalftoneCaptionsProps {
  const list = p.captions
    .slice(0, 8)
    .map((c) => ({ text: (c.text ?? '').trim(), english: (c.english ?? '').trim(), media: c.media ?? '', at: Number(c.at) || 0 }))
    .filter((c) => c.text || c.english || c.media)
    .sort((a, b) => a.at - b.at);
  // 第一个字从头开始，后面的时间一起往前挪；两段至少隔半秒
  const shift = list.length > 0 ? list[0]!.at : 0;
  const captions: Caption[] = [];
  for (const c of list) {
    const prev = captions[captions.length - 1];
    const at = prev ? Math.max(prev.at + 15, frames(c.at - shift)) : 0;
    captions.push({ ...c, at });
  }
  const last = captions[captions.length - 1];
  return {
    captions,
    dim: Math.min(0.9, Math.max(0, Number(p.dim) || 0)),
    vignette: p.vignette !== false,
    durationInFrames: Math.max(last ? last.at + 15 : frames(2), frames(p.duration - shift)),
  };
}

const form: Section[] = [
  {
    title: '大字',
    fields: [
      {
        kind: 'list', key: 'captions', label: '每段一个大字（最多 8 段）', itemLabel: '段',
        fields: [
          { kind: 'text', key: 'text', label: '大字', half: true, hint: '四个字最好看；字多了会自动缩小' },
          { kind: 'text', key: 'english', label: '下面的英文小字', half: true, placeholder: '留空不要' },
          { kind: 'number', key: 'at', label: '第几秒切到这段', min: 0, max: 60, step: 0.1, unit: '秒', hint: '第一段从头开始，字会淡进来；后面的段一切就换字' },
          { kind: 'media', key: 'media', label: '这段垫的视频或图片', hint: '模板只管字，视频用你自己的；留空就是黑底' },
        ],
        newItem: (items) => ({ text: '新的字', english: '', media: '', at: Math.round((Number((items[items.length - 1] as Caption | undefined)?.at ?? 0) + 1.5) * 10) / 10 }),
      },
    ],
  },
  {
    title: '视频',
    fields: [
      { kind: 'number', key: 'dim', label: '视频压暗', min: 0, max: 0.9, step: 0.05, half: true, hint: '0 不压暗；原片的视频本来就很暗' },
      { kind: 'toggle', key: 'vignette', label: '四周暗角', half: true },
      { kind: 'number', key: 'duration', label: '视频时长', min: 1, max: 60, step: 0.1, unit: '秒' },
    ],
  },
];

const snap = (t: number) => Math.round((Math.round(t * FPS) / FPS) * 100) / 100;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export const timeline: TemplateTimeline = {
  tracks: (raw) => {
    const p = raw as unknown as HalftoneCaptionsParams;
    const cs = [...p.captions].sort((a, b) => a.at - b.at);
    const shift = cs.length > 0 ? cs[0]!.at : 0;
    const end = p.duration - shift;
    return [
      {
        id: 'captions', label: '大字', kind: 'element',
        items: cs.map((c, i) => ({
          id: `c${i}`, label: c.text || c.english || '（没有字）',
          start: c.at - shift, end: i + 1 < cs.length ? cs[i + 1]!.at - shift : end,
          phases: i === 0 ? [{ label: '淡进来', start: 0.13, end: 0.67 }] : undefined,
          select: { section: '大字' }, drag: { start: i > 0, end: i + 1 === cs.length },
        })),
      },
    ];
  },
  apply: (raw, itemId, edge, start, end) => {
    const p = raw as unknown as HalftoneCaptionsParams;
    const cs = [...p.captions].sort((a, b) => a.at - b.at);
    const shift = cs.length > 0 ? cs[0]!.at : 0;
    const m = /^c(\d+)$/.exec(itemId);
    if (!m) return raw;
    const i = Number(m[1]);
    const c = cs[i];
    if (!c) return raw;
    if (edge === 'end' && i + 1 === cs.length) return { ...raw, duration: clamp(snap(end + shift), c.at + 0.5, 60) };
    if (edge === 'start' && i > 0) {
      const lo = cs[i - 1]!.at + 0.5;
      const hi = i + 1 < cs.length ? cs[i + 1]!.at - 0.5 : p.duration - 0.5;
      const at = clamp(snap(start + shift), lo, hi);
      return { ...raw, captions: cs.map((x, j) => (j === i ? { ...x, at } : x)) };
    }
    return raw;
  },
};

export const meta: TemplateMeta = {
  id: 'halftone-captions',
  name: '视频上的网点大字 · 英文小字',
  description: '一段段视频上压一个斜体网点大字、下面一行英文小字；第一个字淡进来（英文字母一个个冒出来），之后跟着视频一切就换下一个字。只做字，视频用你自己的',
  origin: '复刻自一条讲大模型能力的视频里的一组字幕镜头，和原片的相似度 92.9%',
  width: 1280,
  height: 720,
  fps: FPS,
  posterFrame: 30,
  form,
  defaultParams: defaultParams as unknown as Record<string, unknown>,
  timeline,
};
