import React from 'react';
import { AbsoluteFill, Img, interpolate, Sequence, useCurrentFrame } from 'remotion';
import { assetUrl } from '../asset';
import { bakeBlurredImage, useBaked } from '../baked';
import { HALFTONE, HalftoneWord } from '../halftone-word';
import { Media } from '../media';
import { vignetteGradient } from '../lens';

/**
 * 复刻：浅灰底上一张截图卡片（排行榜）歪着从下面飞上来、转正，镜头推近 1.5 倍再往下看到卡片底；
 * 卡片按亮度溶解掉（亮的地方先透明），露出视频和一个金属网点大字，之后硬切到下一段视频和下一个大字（381 帧，1280×720 @30fps）
 *
 * 按原片量的（「卡片坐标」= 第 60 帧卡片宽 870 时的像素）：
 *   卡片：第 60 帧中心 (635, 370)、870×460；飞入时缩 0.985，第 0 帧顺时针歪 19.7°、中心 y 890，越来越慢，第 56 帧转正到位
 *   推近：第 53 帧起以画面中心推到 1.486 倍（第 113 帧），第 104 帧起往下移，第 165 帧卡片底边停在 y 471
 *   卡片的影子：往左下拉长（左边 34、下边 24），贴着卡片最深（压暗 47%），往外渐淡
 *   底色 #efefef，四周暗角（第 62–92 帧暗角慢慢退掉）；第 72–104 帧右边滑进来一片深灰（67）的暗影（最右整片是这个灰）和一片虚化，上下边也跟着虚；
 *     推近以后画面上下还有一层暗影，下边压到一半左右，往下看的时候上边变暗、下边变亮
 *   溶解：第 176 帧起，卡片的像素按亮度消失，亮度 196 的在第 178.5 帧消失一半，每帧往暗里推 13.6，边缘软 109；
 *     同时横向拖一点影；第 177–184 帧深色的地方（字）亮度反相成白字（颜色保留，暗影那种中灰不反）；第 185–191 帧整层淡掉
 *   大字：粗黑体往右斜 8°、横向拉宽 1.28 倍、再描边加粗，两个字 227px、多了按宽 997 缩；字底 450，视觉中心 x 636；
 *     灰白渐变（上 #bebebe → 下 #959c9f）＋ 30° 斜着的细网点（间距 3.65）；左下一层贴身的深影和一层软影；每帧放大 0.03%
 *   边上的红蓝错色：卡片左边、下边（影子那一侧）一道 1.5 像素的橙边；大字外轮廓垫一层放大 0.4% 的橙色字形
 * 只复刻画面，底部口播字幕不在模板里。
 */

export type CardWord = { text: string; media: string; at: number };

export type CardWordsProps = {
  card: string;
  cardHeight: number;
  background: string;
  pan: boolean;
  words: CardWord[];
  dim: number;
  vignette: boolean;
  durationInFrames: number;
};

const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;

export const CARD = { width: 870, cx: 635, cy: 370, shadowX: 34, shadowY: 24, shadowAlpha: 0.47, rim: 1.5, rimColor: 'rgba(214,140,70,0.75)' };

const ENTR_T = [0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24, 26, 28, 30, 32, 34, 36, 38, 40, 43, 46, 50, 54, 56];
const ENTR_R = [19.7, 17.75, 15.65, 13.63, 12.5, 11.12, 9.9, 8.79, 7.78, 6.88, 6.07, 5.29, 4.61, 3.99, 3.46, 2.96, 2.49, 2.12, 1.76, 1.42, 1.14, 0.78, 0.53, 0.27, 0.11, 0];
const ENTR_Y = [890, 839, 790, 738.4, 707.1, 670.1, 637.3, 607.5, 580.4, 555.5, 533.3, 513.3, 495, 478.4, 463.6, 450.2, 438.2, 427.4, 417.7, 409.1, 400.9, 391.5, 383.9, 376.6, 372.1, 370.9];
const ENTR_XT = [0, 6, 20, 30, 40];
const ENTR_X = [631, 632.5, 634.2, 634.8, 635];
const ENTR_S = 0.985;
const ZOOM_T = [53, 56, 60, 64, 68, 72, 76, 80, 84, 88, 92, 96, 100, 104, 108, 113];
const ZOOM_S = [0.985, 0.9916, 1, 1.0128, 1.0309, 1.056, 1.0961, 1.1645, 1.2672, 1.3458, 1.3937, 1.4249, 1.446, 1.4626, 1.4747, 1.486];
const PAN_T = [102, 104, 108, 112, 116, 120, 122, 124, 126, 128, 130, 132, 134, 136, 138, 140, 142, 144, 146, 148, 152, 156, 160, 165];
const PAN_U = [0, 0.007, 0.019, 0.038, 0.066, 0.105, 0.131, 0.165, 0.207, 0.261, 0.333, 0.426, 0.535, 0.632, 0.707, 0.767, 0.812, 0.848, 0.878, 0.903, 0.942, 0.968, 0.99, 1];
/** 推近停住后，卡片底边停在哪 */
const PAN_BOTTOM = 470.7;

