import React from 'react';
import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from 'remotion';
import { bundledUrl } from '../asset';
import { Media } from '../media';
import { vignetteGradient } from '../lens';

/**
 * 复刻：两个镜头的照片拼贴 —— 近景横移 → 切全景（推近的状态慢慢拉远、对焦），墙上一个灰色大字，
 * 两张「调查中」的牛皮纸标签钉上去，红线从图钉拉出画面（270 帧，1280×720 @30fps）
 *
 * ── 镜头一（0–65）────────────────────────────────────────────────────
 *   近景图（宽 1500）从右往左滑进来：第 0 帧偏左 182px，先快后慢，第 44 帧过头 11px 停一下，
 *   然后往回走，第 65 帧到 −29（原片是三层视差，模板里按窗户那层的动作整张走）
 *
 * ── 镜头二（66–）─────────────────────────────────────────────────────
 *   全景图一开始放大 1.27 倍、虚着（高斯 7.5px，14 帧对上焦），然后越来越慢地拉远，
 *   第 200 帧回到 1 倍，最后停在 0.98 倍
 *   大字「跳槽.」：粗黑体斜 8°、压窄，灰色网点质感，印在墙上（画面坐标 x 785–1105、y 115–295）
 *   标签（牛皮纸 205×110，微微歪）：右边那张第 104 帧、左边那张第 114 帧，都是从虚到实淡进来（8 帧）
 *   红线：从图钉往外拉出画面，跟在标签后面 8 帧开始画（12 帧画完）
 * 只复刻画面，底部口播字幕不在模板里。
 */

export type OfficeTag = { text: string; sub: string; at: number };

export type OfficeTagsProps = {
  close: string;
  wide: string;
  cutAt: number;
  title: string;
  titleColor: string;
  tags: OfficeTag[];
  tagColor: string;
  vignette: boolean;
  durationInFrames: number;
};

const SANS = '"Noto Sans CJK SC", "PingFang SC", "Source Han Sans SC", "Hiragino Sans GB", sans-serif';
const SERIF = '"Noto Serif CJK SC", "Songti SC", "STSong", "Source Han Serif SC", serif';
const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;

/** 镜头一：整张图的横向偏移（实测窗户那层） */
const PAN_T = [0, 4, 9, 19, 29, 39, 44, 49, 54, 59, 63, 65];
const PAN_X = [-182.3, -116.7, -76.6, -28.2, -1.6, 10.3, 11.3, 8.6, 3.2, -6.8, -19.8, -29.1];
/** 镜头二：相对切镜头那一帧（原片第 66 帧）的缩放、平移（实测） */
const CAM_T = [0, 1, 3, 5, 8, 11, 15, 19, 23, 28, 33, 43, 53, 63, 83, 103, 123, 134, 153, 173, 193, 203];
const CAM_S = [1.2676, 1.2538, 1.2508, 1.2422, 1.2271, 1.2143, 1.199, 1.1842, 1.1711, 1.1553, 1.1415, 1.1163, 1.0956, 1.0766, 1.0467, 1.0238, 1.0075, 1, 0.9909, 0.9847, 0.9818, 0.9815];
const CAM_X = [-176.2, -168.5, -162.4, -156.8, -146.7, -137.6, -127.2, -117.9, -109.6, -99.4, -91.1, -75.4, -62.5, -50.7, -31.7, -16.4, -5, 0, 5.6, 8.4, 8, 7.1];
const CAM_Y = [-96.6, -93, -94.6, -89.6, -84.5, -80.3, -74.8, -69.1, -64.1, -58.3, -52.8, -43.5, -36, -29.3, -19.1, -11.1, -4.1, 0, 6.7, 13.4, 18.2, 19.2];

/** 两张标签、图钉、红线（全景坐标 = 镜头二停在 1 倍时的画面坐标） */
export const TAGS = [
  { x: 655, y: 313, rot: 1, pin: [760, 313], strings: [[-40, 393], [770, -40]] },
  { x: 873, y: 311, rot: -1.5, pin: [975, 314], strings: [[1330, 222], [856, 780]] },
] as const;
const TAG = { w: 205, h: 110 };
export const TITLE = { left: 776, baseline: 292, size: 206, squeeze: 0.74 };

export function wideCamera(t: number) {
  return { s: interpolate(t, CAM_T, CAM_S, clamp), x: interpolate(t, CAM_T, CAM_X, clamp), y: interpolate(t, CAM_T, CAM_Y, clamp) };
}

