import type { Section, TemplateMeta } from '../form';
import type { BubbleSpec, DialogueShotProps, Move } from './DialogueShot';

/**
 * 对话气泡模板的「简单参数」和换算。
 *
 * 所有曲线、时长、位移都来自 s003 的逐帧实测（见 examples/replica-s003/README.md），
 * 这里把它们做成预设：用户只选「从上方落下」「往上飞走」、填几秒出现，其余照原片来。
 */

const FPS = 30;

export type BubbleParams = {
  text: string;
  highlight: string;
  /** 开始入场的时间（秒） */
  appearAt: number;
  enterStyle: 'drop' | 'rise';
  exitStyle: 'fly' | 'stay';
  /** 开始飞走的时间（秒），exitStyle 为 stay 时不用 */
  leaveAt: number;
  /** 停留时气泡中心的高度，占画面高度的百分比 */
  y: number;
};

export type DialogueParams = {
  image: string;
  duration: number;
  startScale: number;
  startRotation: number;
  focusX: number;
  focusY: number;
  zoomOutSeconds: number;
  pushInAt: number;
  pushInSeconds: number;
  endScale: number;
  bubbles: BubbleParams[];
  bubbleColor: string;
  textColor: string;
  highlightColor: string;
  fontSize: number;
  motionBlur: boolean;
};

// ── 实测预设（帧，相对于开始的那一刻）──────────────────────────────────

const LINEAR: [number, number, number, number] = [0, 0, 1, 1];
const NEVER = 1e9;

/** 气泡 1 的入场：从上方 120px 落下，同时淡入、由虚变实 */
function dropIn(a: number): Move {
  return {
    start: a, end: a + 57.5, distance: -120.3, easing: [0.227, 0.256, 0.353, 0.945],
    opacity: 0, fade: { start: a - 1.53, end: a + 55.37, easing: LINEAR },
    blur: 11, blurEnd: a + 28.97,
  };
}

/** 气泡 2 的入场：从画面下方外面升上来，减速停住 */
function riseIn(a: number): Move {
  return {
    start: a, end: a + 26.45, distance: 377.4, easing: [0.015, 0.098, 0.159, 0.871],
    opacity: 1, fade: { start: a, end: a + 26.45, easing: LINEAR },
    blur: 0, blurEnd: a,
  };
}

/** 气泡 1 的离场：加速上飞，飞出画面 */
function flyOut(l: number): Move {
  return {
    start: l, end: l + 27.95, distance: -534.5, easing: [0.207, 0.039, 0.888, 0.085],
    opacity: 1, fade: { start: l, end: l + 27.95, easing: LINEAR },
    blur: 0, blurEnd: 0,
  };
}

function stay(): Move {
  return {
    start: NEVER, end: NEVER + 1, distance: 0, easing: LINEAR,
    opacity: 1, fade: { start: NEVER, end: NEVER + 1, easing: LINEAR },
    blur: 0, blurEnd: 0,
  };
}

function toBubble(b: BubbleParams): BubbleSpec {
  const a = b.appearAt * FPS;
  return {
    text: b.text,
    highlight: b.highlight,
    x: 640,
    y: (b.y / 100) * 720,
    enter: b.enterStyle === 'drop' ? dropIn(a) : riseIn(a),
    exit: b.exitStyle === 'fly' ? flyOut(b.leaveAt * FPS) : stay(),
  };
}

/** 把 #rrggbb 每个通道加亮 n（原片气泡底色是中间亮两边暗的横向渐变，差 14 个灰度） */
function lighten(hex: string, n: number): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m?.[1]) return hex;
  const v = parseInt(m[1], 16);
  const ch = (shift: number) => Math.max(0, Math.min(255, ((v >> shift) & 255) + n));
  return `#${[16, 8, 0].map((s) => ch(s).toString(16).padStart(2, '0')).join('')}`;
}

