import React from 'react';
import { AbsoluteFill, Easing, Img, interpolate, useCurrentFrame } from 'remotion';
import { assetUrl } from '../asset';
import { BUNDLED_FONTS, useBundledFont } from '../fonts';
import { vignetteGradient } from '../lens';
import { Media } from '../media';
import { measure } from '../text-layout';

/**
 * 复刻：开头一组斑驳的大标题（可以垫口播画面，也可以不垫）→ 深蓝底上一串超大数字从大缩回来、后面跟单位和注释 →
 * 黑底两个月亮、背后一排很淡的大字、中间发光的品牌名从虚到实（原片 357 帧，1280×720 @30fps）
 *
 * 按原片量的（世界坐标 = 镜头 1 倍时的画面）：
 *   第一段（第 0 帧起）：镜头以画面中心从 1.333 倍拉到 1 倍（60 帧），再慢慢拉到 0.987；口播画面（有的话）跟着一起缩
 *     第一行「地球上」粗宋 177px 压到 0.64，字底 305、左 120；第 1 帧起每 4 帧蹦出一个字
 *     第二行小字「参数最」70px，右对齐到 462、字底 392；大字「大」213px 青色渐变，左 95、字底 560；第 13–28 帧从虚到实、从大缩回来
 *     右边「开源模型」又高又窄（字高 360），左 770、字底 540；第 33 帧出来，从下面 58px 升上来（27 帧）
 *   第二段（原片第 100 帧起，前后 9 帧交叉淡过去）：深蓝底，四周暗、细虚线框
 *     数字：窄体 427px 压到 0.61，每位 100px 宽，左 180、字底 519；一位接一位从 4.5 倍缩回来（绕各自中心，每位晚 2.6 帧），
 *       先只有描边再填满蓝色（中间几位亮、两头暗）
 *     单位「亿」宋体 330px 压到 0.55，左 682、字底 529；第 16 帧起从 4 倍大缩回来；「个参数」在它右下，第 17 帧起从 3.4 倍缩回来
 *     注释两行小字右对齐到 1062（y 375、403），连着一条折线；手写体「Weights」蓝色
 *     镜头：1.62 倍拉到 1 倍（50 帧），之后匀速往外拉、切走前越拉越快
 *   第三段（原片第 173 帧切进来）：近黑底，右上月亮（中心 1178,100，半径 262）、左下月亮（中心 100,640，半径 252），各自从下面升上来
 *     背后大字（黑体 560px 压到 0.42，每字 230 宽，x 190 起、y 95–640）只有描边 + 月面纹理，第 14 帧起每 2.7 帧一个字从上往下显出来
 *     品牌名「KIMI · K3」字高 117、左 374、字底 417，前半白灰、后半蓝色发光；细线框 325–955 × 267–453，两个角上有亮点
 *     品牌名从很虚（10px）到实（47 帧）；镜头 1.41 倍拉到 1 倍再慢慢拉；结束前 27 帧匀速推近（每帧 +0.013）
 *   结尾（有口播画面才有）：结束前 16 帧起品牌名的字里先透出口播画面，第 298 帧前后 7 帧整个淡回口播，口播慢慢推近
 * 只复刻画面，底部口播字幕不在模板里。
 */

export type TitleNumberBrandProps = {
  aroll: string;
  top: string;
  mid: string;
  big: string;
  side: string;
  number: string;
  unit: string;
  unitSub: string;
  note: string;
  script: string;
  brand: string;
  accent: string;
  backText: string;
  moonA: string;
  moonB: string;
  numberAt: number;
  brandAt: number;
  brandEnd: number;
  durationInFrames: number;
};

const SERIF = '"Noto Serif CJK SC", "Songti SC", "STSong", "Source Han Serif SC", serif';
const SANS = '"Noto Sans CJK SC", "PingFang SC", "Source Han Sans SC", "Hiragino Sans GB", sans-serif';
const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;
const easeOut = Easing.out(Easing.cubic);

