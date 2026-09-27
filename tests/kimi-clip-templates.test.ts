import { describe, expect, it } from 'vitest';
import * as ct from '../templates/src/chrome-title/params';
import { groupScale } from '../templates/src/chrome-title/ChromeTitle';
import * as as from '../templates/src/article-swap/params';
import { barHeight, firstCamera, secondScale, typedChars } from '../templates/src/article-swap/ArticleSwap';
import * as pb from '../templates/src/prompt-box/params';
import { arms, camera as pbCamera, typed } from '../templates/src/prompt-box/PromptBox';
import * as cmp from '../templates/src/compare-table/params';
import { cameraScale as tableScale, cellIn } from '../templates/src/compare-table/CompareTable';
import * as rl from '../templates/src/ranking-logos/params';
import { barLength, dropIn, flip, linePoint, logoStarts, pushDown } from '../templates/src/ranking-logos/RankingLogos';
import * as mt from '../templates/src/marathon-title/params';
import { camera as mtCamera, titleIn } from '../templates/src/marathon-title/MarathonTitle';
import * as psl from '../templates/src/page-scroll-labels/params';
import { labelWipe, scrollOffset, zoom } from '../templates/src/page-scroll-labels/PageScrollLabels';
import * as sc from '../templates/src/story-cards/params';
import { camera as scCamera, cardIn, typedCount } from '../templates/src/story-cards/StoryCards';
import * as pt from '../templates/src/phone-talk/params';
import { ASK, REPLY, charIn, lineTop, rise, textRise, typed as ptTyped } from '../templates/src/phone-talk/PhoneTalk';
import * as cw from '../templates/src/card-words/params';
import { cardPose, dissolveAlpha, lumaInvert, panY, shadeOffset, verticalShade, wordSize } from '../templates/src/card-words/CardWords';
import * as hc from '../templates/src/halftone-captions/params';
import { captionSize, fadeIn, letterDelay } from '../templates/src/halftone-captions/HalftoneCaptions';
import * as tst from '../templates/src/title-score-table/params';
import * as wcp from '../templates/src/web-compare-pixels/params';
import * as bsc from '../templates/src/brain-stat-cards/params';
import { brainSpin, brainToWorld, camera as bscCamera, cardPhase, dotY, worldToBrain } from '../templates/src/brain-stat-cards/BrainStatCards';
import { CAM as BSC_CAM } from '../templates/src/brain-stat-cards/camera';
import { fabricValue } from '../templates/src/fabric';
import { barWipe, darkCamera, lensParams, squareLit, webCamera, wipeX } from '../templates/src/web-compare-pixels/WebComparePixels';
import { DARK_CAM, WEB_CAM } from '../templates/src/web-compare-pixels/camera';
import { FLOATERS, TABLE, cameraY, drift, floatLead, gridValue, settle, typedCount as tstTyped } from '../templates/src/title-score-table/TitleScoreTable';

const raw = (p: unknown) => p as Record<string, unknown>;

describe('金属拉丝大标题', () => {
  it('默认 76 帧；整组从 0.95 倍匀速放大，第 40 帧 1 倍', () => {
    const p = ct.toProps(ct.defaultParams);
    expect(p.durationInFrames).toBe(76);
    expect(groupScale(0)).toBeCloseTo(0.9497, 4);
    expect(groupScale(40)).toBeCloseTo(1, 2);
    expect(groupScale(75)).toBeGreaterThan(1.04);
  });

  it('背景亮度夹在 0.2–1；拖镜头块改时长', () => {
    expect(ct.toProps({ ...ct.defaultParams, dim: 5 }).dim).toBe(1);
    expect(ct.toProps({ ...ct.defaultParams, dim: 0 }).dim).toBe(0.2);
    const moved = ct.timeline.apply(raw(ct.defaultParams), 'cam', 'end', 0, 4) as unknown as ct.ChromeTitleParams;
    expect(moved.duration).toBe(4);
  });
});

