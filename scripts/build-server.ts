/**
 * 把工作台服务打包成一个文件（dist/server/index.mjs），Mac 软件里直接用内置的 Node 跑，不需要 tsx。
 * npm 依赖不打进去，留给软件里的 node_modules：渲染器带平台相关的二进制，不能打包。
 */
import { build } from 'esbuild';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
await build({
  entryPoints: [resolve(root, 'src/server/index.ts')],
  outfile: resolve(root, 'dist/server/index.mjs'),
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node20',
  packages: 'external',
  logLevel: 'warning',
});
console.log('服务打包完成：dist/server/index.mjs');
