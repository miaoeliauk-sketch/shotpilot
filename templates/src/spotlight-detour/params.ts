import type { Section, TemplateMeta, TemplateTimeline } from '../form';
import type { SpotlightDetourProps } from './SpotlightDetour';

const FPS = 30;

export type SpotlightDetourParams = {
  product: string;
  center: string;
  centerSub: string;
  left: string;
  right: string;
  box: string;
  labels: { mark: string; title: string; body: string }[];
  centerAt: number;
  leftAt: number;
  rightAt: number;
  panAt: number;
  circleAt: number;
  duration: number;
};

export const defaultParams: SpotlightDetourParams = {
  product: '/template-assets/spotlight-detour/sample-product.png',
  center: '入口',
  centerSub: 'Entrance',
  left: '绕路',
  right: '超车',
  box: '/template-assets/spotlight-detour/sample-box.png',
  labels: [
    { mark: '绕', title: '绕开渠道限制', body: '当时的产品功能由渠道说了算，新来的却和渠道签下独家协议，要求对方不得干涉产品的软硬件设计。' },
    { mark: '绕', title: '绕开物理按键', body: '老对手坚信「手机就该有键盘」，新来的用一整块触控屏彻底绕开了这一物理限制，创造了全新的交互逻辑。' },
    { mark: '绕', title: '绕开软件围墙', body: '老对手的系统是当时最流行的，但新来的没有选择兼容，而是从零构建了自己的系统和应用商店。' },
  ],
  // 原片：第 28 帧入口、76 帧左字、102 帧右字、244 帧往上摇、298 帧粉圆，一共 512 帧
  centerAt: 0.93,
  leftAt: 2.53,
  rightAt: 3.4,
  panAt: 8.13,
  circleAt: 9.93,
  duration: 17.07,
};

const frames = (sec: number) => Math.round(sec * FPS);

export function toProps(p: SpotlightDetourParams): SpotlightDetourProps {
  return {
    product: p.product,
    box: p.box,
    center: p.center,
    centerSub: p.centerSub,
    left: p.left,
    right: p.right,
    labels: p.labels.slice(0, 3),
    centerAt: frames(p.centerAt),
    leftAt: frames(p.leftAt),
    rightAt: frames(p.rightAt),
    panAt: frames(p.panAt),
    circleAt: frames(p.circleAt),
    durationInFrames: Math.max(1, frames(p.duration)),
  };
}

const form: Section[] = [
  {
    title: '场景一：圆台',
    fields: [
      { kind: 'media', key: 'product', label: '产品图', hint: '透明底、竖着放的产品图最好，会转着落进圆里、斜着放' },
      { kind: 'text', key: 'center', label: '中间的金字', half: true },
      { kind: 'text', key: 'centerSub', label: '金字上的英文', half: true, placeholder: '留空不要' },
      { kind: 'text', key: 'left', label: '左边红字', half: true },
      { kind: 'text', key: 'right', label: '右边红字', half: true },
      { kind: 'number', key: 'centerAt', label: '第几秒出金字', min: 0, max: 60, step: 0.1, unit: '秒' },
      { kind: 'number', key: 'leftAt', label: '第几秒出左字', min: 0, max: 60, step: 0.1, unit: '秒', half: true },
      { kind: 'number', key: 'rightAt', label: '第几秒出右字', min: 0, max: 60, step: 0.1, unit: '秒', half: true },
    ],
  },
  {
    title: '场景二：标签',
    fields: [
      { kind: 'media', key: 'box', label: '中间的图', hint: '横图，落在中间，压在粉圆上面' },
      {
        kind: 'list', key: 'labels', label: '标签', itemLabel: '标签',
        hint: '最多三个：左边、上面、右边。左边和上面的一开始就在，右边的跟着粉圆出来',
        fields: [
          { kind: 'text', key: 'mark', label: '红色大字', hint: '一个字最好' },
          { kind: 'text', key: 'title', label: '标题' },
          { kind: 'text', key: 'body', label: '小字说明', hint: '三四行最合适' },
        ],
        newItem: () => ({ mark: '绕', title: '新的标题', body: '一段说明文字' }),
      },
      { kind: 'number', key: 'panAt', label: '第几秒往上摇到场景二', min: 0.5, max: 60, step: 0.1, unit: '秒' },
      { kind: 'number', key: 'circleAt', label: '第几秒出粉圆', min: 0.5, max: 60, step: 0.1, unit: '秒', half: true },
      { kind: 'number', key: 'duration', label: '视频时长', min: 1, max: 60, step: 0.1, unit: '秒', half: true },
    ],
  },
];

const snap = (t: number) => Math.round((Math.round(t * FPS) / FPS) * 100) / 100;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export const timeline: TemplateTimeline = {
  tracks: (raw) => {
    const p = raw as unknown as SpotlightDetourParams;
    return [
      {
        id: 'camera', label: '镜头', kind: 'camera',
        items: [
          { id: 'a', label: '圆台', start: 0, end: p.panAt, phases: [{ label: '拉远', start: 0, end: Math.min(p.panAt, 5) }], select: { section: '场景一：圆台' }, drag: { end: true } },
          { id: 'b', label: '标签', start: p.panAt, end: p.duration, phases: [{ label: '往上摇', start: p.panAt, end: Math.min(p.duration, p.panAt + 1.6) }], select: { section: '场景二：标签' }, drag: { end: true } },
        ],
      },
      {
        id: 'words', label: '字', kind: 'element',
        items: [
          { id: 'center', label: p.center, start: p.centerAt, end: p.panAt, select: { section: '场景一：圆台' }, drag: { move: true } },
          { id: 'left', label: p.left, start: p.leftAt, end: p.panAt, select: { section: '场景一：圆台' }, drag: { move: true } },
          { id: 'right', label: p.right, start: p.rightAt, end: p.panAt, select: { section: '场景一：圆台' }, drag: { move: true } },
        ],
      },
      { id: 'circle', label: '粉圆', kind: 'element', items: [{ id: 'circle', label: '粉圆 + 第三个标签', start: p.circleAt, end: p.duration, select: { section: '场景二：标签' }, drag: { move: true } }] },
    ];
  },
  apply: (raw, itemId, _edge, start, end) => {
    const p = raw as unknown as SpotlightDetourParams;
    if (itemId === 'a') return { ...raw, panAt: clamp(snap(end), 0.5, p.duration - 0.5) };
    if (itemId === 'b') return { ...raw, duration: clamp(snap(end), p.panAt + 0.5, 60) };
    if (itemId === 'center') return { ...raw, centerAt: clamp(snap(start), 0, p.panAt) };
    if (itemId === 'left') return { ...raw, leftAt: clamp(snap(start), 0, p.panAt) };
    if (itemId === 'right') return { ...raw, rightAt: clamp(snap(start), 0, p.panAt) };
    if (itemId === 'circle') return { ...raw, circleAt: clamp(snap(start), p.panAt, 60) };
    return raw;
  },
};

export const meta: TemplateMeta = {
  id: 'spotlight-detour',
  name: '聚光圆台 · 左右红字 · 上摇到标签页',
  description: '格子纸上的灰色圆台，产品转着落进去，金色大字压下来，左右红字带着光带滑进来；镜头往上一摇，换到三个红色大字标签围着一张图，粉红大圆从下面长出来',
  origin: '复刻自一条科技解读视频里的一段，和原片的相似度 81.1%',
  width: 1280,
  height: 720,
  fps: FPS,
  posterFrame: 200,
  form,
  defaultParams: defaultParams as unknown as Record<string, unknown>,
  timeline,
};
