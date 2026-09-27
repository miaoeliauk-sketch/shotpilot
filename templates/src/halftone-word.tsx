import React from 'react';
import { AbsoluteFill } from 'remotion';
import { useBaked } from './baked';

/**
 * 网点大字：粗黑体往右斜、横向拉宽，灰白渐变上面一层 30° 斜着的细网点，外轮廓一圈细橙边（原片的红蓝错色），
 * 左下一层贴身的深影和一层软影。几个「视频上压一个大字」的模板共用（同一个剪辑师的风格）。
 *
 * 影子每帧都一样，每帧现算模糊很慢：用 canvas 预先画一张影子图，每帧直接贴（画不出来就退回 SVG 滤镜现算）。
 */

export const HEAVY = '"Noto Sans CJK SC", "Source Han Sans SC", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif';

export type HalftoneStyle = {
  /** 往右斜多少度 */
  skew: number;
  /** 横向拉宽 */
  stretch: number;
  /** 字距（字号的倍数） */
  spacing: number;
  /** 笔画加粗：同色描边的宽度（字号的倍数）；原片的字比思源黑体最粗那档还粗 */
  bolder: number;
  top: string;
  bottom: string;
  /** 网点的强弱（0–1） */
  dots: number;
  /** 外轮廓的橙边：垫一层放大这么多倍的橙色字形，0 不要 */
  fringe: number;
};

export const HALFTONE: HalftoneStyle = { skew: 8, stretch: 1.28, spacing: -0.04, bolder: 0.026, top: '#bebebe', bottom: '#959c9f', dots: 0.6, fringe: 0.004 };

type Props = {
  id: string;
  text: string;
  size: number;
  /** 视觉中心的横坐标 */
  cx: number;
  baseline: number;
  style?: HalftoneStyle;
};

/** 字的变换：原点在字底中间（text-anchor middle），先拉宽再斜切；字身中间（字底往上 0.4 个字号）落在 cx */
function geometry(size: number, cx: number, baseline: number, s: HalftoneStyle) {
  const tan = Math.tan((s.skew * Math.PI) / 180);
  const ox = cx - 0.4 * size * tan;
  return { tan, ox, matrix: [s.stretch, 0, -tan, 1, ox, baseline], spacing: s.spacing * size, stroke: s.bolder * size };
}

const SHADOWS = [
  { dx: -5, dy: 9, blur: 9, alpha: 0.55 },
  { dx: -2, dy: 3, blur: 1.5, alpha: 0.85 },
];

async function bakeShadow(text: string, size: number, cx: number, baseline: number, s: HalftoneStyle): Promise<string | null> {
  if (typeof document === 'undefined') return null;
  await document.fonts.load(`900 ${size}px ${HEAVY}`, text);
  const g = geometry(size, cx, baseline, s);
  // 先把字（填充＋加粗描边）画成一层不透明的黑，再按每层影子的偏移、模糊、深浅合到结果上
  const shape = document.createElement('canvas');
  shape.width = 1280;
  shape.height = 720;
  const sc = shape.getContext('2d');
  const out = document.createElement('canvas');
  out.width = 1280;
  out.height = 720;
  const oc = out.getContext('2d');
  if (!sc || !oc) return null;
  sc.setTransform(g.matrix[0]!, g.matrix[1]!, g.matrix[2]!, g.matrix[3]!, g.matrix[4]!, g.matrix[5]!);
  sc.font = `900 ${size}px ${HEAVY}`;
  sc.textAlign = 'center';
  sc.textBaseline = 'alphabetic';
  (sc as unknown as { letterSpacing: string }).letterSpacing = `${g.spacing.toFixed(2)}px`;
  sc.fillStyle = '#000';
  sc.fillText(text, 0, 0);
  if (g.stroke > 0) {
    sc.lineWidth = g.stroke;
    sc.lineJoin = 'miter';
    sc.strokeStyle = '#000';
    sc.strokeText(text, 0, 0);
  }
  for (const sh of SHADOWS) {
    oc.save();
    oc.filter = `blur(${sh.blur}px)`;
    oc.globalAlpha = sh.alpha;
    oc.drawImage(shape, sh.dx, sh.dy);
    oc.restore();
  }
  return out.toDataURL('image/png');
}

