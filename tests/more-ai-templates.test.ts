import { describe, expect, it } from 'vitest';
import * as ts from '../templates/src/two-sides/params';
import { camera as tsCamera, redProgress, tilePose } from '../templates/src/two-sides/TwoSides';
import * as pp from '../templates/src/poster-pair/params';
import { cameraScale as ppCamera, mergePose, typedMiddle } from '../templates/src/poster-pair/PosterPair';
import * as ne from '../templates/src/not-equal/params';
import { cameraScale as neCamera, wordsIn, wordsPose } from '../templates/src/not-equal/NotEqual';
import * as rs from '../templates/src/record-sheet/params';
import { sheetPose, written } from '../templates/src/record-sheet/RecordSheet';
import * as tnb from '../templates/src/title-number-brand/params';
import { brandBlur, brandLayout, camera1, camera2, camera3, digitFill, digitGradient, digitScale } from '../templates/src/title-number-brand/TitleNumberBrand';

const raw = (p: unknown) => p as Record<string, unknown>;

describe('中间图标 · 左右两段说明 · 红字结尾', () => {
  it('默认按原片：800 帧，254 推到左边、396 切右边、536 切回全景、594/650 出红字', () => {
    const p = ts.toProps(ts.defaultParams);
    expect([p.durationInFrames, p.leftAt, p.rightAt, p.backAt, p.redAt, p.redAt + p.redGap]).toEqual([800, 254, 396, 536, 594, 650]);
    expect(p.left.lines).toHaveLength(3);
  });

  it('镜头：第 200 帧 1 倍，切到左边、右边特写，再切回全景', () => {
    expect(tsCamera(200, 254, 396, 536)).toEqual({ s: 1, x: 640, y: 360 });
    expect(tsCamera(254, 254, 396, 536).s).toBeCloseTo(1.6931, 4);
    expect(tsCamera(254, 254, 396, 536).x).toBeGreaterThan(1000);
    expect(tsCamera(396, 254, 396, 536).x).toBeLessThan(200);
    expect(tsCamera(540, 254, 396, 536).s).toBeCloseTo(0.9986, 3);
    // 推到左边的时间改了，前面全景的曲线跟着伸缩
    expect(tsCamera(400, 508, 700, 900)).toEqual(tsCamera(200, 254, 396, 536));
  });

  it('切镜头的时间不会倒着来；图标从下面翻上来；红字按 1 − e^(−t/14) 亮起来', () => {
    const p = ts.toProps({ ...ts.defaultParams, rightAt: 1, backAt: 0.5 });
    expect(p.rightAt).toBeGreaterThan(p.leftAt);
    expect(p.backAt).toBeGreaterThan(p.rightAt);
    expect(tilePose(0).y).toBeGreaterThan(700);
    expect(tilePose(60).rot).toBe(12);
    expect(redProgress(594, 594)).toBe(0);
    expect(redProgress(608, 594)).toBeCloseTo(1 - Math.exp(-1), 5);
  });

  it('拖时间轴：全景块的尾巴改推到左边的时间', () => {
    const moved = ts.timeline.apply(raw(ts.defaultParams), 'wide', 'end', 0, 7) as unknown as ts.TwoSidesParams;
    expect(moved.leftAt).toBe(7);
  });
});

