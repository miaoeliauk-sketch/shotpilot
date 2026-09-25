import React from 'react';
import { AbsoluteFill, Easing, Img, interpolate, random, useCurrentFrame } from 'remotion';
import { assetUrl, bundledUrl } from '../asset';
import { useBundledFont, BUNDLED_FONTS } from '../fonts';
import { TiltShift, vignetteGradient } from '../lens';
import { measure } from '../text-layout';

/**
 * 复刻：两块公司铭牌 + 人数 + 引语，墨刷转场到深色日期页（468 帧，1280×720 @30fps）
 *
 * 全片按原片的帧号写（「标准时间」），用户改的三个时间点（出人数、横甩、墨刷）把各段拉长缩短。
 *
 * ── 第一块铭牌（0–95）──────────────────────────────────────────────────
 *   浅灰水泥墙。镜头从上面往下摇：铭牌（白色台座 + 上面斜放的 logo 方块）从画面顶上下来，
 *   第 33 帧冲过头、弹回去，75 帧停稳；logo 方块在台座上跳一下（33–45 帧），
 *   名字一个字母一个字母掉下来（第 44 帧起每 4 帧一个，歪着落下）
 * ── 人数（96–150）─────────────────────────────────────────────────────
 *   镜头往右推 241px（96–112），右边一排排小人图标闪着出来（98–110），
 *   「40+」从很大、很虚飞进来（110–124），压窄的斜体粗字
 * ── 第二块铭牌 + 引语（150–372）─────────────────────────────────────
 *   镜头往右横甩 1320px（150–240，越来越慢），第二块铭牌名字打出来（178 起），
 *   logo 边上冒出三个生气的表情（208、216、228），
 *   一条红色曲线从右上往下扭着画出来（192–330），三行引语一个字一个字打出来，关键词特别大
 * ── 墨刷转场 + 日期页（372–）─────────────────────────────────────────
 *   十几道很陡的干笔刷（62°）先从中间、再往两边扫过去（372–388），刷到的地方露出深色的日期页；正文每个字在 380–390 帧之间随机冒出来。
 *   压窄斜体「2024年2月」+ 一条细线，两行白色粗宋正文，第 418 帧起在一个词下面画橙色的涂鸦线；右边一叠钱（虚的）
 * 只复刻画面，底部口播字幕不在模板里。
 */

export type QuoteLine = { before: string; key: string; after: string };

export type NameplateStoryProps = {
  wallLight: string;
  wallDark: string;
  logo1: string;
  name1: string;
  logo2: string;
  name2: string;
  count: string;
  quotes: QuoteLine[];
  date: string;
  body: string[];
  underline: string;
  decor: string;
  /** 三个时间点（帧）：出人数、横甩、墨刷 */
  countAt: number;
  whipAt: number;
  brushAt: number;
  durationInFrames: number;
};

const SANS = '"Noto Sans CJK SC", "PingFang SC", "Source Han Sans SC", "Hiragino Sans GB", sans-serif';
const SERIF = '"Noto Serif CJK SC", "Songti SC", "STSong", "Source Han Serif SC", serif';
const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;

/** 原片的三个时间点 */
export const CANON = { countAt: 96, whipAt: 150, brushAt: 372 };

/** 用户的时间 → 原片的标准时间（分段线性） */
export function canonTime(frame: number, p: Pick<NameplateStoryProps, 'countAt' | 'whipAt' | 'brushAt'>): number {
  const real = [0, p.countAt, p.whipAt, p.brushAt];
  const canon = [0, CANON.countAt, CANON.whipAt, CANON.brushAt];
  for (let i = real.length - 1; i >= 0; i--) {
    if (frame >= real[i]!) {
      const next = real[i + 1];
      if (next === undefined) return canon[i]! + (frame - real[i]!);
      return interpolate(frame, [real[i]!, next], [canon[i]!, canon[i + 1]!]);
    }
  }
  return frame;
}

