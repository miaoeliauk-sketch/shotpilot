import React from 'react';
import { AbsoluteFill, Img, interpolate, useCurrentFrame } from 'remotion';
import { assetUrl } from '../asset';
import { BUNDLED_FONTS, useBundledFont } from '../fonts';
import { Media } from '../media';
import { vignetteGradient } from '../lens';

/**
 * 复刻：白色圆角图标从下面翻上来、立住后歪一点；左右两边红字发着光一个一个淡进来（164 帧，1280×720 @30fps）
 *
 * 按原片量的（逐帧跟踪图标的四个角）：
 *   图标 473×473 圆角方块，最后停在 (667, 318)、顺时针歪 16.4°
 *     0–24 帧：从画面下面（中心 y≈790）往上翻，先是上沿朝着镜头、半透明、大一圈，逆时针斜 24° → 摆正
 *     24–45 帧：继续往上走、顺时针转到 16.4°，越来越慢；之后很慢地缩小（160 帧 0.983 倍）
 *   红字：粗黑体（Bold）压窄（0.69），#f73130，外面一圈红光；从虚到实、光越来越强，约 34 帧（1 − e^(−t/14)）
 *     左边的字右边对齐到 x 358，右边的字左边对齐到 x 938，字心 y≈377
 *   暗带：画面中间一条横的暗带（上沿 y≈100–125、下沿 y≈600–620，两头往外翘），两边暗、靠图标的地方淡；
 *     跟着字一起出来：左半从左边扫进来，右半从中间往右扫
 * 背景墙不动。只复刻画面，底部口播字幕不在模板里。
 */

export type IconRedWordsProps = {
  background: string;
  iconText: string;
  iconImage: string;
  left: string;
  right: string;
  leftAt: number;
  rightAt: number;
  vignette: boolean;
  durationInFrames: number;
};

const SANS = '"Noto Sans CJK SC", "PingFang SC", "Source Han Sans SC", "Hiragino Sans GB", sans-serif';
const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;

export const ICON = { size: 473, radius: 104, x: 667, y: 318, rot: 16.4 };
export const WORDS = { size: 187, squeeze: 0.69, baseline: 440, leftEdge: 358, rightEdge: 938, weight: 700, color: '#f73130' };

const POSE_T = [0, 4, 8, 12, 16, 20, 22, 24, 26, 28, 30, 32, 34, 36, 38, 40, 45, 50, 60, 100, 160];
const POSE_Y = [800, 780, 752, 715, 668, 592, 533, 480, 438, 402, 377, 358, 345, 335, 328, 323, 318.5, 318, 318, 318, 319];
const POSE_X = [668, 664, 660, 656, 656, 658, 661, 666, 667, 667, 667, 667, 667, 667, 667, 667, 667, 667, 667, 667, 667];
const POSE_R = [-24, -22.5, -21, -19, -16, -10, -5, 0.5, 3.3, 6.7, 9.4, 11.5, 13.2, 14.3, 15.2, 15.8, 16.3, 16.4, 16.4, 16.4, 16.4];
const POSE_S = [1.12, 1.11, 1.1, 1.095, 1.085, 1.065, 1.05, 1.035, 1.03, 1.02, 1.019, 1.013, 1.01, 1.008, 1.006, 1.005, 1.003, 1.002, 1, 0.9915, 0.983];
/** 上沿朝着镜头的倾斜（rotateX，负数 = 上沿往前） */
const POSE_TILT = [-18, -17, -16, -14, -12, -8, -5, -3, -1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];

export function iconPose(frame: number) {
  const f = (v: number[]) => interpolate(frame, POSE_T, v, clamp);
  return { x: f(POSE_X), y: f(POSE_Y), rot: f(POSE_R), s: f(POSE_S), tilt: f(POSE_TILT), opacity: interpolate(frame, [0, 10], [0.3, 1], clamp) };
}

