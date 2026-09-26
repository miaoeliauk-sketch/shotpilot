import React from 'react';
import { AbsoluteFill, Easing, Img, interpolate, useCurrentFrame } from 'remotion';
import { assetUrl } from '../asset';

/**
 * 复刻：浅灰纸上一张张「图 + 一句话」的圆角卡片：先是一张的特写、字一个一个打出来，镜头拉远，
 * 其它卡片从四周斜着滑进来（每张都打字）；最后中间一个黑圆点长大、写着总结的字，几根细线从圆连到卡片，整个往上甩走（397 帧，1280×720 @30fps）
 *
 * 按原片量的（世界坐标 = 第 360 帧、镜头 1 倍）：
 *   五张卡片（中心、宽高、转角）：上 (648,133) 344×140 0°；右上 (1051,244) 342×132 −9°；左上 (243,244) 350×135 9°；
 *     左下 (268,468) 310×132 −15°；右下 (1010,469) 310×125 14°；白灰色圆角（14）、深色细边、右下有厚度阴影
 *   卡片里：上面那张图在下、字在上；其它的图在左、字在右；字 19px 深灰，前面一个小圆点；每 3.5 帧打一个字
 *   出场：第一张开头就在；其它分别在第 75、112、158、210 帧从外面斜着滑进来（20 帧，先快后慢），落稳了开始打字
 *   黑圆：中心 (640,358)，第 305 帧从一个点长到半径 100（25 帧），里面白字 36px；
 *     细线：第 338 帧起，按左上、左下、上、右上、右下的顺序，从圆边弯弯地画到卡片（每根 7 帧，间隔 10 帧）
 *   镜头：开头 2.02 倍对着上面那张（从下往上移进来），第 40–140 帧拉到 1.19 倍，第 150–180 帧往下移到画面中心、1.06 倍，
 *     之后慢慢拉到 1 倍（360 帧）；最后 17 帧整个往上甩走
 * 只复刻画面，底部口播字幕不在模板里。
 */

export type StoryCard = { image: string; text: string; at: number };

export type StoryCardsProps = {
  cards: StoryCard[];
  center: string;
  centerAt: number;
  durationInFrames: number;
};

const SANS = '"Noto Sans CJK SC", "PingFang SC", "Source Han Sans SC", "Hiragino Sans GB", sans-serif';
const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;
const easeOut = Easing.out(Easing.cubic);

/** 五个位置：中心、宽高、转角、从哪边滑进来、图在哪 */
export const SLOTS = [
  { x: 648, y: 133, w: 344, h: 140, rot: 0, from: [0, -300], layout: 'bottom' as const, anchor: [640, 205] },
  { x: 1051, y: 244, w: 342, h: 132, rot: -9, from: [520, 120], layout: 'left' as const, anchor: [880, 300] },
  { x: 243, y: 244, w: 350, h: 135, rot: 9, from: [-520, 60], layout: 'left' as const, anchor: [405, 300] },
  { x: 268, y: 468, w: 310, h: 132, rot: -15, from: [-420, 300], layout: 'bottom' as const, anchor: [428, 452] },
  { x: 1010, y: 469, w: 310, h: 125, rot: 14, from: [460, 200], layout: 'left' as const, anchor: [860, 440] },
];
export const CIRCLE = { x: 640, y: 358, r: 100 };
const TYPE_STEP = 3.5;

