import { describe, expect, it } from 'vitest';
import * as iconWords from '../templates/src/icon-red-words/params';
import { bandEdge, iconPose, wordProgress } from '../templates/src/icon-red-words/IconRedWords';
import * as bubbles from '../templates/src/icon-bubbles/params';
import { cameraScale, exitPose, rowTops, typedCount } from '../templates/src/icon-bubbles/IconBubbles';
import * as circles from '../templates/src/circle-photos/params';
import { cameraScale as circleCamera, dropIn, slots } from '../templates/src/circle-photos/CirclePhotos';

const raw = (p: unknown) => p as Record<string, unknown>;

describe('白色图标 · 两边红字', () => {
  it('默认按原片：164 帧，第 26 帧出左边、第 84 帧出右边', () => {
    const p = iconWords.toProps(iconWords.defaultParams);
    expect([p.durationInFrames, p.leftAt, p.rightAt]).toEqual([164, 26, 84]);
    expect(p.vignette).toBe(true);
  });

  it('图标从下面翻上来，45 帧后停在 (667, 318)、顺时针歪 16.4°', () => {
    const start = iconPose(0);
    expect(start.y).toBeGreaterThan(720);
    expect(start.rot).toBeLessThan(-20);
    expect(start.opacity).toBeLessThan(0.5);
    const end = iconPose(60);
    expect([end.x, end.y, end.rot, end.s, end.tilt, end.opacity]).toEqual([667, 318, 16.4, 1, 0, 1]);
    expect(iconPose(160).s).toBeLessThan(1);
  });

  it('红字 1 − e^(−t/14) 淡进来，34 帧基本到位；暗带从字前 8 帧开始扫', () => {
    expect(wordProgress(26, 26)).toBe(0);
    expect(wordProgress(40, 26)).toBeCloseTo(1 - Math.exp(-1), 5);
    expect(wordProgress(60, 26)).toBeGreaterThan(0.9);
    expect(bandEdge(10, 18, -330)).toBe(-330);
    expect(bandEdge(28, 18, -330)).toBe(-160);
  });

  it('右边的字留空就不出，时间轴上也没有它；拖动左边的字改出现时间', () => {
    const tracks = iconWords.timeline.tracks(raw({ ...iconWords.defaultParams, right: ' ' }));
    expect(tracks[1]!.items.map((i) => i.id)).toEqual(['left']);
    expect(iconWords.toProps({ ...iconWords.defaultParams, right: ' ' }).right).toBe('');
    const moved = iconWords.timeline.apply(raw(iconWords.defaultParams), 'left', 'move', 1.5, 2.6) as unknown as iconWords.IconRedWordsParams;
    expect(moved.leftAt).toBe(1.5);
  });
});

describe('图标 · 深色条打字', () => {
  it('默认按原片：314 帧，三行在第 0、79、146 帧出来，第 266 帧滑走；最后一行打得慢', () => {
    const p = bubbles.toProps(bubbles.defaultParams);
    expect(p.durationInFrames).toBe(314);
    expect(p.rows.map((r) => r.at)).toEqual([0, 79, 146]);
    expect(p.exitAt).toBe(266);
    expect(p.rows[0]!.step).toBe(2);
    expect(p.rows[2]!.step).toBeGreaterThan(8);
  });

  it('三行时第一行条顶 y 91、行距 190；四行收紧、上下居中', () => {
    expect(rowTops(3)).toEqual([91, 281, 471]);
    const four = rowTops(4);
    expect(four[1]! - four[0]!).toBe(150);
    expect((four[0]! + four[3]! + 76) / 2).toBeCloseTo(319, 5);
  });

  it('镜头以画面中心慢慢推近：0.917 → 1 倍（第 224 帧），滑走时间改了曲线跟着伸缩', () => {
    expect(cameraScale(0, 266)).toBeCloseTo(0.917, 5);
    expect(cameraScale(224, 266)).toBeCloseTo(1, 5);
    expect(cameraScale(448, 532)).toBeCloseTo(1, 5);
    expect(cameraScale(120, 266)).toBeLessThan(cameraScale(180, 266));
  });

  it('出来 18 帧后开始打字，按速度一个字一个字；打完不再多', () => {
    const row = { icon: '', text: '我无法解答', at: 10, step: 2 };
    expect(typedCount(27, row)).toBe(0);
    expect(typedCount(28, row)).toBe(1);
    expect(typedCount(32, row)).toBe(3);
    expect(typedCount(200, row)).toBe(5);
  });

  it('滑走：往左下走、逆时针歪、放大一点，最后淡掉', () => {
    expect(exitPose(100, 266)).toEqual({ dx: 0, dy: 0, rot: 0, s: 1, opacity: 1 });
    const end = exitPose(266 + 48, 266);
    expect(end.dx).toBeLessThan(-350);
    expect(end.dy).toBeGreaterThan(100);
    expect(end.rot).toBeLessThan(-8);
    expect(end.opacity).toBe(0);
  });

  it('最多四行；拖动时间轴上的一行改它出来的时间', () => {
    const many = { ...bubbles.defaultParams, rows: Array.from({ length: 6 }, (_, i) => ({ icon: '', text: `第${i}行`, at: i, speed: 10 })) };
    expect(bubbles.toProps(many).rows).toHaveLength(4);
    const moved = bubbles.timeline.apply(raw(bubbles.defaultParams), 'row-1', 'move', 3.1, 4) as unknown as bubbles.IconBubblesParams;
    expect(moved.rows[1]!.at).toBe(3.1);
    expect(moved.rows[0]!.at).toBe(0);
  });
});

describe('圆形图片 · 红引号标签', () => {
  it('默认按原片：116 帧，三张在第 0、16、46 帧落下来', () => {
    const p = circles.toProps(circles.defaultParams);
    expect(p.durationInFrames).toBe(116);
    expect(p.items.map((i) => i.at)).toEqual([0, 16, 46]);
  });

  it('三张时中间那张最大、略高；最多四张', () => {
    const three = slots(3);
    expect(three[1]!.r).toBeGreaterThan(three[0]!.r);
    expect(three[1]!.r).toBeGreaterThan(three[2]!.r);
    expect(three[1]!.y).toBeLessThan(three[0]!.y);
    const many = { ...circles.defaultParams, items: Array.from({ length: 6 }, (_, i) => ({ image: '', label: `${i}`, at: i })) };
    expect(circles.toProps(many).items).toHaveLength(4);
    expect(slots(4)).toHaveLength(4);
  });

  it('从上面落下来、淡进来；镜头慢慢拉远到 0.918 倍', () => {
    expect(dropIn(10, 10)).toEqual({ dy: -38, opacity: 0 });
    expect(dropIn(26, 10)).toEqual({ dy: -0, opacity: 1 });
    expect(circleCamera(0)).toBe(1);
    expect(circleCamera(115)).toBeCloseTo(0.9177, 4);
    expect(circleCamera(50)).toBeLessThan(circleCamera(20));
  });

  it('拖动时间轴上的一张改它落下来的时间', () => {
    const moved = circles.timeline.apply(raw(circles.defaultParams), 'item-2', 'move', 2.2, 3) as unknown as circles.CirclePhotosParams;
    expect(moved.items[2]!.at).toBe(2.2);
  });
});