const SHADE_T = [72, 76, 78, 80, 82, 84, 86, 88, 90, 92, 94, 96, 98, 100, 104];
const SHADE_OFF = [560, 360, 300, 240, 190, 140, 105, 75, 55, 40, 25, 15, 8, 3, 0];
const SHADE_X = [460, 500, 540, 580, 620, 660, 700, 740, 780, 820, 860, 900, 940, 980, 1020, 1060, 1100, 1140];
const SHADE_V = [1, 0.96, 0.948, 0.927, 0.899, 0.867, 0.831, 0.79, 0.746, 0.694, 0.637, 0.573, 0.504, 0.44, 0.367, 0.306, 0.278, 0.272];
/** 推近以后上下的暗影（画面坐标，每 40 像素一个值，1 = 不暗）：第 92–125 帧是 A，第 150 帧以后是 B，中间过渡 */
const VSHADE_A = [0.85, 0.88, 0.93, 0.95, 1, 1, 1, 1, 1, 0.98, 0.93, 0.9, 0.84, 0.8, 0.75, 0.69, 0.64, 0.58, 0.52];
const VSHADE_B = [0.64, 0.74, 0.78, 0.84, 0.87, 0.94, 0.96, 1, 1, 1, 1, 0.97, 0.94, 0.9, 0.87, 0.83, 0.8, 0.75, 0.71];
const VIG_T = [62, 70, 76, 80, 84, 88, 92];
const VIG_A = [1, 0.87, 0.7, 0.49, 0.26, 0.13, 0];

export const WORD = { maxSize: 227, maxWidth: 997, baseline: 450, cx: 636, grow: 0.0003 };

/** 卡片在画面上的中心、旋转、缩放（不含往下移） */
export function cardPose(frame: number) {
  const s = frame < 53 ? ENTR_S : interpolate(frame, ZOOM_T, ZOOM_S, clamp);
  const k = s / ENTR_S;
  const ex = interpolate(frame, ENTR_XT, ENTR_X, clamp);
  const ey = interpolate(frame, ENTR_T, ENTR_Y, clamp);
  return { x: 640 + k * (ex - 640), y: 360 + k * (ey - 360), rot: interpolate(frame, ENTR_T, ENTR_R, clamp), s };
}

/** 往下看：整张卡往上移多少（负数），推近到底时卡片底边停在 PAN_BOTTOM；卡片矮就不用移 */
export function panY(frame: number, cardHeight: number): number {
  const sEnd = ZOOM_S[ZOOM_S.length - 1]!;
  const kEnd = sEnd / ENTR_S;
  const bottom = 360 + kEnd * (ENTR_Y[ENTR_Y.length - 1]! - 360) + (sEnd * cardHeight) / 2;
  const total = Math.min(0, PAN_BOTTOM - bottom);
  return total * interpolate(frame, PAN_T, PAN_U, clamp);
}

/** 右边滑进来的暗影往右偏了多少（0 = 到位） */
export function shadeOffset(frame: number): number {
  return interpolate(frame, SHADE_T, SHADE_OFF, clamp);
}

/** 溶解：卡片上亮度为 lum（0–255）的像素在 dissolve 开始后第 t 帧还剩多少 */
export function dissolveAlpha(lum: number, t: number): number {
  const thr = 196 + 13.6 * (2.5 - t);
  const key = Math.min(1, Math.max(0, 0.5 + (thr - lum) / 109));
  return key * dissolveFade(t);
}

