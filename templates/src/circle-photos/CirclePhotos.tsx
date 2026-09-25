import React from 'react';
import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from 'remotion';
import { Media } from '../media';
import { vignetteGradient } from '../lens';

/**
 * 复刻：网格纸上几张圆形图片一张张落下来，底下压着带红色引号的白字标签；镜头慢慢拉远（116 帧，1280×720 @30fps）
 *
 * 按原片量的（霍夫找圆，逐帧）：
 *   三张时（镜头 1 倍）：圆心 (190, 345)、(616, 318)、(1060, 338)，半径 155、183、168（中间那张最大、略高）
 *   一张出来：从上面 38px 落下来（16 帧，先慢后快再慢），同时淡进来（12 帧）
 *   标签：粗宋体白字，字高约 0.27 × 半径，字心在圆心下方 0.92 × 半径；两边红色弯引号；
 *     圆的下半截压一层由黑到透明的渐变，字才看得清；圆右下有一圈软投影
 *   镜头：以画面中心慢慢拉远，先快后慢，最后到 0.918 倍
 * 只复刻画面，底部口播字幕不在模板里。
 */

export type CircleItem = { image: string; label: string; at: number };

export type CirclePhotosProps = {
  background: string;
  items: CircleItem[];
  vignette: boolean;
  durationInFrames: number;
};

const SERIF = '"Noto Serif CJK SC", "Songti SC", "STSong", "Source Han Serif SC", serif';
const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;
export const BG = { w: 1396, h: 785 };
const PIVOT = [640, 360] as const;

type Slot = { x: number; y: number; r: number };
const LAYOUTS: Record<number, Slot[]> = {
  1: [{ x: 640, y: 330, r: 185 }],
  2: [{ x: 420, y: 340, r: 170 }, { x: 860, y: 320, r: 177 }],
  3: [{ x: 190, y: 345, r: 155 }, { x: 616, y: 318, r: 183 }, { x: 1060, y: 338, r: 168 }],
  4: [{ x: 168, y: 346, r: 132 }, { x: 480, y: 322, r: 145 }, { x: 800, y: 342, r: 136 }, { x: 1110, y: 324, r: 142 }],
};

export function slots(n: number): Slot[] {
  return LAYOUTS[Math.max(1, Math.min(4, n))]!.slice(0, n);
}

/** 镜头：以画面中心慢慢拉远，先快后慢，115 帧到 0.918 倍（逐帧对齐背景网格量的） */
const CAM_T = [0, 8, 14, 20, 26, 32, 38, 44, 50, 56, 62, 68, 74, 80, 86, 92, 98, 110, 115];
const CAM_S = [1, 0.997, 0.9925, 0.988, 0.982, 0.976, 0.9686, 0.9626, 0.9551, 0.9491, 0.9417, 0.9372, 0.9312, 0.9282, 0.9252, 0.9222, 0.9192, 0.9177, 0.9177];

export function cameraScale(frame: number): number {
  return interpolate(frame, CAM_T, CAM_S, clamp);
}

/** 一张圆落下来：y 偏移（负数 = 还在上面）和透明度 */
export function dropIn(frame: number, at: number) {
  const t = frame - at;
  return {
    dy: -38 * (1 - Easing.inOut(Easing.cubic)(interpolate(t, [0, 16], [0, 1], clamp))),
    opacity: interpolate(t, [0, 12], [0, 1], clamp),
  };
}

export const CirclePhotos: React.FC<CirclePhotosProps> = (p) => {
  const frame = useCurrentFrame();
  const cam = cameraScale(frame);
  const layout = slots(p.items.length);
  return (
    <AbsoluteFill style={{ backgroundColor: '#b8b8b8', overflow: 'hidden' }}>
      <AbsoluteFill style={{ transformOrigin: `${PIVOT[0]}px ${PIVOT[1]}px`, transform: `scale(${cam.toFixed(4)})` }}>
        <div style={{ position: 'absolute', left: 640 - BG.w / 2, top: 360 - BG.h / 2, width: BG.w, height: BG.h }}>
          <Media src={p.background} style={{ width: '100%', height: '100%' }} />
        </div>
        {p.items.map((it, i) => (
          <Circle key={i} item={it} slot={layout[i]!} frame={frame} />
        ))}
      </AbsoluteFill>
      {p.vignette && <AbsoluteFill style={{ background: vignetteGradient({ cx: 640, cy: 330, rx: 760, ry: 470, amount: 0.36, power: 2.6 }) }} />}
    </AbsoluteFill>
  );
};

const Circle: React.FC<{ item: CircleItem; slot: Slot; frame: number }> = ({ item, slot, frame }) => {
  if (frame < item.at) return null;
  const { dy, opacity } = dropIn(frame, item.at);
  const { x, y, r } = slot;
  const size = r * 0.27;
  return (
    <div style={{ position: 'absolute', left: x - r, top: y - r + dy, width: r * 2, height: r * 2, opacity }}>
      <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', boxShadow: '12px 16px 24px rgba(0,0,0,0.42)' }} />
      <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', overflow: 'hidden', backgroundColor: '#111' }}>
        <Media src={item.image} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />
        {/* 有标签才压暗下半截 */}
        {item.label && <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: '42%', background: 'linear-gradient(to top, rgba(0,0,0,0.78), rgba(0,0,0,0.45) 35%, rgba(0,0,0,0))' }} />}
      </div>
      {item.label && (
        <div
          style={{
            position: 'absolute', left: -r, width: r * 4, top: r + 0.92 * r - size * 0.7, height: size * 1.4, lineHeight: `${size * 1.4}px`, textAlign: 'center', whiteSpace: 'pre',
            fontFamily: SERIF, fontWeight: 900, fontSize: size, color: '#fafafa', textShadow: '0 2px 6px rgba(0,0,0,0.6)',
          }}
        >
          <span style={{ color: '#e02a2a', marginRight: -size * 0.08 }}>“</span>
          {item.label}
          <span style={{ color: '#e02a2a', marginLeft: -size * 0.08 }}>”</span>
        </div>
      )}
    </div>
  );
};
