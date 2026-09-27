import React from 'react';
import { AbsoluteFill, Img, interpolate, useCurrentFrame } from 'remotion';
import { assetUrl } from '../asset';
import { FabricOverlay } from '../fabric';
import { BUNDLED_FONTS, useBundledFont } from '../fonts';
import { vignetteGradient } from '../lens';
import { measure } from '../text-layout';
import { BRAIN_GROUP, BRAIN_SPIN, CAM, DOT_Y } from './camera';

/**
 * 复刻：灰纸上一个大脑一边转正一边推近，左上一行粗斜体英文、右下一个斜体大字打出来，后面一根弧线穿过；
 * 两条深色对话标签飞进来、字一个个打出来，标签上垂下两根线汇到下面一个黑球；镜头顺着黑球一路往下甩，
 * 下面挂着的数据卡片一张张「显影」出来，最后拉远看到两组四张卡片（427 帧，1280×720 @30fps）。
 *
 * 按原片量的：
 *   镜头逐帧跟踪出来的（camera.ts）；世界坐标 = 原片最后一帧的画面。大脑那一段按第 56 帧的画面摆，整体缩到 0.449、转 −3.2° 放进世界
 *   大脑段（第 56 帧坐标）：两个淡灰方块 (426,181)–(640,418)、(640,296)–(852,532)；大脑 340×270，中心 (637,362)，
 *     第 0–56 帧自己从 70° 转正；第 22→23 帧镜头一下推近
 *     「KIMIK3」Oswald 粗体斜 12°、横向 0.9、84px，中心 x 414、字底 288；第 15 帧起一个字母一个字母滑进来
 *     「幻觉率」宋体特粗斜 14°、74px，中心 x 888、字底 501；第 28 帧起一个字一个字出来
 *     弧线第 58–68 帧从左往右画出来；对话标签第 88 / 116 帧飞进来，之后每 1.6 帧打一个字；第 146–152 帧两根线垂到黑球
 *   卡片段：黑球 (637,5)；卡片深色 #1d1d1b、2.5px 金 / 蓝描边、转 ±10°，先是一块半透明的浅灰「毛玻璃」，再变深、字浮出来
 *     小卡：K3 第 164 帧、K2.6 第 196 帧；大卡：K2.6 第 270 帧、K3 第 310 帧；第 260–290 帧镜头拉远
 * 只复刻画面，底部口播字幕不在模板里。
 */

export type StatCard = { name: string; sub: string; value: string; up: boolean; gold: boolean };
export type StatGroup = { label: string; labelSub: string; cards: [StatCard, StatCard] };

export type BrainStatCardsProps = {
  image: string;
  title: string;
  word: string;
  question: string;
  answer: string;
  groups: [StatGroup, StatGroup];
  /** 画面细布纹：'' = 合成的，'none' = 不要，其它 = 纹理图 */
  texture: string;
  durationInFrames: number;
};

const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;
const SANS = '"Noto Sans CJK SC", "Source Han Sans SC", "PingFang SC", "Microsoft YaHei", sans-serif';
const SERIF = '"Noto Serif CJK SC", "Source Han Serif SC", "Songti SC", "STSong", serif';

const lerpTrack = (frame: number, t: readonly number[], v: readonly number[]) => interpolate(frame, t as number[], v as number[], clamp);

/** 镜头：世界 → 画面 */
export function camera(frame: number): { s: number; r: number; x: number; y: number } {
  return { s: lerpTrack(frame, CAM.t, CAM.s), r: lerpTrack(frame, CAM.t, CAM.r), x: lerpTrack(frame, CAM.t, CAM.x), y: lerpTrack(frame, CAM.t, CAM.y) };
}

/** 大脑自己转了几度 */
export function brainSpin(frame: number): number {
  return lerpTrack(frame, BRAIN_SPIN.t, BRAIN_SPIN.r);
}