/** 字淡进来的进度：1 − e^(−t/14)，34 帧基本到位 */
export function wordProgress(frame: number, start: number): number {
  const t = frame - start;
  return t <= 0 ? 0 : 1 - Math.exp(-t / 14);
}

/** 暗带扫进来的位置（软边的中点，x） */
export function bandEdge(frame: number, start: number, from: number): number {
  return from + 17 * Math.max(0, frame - start);
}

export const IconRedWords: React.FC<IconRedWordsProps> = (p) => {
  const frame = useCurrentFrame();
  useBundledFont('oswald');
  const pose = iconPose(frame);
  const uL = wordProgress(frame, p.leftAt);
  const uR = wordProgress(frame, p.rightAt);
  // 暗带比字早 8 帧开始扫
  const eL = bandEdge(frame, p.leftAt - 8, -330);
  const eR = bandEdge(frame, p.rightAt - 8, 600);
  return (
    <AbsoluteFill style={{ backgroundColor: '#9a9a9a', overflow: 'hidden' }}>
      <Media src={p.background} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />
      <DarkBand edgeLeft={p.left ? eL : -1e4} edgeRight={p.right ? eR : -1e4} />
      {p.left && <RedWord text={p.left} u={uL} align="right" />}
      {p.right && <RedWord text={p.right} u={uR} align="left" />}
      <IconTile pose={pose} text={p.iconText} image={p.iconImage} />
      {p.vignette && <AbsoluteFill style={{ background: vignetteGradient({ cx: 640, cy: 360, rx: 760, ry: 470, amount: 0.42, power: 2.6 }) }} />}
    </AbsoluteFill>
  );
};

/** 中间一条横的暗带：两头往外翘；左右两半各自从软边扫进来 */
const DarkBand: React.FC<{ edgeLeft: number; edgeRight: number }> = ({ edgeLeft, edgeRight }) => {
  const soft = 450;
  const path = 'M -20 100 Q 640 150 1300 100 L 1300 628 Q 640 568 -20 628 Z';
  if (edgeLeft < -soft / 2 && edgeRight < 600 - soft / 2) return null;
  return (
    <svg width={1280} height={720} style={{ position: 'absolute', left: 0, top: 0 }}>
      <defs>
        <linearGradient id="irw-shade" x1="0" x2="1280" y1="0" y2="0" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#000" stopOpacity="0.47" />
          <stop offset="0.24" stopColor="#000" stopOpacity="0.47" />
          <stop offset="0.3" stopColor="#000" stopOpacity="0.27" />
          <stop offset="0.35" stopColor="#000" stopOpacity="0.14" />
          <stop offset="0.5" stopColor="#000" stopOpacity="0.1" />
          <stop offset="0.7" stopColor="#000" stopOpacity="0.47" />
          <stop offset="0.92" stopColor="#000" stopOpacity="0.44" />
          <stop offset="1" stopColor="#000" stopOpacity="0.33" />
        </linearGradient>
        <linearGradient id="irw-left" x1={edgeLeft - soft / 2} x2={edgeLeft + soft / 2} y1="0" y2="0" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#fff" />
          <stop offset="1" stopColor="#000" />
        </linearGradient>
        <linearGradient id="irw-right" x1={edgeRight - soft / 2} x2={edgeRight + soft / 2} y1="0" y2="0" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#fff" />
          <stop offset="1" stopColor="#000" />
        </linearGradient>
        <mask id="irw-mask" maskUnits="userSpaceOnUse" x="0" y="0" width="1280" height="720">
          <rect x="0" y="0" width="660" height="720" fill="url(#irw-left)" />
          <rect x="620" y="0" width="660" height="720" fill="url(#irw-right)" />
        </mask>
        <filter id="irw-soft" x="-5%" y="-10%" width="110%" height="120%">
          <feGaussianBlur stdDeviation="5" />
        </filter>
      </defs>
      <g mask="url(#irw-mask)">
        <path d={path} fill="url(#irw-shade)" filter="url(#irw-soft)" />
        {/* 上下沿一道淡淡的反光 */}
        <path d="M -20 628 Q 640 568 1300 628" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth={2.5} filter="url(#irw-soft)" />
        <path d="M -20 100 Q 640 150 1300 100" fill="none" stroke="rgba(225,235,255,0.3)" strokeWidth={2} filter="url(#irw-soft)" />
      </g>
    </svg>
  );
};

