import { mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { probeMedia } from './probe.js';
import { buildShots, carryOverAnnotations, detectCuts } from './shots.js';
import { generateThumbnails } from './thumbnails.js';
import { analyzeAudio } from './audio.js';
import { extractAudioTrack, importSubtitles, transcribeWithWhisperX } from './transcribe.js';
import { createProject, projectDir, saveProject, thumbsDir } from '../core/project.js';
import type { ReelProject } from '../core/types.js';

export interface AnalyzeOptions {
  title?: string;
  threshold?: number;
  minShotDuration?: number;
  /** 转写方式：whisperx 跑本地模型，subtitles 导入现成文件，none 跳过 */
  transcribe?: 'whisperx' | 'subtitles' | 'none';
  subtitlePath?: string;
  language?: string;
  skipAudio?: boolean;
}

export type ProgressFn = (stage: string, detail?: string) => void;

/**
 * 完整分析流水线：探测 → 切分 → 缩略图 → 转写 → 音频。
 *
 * 顺序有讲究：转写必须排在音频分析之前，因为音频段落的人声/音乐判定
 * 要拿词级时间戳当判据（见 audio.ts 里的说明）。
 */
export async function analyzeVideo(
  videoPath: string,
  opts: AnalyzeOptions = {},
  onProgress: ProgressFn = () => {},
): Promise<ReelProject> {
  onProgress('probe', '读取视频信息');
  const source = await probeMedia(videoPath);
  const project = createProject(source, opts.title);
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

  const mode = opts.transcribe ?? 'none';
  if (mode !== 'none' && source.hasAudio) {
    try {
      if (mode === 'subtitles') {
        if (!opts.subtitlePath) throw new Error('选择了导入字幕但没给文件路径');
        onProgress('transcribe', '导入字幕');
        const r = await importSubtitles(opts.subtitlePath);
        project.words = r.words;
        onProgress('transcribe', `${r.method}，${r.words.length} 个词`);
      } else {
        onProgress('transcribe', '抽取音轨');
        const wav = join(projectDir(project.id), 'audio.wav');
        await extractAudioTrack(videoPath, wav);
        onProgress('transcribe', '本地 WhisperX 转写中（首次会下载模型，耗时较久）');
        const r = await transcribeWithWhisperX(wav, projectDir(project.id), { language: opts.language });
        project.words = r.words;
        await rm(wav, { force: true });
        onProgress('transcribe', `${r.method}，${r.words.length} 个词`);
      }
    } catch (err) {
      // 转写失败不该让已经切好的分镜作废
      onProgress('transcribe', `转写失败，已跳过：${err instanceof Error ? err.message : String(err)}`);
    }
  }

  if (!opts.skipAudio && source.hasAudio) {
    try {
      onProgress('audio', '分析 BGM 与音频段落');
      project.audio = await analyzeAudio(videoPath, project.words, source.duration);
      const bpm = project.audio.bpm;
      onProgress('audio', `${project.audio.segments.length} 个音频段落${bpm ? `，BPM ≈ ${bpm}` : '，未测出稳定节奏'}`);
    } catch (err) {
      onProgress('audio', `音频分析失败，已跳过：${err instanceof Error ? err.message : String(err)}`);
    }
  }

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
