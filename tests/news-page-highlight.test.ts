import { describe, expect, it } from 'vitest';
import * as nph from '../templates/src/news-page-highlight/params';
import { bigLayout, headerLayout, headlineLayout, markProgress, pageCamera, textCamera, wipeEdge, wrapHeadline } from '../templates/src/news-page-highlight/NewsPageHighlight';
import { TEMPLATES } from '../templates/src/registry';

describe('新闻页扫标题 · 大字滚上来 · 荧光笔', () => {
  it('登记了，默认参数能换成 props', () => {
    expect(TEMPLATES.some((t) => t.id === 'news-page-highlight')).toBe(true);
    const p = nph.toProps(nph.defaultParams);
    expect(p.durationInFrames).toBe(127);
    expect(p.crumbs).toEqual(['科技', '人工智能', '正文']);
    expect(nph.toProps({ ...nph.defaultParams, duration: 1 }).durationInFrames).toBe(108);
  });

  it('镜头：开头往右扫、越扫越慢；第 68→69 帧大字层硬切放大', () => {
    expect(pageCamera(0).x).toBeCloseTo(0, 3);
    const v1 = pageCamera(1).x - pageCamera(0).x;
    const v30 = pageCamera(31).x - pageCamera(30).x;
    expect(v1).toBeLessThan(-50);
    expect(v30).toBeGreaterThan(-12);
    expect(v30).toBeLessThan(0);
    expect(textCamera(69).s / textCamera(68).s).toBeGreaterThan(1.4);
    expect(textCamera(126).s).toBeCloseTo(1, 2);
    // 硬切前后都不来回抖：每帧的缩放都在变大
    for (let f = 54; f < 126; f++) if (f !== 68) expect(textCamera(f + 1).s).toBeGreaterThanOrEqual(textCamera(f).s - 1e-4);
  });

  it('标题区从下往上收，收到页头为止', () => {
    expect(wipeEdge(40)).toBeGreaterThan(600);
    expect(wipeEdge(49)).toBeCloseTo(374, 5);
    expect(wipeEdge(80)).toBe(104);
  });

  it('荧光笔：第 85.7 帧起，先快后慢，第 100.5 帧涂满', () => {
    expect(markProgress(85)).toBe(0);
    expect(markProgress(90)).toBeGreaterThan(0.4);
    expect(markProgress(101)).toBe(1);
    expect(markProgress(88) - markProgress(87)).toBeGreaterThan(markProgress(97) - markProgress(96));
  });

  it('标题换行：英文单词不拆，标点不放行首；太长就缩小字号放两行', () => {
    const lines = wrapHeadline('Hello World 你好世界，再见', 500, '700 100px sans-serif');
    expect(lines.every((l) => !/^[，。]/.test(l))).toBe(true);
    expect(lines.join('').replace(/\s/g, '')).toBe('HelloWorld你好世界，再见');
    const long = headlineLayout('重磅：多家研究机构联合发布最新评测报告，开源大模型在编程、数学和长文本理解三项能力上全面追平闭源模型，行业格局或将重写');
    expect(long.lines.length).toBeLessThanOrEqual(2);
    expect(long.size).toBeLessThan(100);
    // 作者行在最后一行标题下面
    expect(long.authorTop).toBeGreaterThan(296 + (long.lines.length - 1) * long.lineHeight + long.size);
    const short = headlineLayout('开源赢了');
    expect(short.panScale).toBe(0);
  });

  it('页头：网站名长了，红块和面包屑往后挪，不压在一起', () => {
    const a = headerLayout('新知网', '科技');
    expect(a.channelLeft).toBe(495);
    expect(a.crumbsLeft).toBe(800);
    const b = headerLayout('某某科技新闻网站频道', '科技');
    expect(b.channelLeft).toBeGreaterThan(495);
    expect(b.crumbsLeft).toBeGreaterThan(b.channelLeft);
  });

  it('大字：要涂的那段居中，太长就缩小字号放得下', () => {
    const d = bigLayout('外媒', '看清AI新格局', '之后');
    expect(d.markLeft + d.markW / 2).toBeCloseTo(628, 3);
    const long = bigLayout('', '开源生态正在重塑整个行业的竞争格局', '');
    expect(long.markW).toBeLessThanOrEqual(1318 + 1e-6);
    expect(long.size).toBeLessThan(220);
    const short = bigLayout('', '反思', '');
    expect(short.size).toBeLessThanOrEqual(220 * 1.2 + 1e-6);
  });
});
