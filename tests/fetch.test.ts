import { describe, expect, it } from 'vitest';
import { explainDownloadError, extractUrl, needsCookies, parseProgress } from '../src/analyze/fetch.js';

describe('extractUrl', () => {
  it('从整段抖音分享文案里挑出链接——用户通常整段粘贴', () => {
    const share = '7.43 复制打开抖音，看看【某某的作品】教会你怎么用agent办公 # AI https://v.douyin.com/mV1PmaxSw0c/ ZzA:/ 10/23 V@y.Gi';
    expect(extractUrl(share)).toBe('https://v.douyin.com/mV1PmaxSw0c/');
  });

  it('紧贴中文标点时不把标点带进链接', () => {
    expect(extractUrl('看这个：https://v.douyin.com/abc/，挺好的')).toBe('https://v.douyin.com/abc/');
    expect(extractUrl('（https://b23.tv/xyz）')).toBe('https://b23.tv/xyz');
  });

  it('去掉结尾的英文标点', () => {
    expect(extractUrl('see https://youtu.be/abc123.')).toBe('https://youtu.be/abc123');
  });

  it('单独一个链接原样返回', () => {
    expect(extractUrl('https://www.bilibili.com/video/BV1xx411c7mD')).toBe('https://www.bilibili.com/video/BV1xx411c7mD');
  });

  it('本地路径不当成链接', () => {
    expect(extractUrl('/Users/me/Downloads/ref.mp4')).toBeNull();
    expect(extractUrl('~/Movies/a b.mp4')).toBeNull();
  });
});

describe('needsCookies', () => {
  it('识别抖音「需要新鲜 cookie」的报错——这是实测遇到过的原文', () => {
    expect(needsCookies('ERROR: [Douyin] 7667163110523866378: Fresh cookies (not necessarily logged in) are needed')).toBe(true);
  });

  it('识别要求登录的报错', () => {
    expect(needsCookies('ERROR: Sign in to confirm you’re not a bot. Use --cookies-from-browser or --cookies')).toBe(true);
  });

  it('网络错误、链接失效不算 cookie 问题，不该白白换浏览器重试', () => {
    expect(needsCookies('ERROR: Unable to download webpage: HTTP Error 404: Not Found')).toBe(false);
    expect(needsCookies('ERROR: [generic] Unable to connect: timed out')).toBe(false);
  });
});

describe('parseProgress', () => {
  it('读出下载百分比', () => {
    expect(parseProgress('[download]  42.7% of   12.30MiB at    1.20MiB/s ETA 00:06')).toBe(42.7);
    expect(parseProgress('[download] 100% of 12.30MiB in 00:00:09')).toBe(100);
  });

  it('其他行返回 null', () => {
    expect(parseProgress('[Douyin] 7667163110523866378: Downloading web detail JSON')).toBeNull();
  });
});

describe('explainDownloadError', () => {
  it('把常见报错翻成人话', () => {
    expect(explainDownloadError('ERROR: Unable to download webpage: HTTP Error 404: Not Found')).toContain('链接打不开');
    expect(explainDownloadError('ERROR: [Douyin] 1: Fresh cookies (not necessarily logged in) are needed')).toContain('先用 Chrome 打开一次');
    expect(explainDownloadError('ERROR: Unsupported URL: https://example.com/')).toContain('不支持这个网站');
    expect(explainDownloadError('ERROR: Unable to connect: timed out')).toContain('连不上');
  });

  it('认不出的报错不瞎猜', () => {
    expect(explainDownloadError('ERROR: something odd')).toBe('下载失败。');
  });
});
