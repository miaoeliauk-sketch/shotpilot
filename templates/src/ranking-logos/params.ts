import type { Section, TemplateMeta, TemplateTimeline } from '../form';
import type { LogoCard, RankingLogosProps, RankRow } from './RankingLogos';

const FPS = 30;

type LogoParams = { image: string; name: string; layout: LogoCard['layout']; bg: LogoCard['bg']; seconds: number };

export type RankingLogosParams = {
  title: string;
  highlight: string;
  rest: string;
  rows: RankRow[];
  pushAt: number;
  logos: LogoParams[];
};

const A = '/template-assets/ranking-logos';

export const defaultParams: RankingLogosParams = {
  title: 'Frontend Code Arena',
  highlight: 'Model-A:',
  rest: 'Ranked #1',
  rows: [
    { name: 'Model-A', score: 1679, icon: '' },
    { name: 'Model B Pro', score: 1668, icon: '' },
    { name: 'Model C (xHigh)', score: 1661, icon: '' },
    { name: 'Model D (Max)', score: 1597, icon: '' },
    { name: 'Model E (Thinking)', score: 1562, icon: '' },
    { name: 'Model F', score: 1556, icon: '' },
    { name: 'Model G (Thinking)', score: 1556, icon: '' },
    { name: 'Model H', score: 1550, icon: '' },
  ],
  // 原片（去掉开头的口播之后）：第 59 帧往下推走
  pushAt: 1.97,
  logos: [
    { image: `${A}/logo-star.png`, name: '星河问答', layout: 'row', bg: 'paper', seconds: 0.53 },
    { image: `${A}/logo-leaf.png`, name: '青叶助手', layout: 'column', bg: 'paper', seconds: 0.63 },
    { image: `${A}/logo-rings.png`, name: '环宇智能', layout: 'column', bg: 'blue', seconds: 0.8 },
    { image: `${A}/logo-wave.png`, name: 'wavely', layout: 'column', bg: 'paper', seconds: 0.8 },
    { image: `${A}/logo-word.png`, name: '', layout: 'image', bg: 'dark', seconds: 0.8 },
  ],
};

const frames = (sec: number) => Math.round(sec * FPS);

export function toProps(p: RankingLogosParams): RankingLogosProps {
  const logos = p.logos.slice(0, 8).map((l) => ({ image: l.image, name: l.name.trim(), layout: l.layout, bg: l.bg, frames: Math.max(6, frames(l.seconds)) }));
  const pushAt = Math.max(20, frames(p.pushAt));
  const end = logos.length ? pushAt + 12 + logos.reduce((s, l) => s + l.frames, 0) : pushAt + 20;
  return {
    title: p.title.trim(),
    highlight: p.highlight.trim(),
    rest: p.rest.trim(),
    rows: p.rows.slice(0, 8).map((r) => ({ name: r.name.trim(), score: Number(r.score) || 0, icon: r.icon })),
    logos,
    pushAt,
    durationInFrames: end,
  };
}

const LAYOUTS = [{ value: 'column', label: '图在上、字在下' }, { value: 'row', label: '图在左、字在右' }, { value: 'image', label: '只放图' }];
const BGS = [{ value: 'paper', label: '方格纸' }, { value: 'blue', label: '蓝色' }, { value: 'dark', label: '深色 + 发光线' }];

const form: Section[] = [
  {
    title: '排行榜',
    fields: [
      { kind: 'text', key: 'title', label: '第一行标题' },
      { kind: 'text', key: 'highlight', label: '第二行黄底斜体', half: true, placeholder: '留空不要' },
      { kind: 'text', key: 'rest', label: '第二行后面', half: true, placeholder: '留空不要' },
      {
        kind: 'list', key: 'rows', label: '名次（最多 8 行，从第一名往下）', itemLabel: '第',
        fields: [
          { kind: 'text', key: 'name', label: '名字', half: true },
          { kind: 'number', key: 'score', label: '分数', min: 0, max: 100000, step: 1, half: true },
          { kind: 'image', key: 'icon', label: '图标', hint: '不放就显示名字首字母的小方块' },
        ],
        newItem: (items) => ({ name: '新模型', score: Number((items[items.length - 1] as RankRow | undefined)?.score ?? 1500) - 10, icon: '' }),
      },
      { kind: 'number', key: 'pushAt', label: '第几秒推走、换 logo', min: 0.7, max: 60, step: 0.1, unit: '秒' },
    ],
  },
  {
    title: 'logo 快切',
    fields: [
      {
        kind: 'list', key: 'logos', label: 'logo（最多 8 个，一个接一个硬切）', itemLabel: 'logo',
        fields: [
          { kind: 'image', key: 'image', label: '图' },
          { kind: 'text', key: 'name', label: '名字', half: true, placeholder: '留空不要' },
          { kind: 'number', key: 'seconds', label: '停几秒', min: 0.2, max: 10, step: 0.05, unit: '秒', half: true },
          { kind: 'select', key: 'layout', label: '排法', half: true, options: LAYOUTS },
          { kind: 'select', key: 'bg', label: '背景', half: true, options: BGS },
        ],
        newItem: () => ({ image: `${A}/logo-leaf.png`, name: '新产品', layout: 'column', bg: 'paper', seconds: 0.8 }),
      },
    ],
  },
];

const snap = (t: number) => Math.round((Math.round(t * FPS) / FPS) * 100) / 100;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export const timeline: TemplateTimeline = {
  tracks: (raw) => {
    const p = raw as unknown as RankingLogosParams;
    let t = p.pushAt + 12 / FPS;
    const logoItems = p.logos.slice(0, 8).map((l, i) => {
      const start = t;
      t += l.seconds;
      return { id: `logo-${i}`, label: l.name || `logo ${i + 1}`, start, end: t, select: { list: 'logos', index: i }, drag: { end: true } };
    });
    return [
      { id: 'camera', label: '镜头', kind: 'camera', items: [{ id: 'board', label: '排行榜翻进来', start: 0, end: p.pushAt, phases: [{ label: '翻页', start: 0.1, end: 0.47 }], select: { section: '排行榜' }, drag: { end: true } }] },
      { id: 'elements', label: '元素', kind: 'element', items: logoItems },
    ];
  },
  apply: (raw, itemId, _edge, start, end) => {
    const p = raw as unknown as RankingLogosParams;
    if (itemId === 'board') return { ...raw, pushAt: clamp(snap(end), 0.7, 60) };
    const m = /^logo-(\d+)$/.exec(itemId);
    if (m) {
      const i = Number(m[1]);
      return { ...raw, logos: p.logos.map((l, k) => (k === i ? { ...l, seconds: clamp(snap(end - start), 0.2, 10) } : l)) };
    }
    return raw;
  },
};

export const meta: TemplateMeta = {
  id: 'ranking-logos',
  name: '排行榜翻页 · logo 快切',
  description: '方格纸上一张排行榜像翻书一样翻过来，第一名有黄框、蓝条按分数排；然后整张往下推走，一串 logo 一张接一张硬切，每张都慢慢放大',
  origin: '复刻自一条讲开源大模型的视频里的一个镜头（开头的口播画面已去掉），和原片的相似度 86.7%',
  width: 1280,
  height: 720,
  fps: FPS,
  posterFrame: 45,
  form,
  defaultParams: defaultParams as unknown as Record<string, unknown>,
  timeline,
};