describe('文章标题打字 · 高亮条 · 换下一篇', () => {
  it('默认第 50 帧换第二篇，一共 97 帧；正文按换行分段', () => {
    const p = as.toProps(as.defaultParams);
    expect([p.swapAt, p.durationInFrames]).toEqual([50, 97]);
    expect(p.first.body).toHaveLength(2);
    expect(p.second.prefix).toBe('Kimi K3:');
  });

  it('米黄条先是一条细线再长满；标题每帧打一个字；第二篇从 1.54 倍缩回来，30 帧后 1 倍', () => {
    expect(barHeight(0)).toBe(1.5);
    expect(barHeight(30)).toBe(68);
    expect(typedChars(0, 20)).toBe(0);
    expect(typedChars(11, 20)).toBe(10);
    expect(typedChars(99, 20)).toBe(20);
    expect(secondScale(50, 50)).toBeCloseTo(1.54, 2);
    expect(secondScale(80, 50)).toBe(1);
    expect(firstCamera(0, 50).dx).toBe(-330);
    expect(firstCamera(30, 50).dx).toBe(0);
    expect(firstCamera(75, 50).s).toBeLessThan(0.8);
  });

  it('换篇时间太早会被推到 1 秒；拖第二篇的块改换篇时间', () => {
    expect(as.toProps({ ...as.defaultParams, swapAt: 0.2 }).swapAt).toBe(30);
    const moved = as.timeline.apply(raw(as.defaultParams), 'second', 'start', 2.5, 4) as unknown as as.ArticleSwapParams;
    expect(moved.swapAt).toBe(2.5);
    expect(moved.duration).toBeGreaterThanOrEqual(3.54);
  });
});

describe('提示词框 · 特写扫过 · 打字', () => {
  it('默认两行提示词、162 帧', () => {
    const p = pb.toProps(pb.defaultParams);
    expect(p.lines).toHaveLength(2);
    expect(p.durationInFrames).toBe(162);
  });

  it('镜头：前 30 帧 2.25 倍特写，之后拉开、第 80 帧 1 倍居中；框线最后收完；每帧打 0.6 个字', () => {
    expect(pbCamera(20).s).toBeGreaterThan(2.2);
    expect(pbCamera(30).s).toBeCloseTo(1.0262, 4);
    expect(pbCamera(80)).toEqual({ x: 640, y: 360, s: 1, r: 0 });
    const a = arms(130);
    expect(a.top.tail).toBe(a.top.head);
    expect(arms(80).top.head).toBe(1150);
    expect(typed(10)).toBe(6);
  });
});

describe('对比表 · 一格格亮起来 · 涨跌箭头', () => {
  it('默认三行、两行注释、89 帧；箭头只认 up / down', () => {
    const p = cmp.toProps(cmp.defaultParams);
    expect(p.rows).toHaveLength(3);
    expect(p.note).toHaveLength(2);
    expect(p.durationInFrames).toBe(89);
    expect(cmp.toProps({ ...cmp.defaultParams, rows: [{ label: 'x', a: '1', aTrend: 'sideways' as never, b: '2', bTrend: 'down' }] }).rows[0]!.aTrend).toBe('none');
  });

  it('表头三格先亮，然后一行一行；镜头 0.88 倍推到第 63 帧 1 倍', () => {
    expect(cellIn(2, 0)).toBe(0);
    expect(cellIn(8, 0)).toBe(1);
    expect(cellIn(10, 3)).toBe(0);
    expect(cellIn(16, 3)).toBe(1);
    expect(cellIn(16, 6)).toBeLessThan(cellIn(16, 3));
    expect(tableScale(0)).toBe(0.88);
    expect(tableScale(63)).toBe(1);
  });
});

