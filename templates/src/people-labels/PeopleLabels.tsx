import React from 'react';
import { AbsoluteFill, Easing, Img, interpolate, useCurrentFrame } from 'remotion';
import { assetUrl } from '../asset';
import { Media } from '../media';
import { vignetteGradient } from '../lens';

/**
 * 复刻：灰墙上一张人物照片（脸上可以盖一块 logo 方块），身后两张灰卡片写着身份，四周金色词条一个个亮起来（140 帧，1280×720 @30fps）
 *
 * 按原片量的（世界坐标 = 第 108 帧、镜头 1 倍）：
 *   人物照片：框 (345–895, 180–600)，底边对齐，脚下一圈软影子；logo 方块 156 见方、白底圆角，默认在 (742, 271)
 *   灰卡片：大的 (302, 240) 254×192 深灰字 + 英文斜体小字；小的 (502, 135) 203×123 金色字
 *   金色词条：左 (145, 391)、右 (1102, 383)、上 (620, 44)；金色粗宋斜体 64px，左边一个淡金色的圆（r 64）
 *     一个个从虚到实亮起来（10 帧）：左 12、上 20、右 38 帧
 *   镜头（以画面中心）：开头从左下推过来 1.175 → 0.961（36 帧，先快后慢），之后慢慢推近到 1.0
 * 只复刻画面，底部口播字幕不在模板里。
 */

export type IdCard = { title: string; sub: string; gold: boolean };
export type GoldLabel = { text: string; slot: 'left' | 'right' | 'top'; at: number };

export type PeopleLabelsProps = {
  background: string;
  people: string;
  logo: string;
  logoX: number;
  logoY: number;
  cards: IdCard[];
  labels: GoldLabel[];
  vignette: boolean;
  durationInFrames: number;
};

const SERIF = '"Noto Serif CJK SC", "Songti SC", "STSong", "Source Han Serif SC", serif';
const LATIN = '"Georgia", "Times New Roman", serif';
const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;

export const PEOPLE = { x0: 345, y0: 180, x1: 895, y1: 600 };
export const CARD_SLOTS = [
  { x: 302, y: 240, w: 254, h: 192 },
  { x: 502, y: 135, w: 203, h: 123 },
];
export const LABEL_SLOTS = { left: { x: 145, y: 391 }, right: { x: 1102, y: 383 }, top: { x: 620, y: 44 } } as const;
const LOGO = 156;

const CAM_T = [0, 6, 14, 22, 26, 31, 36, 46, 56, 76, 96, 108, 122, 140];
const CAM_S = [1.175, 1.175, 1.169, 1.043, 0.993, 0.971, 0.961, 0.9645, 0.9705, 0.9862, 0.997, 1, 1.0013, 1.004];
const CAM_X = [512, 512, 542, 609, 616, 631, 638, 640, 640, 640, 640, 640, 640, 640];
const CAM_Y = [412, 412, 399, 379, 371, 365, 362, 360, 360, 360, 360, 360, 360, 360];

export function camera(frame: number) {
  return { s: interpolate(frame, CAM_T, CAM_S, clamp), x: interpolate(frame, CAM_T, CAM_X, clamp), y: interpolate(frame, CAM_T, CAM_Y, clamp) };
}

/** 元素淡进来：从虚到实，10 帧 */
export function reveal(frame: number, at: number, dur = 10): number {
  return Easing.out(Easing.quad)(interpolate(frame, [at, at + dur], [0, 1], clamp));
}

