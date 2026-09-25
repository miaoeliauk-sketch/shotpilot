import React from 'react';
import { AbsoluteFill, Easing, Img, interpolate, useCurrentFrame } from 'remotion';
import { assetUrl } from '../asset';
import { Media } from '../media';
import { measure } from '../text-layout';
import { vignetteGradient } from '../lens';

/**
 * 复刻：网格纸上一行行「图标 + 深色条」，条里的字一个一个打出来；最后整列歪着往左滑走（314 帧，1280×720 @30fps）
 *
 * 按原片量的（镜头 1 倍时的画面坐标）：
 *   每行：深色条 #383838、高 76，左边 x 356；图标 140 见方，中心 (333, 条中线 − 4)，盖在条的左头上；
 *     字 43px 白色，从 x 414 起；条的长度按整句字定，右边留 24
 *     行距 190（三行时第一行条顶 y 91）
 *   一行出来：图标从左下飞进来、边转边淡进（16 帧），条淡进来；这时整行只有 0.69 倍大；
 *     18 帧后开始打字（默认每字 2 帧，最后一行 8 帧、带光标），整行边打字边长到 1 倍（20 帧），
 *     每个新字从小到大弹出来（3 帧）
 *   镜头：以画面中心，44 帧后慢慢推近，0.917 → 1.007 倍，滑走时再退回一点（逐帧量的网格线）
 *   滑走：整列往左下走、逆时针转到 −8.5°、放大到 1.12 倍（38 帧，先慢后快再慢），最后 6 帧淡掉
 * 只复刻画面，底部口播字幕不在模板里。
 */

export type BubbleRow = { icon: string; text: string; at: number; step: number };

export type IconBubblesProps = {
  background: string;
  rows: BubbleRow[];
  exitAt: number;
  vignette: boolean;
  durationInFrames: number;
};

const SANS = '"Noto Sans CJK SC", "PingFang SC", "Source Han Sans SC", "Hiragino Sans GB", sans-serif';
const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;

export const ROW = { barLeft: 356, barH: 76, textLeft: 414, padRight: 24, fontSize: 43, icon: 140, iconX: 333, pitch: 190, top: 91 };
/** 开始打字前整行多大、打字后多久长到 1 倍 */
const POP = { s0: 0.69, from: 18, frames: 20, typeDelay: 18 };
const TEXT_FONT = `400 ${ROW.fontSize}px ${SANS}`;
export const BG = { w: 1396, h: 785 };

/** 行的纵向位置：三行以内行距 190，四行起收紧到 150，整体上下居中在 y≈319 */
export function rowTops(n: number): number[] {
  const pitch = n <= 3 ? ROW.pitch : 150;
  const first = n <= 3 ? ROW.top + ((3 - n) * pitch) / 2 : 319 - (ROW.barH + pitch * (n - 1)) / 2;
  return Array.from({ length: n }, (_, i) => first + i * pitch);
}

/** 镜头（以画面中心缩放）：原片逐帧量的，滑走在第 266 帧；滑走前的部分按「滑走」的时间等比伸缩 */
const CAM_T = [0, 29, 44, 59, 74, 89, 104, 119, 134, 149, 164, 179, 194, 209, 224, 234, 244, 254, 264, 274, 284, 294, 304, 314];
const CAM_S = [0.917, 0.9177, 0.9208, 0.9242, 0.9292, 0.9346, 0.9417, 0.9503, 0.9587, 0.9675, 0.9761, 0.9839, 0.9906, 0.9959, 1, 1.0023, 1.0039, 1.0055, 1.0068, 1.0068, 1.0066, 1.0052, 1.0019, 0.9967];
const CAM_EXIT = 266;

export function cameraScale(frame: number, exitAt: number): number {
  const t = frame <= exitAt ? (frame * CAM_EXIT) / Math.max(1, exitAt) : CAM_EXIT + (frame - exitAt);
  return interpolate(t, CAM_T, CAM_S, clamp);
}

/** 打到第几个字（可以是小数：最后一个字正在弹出来） */
export function typedCount(frame: number, row: BubbleRow): number {
  const t = frame - row.at - POP.typeDelay;
  if (t < 0) return 0;
  return Math.min(Array.from(row.text).length, t / Math.max(0.5, row.step) + 1);
}

const EXIT_T = [0, 6, 10, 14, 18, 22, 26, 30, 34, 38];
const EXIT_X = [0, -28, -54, -96, -160, -244, -315, -361, -391, -400];
const EXIT_Y = [0, 10, 20, 34, 56, 83, 109, 125, 133, 137];
const EXIT_R = [0, -0.6, -1, -1.8, -3.2, -4.1, -6.1, -7.2, -8.3, -8.5];
const EXIT_S = [1, 1.011, 1.018, 1.029, 1.054, 1.076, 1.099, 1.112, 1.118, 1.12];

export function exitPose(frame: number, exitAt: number) {
  const t = frame - exitAt;
  return {
    dx: interpolate(t, EXIT_T, EXIT_X, clamp),
    dy: interpolate(t, EXIT_T, EXIT_Y, clamp),
    rot: interpolate(t, EXIT_T, EXIT_R, clamp),
    s: interpolate(t, EXIT_T, EXIT_S, clamp),
    opacity: interpolate(t, [42, 48], [1, 0], clamp),
  };
}