describe('排行榜翻页 · logo 快切', () => {
  it('默认第 59 帧推走；5 个 logo 一个接一个，一共 178 帧（原片去掉开头口播后的长度）', () => {
    const p = rl.toProps(rl.defaultParams);
    expect(p.pushAt).toBe(59);
    expect(p.logos.map((l) => l.frames)).toEqual([16, 19, 24, 24, 24]);
    expect(p.durationInFrames).toBe(178);
    expect(logoStarts(59, p.logos)).toEqual([71, 87, 106, 130, 154]);
  });

  it('翻页：先是纸背面转过来，再是斜卷边、往后弯着的一截，第 15 帧摊平', () => {
    expect(flip(4).mode).toBe('back');
    expect(flip(4).y).toBeLessThan(-150);
    expect(flip(9).mode).toBe('band');
    expect(flip(12).mode).toBe('flap');
    expect(flip(15).mode).toBe('flat');
  });

  it('蓝条：第一名 560，最低的约 310；推走越来越快；第一个 logo 从上面落下来', () => {
    const scores = [1679, 1668, 1661, 1597, 1562, 1556, 1556, 1550];
    expect(barLength(1679, scores)).toBeCloseTo(560, 5);
    expect(barLength(1550, scores)).toBeCloseTo(310, -1);
    expect(pushDown(14) - pushDown(12)).toBeGreaterThan(pushDown(6) - pushDown(4));
    expect(dropIn(14)).toBeLessThan(-300);
    expect(dropIn(22)).toBe(0);
  });

  it('拖时间轴：排行榜块的尾巴改推走时间，logo 块改停留时间', () => {
    const a = rl.timeline.apply(raw(rl.defaultParams), 'board', 'end', 0, 3) as unknown as rl.RankingLogosParams;
    expect(a.pushAt).toBe(3);
    const b = rl.timeline.apply(raw(rl.defaultParams), 'logo-1', 'end', 2.5, 3.5) as unknown as rl.RankingLogosParams;
    expect(b.logos[1]!.seconds).toBe(1);
  });
});

describe('排行榜 logo 快切的发光线', () => {
  it('五条线在画面两边散开（按原片量的 y 383 / 440 / 498 / 561 / 620），在 x 370 / 880 收到 y 500', () => {
    expect([0, 1, 2, 3, 4].map((i) => Math.round(linePoint(0, i).y))).toEqual([384, 441, 499, 562, 621]);
    for (const i of [0, 1, 2, 3, 4]) {
      expect(linePoint(370, i).y).toBeCloseTo(500, 0);
      expect(linePoint(880, i).y).toBeCloseTo(500, 0);
    }
  });

  it('中间拧成螺旋：上下摆不超过 15.5，两头收小', () => {
    const ys = Array.from({ length: 100 }, (_, k) => linePoint(560 + k, 0).y);
    expect(Math.max(...ys)).toBeLessThanOrEqual(515.5);
    expect(Math.min(...ys)).toBeGreaterThanOrEqual(484.5);
    expect(Math.abs(linePoint(385, 2).y - 500)).toBeLessThan(8);
  });
});

describe('金属大标题落下 · 烟雾扫过 · 往下甩走', () => {
  it('默认 133 帧；标题从上面落下来，30 帧到位，123 帧 1 倍', () => {
    const p = mt.toProps(mt.defaultParams);
    expect(p.durationInFrames).toBe(133);
    expect(mtCamera(10, 999).y).toBeLessThan(200);
    expect(mtCamera(30, 999).y).toBe(321);
    expect(mtCamera(123, 999).s).toBe(1);
    expect(titleIn(5)).toBe(0);
    expect(titleIn(40)).toBe(1);
  });

  it('关掉甩走就不往下甩；时长最短 3.5 秒', () => {
    expect(mtCamera(130, 1e9).whip).toBe(0);
    expect(mtCamera(130, 123).whip).toBeGreaterThan(50);
    expect(mt.toProps({ ...mt.defaultParams, whip: false, duration: 1 }).durationInFrames).toBe(105);
  });
});

describe('长网页滚到顶 · 推近 · 翻译标签', () => {
  it('从最底下滚到顶（67 帧）；之后推到 1.8 倍', () => {
    expect(scrollOffset(0, 1292)).toBe(1292);
    expect(scrollOffset(67, 1292)).toBe(0);
    expect(scrollOffset(20, 1292)).toBeLessThan(scrollOffset(10, 1292));
    expect(zoom(67).s).toBeCloseTo(1, 3);
    expect(zoom(117).s).toBeCloseTo(1 / 0.5682, 3);
  });

  it('标签从左往右长出来，第二条晚 2 帧；网页高度最少 720', () => {
    expect(labelWipe(81, 81, 0)).toBe(0);
    expect(labelWipe(97, 81, 0)).toBe(1);
    expect(labelWipe(97, 81, 1)).toBeLessThan(1);
    expect(psl.toProps({ ...psl.defaultParams, pageHeight: 100 }).pageHeight).toBe(720);
  });
});

