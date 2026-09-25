import React from 'react';
import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from 'remotion';
import { BUNDLED_FONTS, useBundledFont } from '../fonts';
import { Media } from '../media';
import { measure } from '../text-layout';
import { PaperPile, type PaperSlot } from '../paper-cards/PaperCards';
import { vignetteGradient } from '../lens';

/**
 * 复刻：灰墙窗影 —— 文件截图斜着滑进来 → 文件虚掉往右滑走、露出后面的人物 → 金色大数字从 0 数到 30 →
 * 一排纸片飞出来（440 帧，1280×720 @30fps）
 *
 * 按原片量的：
 *   墙：浅灰，斜着几道窗户的光影
 *   文件（1020×532，中心 640, 366）：从左边外面斜 8° 滑进来，4–70 帧，先慢后快再慢，边走边摆正；
 *     之后慢慢放大到 1.037 倍（130 帧）；上面一行灰色小字说明
 *   136–190 帧文件越来越虚（到 12px）、往右滑出去，露出后面的人物（左边，本来就有点虚）
 *   金色数字（182–192 帧）：从很大、很虚压下来，同时从 0 数到目标数字；右边一行金色小字 184 帧淡进来
 *   纸片：346–360 帧五张一张张落成一排，366 帧第六张往右上飞出去
 * 只复刻画面，底部口播字幕不在模板里。
 */

export type DocPortraitCountProps = {
  wall: string;
  doc: string;
  caption: string;
  person: string;
  personBlur: number;
  count: number;
  label: string;
  cardTitle: string;
  cardSub: string;
  docOutAt: number;
  countAt: number;
  cardsAt: number;
  durationInFrames: number;
};

const SANS = '"Noto Sans CJK SC", "PingFang SC", "Source Han Sans SC", "Hiragino Sans GB", sans-serif';
const SERIF = '"Noto Serif CJK SC", "Songti SC", "STSong", "Source Han Serif SC", serif';
const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;

export const DOC = { w: 1020, h: 532, x: 640, y: 366 };
/** 文件进场（帧，绝对） */
const IN_T = [0, 4, 8, 12, 16, 28, 32, 36, 40, 44, 48, 52, 56, 60, 70, 80, 100, 130];
const IN_X = [-440, -440, -427, -413, -388, -214, -96, 62, 231, 365, 460, 526, 572, 602, 638, 640, 641, 641];
const IN_Y = [394, 394, 394, 394, 394, 390, 387, 383, 379, 376, 373, 371, 370, 369, 367, 366, 364, 363];
const IN_R = [-8, -8, -7.94, -8.03, -7.81, -6.49, -5.56, -4.36, -3.08, -2.05, -1.34, -0.84, -0.5, -0.27, 0, 0, 0, 0];
const IN_S = [1.005, 1.005, 1.005, 1.006, 1.005, 0.997, 0.993, 0.986, 0.98, 0.975, 0.973, 0.974, 0.975, 0.978, 0.987, 1, 1.02, 1.035];
/** 文件出场（相对 docOutAt，原片 142） */
const OUT_T = [0, 6, 12, 18, 24, 28, 30, 32, 34, 36, 38, 42, 46];
const OUT_X = [0, 9, 46, 125, 250, 395, 500, 620, 745, 852, 945, 1150, 1400];

/** 纸片（相对 cardsAt，原片 346） */
export const CARDS: PaperSlot[] = [
  { n: 5, x: 890, y: 470, rot: -26, at: 14 },
  { n: 4, x: 800, y: 470, rot: -18, at: 2 },
  { n: 3, x: 715, y: 470, rot: -16, at: 10 },
  { n: 2, x: 615, y: 478, rot: -14, at: 6 },
  { n: 1, x: 515, y: 490, rot: -12, at: 0 },
  { n: 6, x: 1010, y: 290, rot: 27, at: 20, from: [760, 470] },
];

const NUMBER = { left: 392, top: 40, size: 393, squeeze: 0.7 };
const LABEL = { left: 625, baseline: 338, size: 105, squeeze: 0.61 };

export function docPose(frame: number, docOutAt: number) {
  const out = interpolate(frame - docOutAt, OUT_T, OUT_X, clamp);
  return {
    x: interpolate(frame, IN_T, IN_X, clamp) + out,
    y: interpolate(frame, IN_T, IN_Y, clamp),
    rot: interpolate(frame, IN_T, IN_R, clamp),
    s: interpolate(frame, IN_T, IN_S, clamp),
    blur: interpolate(frame - docOutAt, [-6, 18], [0, 12], clamp),
  };
}

/** 从 0 数到目标：8 帧数完（先快后慢） */
export function countAt(frame: number, start: number, target: number): number {
  const u = Easing.out(Easing.quad)(interpolate(frame, [start, start + 8], [0, 1], clamp));
  return Math.round(target * u);
}