export const IconBubbles: React.FC<IconBubblesProps> = (p) => {
  const frame = useCurrentFrame();
  const cam = cameraScale(frame, p.exitAt);
  const tops = rowTops(p.rows.length);
  const exit = exitPose(frame, p.exitAt);
  // 整列绕着中间那行的条中心转
  const pivotY = tops.length ? tops[Math.floor((tops.length - 1) / 2)]! + ROW.barH / 2 : 360;
  return (
    <AbsoluteFill style={{ backgroundColor: '#b8b8b8', overflow: 'hidden' }}>
      <AbsoluteFill style={{ transformOrigin: '640px 360px', transform: `scale(${cam.toFixed(4)})` }}>
        {/* 背景比画面大 1.09 倍（等比），镜头拉到 0.917 倍时也铺得满 */}
        <div style={{ position: 'absolute', left: 640 - BG.w / 2, top: 360 - BG.h / 2, width: BG.w, height: BG.h }}>
          <Media src={p.background} style={{ width: '100%', height: '100%' }} />
        </div>
        <div
          style={{
            position: 'absolute', left: 0, top: 0, width: 1280, height: 720, opacity: exit.opacity, transformOrigin: `618px ${pivotY}px`,
            transform: `translate(${exit.dx.toFixed(1)}px, ${exit.dy.toFixed(1)}px) rotate(${exit.rot.toFixed(2)}deg) scale(${exit.s.toFixed(4)})`,
          }}
        >
          {p.rows.map((row, i) => (
            <Row key={i} row={row} top={tops[i]!} frame={frame} />
          ))}
        </div>
      </AbsoluteFill>
      {p.vignette && <AbsoluteFill style={{ background: vignetteGradient({ cx: 640, cy: 330, rx: 760, ry: 470, amount: 0.36, power: 2.6 }) }} />}
    </AbsoluteFill>
  );
};

const Row: React.FC<{ row: BubbleRow; top: number; frame: number }> = ({ row, top, frame }) => {
  const t = frame - row.at;
  if (t < 0) return null;
  const chars = Array.from(row.text);
  const fullW = measure(row.text, TEXT_FONT);
  const barW = ROW.textLeft - ROW.barLeft + fullW + ROW.padRight;
  const mid = top + ROW.barH / 2;
  // 整行：打字前 0.69 倍，开始打字后 20 帧里长到 1 倍（先慢后快再慢）；缩放中心在条左下方
  const grow = Easing.inOut(Easing.quad)(interpolate(t, [POP.from, POP.from + POP.frames], [0, 1], clamp));
  const s = POP.s0 + (1 - POP.s0) * grow;
  const barIn = interpolate(t, [2, 12], [0, 1], clamp);
  // 图标：从左下飞进来、边转边淡进（开头就在的行只淡进来）
  const iconU = Easing.out(Easing.cubic)(interpolate(t, [0, 16], [0, 1], clamp));
  const fly = row.at > 0 ? 1 - iconU : 0;
  const typed = typedCount(frame, row);
  const slow = row.step >= 5;
  const typing = typed > 0 && typed < chars.length;
  const cursorOn = slow && t >= POP.typeDelay && (typing || typed === 0) && Math.floor(frame / 8) % 2 === 0;
  let x = ROW.textLeft;
  return (
    <div style={{ position: 'absolute', left: 0, top: 0, width: 1280, height: 720, transformOrigin: `${ROW.barLeft - 40}px ${top + ROW.barH + 150}px`, transform: `scale(${s.toFixed(4)})` }}>
      {/* 深色条 */}
      <div
        style={{
          position: 'absolute', left: ROW.barLeft, top, width: barW, height: ROW.barH, opacity: barIn,
          background: 'linear-gradient(to bottom, #3e3e3e, #353535 60%, #313131)', boxShadow: '4px 9px 14px rgba(0,0,0,0.38), inset 0 1px 0 rgba(255,255,255,0.08)',
        }}
      />
      {/* 字：一个一个弹出来 */}
      {chars.map((ch, k) => {
        const w = measure(ch, TEXT_FONT);
        const l = x;
        x += w;
        const u = typed - k; // 0→1：这个字弹出来的进度
        if (u <= 0) return null;
        const pop = Math.min(1, u);
        const cs = 0.4 + 0.6 * Easing.out(Easing.quad)(pop);
        return (
          <div
            key={k}
            style={{
              position: 'absolute', left: l, top: mid - ROW.fontSize * 0.68, height: ROW.fontSize * 1.36, lineHeight: `${ROW.fontSize * 1.36}px`, whiteSpace: 'pre',
              fontFamily: SANS, fontSize: ROW.fontSize, color: '#f1f1f1', transform: `scale(${cs.toFixed(3)})`, transformOrigin: '30% 70%', opacity: Math.min(1, pop * 1.6),
            }}
          >
            {ch}
          </div>
        );
      })}
      {cursorOn && <div style={{ position: 'absolute', left: ROW.textLeft + measure(chars.slice(0, Math.floor(typed)).join(''), TEXT_FONT) + 3, top: mid - 17, width: 2, height: 34, background: '#e8e8e8' }} />}
      {/* 图标（盖在条的左头上） */}
      {row.icon && (
        <div
          style={{
            position: 'absolute', left: ROW.iconX - ROW.icon / 2, top: mid - 4 - ROW.icon / 2, width: ROW.icon, height: ROW.icon, opacity: iconU,
            transform: `translate(${(-110 * fly).toFixed(1)}px, ${(110 * fly).toFixed(1)}px) rotate(${(35 * fly).toFixed(2)}deg)`,
          }}
        >
          <Img src={assetUrl(row.icon)} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
        </div>
      )}
    </div>
  );
};
