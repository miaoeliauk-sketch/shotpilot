import React, { useLayoutEffect, useState } from 'react';
import { AbsoluteFill, continueRender, delayRender, Img, interpolate, useCurrentFrame } from 'remotion';
import { assetUrl } from '../asset';
import { BUNDLED_FONTS, useBundledFont } from '../fonts';
import { vignetteGradient } from '../lens';
import { measure } from '../text-layout';
import { DARK_CAM, WEB_CAM } from './camera';

/**
 * 复刻：网页长截图从柱状图特写一路拉远、往上移到页首的大标题推近，镜头往右一甩，斜着一刀切进暗场；
 * 暗场里一张两行对比表一格格长出来、字一个个打出来，镜头慢慢推近；然后下面冒出两个像素方块标签（14 个方块，赢了几项就几个橙色），
 * 标签下面再各弹出一个胶囊（679 帧，1280×720 @30fps）。
 *
 * 按原片量的：
 *   网页：镜头逐帧跟踪出来的（camera.ts）；第 0 帧是 8.2 倍特写，第 66 帧看到整排柱状图，第 71–103 帧往上移到页首、放大到 1.75 倍，
 *     第 103 帧起往右甩、越转越快（到第 124 帧转了 6.8°）；左右两边暗到 0.78
 *   转场：第 124–140 帧，一条斜边（上面比下面靠右 160）从左往右扫过去，扫过的地方换成暗场
 *   暗场（「世界坐标」= 原片第 220 帧的画面）：底色 #161815，四周稍暗
 *     暗场切进来时从下面滑上来 60 像素（第 124–156 帧），之后镜头逐帧跟踪（camera.ts）
 *     标题条：x 137–784、y 143–188，白色 31%→45% 透明；白字 28px，第 124 帧起每帧打 1.25 个字
 *     表格里的中文是窄体：字号 37–42、横向压到 0.72–0.75；英文名字用窄体，数字 Poppins Bold 67px
 *     表头条（棕）y 222–290，两行（蓝紫、青）y 294–362 / 366–434，右端到 x 1090 渐隐；第 168 / 174 / 180 帧起从左往右刷出来
 *     分数：Poppins Bold 67px，57 淡紫 / 60 淡青，前面红色向下 / 绿色向上的箭头；右边一列「6项目」「8项目」
 *   像素标签：每个 7×2 个方块（边长 16、间距 44.3、行距 34），先打上面一排、再打下面一排，赢的项数从下排左边开始涂橙色；
 *     方块下面灰色 Archivo Black 45px 的名字；再下面一个圆角胶囊（宋体粗字，暖色 / 蓝色描边），从下面浮上来
 *   景深：虚的程度随位置渐变（左边按距离平方、上面按距离线性），三层（很虚 / 有点虚 / 清楚）叠出来；
 *     一开始左边虚，第 230–300 帧虚的范围往右扩；第 404 帧起表格虚掉，焦点落在下面的标签上；最后拉远时左边和标题条虚
 * 只复刻画面，底部口播字幕不在模板里。
 */

export type TableRow = { name: string; score: string; scoreUnit: string; count: string; countUnit: string; up: boolean };
export type PixelLabel = { text: string; wins: number; pill: string };

export type WebComparePixelsProps = {
  page: string;
  /** 开头特写对准的地方、最后推近的地方（图片宽、高的比例） */
  focusStart: [number, number];
  focusEnd: [number, number];
  title: string;
  headers: [string, string, string];
  rows: TableRow[];
  labels: PixelLabel[];
  total: number;
  durationInFrames: number;
};

const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;
const SANS = '"Noto Sans CJK SC", "Source Han Sans SC", "PingFang SC", "Microsoft YaHei", sans-serif';
const SERIF = '"Noto Serif CJK SC", "Source Han Serif SC", "Songti SC", "STSong", serif';

/** 原片那张网页截图（5280×3225）上，开头特写和最后推近对准的点（宽、高的比例） */
export const ORIGIN_FOCUS = { start: [0.6026, 0.7554], end: [0.4596, 0.2079], aspect: 3225 / 5280 } as const;

export const WIPE = { t: [124, 127, 129, 131, 133, 135, 137, 140], x: [-170, 282, 580, 802, 967, 1101, 1254, 1440], slant: 160 };
export const DARK_AT = 124;

