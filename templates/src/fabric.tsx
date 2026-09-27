import React from 'react';
import { AbsoluteFill } from 'remotion';
import { assetUrl } from './asset';
import { loadImage, useBaked } from './baked';

/**
 * 画面上一层不动的细布纹（每 3.2 像素一格、斜 10°）：几个截图类模板（同一个剪辑师）的画面都盖着它。
 * 纹理是乘在画面上的：亮的地方 ×(1+t)，t 在 ±几个百分点。CSS 只有「变亮」「变暗」两种混合，
 * 所以拆成两张图：t > 0 的部分用「颜色减淡」（结果 = 底 / (1 − s)，s = t/(1+t) 正好 ×(1+t)），
 * t < 0 的部分用「正片叠底」（s = 1+t）。
 *
 * 纹理图（可选）：1280×720 的灰度图，128 = 不变，每差 1 级 = t 变 1/510。不给就用下面几组波纹合成一张。
 */

/** 合成用的波纹：[横向频率, 竖向频率, 振幅, 相位]（频率单位：每像素几个周期） */
export const FABRIC_WAVES: readonly (readonly [number, number, number, number])[] = [
  [-0.31406, 0.055, 0.011, -0.7445],
  [0.05547, 0.315, 0.0058, 0.7183],
  [-0.0375, -0.17833, 0.0066, 1.3103],
  [0.31328, -0.055, 0.0064, 0.6675],
  [-0.05547, -0.31333, 0.0053, 2.9519],
  [0.05625, 0.315, 0.004, 0.5339],
  [0.03672, 0.17833, 0.0037, -1.3349],
  [-0.27656, -0.16, 0.003, -2.8082],
  [0.13594, -0.01833, 0.0027, -1.9491],
];

/** 合成纹理在 (x, y) 的 t 值 */
export function fabricValue(x: number, y: number, gain = 2): number {
  let t = 0;
  for (const [fx, fy, a, ph] of FABRIC_WAVES) t += a * Math.cos(2 * Math.PI * (fx * x + fy * y) + ph);
  return t * gain;
}

async function bakeFabric(src: string, kind: 'dodge' | 'multiply', strength: number): Promise<string | null> {
  if (typeof document === 'undefined') return null;
  const W = 1280;
  const H = 720;
  let ts: Float32Array;
  if (src) {
    const img = await loadImage(assetUrl(src));
    const c0 = document.createElement('canvas');
    c0.width = W;
    c0.height = H;
    const x0 = c0.getContext('2d');
    if (!x0) return null;
    x0.drawImage(img, 0, 0, W, H);
    const d = x0.getImageData(0, 0, W, H).data;
    ts = new Float32Array(W * H);
    for (let i = 0; i < W * H; i++) ts[i] = (d[i * 4]! - 128) / 510;
  } else {
    ts = new Float32Array(W * H);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) ts[y * W + x] = fabricValue(x, y);
  }
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const ctx = c.getContext('2d');
  if (!ctx) return null;
  const out = ctx.createImageData(W, H);
  for (let i = 0; i < W * H; i++) {
    const t = ts[i]! * strength;
    const v = kind === 'dodge' ? (t > 0 ? t / (1 + t) : 0) : t < 0 ? 1 + t : 1;
    const g = Math.max(0, Math.min(255, Math.round(v * 255)));
    out.data[i * 4] = g;
    out.data[i * 4 + 1] = g;
    out.data[i * 4 + 2] = g;
    out.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(out, 0, 0);
  return c.toDataURL('image/png');
}

/** 盖在整个画面最上面的细布纹 */
export const FabricOverlay: React.FC<{ src?: string; strength?: number }> = ({ src = '', strength = 1 }) => {
  const dodge = useBaked(`fabric:dodge:${strength}:${src}`, () => bakeFabric(src, 'dodge', strength));
  const multiply = useBaked(`fabric:multiply:${strength}:${src}`, () => bakeFabric(src, 'multiply', strength));
  const style: React.CSSProperties = { position: 'absolute', left: 0, top: 0, width: 1280, height: 720 };
  return (
    <AbsoluteFill style={{ pointerEvents: 'none' }}>
      {dodge && <img src={dodge} alt="" style={{ ...style, mixBlendMode: 'color-dodge' }} />}
      {multiply && <img src={multiply} alt="" style={{ ...style, mixBlendMode: 'multiply' }} />}
    </AbsoluteFill>
  );
};