describe('图文卡片一张张滑进来 · 中间黑圆连线', () => {
  it('默认 5 张卡片、397 帧；第 305 帧黑圆长出来', () => {
    const p = sc.toProps(sc.defaultParams);
    expect(p.cards).toHaveLength(5);
    expect(p.centerAt).toBe(305);
    expect(p.durationInFrames).toBe(397);
    expect(p.cards.map((c) => c.at)).toEqual([0, 75, 112, 158, 210]);
  });

  it('镜头：开头 2 倍特写，拉到 1 倍；卡片 20 帧滑进来，落稳后每 3.5 帧打一个字', () => {
    expect(scCamera(0, 380).s).toBeGreaterThan(2);
    expect(scCamera(360, 380).s).toBe(1);
    expect(scCamera(394, 380).y).toBeLessThan(0);
    expect(cardIn(75, 75)).toBe(0);
    expect(cardIn(95, 75)).toBe(1);
    expect(typedCount(96, 75, false, 8)).toBe(0);
    expect(typedCount(97, 75, false, 8)).toBe(1);
    expect(typedCount(200, 75, false, 8)).toBe(8);
  });
});

describe('对着手机说话 · 对话框打字', () => {
  it('默认 303 帧；第 2 帧开始打字，第 121 帧弹出回复、156 帧起每 3 帧一个字；回复里可以手动换行', () => {
    const p = pt.toProps(pt.defaultParams);
    expect(p.durationInFrames).toBe(303);
    expect([p.askAt, p.replyAt, p.replyTypeAt]).toEqual([2, 121, 156]);
    expect(p.replyStep).toBeCloseTo(3, 5);
    expect(p.reply).toContain('\n');
  });

  it('两个框里的字在框里上下居中（按原片量的字底）', () => {
    // 问句一行字：字身中线（字底往上 0.38 个字号）落在框的中线附近
    expect(Math.abs(ASK.base - 0.38 * ASK.size - (ASK.y0 + ASK.y1) / 2)).toBeLessThan(2);
    // 回复两行：第一行字顶到框顶、第二行字底到框底，两边空白差不多
    const top = REPLY.bases[0]! - 0.88 * REPLY.size - REPLY.y0;
    const bottom = REPLY.y1 - REPLY.bases[1]!;
    expect(Math.abs(top - bottom)).toBeLessThan(6);
    // 行框顶由字底反推：行高 L 的行，字底在行框顶往下 L/2 + 0.436×字号
    expect(lineTop(100, 20, 40)).toBeCloseTo(100 - 20 - 8.72, 5);
  });

  it('回复框里的新字从左往右露出来、从下面升上来，6 帧后落定', () => {
    expect(charIn(0).dy).toBe(12);
    expect(charIn(0).wipe).toBeLessThan(1);
    expect(charIn(3).wipe).toBe(1);
    expect(charIn(6).dy).toBe(0);
    expect(charIn(3).dy).toBeLessThan(6);
  });

  it('人从下面升上来，字比框先到位；每一步打一个字', () => {
    expect(rise(0)).toBe(520);
    expect(rise(66)).toBe(0);
    expect(textRise(26)).toBe(0);
    expect(textRise(13)).toBeLessThan(0.82 * rise(13));
    expect(ptTyped(3, 4, 5.5, 17)).toBe(0);
    expect(ptTyped(4, 4, 5.5, 17)).toBe(1);
    expect(ptTyped(300, 4, 5.5, 17)).toBe(17);
  });
});