export const TITLE = { x0: 137, x1: 784, y0: 143, y1: 188, textX: 146, base: 178, size: 28, at: 124, rate: 1.25 };
export const BARS = [
  { y0: 222, y1: 290, x0: 124, x1: 1093, at: 168, stops: [[95, 75, 48, 0], [88, 75, 58, 0.5], [45, 44, 41, 0.9], [33, 35, 32, 1]] },
  { y0: 294, y1: 362, x0: 144, x1: 1085, at: 174, stops: [[48, 54, 82, 0], [70, 74, 94, 0.45], [70, 72, 86, 0.57], [50, 53, 57, 0.7], [42, 43, 41, 1]] },
  { y0: 366, y1: 434, x0: 132, x1: 1083, at: 180, stops: [[40, 74, 80, 0], [70, 100, 108, 0.25], [66, 88, 92, 0.45], [58, 72, 74, 0.6], [48, 52, 51, 0.75], [42, 44, 41, 1]] },
] as const;
/** 表头三格、两行文字的位置和出现时间 */
export const CELLS = {
  /** 表格里的中文是窄的：字号大、横向压到 0.72–0.75 */
  headX: [150, 649, 1087], headBase: 271, headSize: 37, headSqueeze: 0.72, headAt: [170, 184, 192],
  nameX: 148, nameSize: 42, nameSqueeze: 0.73, latinSize: 44, nameRate: 1.4,
  bases: [350, 423],
  arrowX: 625, scoreX: 682, scoreSize: 67, unitSize: 40, unitSqueeze: 0.75, scoreAt: [188, 192],
  countRight: 1086, countSize: 67, countAt: [198, 202],
  colors: ['#dcdcfa', '#d4f6ec'],
};
export const PIXELS = [
  { x: 141.5, y: 505.5, textBase: 594, pill: { x0: 133, x1: 430, y0: 625, y1: 700 }, top: 411, topRate: 1.5, bottom: 423, text: 424, pillAt: 466, border: '#c9938a', fill: ['#3a2f2c', '#1d1a19'] },
  { x: 672, y: 502, textBase: 592, pill: { x0: 662, x1: 959, y0: 623, y1: 698 }, top: 362, topRate: 1.3, bottom: 372, text: 372, pillAt: 561, border: '#3a44dc', fill: ['#22232f', '#1a1b24'] },
] as const;
export const SQUARE = { pitch: 43.7, size: 19, rowGap: 36.5, cols: 7 };
export const PIXEL_TEXT = { size: 58, spacing: 0, sx: 1.12, color: '#8b8b8b' };

/** 在关键帧之间线性插值 */
const lerpTrack = (frame: number, t: readonly number[], v: readonly number[]) => interpolate(frame, t as number[], v as number[], clamp);

/** 网页镜头：画面中心对准的点（按网页宽度归一化）、网页显示宽度、转角 */
export function webCamera(frame: number): { u: number; v: number; w: number; r: number } {
  return { u: lerpTrack(frame, WEB_CAM.t, WEB_CAM.u), v: lerpTrack(frame, WEB_CAM.t, WEB_CAM.v), w: lerpTrack(frame, WEB_CAM.t, WEB_CAM.w), r: lerpTrack(frame, WEB_CAM.t, WEB_CAM.r) };
}

/** 暗场镜头：世界 → 画面 */
export function darkCamera(frame: number): { s: number; r: number; x: number; y: number } {
  return { s: lerpTrack(frame, DARK_CAM.t, DARK_CAM.s), r: lerpTrack(frame, DARK_CAM.t, DARK_CAM.r), x: lerpTrack(frame, DARK_CAM.t, DARK_CAM.x), y: lerpTrack(frame, DARK_CAM.t, DARK_CAM.y) };
}

/** 斜切转场：画面底边上切口的横坐标 */
export function wipeX(frame: number): number {
  return lerpTrack(frame, WIPE.t, WIPE.x);
}

/** 条从左往右刷出来的进度（先快后慢，32 帧刷满） */
export function barWipe(frame: number, at: number): number {
  const t = Math.max(0, Math.min(1, (frame - at) / 32));
  return 1 - Math.pow(1 - t, 2.2);
}

/** 第 i 个字出来的进度（每个字 3 帧从下面浮上来） */
export function charIn(frame: number, at: number, rate: number, i: number): number {
  return interpolate(frame - at - i / rate, [0, 3], [0, 1], clamp);
}

