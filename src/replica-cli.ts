import { resolve } from 'node:path';
import { loadProject } from './core/project.js';
import { buildReplicaPackage } from './export/replica.js';

/** 生成复刻包。挑出要复刻的镜头，打包成 agent 能直接开工的目录。 */

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i !== -1 ? process.argv[i + 1] : undefined;
}

const USAGE = `
生成复刻包

  pnpm replica --project <项目id> --shot <镜头id> [--out <输出目录>] [--fps 10]
  pnpm replica --project <项目id> --all-broll [--out <输出目录>]

  --shot        指定单个镜头，例如 s012
  --all-broll   打包所有标为 B-roll / 叠加层 / 字卡的镜头
  --out         输出目录，默认 ./replica-out
  --fps         帧序列采样率，默认 10

包里有：原片片段（无音轨）、逐帧序列、画面标注、给 agent 的三步法指令。只管画面。
`;

async function main(): Promise<void> {
  const projectId = arg('project');
  if (!projectId) { console.log(USAGE); process.exitCode = 1; return; }

  const project = await loadProject(projectId);
  const outRoot = resolve(arg('out') ?? 'replica-out');
  const fps = arg('fps') ? Number(arg('fps')) : 10;

  const shotId = arg('shot');
  const allBroll = process.argv.includes('--all-broll');

  let targets = project.shots;
  if (shotId) {
    targets = project.shots.filter((s) => s.id === shotId);
    if (targets.length === 0) throw new Error(`镜头不存在：${shotId}`);
  } else if (allBroll) {
    // 只有这三类是 Remotion 画得出来的；真人实拍的 A-roll 复刻不了
    targets = project.shots.filter((s) => s.roll === 'b-roll' || s.roll === 'overlay' || s.roll === 'title');
    if (targets.length === 0) {
      throw new Error('没有标为 B-roll / 叠加层 / 字卡的镜头。先在工作台里按 X 或 V 标出来。');
    }
  } else {
    console.log(USAGE);
    process.exitCode = 1;
    return;
  }

  for (const shot of targets) {
    process.stdout.write(`[${shot.id}] 抽帧与裁剪中…`);
    const r = await buildReplicaPackage(project, shot, outRoot, { fps });
    console.log(` 完成，${r.frameCount} 帧 → ${r.dir}`);
  }

  console.log(`\n共 ${targets.length} 个复刻包，输出到 ${outRoot}`);
  console.log('把某个包丢进 Remotion 项目目录，在那里开 Claude Code 或 Codex，让它读 README.md 开工。');
}

main().catch((err) => {
  console.error(`\n错误：${err instanceof Error ? err.message : String(err)}`);
  process.exitCode = 1;
});
