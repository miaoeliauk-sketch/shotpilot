import React from 'react';
import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from 'remotion';
import { Media } from '../media';
import { vignetteGradient } from '../lens';
import { POSTER, PosterCard, type Poster } from '../poster-card/PosterCard';

/**
 * 复刻：灰墙上一排很高的压窄大字「A ≠ B」，中间的 ≠ 发红光；之后大字变虚，两张海报卡片盖在两边（174 帧，1280×720 @30fps）
 *
 * 按原片量的（世界坐标 = 第 60 帧，镜头 1 倍）：
 *   大字：粗宋 440px 压到 0.45，字身 y 118–533；字心 x 198、393（左边两个字）、898、1120（右边两个字）；
 *     里面两个字深灰、清楚，外面两个字浅、有点虚（像景深）；0–24 帧从虚到实淡进来，同时每个字从 1.38 倍缩回来、往外散开一点（60 帧）
 *   ≠：两道红横 x 540–765（y 306–324、376–394）加一道斜杠，#f22e2e、外面一圈红光；3–30 帧亮起来
 *   镜头（以画面中心）：1.016 倍慢慢拉到 0.946 倍（100 帧）
 *   卡片：第 104 帧镜头跳回 1.023 倍再慢慢拉到 0.995；大字 8 帧里虚掉（10px）；
 *     两张海报卡片（缩到 0.834）左上 (178, 176)、(832, 181)，12 帧里从 1.08 倍缩回、淡进来
 * 只复刻画面，底部口播字幕不在模板里。
 */

export type NotEqualProps = {
  background: string;
  left: string;
  right: string;
  cardsAt: number;
  leftCard: Poster;
  rightCard: Poster;
  vignette: boolean;
  durationInFrames: number;
};

const SERIF = '"Noto Serif CJK SC", "Songti SC", "STSong", "Source Han Serif SC", serif';
const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;

export const WORD = { size: 440, squeeze: 0.45, top: 118, centers: [198, 393, 898, 1120] };
export const CARD_SPOTS = { scale: 0.834, left: { x: 178, y: 176 }, right: { x: 832, y: 181 } };

const A_T = [0, 30, 40, 50, 60, 70, 80, 90, 100, 104];
const A_S = [1.0157, 1.0129, 1.0103, 1.0061, 1, 0.9909, 0.9782, 0.9617, 0.9461, 0.943];
const B_T = [0, 2, 4, 6, 10, 14, 20, 26, 36, 46, 56, 66];
const B_S = [1.0229, 1.0207, 1.0184, 1.0164, 1.0138, 1.0105, 1.0066, 1.0037, 1, 0.9976, 0.9962, 0.9946];

/** 镜头：大字那段按「出卡片」的时间伸缩；出卡片时跳一下 */
export function cameraScale(frame: number, cardsAt: number): number {
  if (frame < cardsAt) return interpolate((frame * 104) / Math.max(1, cardsAt), A_T, A_S, clamp);
  return interpolate(frame - cardsAt, B_T, B_S, clamp);
}

/** 开头每个字从大缩回来（绕自己的中心），字的位置从中间往外散开一点 */
export function wordsPose(frame: number) {
  return {
    s: interpolate(frame, [0, 12, 18, 24, 30, 40, 60], [1.38, 1.31, 1.23, 1.17, 1.11, 1.07, 1], clamp),
    spread: interpolate(frame, [0, 12, 30, 60], [0.86, 0.88, 0.95, 1], clamp),
    ne: interpolate(frame, [0, 15, 30, 60], [1.25, 1.18, 1.08, 1], clamp),
  };
}

/** 大字淡进来的进度（从虚到实） */
export function wordsIn(frame: number): number {
  return Easing.out(Easing.quad)(interpolate(frame, [0, 24], [0, 1], clamp));
}

