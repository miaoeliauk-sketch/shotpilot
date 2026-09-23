import { type ReelProject } from '../core/types.js';
import { labelOf } from '../core/vocabulary.js';

/**
 * 给 agent 用的结构化拉片数据：每个镜头的时间、归类、画面标注。
 *
 * 只含画面信息。声音和口播字幕不归这个工具管，不导出。
 */
export function toHandoffJson(project: ReelProject): string {
  return JSON.stringify({
    generator: 'shotpilot@0.1.0',
    note: 'shots[].annotation 为结构化的画面标注（景别、运镜、构图、光线等），labels 为对应中文',
    source: project.source,
    shots: project.shots.map((s) => ({
      ...s,
      duration: Number((s.end - s.start).toFixed(3)),
      labels: {
        roll: labelOf('roll', s.roll),
        shotSize: labelOf('shotSize', s.annotation.shotSize),
        cameraMove: labelOf('cameraMove', s.annotation.cameraMove),
      },
    })),
  }, null, 2);
}
