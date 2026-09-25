import { describe, expect, it } from 'vitest';
import * as doc from '../templates/src/doc-highlight/params';
import { highlightSegments } from '../templates/src/doc-highlight/DocHighlight';
import * as bubbles from '../templates/src/product-bubbles/params';
import { camera, SLOTS } from '../templates/src/product-bubbles/ProductBubbles';
import * as photo from '../templates/src/photo-title/params';
import * as pointing from '../templates/src/pointing-interview/params';
import { TEMPLATES } from '../templates/src/registry';
import type { BodyChar } from '../templates/src/text-layout';

const raw = (p: unknown) => p as Record<string, unknown>;

describe('模板注册表', () => {
  it('每个模板 id 不重复，默认参数都能换算出正的时长', () => {
    const ids = TEMPLATES.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const t of TEMPLATES) expect(t.toProps(t.defaultParams).durationInFrames).toBeGreaterThan(0);
  });

  it('默认时长复现各自的原片', () => {
    const frames = Object.fromEntries(TEMPLATES.map((t) => [t.id, t.toProps(t.defaultParams).durationInFrames]));
    expect(frames['doc-highlight']).toBe(154);
    expect(frames['product-bubbles']).toBe(111);
    expect(frames['photo-title']).toBe(196);
    expect(frames['pointing-interview']).toBe(333);
    expect(frames['clause-typewriter']).toBe(156);
    expect(frames['orbit-labels']).toBe(450);
    expect(frames['torn-cards']).toBe(160);
    expect(frames['cards-note']).toBe(78);
    expect(frames['verdict-title']).toBe(129);
  });
});

describe('新闻稿荧光笔', () => {
  it('默认按原片：第 73 帧切特写、推近提前 15 帧、第 89 帧开始划', () => {
    const p = doc.toProps(doc.defaultParams);
    expect([p.cutAt, p.pushAt, p.highlightAt]).toEqual([73, 58, 89]);
  });

  it('荧光笔按行分段：同一行连成一条，换行另起一条', () => {
    const c = (x: number, center: number, highlight = true): BodyChar => ({ ch: '字', x, center, width: 30, paragraph: 0, index: 0, line: 0, highlight });
    const segs = highlightSegments([c(0, 100, false), c(30, 100), c(60, 100), c(0, 150), c(30, 150, false)]);
    expect(segs).toEqual([{ x0: 30, x1: 90, center: 100 }, { x0: 0, x1: 30, center: 150 }]);
  });

  it('拖长远景段，荧光笔跟着往后挪', () => {
    const next = doc.timeline.apply(raw(doc.defaultParams), 'wide', 'end', 0, 3) as unknown as doc.DocHighlightParams;
    expect(next.cutAt).toBeCloseTo(3, 5);
    // 2.97 + 0.57 = 3.54，对齐到整帧是 3.53
    expect(next.highlightAt).toBeCloseTo(3.53, 5);
  });
});

describe('产品圆球', () => {
  it('推之前镜头对着画面中间，推完停在目标球附近、放大 2.17 倍', () => {
    const target = SLOTS[2]!;
    const before = camera(44, 45, target);
    expect(before.s).toBeCloseTo(1, 5);
    const after = camera(45 + 60, 45, target);
    expect(after.s).toBeCloseTo(2.1657, 3);
    expect(Math.hypot(after.x - target.x, after.y - target.y)).toBeLessThan(30);
  });

  it('最多三个球，镜头推向的球号不会越界', () => {
    const p = bubbles.toProps({ ...bubbles.defaultParams, bubbles: [...bubbles.defaultParams.bubbles, { label: '多', sub: '' }] });
    expect(p.bubbles).toHaveLength(3);
  });
});

describe('闪白切换 · 竖排标题', () => {
  it('默认按原片：第 46 帧闪白最亮、第 56 帧出标题', () => {
    const p = photo.toProps(photo.defaultParams);
    expect([p.flashAt, p.titleAt]).toEqual([46, 56]);
  });

  it('标题不会早于闪白；挪闪白时标题跟着挪', () => {
    expect(photo.toProps({ ...photo.defaultParams, titleAt: 0 }).titleAt).toBe(48);
    const next = photo.timeline.apply(raw(photo.defaultParams), 'photo1', 'end', 0, 2.53) as unknown as photo.PhotoTitleParams;
    expect(next.titleAt).toBeCloseTo(2.87, 5);
  });
});

