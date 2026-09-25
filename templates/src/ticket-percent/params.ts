import type { Section, TemplateMeta, TemplateTimeline } from '../form';
import type { TicketPercentProps } from './TicketPercent';

const FPS = 30;

export type TicketPercentParams = {
  presenter: string;
  question: string;
  questionAt: number;
  leftImage: string;
  leftValue: string;
  leftAt: number;
  rightImage: string;
  rightValue: string;
  rightAt: number;
  swapAt: number;
  money: string;
  amount: string;
  unit: string;
  moneyOutAt: number;
  vignette: boolean;
  duration: number;
};

const A = '/template-assets/ticket-percent';

export const defaultParams: TicketPercentParams = {
  presenter: `${A}/presenter.jpg`,
  question: '请告诉我退机票手续费比例是多少...',
  // 原片：第 50 帧出提问、116 帧出左边、246 帧出右边、300 帧甩走换钞票、388 帧钞票甩出去，一共 400 帧
  questionAt: 1.67,
  leftImage: `${A}/ticket.png`,
  leftValue: '5%',
  leftAt: 3.87,
  rightImage: `${A}/ticket.png`,
  rightValue: '40%',
  rightAt: 8.2,
  swapAt: 10,
  money: `${A}/bills.png`,
  amount: '600',
  unit: '块钱',
  moneyOutAt: 12.93,
  vignette: true,
  duration: 13.33,
};

const frames = (sec: number) => Math.round(sec * FPS);

export function toProps(p: TicketPercentParams): TicketPercentProps {
  const swapAt = Math.max(1, frames(p.swapAt));
  return {
    presenter: p.presenter,
    question: p.question.trim(),
    questionAt: frames(p.questionAt),
    left: { image: p.leftImage, value: p.leftValue.trim(), at: frames(p.leftAt) },
    right: { image: p.rightImage, value: p.rightValue.trim(), at: frames(p.rightAt) },
    swapAt,
    money: p.money,
    amount: p.amount.trim(),
    unit: p.unit.trim(),
    moneyOutAt: Math.max(swapAt + 20, frames(p.moneyOutAt)),
    vignette: p.vignette !== false,
    durationInFrames: Math.max(1, frames(p.duration)),
  };
}

const form: Section[] = [
  {
    title: '人物和提问',
    fields: [
      { kind: 'media', key: 'presenter', label: '人物照片', hint: '横图，人在右边；会比画面宽一些、后面往右摆一下' },
      { kind: 'text', key: 'question', label: '提问', placeholder: '留空不要', hint: '深色条里一个字一个字打出来' },
      { kind: 'number', key: 'questionAt', label: '第几秒出提问', min: 0, max: 60, step: 0.1, unit: '秒' },
      { kind: 'toggle', key: 'vignette', label: '四周暗角' },
    ],
  },
  {
    title: '两边的百分比',
    fields: [
      { kind: 'text', key: 'leftValue', label: '左边（绿色）', half: true },
      { kind: 'number', key: 'leftAt', label: '第几秒出左边', min: 0, max: 60, step: 0.1, unit: '秒', half: true },
      { kind: 'image', key: 'leftImage', label: '左边的图', hint: '竖的小卡片最好，比如一张票' },
      { kind: 'text', key: 'rightValue', label: '右边（红色）', half: true },
      { kind: 'number', key: 'rightAt', label: '第几秒出右边', min: 0, max: 60, step: 0.1, unit: '秒', half: true },
      { kind: 'image', key: 'rightImage', label: '右边的图' },
      { kind: 'number', key: 'swapAt', label: '第几秒两边甩走', min: 1, max: 60, step: 0.1, unit: '秒', hint: '镜头同时往右摆，接着出钞票' },
    ],
  },
  {
    title: '钞票和金额',
    fields: [
      { kind: 'text', key: 'amount', label: '金额', half: true },
      { kind: 'text', key: 'unit', label: '单位', half: true, placeholder: '留空不要' },
      { kind: 'image', key: 'money', label: '钞票图片', hint: '透明底的 png' },
      { kind: 'number', key: 'moneyOutAt', label: '第几秒甩出去', min: 0, max: 60, step: 0.1, unit: '秒', half: true },
      { kind: 'number', key: 'duration', label: '视频时长', min: 1, max: 60, step: 0.1, unit: '秒', half: true },
    ],
  },
];

const snap = (t: number) => Math.round((Math.round(t * FPS) / FPS) * 100) / 100;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export const timeline: TemplateTimeline = {
  tracks: (raw) => {
    const p = raw as unknown as TicketPercentParams;
    return [
      {
        id: 'camera', label: '镜头', kind: 'camera',
        items: [{ id: 'cam', label: '慢慢拉远 → 往右摆', start: 0, end: p.duration, phases: [{ label: '往右摆', start: p.swapAt, end: Math.min(p.duration, p.swapAt + 0.8) }], select: { section: '人物和提问' }, drag: { end: true } }],
      },
      {
        id: 'elements', label: '元素', kind: 'element',
        items: [
          ...(p.question.trim() ? [{ id: 'question', label: p.question, start: p.questionAt, end: Math.min(p.duration, p.leftAt + 0.27), select: { section: '人物和提问' }, drag: { move: true } }] : []),
          { id: 'left', label: p.leftValue, start: p.leftAt, end: Math.min(p.duration, p.swapAt + 0.6), select: { section: '两边的百分比' }, drag: { move: true } },
          { id: 'right', label: p.rightValue, start: p.rightAt, end: Math.min(p.duration, p.swapAt + 0.6), select: { section: '两边的百分比' }, drag: { move: true } },
          { id: 'money', label: `${p.amount}${p.unit}`, start: p.swapAt + 0.67, end: Math.min(p.duration, p.moneyOutAt + 0.53), select: { section: '钞票和金额' }, drag: { end: true } },
        ],
      },
    ];
  },
  apply: (raw, itemId, _edge, start, end) => {
    if (itemId === 'cam') return { ...raw, duration: clamp(snap(end), 1, 60) };
    if (itemId === 'question') return { ...raw, questionAt: clamp(snap(start), 0, 60) };
    if (itemId === 'left') return { ...raw, leftAt: clamp(snap(start), 0, 60) };
    if (itemId === 'right') return { ...raw, rightAt: clamp(snap(start), 0, 60) };
    if (itemId === 'money') return { ...raw, moneyOutAt: clamp(snap(end - 0.53), 0, 60) };
    return raw;
  },
};

export const meta: TemplateMeta = {
  id: 'ticket-percent',
  name: '口播人物 · 提问 · 两个百分比 · 钞票',
  description: '虚化的人物照片上先打出一句提问，左边一张票和绿色百分比、右边一张票和红色百分比先后飞进来，甩走后镜头往右一摆，出一叠钞票和银色金额',
  origin: '复刻自一条讲 AI 幻觉的视频里的一个镜头，和原片的相似度 91.5%',
  width: 1280,
  height: 720,
  fps: FPS,
  posterFrame: 280,
  form,
  defaultParams: defaultParams as unknown as Record<string, unknown>,
  timeline,
};