describe('截图卡片飞进来推近 · 网点大字压视频', () => {
  it('默认 381 帧；第 176 帧溶解成第一个大字，第 233 帧切到第二个', () => {
    const p = cw.toProps(cw.defaultParams);
    expect(p.durationInFrames).toBe(381);
    expect(p.words.map((w) => w.at)).toEqual([176, 233]);
    expect(p.words.map((w) => w.text)).toEqual(['算力', '运算成本']);
  });

  it('不要卡片：第一个大字从头开始，后面的往前挪', () => {
    const p = cw.toProps({ ...cw.defaultParams, card: '' });
    expect(p.words.map((w) => w.at)).toEqual([0, 57]);
    expect(p.durationInFrames).toBe(205);
  });

  it('大字按时间排好，挨得太近的往后推', () => {
    const p = cw.toProps({ ...cw.defaultParams, words: [{ text: 'B', media: '', at: 8 }, { text: 'A', media: '', at: 7.9 }] });
    expect(p.words.map((w) => w.text)).toEqual(['A', 'B']);
    expect(p.words[1]!.at - p.words[0]!.at).toBeGreaterThanOrEqual(15);
  });

  it('卡片歪着从下面飞上来，第 56 帧转正；第 60 帧中心 (635,370)、1 倍', () => {
    expect(cardPose(0).rot).toBeCloseTo(19.7, 1);
    expect(cardPose(0).y).toBeGreaterThan(850);
    expect(cardPose(56).rot).toBe(0);
    const p60 = cardPose(60);
    expect(p60.s).toBe(1);
    expect(p60.x).toBeCloseTo(635, 0);
    expect(p60.y).toBeCloseTo(371, 0);
    expect(cardPose(113).s).toBeCloseTo(1.486, 3);
  });

  it('往下看：原片卡片高 460 移 247；卡片矮移得少、高移得多', () => {
    expect(panY(100, 460)).toBeCloseTo(0, 5);
    expect(panY(170, 460)).toBeCloseTo(-247.5, 0);
    expect(panY(170, 240)).toBeGreaterThan(-100);
    expect(panY(170, 700)).toBeLessThan(-400);
  });

  it('右边暗影第 72 帧开始滑进来，第 104 帧到位', () => {
    expect(shadeOffset(60)).toBe(560);
    expect(shadeOffset(84)).toBe(140);
    expect(shadeOffset(104)).toBe(0);
  });

  it('按亮度溶解：亮的先没，暗的后没', () => {
    expect(dissolveAlpha(255, -6)).toBe(1);
    expect(dissolveAlpha(196, 2.5)).toBeCloseTo(0.5, 5);
    expect(dissolveAlpha(240, 4)).toBeLessThan(dissolveAlpha(40, 4));
    expect(dissolveAlpha(0, 22)).toBe(0);
  });

  it('大字：两个字 227px，四个字按宽 997 缩小', () => {
    expect(wordSize('算力')).toBe(227);
    expect(wordSize('运算成本')).toBeCloseTo(203, 0);
    expect(wordSize('一二三四五六')).toBeLessThan(wordSize('运算成本'));
  });
});

describe('截图卡片 · 溶解细节', () => {
  it('亮度反相：白变黑、黑变白、中灰不变，颜色保留', () => {
    const m = lumaInvert(1).split(/\s+/).map(Number);
    const ap = (c: number[]) => [0, 1, 2].map((r) => m[r * 5]! * c[0]! + m[r * 5 + 1]! * c[1]! + m[r * 5 + 2]! * c[2]! + m[r * 5 + 4]!);
    expect(ap([1, 1, 1]).every((v) => Math.abs(v) < 1e-3)).toBe(true);
    expect(ap([0, 0, 0])).toEqual([1, 1, 1]);
    expect(ap([0.5, 0.5, 0.5]).every((v) => Math.abs(v - 0.5) < 1e-3)).toBe(true);
    expect(lumaInvert(0).split(/\s+/).map(Number).slice(0, 5)).toEqual([1, 0, 0, 0, 0]);
  });

  it('推近前没有上下暗影，往下看以后上边比下边暗', () => {
    expect(verticalShade(60).every((v) => v === 1)).toBe(true);
    const a = verticalShade(110);
    expect(a[a.length - 1]!).toBeLessThan(a[0]!);
    const b = verticalShade(170);
    expect(b[0]!).toBeLessThan(b[b.length - 1]!);
  });
});

describe('视频上的网点大字 · 英文小字', () => {
  it('默认 172 帧；第 45、67 帧切到下一段', () => {
    const p = hc.toProps(hc.defaultParams);
    expect(p.durationInFrames).toBe(172);
    expect(p.captions.map((c) => c.at)).toEqual([0, 45, 67]);
    expect(p.captions[0]!.english).toBe('Frontier Engineering');
  });

  it('第一段不从 0 开始：整体往前挪；挨得太近的往后推', () => {
    const p = hc.toProps({ ...hc.defaultParams, captions: [{ text: 'A', english: '', media: '', at: 2 }, { text: 'B', english: '', media: '', at: 2.1 }], duration: 6 });
    expect(p.captions.map((c) => c.at)).toEqual([0, 15]);
    expect(p.durationInFrames).toBe(120);
  });

  it('四个字 148px，字少了最大 160', () => {
    expect(captionSize('前沿工程')).toBeCloseTo(148, 0);
    expect(captionSize('算力')).toBe(160);
  });

  it('第一个字第 4–20 帧淡进来；英文字母各自晚 0–6 帧', () => {
    expect(fadeIn(3)).toBe(0);
    expect(fadeIn(12)).toBeCloseTo(0.56, 5);
    expect(fadeIn(20)).toBe(1);
    const ds = Array.from({ length: 20 }, (_, i) => letterDelay(i));
    expect(Math.min(...ds)).toBeGreaterThanOrEqual(0);
    expect(Math.max(...ds)).toBeLessThan(6);
    expect(new Set(ds.map((d) => d.toFixed(2))).size).toBeGreaterThan(10);
  });
});

