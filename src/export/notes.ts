import { formatTime, type ReelProject } from '../core/types.js';
import { labelOf } from '../core/vocabulary.js';

/**
 * 导出 Markdown 拉片笔记。
 *
 * 这是给人看的产物——逐字稿里说"我们去进行学习的时候，就可以在这里针对每个分镜进行备注标注"，
 * 学习成果得能带走、能搜索、能贴进自己的笔记软件，而不是锁在这个工具里。
 */
export function toMarkdown(project: ReelProject): string {
  const lines: string[] = [];
  const src = project.source;

  lines.push(`# 拉片笔记：${project.title}`, '');
  lines.push(`- 源文件：\`${src.filename}\``);
  lines.push(`- 时长：${formatTime(src.duration)}　分辨率：${src.width}×${src.height}　帧率：${src.fps.toFixed(2)}`);
  lines.push(`- 镜头数：${project.shots.length}　已审：${project.shots.filter((s) => s.reviewed).length}`);
  lines.push('');

  if (project.note.trim()) {
    lines.push('## 整片备注', '', project.note.trim(), '');
  }

  // 结构速览：一眼看出这片子的节奏和 A/B-roll 配比
  const rollCount = new Map<string, number>();
  for (const s of project.shots) rollCount.set(s.roll, (rollCount.get(s.roll) ?? 0) + 1);
  const avgDur = project.shots.length
    ? project.shots.reduce((sum, s) => sum + (s.end - s.start), 0) / project.shots.length
    : 0;

  lines.push('## 结构速览', '');
  lines.push(`平均镜头时长 **${avgDur.toFixed(2)} 秒**`);
  lines.push('');
  lines.push('| 归类 | 镜头数 | 占比 |');
  lines.push('| --- | ---: | ---: |');
  for (const [roll, count] of [...rollCount].sort((a, b) => b[1] - a[1])) {
    const pct = ((count / project.shots.length) * 100).toFixed(0);
    lines.push(`| ${labelOf('roll', roll)} | ${count} | ${pct}% |`);
  }
  lines.push('');

  lines.push('## 逐镜拆解', '');
  for (const shot of project.shots) {
    const a = shot.annotation;
    lines.push(`### ${shot.id}　${formatTime(shot.start)} → ${formatTime(shot.end)}　(${(shot.end - shot.start).toFixed(2)}s)`);
    lines.push('');

    const tags: string[] = [];
    if (shot.roll !== 'unset') tags.push(`**${labelOf('roll', shot.roll)}**`);
    if (a.shotSize) tags.push(labelOf('shotSize', a.shotSize));
    if (a.cameraMove) tags.push(labelOf('cameraMove', a.cameraMove));
    if (a.angle) tags.push(labelOf('angle', a.angle));
    if (a.focalLength) tags.push(labelOf('focalLength', a.focalLength) + (a.focalLengthMm ? `(${a.focalLengthMm}mm)` : ''));
    for (const c of a.composition ?? []) tags.push(labelOf('composition', c));
    for (const l of a.lighting ?? []) tags.push(labelOf('lighting', l));
    if (a.transitionIn) tags.push(`入:${labelOf('transitionIn', a.transitionIn)}`);
    if (tags.length > 0) lines.push(tags.join('　·　'), '');

    if (shot.elements.length > 0) lines.push(`元素：${shot.elements.join('、')}`, '');
    if (shot.effects.length > 0) lines.push(`特效：${shot.effects.join('、')}`, '');
    if (shot.brollContent?.trim()) lines.push(`B-roll 内容：${shot.brollContent.trim()}`, '');
    if (a.brollNeed) lines.push(`复刻需求：${labelOf('brollNeed', a.brollNeed)}`, '');
    if (shot.note.trim()) lines.push(shot.note.trim(), '');
  }

  return lines.join('\n');
}