/** 大脑段的布局（第 56 帧画面坐标） */
export const BRAIN = {
  squares: [
    { x0: 426, y0: 181, x1: 640, y1: 418, alpha: 0.1 },
    { x0: 640, y0: 296, x1: 852, y1: 532, alpha: 0.13 },
  ],
  image: { cx: 637, cy: 362, w: 340, h: 270 },
  title: { cx: 414, base: 288, size: 84, skew: 12, sx: 0.78, spacing: -0.02, at: 15, gap: 4 },
  word: { cx: 888, base: 501, size: 74, skew: 14, sx: 0.95, spacing: -0.03, at: 28, gap: 5 },
  wire: { points: [[-60, 196], [-18, 214], [240, 323], [481, 387], [647, 380], [867, 331], [1274, 159], [1330, 132]], at: 58, dur: 10 },
  tags: [
    { cx: 265, cy: 607, w: 496, h: 84, r: 7.6, size: 42, from: [-160, 90], at: 88, bullet: [-12, 562] },
    { cx: 1035, cy: 675, w: 560, h: 110, r: -14.8, size: 58, from: [170, 90], at: 116, bullet: [731, 768] },
  ],
  typeGap: 1.6,
  strings: { at: 146, dur: 6 },
} as const;

/** 卡片段的布局（世界坐标） */
/** 黑球：钉在画面上（x 636），y 按 DOT_Y 走 */
export const DOT = { x: 636, r: 27 };
export function dotY(frame: number): number {
  return lerpTrack(frame, DOT_Y.t, DOT_Y.y);
}

/** 世界坐标 → 画面 */
export function worldToScreen(cam: { s: number; r: number; x: number; y: number }, x: number, y: number): [number, number] {
  const a = (cam.r * Math.PI) / 180;
  return [cam.x + cam.s * (x * Math.cos(a) - y * Math.sin(a)), cam.y + cam.s * (x * Math.sin(a) + y * Math.cos(a))];
}
export const LAYOUT = [
  {
    label: { cx: 327, cy: 237, w: 127, h: 48, r: -0.4, size: 27, at: 164 },
    cards: [
      { cx: 241, cy: 357, w: 160, h: 185, r: -9.4, at: 196, num: 0.3 },
      { cx: 395, cy: 353, w: 213, h: 220, r: 9.9, at: 164, num: 0.28 },
    ],
  },
  {
    label: { cx: 856, cy: 176, w: 212, h: 77, r: 1.2, size: 44, at: 270 },
    cards: [
      { cx: 709, cy: 368, w: 240, h: 298, r: -9.7, at: 270, num: 0.34 },
      { cx: 984, cy: 366, w: 319, h: 375, r: 10, at: 310, num: 0.34 },
    ],
  },
] as const;

/** 卡片显影：0–1 毛玻璃出现，1–2 变深、字浮出来（按帧） */
export function cardPhase(frame: number, at: number): { glass: number; solid: number; content: number; settle: number } {
  const t = frame - at;
  return {
    glass: interpolate(t, [0, 4, 10, 14], [0, 0.75, 0.75, 0], clamp),
    solid: interpolate(t, [6, 14], [0, 1], clamp),
    content: interpolate(t, [8, 18], [0, 1], clamp),
    settle: 1 - Math.pow(1 - interpolate(t, [0, 20], [0, 1], clamp), 3),
  };
}

/** 第 i 个字出来的进度（打字：每个字 3 帧浮出来） */
export function charIn(frame: number, at: number, gap: number, i: number): number {
  return interpolate(frame - at - i * gap, [0, 3], [0, 1], clamp);
}

export const BrainStatCards: React.FC<BrainStatCardsProps> = (p) => {
  const frame = useCurrentFrame();
  const fonts = [useBundledFont('oswald'), useBundledFont('poppinsBold'), useBundledFont('playfair'), useBundledFont('playfairItalic')];
  const ready = fonts.every(Boolean);
  const cam = camera(frame);
  const G = BRAIN_GROUP;
  return (
    <AbsoluteFill style={{ backgroundColor: '#efefed', overflow: 'hidden' }}>
      <div
        style={{
          position: 'absolute', left: 0, top: 0, width: 1280, height: 720, transformOrigin: '0 0',
          transform: `translate(${cam.x.toFixed(2)}px, ${cam.y.toFixed(2)}px) rotate(${cam.r.toFixed(3)}deg) scale(${cam.s.toFixed(5)})`,
        }}
      >
        {frame < 175 && (
          <div style={{ position: 'absolute', left: 0, top: 0, width: 1280, height: 720, transformOrigin: '0 0', transform: `translate(${G.x}px, ${G.y}px) rotate(${G.r}deg) scale(${G.s})` }}>
            {ready && <BrainScene {...p} frame={frame} />}
          </div>
        )}
        {ready && <CardScene {...p} frame={frame} />}
      </div>
      <Pendulum frame={frame} cam={cam} />
      <AbsoluteFill style={{ background: vignetteGradient({ cx: 640, cy: 360, rx: 760, ry: 520, amount: 0.57, power: 2.34 }) }} />
      {p.texture !== 'none' && <FabricOverlay src={p.texture} />}
    </AbsoluteFill>
  );
};

