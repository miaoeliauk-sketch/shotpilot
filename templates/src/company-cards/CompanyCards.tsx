import React, { useMemo } from 'react';
import { AbsoluteFill, Easing, interpolate, random, useCurrentFrame } from 'remotion';
import { inkBox } from '../big-number/BigNumber';
import { BUNDLED_FONTS, useBundledFont } from '../fonts';
import { Media } from '../media';
import { CARD, PersonCard, type PersonCardData } from '../person-card/PersonCard';

/**
 * 复刻：公司名大字 → 横甩 → 人物卡片（296 帧，1280×720 @30fps）
 *
 * ── 公司名（第 100 帧量的，镜头 1 倍）────────────────────────────────
 *   大字「Masimo」 方正无衬线（软件自带 Barlow），x 232–1062，大写字母高 180
 *   左上小字「*麦斯莫医疗」 34px，x 425 起；下面「美国医疗技术公司」 62px 细体，居中，y 460–525
 *   蓝色手写签名压在右上，斜 −8°，从左往右写出来
 *   字母随机顺序从很虚里浮出来（0–24 帧）
 *   镜头：0.5 → 0.62 倍（0–36 帧），第 37 帧直接跳到 0.93 倍，之后一直慢慢推到 1.03 倍
 *
 * ── 横甩（110–132 帧）──────────────────────────────────────────────
 *   整个画面往左甩，越甩越快，带横向动态模糊；人物卡片从右边跟着甩进来
 *
 * ── 人物卡片 ─────────────────────────────────────────────────────────
 *   第一张落在 (386, 369)：离终点的距离每 5.8 帧减半；第二张 206 帧出现在 (895, 369) 右边一点，滑到位
 *   两张一起上下浮动（周期 128 帧、幅度 9.5px）；最后 28 帧镜头加速推近
 *
 * 只复刻画面，底部口播字幕不在模板里。
 */

export type CompanyCardsProps = {
  background: string;
  company: string;
  nameAbove: string;
  nameBelow: string;
  signature: string;
  signatureColor: string;
  cards: PersonCardData[];
  whipAt: number;
  card2At: number;
  pushAt: number;
  durationInFrames: number;
};

const SANS = '"PingFang SC", "Noto Sans CJK SC", "Source Han Sans SC", sans-serif';
const TITLE_FONT = `"${BUNDLED_FONTS.barlow.family}", "DIN Alternate", "Avenir Next", "Helvetica Neue", sans-serif`;
const SIGN_FONT = `"${BUNDLED_FONTS.vibes.family}", "Snell Roundhand", cursive`;

const TITLE = { left: 232, width: 830, capTop: 215, capHeight: 180 };
const CAM_T = [0, 20, 36];
const CAM_S = [0.5, 0.55, 0.62];
const JUMP = { at: 37, from: 0.93, perFrame: 0.0011 };
const CAM_CENTER = { x: 640, y: 357 };
/** 横甩：往左的位移（相对开始甩），越来越快 */
const WHIP_T = [0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22];
const WHIP_D = [0, 2, 7, 17, 33, 56, 90, 138, 207, 309, 520, 1280];
const CARD_POS = [{ x: 372, y: 369.5 }, { x: 895, y: 369.5 }];

const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;

/**
 * 一行字（line-height = lineBox）里基线离行框顶部多远。
 * 不能用字的墨迹高度算：行框按字体的 ascent/descent 居中，和墨迹没关系。
 */
function baselineInLineBox(font: string, lineBox: number): number {
  if (typeof document === 'undefined') return lineBox * 0.8;
  const ctx = document.createElement('canvas').getContext('2d');
  if (!ctx) return lineBox * 0.8;
  ctx.font = font;
  const m = ctx.measureText('M');
  const asc = m.fontBoundingBoxAscent;
  const desc = m.fontBoundingBoxDescent;
  return (lineBox - (asc + desc)) / 2 + asc;
}

