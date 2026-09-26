import type { Section, TemplateMeta, TemplateTimeline } from '../form';
import type { PosterPairProps } from './PosterPair';

const FPS = 30;

export type BigLineParams = { before: string; big: string; after: string; at: number };

export type PosterPairParams = {
  intro: string;
  introEnd: number;
  background: string;
  leftTitle: string;
  leftSub: string;
  leftLetters: string;
  leftImage: string;
  rightTitle: string;
  rightSub: string;
  rightLetters: string;
  rightImage: string;
  english: string;
  middle: string;
  mergeAt: number;
  lines: BigLineParams[];
  vignette: boolean;
  duration: number;
};

export const defaultParams: PosterPairParams = {
  // 开头的口播画面（A-roll）默认不放：一开始就是背景；放了就在 introEnd 秒淡成背景（原片第 50 帧）
  intro: '',
  introEnd: 1.67,
  background: '/template-assets/word-magnifier/grey-wall.jpg',
  leftTitle: '精准作答',
  leftSub: 'Answer accurately',
  leftLetters: 'AA',
  leftImage: '/template-assets/icon-bubbles/magnifier.png',
  rightTitle: '凭空编造',
  rightSub: 'Make things up out of thin air',
  rightLetters: 'MTU',
  rightImage: '/template-assets/icon-bubbles/brain.png',
  english: 'the same continuation mechanism',
  middle: '同一套续写机制',
  // 原片：第 128 帧两张合在一起；右边三行在第 148、226、262 帧出来，一共 315 帧
  mergeAt: 4.27,
  lines: [
    { before: '', big: '彻底禁止', after: 'AI自主补全内容', at: 4.93 },
    { before: '丧失', big: '语言生成', after: '能力', at: 7.53 },
    { before: '彻底变', big: '哑巴', after: '', at: 8.73 },
  ],
  vignette: true,
  duration: 10.5,
};

const frames = (sec: number) => Math.round(sec * FPS);

export function toProps(p: PosterPairParams): PosterPairProps {
  return {
    intro: p.intro ?? '',
    introEnd: frames(p.introEnd ?? 1.67),
    background: p.background,
    left: { title: p.leftTitle, sub: p.leftSub, letters: p.leftLetters, image: p.leftImage, tone: 'cream' },
    right: { title: p.rightTitle, sub: p.rightSub, letters: p.rightLetters, image: p.rightImage, tone: 'peach' },
    english: p.english.trim(),
    middle: p.middle.trim(),
    mergeAt: frames(p.mergeAt),
    lines: p.lines.slice(0, 3).filter((l) => (l.before + l.big + l.after).trim()).map((l) => ({ ...l, at: frames(l.at) })),
    vignette: p.vignette !== false,
    durationInFrames: Math.max(1, frames(p.duration)),
  };
}

const posterFields = (k: 'left' | 'right', name: string) => [
  { kind: 'text' as const, key: `${k}Title`, label: `${name}标题`, half: true },
  { kind: 'text' as const, key: `${k}Letters`, label: `${name}顶上的大字母`, half: true, placeholder: '留空不要' },
  { kind: 'text' as const, key: `${k}Sub`, label: `${name}英文小字`, placeholder: '留空不要' },
  { kind: 'image' as const, key: `${k}Image`, label: `${name}图片`, hint: '透明底的 png，放在卡片下半截' },
];

const form: Section[] = [
  {
    title: '画面',
    fields: [
      { kind: 'media', key: 'intro', label: '开头的口播画面（A-roll）', hint: '放你自己的口播视频，卡片先出现在它上面，到点淡成背景；留空就一开始就是背景' },
      { kind: 'number', key: 'introEnd', label: '第几秒换成背景', min: 0, max: 60, step: 0.1, unit: '秒', hint: '只在放了开头画面时有用，0.5 秒淡过去' },
      { kind: 'media', key: 'background', label: '背景', hint: '原片是一面灰墙' },
      { kind: 'toggle', key: 'vignette', label: '四周暗角' },
    ],
  },
  { title: '左边卡片', fields: posterFields('left', '左卡片') },
  { title: '右边卡片', fields: posterFields('right', '右卡片') },
  {
    title: '中间和右边的字',
    fields: [
      { kind: 'text', key: 'english', label: '中间英文', placeholder: '留空不要' },
      { kind: 'text', key: 'middle', label: '中间一句话', hint: '一个字一个字打出来' },
      { kind: 'number', key: 'mergeAt', label: '第几秒两张合在一起', min: 0, max: 60, step: 0.1, unit: '秒' },
      {
        kind: 'list', key: 'lines', label: '右边的行（最多 3 行）', itemLabel: '第',
        fields: [
          { kind: 'text', key: 'before', label: '前面小字', half: true, placeholder: '留空不要' },
          { kind: 'text', key: 'big', label: '大字', half: true },
          { kind: 'text', key: 'after', label: '后面小字', half: true, placeholder: '留空不要' },
          { kind: 'number', key: 'at', label: '第几秒出来', min: 0, max: 60, step: 0.1, unit: '秒', half: true },
        ],
        newItem: (items) => {
          const last = items[items.length - 1] as BigLineParams | undefined;
          return { before: '', big: '大字', after: '', at: Math.round(((last?.at ?? 5) + 1.2) * 10) / 10 };
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
    const p = raw as unknown as PosterPairParams;
    return [
      {
        id: 'camera', label: '镜头', kind: 'camera',
        items: [{ id: 'cam', label: p.intro ? '口播 → 背景，慢慢推近' : '慢慢推近', start: 0, end: p.duration, phases: p.intro ? [{ label: '换背景', start: p.introEnd, end: p.introEnd + 0.53 }] : [], select: { section: '画面' }, drag: { end: true } }],
      },
      {
        id: 'elements', label: '元素', kind: 'element',
        items: [
          { id: 'merge', label: `${p.rightTitle} 叠到 ${p.leftTitle} 上`, start: p.mergeAt, end: Math.min(p.duration, p.mergeAt + 0.93), select: { section: '中间和右边的字' }, drag: { move: true } },
          ...p.lines.slice(0, 3).map((l, i) => ({ id: `line-${i}`, label: `${l.before}${l.big}${l.after}`, start: l.at, end: Math.min(p.duration, l.at + 0.6), select: { list: 'lines', index: i }, drag: { move: true } })),
        ],
      },
    ];
  },
  apply: (raw, itemId, _edge, start, end) => {
    const p = raw as unknown as PosterPairParams;
    if (itemId === 'cam') return { ...raw, duration: clamp(snap(end), 1, 60) };
    if (itemId === 'merge') return { ...raw, mergeAt: clamp(snap(start), 0, 60) };
    const m = /^line-(\d+)$/.exec(itemId);
    if (m) {
      const i = Number(m[1]);
      return { ...raw, lines: p.lines.map((l, k) => (k === i ? { ...l, at: clamp(snap(start), 0, 60) } : l)) };
    }
    return raw;
  },
};

export const meta: TemplateMeta = {
  id: 'poster-pair',
  name: '两张海报卡片 · 合在一起 · 右边大字',
  description: '两张海报卡片先后出来（开头可以垫一段口播画面，再淡成背景）、中间打出一句话；右边那张滑过去叠在左边那张上，右边一行行「小字 + 大字 + 小字」淡进来',
  origin: '复刻自一条讲 AI 幻觉的视频里的一个镜头，和原片的相似度 85.9%',
  width: 1280,
  height: 720,
  fps: FPS,
  posterFrame: 300,
  form,
  defaultParams: defaultParams as unknown as Record<string, unknown>,
  timeline,
};