/** 第一段镜头（从第 0 帧算） */
const CAM1_T = [0, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24, 26, 28, 30, 33, 36, 40, 45, 50, 55, 60, 70, 80, 90, 98];
const CAM1_S = [1.3335, 1.3296, 1.3265, 1.3189, 1.3077, 1.2962, 1.2638, 1.2211, 1.1836, 1.1524, 1.1278, 1.1084, 1.0925, 1.079, 1.0676, 1.0526, 1.0409, 1.0289, 1.0176, 1.0093, 1.0039, 1, 0.9965, 0.9933, 0.9899, 0.9873];
/** 第二段镜头（从数字那段开始算）；切走前 18 帧再乘一个越来越快的往外拉 */
const CAM2_T = [0, 4, 8, 12, 14, 16, 18, 20, 22, 25, 28, 31, 35, 40, 45, 50];
const CAM2_S = [1.62, 1.54, 1.455, 1.3706, 1.3276, 1.3012, 1.2762, 1.2533, 1.2254, 1.1958, 1.1647, 1.1354, 1.1019, 1.063, 1.0286, 1];
const CAM2_END_T = [-18, -13, -8, -3, -1, 0];
const CAM2_END_K = [1, 0.9975, 0.9857, 0.9549, 0.9273, 0.91];
/** 第三段镜头（从切进来那帧算） */
const CAM3_T = [0, 1, 2, 3, 4, 5, 7, 9, 11, 13, 15, 17, 19, 23, 27, 32, 37, 42, 47, 57, 67, 77, 87, 97];
const CAM3_S = [1.4149, 1.3686, 1.3321, 1.3076, 1.2846, 1.2636, 1.2316, 1.2041, 1.1803, 1.16, 1.1367, 1.122, 1.1045, 1.0862, 1.0705, 1.0475, 1.0304, 1.0214, 1.0135, 1.0072, 1.0035, 1, 0.9968, 0.9937];

export function camera1(frame: number): number {
  return interpolate(frame, CAM1_T, CAM1_S, clamp);
}

export function camera2(rel: number, toCut: number): number {
  const base = rel <= 50 ? interpolate(rel, CAM2_T, CAM2_S, clamp) : 1 - 0.0062 * (rel - 50);
  return base * interpolate(toCut, CAM2_END_T, CAM2_END_K, clamp);
}

/** toEnd = 帧 − 品牌段结束；结束前 27.5 帧开始匀速推近 */
export function camera3(rel: number, toEnd: number): number {
  const base = rel <= 97 ? interpolate(rel, CAM3_T, CAM3_S, clamp) : 0.9937 - 0.00032 * (rel - 97);
  return base + 0.013 * Math.max(0, toEnd + 27.5);
}

/** 数字第 i 位的大小倍数：一位接一位从 4.5 倍缩回来（绕自己的中心，不挤开旁边的） */
export function digitScale(rel: number, i: number): number {
  const t = rel - (-6 + 2.6 * i);
  return 1 + Math.min(3.5, 3.5 * Math.exp(-t / 3.8));
}

/** 数字第 i 位填色的程度（0 只有描边，1 填满） */
export function digitFill(rel: number, i: number): number {
  // 按顺序一位位填满；还很大的那位（像一道亮光柱）已经是满的
  const big = interpolate(digitScale(rel, i), [1.8, 3.3], [0, 0.45], clamp);
  return Math.max(big, interpolate(rel, [2 + 2.4 * i, 9 + 2.4 * i], [0, 1], clamp));
}

/** 品牌名的虚（px） */
export function brandBlur(rel: number): number {
  return interpolate(rel, [0, 12, 22, 27, 32, 37, 42, 47], [10, 8, 6, 5, 3, 1.5, 0.5, 0], clamp);
}

const MOON_A = { cx: 1178, cy: 100, r: 262 };
const MOON_B = { cx: 100, cy: 640, r: 252 };
const MOON_A_DY = { t: [0, 2, 4, 7, 11, 15, 19, 23, 27, 37, 47, 57], y: [86, 67, 56.5, 44, 33.5, 25, 18.4, 14.5, 11, 5.3, 0.5, 0] };
const MOON_B_DY = { t: [0, 2, 7, 13, 17, 27, 37, 47, 62], y: [200, 170, 105, 70, 56, 27, 11, 3, 0] };

