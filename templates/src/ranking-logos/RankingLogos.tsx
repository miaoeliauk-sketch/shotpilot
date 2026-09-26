import React from 'react';
import { AbsoluteFill, Img, interpolate, useCurrentFrame } from 'remotion';
import { assetUrl } from '../asset';

/**
 * 复刻：方格纸底上，一张「排行榜」像翻书一样从左边翻过来（先看到背面、再翻到正面，右边带一点卷边），镜头慢慢往左移；
 * 然后整张往下推走，第一个 logo 从上面落下来，之后几个 logo 一张一张硬切，每张都慢慢放大（原片开头的口播画面已去掉，178 帧，1280×720 @30fps）
 *
 * 按原片量的（世界坐标 = 排行榜停稳后、镜头 1 倍）：
 *   纸：左边 x 258、顶 y 105，往右一直延伸出画面；左边一道很深的投影
 *   标题：衬线 55px「Frontend Code Arena」x 324、字底 201；第二行黄底斜体（黄条 x 322、y 210–271）+ 正体，57px，字底 264
 *   八行：行心 y 336 起每行 49.6；序号圆圈 (336, y) 半径 12；名字 25px 深灰 x 372；图标 34px 中心 x 726；
 *     蓝条（#0f1c80）x 755 起、高 29，长度按分数（最高的 560，最低的约 310）；第一行外面一圈黄色圆角框（x 292 起、y 312–364）
 *   翻页：第 3–8 帧看到纸的背面（反着的字）绕左边转过来、同时摆正；第 8–10 帧左边平了、右边一道斜着的灰色卷边往右走；
 *     第 11–15 帧右边一截往后弯着，慢慢摊平
 *   镜头：第 13 帧偏右 43，慢慢移到第 43 帧居中，再往左 7
 *   推走：第 59 帧起整张往下走，越来越快（14 帧下移 382）；第一个 logo 同时从上面落下来（第 71 帧在上方 310，第 81 帧到位，再往下沉 26）
 *   logo：每张以画面中心从 0.995 倍慢慢放大（每帧 +0.00055），到点硬切下一张；原片 0.53（从开始落下算）/ 0.63 / 0.8 / 0.8 / 0.8 秒
 *     上图下字：图 260 见方、中心 y 282，字 84px 字底 555；左图右字：图 160、字 110px，整组居中 y 305
 *     深色底：五条发光线从两边汇到中间拧成螺旋（见 LINES），跟着 logo 一起慢慢放大
 * 只复刻画面，底部口播字幕不在模板里。
 */

export type RankRow = { name: string; score: number; icon: string };
export type LogoCard = { image: string; name: string; layout: 'column' | 'row' | 'image'; bg: 'paper' | 'blue' | 'dark'; frames: number };

export type RankingLogosProps = {
  title: string;
  highlight: string;
  rest: string;
  rows: RankRow[];
  logos: LogoCard[];
  pushAt: number;
  durationInFrames: number;
};

const SERIF = '"Noto Serif CJK SC", "Songti SC", "STSong", "Source Han Serif SC", Georgia, serif';
const SANS = '"Noto Sans CJK SC", "PingFang SC", "Source Han Sans SC", "Hiragino Sans GB", sans-serif';
const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;

export const PAPER = { left: 258, top: 105, width: 1150, height: 760 };
export const BOARD = { titleX: 324, titleBase: 201, titleSize: 55, line2Base: 264, line2Size: 57, rowY: 336, rowStep: 49.6, nameX: 372, nameSize: 25, iconX: 726, iconSize: 34, barX: 755, barH: 29, barMax: 560, circleX: 336 };

const FLIP_T = [3, 4, 5, 6, 7, 7.9];
const FLIP_Y = [-172, -160, -146, -128, -108, -92];
const FLIP_Z = [-32, -31, -30, -28, -24, -18];
/** 第 8–10.6 帧：斜着的卷边（灰色纸背的一道斜条），折线顶端 / 底端（纸坐标 y 0 / 615）的位置 */
const BAND_T = [8, 9, 10, 10.6];
const BAND_TOP = [70, 140, 250, 300];
const BAND_BOT = [300, 330, 380, 420];
export const BAND_W = 170;
/** 第 10.6 帧起：右边一截往后弯着，折线往右走、弯的角度越来越小 */
const FLAP_T = [10.6, 11, 12, 13, 14, 15];
const FLAP_X = [360, 420, 560, 700, 850, 1150];
const FLAP_A = [70, 55, 35, 20, 8, 0];
const PAN_T = [13, 15, 17, 19, 23, 29, 35, 43, 49, 55, 59, 65];
const PAN_X = [42.6, 38.7, 34, 29.7, 22.4, 13.3, 6.5, 0, -3.2, -5.3, -6.1, -6.6];
const PUSH_T = [0, 2, 4, 6, 8, 10, 12, 14, 16, 18];
const PUSH_Y = [0, 3.7, 13.5, 32.7, 66, 122, 220, 382, 600, 800];
const DROP_T = [12, 14, 16, 18, 20, 22, 24, 26, 28];
const DROP_Y = [-460, -310, -163, -78, -29, 0, 16, 25, 26];

