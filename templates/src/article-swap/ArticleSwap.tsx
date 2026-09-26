import React from 'react';
import { AbsoluteFill, interpolate, useCurrentFrame } from 'remotion';
import { EdgeBlur, vignetteGradient } from '../lens';
import { layoutBody, type BodyBox } from '../text-layout';

/**
 * 复刻：深蓝网点底上一篇「文章」：标题一个字一个字打出来、后半截压着米黄色高亮条，下面英文小标题、正文一行行扫出来；
 * 然后第二篇文章从很大很虚的样子缩回来盖上去，第一篇缩小淡掉（97 帧，1280×720 @30fps）
 *
 * 按原片量的（文章坐标 = 第二篇在第 80 帧、镜头 1 倍时的画面）：
 *   标题：粗宋 53px，字底 197；前半截白色，后半截深色字压在米黄色条上（条高 68，底边 206，左右各空 6）
 *     标题左 x 176；英文小标题 15px 灰色粗体，y 248；正文 24.2px 浅灰，左 163、右 1080，行距 48.5，首行空两格，第一行字心 y 300
 *   第一篇（相对文章坐标：往左 54、往下 38）：
 *     米黄条先是一条细线（第 0 帧 1.5px 高），第 6–14 帧从底边往上长满；标题从第 1 帧起每帧打一个字（含字母、标点）
 *     英文小标题第 18 帧起、正文第 19 帧起一行接一行从左往右扫出来（每行晚 5.5 帧，9 帧扫完）
 *     镜头：开头往左偏 330，先快后慢移回来（30 帧到位），再慢慢往右 60；第 56 帧起缩小（75 帧 0.78 倍）、变虚、淡掉
 *   第二篇：第 50 帧出现（先淡到半透明，第 78 帧才完全不透明），1.54 倍、有点虚（6px），越缩越快，第 80 帧 1 倍变清楚；之后继续拉远，96 帧 0.897 倍；
 *     第一篇第 66–84 帧变虚淡掉
 *   景深：画面中间 x 460–980 清楚，往左右越来越虚（x 80 以外虚 5px）；背景 5px 的斜网点、四周暗
 * 只复刻画面，底部口播字幕不在模板里。
 */

export type Article = { prefix: string; highlight: string; english: string; body: string[] };

export type ArticleSwapProps = {
  first: Article;
  second: Article;
  swapAt: number;
  durationInFrames: number;
};

const SERIF = '"Noto Serif CJK SC", "Songti SC", "STSong", "Source Han Serif SC", serif';
const SANS = '"Noto Sans CJK SC", "PingFang SC", "Source Han Sans SC", "Hiragino Sans GB", sans-serif';
const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;

export const PAGE = {
  titleLeft: 176, titleBase: 197, titleSize: 53, barH: 68, barBottom: 206, barPad: 6,
  englishY: 248, englishSize: 15,
  body: { left: 163, right: 1080, firstCenter: 300, size: 24.2, lineHeight: 48.5, paragraphGap: 0, indent: 2 } as BodyBox,
};
/** 第一篇相对文章坐标的摆放 */
export const FIRST = { s: 1, dx: -54, dy: 38 };

const P1_T = [0, 4, 6, 8, 12, 16, 20, 24, 28, 30, 36, 40, 44, 48, 52, 56];
const P1_X = [-330, -276, -238, -203, -150, -105, -68, -36, -10, 0, 27, 40, 49, 55.5, 59.6, 61.5];
const P1_OUT_T = [56, 60, 65, 70, 75];
const P1_OUT_S = [1, 0.9855, 0.959, 0.911, 0.792];
const P2_T = [0, 2, 6, 10, 14, 18, 22, 24, 26, 28, 30, 32, 34, 36, 38, 40, 42, 44, 46];
const P2_S = [1.54, 1.5402, 1.5271, 1.5141, 1.4924, 1.4564, 1.393, 1.3374, 1.2228, 1.0579, 1, 0.9684, 0.9482, 0.9331, 0.922, 0.9132, 0.9062, 0.901, 0.8971];

