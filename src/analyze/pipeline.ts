import { mkdir } from 'node:fs/promises';
import { probeMedia } from './probe.js';
import { buildShots, carryOverAnnotations, detectCuts } from './shots.js';
import { generateThumbnails } from './thumbnails.js';
import { createProject, projectDir, saveProject, thumbsDir } from '../core/project.js';
import type { ReelProject } from '../core/types.js';

export interface AnalyzeOptions {
  title?: string;
  /** 从链接下载的，记下原链接 */
  sourceUrl?: string;
  threshold?: number;
  minShotDuration?: number;
}

export type ProgressFn = (stage: string, detail?: string) => void;

/**
 * 分析流水线：探测 → 切分镜 → 缩略图。
 *
 * 只处理画面。声音（背景音乐、人声）和口播字幕不归这个工具管——
 * 那些在后期里加，拉片和复刻都只关心画面长什么样、怎么动。
 */
export async function analyzeVideo(
  videoPath: string,
  opts: AnalyzeOptions = {},
  onProgress: ProgressFn = () => {},
): Promise<ReelProject> {
  onProgress('probe', '读取视频信息');
  const source = await probeMedia(videoPath);
  const project = createProject(source, opts.title);
  if (opts.sourceUrl) project.sourceUrl = opts.sourceUrl;
  await mkdir(projectDir(project.id), { recursive: true });

  onProgress('cuts', '检测分镜切点');
  const cuts = await detectCuts(videoPath, {
    threshold: opts.threshold,
    minShotDuration: opts.minShotDuration,
  });
  project.shots = buildShots(cuts, source.duration, {
    minShotDuration: opts.minShotDuration,
  });
  onProgress('cuts', `切出 ${project.shots.length} 个镜头`);

  onProgress('thumbnails', '抽取镜头缩略图');
  project.shots = await generateThumbnails(videoPath, project.shots, thumbsDir(project.id));

  await saveProject(project);
  onProgress('done', `项目已保存：${project.id}`);
  return project;
}

/** 换个阈值重新切分，保留已有标注。 */
export async function resplit(
  project: ReelProject,
  opts: { threshold?: number; minShotDuration?: number } = {},
  onProgress: ProgressFn = () => {},
): Promise<ReelProject> {
  onProgress('cuts', '重新检测分镜切点');
  const cuts = await detectCuts(project.source.path, opts);
  const fresh = buildShots(cuts, project.source.duration, opts);
  const merged = carryOverAnnotations(project.shots, fresh);

  onProgress('thumbnails', '重新抽取缩略图');
  const withThumbs = await generateThumbnails(project.source.path, merged, thumbsDir(project.id));

  const next: ReelProject = { ...project, shots: withThumbs };
  await saveProject(next);
  onProgress('done', `重新切出 ${withThumbs.length} 个镜头`);
  return next;
}
