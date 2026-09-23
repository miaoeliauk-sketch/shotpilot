import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { analyzeVideo } from './analyze/pipeline.js';
import { autoAnnotate, visionConfigFromEnv } from './analyze/vision.js';
import { loadProject, saveProject } from './core/project.js';
import { toMarkdown } from './export/notes.js';
import { toHandoffJson } from './export/handoff.js';

/** 命令行入口。UI 干不了的批处理（跑一批参考片）走这里。 */

function arg(name: string, fallback?: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i !== -1 ? process.argv[i + 1] : fallback;
}

function has(name: string): boolean {
  return process.argv.includes(`--${name}`);
}

const USAGE = `
ShotPilot 拉片 CLI

  分析视频：
    pnpm analyze --input <视频路径> [--threshold 0.3] [--min-shot 0.4]
                 [--ai]                        分析完立即跑 AI 初判

  导出已有项目：
    pnpm analyze --project <项目id> --export md|json --out <输出路径>

环境变量：
  SHOTPILOT_PROJECTS          项目存放目录（默认 ./projects）
  SHOTPILOT_VISION_API_KEY    视觉模型 key，配了才能用 --ai
  SHOTPILOT_VISION_BASE_URL   默认 https://api.openai.com/v1
  SHOTPILOT_VISION_MODEL      默认 gpt-4o-mini
`;

async function main(): Promise<void> {
  const projectId = arg('project');
  const exportFormat = arg('export');

  if (projectId && exportFormat) {
    const project = await loadProject(projectId);
    const body =
      exportFormat === 'md' ? toMarkdown(project) :
      exportFormat === 'json' ? toHandoffJson(project) : null;
    if (body === null) throw new Error(`未知导出格式：${exportFormat}`);
    const out = arg('out');
    if (out) {
      await writeFile(resolve(out), body, 'utf8');
      console.log(`已写入 ${resolve(out)}`);
    } else {
      process.stdout.write(body);
    }
    return;
  }

  const input = arg('input');
  if (!input) {
    console.log(USAGE);
    process.exitCode = 1;
    return;
  }

  const project = await analyzeVideo(resolve(input), {
    threshold: arg('threshold') ? Number(arg('threshold')) : undefined,
    minShotDuration: arg('min-shot') ? Number(arg('min-shot')) : undefined,
  }, (stage, detail) => console.log(`[${stage}] ${detail ?? ''}`));

  if (has('ai')) {
    const cfg = visionConfigFromEnv();
    if (!cfg) {
      console.warn('跳过 AI 初判：未设置 SHOTPILOT_VISION_API_KEY');
    } else {
      const annotated = await autoAnnotate(project.source.path, project.shots, cfg, (done, total, shotId, error) => {
        console.log(`[ai] ${done}/${total} ${shotId}${error ? ` 失败：${error}` : ''}`);
      });
      project.shots = annotated;
      await saveProject(project);
    }
  }

  console.log(`\n项目 id：${project.id}`);
  console.log(`打开工作台：pnpm dev 然后访问 http://127.0.0.1:5174/?id=${project.id}`);
}

main().catch((err) => {
  console.error(`\n错误：${err instanceof Error ? err.message : String(err)}`);
  process.exitCode = 1;
});
