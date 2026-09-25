import type { Section, TemplateMeta, TemplateTimeline } from '../form';
import type { QuoteBarsProps } from './QuoteBars';

const FPS = 30;

export type QuoteBarParams = { text: string; at: number };

export type QuoteBarsParams = {
  background: string;
  name: string;
  nameEn: string;
  body: string;
  highlight: string;
  bars: QuoteBarParams[];
  duration: number;
};

export const defaultParams: QuoteBarsParams = {
  background: '',
  name: '安德烈·卡帕西',
  nameEn: 'Andrej Karpathy',
  body: '（2023年12月9日）提出了最新观点：“幻觉不是大语言模型的问题，而应该是大语言模型助手来解决。 他认为，大语言模型的工作机制就是做梦，所以幻觉是正常现象，他举两个极端的例子，一个是搜索引擎0创新，一个是生成式模型创新。 他提出了一套对大模型环境的全新的理解。 有许多方法可以减轻这些系统中的幻觉-使用。',
  highlight: '他认为，大语言模型的工作机制就是做梦，所以幻觉是正常现象，',
  // 原片：两条白条在第 146、262 帧扫出来，一共 410 帧
  bars: [
    { text: '我们通过提示来引导它们的梦想', at: 4.87 },
    { text: '当梦被认为和事实不符时，我们将其标记为“幻觉”。', at: 8.73 },
  ],
  duration: 13.67,
};

const frames = (sec: number) => Math.round(sec * FPS);
const MAX_BARS = 3;

export function toProps(p: QuoteBarsParams): QuoteBarsProps {
  return {
    background: p.background,
    name: p.name,
    nameEn: p.nameEn,
    body: p.body,
    highlight: p.body.includes(p.highlight) ? p.highlight : '',
    bars: p.bars.slice(0, MAX_BARS).filter((b) => b.text.trim()).map((b) => ({ text: b.text, at: frames(b.at) })),
    durationInFrames: Math.max(1, frames(p.duration)),
  };
}

const form: Section[] = [
  {
    title: '标题',
    fields: [
      { kind: 'text', key: 'name', label: '人名', half: true },
      { kind: 'text', key: 'nameEn', label: '英文名', half: true, placeholder: '留空不要', hint: '金色斜体，自动加括号' },
      { kind: 'media', key: 'background', label: '背景', hint: '留空就是深色网格底' },
    ],
  },
  {
    title: '引文',
    fields: [
      { kind: 'text', key: 'body', label: '一段话', hint: '四行左右最合适' },
      { kind: 'text', key: 'highlight', label: '重点句', placeholder: '留空不标', hint: '必须是上面这段话里的原话，标成淡金色、底下画线' },
    ],
  },
  {
    title: '白条金句',
    fields: [
      {
        kind: 'list', key: 'bars', label: '白条', itemLabel: '第',
        fields: [
          { kind: 'text', key: 'text', label: '一句话', hint: '最长一行，大约 24 个字' },
          { kind: 'number', key: 'at', label: '第几秒扫出来', min: 0, max: 60, step: 0.1, unit: '秒' },
        ],
        newItem: (items) => {
          const last = items[items.length - 1] as QuoteBarParams | undefined;
          return { text: '新的一句话', at: Math.round(((last?.at ?? 3) + 3) * 10) / 10 };
        },
      },
      { kind: 'number', key: 'duration', label: '视频时长', min: 1, max: 60, step: 0.1, unit: '秒' },
    ],
  },
];

const snap = (t: number) => Math.round((Math.round(t * FPS) / FPS) * 100) / 100;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export const timeline: TemplateTimeline = {
  tracks: (raw) => {
    const p = raw as unknown as QuoteBarsParams;
    return [
      {
        id: 'camera', label: '镜头', kind: 'camera',
        items: [{ id: 'cam', label: '慢慢拉远 → 推回', start: 0, end: p.duration, phases: [{ label: '标题、引文扫出来', start: 0, end: Math.min(p.duration, 1.4) }], select: { section: '标题' }, drag: { end: true } }],
      },
      {
        id: 'elements', label: '元素', kind: 'element',
        items: p.bars.slice(0, MAX_BARS).map((b, i) => ({
          id: `bar-${i}`, label: b.text, start: b.at, end: Math.min(p.duration, b.at + 1), select: { list: 'bars', index: i }, drag: { move: true },
        })),
      },
    ];
  },
  apply: (raw, itemId, _edge, start, end) => {
    const p = raw as unknown as QuoteBarsParams;
    if (itemId === 'cam') return { ...raw, duration: clamp(snap(end), 1, 60) };
    const m = /^bar-(\d+)$/.exec(itemId);
    if (m) {
      const i = Number(m[1]);
      return { ...raw, bars: p.bars.map((b, k) => (k === i ? { ...b, at: clamp(snap(start), 0, 60) } : b)) };
    }
    return raw;
  },
};

export const meta: TemplateMeta = {
  id: 'quote-bars',
  name: '人名引文 · 白条金句',
  description: '深色网格底上人名大标题和一段引文从左往右扫出来，重点句标金；之后白条金句一条条斜着扫出来，镜头先拉远再推回',
  origin: '复刻自一条讲 AI 幻觉的视频里的一个镜头，和原片的相似度 85.1%',
  width: 1280,
  height: 720,
  fps: FPS,
  posterFrame: 380,
  form,
  defaultParams: defaultParams as unknown as Record<string, unknown>,
  timeline,
};
