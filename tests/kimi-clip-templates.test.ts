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
import { rise, textRise, typed as ptTyped } from '../templates/src/phone-talk/PhoneTalk';

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
  it('默认 303 帧；第 4 帧开始打字，第 121 帧弹出回复、156 帧起打字；回复里可以手动换行', () => {
    const p = pt.toProps(pt.defaultParams);
    expect(p.durationInFrames).toBe(303);
    expect([p.askAt, p.replyAt, p.replyTypeAt]).toEqual([4, 121, 156]);
    expect(p.reply).toContain('\n');
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
