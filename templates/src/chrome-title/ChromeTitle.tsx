import React from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { vignetteGradient } from '../lens';
import { Media } from '../media';

/**
 * 复刻：暗暗的视频画面上，一行金属拉丝质感的斜体大标题，上面一行疏排的小字、下面一行等宽英文，整组慢慢放大（76 帧，1280×720 @30fps）
 *
 * 按原片量的（第 40 帧、1 倍）：
 *   大标题：黑体加粗 148px（再描 6px 同色边加粗）、横向拉宽 1.2、往右斜 12°，字身 x 267–1013、y 281–428；
 *     金属色：上亮下暗（#f2f4f4 → 浅蓝灰 #ccd7ec → #b3b3b3 → #9d9d96），细密的拉丝纹，边上一点红蓝错色
 *   上面小字 27px 浅灰、字距 32，从 x 542 起、字底 251；下面英文等宽 26px、字距 7.4，x 464 起、字底 488
 *   整组以画面中心匀速放大：第 0 帧 0.950 倍，每帧 +0.00128（第 75 帧 1.046）
 *   背景：暗的视频画面（压暗），四周暗角
 * 只复刻画面，底部口播字幕不在模板里。
 */

export type ChromeTitleProps = {
  background: string;
  title: string;
  top: string;
  sub: string;
  dim: number;
  vignette: boolean;
  durationInFrames: number;
};

const SANS = '"Noto Sans CJK SC", "PingFang SC", "Source Han Sans SC", "Hiragino Sans GB", sans-serif';
const MONO = '"DejaVu Sans Mono", Menlo, Monaco, "Courier New", monospace';

export const TITLE = { size: 148, stretch: 1.2, skew: -12, baseline: 409, center: 640, stroke: 6 };
export const TOP = { size: 27, spacing: 32.5, baseline: 248 };
export const SUB = { size: 26, spacing: 7.4, baseline: 488, shift: -6 };

/** 整组的缩放（以画面中心） */
export function groupScale(frame: number): number {
  return 0.9497 + 0.001283 * frame;
}


export const ChromeTitle: React.FC<ChromeTitleProps> = (p) => {
  const frame = useCurrentFrame();
  const s = groupScale(frame);
  return (
    <AbsoluteFill style={{ backgroundColor: '#070707', overflow: 'hidden' }}>
      {p.background && (
        <AbsoluteFill style={{ filter: `brightness(${p.dim.toFixed(2)})` }}>
          <Media src={p.background} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />
        </AbsoluteFill>
      )}
      {p.vignette && <AbsoluteFill style={{ background: vignetteGradient({ cx: 640, cy: 360, rx: 760, ry: 470, amount: 0.55, power: 2.2 }) }} />}
      <AbsoluteFill style={{ transformOrigin: '640px 360px', transform: `scale(${s.toFixed(4)})` }}>
        {p.top && (
          <div style={{ position: 'absolute', left: 0, width: 1280, top: TOP.baseline - TOP.size * 0.9, textAlign: 'center', whiteSpace: 'pre', fontFamily: SANS, fontWeight: 500, fontSize: TOP.size, lineHeight: 1, letterSpacing: TOP.spacing, paddingLeft: TOP.spacing, color: '#d2d2d2' }}>
            {p.top}
          </div>
        )}
        {p.title && <ChromeText text={p.title} />}
        {p.sub && (
          <div style={{ position: 'absolute', left: SUB.shift, width: 1280, top: SUB.baseline - SUB.size * 0.77, textAlign: 'center', whiteSpace: 'pre', fontFamily: MONO, fontSize: SUB.size, lineHeight: 1, letterSpacing: SUB.spacing, paddingLeft: SUB.spacing, color: '#d6d6d6' }}>
            {p.sub}
          </div>
        )}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

/**
 * 金属字：SVG 文字，填色和描边用同一个上亮下暗的渐变（描边把笔画加粗，像原片那种粗壮的标题字），
 * 上面再压一层细密的拉丝纹；后面垫一红一蓝两份错开 2px 的字当错色边，再加一层暗影
 */
const ChromeText: React.FC<{ text: string }> = ({ text }) => {
  const t = TITLE;
  const x = t.center / t.stretch;
  const common = { x, y: t.baseline, textAnchor: 'middle' as const, fontFamily: SANS, fontWeight: 900, fontSize: t.size, strokeLinejoin: 'round' as const };
  const tr = `translate(${t.center} ${t.baseline}) skewX(${t.skew}) translate(${-t.center} ${-t.baseline}) scale(${t.stretch} 1)`;
  return (
    <svg width={1280} height={720} style={{ position: 'absolute', left: 0, top: 0, overflow: 'visible' }}>
      <defs>
        <linearGradient id="ct-chrome" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#f6f7f7" /><stop offset="0.2" stopColor="#eceff2" /><stop offset="0.42" stopColor="#c9d4ea" />
          <stop offset="0.62" stopColor="#b6b6b6" /><stop offset="0.82" stopColor="#aaaaa5" /><stop offset="1" stopColor="#8f8f88" />
        </linearGradient>
        {/* 拉丝纹：斜着的细纹，随机深浅（SVG 噪点拉长） */}
        <filter id="ct-brushf" x="0" y="0" width="100%" height="100%">
          <feTurbulence type="fractalNoise" baseFrequency="0.9 0.012" numOctaves={2} seed={5} />
          <feColorMatrix values="0 0 0 0 0.5  0 0 0 0 0.5  0 0 0 0 0.5  1.6 0 0 0 -0.75" />
        </filter>
        <filter id="ct-shadow" x="-10%" y="-30%" width="120%" height="160%"><feDropShadow dx="0" dy="6" stdDeviation="6" floodColor="#000" floodOpacity="0.55" /></filter>
      </defs>
      <g transform={tr} filter="url(#ct-shadow)">
        <text {...common} dx={-2 / t.stretch} fill="rgb(255,70,70)" stroke="rgb(255,70,70)" strokeWidth={t.stroke} opacity={0.45}>{text}</text>
        <text {...common} dx={2 / t.stretch} fill="rgb(70,200,255)" stroke="rgb(70,200,255)" strokeWidth={t.stroke} opacity={0.45}>{text}</text>
        <text {...common} fill="url(#ct-chrome)" stroke="url(#ct-chrome)" strokeWidth={t.stroke}>{text}</text>
        <mask id="ct-mask"><text {...common} fill="#fff" stroke="#fff" strokeWidth={t.stroke}>{text}</text></mask>
        <g mask="url(#ct-mask)" style={{ mixBlendMode: 'multiply' }}>
          <rect x={-200} y={t.baseline - t.size} width={1700} height={t.size * 1.3} filter="url(#ct-brushf)" transform={`rotate(-4 ${t.center} ${t.baseline})`} opacity={0.55} />
        </g>
      </g>
    </svg>
  );
};
