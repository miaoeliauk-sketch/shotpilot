import { mkdir, readFile, readdir, rename, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { basename, join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { PROJECT_VERSION, type ReelProject, type SourceMedia } from './types.js';
import { dataDir } from './paths.js';

/** 所有拉片项目的根目录。位置规则见 paths.ts */
export function projectsRoot(): string {
  return dataDir('projects');
}

export function projectDir(id: string): string {
  // id 来自 randomUUID 或用户输入，做一次白名单过滤防止路径穿越
  if (!/^[A-Za-z0-9_-]+$/.test(id)) throw new Error(`非法项目 id：${id}`);
  return join(projectsRoot(), id);
}

export function thumbsDir(id: string): string {
  return join(projectDir(id), 'thumbs');
}

export function createProject(source: SourceMedia, title?: string): ReelProject {
  const now = new Date().toISOString();
  return {
    version: PROJECT_VERSION,
    id: randomUUID(),
    title: title?.trim() || basename(source.filename).replace(/\.[^.]+$/, ''),
    source,
    shots: [],
    note: '',
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * 原子写盘：先写临时文件再 rename。
 * 拉片是几小时的人工活儿，写到一半断电把 project.json 截断，等于白干——这个风险不能留。
 */
export async function saveProject(project: ReelProject): Promise<void> {
  const dir = projectDir(project.id);
  await mkdir(dir, { recursive: true });
  const target = join(dir, 'project.json');
  const tmp = join(dir, `.project.json.${process.pid}.tmp`);
  const payload = { ...project, updatedAt: new Date().toISOString() };
  await writeFile(tmp, JSON.stringify(payload, null, 2), 'utf8');
  await rename(tmp, target);
}

export async function loadProject(id: string): Promise<ReelProject> {
  const file = join(projectDir(id), 'project.json');
  const raw = await readFile(file, 'utf8');
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(`项目文件损坏：${file}`);
  }
  return migrate(parsed as ReelProject);
}

/** 版本迁移入口。目前只有 v1，但留好钩子，以后加字段不至于让老项目打不开。 */
function migrate(project: ReelProject): ReelProject {
  if (typeof project?.version !== 'number') {
    throw new Error('项目文件缺少 version 字段，无法识别');
  }
  if (project.version > PROJECT_VERSION) {
    throw new Error(`项目版本 ${project.version} 高于当前程序支持的 ${PROJECT_VERSION}，请升级 ShotPilot`);
  }
  // 老项目里可能还带着转写和音频分析的字段——工具只管画面之后不再使用，读的时候剥掉，
  // 下次保存就从文件里消失了。镜头和标注完全不受影响。
  const { words: _words, audio: _audio, ...rest } = project as ReelProject & { words?: unknown; audio?: unknown };
  return {
    ...rest,
    shots: rest.shots ?? [],
    note: rest.note ?? '',
  };
}

export interface ProjectSummary {
  id: string;
  title: string;
  filename: string;
  duration: number;
  shotCount: number;
  reviewedCount: number;
  updatedAt: string;
  /** 源视频是否还在原处。移动过位置就播不了，界面要提示而不是静默出错。 */
  sourceExists: boolean;
}

export async function listProjects(): Promise<ProjectSummary[]> {
  const root = projectsRoot();
  if (!existsSync(root)) return [];
  const entries = await readdir(root, { withFileTypes: true });
  const summaries: ProjectSummary[] = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    try {
      const p = await loadProject(entry.name);
      summaries.push({
        id: p.id,
        title: p.title,
        filename: p.source.filename,
        duration: p.source.duration,
        shotCount: p.shots.length,
        reviewedCount: p.shots.filter((s) => s.reviewed).length,
        updatedAt: p.updatedAt,
        sourceExists: existsSync(p.source.path),
      });
    } catch {
      // 坏掉的项目目录跳过，不让它拖垮整个列表
    }
  }
  return summaries.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}
