import React from 'react';
import { AbsoluteFill, Img, interpolate, useCurrentFrame } from 'remotion';
import { assetUrl } from '../asset';
import { smoothTrack } from '../curve';

/**
 * 复刻：一张很长的深色网页截图，从最底下两段快速往上滚到顶（先一下、慢一点、再一下，越滚越慢停住），
 * 停住后镜头推近到标题下面，两条浅灰标签（中文翻译）从左往右长出来，最后整页往上甩走（167 帧，1280×720 @30fps）
 *
 * 按原片量的（「网页坐标」= 网页宽 1280 时的像素，停住那一刻网页顶端贴着画面顶）：
 *   滚动：第 0 帧网页底贴着画面底，按原片的曲线滚到顶（第 67 帧），两次快滚在第 5 帧和第 37 帧前后，最快一帧滚 190
 *   推近：从第 67 帧（滚动停下、1 倍）接着推，焦点先留在原地、慢慢起步，第 91–110 帧推得最快，
 *     第 131 帧前后到 1.8 倍、焦点到画面 (640, 360)，之后焦点再慢慢往下挪 6（原片网页点 (540, 232) 的轨迹）
 *   标签：浅灰（#e0dfdc）底、深色宋体字，高 37.5（网页坐标）、字 25；第一条左上 (272, 181)，第二条 (272, 228)；
 *     第 81 帧起从左往右长出来（16 帧），第二条晚 2 帧
 *   结尾 14 帧整页往上甩走，越甩越快
 *   画面四周暗、带一点红蓝错色
 * 只复刻画面，底部口播字幕不在模板里。
 */

export type PageLabel = { text: string; x: number; y: number };

export type PageScrollLabelsProps = {
  page: string;
  pageHeight: number;
  labels: PageLabel[];
  focusX: number;
  focusY: number;
  labelsAt: number;
  durationInFrames: number;
};

const SERIF = '"Noto Serif CJK SC", "Songti SC", "STSong", "Source Han Serif SC", serif';
const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;

export const LABEL = { h: 37.5, size: 25, pad: 9, gap: 2 };
const SCROLL_T = [0, 1, 3, 5, 7, 9, 12, 17, 22, 27, 30, 32, 34, 35, 36, 37, 38, 39, 41, 43, 45, 47, 50, 53, 57, 61, 65, 67];
const SCROLL_U = [1, 0.9894, 0.9659, 0.9331, 0.8936, 0.8603, 0.8248, 0.784, 0.7474, 0.7011, 0.66, 0.6207, 0.5632, 0.5225, 0.4695, 0.4047, 0.34, 0.2873, 0.2142, 0.1661, 0.1313, 0.1046, 0.0743, 0.0518, 0.03, 0.0147, 0.004, 0];
/** 推近：从第 67 帧起算，缩放（第 67 帧 = 1）和原片焦点（网页点 (540, 232)）在画面上的位置 */
const ZOOM_REF = { x: 540, y: 232 };
const ZOOM_T = [0, 3, 6, 9, 13, 16, 21, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 36, 38, 41, 43, 45, 47, 50, 52, 58, 64, 68, 73, 80];
const ZOOM_S = [1, 1.0056, 1.0121, 1.021, 1.0395, 1.0606, 1.1157, 1.1503, 1.1735, 1.2021, 1.2382, 1.2867, 1.3504, 1.4185, 1.482, 1.5345, 1.5754, 1.6067, 1.6305, 1.6657, 1.6928, 1.724, 1.7408, 1.755, 1.7666, 1.7798, 1.7862, 1.7968, 1.8, 1.8, 1.8, 1.8];
const ZOOM_X = [540, 540.4, 541.1, 542.3, 544.7, 547.4, 553.6, 557.8, 561.1, 565.5, 571.1, 577.7, 585, 592.4, 599.4, 605.6, 610.7, 615.1, 618.7, 624.1, 627.6, 631.2, 633.1, 634.8, 636.2, 637.9, 638.7, 640.3, 640.8, 640.8, 640.7, 640.7];
const ZOOM_Y = [232, 233.2, 234.7, 236.6, 240, 243.4, 251.1, 256.1, 259.9, 264.8, 271.1, 278.5, 286.5, 294.7, 302.5, 309.3, 315.2, 320.2, 324.4, 330.9, 335.5, 340.5, 343.4, 346, 348.3, 351.3, 353, 357.1, 359.9, 361.4, 363.2, 366.2];
const EXIT_T = [0, 4, 8, 10, 12, 14];
const EXIT_Y = [0, -10, -92, -162, -278, -420];

