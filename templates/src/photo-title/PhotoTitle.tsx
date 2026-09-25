import React from 'react';
import { AbsoluteFill, Easing, interpolate, random, useCurrentFrame } from 'remotion';
import { Media } from '../media';

/**
 * 复刻：黑白照片 → 白光闪切 → 第二张照片上一组大字标题逐个出来（196 帧，1280×720 @30fps）
 *
 * ── 两段 ─────────────────────────────────────────────────────────────
 *   0–43   第一张照片，不动
 *   43–50  亮的地方过曝、往外泛光（46、47 帧最亮，暗的地方还在），47 帧切到第二张
 *   47–      第二张照片、胶片边框、标题是一个整体，被同一个镜头拍：一开始推近到 1.46 倍、对着左上，
 *            越来越慢地拉远，120 帧回到 1 倍，之后轻微晃几像素（逐帧实测）。标题那层前 50 帧的中心略有不同
 *
 * ── 标题（位置按原片第 149 帧量的）──────────────────────────────────
 *   主词「偷」    x 365 起、y 115–280，横向加宽的粗宋；56 帧整个出来，57–74 帧故障闪现（横条错位、时隐时现）
 *   引导「苹果的」 右边对齐到 x 320，y 115–195；64 帧起
 *   连接「和」    x 155–340，竖向拉长；64 帧起
 *   副词「[被偷]」 x 365 起、y 305–590，竖向拉长、灰；「[」68 帧，「被」72 帧、「偷」78 帧
 *   引号 68 帧；英文两行小字 70、84 帧；底下一条细线：方点当笔尖，68 帧从右边起步、往左画，98 帧到头
 *   除了主词，其余都是「竖向拖影」淡入：几层上下错开的影子慢慢收拢成一个字，18 帧
 *
 * 胶片边框（和照片一起缩放）：画面四周一圈虚的暗边，右边一道宽的暗边带齿孔；再加屏幕暗角。
 * 只复刻画面，底部口播字幕不在模板里。
 */

export type PhotoTitleProps = {
  photo1: string;
  photo2: string;
  grayscale: boolean;
  lead: string;
  word1: string;
  connector: string;
  word2: string;
  english1: string;
  english2: string;
  /** 闪白切换的帧（最亮那一帧） */
  flashAt: number;
  /** 标题开始出现的帧（主词故障闪现开始） */
  titleAt: number;
  /** 胶片边框 */
  filmFrame: boolean;
  durationInFrames: number;
};

const SERIF = '"Songti SC", "STSong", "Noto Serif CJK SC", "Source Han Serif SC", serif';
const LATIN_SERIF = '"Baskerville", "Times New Roman", "Noto Serif CJK SC", serif';

const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;

/** 相对标题开始（原片 56）的各元素出现帧 */
const T = { lead: 8, connector: 8, word2: 16, word2Step: 6, bracket: 12, quote: 12, english: 14, english2: 28, glitch: 18 };
/** 底下的细线：方点是笔尖，从右往左画（相对标题开始，原片 68 帧起、98 帧画完） */
const RULE_T = [12, 14, 20, 26, 32, 40, 46];
const RULE_X = [1070, 1003, 758, 600, 497, 380, 357];
const SMEAR_FRAMES = 18;

/**
 * 第二段的镜头（相对切过去那一帧，原片 47）：倍数和画面中心 (640, 360) 落在哪（逐帧实测）。
 * 画面 = 中心落点 + 倍数 ×（静止时的坐标 − (640, 360)）
 */