/**
 * 翻页：前 5 帧看到的是纸的背面，绕左边转过来（Y）、同时摆正（Z）；
 * 第 8 帧起纸的左边已经平了，右边卷着：先是一道斜着的灰色纸背（band），再变成往后弯着的一截（flap），第 15 帧摊平
 */
export function flip(frame: number) {
  const none = { y: 0, z: 0, bandTop: 0, bandBot: 0, fold: 0, angle: 0 };
  if (frame < 8) return { ...none, mode: 'back' as const, y: interpolate(frame, FLIP_T, FLIP_Y, clamp), z: interpolate(frame, FLIP_T, FLIP_Z, clamp) };
  if (frame < 10.6) return { ...none, mode: 'band' as const, bandTop: interpolate(frame, BAND_T, BAND_TOP, clamp), bandBot: interpolate(frame, BAND_T, BAND_BOT, clamp) };
  if (frame < 15) return { ...none, mode: 'flap' as const, fold: interpolate(frame, FLAP_T, FLAP_X, clamp), angle: interpolate(frame, FLAP_T, FLAP_A, clamp) };
  return { ...none, mode: 'flat' as const };
}

export function boardPan(frame: number): number {
  return interpolate(frame, PAN_T, PAN_X, clamp);
}

/** 推走时排行榜往下移多少（从 pushAt 起算） */
export function pushDown(rel: number): number {
  return interpolate(rel, PUSH_T, PUSH_Y, clamp);
}

/** 第一个 logo 落下来的位置（从 pushAt 起算） */
export function dropIn(rel: number): number {
  return interpolate(rel, DROP_T, DROP_Y, clamp);
}

/** 蓝条长度：最高分 560，其余按比例（底数取最低分往下再让出一段，最低的约 310） */
export function barLength(score: number, scores: number[]): number {
  const max = Math.max(...scores);
  const min = Math.min(...scores);
  const base = max === min ? min - 1 : min - 1.24 * (max - min);
  return BOARD.barMax * ((score - base) / (max - base));
}

/** 每张 logo 从第几帧开始（第一张在 pushAt + 12 帧就开始落下来） */
export function logoStarts(pushAt: number, logos: { frames: number }[]): number[] {
  const out: number[] = [];
  let t = pushAt + 12;
  for (const l of logos) { out.push(t); t += l.frames; }
  return out;
}

export const RankingLogos: React.FC<RankingLogosProps> = (p) => {
  const frame = useCurrentFrame();
  const starts = logoStarts(p.pushAt, p.logos);
  const rel = frame - p.pushAt;
  let current = -1;
  starts.forEach((s, i) => { if (frame >= s) current = i; });
  const boardVisible = current <= 0 && rel < 20;
  const logo = current >= 0 ? p.logos[current]! : null;
  const showPaper = !logo || logo.bg === 'paper' || current === 0;
  return (
    <AbsoluteFill style={{ backgroundColor: '#9a9a96', overflow: 'hidden' }}>
      {showPaper && <PaperBg />}
      {logo && logo.bg !== 'paper' && current > 0 && <LogoBg kind={logo.bg} />}
      {boardVisible && <Board p={p} frame={frame} dy={rel > 0 ? pushDown(rel) : 0} />}
      {logo && (
        <AbsoluteFill style={{ transform: `translateY(${current === 0 ? dropIn(rel).toFixed(1) : 0}px)` }}>
          <AbsoluteFill style={{ transformOrigin: '640px 360px', transform: `scale(${(0.9955 + 0.00055 * (frame - starts[current]! - (current === 0 ? 10 : 0))).toFixed(4)})` }}>
            {logo.bg === 'dark' && current > 0 && <GlowLines />}
            <Logo card={logo} />
          </AbsoluteFill>
        </AbsoluteFill>
      )}
      <AbsoluteFill style={{ background: logo && logo.bg === 'dark' && current > 0 ? 'radial-gradient(ellipse 760px 470px at 640px 360px, rgba(0,0,0,0) 60%, rgba(0,0,0,0.5) 100%)' : 'radial-gradient(ellipse 780px 480px at 640px 340px, rgba(0,0,0,0) 45%, rgba(0,0,0,0.22) 70%, rgba(0,0,0,0.6) 100%)' }} />
    </AbsoluteFill>
  );
};

