/**
 * 墨迹转场的遮罩：干笔刷一样的墨迹一道道扫过去，露出下面的新闻稿。
 *
 * 做法：先算一张「先后顺序图」——每个点在转场的第几帧被墨迹扫到，
 * 再每帧拿进度去卡阈值，低于进度的地方就透出新闻稿。
 * 顺序图 = 大致先后（原片逐帧量出来的 16×9 粗网格：右上最早，左下角另一股也早，左上、正下方、右下最晚）
 *        + 斜着拉长的条纹噪声（笔刷的丝）+ 块状噪声（墨迹边缘的毛糙）。
 * 每帧扫开多少面积也照原片：58 帧 4%，之后每帧约 9%，69 帧扫完。
 * 噪声用固定种子，每次渲染都一样。
 *
 * 输出是 PNG 的 data URL（白 = 标题段还在，透明 = 露出新闻稿），当 CSS mask 用。
 */

const W = 640;
const H = 360;
/** 原片第 58–69 帧每处第一次露出新闻稿的帧号（80×80 一格，取中位数后轻微平滑） */
const GRID = [
  67.9, 67.4, 66.6, 65.9, 65.5, 65.4, 65.5, 64.3, 62.1, 62.2, 62.5, 61.0, 59.6, 59.9, 60.9, 61.1,
  67.7, 67.5, 67.0, 66.4, 65.9, 65.7, 65.3, 64.0, 62.2, 62.3, 62.3, 61.0, 60.2, 60.1, 60.5, 60.7,
  67.3, 67.6, 67.6, 67.0, 66.4, 66.0, 65.5, 64.2, 62.4, 62.3, 62.2, 61.2, 61.1, 61.3, 60.9, 60.3,
  66.4, 67.0, 67.4, 66.9, 66.7, 66.1, 65.6, 64.5, 62.8, 62.6, 62.3, 61.6, 61.8, 62.3, 61.8, 60.6,
  64.2, 65.5, 66.5, 66.3, 66.4, 66.1, 65.4, 64.2, 63.3, 63.1, 62.4, 62.0, 62.6, 63.2, 63.0, 62.2,
  61.7, 63.4, 65.2, 66.1, 66.6, 66.7, 65.9, 64.2, 63.5, 63.2, 62.7, 63.1, 64.2, 64.6, 64.1, 63.7,
  60.7, 61.7, 63.5, 65.2, 66.4, 66.8, 66.2, 64.3, 63.7, 63.3, 62.9, 64.1, 66.2, 66.6, 65.5, 64.5,
  61.2, 60.9, 61.7, 63.4, 65.5, 66.6, 66.0, 64.2, 63.9, 63.8, 63.2, 64.3, 66.6, 67.5, 66.0, 63.8,
  62.4, 60.9, 60.8, 62.5, 64.9, 66.4, 66.2, 65.0, 64.5, 64.0, 63.6, 64.6, 66.4, 67.6, 65.9, 62.9,
];
const GW = 16;
const GH = 9;
/** 原片每帧扫开的面积比例（第 58–70 帧） */
const REVEALED = [0.04, 0.09, 0.17, 0.26, 0.34, 0.44, 0.52, 0.61, 0.72, 0.84, 0.93, 0.99, 1];
/** 转场从 rel = -1（原片第 58 帧）开始，rel = 11 全部扫完 */
export const INK_FRAMES = 12;