/** 第 k 个方块是不是橙色：从下排左边开始涂，下排满了再涂上排 */
export function squareLit(k: number, wins: number, cols = SQUARE.cols): boolean {
  const row = Math.floor(k / cols);
  const col = k % cols;
  const order = row === 1 ? col : cols + col;
  return order < wins;
}

/** 图片宽高比（高 / 宽），加载完之前按原片的 */
function useAspect(src: string): number {
  const [aspect, setAspect] = useState<number | null>(null);
  useLayoutEffect(() => {
    if (!src) return;
    const handle = delayRender(`读图片尺寸 ${src}`);
    const img = new Image();
    img.onload = () => { setAspect(img.naturalWidth > 0 ? img.naturalHeight / img.naturalWidth : null); continueRender(handle); };
    img.onerror = () => continueRender(handle);
    img.src = assetUrl(src);
  }, [src]);
  return aspect ?? ORIGIN_FOCUS.aspect;
}

export const WebComparePixels: React.FC<WebComparePixelsProps> = (p) => {
  const frame = useCurrentFrame();
  const fonts = [useBundledFont('poppinsBold'), useBundledFont('barlowCondensed'), useBundledFont('archivoBlack')];
  const ready = fonts.every(Boolean);
  const wx = wipeX(frame);
  const clip = `polygon(-10px -10px, ${(wx + WIPE.slant).toFixed(1)}px -10px, ${wx.toFixed(1)}px 730px, -10px 730px)`;
  return (
    <AbsoluteFill style={{ backgroundColor: '#161815', overflow: 'hidden' }}>
      {frame < WIPE.t[WIPE.t.length - 1]! && <WebScene {...p} frame={frame} />}
      {frame >= DARK_AT && (
        <AbsoluteFill style={{ clipPath: frame < WIPE.t[WIPE.t.length - 1]! ? clip : undefined }}>
          <DarkScene {...p} frame={frame} ready={ready} />
        </AbsoluteFill>
      )}
      {frame >= DARK_AT && frame < WIPE.t[WIPE.t.length - 1]! && (
        // 切口上一道细亮边
        <svg width={1280} height={720} style={{ position: 'absolute', inset: 0 }}>
          <line x1={wx + WIPE.slant} y1={-10} x2={wx} y2={730} stroke="rgba(170,200,255,0.55)" strokeWidth={3} style={{ filter: 'blur(1px)' }} />
        </svg>
      )}
    </AbsoluteFill>
  );
};

const WebScene: React.FC<WebComparePixelsProps & { frame: number }> = ({ page, focusStart, focusEnd, frame }) => {
  const aspect = useAspect(page);
  const cam = webCamera(frame);
  // 原片的镜头路线按「开头特写点 → 推近点」线性搬到这张图上
  const O = ORIGIN_FOCUS;
  const mapAxis = (x: number, o0: number, o1: number, n0: number, n1: number) => n0 + ((x - o0) * (n1 - n0)) / (o1 - o0);
  const u = mapAxis(cam.u, O.start[0], O.end[0], focusStart[0], focusEnd[0]);
  const vh = mapAxis(cam.v / O.aspect, O.start[1], O.end[1], focusStart[1], focusEnd[1]);
  const v = vh * aspect;
  const blur = interpolate(frame, [110, 124, 140], [0, 3, 8], clamp);
  return (
    <AbsoluteFill style={{ backgroundColor: '#f6f6f5' }}>
      <div
        style={{
          position: 'absolute', left: 0, top: 0, transformOrigin: '0 0',
          transform: `translate(640px, 360px) rotate(${cam.r.toFixed(3)}deg) translate(${(-u * cam.w).toFixed(2)}px, ${(-v * cam.w).toFixed(2)}px)`,
          filter: blur > 0.3 ? `blur(${blur.toFixed(1)}px)` : undefined,
        }}
      >
        {page && <Img src={assetUrl(page)} style={{ display: 'block', width: cam.w, height: cam.w * aspect }} />}
      </div>
      <AbsoluteFill style={{ background: vignetteGradient({ cx: 640, cy: 330, rx: 700, ry: 1500, amount: 0.22, power: 2.6 }) }} />
    </AbsoluteFill>
  );
};

