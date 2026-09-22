import { shotText, type ReelProject, type Shot } from '../core/types.js';
import { labelOf } from '../core/vocabulary.js';

/**
 * 导出给 hypit 的 SVML。
 *
 * ⚠️ 已验证 vs. 草稿，必须分清楚：
 *
 * 【已验证】以下来自 hypit 官方 @hypit/markup 的文档样例，结构是实的：
 *   - 处理指令 `<?svml using="@hypit/markup@1"?>`
 *   - 根元素 `<svml>`，`<import>` 必须先于 body 声明
 *   - `<script id="...">` 内以段落元素分段，角色提示写成 `<ROLE>文本`
 *   - markup 包本身**不含**脚本/媒体/视频词汇表，词汇来自导入的包
 *
 * 【草稿】镜头级的摄影标注（景别/运镜/光线等）在 hypit 公开文档里没有对应词汇表，
 * 所以这里写成 `<meta>` 注解挂在段落上，并把完整结构化数据同时输出成 JSON 附件。
 * 等拿到 @hypit/script / @hypit/film 的词汇表后，只需要改下面 SHOT_VOCAB 一处即可对齐，
 * 不用动调用方。绝不假装这部分已经是 hypit 能直接消费的格式。
 */

export const SVML_EXPORT_STATUS = {
  verified: ['processing-instruction', 'svml-root', 'import-ordering', 'script-segments', 'role-cues'],
  draft: ['shot-level-camera-annotations', 'media-track-vocabulary'],
} as const;

/** 词汇表映射点：拿到 hypit 官方镜头词汇表后只改这里。 */
const SHOT_VOCAB = {
  segmentTag: (shot: Shot) => (shot.roll === 'b-roll' ? 'broll' : 'segment'),
  metaPrefix: 'shotpilot',
} as const;

function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** 角色提示。口播统一用 HOST，除非转写做了说话人分离。 */
function roleFor(project: ReelProject, shot: Shot): string {
  const words = project.words.filter((w) => w.start < shot.end && w.end > shot.start);
  const speaker = words.find((w) => w.speaker)?.speaker;
  return (speaker ?? 'HOST').toUpperCase().replace(/[^A-Z0-9_]/g, '_');
}

export function toSvml(project: ReelProject): string {
  const lines: string[] = [];
  lines.push('<?svml using="@hypit/markup@1"?>');
  lines.push('<svml>');
  lines.push('  <import from="@hypit/script@1"/>');
  lines.push('');
  lines.push(`  <!-- 由 ShotPilot 从「${escapeXml(project.source.filename)}」拉片导出 -->`);
  lines.push(`  <!-- 镜头级摄影标注为 shotpilot: 前缀的 meta，待对齐 hypit 官方镜头词汇表 -->`);
  lines.push('');
  lines.push(`  <script id="${escapeXml(project.id.slice(0, 8))}">`);

  for (const shot of project.shots) {
    const tag = SHOT_VOCAB.segmentTag(shot);
    const text = shotText(project, shot);
    const a = shot.annotation;

    const metas: string[] = [
      `${SHOT_VOCAB.metaPrefix}:id="${shot.id}"`,
      `${SHOT_VOCAB.metaPrefix}:start="${shot.start.toFixed(3)}"`,
      `${SHOT_VOCAB.metaPrefix}:end="${shot.end.toFixed(3)}"`,
      `${SHOT_VOCAB.metaPrefix}:roll="${shot.roll}"`,
    ];
    if (a.shotSize) metas.push(`${SHOT_VOCAB.metaPrefix}:shot-size="${a.shotSize}"`);
    if (a.cameraMove) metas.push(`${SHOT_VOCAB.metaPrefix}:camera-move="${a.cameraMove}"`);
    if (a.angle) metas.push(`${SHOT_VOCAB.metaPrefix}:angle="${a.angle}"`);
    if (a.focalLength) metas.push(`${SHOT_VOCAB.metaPrefix}:focal="${a.focalLength}"`);
    if (a.composition?.length) metas.push(`${SHOT_VOCAB.metaPrefix}:composition="${a.composition.join(' ')}"`);
    if (a.lighting?.length) metas.push(`${SHOT_VOCAB.metaPrefix}:lighting="${a.lighting.join(' ')}"`);
    if (a.brollNeed) metas.push(`${SHOT_VOCAB.metaPrefix}:broll-need="${a.brollNeed}"`);

    lines.push(`    <${tag} ${metas.join(' ')}>`);
    if (shot.note.trim()) lines.push(`      <!-- 备注：${escapeXml(shot.note.trim())} -->`);
    if (shot.brollContent?.trim()) lines.push(`      <!-- B-roll：${escapeXml(shot.brollContent.trim())} -->`);
    if (text) {
      lines.push(`      <${roleFor(project, shot)}>${escapeXml(text)}`);
    }
    lines.push(`    </${tag}>`);
  }

  lines.push('  </script>');
  lines.push('</svml>');
  return lines.join('\n');
}

/**
 * 结构化附件。SVML 那边词汇表还没定下来，这份 JSON 是**确定可靠**的完整数据，
 * agent 复刻时应该优先读它。
 */
export function toHandoffJson(project: ReelProject): string {
  return JSON.stringify({
    generator: 'shotpilot@0.1.0',
    note: 'shots[].annotation 为结构化拉片标注；words 为词级时间戳，可直接用于 hypit 的按词锚定',
    source: project.source,
    shots: project.shots.map((s) => ({
      ...s,
      text: shotText(project, s),
      duration: Number((s.end - s.start).toFixed(3)),
      labels: {
        roll: labelOf('roll', s.roll),
        shotSize: labelOf('shotSize', s.annotation.shotSize),
        cameraMove: labelOf('cameraMove', s.annotation.cameraMove),
      },
    })),
    words: project.words,
    audio: project.audio,
  }, null, 2);
}