describe('指向人物 · 对话场景', () => {
  it('对话框按「放在哪」换算成场景二里的位置', () => {
    const p = pointing.toProps(pointing.defaultParams);
    expect(p.bubbles.map((b) => [b.x, b.y])).toEqual([[753, 250], [135, 319], [447, 118]]);
    expect(p.bubbles[2]!.small).toBe(true);
    expect(p.switchAt).toBe(156);
  });

  it('挪转场时，对话框一起挪；对话框不能拖到转场之前', () => {
    const next = pointing.timeline.apply(raw(pointing.defaultParams), 'sceneA', 'end', 0, 6.2) as unknown as pointing.PointingInterviewParams;
    expect(next.bubbles[0]!.at).toBeCloseTo(6.8, 5);
    const moved = pointing.timeline.apply(raw(pointing.defaultParams), 'bubble-1', 'move', 1, 2) as unknown as pointing.PointingInterviewParams;
    expect(moved.bubbles[1]!.at).toBeCloseTo(5.2, 5);
  });
});

describe('逐字砸下的标题', async () => {
  const { charStart } = await import('../templates/src/drop-title/DropTitle');
  const drop = await import('../templates/src/drop-title/params');

  it('4 个字照原片的顺序：先第 1、3 个，再第 2、4 个', () => {
    expect([0, 1, 2, 3].map((i) => charStart(i, 4))).toEqual([0, 11, 6, 12]);
  });

  it('别的字数也是单数位先出来', () => {
    const starts = Array.from({ length: 6 }, (_, i) => charStart(i, 6));
    expect(starts[0]).toBeLessThan(starts[1]!);
    expect(starts[2]).toBeLessThan(starts[1]!);
  });

  it('默认复现原片 118 帧，第 3 帧出字', () => {
    const p = drop.toProps(drop.defaultParams);
    expect([p.durationInFrames, p.startAt]).toEqual([118, 3]);
  });
});

describe('条文打字', async () => {
  const clause = await import('../templates/src/clause-typewriter/params');

  it('默认每秒 20 个字（每 1.5 帧一个），第 23 帧开始打、第 76 帧划重点', () => {
    const p = clause.toProps(clause.defaultParams);
    expect(p.framesPerChar).toBeCloseTo(1.5, 5);
    expect([p.typeAt, p.highlightAt]).toEqual([23, 76]);
  });

  it('拖打字块的右边改速度：最后一个字正好在那里打完', () => {
    const p = clause.defaultParams;
    const next = clause.timeline.apply(raw(p), 'type', 'end', 0, p.typeAt + 2) as unknown as typeof p;
    expect(next.typeSpeed).toBe(Math.round(Array.from(p.body).length / 2));
  });
});

describe('环绕标签', async () => {
  const { orbitProgress } = await import('../templates/src/orbit-labels/OrbitLabels');
  const orbit = await import('../templates/src/orbit-labels/params');
  const labels = orbit.toProps(orbit.defaultParams).labels;

  it('默认按原片：标签在第 63、135、201 帧出现', () => {
    expect(labels.map((l) => l.at)).toEqual([63, 135, 201]);
  });

  it('椭圆从第一个标签开始，经过右 → 左 → 上，最后一个之后画满一圈', () => {
    expect(orbitProgress(62, labels)).toBe(0);
    expect(orbitProgress(135, labels)).toBeCloseTo(0.5, 5);
    expect(orbitProgress(201, labels)).toBeCloseTo(0.75, 5);
    expect(orbitProgress(201 + 35, labels)).toBe(1);
  });
});