const CAM_T = [0, 5, 8, 15, 19, 23, 28, 33, 43, 53, 73, 103, 133, 148];
const CAM_S = [1.44, 1.465, 1.3836, 1.2537, 1.2028, 1.1723, 1.1295, 1.0957, 1.069, 1.0304, 1.0037, 0.9997, 0.9998, 1];
const CAM_X = [505, 513.4, 517.9, 534.2, 547, 561.9, 586.5, 608.7, 617.2, 628.5, 642, 636.7, 634.9, 640];
const CAM_Y = [262, 270.4, 280.9, 302.7, 316.2, 332.4, 350.1, 361.6, 365.5, 367.6, 370, 363.3, 360, 360];
/** 标题那层：前 50 帧中心更靠右下一点，之后和照片一样 */
const TCAM_T = [9, 15, 19, 23, 27, 31, 35, 39, 43, 48, 53, 63, 73, 103, 133, 148];
const TCAM_S = [1.35, 1.24, 1.19, 1.1614, 1.1292, 1.1081, 1.0866, 1.0693, 1.0557, 1.0409, 1.0297, 1.0132, 1.0046, 0.9999, 1.0002, 1];
const TCAM_X = [556, 578, 588, 593.4, 599, 604.9, 609.1, 613.9, 617.9, 623.4, 628.5, 636.7, 642, 636.7, 634.8, 640];
const TCAM_Y = [386, 376, 371, 368.9, 367.1, 367, 366, 366.3, 366.6, 367.2, 367.9, 369.5, 370, 363.3, 360.1, 360];
/** 闪白强度（相对最亮那一帧） */
const FLASH_T = [-3, -2, -1, 0, 1, 2, 3, 4, 6];
const FLASH_V = [0, 0.3, 0.75, 1, 1, 0.85, 0.3, 0.08, 0];

export function shotCamera(rel: number, title = false) {
  const [t, sv, xv, yv] = title ? [TCAM_T, TCAM_S, TCAM_X, TCAM_Y] : [CAM_T, CAM_S, CAM_X, CAM_Y];
  return { s: interpolate(rel, t, sv, clamp), x: interpolate(rel, t, xv, clamp), y: interpolate(rel, t, yv, clamp) };
}

const camTransform = (c: { s: number; x: number; y: number }) => `translate(${(c.x - 640).toFixed(2)}px, ${(c.y - 360).toFixed(2)}px) scale(${c.s.toFixed(4)})`;