/** 两根线从对话标签左边的小方块垂到黑球；黑球钉在画面上 */
const Pendulum: React.FC<{ frame: number; cam: { s: number; r: number; x: number; y: number } }> = ({ frame, cam }) => {
  const B = BRAIN;
  const su = interpolate(frame, [B.strings.at, B.strings.at + B.strings.dur], [0, 1], clamp);
  const fade = interpolate(frame, [176, 184], [1, 0], clamp);
  const dy = dotY(frame);
  if (frame < B.strings.at) return null;
  return (
    <svg width={1280} height={720} style={{ position: 'absolute', left: 0, top: 0, overflow: 'visible' }}>
      {B.tags.map((t, i) => {
        const [wx, wy] = brainToWorld(t.bullet[0], t.bullet[1]);
        const [x1, y1] = worldToScreen(cam, wx, wy);
        return fade > 0 && <line key={i} x1={x1} y1={y1} x2={x1 + (DOT.x - x1) * su} y2={y1 + (dy - y1) * su} stroke="#3a3a3a" strokeWidth={1.6} opacity={fade} />;
      })}
      <circle cx={DOT.x} cy={dy} r={DOT.r} fill="#101010" />
    </svg>
  );
};

/** 用世界坐标把大脑段的一个点（第 56 帧坐标）换到卡片段 */
export function brainToWorld(x: number, y: number): [number, number] {
  const G = BRAIN_GROUP;
  const a = (G.r * Math.PI) / 180;
  return [G.x + G.s * (x * Math.cos(a) - y * Math.sin(a)), G.y + G.s * (x * Math.sin(a) + y * Math.cos(a))];
}

const BrainScene: React.FC<BrainStatCardsProps & { frame: number }> = ({ image, title, word, question, answer, frame }) => {
  const B = BRAIN;
  const I = B.image;
  const wireLen = 1600;
  const wireU = interpolate(frame, [B.wire.at, B.wire.at + B.wire.dur], [0, 1], clamp);
  const pts = B.wire.points;
  const path = `M ${pts[0]![0]} ${pts[0]![1]} ` + pts.slice(1).map(([x, y], i) => {
    // Catmull-Rom 转贝塞尔，线过每个点
    const p0 = pts[Math.max(0, i - 1)]!; const p1 = pts[i]!; const p2 = [x, y]; const p3 = pts[Math.min(pts.length - 1, i + 2)]!;
    const c1 = [p1[0] + (p2[0]! - p0[0]) / 6, p1[1] + (p2[1]! - p0[1]) / 6];
    const c2 = [p2[0]! - (p3[0] - p1[0]) / 6, p2[1]! - (p3[1] - p1[1]) / 6];
    return `C ${c1[0]!.toFixed(1)} ${c1[1]!.toFixed(1)} ${c2[0]!.toFixed(1)} ${c2[1]!.toFixed(1)} ${x} ${y}`;
  }).join(' ');
  return (
    <>
      {B.squares.map((q, i) => (
        <div key={i} style={{ position: 'absolute', left: q.x0, top: q.y0, width: q.x1 - q.x0, height: q.y1 - q.y0, background: `rgba(40,40,40,${q.alpha})` }} />
      ))}
      <svg width={1280} height={720} style={{ position: 'absolute', left: 0, top: 0, overflow: 'visible' }}>
        {wireU > 0 && <path d={path} fill="none" stroke="#2c2c2c" strokeWidth={3.2} strokeDasharray={wireLen} strokeDashoffset={wireLen * (1 - wireU)} />}
      </svg>
      {image && (
        <Img
          src={assetUrl(image)}
          style={{
            position: 'absolute', left: I.cx - I.w / 2, top: I.cy - I.h / 2, width: I.w, height: I.h, objectFit: 'contain',
            transform: `rotate(${brainSpin(frame).toFixed(2)}deg)`, filter: 'drop-shadow(-4px 12px 10px rgba(0,0,0,0.35))',
          }}
        />
      )}
      <SlantedWord text={title} spec={B.title} family={`"${BUNDLED_FONTS.oswald.family}", sans-serif`} weight={700} frame={frame} />
      <SlantedWord text={word} spec={B.word} family={SERIF} weight={900} frame={frame} />
      {B.tags.map((t, i) => <Tag key={i} text={i === 0 ? question : answer} spec={t} frame={frame} />)}
    </>
  );
};

