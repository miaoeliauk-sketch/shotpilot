import React from 'react';
import { AbsoluteFill, Easing, Img, interpolate, useCurrentFrame } from 'remotion';
import { assetUrl } from '../asset';
import { useBundledFont } from '../fonts';
import { Media } from '../media';
import { vignetteGradient } from '../lens';
import { IconTile } from '../icon-red-words/IconRedWords';

/**
 * 复刻：中间一块白色 AI 图标，左右各一段说明（标题 + 三行字 + 一个小图）；镜头推到左边、切到右边、再拉回全景，
 * 最后背景变暗变虚，左右两个红字发着光亮起来（800 帧，1280×720 @30fps）
 *
 * 按原片量的（世界坐标 = 第 200 帧的画面，镜头 1 倍；镜头逐帧用 SIFT 对齐）：
 *   图标 468 见方、中心 (624, 328)、顺时针歪 12°；0–60 帧从下面翻上来（和「白色图标 · 两边红字」同一种）
 *   左边：标题 x 136、字身 y 122–205，压窄的粗宋、橙棕色；三行灰字 x 135 起、行距 56、字高 37；放大镜 (203, 440)
 *   右边：标题 x 878、字身 y 318–392，白色粗宋带灰影；三行蓝灰字 x 876 起、y 416 起、行距 54.5；大脑 (1072, 248)
 *   左右的字 10–36 帧从虚到实；放大镜从左下滑上来、大脑从上面滑下来（6–56 帧）
 *   镜头：开头 1.097 倍慢慢拉到 1 倍（200 帧）→ 254 帧切到左边特写（1.69 → 1.92 倍）→ 396 帧切到右边（1.745 → 2.09 倍）
 *     → 536 帧切回全景（1.02 → 1.097 倍）→ 之后慢慢拉远
 *   结尾：594 帧左边红字、650 帧右边红字，1 − e^(−t/14) 亮起来；背景和左右的字 596–616 帧变虚、604–672 帧变暗
 * 只复刻画面，底部口播字幕不在模板里。
 */

export type Side = { title: string; lines: string[]; image: string; red: string };

export type TwoSidesProps = {
  background: string;
  tileText: string;
  tileImage: string;
  left: Side;
  right: Side;
  leftAt: number;
  rightAt: number;
  backAt: number;
  redAt: number;
  redGap: number;
  vignette: boolean;
  durationInFrames: number;
};

const SERIF = '"Noto Serif CJK SC", "Songti SC", "STSong", "Source Han Serif SC", serif';
const SANS = '"Noto Sans CJK SC", "PingFang SC", "Source Han Sans SC", "Hiragino Sans GB", sans-serif';
const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;

export const TILE = { x: 624, y: 328, size: 468, rot: 12, textScale: 1.1 };
export const LEFT = { titleX: 136, titleTop: 122, titleH: 83, lineX: 135, lineTop: 228, pitch: 56, img: { x: 203, y: 440, w: 250, h: 190 }, red: { x: 100, y: 222, h: 190 } };
export const RIGHT = { titleX: 878, titleTop: 318, titleH: 74, lineX: 876, lineTop: 416, pitch: 54.5, img: { x: 1072, y: 248, w: 190, h: 170 }, red: { x: 928, y: 337, h: 184 } };
const LINE = { size: 36, squeeze: 0.76 };

type Cam = { s: number; x: number; y: number };
type Seg = { t: number[]; s: number[]; x: number[]; y: number[] };
const WIDE: Seg = {
  t: [0, 20, 40, 60, 80, 100, 140, 180, 200, 220, 240, 244, 248, 252, 253],
  s: [1.0967, 1.0951, 1.0906, 1.083, 1.0718, 1.0571, 1.0258, 1.0052, 1, 0.9976, 1.016, 1.0328, 1.061, 1.1024, 1.1132],
  x: [], y: [],
};
const CLOSE_L: Seg = {
  t: [0, 2, 4, 8, 12, 16, 26, 46, 86, 126, 136, 138, 139, 140, 141],
  s: [1.6931, 1.7107, 1.7234, 1.7381, 1.7436, 1.7455, 1.7485, 1.7622, 1.8157, 1.8931, 1.9126, 1.9153, 1.9172, 1.9179, 1.919],
  x: [1078.8, 1090.7, 1099.4, 1109.1, 1112.9, 1114, 1114.8, 1118.6, 1133.1, 1154.1, 1151.3, 1144.5, 1139.5, 1132.9, 1126.1],
  y: [538.7, 538.6, 538.5, 538.6, 538.7, 538.7, 539, 540.4, 545.9, 553.8, 555.8, 556.1, 556.3, 556.4, 556.4],
};
const CLOSE_R: Seg = {
  t: [0, 4, 14, 54, 104, 128, 134, 135, 136, 137, 138, 139],
  s: [1.7451, 1.7452, 1.7487, 1.8484, 2.0821, 2.0933, 2.0703, 2.0597, 2.0461, 2.0277, 2.0053, 1.9757],
  x: [186.2, 177.1, 172.3, 145.7, 83.1, 80.1, 86.3, 89.1, 92.8, 97.7, 103.7, 111.6],
  y: [248.4, 248.5, 248.1, 241.8, 226.7, 226.1, 227.6, 228.3, 228.9, 230.3, 231.7, 233.6],
};
const BACK: Seg = {
  t: [0, 2, 4, 8, 14, 24, 44, 64, 84, 104, 124, 144, 164, 204, 263],
  s: [1.0219, 1.0062, 0.9986, 0.9974, 1.0004, 1.0159, 1.077, 1.0969, 1.0946, 1.088, 1.0762, 1.0625, 1.0451, 1.0136, 0.9982],
  x: [], y: [],
};

