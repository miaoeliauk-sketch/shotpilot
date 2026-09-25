import React from 'react';
import { AbsoluteFill, Img, interpolate, useCurrentFrame } from 'remotion';
import { assetUrl } from '../asset';
import { BUNDLED_FONTS, useBundledFont } from '../fonts';
import { Media } from '../media';
import { measure } from '../text-layout';
import { PaperPile, type PaperSlot } from '../paper-cards/PaperCards';
import { vignetteGradient } from '../lens';

/**
 * 复刻：人物照片 + 挡脸的 logo 方块，标题从方块后面滑出来，一叠纸片从手里飞出来（279 帧，1280×720 @30fps）
 *
 * 按原片量的（世界坐标 = 镜头 1 倍时的画面坐标，镜头以 (643, 371) 为中心缩放）：
 *   镜头：第 0 帧 1.21 倍、偏右 36，40 帧 1 倍；之后慢慢拉远到 160 帧 0.93 倍，再推回来，279 帧 1.03 倍
 *   logo 方块 (50–402, 150–500)，白底圆角，挡住人脸
 *   标题「从业30年」：压窄的粗黑体，数字是金色；从方块后面往右滑出来（0–50 帧，先快后慢），
 *   40–70 帧外面一个细线框画出来，左上、右下各一个深灰小方块
 *   右边「老牌律师」小字、「送上被告」大字、下面一行灰色手写英文，0–24 帧一个字一个字从虚到实
 *   纸片：92–108 帧五张从手里一张张飞出来叠在一起，116 帧第六张往右飞出去
 *   「送上被告」后面一个深灰色圆，170–186 帧淡进来
 * 只复刻画面，底部口播字幕不在模板里。
 */

export type LogoTitleCardsProps = {
  background: string;
  logo: string;
  title: string;
  gold: string;
  tag: string;
  headline: string;
  signature: string;
  cardTitle: string;
  cardSub: string;
  cardsAt: number;
  discAt: number;
  durationInFrames: number;
};

const SANS = '"Noto Sans CJK SC", "PingFang SC", "Source Han Sans SC", "Hiragino Sans GB", sans-serif';
const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;
const PIVOT = [643, 371] as const;

