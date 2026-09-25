import React, { useMemo } from 'react';
import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from 'remotion';
import { BAR, BarText, CARD_WIDTH, PostCard, SANS, barFont, layoutPost, type PostCardData, type PostLayout } from './PostCard';
import { measure } from '../text-layout';

/**
 * 复刻：帖子截图飞进来、翻译黑条刷出来 → 一刀切到黑条特写、横着滑到句尾（141 + 53 帧，1280×720 @30fps）
 *
 * ── 卡片（0–140）───────────────────────────────────────────────────
 *   深灰底，整个画面压一层暗角（四角只剩三成亮）。帖子截图（宽 763）从左下斜着滑进画面中间：
 *   中心 (368, 578) → (639, 359)，转角 4.8° → 0.2°，第 1–60 帧，先快后慢（贝塞尔 0.08, 0.33, 0.34, 1）
 *   同时整张一直在慢慢放大，每帧 0.032%（第 0 帧 0.981 倍，第 58 帧 1 倍）
 *   卡片四周一圈橙色的光边；景深：画面中间一竖条是实的，往左右越来越虚
 *   翻译黑条第 51 帧起从左往右刷，73 帧刷完，先快后慢（贝塞尔 0.02, 0.25, 0.23, 0.9）
 *
 * ── 特写（140–）──────────────────────────────────────────────────────
 *   一刀切到黑条特写：后面是放大 2.8 倍、很虚的帖子（不动），前面单独一层黑条放大 6.7 倍，
 *   从句首往左滑到句尾（右端停在 x 1100），第一帧每帧滑 190px，越来越慢，52 帧停稳；
 *   前 16 帧从很虚（高斯 10px）对上焦；黑条下面一片斜的影子，字边上一点红蓝色差；四周暗角
 *
 * 只复刻画面，底部口播字幕不在模板里。
 */

export type PostTranslateProps = PostCardData & {
  /** 卡片飞进来（帧） */
  flyAt: number;
  flyFrames: number;
  barAt: number;
  barFrames: number;
  /** 从这一帧起切到黑条特写；-1 = 不切 */
  closeAt: number;
  /** 只要特写（「翻译金句 · 特写横移」模板） */
  closeOnly?: boolean;
  closeFrames: number;
  durationInFrames: number;
};

const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;

const FLY = { from: [368.2, 577.9], to: [639.4, 358.8], rotFrom: 4.77, rotTo: 0.175, ease: Easing.bezier(0.084, 0.331, 0.336, 1) };
/** 慢慢放大：第 0 帧 0.981 倍，每帧 +0.000324 */
const DRIFT = { s0: 0.981, perFrame: 0.000324 };
const BAR_EASE = Easing.bezier(0.024, 0.25, 0.23, 0.9);

/**
 * 景深（实测）：虚的程度只和画面横坐标有关，约 0.00001 ×（x − 690）²：
 * 中间 x 470–910 基本是实的，最左边虚到 5px 左右。用三层（6px、2px、实的）按横向渐变叠出来。
 */
const TILT = {
  far: 6,
  mid: 2,
  // 2px 那层：虚到 2px 以内全不透明，到 6px 变透明
  midMask: 'linear-gradient(to right, rgba(0,0,0,0.31) 0%, rgba(0,0,0,0.63) 7.8%, #000 19%, #000 88.8%, rgba(0,0,0,0.63) 100%)',
  // 实的那层：x 690 全实，虚到 2px（x 243 / 1137）全透明
  sharpMask: 'linear-gradient(to right, transparent 19%, rgba(0,0,0,0.25) 23.7%, rgba(0,0,0,0.5) 29.2%, rgba(0,0,0,0.75) 36.4%, #000 50%, #000 58%, rgba(0,0,0,0.75) 71.4%, rgba(0,0,0,0.5) 78.6%, rgba(0,0,0,0.25) 84.1%, transparent 88.8%)',
};

/**
 * 暗角（实测，按卡片白底的亮度拟合）：椭圆中心 (650, 358)、半径 764 × 426，
 * 变暗 0.47 × d^2.43（d = 到中心的椭圆距离）；四角只剩三成亮
 */
const VIGNETTE = 'radial-gradient(ellipse 764px 426px at 650px 358px, rgba(0,0,0,0) 0%, rgba(0,0,0,0.016) 25%, rgba(0,0,0,0.087) 50%, rgba(0,0,0,0.15) 62.5%, rgba(0,0,0,0.235) 75%, rgba(0,0,0,0.34) 87.5%, rgba(0,0,0,0.47) 100%, rgba(0,0,0,0.62) 112.5%, rgba(0,0,0,0.79) 125%, rgba(0,0,0,0.95) 137.5%, #000 145%)';

