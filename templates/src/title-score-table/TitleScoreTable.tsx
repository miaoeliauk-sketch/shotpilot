import React from 'react';
import { AbsoluteFill, Img, interpolate, useCurrentFrame } from 'remotion';
import { assetUrl } from '../asset';
import { useBaked } from '../baked';
import { BUNDLED_FONTS, useBundledFont } from '../fonts';
import { vignetteGradient } from '../lens';

/**
 * 复刻：灰纸上一行大小错落的宋体大标题（长 / 链路 / 测试）从四面滑进来、远处的字先虚后实，下面红色英文一个字母一个字母打出来，
 * 两只手各托一个齿轮升上来；然后镜头一路往下甩到一张三行的分数表：名字、分数一行行打出来，最后两格刷上黄色（239 帧，1280×720 @30fps）
 *
 * 按原片量的（「世界坐标」= 第 30 帧画面上的像素；表格在世界里往下 735）：
 *   标题：宋体特粗；「长」246px 横向压到 0.75、左 262 字底 354，「链路」162px 左 441 字底 392，「测试」115px 横向放宽 1.07、左 770 字底 337
 *   英文：Barlow 半粗斜体 74px，#b91f24，左 197 字底 422；第 0 帧起每帧打一个字母
 *   入场：每样东西带一个起始偏移，按指数衰减滑到位（「长」从左下 (−284, +177)、「链路」从下 (+13, +143)、「测试」从右下 (+68, +106)，
 *     齿轮和手一起从下面升上来）；「链路」「测试」前 12 帧从虚到实
 *   中间一条竖虚线（x 621，从 y 442 往下一直连到表格上面）
 *   镜头：第 32 帧起往下甩，越来越快，第 53 帧最快（每帧 47），第 80 帧停在表格上（一共 735）；原片甩的时候画面是清楚的，没有拖影
 *   表格：标题「SWE Marathon」Playfair 斜体 64px ＋ 中文宋体 56px，左 262 字底 242；
 *     三行：名字 Archivo Black 71px（第三行 Archivo 常规体 64px、横向压到 0.86），左 261，字底 353 / 447 / 540；
 *     分数 Archivo Black 68px 字距 0.08，右对齐到 1004；两条横线 y 373.5 / 468.5（x 246–1049），一条竖线 x 709（y 288–558）
 *     三行名字第 51 / 68 / 88 帧开始打，每行 7 帧打完；分数比名字晚 14 帧，每帧一个字；
 *     黄块 #d7a908（x 710–1049、y 292–467），第 107–116 帧从左往右刷出来
 *   表格停下后还有很轻的漂移（±10 像素）
 *   表格旁边四个虚化的装饰（原片是手托齿轮，大小相对装饰图自己的宽度）；镜头下甩时它们比表格先到，第 100 帧跟上
 *   纸：中间 #d6d6d3，四周暗到 0.79；整幅盖一层不动的细棋盘格（格子 2.547 像素，亮处起伏 ±6）
 * 只复刻画面，底部口播字幕不在模板里。
 */

export type ScoreRow = { name: string; value: string; heavy: boolean };
export type Cutout = { image: string; x: number; y: number; width: number };

export type TitleScoreTableProps = {
  words: [string, string, string];
  english: string;
  left: Cutout;
  right: Cutout;
  tableTitle: string;
  tableTitleCjk: string;
  rows: ScoreRow[];
  highlight: number;
  highlightColor: string;
  floaters: string;
  durationInFrames: number;
};

const SERIF = '"Noto Serif CJK SC", "Source Han Serif SC", "Songti SC", "STSong", serif';
const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;

