import { describe, expect, it } from 'vitest';
import { defaultParams, meta, toProps, type BigNumberParams } from '../templates/src/big-number/params';
import { parseMedia } from '../templates/src/media';

const raw = defaultParams as unknown as Record<string, unknown>;

describe('大数字模板：简单参数换算', () => {
  const props = toProps(defaultParams);

  it('默认复现原片：开头数字已经落了 4 帧，加号第 21 帧出来，共 148 帧', () => {
    expect(props.numberAt).toBe(-4);
    expect(props.suffixAt).toBeCloseTo(21, 5);
    expect(props.durationInFrames).toBe(148);
  });

  it('压暗按百分比换算，最多压到九成', () => {
    expect(toProps({ ...defaultParams, dim: 40 }).dim).toBeCloseTo(0.4, 5);
    expect(toProps({ ...defaultParams, dim: 200 }).dim).toBe(0.9);
  });

  it('数字留空也不会让组件拿到空字符串', () => {
    expect(toProps({ ...defaultParams, number: '' }).number).toBe(' ');
  });
});

describe('大数字模板：时间轴', () => {
  const tl = meta.timeline!;

  it('数字一条轨，有符号时再加一条', () => {
    expect(tl.tracks(raw).map((t) => t.id)).toEqual(['number', 'suffix']);
    expect(tl.tracks({ ...raw, suffix: '' }).map((t) => t.id)).toEqual(['number']);
  });

  it('挪数字、挪符号改各自的出现时间；拖右边那头改视频时长', () => {
    expect((tl.apply(raw, 'number', 'move', 0.52, 5) as unknown as BigNumberParams).numberAt).toBeCloseTo(0.53, 5);
    expect((tl.apply(raw, 'suffix', 'move', 1.2, 5) as unknown as BigNumberParams).suffixAt).toBeCloseTo(1.2, 5);
    expect((tl.apply(raw, 'number', 'end', 0, 8) as unknown as BigNumberParams).duration).toBeCloseTo(8, 5);
  });
});

describe('图片或视频槽位', () => {
  it('认得出视频和它的时长', () => {
    expect(parseMedia('/files/assets/abc.mp4#dur=4.93')).toEqual({ url: '/files/assets/abc.mp4', video: true, seconds: 4.93 });
    expect(parseMedia('/files/assets/abc.MOV')).toEqual({ url: '/files/assets/abc.MOV', video: true, seconds: null });
  });

  it('图片不当视频', () => {
    expect(parseMedia('/template-assets/big-number/sample.jpg')).toEqual({ url: '/template-assets/big-number/sample.jpg', video: false, seconds: null });
  });
});