/** 世界坐标 → 大脑段坐标 */
export function worldToBrain(x: number, y: number): [number, number] {
  const G = BRAIN_GROUP;
  const a = (-G.r * Math.PI) / 180;
  const dx = (x - G.x) / G.s;
  const dy = (y - G.y) / G.s;
  return [dx * Math.cos(a) - dy * Math.sin(a), dx * Math.sin(a) + dy * Math.cos(a)];
}

const SlantedWord: React.FC<{ text: string; spec: { cx: number; base: number; size: number; skew: number; sx: number; spacing: number; at: number; gap: number }; family: string; weight: number; frame: number }> = ({ text, spec, family, weight, frame }) => {
  const chars = Array.from(text);
  const font = `${weight} ${spec.size}px ${family}`;
  const adv = chars.map((ch) => (measure(ch, font) + spec.spacing * spec.size) * spec.sx);
  const width = adv.reduce((a, b) => a + b, 0);
  let x = spec.cx - width / 2;
  const tan = Math.tan((spec.skew * Math.PI) / 180);
  return (
    <svg width={1280} height={720} style={{ position: 'absolute', left: 0, top: 0, overflow: 'visible' }}>
      {chars.map((ch, i) => {
        const x0 = x; x += adv[i]!;
        const u = charIn(frame, spec.at, spec.gap, i);
        if (u <= 0) return null;
        // 每个字从右边滑过来，先灰后黑
        const dx = 26 * (1 - u);
        const grey = Math.round(150 * (1 - u) + 18 * u);
        return (
          <text
            key={i} x={0} y={0} transform={`matrix(${spec.sx},0,${-tan},1,${(x0 + dx + tan * 0.35 * spec.size).toFixed(2)},${spec.base})`}
            fontFamily={family} fontWeight={weight} fontSize={spec.size} fill={`rgb(${grey},${grey},${grey})`} fillOpacity={Math.min(1, u * 1.6)}
          >
            {ch}
          </text>
        );
      })}
    </svg>
  );
};

const Tag: React.FC<{ text: string; spec: (typeof BRAIN.tags)[number]; frame: number }> = ({ text, spec, frame }) => {
  const t = frame - spec.at;
  if (!text || t < 0) return null;
  const u = 1 - Math.pow(1 - interpolate(t, [0, 10], [0, 1], clamp), 3);
  const blur = 6 * (1 - u);
  const chars = Array.from(text);
  const shown = chars.filter((_, i) => charIn(frame, spec.at + 9, BRAIN.typeGap, i) > 0).length;
  const bx = spec.bullet[0] - spec.cx;
  const by = spec.bullet[1] - spec.cy;
  return (
    <div
      style={{
        position: 'absolute', left: spec.cx, top: spec.cy, width: 0, height: 0, opacity: u,
        transform: `translate(${(spec.from[0] * (1 - u)).toFixed(1)}px, ${(spec.from[1] * (1 - u)).toFixed(1)}px)`,
        filter: blur > 0.3 ? `blur(${blur.toFixed(1)}px)` : undefined,
      }}
    >
      {/* 左边的小方块 */}
      <div style={{ position: 'absolute', left: bx - 14, top: by - 14, width: 28, height: 28, borderRadius: 5, background: '#262626', transform: `rotate(${spec.r + 20}deg)`, boxShadow: '2px 4px 6px rgba(0,0,0,0.3)' }} />
      <div
        style={{
          position: 'absolute', left: -spec.w / 2 + 34, top: -spec.h / 2, width: spec.w - 34, height: spec.h, transform: `rotate(${spec.r}deg)`, transformOrigin: `${spec.w / 2 - 34}px ${spec.h / 2}px`,
          background: 'linear-gradient(to bottom, #3a3a39, #232322)', borderRadius: 6, boxShadow: '3px 8px 14px rgba(0,0,0,0.35)',
          display: 'flex', alignItems: 'center', paddingLeft: spec.size * 0.5, boxSizing: 'border-box', overflow: 'hidden',
        }}
      >
        <span style={{ fontFamily: SANS, fontSize: spec.size, color: '#f2f2f2', whiteSpace: 'pre', lineHeight: 1 }}>
          {chars.map((ch, i) => {
            const c = charIn(frame, spec.at + 9, BRAIN.typeGap, i);
            return <span key={i} style={{ opacity: c, display: 'inline-block', transform: `translateY(${(8 * (1 - c)).toFixed(1)}px)` }}>{i < shown ? ch : ch}</span>;
          })}
        </span>
      </div>
    </div>
  );
};