const DarkScene: React.FC<WebComparePixelsProps & { frame: number; ready: boolean }> = (p) => {
  const { frame } = p;
  const cam = darkCamera(frame);
  const world = <World {...p} />;
  const worldStyle: React.CSSProperties = {
    position: 'absolute', left: 0, top: 0, width: 1280, height: 720, transformOrigin: '0 0',
    transform: `translate(${cam.x.toFixed(2)}px, ${cam.y.toFixed(2)}px) rotate(${cam.r.toFixed(3)}deg) scale(${cam.s.toFixed(5)})`,
  };
  const m = lensMasks(frame, cam);
  const intersect = (mask: string): React.CSSProperties => ({ WebkitMaskImage: mask, maskImage: mask, WebkitMaskComposite: 'source-in', maskComposite: 'intersect' });
  const union = (mask: string): React.CSSProperties => ({ WebkitMaskImage: mask, maskImage: mask, WebkitMaskComposite: 'source-over', maskComposite: 'add' });
  return (
    <AbsoluteFill style={{ backgroundColor: '#161815' }}>
      {m.maxBlur > LENS.mid && (
        <AbsoluteFill style={{ ...union(m.far), filter: `blur(${LENS.far}px)` }}>
          <div style={worldStyle}>{world}</div>
        </AbsoluteFill>
      )}
      {m.maxBlur > 0.05 && (
        <AbsoluteFill style={{ ...union(m.mid), filter: `blur(${LENS.mid}px)` }}>
          <div style={worldStyle}>{world}</div>
        </AbsoluteFill>
      )}
      <AbsoluteFill style={m.maxBlur > 0.05 ? intersect(m.sharp) : undefined}>
        <div style={worldStyle}>{world}</div>
      </AbsoluteFill>
      <AbsoluteFill style={{ background: vignetteGradient({ cx: 640, cy: 330, rx: 820, ry: 560, amount: 0.45, power: 2.4 }) }} />
    </AbsoluteFill>
  );
};

/**
 * 景深：虚的程度 b 随位置变，左边 b = kh·(cx − x)²，上面 b = kv·(edge − y)（edge 是世界里的 y，跟着镜头走），两者取大的。
 * CSS 做不了逐像素的虚，用三层叠：很虚（far）、有点虚（mid）、清楚的，各层的遮罩按 b 算。
 */
export const LENS = { mid: 2.5, far: 8 };
export function lensParams(frame: number): { cx: number; b150: number; edge: number; kv: number } {
  return {
    cx: interpolate(frame, [124, 230, 300, 400, 404, 628, 645], [330, 330, 560, 560, 150, 150, 330], clamp),
    b150: interpolate(frame, [124, 230, 300, 400, 404, 628, 645], [5, 5, 6.5, 6.5, 0, 0, 4], clamp),
    edge: interpolate(frame, [400, 404, 628, 650], [-2000, 470, 470, 200], clamp),
    kv: interpolate(frame, [628, 650], [0.0375, 0.1], clamp),
  };
}

/** 横向 / 竖向一条渐变遮罩：alpha(b)，b 由 blurAt(p) 给出 */
function axisMask(dir: 'right' | 'bottom', length: number, blurAt: (p: number) => number, alpha: (b: number) => number): string {
  const stops: string[] = [];
  for (let i = 0; i <= 32; i++) {
    const p = (length * i) / 32;
    stops.push(`rgba(0,0,0,${alpha(blurAt(p)).toFixed(3)}) ${p.toFixed(0)}px`);
  }
  return `linear-gradient(to ${dir}, ${stops.join(', ')})`;
}

export function lensMasks(frame: number, cam: { s: number; y: number }): { sharp: string; mid: string; far: string; maxBlur: number } {
  const L = lensParams(frame);
  const kh = L.cx > 150 ? L.b150 / Math.pow(L.cx - 150, 2) : 0;
  const bh = (x: number) => kh * Math.pow(Math.max(0, L.cx - x), 2);
  const ey = cam.s * L.edge + cam.y;
  const bv = (y: number) => L.kv * Math.max(0, ey - y);
  // 每层的权重：清楚 a_s，有点虚 (1−a_s)·a_m，很虚 (1−a_s)(1−a_m)；下面的层在上面的层清楚的地方是 0，免得虚的晕圈从字边透出来
  const sharpA = (b: number) => Math.max(0, 1 - b / LENS.mid);
  const midA = (b: number) => (b <= LENS.mid ? 1 : Math.max(0, (LENS.far - b) / (LENS.far - LENS.mid)));
  const midW = (b: number) => (1 - sharpA(b)) * midA(b);
  const farW = (b: number) => (1 - sharpA(b)) * (1 - midA(b));
  const maxBlur = Math.max(bh(0), bv(0));
  return {
    // 两个方向：清楚的取交集，虚的取并集
    sharp: `${axisMask('right', 1280, bh, sharpA)}, ${axisMask('bottom', 720, bv, sharpA)}`,
    mid: `${axisMask('right', 1280, bh, midW)}, ${axisMask('bottom', 720, bv, midW)}`,
    far: `${axisMask('right', 1280, bh, farW)}, ${axisMask('bottom', 720, bv, farW)}`,
    maxBlur,
  };
}