export const DocPortraitCount: React.FC<DocPortraitCountProps> = (p) => {
  const frame = useCurrentFrame();
  useBundledFont('bebas');
  const doc = docPose(frame, p.docOutAt);
  const personX = interpolate(frame, [180, 300, 440], [-20, 0, 30], clamp);
  const personS = interpolate(frame, [180, 300, 440], [1.04, 1, 0.96], clamp);
  const u = Easing.out(Easing.cubic)(interpolate(frame, [p.countAt, p.countAt + 10], [0, 1], clamp));
  const labelU = interpolate(frame, [p.countAt + 2, p.countAt + 10], [0, 1], clamp);
  const slots = CARDS.map((c) => ({ ...c, at: c.at + p.cardsAt }));
  return (
    <AbsoluteFill style={{ backgroundColor: '#d4d4d4', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', left: -60, top: -40, width: 1400, height: 800 }}>
        <Media src={p.wall} style={{ width: '100%', height: '100%' }} />
      </div>
      {/* 人物（在文件后面） */}
      {frame >= p.docOutAt - 20 && (
        <div style={{ position: 'absolute', inset: 0, transform: `translateX(${personX}px) scale(${personS})`, transformOrigin: '0 100%', filter: p.personBlur > 0 ? `blur(${p.personBlur}px)` : undefined }}>
          <Media src={p.person} style={{ width: '100%', height: '100%', objectFit: 'contain', objectPosition: 'left bottom' }} />
        </div>
      )}
      {/* 金色数字 + 小字 */}
      {frame >= p.countAt && (
        <>
          <GoldNumber text={String(countAt(frame, p.countAt, p.count))} u={u} />
          <div
            style={{
              position: 'absolute', left: LABEL.left, top: LABEL.baseline - LABEL.size * 0.95, height: LABEL.size * 1.2, lineHeight: `${LABEL.size * 1.2}px`, whiteSpace: 'pre',
              fontFamily: SERIF, fontWeight: 900, fontSize: LABEL.size, transform: `scaleX(${LABEL.squeeze})`, transformOrigin: '0 50%', opacity: labelU,
              color: 'transparent', backgroundImage: 'linear-gradient(to bottom, #f9df93 10%, #e8a53a 80%)', WebkitBackgroundClip: 'text', backgroundClip: 'text',
              filter: 'drop-shadow(3px 4px 3px rgba(90,60,20,0.35))',
            }}
          >
            {p.label}
          </div>
        </>
      )}
      <PaperPile slots={slots} title={p.cardTitle} sub={p.cardSub} frame={frame} />
      {/* 文件（最上面） */}
      {doc.x - (DOC.w / 2) * doc.s < 1400 && (
        <div
          style={{
            position: 'absolute', left: doc.x - DOC.w / 2, top: doc.y - DOC.h / 2, width: DOC.w, height: DOC.h, transform: `rotate(${doc.rot}deg) scale(${doc.s})`,
            filter: doc.blur > 0.1 ? `blur(${doc.blur.toFixed(1)}px)` : undefined,
          }}
        >
          {p.caption && (
            <div style={{ position: 'absolute', left: 0, top: -64, height: 40, lineHeight: '40px', fontFamily: SANS, fontSize: 28, color: '#4a4a4a', whiteSpace: 'pre' }}>{`；${p.caption}`}</div>
          )}
          <div style={{ position: 'absolute', inset: 0, boxShadow: '0 18px 36px rgba(0,0,0,0.3)', backgroundColor: '#fff' }}>
            <Media src={p.doc} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          </div>
        </div>
      )}
      <AbsoluteFill style={{ background: vignetteGradient({ cx: 640, cy: 360, rx: 780, ry: 480, amount: 0.3, power: 2.4 }) }} />
    </AbsoluteFill>
  );
};

/** 金色大数字：压窄的粗体，金色渐变 + 下面一层深金色的厚度 + 投影；从很大、很虚压下来 */
const GoldNumber: React.FC<{ text: string; u: number }> = ({ text, u }) => {
  const s = 2 - u;
  const blur = 10 * (1 - u);
  const family = `"${BUNDLED_FONTS.bebas.family}", ${SANS}`;
  const w = measure(text, `${NUMBER.size}px ${family}`) * NUMBER.squeeze;
  const common: React.CSSProperties = {
    position: 'absolute', left: 0, top: 0, height: NUMBER.size, lineHeight: `${NUMBER.size}px`, whiteSpace: 'pre', fontFamily: family, fontSize: NUMBER.size,
    transform: `scaleX(${NUMBER.squeeze})`, transformOrigin: '0 50%',
  };
  return (
    <div
      style={{
        position: 'absolute', left: NUMBER.left, top: NUMBER.top, width: w, height: NUMBER.size, transform: `scale(${s})`, transformOrigin: '50% 60%',
        opacity: Math.min(1, u * 2.5), filter: `${blur > 0.1 ? `blur(${blur.toFixed(1)}px) ` : ''}drop-shadow(6px 10px 8px rgba(80,55,20,0.35))`,
      }}
    >
      <div style={{ ...common, left: 4, top: 5, color: '#c68a34' }}>{text}</div>
      <div style={{ ...common, color: 'transparent', backgroundImage: 'linear-gradient(to bottom, #fbe9ad 12%, #f3cb6b 50%, #e89b35 88%)', WebkitBackgroundClip: 'text', backgroundClip: 'text' }}>{text}</div>
    </div>
  );
};
