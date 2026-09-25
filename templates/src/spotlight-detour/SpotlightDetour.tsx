import React from 'react';
import { AbsoluteFill, Easing, interpolate, random, useCurrentFrame } from 'remotion';
import { Media } from '../media';
import { measure } from '../text-layout';
import { vignetteGradient } from '../lens';

/**
 * 复刻：格子纸上的聚光圆台 —— 产品转着落进灰色圆里、金色「入口」、左右红字带灰色光带飞进来 →
 * 镜头往上一摇，换到另一张格子纸：产品盒子落下来，三个红色大字标签，一个粉红色大圆从下面长出来（512 帧，1280×720 @30fps）
 *
 * ── 场景一（0–244）────────────────────────────────────────────────────
 *   浅灰格子纸（36px 一格）。灰色半透明圆（中心 645, 357，半径 327），下面一块深灰梯形「地面」
 *   镜头从 1.71 倍慢慢拉远：30 帧 1.52、60 帧 1.24、100 帧 1.07、150 帧回到 1 倍（实测圆的大小）
 *   产品（手机）从 −175° 转着、放大 1.35 倍落进圆里：45 帧转正，50–60 帧多转 4° 再回来
 *   金色「入口」+ 橙色斜体小字，第 28 帧从很大、很虚压下来（12 帧）
 *   左边红字（绕路）第 76 帧带着灰色光带从画面外横着滑进来（14 帧，拖着运动模糊），右边红字（超车）第 102 帧
 * ── 镜头往上摇（244–340）──────────────────────────────────────────────
 *   两张纸上下贴着，整体往下走 720：先慢后快（244–268），再越来越慢（268–292），冲过头 11px，340 帧回正
 * ── 场景二 ──────────────────────────────────────────────────────────
 *   产品盒子跟着纸一起下来，自己还从歪 11°、0.85 倍转正放大（268–300）
 *   标签：大红毛笔字「绕」+ 加粗宋体标题 + 三四行灰色小字。左边、上面两个一开始就在纸上，右边的第 302 帧闪进来
 *   粉红色大圆（中心 622, 790，半径 620）第 298 帧从中间长出来，12 帧长满
 * 只复刻画面，底部口播字幕不在模板里。
 */

export type DetourLabel = { mark: string; title: string; body: string };

export type SpotlightDetourProps = {
  product: string;
  box: string;
  center: string;
  centerSub: string;
  left: string;
  right: string;
  labels: DetourLabel[];
  centerAt: number;
  leftAt: number;
  rightAt: number;
  panAt: number;
  circleAt: number;
  durationInFrames: number;
};

const SERIF = '"Noto Serif CJK SC", "Songti SC", "STSong", "Source Han Serif SC", serif';
const SANS = '"Noto Sans CJK SC", "PingFang SC", "Source Han Sans SC", "Hiragino Sans GB", sans-serif';
const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;

/** 场景一的镜头：圆心在画面上的位置、倍数（实测） */
const A_T = [0, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70, 75, 80, 85, 90, 95, 100, 110, 120, 130, 150, 200, 230];
const A_S = [1.78, 1.71, 1.71, 1.71, 1.636, 1.523, 1.462, 1.382, 1.336, 1.284, 1.254, 1.235, 1.211, 1.202, 1.196, 1.156, 1.131, 1.11, 1.089, 1.073, 1.043, 1.028, 1.012, 1.006, 1, 1.003];
const A_X = [560, 560, 587, 631, 633, 641, 637, 645, 643, 645, 645, 647, 645, 645, 649, 649, 647, 647, 645, 647, 649, 645, 641, 645, 645, 645];
const A_Y = [360, 360, 329, 309, 301, 297, 291, 287, 287, 285, 283, 281, 281, 281, 283, 297, 307, 315, 323, 327, 339, 343, 349, 357, 359, 367];
export const CIRCLE = { x: 645, y: 357, r: 327 };
/** 产品自己转（度），相对第 0 帧 */
const SPIN_T = [0, 3, 6, 8, 10, 12, 14, 16, 18, 20, 25, 28, 35, 40, 45, 50, 60, 80];
const SPIN_R = [-175, -155, -136, -120, -105, -92, -81, -70, -61, -53, -35, -26, -11, -3, 0, 4, 4, 0];
const SPIN_S = [1.35, 1.32, 1.3, 1.25, 1.2, 1.15, 1.11, 1.07, 1.04, 1.03, 1.0, 1, 1, 1, 1, 1, 1, 1];
/** 往上摇：两张纸一起往下走多少（相对 panAt） */
const PAN_T = [0, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 26, 30, 32, 34, 36, 38, 40, 44, 48, 52, 56, 66, 96];
const PAN_Y = [0, 16, 26, 38, 52, 72, 92, 122, 158, 210, 274, 425, 518, 572, 612, 643, 667, 686, 711, 725, 731, 731, 728, 720];
/** 产品（世界坐标）：中心 (640, 330)、斜 24.6°，长 528 */
export const PRODUCT = { x: 640, y: 330, w: 250, h: 528, rot: 24.6 };
export const BOX = { x: 628, y: 475, w: 490, h: 320 };
const PINK = { x: 622, y: 790, r: 620 };
/** 三个标签的位置（场景二，停稳时的画面坐标） */
export const LABELS = [
  { markX: 15, markY: 270, titleX: 165, titleY: 325, bodyX: 160, bodyY: 368, width: 300 },
  { markX: 385, markY: 25, titleX: 532, titleY: 75, bodyX: 535, bodyY: 112, width: 310 },
  { markX: 775, markY: 220, titleX: 910, titleY: 270, bodyX: 910, bodyY: 313, width: 325 },
];

