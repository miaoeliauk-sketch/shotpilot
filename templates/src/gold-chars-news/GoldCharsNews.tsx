import React, { useMemo } from 'react';
import { AbsoluteFill, Easing, interpolate, random, useCurrentFrame } from 'remotion';
import { BUNDLED_FONTS, useBundledFont } from '../fonts';
import { Media } from '../media';
import { layoutBody, measure, type BodyChar } from '../text-layout';
import { vignetteGradient } from '../lens';

/**
 * 复刻：三个金色大字围着一张纸，金色大圆升起来 → 背景暗下去、纸掉走 → 深色新闻页，标题闪进来、正文一行行出来（281 帧，1280×720 @30fps）
 *
 * 按原片量的：
 *   浅灰墙（斜的窗影）。纸（假判案例 + 木槌）从下面飞上来，0–8 帧，停在中间偏左一点、斜 −5°
 *   三个金色大字：粗、斜一点、金色渐变 + 深色投影；像金粉一样一条条从上面落下来拼成字（10 帧），
 *     旁边粗宋黑字的说明一个字一个字打出来，下面一行灰色斜体英文
 *     案 (62–239, 276–519) 第 8 帧；法 (416–559, 22–241) 第 26 帧；理 (788–935, 210–419) 第 58 帧
 *   金色大圆（中心 660, 811，半径 608）第 44 帧从下面升起来，12 帧
 *   第 156 帧起背景暗下去（四周先黑），160–168 帧纸往下掉走、圆和说明淡掉，金字留着发光，172–180 帧淡掉
 *   新闻页（第 184 帧起）：深色底；两行白色粗宋标题（一段是金色），横着错开几条、红蓝错位闪进来（14 帧）；
 *     下面一行英文、一条细线；正文浅灰宋体 37px 一行行从左往右出来，引用的句子是橙色、下面画橙线；
 *     最后一段越往下越暗
 * 只复刻画面，底部口播字幕不在模板里。
 */

export type GoldChar = { char: string; label: string; english: string; at: number };

export type GoldCharsNewsProps = {
  wall: string;
  paper: string;
  chars: GoldChar[];
  discAt: number;
  darkAt: number;
  newsAt: number;
  title1: string;
  titleGold: string;
  title2: string;
  english: string;
  body: string;
  highlight: string;
  body2: string;
  durationInFrames: number;
};

const SERIF = '"Noto Serif CJK SC", "Songti SC", "STSong", "Source Han Serif SC", serif';
const GOLD_FONT = `"${BUNDLED_FONTS.oswald.family}", ${SERIF}`;
const LATIN = '"Georgia", "Times New Roman", serif';
const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;

/** 三个金字的位置：字的左上角、字号，说明文字的位置（原片量的） */
export const SLOTS = [
  { x: 54, y: 256, size: 264, squeeze: 0.68, labelX: 220, labelY: 307, enX: 265, enY: 370 },
  { x: 415, y: 2, size: 222, squeeze: 0.61, labelX: 572, labelY: 48, enX: 572, enY: 110 },
  { x: 792, y: 190, size: 188, squeeze: 0.6, labelX: 946, labelY: 232, enX: 948, enY: 294 },
];
export const DISC = { x: 660, y: 811, r: 608 };
const PAPER = { x: 400, y: 160, w: 410, h: 540, rot: -5 };
const BODY = { left: 77, right: 1195, firstCenter: 350, size: 38.5, lineHeight: 58, paragraphGap: 0, indent: 1.8 };

/** 金粉落下：一个字切成几条竖条，每条带着拖影从上面落下来（10 帧），落地的先后随机 */
export function stripProgress(frame: number, at: number, i: number, n: number): number {
  const delay = random(`strip-${i}-${n}`) * 6;
  return Easing.out(Easing.cubic)(interpolate(frame, [at + delay, at + delay + 8], [0, 1], clamp));
}

