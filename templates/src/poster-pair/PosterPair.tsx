import React from 'react';
import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from 'remotion';
import { Media } from '../media';
import { vignetteGradient } from '../lens';
import { POSTER, PosterCard, type Poster } from '../poster-card/PosterCard';

/**
 * 复刻：口播画面上两张海报卡片先后淡出来 → 背景换成灰墙，中间打出一句话 → 右边那张滑过去叠在左边那张上，
 * 右边一行行「小字 + 大字 + 小字」淡进来（315 帧，1280×720 @30fps）
 *
 * 按原片量的（世界坐标 = 第 120 帧，镜头 1 倍）：
 *   左卡片左上 (124, 144)、右卡片左上 (824, 152)（各 326×373 含窗口栏）；第 20、36 帧淡进来（12 帧，略大一点缩回来）
 *   背景：开头可以放一段口播画面（A-roll），第 50–66 帧变虚、淡成灰墙；不放就一开始就是灰墙
 *   中间：英文两行（斜体细字 30px，x 480、y 295）70 帧淡进来；中文（斜体 49px，x 468、y 383）72 帧起每 4 帧打一个字
 *   合在一起：第 128 帧右卡片往左滑 560、往下 26（28 帧，先慢后快再慢），左卡片逆时针歪 6°；中间的字 134–144 帧淡掉
 *   右边三行（底边对齐）：大字粗黑斜体 128px 压到 0.66，小字 46px；
 *     第一行 x 654、底 245，第 148 帧；第二行 x 626、底 395，第 226 帧；第三行 x 675、底 523，第 262 帧；各 14 帧从虚到实
 *   镜头（以画面中心）：66 帧 0.988 倍 → 120 帧 1 倍 → 慢慢推近，越来越慢，300 帧 1.097 倍
 * 只复刻画面，底部口播字幕不在模板里。
 */

export type BigLine = { before: string; big: string; after: string; at: number };

export type PosterPairProps = {
  intro: string;
  introEnd: number;
  background: string;
  left: Poster;
  right: Poster;
  english: string;
  middle: string;
  mergeAt: number;
  lines: BigLine[];
  vignette: boolean;
  durationInFrames: number;
};

const SANS = '"Noto Sans CJK SC", "PingFang SC", "Source Han Sans SC", "Hiragino Sans GB", sans-serif';
const LATIN = '"Helvetica Neue", Arial, sans-serif';
const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;

export const CARDS = { left: { x: 124, y: 144 }, right: { x: 824, y: 152 } };
export const LINE_SLOTS = [
  { x: 654, bottom: 245 },
  { x: 626, bottom: 395 },
  { x: 675, bottom: 523 },
];
const BIG = { size: 128, squeeze: 0.66 };
const SMALL = { size: 46 };
const MERGE_T = [0, 2, 6, 8, 10, 12, 14, 16, 18, 20, 22, 28];
const MERGE_X = [0, -18, -65, -111, -182, -280, -379, -449, -495, -524, -542, -560];

export function cameraScale(frame: number): number {
  return interpolate(frame, [66, 120, 150, 160, 180, 200, 220, 240, 260, 280, 300, 315], [0.988, 1, 1.016, 1.0221, 1.0373, 1.0536, 1.0678, 1.08, 1.0881, 1.0942, 1.0973, 1.0975], clamp);
}

/** 右卡片滑过去的位移、左卡片歪的角度 */
export function mergePose(frame: number, mergeAt: number) {
  const t = frame - mergeAt;
  const u = interpolate(t, [0, 28], [0, 1], clamp);
  return { dx: interpolate(t, MERGE_T, MERGE_X, clamp), dy: 26 * Easing.inOut(Easing.cubic)(u), rot: -6 * Easing.inOut(Easing.cubic)(interpolate(t, [4, 22], [0, 1], clamp)) };
}

/** 中间那句中文打到第几个字 */
export function typedMiddle(frame: number, text: string): number {
  return Math.max(0, Math.min(Array.from(text).length, Math.floor((frame - 72) / 4) + 1));
}

