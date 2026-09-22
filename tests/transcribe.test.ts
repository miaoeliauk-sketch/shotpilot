import { describe, expect, it } from 'vitest';
import { parseSrt, parseWhisperJson } from '../src/analyze/transcribe.js';

describe('parseWhisperJson', () => {
  it('优先读 whisperx 的扁平 word_segments', () => {
    const words = parseWhisperJson(JSON.stringify({
      word_segments: [{ word: '你好', start: 0.1, end: 0.5, score: 0.9 }],
      segments: [{ words: [{ word: '不该用这个', start: 9, end: 10 }] }],
    }));
    expect(words).toEqual([{ text: '你好', start: 0.1, end: 0.5, confidence: 0.9 }]);
  });

  it('没有 word_segments 时回落到 segments[].words', () => {
    const words = parseWhisperJson(JSON.stringify({
      segments: [{ words: [{ text: 'hello', start: 1, end: 1.4, probability: 0.8 }] }],
    }));
    expect(words[0]).toMatchObject({ text: 'hello', confidence: 0.8 });
  });

  it('丢弃时间戳缺失或颠倒的词，而不是写进项目', () => {
    const words = parseWhisperJson(JSON.stringify({
      word_segments: [
        { word: '好', start: 1, end: 0.5 },
        { word: '缺时间' },
        { word: '正常', start: 2, end: 2.5 },
      ],
    }));
    expect(words).toHaveLength(1);
    expect(words[0]?.text).toBe('正常');
  });

  it('非法 JSON 抛出可读错误', () => {
    expect(() => parseWhisperJson('{ 不是 json')).toThrow(/不是合法 JSON/);
  });
});

describe('parseSrt', () => {
  const srt = `1
00:00:01,000 --> 00:00:03,000
你好世界

2
00:00:04,500 --> 00:00:06,500
hello there
`;

  it('中文按字切分并均摊时长', () => {
    const words = parseSrt(srt);
    const chinese = words.filter((w) => w.start < 3);
    expect(chinese.map((w) => w.text)).toEqual(['你', '好', '世', '界']);
    expect(chinese[0]?.start).toBeCloseTo(1, 5);
    expect(chinese[3]?.end).toBeCloseTo(3, 5);
  });

  it('英文按词切分', () => {
    const words = parseSrt(srt).filter((w) => w.start >= 4);
    expect(words.map((w) => w.text)).toEqual(['hello', 'there']);
  });

  it('均摊出的时间连续无空隙', () => {
    const words = parseSrt(srt).filter((w) => w.start < 3);
    for (let i = 1; i < words.length; i++) {
      expect(words[i]!.start).toBeCloseTo(words[i - 1]!.end, 5);
    }
  });

  it('忽略残缺块而不是整份失败', () => {
    expect(parseSrt('1\n没有时间行\n\n2\n00:00:01,000 --> 00:00:02,000\n好')).toHaveLength(1);
  });
});