/** 第一篇的镜头：横移（屏幕像素）和缩放（以画面中心）；换篇前 6 帧开始缩小 */
export function firstCamera(frame: number, swapAt: number) {
  const out = frame - (swapAt + 6);
  const hold = interpolate(frame, [30, 36, 40, 48, 52], [1, 0.9971, 0.995, 0.9915, 0.9877], clamp);
  return {
    dx: interpolate(frame, P1_T, P1_X, clamp),
    s: out <= 0 ? hold : hold * interpolate(out + 56, P1_OUT_T, P1_OUT_S, clamp),
  };
}

/** 第二篇的缩放（以画面中心），从 swapAt 起算 */
export function secondScale(frame: number, swapAt: number): number {
  return interpolate(frame - swapAt, P2_T, P2_S, clamp);
}

/** 米黄条的高度（从底边往上长） */
export function barHeight(t: number): number {
  return interpolate(t, [0, 4, 6, 8, 10, 12, 14, 16, 20], [1.5, 3, 6, 9, 19, 59, 64, 66, PAGE.barH], clamp);
}

/** 标题打到第几个字（字母、标点都算一个） */
export function typedChars(t: number, total: number): number {
  return Math.max(0, Math.min(total, Math.floor(t - 1)));
}

export const ArticleSwap: React.FC<ArticleSwapProps> = (p) => {
  const frame = useCurrentFrame();
  const c1 = firstCamera(frame, p.swapAt);
  const s2 = secondScale(frame, p.swapAt);
  const u2 = frame - p.swapAt;
  const out1 = interpolate(u2, [16, 34], [0, 1], clamp);
  const in2 = interpolate(u2, [0, 6, 20, 28], [0, 0.55, 0.7, 1], clamp);
  const blur2 = interpolate(u2, [0, 20, 26, 29, 31], [6, 4.5, 3, 1, 0], clamp);
  return (
    <AbsoluteFill style={{ backgroundColor: '#04111d', overflow: 'hidden' }}>
      <Backdrop />
      <EdgeBlur cx={720} inner={260} outer={640} blur={5}>
        {out1 < 1 && (
          <AbsoluteFill style={{ opacity: 1 - out1, filter: out1 > 0 ? `blur(${(6 * out1).toFixed(1)}px)` : undefined }}>
            <AbsoluteFill style={{ transformOrigin: '640px 360px', transform: `translateX(${c1.dx.toFixed(1)}px) scale(${c1.s.toFixed(4)})` }}>
              <AbsoluteFill style={{ transformOrigin: '0 0', transform: `translate(${FIRST.dx}px, ${FIRST.dy}px) scale(${FIRST.s})` }}>
                <Page a={p.first} t={frame} typed />
              </AbsoluteFill>
            </AbsoluteFill>
          </AbsoluteFill>
        )}
        {u2 >= 0 && (
          <AbsoluteFill style={{ opacity: in2, filter: blur2 > 0.05 ? `blur(${blur2.toFixed(1)}px)` : undefined }}>
            <AbsoluteFill style={{ transformOrigin: '640px 360px', transform: `translateY(${(19 * (s2 - 1) / 0.54).toFixed(1)}px) scale(${s2.toFixed(4)})` }}>
              <Page a={p.second} t={999} typed={false} />
            </AbsoluteFill>
          </AbsoluteFill>
        )}
      </EdgeBlur>
      <AbsoluteFill style={{ background: vignetteGradient({ cx: 700, cy: 380, rx: 860, ry: 560, amount: 0.18, power: 2.6 }) }} />
    </AbsoluteFill>
  );
};

/** 深蓝底 + 5px 斜网点（原片的网点跟着镜头动、对不齐，所以做得很淡） */
const Backdrop: React.FC = () => (
  <>
    <AbsoluteFill style={{ background: 'radial-gradient(ellipse 1150px 760px at 740px 380px, rgb(8,30,50) 0%, rgb(7,26,43) 40%, rgb(5,19,32) 72%, rgb(3,10,15) 100%)' }} />
    <AbsoluteFill
      style={{
        backgroundImage: 'radial-gradient(circle at 1.25px 1.25px, rgba(120,160,200,0.035) 0 1.2px, rgba(0,0,0,0) 1.5px), radial-gradient(circle at 3.75px 3.75px, rgba(0,0,0,0.12) 0 1.2px, rgba(0,0,0,0) 1.5px)',
        backgroundSize: '5px 5px',
      }}
    />
  </>
);

