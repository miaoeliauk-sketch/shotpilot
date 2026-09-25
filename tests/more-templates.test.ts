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

describe('帖子截图 · 翻译黑条', async () => {
  const post = await import('../templates/src/post-translate/params');
  const { cardPose, barProgress, closeupBarLeft, CLOSE } = await import('../templates/src/post-translate/PostTranslate');
  const { wrapWords, layoutPost, barTextWidth, BAR } = await import('../templates/src/post-translate/PostCard');

  it('默认按原片：第 51 帧刷黑条、第 140 帧切特写，一共 193 帧（141 + 53，切的那帧是同一帧）', () => {
    const p = post.toProps(post.defaultParams);
    expect([p.barAt, p.closeAt, p.durationInFrames]).toEqual([51, 140, 193]);
  });

  it('关掉特写就不切', () => {
    expect(post.toProps({ ...post.defaultParams, closeup: false }).closeAt).toBe(-1);
  });

  it('卡片从左下斜着滑到正中间，越来越慢，停住以后还在慢慢放大', () => {
    const p = post.toProps(post.defaultParams);
    const a = cardPose(0, p);
    const b = cardPose(30, p);
    const c = cardPose(70, p);
    expect(a.x).toBeCloseTo(368.2, 0);
    expect(a.y).toBeCloseTo(577.9, 0);
    expect(a.rotate).toBeCloseTo(4.77, 1);
    expect(c.x).toBeCloseTo(639.4, 0);
    expect(c.y).toBeCloseTo(358.8, 0);
    expect(b.x - a.x).toBeGreaterThan(c.x - b.x);
    expect(cardPose(130, p).scale).toBeGreaterThan(c.scale);
  });

  it('黑条先快后慢刷出来，刷完停在 1', () => {
    const p = { barAt: 51, barFrames: 73 };
    expect(barProgress(50, p)).toBe(0);
    expect(barProgress(60, p) - barProgress(51, p)).toBeGreaterThan(barProgress(124, p) - barProgress(100, p));
    expect(barProgress(124, p)).toBe(1);
    expect(barProgress(200, p)).toBe(1);
  });

  it('句尾是全角标点时，黑条收在字形后面，不留整格', () => {
    const a = barTextWidth('我不怕苹果');
    const b = barTextWidth('我不怕苹果。');
    expect(b - a).toBeLessThan(BAR.size * BAR.squeeze);
    expect(b).toBeGreaterThan(a);
  });

  it('英文按单词换行，不拆开单词', () => {
    const lines = wrapWords('i am not afraid of apple, but i have tremendous respect for them', '20px sans-serif', 200);
    expect(lines.length).toBeGreaterThan(1);
    for (const l of lines) expect(l).toBe(l.trim());
    expect(lines.join(' ')).toBe('i am not afraid of apple, but i have tremendous respect for them');
  });

  it('上面那条多一行，下面的东西整体往下挪一行', () => {
    const base = post.toProps(post.defaultParams);
    const one = layoutPost({ ...base, parent: { ...base.parent, text: 'short' } });
    const three = layoutPost({ ...base, parent: { ...base.parent, text: 'word '.repeat(80) } });
    expect(three.parentLines.length).toBeGreaterThan(2);
    expect(three.y.bar - one.y.bar).toBeCloseTo((three.parentLines.length - 1) * 26, 5);
  });

  it('特写：从句首滑到句尾（右端停在 x 1100）；句子很短也至少滑 200', () => {
    const long = 400;
    expect(closeupBarLeft(0, long, 52)).toBeCloseTo(CLOSE.startLeft, 5);
    expect(closeupBarLeft(52, long, 52) + long * CLOSE.k).toBeCloseTo(CLOSE.endRight, 5);
    const short = 60;
    expect(closeupBarLeft(0, short, 52) - closeupBarLeft(52, short, 52)).toBeCloseTo(200, 5);
  });

  it('拖特写那段的右边改视频时长', () => {
    const next = post.timeline.apply(raw(post.defaultParams), 'close', 'end', 4.67, 8);
    expect(next.duration).toBe(8);
  });
});

describe('翻译金句 · 特写横移', async () => {
  const quote = await import('../templates/src/quote-closeup/params');

  it('只有特写，默认 53 帧、52 帧滑完', () => {
    const p = quote.toProps(quote.defaultParams);
    expect(p.closeOnly).toBe(true);
    expect(p.durationInFrames).toBe(53);
    expect(p.closeFrames).toBeCloseTo(51.9, 1);
  });
});

