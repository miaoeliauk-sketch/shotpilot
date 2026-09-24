import { useLayoutEffect, useState } from 'react';
import { continueRender, delayRender } from 'remotion';
import { bundledUrl } from './asset';

/**
 * 模板自带的字体（templates/public/fonts/，都是 SIL OFL 开源授权，可以随软件分发）。
 *
 * 系统字体每台 Mac 不一样，原片用的那种窄粗体数字字体 Mac 上没有，所以直接带上。
 * 预览时字体从工作台的 /template-assets/ 取，导出时从打包好的模板里取。
 * 只有一个字重的字体注册时声明覆盖所有字重，免得浏览器自己「加粗」把字形弄坏。
 */

export const BUNDLED_FONTS = {
  bebas: { family: 'ShotPilot Bebas Neue', file: 'BebasNeue-Regular.ttf', weight: '100 900' },
  /** 窄体，有小写；可变字重 200–700 */
  oswald: { family: 'ShotPilot Oswald', file: 'Oswald-Variable.ttf', weight: '200 700' },
} as const;

type FontKey = keyof typeof BUNDLED_FONTS;

const fontUrl = (file: string) => bundledUrl(`fonts/${file}`);

const loading = new Map<FontKey, Promise<void>>();
/** 已经加载完的。不能用 document.fonts.check 判断：没注册过的字体它也返回 true */
const loaded = new Set<FontKey>();

function load(key: FontKey): Promise<void> {
  const hit = loading.get(key);
  if (hit) return hit;
  const { family, file, weight } = BUNDLED_FONTS[key];
  const face = new FontFace(family, `url(${fontUrl(file)})`, { weight });
  const p = face.load().then(
    (f) => { (document.fonts as unknown as { add: (face: FontFace) => void }).add(f); loaded.add(key); },
    (err) => { console.warn(`字体加载失败 ${family} ${fontUrl(file)}`, String(err)); }, // 取不到就用后备字体，不卡住渲染
  );
  loading.set(key, p);
  return p;
}

/** 字体加载好之前返回 false，并让导出等它（delayRender）；加载好了组件会重新量字 */
export function useBundledFont(key: FontKey): boolean {
  const [ready, setReady] = useState(() => loaded.has(key));
  useLayoutEffect(() => {
    if (ready) return;
    const handle = delayRender(`加载字体 ${BUNDLED_FONTS[key].family}`);
    let alive = true;
    void load(key).then(() => {
      if (alive) setReady(true);
      continueRender(handle);
    });
    return () => { alive = false; };
  }, [key, ready]);
  return ready;
}
