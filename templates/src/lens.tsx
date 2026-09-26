import React from 'react';
import { AbsoluteFill } from 'remotion';

/**
 * 镜头效果：暗角、横向景深。几个截图类模板（同一个剪辑师的风格）共用。
 */

/** 暗角：椭圆中心、半径，变暗 amount × d^power（d = 到中心的椭圆距离，1 = 椭圆边上） */
export type Vignette = { cx: number; cy: number; rx: number; ry: number; amount: number; power: number };

export function vignetteGradient(v: Vignette): string {
  const stops: string[] = [];
  for (let d = 0; d <= 1.75; d += 0.125) {
    const a = Math.min(1, v.amount * Math.pow(d, v.power));
    stops.push(`rgba(0,0,0,${a.toFixed(3)}) ${(d * 100).toFixed(1)}%`);
    if (a >= 1) break;
  }
  return `radial-gradient(ellipse ${v.rx}px ${v.ry}px at ${v.cx}px ${v.cy}px, ${stops.join(', ')})`;
}

/**
 * 横向景深：虚的程度 = k × |x − cx|^power（默认平方），中间一竖条是实的，往左右越来越虚。
 * CSS 做不了逐像素的虚，用三层叠：很虚（far）、有点虚（mid = 2px）、实的，按横向渐变混。
 */
export function tiltMasks(cx: number, k: number, far: number, power = 2, width = 1280): { mid: string; sharp: string } {
  const mid: string[] = [];
  const sharp: string[] = [];
  for (let x = 0; x <= width; x += width / 20) {
    const b = k * Math.pow(Math.abs(x - cx), power);
    const pct = `${((x / width) * 100).toFixed(1)}%`;
    const s = Math.max(0, 1 - b / 2);
    const m = b <= 2 ? 1 : Math.max(0, (far - b) / (far - 2));
    sharp.push(`rgba(0,0,0,${s.toFixed(3)}) ${pct}`);
    mid.push(`rgba(0,0,0,${m.toFixed(3)}) ${pct}`);
  }
  return { mid: `linear-gradient(to right, ${mid.join(', ')})`, sharp: `linear-gradient(to right, ${sharp.join(', ')})` };
}

export const TiltShift: React.FC<{ cx: number; k: number; power?: number; far?: number; farStyle?: React.CSSProperties; children: React.ReactNode }> = ({ cx, k, power = 2, far = 6, farStyle, children }) => {
  const m = tiltMasks(cx, k, far, power);
  return (
    <>
      <AbsoluteFill style={{ filter: `blur(${far}px)`, ...farStyle }}>{children}</AbsoluteFill>
      <AbsoluteFill style={{ filter: 'blur(2px)', WebkitMaskImage: m.mid, maskImage: m.mid }}>{children}</AbsoluteFill>
      <AbsoluteFill style={{ WebkitMaskImage: m.sharp, maskImage: m.sharp }}>{children}</AbsoluteFill>
    </>
  );
};

/**
 * 两边虚、中间实：一份清楚的、一份虚的，用互补的横向渐变遮罩叠起来。
 * |x − cx| < inner 全清楚，> outer 全虚，中间线性过渡。和 TiltShift 不同，中间这一段下面没有虚的那份，字边不会发毛。
 */
export const EdgeBlur: React.FC<{ cx: number; inner: number; outer: number; blur: number; farStyle?: React.CSSProperties; width?: number; children: React.ReactNode }> = ({ cx, inner, outer, blur, farStyle, width = 1280, children }) => {
  const pct = (x: number) => `${((x / width) * 100).toFixed(2)}%`;
  const far = `linear-gradient(to right, #000 ${pct(cx - outer)}, transparent ${pct(cx - inner)}, transparent ${pct(cx + inner)}, #000 ${pct(cx + outer)})`;
  const near = `linear-gradient(to right, transparent ${pct(cx - outer)}, #000 ${pct(cx - inner)}, #000 ${pct(cx + inner)}, transparent ${pct(cx + outer)})`;
  return (
    <>
      <AbsoluteFill style={{ filter: `blur(${blur}px)`, WebkitMaskImage: far, maskImage: far, ...farStyle }}>{children}</AbsoluteFill>
      <AbsoluteFill style={{ WebkitMaskImage: near, maskImage: near }}>{children}</AbsoluteFill>
    </>
  );
};