export const NotEqual: React.FC<NotEqualProps> = (p) => {
  const frame = useCurrentFrame();
  const cam = cameraScale(frame, p.cardsAt);
  const u = wordsIn(frame);
  const pose = wordsPose(frame);
  const ne = Easing.out(Easing.quad)(interpolate(frame, [3, 30], [0, 1], clamp));
  const blurOut = interpolate(frame, [p.cardsAt - 2, p.cardsAt + 8], [0, 1], clamp);
  const cardU = Easing.out(Easing.cubic)(interpolate(frame, [p.cardsAt, p.cardsAt + 12], [0, 1], clamp));
  const chars = [...Array.from(p.left).slice(0, 2), ...Array.from(p.right).slice(0, 2)];
  // 左边的字靠右放（只有一个字时放在里面那格），右边的靠左放
  const slots = [
    ...(Array.from(p.left).length === 1 ? [1] : [0, 1]),
    ...(Array.from(p.right).length === 1 ? [2] : [2, 3]),
  ];
  return (
    <AbsoluteFill style={{ backgroundColor: '#9d9d9d', overflow: 'hidden' }}>
      <AbsoluteFill style={{ transformOrigin: '640px 360px', transform: `scale(${cam.toFixed(4)})` }}>
        <div style={{ position: 'absolute', left: -60, top: -34, width: 1400, height: 788 }}>
          <Media src={p.background} style={{ width: '100%', height: '100%' }} />
        </div>
        <AbsoluteFill style={{ filter: blurOut > 0 ? `blur(${(10 * blurOut).toFixed(1)}px)` : undefined, opacity: 1 - 0.25 * blurOut }}>
          {chars.map((ch, i) => {
            const slot = slots[i]!;
            const outer = slot === 0 || slot === 3;
            return (
              <div
                key={i}
                style={{
                  position: 'absolute', left: 652 + (WORD.centers[slot]! - 652) * pose.spread - WORD.size / 2, top: WORD.top - WORD.size * 0.08, width: WORD.size, height: WORD.size * 1.15, lineHeight: `${WORD.size * 1.15}px`,
                  textAlign: 'center', fontFamily: SERIF, fontWeight: 900, fontSize: WORD.size, transform: `scale(${(WORD.squeeze * pose.s).toFixed(4)}, ${pose.s.toFixed(4)})`, color: 'transparent',
                  backgroundImage: outer ? 'linear-gradient(to bottom, #9b9b9b, #8a8a8a)' : 'linear-gradient(to bottom, #5a5a5a, #3f3f3f 60%, #4d4d4d)', WebkitBackgroundClip: 'text', backgroundClip: 'text',
                  opacity: u, filter: `blur(${((outer ? 3.5 : 0) + 10 * (1 - u)).toFixed(1)}px) drop-shadow(4px 8px 6px rgba(0,0,0,${outer ? 0.08 : 0.2}))`,
                }}
              >
                {ch}
              </div>
            );
          })}
          <NotEqualSign u={ne} scale={pose.ne} />
        </AbsoluteFill>
        {cardU > 0 && (
          <>
            <PosterCard poster={p.leftCard} style={cardStyle(CARD_SPOTS.left, cardU)} />
            <PosterCard poster={p.rightCard} style={cardStyle(CARD_SPOTS.right, cardU)} />
          </>
        )}
      </AbsoluteFill>
      {p.vignette && <AbsoluteFill style={{ background: vignetteGradient({ cx: 640, cy: 360, rx: 740, ry: 460, amount: 0.42, power: 2.4 }) }} />}
    </AbsoluteFill>
  );
};

const cardStyle = (at: { x: number; y: number }, u: number): React.CSSProperties => ({
  left: at.x, top: at.y, opacity: u, transformOrigin: '0 0',
  transform: `translate(${((POSTER.w * CARD_SPOTS.scale * (1 - 1.08)) / 2 * (1 - u)).toFixed(1)}px, 0) scale(${(CARD_SPOTS.scale * (1.08 - 0.08 * u)).toFixed(4)})`,
});

/** 发红光的 ≠：两道横 + 一道斜杠 */
const NotEqualSign: React.FC<{ u: number; scale: number }> = ({ u, scale }) => {
  if (u <= 0) return null;
  return (
    <svg width={1280} height={720} style={{ position: 'absolute', left: 0, top: 0, opacity: Math.min(1, u * 1.3), transform: `scale(${scale.toFixed(4)})`, transformOrigin: '652px 350px', filter: `drop-shadow(0 0 ${(6 + 10 * u).toFixed(1)}px rgba(255,40,30,${(0.9 * u).toFixed(2)})) drop-shadow(0 0 ${(20 + 20 * u).toFixed(1)}px rgba(255,20,10,${(0.6 * u).toFixed(2)}))` }}>
      <g fill="#f22e2e">
        <rect x={540} y={306} width={225} height={18} />
        <rect x={540} y={376} width={225} height={18} />
        <polygon points="685,268 703,268 612,437 594,437" />
      </g>
    </svg>
  );
};
