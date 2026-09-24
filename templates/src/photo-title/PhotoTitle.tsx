import React from 'react';
import { AbsoluteFill, Easing, interpolate, random, useCurrentFrame } from 'remotion';
import { Media } from '../media';

/**
 * 复刻：黑白照片 → 白光闪切 → 第二张照片上一组大字标题逐个出来（196 帧，1280×720 @30fps）
 *
 * ── 两段 ─────────────────────────────────────────────────────────────
 *   0–43   第一张照片，基本不动
 *   43–50  过曝闪一下（46 帧最亮，还看得出轮廓），47 帧切到第二张
 *   47–72  第二张照片往左平移 115px、先放大到 1.04 再回到 1（先快后慢）
 *
 * ── 标题（位置按原片第 149 帧量的）──────────────────────────────────
 *   主词「偷」    x 365 起、y 115–280，横向加宽的粗宋；56–74 帧故障闪现（横条错位、时隐时现）
 *   引导「苹果的」 右边对齐到 x 320，y 115–195；78 帧起
 *   连接「和」    x 155–340，竖向拉长；66 帧起
 *   副词「[被偷]」 x 365 起、y 305–590，竖向拉长、灰；68 帧起一个字一个字
 *   引号、英文两行小字、底下一条细线（80–92 帧从左往右画）
 *   除了主词，其余都是「竖向拖影」淡入：几层上下错开的影子收拢成一个字，14 帧
 *
 * 右边一道暗的胶片边框、四周暗角和颗粒，盖在最上面。只复刻画面，底部口播字幕不在模板里。
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
  durationInFrames: number;
};

const SERIF = '"Songti SC", "STSong", "Noto Serif CJK SC", "Source Han Serif SC", serif';
const LATIN_SERIF = '"Baskerville", "Times New Roman", "Noto Serif CJK SC", serif';

const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;

/** 相对标题开始（原片 56）的各元素出现帧 */
const T = { lead: 22, connector: 10, word2: 12, word2Step: 10, quote: 16, english: 14, rule: 18, glitch: 18 };
const SMEAR_FRAMES = 14;