const World: React.FC<WebComparePixelsProps & { frame: number; ready: boolean }> = ({ title, headers, rows, labels, total, frame, ready }) => {
  if (!ready) return null;
  return (
    <>
      <TitleBar text={title} frame={frame} />
      {BARS.map((b, i) => (i === 0 || rows[i - 1]) && <Bar key={i} bar={b} frame={frame} />)}
      <Headers headers={headers} frame={frame} />
      {rows.slice(0, 2).map((r, i) => <Row key={i} row={r} i={i} frame={frame} />)}
      {labels.slice(0, 2).map((l, i) => <Pixels key={i} label={l} i={i} total={total} frame={frame} />)}
    </>
  );
};

const TitleBar: React.FC<{ text: string; frame: number }> = ({ text, frame }) => {
  const T = TITLE;
  const font = (): CharFont => ({ family: SANS, weight: 400, size: T.size, sx: 1 });
  const chars = Array.from(text);
  return (
    <>
      <div style={{ position: 'absolute', left: T.x0, top: T.y0, width: T.x1 - T.x0, height: T.y1 - T.y0, background: 'linear-gradient(to right, rgba(255,255,255,0.31), rgba(255,255,255,0.45) 65%, rgba(255,255,255,0.40))' }} />
      <TypedText chars={chars} x={T.textX} base={T.base} font={font} fill="#ffffff" frame={frame} at={T.at} rate={T.rate} />
    </>
  );
};

/** 每个字用什么字体：family、字重、字号、横向压缩 */
export type CharFont = { family: string; weight: number; size: number; sx: number; spacing?: number };
const isLatin = (ch: string) => /[\x00-\x7f]/.test(ch);

/** 一个字一个字打出来：每个字单独放，位置按每个字量出来的宽度累加 */
const TypedText: React.FC<{ chars: string[]; x: number; base: number; font: (ch: string) => CharFont; fill: string; frame: number; at: number; rate: number; anchorEnd?: boolean; rise?: number }> = ({ chars, x, base, font, fill, frame, at, rate, anchorEnd, rise = 8 }) => {
  const fonts = chars.map(font);
  const adv = chars.map((ch, i) => {
    const f = fonts[i]!;
    return (measure(ch, `${f.weight} ${f.size}px ${f.family}`) + (f.spacing ?? 0) * f.size) * f.sx;
  });
  const width = adv.reduce((a, b) => a + b, 0);
  let cx = anchorEnd ? x - width : x;
  const xs = adv.map((w) => { const x0 = cx; cx += w; return x0; });
  return (
    <svg width={1280} height={720} style={{ position: 'absolute', left: 0, top: 0, overflow: 'visible' }}>
      {chars.map((ch, i) => {
        const u = charIn(frame, at, rate, i);
        if (u <= 0 || ch === ' ') return null;
        const f = fonts[i]!;
        return (
          <text
            key={i} x={0} y={0} transform={`translate(${xs[i]!.toFixed(2)} ${(base + rise * (1 - u)).toFixed(2)}) scale(${f.sx} 1)`}
            fontFamily={f.family} fontWeight={f.weight} fontSize={f.size} fill={fill} fillOpacity={u} style={{ whiteSpace: 'pre' }}
          >
            {ch}
          </text>
        );
      })}
    </svg>
  );
};