/** 滚动：网页往上移了多少（网页坐标），0 = 网页顶贴着画面顶 */
export function scrollOffset(frame: number, maxScroll: number): number {
  return maxScroll * smoothTrack(frame, SCROLL_T, SCROLL_U);
}

/**
 * 推近：焦点在画面上的位置和缩放（缩放以网页坐标为 1）。
 * 第 67 帧焦点就在它滚停时的位置（和滚动接得上，不跳），推近的过程中再挪到原片的落点（画面中间）
 */
export function zoom(frame: number, focusX: number = ZOOM_REF.x, focusY: number = ZOOM_REF.y) {
  const t = frame - 67;
  const s = smoothTrack(t, ZOOM_T, ZOOM_S);
  const k = 1 - Math.min(1, Math.max(0, (s - 1) / (ZOOM_S[ZOOM_S.length - 1]! - 1)));
  return { s, x: smoothTrack(t, ZOOM_T, ZOOM_X) + (focusX - ZOOM_REF.x) * k, y: smoothTrack(t, ZOOM_T, ZOOM_Y) + (focusY - ZOOM_REF.y) * k };
}

export function labelWipe(frame: number, at: number, i: number): number {
  const u = interpolate(frame - at - 2 * i, [0, 4, 8, 12, 16], [0, 0.18, 0.55, 0.85, 1], clamp);
  return u;
}

export const PageScrollLabels: React.FC<PageScrollLabelsProps> = (p) => {
  const frame = useCurrentFrame();
  const maxScroll = Math.max(0, p.pageHeight - 720);
  const exitAt = p.durationInFrames - 14;
  const exitY = frame > exitAt ? interpolate(frame - exitAt, EXIT_T, EXIT_Y, { extrapolateLeft: 'clamp', extrapolateRight: 'extend' }) : 0;
  const exitV = frame > exitAt ? Math.abs(exitY - (frame - 1 > exitAt ? interpolate(frame - 1 - exitAt, EXIT_T, EXIT_Y, clamp) : 0)) : 0;
  let transform: string;
  let vblur = 0;
  if (frame < 67) {
    const o = scrollOffset(frame, maxScroll);
    vblur = Math.abs(o - scrollOffset(frame - 1, maxScroll));
    transform = `translateY(${(-o).toFixed(1)}px)`;
  } else {
    const z = zoom(frame, p.focusX, p.focusY);
    transform = `translate(${(z.x - p.focusX * z.s).toFixed(2)}px, ${(z.y - p.focusY * z.s + exitY).toFixed(2)}px) scale(${z.s.toFixed(4)})`;
    vblur = exitV;
  }
  // 原片滚得很快也没怎么糊：只有特别快的几帧带一点竖向模糊
  const blur = Math.min(8, Math.max(0, (vblur - 60) / 20));
  return (
    <AbsoluteFill style={{ backgroundColor: '#0b0d0c', overflow: 'hidden' }}>
      <AbsoluteFill style={{ filter: blur > 0.6 ? `blur(${blur.toFixed(1)}px)` : undefined }}>
        <div style={{ position: 'absolute', left: 0, top: 0, width: 1280, height: p.pageHeight, transformOrigin: '0 0', transform }}>
          {p.page && <Img src={assetUrl(p.page)} style={{ position: 'absolute', left: 0, top: 0, width: 1280, height: p.pageHeight }} />}
          {p.labels.slice(0, 3).map((l, i) => {
            const u = labelWipe(frame, p.labelsAt, i);
            if (u <= 0 || !l.text) return null;
            return (
              <div key={i} style={{ position: 'absolute', left: l.x, top: l.y, height: LABEL.h, padding: `0 ${LABEL.pad}px`, whiteSpace: 'pre', background: 'linear-gradient(to bottom, #e4e3e0, #dcdad6)', clipPath: `inset(0 ${((1 - u) * 100).toFixed(1)}% 0 0)`, boxShadow: '1px 2px 3px rgba(0,0,0,0.35)' }}>
                <span style={{ fontFamily: SERIF, fontWeight: 600, fontSize: LABEL.size, lineHeight: `${LABEL.h}px`, color: '#1b1b1a' }}>{l.text}</span>
              </div>
            );
          })}
        </div>
      </AbsoluteFill>
      {/* 四周暗、边上一点红蓝错色（像镜头边缘） */}
      <AbsoluteFill style={{ background: 'radial-gradient(ellipse 760px 470px at 640px 360px, rgba(0,0,0,0) 55%, rgba(0,0,0,0.5) 100%)' }} />
      <AbsoluteFill style={{ boxShadow: 'inset 3px 0 6px rgba(255,60,60,0.12), inset -3px 0 6px rgba(60,160,255,0.12)' }} />
    </AbsoluteFill>
  );
};