const CardScene: React.FC<BrainStatCardsProps & { frame: number }> = ({ groups, frame }) => {
  return (
    <>
      {LAYOUT.map((L, gi) => {
        const g = groups[gi];
        if (!g) return null;
        return (
          <React.Fragment key={gi}>
            {L.cards.map((c, ci) => <Card key={ci} card={g.cards[ci]!} spec={c} frame={frame} big={gi === 1} />)}
            <Label text={g.label} sub={g.labelSub} spec={L.label} frame={frame} />
          </React.Fragment>
        );
      })}
    </>
  );
};

const Label: React.FC<{ text: string; sub: string; spec: (typeof LAYOUT)[number]['label']; frame: number }> = ({ text, sub, spec, frame }) => {
  const ph = cardPhase(frame, spec.at);
  if (!text || ph.glass + ph.solid <= 0) return null;
  return (
    <div
      style={{
        position: 'absolute', left: spec.cx - spec.w / 2, top: spec.cy - spec.h / 2, width: spec.w, height: spec.h, transform: `rotate(${spec.r}deg) translateY(${(-20 * (1 - ph.settle)).toFixed(1)}px)`,
        background: ph.solid > 0 ? `rgba(22,22,21,${ph.solid})` : undefined, boxShadow: `4px 8px 12px rgba(0,0,0,${(0.35 * ph.solid).toFixed(2)})`,
        outline: ph.glass > 0 ? `${spec.h}px solid rgba(200,200,198,${(ph.glass * 0.5).toFixed(2)})` : undefined, outlineOffset: -spec.h,
      }}
    >
      <div style={{ position: 'absolute', left: 0, right: 0, top: spec.h * 0.1, textAlign: 'center', fontFamily: SERIF, fontWeight: 700, fontSize: spec.size, color: '#f4f4f2', opacity: ph.content, lineHeight: 1.1 }}>{text}</div>
      {sub && <div style={{ position: 'absolute', right: spec.w * 0.12, bottom: spec.h * 0.06, fontFamily: `"${BUNDLED_FONTS.playfair.family}", serif`, fontSize: spec.size * 0.3, color: '#8c8c88', opacity: ph.content }}>{sub}</div>}
      <div style={{ position: 'absolute', left: 8, top: 8, width: spec.size * 0.35, height: spec.size * 0.35, background: '#3c3c3a', opacity: ph.content }} />
    </div>
  );
};

const Diamond: React.FC<{ x: number; y: number; size: number; color: string; opacity?: number }> = ({ x, y, size, color, opacity = 1 }) => (
  <div style={{ position: 'absolute', left: x - size / 2, top: y - size / 2, width: size, height: size, background: color, transform: 'rotate(45deg)', opacity }} />
);

