import React from 'react';
import { AbsoluteFill, Easing, Img, interpolate, staticFile, useCurrentFrame } from 'remotion';
import { z } from 'zod';
import { zColor } from '@remotion/zod-types';

/**
 * 复刻：对话气泡 + 旋转拉远 + 推近（ref.mp4 · s003，9.1 秒 / 273 帧）
 *
 * ── 这个镜头在做什么（全部逐帧实测）────────────────────────────────
 *   1. 开场是插画的局部特写：放大 3.23 倍、顺时针斜 29.9°，定格约 12 帧
 *   2. 缩放和旋转沿同一种缓动拉回正常画面（约第 97 帧到位），中段极快、带运动模糊
 *      曲线实测 ≈ cubic-bezier(1, 0, 0, 1)，缩放/旋转各自拟合，残差约 0.2%
  *   3. 气泡 1 在拉远后半程从上方落下、由虚变实；停留；随后加速上飞离场（发虚是运动模糊，不是变淡）
 *   4. 同时镜头推近到 1.198 倍（同一种缓动，第 148–201 帧）
 *   5. 气泡 2 从下方升起，停一下又上飞离场；气泡 3 从下方升起，停到结尾
 *   原片镜头始终绕画面中心 (640, 360) 缩放旋转，不平移。气泡跟着画面一起缩放（在「世界层」里）。
 *
 * 只复刻画面。原片底部的口播字幕是后期加的，不在模板里；比对时用 --mask 遮掉。
 *
 * ── 槽位 ───────────────────────────────────────────────────────────
 *   image      底图（1280×720 画布上的插画；分辨率越高，开场特写越清晰）
 *   zoomImage  可选：开场特写专用的高清底图，留空就用 image
 *   bubbles    每个气泡的文字、高亮词、位置、出现/离开的时间和方式
 *   camera.focusX / focusY  开场特写对准底图的哪个点（原片是正中间）
 *
 * 模板默认值是整理过的设计值（回正到 1 倍 / 0°）；原片逐帧实测的精确值在 replica-props.json 里，
 * 复刻验证时用它渲染。
 */

const bezier = z.tuple([z.number(), z.number(), z.number(), z.number()]);

const segmentSchema = z.object({ start: z.number(), end: z.number(), easing: bezier });

const moveSchema = z.object({
  start: z.number().describe('开始帧'),
  end: z.number().describe('结束帧'),
  distance: z.number().describe('位移（像素）：正数=在下方，负数=在上方'),
  easing: bezier.describe('缓动 cubic-bezier'),
  opacity: z.number().min(0).max(1).describe('入场时的起始 / 离场时的最终不透明度'),
  fade: segmentSchema.describe('透明度变化的时间段（和位移分开，原片两者节奏不同）'),
  blur: z.number().min(0).describe('入场起始模糊（像素），离场不用'),
  blurEnd: z.number().describe('模糊消失的帧'),
});

const bubbleSchema = z.object({
  text: z.string(),
  highlight: z.string().describe('要高亮的那几个字，留空不高亮'),
  x: z.number().describe('气泡中心的横坐标（画布像素，640 = 居中）'),
  y: z.number().describe('停留时气泡中心的纵坐标（画布像素）'),
  enter: moveSchema,
  exit: moveSchema.describe('离场；开始帧超过总时长就不离场'),
});

export const dialogueShotSchema = z.object({
  image: z.string(),
  zoomImage: z.string(),
  camera: z.object({
    startScale: z.number().describe('开场放大倍数'),
    startRotation: z.number().describe('开场倾斜角度（度，正=顺时针）'),
    focusX: z.number().describe('开场特写对准底图的横坐标（画布像素）'),
    focusY: z.number().describe('开场特写对准底图的纵坐标（画布像素）'),
    restScale: z.number(),
    restRotation: z.number(),
    endScale: z.number().describe('推近后的倍数'),
    zoomOut: segmentSchema.describe('拉远（缩放）'),
    unrotate: segmentSchema.describe('拉远（回正旋转）'),
    pushIn: segmentSchema.describe('推近'),
    zoomImageFade: z.tuple([z.number(), z.number()]).describe('特写底图淡出的起止帧'),
  }),
  motionBlur: z.object({
    enabled: z.boolean(),
    shutter: z.number().min(0).max(2).describe('快门（1 = 一整帧）'),
    samples: z.number().int().min(2).max(24),
    minSpeed: z.number().describe('画面移动超过多少像素/帧才加模糊'),
  }),
  bubbleStyle: z.object({
    fontSize: z.number(),
    fontWeight: z.number().describe('字重：300 细 / 350 半细 / 400 常规'),
    textOffsetY: z.number().describe('文字上下微调（像素，负数往上）'),
    textBlur: z.number().min(0).describe('文字柔化（像素）：原片文字经过压缩和放大，比浏览器直出的软'),
    paddingX: z.number(),
    height: z.number(),
    radius: z.number(),
    fill: z.string().describe('气泡底色（CSS 颜色或渐变）'),
    borderTop: zColor(),
    borderBottom: zColor(),
    textColor: zColor(),
    highlightColor: zColor(),
    shadow: z.string(),
  }),
  bubbles: z.array(bubbleSchema),
  showPillarbox: z.boolean().describe('原片左右 4px 黑边'),
});

