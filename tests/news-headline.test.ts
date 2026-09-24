import { describe, expect, it } from 'vitest';
import { defaultParams, meta, toProps, type NewsParams } from '../templates/src/news-headline/params';
import { glyphStart, underlinePath } from '../templates/src/news-headline/NewsHeadline';
import { layoutBody, type BodyBox } from '../templates/src/text-layout';
import { inkProgress } from '../templates/src/news-headline/ink';

const raw = defaultParams as unknown as Record<string, unknown>;

describe('新闻标题模板：简单参数换算', () => {
  const props = toProps(defaultParams);

  it('默认参数复现原片的时间：59 帧转场、113 帧切特写、共 150 帧', () => {
    expect(props.wipeAt).toBe(59);
    expect(props.punchAt).toBe(113);
    expect(props.durationInFrames).toBe(150);
    expect(props.titleSpeed).toBeCloseTo(1, 5);
  });

  it('两道划线按原片的帧开始画；第二段比第一段靠左 12px', () => {
    expect(props.paragraphs[0]!.underlineAt).toBeCloseTo(81, 5);
    expect(props.paragraphs[1]!.underlineAt).toBeCloseTo(66.6, 5);
    expect(props.paragraphs[1]!.offsetX).toBe(-12);
  });

  it('标金色的词按空格拆开；第二行留空就只有一行标题', () => {
    expect(props.headlineGold).toEqual(['OpenAI及两名员工', '窃取产品机密']);
    expect(toProps({ ...defaultParams, headline2: '  ' }).headline).toEqual([defaultParams.headline1]);
  });

  it('特写对准点按百分比换算成新闻稿坐标', () => {
    expect(props.punchX).toBeCloseTo(645.1, 1);
    expect(props.punchY).toBeCloseTo(490.3, 1);
  });

  it('转场改晚了，标题段整体放慢；特写不会早于转场结束，视频也不会短于转场', () => {
    const p = toProps({ ...defaultParams, wipeAt: 3.93, punchAt: 1, duration: 1 });
    expect(p.wipeAt).toBe(118);
    expect(p.titleSpeed).toBeCloseTo(2, 5);
    expect(p.punchAt).toBeGreaterThanOrEqual(p.wipeAt + 11);
    expect(p.durationInFrames).toBeGreaterThan(p.wipeAt + 11);
  });
});

describe('新闻标题模板：大标题逐字浮现', () => {
  it('10 个字正好是原片的节奏', () => {
    expect([0, 1, 2, 3, 6, 7, 9].map((i) => glyphStart(i, 10))).toEqual([3, 5, 8, 15, 15, 24, 24]);
  });

  it('字数不同就按比例插值，而且越往后越晚', () => {
    const starts = Array.from({ length: 6 }, (_, i) => glyphStart(i, 6));
    expect(starts[0]).toBe(3);
    expect(starts[5]).toBe(24);
    for (let i = 1; i < starts.length; i++) expect(starts[i]!).toBeGreaterThanOrEqual(starts[i - 1]!);
    expect(glyphStart(0, 1)).toBe(3);
  });
});

describe('新闻标题模板：正文排版', () => {
  // 测试里没有浏览器，按「汉字 1 个字宽、英文半个多」估字宽
  const box: BodyBox = { left: 40, right: 240, firstCenter: 100, size: 20, lineHeight: 30, paragraphGap: 4, indent: 2 };
  const para = (text: string, highlight = '', offsetX = 0) => ({ text, highlight, underlineAt: 0, offsetX });

  it('首行缩进两字，一行放满 10 个字就换行', () => {
    const { chars, lines } = layoutBody([para('一二三四五六七八九十甲乙丙丁')], box, 'serif');
    expect(chars[0]!.x).toBe(80);
    expect(chars[7]!.center).toBe(100);
    expect(chars[8]!.x).toBe(40);
    expect(chars[8]!.center).toBe(130);
    expect(lines).toBe(2);
  });

  it('逗号句号不放到行首，挂在上一行末尾', () => {
    const { chars } = layoutBody([para('一二三四五六七八，九')], box, 'serif');
    const comma = chars.find((c) => c.ch === '，')!;
    expect(comma.center).toBe(100);
    expect(chars.find((c) => c.ch === '九')!.center).toBe(130);
  });

  it('英文单词不拆开', () => {
    const { chars } = layoutBody([para('一二三四五六七OpenAI')], box, 'serif');
    const o = chars.find((c) => c.ch === 'O')!;
    const i = chars.find((c) => c.ch === 'I')!;
    expect(o.center).toBe(i.center);
  });

  it('第二段接着排，段间多空一点；整段可以左右挪', () => {
    const { chars } = layoutBody([para('一二'), para('三四', '', -12)], box, 'serif');
    expect(chars[2]!.center).toBe(100 + 30 + 4);
    expect(chars[2]!.x).toBe(80 - 12);
  });

  it('划线画在重点句最长的那一行下面，太长只画后面 19 个字', () => {
    const wide: BodyBox = { ...box, right: 40 + 30 * 20 };
    const text = `${'甲'.repeat(20)}${'乙'.repeat(30)}${'丙'.repeat(5)}`;
    const { underlines } = layoutBody([para(text, '乙'.repeat(30) + '丙'.repeat(5))], wide, 'serif');
    expect(underlines).toHaveLength(1);
    const u = underlines[0]!;
    // 第一行：缩进 2 字 + 20 个甲，乙从第 22 个字宽开始、到行尾（30 字宽）只有 8 个；第二行 22 个乙 + 5 个丙 最长
    expect(u.center).toBe(100 + 30);
    expect(u.x1 - u.x0).toBeCloseTo(19 * 20, 5);
  });

  it('没有重点句就不画线', () => {
    expect(layoutBody([para('一二三', '')], box, 'serif').underlines).toHaveLength(0);
    expect(layoutBody([para('一二三', '四五')], box, 'serif').underlines).toHaveLength(0);
  });
});

