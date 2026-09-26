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
import { barLength, dropIn, flip, logoStarts, pushDown } from '../templates/src/ranking-logos/RankingLogos';

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