const Bar: React.FC<{ bar: (typeof BARS)[number]; frame: number }> = ({ bar, frame }) => {
  const w = barWipe(frame, bar.at);
  if (w <= 0) return null;
  const full = bar.x1 - bar.x0;
  const grad = `linear-gradient(to right, ${bar.stops.map(([r, g, b, t]) => `rgb(${r},${g},${b}) ${(t * 100).toFixed(0)}%`).join(', ')})`;
  // 右端毛刷一样的软边
  const edge = Math.min(40, full * w);
  const mask = `linear-gradient(to right, #000 ${(full * w - edge).toFixed(0)}px, transparent ${(full * w).toFixed(0)}px)`;
  return (
    <div
      style={{
        position: 'absolute', left: bar.x0, top: bar.y0, width: full, height: bar.y1 - bar.y0, background: grad,
        WebkitMaskImage: w < 1 ? mask : undefined, maskImage: w < 1 ? mask : undefined,
      }}
    />
  );
};

const Headers: React.FC<{ headers: [string, string, string]; frame: number }> = ({ headers, frame }) => {
  const C = CELLS;
  return (
    <>
      {headers.map((h, i) => {
        if (!h) return null;
        const font = (): CharFont => ({ family: SANS, weight: i === 0 ? 700 : 400, size: C.headSize, sx: C.headSqueeze });
        return <TypedText key={i} chars={Array.from(h)} x={C.headX[i]!} base={C.headBase} font={font} fill="#f2f2f2" frame={frame} at={C.headAt[i]!} rate={i === 0 ? 2 : 1.4} anchorEnd={i === 2} />;
      })}
    </>
  );
};

const Arrow: React.FC<{ x: number; base: number; up: boolean; size: number; opacity: number }> = ({ x, base, up, size, opacity }) => {
  // 实心箭头：宽 size，高 1.1 size，底边在字底往上一点
  const h = size * 1.1;
  const w = size;
  const y1 = base - size * 0.08;
  const y0 = y1 - h;
  const stem = w * 0.36;
  const head = h * 0.5;
  const pts = up
    ? [[x, y0], [x + w / 2, y0 + head], [x + stem / 2, y0 + head], [x + stem / 2, y1], [x - stem / 2, y1], [x - stem / 2, y0 + head], [x - w / 2, y0 + head]]
    : [[x, y1], [x + w / 2, y1 - head], [x + stem / 2, y1 - head], [x + stem / 2, y0], [x - stem / 2, y0], [x - stem / 2, y1 - head], [x - w / 2, y1 - head]];
  return <polygon points={pts.map(([a, b]) => `${a!.toFixed(1)},${b!.toFixed(1)}`).join(' ')} fill={up ? '#3ee06a' : '#e8313a'} opacity={opacity} />;
};

const Row: React.FC<{ row: TableRow; i: number; frame: number }> = ({ row, i, frame }) => {
  const C = CELLS;
  const base = C.bases[i]!;
  const nameFont = (ch: string): CharFont =>
    isLatin(ch) ? { family: `"${BUNDLED_FONTS.barlowCondensed.family}", sans-serif`, weight: 500, size: C.latinSize, sx: 1 } : { family: SANS, weight: 500, size: C.nameSize, sx: C.nameSqueeze };
  const color = C.colors[i % 2]!;
  const s = interpolate(frame - C.scoreAt[i]!, [0, 4], [0, 1], clamp);
  const c = interpolate(frame - C.countAt[i]!, [0, 4], [0, 1], clamp);
  const numFont = `"${BUNDLED_FONTS.poppinsBold.family}", sans-serif`;
  const unitW = measure(row.countUnit, `500 ${C.unitSize}px ${SANS}`) * C.unitSqueeze;
  const countW = measure(row.count, `700 ${C.countSize}px ${numFont}`);
  const countX = C.countRight - unitW - countW;
  return (
    <>
      <TypedText chars={Array.from(row.name)} x={C.nameX} base={base} font={nameFont} fill="#f4f4f4" frame={frame} at={BARS[i + 1]!.at} rate={C.nameRate} />
      <svg width={1280} height={720} style={{ position: 'absolute', left: 0, top: 0, overflow: 'visible' }}>
        {s > 0 && (
          <g opacity={s} transform={`translate(0 ${(6 * (1 - s)).toFixed(2)})`} style={{ filter: s < 1 ? `blur(${(3 * (1 - s)).toFixed(1)}px)` : undefined }}>
            <Arrow x={C.arrowX} base={base} up={row.up} size={29} opacity={1} />
            <text x={C.scoreX} y={base} textAnchor="middle" fontFamily={numFont} fontSize={C.scoreSize} letterSpacing="0.03em" fill={color}>{row.score}</text>
            <text transform={`translate(${(C.scoreX + (measure(row.score, `700 ${C.scoreSize}px ${numFont}`) * 1.03) / 2 + 2).toFixed(1)} ${base - 1}) scale(${C.unitSqueeze} 1)`} fontFamily={SANS} fontWeight={500} fontSize={C.unitSize} fill="#f0f0f0">{row.scoreUnit}</text>
          </g>
        )}
        {c > 0 && (
          <g opacity={c} transform={`translate(0 ${(6 * (1 - c)).toFixed(2)})`} style={{ filter: c < 1 ? `blur(${(3 * (1 - c)).toFixed(1)}px)` : undefined }}>
            <Arrow x={countX - 21} base={base} up={row.up} size={29} opacity={1} />
            <text x={countX} y={base} fontFamily={numFont} fontSize={C.countSize} fill={color}>{row.count}</text>
            <text transform={`translate(${C.countRight - unitW} ${base - 1}) scale(${C.unitSqueeze} 1)`} fontFamily={SANS} fontWeight={500} fontSize={C.unitSize} fill="#f0f0f0">{row.countUnit}</text>
          </g>
        )}
      </svg>
    </>
  );
};