describe('新闻标题模板：墨迹转场和划线', () => {
  it('墨迹扫开的阈值逐帧变大；转场前不扫，扫完全透', () => {
    expect(inkProgress(-2)).toBe(-Infinity);
    expect(inkProgress(11)).toBe(Infinity);
    let prev = -Infinity;
    for (let rel = -1; rel <= 10; rel += 0.5) {
      const p = inkProgress(rel);
      expect(p).toBeGreaterThan(prev);
      prev = p;
    }
  });

  it('划线没开始时是空的，画到一半比画完短', () => {
    expect(underlinePath(100, 500, 300, 0)).toBe('');
    const half = underlinePath(100, 500, 300, 0.5);
    const full = underlinePath(100, 500, 300, 1);
    expect(half.length).toBeGreaterThan(0);
    expect(full.length).toBeGreaterThan(half.length);
  });
});

describe('新闻标题模板：时间轴', () => {
  const tl = meta.timeline!;

  it('镜头轨三段：大标题（带转场）、新闻稿、特写；每段一条划线轨', () => {
    const tracks = tl.tracks(raw);
    const camera = tracks[0]!;
    expect(camera.items.map((i) => i.id)).toEqual(['title', 'article', 'punch']);
    expect(camera.items[0]!.end).toBeCloseTo(1.97, 5);
    expect(camera.items[2]!.end).toBeCloseTo(5, 5);
    expect(tracks.slice(1).map((t) => t.items[0]?.id)).toEqual(['underline-0', 'underline-1']);
  });

  it('特写设得比视频还晚就不画特写那段', () => {
    const tracks = tl.tracks({ ...raw, punchAt: 9 });
    expect(tracks[0]!.items.map((i) => i.id)).toEqual(['title', 'article']);
  });

  it('拖大标题的右边改转场时间（对齐整帧），后面的划线、特写、总时长一起顺延', () => {
    const next = tl.apply(raw, 'title', 'end', 0, 2.51) as unknown as NewsParams;
    expect(next.wipeAt).toBeCloseTo(2.5, 5);
    expect(next.punchAt).toBeCloseTo(3.77 + 0.53, 5);
    expect(next.duration).toBeCloseTo(5.53, 5);
    expect(next.paragraphs.map((x) => x.underlineAt)).toEqual([3.23, 2.75]);
    expect((tl.apply(raw, 'title', 'end', 0, 0.1) as unknown as NewsParams).wipeAt).toBe(0.5);
  });

  it('拖新闻稿的右边改切特写的时间；拖特写的右边改视频时长', () => {
    expect((tl.apply(raw, 'article', 'end', 0, 4.2) as unknown as NewsParams).punchAt).toBeCloseTo(4.2, 5);
    expect((tl.apply(raw, 'punch', 'end', 0, 7) as unknown as NewsParams).duration).toBeCloseTo(7, 5);
  });

  it('挪划线块改那一段的画线时间，别的段不动', () => {
    const next = tl.apply(raw, 'underline-1', 'move', 3, 3.6) as unknown as NewsParams;
    expect(next.paragraphs[1]!.underlineAt).toBeCloseTo(3, 5);
    expect(next.paragraphs[0]!.underlineAt).toBeCloseTo(2.7, 5);
  });
});
