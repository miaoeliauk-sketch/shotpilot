import React from 'react';
import { AbsoluteFill, interpolate, useCurrentFrame } from 'remotion';
import { BUNDLED_FONTS, useBundledFont } from '../fonts';
import { Media } from '../media';

/**
 * 复刻：暗暗的视频画面上，一行金属拉丝的大标题从上面落下来，一团烟雾从左往右扫过字；
 * 然后标题放大、往下挪，上面淡出一行疏排的小字；最后整个画面往下甩走（133 帧，1280×720 @30fps）
 *
 * 按原片量的（世界坐标 = 第 123 帧、1 倍）：
 *   标题：方正的无衬线体 170px、字距 −3，居中，字身 x 124–1151、y 351–481（字底 478）；金属色上亮下暗、细拉丝纹、红蓝错色边
 *   小字：40px 浅灰、字距 10，居中，y 253–292
 *   镜头（以世界点 (640, 415) 为准）：第 8–30 帧标题从上面落下来（越落越快，落 187），同时淡进来；
 *     30–80 帧 0.746 倍停在屏幕 y 321；80–105 帧放大到 0.99、挪到 y 400；123 帧 1 倍 y 415；
 *     小字第 90–102 帧从虚到实；123 帧起整个往下甩（带竖向动态模糊）
 *   烟雾：第 20–50 帧一团白烟从左（世界 x 430）扫到右（1010），再慢慢飘到 1100 散掉；经过的地方字散开（露出背景）
 * 只复刻画面，底部口播字幕不在模板里。
 */

export type MarathonTitleProps = {
  background: string;
  title: string;
  tagline: string;
  dim: number;
  whip: boolean;
  vignette: boolean;
  durationInFrames: number;
};

const SANS = '"Noto Sans CJK SC", "PingFang SC", "Source Han Sans SC", "Hiragino Sans GB", sans-serif';
const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;

export const TITLE = { size: 170, spacing: -3, baseline: 478, center: 640 };
export const TAG = { size: 40, spacing: 10, baseline: 287 };

const CAM_T = [30, 40, 50, 60, 70, 80, 85, 88, 91, 94, 97, 100, 105, 110, 120, 123];
const CAM_S = [0.7456, 0.7478, 0.7501, 0.7533, 0.7554, 0.7598, 0.7742, 0.7902, 0.8182, 0.8803, 0.9422, 0.9688, 0.9886, 0.9957, 0.999, 1];
const CAM_Y = [321, 320.9, 320.9, 320.8, 320.5, 321.1, 325.6, 330.9, 340.6, 362.4, 383.9, 393, 399.6, 401.5, 405.7, 415];
const DROP_T = [8, 10, 12, 14, 16, 18, 20, 22, 24, 26, 28, 30];
const DROP_Y = [-183, -180, -176, -169, -161, -151, -139, -124, -105, -81, -48, 0];
const WHIP_T = [0, 3, 5, 7, 9, 10];
const WHIP_Y = [0, 10, 35, 60, 93, 150];

/** 世界点 (640, 415) 在屏幕上的 y，和缩放；exitAt = 开始往下甩的帧 */
export function camera(frame: number, exitAt: number) {
  const s = interpolate(frame, CAM_T, CAM_S, clamp);
  const y = interpolate(frame, CAM_T, CAM_Y, clamp) + (frame < 30 ? interpolate(frame, DROP_T, DROP_Y, clamp) : 0);
  const whip = frame > exitAt ? interpolate(frame - exitAt, WHIP_T, WHIP_Y, { extrapolateLeft: 'clamp', extrapolateRight: 'extend' }) : 0;
  return { s, y, whip };
}

/** 标题淡进来的程度 */
export function titleIn(frame: number): number {
  return interpolate(frame, [10, 28], [0, 1], clamp);
}