describe('英文原文特写 · 翻译黑条', async () => {
  const tweet = await import('../templates/src/tweet-translate/params');
  const { parseBold, wrapRich, layoutPage, camera, wipeProgress, PAGE } = await import('../templates/src/tweet-translate/TweetTranslate');

  it('默认按原片：第 5、58 帧开始刷黑条，一共 118 帧', () => {
    const p = tweet.toProps(tweet.defaultParams);
    expect(p.lines.map((l) => Math.round(l.at))).toEqual([5, 58]);
    expect(p.durationInFrames).toBe(118);
  });

  it('**粗体** 拆成粗细两段，换行时粗细跟着单词走', () => {
    expect(parseBold('a **b c** d')).toEqual([{ text: 'a ', bold: false }, { text: 'b c', bold: true }, { text: ' d', bold: false }]);
    const lines = wrapRich('word '.repeat(60) + '**bold words**', 400);
    expect(lines.length).toBeGreaterThan(1);
    expect(lines[lines.length - 1]!.some((s) => s.bold)).toBe(true);
  });

  it('段落之间空一行；黑条压在指定那段的第一行', () => {
    const layout = layoutPage(['one', 'two'], 1);
    expect(layout.lines[1]!.baseline - layout.lines[0]!.baseline).toBeCloseTo(PAGE.pitch * 2, 5);
    expect(layout.anchorBaseline).toBe(layout.lines[1]!.baseline);
  });

  it('镜头往右下漂，越来越慢；黑条先慢后快再慢', () => {
    expect(camera(10).y - camera(0).y).toBeGreaterThan(camera(117).y - camera(100).y);
    expect(wipeProgress(4, 5, 52)).toBe(0);
    expect(wipeProgress(30, 5, 52) - wipeProgress(25, 5, 52)).toBeGreaterThan(wipeProgress(10, 5, 52) - wipeProgress(5, 5, 52));
    expect(wipeProgress(57, 5, 52)).toBe(1);
  });
});

describe('文章截图 · 黑条涂重点 · 推近', async () => {
  const art = await import('../templates/src/article-marker/params');
  const { layoutArticle, articleCamera } = await import('../templates/src/article-marker/ArticleMarker');

  it('默认按原片：第 34 帧涂黑、推近，一共 134 帧', () => {
    const p = art.toProps(art.defaultParams);
    expect([p.markAt, p.zoomAt, p.durationInFrames]).toEqual([34, 34, 134]);
  });

  it('开头从帖子特写拉远到 1 倍；推近最后停在 2.45 倍、要标的那句在画面中间', () => {
    const p = { pullBack: true, zoomAt: 34, zoomFrames: 54 };
    expect(articleCamera(0, p, [411, 261]).s).toBeCloseTo(1.2127, 3);
    expect(articleCamera(31, p, [411, 261]).s).toBeCloseTo(1, 3);
    const end = articleCamera(88, p, [411, 261]);
    expect(end.s).toBeCloseTo(2.455, 3);
    // 文章里的目标点落在画面中心（画面 = pos + s ×（文章坐标 − 画面中心））
    expect(end.x + end.s * (411 - 640)).toBeCloseTo(640, 3);
    expect(end.y + end.s * (261 - 360)).toBeCloseTo(360, 3);
  });

  it('关掉拉远，一开始就是 1 倍', () => {
    expect(articleCamera(0, { pullBack: false, zoomAt: 34, zoomFrames: 54 }, [411, 261]).s).toBe(1);
  });

  it('长段落按宽度换行，逗号句号不放行首', () => {
    const { lines } = layoutArticle(['字'.repeat(80) + '，结尾。']);
    expect(lines.length).toBeGreaterThan(1);
    for (const l of lines.slice(1)) expect(/^[，。]/.test(l.text)).toBe(false);
  });
});