export const GoldCharsNews: React.FC<GoldCharsNewsProps> = (p) => {
  const frame = useCurrentFrame();
  useBundledFont('oswald');
  const dark = interpolate(frame, [p.darkAt, p.darkAt + 12], [0, 1], clamp);
  const paperIn = Easing.out(Easing.cubic)(interpolate(frame, [0, 8], [0, 1], clamp));
  const paperOut = Easing.in(Easing.quad)(interpolate(frame, [p.darkAt + 4, p.darkAt + 12], [0, 1], clamp));
  const disc = Easing.out(Easing.cubic)(interpolate(frame, [p.discAt, p.discAt + 12], [0, 1], clamp));
  const sideFade = 1 - interpolate(frame, [p.darkAt + 6, p.darkAt + 14], [0, 1], clamp);
  const charFade = 1 - interpolate(frame, [p.darkAt + 16, p.darkAt + 24], [0, 1], clamp);
  const news = frame >= p.newsAt;
  return (
    // 暗下去：墙和圆淡掉，露出下面的深灰底；纸、金字、说明留在上面
    <AbsoluteFill style={{ background: 'radial-gradient(ellipse 75% 75% at 50% 45%, #242424, #1a1a1a 70%, #111)', overflow: 'hidden' }}>
      {!news && (
        <>
          <AbsoluteFill style={{ opacity: 1 - dark }}>
            <div style={{ position: 'absolute', left: -60, top: -40, width: 1400, height: 800 }}>
              <Media src={p.wall} style={{ width: '100%', height: '100%' }} />
            </div>
            {disc > 0 && (
              <div
                style={{
                  position: 'absolute', left: DISC.x - DISC.r, top: DISC.y - DISC.r + (1 - disc) * 500, width: DISC.r * 2, height: DISC.r * 2, borderRadius: '50%',
                  background: 'radial-gradient(circle at 50% 35%, #e9cf8a 0%, #dcb865 55%, #c99d45 100%)', opacity: 0.92,
                }}
              />
            )}
          </AbsoluteFill>
          {/* 纸 */}
          {paperOut < 1 && (
            <div
              style={{
                position: 'absolute', left: PAPER.x, top: PAPER.y + (1 - paperIn) * 520 + paperOut * 560, width: PAPER.w, height: PAPER.h,
                transform: `rotate(${PAPER.rot + (1 - paperIn) * 12 + paperOut * 14}deg) scale(${0.8 + 0.2 * paperIn})`, filter: 'drop-shadow(0 16px 20px rgba(0,0,0,0.35))',
              }}
            >
              <Media src={p.paper} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
            </div>
          )}
          {p.chars.slice(0, 3).map((c, i) => (
            <React.Fragment key={i}>
              <GoldChar c={c} slot={SLOTS[i]!} frame={frame} opacity={charFade} glow={dark} />
              <Label c={c} slot={SLOTS[i]!} frame={frame} opacity={sideFade} />
            </React.Fragment>
          ))}
        </>
      )}
      {news && <NewsPage p={p} t={frame - p.newsAt} />}
    </AbsoluteFill>
  );
};

const GoldChar: React.FC<{ c: GoldChar; slot: (typeof SLOTS)[number]; frame: number; opacity: number; glow: number }> = ({ c, slot, frame, opacity, glow }) => {
  if (frame < c.at || opacity <= 0 || !c.char) return null;
  const n = 9;
  const w = slot.size * 1.05 * slot.squeeze;
  const style: React.CSSProperties = {
    position: 'absolute', left: 0, top: 0, width: w, height: slot.size * 1.1, lineHeight: `${slot.size}px`, fontFamily: SERIF, fontWeight: 900, fontSize: slot.size,
    color: 'transparent', backgroundImage: 'linear-gradient(to bottom, #fff0b0 5%, #f7c542 45%, #e39322 80%, #f5c957 100%)', WebkitBackgroundClip: 'text', backgroundClip: 'text',
    transform: 'skewX(-9deg)', whiteSpace: 'pre',
  };
  return (
    <div
      style={{
        position: 'absolute', left: slot.x, top: slot.y, width: w, height: slot.size * 1.1, opacity,
        filter: `drop-shadow(5px 8px 5px rgba(60,40,10,${0.55 - 0.3 * glow})) drop-shadow(0 0 ${(14 * glow).toFixed(1)}px rgba(255,190,70,${0.6 * glow}))`,
      }}
    >
      {Array.from({ length: n }, (_, i) => {
        const u = stripProgress(frame, c.at, i, n);
        if (u <= 0) return null;
        const x0 = (i / n) * 100;
        const x1 = ((i + 1) / n) * 100;
        const clip = `inset(0 ${(100 - x1).toFixed(2)}% 0 ${x0.toFixed(2)}%)`;
        return (
          <div key={i} style={{ position: 'absolute', inset: 0, clipPath: clip, WebkitClipPath: clip }}>
            <div style={{ ...style, width: slot.size * 1.05, transform: `translateY(${(-(1 - u) * slot.size * 1.2).toFixed(1)}px) scaleY(${1 + (1 - u) * 1.6}) scaleX(${slot.squeeze}) skewX(-9deg)`, transformOrigin: '0 100%', opacity: 0.4 + 0.6 * u }}>
              {c.char}
            </div>
          </div>
        );
      })}
    </div>
  );
};

