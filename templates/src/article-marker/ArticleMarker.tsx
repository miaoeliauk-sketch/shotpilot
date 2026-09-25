import React, { useMemo } from 'react';
import { AbsoluteFill, Easing, Img, interpolate, useCurrentFrame } from 'remotion';
import { bundledUrl } from '../asset';
import { TiltShift, vignetteGradient } from '../lens';
import { measure } from '../text-layout';
import { TweetPage, layoutPage, type TranslationLine } from '../tweet-translate/TweetTranslate';

/**
 * 复刻：从帖子特写拉远到整篇文章 → 一句话被黑条从左往右涂黑、字变白 → 镜头推到这句话上（134 帧，1280×720 @30fps）
 *
 * 按原片量的（文章坐标 = 第 31 帧的画面坐标）：
 *   中文正文 26.5px 灰色，左边 x 88；段内行距 52，段与段之间多空 34
 *   正文下面嵌着一条帖子：就是「英文原文特写 · 翻译黑条」那一页，缩到 0.8 倍，左上角在 (248, 607)
 *   开头：镜头从帖子特写（1.21 倍）拉远到整篇文章，第 0–30 帧，先快后慢
 *   第 34 帧起：选中那句被黑条从左往右涂黑（先慢后快），黑条高 41、纯黑，涂到的字变白
 *   同时镜头推到这句话上：2.45 倍，第 34–88 帧，先慢后快再慢；停住以后还慢慢往下漂一点
 *   推近的动作是位置和缩放用同一条曲线插值（像 AE 里打两个关键帧），所以中途的画面中心不是直线走过去的
 * 画面效果：横向景深、暗角、划痕、一点红蓝色差。只复刻画面，底部口播字幕不在模板里。
 */

export type ArticleMarkerProps = {
  paragraphs: string[];
  /** 涂黑第几段（从 0 数），整段第一行 */
  markParagraph: number;
  post: { avatar: string; name: string; handle: string; paragraphs: string[]; anchorParagraph: number; lines: TranslationLine[]; highlightColor: string };
  /** 开头从帖子特写拉远 */
  pullBack: boolean;
  markAt: number;
  markFrames: number;
  zoomAt: number;
  zoomFrames: number;
  durationInFrames: number;
};

const SANS = '"Noto Sans CJK SC", "PingFang SC", "Source Han Sans SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif';
export const ARTICLE = { left: 88, width: 1110, size: 26.5, line: 52, paraGap: 34, firstCenter: 0, color: '#4a4a4d', lastLineCenter: 257 };
/** 嵌的帖子：帖子页缩到 0.8 倍，页面原点放在这里；和正文最后一段的距离按原片 */
const EMBED = { scale: 0.8, x: 248, gapBelowText: 212 };

const MARK = { height: 41, padLeft: 20, padRight: 10, ease: Easing.bezier(0.78, 0, 0.23, 0.94) };
const ZOOM = { to: 2.455, offsetX: 331, offsetY: 4 };
/** 开头拉远：第 0 帧 1.2127 倍，画面中心对着文章里的 (757.6, 791.1)；进度按实测表（先快后慢） */
const PULL = { from: 1.2127, center: [757.6, 791.1], t: [0, 3, 6, 9, 12, 15, 18, 21, 24, 27, 30], e: [0, 0.381, 0.583, 0.722, 0.812, 0.877, 0.923, 0.956, 0.979, 0.997, 1] };
/** 推近进度（实测，相对 zoomAt，原片 54 帧推完） */
const PUSH_T = [0, 5, 10, 15, 17, 19, 21, 23, 25, 27, 29, 31, 33, 35, 40, 45, 54];
const PUSH_E = [0, 0.009, 0.029, 0.064, 0.087, 0.117, 0.157, 0.213, 0.305, 0.485, 0.687, 0.79, 0.848, 0.887, 0.947, 0.983, 1];

const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;
const C = [640, 360] as const;

export type ArticleLine = { text: string; center: number; paragraph: number };

/** 中文正文换行（按字，标点不放行首） */
export function layoutArticle(paragraphs: string[]): { lines: ArticleLine[]; bottom: number } {
  const font = `${ARTICLE.size}px ${SANS}`;
  const lines: ArticleLine[] = [];
  // 最后一段第一行对着原片的 y 257 往回排（原片要标的那句前面有三段）
  let y = 0;
  paragraphs.forEach((p, i) => {
    if (i > 0) y += ARTICLE.paraGap;
    let cur = '';
    for (const ch of Array.from(p)) {
      if (cur && measure(cur + ch, font) > ARTICLE.width && !/[，。、；：！？）」』”]/.test(ch)) {
        lines.push({ text: cur, center: y, paragraph: i });
        y += ARTICLE.line;
        cur = ch;
      } else cur += ch;
    }
    lines.push({ text: cur, center: y, paragraph: i });
    y += ARTICLE.line;
  });
  return { lines, bottom: y - ARTICLE.line };
}