/** 溶解到最后整层淡掉：开始后第 8.5–15 帧 */
export function dissolveFade(t: number): number {
  return interpolate(t, [8.5, 15], [1, 0], clamp);
}

/** 亮度反相（颜色保留）的颜色矩阵：RGB + k·(1 − 2·亮度)，k = 0 不变、1 全反 */
export function lumaInvert(k: number): string {
  const Y = [0.2126, 0.7152, 0.0722];
  const rows = [0, 1, 2].map((r) => [...Y.map((y, c) => (r === c ? 1 : 0) - 2 * k * y), 0, k].map((v) => Number(v.toFixed(4))).join(' '));
  return `${rows.join('  ')}  0 0 0 1 0`;
}

/** 大字字号（刚出来那一刻）：两个字 227，字多了按总宽 997 缩（四个字 203）；之后每帧放大 0.03% */
export function wordSize(text: string): number {
  const n = Math.max(1, Array.from(text).length);
  return Math.min(WORD.maxSize, WORD.maxWidth / (n * (1 + HALFTONE.spacing) * HALFTONE.stretch));
}

/** 上下暗影：第 frame 帧、画面 y（0–720，每 40 一格）处的亮度倍数 */
export function verticalShade(frame: number): number[] {
  const on = interpolate(frame, [72, 92], [0, 1], clamp);
  const b = interpolate(frame, [125, 150], [0, 1], clamp);
  return VSHADE_A.map((a, i) => 1 - on * (1 - (a + (VSHADE_B[i]! - a) * b)));
}

const verticalGradient = (v: number[]) =>
  `linear-gradient(to bottom, ${v.map((x, i) => `rgba(0,0,0,${(1 - x).toFixed(3)}) ${i * 40}px`).join(', ')})`;

/** 右边的暗影：一层深灰（67），按量出来的压暗倍数折算成不透明度（纸 248 压到 v×248） */
const SHADE_GREY = 67;
const shadeGradient = (off: number) =>
  `linear-gradient(to right, ${SHADE_X.map((x, i) => `rgba(${SHADE_GREY},${SHADE_GREY},${SHADE_GREY},${Math.min(1, ((1 - SHADE_V[i]!) * 248) / (248 - SHADE_GREY)).toFixed(3)}) ${(x + off).toFixed(0)}px`).join(', ')})`;

export const CardWords: React.FC<CardWordsProps> = (p) => {
  const frame = useCurrentFrame();
  const d0 = p.words.length > 0 ? p.words[0]!.at : Infinity;
  const showCard = Boolean(p.card) && frame < d0 + 22;
  const showWords = p.words.length > 0 && frame >= d0;
  const body = (
    <AbsoluteFill style={{ backgroundColor: '#000', overflow: 'hidden' }}>
      {showWords && <WordsLayer {...p} frame={frame} />}
      {showCard && <CardLayer {...p} frame={frame} d0={d0} />}
    </AbsoluteFill>
  );
  return body;
};

