import React from 'react';
import { AbsoluteFill, Easing, Img, interpolate, useCurrentFrame } from 'remotion';
import { assetUrl } from '../asset';
import { BUNDLED_FONTS, useBundledFont } from '../fonts';
import { Media } from '../media';
import { vignetteGradient } from '../lens';

/**
 * 复刻：灰墙上两组压窄的大字 + 一本册子飞进来 → 拉远，右边两个灰圆各一句说明 → 圆淡掉，放大镜从右下移进来，镜片里一个大数字滚出来（444 帧，1280×720 @30fps）
 *
 * 按原片量的（世界坐标 = 第 200 帧的画面，镜头 1 倍）：
 *   大字：中粗黑体压到 0.48，字身高 235；第一组 x 82 起、第二组 x 435 起，字身 y 234–469；深灰、有点立体
 *     一个字一个字从虚到实淡进来：第一组第 6、10 帧（10 帧），第二组第 32、36 帧（18 帧）
 *   册子：中心 (345, 360)、224×290 的框，默认斜 −8°；第 10 帧从下面飞上来、边转边摆正（26 帧，先快后慢）
 *   开头只有字和册子被放大 1.75 倍、对着左边（墙几乎不动）；第 50–70 帧拉回来（先慢后快再慢）
 *   镜头（以画面中心）：70 帧 1.05 倍 → 200 帧 1 倍 → 320 帧 0.979 倍 → 440 帧 1.078 倍（放大镜出来后推近）
 *   两个圆：(1031, 221) r161、(832, 491) r146，灰色半透明；圆里一个大的粗宋斜体词 + 两行小字 + 一行淡淡的英文手写
 *     第 58、78 帧：先出字（从虚到实 8 帧），6 帧后圆淡进来；第 306 帧起一起淡掉（18 帧）
 *   放大镜：镜片中心 (919, 314)、外圈半径 230，银白镜框，手柄朝右下；第 306 帧从下面移上来（34 帧，先快后慢）
 *     第 336 帧镜片里的数字滚动着数上去（12 帧，带竖向拖影），Oswald 粗体压到 0.6、高 223
 * 只复刻画面，底部口播字幕不在模板里。
 */

export type Bubble = { title: string; line1: string; line2: string; script: string };

export type WordMagnifierProps = {
  background: string;
  word1: string;
  word2: string;
  book: string;
  bookTilt: number;
  bubbles: Bubble[];
  number: string;
  bubblesAt: number;
  magnifierAt: number;
  vignette: boolean;
  durationInFrames: number;
};

const SANS = '"Noto Sans CJK SC", "PingFang SC", "Source Han Sans SC", "Hiragino Sans GB", sans-serif';
const SERIF = '"Noto Serif CJK SC", "Songti SC", "STSong", "Source Han Serif SC", serif';
const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;

export const WORDS = { size: 246, squeeze: 0.48, baseline: 445, x1: 82, x2: 435 };
export const BOOK = { x: 345, y: 360, w: 224, h: 290 };
export const CIRCLES = [
  { x: 1031, y: 221, r: 161 },
  { x: 832, y: 491, r: 146 },
];
export const LENS = { x: 919, y: 314, r: 230 };
const NUMBER = { size: 264, squeeze: 0.6 };

/** 背景（墙）的镜头：开头几乎不动，70 帧后和前景一起 */
const CAM_T = [0, 60, 70, 80, 90, 100, 120, 140, 160, 180, 200, 220, 260, 300, 320, 330, 340, 348, 356, 360, 380, 400, 420, 440];
const CAM_S = [1.02, 1.041, 1.0503, 1.0464, 1.0414, 1.0374, 1.0289, 1.0209, 1.0132, 1.0063, 1, 0.994, 0.9848, 0.9795, 0.9791, 0.9799, 0.9827, 0.9864, 0.9922, 0.9959, 1.0326, 1.064, 1.0753, 1.0778];
/** 开头前景（字、册子）单独放大：屏幕 = c + s·(世界 − 中心)（逐帧量「案」字的框） */
const FG_T = [0, 16, 24, 30, 40, 50, 52, 54, 56, 58, 60, 62, 64, 66, 70];
const FG_S = [1.755, 1.755, 1.752, 1.747, 1.735, 1.709, 1.684, 1.628, 1.535, 1.39, 1.2415, 1.152, 1.097, 1.0714, 1.0503];
const FG_X = [1075, 1075, 1075, 1075, 1070, 1057.5, 1041.5, 1005.4, 947.3, 854.6, 759.6, 702.9, 668, 651.7, 640];
const FG_Y = [427, 417, 394, 381, 374, 372.8, 372.7, 371.7, 370, 366.8, 364.1, 361.8, 360.9, 360.7, 360];