/** 特写的暗角（实测）：中心 (645, 364)、半径 704 × 438，变暗 0.45 × d^2.58 */
const CLOSE_VIGNETTE = 'radial-gradient(ellipse 704px 438px at 645px 364px, rgba(0,0,0,0) 0%, rgba(0,0,0,0.013) 25%, rgba(0,0,0,0.075) 50%, rgba(0,0,0,0.134) 62.5%, rgba(0,0,0,0.213) 75%, rgba(0,0,0,0.318) 87.5%, rgba(0,0,0,0.45) 100%, rgba(0,0,0,0.61) 112.5%, rgba(0,0,0,0.8) 125%, #000 137.5%)';

/** 特写：黑条放大倍数、上下位置；后面的帖子放大倍数和位置（卡片坐标 → 画面） */
export const CLOSE = { k: 6.7, barTop: 232, barHeight: 258, endRight: 1100, startLeft: -74, bgScale: 2.8, bgX: -422, bgY: -255 };
/** 特写横移的进度（实测，第 0–52 帧） */
const PAN_T = [0, 1, 2, 3, 4, 6, 8, 10, 13, 16, 20, 24, 28, 32, 36, 40, 44, 48, 52];
const PAN_P = [0, 0.121, 0.205, 0.274, 0.332, 0.429, 0.509, 0.575, 0.658, 0.731, 0.803, 0.86, 0.904, 0.937, 0.963, 0.981, 0.993, 0.999, 1];

export function cardPose(frame: number, p: Pick<PostTranslateProps, 'flyAt' | 'flyFrames'>) {
  const u = FLY.ease(interpolate(frame - p.flyAt, [0.82, 0.82 + p.flyFrames], [0, 1], clamp));
  return {
    x: FLY.from[0]! + (FLY.to[0]! - FLY.from[0]!) * u,
    y: FLY.from[1]! + (FLY.to[1]! - FLY.from[1]!) * u,
    rotate: FLY.rotFrom + (FLY.rotTo - FLY.rotFrom) * u,
    scale: DRIFT.s0 + DRIFT.perFrame * Math.max(0, frame - p.flyAt),
  };
}

export function barProgress(frame: number, p: Pick<PostTranslateProps, 'barAt' | 'barFrames'>): number {
  if (frame < p.barAt) return 0;
  return BAR_EASE(interpolate(frame, [p.barAt, p.barAt + p.barFrames], [0, 1], clamp));
}

/** 特写里黑条左边的 x：从句首（-48）滑到句尾（右端 1100） */
export function closeupBarLeft(t: number, barWidth: number, frames: number): number {
  const len = barWidth * CLOSE.k;
  const end = CLOSE.endRight - len;
  // 句子太短时也至少滑 200px
  const start = Math.max(CLOSE.startLeft, end + 200);
  const prog = interpolate(t * (52 / Math.max(1, frames)), PAN_T, PAN_P, clamp);
  return start + (end - start) * prog;
}

export const PostTranslate: React.FC<PostTranslateProps> = (p) => {
  const frame = useCurrentFrame();
  const layout = useMemo(() => layoutPost(p), [p]);
  const close = p.closeOnly || (p.closeAt >= 0 && frame >= p.closeAt);
  if (close) {
    const t = p.closeOnly ? frame : frame - p.closeAt;
    return <Closeup data={p} layout={layout} t={t} frames={p.closeFrames} />;
  }

  const pose = cardPose(frame, p);
  const h = layout.y.height;
  const card = (
    <div
      style={{
        position: 'absolute', left: 0, top: 0, width: CARD_WIDTH, height: h, transformOrigin: '0 0',
        transform: `translate(${pose.x}px, ${pose.y}px) rotate(${pose.rotate}deg) scale(${pose.scale}) translate(${-CARD_WIDTH / 2}px, ${-h / 2}px)`,
      }}
    >
      <div style={{ position: 'absolute', inset: 0, filter: 'blur(0.45px)' }}>
        <PostCard data={p} layout={layout} barProgress={barProgress(frame, p)} />
      </div>
      {/* 橙色光边 */}
      <div
        style={{
          position: 'absolute', inset: 0,
          boxShadow: '0 0 0 1.2px rgba(236,168,110,0.95), 0 0 0 2.6px rgba(170,95,45,0.75), 0 0 5px 2px rgba(120,60,25,0.55), inset 0 0 1.5px 1.5px rgba(255,226,186,0.9)',
        }}
      />
    </div>
  );
  return (
    <AbsoluteFill style={{ backgroundColor: '#1b1b1b', overflow: 'hidden' }}>
      {/* 景深：画面中间一竖条是实的，往左右两边越来越虚（同一张卡画三遍：很虚、有点虚、实的） */}
      <AbsoluteFill style={{ filter: `blur(${TILT.far}px)` }}>{card}</AbsoluteFill>
      <AbsoluteFill style={{ filter: `blur(${TILT.mid}px)`, WebkitMaskImage: TILT.midMask, maskImage: TILT.midMask }}>{card}</AbsoluteFill>
      <AbsoluteFill style={{ WebkitMaskImage: TILT.sharpMask, maskImage: TILT.sharpMask }}>{card}</AbsoluteFill>
      <AbsoluteFill style={{ background: VIGNETTE }} />
    </AbsoluteFill>
  );
};

