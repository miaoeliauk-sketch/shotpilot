import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { FFMPEG, runOrThrow } from './ffmpeg.js';
import type { Shot } from '../core/types.js';

export interface ThumbnailOptions {
  /** 缩略图宽度，高度按比例。240 在时间线上够看又不撑爆内存。 */
  width?: number;
  /**
   * 取帧位置占镜头时长的比例。
   * 不取首帧：镜头开头常常还在转场中途（叠化、甩镜残影），取出来是糊的。
   * 30% 处基本已经稳定，又还没到镜头后半段的运动末态。
   */
  position?: number;
  concurrency?: number;
}

/**
 * 为每个镜头抽一张代表帧。
 *
 * 用 -ss 放在 -i 之前做关键帧快速定位，长视频上比逐帧解码快一到两个数量级；
 * 代价是定位精度到最近的关键帧，对缩略图来说完全够用。
 */
export async function generateThumbnails(
  videoPath: string,
  shots: Shot[],
  outputDir: string,
  opts: ThumbnailOptions = {},
): Promise<Shot[]> {
  const width = opts.width ?? 240;
  const position = opts.position ?? 0.3;
  const concurrency = Math.max(1, opts.concurrency ?? 4);

  await mkdir(outputDir, { recursive: true });

  const results = new Map<string, string>();
  const queue = [...shots];

  const worker = async (): Promise<void> => {
    for (;;) {
      const shot = queue.shift();
      if (!shot) return;
      const seek = shot.start + (shot.end - shot.start) * position;
      const name = `${shot.id}.jpg`;
      try {
        await runOrThrow(FFMPEG, [
          '-hide_banner', '-nostats', '-loglevel', 'error',
          '-ss', seek.toFixed(3),
          '-i', videoPath,
          '-frames:v', '1',
          '-vf', `scale=${width}:-2`,
          '-q:v', '4',
          '-y', join(outputDir, name),
        ], { timeoutMs: 60_000 });
        results.set(shot.id, name);
      } catch {
        // 单张抽帧失败不该让整次分析报废——界面显示占位图即可
      }
    }
  };

  await Promise.all(Array.from({ length: concurrency }, worker));

  return shots.map((s) => {
    const thumb = results.get(s.id);
    return thumb ? { ...s, thumbnail: thumb } : s;
  });
}
