/** 打包模板工作室（React + Remotion 播放器）成 web/js/studio.js，拉片界面按需加载 */
import { build } from 'esbuild';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const started = Date.now();
await build({
  entryPoints: [resolve(root, 'web/src/studio/main.tsx')],
  outfile: resolve(root, 'web/js/studio.js'),
  bundle: true,
  format: 'esm',
  platform: 'browser',
  target: 'es2020',
  jsx: 'automatic',
  minify: true,
  sourcemap: false,
  define: { 'process.env.NODE_ENV': '"production"' },
  logLevel: 'warning',
});
console.log(`界面打包完成（${((Date.now() - started) / 1000).toFixed(1)} 秒）`);