const CardLayer: React.FC<CardWordsProps & { frame: number; d0: number }> = ({ card, cardHeight: H, background, pan, frame, d0 }) => {
  const pose = cardPose(frame);
  const py = pan ? panY(frame, H) : 0;
  const off = shadeOffset(frame);
  const u = 1 - off / SHADE_OFF[0]!;
  const vig = interpolate(frame, VIG_T, VIG_A, clamp);
  const W = CARD.width;
  const src = assetUrl(card);
  // 虚化那一份用预先模糊好的卡片图（卡片坐标里模糊 5，推近 1.4 倍左右时约等于画面上 7）
  const pad = 16;
  const blurred = useBaked(`card-words-blur|${src}|${H}`, () => bakeBlurredImage(src, W, H, 5, pad));
  const placed = (children: React.ReactNode) => (
    <div
      style={{
        position: 'absolute', left: 0, top: 0, width: W, height: H, transformOrigin: '0 0',
        transform: `translate(${pose.x.toFixed(2)}px, ${(pose.y + py).toFixed(2)}px) rotate(${pose.rot.toFixed(3)}deg) scale(${pose.s.toFixed(4)}) translate(${-W / 2}px, ${-H / 2}px)`,
      }}
    >
      {children}
    </div>
  );
  const shadow = (blur: boolean) => (
    <svg width={W} height={H} style={{ position: 'absolute', left: 0, top: 0, overflow: 'visible' }}>
      <defs>
        <linearGradient id="cw-sh-l" gradientUnits="userSpaceOnUse" x1={0} y1={0} x2={-CARD.shadowX} y2={0}>
          <stop offset={0} stopColor="#000" stopOpacity={CARD.shadowAlpha} />
          <stop offset={1} stopColor="#000" stopOpacity={0} />
        </linearGradient>
        <linearGradient id="cw-sh-b" gradientUnits="userSpaceOnUse" x1={0} y1={H} x2={0} y2={H + CARD.shadowY}>
          <stop offset={0} stopColor="#000" stopOpacity={CARD.shadowAlpha} />
          <stop offset={1} stopColor="#000" stopOpacity={0} />
        </linearGradient>
        <filter id="cw-sh-blur" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation={1.5} /></filter>
      </defs>
      <g filter={blur ? 'url(#cw-sh-blur)' : undefined}>
        <polygon points={`0,0 0,${H} ${-CARD.shadowX},${H + CARD.shadowY} ${-CARD.shadowX},${CARD.shadowY}`} fill="url(#cw-sh-l)" />
        <polygon points={`0,${H} ${W},${H} ${W - CARD.shadowX},${H + CARD.shadowY} ${-CARD.shadowX},${H + CARD.shadowY}`} fill="url(#cw-sh-b)" />
      </g>
    </svg>
  );
  const sharp = placed(
    <>
      {shadow(true)}
      <Img src={src} style={{ position: 'absolute', left: 0, top: 0, width: W, height: H, objectFit: 'cover', objectPosition: '50% 0%' }} />
      {/* 影子那一侧的橙边（原片的红蓝错色） */}
      <div style={{ position: 'absolute', left: -CARD.rim, top: 0, width: CARD.rim, height: H + CARD.rim, background: CARD.rimColor }} />
      <div style={{ position: 'absolute', left: -CARD.rim, top: H, width: W + CARD.rim, height: CARD.rim, background: CARD.rimColor }} />
    </>,
  );
  // 虚化：右边跟着暗影一起滑进来，上下边一点点
  const blurMask = [
    `linear-gradient(to right, transparent ${(640 + off).toFixed(0)}px, #000 ${(900 + off).toFixed(0)}px)`,
    `linear-gradient(to bottom, rgba(0,0,0,${(0.8 * u).toFixed(3)}) 0px, transparent 110px, transparent 430px, rgba(0,0,0,${u.toFixed(3)}) 620px)`,
  ].join(', ');
  const layer = (
    <AbsoluteFill style={{ backgroundColor: background }}>
      {sharp}
      {u > 0.02 && (
        <AbsoluteFill style={{ backgroundColor: background, WebkitMaskImage: blurMask, maskImage: blurMask, WebkitMaskComposite: 'source-over', maskComposite: 'add' }}>
          {blurred
            ? placed(
                <>
                  {shadow(false)}
                  <img src={blurred} alt="" style={{ position: 'absolute', left: -pad, top: -pad, width: W + 2 * pad, height: H + 2 * pad }} />
                </>,
              )
            : <AbsoluteFill style={{ filter: 'blur(7px)' }}>{sharp}</AbsoluteFill>}
        </AbsoluteFill>
      )}
      {/* 四周暗角：推近的时候慢慢退掉 */}
      {vig > 0 && <AbsoluteFill style={{ background: vignetteGradient({ cx: 637.5, cy: 385, rx: 699, ry: 477, amount: 0.464 * vig, power: 2.18 }) }} />}
      {/* 推近以后上下的暗影 */}
      {frame > 72 && <AbsoluteFill style={{ background: verticalGradient(verticalShade(frame)) }} />}
      {/* 右边滑进来的暗影：往深灰（67）里混。溶解时它跟着卡片一起按亮度消失，但因为是中灰，不会被反相 */}
      {off < 500 && <AbsoluteFill style={{ background: shadeGradient(off) }} />}
    </AbsoluteFill>
  );
  const t = frame - d0;
  const dissolving = t > -6;
  if (!dissolving) return layer;
  // 按亮度溶解：alpha = c − k·亮度（k = 255/109），亮的先没；同时横向拖一点影
  const thr = 196 + 13.6 * (2.5 - t);
  const k = 255 / 109;
  const c = 0.5 + thr / 109;
  const keyRow = `${(-k * 0.2126).toFixed(4)} ${(-k * 0.7152).toFixed(4)} ${(-k * 0.0722).toFixed(4)} 0 ${c.toFixed(4)}`;
  const smear = interpolate(t, [-2, 4, 12], [0, 5, 10], clamp);
  // 深色的地方（字）亮度反相成白字，颜色保留；暗影那种中灰不反。第 177–184 帧翻过来
  const inv = interpolate(t, [1, 8], [0, 1], clamp);
  const dark = { at: 0.2, soft: 0.06 };
  const g = 1 / dark.soft;
  const darkRow = `${(-g * 0.2126).toFixed(4)} ${(-g * 0.7152).toFixed(4)} ${(-g * 0.0722).toFixed(4)} 0 ${(0.5 + dark.at * g).toFixed(4)}`;
  // 最后整层淡掉（第 185–191 帧）
  const fade = dissolveFade(t);
  return (
    <AbsoluteFill>
      <svg width={0} height={0} style={{ position: 'absolute' }}>
        <defs>
          <filter id="cw-dissolve" filterUnits="userSpaceOnUse" x={-40} y={0} width={1360} height={720} colorInterpolationFilters="sRGB">
            <feGaussianBlur in="SourceGraphic" stdDeviation={`${smear.toFixed(2)} 0`} result="sm" />
            <feComposite in="SourceGraphic" in2="sm" operator="arithmetic" k2={0.5} k3={0.5} result="mix" />
            {inv > 0 ? (
              <>
                <feColorMatrix in="mix" type="matrix" values={lumaInvert(inv)} result="inv" />
                <feColorMatrix in="mix" type="matrix" values={`0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  ${darkRow}`} result="dm" />
                <feComposite in="inv" in2="dm" operator="in" result="invDark" />
                <feComposite in="invDark" in2="mix" operator="over" result="col" />
              </>
            ) : (
              <feOffset in="mix" dx={0} dy={0} result="col" />
            )}
            <feColorMatrix in="mix" type="matrix" values={`0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  ${keyRow}`} result="key" />
            <feComponentTransfer in="key" result="ka"><feFuncA type="linear" slope={fade} /></feComponentTransfer>
            <feComposite in="col" in2="ka" operator="in" />
          </filter>
        </defs>
      </svg>
      <AbsoluteFill style={{ filter: 'url(#cw-dissolve)' }}>{layer}</AbsoluteFill>
    </AbsoluteFill>
  );
};