export const HalftoneWord: React.FC<Props> = ({ id, text, size, cx, baseline, style = HALFTONE }) => {
  const g = geometry(size, cx, baseline, style);
  const shadow = useBaked(
    `halftone-shadow|${text}|${size.toFixed(2)}|${cx.toFixed(2)}|${baseline}|${style.skew}|${style.stretch}|${style.spacing}|${style.bolder}`,
    () => bakeShadow(text, size, cx, baseline, style),
  );
  const textProps = {
    x: 0, y: 0, textAnchor: 'middle' as const, transform: `matrix(${g.matrix.map((v) => Number(v.toFixed(4))).join(' ')})`,
    fontFamily: HEAVY, fontWeight: 900, fontSize: size, strokeWidth: g.stroke, strokeLinejoin: 'miter' as const,
    style: { letterSpacing: `${g.spacing.toFixed(2)}px` },
  };
  // 橙边那一层：以字身中间为中心放大一点点，只在外轮廓露出一圈
  const my = baseline - 0.4 * size;
  return (
    <AbsoluteFill>
      {shadow && <img src={shadow} alt="" style={{ position: 'absolute', left: 0, top: 0, width: 1280, height: 720 }} />}
      <svg width={1280} height={720} style={{ position: 'absolute', left: 0, top: 0, overflow: 'visible' }}>
        <defs>
          {/* 字带着自己的变换（原点在字底中间），渐变坐标也在这个坐标系里：字顶 −0.9×字号 → 字底 0 */}
          <linearGradient id={`${id}-fill`} gradientUnits="userSpaceOnUse" x1={0} y1={-0.9 * size} x2={0} y2={0}>
            <stop offset={0} stopColor={style.top} />
            <stop offset={1} stopColor={style.bottom} />
          </linearGradient>
          {/* 网点：亮点和暗点错开排（像棋盘），间距 3.65、斜 30° */}
          <pattern id={`${id}-dots`} width={3.65} height={3.65} patternUnits="userSpaceOnUse" patternTransform="rotate(30)">
            <circle cx={0.9125} cy={0.9125} r={0.95} fill="#fff" />
            <circle cx={2.7375} cy={2.7375} r={0.9} fill="#000" fillOpacity={0.3} />
          </pattern>
          <mask id={`${id}-mask`}>
            <text {...textProps} fill="#fff" stroke="#fff">{text}</text>
          </mask>
          {!shadow && (
            <filter id={`${id}-shadow`} x="-20%" y="-40%" width="140%" height="180%">
              {SHADOWS.map((sh, i) => <feDropShadow key={i} dx={sh.dx} dy={sh.dy} stdDeviation={sh.blur} floodColor="#000" floodOpacity={sh.alpha} />)}
            </filter>
          )}
        </defs>
        {style.fringe > 0 && (
          <g transform={`translate(${cx} ${my}) scale(${1 + style.fringe}) translate(${-cx} ${-my})`}>
            <text {...textProps} fill="rgb(235,140,60)" stroke="rgb(235,140,60)" opacity={0.85}>{text}</text>
          </g>
        )}
        <g filter={shadow ? undefined : `url(#${id}-shadow)`}>
          <text {...textProps} fill={`url(#${id}-fill)`} stroke={`url(#${id}-fill)`}>{text}</text>
        </g>
        {style.dots > 0 && <rect x={0} y={0} width={1280} height={720} fill={`url(#${id}-dots)`} opacity={style.dots} mask={`url(#${id}-mask)`} />}
      </svg>
    </AbsoluteFill>
  );
};
