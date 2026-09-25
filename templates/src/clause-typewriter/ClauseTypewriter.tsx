import React, { useMemo } from 'react';
import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from 'remotion';
import { Media } from '../media';
import { highlightSegments } from '../doc-highlight/DocHighlight';
import { layoutBody } from '../text-layout';

/**
 * 复刻：老照片背景上，标题从模糊里浮出来，下面的条文一个字一个字打出来，橙色笔刷划重点（156 帧，1280×720 @30fps）
 *
 * ── 结构（第 149 帧量的）─────────────────────────────────────────────
 *   标题两行  粗宋 62px，居中（x≈630），字心 y 75、153
 *   英文      y 220–241，粗体无衬线 20px，灰
 *   分隔线    y 272，一条细灰线
 *   正文      粗宋 34px，行距 81（很松），左边 71、首行缩进约 2 字，右边 1210
 *             引号里的那段更黑更粗，后面垫一道橙色笔刷
 *
 * ── 动作 ─────────────────────────────────────────────────────────────
 *   整个画面（连背景）从 0.954 倍匀速推到 1 倍，中心 (630, 355)
 *   标题  第 3–21 帧从模糊（σ≈12）里淡出来
 *   正文  第 23 帧开始打字，每 1.5 帧一个字，末尾跟一个光标「|」；
 *         一开始整段在更低的位置（+103px），第 30–66 帧缓缓升上去
 *   笔刷  第 76 帧起，第一行从左往右刷（6 帧），第二行从右往左刷（16 帧），一行一来回
 *
 * 背景（带两只飞鸟的老照片）是视频，换成用户自己的图或视频。只复刻画面，底部口播字幕不在模板里。
 */

export type ClauseTypewriterProps = {
  background: string;
  title1: string;
  title2: string;
  subtitle: string;
  body: string;
  highlight: string;
  highlightColor: string;
  titleAt: number;
  typeAt: number;
  /** 每个字几帧 */
  framesPerChar: number;
  highlightAt: number;
  durationInFrames: number;
};

const SERIF = '"Songti SC", "STSong", "Noto Serif CJK SC", "Source Han Serif SC", serif';
const SANS = '"Avenir Next", "Helvetica Neue", "Noto Sans CJK SC", sans-serif';

export const BODY = { left: 71, right: 1240, firstCenter: 362, size: 34, lineHeight: 81, paragraphGap: 0, indent: 1.9 };
const RISE = { distance: 103, from: 7, to: 43 };
const HIGHLIGHT = { height: 43, first: 6, rest: 16, gap: 4 };
const ZOOM = { from: 0.954, anchorX: 630, anchorY: 355 };

const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;

