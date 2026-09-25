import React, { useMemo } from 'react';
import { AbsoluteFill, Easing, interpolate, random, useCurrentFrame } from 'remotion';
import { Media } from '../media';
import { layoutBody, type BodyChar } from '../text-layout';

/**
 * 复刻：深色背景上，白 + 金两行标题闪出来，下面两段正文快速打出来（129 帧，1280×720 @30fps）
 *
 * ── 结构（第 119 帧量的，镜头不动）────────────────────────────────────
 *   标题第一行  粗宋 52px（第一行宽 966），灰白，左边 155，字身 y 111–174
 *   标题第二行  粗宋 52px，金色 (253,203,65)，左边 155，y 197–253
 *   英文        斜体衬线 15px，灰，x 259 起，y 275–289
 *   金色弧线    从左边 y 250 拱到中间 y 226 再落到右边 y 250，像地平线；右边那段（x 850 以后）更亮
 *   正文        黑体 26px、字距 1（这样换行位置和原片一模一样），行距 39.5，段间多空 12，左边 62，首行缩进两字；
 *               重点句是淡金色、加粗；第二段后面垫一片半色调网点
 *
 * ── 动作 ─────────────────────────────────────────────────────────────
 *   标题  每个字在第 0–8 帧里随机时间闪出来（4 帧淡入，从很虚变清楚），
 *         同时整行字距从挤在一起（−0.16 字）慢慢松开到正常（16 帧），第 10 帧最亮，之后回落
 *   弧线  左边那段第 2–6 帧淡入；右边亮的那段第 74–86 帧从左往右画出来
 *   正文  第 19 帧开始打字，每帧 4.5 个字，段与段之间停 3 帧，末尾一个光标
 *
 * 全画面有一点色差（红青错开）。只复刻画面，底部口播字幕不在模板里。
 */

export type VerdictParagraph = { text: string; highlight: string };

export type VerdictTitleProps = {
  background: string;
  title1: string;
  title2: string;
  english: string;
  paragraphs: VerdictParagraph[];
  gold: string;
  titleAt: number;
  typeAt: number;
  charsPerFrame: number;
  arcAt: number;
  durationInFrames: number;
};

const SERIF = '"Songti SC", "STSong", "Noto Serif CJK SC", "Source Han Serif SC", serif';
const SANS = '"PingFang SC", "Noto Sans CJK SC", "Source Han Sans SC", "Hiragino Sans GB", sans-serif';
const LATIN = '"Georgia", "Times New Roman", serif';

const TITLE = { left: 155, line1: 142, line2: 225, size: 52.5 };
export const BODY = { left: 62, right: 1220, firstCenter: 350.5, size: 26, lineHeight: 39.5, paragraphGap: 12, indent: 2.23, letterSpacing: 1 };
const PARAGRAPH_PAUSE = 3;

const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;

/** 第 i 个正文字（按段落顺序数）开始出现的帧，相对开始打字 */
export function charAt(c: { paragraph: number }, globalIndex: number, perFrame: number): number {
  return globalIndex / perFrame + c.paragraph * PARAGRAPH_PAUSE;
}

export const VerdictTitle: React.FC<VerdictTitleProps> = (p) => {
  const frame = useCurrentFrame();
  const layout = useMemo(
    () => layoutBody(p.paragraphs.map((x) => ({ text: x.text, highlight: x.highlight && x.text.includes(x.highlight) ? x.highlight : '' })), BODY, SANS),
    [p.paragraphs],
  );
  const t = frame - p.titleAt;
  // 字距从挤到松；整体亮度第 10 帧最亮
  const spacing = -0.16 * (1 - Easing.out(Easing.cubic)(interpolate(t, [0, 16], [0, 1], clamp)));
  const flash = interpolate(t, [4, 10, 20], [1, 1.55, 1], clamp);
  const typed = (frame - p.typeAt) ;
  const shownChars = layout.chars.filter((c, i) => typed >= charAt(c, i, p.charsPerFrame));
  const last = shownChars[shownChars.length - 1];
  const done = shownChars.length === layout.chars.length;

  return (
    <AbsoluteFill style={{ backgroundColor: '#161616', overflow: 'hidden' }}>
      <Media src={p.background} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />
      <Arc frame={frame} arcAt={p.arcAt} titleAt={p.titleAt} gold={p.gold} />

      {/* 原片的字边有点软，还有一点红青色差 */}
      <AbsoluteFill style={{ filter: 'blur(0.5px) drop-shadow(-1.5px 0 0 rgba(220,40,40,0.45)) drop-shadow(1.5px 0 0 rgba(40,170,230,0.4))' }}>
        {t >= 0 && (
          <div style={{ filter: `brightness(${flash.toFixed(3)})` }}>
            <TitleLine text={p.title1} top={TITLE.line1} color="#b4b1b4" t={t} spacing={spacing} seed="a" />
            <TitleLine text={p.title2} top={TITLE.line2} color={p.gold} t={t} spacing={spacing} seed="b" />
            <div
              style={{
                position: 'absolute', left: 259, top: 272, fontFamily: LATIN, fontStyle: 'italic', fontWeight: 700, fontSize: 15, color: '#6f6c68',
                whiteSpace: 'pre', opacity: interpolate(t, [4, 12], [0, 1], clamp), letterSpacing: `${spacing * 2}em`,
              }}
            >
              {p.english}
            </div>
          </div>
        )}

        {/* 第二段后面的半色调网点 */}
        {p.paragraphs.length > 1 && (
          <div
            style={{
              position: 'absolute', left: 60, top: 452, width: 1160, height: 92, opacity: 0.2 * interpolate(frame - p.typeAt, [20, 30], [0, 1], clamp),
              backgroundImage: 'radial-gradient(circle, rgba(200,200,200,0.9) 1.6px, transparent 2px)', backgroundSize: '9px 9px',
              WebkitMaskImage: 'linear-gradient(to right, transparent, #000 15%, #000 85%, transparent)', maskImage: 'linear-gradient(to right, transparent, #000 15%, #000 85%, transparent)',
            }}
          />
        )}

        {shownChars.map((c, i) => <Glyph key={i} c={c} gold={p.gold} />)}
        {last && !done && (
          <div style={{ position: 'absolute', left: last.x + last.width, top: last.center - 12, width: 2, height: 24, backgroundColor: '#d8d8d8' }} />
        )}
      </AbsoluteFill>
      <AbsoluteFill style={{ background: 'radial-gradient(ellipse 75% 80% at 50% 45%, rgba(0,0,0,0) 55%, rgba(0,0,0,0.45) 100%)' }} />
    </AbsoluteFill>
  );
};