/** 方格纸：浅灰、10px 的细格子 */
const GRID = 'linear-gradient(rgba(0,0,0,0.045) 1px, transparent 1px), linear-gradient(90deg, rgba(0,0,0,0.045) 1px, transparent 1px)';
const PaperBg: React.FC = () => (
  <AbsoluteFill style={{ backgroundColor: '#e2e2de', backgroundImage: `${GRID}, radial-gradient(ellipse 700px 420px at 640px 330px, #f0f0ec, #d4d4d0 70%, #b8b8b4 100%)`, backgroundSize: '10px 10px, 10px 10px, 100% 100%' }} />
);

const LogoBg: React.FC<{ kind: 'blue' | 'dark' }> = ({ kind }) => {
  if (kind === 'blue') {
    return <AbsoluteFill style={{ backgroundImage: `${GRID.replace(/0,0,0,0.045/g, '255,255,255,0.05')}, radial-gradient(ellipse 760px 460px at 640px 360px, #2452f4, #1f46e0 60%, #1d40c6 100%)`, backgroundSize: '10px 10px, 10px 10px, 100% 100%' }} />;
  }
  // 深色底：四周纯黑，麻花那一圈一点蓝光、logo 那里一点暖光
  return (
    <AbsoluteFill
      style={{
        backgroundColor: '#010101',
        backgroundImage: [
          'radial-gradient(ellipse 470px 170px at 625px 500px, rgba(40,48,66,0.95), rgba(26,32,44,0.6) 45%, rgba(0,0,0,0) 100%)',
          'radial-gradient(ellipse 380px 190px at 625px 320px, rgba(26,25,22,0.9), rgba(0,0,0,0) 100%)',
        ].join(', '),
      }}
    />
  );
};

/**
 * 发光线（深色底的 logo 用）：按原片量的
 *   五条线，两边散开（画面边上 y 383 / 440 / 498 / 561 / 620），往中间收，在 x 370 和 x 880 收到 y 500 一点；
 *   中间拧成五股螺旋：周期 125、上下摆 ±17（两头 ±11），转到后面的那段暗一点；
 *   颜色从上到下：蓝、灰蓝、白、米黄、粉；越往两边越暗（边上只有中间的三成亮）
 */
export const LINES = {
  cy: 500, meetL: 370, fullL: 60, meetR: 880, fullR: 1220, period: 125, amp: 15.5,
  offsets: [-116.5, -59.5, -1.5, 61.5, 120.5],
  colors: ['#4f8fdc', '#8fb6d4', '#c8d2e6', '#f2e4d2', '#e6cdd4'],
};
/** 散开的程度（0 = 收在一点，1 = 完全散开），按原片逐列量的；t = 离收拢点的距离 / 散开段的长度 */
const SPREAD_L = { t: [0, 0.097, 0.226, 0.419, 0.613, 0.806, 1], v: [0, 0.127, 0.29, 0.6175, 0.853, 0.97, 1] };
const SPREAD_R = { t: [0, 0.059, 0.176, 0.294, 0.47, 0.647, 0.824, 1], v: [0, 0.09, 0.195, 0.36, 0.68, 0.87, 0.966, 1] };

/** 第 i 条线在 x 处的 y；front = 这一点在螺旋的前面（亮）还是后面（暗） */
export function linePoint(x: number, i: number) {
  const L = LINES;
  let spread = 0;
  if (x < L.meetL) spread = interpolate((L.meetL - x) / (L.meetL - L.fullL), SPREAD_L.t, SPREAD_L.v, clamp);
  else if (x > L.meetR) spread = interpolate((x - L.meetR) / (L.fullR - L.meetR), SPREAD_R.t, SPREAD_R.v, clamp);
  // 螺旋：中间摆得最大，离收拢点 70 以内慢慢收到 0
  const edge = Math.min(x - L.meetL, L.meetR - x);
  const env = edge <= 0 ? 0 : Math.sin((Math.PI / 2) * Math.min(1, edge / 70));
  const ph = (2 * Math.PI * (x - L.meetL)) / L.period + (i * 2 * Math.PI) / 5;
  return { y: L.cy + spread * L.offsets[i]! + L.amp * env * Math.sin(ph), front: env === 0 || Math.cos(ph) >= 0 };
}

