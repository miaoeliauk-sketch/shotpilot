import React, { useMemo } from 'react';
import { AbsoluteFill, Easing, Img, interpolate, useCurrentFrame } from 'remotion';
import { assetUrl, bundledUrl } from '../asset';
import { TiltShift, vignetteGradient } from '../lens';
import { measure } from '../text-layout';

/**
 * 复刻：英文帖子原文特写，一行一行刷出黑底白字的中文翻译（118 帧，1280×720 @30fps）
 *
 * 按原片量的（页面坐标 = 第 0 帧的画面坐标）：
 *   英文原文 40px、行距 59.1，左边从 x −13 开始、一行排 1360 宽（右边超出画面），段落之间空一行；**粗体**照原样
 *   左上角是头像和名字（只露出一点）
 *   整页一直在慢慢往右下漂：第 0 帧每帧 4px，越来越慢，117 帧一共往下 85、往右 14
 *   翻译黑条盖在某一段第一行上，每条高 61、上下间隔 76.5，从画面左边外面开始；
 *   字 47px 白色，重点词黄绿色 #eaf960
 *   黑条从左往右刷出来，字跟着露出来：先慢后快再慢（贝塞尔 0.78, 0, 0.23, 0.94），52 帧刷完；
 *   原片第一条第 5 帧开始，第二条第 58 帧开始
 * 画面效果：横向景深（中间实、左右虚，约 2.3e-8 ×|x − 640|³，最边上虚到 6px）、暗角、划痕、一点红蓝色差。只复刻画面，底部口播字幕不在模板里。
 */

export type TranslationLine = { text: string; highlight: string; at: number };

export type TweetTranslateProps = {
  avatar: string;
  name: string;
  handle: string;
  paragraphs: string[];
  /** 黑条盖在第几段的第一行上（从 0 数） */
  anchorParagraph: number;
  lines: TranslationLine[];
  highlightColor: string;
  wipeFrames: number;
  durationInFrames: number;
};

const SANS = '"Noto Sans CJK SC", "PingFang SC", "Source Han Sans SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif';
export const PAGE = { left: -13, width: 1360, size: 40, pitch: 59.1, firstBaseline: 8.8, color: '#3a3b40' };
export const BAR = { left: -57, textLeft: -27, height: 61, pitch: 76.5, size: 47, padRight: 16, color: '#191919', text: '#ececec', offsetY: -16.5 };
const WIPE = Easing.bezier(0.78, 0, 0.23, 0.94);
/** 镜头漂移（实测，第 0–117 帧）：整页往右下走多少 */
const CAM_T = [0, 3, 6, 9, 12, 15, 18, 24, 30, 36, 42, 48, 57, 66, 78, 90, 102, 117];
const CAM_Y = [0, 12.3, 21, 27.5, 32.9, 37.6, 41.2, 48.9, 54, 58.5, 63, 67, 72, 75.8, 79.5, 82, 84, 85.1];
const CAM_X = [0, 0.5, 1, 1.7, 2.3, 3, 3.8, 5.4, 6.9, 8.2, 9.4, 10.5, 11.8, 12.8, 13.6, 14, 14.1, 14.1];

const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;
const EDGE_MASK = 'radial-gradient(ellipse 640px 400px at 640px 360px, transparent 55%, #000 100%)';

type Seg = { text: string; bold: boolean };

/** 「**粗体**」拆成一段一段 */
export function parseBold(text: string): Seg[] {
  return text.split(/(\*\*[^*]+\*\*)/).filter(Boolean).map((s) => (s.startsWith('**') && s.endsWith('**') ? { text: s.slice(2, -2), bold: true } : { text: s, bold: false }));
}

const font = (bold: boolean) => `${bold ? 700 : 400} ${PAGE.size}px ${SANS}`;

/** 按单词换行，带粗细 */
export function wrapRich(text: string, maxWidth: number): Seg[][] {
  const words: Seg[] = [];
  for (const seg of parseBold(text)) for (const w of seg.text.split(/(\s+)/)) if (w) words.push({ text: w, bold: seg.bold });
  const lines: Seg[][] = [];
  let cur: Seg[] = [];
  let width = 0;
  for (const w of words) {
    const ww = measure(w.text, font(w.bold));
    if (/^\s+$/.test(w.text)) {
      if (cur.length) {
        cur.push(w);
        width += ww;
      }
      continue;
    }
    if (cur.length && width + ww > maxWidth) {
      while (cur.length && /^\s+$/.test(cur[cur.length - 1]!.text)) cur.pop();
      lines.push(cur);
      cur = [];
      width = 0;
    }
    cur.push(w);
    width += ww;
  }
  if (cur.length) lines.push(cur);
  return lines;
}

export type PageLayout = { lines: { segs: Seg[]; baseline: number }[]; anchorBaseline: number };

export function layoutPage(paragraphs: string[], anchorParagraph: number): PageLayout {
  const lines: PageLayout['lines'] = [];
  let k = 0;
  let anchorBaseline = PAGE.firstBaseline + PAGE.pitch * 4;
  paragraphs.forEach((p, i) => {
    if (i > 0) k += 1; // 段落之间空一行
    if (i === anchorParagraph) anchorBaseline = PAGE.firstBaseline + PAGE.pitch * k;
    for (const segs of wrapRich(p, PAGE.width)) {
      lines.push({ segs, baseline: PAGE.firstBaseline + PAGE.pitch * k });
      k += 1;
    }
  });
  return { lines, anchorBaseline };
}

export function camera(frame: number): { x: number; y: number } {
  return { x: interpolate(frame, CAM_T, CAM_X, clamp), y: interpolate(frame, CAM_T, CAM_Y, clamp) };
}