export const TITLE = {
  top: { left: 120, bottom: 305, size: 177, squeeze: 0.644 },
  mid: { right: 462, bottom: 392, size: 70, squeeze: 1.1 },
  big: { left: 95, bottom: 560, size: 213, squeeze: 0.95 },
  side: { left: 770, bottom: 540, size: 245, sx: 0.457, sy: 1.53 },
};
export const NUMBER = { left: 175, baseline: 519, size: 427, squeeze: 0.61, advance: 100, inkTop: 24 };
export const BRAND = { shift: 2, baseline: 410, size: 156, spacing: -2.5, dotGap: 9, box: { x: 325, y: 267, w: 630, h: 186 } };
export const BACK = { left: 190, top: 95, size: 560, squeeze: 0.42, advance: 230 };

/** 斑驳的纹理（SVG 噪点，暗色小点） */
function grunge(seed: number, freq: string, alpha: number): string {
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='480' height='480'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='${freq}' numOctaves='3' seed='${seed}'/><feColorMatrix values='0 0 0 0 0.28  0 0 0 0 0.30  0 0 0 0 0.32  0 0 0 -${alpha} ${(alpha * 0.4).toFixed(2)}'/></filter><rect width='100%' height='100%' filter='url(#n)'/></svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}

const GRUNGE_A = grunge(3, '0.22 0.035', 4.2);
const GRUNGE_B = grunge(8, '0.25 0.05', 4.0);

export const TitleNumberBrand: React.FC<TitleNumberBrandProps> = (p) => {
  const frame = useCurrentFrame();
  useBundledFont('bebas');
  useBundledFont('vibes');
  const N = p.numberAt;
  const B = p.brandAt;
  const E = p.brandEnd;
  const hasTitle = Boolean(p.top || p.mid || p.big || p.side);
  const o1 = hasTitle ? interpolate(frame, [N - 6, N + 3], [1, 0], clamp) : 0;
  const o2 = hasTitle ? interpolate(frame, [N - 6, N + 3], [0, 1], clamp) : 1;
  const outro = p.aroll ? interpolate(frame, [E - 2, E + 5], [0, 1], clamp) : 0;
  return (
    <AbsoluteFill style={{ backgroundColor: '#0e1014', overflow: 'hidden' }}>
      {frame < B && o2 > 0 && <NumberScene p={p} frame={frame} opacity={o2} />}
      {frame < N + 4 && o1 > 0 && <TitleScene p={p} frame={frame} opacity={o1} />}
      {frame >= B && outro < 1 && <BrandScene p={p} frame={frame} />}
      {p.aroll && frame >= E - 2 && (
        <AbsoluteFill style={{ opacity: outro }}>
          <AbsoluteFill style={{ transformOrigin: '640px 360px', transform: `scale(${Math.max(1, 1 + 0.0006 * (frame - E - 5)).toFixed(4)})` }}>
            <Media src={p.aroll} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />
          </AbsoluteFill>
        </AbsoluteFill>
      )}
    </AbsoluteFill>
  );
};

/* ---------------- 第一段：大标题 ---------------- */