describe('错落宋体大标题 · 镜头下甩 · 分数表', () => {
  it('默认 239 帧；三行、前两行刷黄；装饰图开关转成字符串', () => {
    const p = tst.toProps(tst.defaultParams);
    expect(p.durationInFrames).toBe(239);
    expect(p.rows).toHaveLength(3);
    expect(p.highlight).toBe(2);
    expect(p.floaters).toBe('on');
    expect(tst.toProps({ ...tst.defaultParams, floaters: false }).floaters).toBe('none');
    expect(tst.toProps({ ...tst.defaultParams, highlight: 9, duration: 1 })).toMatchObject({ highlight: 3, durationInFrames: 126 });
  });

  it('镜头第 32 帧起往下甩，第 80 帧停在表格上；之后只剩轻微漂移', () => {
    expect(cameraY(32)).toBe(0);
    expect(cameraY(53)).toBe(-390);
    expect(cameraY(80)).toBe(-TABLE.offset);
    expect(cameraY(200)).toBe(-TABLE.offset);
    const [dx, dy] = drift(238);
    expect(Math.abs(dx)).toBeLessThanOrEqual(15);
    expect(Math.abs(dy)).toBeLessThanOrEqual(15);
  });

  it('入场偏移指数衰减；装饰图下甩时先到，第 100 帧跟上表格', () => {
    expect(settle([100, -50], 0.1, 0)).toEqual([100, -50]);
    const [x] = settle([100, 0], 0.1, 30);
    expect(x).toBeCloseTo(100 * Math.exp(-3), 6);
    expect(floatLead(54)).toBe(-80);
    expect(floatLead(100)).toBe(0);
    expect(FLOATERS).toHaveLength(4);
  });

  it('名字 7 帧打完（不管几个字），分数每帧一个字', () => {
    expect(tstTyped(50, 51, 7, 7)).toBe(0);
    expect(tstTyped(51, 51, 7, 7)).toBe(1);
    expect(tstTyped(57, 51, 7, 7)).toBe(7);
    expect(tstTyped(88, 88, 10, 7)).toBe(2);
    expect(tstTyped(94, 88, 10, 7)).toBe(10);
    expect(tstTyped(67, 65, 4)).toBe(3);
    expect(TABLE.rowAt).toEqual([51, 68, 88]);
  });

  it('纸面细网格起伏不大、确定的', () => {
    let lo = Infinity;
    let hi = -Infinity;
    for (let y = 0; y < 40; y++) for (let x = 0; x < 40; x++) {
      const v = gridValue(x, y);
      lo = Math.min(lo, v);
      hi = Math.max(hi, v);
    }
    expect(hi - lo).toBeGreaterThan(5);
    expect(hi - lo).toBeLessThan(60);
    expect(gridValue(3, 7)).toBe(gridValue(3, 7));
  });
});

