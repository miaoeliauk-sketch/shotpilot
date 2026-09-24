import React, { useLayoutEffect, useMemo, useState } from 'react';
import { AbsoluteFill, Easing, Img, continueRender, delayRender, interpolate, useCurrentFrame } from 'remotion';
import { assetUrl } from '../asset';
import { inkMaskUrl } from './ink';
import { layoutBody, measure, type BodyChar, type BodyLayout } from './layout';

/**
 * 复刻：金色大标题 → 墨迹转场 → 新闻稿划重点 → 推近特写（150 帧，1280×720 @30fps）
 *
 * ── 四段（全部来自逐帧实测）──────────────────────────────────────────
 *   0–58   标题段：整幅画面从 2.3 倍拉远到 1 倍，放大中心在画面顶边正中（x′=S(x−640)+640，y′=S·y）。
 *          背景从一片暗棕色里渐显、由虚变实；大标题一个字一个字从模糊里浮出来，跟着画面一起缩放。
 *   58–69  墨迹转场：干笔刷一样的墨迹一道道扫过，露出下面的新闻稿（先后顺序和每帧扫开的面积照原片量）。
 *   59–112 新闻稿：整页慢慢拉远（1.126 → 1 倍，不动点 (786, 406)，越来越慢）。
 *          正文一行一行从左往右淡入；重点句是橙色，手绘划线先往右画、到头折回来再画一笔。
 *   113–   硬切到正文特写：2.0 倍，镜头从下往上缓缓停住，同时继续极慢地拉远。
 *
 * 只复刻画面。原片底部那行口播字幕是后期加的，不在模板里；比对时用 --mask 遮掉。
 *
 * 标题段的背景是位图（手、卡片、纸片、书架），换成用户自己的图；
 * 卡片和纸片在原片里各自有动作，一张静态图做不出来，这是标题段和原片差异最大的地方。
 *
 * ── 复刻记录（SSIM 按段，遮掉底部字幕；开场背景用原片第 56 帧刮掉标题）──────────
 *   第一版     标题 0.806 · 转场 0.573 · 新闻稿 0.614 · 特写 0.596
 *   背景和暗角  新闻稿的底其实是从左往右渐亮 + 一层压在字上的暗角，不是一个径向渐变 → 新闻稿 0.678
 *   标点和换行  新闻标题用窄标点（palt）；正文不是两端对齐，是左对齐、首行缩进 2.25 字
 *   墨迹       用原片逐帧「哪里先露出新闻稿」量出 16×9 的先后网格，面积按帧对齐 → 转场 0.63
 *   标题       原片标题是单独一层：比背景多一点景深（前半段更虚）和几像素漂移；英文不是拉高，是和汉字差不多大 → 标题 0.851
 *   第二段     原片第二段整体比第一段靠左 12px，对上以后特写段 0.657 → 0.739
 *   最终用仓库的比对工具（pnpm compare）测：平均 0.868。剩下的差距主要是字体：原片正文不是思源黑体，字形对不齐
 */

export type Paragraph = {
  text: string;
  /** 标橙色、画线的那一段，必须和正文里的某一段完全一样；留空不标 */
  highlight: string;
  /** 划线开始画的帧 */
  underlineAt: number;
  /** 整段左右挪多少 px（原片第二段比第一段靠左 12px） */
  offsetX: number;
};

// 用 type 而非 interface：Remotion 要求 props 可赋值给 Record<string, unknown>
export type NewsHeadlineProps = {
  image: string;
  title: string;
  subtitle: string;
  headline: string[];
  /** 新闻标题里标金色的词 */
  headlineGold: string[];
  paragraphs: Paragraph[];
  titleColor: [string, string];
  goldColor: [string, string];
  whiteColor: string;
  bodyColor: string;
  accentColor: string;
  /** 标题段的时间倍率：1 = 原片（59 帧后开始转场） */
  titleSpeed: number;
  wipeAt: number;
  punchAt: number;
  punchScale: number;
  /** 推近停住时对准新闻稿上的哪一点（新闻稿坐标，px） */
  punchX: number;
  punchY: number;
  durationInFrames: number;
};