export function bgCamera(frame: number) {
  return { s: interpolate(frame, CAM_T, CAM_S, clamp), x: 640, y: 360 };
}

export function fgCamera(frame: number) {
  if (frame >= 70) return bgCamera(frame);
  return { s: interpolate(frame, FG_T, FG_S, clamp), x: interpolate(frame, FG_T, FG_X, clamp), y: interpolate(frame, FG_T, FG_Y, clamp) };
}

const camTransform = (c: { s: number; x: number; y: number }) => `translate(${(c.x - 640).toFixed(2)}px, ${(c.y - 360).toFixed(2)}px) scale(${c.s.toFixed(4)})`;

/** 一个字淡进来的进度 */
export function charIn(frame: number, start: number, dur: number): number {
  return Easing.inOut(Easing.quad)(interpolate(frame, [start, start + dur], [0, 1], clamp));
}

/** 数字滚上去：目标数字前面的数按比例、滚动中带拖影 */
export function rollingNumber(frame: number, start: number, target: string): { text: string; blur: number } {
  const u = interpolate(frame, [start, start + 12], [0, 1], clamp);
  const n = Number(target.replace(/[^\d]/g, ''));
  if (!Number.isFinite(n) || n === 0 || u >= 1) return { text: target, blur: 0 };
  const v = Math.round(n * Easing.out(Easing.cubic)(u));
  return { text: String(v), blur: 10 * (1 - u) };
}

export const WordMagnifier: React.FC<WordMagnifierProps> = (p) => {
  const frame = useCurrentFrame();
  useBundledFont('oswald');
  useBundledFont('vibes');
  const bg = bgCamera(frame);
  const fg = fgCamera(frame);
  const bookU = Easing.out(Easing.cubic)(interpolate(frame, [10, 36], [0, 1], clamp));
  const bubblesOut = interpolate(frame, [p.magnifierAt, p.magnifierAt + 18], [1, 0], clamp);
  const lensU = Easing.out(Easing.cubic)(interpolate(frame, [p.magnifierAt, p.magnifierAt + 34], [0, 1], clamp));
  const num = rollingNumber(frame, p.magnifierAt + 30, p.number);
  const w1 = Array.from(p.word1);
  const w2 = Array.from(p.word2);
  const adv = WORDS.size * WORDS.squeeze;
  return (
    <AbsoluteFill style={{ backgroundColor: '#9d9d9d', overflow: 'hidden' }}>
      <AbsoluteFill style={{ transformOrigin: '640px 360px', transform: camTransform(bg) }}>
        <div style={{ position: 'absolute', left: -60, top: -34, width: 1400, height: 788 }}>
          <Media src={p.background} style={{ width: '100%', height: '100%' }} />
        </div>
      </AbsoluteFill>
      <AbsoluteFill style={{ transformOrigin: '640px 360px', transform: camTransform(fg) }}>
        {w1.map((ch, i) => (
          <BigChar key={`a${i}`} ch={ch} x={WORDS.x1 + i * adv} u={charIn(frame, 6 + i * 4, 10)} />
        ))}
        {w2.map((ch, i) => (
          <BigChar key={`b${i}`} ch={ch} x={WORDS.x2 + i * adv} u={charIn(frame, 32 + i * 4, 18)} />
        ))}
        {/* 册子 */}
        {frame >= 10 && p.book && (
          <div
            style={{
              position: 'absolute', left: BOOK.x - BOOK.w / 2, top: BOOK.y - BOOK.h / 2, width: BOOK.w, height: BOOK.h,
              transform: `translate(${(40 * (1 - bookU)).toFixed(1)}px, ${(260 * (1 - bookU)).toFixed(1)}px) rotate(${(p.bookTilt - 32 * (1 - bookU)).toFixed(2)}deg)`,
              opacity: Math.min(1, bookU * 4), filter: 'drop-shadow(8px 12px 12px rgba(0,0,0,0.35))',
            }}
          >
            <Img src={assetUrl(p.book)} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
          </div>
        )}
        {/* 两个灰圆 */}
        {bubblesOut > 0.01 &&
          p.bubbles.slice(0, 2).map((b, i) => <Circle key={i} bubble={b} c={CIRCLES[i]!} frame={frame} at={p.bubblesAt + i * 20} fade={bubblesOut} />)}
        {/* 放大镜 */}
        {lensU > 0 && (
          <div style={{ position: 'absolute', left: 0, top: 0, width: 1280, height: 720, transform: `translate(${(120 * (1 - lensU)).toFixed(1)}px, ${(430 * (1 - lensU)).toFixed(1)}px)` }}>
            <Magnifier />
            {frame >= p.magnifierAt + 30 && (
              <div
                style={{
                  position: 'absolute', left: LENS.x - 300, width: 600, top: LENS.y - NUMBER.size * 0.62 - 9, height: NUMBER.size * 1.24, lineHeight: `${NUMBER.size * 1.24}px`,
                  textAlign: 'center', whiteSpace: 'pre', fontFamily: `"${BUNDLED_FONTS.oswald.family}", ${SANS}`, fontWeight: 700, fontSize: NUMBER.size, color: '#262626',
                  transform: `scaleX(${NUMBER.squeeze}) translateY(${(-40 * (num.blur / 10)).toFixed(1)}px)`, opacity: Math.min(1, (frame - p.magnifierAt - 30) / 4),
                  textShadow: '3px 5px 0 #0d0d0d, 6px 12px 14px rgba(0,0,0,0.35)', filter: num.blur > 0.2 ? `blur(${num.blur.toFixed(1)}px)` : undefined,
                }}
              >
                {num.text}
              </div>
            )}
          </div>
        )}
      </AbsoluteFill>
      {p.vignette && <AbsoluteFill style={{ background: vignetteGradient({ cx: 640, cy: 360, rx: 760, ry: 470, amount: 0.34, power: 2.4 }) }} />}
    </AbsoluteFill>
  );
};

