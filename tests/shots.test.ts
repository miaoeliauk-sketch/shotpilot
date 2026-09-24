import { describe, expect, it } from 'vitest';
import { buildShots, carryOverAnnotations, emptyShot, mergeWithPrevious, splitShot, splitShotByCuts } from '../src/analyze/shots.js';
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

describe('splitShot', () => {
  const base = () => [
    { ...emptyShot(0, 0, 10), roll: 'a-roll' as const, note: '原备注', reviewed: true, annotation: { shotSize: 'medium' as const } },
    emptyShot(1, 10, 20),
  ];

  it('在指定时间切成两段，边界首尾相接', () => {
    const out = splitShot(base(), 's001', 4);
    expect(out).toHaveLength(3);
    expect(out.map((s) => [s.start, s.end])).toEqual([[0, 4], [4, 10], [10, 20]]);
  });

  it('切完重排编号，不出现重复 id', () => {
    const out = splitShot(base(), 's001', 4);
    expect(out.map((s) => s.id)).toEqual(['s001', 's002', 's003']);
    expect(out.map((s) => s.index)).toEqual([0, 1, 2]);
  });

  it('前半段保留全部标注和已审状态', () => {
    const out = splitShot(base(), 's001', 4);
    expect(out[0]).toMatchObject({ note: '原备注', reviewed: true, roll: 'a-roll' });
    expect(out[0]?.annotation.shotSize).toBe('medium');
  });

  it('后半段只继承 A/B-roll 归类，其余留空待确认', () => {
    const out = splitShot(base(), 's001', 4);
    expect(out[1]?.roll).toBe('a-roll');
    expect(out[1]?.note).toBe('');
    expect(out[1]?.reviewed).toBe(false);
    expect(out[1]?.annotation).toEqual({});
  });

  it('切分点贴着边界时报错而不是造出零长镜头', () => {
    expect(() => splitShot(base(), 's001', 0.01)).toThrow(/太近/);
    expect(() => splitShot(base(), 's001', 9.99)).toThrow(/太近/);
  });

  it('镜头不存在或时间非法时报错', () => {
    expect(() => splitShot(base(), 's999', 4)).toThrow(/不存在/);
    expect(() => splitShot(base(), 's001', NaN)).toThrow(/无效/);
  });
});

describe('mergeWithPrevious', () => {
  const base = () => [
    { ...emptyShot(0, 0, 5), roll: 'a-roll' as const, note: '前', elements: ['话筒'], annotation: { shotSize: 'close' as const } },
    { ...emptyShot(1, 5, 12), roll: 'b-roll' as const, note: '后', elements: ['产品'], reviewed: true, annotation: { shotSize: 'wide' as const } },
    emptyShot(2, 12, 20),
  ];

  it('并入上一个镜头并接管时间范围', () => {
    const out = mergeWithPrevious(base(), 's002');
    expect(out).toHaveLength(2);
    expect(out.map((s) => [s.start, s.end])).toEqual([[0, 12], [12, 20]]);
  });

  it('判断性标注以前一个为准，不被后一个覆盖', () => {
    const out = mergeWithPrevious(base(), 's002');
    expect(out[0]?.roll).toBe('a-roll');
    expect(out[0]?.annotation.shotSize).toBe('close');
  });

  it('累加性信息合并去重', () => {
    const out = mergeWithPrevious(base(), 's002');
    expect(out[0]?.elements).toEqual(['话筒', '产品']);
    expect(out[0]?.note).toBe('前\n后');
  });

  it('边界变了就撤销已审状态', () => {
    const out = mergeWithPrevious(base(), 's002');
    expect(out[0]?.reviewed).toBe(false);
  });

  it('第一个镜头无法向前合并', () => {
    expect(() => mergeWithPrevious(base(), 's001')).toThrow(/第一个镜头/);
  });

  it('合并后重排编号', () => {
    const out = mergeWithPrevious(base(), 's002');
    expect(out.map((s) => s.id)).toEqual(['s001', 's002']);
  });
});

describe('splitShotByCuts', () => {
  const base = () => [
    { ...emptyShot(0, 0, 5), roll: 'a-roll' as const, note: '前面的镜头' },
    { ...emptyShot(1, 5, 40), roll: 'b-roll' as const, note: '录屏演示段', annotation: { shotSize: 'insert' as const } },
  ];

  it('按检测到的切点把镜头切成多段', () => {
    const out = splitShotByCuts(base(), 's002', [
      { time: 12, score: 0.09 }, { time: 20, score: 0.07 }, { time: 31, score: 0.06 },
    ]);
    expect(out.map((s) => [s.start, s.end])).toEqual([[0, 5], [5, 12], [12, 20], [20, 31], [31, 40]]);
  });

  it('忽略落在目标镜头之外的切点', () => {
    const out = splitShotByCuts(base(), 's002', [
      { time: 2, score: 0.5 }, { time: 12, score: 0.09 }, { time: 99, score: 0.5 },
    ]);
    expect(out).toHaveLength(3);
    expect(out.map((s) => [s.start, s.end])).toEqual([[0, 5], [5, 12], [12, 40]]);
  });

  it('首段保留原标注，后续段只继承归类', () => {
    const out = splitShotByCuts(base(), 's002', [{ time: 12, score: 0.09 }]);
    expect(out[1]).toMatchObject({ note: '录屏演示段', roll: 'b-roll' });
    expect(out[1]?.annotation.shotSize).toBe('insert');
    expect(out[2]).toMatchObject({ note: '', roll: 'b-roll', reviewed: false });
    expect(out[2]?.annotation).toEqual({});
  });

  it('一个切点都没有时原样返回，不动结构', () => {
    const shots = base();
    expect(splitShotByCuts(shots, 's002', [])).toBe(shots);
    expect(splitShotByCuts(shots, 's002', [{ time: 100, score: 1 }])).toBe(shots);
  });

  it('挤在一起的切点只保留够间隔的，不切出碎片', () => {
    const out = splitShotByCuts(base(), 's002', [
      { time: 12, score: 0.1 }, { time: 12.02, score: 0.1 }, { time: 12.04, score: 0.1 },
    ]);
    expect(out).toHaveLength(3);
  });

  it('切完重排编号', () => {
    const out = splitShotByCuts(base(), 's002', [{ time: 12, score: 0.09 }, { time: 20, score: 0.07 }]);
    expect(out.map((s) => s.id)).toEqual(['s001', 's002', 's003', 's004']);
  });
});

describe('归类来源和适不适合做模板跟着镜头走', () => {
  it('补刀后后半段继承归类、来源和适不适合做模板', () => {
    const shots = [{ ...emptyShot(0, 0, 4), roll: 'b-roll' as const, rollSource: 'ai' as const, templateFit: { fit: true, reason: '图形', source: 'ai' as const } }];
    const next = splitShot(shots, 's001', 2);
    expect(next[1]).toMatchObject({ roll: 'b-roll', rollSource: 'ai', templateFit: { fit: true } });
  });
});
