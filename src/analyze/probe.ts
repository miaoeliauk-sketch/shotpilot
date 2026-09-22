import { stat } from 'node:fs/promises';
import { basename } from 'node:path';
import { FFPROBE, runOrThrow } from './ffmpeg.js';
import type { SourceMedia } from '../core/types.js';

interface FfprobeStream {
  codec_type?: string;
  codec_name?: string;
  width?: number;
  height?: number;
  avg_frame_rate?: string;
  r_frame_rate?: string;
}

interface FfprobeOutput {
  streams?: FfprobeStream[];
  format?: { duration?: string; format_name?: string };
}

/** "30000/1001" → 29.97。除零和脏数据一律回落到 0，由调用方决定怎么处理。 */
function parseFrameRate(value: string | undefined): number {
  if (!value) return 0;
  const [numStr, denStr] = value.split('/');
  const num = Number(numStr);
  const den = denStr === undefined ? 1 : Number(denStr);
  if (!Number.isFinite(num) || !Number.isFinite(den) || den === 0) return 0;
  return num / den;
}

export async function probeMedia(path: string): Promise<SourceMedia> {
  const fileStat = await stat(path);
  if (!fileStat.isFile()) throw new Error(`不是文件：${path}`);

  const { stdout } = await runOrThrow(FFPROBE, [
    '-v', 'error',
    '-print_format', 'json',
    '-show_format',
    '-show_streams',
    path,
  ], { timeoutMs: 60_000 });

  let parsed: FfprobeOutput;
  try {
    parsed = JSON.parse(stdout) as FfprobeOutput;
  } catch {
    throw new Error(`ffprobe 输出无法解析，${path} 可能不是有效的媒体文件`);
  }

  const streams = parsed.streams ?? [];
  const video = streams.find((s) => s.codec_type === 'video');
  const audio = streams.find((s) => s.codec_type === 'audio');
  if (!video) throw new Error(`${path} 里没有视频轨，拉片需要视频`);

  const duration = Number(parsed.format?.duration ?? 0);
  if (!Number.isFinite(duration) || duration <= 0) {
    throw new Error(`无法读取 ${path} 的时长，文件可能损坏`);
  }

  return {
    path,
    filename: basename(path),
    duration,
    width: video.width ?? 0,
    height: video.height ?? 0,
    fps: parseFrameRate(video.avg_frame_rate) || parseFrameRate(video.r_frame_rate),
    hasAudio: Boolean(audio),
    size: fileStat.size,
    container: parsed.format?.format_name,
    videoCodec: video.codec_name,
    audioCodec: audio?.codec_name,
  };
}
