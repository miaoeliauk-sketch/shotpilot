import React from 'react';
import { AbsoluteFill, Easing, Img, interpolate, useCurrentFrame } from 'remotion';
import { assetUrl } from '../asset';
import { Media } from '../media';
import { vignetteGradient } from '../lens';

/**
 * 复刻：虚化的口播人物照片，左边滑进来一个脸上盖着 logo 方块的人，旁边一条条深色对话条打出来（360 帧，1280×720 @30fps）
 *
 * 按原片量的（「照片坐标」和「口播人物 · 提问 · 两个百分比 · 钞票」一样：照片框 x −420–1420、y −50–770，同一张照片能接着用）：
 *   镜头：画面中心对着照片 x 898 → 926，0.88 倍慢慢推到 0.977 倍（先慢后快再慢，300 帧）
 *   左边的人：框 x −380–110、y 50–770；第 8 帧从左下滑进来（18 帧，先快后慢）；logo 方块 288 见方、白底，中心 (−128, 208)
 *   对话条（深灰 #343434、字 40px 白色，高 80）：
 *     第一条右边对齐 x 663、顶 y 147，第 16 帧往左长出来（14 帧），10 帧后开始打字
 *     第二条左边对齐 x 27、顶 y 261，第 84 帧；第三条左边对齐 x 93、顶 y 386，第 88 帧，往右长出来（20 帧）
 *     每 2.3 帧打一个字
 * 只复刻画面，底部口播字幕不在模板里。
 */

export type ChatLine = { text: string; at: number; x: number; y: number; align: 'left' | 'right' };

export type ChatGuestProps = {
  presenter: string;
  guest: string;
  logo: string;
  lines: ChatLine[];
  vignette: boolean;
  durationInFrames: number;
};

const SANS = '"Noto Sans CJK SC", "PingFang SC", "Source Han Sans SC", "Hiragino Sans GB", sans-serif';
const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;

export const PHOTO = { x: -420, y: -50, w: 1840, h: 820 };
export const GUEST = { x0: -380, y0: 50, x1: 110, y1: 770, logoX: -128, logoY: 208, logo: 288, at: 8 };
export const LINE = { h: 80, size: 40, pad: 16, step: 2.3 };

const CAM_T = [0, 30, 50, 80, 100, 150, 200, 250, 300, 360];
const CAM_S = [0.8798, 0.882, 0.8844, 0.8886, 0.894, 0.9162, 0.9504, 0.9681, 0.9752, 0.9772];
const CAM_X = [898.3, 898.6, 899.1, 900.3, 901.9, 908.5, 918.4, 923.6, 925.6, 926.2];

export function camera(frame: number) {
  return { s: interpolate(frame, CAM_T, CAM_S, clamp), x: interpolate(frame, CAM_T, CAM_X, clamp), y: 360 };
}

/** 对话条：长出来（横 14–20 帧、竖 10 帧）、10 帧后开始打字 */
export function lineState(frame: number, line: ChatLine) {
  const t = frame - line.at;
  const n = Array.from(line.text).length;
  return {
    grow: Easing.out(Easing.cubic)(interpolate(t, [0, 16], [0, 1], clamp)),
    tall: Easing.out(Easing.quad)(interpolate(t, [2, 12], [0, 1], clamp)),
    typed: Math.max(0, Math.min(n, Math.floor((t - 10) / LINE.step) + 1)),
  };
}

export const ChatGuest: React.FC<ChatGuestProps> = (p) => {
  const frame = useCurrentFrame();
  const cam = camera(frame);
  const g = Easing.out(Easing.cubic)(interpolate(frame, [GUEST.at, GUEST.at + 18], [0, 1], clamp));
  return (
    <AbsoluteFill style={{ backgroundColor: '#8a8a8a', overflow: 'hidden' }}>
      <AbsoluteFill style={{ transformOrigin: '640px 360px', transform: `translate(${(cam.x - 640).toFixed(2)}px, ${(cam.y - 360).toFixed(2)}px) scale(${cam.s.toFixed(4)})` }}>
        <div style={{ position: 'absolute', left: PHOTO.x, top: PHOTO.y, width: PHOTO.w, height: PHOTO.h }}>
          <Media src={p.presenter} style={{ width: '100%', height: '100%' }} />
        </div>
        {/* 左边的人 + logo 方块 */}
        {(p.guest || p.logo) && frame >= GUEST.at && (
          <div style={{ position: 'absolute', left: 0, top: 0, width: 1280, height: 720, opacity: Math.min(1, g * 4), transform: `translate(${(-300 * (1 - g)).toFixed(1)}px, ${(320 * (1 - g)).toFixed(1)}px)` }}>
            {p.guest && (
              <Img src={assetUrl(p.guest)} style={{ position: 'absolute', left: GUEST.x0, top: GUEST.y0, width: GUEST.x1 - GUEST.x0, height: GUEST.y1 - GUEST.y0, objectFit: 'contain', objectPosition: '50% 100%' }} />
            )}
            {p.logo && (
              <div
                style={{
                  position: 'absolute', left: GUEST.logoX - GUEST.logo / 2, top: GUEST.logoY - GUEST.logo / 2, width: GUEST.logo, height: GUEST.logo, borderRadius: 10, background: '#fbfbfb',
                  boxShadow: '6px 10px 18px rgba(0,0,0,0.3)', overflow: 'hidden',
                }}
              >
                <Img src={assetUrl(p.logo)} style={{ position: 'absolute', inset: '9%', width: '82%', height: '82%', objectFit: 'contain' }} />
              </div>
            )}
          </div>
        )}
        {p.lines.map((l, i) => (
          <Line key={i} line={l} frame={frame} />
        ))}
      </AbsoluteFill>
      {p.vignette && <AbsoluteFill style={{ background: vignetteGradient({ cx: 640, cy: 360, rx: 740, ry: 460, amount: 0.4, power: 2.4 }) }} />}
    </AbsoluteFill>
  );
};

const Line: React.FC<{ line: ChatLine; frame: number }> = ({ line, frame }) => {
  if (frame < line.at || !line.text) return null;
  const st = lineState(frame, line);
  const chars = Array.from(line.text);
  const w = chars.reduce((s, ch) => s + (/[\x00-\xff]/.test(ch) ? 0.5 : 1) * LINE.size, 0) * 0.98 + LINE.pad * 2;
  const shown = w * st.grow;
  const h = 4 + (LINE.h - 4) * st.tall;
  const left = line.align === 'right' ? line.x - shown : line.x;
  return (
    <div
      style={{
        position: 'absolute', left, top: line.y + LINE.h - h, width: shown, height: h, background: 'rgba(52,52,52,0.96)', boxShadow: '4px 6px 12px rgba(0,0,0,0.3)', overflow: 'hidden',
      }}
    >
      <div
        style={{
          position: 'absolute', top: 0, height: LINE.h, lineHeight: `${LINE.h}px`, whiteSpace: 'pre', fontFamily: SANS, fontSize: LINE.size, color: '#f2f2f2',
          ...(line.align === 'right' ? { left: LINE.pad - (w - shown) } : { left: LINE.pad }),
        }}
      >
        {chars.slice(0, st.typed).join('')}
      </div>
    </div>
  );
};