function segCam(seg: Seg, t: number): Cam {
  return {
    s: interpolate(t, seg.t, seg.s, clamp),
    x: seg.x.length ? interpolate(t, seg.t, seg.x, clamp) : 640,
    y: seg.y.length ? interpolate(t, seg.t, seg.y, clamp) : 360,
  };
}

/** 镜头：全景（前面按「推到左边」的时间伸缩）→ 左边特写 → 右边特写 → 全景 */
export function camera(frame: number, leftAt: number, rightAt: number, backAt: number): Cam {
  if (frame < leftAt) return segCam(WIDE, (frame * 254) / Math.max(1, leftAt));
  if (frame < rightAt) return segCam(CLOSE_L, frame - leftAt);
  if (frame < backAt) return segCam(CLOSE_R, frame - rightAt);
  return segCam(BACK, frame - backAt);
}

/** 图标从下面翻上来（相对它最后的位置） */
const IN_T = [0, 20, 24, 28, 32, 36, 40, 44, 48, 52, 56, 60];
const IN_DY = [400, 385, 350, 305, 234, 161, 97, 58, 33, 17, 6, 0];
const IN_R = [-80, -55, -57, -50, -40, -24, -13.3, -9.9, -5.6, -2.8, -1.1, 0];
const IN_S = [1.2, 1.2, 1.2, 1.2, 1.18, 1.16, 1.116, 1.049, 1.028, 1.015, 1.006, 1];

export function tilePose(frame: number) {
  const f = (v: number[]) => interpolate(frame, IN_T, v, clamp);
  return { x: TILE.x, y: TILE.y + f(IN_DY), rot: TILE.rot + f(IN_R), s: f(IN_S), tilt: 0, opacity: interpolate(frame, [2, 14], [0, 1], clamp) };
}

/** 红字：1 − e^(−t/14) */
export function redProgress(frame: number, start: number): number {
  const t = frame - start;
  return t <= 0 ? 0 : 1 - Math.exp(-t / 14);
}

const camTransform = (c: Cam) => `translate(${(c.x - 640).toFixed(2)}px, ${(c.y - 360).toFixed(2)}px) scale(${c.s.toFixed(4)})`;

