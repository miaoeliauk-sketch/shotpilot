import React, { useMemo } from 'react';
import { AbsoluteFill, Easing, Img, interpolate, useCurrentFrame } from 'remotion';
import { assetUrl } from '../asset';
import { inkBox } from '../big-number/BigNumber';
import { BUNDLED_FONTS, useBundledFont } from '../fonts';
import { Media } from '../media';

/**
 * 复刻：产品大字 + 三个功能圆球，镜头推向其中一个（111 帧，1280×720 @30fps）
 *
 * ── 坐标 ─────────────────────────────────────────────────────────────
 *   按原片第 40 帧的画面排版（世界坐标），每帧只是给整个场景套一个镜头（缩放 + 对准点），逐帧量的。
 *   大字「Apple Watch」x 140–675、y 265–440；产品图在大字中间；三个圆球：
 *   心脏 (1095, 350) r98、日常 (940, 520) r108、血氧 (853, 246) r146（镜头最后推向它）
 *
 * ── 动作 ─────────────────────────────────────────────────────────────
 *   0–10   开场从 1.63 倍拉远到 1 倍（先快后慢）
 *   11–47  三个圆球依次从一个点长出来（第 11、15、23 帧起，24 帧长满），
 *          球上的大字从放大 1.8 倍、模糊里收回来（第 23、30、36 帧起，8 帧）
 *   45–90  镜头推向「血氧」那个球（到 2.17 倍，先快后慢），别的东西越来越虚
 *
 * 只复刻画面，底部口播字幕不在模板里。
 */

export type Bubble = { label: string; sub: string };

export type ProductBubblesProps = {
  background: string;
  product: string;
  title: string;
  bubbles: Bubble[];
  /** 镜头最后推向第几个球（从 0 数） */
  focus: number;
  textColor: string;
  /** 各个动作开始的帧（原片） */
  pushAt: number;
  durationInFrames: number;
};

const SERIF = '"Songti SC", "STSong", "Noto Serif CJK SC", "Source Han Serif SC", serif';
const SANS = '"PingFang SC", "Noto Sans CJK SC", "Hiragino Sans GB", sans-serif';
/** 产品大字用软件自带的 Oswald（窄体、有小写，和原片的字很像） */
const TITLE_FONT = `"${BUNDLED_FONTS.oswald.family}", "DIN Condensed", "Avenir Next Condensed", Impact, sans-serif`;

const TITLE_BOX = { left: 140, top: 265, width: 535, height: 175 };
const PRODUCT_BOX = { left: 283, top: 272, width: 240, height: 200 };
export const SLOTS = [
  { x: 1095, y: 350, r: 98, grow: 11, label: 23 },
  { x: 940, y: 520, r: 108, grow: 15, label: 30 },
  { x: 853, y: 246, r: 146, grow: 23, label: 36 },
];
const GROW_FRAMES = 24;
const LABEL_FRAMES = 8;

// 开场拉远（第 0–14 帧）
const OPEN_T = [0, 2, 4, 6, 8, 10, 14];
const OPEN_S = [1.633, 1.4075, 1.2237, 1.1376, 1.0876, 1.0361, 1];
const OPEN_X = [435.7, 489, 547.7, 581.8, 604.1, 623.3, 640];
const OPEN_Y = [323.5, 318.7, 313.3, 309.9, 307.6, 306.8, 300];
// 推近（相对开始推的那一帧；对准点相对目标球心）
const PUSH_T = [0, 1, 3, 5, 7, 9, 11, 13, 15, 19, 23, 27, 35, 45];
const PUSH_S = [1, 1.1063, 1.296, 1.4257, 1.5283, 1.6117, 1.6831, 1.7444, 1.7981, 1.8833, 1.9663, 2.0291, 2.1233, 2.1657];
const PUSH_DX = [-213, -173.1, -118.3, -89.2, -69.9, -55.9, -45.1, -36.5, -29.5, -20, -11, -5.3, 1.6, 0.8];
const PUSH_DY = [54, 38.9, 18.5, 8.1, 1.2, -4, -7.6, -10.8, -13.3, -16.3, -19.5, -21.9, -25, -27.7];
const DEPTH_BLUR = 6;

const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;
const curve = (t: number, ks: number[], vs: number[]) => interpolate(t, ks, vs, clamp);