export const ClauseTypewriter: React.FC<ClauseTypewriterProps> = (p) => {
  const frame = useCurrentFrame();
  const layout = useMemo(() => layoutBody([{ text: p.body, highlight: p.highlight && p.body.includes(p.highlight) ? p.highlight : '' }], BODY, SERIF), [p.body, p.highlight]);
  const segs = useMemo(() => highlightSegments(layout.chars), [layout]);

  const zoom = ZOOM.from + (1 - ZOOM.from) * interpolate(frame, [0, Math.max(1, p.durationInFrames - 1)], [0, 1], clamp);
  // 标题：前半段一直很虚，后半段才迅速变清楚
  const titleU = interpolate(frame, [p.titleAt, p.titleAt + 18], [0, 1], clamp);
  const titleBlur = 12 * (1 - titleU) ** 0.9;
  const titleAlpha = titleU ** 0.7;
  const typed = Math.floor((frame - p.typeAt) / p.framesPerChar) + 1;
  const rise = RISE.distance * (1 - Easing.inOut(Easing.cubic)(interpolate(frame - p.typeAt, [RISE.from, RISE.to], [0, 1], clamp)));
  const last = layout.chars[Math.min(layout.chars.length, Math.max(0, typed)) - 1];

  return (
    <AbsoluteFill style={{ backgroundColor: '#9a9a9a', overflow: 'hidden' }}>
      <AbsoluteFill style={{ transform: `scale(${zoom})`, transformOrigin: `${ZOOM.anchorX}px ${ZOOM.anchorY}px` }}>
        {/* 背景比画面大 5%：整体缩到 0.954 倍时四边不露底 */}
        <Media src={p.background} style={{ position: 'absolute', left: -32, top: -18, width: 1344, height: 756 }} />
        {/* 文字后面一层淡淡的亮雾，让黑字看得清（原片背景在字的区域明显更亮） */}
        <div style={{ position: 'absolute', left: 60, top: 20, width: 1160, height: 560, background: 'radial-gradient(closest-side, rgba(235,235,235,0.55), rgba(235,235,235,0))' }} />

        <div style={{ opacity: titleAlpha, filter: titleBlur > 0.05 ? `blur(${titleBlur.toFixed(2)}px)` : undefined }}>
          <Line top={75} size={62} text={p.title1} />
          <Line top={153} size={62} text={p.title2} />
          {p.subtitle && (
            <div style={{ position: 'absolute', left: 0, width: 1260, top: 220, height: 22, display: 'flex', justifyContent: 'center', alignItems: 'center', fontFamily: SANS, fontWeight: 700, fontSize: 20, color: '#6c6c6c', whiteSpace: 'pre' }}>
              {p.subtitle}
            </div>
          )}
          <div style={{ position: 'absolute', left: 90, top: 272, width: 1100, height: 1.5, backgroundColor: 'rgba(80,80,80,0.55)' }} />
        </div>

        {typed > 0 && (
          <div style={{ position: 'absolute', inset: 0, transform: `translateY(${rise.toFixed(2)}px)` }}>
            {/* 橙色笔刷：一行一来回 */}
            {segs.map((s, i) => {
              const start = p.highlightAt + (i === 0 ? 0 : HIGHLIGHT.first + HIGHLIGHT.gap + (i - 1) * (HIGHLIGHT.rest + HIGHLIGHT.gap));
              const dur = i === 0 ? HIGHLIGHT.first : HIGHLIGHT.rest;
              const u = Easing.out(Easing.quad)(interpolate(frame, [start, start + dur], [0, 1], clamp));
              if (u <= 0) return null;
              const w = (s.x1 - s.x0 + 12) * u;
              const ltr = i % 2 === 0;
              return (
                <div
                  key={i}
                  style={{
                    position: 'absolute', left: ltr ? s.x0 - 6 : s.x1 + 6 - w, top: s.center - HIGHLIGHT.height / 2, width: w, height: HIGHLIGHT.height,
                    backgroundColor: p.highlightColor, opacity: 0.85, mixBlendMode: 'multiply',
                    borderRadius: '40% 12% 45% 10% / 50% 30% 50% 30%', filter: 'blur(0.8px)',
                  }}
                />
              );
            })}
            {layout.chars.slice(0, Math.max(0, typed)).map((c, i) => (
              <span
                key={i}
                style={{
                  position: 'absolute', left: c.x, top: c.center - BODY.lineHeight / 2 - BODY.size * 0.05, lineHeight: `${BODY.lineHeight}px`,
                  fontFamily: SERIF, fontSize: BODY.size, fontWeight: c.highlight ? 900 : 700, color: c.highlight ? '#0c0c0c' : '#1e1e1e', whiteSpace: 'pre',
                }}
              >
                {c.ch}
              </span>
            ))}
            {last && typed <= layout.chars.length && (
              <div style={{ position: 'absolute', left: last.x + last.width + 4, top: last.center - 16, width: 2.5, height: 32, backgroundColor: '#1e1e1e' }} />
            )}
          </div>
        )}
      </AbsoluteFill>
      {/* 暗角 */}
      <AbsoluteFill style={{ background: 'radial-gradient(ellipse 75% 80% at 50% 45%, rgba(0,0,0,0) 55%, rgba(0,0,0,0.35) 85%, rgba(0,0,0,0.6) 100%)' }} />
    </AbsoluteFill>
  );
};

const Line: React.FC<{ top: number; size: number; text: string }> = ({ top, size, text }) => (
  <div
    style={{
      position: 'absolute', left: 0, width: 1260, top: top - size * 0.6, height: size * 1.2, display: 'flex', justifyContent: 'center', alignItems: 'center',
      fontFamily: SERIF, fontWeight: 700, fontSize: size, lineHeight: 1, color: '#1c1c1e', whiteSpace: 'pre', fontFeatureSettings: '"palt"',
    }}
  >
    {text}
  </div>
);