describe('两张海报卡片 · 合在一起 · 右边大字', () => {
  it('默认按原片：315 帧，第 128 帧合在一起，右边三行在 148、226、262 帧', () => {
    const p = pp.toProps(pp.defaultParams);
    expect(p.durationInFrames).toBe(315);
    expect(p.mergeAt).toBe(128);
    expect(p.lines.map((l) => l.at)).toEqual([148, 226, 262]);
    expect([p.left.tone, p.right.tone]).toEqual(['cream', 'peach']);
  });

  it('右卡片往左滑 560、往下 26，左卡片歪 −6°；镜头 120 帧 1 倍、越推越慢', () => {
    expect(mergePose(100, 128)).toEqual({ dx: 0, dy: 0, rot: -0 });
    const end = mergePose(160, 128);
    expect(end.dx).toBe(-560);
    expect(end.dy).toBeCloseTo(26, 5);
    expect(end.rot).toBeCloseTo(-6, 5);
    expect(ppCamera(120)).toBe(1);
    expect(ppCamera(300) - ppCamera(260)).toBeLessThan(ppCamera(200) - ppCamera(160));
  });

  it('开头的口播画面默认不放（一开始就是背景）；放了就在「第几秒换成背景」淡掉', () => {
    const p = pp.toProps(pp.defaultParams);
    expect(p.intro).toBe('');
    const withIntro = pp.toProps({ ...pp.defaultParams, intro: 'a-roll.mp4', introEnd: 3 });
    expect([withIntro.intro, withIntro.introEnd]).toEqual(['a-roll.mp4', 90]);
    const tracks = pp.timeline.tracks(raw({ ...pp.defaultParams, intro: 'a-roll.mp4', introEnd: 3 }));
    const phase = tracks[0]!.items[0]!.phases![0]!;
    expect([phase.label, phase.start]).toEqual(['换背景', 3]);
    expect(phase.end).toBeCloseTo(3.53, 5);
    expect(pp.timeline.tracks(raw(pp.defaultParams))[0]!.items[0]!.phases).toEqual([]);
  });

  it('中间那句从第 72 帧起每 4 帧打一个字；空的行不出', () => {
    expect(typedMiddle(71, '同一套')).toBe(0);
    expect(typedMiddle(76, '同一套')).toBe(2);
    expect(typedMiddle(200, '同一套')).toBe(3);
    const p = pp.toProps({ ...pp.defaultParams, lines: [{ before: '', big: ' ', after: '', at: 1 }, { before: '', big: '留', after: '', at: 2 }] });
    expect(p.lines).toHaveLength(1);
  });
});

describe('大字 A ≠ B · 两张海报卡片', () => {
  it('默认按原片：174 帧，第 104 帧盖上卡片', () => {
    const p = ne.toProps(ne.defaultParams);
    expect([p.durationInFrames, p.cardsAt]).toEqual([174, 104]);
    expect(p.leftCard.title).toBe('搜错文件');
  });

  it('镜头：大字慢慢拉远，盖卡片时跳回 1.023 倍；开头每个字从 1.38 倍缩回来', () => {
    expect(neCamera(60, 104)).toBe(1);
    expect(neCamera(103, 104)).toBeLessThan(0.95);
    expect(neCamera(104, 104)).toBeCloseTo(1.0229, 4);
    expect(neCamera(120, 208)).toBe(neCamera(60, 104));
    expect(wordsPose(0).s).toBeCloseTo(1.38, 5);
    expect(wordsPose(60)).toEqual({ s: 1, spread: 1, ne: 1 });
    expect(wordsIn(0)).toBe(0);
    expect(wordsIn(24)).toBe(1);
  });

  it('拖时间轴：大字块的尾巴改盖卡片的时间', () => {
    const moved = ne.timeline.apply(raw(ne.defaultParams), 'words', 'end', 0, 2.5) as unknown as ne.NotEqualParams;
    expect(moved.cardsAt).toBe(2.5);
  });
});

describe('旧档案表 · 飞进来 · 一栏栏填写', () => {
  it('默认按原片：152 帧，四栏在飞进来后第 16、26、50、70 帧开始写', () => {
    const p = rs.toProps(rs.defaultParams);
    expect(p.durationInFrames).toBe(152);
    expect(p.fields.map((f) => f.at)).toEqual([16, 26, 50, 70]);
  });

  it('飞进来 16 帧：从左下转着到中间，之后慢慢推近到 1 倍', () => {
    expect(sheetPose(0).rot).toBeCloseTo(11.6, 5);
    expect(sheetPose(0).y).toBeGreaterThan(800);
    expect(sheetPose(16)).toEqual({ x: 650, y: 350, s: 0.9164, rot: 0 });
    expect(sheetPose(126).s).toBe(1);
  });

  it('每 8 帧写一个字；推迟飞进来，写字的时间跟着往后挪', () => {
    const f = { label: 'NAME', value: 'XXX', at: 16 };
    expect(written(15, f)).toBe(0);
    expect(written(16, f)).toBe(1);
    expect(written(32, f)).toBe(3);
    const moved = rs.timeline.apply(raw(rs.defaultParams), 'cam', 'move', 1, 3) as unknown as rs.RecordSheetParams;
    expect(moved.enterAt).toBe(1);
    expect(moved.fields[0]!.at).toBeCloseTo(1.53, 5);
  });
});

