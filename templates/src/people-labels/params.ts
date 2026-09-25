import type { Section, TemplateMeta, TemplateTimeline } from '../form';
import type { GoldLabel, PeopleLabelsProps } from './PeopleLabels';

const FPS = 30;

export type IdCardParams = { title: string; sub: string; gold: boolean };
export type GoldLabelParams = { text: string; slot: GoldLabel['slot']; at: number };

export type PeopleLabelsParams = {
  background: string;
  people: string;
  logo: string;
  logoX: number;
  logoY: number;
  cards: IdCardParams[];
  labels: GoldLabelParams[];
  vignette: boolean;
  duration: number;
};

const A = '/template-assets/people-labels';

export const defaultParams: PeopleLabelsParams = {
  background: '/template-assets/word-magnifier/grey-wall.jpg',
  people: `${A}/people.png`,
  logo: `${A}/logo.png`,
  logoX: 742,
  logoY: 271,
  cards: [
    { title: '律师', sub: 'Lawyer', gold: false },
    { title: '法官', sub: '', gold: true },
  ],
  // 原片：三个词条在第 12、20、38 帧亮起来，一共 140 帧
  labels: [
    { text: 'xxx行业', slot: 'left', at: 0.4 },
    { text: 'xxx职业', slot: 'top', at: 0.67 },
    { text: 'xxx事件', slot: 'right', at: 1.27 },
  ],
  vignette: true,
  duration: 4.67,
};

const frames = (sec: number) => Math.round(sec * FPS);

export function toProps(p: PeopleLabelsParams): PeopleLabelsProps {
  return {
    background: p.background,
    people: p.people,
    logo: p.logo,
    logoX: p.logoX,
    logoY: p.logoY,
    cards: p.cards.slice(0, 2),
    labels: p.labels.slice(0, 3).filter((l) => l.text.trim()).map((l) => ({ ...l, at: frames(l.at) })),
    vignette: p.vignette !== false,
    durationInFrames: Math.max(1, frames(p.duration)),
  };
}

const form: Section[] = [
  {
    title: '人物',
    fields: [
      { kind: 'image', key: 'people', label: '人物照片', hint: '透明底的 png 最好（抠好的人），放在画面中间、脚底对齐' },
      { kind: 'image', key: 'logo', label: '挡脸的 logo', hint: '放在白色方块里；不放就不挡' },
      { kind: 'number', key: 'logoX', label: 'logo 横向位置', min: 0, max: 1280, step: 1, half: true },
      { kind: 'number', key: 'logoY', label: 'logo 纵向位置', min: 0, max: 720, step: 1, half: true },
      { kind: 'media', key: 'background', label: '背景', hint: '横图，原片是一面灰墙' },
      { kind: 'toggle', key: 'vignette', label: '四周暗角' },
    ],
  },
  {
    title: '身份卡片',
    fields: [
      {
        kind: 'list', key: 'cards', label: '卡片（第一张大的在左、第二张小的在上）', itemLabel: '卡片',
        fields: [
          { kind: 'text', key: 'title', label: '字', half: true },
          { kind: 'text', key: 'sub', label: '英文小字', half: true, placeholder: '留空不要' },
          { kind: 'toggle', key: 'gold', label: '金色字', hint: '关掉是深灰字' },
        ],
        newItem: () => ({ title: '身份', sub: '', gold: true }),
      },
    ],
  },
  {
    title: '金色词条',
    fields: [
      {
        kind: 'list', key: 'labels', label: '词条（最多 3 个）', itemLabel: '词条',
        fields: [
          { kind: 'text', key: 'text', label: '字', half: true },
          {
            kind: 'select', key: 'slot', label: '放在哪', half: true,
            options: [{ value: 'left', label: '左' }, { value: 'top', label: '上' }, { value: 'right', label: '右' }],
          },
          { kind: 'number', key: 'at', label: '第几秒亮起来', min: 0, max: 60, step: 0.1, unit: '秒' },
        ],
        newItem: (items) => {
          const last = items[items.length - 1] as GoldLabelParams | undefined;
          return { text: '新词条', slot: 'right', at: Math.round(((last?.at ?? 0) + 0.5) * 10) / 10 };
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
    const p = raw as unknown as PeopleLabelsParams;
    return [
      { id: 'camera', label: '镜头', kind: 'camera', items: [{ id: 'cam', label: '推过来 → 慢慢推近', start: 0, end: p.duration, phases: [{ label: '推过来', start: 0, end: Math.min(p.duration, 1.2) }], select: { section: '人物' }, drag: { end: true } }] },
      {
        id: 'elements', label: '元素', kind: 'element',
        items: p.labels.slice(0, 3).map((l, i) => ({ id: `label-${i}`, label: l.text, start: l.at, end: Math.min(p.duration, l.at + 0.33), select: { list: 'labels', index: i }, drag: { move: true } })),
      },
    ];
  },
  apply: (raw, itemId, _edge, start, end) => {
    const p = raw as unknown as PeopleLabelsParams;
    if (itemId === 'cam') return { ...raw, duration: clamp(snap(end), 1, 60) };
    const m = /^label-(\d+)$/.exec(itemId);
    if (m) {
      const i = Number(m[1]);
      return { ...raw, labels: p.labels.map((l, k) => (k === i ? { ...l, at: clamp(snap(start), 0, 60) } : l)) };
    }
    return raw;
  },
};

export const meta: TemplateMeta = {
  id: 'people-labels',
  name: '人物 · 身份卡片 · 金色词条',
  description: '灰墙上一张人物照片（脸上可以盖 logo），身后两张灰卡片写着身份，四周金色词条一个个亮起来，镜头推过来再慢慢推近',
  origin: '复刻自一条讲 AI 幻觉的视频里的一个镜头，和原片的相似度 90.8%',
  width: 1280,
  height: 720,
  fps: FPS,
  posterFrame: 120,
  form,
  defaultParams: defaultParams as unknown as Record<string, unknown>,
  timeline,
};