export function sceneACamera(t: number) {
  return { s: interpolate(t, A_T, A_S, clamp), x: interpolate(t, A_T, A_X, clamp), y: interpolate(t, A_T, A_Y, clamp) };
}

export function panOffset(t: number): number {
  return interpolate(t, PAN_T, PAN_Y, clamp);
}

export const SpotlightDetour: React.FC<SpotlightDetourProps> = (p) => {
  const frame = useCurrentFrame();
  const pan = panOffset(frame - p.panAt);
  const cam = sceneACamera(Math.min(frame, p.panAt));
  return (
    <AbsoluteFill style={{ backgroundColor: '#e2e2e2', overflow: 'hidden' }}>
      {/* 场景一：随镜头缩放，再跟着往下走 */}
      {pan < 720 && (
        <AbsoluteFill style={{ transform: `translateY(${pan}px)` }}>
          <GridPaper />
          <div style={{ position: 'absolute', left: 0, top: 0, width: 1280, height: 720, transformOrigin: '0 0', transform: `translate(${cam.x}px, ${cam.y}px) scale(${cam.s}) translate(${-CIRCLE.x}px, ${-CIRCLE.y}px)` }}>
            <SceneA p={p} frame={frame} />
          </div>
        </AbsoluteFill>
      )}
      {/* 场景二：在场景一上面，一起往下走进来 */}
      {pan > 0 && (
        <AbsoluteFill style={{ transform: `translateY(${pan - 720}px)` }}>
          <GridPaper />
          <SceneB p={p} frame={frame} />
        </AbsoluteFill>
      )}
      <AbsoluteFill style={{ background: vignetteGradient({ cx: 640, cy: 360, rx: 760, ry: 470, amount: 0.38, power: 2.4 }) }} />
    </AbsoluteFill>
  );
};

const GridPaper: React.FC = () => (
  <AbsoluteFill
    style={{
      backgroundColor: '#e6e6e6',
      backgroundImage: 'linear-gradient(to right, rgba(0,0,0,0.075) 1px, transparent 1px), linear-gradient(to bottom, rgba(0,0,0,0.075) 1px, transparent 1px)',
      backgroundSize: '36px 36px', backgroundPosition: '-6px -8px',
    }}
  />
);

/** 场景一（世界坐标 = 镜头 1 倍时的画面坐标） */
const SceneA: React.FC<{ p: SpotlightDetourProps; frame: number }> = ({ p, frame }) => {
  const rot = interpolate(frame, SPIN_T, SPIN_R, clamp);
  const own = interpolate(frame, SPIN_T, SPIN_S, clamp);
  const leftU = Easing.out(Easing.cubic)(interpolate(frame, [p.leftAt, p.leftAt + 14], [0, 1], clamp));
  const rightU = Easing.out(Easing.cubic)(interpolate(frame, [p.rightAt, p.rightAt + 14], [0, 1], clamp));
  return (
    <>
      {/* 光带：从画面边上往圆收窄，外深里浅 */}
      <Band side="left" u={leftU} />
      <Band side="right" u={rightU} />
      {/* 地面 */}
      <div style={{ position: 'absolute', left: 0, top: 0, width: 1280, height: 900, clipPath: 'polygon(445px 585px, 845px 585px, 1080px 760px, 225px 760px)', background: 'linear-gradient(to bottom, #5e5e5e, #7d7d7d 60%, #9a9a9a)' }} />
      {/* 灰色圆 */}
      <div
        style={{
          position: 'absolute', left: CIRCLE.x - CIRCLE.r, top: CIRCLE.y - CIRCLE.r, width: CIRCLE.r * 2, height: CIRCLE.r * 2, borderRadius: '50%',
          background: 'radial-gradient(circle at 60% 25%, rgba(185,185,185,0.45), rgba(120,120,120,0.6) 60%, rgba(85,85,85,0.72) 100%)',
          boxShadow: 'inset 0 0 0 2px rgba(110,110,125,0.55), inset 0 0 30px rgba(0,0,0,0.18)',
        }}
      />
      {/* 产品 */}
      <div
        style={{
          position: 'absolute', left: PRODUCT.x - PRODUCT.w / 2, top: PRODUCT.y - PRODUCT.h / 2, width: PRODUCT.w, height: PRODUCT.h,
          transform: `rotate(${PRODUCT.rot + rot}deg) scale(${own})`, filter: 'drop-shadow(-10px 18px 18px rgba(0,0,0,0.45))',
        }}
      >
        <Media src={p.product} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
      </div>
      <SideWord text={p.left} side="left" u={leftU} />
      <SideWord text={p.right} side="right" u={rightU} />
      <CenterWord text={p.center} sub={p.centerSub} t={frame - p.centerAt} />
    </>
  );
};