export const OfficeTags: React.FC<OfficeTagsProps> = (p) => {
  const frame = useCurrentFrame();
  if (frame < p.cutAt) {
    const x = interpolate(frame * (65 / Math.max(1, p.cutAt - 1)), PAN_T, PAN_X, clamp);
    return (
      <AbsoluteFill style={{ backgroundColor: '#cfcfcf', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', left: -30 + x, top: 0, width: 1500, height: 720 }}>
          <Media src={p.close} style={{ width: '100%', height: '100%' }} />
        </div>
        {p.vignette && <AbsoluteFill style={{ background: VIGNETTE }} />}
      </AbsoluteFill>
    );
  }

  const t = frame - p.cutAt;
  const cam = wideCamera(t);
  // 切过来先虚着（高斯 7.5px），14 帧对上焦
  const focus = 7.5 * Math.pow(Math.max(0, 1 - t / 14), 0.8);
  return (
    <AbsoluteFill style={{ backgroundColor: '#cfcfcf', overflow: 'hidden' }}>
      <AbsoluteFill style={{ filter: focus > 0.05 ? `blur(${focus.toFixed(2)}px)` : undefined }}>
        <div style={{ position: 'absolute', left: 0, top: 0, width: 1280, height: 720, transformOrigin: '0 0', transform: `translate(${cam.x}px, ${cam.y}px) scale(${cam.s})` }}>
          <div style={{ position: 'absolute', left: -30, top: -20, width: 1340, height: 760 }}>
            <Media src={p.wide} style={{ width: '100%', height: '100%' }} />
          </div>
          {p.title && <Title text={p.title} color={p.titleColor} />}
          {p.tags.slice(0, 2).map((tag, i) => (
            <Strings key={i} slot={TAGS[i]!} progress={Easing.out(Easing.cubic)(interpolate(frame, [tag.at + 8, tag.at + 20], [0, 1], clamp))} />
          ))}
          {p.tags.slice(0, 2).map((tag, i) => (
            <Tag key={i} tag={tag} slot={TAGS[i]!} color={p.tagColor} appear={interpolate(frame, [tag.at, tag.at + 8], [0, 1], clamp)} />
          ))}
        </div>
      </AbsoluteFill>
      {p.vignette && <AbsoluteFill style={{ background: VIGNETTE }} />}
    </AbsoluteFill>
  );
};

const VIGNETTE = vignetteGradient({ cx: 640, cy: 330, rx: 760, ry: 470, amount: 0.42, power: 2.6 });

/** 灰色大字：粗黑体、斜一点、压得很窄，斑驳的印刷质感，印在墙上 */
const Title: React.FC<{ text: string; color: string }> = ({ text, color }) => {
  const grain = `url(${bundledUrl('office-tags/grain.png')})`;
  return (
    <div
      style={{
        position: 'absolute', left: TITLE.left, top: TITLE.baseline - TITLE.size * 1.02, height: TITLE.size * 1.2, lineHeight: `${TITLE.size * 1.2}px`,
        fontFamily: SANS, fontWeight: 900, fontSize: TITLE.size, color, whiteSpace: 'pre', letterSpacing: -6,
        transform: `skewX(-8deg) scaleX(${TITLE.squeeze})`, transformOrigin: '0 100%', mixBlendMode: 'multiply', opacity: 0.72,
        WebkitMaskImage: grain, maskImage: grain, WebkitMaskSize: '128px 128px', maskSize: '128px 128px',
      }}
    >
      {text}
    </div>
  );
};

/** 牛皮纸标签 + 图钉；从虚到实淡进来 */
const Tag: React.FC<{ tag: OfficeTag; slot: (typeof TAGS)[number]; color: string; appear: number }> = ({ tag, slot, color, appear }) => {
  if (appear <= 0) return null;
  const blur = 8 * (1 - appear);
  return (
    <div style={{ position: 'absolute', left: 0, top: 0, opacity: appear, filter: blur > 0.05 ? `blur(${blur.toFixed(2)}px)` : undefined }}>
      <div
        style={{
          position: 'absolute', left: slot.x, top: slot.y, width: TAG.w, height: TAG.h, transform: `rotate(${slot.rot}deg)`,
          background: 'radial-gradient(ellipse 70% 70% at 50% 45%, #efc48a 0%, #e6b476 60%, #d49a58 100%)',
          boxShadow: 'inset 0 0 0 2px rgba(150,95,40,0.35), 0 10px 14px rgba(0,0,0,0.3)',
        }}
      >
        <div style={{ position: 'absolute', left: 0, right: 0, top: 18, textAlign: 'center', fontFamily: SERIF, fontWeight: 900, fontSize: 49, lineHeight: '56px', color, letterSpacing: 1 }}>{tag.text}</div>
        {tag.sub && (
          <div style={{ position: 'absolute', left: 0, right: 0, top: 76, textAlign: 'center', fontFamily: SERIF, fontStyle: 'italic', fontSize: 10.5, color: 'rgba(90,55,25,0.75)' }}>{tag.sub}</div>
        )}
      </div>
      {/* 图钉 */}
      <div
        style={{
          position: 'absolute', left: slot.pin[0] - 10, top: slot.pin[1] - 10, width: 20, height: 20, borderRadius: 10,
          background: 'radial-gradient(circle at 35% 35%, #ff6a6a, #c0101c 55%, #7a0810 100%)', boxShadow: '1px 3px 4px rgba(0,0,0,0.4)',
        }}
      />
    </div>
  );
};

/** 红线：从图钉往外画出画面 */
const Strings: React.FC<{ slot: (typeof TAGS)[number]; progress: number }> = ({ slot, progress }) => {
  if (progress <= 0) return null;
  return (
    <svg style={{ position: 'absolute', left: -200, top: -200, overflow: 'visible' }} width={1700} height={1200} viewBox="-200 -200 1700 1200">
      {slot.strings.map((end, i) => {
        const x = slot.pin[0] + (end[0] - slot.pin[0]) * progress;
        const y = slot.pin[1] + (end[1] - slot.pin[1]) * progress;
        return <line key={i} x1={slot.pin[0]} y1={slot.pin[1]} x2={x} y2={y} stroke="#c9232d" strokeWidth={2.4} strokeLinecap="round" opacity={0.9} />;
      })}
    </svg>
  );
};