describe('网页截图推拉 · 暗色对比表 · 像素方块标签', () => {
  it('默认 679 帧；两行两标签，赢的项数夹在 0 到总数之间', () => {
    const p = wcp.toProps(wcp.defaultParams);
    expect(p.durationInFrames).toBe(679);
    expect(p.rows).toHaveLength(2);
    expect(p.labels.map((l) => l.wins)).toEqual([6, 8]);
    expect(p.focusStart[0]).toBeCloseTo(0.603, 3);
    const q = wcp.toProps({ ...wcp.defaultParams, total: 6, labels: [{ text: 'A', wins: 99, pill: '' }] });
    expect(q.labels[0]!.wins).toBe(6);
  });

  it('镜头关键帧按时间递增；网页开头 8 倍特写，第 66 帧拉到整页', () => {
    for (const t of [WEB_CAM.t, DARK_CAM.t]) for (let i = 1; i < t.length; i++) expect(t[i]!).toBeGreaterThan(t[i - 1]!);
    expect(webCamera(0).w / webCamera(66).w).toBeGreaterThan(8);
    expect(Math.abs(webCamera(124).r)).toBeGreaterThan(5);
    expect(darkCamera(220).s).toBeCloseTo(1, 2);
    expect(darkCamera(600).s).toBeGreaterThan(1.8);
  });

  it('斜切从左扫到右；条 32 帧刷满', () => {
    expect(wipeX(124)).toBeLessThan(0);
    expect(wipeX(140)).toBeGreaterThan(1280);
    expect(barWipe(168, 168)).toBe(0);
    expect(barWipe(184, 168)).toBeGreaterThan(0.5);
    expect(barWipe(200, 168)).toBe(1);
  });

  it('橙色方块从下排左边开始涂，下排满了再涂上排', () => {
    const lit = (wins: number) => Array.from({ length: 14 }, (_, k) => (squareLit(k, wins) ? 1 : 0)).join('');
    expect(lit(6)).toBe('00000001111110');
    expect(lit(8)).toBe('10000001111111');
  });

  it('景深：开头左边虚，第 404 帧起焦点落到下面', () => {
    expect(lensParams(200).b150).toBeGreaterThan(0);
    expect(lensParams(500).b150).toBe(0);
    expect(lensParams(500).edge).toBe(470);
  });
});

describe('转正的大脑 · 对话标签 · 挂着的数据卡片', () => {
  it('默认 427 帧；两组各两张卡，右边一张是金色；布纹默认开、可以关', () => {
    const p = bsc.toProps(bsc.defaultParams);
    expect(p.durationInFrames).toBe(427);
    expect(p.groups.map((g) => g.cards.map((c) => c.gold))).toEqual([[false, true], [false, true]]);
    expect(p.texture).toBe('');
    expect(bsc.toProps({ ...bsc.defaultParams, fabric: false }).texture).toBe('none');
  });

  it('镜头关键帧递增，第 22→23 帧一下推近；最后一帧就是世界坐标', () => {
    for (let i = 1; i < BSC_CAM.t.length; i++) expect(BSC_CAM.t[i]!).toBeGreaterThan(BSC_CAM.t[i - 1]!);
    expect(bscCamera(23).s / bscCamera(22).s).toBeGreaterThan(2);
    const end = bscCamera(391);
    expect(end.s).toBeCloseTo(1, 1);
    expect(Math.abs(end.x)).toBeLessThan(5);
  });

  it('大脑第 0 帧转着 70°、第 56 帧转正；黑球最后钉在画面顶上', () => {
    expect(brainSpin(0)).toBeGreaterThan(60);
    expect(Math.abs(brainSpin(56))).toBeLessThan(0.5);
    expect(dotY(400)).toBeCloseTo(-1, 0);
    expect(dotY(150)).toBeGreaterThan(700);
  });

  it('大脑段坐标和世界坐标来回换得回来', () => {
    const [x, y] = brainToWorld(637, 362);
    const [bx, by] = worldToBrain(x, y);
    expect(bx).toBeCloseTo(637, 6);
    expect(by).toBeCloseTo(362, 6);
  });

  it('卡片先是毛玻璃，再变深、字浮出来', () => {
    expect(cardPhase(100, 164)).toMatchObject({ glass: 0, solid: 0, content: 0 });
    expect(cardPhase(167, 164).glass).toBeGreaterThan(0.5);
    expect(cardPhase(190, 164)).toMatchObject({ glass: 0, solid: 1, content: 1 });
  });

  it('合成布纹起伏在几个百分点', () => {
    let lo = 0;
    let hi = 0;
    for (let y = 0; y < 30; y++) for (let x = 0; x < 30; x++) { const v = fabricValue(x, y); lo = Math.min(lo, v); hi = Math.max(hi, v); }
    expect(hi).toBeGreaterThan(0.02);
    expect(lo).toBeLessThan(-0.02);
    expect(hi - lo).toBeLessThan(0.2);
  });
});