/** 画面 = pos + s ×（文章坐标 − 画面中心） */
export function articleCamera(frame: number, p: Pick<ArticleMarkerProps, 'pullBack' | 'zoomAt' | 'zoomFrames'>, target: [number, number]) {
  let s = 1;
  let pos: number[] = [C[0], C[1]];
  if (p.pullBack) {
    const e = interpolate(frame, PULL.t, PULL.e, clamp);
    const s0 = PULL.from;
    const pos0 = [C[0] - s0 * (PULL.center[0]! - C[0]), C[1] - s0 * (PULL.center[1]! - C[1])];
    s = s0 + (1 - s0) * e;
    pos = [pos0[0]! + (C[0] - pos0[0]!) * e, pos0[1]! + (C[1] - pos0[1]!) * e];
  }
  const e2 = interpolate(frame - p.zoomAt, PUSH_T.map((t) => (t * p.zoomFrames) / 54), PUSH_E, clamp);
  if (e2 > 0) {
    const pos1 = [C[0] - ZOOM.to * (target[0] - C[0]), C[1] - ZOOM.to * (target[1] - C[1])];
    s = s + (ZOOM.to - s) * e2;
    pos = [pos[0]! + (pos1[0]! - pos[0]!) * e2, pos[1]! + (pos1[1]! - pos[1]!) * e2];
    // 推完以后还慢慢往下漂（原片每帧 0.22px）
    pos[1]! += 0.22 * Math.max(0, frame - p.zoomAt - p.zoomFrames);
  }
  return { s, x: pos[0]!, y: pos[1]! };
}

export const ArticleMarker: React.FC<ArticleMarkerProps> = (p) => {
  const frame = useCurrentFrame();
  const article = useMemo(() => layoutArticle(p.paragraphs), [p.paragraphs]);
  const tweet = useMemo(() => layoutPage(p.post.paragraphs, p.post.anchorParagraph), [p.post.paragraphs, p.post.anchorParagraph]);
  const markIdx = Math.min(Math.max(0, p.markParagraph), p.paragraphs.length - 1);
  const markLine = article.lines.find((l) => l.paragraph === markIdx) ?? article.lines[0];
  // 文章整体上下挪：让要标的那句落在原片的 y 257
  const shiftY = ARTICLE.lastLineCenter - (markLine?.center ?? 0);
  const font = `${ARTICLE.size}px ${SANS}`;
  const lineW = markLine ? measure(markLine.text, font) : 0;
  const markY = (markLine?.center ?? 0) + shiftY;
  const target: [number, number] = [ARTICLE.left + ZOOM.offsetX, markY + ZOOM.offsetY];
  const cam = articleCamera(frame, p, target);
  const markW = (lineW + MARK.padLeft + MARK.padRight) * (frame < p.markAt ? 0 : MARK.ease(interpolate(frame, [p.markAt, p.markAt + p.markFrames], [0, 1], clamp)));
  const embedY = article.bottom + shiftY + EMBED.gapBelowText;

  // 截图本身有点软：虚化加在外面一层（画面坐标），不能和缩放放在同一层——那样会先虚再放大，推近以后糊成一片
  const page = (
    <div style={{ position: 'absolute', inset: 0, filter: 'blur(0.8px)' }}>
    <div
      style={{
        position: 'absolute', left: 0, top: 0, width: 1280, height: 720, transformOrigin: '640px 360px',
        transform: `translate(${cam.x - C[0]}px, ${cam.y - C[1]}px) scale(${cam.s})`,
      }}
    >
      <div style={{ position: 'absolute', left: -600, top: -900, width: 2600, height: 2600, backgroundColor: '#fafafa' }} />
      {article.lines.map((l, i) => {
        const marked = l === markLine;
        return (
          <div
            key={i}
            style={{
              position: 'absolute', left: ARTICLE.left, top: l.center + shiftY - 26, height: 52, lineHeight: '52px',
              fontFamily: SANS, fontSize: ARTICLE.size, color: ARTICLE.color, whiteSpace: 'pre',
            }}
          >
            {l.text}
            {marked && markW > 0 && (
              // 涂黑：黑条盖上去，盖住的字变白
              <div style={{ position: 'absolute', left: -MARK.padLeft, top: 26 - MARK.height / 2, width: markW, height: MARK.height, overflow: 'hidden', backgroundColor: '#050505' }}>
                <div style={{ position: 'absolute', left: MARK.padLeft, top: MARK.height / 2 - 26, height: 52, lineHeight: '52px', color: '#f6f4f5', whiteSpace: 'pre' }}>{l.text}</div>
              </div>
            )}
          </div>
        );
      })}
      <div style={{ position: 'absolute', left: EMBED.x, top: embedY, transformOrigin: '0 0', transform: `scale(${EMBED.scale})` }}>
        <TweetPage avatar={p.post.avatar} name={p.post.name} handle={p.post.handle} layout={tweet} lines={p.post.lines} highlightColor={p.post.highlightColor} progress={() => 1} />
      </div>
    </div>
    </div>
  );

  return (
    <AbsoluteFill style={{ backgroundColor: '#fafafa', overflow: 'hidden' }}>
      <TiltShift cx={640} k={2.3e-8} power={3} far={7} farStyle={{ filter: 'blur(6px) drop-shadow(-5px 0 0 rgba(230,60,60,0.35)) drop-shadow(5px 0 0 rgba(60,150,235,0.35))' }}>
        {page}
      </TiltShift>
      <AbsoluteFill style={{ background: vignetteGradient({ cx: 644, cy: 358, rx: 709, ry: 472, amount: 0.44, power: 2.48 }) }} />
      <Img
        src={bundledUrl('doc-highlight/scratches.png')}
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0.55, WebkitMaskImage: EDGE_MASK, maskImage: EDGE_MASK }}
      />
    </AbsoluteFill>
  );
};

const EDGE_MASK = 'radial-gradient(ellipse 640px 400px at 640px 360px, transparent 55%, #000 100%)';
