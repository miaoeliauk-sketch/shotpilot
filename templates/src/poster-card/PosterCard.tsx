import React from 'react';
import { Img } from 'remotion';
import { assetUrl } from '../asset';
import { BUNDLED_FONTS } from '../fonts';

/**
 * 一张「浏览器窗口」样子的海报卡片（「两张海报 · 合在一起 · 右边大字」「联网 ≠ 成功 · 两张海报 · 档案卡」共用）。
 *
 * 按原片量的（卡片 326×356 + 顶上 17px 的窗口栏）：
 *   窗口栏：浅灰白、左边红黄绿三个点、右边两个小图标、中间一条地址栏
 *   卡面：米黄（或橘粉）渐变；顶上一排很大的淡灰字母（从上往下渐隐）；
 *     卡面往下 82 起一行深棕色粗宋标题（字高 62）、154 起一行灰色压窄的英文；下半截一张图（透明底）
 */

export type Poster = { title: string; sub: string; letters: string; image: string; tone: 'cream' | 'peach' };

export const POSTER = { w: 326, h: 356, bar: 17 };

const SERIF = '"Noto Serif CJK SC", "Songti SC", "STSong", "Source Han Serif SC", serif';
const TONES = {
  cream: 'linear-gradient(170deg, #eee2b8 0%, #e6d9ad 60%, #dccda0 100%)',
  peach: 'linear-gradient(170deg, #f1d0a4 0%, #eabf92 60%, #e0b184 100%)',
} as const;

export const PosterCard: React.FC<{ poster: Poster; style?: React.CSSProperties }> = ({ poster, style }) => {
  const { w, h, bar } = POSTER;
  return (
    <div style={{ position: 'absolute', width: w, height: h + bar, boxShadow: '10px 14px 22px rgba(0,0,0,0.35)', ...style }}>
      {/* 窗口栏 */}
      <div style={{ position: 'absolute', left: -3, right: -3, top: 0, height: bar, borderRadius: '5px 5px 0 0', background: 'linear-gradient(to bottom, #fafafa, #e4e4e4)', boxShadow: '0 1px 0 #cfcfcf' }}>
        {['#e0443e', '#dea123', '#1aab29'].map((c, i) => (
          <div key={i} style={{ position: 'absolute', left: 8 + i * 10, top: 5, width: 7, height: 7, borderRadius: 4, background: c }} />
        ))}
        <div style={{ position: 'absolute', left: 60, top: 6, width: 8, height: 6, border: '1px solid #9a9a9a', borderRadius: 1 }} />
        <div style={{ position: 'absolute', left: 104, right: 74, top: 4, height: 9, borderRadius: 4, background: '#efefef' }} />
        <div style={{ position: 'absolute', right: 22, top: 3, fontSize: 10, lineHeight: '10px', color: '#666' }}>+</div>
        <div style={{ position: 'absolute', right: 8, top: 5, width: 7, height: 7, border: '1px solid #777', borderRadius: 1 }} />
      </div>
      {/* 卡面 */}
      <div style={{ position: 'absolute', left: 0, right: 0, top: bar, bottom: 0, background: TONES[poster.tone], overflow: 'hidden', borderRadius: '0 0 4px 4px' }}>
        {poster.letters && (
          <div
            style={{
              position: 'absolute', left: 0, right: 0, top: 4, textAlign: 'center', whiteSpace: 'pre', fontFamily: `"${BUNDLED_FONTS.oswald.family}", sans-serif`, fontWeight: 700,
              fontSize: 96, lineHeight: 1, letterSpacing: 4, color: 'transparent',
              backgroundImage: 'linear-gradient(to bottom, rgba(95,90,82,0.85) 20%, rgba(95,90,82,0.25) 70%, rgba(95,90,82,0) 95%)', WebkitBackgroundClip: 'text', backgroundClip: 'text',
            }}
          >
            {poster.letters}
          </div>
        )}
        <div
          style={{
            position: 'absolute', left: 0, right: 0, top: 76, textAlign: 'center', whiteSpace: 'pre', fontFamily: SERIF, fontWeight: 700, fontSize: 64, lineHeight: 1,
            color: '#3b2e14', transform: 'scaleX(0.8)', textShadow: '1px 2px 2px rgba(60,40,10,0.35)',
          }}
        >
          {poster.title}
        </div>
        {poster.sub && (
          <div
            style={{
              position: 'absolute', left: -40, right: -40, top: 152, textAlign: 'center', whiteSpace: 'pre', fontFamily: '"Arial Narrow", "Helvetica Neue", Arial, sans-serif',
              fontSize: 22, lineHeight: 1, color: '#8d8a73', transform: 'scaleX(0.82)',
            }}
          >
            {poster.sub}
          </div>
        )}
        {poster.image && (
          <Img src={assetUrl(poster.image)} style={{ position: 'absolute', left: 38, top: 172, width: w - 76, height: h - 180, objectFit: 'contain', filter: 'drop-shadow(6px 10px 8px rgba(0,0,0,0.35))' }} />
        )}
      </div>
    </div>
  );
};
