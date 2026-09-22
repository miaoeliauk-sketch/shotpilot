import { describe, expect, it } from 'vitest';
import { buildShots, carryOverAnnotations, emptyShot } from '../src/analyze/shots.js';
import type { Shot } from '../src/core/types.js';

describe('buildShots', () => {
  it('把切点变成首尾相接的镜头区间', () => {
    const shots = buildShots([{ time: 3, score: 0.5 }, { time: 7, score: 0.6 }], 10);
    expect(shots.map((s) => [s.start, s.end])).toEqual([[0, 3], [3, 7], [7, 10]]);
  });

  it('一个切点都没有时给出整片一个镜头', () => {
    const shots = buildShots([], 12);
    expect(shots).toHaveLength(1);
    expect(shots[0]).toMatchObject({ start: 0, end: 12, id: 's001' });
  });

  it('丢弃过短的碎片，等价于并入前一个镜头', () => {
    // 3.0 和 3.1 只隔 0.1 秒，低于 0.4 的下限
    const shots = buildShots([{ time: 3, score: 0.5 }, { time: 3.1, score: 0.5 }], 10, { minShotDuration: 0.4 });
    expect(shots.map((s) => [s.start, s.end])).toEqual([[0, 3], [3, 10]]);
  });

  it('忽略落在时长之外的切点', () => {
    const shots = buildShots([{ time: -1, score: 1 }, { time: 99, score: 1 }], 10);
    expect(shots).toHaveLength(1);
  });

  it('末尾碎片不会单独成镜头', () => {
    const shots = buildShots([{ time: 5, score: 0.5 }, { time: 9.9, score: 0.5 }], 10, { minShotDuration: 0.4 });
    expect(shots[shots.length - 1]?.end).toBe(10);
    expect(shots.every((s) => s.end - s.start >= 0.4)).toBe(true);
  });

  it('时长非法时报错而不是产出空项目', () => {
    expect(() => buildShots([], 0)).toThrow(/时长无效/);
  });
});

describe('carryOverAnnotations', () => {
  const annotate = (shot: Shot, note: string): Shot => ({
    ...shot, note, roll: 'b-roll', reviewed: true, annotation: { shotSize: 'closeup' },
  });

  it('重新切分后把标注迁移到重叠最多的新镜头', () => {
    const oldShots = [annotate(emptyShot(0, 0, 5), '前半段'), emptyShot(1, 5, 10)];
    const newShots = [emptyShot(0, 0, 4), emptyShot(1, 4, 10)];
    const merged = carryOverAnnotations(oldShots, newShots);
    expect(merged[0]?.note).toBe('前半段');
    expect(merged[0]?.annotation.shotSize).toBe('closeup');
    expect(merged[1]?.note).toBe('');
  });

  it('重叠不足一半时不继承，避免张冠李戴', () => {
    const oldShots = [annotate(emptyShot(0, 0, 2), '很短的一段')];
    const newShots = [emptyShot(0, 0, 10)];
    expect(carryOverAnnotations(oldShots, newShots)[0]?.note).toBe('');
  });

  it('旧项目没有任何标注时原样返回', () => {
    const newShots = [emptyShot(0, 0, 5)];
    expect(carryOverAnnotations([emptyShot(0, 0, 5)], newShots)).toBe(newShots);
  });
});