export const PosterPair: React.FC<PosterPairProps> = (p) => {
  const frame = useCurrentFrame();
  const cam = cameraScale(frame);
  // 没有开头画面就一开始就是背景
  const introOut = p.intro ? interpolate(frame, [p.introEnd, p.introEnd + 16], [0, 1], clamp) : 1;
  const m = mergePose(frame, p.mergeAt);
  const midOut = interpolate(frame, [p.mergeAt + 6, p.mergeAt + 16], [1, 0], clamp);
  const in1 = Easing.out(Easing.cubic)(interpolate(frame, [20, 32], [0, 1], clamp));
  const in2 = Easing.out(Easing.cubic)(interpolate(frame, [36, 48], [0, 1], clamp));
  const engU = interpolate(frame, [70, 82], [0, 1], clamp) * midOut;
  const typed = typedMiddle(frame, p.middle);
  return (
    <AbsoluteFill style={{ backgroundColor: '#9a9a9a', overflow: 'hidden' }}>
      <AbsoluteFill style={{ transformOrigin: '640px 360px', transform: `scale(${cam.toFixed(4)})` }}>
        <div style={{ position: 'absolute', left: -60, top: -34, width: 1400, height: 788 }}>
          <Media src={p.background} style={{ width: '100%', height: '100%' }} />
        </div>
      </AbsoluteFill>
      {/* 开头的口播画面（A-roll，可换可不要），到点变虚、淡成背景 */}
      {p.intro && introOut < 1 && (
        <AbsoluteFill style={{ opacity: 1 - introOut, filter: introOut > 0 ? `blur(${(10 * introOut).toFixed(1)}px)` : undefined }}>
          <Media src={p.intro} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />
        </AbsoluteFill>
      )}
      <AbsoluteFill style={{ transformOrigin: '640px 360px', transform: `scale(${cam.toFixed(4)})` }}>
        {/* 中间的一句话 */}
        {engU > 0 && p.english && (
          <div style={{ position: 'absolute', left: 480, top: 292, width: 330, fontFamily: LATIN, fontWeight: 300, fontStyle: 'italic', fontSize: 30, lineHeight: '32px', color: '#3e3e3e', opacity: engU }}>
            {p.english}
          </div>
        )}
        {typed > 0 && midOut > 0 && (
          <div style={{ position: 'absolute', left: 468, top: 372, whiteSpace: 'pre', fontFamily: SANS, fontWeight: 300, fontSize: 49, lineHeight: 1.2, color: '#3a3a3a', transform: 'skewX(-12deg)', transformOrigin: '0 100%', opacity: midOut }}>
            {Array.from(p.middle).slice(0, typed).join('')}
          </div>
        )}
        {/* 左卡片（被盖住的那张） */}
        {in1 > 0 && (
          <PosterCard
            poster={p.left}
            style={{ left: CARDS.left.x, top: CARDS.left.y, opacity: in1, transform: `rotate(${m.rot.toFixed(2)}deg) scale(${(1.06 - 0.06 * in1).toFixed(3)})`, transformOrigin: '50% 50%' }}
          />
        )}
        {in2 > 0 && (
          <PosterCard
            poster={p.right}
            style={{ left: CARDS.right.x + m.dx, top: CARDS.right.y + m.dy, opacity: in2, transform: `scale(${(1.06 - 0.06 * in2).toFixed(3)})` }}
          />
        )}
        {/* 右边一行行大字 */}
        {p.lines.slice(0, 3).map((l, i) => (
          <Line key={i} line={l} slot={LINE_SLOTS[i]!} frame={frame} />
        ))}
      </AbsoluteFill>
      {p.vignette && <AbsoluteFill style={{ background: vignetteGradient({ cx: 640, cy: 360, rx: 740, ry: 460, amount: 0.4 * introOut, power: 2.4 }) }} />}
    </AbsoluteFill>
  );
};

const Line: React.FC<{ line: BigLine; slot: { x: number; bottom: number }; frame: number }> = ({ line, slot, frame }) => {
  const u = (d: number) => Easing.out(Easing.quad)(interpolate(frame - line.at - d, [0, 14], [0, 1], clamp));
  const small = (text: string, d: number): React.ReactNode => {
    const v = u(d);
    if (!text || v <= 0) return null;
    return (
      <span style={{ display: 'inline-block', fontFamily: SANS, fontWeight: 400, fontSize: SMALL.size, lineHeight: 1, color: '#343434', opacity: v, filter: v < 0.98 ? `blur(${(6 * (1 - v)).toFixed(1)}px)` : undefined, marginBottom: 6 }}>
        {text}
      </span>
    );
  };
  const vb = u(4);
  if (frame < line.at) return null;
  return (
    <div style={{ position: 'absolute', left: slot.x, bottom: 720 - slot.bottom, display: 'flex', alignItems: 'flex-end', whiteSpace: 'pre', gap: 4 }}>
      {small(line.before, 0)}
      {vb > 0 && (
        <span
          style={{
            display: 'inline-block', fontFamily: SANS, fontWeight: 700, fontSize: BIG.size, lineHeight: 0.9, color: 'transparent',
            backgroundImage: 'linear-gradient(to bottom, #6a6a6a 0%, #4a4a4a 55%, #5c5c5c 100%)', WebkitBackgroundClip: 'text', backgroundClip: 'text',
            transform: `skewX(-10deg) scaleX(${BIG.squeeze})`, transformOrigin: '0 100%', marginRight: -BIG.size * Array.from(line.big).length * (1 - BIG.squeeze),
            opacity: vb, filter: `drop-shadow(2px 4px 3px rgba(0,0,0,0.25))${vb < 0.98 ? ` blur(${(8 * (1 - vb)).toFixed(1)}px)` : ''}`,
          }}
        >
          {line.big}
        </span>
      )}
      {small(line.after, 8)}
    </div>
  );
};

export const CARD_SIZE = POSTER;