// ── 字体 ──────────────────────────────────────────────────────────────
// Mac 上用系统自带的宋体 / 苹方；没有的机器（比如打包用的 Linux）落到思源字体
export const SERIF = '"Songti SC", "STSong", "Noto Serif CJK SC", "Source Han Serif SC", serif';
export const SANS = '"PingFang SC", "Noto Sans CJK SC", "Source Han Sans SC", "Hiragino Sans GB", sans-serif';

// ── 标题段 ────────────────────────────────────────────────────────────

/** 画面缩放 S（原片第 k 帧）。0–2 帧是一片暗棕，量不出来，按 3–6 帧的趋势往前补 */
const CAM_K = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 28, 30, 32, 34, 36, 38, 40, 42, 44, 46, 48, 50, 52, 54, 56, 58];
const CAM_S = [2.45, 2.35, 2.24, 2.1, 1.973, 1.89, 1.829, 1.79, 1.754, 1.721, 1.673, 1.641, 1.611, 1.585, 1.558, 1.53, 1.506, 1.484, 1.461, 1.441, 1.415, 1.396, 1.376, 1.361, 1.337, 1.321, 1.302, 1.271, 1.241, 1.217, 1.193, 1.171, 1.148, 1.127, 1.109, 1.092, 1.077, 1.061, 1.044, 1.033, 1.027, 1.013, 1.0];

/**
 * 背景从暗棕里渐显：画面 = (1−a)·暗棕 + a·背景，同时由虚变实。
 * 原片是分层的：前景的手和卡片亮得早（36 帧全亮），后面的法庭 24 帧以后才慢慢亮出来（52 帧全亮）。
 * 一张图只能取一条曲线：取两层逐帧拟合结果的平均。
 */
const FADE_K = [0, 4, 8, 12, 16, 20, 24, 28, 32, 36, 40, 48, 52];
const FADE_A = [0, 0.02, 0.05, 0.1, 0.18, 0.29, 0.4, 0.58, 0.78, 0.9, 0.94, 0.98, 1];
const FADE_COLOR = '#352107';

/** 背景虚化（高斯 σ，画面像素）：法庭后墙比这更虚，前景的手几乎是实的，一张图取中间 */
const BLUR_K = [0, 12, 24, 30, 36, 44, 50, 56];
const BLUR_S = [12, 9, 7, 5.5, 4, 2, 1, 0];

/**
 * 大标题自己还有一点景深和漂移（单独追踪标题层量的，相对第 56 帧）：
 * 前半段更虚（σ 从 4 降到 0），位置比背景偏右下几像素，40 帧前后归位。
 */
const TITLE_BLUR_K = [0, 16, 26, 34, 40, 44];
const TITLE_BLUR_S = [4, 3, 2.5, 1.5, 0.8, 0];
/** 原片是视频画面，停住以后字边也比浏览器渲染的软一点 */
const TITLE_SOFT = 0.8;
const TITLE_DRIFT_K = [0, 20, 30, 36, 40];
const TITLE_DRIFT_X = [10, 8, 4, 2, 0];
const TITLE_DRIFT_Y = [14, 12, 4, 0, 0];

/** 大标题逐字浮现的开始帧（原片 10 个字：苹 果 状 告 O p e n A I） */
const GLYPH_START = [3, 5, 8, 15, 15, 15, 15, 24, 24, 24];
const GLYPH_FADE = 5;

/**
 * 标题实测位置（第 56 帧，S≈1）：汉字 y 288–409、宽 101（竖向拉长 1.28 倍），左右中心 632.5；
 * 英文大写 y 300–400，比汉字矮一截、底边高 12px，字宽略压窄。
 */
const TITLE = { cx: 632.5, cy: 340, size: 101, stretchY: 1.283, latinScale: 0.968, latinSqueeze: 0.967, latinLift: -2.8 };
/** 英文小字：大写字母高 15px，字距很宽，中心 (622.5, 474) */
const SUBTITLE = { cx: 622.5, cy: 474, size: 21.5, tracking: 13.5 };

// ── 新闻稿 ────────────────────────────────────────────────────────────