export const WORDS = [
  { size: 246, left: 262, base: 354, sx: 0.75, from: [-284, 177], k: 0.145, blur: 0 },
  { size: 162, left: 441, base: 392, sx: 1, from: [13, 143], k: 0.128, blur: 8 },
  { size: 115, left: 770, base: 337, sx: 1.07, from: [68, 106], k: 0.11, blur: 8 },
] as const;
export const ENGLISH = { size: 74, left: 197, base: 422, color: '#b91f24', from: [13, 33], k: 0.08 };
export const CUT_FROM = { left: { from: [13, 33], k: 0.07 }, right: { from: [14, 175], k: 0.095 } };
export const TABLE = {
  offset: 735,
  title: { left: 262, base: 242, latin: 64, cjk: 56 },
  rows: { left: 261, bases: [353, 447, 540], name: 71, light: 64, lightSqueeze: 0.86, value: 68, valueRight: 1004 },
  lines: { ys: [373.5, 468.5], x0: 246, x1: 1049, vx: 709, vy0: 288, vy1: 558 },
  highlight: { x0: 710, x1: 1049, y0: 292, rowH: 87.5 },
  /** 三行名字开始打的帧；名字 7 帧打完（不管几个字），分数晚 14 帧、每帧一个字 */
  rowAt: [51, 68, 88], nameFrames: 7, valueLag: 14, highlightAt: 107,
};

const CAM_T = [32, 34, 38, 42, 44, 46, 48, 50, 51, 52, 53, 54, 55, 56, 57, 58, 59, 62, 64, 66, 68, 72, 75, 80];
const CAM_Y = [0, -9, -32, -68, -99, -136, -186, -259, -300, -345, -390, -437, -480, -518, -550, -577, -601, -653, -679, -696, -710, -726, -732, -735];
const DRIFT_T = [80, 90, 100, 110, 120, 130, 150, 170, 190, 210, 238];
const DRIFT_X = [0, 5, 10, 14, 15, 14, 7, 0, -2, 4, 13];
const DRIFT_Y = [0, 2, 4, 4, 4, 2, -4, -10, -13, -12, -14];

/** 镜头往下甩：世界往上移了多少 */
export function cameraY(frame: number): number {
  return interpolate(frame, CAM_T, CAM_Y, clamp);
}

/** 入场：起始偏移按指数衰减 */
export function settle(from: readonly number[], k: number, frame: number): [number, number] {
  const e = Math.exp(-k * Math.max(0, frame));
  return [from[0]! * e, from[1]! * e];
}

/** 打字：第 at 帧起每帧一个字；给了 frames 就是不管几个字都在这么多帧里打完 */
export function typedCount(frame: number, at: number, total: number, frames?: number): number {
  if (frame < at) return 0;
  const t = Math.floor(frame - at) + 1;
  return Math.min(total, frames ? Math.ceil((total * t) / frames) : t);
}

/** 表格停下后的漂移 */
export function drift(frame: number): [number, number] {
  return [interpolate(frame, DRIFT_T, DRIFT_X, clamp), interpolate(frame, DRIFT_T, DRIFT_Y, clamp)];
}

/**
 * 纸面的细网格：原片整幅画面叠了一层不动的细棋盘格（格子 2.547 像素、正方向排），亮处起伏 ±6 左右。
 * 两组斜着的余弦波叠出来，相位按原片量的；画一次，之后每帧以「叠加」方式盖上去。
 */
export const GRID = {
  /** 每组波纹：[横向频率, 竖向频率, cos 系数, sin 系数]（频率单位：每像素几个周期） */
  waves: [
    [0.1963, 0.1963, -6.17, -1.66],
    [0.1963, -0.1963, -4.76, 3.99],
    [0.314, -0.0555, -0.74, -4.09],
    [0.0552, 0.314, -2.91, 0.7],
    [0.2763, 0.1597, -0.72, 1.88],
    [0.0376, 0.1782, 0.3, 2.15],
  ] as const,
  gain: 2.18,
};

