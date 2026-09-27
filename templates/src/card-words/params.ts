import type { Section, TemplateMeta, TemplateTimeline } from '../form';
import type { CardWord, CardWordsProps } from './CardWords';

const FPS = 30;

export type CardWordsParams = {
  card: string;
  cardHeight: number;
  background: string;
  pan: boolean;
  words: CardWord[];
  dim: number;
  vignette: boolean;
  duration: number;
};

export const defaultParams: CardWordsParams = {
  card: '/template-assets/card-words/leaderboard.jpg',
  cardHeight: 460,
  background: '#efefef',
  pan: true,
  // 原片：第 176 帧卡片溶解成第一个大字，第 233 帧硬切到第二个，一共 381 帧
  words: [
    { text: '算力', media: '/template-assets/card-words/word-1.jpg', at: 5.87 },
    { text: '运算成本', media: '/template-assets/card-words/word-2.jpg', at: 7.77 },
  ],
  dim: 0.25,
  vignette: true,
  duration: 12.7,
};

const frames = (sec: number) => Math.round(sec * FPS);

/** 卡片那段最短要到推近、往下看完（第 165 帧）再溶解 */
const CARD_MIN = 1.5;

export function toProps(p: CardWordsParams): CardWordsProps {
  const hasCard = Boolean(p.card);
  const list = p.words
    .slice(0, 6)
    .map((w) => ({ text: (w.text ?? '').trim(), media: w.media ?? '', at: Number(w.at) || 0 }))
    .filter((w) => w.text || w.media)
    .sort((a, b) => a.at - b.at);
  // 不要卡片：第一个大字从头开始，后面的时间一起往前挪
  const shift = !hasCard && list.length > 0 ? list[0]!.at : 0;
  const words: CardWord[] = [];
  for (const w of list) {
    const prev = words[words.length - 1];
    const at0 = frames(w.at - shift);
    const at = prev ? Math.max(prev.at + 15, at0) : hasCard ? Math.max(frames(CARD_MIN), at0) : 0;
    words.push({ ...w, at });
  }
  const last = words[words.length - 1];
  const minEnd = last ? last.at + 15 : frames(6);
  return {
    card: p.card,
    cardHeight: Math.min(900, Math.max(240, Number(p.cardHeight) || 460)),
    background: p.background || '#efefef',
    pan: p.pan !== false,
    words,
    dim: Math.min(0.9, Math.max(0, Number(p.dim) || 0)),
    vignette: p.vignette !== false,
    durationInFrames: Math.max(minEnd, frames(p.duration - shift)),
  };
}

const form: Section[] = [
  {
    title: '截图卡片',
    fields: [
      { kind: 'image', key: 'card', label: '截图（排行榜、网页、表格都行）', hint: '留空就不要卡片这段，一开始就是大字。截图按宽 870 显示，上面对齐' },
      { kind: 'number', key: 'cardHeight', label: '卡片高度', min: 240, max: 900, step: 10, unit: '像素', half: true, hint: '宽 870 时的高度；原片 460。卡片高了，最后往下看得更多' },
      { kind: 'color', key: 'background', label: '底色', half: true },
      { kind: 'toggle', key: 'pan', label: '推近后往下看到卡片底', half: true },
    ],
  },
  {
    title: '大字',
    fields: [
      {
        kind: 'list', key: 'words', label: '大字（每个压在一段视频上，最多 6 个）', itemLabel: '大字',
        fields: [
          { kind: 'text', key: 'text', label: '字', half: true, hint: '两三个字最好看；字多了会自动缩小' },
          { kind: 'number', key: 'at', label: '第几秒出现', min: 0, max: 60, step: 0.1, unit: '秒', half: true, hint: '第一个大字：卡片从这时候开始溶解' },
          { kind: 'media', key: 'media', label: '后面垫的视频或图片' },
        ],
        newItem: (items) => ({ text: '新的字', media: '', at: Math.round((Number((items[items.length - 1] as CardWord | undefined)?.at ?? 5.87) + 2) * 10) / 10 }),
      },
      { kind: 'number', key: 'dim', label: '视频压暗', min: 0, max: 0.9, step: 0.05, half: true, hint: '0 不压暗' },
      { kind: 'toggle', key: 'vignette', label: '视频四周暗角', half: true },
    ],
  },
  {
    title: '整体',
    fields: [
      { kind: 'number', key: 'duration', label: '视频时长', min: 3, max: 60, step: 0.1, unit: '秒' },
    ],
  },
];

const snap = (t: number) => Math.round((Math.round(t * FPS) / FPS) * 100) / 100;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export const timeline: TemplateTimeline = {
  tracks: (raw) => {
    const p = raw as unknown as CardWordsParams;
    const hasCard = Boolean(p.card);
    const ws = [...p.words].sort((a, b) => a.at - b.at);
    const shift = !hasCard && ws.length > 0 ? ws[0]!.at : 0;
    const end = p.duration - shift;
    const d0 = ws.length > 0 ? ws[0]!.at - shift : end;
    return [
      {
        id: 'camera', label: '镜头', kind: 'camera',
        items: hasCard
          ? [{ id: 'card', label: '截图卡片', start: 0, end: Math.min(end, d0 + 0.5), phases: [{ label: '飞进来', start: 0, end: 1.87 }, { label: '推近', start: 1.77, end: 3.77 }, { label: '往下看', start: 3.47, end: 5.5 }, { label: '溶解', start: d0, end: d0 + 0.5 }], select: { section: '截图卡片' }, drag: {} }]
          : [],
      },
      {
        id: 'words', label: '大字', kind: 'element',
        items: ws.map((w, i) => ({
          id: `w${i}`, label: w.text || '（没有字）',
          start: w.at - shift, end: i + 1 < ws.length ? ws[i + 1]!.at - shift : end,
          select: { section: '大字' }, drag: { start: true, end: i + 1 === ws.length },
        })),
      },
    ];
  },
  apply: (raw, itemId, edge, start, end) => {
    const p = raw as unknown as CardWordsParams;
    const ws = [...p.words].sort((a, b) => a.at - b.at);
    const shift = !p.card && ws.length > 0 ? ws[0]!.at : 0;
    const m = /^w(\d+)$/.exec(itemId);
    if (!m) return raw;
    const i = Number(m[1]);
    const w = ws[i];
    if (!w) return raw;
    if (edge === 'end' && i + 1 === ws.length) return { ...raw, duration: clamp(snap(end + shift), w.at + 0.5, 60) };
    if (edge === 'start') {
      const lo = i > 0 ? ws[i - 1]!.at + 0.5 : p.card ? CARD_MIN : 0;
      const hi = i + 1 < ws.length ? ws[i + 1]!.at - 0.5 : p.duration - 0.5;
      const at = clamp(snap(start + shift), lo, hi);
      return { ...raw, words: ws.map((x, j) => (j === i ? { ...x, at } : x)) };
    }
    return raw;
  },
};

export const meta: TemplateMeta = {
  id: 'card-words',
  name: '截图卡片飞进来推近 · 网点大字压视频',
  description: '浅灰底上一张截图卡片歪着飞上来、转正，镜头推近再往下看，右边慢慢暗下来；卡片按亮度溶解掉，露出视频和一个斜体网点大字，之后一段视频一个大字硬切',
  origin: '复刻自一条讲开源大模型评测的视频，和原片的相似度 91.0%',
  width: 1280,
  height: 720,
  fps: FPS,
  posterFrame: 120,
  form,
  defaultParams: defaultParams as unknown as Record<string, unknown>,
  timeline,
};