/** 新闻稿拉远：第 59 帧起的缩放（第 64–112 帧实测，59–63 按斜率外推），不动点 (786, 406) */
const ART_T = [0, 5, 7, 9, 11, 13, 15, 17, 19, 21, 23, 25, 27, 29, 31, 33, 35, 37, 39, 41, 43, 45, 47, 49, 51, 53];
const ART_S = [1.126, 1.1085, 1.1021, 1.0946, 1.0877, 1.0815, 1.0756, 1.0698, 1.0646, 1.0594, 1.0546, 1.0499, 1.0455, 1.0411, 1.0371, 1.033, 1.0292, 1.0255, 1.022, 1.0185, 1.0152, 1.0119, 1.0088, 1.0057, 1.0029, 1.0];
const ART_FIXED = { x: 786, y: 406 };

/** 推近段逐帧实测（第 113–149 帧）：缩放和画面中心对准的新闻稿坐标 */
const PUNCH_S = [2.0073, 2.0044, 2.001, 1.9983, 1.9957, 1.9932, 1.9907, 1.9881, 1.9856, 1.9831, 1.9807, 1.9784, 1.9761, 1.9735, 1.9712, 1.9691, 1.9669, 1.9647, 1.9626, 1.9604, 1.9583, 1.9562, 1.9541, 1.9521, 1.95, 1.9482, 1.9461, 1.9441, 1.9422, 1.9404, 1.9385, 1.9367, 1.935, 1.9331, 1.9315, 1.9298, 1.9279];
const PUNCH_X = [643.0, 642.9, 642.8, 642.7, 642.7, 642.7, 642.6, 642.7, 642.6, 642.6, 642.7, 642.6, 642.7, 642.7, 642.7, 642.7, 642.8, 642.8, 642.9, 643.0, 643.1, 643.1, 643.2, 643.3, 643.4, 643.5, 643.5, 643.7, 643.8, 643.9, 644.0, 644.1, 644.3, 644.4, 644.5, 644.6, 644.8];
const PUNCH_Y = [560.4, 548.2, 539.5, 532.8, 527.2, 522.7, 518.6, 514.8, 511.2, 508.3, 505.9, 503.7, 501.8, 500.1, 498.4, 497.2, 495.8, 494.7, 493.6, 492.9, 492.1, 491.4, 491.0, 490.5, 490.0, 489.7, 489.7, 489.5, 489.6, 489.5, 489.7, 489.8, 489.8, 489.9, 490.1, 490.2, 490.2];

/** 新闻标题：64px 粗宋体，行距 77，第一行字心 y=148.5，左边 58 */
export const HEADLINE = { left: 58, firstCenter: 147.5, size: 64.6, lineHeight: 77 };
/** 正文：32.5px 黑体，行距 53.3，段间多空 4px，首行字心 y=333.5，左边 46，右边 1250；左对齐，首行缩进 2.25 字 */
export const BODY = { left: 46, right: 1250, firstCenter: 333.5, size: 32.5, lineHeight: 53.3, paragraphGap: 4, indent: 2.25 };

/**
 * 正文逐行从左往右淡入（按原片每 100px 一格量的对比度）：
 * 一行扫完 6 帧，下一行接着扫（每行间隔 6.5 帧）；第一段转场后 2 帧开始，之后每段晚 6 帧。
 * 下面的时间都是「这个字亮到一半」的时刻，单个字从暗到亮 9 帧。
 */
const LINE_SWEEP = 6;
const LINE_STEP = 6.5;
const PARAGRAPH_START = 2;
const PARAGRAPH_STEP = 6;
const CHAR_FADE = 9;
/** 字边缘柔化（画面像素） */
const SOFTEN = 0.55;
/** 划线：整条路径一口气画完，先快后慢（1−(1−u)^2.2），用时 17 帧 */
const UNDERLINE_FRAMES = 17;
const UNDERLINE_POWER = 2.2;

const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;
const ease = Easing.out(Easing.cubic);

function curve(t: number, ks: number[], vs: number[]): number {
  return interpolate(t, ks, vs, clamp);
}

/** 按原片 10 个字的节奏，把第 i 个字（共 n 个）的浮现时间插值出来 */
export function glyphStart(i: number, n: number): number {
  if (n <= 1) return GLYPH_START[0]!;
  const pos = (i / (n - 1)) * (GLYPH_START.length - 1);
  const lo = Math.floor(pos);
  const hi = Math.min(GLYPH_START.length - 1, lo + 1);
  const w = pos - lo;
  return GLYPH_START[lo]! * (1 - w) + GLYPH_START[hi]! * w;
}

