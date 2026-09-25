import React, { useMemo } from 'react';
import { AbsoluteFill, Easing, Img, interpolate, useCurrentFrame } from 'remotion';
import { bundledUrl } from '../asset';
import { Media } from '../media';
import { layoutBody, measure, type BodyChar } from '../text-layout';

/**
 * 复刻：网页新闻截图 —— 正文滚动、一句话被黑底黄字标出来、镜头推进去 → 配图压下来 → 英文标题刷黑、中文翻译（219 帧，1280×720 @30fps）
 *
 * ── 正文（0–51）─────────────────────────────────────────────────────
 *   白底网页正文：灰色黑体、每字 36px、行距 70、段间多空 60，左边 80，右边超出画面；中间一个蓝色小标题（前后多空一些）
 *   整页往下滚，一开始很快（每帧 59px），越来越慢（第 51 帧每帧 7px）——逐帧对比行位置量的
 *   第 32 帧起，重点句垫上黑条、字变黄：黑条从一条细线撑开到整行高，同时从左往右铺开（都是 12 帧）
 *   景深：画面中间一条是实的，上下越来越虚
 *
 * ── 推近（51–68）───────────────────────────────────────────────────
 *   以黑条为中心推到 2.35 倍（先快后慢），黑条停在画面 y 341
 *
 * ── 配图（88–127）───────────────────────────────────────────────────
 *   配图（1096×616）从画面顶上压下来，把正文往下推；在 y 68 停一下，再继续往下走，露出上面的标题
 *
 * ── 标题（127–）─────────────────────────────────────────────────────
 *   英文标题两行（粗衬线，第一行撑满 1072px），停在 y 273、340；配图在它下面（顶边 y 548）
 *   第一行后面一道黑色干笔刷从左往右刷过去（126–168，先快后慢），被刷到的字变白；第二行 134–146
 *   中文翻译：黑底白字的框（42px 粗宋），从左往右长出来、字跟着出现（136–172）
 *
 * 全片有暗角、划痕、一点红青色差。只复刻画面，底部口播字幕不在模板里。
 */

export type NewsScreenshotProps = {
  paragraphs: string[];
  heading: string;
  /** 标题插在第几段前面（从 0 数） */
  headingBefore: number;
  highlight: string;
  highlightColor: string;
  photo: string;
  headline: string[];
  translation: string;
  highlightAt: number;
  zoomAt: number;
  photoAt: number;
  durationInFrames: number;
};

const SANS = '"PingFang SC", "Noto Sans CJK SC", "Source Han Sans SC", "Hiragino Sans GB", sans-serif';
const SERIF = '"Georgia", "Times New Roman", "Noto Serif CJK SC", serif';
const CN_SERIF = '"Songti SC", "STSong", "Noto Serif CJK SC", serif';

/** 每个字占 36px（34px 字 + 2px 字距），和原片一样 */
export const BODY = { left: 80, right: 1520, firstCenter: 0, size: 34, lineHeight: 70, paragraphGap: 60, indent: 0, letterSpacing: 2 };
/** 滚动速度（每帧往下多少 px），第 4–51 帧实测；第 0–3 帧是上一个镜头的叠化，按 60 算 */
const SPEED = [60, 60, 60, 60, 59, 59, 53, 48, 45, 41, 39, 36, 34, 32, 30, 29, 27, 26, 25, 24, 23, 22, 21, 20, 19, 19, 18, 17, 16, 16, 15, 15, 14, 14, 13, 13, 12, 12, 11, 11, 10, 10, 10, 9, 9, 9, 8, 8, 8, 7, 7, 7];
/** 第 44 帧时重点句的行心在画面 y 204 */
const HIGHLIGHT_Y_AT_44 = 204;
const ZOOM = { to: 2.35, frames: 17, fixX: 612.6, fixY: 182.6 };
const BAR = { grow: 12, wipe: 12, height: 43, pad: 6 };