const Band: React.FC<{ side: 'left' | 'right'; u: number }> = ({ side, u }) => {
  if (u <= 0) return null;
  const dx = (1 - u) * (side === 'left' ? -420 : 420);
  const poly = side === 'left' ? 'polygon(-200px 150px, 330px 172px, 330px 562px, -200px 592px)' : 'polygon(950px 172px, 1480px 150px, 1480px 592px, 950px 562px)';
  // 外边深、往圆那边越来越淡
  const grad = side === 'left'
    ? 'linear-gradient(to right, #474747 0px, #6a6a6a 120px, rgba(150,150,150,0.55) 260px, rgba(200,200,200,0) 345px)'
    : 'linear-gradient(to left, #474747 0px, #6a6a6a 120px, rgba(150,150,150,0.55) 260px, rgba(200,200,200,0) 345px)';
  return (
    <div style={{ position: 'absolute', left: dx, top: 0, width: 1280, height: 720, clipPath: poly, opacity: Math.min(1, u * 2) }}>
      <div style={{ position: 'absolute', top: 0, height: 720, width: 545, left: side === 'left' ? -200 : 935, background: grad }} />
    </div>
  );
};

/** 红字：压窄的粗宋，红色渐变 + 红光；横着滑进来，拖着模糊 */
const SideWord: React.FC<{ text: string; side: 'left' | 'right'; u: number }> = ({ text, side, u }) => {
  if (u <= 0 || !text) return null;
  const size = 190;
  const squeeze = 0.66;
  const w = measure(text, `900 ${size}px ${SERIF}`) * squeeze;
  const x0 = side === 'left' ? 20 : 1255 - w;
  const dx = (1 - u) * (side === 'left' ? -520 : 520);
  const blur = 10 * (1 - u);
  return (
    <div
      style={{
        position: 'absolute', left: x0 + dx, top: 377 - size * 0.62, height: size * 1.2, lineHeight: `${size * 1.2}px`, whiteSpace: 'pre', fontFamily: SERIF, fontWeight: 900, fontSize: size,
        transform: `scaleX(${squeeze}) skewX(-6deg)`, transformOrigin: '0 50%', filter: `${blur > 0.2 ? `blur(${blur.toFixed(1)}px) ` : ''}drop-shadow(0 0 10px rgba(255,40,40,0.55))`,
        color: 'transparent', backgroundImage: 'linear-gradient(to bottom, #ff3b3b, #d4101a 60%, #9e0a12)', WebkitBackgroundClip: 'text', backgroundClip: 'text',
      }}
    >
      {text}
    </div>
  );
};

/** 金色「入口」：从很大、很虚压下来；上面叠一行橙色斜体小字 */
const CenterWord: React.FC<{ text: string; sub: string; t: number }> = ({ text, sub, t }) => {
  if (t < 0 || !text) return null;
  const u = Easing.out(Easing.cubic)(interpolate(t, [0, 12], [0, 1], clamp));
  const size = 180;
  const squeeze = 0.64;
  const w = measure(text, `900 ${size}px ${SERIF}`) * squeeze;
  const s = 2.4 - 1.4 * u;
  const blur = 12 * (1 - u);
  return (
    <div style={{ position: 'absolute', left: 648 - w / 2, top: 535 - size * 0.6, width: w, height: size * 1.2, transform: `scale(${s})`, transformOrigin: '50% 50%', opacity: Math.min(1, u * 2.5), filter: blur > 0.2 ? `blur(${blur.toFixed(1)}px)` : undefined }}>
      <div
        style={{
          position: 'absolute', left: 0, top: 0, height: size * 1.2, lineHeight: `${size * 1.2}px`, whiteSpace: 'pre', fontFamily: SERIF, fontWeight: 900, fontSize: size,
          transform: `scaleX(${squeeze}) skewX(-8deg)`, transformOrigin: '0 50%', color: 'transparent',
          backgroundImage: 'linear-gradient(to bottom, #fff6a8 10%, #ffd23a 45%, #f39a1c 90%)', WebkitBackgroundClip: 'text', backgroundClip: 'text',
          filter: 'drop-shadow(0 0 12px rgba(255,170,40,0.75))',
        }}
      >
        {text}
      </div>
      {sub && (
        <div style={{ position: 'absolute', left: 0, right: 0, top: size * 0.55, textAlign: 'center', fontFamily: SERIF, fontStyle: 'italic', fontWeight: 700, fontSize: 26, letterSpacing: 4, color: 'rgba(240,110,30,0.9)', whiteSpace: 'pre' }}>
          {sub}
        </div>
      )}
    </div>
  );
};