export const TwoSides: React.FC<TwoSidesProps> = (p) => {
  const frame = useCurrentFrame();
  useBundledFont('oswald');
  const cam = camera(frame, p.leftAt, p.rightAt, p.backAt);
  const textU = Easing.out(Easing.quad)(interpolate(frame, [10, 36], [0, 1], clamp));
  const slide = Easing.out(Easing.cubic)(interpolate(frame, [6, 56], [0, 1], clamp));
  const blur = interpolate(frame, [p.redAt + 2, p.redAt + 22], [0, 16], clamp);
  const dim = interpolate(frame, [p.redAt + 10, p.redAt + 78], [0, 1], clamp);
  const redL = redProgress(frame, p.redAt);
  const redR = redProgress(frame, p.redAt + p.redGap);
  return (
    <AbsoluteFill style={{ backgroundColor: '#8f8f8f', overflow: 'hidden' }}>
      <AbsoluteFill style={{ transformOrigin: '640px 360px', transform: camTransform(cam) }}>
        {/* 纸面：背景 + 左右的字（结尾一起变虚变暗） */}
        <AbsoluteFill style={{ filter: blur > 0.1 || dim > 0 ? `blur(${blur.toFixed(1)}px) brightness(${(1 - 0.5 * dim).toFixed(3)})` : undefined }}>
          <div style={{ position: 'absolute', left: -80, top: -45, width: 1440, height: 810 }}>
            <Media src={p.background} style={{ width: '100%', height: '100%' }} />
          </div>
          <Texts side={p.left} u={textU} layout={LEFT} tone="left" />
          <Texts side={p.right} u={textU} layout={RIGHT} tone="right" />
        </AbsoluteFill>
        {/* 小图 */}
        {p.left.image && (
          <div style={{ position: 'absolute', left: LEFT.img.x - LEFT.img.w / 2, top: LEFT.img.y - LEFT.img.h / 2, width: LEFT.img.w, height: LEFT.img.h, transform: `translate(${(-70 * (1 - slide)).toFixed(1)}px, ${(175 * (1 - slide)).toFixed(1)}px)`, opacity: Math.min(1, slide * 3) }}>
            <Img src={assetUrl(p.left.image)} style={{ width: '100%', height: '100%', objectFit: 'contain', filter: 'drop-shadow(8px 12px 10px rgba(0,0,0,0.35))' }} />
          </div>
        )}
        {p.right.image && (
          <div style={{ position: 'absolute', left: RIGHT.img.x - RIGHT.img.w / 2, top: RIGHT.img.y - RIGHT.img.h / 2, width: RIGHT.img.w, height: RIGHT.img.h, transform: `translate(${(-80 * (1 - slide)).toFixed(1)}px, ${(-190 * (1 - slide)).toFixed(1)}px)`, opacity: Math.min(1, slide * 3) }}>
            <Img src={assetUrl(p.right.image)} style={{ width: '100%', height: '100%', objectFit: 'contain', filter: 'drop-shadow(8px 12px 10px rgba(0,0,0,0.35))' }} />
          </div>
        )}
        {/* 红字 */}
        {p.left.red && <RedWord text={p.left.red} u={redL} box={LEFT.red} />}
        {p.right.red && <RedWord text={p.right.red} u={redR} box={RIGHT.red} />}
        <IconTile pose={tilePose(frame)} text={p.tileText} image={p.tileImage} size={TILE.size} textScale={TILE.textScale} />
      </AbsoluteFill>
      {p.vignette && <AbsoluteFill style={{ background: vignetteGradient({ cx: 640, cy: 360, rx: 740, ry: 460, amount: 0.34 + 0.3 * dim, power: 2.4 }) }} />}
    </AbsoluteFill>
  );
};

const Texts: React.FC<{ side: Side; u: number; layout: typeof LEFT | typeof RIGHT; tone: 'left' | 'right' }> = ({ side, u, layout, tone }) => {
  if (u <= 0) return null;
  const titleSize = layout.titleH / 0.9;
  return (
    <div style={{ position: 'absolute', inset: 0, opacity: u, filter: u < 0.98 ? `blur(${(6 * (1 - u)).toFixed(2)}px)` : undefined }}>
      <div
        style={{
          position: 'absolute', left: layout.titleX, top: layout.titleTop - titleSize * 0.18, height: titleSize * 1.2, lineHeight: `${titleSize * 1.2}px`, whiteSpace: 'pre',
          fontFamily: SERIF, fontWeight: 900, fontSize: titleSize, transform: 'scaleX(0.52)', transformOrigin: '0 50%',
          ...(tone === 'left' ? { color: '#b77b54' } : { color: '#f4f4f4', textShadow: '3px 4px 3px rgba(60,60,60,0.55)' }),
        }}
      >
        {side.title}
      </div>
      {side.lines.map((l, i) => (
        <div
          key={i}
          style={{
            position: 'absolute', left: layout.lineX, top: layout.lineTop + i * layout.pitch - 10, height: LINE.size * 1.4, lineHeight: `${LINE.size * 1.4}px`, whiteSpace: 'pre',
            fontFamily: SANS, fontWeight: 400, fontSize: LINE.size, transform: `scaleX(${LINE.squeeze})`, transformOrigin: '0 50%',
            color: tone === 'left' ? '#686868' : '#4d5f8c',
          }}
        >
          {l}
        </div>
      ))}
    </div>
  );
};

const RedWord: React.FC<{ text: string; u: number; box: { x: number; y: number; h: number } }> = ({ text, u, box }) => {
  if (u <= 0.005) return null;
  const size = box.h / 1.02;
  const glow = u * u;
  return (
    <div
      style={{
        position: 'absolute', left: box.x, top: box.y - size * 0.13, height: size * 1.3, lineHeight: `${size * 1.3}px`, whiteSpace: 'pre', fontFamily: SERIF, fontWeight: 900, fontSize: size,
        color: '#f1302e', transform: 'scaleX(0.66)', transformOrigin: '0 50%', opacity: Math.min(1, u * 1.15),
        textShadow: `0 0 ${(3 + 3 * glow).toFixed(1)}px rgba(255,40,30,${(0.8 * glow).toFixed(2)}), 0 0 ${(12 + 8 * glow).toFixed(1)}px rgba(255,20,10,${(0.5 * glow).toFixed(2)})`,
        filter: u < 0.985 ? `blur(${(16 * (1 - u)).toFixed(2)}px)` : undefined,
      }}
    >
      {text}
    </div>
  );
};