/** 配图顶边（画面 y），相对 photoAt（原片 88） */
const PHOTO_T = [0, 4, 8, 12, 16, 22, 28, 34, 38, 39, 40, 42, 46, 50, 62, 76, 102, 131];
const PHOTO_Y = [-640, -575, -520, -423, -208, 68, 68, 148, 208, 290, 392, 444, 488, 520, 537, 548, 542, 530];
const PHOTO = { left: 80, width: 1096, height: 616 };
/** 标题各行相对配图顶边的位置 */
/** 英文标题第一行撑满 1072px（按实际字体量出字号，最大 60） */
const HEAD = { line1: -274.5, line2: -208, box: -145, width: 1072, maxSize: 60, boxHeight: 61, boxLeft: 68, cnSize: 42 };
/** 相对 photoAt：第一行刷 40–84，第二行 50–62，翻译 52–84 */
const T = { brush1: [38, 80], brush2: [46, 58], box: [48, 84] } as const;

const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;

/** 从第 0 帧到第 frame 帧一共往下滚了多少 */
export function scrolled(frame: number): number {
  let y = 0;
  const f = Math.max(0, frame);
  for (let i = 0; i < Math.floor(f); i++) y += SPEED[Math.min(i, SPEED.length - 1)]!;
  return y + (f - Math.floor(f)) * SPEED[Math.min(Math.floor(f), SPEED.length - 1)]!;
}

