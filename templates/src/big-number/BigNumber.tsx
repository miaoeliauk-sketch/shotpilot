import React, { useMemo } from 'react';
import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from 'remotion';
import { BUNDLED_FONTS, useBundledFont } from '../fonts';
import { Media } from '../media';

/**
 * 复刻：金色发光大数字「400+」（148 帧，1280×720 @30fps）
 *
 * ── 结构（逐帧实测）──────────────────────────────────────────────────
 *   背景      一段压暗的视频（手在敲键盘），换成用户自己的图或视频
 *   顶部标题  「前苹果员工就职 OpenAI 人数」细体，字心 y=68.5，下面一行 12px 的英文小字（y=111）
 *   大数字    字身 418px 高（y 160–578），极窄的粗体；金色：中间偏左下是奶白高光，四周是橙色；外发光约 25px
 *   加号      91×103，横竖笔画 18–20px，在数字右上
 *
 * ── 动作 ─────────────────────────────────────────────────────────────
 *   数字      从上方 221px 落下，三次方减速，34 帧到位（片子开头已经走了 4 帧）；
 *             同时淡入（22 帧，二次方减速）、由虚变实
 *   加号      第 21 帧出现：从模糊、放大 1.3 倍里收回来，同时整组往左挪，让「数字+加号」一起居中
 *             （五次方减速，40 帧）
 *
 * 只复刻画面，原片底部口播字幕不在模板里。
 */

export type BigNumberProps = {
  background: string;
  /** 背景压暗（0–1） */
  dim: number;
  title: string;
  subtitle: string;
  number: string;
  suffix: string;
  mainColor: string;
  lightColor: string;
  titleColor: string;
  /** 数字开始落下的帧（原片是 −4：开头已经在动了） */
  numberAt: number;
  /** 加号出现的帧 */
  suffixAt: number;
  durationInFrames: number;
};

/** 数字用软件自带的 Bebas Neue（开源字体，和原片的窄粗体数字几乎一样）；没加载出来就退到系统的窄体 */
export const NUMBER_FONT = `"${BUNDLED_FONTS.bebas.family}", "DIN Condensed", "Avenir Next Condensed", Impact, "Arial Narrow", sans-serif`;
const TITLE_FONT = '"PingFang SC", "Noto Sans CJK SC", "Hiragino Sans GB", sans-serif';

/** 原片数字字身（第 100 帧）：x 345–763，y 160–578；「400」三个字宽高正好相等 */
const DIGITS = { top: 160, height: 418, refText: '400', refWidth: 418 };
/** 加号：91×103，字心 (851.5, 223.5)；和数字之间空 47px */
const SUFFIX = { height: 103, refWidth: 91, gap: 47, centerY: 223.5 };
/** 整组停住时的中心 x（数字+加号），加号出现前数字自己的中心 x */
const GROUP_CENTER = 619;
const DIGITS_ALONE_CENTER = 637.5;

const FALL = { distance: 221, frames: 34 };
const FADE_FRAMES = 22;
const BLUR_START = 7;
const SUFFIX_IN = { frames: 40, fade: 11, blur: 10, blurFrames: 24, scale: 1.3, scaleFrames: 19 };

const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;

/** 用 canvas 量字的墨迹框（不含字距、行高，只算真正画出来的部分） */
let ctx: CanvasRenderingContext2D | null = null;
export function inkBox(text: string, font: string): { left: number; right: number; ascent: number; descent: number } {
  if (typeof document === 'undefined') {
    const size = Number(/(\d+(?:\.\d+)?)px/.exec(font)?.[1] ?? 100);
    return { left: 0, right: Array.from(text).length * size * 0.45, ascent: size * 0.72, descent: 0 };
  }
  ctx ??= document.createElement('canvas').getContext('2d');
  if (!ctx) return { left: 0, right: 0, ascent: 0, descent: 0 };
  ctx.font = font;
  const m = ctx.measureText(text);
  return { left: m.actualBoundingBoxLeft, right: m.actualBoundingBoxRight, ascent: m.actualBoundingBoxAscent, descent: m.actualBoundingBoxDescent };
}

type Fit = { sx: number; sy: number; width: number; tx: number; ty: number };

/**
 * 把一段字缩放到指定的墨迹高度；宽度按「原片那几个字该有多宽」同比例压窄，
 * 这样换了字体（Mac 上的 DIN、这里的思源）字形不同，数字的粗细比例还是原片的样子。
 */
function fitText(text: string, height: number, refText: string, refWidth: number): Fit {
  const font = `700 200px ${NUMBER_FONT}`;
  const ref = inkBox(refText, font);
  const box = inkBox(text, font);
  const sy = height / Math.max(1, box.ascent + box.descent);
  const refNaturalW = (ref.left + ref.right) * (height / Math.max(1, ref.ascent + ref.descent));
  const squeeze = refWidth / Math.max(1, refNaturalW);
  const sx = sy * squeeze;
  const width = (box.left + box.right) * sx;
  // 文字原点在基线左端：墨迹框左上角 = (−left, −ascent)
  return { sx, sy, width, tx: box.left * sx, ty: box.ascent * sy };
}