const CAM_T = [0, 6, 12, 15, 20, 25, 30, 40, 50, 60, 80, 100, 130, 160, 200, 250, 278];
const CAM_S = [1.207, 1.197, 1.166, 1.139, 1.094, 1.052, 1.025, 1.012, 1.011, 1.004, 0.992, 0.975, 0.941, 0.93, 0.983, 1, 1.029];
const CAM_DX = [36, 36, 34, 32, 26, 17, 8, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
/** 标题从方块后面滑出来（世界坐标的横向偏移） */
const SLIDE_T = [0, 6, 9, 12, 15, 20, 25, 30, 40, 50];
const SLIDE_X = [-160, -125, -100, -79, -63, -50, -41, -32, -11, 0];

export const LOGO = { x: 50, y: 150, w: 352, h: 350 };
export const TITLE = { left: 440, baseline: 279, size: 175, squeeze: 0.47, weight: 700, box: [420, 125, 808, 320] as const };
const TAG = { left: 815, baseline: 225, size: 70, squeeze: 0.745 };
const HEAD = { left: 860, baseline: 416, size: 195, squeeze: 0.49 };
const DISC = { x: 1060, y: 430, r: 195 };

/** 纸片（相对 cardsAt，原片 92） */
export const CARDS: PaperSlot[] = [
  { n: 3, x: 510, y: 425, rot: 162, at: 0, from: [600, 640] },
  { n: 5, x: 770, y: 400, rot: 25, at: 3, from: [620, 620] },
  { n: 4, x: 760, y: 500, rot: 18, at: 6, from: [620, 640] },
  { n: 2, x: 655, y: 460, rot: -8, at: 9, from: [600, 650] },
  { n: 1, x: 598, y: 540, rot: -10, at: 12, from: [590, 680] },
  { n: 6, x: 960, y: 525, rot: -28, at: 22, from: [640, 560] },
];

export function camera(frame: number) {
  return { s: interpolate(frame, CAM_T, CAM_S, clamp), dx: interpolate(frame, CAM_T, CAM_DX, clamp) };
}

export const LogoTitleCards: React.FC<LogoTitleCardsProps> = (p) => {
  const frame = useCurrentFrame();
  useBundledFont('vibes');
  const cam = camera(frame);
  const slide = interpolate(frame, SLIDE_T, SLIDE_X, clamp);
  const boxU = interpolate(frame, [40, 70], [0, 1], clamp);
  const discU = interpolate(frame, [p.discAt, p.discAt + 16], [0, 1], clamp);
  const slots = CARDS.map((c) => ({ ...c, at: c.at + p.cardsAt }));
  const [bx0, by0, bx1, by1] = TITLE.box;
  const titleFont = `${TITLE.weight} ${TITLE.size}px ${SANS}`;
  // 标题从淡到实（0–35 帧）
  const titleU = interpolate(frame, [0, 35], [0.15, 1], clamp);
  const before = p.gold && p.title.includes(p.gold) ? p.title.slice(0, p.title.indexOf(p.gold)) : p.title;
  const after = p.gold && p.title.includes(p.gold) ? p.title.slice(p.title.indexOf(p.gold) + p.gold.length) : '';
  const goldPart = p.gold && p.title.includes(p.gold) ? p.gold : '';
  const titleW = measure(p.title, titleFont) * TITLE.squeeze;
  return (
    <AbsoluteFill style={{ backgroundColor: '#cfc49a', overflow: 'hidden' }}>
      <div
        style={{
          position: 'absolute', left: 0, top: 0, width: 1280, height: 720, transformOrigin: `${PIVOT[0]}px ${PIVOT[1]}px`,
          transform: `translateX(${cam.dx}px) scale(${cam.s})`,
        }}
      >
        <div style={{ position: 'absolute', left: -60, top: -40, width: 1400, height: 800 }}>
          <Media src={p.background} style={{ width: '100%', height: '100%' }} />
        </div>
        {/* 深灰圆 */}
        {discU > 0 && (
          <div
            style={{
              position: 'absolute', left: DISC.x - DISC.r, top: DISC.y - DISC.r, width: DISC.r * 2, height: DISC.r * 2, borderRadius: '50%', opacity: discU,
              transform: `scale(${0.85 + 0.15 * discU})`, background: 'radial-gradient(circle at 45% 40%, rgba(80,76,58,0.85), rgba(60,57,42,0.92) 70%, rgba(40,38,28,0.95))',
              filter: 'blur(1px)',
            }}
          />
        )}
        {/* 标题：从 logo 方块后面滑出来 */}
        <div style={{ position: 'absolute', left: TITLE.left + slide, top: TITLE.baseline - TITLE.size * 0.95, height: TITLE.size * 1.2, lineHeight: `${TITLE.size * 1.2}px`, whiteSpace: 'pre', fontFamily: SANS, fontWeight: TITLE.weight, fontSize: TITLE.size, color: '#15150f', transform: `scaleX(${TITLE.squeeze})`, transformOrigin: '0 50%', opacity: titleU, filter: titleU < 1 ? `blur(${(3 * (1 - titleU)).toFixed(1)}px)` : undefined }}>
          {before}
          {goldPart && (
            <span style={{ color: 'transparent', backgroundImage: 'linear-gradient(to bottom, #f6e3a8 5%, #d9a93c 45%, #b17a1c 70%, #f0d58a 95%)', WebkitBackgroundClip: 'text', backgroundClip: 'text' }}>{goldPart}</span>
          )}
          {after}
        </div>
        {/* 细线框 + 两个小方块 */}
        {boxU > 0 && (
          <svg style={{ position: 'absolute', left: 0, top: 0, overflow: 'visible' }} width={1280} height={720}>
            <rect x={bx0} y={by0} width={Math.max(titleW + 20, bx1 - bx0)} height={by1 - by0} fill="none" stroke="rgba(30,30,25,0.8)" strokeWidth={1.6} pathLength={1} strokeDasharray={`${boxU} 1`} />
            <rect x={bx0 - 23} y={by0 - 25} width={22} height={22} fill="#5a5850" opacity={Math.min(1, boxU * 3)} />
            <rect x={bx1 - 13} y={by1 - 12} width={22} height={22} fill="#5a5850" opacity={Math.min(1, boxU * 3)} />
          </svg>
        )}
        {/* logo 方块（盖在标题上面） */}
        <div
          style={{
            position: 'absolute', left: LOGO.x, top: LOGO.y, width: LOGO.w, height: LOGO.h, borderRadius: 14, overflow: 'hidden',
            background: 'linear-gradient(135deg, #f4f4f2, #dcdcda)', boxShadow: '0 16px 26px rgba(40,30,10,0.35)',
          }}
        >
          {p.logo && <Img src={assetUrl(p.logo)} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />}
        </div>
        {/* 右边的字 */}
        <Chars text={p.tag} left={TAG.left} baseline={TAG.baseline} size={TAG.size} weight={500} squeeze={TAG.squeeze} frame={frame} start={0} />
        <Chars text={p.headline} left={HEAD.left} baseline={HEAD.baseline} size={HEAD.size} weight={700} squeeze={HEAD.squeeze} frame={frame} start={2} />
        {p.signature && (
          <div
            style={{
              position: 'absolute', left: 1000, top: 405, fontFamily: `"${BUNDLED_FONTS.vibes.family}", cursive`, fontSize: 40, color: 'rgba(60,55,40,0.6)', whiteSpace: 'pre',
              transform: 'rotate(-4deg)', opacity: interpolate(frame, [12, 26], [0, 1], clamp),
            }}
          >
            {p.signature}
          </div>
        )}
        <PaperPile slots={slots} title={p.cardTitle} sub={p.cardSub} frame={frame} />
      </div>
      <AbsoluteFill style={{ background: vignetteGradient({ cx: 640, cy: 330, rx: 760, ry: 470, amount: 0.3, power: 2.4 }) }} />
    </AbsoluteFill>
  );
};

/** 一个字一个字从虚到实 */
const Chars: React.FC<{ text: string; left: number; baseline: number; size: number; weight: number; squeeze: number; frame: number; start: number }> = ({ text, left, baseline, size, weight, squeeze, frame, start }) => {
  const font = `${weight} ${size}px ${SANS}`;
  let x = left;
  return (
    <>
      {Array.from(text).map((ch, i) => {
        const l = x;
        x += measure(ch, font) * squeeze;
        const u = interpolate(frame, [start + i * 4, start + i * 4 + 12], [0, 1], clamp);
        if (u <= 0) return null;
        return (
          <div
            key={i}
            style={{
              position: 'absolute', left: l, top: baseline - size * 0.95, height: size * 1.2, lineHeight: `${size * 1.2}px`, fontFamily: SANS, fontWeight: weight, fontSize: size,
              color: '#161612', whiteSpace: 'pre', transform: `scaleX(${squeeze})`, transformOrigin: '0 50%', opacity: u, filter: u < 1 ? `blur(${(6 * (1 - u)).toFixed(1)}px)` : undefined,
            }}
          >
            {ch}
          </div>
        );
      })}
    </>
  );
};