describe('场景拼贴 · 墙上大字 · 钉标签', async () => {
  const office = await import('../templates/src/office-tags/params');
  const { wideCamera } = await import('../templates/src/office-tags/OfficeTags');

  it('默认按原片：第 66 帧切全景，右边标签第 104 帧、左边第 114 帧，一共 270 帧', () => {
    const p = office.toProps(office.defaultParams);
    expect(p.cutAt).toBe(66);
    expect(p.tags.map((t) => t.at)).toEqual([114, 104]);
    expect(p.durationInFrames).toBe(270);
  });

  it('全景一开始放大，越来越慢地拉远，最后略小于 1 倍', () => {
    expect(wideCamera(0).s).toBeCloseTo(1.2676, 3);
    expect(wideCamera(134).s).toBeCloseTo(1, 3);
    expect(wideCamera(0).s - wideCamera(20).s).toBeGreaterThan(wideCamera(100).s - wideCamera(120).s);
    expect(wideCamera(300).s).toBeLessThan(1);
  });

  it('拖标签块改它钉上去的时间', () => {
    const next = office.timeline.apply(raw(office.defaultParams), 'tag-1', 'move', 5, 5.6);
    expect((next.tags as { at: number }[])[1]!.at).toBe(5);
  });
});

describe('公司铭牌 · 人数 · 引语 · 墨刷日期页', async () => {
  const story = await import('../templates/src/nameplate-story/params');
  const { canonTime, CANON, quoteShown } = await import('../templates/src/nameplate-story/NameplateStory');

  it('默认按原片：第 96 帧出人数、150 帧横甩、372 帧墨刷，一共 468 帧', () => {
    const p = story.toProps(story.defaultParams);
    expect([p.countAt, p.whipAt, p.brushAt, p.durationInFrames]).toEqual([96, 150, 372, 468]);
  });

  it('用户改了时间点，各段按比例拉长缩短，时间点对上原片的时间点', () => {
    const p = { countAt: 120, whipAt: 200, brushAt: 500 };
    expect(canonTime(0, p)).toBe(0);
    expect(canonTime(120, p)).toBeCloseTo(CANON.countAt, 5);
    expect(canonTime(200, p)).toBeCloseTo(CANON.whipAt, 5);
    expect(canonTime(500, p)).toBeCloseTo(CANON.brushAt, 5);
    expect(canonTime(510, p)).toBeCloseTo(CANON.brushAt + 10, 5);
  });

  it('引语一个字一个字打出来，打完停住', () => {
    const q = { before: '这些人临走前，还拿', key: 'U盘', after: '' };
    expect(quoteShown(0, 189, q)).toBe(0);
    expect(quoteShown(0, 215, q)).toBeGreaterThan(0);
    expect(quoteShown(0, 300, q)).toBe(Array.from(`“${q.before}${q.key}${q.after}”`).length);
  });
});

describe('聚光圆台 · 上摇到标签页', async () => {
  const spot = await import('../templates/src/spotlight-detour/params');
  const { sceneACamera, panOffset, wrapChars } = await import('../templates/src/spotlight-detour/SpotlightDetour');

  it('默认按原片：第 28 帧金字、76 帧左字、102 帧右字、244 帧上摇、298 帧粉圆，一共 512 帧', () => {
    const p = spot.toProps(spot.defaultParams);
    expect([p.centerAt, p.leftAt, p.rightAt, p.panAt, p.circleAt, p.durationInFrames]).toEqual([28, 76, 102, 244, 298, 512]);
  });

  it('圆台从 1.71 倍拉远，150 帧回到 1 倍', () => {
    expect(sceneACamera(15).s).toBeCloseTo(1.71, 2);
    expect(sceneACamera(150).s).toBeCloseTo(1.006, 3);
    expect(sceneACamera(15).s - sceneACamera(60).s).toBeGreaterThan(sceneACamera(100).s - sceneACamera(145).s);
  });

  it('往上摇：先慢后快再慢，冲过头一点再回到 720', () => {
    expect(panOffset(0)).toBe(0);
    expect(panOffset(20) - panOffset(16)).toBeGreaterThan(panOffset(4) - panOffset(0));
    expect(Math.max(...[48, 52, 56].map(panOffset))).toBeGreaterThan(720);
    expect(panOffset(200)).toBe(720);
  });

  it('标签小字按宽度换行', () => {
    expect(wrapChars('字'.repeat(40), '19px sans-serif', 300).length).toBeGreaterThan(1);
  });
});