function titleScale(frame: number): number {
  if (frame < JUMP.at) return interpolate(frame, CAM_T, CAM_S, clamp);
  return JUMP.from + (frame - JUMP.at) * JUMP.perFrame;
}

export const CompanyCards: React.FC<CompanyCardsProps> = (p) => {
  const frame = useCurrentFrame();
  const barlow = useBundledFont('barlow');
  const vibes = useBundledFont('vibes');
  const whip = interpolate(frame - p.whipAt, WHIP_T, WHIP_D, clamp);
  const speed = Math.abs(interpolate(frame - p.whipAt + 1, WHIP_T, WHIP_D, clamp) - whip);
  const blurX = Math.min(40, speed * 0.25);

  const fit = useMemo(() => {
    const b = inkBox(p.company || ' ', `500 200px ${TITLE_FONT}`);
    const sy = TITLE.capHeight / Math.max(1, b.ascent);
    const sx = TITLE.width / Math.max(1, b.left + b.right);
    return { sx, sy, b, baseline: baselineInLineBox(`500 200px ${TITLE_FONT}`, 200) };
  }, [p.company, barlow]);

  const s = titleScale(frame);
  const titleCam = `translate(${CAM_CENTER.x - whip}px, ${CAM_CENTER.y}px) scale(${s}) translate(${-CAM_CENTER.x}px, ${-CAM_CENTER.y}px)`;

  return (
    <AbsoluteFill style={{ backgroundColor: '#e6e6e6', overflow: 'hidden' }}>
      <svg width={0} height={0} style={{ position: 'absolute' }}>
        <filter id="cc-mblur" x="-20%" y="0" width="140%" height="100%"><feGaussianBlur stdDeviation={`${blurX.toFixed(1)} 0`} /></filter>
      </svg>
      <AbsoluteFill style={{ filter: blurX > 0.3 ? 'url(#cc-mblur)' : undefined }}>
        {/* 公司名这一段 */}
        {whip < 1280 && (
          <AbsoluteFill style={{ transformOrigin: '0 0', transform: titleCam }}>
            <div style={{ position: 'absolute', left: -700, top: -400, width: 2680, height: 1520 }}>
              <Media src={p.background} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />
            </div>
            <TitleBlock p={p} frame={frame} fit={fit} vibes={vibes} />
          </AbsoluteFill>
        )}
        {/* 人物卡片这一段：跟在公司名右边甩进来 */}
        {frame >= p.whipAt && <CardsScene p={p} frame={frame} bgOffset={Math.max(0, 1280 - whip)} />}
      </AbsoluteFill>
      <AbsoluteFill style={{ background: 'radial-gradient(ellipse 72% 78% at 50% 48%, rgba(0,0,0,0) 55%, rgba(0,0,0,0.18) 85%, rgba(0,0,0,0.38) 100%)' }} />
    </AbsoluteFill>
  );
};

