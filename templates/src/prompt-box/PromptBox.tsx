import React from 'react';
import { AbsoluteFill, interpolate, useCurrentFrame } from 'remotion';
import { vignetteGradient } from '../lens';
import { measure } from '../text-layout';

/**
 * 复刻：墨绿底上一个圆角「提示词框」：开头镜头贴着框的左上角从右往左扫、慢慢亮起来，一个字一个字打出提示词；
 * 第 30 帧拉开看全框，字继续打完、后面跟一行灰色小字；框线像两条「蛇」沿上下两边往右爬，再从左往右收掉（162 帧，1280×720 @30fps）
 *
 * 按原片量的（世界坐标 = 第 80 帧、镜头 1 倍）：
 *   框：x 218–1158、y 247–483，圆角 30，线宽 3；线的颜色左边浅（#bedcb2）、往右变绿（#4c885b），右边一竖是深绿（#39751e），外面一圈绿光
 *   提示词：黑体 45px，两行，左 258，字底 339 / 434；颜色横向渐变：绿 → 白（45%）→ 绿；外面一点绿光
 *     从第 0 帧起每帧打 0.6 个字（两行连着打）
 *   小字：20px 灰绿（#7e987a），跟在第二行后面空 14，第 52–62 帧从左往右扫出来
 *   框线：上下两条，都从左边中点出发、到右边中点结束（各长 1150），头尾位置按原片逐帧量的
 *   镜头：0–29 帧 2.25 倍、画面中心对着世界 (…, 380)，从右往左扫（先慢后快），略歪 1.9° → 0.8°；
 *     30 帧起 1.026 倍、偏右 263，先快后慢移回来（80 帧 1 倍居中），慢慢拉远到 0.97（140 帧），最后 12 帧快速推近到 1.18
 *   开头 25 帧从暗到亮
 * 只复刻画面，底部口播字幕不在模板里。
 */

export type PromptBoxProps = {
  lines: string[];
  note: string;
  durationInFrames: number;
};

const SANS = '"Noto Sans CJK SC", "PingFang SC", "Source Han Sans SC", "Hiragino Sans GB", sans-serif';
const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;

export const BOX = { x0: 218, y0: 247, x1: 1158, y1: 483, r: 30 };
export const TEXT = { left: 258, baselines: [339, 434], size: 45, perFrame: 0.6, noteSize: 20, noteGap: 14 };
const ARM = 1150;

const C1_T = [0, 10, 14, 18, 22, 24, 26, 28, 29];
const C1_X = [1700, 1655, 1622, 1568, 1489, 1433, 1361, 1258, 1181];
const C1_Y = [420, 415.6, 401.7, 394.1, 387, 384.3, 381.7, 379, 377.8];
const C1_R = [2.1, 1.89, 1.38, 1.26, 1.06, 1.01, 0.94, 0.86, 0.81];
const C1_S = [2.27, 2.2687, 2.2693, 2.2633, 2.26, 2.2564, 2.2547, 2.2518, 2.2501];
const C2_T = [30, 32, 36, 40, 50, 60, 70, 80, 90, 100, 110, 120, 130, 140, 150, 155, 158, 160, 161];
const C2_S = [1.0262, 1.0255, 1.0226, 1.0204, 1.0152, 1.0101, 1.0058, 1, 0.9947, 0.9897, 0.9849, 0.9797, 0.9752, 0.9705, 0.983, 1.0251, 1.0753, 1.1313, 1.176];
const C2_X = [903.4, 856.3, 810.8, 779.1, 724.9, 686.8, 660.5, 640, 624.8, 613.4, 605.3, 599.7, 596.4, 594.9, 594.3, 592.3, 590, 587.4, 585.3];
const C2_Y = [368.6, 367.5, 365.3, 364, 361.5, 360.5, 360.8, 360, 359.5, 359.7, 359.6, 359.3, 359.7, 359.8, 359.6, 359.5, 359.6, 359.6, 359.6];
const C2_R = [1.08, 1.05, 0.73, 0.64, 0.32, 0.1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];

/** 镜头：世界点 (640,360) 在屏幕上的位置 x/y、缩放 s、转角 r（度） */
export function camera(frame: number) {
  if (frame < 30) {
    return { x: interpolate(frame, C1_T, C1_X, clamp), y: interpolate(frame, C1_T, C1_Y, clamp), s: interpolate(frame, C1_T, C1_S, clamp), r: interpolate(frame, C1_T, C1_R, clamp) };
  }
  return { x: interpolate(frame, C2_T, C2_X, clamp), y: interpolate(frame, C2_T, C2_Y, clamp), s: interpolate(frame, C2_T, C2_S, clamp), r: interpolate(frame, C2_T, C2_R, clamp) };
}

/** 框线上下两条的头尾（沿线的长度，0 = 左边中点，1150 = 右边中点） */
export function arms(frame: number) {
  const f = (t: number[], v: number[]) => interpolate(frame, t, v, clamp);
  return {
    top: {
      tail: f([0, 26, 30, 50, 60, 70, 80, 90, 100, 110, 116], [0, 0, 60, 110, 236, 358, 487, 635, 801, 997, ARM]),
      head: f([0, 20, 28, 36, 40, 50, 60, 70, 80], [300, 450, 500, 530, 625, 805, 942, 1008, ARM]),
    },
    bottom: {
      tail: f([0, 24, 28, 36, 40, 50, 60, 70, 80, 90, 100, 108], [0, 120, 181, 228, 253, 339, 445, 568, 696, 844, 1012, ARM]),
      head: f([0, 20, 28, 36, 40, 50, 60, 70, 80], [300, 500, 560, 609, 703, 868, 987, 1086, ARM]),
    },
  };
}