const CAM_T = [0, 4, 8, 12, 16, 20, 25, 30, 40, 50, 60, 70, 80, 90, 100, 110, 120, 130, 140, 150, 160, 170, 180, 200, 220, 240, 260, 280, 300, 320, 340, 360, 380, 386, 390, 394];
const CAM_S = [2.026, 2.026, 2.0231, 2.0196, 2.0158, 2.0134, 2.0107, 2.007, 1.9136, 1.6889, 1.5334, 1.4219, 1.3416, 1.2832, 1.244, 1.218, 1.2034, 1.1971, 1.1938, 1.1866, 1.1708, 1.0809, 1.0651, 1.055, 1.0477, 1.041, 1.0341, 1.027, 1.0202, 1.0131, 1.0063, 1, 0.9933, 0.9924, 0.992, 0.992];
const CAM_X = [640, 640, 640.2, 640.1, 640.1, 640, 640, 639.9, 641.2, 643.6, 645.4, 646.6, 647.8, 648.1, 648.7, 648.8, 649, 649.2, 649.3, 649, 648.2, 641.2, 640.2, 639.9, 639.9, 639.9, 639.9, 639.8, 639.7, 639.9, 639.9, 640, 640.1, 640.1, 640.1, 640.1];
const CAM_Y = [367, 397, 427.8, 458.7, 499.5, 536, 571.3, 597.4, 621.9, 614, 601.9, 593.8, 587.9, 583.5, 580.8, 579.1, 578.3, 577.9, 577.6, 571.7, 550.6, 388.9, 366.8, 360.2, 360.1, 360.1, 360.2, 360.1, 360.1, 360, 360, 360, 283.6, 190.7, 60, -200];

/** 镜头：世界点 (640, 360) 在屏幕上的位置和缩放；exit = 从哪一帧起用结尾的甩走（原片 380） */
export function camera(frame: number, exitAt: number) {
  const t = frame < exitAt ? Math.min(frame, 379) : 380 + (frame - exitAt);
  return { s: interpolate(t, CAM_T, CAM_S, clamp), x: interpolate(t, CAM_T, CAM_X, clamp), y: interpolate(t, CAM_T, CAM_Y, { extrapolateLeft: 'clamp', extrapolateRight: 'extend' }) };
}

/** 卡片滑进来的进度 */
export function cardIn(frame: number, at: number): number {
  return easeOut(interpolate(frame, [at, at + 20], [0, 1], clamp));
}

/** 这张卡片打到第几个字（落稳后开始打） */
export function typedCount(frame: number, at: number, first: boolean, total: number): number {
  const start = first ? 16 : at + 22;
  return Math.max(0, Math.min(total, Math.floor((frame - start) / TYPE_STEP) + 1));
}