export type DialogueShotProps = z.infer<typeof dialogueShotSchema>;
export type BubbleSpec = z.infer<typeof bubbleSchema>;

// ── 时间函数 ──────────────────────────────────────────────────────────

function progress(t: number, seg: { start: number; end: number; easing: number[] }): number {
  const [x1, y1, x2, y2] = seg.easing;
  return interpolate(t, [seg.start, seg.end], [0, 1], {
    easing: Easing.bezier(x1, y1, x2, y2),
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
}

type Cam = { scale: number; rotation: number; tx: number; ty: number };

function cameraAt(t: number, c: DialogueShotProps['camera']): Cam {
  const pz = progress(t, c.zoomOut);
  const pr = progress(t, c.unrotate);
  const pp = progress(t, c.pushIn);
  // 拉远和推近是两段不重叠的动画：拉远结束后缩放停在 restScale，再从这里推近
  const scale = t < c.pushIn.start ? c.startScale + (c.restScale - c.startScale) * pz : c.restScale + (c.endScale - c.restScale) * pp;
  const rotation = c.startRotation + (c.restRotation - c.startRotation) * pr;
  // 开场让焦点落在屏幕中心，随拉远进度平移回来：屏幕 = 中心 + 平移 + s·R·(点 − 中心)
  const fx = c.focusX - 640;
  const fy = c.focusY - 360;
  const r = (rotation * Math.PI) / 180;
  const k = 1 - pz;
  const tx = -k * scale * (Math.cos(r) * fx - Math.sin(r) * fy);
  const ty = -k * scale * (Math.sin(r) * fx + Math.cos(r) * fy);
  return { scale, rotation, tx, ty };
}

type BubbleState = { dy: number; opacity: number; blur: number; visible: boolean };

// 入场和离场的位移是叠加的：原片气泡 2 还没完全停稳就开始上飞，两段动画有重叠
function bubbleAt(t: number, b: BubbleSpec): BubbleState {
  const visible = t >= b.enter.start && t <= b.exit.end;
  const dy = b.enter.distance * (1 - progress(t, b.enter)) + b.exit.distance * progress(t, b.exit);
  const fadeIn = b.enter.opacity + (1 - b.enter.opacity) * progress(t, b.enter.fade);
  const fadeOut = 1 + (b.exit.opacity - 1) * progress(t, b.exit.fade);
  const blurP = interpolate(t, [b.enter.start, Math.max(b.enter.blurEnd, b.enter.start + 0.01)], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  return { dy, opacity: Math.max(0, Math.min(1, fadeIn * fadeOut)), blur: b.enter.blur * blurP, visible };
}

// 画面上离中心最远的点在这一帧移动了多少像素，用来决定要不要加运动模糊
function cameraSpeed(t: number, c: DialogueShotProps['camera']): number {
  const a = cameraAt(t - 0.5, c);
  const b = cameraAt(t + 0.5, c);
  const r = Math.hypot(640, 360);
  const dRot = (Math.abs(b.rotation - a.rotation) * Math.PI) / 180;
  return Math.abs(b.scale - a.scale) * r + Math.max(a.scale, b.scale) * r * dRot;
}

function bubbleSpeed(t: number, bubbles: BubbleSpec[]): number {
  let v = 0;
  for (const b of bubbles) {
    const a = bubbleAt(t - 0.5, b);
    const c = bubbleAt(t + 0.5, b);
    if (a.visible || c.visible) v = Math.max(v, Math.abs(c.dy - a.dy));
  }
  return v;
}

// ── 组件 ──────────────────────────────────────────────────────────────

const Bubble: React.FC<{ spec: BubbleSpec; state: BubbleState; style: DialogueShotProps['bubbleStyle'] }> = ({
  spec,
  state,
  style,
}) => {
  if (!state.visible || state.opacity <= 0) return null;
  const parts = spec.highlight ? spec.text.split(spec.highlight) : [spec.text];
  return (
    <div
      style={{
        position: 'absolute',
        left: spec.x,
        top: spec.y + state.dy,
        transform: 'translate(-50%, -50%)',
        opacity: state.opacity,
        filter: state.blur > 0.05 ? `blur(${state.blur}px)` : undefined,
      }}
    >
      {/* 1px 渐变描边：外层渐变 + 1px 内边距，内层是气泡本体 */}
      <div
        style={{
          padding: 1,
          borderRadius: style.radius,
          background: `linear-gradient(${style.borderTop}, ${style.borderBottom})`,
          boxShadow: style.shadow,
        }}
      >
        <div
          style={{
            height: style.height - 2,
            borderRadius: style.radius - 1,
            background: style.fill,
            padding: `0 ${style.paddingX}px`,
            display: 'flex',
            alignItems: 'center',
            whiteSpace: 'nowrap',
            fontFamily: '"PingFang SC", "Noto Sans CJK SC", "Source Han Sans SC", "Microsoft YaHei", sans-serif',
            fontSize: style.fontSize,
            fontWeight: style.fontWeight,
            color: style.textColor,
            lineHeight: 1,
          }}
        >
          <span style={{ position: 'relative', top: style.textOffsetY, filter: style.textBlur > 0 ? `blur(${style.textBlur}px)` : undefined }}>
          {parts.map((p, i) => (
            <React.Fragment key={i}>
              {p}
              {i < parts.length - 1 && <span style={{ color: style.highlightColor }}>{spec.highlight}</span>}
            </React.Fragment>
          ))}
          </span>
        </div>
      </div>
    </div>
  );
};

/** 某一时刻（可以是小数帧）的完整画面：底图 + 气泡，整体按镜头缩放旋转 */
const World: React.FC<{ t: number; props: DialogueShotProps }> = ({ t, props }) => {
  const cam = cameraAt(t, props.camera);
  const [f0, f1] = props.camera.zoomImageFade;
  const zoomOpacity = props.zoomImage ? interpolate(t, [f0, f1], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }) : 0;
  return (
    <div
      style={{
        position: 'absolute',
        left: 0,
        top: 0,
        width: 1280,
        height: 720,
        transformOrigin: '640px 360px',
        transform: `translate(${cam.tx}px, ${cam.ty}px) rotate(${cam.rotation}deg) scale(${cam.scale})`,
      }}
    >
      <Img src={staticFile(props.image)} style={{ position: 'absolute', left: 0, top: 0, width: 1280, height: 720 }} />
      {zoomOpacity > 0 && (
        <Img
          src={staticFile(props.zoomImage)}
          style={{ position: 'absolute', left: 0, top: 0, width: 1280, height: 720, opacity: zoomOpacity }}
        />
      )}
      {props.bubbles.map((b, i) => (
        <Bubble key={i} spec={b} state={bubbleAt(t, b)} style={props.bubbleStyle} />
      ))}
    </div>
  );
};

// 原片左右黑边（缩放残留）：4 列纯黑 + 1 列约 30% 亮度 + 1 列轻微锐化亮边
const PILLAR: { x: number; color: string }[] = [
  ...[0, 1, 2, 3, 1276, 1277, 1278, 1279].map((x) => ({ x, color: '#000' })),
  { x: 4, color: 'rgba(0,0,0,0.68)' },
  { x: 1275, color: 'rgba(0,0,0,0.66)' },
  { x: 5, color: 'rgba(255,255,255,0.05)' },
  { x: 1274, color: 'rgba(255,255,255,0.08)' },
];

export const DialogueShot: React.FC<DialogueShotProps> = (props) => {
  const frame = useCurrentFrame();
  const mb = props.motionBlur;
  const fast = mb.enabled && Math.max(cameraSpeed(frame, props.camera), bubbleSpeed(frame, props.bubbles)) >= mb.minSpeed;
  const n = fast ? mb.samples : 1;
  // 运动模糊：在快门时间内取 n 个时刻叠起来。第 k 层不透明度 1/(k+1)，叠完正好是等权平均
  const times = n === 1 ? [frame] : Array.from({ length: n }, (_, k) => frame + mb.shutter * (k / (n - 1) - 0.5));
  return (
    <AbsoluteFill style={{ backgroundColor: '#000', overflow: 'hidden' }}>
      {times.map((t, k) => (
        <AbsoluteFill key={k} style={{ opacity: 1 / (k + 1) }}>
          <World t={t} props={props} />
        </AbsoluteFill>
      ))}
      {props.showPillarbox &&
        PILLAR.map((c) => (
          <div key={c.x} style={{ position: 'absolute', left: c.x, top: 0, width: 1, height: '100%', backgroundColor: c.color }} />
        ))}
    </AbsoluteFill>
  );
};