const RedWord: React.FC<{ text: string; u: number; align: 'left' | 'right' }> = ({ text, u, align }) => {
  if (u <= 0.005) return null;
  const { size, squeeze, baseline, color } = WORDS;
  const top = baseline - size * 1.08;
  const glow = u * u;
  return (
    <div
      style={{
        position: 'absolute', top, height: size * 1.4, lineHeight: `${size * 1.4}px`,
        ...(align === 'right' ? { right: 1280 - WORDS.leftEdge, transformOrigin: '100% 50%' } : { left: WORDS.rightEdge, transformOrigin: '0 50%' }),
        fontFamily: SANS, fontWeight: WORDS.weight, fontSize: size, color, whiteSpace: 'pre', transform: `scaleX(${squeeze})`, opacity: Math.min(1, u * 1.15),
        textShadow: `0 0 ${(3 + 3 * glow).toFixed(1)}px rgba(255,40,30,${(0.8 * glow).toFixed(2)}), 0 0 ${(12 + 8 * glow).toFixed(1)}px rgba(255,20,10,${(0.45 * glow).toFixed(2)})`,
        filter: u < 0.985 ? `blur(${(16 * (1 - u)).toFixed(2)}px)` : undefined,
      }}
    >
      {text}
    </div>
  );
};

/** 白色圆角图标：有厚度（右下一圈灰边）、投影；里面是字或者一张图 */
export const IconTile: React.FC<{ pose: ReturnType<typeof iconPose>; text: string; image: string; size?: number; textScale?: number }> = ({ pose, text, image, size = ICON.size, textScale = 1 }) => {
  const radius = (ICON.radius * size) / ICON.size;
  const k = (size / ICON.size) * textScale;
  return (
    <div style={{ position: 'absolute', left: 0, top: 0, width: 1280, height: 720, perspective: 1400, perspectiveOrigin: `${pose.x}px ${pose.y}px` }}>
      <div
        style={{
          position: 'absolute', left: pose.x - size / 2, top: pose.y - size / 2, width: size, height: size, opacity: pose.opacity,
          transform: `rotate(${pose.rot.toFixed(2)}deg) rotateX(${pose.tilt.toFixed(2)}deg) scale(${pose.s.toFixed(4)})`,
        }}
      >
        {/* 厚度 + 投影 */}
        <div style={{ position: 'absolute', inset: 0, borderRadius: radius, background: '#b9bcbd', transform: 'translate(7px, 10px)', boxShadow: '14px 22px 34px rgba(0,0,0,0.38)' }} />
        <div
          style={{
            position: 'absolute', inset: 0, borderRadius: radius, overflow: 'hidden',
            background: 'linear-gradient(170deg, #fbfcfc 0%, #f1f2f2 55%, #e2e4e4 100%)',
            boxShadow: 'inset -5px -7px 10px rgba(0,0,0,0.10), inset 4px 4px 6px rgba(255,255,255,0.9)',
          }}
        >
          {image ? (
            <Img src={assetUrl(image)} style={{ position: 'absolute', inset: '12%', width: '76%', height: '76%', objectFit: 'contain' }} />
          ) : (
            <div
              style={{
                position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontFamily: `"${BUNDLED_FONTS.oswald.family}", ${SANS}`, fontWeight: 300, fontSize: 375 * k, lineHeight: 1, color: '#5a5a5a',
                letterSpacing: -8, paddingRight: 26, paddingTop: 4, textShadow: '2px 3px 0 #2e2e2e',
              }}
            >
              {text}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