/** 场景二（画面坐标） */
const SceneB: React.FC<{ p: SpotlightDetourProps; frame: number }> = ({ p, frame }) => {
  const tb = frame - p.panAt;
  const boxU = Easing.out(Easing.cubic)(interpolate(tb, [24, 56], [0, 1], clamp));
  const pinkU = Easing.out(Easing.back(1.2))(interpolate(frame, [p.circleAt, p.circleAt + 12], [0, 1], clamp));
  return (
    <>
      {pinkU > 0 && (
        <div
          style={{
            position: 'absolute', left: PINK.x - PINK.r, top: PINK.y - PINK.r, width: PINK.r * 2, height: PINK.r * 2, borderRadius: '50%', transform: `scale(${pinkU})`,
            background: 'radial-gradient(circle at 50% 45%, rgba(236,120,120,0.72), rgba(226,95,95,0.8) 70%, rgba(215,80,80,0.85))',
          }}
        />
      )}
      {p.labels.slice(0, 3).map((l, i) => (
        <Label key={i} label={l} slot={LABELS[i]!} appear={i < 2 ? 1 : interpolate(frame, [p.circleAt + 4, p.circleAt + 12], [0, 1], clamp)} seed={i} frame={frame} />
      ))}
      <div
        style={{
          position: 'absolute', left: BOX.x - BOX.w / 2, top: BOX.y - BOX.h / 2, width: BOX.w, height: BOX.h,
          transform: `rotate(${11 * (1 - boxU)}deg) scale(${0.85 + 0.15 * boxU})`, filter: 'drop-shadow(0 22px 22px rgba(0,0,0,0.35))',
        }}
      >
        <Media src={p.box} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
      </div>
    </>
  );
};

/** 标签：大红毛笔字 + 加粗宋体标题 + 灰色小字；出现时闪几下、从右边一点挪过来 */
const Label: React.FC<{ label: DetourLabel; slot: (typeof LABELS)[number]; appear: number; seed: number; frame: number }> = ({ label, slot, appear, seed, frame }) => {
  if (appear <= 0) return null;
  const flicker = appear < 1 && random(`lab-${seed}-${frame}`) < 0.35 ? 0.3 : 1;
  const dx = (1 - appear) * 40;
  const bodyLines = wrapChars(label.body, `19px ${SANS}`, slot.width);
  return (
    <div style={{ position: 'absolute', left: dx, top: 0, opacity: appear * flicker, filter: appear < 1 ? `blur(${(4 * (1 - appear)).toFixed(1)}px)` : undefined }}>
      <div
        style={{
          position: 'absolute', left: slot.markX, top: slot.markY - 10, height: 220, lineHeight: '220px', fontFamily: SERIF, fontWeight: 900, fontSize: 190, whiteSpace: 'pre',
          transform: 'scaleX(0.78) skewX(-6deg)', transformOrigin: '0 50%', color: '#c9141c',
          filter: 'drop-shadow(-3px 0 0 rgba(60,120,230,0.35)) drop-shadow(4px 6px 6px rgba(120,0,0,0.35))',
        }}
      >
        {label.mark}
      </div>
      <div style={{ position: 'absolute', left: slot.titleX, top: slot.titleY - 25, height: 50, lineHeight: '50px', fontFamily: SERIF, fontWeight: 900, fontSize: 41, color: '#2c2c2c', whiteSpace: 'pre' }}>{label.title}</div>
      {bodyLines.map((line, i) => (
        <div key={i} style={{ position: 'absolute', left: slot.bodyX, top: slot.bodyY + i * 26 - 13, height: 26, lineHeight: '26px', fontFamily: SANS, fontSize: 19, color: '#7a7a7a', whiteSpace: 'pre' }}>
          {line}
        </div>
      ))}
    </div>
  );
};

export function wrapChars(text: string, font: string, width: number): string[] {
  const lines: string[] = [];
  let cur = '';
  for (const ch of Array.from(text)) {
    if (cur && measure(cur + ch, font) > width && !/[，。、；：！？）」』”]/.test(ch)) {
      lines.push(cur);
      cur = ch;
    } else cur += ch;
  }
  if (cur) lines.push(cur);
  return lines;
}