const Card: React.FC<{ card: StatCard; spec: (typeof LAYOUT)[number]['cards'][number]; frame: number; big: boolean }> = ({ card, spec, frame }) => {
  const ph = cardPhase(frame, spec.at);
  if (ph.glass + ph.solid <= 0) return null;
  const w = spec.w;
  const h = spec.h;
  const gold = card.gold;
  const ink = gold ? '#ecdcb2' : '#c7cdf2';
  const edge = gold ? '#b89a62' : '#6d7db9';
  const accent = gold ? '#d8b36a' : '#3aa7de';
  const sc = 1 + 0.12 * (1 - ph.settle);
  const numFont = `"${BUNDLED_FONTS.poppinsBold.family}", sans-serif`;
  const numSize = w * spec.num;
  const pctSize = w * spec.num * 0.6;
  const numW = measure(card.value, `700 ${numSize}px ${numFont}`);
  const pctW = measure('%', `700 ${pctSize}px ${numFont}`);
  const vx = w / 2 - (numW + pctW) / 2;
  return (
    <div
      style={{
        position: 'absolute', left: spec.cx - w / 2, top: spec.cy - h / 2, width: w, height: h,
        transform: `translate(${(30 * (1 - ph.settle)).toFixed(1)}px, ${(40 * (1 - ph.settle)).toFixed(1)}px) rotate(${(spec.r + 12 * (1 - ph.settle)).toFixed(2)}deg) scale(${sc.toFixed(3)})`,
      }}
    >
      {ph.glass > 0 && <div style={{ position: 'absolute', inset: 0, background: `rgba(205,205,203,${ph.glass})`, filter: 'blur(3px)', boxShadow: '6px 12px 18px rgba(0,0,0,0.18)' }} />}
      {ph.solid > 0 && (
        <div
          style={{
            position: 'absolute', inset: 0, opacity: ph.solid, borderRadius: 5, boxSizing: 'border-box', border: `2.5px solid ${edge}`,
            background: 'linear-gradient(160deg, #262624, #1b1b19 60%, #171715)', boxShadow: '8px 16px 20px rgba(0,0,0,0.38)', overflow: 'hidden',
          }}
        >
          <div style={{ position: 'absolute', inset: 0, opacity: ph.content }}>
            <Diamond x={w / 2} y={h * 0.1} size={w * 0.04} color={accent} />
            <div style={{ position: 'absolute', left: 0, right: 0, top: h * 0.2, textAlign: 'center', fontFamily: `"${BUNDLED_FONTS.playfair.family}", serif`, fontWeight: 500, fontSize: w * 0.145, color: ink, lineHeight: 1 }}>{card.name}</div>
            <div style={{ position: 'absolute', left: 0, right: 0, top: h * 0.35, textAlign: 'center', fontFamily: SANS, fontSize: w * 0.055, color: '#86867f', lineHeight: 1 }}>{card.sub}</div>
            <svg width={w} height={h} style={{ position: 'absolute', left: 0, top: 0, overflow: 'visible' }}>
              <text x={vx} y={h * 0.7} fontFamily={numFont} fontSize={numSize} fill={ink} letterSpacing="-0.02em">{card.value}</text>
              <text x={vx + numW} y={h * 0.7} fontFamily={numFont} fontSize={pctSize} fill={ink}>%</text>
              {/* 箭头：% 右上角 */}
              <g transform={`translate(${vx + numW + pctW * 0.55} ${h * 0.7 - pctSize * 1.25})`}>
                <polygon points={card.up ? `0,${-w * 0.035} ${w * 0.03},0 ${w * 0.01},0 ${w * 0.01},${w * 0.035} ${-w * 0.01},${w * 0.035} ${-w * 0.01},0 ${-w * 0.03},0` : `0,${w * 0.035} ${w * 0.03},0 ${w * 0.01},0 ${w * 0.01},${-w * 0.035} ${-w * 0.01},${-w * 0.035} ${-w * 0.01},0 ${-w * 0.03},0`} fill={accent} />
              </g>
              <text x={w * 0.1} y={h * 0.9} fontFamily={`"${BUNDLED_FONTS.playfairItalic.family}", serif`} fontSize={w * 0.1} fill="rgba(120,32,30,0.55)">illusion</text>
            </svg>
            {[[0.8, 0.8, 0.05], [0.88, 0.86, 0.03], [0.72, 0.9, 0.025], [0.9, 0.76, 0.02]].map(([x, y, s], i) => (
              <Diamond key={i} x={w * x!} y={h * y!} size={w * s!} color={accent} opacity={0.75} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
