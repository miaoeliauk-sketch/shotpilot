import { describe, expect, it } from 'vitest';
import * as wm from '../templates/src/word-magnifier/params';
import { bgCamera, charIn, fgCamera, rollingNumber } from '../templates/src/word-magnifier/WordMagnifier';
import * as pl from '../templates/src/people-labels/params';
import { camera as plCamera, reveal } from '../templates/src/people-labels/PeopleLabels';
import * as tp from '../templates/src/ticket-percent/params';
import { camera as tpCamera, questionState } from '../templates/src/ticket-percent/TicketPercent';

const raw = (p: unknown) => p as Record<string, unknown>;

describe('压窄大字 · 灰圆 · 放大镜数字', () => {
  it('默认按原片：444 帧，第 58 帧出圆、第 306 帧换放大镜', () => {
    const p = wm.toProps(wm.defaultParams);
    expect([p.durationInFrames, p.bubblesAt, p.magnifierAt]).toEqual([444, 58, 306]);
    expect(p.bubbles).toHaveLength(2);
  });

  it('开头只有字和册子放大 1.75 倍，70 帧后和墙用同一个镜头', () => {
    expect(fgCamera(0).s).toBeCloseTo(1.755, 3);
    expect(bgCamera(0).s).toBeLessThan(1.05);
    expect(fgCamera(120)).toEqual(bgCamera(120));
    expect(bgCamera(200)).toEqual({ s: 1, x: 640, y: 360 });
    expect(bgCamera(440).s).toBeGreaterThan(1.07);
  });

  it('字从虚到实；数字从 0 滚到目标，滚完就是原样', () => {
    expect(charIn(5, 6, 10)).toBe(0);
    expect(charIn(16, 6, 10)).toBe(1);
    expect(rollingNumber(100, 100, '1700').text).toBe('0');
    expect(Number(rollingNumber(106, 100, '1700').text)).toBeGreaterThan(1000);
    expect(rollingNumber(112, 100, '1700')).toEqual({ text: '1700', blur: 0 });
    expect(rollingNumber(105, 100, '三成')).toEqual({ text: '三成', blur: 0 });
  });

  it('拖时间轴改圆和放大镜出来的时间', () => {
    const a = wm.timeline.apply(raw(wm.defaultParams), 'magnifier', 'move', 9, 14) as unknown as wm.WordMagnifierParams;
    expect(a.magnifierAt).toBe(9);
    const b = wm.timeline.apply(raw(wm.defaultParams), 'bubbles', 'move', 3, 9) as unknown as wm.WordMagnifierParams;
    expect(b.bubblesAt).toBe(3);
  });
});

describe('人物 · 身份卡片 · 金色词条', () => {
  it('默认按原片：140 帧，三个词条在第 12、20、38 帧亮起来', () => {
    const p = pl.toProps(pl.defaultParams);
    expect(p.durationInFrames).toBe(140);
    expect(p.labels.map((l) => [l.slot, l.at])).toEqual([['left', 12], ['top', 20], ['right', 38]]);
    expect(p.cards).toHaveLength(2);
  });

  it('镜头：从左下推过来 1.175 → 0.961，第 108 帧正好 1 倍', () => {
    expect(plCamera(0).s).toBeCloseTo(1.175, 3);
    expect(plCamera(36).s).toBeCloseTo(0.961, 3);
    expect(plCamera(108)).toEqual({ s: 1, x: 640, y: 360 });
    expect(reveal(5, 10)).toBe(0);
    expect(reveal(20, 10)).toBe(1);
  });

  it('空词条不出；拖时间轴改词条出来的时间', () => {
    const p = pl.toProps({ ...pl.defaultParams, labels: [{ text: ' ', slot: 'left', at: 0 }, { text: '留下', slot: 'top', at: 1 }] });
    expect(p.labels).toEqual([{ text: '留下', slot: 'top', at: 30 }]);
    const moved = pl.timeline.apply(raw(pl.defaultParams), 'label-2', 'move', 2, 2.3) as unknown as pl.PeopleLabelsParams;
    expect(moved.labels[2]!.at).toBe(2);
  });
});

describe('口播人物 · 提问 · 两个百分比 · 钞票', () => {
  it('默认按原片：400 帧，提问 50、左 116、右 246、甩走 300、钞票甩出 388', () => {
    const p = tp.toProps(tp.defaultParams);
    expect([p.durationInFrames, p.questionAt, p.left.at, p.right.at, p.swapAt, p.moneyOutAt]).toEqual([400, 50, 116, 246, 300, 388]);
  });

  it('镜头：100 帧 1 倍，慢慢拉远到 0.886，甩走后往右摆到 x 898；甩走时间改了，前面的曲线跟着伸缩', () => {
    expect(tpCamera(100, 300)).toEqual({ s: 1, x: 640, y: 360 });
    expect(tpCamera(300, 300).s).toBeCloseTo(0.8857, 4);
    expect(tpCamera(360, 300).x).toBeCloseTo(898.2, 1);
    expect(tpCamera(200, 400)).toEqual(tpCamera(150, 300));
  });

  it('提问条先长出来再打字；钞票甩出去不会早于出现', () => {
    const q = questionState(50, 50, '一二三四');
    expect([q.grow, q.typed]).toEqual([0, 0]);
    expect(questionState(80, 50, '一二三四').typed).toBe(4);
    expect(tp.toProps({ ...tp.defaultParams, moneyOutAt: 5 }).moneyOutAt).toBe(320);
  });
});