export const PeopleLabels: React.FC<PeopleLabelsProps> = (p) => {
  const frame = useCurrentFrame();
  const cam = camera(frame);
  const peopleU = reveal(frame, 0, 8);
  return (
    <AbsoluteFill style={{ backgroundColor: '#a4a4a4', overflow: 'hidden' }}>
      <AbsoluteFill style={{ transformOrigin: '640px 360px', transform: `translate(${(cam.x - 640).toFixed(2)}px, ${(cam.y - 360).toFixed(2)}px) scale(${cam.s.toFixed(4)})` }}>
        <div style={{ position: 'absolute', left: -60, top: -34, width: 1400, height: 788 }}>
          <Media src={p.background} style={{ width: '100%', height: '100%' }} />
        </div>
        {/* 灰卡片（在人物后面） */}
        {p.cards.slice(0, 2).map((c, i) => (
          <Card key={i} card={c} slot={CARD_SLOTS[i]!} u={reveal(frame, i === 0 ? 2 : 0, 12)} />
        ))}
        {/* 人物 */}
        <div style={{ position: 'absolute', left: PEOPLE.x0, top: PEOPLE.y0, width: PEOPLE.x1 - PEOPLE.x0, height: PEOPLE.y1 - PEOPLE.y0, opacity: peopleU }}>
          <div
            style={{
              position: 'absolute', left: '-6%', right: '-6%', bottom: -14, height: 70, borderRadius: '50%',
              background: 'radial-gradient(ellipse at 50% 50%, rgba(20,20,20,0.75), rgba(20,20,20,0.35) 55%, rgba(20,20,20,0) 72%)',
            }}
          />
          {p.people && <Img src={assetUrl(p.people)} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'contain', objectPosition: '50% 100%' }} />}
        </div>
        {/* logo 方块 */}
        {p.logo && (
          <div
            style={{
              position: 'absolute', left: p.logoX - LOGO / 2, top: p.logoY - LOGO / 2, width: LOGO, height: LOGO, borderRadius: 8, background: '#fff', opacity: peopleU,
              boxShadow: '4px 6px 12px rgba(0,0,0,0.3)', overflow: 'hidden',
            }}
          >
            <Img src={assetUrl(p.logo)} style={{ position: 'absolute', inset: '10%', width: '80%', height: '80%', objectFit: 'contain' }} />
          </div>
        )}
        {/* 金色词条 */}
        {p.labels.map((l, i) => (
          <Gold key={i} label={l} u={reveal(frame, l.at)} />
        ))}
      </AbsoluteFill>
      {p.vignette && <AbsoluteFill style={{ background: vignetteGradient({ cx: 640, cy: 360, rx: 760, ry: 470, amount: 0.34, power: 2.4 }) }} />}
    </AbsoluteFill>
  );
};

const Card: React.FC<{ card: IdCard; slot: { x: number; y: number; w: number; h: number }; u: number }> = ({ card, slot, u }) => {
  if (u <= 0 || !card.title) return null;
  const big = slot.h > 150;
  const size = big ? 104 : 72;
  return (
    <div
      style={{
        position: 'absolute', left: slot.x, top: slot.y, width: slot.w, height: slot.h, opacity: u, background: 'linear-gradient(160deg, #8e8e8e, #7b7b7b)',
        boxShadow: '6px 8px 14px rgba(0,0,0,0.25)', filter: u < 0.98 ? `blur(${(6 * (1 - u)).toFixed(2)}px)` : undefined,
      }}
    >
      <div
        style={{
          position: 'absolute', left: big ? 26 : 34, top: big ? 14 : 18, whiteSpace: 'pre', fontFamily: SERIF, fontWeight: 900, fontSize: size, lineHeight: 1,
          transform: 'skewX(-8deg)',
          ...(card.gold
            ? { color: 'transparent', backgroundImage: 'linear-gradient(to bottom, #f5c338, #cc9b17 60%, #a87408)', WebkitBackgroundClip: 'text', backgroundClip: 'text' }
            : { color: '#3a3a3a' }),
        }}
      >
        {card.title}
      </div>
      {card.sub && (
        <div style={{ position: 'absolute', left: 18, bottom: big ? 24 : 10, whiteSpace: 'pre', fontFamily: LATIN, fontStyle: 'italic', fontWeight: 700, fontSize: big ? 30 : 20, color: '#4a4a4a' }}>
          {card.sub}
        </div>
      )}
    </div>
  );
};

const Gold: React.FC<{ label: GoldLabel; u: number }> = ({ label, u }) => {
  if (u <= 0 || !label.text) return null;
  const s = LABEL_SLOTS[label.slot];
  return (
    <div style={{ position: 'absolute', left: s.x, top: s.y, opacity: u, filter: u < 0.98 ? `blur(${(6 * (1 - u)).toFixed(2)}px)` : undefined }}>
      <div
        style={{
          position: 'absolute', left: -153, top: -64, width: 128, height: 128, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(236,190,70,0.55), rgba(236,190,70,0.38) 55%, rgba(236,190,70,0) 72%)',
        }}
      />
      <div
        style={{
          position: 'absolute', left: 0, top: 0, transform: `translate(-50%, -50%) skewX(-10deg) scale(${(0.8 * (0.9 + 0.1 * u)).toFixed(3)}, ${(0.9 + 0.1 * u).toFixed(3)})`, whiteSpace: 'pre', fontFamily: SERIF, fontWeight: 900,
          fontSize: 62, lineHeight: 1, color: 'transparent', backgroundImage: 'linear-gradient(to bottom, #f7c63c, #cc9b17 60%, #b07a0b)', WebkitBackgroundClip: 'text', backgroundClip: 'text',
          filter: 'drop-shadow(1px 2px 1px rgba(90,60,0,0.35))',
        }}
      >
        {label.text}
      </div>
    </div>
  );
};