const TitleScene: React.FC<{ p: TitleNumberBrandProps; frame: number; opacity: number }> = ({ p, frame, opacity }) => {
  const cam = camera1(frame);
  const topChars = Array.from(p.top);
  const shown = Math.max(0, Math.min(topChars.length, Math.floor((frame - 1) / 4) + 1));
  const u = interpolate(frame, [13, 28], [0, 1], clamp);
  const sideU = interpolate(frame, [33, 60], [0, 1], clamp);
  const rise = 58 * (1 - easeOut(sideU));
  const t = TITLE;
  const grungeFill = (grad: string, g: string): React.CSSProperties => ({
    color: 'transparent', backgroundImage: `${g}, ${grad}`, backgroundSize: '480px 480px, 100% 100%', WebkitBackgroundClip: 'text', backgroundClip: 'text',
  });
  return (
    <AbsoluteFill style={{ opacity }}>
      <AbsoluteFill style={{ transformOrigin: '640px 360px', transform: `scale(${cam.toFixed(4)})` }}>
        {p.aroll ? (
          <Media src={p.aroll} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />
        ) : (
          <AbsoluteFill style={{ background: NAVY }} />
        )}
        {/* 右边竖长字后面一团暗影 */}
        {p.side && frame >= 33 && (
          <div style={{ position: 'absolute', left: 700, top: 120, width: 580, height: 480, background: 'radial-gradient(ellipse 50% 50% at 58% 50%, rgba(6,20,34,0.72), rgba(6,20,34,0) 100%)' }} />
        )}
        {/* 第一行：一个字一个字蹦出来 */}
        {shown > 0 && (
          <div style={{ position: 'absolute', left: t.top.left, top: t.top.bottom - t.top.size * 0.96, height: t.top.size, whiteSpace: 'pre', transformOrigin: '0 0', transform: `scaleX(${t.top.squeeze})`, filter: 'drop-shadow(3px 4px 3px rgba(0,0,0,0.55))' }}>
            {topChars.map((ch, i) => (
              <span key={i} style={{ fontFamily: SERIF, fontWeight: 900, fontSize: t.top.size, lineHeight: 1, visibility: i < shown ? 'visible' : 'hidden', ...grungeFill('linear-gradient(to bottom, #f2f2f0, #d9d9d6 60%, #c7c7c4)', GRUNGE_A) }}>
                {ch}
              </span>
            ))}
          </div>
        )}
        {/* 第二行小字 + 大字：从虚到实、从大缩回来 */}
        {p.mid && u > 0 && (
          <div style={{ position: 'absolute', right: 1280 - t.mid.right, top: t.mid.bottom - t.mid.size * 0.96, whiteSpace: 'pre', opacity: u, transformOrigin: '100% 50%', transform: `scale(${(1.25 - 0.25 * u).toFixed(4)})`, filter: `blur(${(8 * (1 - u)).toFixed(1)}px) drop-shadow(2px 3px 2px rgba(0,0,0,0.5))` }}>
            <span style={{ display: 'inline-block', fontFamily: SERIF, fontWeight: 900, fontSize: t.mid.size, lineHeight: 1, transformOrigin: '100% 0', transform: `scaleX(${t.mid.squeeze})`, ...grungeFill('linear-gradient(to bottom, #f6f6f4, #dcdcd9)', GRUNGE_B) }}>
              {p.mid}
            </span>
          </div>
        )}
        {p.big && u > 0 && (
          <div style={{ position: 'absolute', left: t.big.left, top: t.big.bottom - t.big.size * 0.96, whiteSpace: 'pre', opacity: u, transformOrigin: '50% 50%', transform: `scale(${(1.1 - 0.1 * u).toFixed(4)})`, filter: `blur(${(8 * (1 - u)).toFixed(1)}px) drop-shadow(2px 4px 4px rgba(0,30,40,0.45))` }}>
            <span
              style={{
                display: 'inline-block', fontFamily: SERIF, fontWeight: 900, fontSize: t.big.size, lineHeight: 1, transformOrigin: '0 0', transform: `scaleX(${t.big.squeeze})`, color: 'transparent',
                backgroundImage: 'linear-gradient(to bottom, #dff7fb 0%, #93dbe8 45%, #3fa7c0 100%)', WebkitBackgroundClip: 'text', backgroundClip: 'text',
              }}
            >
              {p.big}
            </span>
          </div>
        )}
        {/* 右边又高又窄的字，从下面升上来 */}
        {p.side && frame >= 33 && (
          <div style={{ position: 'absolute', left: t.side.left, top: t.side.bottom - t.side.size * 0.96 * t.side.sy + rise, whiteSpace: 'pre', transformOrigin: '0 0', transform: `scale(${t.side.sx}, ${t.side.sy})`, filter: 'drop-shadow(3px 5px 5px rgba(0,10,20,0.5))' }}>
            <span style={{ fontFamily: SERIF, fontWeight: 900, fontSize: t.side.size, lineHeight: 1, ...grungeFill('linear-gradient(115deg, #e6f0f7 0%, #c2d7e9 30%, #8cb0d0 60%, #6189b2 100%)', GRUNGE_A) }}>
              {p.side}
            </span>
          </div>
        )}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

/* ---------------- 第二段：超大数字 ---------------- */

const NAVY = 'radial-gradient(ellipse 860px 560px at 640px 330px, #1a1f27 0%, #161b22 45%, #0e1115 100%)';
/** 数字的填色：按原片量的五位数各自上 / 中 / 下的颜色（中间几位亮、两头暗），位数不同就按位置插值 */
const DIGIT_COLS: [number, number, number][][] = [
  [[84, 129, 159], [69, 110, 145], [38, 69, 109]],
  [[155, 184, 207], [126, 169, 197], [82, 136, 168]],
  [[155, 188, 212], [157, 199, 223], [121, 183, 210]],
  [[104, 153, 182], [122, 179, 208], [125, 189, 218]],
  [[59, 101, 136], [81, 132, 167], [84, 149, 183]],
];
export function digitGradient(i: number, count: number): string {
  const u = count <= 1 ? 0.5 : i / (count - 1);
  const pos = u * (DIGIT_COLS.length - 1);
  const a = Math.min(DIGIT_COLS.length - 2, Math.floor(pos));
  const w = pos - a;
  const mix = (k: number) => DIGIT_COLS[a]![k]!.map((v, c) => Math.round(v * (1 - w) + DIGIT_COLS[a + 1]![k]![c]! * w)).join(',');
  return [
    'radial-gradient(ellipse 60% 22% at 40% 30%, rgba(225,238,248,0.32), rgba(225,238,248,0) 100%)',
    'radial-gradient(ellipse 50% 18% at 62% 68%, rgba(210,232,246,0.22), rgba(210,232,246,0) 100%)',
    `linear-gradient(to bottom, rgb(${mix(0)}) 12%, rgb(${mix(1)}) 50%, rgb(${mix(2)}) 90%)`,
  ].join(', ');
}

const NumberScene: React.FC<{ p: TitleNumberBrandProps; frame: number; opacity: number }> = ({ p, frame, opacity }) => {
  const rel = frame - p.numberAt;
  const cam = camera2(rel, frame - p.brandAt);
  const digits = Array.from(p.number);
  const n = NUMBER;
  const unitU = interpolate(rel, [16, 20], [0, 1], clamp);
  const unitK = 1 + 3.2 * Math.exp(-Math.max(0, rel - 16) / 2.6);
  const unitLight = interpolate(rel, [16, 28], [0.55, 1], clamp);
  const subU = interpolate(rel, [17, 19], [0, 1], clamp);
  const subK = 1 + 2.4 * Math.exp(-Math.max(0, rel - 17) / 3.5);
  const lineU = interpolate(rel, [24, 30], [0, 1], clamp);
  const noteU = interpolate(rel, [27, 31], [0, 1], clamp);
  const scriptU = interpolate(rel, [29, 37], [0, 1], clamp);
  const numEnd = n.left + digits.length * n.advance;
  // 单位跟在数字后面（原片 5 位数时在 683）
  const unitLeft = numEnd + 7;
  return (
    <AbsoluteFill style={{ opacity }}>
      <AbsoluteFill style={{ background: NAVY }} />
      <AbsoluteFill style={{ transformOrigin: '640px 360px', transform: `scale(${cam.toFixed(4)})` }}>
        <DashedFrame />
        {/* 单位后面的一团亮光 */}
        {p.unit && unitU > 0 && (
          <div style={{ position: 'absolute', left: unitLeft - 60, top: 280, width: 520, height: 320, opacity: unitU, background: 'radial-gradient(ellipse 50% 50% at 50% 55%, rgba(215,232,245,0.28), rgba(215,232,245,0) 100%)' }} />
        )}
        {rel >= 0 && digits.map((ch, i) => {
          const k = digitScale(rel, i);
          const f = digitFill(rel, i);
          const capH = n.size * 0.71;
          return (
            <div key={i} style={{ position: 'absolute', left: n.left + i * n.advance, top: n.baseline - capH, width: n.advance, height: capH, transformOrigin: '50% 50%', transform: `scale(${k.toFixed(4)})` }}>
              <div
                style={{
                  position: 'absolute', left: '50%', top: n.inkTop, whiteSpace: 'pre', fontFamily: `"${BUNDLED_FONTS.bebas.family}", "Bebas Neue", "Oswald", sans-serif`, fontSize: n.size, lineHeight: `${capH}px`,
                  transformOrigin: '50% 0', transform: `translateX(-50%) scaleX(${n.squeeze})`,
                }}
              >
                {/* 描边 */}
                <span style={{ position: 'absolute', left: 0, top: 0, color: 'transparent', WebkitTextStroke: `${(2.6 / k).toFixed(2)}px rgba(130,190,225,${(0.85 * (1 - 0.6 * f)).toFixed(2)})` }}>{ch}</span>
                {/* 填色 */}
                <span style={{ position: 'relative', color: 'transparent', opacity: f, backgroundImage: digitGradient(i, digits.length), WebkitBackgroundClip: 'text', backgroundClip: 'text' }}>{ch}</span>
              </div>
            </div>
          );
        })}
        {/* 单位大字：从大落下来 */}
        {p.unit && unitU > 0 && (
          <div style={{ position: 'absolute', left: unitLeft, top: 529 - 330 * 0.97, whiteSpace: 'pre', opacity: unitU, transformOrigin: '0 50%', transform: `scale(${unitK.toFixed(4)})`, filter: `brightness(${unitLight.toFixed(3)}) drop-shadow(0 0 14px rgba(190,225,250,0.45))` }}>
            <span
              style={{
                display: 'inline-block', fontFamily: SERIF, fontWeight: 900, fontSize: 330, lineHeight: 1, transformOrigin: '0 0', transform: 'scaleX(0.55)', color: 'transparent',
                backgroundImage: 'linear-gradient(to bottom, #f6fcff 0%, #dcf0fa 45%, #b4def4 100%)', WebkitBackgroundClip: 'text', backgroundClip: 'text',
              }}
            >
              {p.unit}
            </span>
          </div>
        )}
        {p.unitSub && subU > 0 && (
          <div style={{ position: 'absolute', left: unitLeft + 197, top: 530 - 90 * 0.96, whiteSpace: 'pre', opacity: subU, transformOrigin: '0 0', transform: `scale(${subK.toFixed(4)})`, filter: `blur(${(1.5 * (subK - 1)).toFixed(1)}px) drop-shadow(0 0 10px rgba(230,240,248,0.35))` }}>
            <span style={{ display: 'inline-block', fontFamily: SERIF, fontWeight: 700, fontSize: 90, lineHeight: 1, transformOrigin: '0 0', transform: 'scaleX(0.69)', color: 'transparent', backgroundImage: 'linear-gradient(to bottom, #f2f2f2, #bfc3c6)', WebkitBackgroundClip: 'text', backgroundClip: 'text' }}>
              {p.unitSub}
            </span>
          </div>
        )}
        {/* 注释：折线 + 两行小字 + 手写体 */}
        {lineU > 0 && (p.note || p.script) && (
          <>
            <svg width={1280} height={720} style={{ position: 'absolute', left: 0, top: 0 }}>
              <polyline points={`${unitLeft + 195},267 ${unitLeft + 347},267 ${unitLeft + 347},382`} fill="none" stroke="rgba(200,212,222,0.7)" strokeWidth={1.3} pathLength={1} strokeDasharray={`${lineU.toFixed(3)} 1`} />
            </svg>
            {p.note && (
              <div style={{ position: 'absolute', right: 1280 - (unitLeft + 379), top: 372, whiteSpace: 'pre', textAlign: 'right', fontFamily: SANS, fontWeight: 700, fontSize: 16, lineHeight: '28px', color: '#eef2f5', opacity: noteU }}>
                {p.note}
              </div>
            )}
          </>
        )}
        {p.script && scriptU > 0 && (
          <div style={{ position: 'absolute', left: unitLeft + 175, top: 392, whiteSpace: 'pre', fontFamily: `"${BUNDLED_FONTS.vibes.family}", cursive`, fontSize: 50, lineHeight: 1.2, color: '#5572f2', clipPath: `inset(-20px ${((1 - scriptU) * 100).toFixed(1)}% -20px -20px)`, textShadow: '0 0 6px rgba(80,110,255,0.35)' }}>
            {p.script}
          </div>
        )}
      </AbsoluteFill>
      <AbsoluteFill style={{ background: vignetteGradient({ cx: 640, cy: 340, rx: 780, ry: 480, amount: 0.3, power: 2.4 }) }} />
    </AbsoluteFill>
  );
};

/** 四周一圈淡淡的虚线（只有左上、右下两段） */
const DashedFrame: React.FC = () => (
  <svg width={1280} height={720} style={{ position: 'absolute', left: 0, top: 0 }}>
    <g stroke="rgba(120,132,145,0.35)" strokeWidth={1.2} strokeDasharray="7 5" fill="none">
      <polyline points="10,330 10,33 665,33" />
      <polyline points="700,686 1270,686 1270,400" />
    </g>
  </svg>
);

/* ---------------- 第三段：月亮 + 品牌名 ---------------- */

/** 品牌名一行的排版：白字、菱形点、蓝字，整行以画面中心对齐 */
export function brandLayout(brand: string, accent: string, measureText: (t: string, font: string) => number) {
  const b = BRAND;
  const font = `700 ${b.size}px ${SANS}`;
  const w1 = brand ? measureText(brand, font) + b.spacing * Array.from(brand).length : 0;
  const w2 = accent ? measureText(accent, font) + b.spacing * Array.from(accent).length : 0;
  const dotW = accent ? 12 + 2 * b.dotGap : 0;
  const left = 640 - (w1 + dotW + w2) / 2 + b.shift;
  return { left, dot: left + w1 + b.dotGap, accentLeft: left + w1 + dotW, top: b.baseline - b.size * 0.88 };
}

const BrandScene: React.FC<{ p: TitleNumberBrandProps; frame: number }> = ({ p, frame }) => {
  const rel = frame - p.brandAt;
  const cam = camera3(rel, frame - p.brandEnd);
  const blur = brandBlur(rel);
  const chars = Array.from(p.backText);
  const lay = brandLayout(p.brand, p.accent, measure);
  // 结束前字里面先透出口播画面（有口播画面才有）
  const inLetters = p.aroll ? interpolate(frame, [p.brandEnd - 16, p.brandEnd - 4], [0, 1], clamp) : 0;
  const sameMoon = p.moonA === p.moonB;
  // 月亮按镜头缩放，再各自从下面升上来（屏幕上的位移）
  const moon = (m: { cx: number; cy: number; r: number }, dy: number, src: string, flip: boolean) => {
    const cx = 640 + cam * (m.cx - 640);
    const cy = 360 + cam * (m.cy - 360) + dy;
    const r = m.r * cam;
    return (
      <Img src={assetUrl(src)} style={{ position: 'absolute', left: cx - r, top: cy - r, width: 2 * r, height: 2 * r, transform: flip ? 'scale(-1, -1)' : undefined, filter: 'blur(1.2px)' }} />
    );
  };
  const textStyle: React.CSSProperties = { position: 'absolute', top: lay.top, whiteSpace: 'pre', fontFamily: SANS, fontWeight: 700, fontSize: BRAND.size, lineHeight: 1, letterSpacing: BRAND.spacing };
  const camT = `translate(640 360) scale(${cam.toFixed(4)}) translate(-640 -360)`;
  const clipFont: React.CSSProperties = { fontFamily: SANS, fontWeight: 700, fontSize: BRAND.size, letterSpacing: BRAND.spacing };
  return (
    <AbsoluteFill style={{ backgroundColor: '#0f0f0f' }}>
      {p.moonA && moon(MOON_A, interpolate(rel, MOON_A_DY.t, MOON_A_DY.y, clamp), p.moonA, false)}
      {/* 两个用同一张图时，左下那个转过来，看着不一样 */}
      {p.moonB && moon(MOON_B, interpolate(rel, MOON_B_DY.t, MOON_B_DY.y, clamp), p.moonB, sameMoon)}
      <AbsoluteFill style={{ transformOrigin: '640px 360px', transform: `scale(${cam.toFixed(4)})` }}>
        {/* 背后很淡的大字：描边 + 月面纹理，一个字一个字从上往下显出来 */}
        {chars.map((ch, i) => {
          const u = interpolate(rel, [14 + 2.7 * i, 19 + 2.7 * i], [0, 1], clamp);
          if (u <= 0) return null;
          const left = BACK.left + i * BACK.advance;
          const common: React.CSSProperties = { position: 'absolute', left: 0, top: 0, fontFamily: SANS, fontWeight: 900, fontSize: BACK.size, lineHeight: 1, whiteSpace: 'pre' };
          return (
            <div key={i} style={{ position: 'absolute', left, top: BACK.top - BACK.size * 0.07, width: BACK.size, height: BACK.size * 1.1, transformOrigin: '0 0', transform: `scaleX(${BACK.squeeze})`, clipPath: `inset(0 0 ${((1 - u) * 100).toFixed(1)}% 0)` }}>
              {p.moonA && (
                <span style={{ ...common, color: 'transparent', opacity: 0.4, WebkitMaskImage: 'linear-gradient(to bottom, rgba(0,0,0,0.25) 20%, rgba(0,0,0,1) 75%)', maskImage: 'linear-gradient(to bottom, rgba(0,0,0,0.25) 20%, rgba(0,0,0,1) 75%)', backgroundImage: `url("${assetUrl(p.moonA)}")`, backgroundSize: `${BACK.size * 1.2}px ${BACK.size * 1.2}px`, backgroundPosition: `${-BACK.size * 0.1 - i * 60}px ${-BACK.size * 0.05}px`, WebkitBackgroundClip: 'text', backgroundClip: 'text' }}>
                  {ch}
                </span>
              )}
              <span style={{ ...common, color: 'transparent', WebkitTextStroke: '3px rgba(150,150,150,0.16)' }}>{ch}</span>
            </div>
          );
        })}
        {/* 细线框 + 两个角上的亮点 */}
        <svg width={1280} height={720} style={{ position: 'absolute', left: 0, top: 0 }}>
          <rect x={BRAND.box.x} y={BRAND.box.y} width={BRAND.box.w} height={BRAND.box.h} fill="none" stroke="rgba(150,162,175,0.42)" strokeWidth={1.2} />
          {[[BRAND.box.x, BRAND.box.y], [BRAND.box.x + BRAND.box.w, BRAND.box.y + BRAND.box.h]].map(([x, y], i) => (
            <rect key={i} x={x! - 3.5} y={y! - 3.5} width={7} height={7} fill="#b9e2ff" style={{ filter: 'drop-shadow(0 0 4px rgba(120,190,255,0.9))' }} />
          ))}
        </svg>
        {/* 品牌名：从很虚到实 */}
        <div style={{ position: 'absolute', left: 0, top: 0, width: 1280, height: 720, filter: blur > 0.05 ? `blur(${blur.toFixed(2)}px)` : undefined }}>
          {p.brand && (
            <div style={{ ...textStyle, left: lay.left, color: 'transparent', backgroundImage: 'linear-gradient(to bottom, #ffffff 0%, #eeeeee 45%, #a9a9a9 100%)', WebkitBackgroundClip: 'text', backgroundClip: 'text', filter: 'drop-shadow(0 0 10px rgba(255,255,255,0.35)) drop-shadow(0 0 24px rgba(220,230,255,0.2))' }}>
              {p.brand}
            </div>
          )}
          {p.accent && (
            <>
              <div style={{ position: 'absolute', left: lay.dot, top: BRAND.baseline - 63, width: 12, height: 12, transform: 'rotate(45deg)', background: '#b6ecfc', boxShadow: '0 0 8px rgba(120,210,255,0.9)' }} />
              <div style={{ ...textStyle, left: lay.accentLeft, color: 'transparent', backgroundImage: 'linear-gradient(to bottom, #b4ccff 0%, #7b9cf4 45%, #3f63d8 100%)', WebkitBackgroundClip: 'text', backgroundClip: 'text', filter: 'drop-shadow(0 0 10px rgba(70,110,255,0.75)) drop-shadow(0 0 26px rgba(60,90,255,0.45))' }}>
                {p.accent}
              </div>
            </>
          )}
        </div>
      </AbsoluteFill>
      {/* 字里透出来的口播画面：用品牌名的字形裁出来 */}
      {inLetters > 0 && (
        <>
          <svg width={0} height={0} style={{ position: 'absolute' }}>
            <defs>
              <clipPath id="tnb-brand-letters">
                {/* clipPath 里只能直接放 text，不能套 g */}
                {p.brand && <text transform={camT} style={clipFont} x={lay.left} y={BRAND.baseline}>{p.brand}</text>}
                {p.accent && <text transform={camT} style={clipFont} x={lay.accentLeft} y={BRAND.baseline}>{p.accent}</text>}
              </clipPath>
            </defs>
          </svg>
          <AbsoluteFill style={{ clipPath: 'url(#tnb-brand-letters)', opacity: inLetters }}>
            <Media src={p.aroll} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />
          </AbsoluteFill>
        </>
      )}
      <AbsoluteFill style={{ background: vignetteGradient({ cx: 640, cy: 360, rx: 760, ry: 470, amount: 0.25, power: 2.4 }) }} />
    </AbsoluteFill>
  );
};