export function camera(frame: number, pushAt: number, target: { x: number; y: number }): { s: number; x: number; y: number; push: number } {
  if (frame >= pushAt) {
    const t = frame - pushAt;
    // 推之前镜头对着 (640, 300)，推完对着球心附近；按原片的曲线换算成进度，换了目标球也照这个节奏走
    const u = (curve(t, PUSH_T, PUSH_DX) - PUSH_DX[0]!) / (PUSH_DX[PUSH_DX.length - 1]! - PUSH_DX[0]!);
    const v = (curve(t, PUSH_T, PUSH_DY) - PUSH_DY[0]!) / (PUSH_DY[PUSH_DY.length - 1]! - PUSH_DY[0]!);
    const x = 640 + (target.x + PUSH_DX[PUSH_DX.length - 1]! - 640) * u;
    const y = 300 + (target.y + PUSH_DY[PUSH_DY.length - 1]! - 300) * v;
    return { s: curve(t, PUSH_T, PUSH_S), x, y, push: (curve(t, PUSH_T, PUSH_S) - 1) / 1.1657 };
  }
  return { s: curve(frame, OPEN_T, OPEN_S), x: curve(frame, OPEN_T, OPEN_X), y: curve(frame, OPEN_T, OPEN_Y), push: 0 };
}

export const ProductBubbles: React.FC<ProductBubblesProps> = (p) => {
  const frame = useCurrentFrame();
  const fontReady = useBundledFont('oswald');
  const bubbles = p.bubbles.slice(0, SLOTS.length);
  const focus = Math.min(Math.max(0, p.focus), bubbles.length - 1);
  const target = SLOTS[focus] ?? SLOTS[2]!;
  const cam = camera(frame, p.pushAt, target);
  const depth = DEPTH_BLUR * Math.min(1, cam.push * 1.4);

  const title = useMemo(() => {
    const b = inkBox(p.title || ' ', `600 200px ${TITLE_FONT}`);
    return { sx: TITLE_BOX.width / Math.max(1, b.left + b.right), sy: TITLE_BOX.height / Math.max(1, b.ascent + b.descent), b };
  }, [p.title, fontReady]);

  const world = `translate(640px, 300px) scale(${cam.s}) translate(${-cam.x}px, ${-cam.y}px)`;

  return (
    <AbsoluteFill style={{ backgroundColor: '#a99a8b', overflow: 'hidden' }}>
      <AbsoluteFill style={{ transformOrigin: '0 0', transform: world }}>
        <div style={{ position: 'absolute', left: -200, top: -120, width: 1680, height: 960, filter: depth > 0.05 ? `blur(${(depth / cam.s).toFixed(2)}px)` : undefined }}>
          <Media src={p.background} style={{ position: 'absolute', left: 0, top: 0, width: 1680, height: 960 }} />
        </div>

        {/* 产品大字：窄体，上浅下深的棕色，有一点色差 */}
        <svg width={1280} height={720} style={{ position: 'absolute', left: 0, top: 0, overflow: 'visible', filter: `blur(${(0.8 + depth / cam.s).toFixed(2)}px) drop-shadow(-2px 0 0 rgba(200,60,40,0.25)) drop-shadow(2px 0 0 rgba(40,120,200,0.2))` }}>
          <defs>
            <linearGradient id="pb-title" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#957150" />
              <stop offset="1" stopColor="#5f4630" />
            </linearGradient>
          </defs>
          <g transform={`translate(${TITLE_BOX.left + title.b.left * title.sx}, ${TITLE_BOX.top + title.b.ascent * title.sy}) scale(${title.sx}, ${title.sy})`}>
            <text x={0} y={0} fontFamily={TITLE_FONT} fontWeight={600} fontSize={200} fill="url(#pb-title)">{p.title}</text>
          </g>
        </svg>

        <Img
          src={assetUrl(p.product)}
          style={{
            position: 'absolute', left: PRODUCT_BOX.left, top: PRODUCT_BOX.top, width: PRODUCT_BOX.width, height: PRODUCT_BOX.height,
            objectFit: 'contain', filter: `drop-shadow(6px 10px 10px rgba(50,35,20,0.35))${depth > 0.05 ? ` blur(${(depth / cam.s).toFixed(2)}px)` : ''}`,
          }}
        />

        {bubbles.map((b, i) => (
          <BubbleView key={i} b={b} slot={SLOTS[i]!} frame={frame} blur={i === focus ? 0 : depth / cam.s} color={p.textColor} />
        ))}
      </AbsoluteFill>

      {/* 暗角 + 颗粒感 */}
      <AbsoluteFill style={{ background: 'radial-gradient(ellipse 75% 80% at 50% 48%, rgba(40,30,22,0) 50%, rgba(40,30,22,0.3) 80%, rgba(30,22,16,0.62) 100%)' }} />
    </AbsoluteFill>
  );
};