describe('对话框换行', async () => {
  const { wrapBubble } = await import('../templates/src/pointing-interview/PointingInterview');

  it('按字宽换行：省略号、英文比汉字窄，不会被当成整字多算一行', () => {
    // 测试里按「汉字 1 个字宽、英文 0.55 个」估：10 个汉字 + 3 个点 = 11.65 个字宽
    expect(wrapBubble('你知道那个某某项目吗...', '500 20px sans-serif', 240).lines).toHaveLength(1);
    expect(wrapBubble('你知道那个某某项目吗...', '500 20px sans-serif', 200).lines).toHaveLength(2);
  });

  it('框宽跟着最长那一行', () => {
    const w = wrapBubble('一二三', '400 20px sans-serif', 500);
    expect(w.width).toBe(60);
  });
});

describe('撕纸边卡片', async () => {
  const { cardPose } = await import('../templates/src/torn-cards/TornCards');
  const torn = await import('../templates/src/torn-cards/params');
  const cards = torn.toProps(torn.defaultParams).cards;

  it('默认按原片：第 3、72 帧进来，边长 534、396', () => {
    expect(cards.map((c) => c.at)).toEqual([3, 72]);
    expect(Math.round(cards[0]!.size)).toBe(533);
  });

  it('第一张斜着进来、最后摆正；下一张进来后几帧被甩出画面（原片第 74 帧左边还露一条边）', () => {
    expect(cardPose(0, cards, 3)!.rot).toBeCloseTo(16, 5);
    expect(cardPose(0, cards, 60)!.rot).toBeCloseTo(0, 5);
    expect(cardPose(0, cards, 72)!.x).toBeLessThan(0);
    expect(cardPose(0, cards, 76)).toBeNull();
  });

  it('后面的卡片从右边滑进来，越来越慢地停到中间', () => {
    const a = cardPose(1, cards, 80)!.x;
    const b = cardPose(1, cards, 120)!.x;
    expect(a).toBeGreaterThan(b);
    // 原片第 120 帧离中间还有 10px，第 150 帧才基本停住
    expect(b - 640).toBeGreaterThan(5);
    expect(cardPose(1, cards, 150)!.x - 640).toBeLessThan(2);
  });
});

describe('人物卡片', async () => {
  const company = await import('../templates/src/company-cards/params');
  const { typeSchedule } = await import('../templates/src/cards-note/CardsNote');

  it('公司名：默认第 110 帧横甩、第 206 帧第二张', () => {
    const p = company.toProps(company.defaultParams);
    expect([p.whipAt, p.card2At, p.durationInFrames]).toEqual([110, 206, 296]);
  });

  it('拖公司名那段的右边，后面的时间一起顺延', () => {
    const next = company.timeline.apply(raw(company.defaultParams), 'title', 'end', 0, 4.67) as unknown as typeof company.defaultParams;
    expect(next.card2At).toBeCloseTo(7.87, 5);
    expect(next.duration).toBeCloseTo(10.87, 5);
  });

  it('打字：英文快、中文慢，换行停一下', () => {
    const [l1, l2] = typeSchedule(['ab', '中文']);
    expect(l1).toEqual([0, 0.9]);
    expect(l2![0]).toBeCloseTo(1.8 + 6, 5);
    expect(l2![1]! - l2![0]!).toBeCloseTo(3.4, 5);
  });
});

describe('深色判决标题', async () => {
  const verdict = await import('../templates/src/verdict-title/params');

  it('默认每秒 135 个字（每帧 4.5 个），第 19 帧开始打', () => {
    const p = verdict.toProps(verdict.defaultParams);
    expect(p.charsPerFrame).toBeCloseTo(4.5, 5);
    expect(p.typeAt).toBe(19);
  });
});

describe('网页新闻截图', async () => {
  const { scrolled } = await import('../templates/src/news-screenshot/NewsScreenshot');
  const shot = await import('../templates/src/news-screenshot/params');

  it('滚动越来越慢：前 10 帧比后 10 帧滚得多得多', () => {
    expect(scrolled(10)).toBeGreaterThan(3 * (scrolled(51) - scrolled(41)));
    expect(scrolled(0)).toBe(0);
  });

  it('默认按原片：第 32 帧标重点、第 51 帧推近、第 88 帧配图压下来', () => {
    const p = shot.toProps(shot.defaultParams);
    expect([p.highlightAt, p.zoomAt, p.photoAt, p.durationInFrames]).toEqual([32, 51, 88, 219]);
  });
});
