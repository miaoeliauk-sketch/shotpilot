/**
 * 构建后的冒烟测试用：打印两个模板的导出请求（时长缩短到 1 秒，测得快）。
 * 用法：tsx desktop/smoke-requests.ts <输出目录>
 */
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { TEMPLATES } from '../templates/src/registry';

const out = process.argv[2] ?? '.';
for (const t of TEMPLATES) {
  const inputProps = t.toProps({ ...t.defaultParams, duration: 1 });
  writeFileSync(join(out, `${t.id}.json`), JSON.stringify({ compositionId: t.id, name: `冒烟-${t.id}`, inputProps }));
}
console.log(`写好 ${TEMPLATES.length} 个导出请求到 ${out}`);