export function toProps(p: DialogueParams): DialogueShotProps {
  // 原片拉远：缩放 −1 → 97.74 帧，旋转 0 → 96.43 帧；改了时长就按比例伸缩
  const zoomFrames = Math.max(1, p.zoomOutSeconds * FPS);
  const k = zoomFrames / 98.74;
  const zStart = -1;
  const zEnd = zStart + zoomFrames;
  const fs = p.fontSize;
  const unit = fs / 37.85; // 原片字号；气泡高度、边距、圆角按它等比缩放
  return {
    image: p.image,
    zoomImage: '',
    camera: {
      startScale: p.startScale,
      startRotation: p.startRotation,
      focusX: (p.focusX / 100) * 1280,
      focusY: (p.focusY / 100) * 720,
      restScale: 1,
      restRotation: 0,
      endScale: p.endScale,
      zoomOut: { start: zStart, end: zEnd, easing: [1, -0.031, 0, 1.014] },
      unrotate: { start: zStart + 1 * k, end: zEnd - 1.31 * k, easing: [1, -0.056, 0, 0.999] },
      pushIn: {
        start: p.pushInAt * FPS,
        end: (p.pushInAt + Math.max(0.1, p.pushInSeconds)) * FPS,
        easing: [1, 0.046, 0, 0.966],
      },
      zoomImageFade: [zStart + 46 * k, zStart + 57 * k],
    },
    motionBlur: { enabled: p.motionBlur, shutter: 0.27, samples: 10, minSpeed: 3 },
    bubbleStyle: {
      fontSize: fs,
      fontWeight: 350,
      textOffsetY: -3 * unit,
      textBlur: 0.6,
      paddingX: 40 * unit,
      height: 82 * unit,
      radius: 22 * unit,
      fill: `linear-gradient(to right, ${p.bubbleColor} 0%, ${lighten(p.bubbleColor, 9)} 25%, ${lighten(p.bubbleColor, 14)} 50%, ${lighten(p.bubbleColor, 13)} 75%, ${lighten(p.bubbleColor, 4)} 100%)`,
      borderTop: 'rgba(255,255,255,0.28)',
      borderBottom: 'rgba(255,255,255,0.33)',
      textColor: p.textColor,
      highlightColor: p.highlightColor,
      shadow: '-28px 34px 26px rgba(0,0,0,0.39)',
    },
    bubbles: p.bubbles.map(toBubble),
    showPillarbox: false,
    durationInFrames: Math.max(1, Math.round(p.duration * FPS)),
  };
}

// 原片的三个气泡（时间 = 实测帧号 ÷ 30）
export const defaultParams: DialogueParams = {
  image: '/template-assets/dialogue-shot/sample.jpg',
  duration: 9.1,
  startScale: 3.23,
  startRotation: 29.9,
  focusX: 50,
  focusY: 50,
  zoomOutSeconds: 3.29,
  pushInAt: 4.92,
  pushInSeconds: 1.78,
  endScale: 1.2,
  bubbles: [
    { text: '这周末，我们要在上海办一场品牌快闪活动', highlight: '', appearAt: 1.47, enterStyle: 'drop', exitStyle: 'fly', leaveAt: 4.84, y: 49.4 },
    { text: '你 48 小时内，给我一份完整策划案', highlight: '48 小时内', appearAt: 5.96, enterStyle: 'rise', exitStyle: 'fly', leaveAt: 6.81, y: 50 },
    { text: '收到....', highlight: '', appearAt: 7.77, enterStyle: 'rise', exitStyle: 'stay', leaveAt: 9, y: 51 },
  ],
  bubbleColor: '#131313',
  textColor: '#dadada',
  highlightColor: '#d8b45a',
  fontSize: 37.85,
  motionBlur: true,
};