export const NewsScreenshot: React.FC<NewsScreenshotProps> = (p) => {
  const frame = useCurrentFrame();
  const layout = useMemo(() => {
    const paras = p.paragraphs.map((text) => ({ text, highlight: p.highlight && text.includes(p.highlight) ? p.highlight : '' }));
    return layoutBody(paras, BODY, SANS);
  }, [p.paragraphs, p.highlight]);
  const hl = layout.chars.filter((c) => c.highlight);
  const hlCenter = hl[0]?.center ?? 0;
  const hlX0 = hl[0]?.x ?? 0;
  const hlX1 = hl.length ? hl[hl.length - 1]!.x + hl[hl.length - 1]!.width : 0;
  // 小标题插进去：它下面的段落整体往下挪
  const headingShift = p.heading ? 105 : 0;
  const headingPara = Math.min(Math.max(0, p.headingBefore), p.paragraphs.length);
  const firstOfHeadingPara = layout.chars.find((c) => c.paragraph === headingPara);
  // 小标题的字心在它下面那段第一行上方 95px
  const headingY = firstOfHeadingPara ? firstOfHeadingPara.center + headingShift - 95 : 0;
  const shiftOf = (c: BodyChar) => (c.paragraph >= headingPara ? headingShift : 0);
  const hlShift = hl[0] ? shiftOf(hl[0]) : 0;

  // 正文滚动：第 44 帧时重点句行心在 y 204；推近以后不再滚
  const scrollFrame = Math.min(frame, p.zoomAt);
  const pageY = HIGHLIGHT_Y_AT_44 - (hlCenter + hlShift) + (scrolled(scrollFrame) - scrolled(44));
  const z = Easing.out(Easing.cubic)(interpolate(frame, [p.zoomAt, p.zoomAt + ZOOM.frames], [0, 1], clamp));
  const s = 1 + (ZOOM.to - 1) * z;
  // 推近以后黑条停在 y 341：把页面补到这个位置
  const barScreenAtZoom = hlCenter + hlShift + pageY;
  const settle = (341 - ((barScreenAtZoom - ZOOM.fixY) * ZOOM.to + ZOOM.fixY)) * z;

  const tp = frame - p.photoAt;
  const photoTop = interpolate(tp, PHOTO_T, PHOTO_Y, clamp);
  const push = Math.max(0, photoTop + PHOTO.height - 21);
  const articleCam = `translate(0px, ${settle + push}px) translate(${ZOOM.fixX}px, ${ZOOM.fixY}px) scale(${s}) translate(${-ZOOM.fixX}px, ${-ZOOM.fixY}px)`;

  // 景深：实的那一条在画面中间；推近以后变宽（原片推近后下一行也是实的）
  const focusBand = `linear-gradient(to bottom, transparent ${8 - 6 * z}%, #000 ${30 - 8 * z}%, #000 ${62 + 16 * z}%, transparent ${85 + 12 * z}%)`;
  const barH = BAR.height * Easing.out(Easing.cubic)(interpolate(frame, [p.highlightAt, p.highlightAt + BAR.grow], [0, 1], clamp));
  const barW = Easing.out(Easing.quad)(interpolate(frame, [p.highlightAt, p.highlightAt + BAR.wipe], [0, 1], clamp));
  const barOn = frame >= p.highlightAt;

  const article = (
    <div style={{ position: 'absolute', left: 0, top: 0, width: 1280, height: 720, transform: `translateY(${pageY}px)` }}>
      {p.heading && (
        <div style={{ position: 'absolute', left: BODY.left, top: headingY - 25, height: 50, lineHeight: '50px', fontFamily: SANS, fontWeight: 600, fontSize: 38, color: '#446bab', whiteSpace: 'pre' }}>{p.heading}</div>
      )}
      {barOn && hl.length > 0 && (
        <div
          style={{
            position: 'absolute', left: hlX0 - BAR.pad, top: hlCenter + hlShift - barH / 2, width: (hlX1 - hlX0 + BAR.pad * 2) * barW, height: barH,
            backgroundColor: '#0b0b0b',
          }}
        />
      )}
      {layout.chars.map((c, i) => {
        const lit = c.highlight && barOn && c.x - hlX0 <= (hlX1 - hlX0) * barW;
        return (
          <span
            key={i}
            style={{
              position: 'absolute', left: c.x, top: c.center + shiftOf(c) - BODY.lineHeight / 2 - BODY.size * 0.05, lineHeight: `${BODY.lineHeight}px`,
              fontFamily: SANS, fontSize: BODY.size, color: lit ? p.highlightColor : '#46474a', fontWeight: lit ? 500 : 400, whiteSpace: 'pre',
            }}
          >
            {c.ch}
          </span>
        );
      })}
    </div>
  );

  return (
    <AbsoluteFill style={{ backgroundColor: '#fff', overflow: 'hidden' }}>
      {/* 正文：同一页画两遍，一遍虚的垫底，一遍实的只露出中间那条 */}
      {tp < 42 && (
        <AbsoluteFill style={{ transformOrigin: '0 0', transform: articleCam }}>
          <AbsoluteFill style={{ filter: 'blur(3px)' }}>{article}</AbsoluteFill>
        </AbsoluteFill>
      )}
      {tp < 42 && (
        <AbsoluteFill style={{ WebkitMaskImage: focusBand, maskImage: focusBand }}>
          <AbsoluteFill style={{ transformOrigin: '0 0', transform: articleCam }}>{article}</AbsoluteFill>
        </AbsoluteFill>
      )}

      {tp >= 0 && <HeadlinePage p={p} photoTop={photoTop} tp={tp} />}

      {/* 暗角 + 划痕 + 一点色差 */}
      <AbsoluteFill style={{ background: 'radial-gradient(ellipse 70% 72% at 50% 48%, rgba(0,0,0,0) 50%, rgba(20,20,20,0.35) 80%, rgba(10,10,10,0.75) 100%)' }} />
      <Img src={bundledUrl('doc-highlight/scratches.png')} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0.45 }} />
    </AbsoluteFill>
  );
};