const isLatin = (ch: string) => /[A-Za-z0-9]/.test(ch);

// ── 组件 ──────────────────────────────────────────────────────────────

export const NewsHeadline: React.FC<NewsHeadlineProps> = (props) => {
  const frame = useCurrentFrame();
  const { wipeAt, punchAt } = props;
  const wipeEnd = wipeAt + 11;
  const layout = useMemo(() => layoutBody(props.paragraphs, BODY, SANS), [props.paragraphs]);
  const mask = useInkMask(frame >= wipeAt - 1 && frame < wipeEnd ? frame - wipeAt : null);

  return (
    <AbsoluteFill style={{ backgroundColor: '#161616', overflow: 'hidden' }}>
      {frame >= wipeAt - 1 && <Article {...props} frame={frame} layout={layout} />}
      {frame < wipeEnd && (
        <TitleScene
          {...props}
          frame={frame}
          mask={mask}
        />
      )}
    </AbsoluteFill>
  );
};

/**
 * CSS 遮罩的图片是浏览器异步解码的，导出时可能截到还没套上遮罩的那一帧。
 * 先用 Image 解码好、再放行渲染（delayRender），套上时就是现成的。
 */
function useInkMask(rel: number | null): string | null {
  const url = useMemo(() => (rel === null ? null : inkMaskUrl(rel)), [rel]);
  const [ready, setReady] = useState<string | null>(null);
  useLayoutEffect(() => {
    if (!url) return;
    const handle = delayRender('墨迹遮罩');
    const img = new Image();
    img.src = url;
    img.decode().then(
      () => { setReady(url); continueRender(handle); },
      () => { setReady(url); continueRender(handle); },
    );
  }, [url]);
  if (!url) return null;
  // 新的还没解码好时先用上一帧的（预览里一闪而过；导出会等 continueRender，不会截到这一刻）
  return ready === url ? url : ready ?? url;
}

// ── 标题段 ────────────────────────────────────────────────────────────