/** 打到第几个字（两行连着算） */
export function typed(frame: number): number {
  return Math.floor(frame * TEXT.perFrame + 0.2);
}

const midY = (BOX.y0 + BOX.y1) / 2;
const { x0, y0, x1, y1, r } = BOX;
const TOP_PATH = `M ${x0} ${midY} L ${x0} ${y0 + r} A ${r} ${r} 0 0 1 ${x0 + r} ${y0} L ${x1 - r} ${y0} A ${r} ${r} 0 0 1 ${x1} ${y0 + r} L ${x1} ${midY}`;
const BOTTOM_PATH = `M ${x0} ${midY} L ${x0} ${y1 - r} A ${r} ${r} 0 0 0 ${x0 + r} ${y1} L ${x1 - r} ${y1} A ${r} ${r} 0 0 0 ${x1} ${y1 - r} L ${x1} ${midY}`;

export const PromptBox: React.FC<PromptBoxProps> = (p) => {
  const frame = useCurrentFrame();
  const cam = camera(frame);
  const a = arms(frame);
  const light = interpolate(frame, [0, 21, 25], [0.2, 0.5, 1], clamp);
  const n = typed(frame);
  const lines = p.lines.slice(0, 2);
  let left = n;
  const shown = lines.map((l) => {
    const chars = Array.from(l);
    const k = Math.max(0, Math.min(chars.length, left));
    left -= chars.length;
    return chars.slice(0, k).join('');
  });
  const last = lines[lines.length - 1] ?? '';
  const noteX = TEXT.left + measure(last, `500 ${TEXT.size}px ${SANS}`) + TEXT.noteGap;
  const noteU = interpolate(frame, [52, 62], [0, 1], clamp);
  const seg = (arm: { tail: number; head: number }) => ({ strokeDasharray: `${Math.max(0, arm.head - arm.tail).toFixed(1)} 5000`, strokeDashoffset: (-arm.tail).toFixed(1) });
  return (
    <AbsoluteFill style={{ backgroundColor: '#0d160c', overflow: 'hidden' }}>
      <AbsoluteFill style={{ background: 'linear-gradient(100deg, rgb(16,19,13) 0%, rgb(12,24,10) 45%, rgb(6,31,5) 100%)' }} />
      <AbsoluteFill style={{ background: 'linear-gradient(125deg, rgba(0,0,0,0) 20%, rgba(0,0,0,0.22) 32%, rgba(0,0,0,0) 44%, rgba(0,0,0,0) 60%, rgba(0,0,0,0.18) 70%, rgba(0,0,0,0) 80%)', filter: 'blur(30px)' }} />
      <AbsoluteFill style={{ opacity: light, filter: frame < 30 ? 'blur(0.8px)' : undefined }}>
        <AbsoluteFill style={{ transformOrigin: '640px 360px', transform: `translate(${(cam.x - 640).toFixed(1)}px, ${(cam.y - 360).toFixed(1)}px) rotate(${cam.r.toFixed(2)}deg) scale(${cam.s.toFixed(4)})` }}>
          <svg width={1280} height={720} style={{ position: 'absolute', left: 0, top: 0, overflow: 'visible', filter: 'drop-shadow(0 0 4px rgba(120,230,120,0.55))' }}>
            <defs>
              <linearGradient id="pb-line" gradientUnits="userSpaceOnUse" x1={x0} y1={0} x2={x1} y2={0}>
                <stop offset="0" stopColor="#d6e6cc" /><stop offset="0.43" stopColor="#bedcb2" /><stop offset="0.73" stopColor="#95c292" />
                <stop offset="0.9" stopColor="#4c885b" /><stop offset="1" stopColor="#39751e" />
              </linearGradient>
            </defs>
            <path d={TOP_PATH} fill="none" stroke="url(#pb-line)" strokeWidth={3} strokeLinecap="round" pathLength={ARM} {...seg(a.top)} />
            <path d={BOTTOM_PATH} fill="none" stroke="url(#pb-line)" strokeWidth={3} strokeLinecap="round" pathLength={ARM} {...seg(a.bottom)} />
          </svg>
          {shown.map((t, i) => t && (
            <div
              key={i}
              style={{
                position: 'absolute', left: TEXT.left, top: TEXT.baselines[i]! - TEXT.size * 0.88, width: 900, whiteSpace: 'pre', fontFamily: SANS, fontWeight: 500, fontSize: TEXT.size, lineHeight: 1,
                color: 'transparent', backgroundImage: 'linear-gradient(to right, #8fd494 0%, #c7e3c9 22%, #dfe4dd 45%, #d2e6cf 62%, #98e28d 85%, #86e27a 100%)', backgroundSize: '852px 100%',
                WebkitBackgroundClip: 'text', backgroundClip: 'text', filter: 'drop-shadow(0 0 5px rgba(120,220,120,0.35))',
              }}
            >
              {t}
            </div>
          ))}
          {p.note && noteU > 0 && (
            <div style={{ position: 'absolute', left: noteX, top: TEXT.baselines[Math.max(0, lines.length - 1)]! - TEXT.noteSize * 0.95, whiteSpace: 'pre', fontFamily: SANS, fontSize: TEXT.noteSize, lineHeight: 1, color: '#7e987a', clipPath: `inset(-6px ${((1 - noteU) * 100).toFixed(1)}% -6px -6px)` }}>
              {p.note}
            </div>
          )}
        </AbsoluteFill>
      </AbsoluteFill>
      <AbsoluteFill style={{ background: vignetteGradient({ cx: 640, cy: 360, rx: 760, ry: 470, amount: 0.35, power: 2.4 }) }} />
    </AbsoluteFill>
  );
};