/** 黑条特写：后面虚的帖子不动，前面黑条横着滑 */
const Closeup: React.FC<{ data: PostCardData; layout: PostLayout; t: number; frames: number }> = ({ data, layout, t, frames }) => {
  const k = CLOSE.k;
  const left = closeupBarLeft(t, layout.barWidth, frames);
  const zoom = 1 + 0.00036 * t;
  // 前 16 帧从很虚对上焦
  const focus = Math.max(0, 1 - Math.pow(Math.max(0, t) / 16.5, 1.3));
  // 对上焦以后字也有点软（原片是放大的截图）
  const blur = 0.8 + 11 * focus;
  const width = layout.barWidth * k;
  const textW = measure(data.translation, barFont()) * BAR.squeeze * layout.barScale * k;

  return (
    <AbsoluteFill style={{ backgroundColor: '#e9e9e9', overflow: 'hidden' }}>
      {/* 后面：放大、很虚的帖子 */}
      <div style={{ position: 'absolute', inset: 0, filter: 'blur(9px)' }}>
        <div style={{ position: 'absolute', left: 0, top: 0, transformOrigin: '0 0', transform: `translate(${CLOSE.bgX}px, ${CLOSE.bgY}px) scale(${CLOSE.bgScale})` }}>
          <PostCard data={data} layout={layout} barProgress={0} showBar={false} />
        </div>
      </div>

      {/* 前面：黑条 */}
      <AbsoluteFill style={{ transform: `scale(${zoom})`, filter: `blur(${blur.toFixed(2)}px)` }}>
        {/* 斜着的影子 */}
        <div
          style={{
            position: 'absolute', left: left + 20, top: CLOSE.barTop + CLOSE.barHeight - 8, width: width + 10, height: 70,
            background: 'linear-gradient(to bottom, rgba(0,0,0,0.5), rgba(0,0,0,0))', filter: 'blur(6px)',
            clipPath: 'polygon(0 0, 100% 0, calc(100% - 45px) 100%, 0 100%)',
          }}
        />
        <div
          style={{
            position: 'absolute', left, top: CLOSE.barTop, width, height: CLOSE.barHeight, backgroundColor: BAR.color,
            filter: 'drop-shadow(-2px 0 0 rgba(230,120,60,0.35)) drop-shadow(2px 0 0 rgba(60,150,230,0.45))',
          }}
        >
          <div
            style={{
              position: 'absolute', left: BAR.padLeft * k * layout.barScale, top: 0, height: '100%', width: textW / BAR.squeeze,
              display: 'flex', alignItems: 'center', whiteSpace: 'pre', fontFamily: SANS, fontWeight: 500,
              fontSize: BAR.size * k * layout.barScale, transform: `scaleX(${BAR.squeeze})`, transformOrigin: '0 50%',
            }}
          >
            <BarText text={data.translation} />
          </div>
        </div>
      </AbsoluteFill>

      {/* 暗角 */}
      <AbsoluteFill style={{ background: CLOSE_VIGNETTE }} />
    </AbsoluteFill>
  );
};

/** 「翻译金句 · 特写横移」模板：只要特写 */
export const QuoteCloseup: React.FC<PostTranslateProps> = (p) => <PostTranslate {...p} closeOnly />;

