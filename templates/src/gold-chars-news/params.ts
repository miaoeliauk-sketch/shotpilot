import type { Section, TemplateMeta, TemplateTimeline } from '../form';
import type { GoldCharsNewsProps } from './GoldCharsNews';

const FPS = 30;

export type GoldCharsNewsParams = {
  wall: string;
  paper: string;
  chars: { char: string; label: string; english: string; at: number }[];
  discAt: number;
  darkAt: number;
  newsAt: number;
  title1: string;
  titleGold: string;
  title2: string;
  english: string;
  body: string;
  highlight: string;
  body2: string;
  duration: number;
};

export const defaultParams: GoldCharsNewsParams = {
  wall: '/template-assets/doc-portrait-count/wall.jpg',
  paper: '/template-assets/gold-chars-news/sample-paper.png',
  chars: [
    { char: '案', label: '案件名称', english: 'Case Name', at: 0.27 },
    { char: '法', label: '法条摘录', english: 'Excerpt from the law', at: 0.87 },
    { char: '理', label: '裁判理由', english: "Judge's reasoning", at: 1.93 },
  ],
  // 原片：第 44 帧升圆、156 帧暗下去、184 帧新闻页，一共 281 帧
  discAt: 1.47,
  darkAt: 5.2,
  newsAt: 6.13,
  title1: '律师因引用AI编造的案例被罚',
  titleGold: '引用AI',
  title2: '法院：这些判例根本不存在',
  english: 'Lawyer fined for citing cases made up by AI',
  body: '记者在法院公布的判决书中看到，这名律师所引用的案例包括“某某诉某航空公司”“某某诉某集团”等多份判例。但经过仔细查证之后，却根本找不到这些判决。',
  highlight: '引用的案例包括“某某诉某航空公司”“某某诉某集团”等多份判例。',
  body2: '律师在听证会上说：“我从来没有想到这会是捏造的案例。”',
  duration: 9.37,
};

const frames = (sec: number) => Math.round(sec * FPS);

export function toProps(p: GoldCharsNewsParams): GoldCharsNewsProps {
  return {
    wall: p.wall,
    paper: p.paper,
    chars: p.chars.slice(0, 3).map((c) => ({ ...c, at: frames(c.at) })),
    discAt: frames(p.discAt),
    darkAt: frames(p.darkAt),
    newsAt: frames(p.newsAt),
    title1: p.title1,
    titleGold: p.titleGold.trim(),
    title2: p.title2,
    english: p.english,
    body: p.body,
    highlight: p.highlight.trim(),
    body2: p.body2,
    durationInFrames: Math.max(1, frames(p.duration)),
  };
}

const form: Section[] = [
  {
    title: '金字',
    fields: [
      { kind: 'media', key: 'paper', label: '中间的图', hint: '透明底最好，竖着放在中间' },
      {
        kind: 'list', key: 'chars', label: '金字', itemLabel: '金字',
        hint: '三个：左下、上面、右边。每个配一行说明和一行英文',
        fields: [
          { kind: 'text', key: 'char', label: '金色大字', hint: '一个字' },
          { kind: 'text', key: 'label', label: '说明', half: true },
          { kind: 'text', key: 'english', label: '英文', half: true, placeholder: '留空不要' },
          { kind: 'number', key: 'at', label: '第几秒出来', min: 0, max: 60, step: 0.1, unit: '秒' },
        ],
        newItem: () => ({ char: '字', label: '说明', english: '', at: 2 }),
      },
      { kind: 'number', key: 'discAt', label: '第几秒升起金色圆', min: 0, max: 60, step: 0.1, unit: '秒', half: true },
      { kind: 'number', key: 'darkAt', label: '第几秒暗下去', min: 0.5, max: 60, step: 0.1, unit: '秒', half: true },
      { kind: 'media', key: 'wall', label: '墙', hint: '浅色背景' },
    ],
  },
  {
    title: '新闻页',
    fields: [
      { kind: 'text', key: 'title1', label: '标题第一行' },
      { kind: 'text', key: 'titleGold', label: '第一行里变金色的字', placeholder: '留空不变' },
      { kind: 'text', key: 'title2', label: '标题第二行' },
      { kind: 'text', key: 'english', label: '英文', placeholder: '留空不要' },
      { kind: 'text', key: 'body', label: '正文' },
      { kind: 'text', key: 'highlight', label: '正文里标橙色的句子', hint: '必须和正文里的一句完全一样', placeholder: '留空不标' },
      { kind: 'text', key: 'body2', label: '下面一段（越往下越暗）', placeholder: '留空不要' },
      { kind: 'number', key: 'newsAt', label: '第几秒出新闻页', min: 0.5, max: 60, step: 0.1, unit: '秒', half: true },
      { kind: 'number', key: 'duration', label: '视频时长', min: 1, max: 60, step: 0.1, unit: '秒', half: true },
    ],
  },
];

const snap = (t: number) => Math.round((Math.round(t * FPS) / FPS) * 100) / 100;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export const timeline: TemplateTimeline = {
  tracks: (raw) => {
    const p = raw as unknown as GoldCharsNewsParams;
    return [
      {
        id: 'camera', label: '画面', kind: 'camera',
        items: [
          { id: 'gold', label: '金字', start: 0, end: p.newsAt, phases: [{ label: '暗下去', start: p.darkAt, end: p.newsAt }], select: { section: '金字' }, drag: { end: true } },
          { id: 'news', label: '新闻页', start: p.newsAt, end: p.duration, select: { section: '新闻页' }, drag: { end: true } },
        ],
      },
      {
        id: 'chars', label: '金字', kind: 'element',
        items: p.chars.slice(0, 3).map((c, i) => ({ id: `char-${i}`, label: `${c.char} · ${c.label}`, start: c.at, end: Math.min(p.newsAt, c.at + 0.6), select: { list: 'chars', index: i }, drag: { move: true } })),
      },
      { id: 'disc', label: '金色圆', kind: 'element', items: [{ id: 'disc', label: '升起来', start: p.discAt, end: Math.min(p.darkAt, p.discAt + 0.4), select: { section: '金字' }, drag: { move: true } }] },
    ];
  },
  apply: (raw, itemId, _edge, start, end) => {
    const p = raw as unknown as GoldCharsNewsParams;
    if (itemId === 'gold') {
      const newsAt = clamp(snap(end), 1, p.duration - 0.3);
      return { ...raw, newsAt, darkAt: clamp(snap(newsAt - (p.newsAt - p.darkAt)), 0.5, newsAt) };
    }
    if (itemId === 'news') return { ...raw, duration: clamp(snap(end), p.newsAt + 0.3, 60) };
    if (itemId === 'disc') return { ...raw, discAt: clamp(snap(start), 0, 60) };
    const m = /^char-(\d+)$/.exec(itemId);
    if (m) return { ...raw, chars: p.chars.map((c, j) => (j === Number(m[1]) ? { ...c, at: clamp(snap(start), 0, 60) } : c)) };
    return raw;
  },
};

export const meta: TemplateMeta = {
  id: 'gold-chars-news',
  name: '三个金字 · 金色圆 → 深色新闻页',
  description: '一张图在中间，三个金色大字像金粉一样落下来拼成，旁边打出说明，金色大圆从下面升起；背景暗下去，切到深色新闻页：标题闪进来，正文一行行出来，引用的句子标橙色',
  origin: '复刻自一条新闻解读视频里的一段，和原片的相似度 82.5%',
  width: 1280,
  height: 720,
  fps: FPS,
  posterFrame: 120,
  form,
  defaultParams: defaultParams as unknown as Record<string, unknown>,
  timeline,
};