/** 细网格在像素 (x, y) 处让亮度起伏多少（前两组是主体的棋盘格，后面几组是原片网格缩放时带出来的斜纹） */
export function gridValue(x: number, y: number): number {
  let v = 0;
  for (const [fx, fy, c, sn] of GRID.waves) {
    const ph = 2 * Math.PI * (fx * x + fy * y);
    v += c * Math.cos(ph) + sn * Math.sin(ph);
  }
  return v;
}

async function bakeGrid(): Promise<string | null> {
  if (typeof document === 'undefined') return null;
  const c = document.createElement('canvas');
  c.width = 1280;
  c.height = 720;
  const ctx = c.getContext('2d');
  if (!ctx) return null;
  const img = ctx.createImageData(1280, 720);
  for (let y = 0; y < 720; y++) {
    for (let x = 0; x < 1280; x++) {
      const g = Math.max(0, Math.min(255, Math.round(128 + GRID.gain * gridValue(x, y))));
      const k = (y * 1280 + x) * 4;
      img.data[k] = g;
      img.data[k + 1] = g;
      img.data[k + 2] = g;
      img.data[k + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return c.toDataURL('image/png');
}

export const TitleScoreTable: React.FC<TitleScoreTableProps> = (p) => {
  const frame = useCurrentFrame();
  const fonts = [useBundledFont('barlowItalic'), useBundledFont('archivoBlack'), useBundledFont('archivo'), useBundledFont('playfairItalic')];
  const ready = fonts.every(Boolean);
  const grid = useBaked('title-score-table-grid', bakeGrid);
  const cam = cameraY(frame);
  const [dx, dy] = frame > 80 ? drift(frame) : [0, 0];
  const worldStyle: React.CSSProperties = { transform: `translate(${dx.toFixed(2)}px, ${(cam + dy).toFixed(2)}px)` };
  return (
    <AbsoluteFill style={{ backgroundColor: '#d6d6d3', overflow: 'hidden' }}>
      <AbsoluteFill style={worldStyle}>
        {frame < 70 && <TitleScene {...p} frame={frame} ready={ready} />}
        {/* 竖虚线：从标题下面一直连到表格上面 */}
        <div style={{ position: 'absolute', left: 621, top: 442, width: 0, height: TABLE.offset + 190 - 442, borderLeft: '2px dotted rgba(40,40,40,0.55)' }} />
        {frame >= 40 && ready && (
          <div style={{ position: 'absolute', left: 0, top: TABLE.offset, width: 1280, height: 720 }}>
            <TableScene {...p} frame={frame} />
          </div>
        )}
      </AbsoluteFill>
      <AbsoluteFill style={{ background: vignetteGradient({ cx: 640, cy: 380, rx: 760, ry: 480, amount: 0.24, power: 2.2 }) }} />
      {grid && <img src={grid} alt="" style={{ position: 'absolute', left: 0, top: 0, width: 1280, height: 720, mixBlendMode: 'overlay' }} />}
    </AbsoluteFill>
  );
};

const CutoutImg: React.FC<{ c: Cutout; off: [number, number]; blur?: number; scale?: number }> = ({ c, off, blur = 0, scale = 1 }) =>
  c.image ? (
    <Img
      src={assetUrl(c.image)}
      style={{
        position: 'absolute', left: c.x + off[0], top: c.y + off[1], width: c.width * scale, height: 'auto',
        filter: `${blur > 0.3 ? `blur(${blur.toFixed(1)}px) ` : ''}drop-shadow(-6px 10px 10px rgba(0,0,0,0.28))`,
      }}
    />
  ) : null;

const TitleScene: React.FC<TitleScoreTableProps & { frame: number; ready: boolean }> = ({ words, english, left, right, frame, ready }) => {
  const letters = Array.from(english);
  const typed = typedCount(frame, 0, letters.length);
  const eOff = settle(ENGLISH.from, ENGLISH.k, frame);
  return (
    <AbsoluteFill>
      <CutoutImg c={left} off={settle(CUT_FROM.left.from, CUT_FROM.left.k, frame)} />
      <CutoutImg c={right} off={settle(CUT_FROM.right.from, CUT_FROM.right.k, frame)} />
      {WORDS.map((w, i) => {
        const text = words[i];
        if (!text) return null;
        const [ox, oy] = settle(w.from, w.k, frame);
        const blur = w.blur * interpolate(frame, [0, 12], [1, 0], clamp);
        return (
          <svg key={i} width={1280} height={720} style={{ position: 'absolute', left: ox, top: oy, overflow: 'visible', filter: blur > 0.3 ? `blur(${blur.toFixed(1)}px)` : undefined }}>
            <text x={0} y={0} transform={`translate(${w.left} ${w.base}) scale(${w.sx} 1)`} fontFamily={SERIF} fontWeight={900} fontSize={w.size} fill="#1b1b1b" style={{ filter: 'drop-shadow(-2px 3px 2px rgba(0,0,0,0.12))' }}>
              {text}
            </text>
          </svg>
        );
      })}
      {ready && typed > 0 && (
        <svg width={1280} height={720} style={{ position: 'absolute', left: eOff[0], top: eOff[1], overflow: 'visible' }}>
          <text x={ENGLISH.left} y={ENGLISH.base} fontFamily={`"${BUNDLED_FONTS.barlowItalic.family}", sans-serif`} fontSize={ENGLISH.size} fill={ENGLISH.color} style={{ whiteSpace: 'pre' }}>
            {letters.slice(0, typed).join('')}
          </text>
        </svg>
      )}
    </AbsoluteFill>
  );
};

/**
 * 表格旁边飘着的几个虚化装饰（原片是手托齿轮）：cx/cy 是图中心（表格坐标），scale 是相对装饰图自己设的宽度（至少 min 像素宽）。
 * 按原片逐帧对出来的；镜头下甩时它们比表格先到（离得近），第 100 帧跟上表格。
 */
export const FLOATERS = [
  { img: 'left', cx: 122.5, cy: 236, scale: 0.25, min: 90, blur: 14 },
  { img: 'right', cx: 305.5, cy: 660, scale: 0.842, min: 160, blur: 5 },
  { img: 'right', cx: 1338, cy: 380, scale: 0.63, min: 170, blur: 20 },
  { img: 'right', cx: 1142.5, cy: 591, scale: 0.449, min: 120, blur: 5 },
] as const;
const LEAD_T = [50, 54, 56, 58, 60, 62, 64, 66, 70, 74, 80, 90, 100];
const LEAD_Y = [-80, -80, -72, -55, -45, -35, -28, -24, -21, -16, -10, -3, 0];

/** 镜头下甩时装饰图比表格往上多走了多少 */
export function floatLead(frame: number): number {
  return interpolate(frame, LEAD_T, LEAD_Y, clamp);
}

const Floater: React.FC<{ c: Cutout; cx: number; cy: number; width: number; blur: number }> = ({ c, cx, cy, width, blur }) =>
  c.image ? (
    <Img
      src={assetUrl(c.image)}
      style={{
        position: 'absolute', left: cx, top: cy, width, height: 'auto', transform: 'translate(-50%, -50%)',
        filter: `blur(${blur}px) drop-shadow(-6px 10px 10px rgba(0,0,0,0.28))`,
      }}
    />
  ) : null;

const TableScene: React.FC<TitleScoreTableProps & { frame: number }> = ({ tableTitle, tableTitleCjk, rows, highlight, highlightColor, left, right, floaters, frame }) => {
  const T = TABLE;
  const hl = interpolate(frame, [T.highlightAt, T.highlightAt + 2, T.highlightAt + 5, T.highlightAt + 9], [0, 0.3, 0.72, 1], clamp);
  const n = Math.min(3, rows.length);
  const hlRows = Math.max(0, Math.min(n, highlight));
  const lineIn = (i: number) => interpolate(frame, [T.rowAt[i]! + 2, T.rowAt[i]! + 10], [0, 1], clamp);
  return (
    <AbsoluteFill>
      {floaters !== 'none' &&
        FLOATERS.map((f, i) => {
          const c = f.img === 'left' ? left : right;
          return <Floater key={i} c={c} cx={f.cx} cy={f.cy + floatLead(frame)} width={Math.max(f.min, c.width * f.scale)} blur={f.blur} />;
        })}
      {/* 黄块：从左往右刷出来 */}
      {hlRows > 0 && hl > 0 && (
        <div
          style={{
            position: 'absolute', left: T.highlight.x0, top: T.highlight.y0, width: (T.highlight.x1 - T.highlight.x0) * hl, height: T.highlight.rowH * hlRows,
            background: highlightColor,
          }}
        />
      )}
      {/* 格线 */}
      {T.lines.ys.slice(0, Math.max(0, n - 1)).map((y, i) => (
        <div key={i} style={{ position: 'absolute', left: T.lines.x0, top: y - 0.75, width: (T.lines.x1 - T.lines.x0) * lineIn(i), height: 1.5, background: 'rgba(90,90,90,0.55)' }} />
      ))}
      {n > 0 && (
        <div style={{ position: 'absolute', left: T.lines.vx - 0.75, top: T.lines.vy0, width: 1.5, height: (T.lines.vy1 - T.lines.vy0) * interpolate(frame, [T.rowAt[0]! + 2, T.rowAt[0]! + 22], [0, 1], clamp), background: 'rgba(90,90,90,0.55)' }} />
      )}
      {/* 表格标题 */}
      <svg width={1280} height={720} style={{ position: 'absolute', left: 0, top: 0, overflow: 'visible' }}>
        <text x={T.title.left} y={T.title.base} fill="#1c1c1c" style={{ whiteSpace: 'pre' }}>
          <tspan fontFamily={`"${BUNDLED_FONTS.playfairItalic.family}", serif`} fontSize={T.title.latin} letterSpacing="0.03em">{tableTitle}</tspan>
          <tspan fontFamily={SERIF} fontWeight={700} fontSize={T.title.cjk}>{tableTitleCjk}</tspan>
        </text>
      </svg>
      {rows.slice(0, 3).map((r, i) => {
        const at = T.rowAt[i]!;
        const nameChars = Array.from(r.name);
        const valChars = Array.from(r.value);
        const nName = typedCount(frame, at, nameChars.length, T.nameFrames);
        const nVal = typedCount(frame, at + T.valueLag, valChars.length);
        const base = T.rows.bases[i]!;
        const size = r.heavy ? T.rows.name : T.rows.light;
        return (
          <svg key={i} width={1280} height={720} style={{ position: 'absolute', left: 0, top: 0, overflow: 'visible' }}>
            {nName > 0 && (
              <text
                x={0} y={0} transform={`translate(${T.rows.left} ${base}) scale(${r.heavy ? 1 : T.rows.lightSqueeze} 1)`} fontSize={size} fill="#141414" style={{ whiteSpace: 'pre' }}
                fontFamily={r.heavy ? `"${BUNDLED_FONTS.archivoBlack.family}", sans-serif` : `"${BUNDLED_FONTS.archivo.family}", sans-serif`}
              >
                {nameChars.slice(0, nName).join('')}
              </text>
            )}
            {nVal > 0 && (
              // 右对齐、从左往右打：没打出来的字先占着位置（透明）
              <text x={T.rows.valueRight} y={base} textAnchor="end" fontSize={T.rows.value} letterSpacing="0.08em" fill="#141414" fontFamily={`"${BUNDLED_FONTS.archivoBlack.family}", sans-serif`} style={{ whiteSpace: 'pre' }}>
                {valChars.map((ch, k) => <tspan key={k} fillOpacity={k < nVal ? 1 : 0}>{ch}</tspan>)}
              </text>
            )}
          </svg>
        );
      })}
    </AbsoluteFill>
  );
};