const form: Section[] = [
  {
    title: '画面',
    fields: [
      { kind: 'image', key: 'image', label: '底图', hint: '横版插画，1280×720 或更大。开场会放大 3 倍，图越清楚越好' },
      { kind: 'number', key: 'duration', label: '视频时长', min: 2, max: 60, step: 0.1, unit: '秒' },
    ],
  },
  {
    title: '开场特写 → 拉远',
    fields: [
      { kind: 'number', key: 'startScale', label: '开场放大', min: 1, max: 5, step: 0.05, unit: '倍', hint: '1 = 不放大，直接全景开场' },
      { kind: 'number', key: 'startRotation', label: '开场倾斜', min: -45, max: 45, step: 0.5, unit: '°', hint: '正数顺时针，0 = 不倾斜' },
      { kind: 'number', key: 'focusX', label: '特写对准·左右', min: 0, max: 100, step: 1, unit: '%', hint: '0 最左，50 正中，100 最右' },
      { kind: 'number', key: 'focusY', label: '特写对准·上下', min: 0, max: 100, step: 1, unit: '%', hint: '0 最上，50 正中，100 最下' },
      { kind: 'number', key: 'zoomOutSeconds', label: '拉远用时', min: 0.5, max: 10, step: 0.1, unit: '秒' },
    ],
  },
  {
    title: '推近',
    fields: [
      { kind: 'number', key: 'pushInAt', label: '开始推近', min: 0, max: 60, step: 0.1, unit: '秒' },
      { kind: 'number', key: 'pushInSeconds', label: '推近用时', min: 0.1, max: 10, step: 0.1, unit: '秒' },
      { kind: 'number', key: 'endScale', label: '推近到', min: 1, max: 2, step: 0.01, unit: '倍', hint: '1 = 不推近' },
    ],
  },
  {
    title: '对话气泡',
    fields: [
      {
        kind: 'list',
        key: 'bubbles',
        label: '气泡',
        itemLabel: '气泡',
        hint: '按出现顺序排列。时间都从视频开头算起',
        fields: [
          { kind: 'text', key: 'text', label: '文字' },
          { kind: 'text', key: 'highlight', label: '标黄的字', placeholder: '例如：48 小时内（留空不标）', hint: '必须和上面文字里的某一段完全一样' },
          { kind: 'number', key: 'appearAt', label: '出现时间', min: 0, max: 60, step: 0.1, unit: '秒' },
          {
            kind: 'select', key: 'enterStyle', label: '怎么进来',
            options: [{ value: 'drop', label: '从上方落下（慢慢变清楚）' }, { value: 'rise', label: '从下方升起（快）' }],
          },
          {
            kind: 'select', key: 'exitStyle', label: '怎么离开',
            options: [{ value: 'fly', label: '往上飞走' }, { value: 'stay', label: '一直停到结尾' }],
          },
          { kind: 'number', key: 'leaveAt', label: '飞走时间', min: 0, max: 60, step: 0.1, unit: '秒', hint: '选了「一直停到结尾」就不用管' },
          { kind: 'number', key: 'y', label: '上下位置', min: 5, max: 95, step: 0.5, unit: '%', hint: '50 = 画面正中' },
        ],
        newItem: (items) => {
          const last = items[items.length - 1] as BubbleParams | undefined;
          const at = last ? (last.exitStyle === 'fly' ? last.leaveAt : last.appearAt + 2) : 1;
          return { text: '新的一句话', highlight: '', appearAt: Math.round(at * 10) / 10, enterStyle: 'rise', exitStyle: 'stay', leaveAt: at + 2, y: 50 };
        },
      },
    ],
  },
  {
    title: '气泡样式',
    fields: [
      { kind: 'color', key: 'bubbleColor', label: '底色', hint: '会自动做成中间略亮的渐变，和原片一样' },
      { kind: 'color', key: 'textColor', label: '文字颜色' },
      { kind: 'color', key: 'highlightColor', label: '标黄颜色' },
      { kind: 'number', key: 'fontSize', label: '字号', min: 16, max: 72, step: 0.5, unit: 'px', hint: '气泡高度、圆角跟着一起缩放' },
    ],
  },
  {
    title: '其他',
    fields: [{ kind: 'toggle', key: 'motionBlur', label: '运动模糊', hint: '快速运动时画面发虚，和原片一样。关掉导出更快' }],
  },
];

export const meta: TemplateMeta = {
  id: 'dialogue-shot',
  name: '对话气泡 · 旋转拉远',
  description: '插画从斜着的特写旋转拉远，对话气泡依次落下、升起、飞走，中途镜头推近',
  origin: '复刻自一条抖音视频的第 3 个镜头，和原片的相似度 97.7%',
  width: 1280,
  height: 720,
  fps: FPS,
  posterFrame: 125,
  form,
  defaultParams: defaultParams as unknown as Record<string, unknown>,
};