describe('纸片堆（两个模板共用）', async () => {
  const { paperPose } = await import('../templates/src/paper-cards/PaperCards');

  it('从起点飞过来，8 帧落到位置上，落地前又小又虚、转得多', () => {
    const slot = { n: 1, x: 500, y: 400, rot: -10, at: 10, from: [300, 700] as [number, number] };
    expect(paperPose(slot, 9).visible).toBe(false);
    const mid = paperPose(slot, 12);
    expect(mid.scale).toBeLessThan(1);
    expect(mid.blur).toBeGreaterThan(0);
    const end = paperPose(slot, 18);
    expect([end.x, end.y, end.rot, end.scale, end.blur]).toEqual([500, 400, -10, 1, 0]);
  });
});

describe('人物 + logo 挡脸 · 标题滑出 · 纸片堆', async () => {
  const ltc = await import('../templates/src/logo-title-cards/params');
  const { camera } = await import('../templates/src/logo-title-cards/LogoTitleCards');

  it('默认按原片：第 92 帧飞纸片、第 170 帧出深灰圆，一共 279 帧', () => {
    const p = ltc.toProps(ltc.defaultParams);
    expect([p.cardsAt, p.discAt, p.durationInFrames]).toEqual([92, 170, 279]);
  });

  it('镜头从 1.21 倍拉远到 1 倍，中间再拉远一点又推回来', () => {
    expect(camera(0).s).toBeCloseTo(1.207, 3);
    expect(camera(60).s).toBeCloseTo(1.004, 3);
    expect(camera(160).s).toBeLessThan(camera(250).s);
  });
});

describe('文件截图 → 人物 · 金色数字 · 纸片', async () => {
  const dpc = await import('../templates/src/doc-portrait-count/params');
  const { docPose, countAt } = await import('../templates/src/doc-portrait-count/DocPortraitCount');

  it('默认按原片：第 142 帧文件滑走、182 帧出数字、346 帧飞纸片，一共 440 帧', () => {
    const p = dpc.toProps(dpc.defaultParams);
    expect([p.docOutAt, p.countAt, p.cardsAt, p.durationInFrames]).toEqual([142, 182, 346, 440]);
  });

  it('文件斜着滑进来、摆正；滑走时越来越虚、出画面', () => {
    expect(docPose(0, 142).x).toBeLessThan(0);
    expect(docPose(0, 142).rot).toBeCloseTo(-8, 5);
    expect(docPose(80, 142).rot).toBe(0);
    expect(docPose(80, 142).blur).toBe(0);
    expect(docPose(190, 142).x).toBeGreaterThan(1280 + 500);
    expect(docPose(165, 142).blur).toBeGreaterThan(5);
  });

  it('数字从 0 数到目标，8 帧数完', () => {
    expect(countAt(182, 182, 30)).toBe(0);
    expect(countAt(186, 182, 30)).toBeGreaterThan(0);
    expect(countAt(186, 182, 30)).toBeLessThan(30);
    expect(countAt(190, 182, 30)).toBe(30);
  });
});

describe('三个金字 · 金色圆 → 深色新闻页', async () => {
  const gcn = await import('../templates/src/gold-chars-news/params');
  const { stripProgress, underlinesByLine } = await import('../templates/src/gold-chars-news/GoldCharsNews');

  it('默认按原片：金字第 8、26、58 帧，第 44 帧升圆，156 帧暗下去，184 帧新闻页，一共 281 帧', () => {
    const p = gcn.toProps(gcn.defaultParams);
    expect(p.chars.map((c) => c.at)).toEqual([8, 26, 58]);
    expect([p.discAt, p.darkAt, p.newsAt, p.durationInFrames]).toEqual([44, 156, 184, 281]);
  });

  it('金粉落下：每一条在 14 帧内都落到位', () => {
    for (let i = 0; i < 9; i++) {
      expect(stripProgress(7, 8, i, 9)).toBe(0);
      expect(stripProgress(22, 8, i, 9)).toBe(1);
    }
  });

  it('重点句每一行各画一条线，从这一行第一个标橙的字画到最后一个', () => {
    const c = (line: number, x: number, highlight: boolean) => ({ ch: '字', x, center: 100 + line * 58, width: 38, paragraph: 0, index: 0, line, highlight });
    const lines = underlinesByLine([c(0, 100, false), c(0, 138, true), c(0, 176, true), c(1, 77, true), c(1, 115, false)]);
    expect(lines).toEqual([
      { line: 0, x0: 138, x1: 214, center: 100 },
      { line: 1, x0: 77, x1: 115, center: 158 },
    ]);
  });
});