/** 说明：粗宋黑字一个字一个字打出来，下面一行灰色斜体英文淡进来 */
const Label: React.FC<{ c: GoldChar; slot: (typeof SLOTS)[number]; frame: number; opacity: number }> = ({ c, slot, frame, opacity }) => {
  const t = frame - c.at - 2;
  if (t < 0 || opacity <= 0) return null;
  const chars = Array.from(c.label);
  const shown = Math.min(chars.length, Math.floor(t / 2.5) + 1);
  return (
    <div style={{ opacity }}>
      <div style={{ position: 'absolute', left: slot.labelX, top: slot.labelY - 8, height: 66, lineHeight: '66px', fontFamily: SERIF, fontWeight: 900, fontSize: 50, color: '#161310', whiteSpace: 'pre' }}>
        {chars.slice(0, shown).join('')}
      </div>
      {c.english && (
        <div style={{ position: 'absolute', left: slot.enX, top: slot.enY - 14, fontFamily: LATIN, fontStyle: 'italic', fontSize: 23, color: 'rgba(70,64,55,0.85)', whiteSpace: 'pre', opacity: interpolate(t, [chars.length * 2.5, chars.length * 2.5 + 8], [0, 1], clamp) }}>
          {c.english}
        </div>
      )}
    </div>
  );
};

/** 重点句每行下面一条线（从这一行第一个标橙的字画到最后一个） */
export function underlinesByLine(chars: BodyChar[]): { line: number; x0: number; x1: number; center: number }[] {
  const out = new Map<number, { line: number; x0: number; x1: number; center: number }>();
  for (const c of chars) {
    if (!c.highlight) continue;
    const u = out.get(c.line);
    if (u) u.x1 = Math.max(u.x1, c.x + c.width);
    else out.set(c.line, { line: c.line, x0: c.x, x1: c.x + c.width, center: c.center });
  }
  return [...out.values()];
}

