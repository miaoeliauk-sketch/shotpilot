import React from 'react';
import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from 'remotion';
import { Media } from '../media';

/**
 * 复刻：暗色视频背景上，白色大标题一个字一个字「砸」下来（118 帧，1280×720 @30fps）
 *
 * ── 结构（第 79 帧量的）──────────────────────────────────────────────
 *   标题  4 个字 x 379–903、y 234–426：每个字宽 131、高 192（竖向拉长），粗宋、微微右斜，白色带一点纹理
 *   英文  x 452–828、y 464–490，粗斜体衬线，白色
 *
 * ── 动作（逐字追踪）─────────────────────────────────────────────────
 *   每个字从 1.5 倍大、有点虚开始，20 帧缩回原大（9 帧就清楚了），2 帧淡入，同时往下落约 20px；
 *   出场顺序不是从左到右：原片 4 个字依次在第 3、14、9、15 帧开始（先第 1 个、第 3 个，再第 2、4 个）
 *   英文在第 9 帧开始从模糊里淡出来（16 帧）
 *
 * 背景是一段暗的视频（换成用户自己的图或视频），压暗一点让白字跳出来。只复刻画面，底部口播字幕不在模板里。
 */

export type DropTitleProps = {
  background: string;
  dim: number;
  title: string;
  subtitle: string;
  color: string;
  /** 第一个字开始的帧 */
  startAt: number;
  durationInFrames: number;
};

const SERIF = '"Songti SC", "STSong", "Noto Serif CJK SC", "Source Han Serif SC", serif';
const LATIN = '"Baskerville", "Georgia", "Times New Roman", serif';

const TITLE = { centerX: 641, top: 234, height: 192, charWidth: 131 };
const SUB = { centerX: 640, top: 464, size: 27 };
/** 原片 4 个字的开始时间（相对第一个字） */
const ORDER_4 = [0, 11, 6, 12];
const CHAR = { scale: 1.5, blur: 8, blurFrames: 9, frames: 20, fade: 2, drop: 20 };

const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;

/** 第 i 个字（共 n 个）开始的帧：照原片「单数位先、双数位后」的节奏 */
export function charStart(i: number, n: number): number {
  if (n === 4) return ORDER_4[i]!;
  const odd = i % 2 === 0; // 第 1、3、5… 个
  const rank = Math.floor(i / 2);
  return odd ? rank * 6 : 11 + rank * 1.5;
}

export const DropTitle: React.FC<DropTitleProps> = (p) => {
  const frame = useCurrentFrame();
  const chars = Array.from(p.title);
  const n = chars.length;
  // 字多了就缩小，保持整行宽度不超过画面的 80%
  const k = Math.min(1, (1280 * 0.8) / Math.max(1, n * TITLE.charWidth));
  const w = TITLE.charWidth * k;
  const h = TITLE.height * k;
  const left0 = TITLE.centerX - (n * w) / 2;
  const subStart = p.startAt + 6;
  const subQ = Easing.out(Easing.quad)(interpolate(frame, [subStart, subStart + 16], [0, 1], clamp));

  return (
    <AbsoluteFill style={{ backgroundColor: '#050505', overflow: 'hidden' }}>
      <Media src={p.background} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />
      <AbsoluteFill style={{ backgroundColor: `rgba(0,0,0,${p.dim})` }} />

      {chars.map((ch, i) => {
        const t = frame - p.startAt - charStart(i, n);
        if (t < 0) return null;
        const u = Easing.out(Easing.cubic)(interpolate(t, [0, CHAR.frames], [0, 1], clamp));
        const s = CHAR.scale + (1 - CHAR.scale) * u;
        const blur = CHAR.blur * (1 - Easing.out(Easing.quad)(interpolate(t, [0, CHAR.blurFrames], [0, 1], clamp)));
        const alpha = interpolate(t, [0, CHAR.fade], [0, 1], clamp);
        return (
          <div
            key={i}
            style={{
              position: 'absolute', left: left0 + i * w, top: TITLE.top + (TITLE.height - h) / 2, width: w, height: h,
              opacity: alpha, transform: `translateY(${(-CHAR.drop * (1 - u)).toFixed(2)}px) scale(${s})`, transformOrigin: '50% 50%',
              filter: `${blur > 0.05 ? `blur(${blur.toFixed(2)}px) ` : ''}drop-shadow(0 4px 12px rgba(0,0,0,0.6))`,
            }}
          >
            <div
              style={{
                position: 'absolute', left: 0, top: 0, width: w, height: w, display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontFamily: SERIF, fontWeight: 900, fontSize: w * 1.02, lineHeight: 1, whiteSpace: 'pre',
                transform: `scaleY(${h / w}) skewX(-7deg)`, transformOrigin: '50% 0',
                backgroundImage: `linear-gradient(170deg, ${p.color} 0%, #d9d9d9 45%, ${p.color} 60%, #e6e6e6 100%)`,
                WebkitBackgroundClip: 'text', backgroundClip: 'text', WebkitTextFillColor: 'transparent',
              }}
            >
              {ch}
            </div>
          </div>
        );
      })}

      {p.subtitle && subQ > 0 && (
        <div
          style={{
            position: 'absolute', left: 0, width: 1280, top: SUB.top, height: SUB.size * 1.2, display: 'flex', justifyContent: 'center', alignItems: 'center',
            transform: `translateX(${SUB.centerX - 640}px)`, fontFamily: LATIN, fontStyle: 'italic', fontWeight: 700, fontSize: SUB.size,
            color: p.color, opacity: subQ, filter: subQ < 1 ? `blur(${(6 * (1 - subQ)).toFixed(2)}px)` : undefined, whiteSpace: 'pre', letterSpacing: 0.5,
          }}
        >
          {p.subtitle}
        </div>
      )}
    </AbsoluteFill>
  );
};
