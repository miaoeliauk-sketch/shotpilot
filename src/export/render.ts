import { existsSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dataDir } from '../core/paths.js';
import { safeFileName } from '../core/names.js';

export { safeFileName };

/**
 * 用模板导出视频。
 *
 * 模板在构建时打包成静态站点（scripts/build-templates.ts），这里只加载它、填参数、渲染。
 * 渲染用的无头浏览器：Mac 软件里自带（SHOTPILOT_BROWSER 指过去）；
 * 开发时没设就由 Remotion 自己下载，第一次会慢一些。
 */

const APP_ROOT = resolve(fileURLToPath(new URL('../..', import.meta.url)));

export function bundleDir(): string {
  return resolve(process.env.SHOTPILOT_REMOTION_BUNDLE ?? join(APP_ROOT, 'dist/remotion-bundle'));
}

/**
 * 把参数里的站内地址补成完整地址。
 * 预览时浏览器和工作台同源，/files/… 直接能取；渲染用的浏览器加载的是模板打包站点，
 * 得告诉它去工作台的端口取图。
 */
export function absolutizeUrls<T>(value: T, origin: string): T {
  if (typeof value === 'string') {
    return (/^\/(files|template-assets)\//.test(value) ? `${origin}${value}` : value) as T;
  }
  if (Array.isArray(value)) return value.map((v) => absolutizeUrls(v, origin)) as T;
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, absolutizeUrls(v, origin)])) as T;
  }
  return value;
}

function timestamp(d = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

export interface RenderRequest {
  compositionId: string;
  inputProps: Record<string, unknown>;
  name: string;
  /** 工作台自己的地址，例如 http://127.0.0.1:5174 */
  origin: string;
}

export type RenderProgress = (message: string, percent: number | null) => void;

async function ensureBundle(onProgress: RenderProgress): Promise<string> {
  const dir = bundleDir();
  if (existsSync(join(dir, 'index.html'))) return dir;
  // 开发时还没打包过：现打一次（Mac 软件里是构建时就打好的）
  onProgress('第一次导出，正在准备模板…', null);
  const { bundle } = await import('@remotion/bundler');
  await bundle({
    entryPoint: join(APP_ROOT, 'templates/src/index.ts'),
    outDir: dir,
    publicDir: join(APP_ROOT, 'templates/public'),
  });
  return dir;
}

export async function renderTemplate(req: RenderRequest, onProgress: RenderProgress): Promise<string> {
  const serveUrl = await ensureBundle(onProgress);
  const { renderMedia, selectComposition } = await import('@remotion/renderer');
  const inputProps = absolutizeUrls(req.inputProps, req.origin);
  const browserExecutable = process.env.SHOTPILOT_BROWSER || null;
  const onBrowserDownload = () => {
    onProgress('第一次导出，正在下载渲染组件…', null);
    return {
      version: null,
      onProgress: ({ percent }: { percent: number }) => onProgress('第一次导出，正在下载渲染组件…', Math.round(percent * 100)),
    };
  };

  onProgress('准备中…', 0);
  const composition = await selectComposition({ serveUrl, id: req.compositionId, inputProps, browserExecutable, onBrowserDownload });

  const outDir = dataDir('renders');
  await mkdir(outDir, { recursive: true });
  const outputLocation = join(outDir, `${safeFileName(req.name)}-${timestamp()}.mp4`);

  let last = -1;
  await renderMedia({
    composition,
    serveUrl,
    codec: 'h264',
    outputLocation,
    inputProps,
    browserExecutable,
    onBrowserDownload,
    onProgress: ({ progress }) => {
      const pct = Math.floor(progress * 100);
      if (pct !== last) {
        last = pct;
        onProgress('正在导出', pct);
      }
    },
  });
  return outputLocation;
}
