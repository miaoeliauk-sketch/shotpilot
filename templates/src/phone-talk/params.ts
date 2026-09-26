import type { Section, TemplateMeta, TemplateTimeline } from '../form';
import type { PhoneTalkProps } from './PhoneTalk';

const FPS = 30;

export type PhoneTalkParams = {
  person: string;
  tipX: number;
  tipY: number;
  ask: string;
  reply: string;
  askAt: number;
  askSpeed: number;
  replyAt: number;
  replySpeed: number;
  duration: number;
};

export const defaultParams: PhoneTalkParams = {
  person: '/template-assets/phone-talk/person.png',
  tipX: 420,
  tipY: 440,
  ask: '还有一件事,老人走不了那么多路.',
  reply: '好的,我会根据昨天的方案调整,\n酒店我们换XX酒店,交通预算也....',
  // 原片：第 4 帧开始打字，第 121 帧弹出回复，一共 303 帧
  askAt: 0.13,
  askSpeed: 5.5,
  replyAt: 4.03,
  replySpeed: 11,
  duration: 10.1,
};

const frames = (sec: number) => Math.round(sec * FPS);

export function toProps(p: PhoneTalkParams): PhoneTalkProps {
  const replyAt = frames(p.replyAt);
  return {
    person: p.person,
    tipX: Number(p.tipX) || 420,
    tipY: Number(p.tipY) || 440,
    ask: p.ask.trim(),
    reply: p.reply.trim(),
    askAt: frames(p.askAt),
    askStep: FPS / Math.max(1, p.askSpeed),
    replyAt,
    replyTypeAt: replyAt + 35,
    replyStep: FPS / Math.max(1, p.replySpeed),
    durationInFrames: Math.max(frames(2), frames(p.duration)),
  };
}

const form: Section[] = [
  {
    title: '人',
    fields: [
      { kind: 'image', key: 'person', label: '拿手机的人', hint: '抠好图的透明 PNG，放在左下（高 560）' },
      { kind: 'number', key: 'tipX', label: '尖角指到哪（横）', min: 0, max: 1280, step: 1, unit: '像素', half: true },
      { kind: 'number', key: 'tipY', label: '尖角指到哪（竖）', min: 0, max: 720, step: 1, unit: '像素', half: true, hint: '一般指到手机或嘴边' },
    ],
  },
  {
    title: '对话',
    fields: [
      { kind: 'text', key: 'ask', label: '说的话（上面的框）', hint: '一行，最多 17 个字左右' },
      { kind: 'number', key: 'askAt', label: '第几秒开始打字', min: 0, max: 60, step: 0.1, unit: '秒', half: true },
      { kind: 'number', key: 'askSpeed', label: '每秒打几个字', min: 1, max: 30, step: 0.5, half: true },
      { kind: 'text', key: 'reply', label: '回复（下面的框）', placeholder: '留空不要', hint: '最多两行，可以手动换行；一行大概 17 个字' },
      { kind: 'number', key: 'replyAt', label: '第几秒弹出回复', min: 0, max: 60, step: 0.1, unit: '秒', half: true, hint: '弹出后 1.2 秒开始打字' },
      { kind: 'number', key: 'replySpeed', label: '每秒打几个字', min: 1, max: 30, step: 0.5, half: true },
      { kind: 'number', key: 'duration', label: '视频时长', min: 2, max: 60, step: 0.1, unit: '秒' },
    ],
  },
];

const snap = (t: number) => Math.round((Math.round(t * FPS) / FPS) * 100) / 100;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export const timeline: TemplateTimeline = {
  tracks: (raw) => {
    const p = raw as unknown as PhoneTalkParams;
    const askEnd = p.askAt + Array.from(p.ask).length / Math.max(1, p.askSpeed);
    const replyEnd = p.replyAt + 1.17 + Array.from(p.reply).length / Math.max(1, p.replySpeed);
    return [
      { id: 'camera', label: '镜头', kind: 'camera', items: [{ id: 'cam', label: '人升上来', start: 0, end: p.duration, phases: [{ label: '升上来', start: 0, end: 2.2 }], select: { section: '人' }, drag: { end: true } }] },
      {
        id: 'elements', label: '元素', kind: 'element',
        items: [
          { id: 'ask', label: p.ask, start: p.askAt, end: Math.min(p.duration, askEnd), select: { section: '对话' }, drag: { move: true } },
          ...(p.reply ? [{ id: 'reply', label: p.reply, start: p.replyAt, end: Math.min(p.duration, replyEnd), select: { section: '对话' }, drag: { move: true } }] : []),
        ],
      },
    ];
  },
  apply: (raw, itemId, _edge, start, end) => {
    if (itemId === 'cam') return { ...raw, duration: clamp(snap(end), 2, 60) };
    if (itemId === 'ask') return { ...raw, askAt: clamp(snap(start), 0, 60) };
    if (itemId === 'reply') return { ...raw, replyAt: clamp(snap(start), 0, 60) };
    return raw;
  },
};

export const meta: TemplateMeta = {
  id: 'phone-talk',
  name: '对着手机说话 · 对话框打字',
  description: '浅灰底上一个拿着手机的人从下面升上来，手机那里伸出黑色尖角连到白色对话框，一个字一个字打出一句话；过一会儿下面弹出回复框，也一个字一个字打出来',
  origin: '复刻自一条讲编程评测榜单的视频里的一个镜头，和原片的相似度 95.0%',
  width: 1280,
  height: 720,
  fps: FPS,
  posterFrame: 260,
  form,
  defaultParams: defaultParams as unknown as Record<string, unknown>,
  timeline,
};