/** 一篇文章（文章坐标）。typed：标题打字、条长出来、正文扫出来；否则直接全部显示 */
const Page: React.FC<{ a: Article; t: number; typed: boolean }> = ({ a, t, typed }) => {
  const prefix = Array.from(a.prefix);
  const hl = Array.from(a.highlight);
  const n = typed ? typedChars(t, prefix.length + hl.length) : prefix.length + hl.length;
  const bh = typed ? barHeight(t) : PAGE.barH;
  const titleFont = `700 ${PAGE.titleSize}px ${SERIF}`;
  const lay = layoutBody(a.body.filter((x) => x.trim()).map((text) => ({ text, highlight: '' })), PAGE.body, SANS);
  const lines = new Map<number, typeof lay.chars>();
  let lineNo = 0;
  let lastKey = '';
  for (const ch of lay.chars) {
    const key = `${ch.paragraph}-${ch.line}`;
    if (key !== lastKey) { if (lastKey) lineNo++; lastKey = key; }
    const arr = lines.get(lineNo) ?? [];
    arr.push(ch);
    lines.set(lineNo, arr);
  }
  const engU = typed ? interpolate(t, [18, 28], [0, 1], clamp) : 1;
  return (
    <>
      {/* 标题：前半截白字，后半截深色字压在米黄条上 */}
      <div style={{ position: 'absolute', left: PAGE.titleLeft, top: PAGE.titleBase - PAGE.titleSize * 0.88, whiteSpace: 'pre', font: titleFont, lineHeight: 1, display: 'flex', alignItems: 'flex-end' }}>
        <span style={{ color: '#f1f1f1', textShadow: '0 0 6px rgba(255,255,255,0.35)' }}>
          {prefix.map((c, i) => <span key={i} style={{ opacity: i < n ? 1 : 0 }}>{c}</span>)}
        </span>
        {hl.length > 0 && (
          <span style={{ position: 'relative', marginLeft: PAGE.barPad, padding: `0 ${PAGE.barPad}px` }}>
            <span style={{ position: 'absolute', left: 0, right: 0, bottom: PAGE.titleBase + PAGE.titleSize * 0.12 - PAGE.barBottom, height: bh, background: 'linear-gradient(to bottom, #efe7c6, #e2d7ac 60%, #d6c99a)', boxShadow: '0 0 10px rgba(240,230,190,0.25)' }} />
            <span style={{ position: 'relative', color: '#2b2416' }}>
              {hl.map((c, i) => <span key={i} style={{ opacity: prefix.length + i < n ? 1 : 0 }}>{c}</span>)}
            </span>
          </span>
        )}
      </div>
      {a.english && (
        <div style={{ position: 'absolute', left: PAGE.body.left + 6, top: PAGE.englishY - PAGE.englishSize * 0.8, whiteSpace: 'pre', fontFamily: SANS, fontWeight: 700, fontSize: PAGE.englishSize, lineHeight: 1, color: '#5d6b7a', clipPath: `inset(-10px ${((1 - engU) * 100).toFixed(1)}% -10px -10px)` }}>
          {a.english}
        </div>
      )}
      {/* 正文：一行接一行从左往右扫出来 */}
      {[...lines.entries()].map(([i, chars]) => {
        const u = typed ? interpolate(t, [19 + 5.5 * i, 28 + 5.5 * i], [0, 1], clamp) : 1;
        if (u <= 0) return null;
        const x0 = chars[0]!.x;
        const x1 = chars[chars.length - 1]!.x + chars[chars.length - 1]!.width;
        const edge = x0 + (x1 - x0 + 60) * u - 60;
        return (
          <div key={i} style={{ position: 'absolute', left: 0, top: 0, width: 1280, height: 720, WebkitMaskImage: `linear-gradient(to right, #000 ${edge.toFixed(0)}px, transparent ${(edge + 60).toFixed(0)}px)`, maskImage: `linear-gradient(to right, #000 ${edge.toFixed(0)}px, transparent ${(edge + 60).toFixed(0)}px)` }}>
            {chars.map((ch, k) => (
              <span key={k} style={{ position: 'absolute', left: ch.x, top: ch.center - PAGE.body.size * 0.6, fontFamily: SANS, fontWeight: 400, fontSize: PAGE.body.size, lineHeight: 1.2, color: '#c6cbd1', whiteSpace: 'pre' }}>
                {ch.ch}
              </span>
            ))}
          </div>
        );
      })}
    </>
  );
};