const BubbleView: React.FC<{ b: Bubble; slot: (typeof SLOTS)[number]; frame: number; blur: number; color: string }> = ({ b, slot, frame, blur, color }) => {
  const grow = Easing.out(Easing.cubic)(interpolate(frame, [slot.grow, slot.grow + GROW_FRAMES], [0, 1], clamp));
  if (grow <= 0) return null;
  const lu = interpolate(frame, [slot.label, slot.label + LABEL_FRAMES], [0, 1], clamp);
  const le = Easing.out(Easing.cubic)(lu);
  const r = slot.r;
  const size = r * 0.72;
  return (
    <div style={{ position: 'absolute', left: slot.x - r, top: slot.y - r, width: r * 2, height: r * 2, filter: blur > 0.05 ? `blur(${blur.toFixed(2)}px)` : undefined }}>
      <div
        style={{
          position: 'absolute', inset: 0, borderRadius: '50%', transform: `scale(${grow})`,
          background: 'radial-gradient(circle at 32% 26%, rgba(214,196,176,0.95) 0%, rgba(196,178,160,0.88) 42%, rgba(150,132,117,0.92) 100%)',
          boxShadow: '12px 18px 34px rgba(70,52,38,0.35)',
        }}
      />
      {lu > 0 && (
        <div style={{ position: 'absolute', inset: 0, opacity: le, transform: `scale(${1 + 0.8 * (1 - le)})`, filter: lu < 1 ? `blur(${(8 * (1 - le)).toFixed(2)}px)` : undefined }}>
          {/* 大字：竖向拉长的粗宋，深铜色渐变 */}
          <div
            style={{
              position: 'absolute', left: r * 0.18, top: r * 0.3, height: size, display: 'flex', alignItems: 'center',
              fontFamily: SERIF, fontWeight: 900, fontSize: size, lineHeight: 1, whiteSpace: 'pre',
              transform: 'scaleY(1.4)', transformOrigin: '0 50%',
              backgroundImage: `linear-gradient(to bottom, ${color} 10%, #8a6e55 70%, ${color} 100%)`,
              WebkitBackgroundClip: 'text', backgroundClip: 'text', WebkitTextFillColor: 'transparent',
            }}
          >
            {b.label}
          </div>
          <Star x={r * 1.52} y={r * 0.86} s={r * 0.2} />
          <Star x={r * 1.7} y={r * 0.6} s={r * 0.09} />
          <Star x={r * 1.8} y={r * 0.9} s={r * 0.05} />
          {b.sub && (
            <>
              <div style={{ position: 'absolute', left: r * 0.18, top: r * 1.33, width: r * 0.36, height: r * 0.1, borderRadius: r, background: 'linear-gradient(to right, #8e7a68, #cbb9a6)' }} />
              <div style={{ position: 'absolute', left: r * 0.58, top: r * 1.22, fontFamily: SANS, fontSize: r * 0.2, lineHeight: 1.3, color: '#6a5a4c', whiteSpace: 'pre' }}>{b.sub}</div>
            </>
          )}
        </div>
      )}
    </div>
  );
};

const Star: React.FC<{ x: number; y: number; s: number }> = ({ x, y, s }) => (
  <svg width={s * 2} height={s * 2} viewBox="-1 -1 2 2" style={{ position: 'absolute', left: x - s, top: y - s }}>
    <path d="M0,-1 Q0.12,-0.12 1,0 Q0.12,0.12 0,1 Q-0.12,0.12 -1,0 Q-0.12,-0.12 0,-1Z" fill="#141210" />
  </svg>
);