let linesCache: { d: string; i: number; front: boolean }[] | null = null;
function linePaths() {
  if (linesCache) return linesCache;
  const out: { d: string; i: number; front: boolean }[] = [];
  for (let i = 0; i < 5; i++) {
    let seg: string[] = [];
    let front = linePoint(-30, i).front;
    for (let x = -30; x <= 1310; x += 3) {
      const p = linePoint(x, i);
      if (p.front !== front && seg.length) {
        seg.push(`${x} ${p.y.toFixed(1)}`);
        out.push({ d: `M ${seg.join(' L ')}`, i, front });
        seg = [];
        front = p.front;
      }
      seg.push(`${x} ${p.y.toFixed(1)}`);
    }
    if (seg.length > 1) out.push({ d: `M ${seg.join(' L ')}`, i, front });
  }
  linesCache = out;
  return out;
}

export const GlowLines: React.FC = () => {
  const paths = linePaths();
  const L = LINES;
  // 两层：清楚的细线（中间亮、两边暗到两成半），和一层虚的粗光（两边也有，像离焦）
  const core: [number, number][] = [[0, 0.12], [60, 0.18], [120, 0.28], [180, 0.42], [240, 0.6], [300, 0.78], [340, 0.9], [L.meetL, 1], [L.meetR, 1], [940, 0.88], [980, 0.76], [1040, 0.6], [1100, 0.44], [1160, 0.3], [1220, 0.19], [1280, 0.13]];
  const soft: [number, number][] = [[0, 0.95], [180, 0.95], [300, 0.7], [L.meetL, 0.45], [L.meetR, 0.45], [980, 0.7], [1100, 0.95], [1280, 0.95]];
  const grad = (id: string, stops: [number, number][]) => (
    <>
      <linearGradient id={`${id}-g`} gradientUnits="userSpaceOnUse" x1={0} y1={0} x2={1280} y2={0}>
        {stops.map(([x, v]) => <stop key={x} offset={(x / 1280).toFixed(4)} stopColor="#fff" stopOpacity={v} />)}
      </linearGradient>
      <mask id={id} maskUnits="userSpaceOnUse" x={-50} y={0} width={1380} height={720}><rect x={-50} y={0} width={1380} height={720} fill={`url(#${id}-g)`} /></mask>
    </>
  );
  const draw = (front: boolean | null, width: number, opacity: number) =>
    paths.filter((p) => front === null || p.front === front).map((p, k) => (
      <path key={`${String(front)}-${width}-${k}`} d={p.d} fill="none" stroke={L.colors[p.i]} strokeWidth={width} strokeLinecap="round" strokeLinejoin="round" opacity={opacity} />
    ));
  return (
    <svg width={1280} height={720} style={{ position: 'absolute', left: 0, top: 0, overflow: 'visible' }}>
      <defs>
        {grad('rl-core', core)}
        {grad('rl-soft', soft)}
        <filter id="rl-blur" x="-10%" y="-50%" width="120%" height="200%"><feGaussianBlur stdDeviation="4.5" /></filter>
      </defs>
      <g mask="url(#rl-soft)" filter="url(#rl-blur)">{draw(null, 11, 0.62)}</g>
      <g mask="url(#rl-core)">
        {/* 螺旋转到后面的那段暗一点 */}
        {draw(false, 3.6, 0.55)}
        {draw(true, 4.4, 1)}
      </g>
    </svg>
  );
};

