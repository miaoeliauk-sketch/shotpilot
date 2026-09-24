/** 打包界面（React + Remotion 播放器）成 web/js/app.js，web/index.html 加载它 */
import { build } from 'esbuild';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const started = Date.now();
await build({
  entryPoints: [resolve(root, 'web/src/main.tsx')],
  outfile: resolve(root, 'web/js/app.js'),
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