describe('开场大标题 · 超大数字 · 发光品牌名', () => {
  it('默认不放口播画面：标题直接出现在深色底上；100 帧换数字、173 帧切品牌名、298 帧结束，一共 300 帧', () => {
    const p = tnb.toProps(tnb.defaultParams);
    expect(p.aroll).toBe('');
    expect([p.numberAt, p.brandAt, p.brandEnd, p.durationInFrames]).toEqual([100, 173, 298, 300]);
    expect(p.note.split('\n')).toHaveLength(2);
  });

  it('放了口播画面可以拉长，后面接着放口播；最短也要放到品牌名结束', () => {
    expect(tnb.toProps({ ...tnb.defaultParams, aroll: 'a.mp4', duration: 11.9 }).durationInFrames).toBe(357);
    expect(tnb.toProps({ ...tnb.defaultParams, duration: 3 }).durationInFrames).toBe(300);
  });

  it('开头大标题全空着：直接从数字开始，后面的时间一起往前挪', () => {
    const p = tnb.toProps({ ...tnb.defaultParams, top: '', mid: ' ', big: '', side: '' });
    expect([p.numberAt, p.brandAt, p.brandEnd]).toEqual([0, 73, 198]);
    expect(p.durationInFrames).toBe(200);
  });

  it('镜头：开头 1.333 倍拉到 1 倍；数字段 1.62 倍拉到 1 倍、切走前越拉越快；品牌名段结束前匀速推近', () => {
    expect(camera1(0)).toBeCloseTo(1.3335, 4);
    expect(camera1(60)).toBe(1);
    expect(camera2(0, -73)).toBeCloseTo(1.62, 4);
    expect(camera2(50, -23)).toBe(1);
    expect(camera2(72, -1)).toBeCloseTo(0.8008, 2);
    expect(camera3(0, -125)).toBeCloseTo(1.4149, 4);
    expect(camera3(77, -48)).toBe(1);
    expect(camera3(121, -4)).toBeCloseTo(1.2976, 1);
  });

  it('数字一位接一位从 4.5 倍缩回来；很大的那位已经填上色；品牌名从 10px 虚到实', () => {
    expect(digitScale(0, 4)).toBe(4.5);
    expect(digitScale(30, 0)).toBeCloseTo(1, 2);
    expect(digitScale(8, 1)).toBeLessThan(digitScale(8, 3));
    expect(digitFill(0, 0)).toBe(0);
    expect(digitFill(2, 4)).toBeCloseTo(0.45, 5);
    expect(digitFill(40, 4)).toBe(1);
    expect(digitGradient(2, 5)).toContain('rgb(157,199,223)');
    expect(digitGradient(0, 1)).toContain('rgb(157,199,223)');
    expect(brandBlur(0)).toBe(10);
    expect(brandBlur(60)).toBe(0);
  });

  it('品牌名一行以画面中心对齐；没有蓝字就不留菱形点的位置', () => {
    const w = (t: string) => t.length * 100;
    const a = brandLayout('KIMI', 'K3', w);
    const b = brandLayout('KIMI', '', w);
    // 白字 390 宽（字距 −2.5）、菱形点连两边空 30、蓝字 195：整行 615，中心在 640（再往右挪 2）
    expect(a.left).toBeCloseTo(334.5, 5);
    expect(a.dot).toBeCloseTo(733.5, 5);
    expect(a.accentLeft).toBeCloseTo(754.5, 5);
    expect(b.left).toBeCloseTo(640 - 390 / 2 + 2, 5);
  });

  it('拖时间轴：品牌名块的两头改切进来和结束的时间，结束往后拖会顺带拉长视频', () => {
    const moved = tnb.timeline.apply(raw(tnb.defaultParams), 'brand', 'start', 6.5, 9.93) as unknown as tnb.TitleNumberBrandParams;
    expect(moved.brandAt).toBe(6.5);
    const longer = tnb.timeline.apply(raw(tnb.defaultParams), 'brand', 'end', 5.77, 12) as unknown as tnb.TitleNumberBrandParams;
    expect(longer.brandEnd).toBe(12);
    expect(longer.duration).toBeGreaterThan(12);
    const tracks = tnb.timeline.tracks(raw(tnb.defaultParams));
    expect(tracks[0]!.items.map((i) => i.id)).toEqual(['title', 'number', 'brand']);
  });
});