const Board: React.FC<{ p: RankingLogosProps; frame: number; dy: number }> = ({ p, frame, dy }) => {
  const f = flip(frame);
  if (frame < 3) return null;
  const pan = boardPan(frame);
  const H = PAPER.height;
  // 斜折线：纸坐标 y 处的 x
  const xAt = (y: number) => f.bandTop + ((f.bandBot - f.bandTop) * y) / 615;
  const flatClip =
    f.mode === 'band' ? `polygon(-300px -200px, ${xAt(-200).toFixed(1)}px -200px, ${xAt(H + 200).toFixed(1)}px ${H + 200}px, -300px ${H + 200}px)`
    : f.mode === 'flap' ? `inset(-200px ${(PAPER.width - f.fold).toFixed(1)}px -200px -300px)`
    : undefined;
  return (
    <AbsoluteFill style={{ transform: `translate(${pan.toFixed(1)}px, ${dy.toFixed(1)}px)`, perspective: 1500, perspectiveOrigin: '640px 360px' }}>
      <div
        style={{
          position: 'absolute', left: PAPER.left, top: PAPER.top, width: PAPER.width, height: H, transformOrigin: '0 50%',
          transform: `rotateZ(${f.z.toFixed(2)}deg) rotateY(${f.y.toFixed(2)}deg)`, transformStyle: 'preserve-3d',
        }}
      >
        {/* 平着的部分 */}
        <div style={{ position: 'absolute', inset: 0, boxShadow: '-40px 10px 50px rgba(0,0,0,0.55), -8px 0 12px rgba(0,0,0,0.35)', clipPath: flatClip }}>
          <PageFace p={p} />
          {/* 背面朝着镜头时（转过 90° 以上）整张灰一点 */}
          {f.y < -90 && <div style={{ position: 'absolute', inset: 0, background: 'rgba(120,120,115,0.25)' }} />}
        </div>
        {/* 斜着的卷边：一道灰色的纸背，左边压一道影子；再往右露出还没摊平的纸（暗一点） */}
        {f.mode === 'band' && (
          <>
            <div style={{ position: 'absolute', inset: 0, clipPath: `polygon(${(xAt(0) + BAND_W).toFixed(1)}px 0, ${PAPER.width}px 0, ${PAPER.width}px ${H}px, ${(xAt(H) + BAND_W).toFixed(1)}px ${H}px)` }}>
              <PageFace p={p} />
              <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.28)' }} />
            </div>
            <div
              style={{
                position: 'absolute', inset: 0,
                clipPath: `polygon(${xAt(0).toFixed(1)}px 0, ${(xAt(0) + BAND_W).toFixed(1)}px 0, ${(xAt(H) + BAND_W).toFixed(1)}px ${H}px, ${xAt(H).toFixed(1)}px ${H}px)`,
                background: 'linear-gradient(90deg, #7c7c78, #a4a4a0 35%, #9a9a96 80%, #8a8a86)',
              }}
            />
          </>
        )}
        {/* 往后弯着的一截：绕折线转 */}
        {f.mode === 'flap' && (
          <div style={{ position: 'absolute', inset: 0, transformOrigin: `${f.fold.toFixed(1)}px 50%`, transform: `rotateY(${f.angle.toFixed(2)}deg)`, clipPath: `inset(0 0 0 ${f.fold.toFixed(1)}px)` }}>
            <PageFace p={p} />
            <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(90deg, rgba(0,0,0,${(0.35 * f.angle / 90).toFixed(2)}) ${f.fold.toFixed(0)}px, rgba(0,0,0,${(0.1 * f.angle / 90).toFixed(2)}) ${(f.fold + 260).toFixed(0)}px)` }} />
          </div>
        )}
      </div>
    </AbsoluteFill>
  );
};

/** 排行榜这张纸的正面（纸坐标） */
const PageFace: React.FC<{ p: RankingLogosProps }> = ({ p }) => {
  const scores = p.rows.map((r) => r.score);
  const b = BOARD;
  return (
    <div style={{ position: 'absolute', inset: 0, backgroundColor: '#f2f2ec', backgroundImage: `${GRID}, linear-gradient(90deg, #f6f6f0, #eeeee8 60%, #e2e1dc)`, backgroundSize: '10px 10px, 10px 10px, 100% 100%' }}>
        <div style={{ position: 'absolute', left: b.titleX - PAPER.left, top: b.titleBase - PAPER.top - b.titleSize * 0.82, whiteSpace: 'pre', fontFamily: SERIF, fontSize: b.titleSize, lineHeight: 1, color: '#1d1d1b', letterSpacing: -1 }}>{p.title}</div>
        <div style={{ position: 'absolute', left: b.titleX - 2 - PAPER.left, top: b.line2Base - PAPER.top - b.line2Size * 0.82, whiteSpace: 'pre', fontFamily: SERIF, fontSize: b.line2Size, lineHeight: 1, color: '#1d1d1b', letterSpacing: -1 }}>
          {p.highlight && <span style={{ background: '#f1c232', fontStyle: 'italic', padding: '4px 4px 6px 2px' }}>{p.highlight}</span>}
          {p.rest && <span style={{ marginLeft: 14 }}>{p.rest}</span>}
        </div>
        {p.rows.slice(0, 8).map((r, i) => {
          const cy = b.rowY + i * b.rowStep - PAPER.top;
          const len = barLength(r.score, scores);
          return (
            <React.Fragment key={i}>
              {i === 0 && <div style={{ position: 'absolute', left: 292 - PAPER.left, top: cy - 24, width: 1200, height: 50, border: '3px solid #e9b92c', borderRadius: 12, boxSizing: 'border-box' }} />}
              <div style={{ position: 'absolute', left: b.circleX - 12 - PAPER.left, top: cy - 12, width: 24, height: 24, borderRadius: 12, border: '1.5px solid #b9b9b4', boxSizing: 'border-box', fontFamily: SANS, fontSize: 11, lineHeight: '21px', textAlign: 'center', color: '#8a8a86' }}>{i + 1}</div>
              <div style={{ position: 'absolute', left: b.nameX - PAPER.left, top: cy - b.nameSize * 0.62, whiteSpace: 'pre', fontFamily: SANS, fontSize: b.nameSize, lineHeight: 1.2, color: '#2c2c2a' }}>{r.name}</div>
              <RowIcon icon={r.icon} name={r.name} left={b.iconX - b.iconSize / 2 - PAPER.left} top={cy - b.iconSize / 2} />
              <div style={{ position: 'absolute', left: b.barX - PAPER.left, top: cy - b.barH / 2, width: len, height: b.barH, background: '#0f1c80' }} />
              <div style={{ position: 'absolute', left: b.barX - PAPER.left + len + 26, top: cy - 9, whiteSpace: 'pre', fontFamily: SANS, fontSize: 16, lineHeight: 1, color: '#9a9a96', filter: 'blur(1.5px)' }}>{r.score.toLocaleString('en-US')}</div>
            </React.Fragment>
          );
        })}
    </div>
  );
};

/** 每行的图标：给了图片就用图片，没给就画一个带首字母的深色小方块 */
const RowIcon: React.FC<{ icon: string; name: string; left: number; top: number }> = ({ icon, name, left, top }) => {
  const s = BOARD.iconSize;
  if (icon) return <Img src={assetUrl(icon)} style={{ position: 'absolute', left, top, width: s, height: s, objectFit: 'contain' }} />;
  const letter = (name.trim()[0] ?? '?').toUpperCase();
  return (
    <div style={{ position: 'absolute', left, top, width: s, height: s, borderRadius: 7, background: '#1f1f1f', color: '#fafafa', fontFamily: SANS, fontWeight: 700, fontSize: 20, lineHeight: `${s}px`, textAlign: 'center' }}>{letter}</div>
  );
};

const Logo: React.FC<{ card: LogoCard }> = ({ card }) => {
  const dark = card.bg !== 'paper';
  const color = dark ? '#f2f4f8' : '#151515';
  if (card.layout === 'row') {
    return (
      <div style={{ position: 'absolute', left: 0, width: 1280, top: 305 - 80, height: 160, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 44 }}>
        {card.image && <Img src={assetUrl(card.image)} style={{ width: 160, height: 160, objectFit: 'contain' }} />}
        {card.name && <span style={{ fontFamily: SANS, fontWeight: 500, fontSize: 110, letterSpacing: 12, lineHeight: 1, color }}>{card.name}</span>}
      </div>
    );
  }
  if (card.layout === 'image') {
    return card.image ? <Img src={assetUrl(card.image)} style={{ position: 'absolute', left: 240, top: 120, width: 800, height: 400, objectFit: 'contain' }} /> : null;
  }
  return (
    <>
      {card.image && <Img src={assetUrl(card.image)} style={{ position: 'absolute', left: 640 - 130, top: 282 - 130, width: 260, height: 260, objectFit: 'contain' }} />}
      {card.name && <div style={{ position: 'absolute', left: 0, width: 1280, top: 555 - 84 * 0.88, textAlign: 'center', whiteSpace: 'pre', fontFamily: SANS, fontWeight: 500, fontSize: 84, lineHeight: 1, color }}>{card.name}</div>}
    </>
  );
};