/** 标题一行：每个字在 0–8 帧里随机时间闪出来 */
const TitleLine: React.FC<{ text: string; top: number; color: string; t: number; spacing: number; seed: string }> = ({ text, top, color, t, spacing, seed }) => (
  <div
    style={{
      position: 'absolute', left: TITLE.left, top: top - TITLE.size * 0.6, height: TITLE.size * 1.2, display: 'flex', alignItems: 'center',
      fontFamily: SERIF, fontWeight: 900, fontSize: TITLE.size, lineHeight: 1, color, whiteSpace: 'pre', letterSpacing: `${spacing}em`,
    }}
  >
    {Array.from(text).map((ch, i) => {
      const start = random(`${seed}-${i}`) * 8;
      const q = interpolate(t, [start, start + 4], [0, 1], clamp);
      const blur = 9 * (1 - Easing.out(Easing.quad)(interpolate(t, [start, start + 12], [0, 1], clamp)));
      return (
        <span key={i} style={{ opacity: q, filter: blur > 0.05 ? `blur(${blur.toFixed(2)}px)` : undefined }}>{ch}</span>
      );
    })}
  </div>
);

const Glyph: React.FC<{ c: BodyChar; gold: string }> = ({ c, gold }) => (
  <span
    style={{
      position: 'absolute', left: c.x, top: c.center - BODY.lineHeight / 2 - BODY.size * 0.05, lineHeight: `${BODY.lineHeight}px`,
      fontFamily: SANS, fontSize: BODY.size, fontWeight: c.highlight ? 700 : 400, whiteSpace: 'pre',
      color: c.highlight ? mixGold(gold) : '#b3b2b0',
    }}
  >
    {c.ch}
  </span>
);

/** 正文里的金色比标题淡：和白色对半混 */
function mixGold(hex: string): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m?.[1]) return hex;
  const v = parseInt(m[1], 16);
  const ch = (s: number) => Math.round((((v >> s) & 255) + 225) / 2);
  return `rgb(${ch(16)},${ch(8)},${ch(0)})`;
}

/** 金色弧线：左边一段一开始就有，右边亮的那段后来从左往右画出来 */
const Arc: React.FC<{ frame: number; arcAt: number; titleAt: number; gold: string }> = ({ frame, arcAt, titleAt, gold }) => {
  const left = interpolate(frame - titleAt, [2, 6], [0, 1], clamp);
  const right = Easing.out(Easing.cubic)(interpolate(frame, [arcAt, arcAt + 12], [0, 1], clamp));
  const d = 'M -20 252 Q 640 200 1300 252';
  return (
    <svg width={1280} height={720} style={{ position: 'absolute', left: 0, top: 0 }}>
      <defs>
        <linearGradient id="vt-arc-left" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor={gold} stopOpacity={0.9} />
          <stop offset="0.12" stopColor={gold} stopOpacity={0.5} />
          <stop offset="0.3" stopColor={gold} stopOpacity={0} />
        </linearGradient>
        <linearGradient id="vt-arc-right" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0.62" stopColor={gold} stopOpacity={0} />
          <stop offset="0.72" stopColor="#fff3c8" stopOpacity={1} />
          <stop offset="0.9" stopColor={gold} stopOpacity={0.8} />
          <stop offset="1" stopColor={gold} stopOpacity={0.2} />
        </linearGradient>
        <linearGradient id="vt-horizon" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#3a3833" stopOpacity={0.55} />
          <stop offset="1" stopColor="#1a1a1a" stopOpacity={0} />
        </linearGradient>
        <filter id="vt-glow"><feGaussianBlur stdDeviation="2.2" /></filter>
      </defs>
      <path d={`${d} L 1300 520 L -20 520 Z`} fill="url(#vt-horizon)" opacity={left} />
      <path d={d} fill="none" stroke="url(#vt-arc-left)" strokeWidth={2.5} opacity={left} />
      <path d={d} fill="none" stroke="url(#vt-arc-left)" strokeWidth={6} opacity={left * 0.5} filter="url(#vt-glow)" />
      {right > 0 && (
        <g style={{ clipPath: `inset(0 ${(1 - right) * (1280 - 800)}px 0 0)` }}>
          <path d={d} fill="none" stroke="url(#vt-arc-right)" strokeWidth={2.5} />
          <path d={d} fill="none" stroke="url(#vt-arc-right)" strokeWidth={7} opacity={0.6} filter="url(#vt-glow)" />
        </g>
      )}
    </svg>
  );
};
