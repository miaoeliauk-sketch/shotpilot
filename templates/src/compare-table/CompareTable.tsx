import React from 'react';
import { AbsoluteFill, interpolate, useCurrentFrame } from 'remotion';
import { EdgeBlur, vignetteGradient } from '../lens';

/**
 * 复刻：墨绿底上一张「对比表」：表头、每一格一个接一个从虚到实亮起来，数值后面跟绿色上箭头 / 红色下箭头，最后两行小字注释；
 * 镜头从 0.88 倍慢慢推到 1 倍再往回一点点（89 帧，1280×720 @30fps）
 *
 * 按原片量的（第 63 帧、镜头 1 倍）：
 *   表头：左边中文粗体 62px（x 123，字底 218），两个对比对象斜体 61px（x 469 / 766，字底 219），白色带一圈光
 *   三行：行名粗体 33px（x 122），两列斜体 32px（x 418 / 824），字底 317 / 389 / 453；
 *     箭头高 50、宽 26，跟在数值后面空 14：上涨绿（#72f968），下跌红（#fe5042）
 *   注释：23px 灰色，x 122，字底 513 / 554，从左往右扫出来
 *   出场顺序：表头三格第 2、4、6 帧，之后每一格晚 2 帧（一行三格），每格 6 帧从虚到实；注释第 30、34 帧起各扫 8 帧
 *   画面两边虚、带一点红蓝错色（像镜头边缘）
 * 只复刻画面，底部口播字幕不在模板里。
 */

export type Trend = 'up' | 'down' | 'none';
export type CompareRow = { label: string; a: string; aTrend: Trend; b: string; bTrend: Trend };

export type CompareTableProps = {
  head: string;
  colA: string;
  colB: string;
  rows: CompareRow[];
  note: string[];
  durationInFrames: number;
};

const SANS = '"Noto Sans CJK SC", "PingFang SC", "Source Han Sans SC", "Hiragino Sans GB", sans-serif';
const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;

export const LAYOUT = {
  head: { x: 123, base: 218, size: 62 },
  cols: { a: 469, b: 766, base: 219, size: 61 },
  rows: { label: 122, a: 418, b: 824, bases: [317, 389, 453], labelSize: 33, size: 32 },
  arrow: { h: 50, w: 26, gap: 14 },
  note: { x: 122, bases: [513, 554], size: 23 },
};

const CAM_T = [0, 4, 8, 12, 16, 20, 24, 28, 32, 36, 40, 44, 50, 56, 63, 70, 76, 82, 88];
const CAM_S = [0.88, 0.9069, 0.932, 0.9447, 0.9556, 0.9645, 0.9721, 0.9785, 0.9838, 0.9881, 0.9916, 0.9944, 0.9978, 0.9994, 1, 0.9995, 0.9982, 0.9961, 0.9933];

export function cameraScale(frame: number): number {
  return interpolate(frame, CAM_T, CAM_S, { extrapolateLeft: 'clamp', extrapolateRight: 'extend' });
}

/** 第 k 格（按阅读顺序：表头 0–2，之后每行 3 格）亮起来的程度 */
export function cellIn(frame: number, k: number): number {
  const start = k < 3 ? 2 + 2 * k : 10 + 2 * (k - 3) - 2 * Math.floor((k - 3) / 3);
  return interpolate(frame, [start, start + 6], [0, 1], clamp);
}