/** 配图 + 上面的英文标题、中文翻译（一起跟着配图的位置走） */
const HeadlinePage: React.FC<{ p: NewsScreenshotProps; photoTop: number; tp: number }> = ({ p, photoTop, tp }) => {
  const b1 = Easing.out(Easing.quad)(interpolate(tp, T.brush1, [0, 1], clamp));
  const b2 = Easing.out(Easing.quad)(interpolate(tp, T.brush2, [0, 1], clamp));
  const box = Easing.out(Easing.cubic)(interpolate(tp, T.box, [0, 1], clamp));
  const lines = p.headline.slice(0, 2);
  const tops = [photoTop + HEAD.line1, photoTop + HEAD.line2];
  const size = Math.min(HEAD.maxSize, (100 * HEAD.width) / Math.max(1, measure(lines[0] ?? ' ', `700 100px ${SERIF}`)));
  const boxFont = `700 ${HEAD.cnSize}px ${CN_SERIF}`;
  const boxW = measure(p.translation, boxFont) + 24;
  const shownChars = Math.round(Array.from(p.translation).length * box);
  return (
    <AbsoluteFill style={{ filter: 'drop-shadow(-1.5px 0 0 rgba(220,40,40,0.35)) drop-shadow(1.5px 0 0 rgba(40,170,230,0.3))' }}>
      {/* 标题所在的网页：白底，配图上面 */}
      <div style={{ position: 'absolute', left: 0, top: photoTop - 720, width: 1280, height: 720, backgroundColor: '#fbfbfb' }} />
      {lines.map((line, i) => {
        const prog = i === 0 ? b1 : b2;
        const w = measure(line, `700 ${size}px ${SERIF}`);
        const brushW = (w + 36) * prog;
        const top = tops[i]! - 33;
        const textStyle: React.CSSProperties = { position: 'absolute', left: 78, top, height: 66, lineHeight: '66px', fontFamily: SERIF, fontWeight: 700, fontSize: size, whiteSpace: 'pre' };
        return (
          <React.Fragment key={i}>
            <div style={{ ...textStyle, color: '#1b1b1b' }}>{line}</div>
            {prog > 0 && (
              <>
                <div
                  style={{
                    position: 'absolute', left: 62, top: top - 2, width: brushW, height: 70, backgroundColor: '#0c0c0c',
                    WebkitMaskImage: `url(${bundledUrl('news-screenshot/brush.png')})`, maskImage: `url(${bundledUrl('news-screenshot/brush.png')})`,
                    WebkitMaskSize: `${w + 36}px 70px`, maskSize: `${w + 36}px 70px`, WebkitMaskRepeat: 'no-repeat', maskRepeat: 'no-repeat',
                  }}
                />
                <div style={{ ...textStyle, color: '#f4f4f4', clipPath: `inset(0 ${Math.max(0, w + 16 - brushW)}px 0 0)` }}>{line}</div>
              </>
            )}
          </React.Fragment>
        );
      })}
      <div style={{ position: 'absolute', left: 80, top: photoTop + HEAD.box - 22, fontFamily: SERIF, fontSize: 12, color: '#9a8a5a', whiteSpace: 'pre' }}>Technology · 19:12, 18-Jan-2024</div>
      {[1070, 1150].map((x) => (
        <div key={x} style={{ position: 'absolute', left: x - 11, top: photoTop + HEAD.box + 20, width: 22, height: 22, borderRadius: '50%', border: '2px solid #9a9a9a' }} />
      ))}
      {box > 0 && p.translation && (
        <div style={{ position: 'absolute', left: HEAD.boxLeft, top: photoTop + HEAD.box, width: boxW * box, height: HEAD.boxHeight, backgroundColor: '#111', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', left: 12, top: 0, lineHeight: `${HEAD.boxHeight}px`, fontFamily: CN_SERIF, fontWeight: 700, fontSize: HEAD.cnSize, color: '#f1f1f1', whiteSpace: 'pre' }}>
            {Array.from(p.translation).slice(0, shownChars).join('')}
          </div>
        </div>
      )}
      <div style={{ position: 'absolute', left: 80, top: photoTop - 36, width: 1100, height: 1.5, backgroundColor: '#e2e2e2' }} />
      <div style={{ position: 'absolute', left: PHOTO.left, top: photoTop, width: PHOTO.width, height: PHOTO.height, overflow: 'hidden', boxShadow: '0 -2px 0 rgba(120,150,220,0.35)' }}>
        <Media src={p.photo} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />
      </div>
    </AbsoluteFill>
  );
};