const Pixels: React.FC<{ label: PixelLabel; i: number; total: number; frame: number }> = ({ label, i, total, frame }) => {
  const P = PIXELS[i]!;
  const Q = SQUARE;
  const cols = Math.max(1, Math.ceil(total / 2));
  const squares = Array.from({ length: Math.min(total, cols * 2) }, (_, k) => k);
  const pillIn = interpolate(frame - P.pillAt, [0, 14], [0, 1], clamp);
  const pillEase = 1 - Math.pow(1 - pillIn, 3);
  const pillFont = `700 40px ${SERIF}`;
  return (
    <>
      {squares.map((k) => {
        const row = Math.floor(k / cols);
        const col = k % cols;
        const at = row === 0 ? P.top + col * P.topRate : P.bottom + col;
        const u = interpolate(frame - at, [0, 2], [0, 1], clamp);
        if (u <= 0) return null;
        const lit = squareLit(k, label.wins, cols);
        const x = P.x + col * Q.pitch;
        const y = P.y + row * Q.rowGap;
        const sz = Q.size * (0.6 + 0.4 * u);
        return (
          <div
            key={k}
            style={{
              position: 'absolute', left: x + (Q.size - sz) / 2, top: y + (Q.size - sz) / 2, width: sz, height: sz, opacity: u,
              background: lit ? 'linear-gradient(135deg, #f19a35, #ffc86a)' : '#f3f3f1',
              boxShadow: lit ? '0 0 8px rgba(255,170,80,0.55)' : '0 0 7px rgba(255,255,255,0.45)',
            }}
          />
        );
      })}
      <TypedText
        chars={Array.from(label.text)} x={P.x - 1.5} base={P.textBase} rise={10} fill={PIXEL_TEXT.color} frame={frame} at={P.text} rate={1.1}
        font={() => ({ family: `"${BUNDLED_FONTS.archivoBlack.family}", sans-serif`, weight: 400, size: PIXEL_TEXT.size, sx: PIXEL_TEXT.sx, spacing: PIXEL_TEXT.spacing })}
      />
      {label.pill && pillIn > 0 && (
        <div
          style={{
            position: 'absolute', left: P.pill.x0, top: P.pill.y0 + 24 * (1 - pillEase), width: P.pill.x1 - P.pill.x0, height: P.pill.y1 - P.pill.y0,
            borderRadius: 14, border: `2px solid ${P.border}`, opacity: pillEase, boxSizing: 'border-box',
            background: `radial-gradient(ellipse 45% 70% at 50% 50%, rgba(255,255,255,0.16), rgba(255,255,255,0) 100%), linear-gradient(to right, ${P.fill[0]}, ${P.fill[1]})`,
            display: 'flex', alignItems: 'center', justifyContent: 'center', filter: pillIn < 1 ? `blur(${(4 * (1 - pillEase)).toFixed(1)}px)` : undefined,
          }}
        >
          <span style={{ font: pillFont, color: '#fbfbfb', textShadow: '0 0 6px rgba(255,255,255,0.7), 0 0 18px rgba(255,255,255,0.45)', lineHeight: 1 }}>{label.pill}</span>
        </div>
      )}
    </>
  );
};