/** 压窄的粗黑体大字：深灰渐变、左上一道亮边、右下一层暗边当厚度 */
const BigChar: React.FC<{ ch: string; x: number; u: number }> = ({ ch, x, u }) => {
  if (u <= 0) return null;
  const { size, squeeze, baseline } = WORDS;
  const common: React.CSSProperties = {
    position: 'absolute', left: 0, top: 0, height: size * 1.2, lineHeight: `${size * 1.2}px`, whiteSpace: 'pre', fontFamily: SANS, fontWeight: 500, fontSize: size,
  };
  return (
    <div
      style={{
        position: 'absolute', left: x, top: baseline - size * 1.02, width: size, height: size * 1.2, transform: `scaleX(${squeeze})`, transformOrigin: '0 50%', opacity: u,
        filter: u < 0.98 ? `blur(${(8 * (1 - u)).toFixed(2)}px)` : undefined,
      }}
    >
      <div style={{ ...common, left: 5, top: 5, color: 'rgba(20,20,20,0.55)', filter: 'blur(3px)' }}>{ch}</div>
      <div style={{ ...common, left: 2, top: 2, color: '#1f1f1f' }}>{ch}</div>
      <div
        style={{
          ...common, color: 'transparent', backgroundImage: 'linear-gradient(to bottom, #5e5e5e 0%, #3c3c3c 45%, #4e4e4e 100%)', WebkitBackgroundClip: 'text', backgroundClip: 'text',
        }}
      >
        {ch}
      </div>
    </div>
  );
};

