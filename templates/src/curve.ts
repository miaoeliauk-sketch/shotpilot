/**
 * 过关键帧的平滑曲线（单调三次插值，和 scipy 的 PCHIP 一样）：
 * 直线插值在每个关键帧上速度会突变，镜头看着一顿一顿的；这个速度是连续的，而且两个关键帧之间不会冲过头。
 * 关键帧外面保持端点的值（extendRight 时最后一个关键帧往后按那一刻的速度继续走）。
 */
export function smoothTrack(x: number, xs: readonly number[], ys: readonly number[], extendRight = false): number {
  const n = xs.length;
  if (n === 0) return 0;
  if (n === 1 || x <= xs[0]!) return ys[0]!;
  if (x >= xs[n - 1]!) {
    if (!extendRight || n < 2) return ys[n - 1]!;
    // 往后按最后那一刻的速度一直走（和曲线接得上）
    const e = 1e-3;
    const v = (ys[n - 1]! - smoothTrack(xs[n - 1]! - e, xs, ys)) / e;
    return ys[n - 1]! + v * (x - xs[n - 1]!);
  }
  let i = 0;
  while (i < n - 2 && x > xs[i + 1]!) i++;
  const h = (k: number) => xs[k + 1]! - xs[k]!;
  const d = (k: number) => (ys[k + 1]! - ys[k]!) / h(k);
  const endSlope = (h0: number, h1: number, d0: number, d1: number) => {
    const m = ((2 * h0 + h1) * d0 - h0 * d1) / (h0 + h1);
    if (Math.sign(m) !== Math.sign(d0)) return 0;
    if (Math.sign(d0) !== Math.sign(d1) && Math.abs(m) > Math.abs(3 * d0)) return 3 * d0;
    return m;
  };
  const slope = (k: number) => {
    if (n === 2) return d(0);
    if (k === 0) return endSlope(h(0), h(1), d(0), d(1));
    if (k === n - 1) return endSlope(h(n - 2), h(n - 3), d(n - 2), d(n - 3));
    const d0 = d(k - 1);
    const d1 = d(k);
    if (d0 === 0 || d1 === 0 || Math.sign(d0) !== Math.sign(d1)) return 0;
    const w1 = 2 * h(k) + h(k - 1);
    const w2 = h(k) + 2 * h(k - 1);
    return (w1 + w2) / (w1 / d0 + w2 / d1);
  };
  const hi = h(i);
  const t = (x - xs[i]!) / hi;
  const t2 = t * t;
  const t3 = t2 * t;
  return (2 * t3 - 3 * t2 + 1) * ys[i]! + (t3 - 2 * t2 + t) * hi * slope(i) + (-2 * t3 + 3 * t2) * ys[i + 1]! + (t3 - t2) * hi * slope(i + 1);
}