export const StoryCards: React.FC<StoryCardsProps> = (p) => {
  const frame = useCurrentFrame();
  const exitAt = p.durationInFrames - 17;
  const cam = camera(frame, exitAt);
  const cards = p.cards.slice(0, 5);
  const cU = easeOut(interpolate(frame, [p.centerAt, p.centerAt + 25], [0, 1], clamp));
  return (
    <AbsoluteFill style={{ backgroundColor: '#dcdcda', overflow: 'hidden' }}>
      <AbsoluteFill style={{ background: 'radial-gradient(ellipse 820px 520px at 640px 360px, #efefed 0%, #e3e3e1 55%, #c9c9c7 100%)' }} />
      <AbsoluteFill style={{ transformOrigin: '0 0', transform: `translate(${(cam.x - 640 * cam.s).toFixed(2)}px, ${(cam.y - 360 * cam.s).toFixed(2)}px) scale(${cam.s.toFixed(4)})` }}>
        {/* 细线（在卡片和圆下面） */}
        {p.center && (
          <svg width={1280} height={720} style={{ position: 'absolute', left: 0, top: 0, overflow: 'visible' }}>
            {cards.map((_, i) => {
              const order = [2, 3, 0, 1, 4].indexOf(i);
              const u = interpolate(frame, [p.centerAt + 33 + order * 10, p.centerAt + 40 + order * 10], [0, 1], clamp);
              if (u <= 0) return null;
              const s = SLOTS[i]!;
              const ang = Math.atan2(s.anchor[1]! - CIRCLE.y, s.anchor[0]! - CIRCLE.x);
              const sx = CIRCLE.x + CIRCLE.r * Math.cos(ang);
              const sy = CIRCLE.y + CIRCLE.r * Math.sin(ang);
              const mx = (sx + s.anchor[0]!) / 2 + (i % 2 ? 30 : -30);
              const my = (sy + s.anchor[1]!) / 2 + 30;
              return <path key={i} d={`M ${sx.toFixed(1)} ${sy.toFixed(1)} Q ${mx.toFixed(1)} ${my.toFixed(1)} ${s.anchor[0]} ${s.anchor[1]}`} fill="none" stroke="#1e1e1e" strokeWidth={1.6} pathLength={1} strokeDasharray={`${u.toFixed(3)} 1`} />;
            })}
          </svg>
        )}
        {cards.map((c, i) => {
          const s = SLOTS[i]!;
          const u = i === 0 ? 1 : cardIn(frame, c.at);
          if (u <= 0) return null;
          const n = typedCount(frame, c.at, i === 0, Array.from(c.text).length);
          return <Card key={i} slot={s} card={c} u={u} typed={n} frame={frame} />;
        })}
        {p.center && cU > 0 && (
          <div style={{ position: 'absolute', left: CIRCLE.x - CIRCLE.r, top: CIRCLE.y - CIRCLE.r, width: CIRCLE.r * 2, height: CIRCLE.r * 2, borderRadius: '50%', background: '#1a1a1a', transform: `scale(${(0.08 + 0.92 * cU).toFixed(4)})`, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 6px 14px rgba(0,0,0,0.25)' }}>
            <span style={{ fontFamily: SANS, fontSize: 36, color: '#f4f4f2', whiteSpace: 'pre' }}>{p.center}</span>
          </div>
        )}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

const Card: React.FC<{ slot: (typeof SLOTS)[number]; card: StoryCard; u: number; typed: number; frame: number }> = ({ slot, card, u, typed, frame }) => {
  const dx = slot.from[0]! * (1 - u);
  const dy = slot.from[1]! * (1 - u);
  const rot = slot.rot + (1 - u) * (slot.rot >= 0 ? 14 : -14);
  const chars = Array.from(card.text);
  const shown = chars.slice(0, typed).join('');
  const cursor = typed < chars.length && typed > 0 && Math.floor(frame / 8) % 2 === 0;
  const text = (
    <span style={{ fontFamily: SANS, fontSize: 19, lineHeight: 1.35, color: '#2b2b2a', whiteSpace: 'pre-wrap' }}>
      <span style={{ fontSize: 12, verticalAlign: 'top', marginRight: 2 }}>·</span>
      {shown}
      {cursor && <span style={{ color: '#555' }}>|</span>}
    </span>
  );
  return (
    <div
      style={{
        position: 'absolute', left: slot.x - slot.w / 2, top: slot.y - slot.h / 2, width: slot.w, height: slot.h, transform: `translate(${dx.toFixed(1)}px, ${dy.toFixed(1)}px) rotate(${rot.toFixed(2)}deg)`,
        borderRadius: 14, background: 'linear-gradient(160deg, #f4f4f2, #e8e8e6)', border: '1.5px solid #4a4a48', overflow: 'hidden',
        boxShadow: '4px 7px 0 -1px #bdbdbb, 8px 14px 18px rgba(0,0,0,0.28)',
      }}
    >
      {slot.layout === 'bottom' ? (
        <>
          {card.image && <Img src={assetUrl(card.image)} style={{ position: 'absolute', left: '8%', right: '8%', bottom: 0, height: '62%', width: '84%', objectFit: 'cover', objectPosition: '50% 20%' }} />}
          <div style={{ position: 'absolute', left: 30, right: 16, top: 12 }}>{text}</div>
        </>
      ) : (
        <>
          {card.image && <Img src={assetUrl(card.image)} style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: '38%', height: '100%', objectFit: 'cover' }} />}
          <div style={{ position: 'absolute', left: '42%', right: 12, top: '30%' }}>{text}</div>
        </>
      )}
    </div>
  );
};