export const PhotoTitle: React.FC<PhotoTitleProps> = (p) => {
  const frame = useCurrentFrame();
  const cut = p.flashAt + 1;
  const flash = interpolate(frame - p.flashAt, FLASH_T, FLASH_V, clamp);
  const t = frame - p.titleAt;
  const gray = p.grayscale ? 'grayscale(1) ' : '';
  const cam = shotCamera(frame - cut);
  const tcam = shotCamera(frame - cut, true);
  const photo = frame < cut ? p.photo1 : p.photo2;

  // 照片：过曝那几帧底图亮一点，再叠一层「只留亮部、糊开」的光（screen 混合）
  const picture = (
    <>
      <AbsoluteFill style={{ filter: `${gray}brightness(${(1 + 0.25 * flash).toFixed(3)})` }}>
        <Media src={photo} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />
      </AbsoluteFill>
      {flash > 0.01 &&
        // 两层光：一层贴着亮部（糊 18px），一层往外泛得很开（糊 70px）；越亮，算「亮部」的门槛越低，墙也跟着过曝
        [18, 60].map((r, i) => (
          <AbsoluteFill key={i} style={{ mixBlendMode: 'screen', opacity: 0.9 * flash, filter: `${gray}brightness(${(0.9 + 0.2 * flash).toFixed(3)}) contrast(5) blur(${(r * (0.4 + 0.6 * flash)).toFixed(1)}px)` }}>
            <Media src={photo} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />
          </AbsoluteFill>
        ))}
    </>
  );

  return (
    <AbsoluteFill style={{ backgroundColor: '#111', overflow: 'hidden' }}>
      {frame < cut ? (
        picture
      ) : (
        <AbsoluteFill style={{ transformOrigin: '640px 360px', transform: camTransform(cam) }}>
          {/* 四边多铺一点，镜头轻微晃动时不露边 */}
          <AbsoluteFill style={{ transform: 'scale(1.02)' }}>{picture}</AbsoluteFill>
          {p.filmFrame && <FilmGate />}
        </AbsoluteFill>
      )}

      {frame >= cut && t >= 0 && (
        <AbsoluteFill style={{ transformOrigin: '640px 360px', transform: camTransform(tcam), filter: 'drop-shadow(-1.5px 0 0 rgba(200,40,40,0.35)) drop-shadow(1.5px 0 0 rgba(40,160,200,0.3))' }}>
          {/* 引号：很淡的灰 */}
          <Smear t={t - T.quote} style={{ left: 330, top: 60, fontSize: 210, color: 'rgba(170,170,170,0.8)', fontWeight: 900 }}>“</Smear>
          {/* 引导词：右边对齐到 x=320 */}
          <Smear t={t - T.lead} style={{ right: 1280 - 322, top: 106, fontSize: 76, color: '#3a3a3a', fontWeight: 700, filter: 'blur(0.8px)' }}>{p.lead}</Smear>
          <Glitch t={t} word={p.word1} />
          {/* 连接词：竖向拉长 */}
          <Smear t={t - T.connector} style={{ left: 150, top: 222, fontSize: 192, color: '#161616', fontWeight: 900, scaleY: 1.33 }}>{p.connector}</Smear>
          {/* 副词：带方括号，一个字一个字 */}
          <Smear t={t - T.bracket} style={{ left: 360, top: 396, fontSize: 104, color: '#2e2e2e', fontWeight: 300 }}>[</Smear>
          {Array.from(p.word2).map((ch, i) => (
            <Smear key={i} t={t - T.word2 - i * T.word2Step} style={{ left: 402 + i * 184, top: 302, fontSize: 186, color: '#2b2b2b', fontWeight: 900, scaleY: 1.55, grunge: true }}>{ch}</Smear>
          ))}
          <Smear t={t - T.word2 - (Array.from(p.word2).length - 1) * T.word2Step} style={{ left: 402 + Array.from(p.word2).length * 184 + 6, top: 396, fontSize: 104, color: '#2e2e2e', fontWeight: 300 }}>]</Smear>
          {/* 英文两行 */}
          <Smear t={t - T.english} style={{ left: 150, top: 490, fontSize: 28, color: '#6f6f6f', fontWeight: 700, font: LATIN_SERIF, filter: 'blur(0.7px)' }}>{p.english1}</Smear>
          <Smear t={t - T.english2} style={{ left: 150, top: 538, fontSize: 28, color: '#6f6f6f', fontWeight: 700, font: LATIN_SERIF, filter: 'blur(0.7px)' }}>{p.english2}</Smear>
          {/* 细线：方点当笔尖，从右往左画 */}
          {t >= RULE_T[0]! && (() => {
            const pen = interpolate(t, RULE_T, RULE_X, clamp);
            return (
              <>
                <div style={{ position: 'absolute', left: pen, top: 605, width: 10, height: 10, backgroundColor: '#222' }} />
                <div style={{ position: 'absolute', left: pen + 15, top: 609, height: 2, backgroundColor: '#2c2c2c', width: Math.max(0, 1070 - pen - 15) }} />
              </>
            );
          })()}
        </AbsoluteFill>
      )}

      {/* 屏幕暗角 */}
      <AbsoluteFill style={{ background: 'radial-gradient(ellipse 72% 78% at 45% 45%, rgba(0,0,0,0) 60%, rgba(0,0,0,0.3) 88%, rgba(0,0,0,0.55) 100%)' }} />
    </AbsoluteFill>
  );
};

type SmearStyle = { left?: number; right?: number; top: number; fontSize: number; color: string; fontWeight: number; scaleY?: number; font?: string; filter?: string; grunge?: boolean };

