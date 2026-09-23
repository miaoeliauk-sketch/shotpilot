/**
 * 把模板打包成静态站点（dist/remotion-bundle），导出视频时渲染器直接加载它。
 * 打包要几十秒，所以在构建时做一次，不在用户点「导出」时现做。
 */
import { bundle } from '@remotion/bundler';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const outDir = resolve(root, 'dist/remotion-bundle');
const started = Date.now();
await bundle({
  entryPoint: resolve(root, 'templates/src/index.ts'),
  outDir,
  publicDir: resolve(root, 'templates/public'),
  onProgress: (p) => { if (p % 25 === 0) process.stdout.write(`  打包模板 ${p}%\n`); },
});
console.log(`模板打包完成：${outDir}（${((Date.now() - started) / 1000).toFixed(1)} 秒）`);