const Circle: React.FC<{ bubble: Bubble; c: { x: number; y: number; r: number }; frame: number; at: number; fade: number }> = ({ bubble, c, frame, at, fade }) => {
  const t = frame - at;
  if (t < 0) return null;
  const textU = Easing.out(Easing.quad)(interpolate(t, [0, 8], [0, 1], clamp));
  const discU = interpolate(t, [6, 18], [0, 1], clamp);
  const sub: React.CSSProperties = { position: 'absolute', whiteSpace: 'pre', fontFamily: SANS, fontSize: 34, lineHeight: 1, color: '#2d2d2d' };
  return (
    <div style={{ position: 'absolute', left: c.x - c.r, top: c.y - c.r, width: c.r * 2, height: c.r * 2, opacity: fade }}>
      <div
        style={{
          position: 'absolute', inset: 0, borderRadius: '50%', opacity: discU, transform: `scale(${(0.92 + 0.08 * discU).toFixed(3)})`,
          background: 'radial-gradient(circle at 38% 32%, rgba(200,200,200,0.55), rgba(150,150,150,0.6) 62%, rgba(110,110,110,0.7) 100%)',
          boxShadow: '10px 14px 24px rgba(0,0,0,0.28), inset -8px -10px 18px rgba(0,0,0,0.12)',
        }}
      />
      <div style={{ position: 'absolute', inset: 0, opacity: textU, filter: textU < 0.98 ? `blur(${(6 * (1 - textU)).toFixed(2)}px)` : undefined }}>
        {bubble.script && (
          <div
            style={{
              position: 'absolute', left: c.r - 150, top: c.r - 10, fontFamily: `"${BUNDLED_FONTS.vibes.family}", cursive`, fontSize: 92, color: 'rgba(60,60,60,0.32)',
              whiteSpace: 'pre', transform: 'rotate(-14deg)',
            }}
          >
            {bubble.script}
          </div>
        )}
        <div
          style={{
            position: 'absolute', left: c.r - 113, top: c.r - 128, height: 170, lineHeight: '170px', whiteSpace: 'pre', fontFamily: SERIF, fontWeight: 900, fontSize: 142,
            color: '#1e1e1e', transform: 'skewX(-9deg) scaleX(0.64)', transformOrigin: '0 50%',
          }}
        >
          {bubble.title}
        </div>
        {bubble.line1 && <div style={{ ...sub, left: c.r - 23, top: c.r + 24 }}>{bubble.line1}</div>}
        {bubble.line2 && <div style={{ ...sub, left: c.r - 110, top: c.r + 72 }}>{bubble.line2}</div>}
      </div>
    </div>
  );
};

/** 放大镜：银色镜框、镜片里亮一点、手柄朝右下 */
const Magnifier: React.FC = () => {
  const { x, y, r } = LENS;
  const ang = 32;
  const rad = (ang * Math.PI) / 180;
  const hx = x + Math.cos(rad) * (r - 6);
  const hy = y + Math.sin(rad) * (r - 6);
  return (
    <>
      {/* 手柄 */}
      <div
        style={{
          position: 'absolute', left: hx, top: hy - 34, width: 360, height: 68, transformOrigin: '0 50%', transform: `rotate(${ang}deg)`,
          filter: 'drop-shadow(8px 14px 12px rgba(0,0,0,0.4))',
        }}
      >
        <div style={{ position: 'absolute', left: 0, top: 14, width: 70, height: 40, background: 'linear-gradient(to bottom, #f2f2f2, #9a9a9a 55%, #d8d8d8)' }} />
        <div
          style={{
            position: 'absolute', left: 64, top: 0, width: 300, height: 68, borderRadius: 30,
            background: 'repeating-linear-gradient(to right, #1a1a1a 0 14px, #2e2e2e 14px 18px), linear-gradient(to bottom, #3a3a3a, #0e0e0e)',
            backgroundBlendMode: 'multiply',
          }}
        />
      </div>
      {/* 镜片 */}
      <div
        style={{
          position: 'absolute', left: x - r, top: y - r, width: r * 2, height: r * 2, borderRadius: '50%',
          background: 'radial-gradient(circle at 45% 40%, rgba(255,255,255,0.28), rgba(255,255,255,0.12) 60%, rgba(0,0,0,0.08) 100%)',
          boxShadow: 'inset 0 0 0 22px #ececec, inset 0 0 0 25px #a8a8a8, inset 4px 6px 0 22px #fbfbfb, inset -6px -8px 18px 22px rgba(0,0,0,0.16), 0 0 0 3px #c9c9c9, 10px 18px 26px rgba(0,0,0,0.38)',
        }}
      />
    </>
  );
};