const WordsLayer: React.FC<CardWordsProps & { frame: number }> = ({ words, dim, vignette, frame, durationInFrames }) => {
  let i = 0;
  while (i + 1 < words.length && frame >= words[i + 1]!.at) i++;
  const w = words[i]!;
  const end = i + 1 < words.length ? words[i + 1]!.at : durationInFrames;
  return (
    <AbsoluteFill>
      <Sequence from={w.at} durationInFrames={Math.max(1, end - w.at)} layout="none">
        <AbsoluteFill>{w.media && <Media src={w.media} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />}</AbsoluteFill>
      </Sequence>
      {dim > 0 && <AbsoluteFill style={{ backgroundColor: `rgba(0,0,0,${dim.toFixed(3)})` }} />}
      {vignette && <AbsoluteFill style={{ background: vignetteGradient({ cx: 640, cy: 360, rx: 720, ry: 450, amount: 0.9, power: 2.4 }) }} />}
      {w.text && (
        <AbsoluteFill style={{ transformOrigin: '635px 365px', transform: `scale(${(1 + WORD.grow * (frame - w.at)).toFixed(5)})` }}>
          <HalftoneWord key={i} id={`cw-w${i}`} text={w.text} size={wordSize(w.text)} cx={WORD.cx} baseline={WORD.baseline} />
        </AbsoluteFill>
      )}
    </AbsoluteFill>
  );
};