export const CompareTable: React.FC<CompareTableProps> = (p) => {
  const frame = useCurrentFrame();
  const s = cameraScale(frame);
  const rows = p.rows.slice(0, 3);
  const cell = (k: number, children: React.ReactNode, style: React.CSSProperties) => {
    const u = cellIn(frame, k);
    if (u <= 0) return null;
    return (
      <div key={k} style={{ position: 'absolute', whiteSpace: 'pre', lineHeight: 1, opacity: u, filter: u < 0.98 ? `blur(${(5 * (1 - u)).toFixed(1)}px)` : undefined, ...style }}>
        {children}
      </div>
    );
  };
  const L = LAYOUT;
  const glow = '0 0 6px rgba(255,255,255,0.3)';
  return (
    <AbsoluteFill style={{ backgroundColor: '#0d160c', overflow: 'hidden' }}>
      <AbsoluteFill style={{ background: 'linear-gradient(100deg, rgb(16,19,13) 0%, rgb(12,24,10) 45%, rgb(6,31,5) 100%)' }} />
      <AbsoluteFill style={{ background: 'radial-gradient(ellipse 520px 300px at 520px 330px, rgba(40,60,35,0.35), rgba(0,0,0,0) 100%)' }} />
      <EdgeBlur cx={640} inner={420} outer={700} blur={2.5} farStyle={{ filter: 'blur(3px) drop-shadow(-3px 0 0 rgba(230,60,60,0.35)) drop-shadow(3px 0 0 rgba(60,150,235,0.35))' }}>
        <AbsoluteFill style={{ transformOrigin: '640px 360px', transform: `scale(${s.toFixed(4)})` }}>
          {cell(0, p.head, { left: L.head.x, top: L.head.base - L.head.size * 0.88, fontFamily: SANS, fontWeight: 700, fontSize: L.head.size, color: '#f4f4f0', textShadow: glow })}
          {cell(1, p.colA, { left: L.cols.a, top: L.cols.base - L.cols.size * 0.92, fontFamily: SANS, fontWeight: 400, fontStyle: 'italic', fontSize: L.cols.size, color: '#f4f4f0', textShadow: '0 0 4px rgba(255,255,255,0.25)' })}
          {cell(2, <ColName text={p.colB} />, { left: L.cols.b, top: L.cols.base - L.cols.size * 0.92, fontFamily: SANS, fontWeight: 400, fontStyle: 'italic', fontSize: L.cols.size, color: '#f4f4f0', textShadow: '0 0 4px rgba(255,255,255,0.25)' })}
          {rows.map((r, i) => {
            const base = L.rows.bases[i]!;
            const k = 3 + i * 3;
            const val = (text: string, trend: Trend) => (
              <span style={{ position: 'relative' }}>
                {text}
                {trend !== 'none' && <Arrow up={trend === 'up'} />}
              </span>
            );
            return (
              <React.Fragment key={i}>
                {cell(k, r.label, { left: L.rows.label, top: base - L.rows.labelSize * 0.88, fontFamily: SANS, fontWeight: 700, fontSize: L.rows.labelSize, color: '#ecece8', textShadow: '0 0 6px rgba(255,255,255,0.3)' })}
                {cell(k + 1, val(r.a, r.aTrend), { left: L.rows.a, top: base - L.rows.size * 1.03, fontFamily: SANS, fontStyle: 'italic', fontSize: L.rows.size, color: '#f0f0ec' })}
                {cell(k + 2, val(r.b, r.bTrend), { left: L.rows.b, top: base - L.rows.size * 1.03, fontFamily: SANS, fontStyle: 'italic', fontSize: L.rows.size, color: '#f0f0ec' })}
              </React.Fragment>
            );
          })}
          {p.note.slice(0, 2).map((line, i) => {
            const u = interpolate(frame, [30 + 4 * i, 38 + 4 * i], [0, 1], clamp);
            if (u <= 0 || !line) return null;
            return (
              <div key={`n${i}`} style={{ position: 'absolute', left: L.note.x, top: L.note.bases[i]! - L.note.size * 0.88, whiteSpace: 'pre', fontFamily: SANS, fontSize: L.note.size, lineHeight: 1, color: '#bfc2bb', clipPath: `inset(-6px ${((1 - u) * 100).toFixed(1)}% -6px -6px)` }}>
                {line}
              </div>
            );
          })}
        </AbsoluteFill>
      </EdgeBlur>
      <AbsoluteFill style={{ background: vignetteGradient({ cx: 640, cy: 360, rx: 760, ry: 470, amount: 0.4, power: 2.4 }) }} />
    </AbsoluteFill>
  );
};

/** 对比对象的名字：最后一段是数字就加粗（像原片的「Fable 5」） */
const ColName: React.FC<{ text: string }> = ({ text }) => {
  const m = /^(.*\s)(\d+)$/.exec(text);
  if (!m) return <>{text}</>;
  return (<>{m[1]}<span style={{ fontWeight: 700 }}>{m[2]}</span></>);
};

const Arrow: React.FC<{ up: boolean }> = ({ up }) => {
  const { h, w, gap } = LAYOUT.arrow;
  const c = up ? '#72f968' : '#fe5042';
  return (
    <svg width={w} height={h} viewBox="0 0 26 50" style={{ position: 'absolute', left: `calc(100% + ${gap}px)`, bottom: up ? 4 : -2, overflow: 'visible', filter: `drop-shadow(0 0 4px ${up ? 'rgba(110,250,100,0.5)' : 'rgba(255,80,60,0.5)'})` }}>
      <g transform={up ? undefined : 'rotate(180 13 25)'} fill="none" stroke={c} strokeWidth={4.5} strokeLinecap="round" strokeLinejoin="round">
        <path d="M13 47 L13 5" />
        <path d="M3 15 L13 4 L23 15" />
      </g>
    </svg>
  );
};