const TitleScene: React.FC<NewsHeadlineProps & { frame: number; mask: string | null }> = (p) => {
  // 标题段时间按 titleSpeed 伸缩，曲线都按原片帧号查
  const t = p.frame / p.titleSpeed;
  const S = curve(t, CAM_K, CAM_S);
  const a = curve(t, FADE_K, FADE_A);
  const sigma = curve(t, BLUR_K, BLUR_S) / S; // 实测是画面上的 σ，舞台被放大了 S 倍
  const margin = Math.ceil(sigma * 3);
  const glyphs = Array.from(p.title);
  const maskStyle: React.CSSProperties = p.mask
    ? { WebkitMaskImage: `url(${p.mask})`, maskImage: `url(${p.mask})`, WebkitMaskSize: '100% 100%', maskSize: '100% 100%' }
    : {};

  return (
    <AbsoluteFill style={{ ...maskStyle }}>
      <AbsoluteFill style={{ transformOrigin: '640px 0px', transform: `scale(${S})` }}>
        {/* 背景：虚化时四周往外多铺一圈，免得边缘被模糊成黑边 */}
        <Img
          src={assetUrl(p.image)}
          style={{
            position: 'absolute',
            left: -margin,
            top: -margin,
            width: 1280 + margin * 2,
            height: 720 + margin * 2,
            objectFit: 'cover',
            filter: sigma > 0.05 ? `blur(${sigma.toFixed(2)}px)` : undefined,
          }}
        />
        <AbsoluteFill style={{ backgroundColor: FADE_COLOR, opacity: 1 - a }} />

        {/* 大标题：汉字 101px 竖向拉长，英文放大再压窄（原片英文和汉字一样高） */}
        <div
          style={{
            position: 'absolute',
            left: 0,
            width: 1280,
            top: TITLE.cy - TITLE.size / 2,
            height: TITLE.size,
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            transform: `translate(${TITLE.cx - 640 + curve(t, TITLE_DRIFT_K, TITLE_DRIFT_X) / S}px, ${curve(t, TITLE_DRIFT_K, TITLE_DRIFT_Y) / S}px) scaleY(${TITLE.stretchY})`,
            filter: `blur(${((curve(t, TITLE_BLUR_K, TITLE_BLUR_S) + TITLE_SOFT) / S).toFixed(2)}px) drop-shadow(0px 0px 18px rgba(0,0,0,0.75))`,
            fontFamily: SERIF,
            fontWeight: 900,
            fontSize: TITLE.size,
            lineHeight: 1,
            whiteSpace: 'pre',
          }}
        >
          {glyphs.map((ch, i) => {
            const start = glyphStart(i, glyphs.length);
            const q = ease(interpolate(t, [start, start + GLYPH_FADE], [0, 1], clamp));
            const latin = isLatin(ch);
            const size = latin ? TITLE.size * TITLE.latinScale : TITLE.size;
            const w = latin ? measure(ch, `900 ${size}px ${SERIF}`) * TITLE.latinSqueeze : undefined;
            return (
              <span
                key={i}
                style={{
                  display: 'inline-block',
                  width: w,
                  opacity: q,
                  filter: q < 1 ? `blur(${((1 - q) * 10).toFixed(2)}px)` : undefined,
                }}
              >
                <span
                  style={{
                    display: 'inline-block',
                    fontSize: size,
                    transform: latin ? `translateY(${TITLE.latinLift}px) scaleX(${TITLE.latinSqueeze})` : undefined,
                    transformOrigin: '0 50%',
                    backgroundImage: `linear-gradient(to bottom, ${p.titleColor[0]} 20%, ${p.titleColor[1]} 85%)`,
                    WebkitBackgroundClip: 'text',
                    backgroundClip: 'text',
                    color: 'transparent',
                  }}
                >
                  {ch}
                </span>
              </span>
            );
          })}
        </div>

        {/* 英文小字：和大标题最后一组字一起淡入 */}
        <div
          style={{
            position: 'absolute',
            left: 0,
            width: 1280,
            top: SUBTITLE.cy - SUBTITLE.size,
            height: SUBTITLE.size * 2,
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            transform: `translate(${SUBTITLE.cx - 640 + SUBTITLE.tracking / 2 + curve(t, TITLE_DRIFT_K, TITLE_DRIFT_X) / S}px, ${curve(t, TITLE_DRIFT_K, TITLE_DRIFT_Y) / S}px)`,
            fontFamily: SERIF,
            fontWeight: 900,
            fontSize: SUBTITLE.size,
            letterSpacing: SUBTITLE.tracking,
            color: p.titleColor[1],
            opacity: interpolate(t, [12, 20], [0, 1], clamp),
            whiteSpace: 'pre',
            filter: `blur(${((curve(t, TITLE_BLUR_K, TITLE_BLUR_S) + TITLE_SOFT) / S).toFixed(2)}px) drop-shadow(0px 0px 6px rgba(0,0,0,0.8))`,
          }}
        >
          {p.subtitle}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// ── 新闻稿 ────────────────────────────────────────────────────────────

function articleTransform(p: NewsHeadlineProps, frame: number): { s: number; tx: number; ty: number } {
  if (frame < p.punchAt || p.punchAt >= p.durationInFrames) {
    // 原片从转场到推近是 54 帧；推近时间改了，拉远就按比例伸缩，保证推近前正好停在 1 倍
    const span = Math.max(1, p.punchAt - 1 - p.wipeAt);
    const t = ((frame - p.wipeAt) / span) * 53;
    const s = curve(t, ART_T, ART_S);
    return { s, tx: (1 - s) * ART_FIXED.x, ty: (1 - s) * ART_FIXED.y };
  }
  const n = PUNCH_S.length - 1;
  const t = frame - p.punchAt;
  const k = p.punchScale / PUNCH_S[0]!;
  let s: number;
  let cx: number;
  let cy: number;
  if (t <= n) {
    s = curve(t, PUNCH_S.map((_, i) => i), PUNCH_S);
    cx = curve(t, PUNCH_X.map((_, i) => i), PUNCH_X);
    cy = curve(t, PUNCH_Y.map((_, i) => i), PUNCH_Y);
  } else {
    // 原片到这里就结束了；再往后按最后的速度继续极慢地拉远，慢慢停住
    const v = PUNCH_S[n]! - PUNCH_S[n - 1]!;
    const extra = t - n;
    s = PUNCH_S[n]! + v * (1 - 0.97 ** extra) / (1 - 0.97);
    cx = PUNCH_X[n]!;
    cy = PUNCH_Y[n]!;
  }
  s *= k;
  cx += p.punchX - PUNCH_X[n]!;
  cy += p.punchY - PUNCH_Y[n]!;
  return { s, tx: 640 - s * cx, ty: 360 - s * cy };
}

const Article: React.FC<NewsHeadlineProps & { frame: number; layout: BodyLayout }> = (p) => {
  const { s, tx, ty } = articleTransform(p, p.frame);
  const rel = p.frame - p.wipeAt;
  const goldGradient = `linear-gradient(to bottom, ${p.goldColor[0]} 25%, ${p.goldColor[1]} 90%)`;

  return (
    <AbsoluteFill>
      {/* 底：深灰，从左往右渐亮（左边 16 → 右边 37，最右又暗一点）；屏幕坐标，不跟着新闻稿缩放 */}
      <AbsoluteFill
        style={{
          background: 'linear-gradient(to right, #100f10 0%, #161516 12%, #1a191a 37%, #1e1d1e 56%, #222021 75%, #252324 86%, #211f20 100%)',
        }}
      />
      {/* 原片是视频里的字，边缘比浏览器渲染的软一点 */}
      <AbsoluteFill style={{ transformOrigin: '0 0', transform: `translate(${tx}px, ${ty}px) scale(${s})`, filter: `blur(${(SOFTEN / s).toFixed(3)}px)` }}>
        {p.headline.map((line, i) => (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: HEADLINE.left,
              top: HEADLINE.firstCenter + i * HEADLINE.lineHeight - HEADLINE.lineHeight / 2 - HEADLINE.size * 0.05,
              height: HEADLINE.lineHeight,
              lineHeight: `${HEADLINE.lineHeight}px`,
              fontFamily: SERIF,
              fontWeight: 900,
              fontSize: HEADLINE.size,
              // 标点用窄的（原片冒号、引号都只占半个字）
              fontFeatureSettings: '"palt"',
              whiteSpace: 'pre',
              filter: 'drop-shadow(0px 2px 6px rgba(0,0,0,0.6))',
            }}
          >
            {splitGold(line, p.headlineGold).map((seg, j) => (
              <span
                key={j}
                style={
                  seg.gold
                    ? { backgroundImage: goldGradient, WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' }
                    : { color: p.whiteColor }
                }
              >
                {seg.text}
              </span>
            ))}
          </div>
        ))}

        {p.layout.chars.map((c, i) => (
          <BodyGlyph key={i} c={c} rel={rel} color={c.highlight ? p.accentColor : p.bodyColor} />
        ))}

        <svg width={1280} height={720} style={{ position: 'absolute', left: 0, top: 0, overflow: 'visible' }}>
          {p.layout.underlines.map((u, i) => {
            const start = p.paragraphs[u.paragraph]?.underlineAt ?? Infinity;
            const x = interpolate(p.frame, [start, start + UNDERLINE_FRAMES], [0, 1], clamp);
            const progress = 1 - (1 - x) ** UNDERLINE_POWER;
            if (progress <= 0) return null;
            return <path key={i} d={underlinePath(u.x0, u.x1, u.center, progress)} fill={p.accentColor} />;
          })}
        </svg>
      </AbsoluteFill>
      {/* 暗角压在所有东西上面：画面中上最亮，四周压暗到七成（原片左边、右边的字都比中间暗一截） */}
      <AbsoluteFill
        style={{
          background: 'radial-gradient(ellipse 760px 400px at 640px 300px, rgba(0,0,0,0) 35%, rgba(0,0,0,0.3) 100%)',
        }}
      />
    </AbsoluteFill>
  );
};

const BodyGlyph: React.FC<{ c: BodyChar; rel: number; color: string }> = ({ c, rel, color }) => {
  const half = PARAGRAPH_START + PARAGRAPH_STEP * c.paragraph + LINE_STEP * c.line + LINE_SWEEP * ((c.x - BODY.left) / (BODY.right - BODY.left));
  const q = Easing.inOut(Easing.sin)(interpolate(rel, [half - CHAR_FADE / 2, half + CHAR_FADE / 2], [0, 1], clamp));
  if (q <= 0) return null;
  return (
    <span
      style={{
        position: 'absolute',
        left: c.x,
        top: c.center - BODY.lineHeight / 2 - BODY.size * 0.05,
        lineHeight: `${BODY.lineHeight}px`,
        fontFamily: SANS,
        fontSize: BODY.size,
        fontWeight: 400,
        color,
        opacity: q,
        whiteSpace: 'pre',
      }}
    >
      {c.ch}
    </span>
  );
};

function splitGold(line: string, gold: string[]): { text: string; gold: boolean }[] {
  const words = gold.map((g) => g.trim()).filter(Boolean);
  const out: { text: string; gold: boolean }[] = [];
  let rest = line;
  while (rest) {
    let best: { at: number; word: string } | null = null;
    for (const w of words) {
      const at = rest.indexOf(w);
      if (at >= 0 && (!best || at < best.at)) best = { at, word: w };
    }
    if (!best) {
      out.push({ text: rest, gold: false });
      break;
    }
    if (best.at > 0) out.push({ text: rest.slice(0, best.at), gold: false });
    out.push({ text: best.word, gold: true });
    rest = rest.slice(best.at + best.word.length);
  }
  return out;
}

/**
 * 手绘划线：一笔往右画过重点句，稍微冲出去一点，折回来在下面再画一笔，停在全长四成的地方。
 * 形状照第 112 帧的两条线量的：第一笔在字心下方 17–21px、中间略拱，第二笔再低 8px，笔尾变细。
 * 画成填充的多边形（线宽沿路径变化），progress 0–1 表示画到哪。
 */
export function underlinePath(x0: number, x1: number, center: number, progress: number): string {
  const L = Math.max(10, x1 - x0);
  const yA = center + 20;
  const pts: [number, number][] = [];
  const N = 90;
  // 第一笔：x0 → x1 + 2%，中间拱起 4px
  for (let i = 0; i <= N; i++) {
    const u = i / N;
    pts.push([x0 + u * L * 1.02, yA - 4 * Math.sin(Math.PI * u) + 1.5 * u]);
  }
  // 折返：一个小弯
  const turnX = x0 + L * 1.02;
  for (let i = 1; i <= 12; i++) {
    const u = i / 12;
    pts.push([turnX + 0.035 * L * Math.sin(Math.PI * u) * 0.6, yA + 1.5 + 6 * u]);
  }
  // 第二笔：往回到 0.4L，微微下沉
  const endX = x0 + 0.4 * L;
  for (let i = 1; i <= N; i++) {
    const u = i / N;
    pts.push([turnX - u * (turnX - endX), yA + 7.5 - 2.5 * Math.sin(Math.PI * u) + 3 * u * u]);
  }
  // 按弧长截到 progress
  const acc = [0];
  for (let i = 1; i < pts.length; i++) {
    acc.push(acc[i - 1]! + Math.hypot(pts[i]![0] - pts[i - 1]![0], pts[i]![1] - pts[i - 1]![1]));
  }
  const total = acc[acc.length - 1]!;
  const limit = total * Math.min(1, progress);
  const width = (d: number) => {
    const u = d / total;
    const head = Math.min(1, d / 6);
    const tail = Math.min(1, (1 - u) / 0.22);
    return 0.95 * head * (0.35 + 0.65 * tail) + 0.2;
  };
  const left: [number, number][] = [];
  const right: [number, number][] = [];
  for (let i = 0; i < pts.length && acc[i]! <= limit; i++) {
    const a = pts[Math.max(0, i - 1)]!;
    const b = pts[Math.min(pts.length - 1, i + 1)]!;
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len;
    const ny = dx / len;
    const w = width(acc[i]!);
    const [x, y] = pts[i]!;
    left.push([x + nx * w, y + ny * w]);
    right.push([x - nx * w, y - ny * w]);
  }
  if (left.length < 2) return '';
  const all = [...left, ...right.reverse()];
  return `M${all.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join('L')}Z`;
}