export function wipeProgress(frame: number, at: number, frames: number): number {
  if (frame < at) return 0;
  return WIPE(interpolate(frame, [at, at + frames], [0, 1], clamp));
}

export const TweetTranslate: React.FC<TweetTranslateProps> = (p) => {
  const frame = useCurrentFrame();
  const layout = useMemo(() => layoutPage(p.paragraphs, p.anchorParagraph), [p.paragraphs, p.anchorParagraph]);
  const cam = camera(frame);

  const page = (
    <div style={{ position: 'absolute', left: 0, top: 0, width: 1280, height: 720, transform: `translate(${cam.x}px, ${cam.y}px)`, filter: 'blur(1px)' }}>
      {/* 页面白底要不透明：三层景深叠在一起时，上面实的那层得盖住下面虚的 */}
      <div style={{ position: 'absolute', left: -200, top: -300, width: 1700, height: 1300, backgroundColor: '#fafafa' }} />
      <TweetPage avatar={p.avatar} name={p.name} handle={p.handle} layout={layout} lines={p.lines} highlightColor={p.highlightColor} progress={(l) => wipeProgress(frame, l.at, p.wipeFrames)} />
    </div>
  );

  return (
    <AbsoluteFill style={{ backgroundColor: '#fafafa', overflow: 'hidden' }}>
      <TiltShift cx={640} k={2.3e-8} power={3} far={7} farStyle={{ filter: 'blur(6px) drop-shadow(-5px 0 0 rgba(230,60,60,0.35)) drop-shadow(5px 0 0 rgba(60,150,235,0.35))' }}>
        {page}
      </TiltShift>
      <AbsoluteFill style={{ background: vignetteGradient({ cx: 638, cy: 361, rx: 699, ry: 474, amount: 0.444, power: 2.62 }) }} />
      {/* 划痕只在四周（中间干净） */}
      <Img
        src={bundledUrl('doc-highlight/scratches.png')}
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0.55, WebkitMaskImage: EDGE_MASK, maskImage: EDGE_MASK }}
      />
    </AbsoluteFill>
  );
};

/**
 * 帖子这一页（页面坐标）：左上角头像、名字、账号，下面英文原文，再压上翻译黑条。
 * 「文章截图 · 黑条标重点」里嵌的帖子也是这一页，缩到 0.8 倍放进文章里。
 */
export const TweetPage: React.FC<{
  avatar: string;
  name: string;
  handle: string;
  layout: PageLayout;
  lines: TranslationLine[];
  highlightColor: string;
  progress: (line: TranslationLine) => number;
}> = ({ avatar, name, handle, layout, lines, highlightColor, progress }) => (
  <>
    {/* 头像 + 名字、账号两行（在第一行原文上面，特写里只露出一点） */}
    {avatar && (
      <div style={{ position: 'absolute', left: -12, top: -157, width: 88, height: 88, borderRadius: 44, overflow: 'hidden', backgroundColor: '#e7c34a' }}>
        <Img src={assetUrl(avatar)} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      </div>
    )}
    {name && <div style={{ position: 'absolute', left: 97, top: -128, fontFamily: SANS, fontSize: 32, fontWeight: 700, lineHeight: '48px', whiteSpace: 'pre', color: '#111' }}>{name}</div>}
    {handle && <div style={{ position: 'absolute', left: 97, top: -73, fontFamily: SANS, fontSize: 30, lineHeight: '45px', whiteSpace: 'pre', color: '#6b7680' }}>{handle}</div>}
    {layout.lines.map((line, i) => (
      <div
        key={i}
        style={{
          position: 'absolute', left: PAGE.left, top: line.baseline - PAGE.size * 0.75 - PAGE.size * 0.43, height: PAGE.size * 1.5, lineHeight: `${PAGE.size * 1.5}px`,
          fontFamily: SANS, fontSize: PAGE.size, color: PAGE.color, whiteSpace: 'pre',
        }}
      >
        {line.segs.map((s, j) => (
          <span key={j} style={{ fontWeight: s.bold ? 700 : 400, color: s.bold ? '#1d1e21' : undefined }}>{s.text}</span>
        ))}
      </div>
    ))}
    {lines.map((l, i) => (
      <Bar key={i} line={l} top={layout.anchorBaseline + BAR.offsetY + i * BAR.pitch - BAR.height / 2} progress={progress(l)} color={highlightColor} />
    ))}
  </>
);

/** 一条翻译黑条：从左往右刷，重点词换颜色 */
const Bar: React.FC<{ line: TranslationLine; top: number; progress: number; color: string }> = ({ line, top, progress, color }) => {
  if (progress <= 0 || !line.text) return null;
  const f = `400 ${BAR.size}px ${SANS}`;
  const right = BAR.textLeft + measure(line.text, f) + BAR.padRight;
  const w = (right - BAR.left) * progress;
  const hl = line.highlight && line.text.includes(line.highlight) ? line.highlight : '';
  const parts = hl ? line.text.split(hl) : [line.text];
  return (
    <div style={{ position: 'absolute', left: BAR.left, top, width: w, height: BAR.height, overflow: 'hidden', backgroundColor: BAR.color }}>
      <div
        style={{
          position: 'absolute', left: BAR.textLeft - BAR.left, top: 0, height: BAR.height, lineHeight: `${BAR.height}px`,
          fontFamily: SANS, fontSize: BAR.size, color: BAR.text, whiteSpace: 'pre',
        }}
      >
        {parts.map((part, i) => (
          <React.Fragment key={i}>
            {part}
            {i < parts.length - 1 && <span style={{ color }}>{hl}</span>}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
};