/** 竖向拖影淡入：几层上下错开、越外越淡的影子，14 帧收拢成一个字 */
const Smear: React.FC<{ t: number; style: SmearStyle; children: React.ReactNode }> = ({ t, style, children }) => {
  if (t < 0) return null;
  const q = Math.pow(interpolate(t, [0, SMEAR_FRAMES], [0, 1], clamp), 1.3);
  const spread = 36 * (1 - q);
  const base: React.CSSProperties = {
    position: 'absolute', left: style.left, right: style.right, top: style.top,
    fontFamily: style.font ?? SERIF, fontSize: style.fontSize, fontWeight: style.fontWeight, lineHeight: 1,
    color: style.color, whiteSpace: 'pre', transformOrigin: '0 0',
    transform: style.scaleY ? `scaleY(${style.scaleY})` : undefined,
    ...(style.grunge
      ? { backgroundImage: `linear-gradient(to bottom, #1d1d1d 0%, ${style.color} 45%, #555 100%)`, WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' }
      : {}),
  };
  const layers = q < 1 ? [-2, -1, 1, 2] : [];
  return (
    <>
      {layers.map((k) => (
        <div key={k} style={{ ...base, opacity: (0.1 * (1 - q) + 0.03) * Math.min(1, t / 3) / Math.abs(k), marginTop: k * spread * 0.5, filter: `blur(${(3 * (1 - q)).toFixed(2)}px)` }}>{children}</div>
      ))}
      <div style={{ ...base, opacity: q, filter: [style.filter, q < 1 ? `blur(${(4 * (1 - q)).toFixed(2)}px)` : ''].filter(Boolean).join(' ') || undefined }}>{children}</div>
    </>
  );
};

/** 主词的故障闪现：切成几条横带，每帧随机错位、时隐时现，18 帧后稳住 */
const Glitch: React.FC<{ t: number; word: string }> = ({ t, word }) => {
  if (t < 0) return null;
  const bands = 6;
  const settle = interpolate(t, [0, T.glitch], [0, 1], clamp);
  const base: React.CSSProperties = {
    position: 'absolute', left: 362, top: 110, fontFamily: SERIF, fontSize: 176, fontWeight: 900, lineHeight: 1,
    color: '#0e0e0e', whiteSpace: 'pre', transform: 'scaleX(1.42)', transformOrigin: '0 0',
  };
  // 第一帧整个字出来，之后才碎；18 帧后稳住
  if (t < 1 || settle >= 1) return <div style={base}>{word}</div>;
  return (
    <>
      {Array.from({ length: bands }, (_, i) => {
        const seed = `${Math.floor(t)}-${i}`;
        const show = random(`s${seed}`) < 0.25 + 0.7 * settle;
        if (!show) return null;
        const dx = (random(`x${seed}`) - 0.5) * 90 * (1 - settle);
        const top = (i / bands) * 100;
        const bottom = 100 - ((i + 1) / bands) * 100;
        return (
          <div key={i} style={{ ...base, left: 362 + dx, clipPath: `inset(${top}% 0 ${bottom}% 0)` }}>{word}</div>
        );
      })}
    </>
  );
};

/**
 * 胶片边框（静止时的画面坐标，跟着照片一起缩放）：
 *   四周一圈虚的暗边（左边 0–50、上边 0–60、下边 640–700 渐暗），圆角；
 *   右边从 x 1100 起一道宽的暗边，里面几个虚的齿孔
 */
const FilmGate: React.FC = () => (
  <>
    <div
      style={{
        position: 'absolute', left: 22, top: 14, width: 1110, height: 648, borderRadius: 46,
        boxShadow: '0 0 0 700px rgba(16,13,12,0.9)', filter: 'blur(18px)',
      }}
    />
    <div style={{ position: 'absolute', left: 1100, top: -200, width: 400, height: 1120, background: 'linear-gradient(to right, rgba(16,13,12,0) 0%, rgba(20,17,16,0.9) 12%, rgba(22,20,20,0.95) 100%)', filter: 'blur(6px)' }} />
    {Array.from({ length: 7 }, (_, i) => (
      <div key={i} style={{ position: 'absolute', left: 1200, top: -70 + i * 130, width: 62, height: 82, borderRadius: 16, backgroundColor: 'rgba(70,70,72,0.45)', filter: 'blur(12px)' }} />
    ))}
  </>
);