const TitleBlock: React.FC<{ p: CompanyCardsProps; frame: number; fit: { sx: number; sy: number; b: ReturnType<typeof inkBox>; baseline: number }; vibes: boolean }> = ({ p, frame, fit }) => {
  const letters = Array.from(p.company);
  const sub = interpolate(frame, [10, 22], [0, 1], clamp);
  const sign = Easing.inOut(Easing.quad)(interpolate(frame, [6, 30], [0, 1], clamp));
  return (
    <>
      {/* 大字：每个字母随机时间从虚里浮出来 */}
      <div
        style={{
          // 墨迹左边 = 原点 − actualBoundingBoxLeft；大写字母顶 = 基线 − ascent
          position: 'absolute', left: TITLE.left + fit.b.left * fit.sx, top: TITLE.capTop + fit.b.ascent * fit.sy - fit.baseline * fit.sy, whiteSpace: 'pre',
          fontFamily: TITLE_FONT, fontWeight: 500, fontSize: 200, lineHeight: 1, color: '#161616',
          transform: `scale(${fit.sx}, ${fit.sy})`, transformOrigin: '0 0', display: 'flex',
        }}
      >
        <span style={{ visibility: 'hidden', position: 'absolute' }}>.</span>
        {letters.map((ch, i) => {
          const start = random(`co-${i}`) * 18;
          const q = interpolate(frame, [start, start + 4], [0, 1], clamp);
          const blur = 30 * (1 - Easing.out(Easing.quad)(interpolate(frame, [start, start + 14], [0, 1], clamp)));
          return <span key={i} style={{ opacity: q, filter: blur > 0.1 ? `blur(${(blur / fit.sx).toFixed(2)}px)` : undefined }}>{ch}</span>;
        })}
      </div>
      {p.nameAbove && (
        <div style={{ position: 'absolute', left: 418, top: 184, fontFamily: SANS, fontSize: 40, color: '#2a2a2a', whiteSpace: 'pre', opacity: sub, filter: sub < 1 ? `blur(${(8 * (1 - sub)).toFixed(2)}px)` : undefined }}>
          {p.nameAbove}
        </div>
      )}
      {p.nameBelow && (
        <div style={{ position: 'absolute', left: 0, width: 1284, top: 456, height: 72, display: 'flex', justifyContent: 'center', alignItems: 'center', fontFamily: SANS, fontWeight: 300, fontSize: 72, letterSpacing: 2, color: '#2c2c2c', whiteSpace: 'pre', opacity: sub, filter: sub < 1 ? `blur(${(10 * (1 - sub)).toFixed(2)}px)` : undefined }}>
          {p.nameBelow}
        </div>
      )}
      {p.signature && sign > 0 && (
        <div
          style={{
            position: 'absolute', left: 770, top: 255, fontFamily: SIGN_FONT, fontSize: 92, lineHeight: 1.1, color: p.signatureColor, whiteSpace: 'pre',
            transform: 'rotate(-8deg) scaleX(1.25)', transformOrigin: '0 50%', clipPath: `inset(-20% ${(1 - sign) * 100}% -20% -5%)`, opacity: 0.75,
          }}
        >
          {p.signature}
        </div>
      )}
    </>
  );
};

const CardsScene: React.FC<{ p: CompanyCardsProps; frame: number; bgOffset: number }> = ({ p, frame, bgOffset }) => {
  const landAt = p.whipAt + 22;
  const bob = 9.5 * Math.cos((2 * Math.PI * (frame - (p.whipAt + 50))) / 128);
  const push = interpolate(frame, [p.pushAt, p.durationInFrames], [0, 1], clamp);
  const zoom = 1 + 0.2 * Easing.in(Easing.cubic)(push);
  return (
    <AbsoluteFill style={{ transform: `scale(${zoom})`, transformOrigin: '640px 374px' }}>
      {/* 背景跟着横甩从右边进来（镜像一下，免得和前面一模一样） */}
      <div style={{ position: 'absolute', inset: 0, transform: `translateX(${bgOffset}px)` }}>
        <Media src={p.background} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', transform: 'scaleX(-1)' }} />
      </div>
      {p.cards.slice(0, 2).map((c, i) => {
        const at = i === 0 ? p.whipAt + 18 : p.card2At;
        if (frame < at) return null;
        const t = frame - at;
        const target = CARD_POS[i]!;
        // 第一张：甩进来时离终点 731px，每 5.8 帧减半；第二张：从右边 60px 处滑进来，每 12 帧减半
        const dx = i === 0 ? 731 * 2 ** (-(frame - landAt + 2) / 5.8) : 60 * 2 ** (-t / 12);
        const q = i === 0 ? 1 : interpolate(t, [0, 4], [0, 1], clamp);
        return (
          <div key={i} style={{ position: 'absolute', left: target.x + dx - CARD.width / 2, top: target.y + bob - CARD.height / 2, width: CARD.width, height: CARD.height, opacity: q }}>
            <PersonCard card={c} t={t} seed={`card${i}`} />
          </div>
        );
      })}
    </AbsoluteFill>
  );
};