export const MarathonTitle: React.FC<MarathonTitleProps> = (p) => {
  const frame = useCurrentFrame();
  useBundledFont('barlow');
  const exitAt = p.whip ? p.durationInFrames - 10 : 1e9;
  const cam = camera(frame, exitAt);
  const u = titleIn(frame);
  const tagU = interpolate(frame, [90, 102], [0, 1], clamp);
  const smokeX = interpolate(frame, [20, 30, 40, 50, 70, 86], [430, 560, 800, 1010, 1060, 1100], clamp);
  const smokeA = interpolate(frame, [20, 26, 72, 88], [0, 0.95, 0.85, 0], clamp);
  const whipBlur = Math.min(40, (cam.whip - interpolate(frame - 1 - exitAt, WHIP_T, WHIP_Y, { extrapolateLeft: 'clamp', extrapolateRight: 'extend' })) * 0.25);
  return (
    <AbsoluteFill style={{ backgroundColor: '#050505', overflow: 'hidden' }}>
      <AbsoluteFill style={{ transform: `translateY(${cam.whip.toFixed(1)}px)`, filter: whipBlur > 0.5 ? `blur(${(whipBlur / 4).toFixed(1)}px)` : undefined }}>
        {p.background && (
          <AbsoluteFill style={{ filter: `brightness(${p.dim.toFixed(2)})` }}>
            <Media src={p.background} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />
          </AbsoluteFill>
        )}
        {p.vignette && <AbsoluteFill style={{ background: 'radial-gradient(ellipse 780px 480px at 640px 360px, rgba(0,0,0,0) 45%, rgba(0,0,0,0.55) 100%)' }} />}
        <AbsoluteFill style={{ transformOrigin: '640px 415px', transform: `translateY(${(cam.y - 415).toFixed(1)}px) scale(${cam.s.toFixed(4)})` }}>
          {p.tagline && tagU > 0 && (
            <div style={{ position: 'absolute', left: 0, width: 1280, top: TAG.baseline - TAG.size * 0.86, textAlign: 'center', whiteSpace: 'pre', fontFamily: SANS, fontSize: TAG.size, lineHeight: 1, letterSpacing: TAG.spacing, paddingLeft: TAG.spacing, color: '#d8d8d8', opacity: tagU, filter: tagU < 0.98 ? `blur(${(6 * (1 - tagU)).toFixed(1)}px)` : undefined }}>
              {p.tagline}
            </div>
          )}
          {p.title && u > 0 && <MetalText text={p.title} opacity={u} hole={smokeA > 0 ? { x: smokeX - 40, a: smokeA } : null} />}
          {smokeA > 0 && <Smoke x={smokeX} y={425} opacity={smokeA} />}
        </AbsoluteFill>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

/** 金属拉丝字：上亮下暗的渐变 + 竖向细纹，后面垫红蓝错色 */
const MetalText: React.FC<{ text: string; opacity: number; hole: { x: number; a: number } | null }> = ({ text, opacity, hole }) => {
  const t = TITLE;
  const common = { x: t.center, y: t.baseline, textAnchor: 'middle' as const, fontFamily: `"${BUNDLED_FONTS.barlow.family}", "Barlow", "Helvetica Neue", Arial, sans-serif`, fontSize: t.size, letterSpacing: t.spacing };
  return (
    <svg width={1280} height={720} style={{ position: 'absolute', left: 0, top: 0, overflow: 'visible', opacity }}>
      <defs>
        <linearGradient id="mt-metal" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fbfbfb" /><stop offset="0.3" stopColor="#e9ecef" /><stop offset="0.55" stopColor="#c3c7cc" />
          <stop offset="0.8" stopColor="#a4a6a8" /><stop offset="1" stopColor="#8b8c8c" />
        </linearGradient>
        <filter id="mt-brush" x="0" y="0" width="100%" height="100%">
          <feTurbulence type="fractalNoise" baseFrequency="0.9 0.02" numOctaves={2} seed={3} />
          <feColorMatrix values="0 0 0 0 0.5  0 0 0 0 0.5  0 0 0 0 0.5  1.5 0 0 0 -0.72" />
        </filter>
        <mask id="mt-mask"><text {...common} fill="#fff">{text}</text></mask>
        <filter id="mt-glow" x="-10%" y="-40%" width="120%" height="180%"><feDropShadow dx="0" dy="0" stdDeviation="6" floodColor="#fff" floodOpacity="0.25" /></filter>
        {/* 烟雾经过的地方字散掉 */}
        <radialGradient id="mt-hole-g"><stop offset="0.3" stopColor="#000" /><stop offset="1" stopColor="#000" stopOpacity="0" /></radialGradient>
        <mask id="mt-hole" maskUnits="userSpaceOnUse" x={-200} y={-200} width={1680} height={1120}>
          <rect x={-200} y={-200} width={1680} height={1120} fill="#fff" />
          {hole && <ellipse cx={hole.x} cy={t.baseline - t.size * 0.36} rx={120} ry={85} fill="url(#mt-hole-g)" opacity={hole.a} />}
        </mask>
      </defs>
      <g mask="url(#mt-hole)">
      <g filter="url(#mt-glow)">
        <text {...common} dx={-2.5} fill="rgb(255,90,70)" opacity={0.55}>{text}</text>
        <text {...common} dx={2.5} fill="rgb(80,170,255)" opacity={0.55}>{text}</text>
        <text {...common} fill="url(#mt-metal)">{text}</text>
      </g>
      <g mask="url(#mt-mask)" style={{ mixBlendMode: 'multiply' }}>
        <rect x={0} y={t.baseline - t.size} width={1280} height={t.size * 1.1} filter="url(#mt-brush)" opacity={0.6} transform={`rotate(90 640 ${t.baseline - t.size / 2}) scale(1 1)`} />
      </g>
      </g>
    </svg>
  );
};

/** 一团白烟：SVG 噪点做的云，外面渐隐 */
const Smoke: React.FC<{ x: number; y: number; opacity: number }> = ({ x, y, opacity }) => (
  <svg width={1280} height={720} style={{ position: 'absolute', left: 0, top: 0, overflow: 'visible', opacity, mixBlendMode: 'screen' }}>
    <defs>
      <filter id="mt-smoke" x="-50%" y="-50%" width="200%" height="200%">
        <feTurbulence type="fractalNoise" baseFrequency="0.018" numOctaves={4} seed={7} />
        <feColorMatrix values="0 0 0 0 0.92  0 0 0 0 0.92  0 0 0 0 0.92  0 0 0 2.2 -0.55" />
        <feGaussianBlur stdDeviation="3" />
      </filter>
      <radialGradient id="mt-smoke-fade"><stop offset="0.35" stopColor="#fff" /><stop offset="1" stopColor="#fff" stopOpacity="0" /></radialGradient>
      <mask id="mt-smoke-mask"><ellipse cx={x} cy={y} rx={170} ry={110} fill="url(#mt-smoke-fade)" /></mask>
    </defs>
    <g mask="url(#mt-smoke-mask)">
      <rect x={x - 200} y={y - 140} width={400} height={280} filter="url(#mt-smoke)" />
    </g>
  </svg>
);