/** 深色新闻页 */
const NewsPage: React.FC<{ p: GoldCharsNewsProps; t: number }> = ({ p, t }) => {
  const layout = useMemo(() => layoutBody([{ text: p.body, highlight: p.highlight }], BODY, SERIF), [p.body, p.highlight]);
  const layout2 = useMemo(() => layoutBody([{ text: p.body2, highlight: '' }], { ...BODY, firstCenter: BODY.firstCenter + BODY.lineHeight * (layout.lines + 0.05) }, SERIF), [p.body2, layout.lines]);
  const glitch = interpolate(t, [0, 14], [1, 0], clamp);
  const titleFont = `900 70px ${SERIF}`;
  // 金色那段里的英文用窄字体（原片是窄的衬线）
  const goldIdx = p.titleGold ? p.title1.indexOf(p.titleGold) : -1;
  const w1 = goldIdx >= 0
    ? measure(p.title1.slice(0, goldIdx), titleFont) + measure(p.titleGold, `400 70px ${GOLD_FONT}`) + measure(p.title1.slice(goldIdx + p.titleGold.length), titleFont)
    : measure(p.title1, titleFont);
  // 标题闪进来：横着切几条，错开、带红蓝错位
  const slices = 6;
  const title = (
    <>
      <div style={{ position: 'absolute', left: 640 - w1 / 2, top: 43, height: 84, lineHeight: '84px', fontFamily: SERIF, fontWeight: 900, fontSize: 70, color: '#fbfbfb', whiteSpace: 'pre' }}>
        {p.titleGold && p.title1.includes(p.titleGold) ? (
          <>
            {p.title1.slice(0, p.title1.indexOf(p.titleGold))}
            <span style={{ fontFamily: GOLD_FONT, fontWeight: 400, color: 'transparent', backgroundImage: 'linear-gradient(to bottom, #fde6cf, #e9b98f)', WebkitBackgroundClip: 'text', backgroundClip: 'text' }}>{p.titleGold}</span>
            {p.title1.slice(p.title1.indexOf(p.titleGold) + p.titleGold.length)}
          </>
        ) : (
          p.title1
        )}
      </div>
      <div style={{ position: 'absolute', left: 0, right: 0, top: 126, height: 84, lineHeight: '84px', textAlign: 'center', fontFamily: SERIF, fontWeight: 900, fontSize: 70, color: '#fbfbfb', whiteSpace: 'pre' }}>{p.title2}</div>
      {p.english && (
        <div style={{ position: 'absolute', left: 0, right: 0, top: 221, height: 50, lineHeight: '50px', textAlign: 'center', fontFamily: `"${BUNDLED_FONTS.oswald.family}", sans-serif`, fontWeight: 500, fontSize: 36, color: '#f4f4f4', whiteSpace: 'pre' }}>
          {p.english}
        </div>
      )}
    </>
  );
  // 正文按行从左往右出来：第 1 行一开始就出，之后每行晚 9 帧
  const lineReveal = (line: number) => Easing.out(Easing.quad)(interpolate(t, [line * 9, 6 + line * 9], [0, 1], clamp));
  const bodyMask = 'linear-gradient(to bottom, #000 0px, #000 560px, rgba(0,0,0,0.8) 600px, rgba(0,0,0,0.35) 650px, transparent 700px)';
  return (
    <AbsoluteFill style={{ background: 'radial-gradient(ellipse 80% 80% at 50% 45%, #202020, #151515 70%, #0d0d0d)' }}>
      {/* 标题 */}
      {glitch > 0.02 ? (
        Array.from({ length: slices }, (_, i) => {
          const y0 = 40 + (i * 240) / slices;
          const y1 = 40 + ((i + 1) * 240) / slices;
          const dx = (random(`gx-${i}-${Math.floor(t / 2)}`) - 0.5) * 160 * glitch;
          const clip = `polygon(0 ${y0}px, 1280px ${y0}px, 1280px ${y1}px, 0 ${y1}px)`;
          return (
            <div key={i} style={{ position: 'absolute', inset: 0, clipPath: clip, WebkitClipPath: clip, transform: `translateX(${dx}px)`, opacity: 1 - 0.4 * glitch, filter: `drop-shadow(${-6 * glitch}px 0 0 rgba(230,50,50,0.7)) drop-shadow(${6 * glitch}px 0 0 rgba(50,160,240,0.7))` }}>
              {title}
            </div>
          );
        })
      ) : (
        <div style={{ position: 'absolute', inset: 0 }}>{title}</div>
      )}
      <div style={{ position: 'absolute', left: 75, top: 295, width: 1135, height: 2, background: 'linear-gradient(to right, rgba(200,200,200,0), rgba(220,220,220,0.8) 15%, rgba(220,220,220,0.8) 85%, rgba(200,200,200,0))', opacity: interpolate(t, [0, 10], [0, 1], clamp) }} />
      <div style={{ position: 'absolute', inset: 0, WebkitMaskImage: bodyMask, maskImage: bodyMask }}>
        {[layout, layout2].map((l, k) =>
          l.chars.map((c, i) => {
            const line = c.line + (k === 1 ? layout.lines : 0);
            const u = lineReveal(line);
            if (u <= 0 || c.x - BODY.left > (BODY.right - BODY.left + 80) * u) return null;
            return (
              <span
                key={`${k}-${i}`}
                style={{
                  position: 'absolute', left: c.x, top: c.center - 29, height: 58, lineHeight: '58px', fontFamily: SERIF, fontSize: BODY.size,
                  color: c.highlight ? '#eaa56c' : k === 1 ? '#bdbdbd' : '#d6d6d6', whiteSpace: 'pre',
                }}
              >
                {c.ch}
              </span>
            );
          }),
        )}
        {underlinesByLine(layout.chars).map((u) => {
          const r = lineReveal(u.line);
          return <div key={u.line} style={{ position: 'absolute', left: u.x0, top: u.center + 25, width: (u.x1 - u.x0) * r, height: 2.4, backgroundColor: '#e59a57' }} />;
        })}
      </div>
      <AbsoluteFill style={{ background: vignetteGradient({ cx: 640, cy: 330, rx: 760, ry: 470, amount: 0.5, power: 2.2 }) }} />
    </AbsoluteFill>
  );
};