/** 粗网格双线性插值，u、v 是 0–1 */
function gridAt(u: number, v: number): number {
  const gx = Math.min(GW - 1.001, Math.max(0, u * GW - 0.5));
  const gy = Math.min(GH - 1.001, Math.max(0, v * GH - 0.5));
  const x0 = Math.floor(gx);
  const y0 = Math.floor(gy);
  const tx = gx - x0;
  const ty = gy - y0;
  const g = (x: number, y: number) => GRID[y * GW + x]!;
  const a = g(x0, y0) + (g(x0 + 1, y0) - g(x0, y0)) * tx;
  const b = g(x0, y0 + 1) + (g(x0 + 1, y0 + 1) - g(x0, y0 + 1)) * tx;
  return a + (b - a) * ty;
}

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 格点随机值 + 平滑插值的噪声，fx / fy 是两个方向上每像素多少个格 */
function valueNoise(seed: number, gw: number, gh: number) {
  const rand = mulberry32(seed);
  const grid = new Float32Array((gw + 1) * (gh + 1));
  for (let i = 0; i < grid.length; i++) grid[i] = rand();
  const s = (t: number) => t * t * (3 - 2 * t);
  return (x: number, y: number) => {
    // x、y 已经换算成格坐标，超出范围就绕回去
    const xi = ((Math.floor(x) % gw) + gw) % gw;
    const yi = ((Math.floor(y) % gh) + gh) % gh;
    const tx = s(x - Math.floor(x));
    const ty = s(y - Math.floor(y));
    const g = (i: number, j: number) => grid[j * (gw + 1) + i]!;
    const a = g(xi, yi) + (g(xi + 1, yi) - g(xi, yi)) * tx;
    const b = g(xi, yi + 1) + (g(xi + 1, yi + 1) - g(xi, yi + 1)) * tx;
    return a + (b - a) * ty;
  };
}

let orderMap: Float32Array | null = null;

function buildOrder(): Float32Array {
  const out = new Float32Array(W * H);
  const streak = valueNoise(7, 64, 256);
  const streak2 = valueNoise(11, 64, 256);
  const blotch = valueNoise(23, 64, 64);
  const fine = valueNoise(31, 256, 256);
  // 笔刷的丝斜着走（从左上到右下，和水平线约 35°）
  const ang = (35 * Math.PI) / 180;
  const ca = Math.cos(ang);
  const sa = Math.sin(ang);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const u = x / W;
      const v = y / H;
      const base = (gridAt(u, v) - 57) / 13;
      // 沿丝方向拉得很长、横着很细
      const px = x * 2;
      const py = y * 2;
      const along = px * ca + py * sa;
      const across = -px * sa + py * ca;
      const st = 0.6 * streak(along / 110, across / 5) + 0.4 * streak2(along / 45, across / 2.5);
      const bl = blotch(px / 90, py / 90);
      const fn = fine(px / 3, py / 3);
      out[y * W + x] = base + 0.3 * (st - 0.5) + 0.16 * (bl - 0.5) + 0.14 * (fn - 0.5);
    }
  }
  return out;
}

let sorted: Float32Array | null = null;

/** 第 rel 帧（相对转场开始）的阈值：取顺序图的分位数，让扫开的面积和原片一样 */
export function inkProgress(rel: number): number {
  orderMap ??= buildOrder();
  sorted ??= Float32Array.from(orderMap).sort();
  const i = rel + 1;
  if (i < 0) return -Infinity;
  if (i >= REVEALED.length - 1) return Infinity;
  const lo = Math.floor(i);
  const frac = REVEALED[lo]! + (REVEALED[lo + 1]! - REVEALED[lo]!) * (i - lo);
  return sorted[Math.min(sorted.length - 1, Math.floor(frac * sorted.length))]!;
}

const cache = new Map<number, string>();
let canvas: HTMLCanvasElement | null = null;

/** 标题段该保留的部分（白色不透明）；拿不到 canvas（不在浏览器里）就不遮 */
export function inkMaskUrl(rel: number): string | null {
  if (typeof document === 'undefined') return null;
  const key = Math.round(rel * 100) / 100;
  const hit = cache.get(key);
  if (hit) return hit;
  orderMap ??= buildOrder();
  canvas ??= document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  const img = ctx.createImageData(W, H);
  const p = inkProgress(key);
  const soft = 0.035;
  for (let i = 0; i < W * H; i++) {
    // 顺序值比阈值大 = 还没扫到 = 标题段保留
    const keep = Math.min(1, Math.max(0, (orderMap[i]! - p) / soft + 0.5));
    img.data[i * 4] = 255;
    img.data[i * 4 + 1] = 255;
    img.data[i * 4 + 2] = 255;
    img.data[i * 4 + 3] = Math.round(keep * 255);
  }
  ctx.putImageData(img, 0, 0);
  const url = canvas.toDataURL('image/png');
  if (cache.size > 40) cache.clear();
  cache.set(key, url);
  return url;
}