export const BigNumber: React.FC<BigNumberProps> = (p) => {
  const frame = useCurrentFrame();
  const fontReady = useBundledFont('bebas');
  // 字体到位后重新量一次字
  const digits = useMemo(() => fitText(p.number, DIGITS.height, DIGITS.refText, DIGITS.refWidth), [p.number, fontReady]);
  const suffix = useMemo(
    () => (p.suffix ? fitText(p.suffix, SUFFIX.height, '+', SUFFIX.refWidth) : null),
    [p.suffix, fontReady],
  );

  // 数字落下、淡入、由虚变实
  const u = interpolate(frame, [p.numberAt, p.numberAt + FALL.frames], [0, 1], clamp);
  const fall = -FALL.distance * (1 - Easing.out(Easing.cubic)(u));
  const fadeU = interpolate(frame, [p.numberAt - 0.75, p.numberAt - 0.75 + FADE_FRAMES], [0, 1], clamp);
  const opacity = Easing.out(Easing.quad)(fadeU);
  const blur = BLUR_START * (1 - fadeU);

  // 加号出现后整组往左挪，一起居中
  const finalDigitsCenter = suffix ? GROUP_CENTER - (SUFFIX.gap + suffix.width) / 2 : DIGITS_ALONE_CENTER;
  const shiftU = suffix ? interpolate(frame, [p.suffixAt, p.suffixAt + SUFFIX_IN.frames], [0, 1], clamp) : 1;
  const digitsCenter = DIGITS_ALONE_CENTER + (finalDigitsCenter - DIGITS_ALONE_CENTER) * Easing.out(Easing.poly(5))(shiftU);
  const digitsLeft = digitsCenter - digits.width / 2;

  const sOpacity = interpolate(frame, [p.suffixAt, p.suffixAt + SUFFIX_IN.fade], [0, 1], { ...clamp, easing: Easing.out(Easing.quad) });
  const sBlur = SUFFIX_IN.blur * (1 - interpolate(frame, [p.suffixAt, p.suffixAt + SUFFIX_IN.blurFrames], [0, 1], { ...clamp, easing: Easing.out(Easing.quad) }));
  const sScale = 1 + (SUFFIX_IN.scale - 1) * (1 - interpolate(frame, [p.suffixAt, p.suffixAt + SUFFIX_IN.scaleFrames], [0, 1], { ...clamp, easing: Easing.out(Easing.cubic) }));

  const glow = `drop-shadow(0px 0px 5px ${hexA(p.mainColor, 0.7)}) drop-shadow(0px 0px 16px ${hexA(p.mainColor, 0.55)})`;

  return (
    <AbsoluteFill style={{ backgroundColor: '#000', overflow: 'hidden' }}>
      <Media src={p.background} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />
      <AbsoluteFill style={{ backgroundColor: `rgba(0,0,0,${p.dim})` }} />

      {/* 顶部标题 */}
      <div style={{ position: 'absolute', left: 0, width: 1280, top: 68.5 - 30, height: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: TITLE_FONT, fontWeight: 300, fontSize: 39, color: p.titleColor, whiteSpace: 'pre' }}>
        {p.title}
      </div>
      <div style={{ position: 'absolute', left: 0, width: 1280, top: 111 - 10, height: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: TITLE_FONT, fontWeight: 400, fontSize: 12.5, color: '#b1a7a5', whiteSpace: 'pre' }}>
        {p.subtitle}
      </div>

      <svg width={1280} height={720} style={{ position: 'absolute', left: 0, top: 0, overflow: 'visible' }}>
        <defs>
          {/* 奶白高光在中间偏左下，四周橙色（按第 100 帧逐块取色画的） */}
          <radialGradient id="bn-gold" cx="0.33" cy="0.63" r="0.62" fx="0.33" fy="0.63">
            <stop offset="0" stopColor={p.lightColor} />
            <stop offset="0.32" stopColor={p.lightColor} />
            <stop offset="0.8" stopColor={p.mainColor} />
            <stop offset="1" stopColor={p.mainColor} />
          </radialGradient>
          <linearGradient id="bn-suffix" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={p.lightColor} />
            <stop offset="1" stopColor={mix(p.lightColor, p.mainColor, 0.35)} />
          </linearGradient>
        </defs>
        <g style={{ opacity, filter: `${blur > 0.05 ? `blur(${blur.toFixed(2)}px) ` : ''}${glow}` }}>
          <g transform={`translate(${digitsLeft + digits.tx}, ${DIGITS.top + fall + digits.ty}) scale(${digits.sx}, ${digits.sy})`}>
            <text x={0} y={0} fontFamily={NUMBER_FONT} fontWeight={700} fontSize={200} fill="url(#bn-gold)">{p.number}</text>
          </g>
        </g>
        {suffix && sOpacity > 0 && (
          <g
            style={{
              opacity: sOpacity,
              filter: `${sBlur > 0.05 ? `blur(${sBlur.toFixed(2)}px) ` : ''}${glow}`,
              transformBox: 'view-box',
              transformOrigin: `${digitsLeft + digits.width + SUFFIX.gap + suffix.width / 2}px ${SUFFIX.centerY}px`,
              transform: `scale(${sScale})`,
            }}
          >
            <g transform={`translate(${digitsLeft + digits.width + SUFFIX.gap + suffix.tx}, ${SUFFIX.centerY - SUFFIX.height / 2 + fall + suffix.ty}) scale(${suffix.sx}, ${suffix.sy})`}>
              <text x={0} y={0} fontFamily={NUMBER_FONT} fontWeight={700} fontSize={200} fill="url(#bn-suffix)">{p.suffix}</text>
            </g>
          </g>
        )}
      </svg>
    </AbsoluteFill>
  );
};

function parseHex(hex: string): [number, number, number] | null {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m?.[1]) return null;
  const v = parseInt(m[1], 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
}

function hexA(hex: string, a: number): string {
  const c = parseHex(hex);
  return c ? `rgba(${c[0]},${c[1]},${c[2]},${a})` : hex;
}

function mix(a: string, b: string, t: number): string {
  const x = parseHex(a);
  const y = parseHex(b);
  if (!x || !y) return a;
  const c = x.map((v, i) => Math.round(v + (y[i]! - v) * t));
  return `rgb(${c[0]},${c[1]},${c[2]})`;
}
