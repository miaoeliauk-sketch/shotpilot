import { useLayoutEffect, useState } from 'react';
import { continueRender, delayRender } from 'remotion';

/**
 * 预先画好的图：每帧都一样、但每帧现算很贵的东西（大半径模糊、软阴影），在浏览器里用 canvas 画一次，
 * 之后每帧直接贴这张图。画好之前让导出等着（delayRender）；画不出来（比如图片跨域不让读）就返回 null，
 * 调用的地方退回每帧现算的做法，画面一样、只是慢一点。
 */

const pending = new Map<string, Promise<string | null>>();
const done = new Map<string, string | null>();

export function useBaked(key: string, draw: () => Promise<string | null>): string | null {
  const [state, setState] = useState<{ key: string; url: string | null } | null>(() => (done.has(key) ? { key, url: done.get(key)! } : null));
  useLayoutEffect(() => {
    if (done.has(key)) {
      setState({ key, url: done.get(key)! });
      return;
    }
    const handle = delayRender(`预先画图 ${key.slice(0, 60)}`);
    let alive = true;
    let p = pending.get(key);
    if (!p) {
      p = draw().then(
        (url) => { done.set(key, url); return url; },
        (err) => { console.warn('预先画图失败，退回每帧现算', String(err)); done.set(key, null); return null; },
      );
      pending.set(key, p);
    }
    void p.then((url) => {
      if (alive) setState({ key, url });
      continueRender(handle);
    });
    return () => { alive = false; };
  }, [key]);
  if (done.has(key)) return done.get(key)!;
  return state && state.key === key ? state.url : null;
}

export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`图片加载失败 ${src}`));
    img.src = src;
  });
}

/**
 * 把一张图按「铺满、上边对齐」（object-fit: cover; object-position: 50% 0%）缩到 w×h，四周留出 pad 的空白，
 * 整张模糊 radius（都是显示尺寸下的像素），按 scale 缩小了画（模糊的图不需要高清）。
 */
export async function bakeBlurredImage(src: string, w: number, h: number, radius: number, pad: number, scale = 0.5): Promise<string | null> {
  if (typeof document === 'undefined') return null;
  const img = await loadImage(src);
  const c = document.createElement('canvas');
  c.width = Math.round((w + 2 * pad) * scale);
  c.height = Math.round((h + 2 * pad) * scale);
  const ctx = c.getContext('2d');
  if (!ctx) return null;
  const k = Math.max(w / img.naturalWidth, h / img.naturalHeight);
  const sw = w / k;
  const sh = h / k;
  const sx = (img.naturalWidth - sw) / 2;
  ctx.filter = `blur(${(radius * scale).toFixed(2)}px)`;
  ctx.drawImage(img, sx, 0, sw, sh, pad * scale, pad * scale, w * scale, h * scale);
  return c.toDataURL('image/png');
}