export const PhotoTitle: React.FC<PhotoTitleProps> = (p) => {
  const frame = useCurrentFrame();
  const cut = p.flashAt + 1;
  const flash = interpolate(frame, [p.flashAt - 3, p.flashAt, p.flashAt + 4], [0, 1, 0], clamp);
  const t = frame - p.titleAt;
  const gray = p.grayscale ? 'grayscale(1) ' : '';

  // 第二张照片的镜头（相对切过去那一帧）
  const u = interpolate(frame - cut, [0, 25], [0, 1], { ...clamp, easing: Easing.out(Easing.cubic) });
  const panX = 115 * (1 - u);
  const panY = 17 * (1 - u);
  const zoom = interpolate(frame - cut, [0, 13, 43], [0.92, 1.04, 1], { ...clamp, easing: Easing.inOut(Easing.quad) });

  return (
    <AbsoluteFill style={{ backgroundColor: '#111', overflow: 'hidden' }}>
      {frame < cut ? (
        <AbsoluteFill style={{ filter: `${gray}brightness(${1 + 1.5 * flash}) contrast(${1 - 0.25 * flash}) blur(${(14 * flash).toFixed(2)}px)` }}>
          <Media src={p.photo1} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />
        </AbsoluteFill>
      ) : (
        <AbsoluteFill style={{ filter: `${gray}brightness(${1 + 1.5 * flash}) contrast(${1 - 0.25 * flash}) blur(${(14 * flash).toFixed(2)}px)` }}>
          <AbsoluteFill style={{ transform: `translate(${panX}px, ${panY}px) scale(${zoom})`, transformOrigin: '800px 200px' }}>
            <Media src={p.photo2} style={{ position: 'absolute', left: -80, top: -60, width: 1440, height: 840 }} />
          </AbsoluteFill>
        </AbsoluteFill>
      )}

      {frame >= cut && t >= 0 && (
        <AbsoluteFill style={{ filter: 'drop-shadow(-1.5px 0 0 rgba(200,40,40,0.35)) drop-shadow(1.5px 0 0 rgba(40,160,200,0.3))' }}>
          {/* 引号：很淡的灰 */}
          <Smear t={t - T.quote} style={{ left: 330, top: 60, fontSize: 210, color: 'rgba(170,170,170,0.8)', fontWeight: 900 }}>“</Smear>
          {/* 引导词：右边对齐到 x=320 */}
          <Smear t={t - T.lead} style={{ right: 1280 - 322, top: 106, fontSize: 76, color: '#3a3a3a', fontWeight: 700, filter: 'blur(0.8px)' }}>{p.lead}</Smear>
          <Glitch t={t} word={p.word1} />
          {/* 连接词：竖向拉长 */}
          <Smear t={t - T.connector} style={{ left: 150, top: 222, fontSize: 192, color: '#161616', fontWeight: 900, scaleY: 1.33 }}>{p.connector}</Smear>
          {/* 副词：带方括号，一个字一个字 */}
          <Smear t={t - T.word2} style={{ left: 360, top: 396, fontSize: 104, color: '#2e2e2e', fontWeight: 300 }}>[</Smear>
          {Array.from(p.word2).map((ch, i) => (
            <Smear key={i} t={t - T.word2 - i * T.word2Step} style={{ left: 402 + i * 184, top: 302, fontSize: 186, color: '#2b2b2b', fontWeight: 900, scaleY: 1.55, grunge: true }}>{ch}</Smear>
          ))}
          <Smear t={t - T.word2 - (Array.from(p.word2).length - 1) * T.word2Step} style={{ left: 402 + Array.from(p.word2).length * 184 + 6, top: 396, fontSize: 104, color: '#2e2e2e', fontWeight: 300 }}>]</Smear>
          {/* 英文两行 */}
          <Smear t={t - T.english} style={{ left: 150, top: 490, fontSize: 28, color: '#6f6f6f', fontWeight: 700, font: LATIN_SERIF, filter: 'blur(0.7px)' }}>{p.english1}</Smear>
          <Smear t={t - T.english - 3} style={{ left: 150, top: 538, fontSize: 28, color: '#6f6f6f', fontWeight: 700, font: LATIN_SERIF, filter: 'blur(0.7px)' }}>{p.english2}</Smear>
          {/* 细线：方点 + 从左往右画 */}
          {t >= T.rule && (
            <>
              <div style={{ position: 'absolute', left: 357, top: 605, width: 10, height: 10, backgroundColor: '#222' }} />
              <div
                style={{
                  position: 'absolute', left: 372, top: 609, height: 2, backgroundColor: '#2c2c2c',
                  width: 698 * Easing.out(Easing.cubic)(interpolate(t - T.rule, [0, 12], [0, 1], clamp)),
                }}
              />
            </>
          )}
        </AbsoluteFill>
      )}

      <FilmFrame opacity={interpolate(frame - cut, [2, 15], [0, 1], clamp)} />
    </AbsoluteFill>
  );
};

type SmearStyle = { left?: number; right?: number; top: number; fontSize: number; color: string; fontWeight: number; scaleY?: number; font?: string; filter?: string; grunge?: boolean };

/** 竖向拖影淡入：几层上下错开、越外越淡的影子，14 帧收拢成一个字 */
const Smear: React.FC<{ t: number; style: SmearStyle; children: React.ReactNode }> = ({ t, style, children }) => {
  if (t < 0) return null;
  const q = Easing.out(Easing.cubic)(interpolate(t, [0, SMEAR_FRAMES], [0, 1], clamp));
  const spread = 40 * (1 - q);
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
        <div key={k} style={{ ...base, opacity: 0.22 * q * (1 - q) * 4 / Math.abs(k), marginTop: k * spread * 0.5, filter: `blur(${(3 * (1 - q)).toFixed(2)}px)` }}>{children}</div>
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
  if (settle >= 1) return <div style={base}>{word}</div>;
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

/** 右边一道暗的胶片边框（带虚化的齿孔）、四周暗角 */
const FilmFrame: React.FC<{ opacity: number }> = ({ opacity }) => (
  <>
    <AbsoluteFill style={{ opacity }}>
      <div style={{ position: 'absolute', left: 1085, top: -20, width: 240, height: 760, background: 'linear-gradient(to right, rgba(12,12,12,0) 0%, rgba(12,12,12,0.85) 18%, rgba(20,20,20,0.92) 100%)', filter: 'blur(6px)' }} />
      {Array.from({ length: 6 }, (_, i) => (
        <div key={i} style={{ position: 'absolute', left: 1205, top: 20 + i * 130, width: 60, height: 78, borderRadius: 16, backgroundColor: 'rgba(80,80,80,0.4)', filter: 'blur(14px)' }} />
      ))}
    </AbsoluteFill>
    <AbsoluteFill style={{ background: 'radial-gradient(ellipse 72% 78% at 45% 45%, rgba(0,0,0,0) 55%, rgba(0,0,0,0.45) 85%, rgba(0,0,0,0.8) 100%)' }} />
  </>
);
