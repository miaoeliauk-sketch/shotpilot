import React from 'react';
import { AbsoluteFill, interpolate, Sequence, useCurrentFrame } from 'remotion';
import { BUNDLED_FONTS, useBundledFont } from '../fonts';
import { HALFTONE, HalftoneWord } from '../halftone-word';
import { vignetteGradient } from '../lens';
import { Media } from '../media';

/**
 * 复刻：一段段视频上压一个斜体网点大字，下面一行英文小字；第一个字淡进来（英文一个个字母先后冒出来），
 * 之后跟着视频硬切换成下一个字（172 帧，1280×720 @30fps）。只做字这一层，视频自己放。
 *
 * 按原片量的：
 *   大字：粗黑体往右斜 8°、横向拉宽 1.2 倍、描边加粗，四个字 148px（总宽约 682，字少了最大 160）；字底 365，视觉中心 x 631
 *     灰白渐变＋细网点＋左下影子，和「截图卡片 · 网点大字」那个模板同一种字
 *   英文：圆润的粗体（Comfortaa，描边加粗、字距收紧 0.07 个字），25px 浅灰 #d6d6d6，居中 x 637，字底 447；比大字晚一点点出来
 *   第一个字：第 4–20 帧淡进来（先慢后快再慢）；英文每个字母各自晚 0–6 帧，6 帧淡进来
 *   之后每段一切就换字，不再淡入；字每帧放大 0.035%（以字底下面 (631, 390) 为中心）
 * 只复刻画面，底部口播字幕不在模板里。
 */

export type Caption = { text: string; english: string; media: string; at: number };

export type HalftoneCaptionsProps = {
  captions: Caption[];
  dim: number;
  vignette: boolean;
  durationInFrames: number;
};

export const BIG = { maxSize: 160, maxWidth: 682, baseline: 365, cx: 631, grow: 0.00035, growY: 390 };
export const ENGLISH = { size: 25, cx: 637, baseline: 447, color: '#d6d6d6', spacing: -0.07, bolder: 1.8 };
const STYLE = { ...HALFTONE, stretch: 1.2 };
const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;

/** 大字字号：四个字 148，字少了最大 160 */
export function captionSize(text: string): number {
  const n = Math.max(1, Array.from(text).length);
  return Math.min(BIG.maxSize, BIG.maxWidth / (n * (1 + STYLE.spacing) * STYLE.stretch));
}

/** 第一个字淡进来：开始后第 t 帧的不透明度（原片第 4–20 帧） */
export function fadeIn(t: number): number {
  return interpolate(t, [4, 8, 12, 16, 20], [0, 0.2, 0.56, 0.88, 1], clamp);
}

/** 英文第 i 个字母晚几帧出来（0–6 帧，固定的乱序） */
export function letterDelay(i: number): number {
  const x = Math.sin((i + 1) * 12.9898) * 43758.5453;
  return 6 * (x - Math.floor(x));
}

export const HalftoneCaptions: React.FC<HalftoneCaptionsProps> = ({ captions, dim, vignette, durationInFrames }) => {
  const frame = useCurrentFrame();
  const fontReady = useBundledFont('comfortaa');
  if (captions.length === 0) return <AbsoluteFill style={{ backgroundColor: '#0e0e0e' }} />;
  let i = 0;
  while (i + 1 < captions.length && frame >= captions[i + 1]!.at) i++;
  const c = captions[i]!;
  const end = i + 1 < captions.length ? captions[i + 1]!.at : durationInFrames;
  const t = frame - c.at;
  const first = i === 0;
  const u = first ? fadeIn(t) : 1;
  const grow = 1 + BIG.grow * t;
  return (
    <AbsoluteFill style={{ backgroundColor: '#0e0e0e', overflow: 'hidden' }}>
      <Sequence from={c.at} durationInFrames={Math.max(1, end - c.at)} layout="none">
        <AbsoluteFill>{c.media && <Media src={c.media} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />}</AbsoluteFill>
      </Sequence>
      {dim > 0 && <AbsoluteFill style={{ backgroundColor: `rgba(0,0,0,${dim.toFixed(3)})` }} />}
      {vignette && <AbsoluteFill style={{ background: vignetteGradient({ cx: 640, cy: 360, rx: 720, ry: 450, amount: 0.9, power: 2.4 }) }} />}
      <AbsoluteFill style={{ transformOrigin: `${BIG.cx}px ${BIG.growY}px`, transform: `scale(${grow.toFixed(5)})` }}>
        {c.text && u > 0 && (
          <AbsoluteFill style={{ opacity: u }}>
            <HalftoneWord key={i} id={`hc-w${i}`} text={c.text} size={captionSize(c.text)} cx={BIG.cx} baseline={BIG.baseline} style={STYLE} />
          </AbsoluteFill>
        )}
        {c.english && fontReady && <English text={c.english} t={t} first={first} />}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

const English: React.FC<{ text: string; t: number; first: boolean }> = ({ text, t, first }) => {
  const letters = Array.from(text);
  return (
    <div
      style={{
        position: 'absolute', left: 0, width: 1280, top: ENGLISH.baseline - ENGLISH.size, height: ENGLISH.size * 1.4,
        display: 'flex', justifyContent: 'center', transform: `translateX(${ENGLISH.cx - 640}px)`,
        fontFamily: `"${BUNDLED_FONTS.comfortaa.family}", sans-serif`, fontWeight: 700, fontSize: ENGLISH.size, lineHeight: `${ENGLISH.size}px`,
        letterSpacing: `${ENGLISH.spacing}em`, color: ENGLISH.color, whiteSpace: 'pre',
        WebkitTextStroke: `${ENGLISH.bolder}px ${ENGLISH.color}`, filter: 'drop-shadow(-1px 2px 1.5px rgba(0,0,0,0.7))',
      }}
    >
      {letters.map((ch, k) => {
        const o = first ? interpolate(t - 5 - letterDelay(k), [0, 6], [0, 1], clamp) : 1;
        return <span key={k} style={{ opacity: o }}>{ch}</span>;
      })}
    </div>
  );
};