/** 镜头（画面 = 世界坐标 + 偏移），世界坐标 = 原片第 150 帧的画面坐标 */
const CAM_T = [0, 8, 16, 22, 28, 33, 38, 45, 52, 60, 75, 95, 96, 104, 112, 150, 160, 164, 168, 172, 176, 180, 184, 190, 194, 200, 212, 218, 240, 315, 380];
const CAM_X = [274, 277, 279, 280, 280, 284, 284, 286, 286, 286, 275, 241, 241, 120, 0, 0, -56, -126, -256, -443, -644, -796, -912, -1058, -1109, -1179, -1260, -1281, -1298, -1320, -1328];
const CAM_Y = [-320, -310, -250, -190, -100, -25, -40, -85, -70, -25, -10, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
/** logo 方块在台座上跳一下 */
const TILE_T = [0, 28, 31, 34, 38, 42, 46, 50];
const TILE_Y = [0, 0, -25, -55, -72, -45, -4, 0];
const TILE_R = [3, 3, -3, -6, 6, 5, 3, 3];

/** 铭牌（世界坐标）：台座面 x 178–535、y 370–545；台面 160–545、320–365；logo 方块 250–475、85–310 */
export const PLATE = { lidX: 160, lidY: 320, lidW: 385, lidH: 45, faceX: 178, faceY: 370, faceW: 357, faceH: 175, tileX: 250, tileY: 85, tile: 225, nameY: 470, nameSize: 74 };
const PLATE2 = { dx: 1294, dy: 15 };
/** 小人图标：4 列 × 11 行 */
const GRID = { x0: 750, dx: 50, y0: 105, dy: 51, cols: 4, rows: 11, size: 44 };
const COUNT = { x: 925, top: 110, size: 500, squeeze: 0.37 };
/** 引语（世界坐标 = 原片第 341 帧画面坐标 + 1320） */
const QUOTES = [
  { x: 2023, baseline: 230, small: 37, big: 86, at: 190, end: 240 },
  { x: 1888, baseline: 370, small: 37, big: 100, at: 240, end: 300 },
  { x: 1948, baseline: 515, small: 37, big: 104, at: 264, end: 322 },
];
/** 关键词压窄：英文 0.85（窄体本来就窄）、中文 0.68 */
const KEY_SQUEEZE = { latin: 0.85, cjk: 0.68 };
const EMOJI = [
  { x: 1815, y: 305, at: 208 },
  { x: 1525, y: 240, at: 216 },
  { x: 1665, y: 85, at: 228 },
];
const SWOOSH = 'M 2400 -20 C 2250 90 1900 150 1975 215 C 2050 280 2470 280 2460 340 C 2450 400 1990 420 1960 480 C 1935 540 2010 640 2050 760';

export const NameplateStory: React.FC<NameplateStoryProps> = (p) => {
  const frame = useCurrentFrame();
  const t = canonTime(frame, p);
  useBundledFont('bebas');
  useBundledFont('oswald');
  const camX = interpolate(t, CAM_T, CAM_X, clamp);
  const camY = interpolate(t, CAM_T, CAM_Y, clamp);

  const light = (
    <AbsoluteFill style={{ backgroundColor: '#d6d6d6', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', left: 0, top: 0, transform: `translate(${camX}px, ${camY}px)` }}>
        {/* 墙：世界坐标 x −400 起，宽 2800 */}
        <Img src={assetUrl(p.wallLight)} style={{ position: 'absolute', left: -400, top: -420, width: 2800, height: 1500, objectFit: 'cover' }} />
        <Nameplate logo={p.logo1} name={p.name1} x={0} y={0} t={t} nameAt={44} bounce />
        <Grid t={t} />
        <Count text={p.count} t={t} />
        <Nameplate logo={p.logo2} name={p.name2} x={PLATE2.dx} y={PLATE2.dy} t={t} nameAt={178} />
        {EMOJI.map((e, i) => (
          <Emoji key={i} x={e.x} y={e.y} progress={interpolate(t, [e.at, e.at + 8], [0, 1], clamp)} />
        ))}
        <Swoosh progress={Easing.inOut(Easing.cubic)(interpolate(t, [192, 330], [0, 1], clamp))} />
        {p.quotes.slice(0, 3).map((q, i) => (
          <Quote key={i} q={q} slot={QUOTES[i]!} t={t} />
        ))}
      </div>
      <AbsoluteFill style={{ background: vignetteGradient({ cx: 640, cy: 330, rx: 760, ry: 480, amount: 0.45, power: 2.4 }) }} />
    </AbsoluteFill>
  );

  if (t < CANON.brushAt) return light;
  const reveal = interpolate(t, [CANON.brushAt, CANON.brushAt + 16], [0, 1], clamp);
  return (
    <AbsoluteFill>
      {reveal < 1 && light}
      <BrushReveal progress={reveal}>
        <DarkScene p={p} t={t} />
      </BrushReveal>
    </AbsoluteFill>
  );
};

/** 铭牌：台座 + 台面 + 斜放的 logo 方块 + 名字（字母一个个歪着掉下来） */
const Nameplate: React.FC<{ logo: string; name: string; x: number; y: number; t: number; nameAt: number; bounce?: boolean }> = ({ logo, name, x, y, t, nameAt, bounce }) => {
  const ty = bounce ? interpolate(t, TILE_T, TILE_Y, clamp) : 0;
  const rot = bounce ? interpolate(t, TILE_T, TILE_R, clamp) : 3;
  const letters = Array.from(name);
  const font = `700 ${PLATE.nameSize}px ${SERIF}`;
  const total = measure(name, font);
  let cursor = PLATE.faceX + PLATE.faceW / 2 - total / 2;
  return (
    <div style={{ position: 'absolute', left: x, top: y }}>
      {/* 投影 */}
      <div style={{ position: 'absolute', left: PLATE.faceX + 10, top: PLATE.faceY + 30, width: PLATE.faceW, height: PLATE.faceH, backgroundColor: 'rgba(0,0,0,0.35)', filter: 'blur(18px)' }} />
      {/* 台面 */}
      <div style={{ position: 'absolute', left: PLATE.lidX, top: PLATE.lidY, width: PLATE.lidW, height: PLATE.lidH, background: 'linear-gradient(to bottom, #f1f1f1 0%, #e4e4e4 55%, #9c9c9c 56%, #bdbdbd 100%)', boxShadow: '0 3px 6px rgba(0,0,0,0.25)' }} />
      {/* 台座面 */}
      <div
        style={{
          position: 'absolute', left: PLATE.faceX, top: PLATE.faceY, width: PLATE.faceW, height: PLATE.faceH, backgroundColor: '#f7f7f7',
          boxShadow: 'inset 0 0 0 3px #b9b9b9, inset 0 0 18px rgba(0,0,0,0.12), 0 6px 10px rgba(0,0,0,0.3)',
        }}
      />
      {letters.map((ch, i) => {
        const w = measure(ch, font);
        const left = cursor;
        cursor += w;
        const u = interpolate(t, [nameAt + i * 4, nameAt + i * 4 + 6], [0, 1], clamp);
        if (u <= 0) return null;
        const e = Easing.out(Easing.back(1.4))(u);
        return (
          <div
            key={i}
            style={{
              position: 'absolute', left, top: PLATE.nameY - PLATE.nameSize * 0.8 + (1 - e) * -40, fontFamily: SERIF, fontWeight: 700, fontSize: PLATE.nameSize,
              lineHeight: `${PLATE.nameSize}px`, color: '#1f1f1f', opacity: Math.min(1, u * 2), transform: `rotate(${(1 - e) * -25}deg)`, transformOrigin: '50% 100%',
            }}
          >
            {ch}
          </div>
        );
      })}
      {/* logo 方块 */}
      <div
        style={{
          position: 'absolute', left: PLATE.tileX, top: PLATE.tileY + ty, width: PLATE.tile, height: PLATE.tile, transform: `rotate(${rot}deg)`,
          backgroundColor: '#fbfbfb', borderRadius: 10, boxShadow: '0 12px 16px rgba(0,0,0,0.35), inset 0 0 0 2px #d0d0d0', overflow: 'hidden',
        }}
      >
        {logo && <Img src={assetUrl(logo)} style={{ position: 'absolute', left: 12, top: 12, width: PLATE.tile - 24, height: PLATE.tile - 24, objectFit: 'contain' }} />}
      </div>
    </div>
  );
};

/** 一排排小人图标，闪着出来 */
const Grid: React.FC<{ t: number }> = ({ t }) => {
  if (t < 98) return null;
  const cells = [];
  for (let r = 0; r < GRID.rows; r++) {
    for (let c = 0; c < GRID.cols; c++) {
      const k = r * GRID.cols + c;
      const on = interpolate(t, [98 + random(`g${k}`) * 8, 102 + random(`g${k}`) * 8], [0, 1], clamp);
      const flicker = t < 110 && random(`gf${k}-${Math.floor(t)}`) < 0.3 ? 0.3 : 1;
      cells.push(<Person key={k} x={GRID.x0 + c * GRID.dx} y={GRID.y0 + r * GRID.dy} opacity={on * flicker} />);
    }
  }
  return <>{cells}</>;
};

const Person: React.FC<{ x: number; y: number; opacity: number }> = ({ x, y, opacity }) => (
  <svg viewBox="0 0 40 40" width={GRID.size} height={GRID.size} style={{ position: 'absolute', left: x - GRID.size / 2, top: y - GRID.size / 2, opacity }}>
    <circle cx="16" cy="13" r="7" fill="#6e6e6e" />
    <path d="M4 32 Q4 21 16 21 Q28 21 28 32 Z" fill="#6e6e6e" />
    <path d="M29 9 A13 13 0 0 1 29 31" stroke="#6e6e6e" strokeWidth="3" fill="none" strokeLinecap="round" />
  </svg>
);

/** 「40+」：压窄斜体，从很大、很虚飞进来 */
const Count: React.FC<{ text: string; t: number }> = ({ text, t }) => {
  const u = Easing.out(Easing.cubic)(interpolate(t, [110, 124], [0, 1], clamp));
  if (t < 110) return null;
  const s = 2.2 - 1.2 * u;
  const blur = 8 * (1 - u);
  return (
    <div
      style={{
        position: 'absolute', left: COUNT.x, top: COUNT.top, height: COUNT.size, fontFamily: `"${BUNDLED_FONTS.bebas.family}", ${SANS}`, fontSize: COUNT.size, lineHeight: `${COUNT.size}px`,
        color: '#161616', whiteSpace: 'pre', opacity: Math.min(1, u * 1.6), filter: blur > 0.1 ? `blur(${blur.toFixed(1)}px)` : undefined,
        transform: `translateX(${(1 - u) * 180}px) scale(${s}) skewX(-10deg) scaleX(${COUNT.squeeze})`, transformOrigin: '0 50%',
        textShadow: '-14px 0 0 rgba(120,120,120,0.45)',
      }}
    >
      {text.replace(/\+$/, '')}
      {text.endsWith('+') && <span style={{ fontSize: COUNT.size * 0.36, verticalAlign: 'top', position: 'relative', top: COUNT.size * 0.05 }}>+</span>}
    </div>
  );
};

/** 生气的表情：灰色圆脸，弹出来 */
const Emoji: React.FC<{ x: number; y: number; progress: number }> = ({ x, y, progress }) => {
  if (progress <= 0) return null;
  const s = Easing.out(Easing.back(2))(progress);
  return (
    <svg viewBox="0 0 60 60" width={64} height={64} style={{ position: 'absolute', left: x - 32, top: y - 32, transform: `scale(${s})`, filter: 'drop-shadow(2px 4px 4px rgba(0,0,0,0.35))' }}>
      <circle cx="30" cy="30" r="28" fill="#7d7d7d" />
      <path d="M16 22 L26 26 M44 22 L34 26" stroke="#222" strokeWidth="3" strokeLinecap="round" />
      <circle cx="22" cy="30" r="2.6" fill="#222" />
      <circle cx="38" cy="30" r="2.6" fill="#222" />
      <path d="M21 44 Q30 37 39 44" stroke="#222" strokeWidth="3" fill="none" strokeLinecap="round" />
    </svg>
  );
};

/** 红色曲线：从右上往下扭着画出来 */
const Swoosh: React.FC<{ progress: number }> = ({ progress }) => {
  if (progress <= 0) return null;
  return (
    <svg style={{ position: 'absolute', left: 0, top: 0, overflow: 'visible' }} width={2800} height={900}>
      <path d={SWOOSH} pathLength={1} stroke="rgba(230,120,120,0.45)" strokeWidth={7} fill="none" strokeDasharray={`${progress} 1`} strokeLinecap="round" />
      <path d={SWOOSH} pathLength={1} stroke="#d12a2a" strokeWidth={2.6} fill="none" strokeDasharray={`${progress} 1`} strokeLinecap="round" />
    </svg>
  );
};

/** 一行引语：小字 + 特别大的关键词 + 小字，一个字一个字打出来，后面一个光标 */
const Quote: React.FC<{ q: QuoteLine; slot: (typeof QUOTES)[number]; t: number }> = ({ q, slot, t }) => {
  const parts = [
    { text: `“${q.before}`, big: false },
    { text: q.key, big: true },
    { text: `${q.after}”`, big: false },
  ];
  const all = parts.reduce((n, x) => n + Array.from(x.text).length, 0);
  const shown = Math.floor(interpolate(t, [slot.at, slot.end], [0, all], clamp));
  if (t < slot.at) return null;
  let left = slot.x;
  let remaining = shown;
  const out: React.ReactNode[] = [];
  parts.forEach((part, i) => {
    const chars = Array.from(part.text);
    const vis = chars.slice(0, Math.max(0, remaining)).join('');
    remaining -= chars.length;
    const isLatin = /^[\x00-\x7f]+$/.test(part.text);
    const family = part.big ? (isLatin ? `"${BUNDLED_FONTS.oswald.family}", ${SANS}` : SANS) : SANS;
    const size = part.big ? slot.big : slot.small;
    const squeeze = part.big ? (isLatin ? KEY_SQUEEZE.latin : KEY_SQUEEZE.cjk) : 1;
    const weight = part.big ? (isLatin ? 500 : 900) : 400;
    const fullW = measure(part.text, `${weight} ${size}px ${family}`) * squeeze;
    if (vis) {
      out.push(
        <div
          key={i}
          style={{
            position: 'absolute', left, top: slot.baseline - size * 0.9, height: size * 1.1, lineHeight: `${size * 1.1}px`, fontFamily: family, fontWeight: weight, fontSize: size,
            color: part.big ? '#171717' : '#2a2a2a', whiteSpace: 'pre', transform: `skewX(${part.big ? -10 : 0}deg) scaleX(${squeeze})`, transformOrigin: '0 100%',
          }}
        >
          {vis}
        </div>,
      );
    }
    left += fullW + (part.big ? 12 : 6);
  });
  // 光标：打字时跟在最后一个字后面闪
  const typing = t < slot.end + 12;
  const caretX = (() => {
    let x = slot.x;
    let rem = shown;
    for (const part of parts) {
      const chars = Array.from(part.text);
      const isLatin = /^[\x00-\x7f]+$/.test(part.text);
      const family = part.big ? (isLatin ? `"${BUNDLED_FONTS.oswald.family}", ${SANS}` : SANS) : SANS;
      const size = part.big ? (slot.big) : slot.small;
      const squeeze = part.big ? (isLatin ? KEY_SQUEEZE.latin : KEY_SQUEEZE.cjk) : 1;
      const weight = part.big ? (isLatin ? 500 : 900) : 400;
      const take = Math.max(0, Math.min(rem, chars.length));
      x += measure(chars.slice(0, take).join(''), `${weight} ${size}px ${family}`) * squeeze;
      if (rem <= chars.length) return x;
      x += part.big ? 12 : 6;
      rem -= chars.length;
    }
    return x;
  })();
  return (
    <>
      {out}
      {typing && Math.floor(t / 6) % 2 === 0 && <div style={{ position: 'absolute', left: caretX + 4, top: slot.baseline - 30, width: 2, height: 34, backgroundColor: '#333' }} />}
    </>
  );
};

/**
 * 墨刷：几道很陡的干笔刷（从左上往右下，约 62°）依次扫过去，刷到的地方露出下一页。
 * 做法：一个转了 62° 的大框，里面横着排几条笔刷遮罩，每条从一头长到另一头；框里再反着转回来放下一页。
 */
const BRUSH_ANGLE = 62;
const BrushReveal: React.FC<{ progress: number; children: React.ReactNode }> = ({ progress, children }) => {
  if (progress >= 1) return <AbsoluteFill>{children}</AbsoluteFill>;
  const url = `url(${bundledUrl('nameplate-story/ink-stroke.png')})`;
  const rows = 12;
  const images: string[] = [];
  const sizes: string[] = [];
  const positions: string[] = [];
  // 顺序：先中间两道，再往两边
  const order = [7, 9, 5, 8, 10, 4, 6, 11, 3, 2, 1, 0];
  for (let i = 0; i < rows; i++) {
    const k = order.indexOf(i);
    const u = Easing.inOut(Easing.quad)(interpolate(progress, [k * 0.05, k * 0.05 + 0.4], [0, 1], clamp));
    images.push(url);
    sizes.push(`${(u * 125).toFixed(1)}% ${((100 / rows) * 1.2).toFixed(1)}%`);
    positions.push(`${i % 2 ? 'right' : 'left'} ${((i / (rows - 1)) * 100).toFixed(1)}%`);
  }
  // 最后几帧整页补齐
  const fill = interpolate(progress, [0.75, 1], [0, 1], clamp);
  const mask: React.CSSProperties = {
    WebkitMaskImage: images.join(', '), maskImage: images.join(', '), WebkitMaskSize: sizes.join(', '), maskSize: sizes.join(', '),
    WebkitMaskPosition: positions.join(', '), maskPosition: positions.join(', '), WebkitMaskRepeat: 'no-repeat', maskRepeat: 'no-repeat',
  };
  const W = 1700;
  const H = 1700;
  return (
    <AbsoluteFill style={{ overflow: 'hidden' }}>
      <div style={{ position: 'absolute', left: 640 - W / 2, top: 360 - H / 2, width: W, height: H, transform: `rotate(${BRUSH_ANGLE}deg)`, ...mask }}>
        <div style={{ position: 'absolute', left: W / 2 - 640, top: H / 2 - 360, width: 1280, height: 720, transform: `rotate(${-BRUSH_ANGLE}deg)` }}>{children}</div>
      </div>
      {fill > 0 && <AbsoluteFill style={{ opacity: fill }}>{children}</AbsoluteFill>}
    </AbsoluteFill>
  );
};

/** 深色日期页 */
const DarkScene: React.FC<{ p: NameplateStoryProps; t: number }> = ({ p, t }) => {
  const u = interpolate(t, [418, 434], [0, 1], clamp);
  const bodyFont = `700 ${BODY.size}px ${SERIF}`;
  const line0 = p.body[0] ?? '';
  const idx = p.underline ? line0.indexOf(p.underline) : -1;
  const ulX0 = idx >= 0 ? BODY.left[0]! + measure(line0.slice(0, idx), bodyFont) + idx * BODY.spacing : 0;
  const ulW = idx >= 0 ? measure(p.underline, bodyFont) + p.underline.length * BODY.spacing : 0;
  const zoom = 1 + 0.0004 * Math.max(0, t - CANON.brushAt);
  const titleW = measure(p.date, `900 ${DATE.size}px ${SANS}`) * DATE.squeeze;
  const lineX = Math.max(455, DATE.left + titleW + 30);
  const page = (
    <AbsoluteFill style={{ transform: `scale(${zoom})` }}>
      <Img src={assetUrl(p.wallDark)} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
      {p.decor && <Img src={assetUrl(p.decor)} style={{ position: 'absolute', left: 870, top: 130, width: 420, height: 520, objectFit: 'contain', opacity: 0.9 }} />}
      {/* 日期：压窄斜体 + 红蓝错位 */}
      <div
        style={{
          position: 'absolute', left: DATE.left, top: DATE.center - DATE.size * 0.6, height: DATE.size * 1.2, lineHeight: `${DATE.size * 1.2}px`, fontFamily: SANS, fontWeight: 900,
          fontSize: DATE.size, color: '#f4f4f4', whiteSpace: 'pre', transform: `skewX(-10deg) scaleX(${DATE.squeeze})`, transformOrigin: '0 50%',
          textShadow: '-3px 0 0 rgba(230,60,60,0.55), 3px 0 0 rgba(60,170,230,0.55), 0 6px 12px rgba(0,0,0,0.5)',
        }}
      >
        {p.date}
      </div>
      <div style={{ position: 'absolute', left: lineX, top: 207, width: 1240 - lineX, height: 2, backgroundColor: 'rgba(200,200,200,0.75)' }} />
      {p.body.slice(0, 2).map((line, i) => {
        let x = BODY.left[i]!;
        return Array.from(line).map((ch, j) => {
          const left = x;
          x += measure(ch, bodyFont) + BODY.spacing;
          // 每个字在 383–393 帧之间随机冒出来，冒出来那两帧虚一点、偏一点
          const at = 380 + random(`body-${i}-${j}`) * 10;
          if (t < at) return null;
          const fresh = t < at + 2;
          return (
            <div
              key={`${i}-${j}`}
              style={{
                position: 'absolute', left: left + (fresh ? 6 : 0), top: BODY.center[i]! - 26, height: 52, lineHeight: '52px', fontFamily: SERIF, fontWeight: 700, fontSize: BODY.size,
                color: '#f2f2f2', whiteSpace: 'pre', opacity: fresh ? 0.6 : 1, filter: fresh ? 'blur(1.5px)' : undefined,
                textShadow: '-2px 0 0 rgba(230,60,60,0.35), 2px 0 0 rgba(60,170,230,0.35), 0 4px 10px rgba(0,0,0,0.6)',
              }}
            >
              {ch}
            </div>
          );
        });
      })}
      {/* 橙色涂鸦线 */}
      {idx >= 0 && u > 0 && (
        <svg style={{ position: 'absolute', left: ulX0 - 10, top: BODY.center[0]! + 16, overflow: 'visible' }} width={ulW + 40} height={24}>
          <path
            d={`M 0 8 Q ${ulW * 0.25} 2 ${ulW * 0.5} 9 T ${ulW + 20} 6 M 10 16 Q ${ulW * 0.4} 10 ${ulW * 0.7} 17 T ${ulW + 10} 14`}
            pathLength={1} stroke="#f08a24" strokeWidth={3.2} fill="none" strokeLinecap="round" strokeDasharray={`${u} 1`}
          />
        </svg>
      )}
    </AbsoluteFill>
  );
  return (
    <AbsoluteFill style={{ backgroundColor: '#3a3a3a', overflow: 'hidden' }}>
      {/* 景深：中间实、左右两边虚 */}
      <TiltShift cx={560} k={2.2e-8} power={3} far={6}>
        {page}
      </TiltShift>
      <AbsoluteFill style={{ background: vignetteGradient({ cx: 640, cy: 340, rx: 760, ry: 470, amount: 0.5, power: 2.2 }) }} />
    </AbsoluteFill>
  );
};

const DATE = { left: 50, center: 205, size: 124, squeeze: 0.56 };
const BODY = { size: 50, spacing: 2, left: [150, 40], center: [369, 450] };

// 便于测试：给出第 t（标准时间）帧引语打到第几个字
export function quoteShown(i: number, t: number, q: QuoteLine): number {
  const slot = QUOTES[i]!;
  const all = Array.from(`“${q.before}${q.key}${q.after}”`).length;
  return Math.floor(interpolate(t, [slot.at, slot.end], [0, all], clamp));
}
