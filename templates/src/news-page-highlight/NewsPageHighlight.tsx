import React from 'react';
import { AbsoluteFill, Img, useCurrentFrame } from 'remotion';
import { bundledUrl } from '../asset';
import { smoothTrack } from '../curve';
import { vignetteGradient } from '../lens';
import { measure } from '../text-layout';
import { PAGE_CAM, TEXT_CAM } from './camera';

/**
 * 复刻：一张新闻网页，镜头从标题开头往右扫过去（先快后慢），标题区从下往上收掉，
 * 露出下面一行很大的字从画面底下滚上来，硬切推近到其中一段，黄色荧光笔从左往右涂过去（127 帧，1280×720 @30fps）
 *
 * 按原片量的：
 *   页面层（页面坐标 = 原片第 0 帧的画面）：
 *     页头：网站名、红底频道块（x 495–732）、面包屑（x 800 起，字高 62）、分隔线 y 100
 *     标题：粗黑体 100px，左 58，第一行字顶 296，行距 132，一行最宽 2200
 *     作者行：圆头像 (140, 648)、灰字名字、红色「关注」按钮（高 49）
 *     第 0–48 帧往右扫 928（每帧 98 → 3，越扫越慢），第 41 帧起慢慢推近；标题区下边从第 48 帧起每帧往上收 30，
 *     页头一直钉在顶上，第 61–66 帧被推出画面
 *   大字层（内容坐标 = 原片最后一帧的画面）：
 *     一整行常规黑体 220px，要涂的那段居中（字心 x 628、y 346.5），前后的字接着排；上方 y −60 一条分隔线
 *     第 54 帧从画面底下滚上来（0.56 倍、带竖向拖影），第 68→69 帧硬切放大 1.46 倍，再慢慢上移推到 1 倍（第 100 帧停稳）
 *     荧光笔：黄条高 1.086 字号，第 85.7 帧从左边起，先快后慢，第 100.5 帧涂满
 *   画面：屏幕网格（周期 5.87 像素的细线）、很重的暗角、四周虚一点、边上一点红蓝错色
 * 只复刻画面，底部口播字幕不在模板里。
 */

export type NewsPageHighlightProps = {
  site: string;
  channel: string;
  crumbs: string[];
  headline: string;
  author: string;
  follow: string;
  lead: string;
  mark: string;
  tail: string;
  markColor: string;
  durationInFrames: number;
};

const SANS = '"Noto Sans CJK SC", "PingFang SC", "Source Han Sans SC", "Microsoft YaHei", sans-serif';
const SERIF = '"Noto Serif CJK SC", "Songti SC", "Source Han Serif SC", "STSong", serif';
const PAPER = 'rgb(250, 252, 249)';
const INK = '#171717';
const RULE = '#c9ccd0';

export const PAGE = {
  width: 2700,
  headerBottom: 104,
  rule: 100,
  headline: { left: 58, firstTop: 296, size: 100, lineHeight: 132, maxWidth: 2200 },
  author: { avatarX: 140, avatarY: 648, avatarR: 25, nameX: 265, top: 622, height: 50 },
};
/** 原片标题第一行右端（页面坐标）：往右扫 928 正好扫到这里 */
const PAN_REF = { distance: 928, lineRight: 2230 };

export const BIG = { size: 220, cx: 628, cy: 346.5, maxWidth: 1318, rule: -60 };

/** 标题区的下边（页面坐标）：第 48 帧在 404（第一行字底下），每帧往上收 30，收到页头为止 */
export function wipeEdge(frame: number): number {
  return Math.max(PAGE.headerBottom, 404 - 30 * (frame - 48));
}

/** 荧光笔涂到哪（0–1），按原片前沿的实测位置 */
const MARK_T = [85.7, 87, 88, 89, 90, 91, 92, 93, 94, 95, 96, 97, 98, 99, 100.5];
const MARK_U = [0, 0.151, 0.267, 0.367, 0.453, 0.531, 0.6, 0.663, 0.721, 0.773, 0.822, 0.867, 0.907, 0.946, 1];
export function markProgress(frame: number, at = 85.7): number {
  return smoothTrack(frame - at + 85.7, MARK_T, MARK_U);
}

/** 大字层滚上来时的竖向拖影（px，画面上） */
export function riseBlur(frame: number): number {
  return smoothTrack(frame, [53, 57, 59, 61, 64, 68], [4.5, 4.5, 3, 1.5, 0.8, 0]);
}


/** 关键帧之间用平滑曲线（速度连续）；大字层第 68→69 帧是硬切，前后两段分开插值 */
function track(frame: number, t: readonly number[], v: readonly number[]) {
  return smoothTrack(frame, t, v);
}
const CUT = 68.5;
function textTrack(frame: number, v: readonly number[]) {
  const t = TEXT_CAM.t;
  const k = t.findIndex((x) => x > CUT);
  return frame < CUT ? track(frame, t.slice(0, k), v.slice(0, k)) : track(frame, t.slice(k), v.slice(k));
}

export function pageCamera(frame: number, panScale = 1) {
  return { s: track(frame, PAGE_CAM.t, PAGE_CAM.s), x: track(frame, PAGE_CAM.t, PAGE_CAM.x) * panScale, y: track(frame, PAGE_CAM.t, PAGE_CAM.y) };
}

export function textCamera(frame: number) {
  return { s: textTrack(frame, TEXT_CAM.s), x: textTrack(frame, TEXT_CAM.x), y: textTrack(frame, TEXT_CAM.y) };
}

/**
 * 原片是微软雅黑：同样的字号，它的中文字形在字框里大一点、英文窄一点。
 * 用黑体模仿：标题中文每字收 0.04 em（原片中文字距 96）、英文收 0.024 em；
 * 大字整体放大 5%、中文每字收回 0.05 em（字距不变、字形变大），英文反而放宽一点（原片的 AI 更宽）
 */
export const HEAD_TRACK = { latin: -0.024, cjk: -0.04 };
export const BIG_TRACK = { latin: 0.005, cjk: -0.05 };
export const CJK_GROW = 1.05;
/** 原片的笔画比黑体常规体细一点（14 对 16 像素），用 DemiLight */
export const BIG_WEIGHT = 350;
const isLatin = (ch: string) => /[\x00-\xff]/.test(ch);

/** 一行字的宽度（按收过的字距算，track 以 em 计） */
export function lineWidth(text: string, font: string, size: number, track = HEAD_TRACK): number {
  const chars = Array.from(text);
  const latin = chars.filter(isLatin).length;
  return measure(text, font) + (latin * track.latin + (chars.length - latin) * track.cjk) * size;
}

/** 标题按宽度换行：中文一个字一个字排，英文单词不拆，标点不放行首 */
export function wrapHeadline(text: string, maxWidth: number, font: string, size: number = PAGE.headline.size): string[] {
  const tokens = text.match(/[A-Za-z0-9.'’\-]+|\s+|./gu) ?? [];
  const lines: string[] = [];
  let line = '';
  for (const tok of tokens) {
    const next = line + tok;
    if (line && lineWidth(next.trimEnd(), font, size) > maxWidth && !/^[，。、：；！？,.:;!?）」』”]$/u.test(tok)) {
      lines.push(line.trimEnd());
      line = tok.trimStart();
    } else {
      line = next;
    }
  }
  if (line.trim()) lines.push(line.trimEnd());
  return lines;
}

export function headlineLayout(headline: string) {
  const H = PAGE.headline;
  // 原片是两行：超过两行就缩小字号（最小 70），还放不下才排第三行
  let size = H.size;
  let lines: string[] = [];
  for (; size >= 70; size -= 2) {
    lines = wrapHeadline(headline, H.maxWidth, `700 ${size}px ${SANS}`, size);
    if (lines.length <= 2) break;
  }
  size = Math.max(70, size);
  const font = `700 ${size}px ${SANS}`;
  const lineHeight = (H.lineHeight / H.size) * size;
  const firstWidth = lines[0] ? lineWidth(lines[0], font, size) : 0;
  const lineRight = H.left + firstWidth;
  // 扫的距离跟着第一行的长度走：原片第一行右端 2230 → 扫 928
  const distance = Math.max(0, lineRight - (PAN_REF.lineRight - PAN_REF.distance));
  // 作者行跟在最后一行标题下面（原片：第二行顶往下 194）
  const authorTop = H.firstTop + Math.max(0, lines.length - 1) * lineHeight + (194 / H.size) * size;
  return { lines, size, lineHeight, authorTop, panScale: distance / PAN_REF.distance };
}

/** 页头：网站名、红块、面包屑从左往右排，默认位置按原片，前面的字长了就往后挪 */
export function headerLayout(site: string, channel: string) {
  const siteRight = 60 + measure(site, `900 84px ${SERIF}`);
  const channelLeft = Math.max(495, siteRight + 35);
  const channelRight = channel ? channelLeft + measure(channel, `700 62px ${SANS}`) + 32 : siteRight;
  const crumbsLeft = Math.max(800, channelRight + 68);
  return { channelLeft, crumbsLeft };
}

/** 大字：要涂的那段居中；太长就缩小字号放得下 */
export function bigLayout(lead: string, mark: string, tail: string) {
  const w0 = (t: string) => lineWidth(t, `${BIG_WEIGHT} ${BIG.size * CJK_GROW}px ${SANS}`, BIG.size, BIG_TRACK);
  const markW0 = w0(mark);
  const k = markW0 > 0 ? Math.min(1.2, BIG.maxWidth / markW0) : 1;
  const size = BIG.size * k;
  const markW = markW0 * k;
  const markLeft = BIG.cx - markW / 2;
  return { size, markLeft, markW, leadW: w0(lead) * k, tailW: w0(tail) * k };
}

const PersonIcon: React.FC<{ x: number; y: number; size: number }> = ({ x, y, size }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" style={{ position: 'absolute', left: x - size / 2, top: y - size / 2 }}>
    <circle cx="12" cy="8" r="4.2" fill="none" stroke="#b9bdc3" strokeWidth="1.8" />
    <path d="M4 21c0-4.4 3.6-7.2 8-7.2s8 2.8 8 7.2" fill="none" stroke="#b9bdc3" strokeWidth="1.8" strokeLinecap="round" />
  </svg>
);

/** 中英文分开收字距（track 以 em 计，size 是字距按的字号） */
const Tracked: React.FC<{ text: string; size: number; track: { latin: number; cjk: number } }> = ({ text, size, track }) => (
  <>
    {(text.match(/[\x00-\xff]+|[^\x00-\xff]+/g) ?? []).map((run, i) => (
      <span key={i} style={{ letterSpacing: `${((isLatin(run[0]!) ? track.latin : track.cjk) * size).toFixed(2)}px` }}>{run}</span>
    ))}
  </>
);

/** 页面层：页头、标题、作者行 */
const PageLayer: React.FC<{ p: NewsPageHighlightProps; head: ReturnType<typeof headlineLayout>; edge: number }> = ({ p, head, edge }) => {
  const H = PAGE.headline;
  const A = PAGE.author;
  const hd = headerLayout(p.site, p.channel);
  const aTop = head.authorTop;
  const bodyH = Math.max(0, edge - PAGE.headerBottom);
  return (
    <div style={{ position: 'absolute', left: 0, top: 0, width: PAGE.width }}>
      {/* 页头（一直钉在顶上） */}
      <div style={{ position: 'absolute', left: 0, top: -400, width: PAGE.width, height: 400 + PAGE.headerBottom, background: PAPER }}>
        <div style={{ position: 'absolute', left: 60, top: 400 - 26, fontFamily: SERIF, fontWeight: 900, fontSize: 84, lineHeight: '90px', color: '#595959', whiteSpace: 'pre' }}>{p.site}</div>
        {p.channel && (
          <div style={{ position: 'absolute', left: hd.channelLeft, top: 400 - 12, height: 72, padding: '0 16px', background: '#cf2f2b', color: '#fff', fontFamily: SANS, fontWeight: 700, fontSize: 62, lineHeight: '72px', whiteSpace: 'pre' }}>{p.channel}</div>
        )}
        <div style={{ position: 'absolute', left: hd.crumbsLeft, top: 400 - 12, fontFamily: SANS, fontWeight: 500, fontSize: 62, lineHeight: '74px', color: '#2e2e2e', whiteSpace: 'pre' }}>
          {p.crumbs.map((c, i) => (
            <React.Fragment key={i}>
              {i > 0 && <span style={{ color: '#6f6f6f', fontWeight: 400, padding: '0 0.45em' }}>&gt;</span>}
              {c}
            </React.Fragment>
          ))}
        </div>
        <div style={{ position: 'absolute', left: 0, top: 400 + PAGE.rule, width: PAGE.width, height: 4, background: RULE }} />
      </div>
      {/* 标题区：从下往上收掉 */}
      <div style={{ position: 'absolute', left: 0, top: PAGE.headerBottom, width: PAGE.width, height: bodyH, overflow: 'hidden', background: PAPER }}>
        <div style={{ position: 'absolute', left: 0, top: -PAGE.headerBottom, width: PAGE.width }}>
          {head.lines.map((l, i) => (
            <div key={i} style={{ position: 'absolute', left: H.left, top: H.firstTop - 0.17 * head.size + i * head.lineHeight, fontFamily: SANS, fontWeight: 700, fontSize: head.size, lineHeight: `${head.size * 1.2}px`, color: INK, whiteSpace: 'pre' }}>
              <Tracked text={l} size={head.size} track={HEAD_TRACK} />
            </div>
          ))}
          {p.author && (
            <div style={{ position: 'absolute', left: A.avatarX - A.avatarR, top: aTop + (A.avatarY - A.top) - A.avatarR, width: A.avatarR * 2, height: A.avatarR * 2, borderRadius: '50%', background: 'radial-gradient(circle at 40% 35%, #f07a4a, #d5352b)' }} />
          )}
          <div style={{ position: 'absolute', left: A.nameX, top: aTop - 4, height: 58, display: 'flex', alignItems: 'center', gap: 40, whiteSpace: 'pre' }}>
            <span style={{ fontFamily: SANS, fontWeight: 500, fontSize: 50, color: '#4d4d4d' }}>{p.author}</span>
            {p.follow && <span style={{ height: A.height, padding: '0 38px', borderRadius: A.height / 2, background: '#e2372f', color: '#fff', fontFamily: SANS, fontWeight: 500, fontSize: 36, lineHeight: `${A.height}px` }}>{p.follow}</span>}
          </div>
        </div>
      </div>
    </div>
  );
};

/** 大字层：网页下半截（分隔线、小图标、一整行大字、荧光笔） */
const TextLayer: React.FC<{ p: NewsPageHighlightProps; mark: number }> = ({ p, mark }) => {
  const L = bigLayout(p.lead, p.mark, p.tail);
  const bandH = L.size * 1.086;
  const bandLeft = L.markLeft - 4;
  const bandW = L.markW + 24;
  const textTop = BIG.cy - L.size * 0.5 - L.size * 0.057;
  return (
    <div style={{ position: 'absolute', left: 0, top: 0 }}>
      <div style={{ position: 'absolute', left: -1400, top: -1400, width: 4400, height: 2800, background: PAPER }} />
      <div style={{ position: 'absolute', left: -1400, top: BIG.rule, width: 4400, height: 3, background: RULE }} />
      <PersonIcon x={1664} y={-237} size={44} />
      {mark > 0 && (
        <div style={{ position: 'absolute', left: bandLeft, top: BIG.cy - bandH / 2, width: bandW, height: bandH, background: p.markColor, clipPath: `inset(0 ${((1 - mark) * 100).toFixed(2)}% 0 0)` }} />
      )}
      <div style={{ position: 'absolute', left: L.markLeft - L.leadW, top: textTop, fontFamily: SANS, fontWeight: BIG_WEIGHT, fontSize: L.size * CJK_GROW, lineHeight: `${L.size}px`, color: INK, whiteSpace: 'pre' }}>
        <Tracked text={p.lead + p.mark + p.tail} size={L.size} track={BIG_TRACK} />
      </div>
    </div>
  );
};

/** 镜头效果：四周虚一点（清楚的一份盖在虚的一份上，中间清楚），再按红绿蓝分开、红的放大一点、蓝的缩小一点叠回去 */
const Lens: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const sharpMask = 'radial-gradient(ellipse 720px 430px at 640px 360px, #000 50%, rgba(0,0,0,0.55) 78%, transparent 100%)';
  const blurred = (
    <>
      <AbsoluteFill style={{ filter: 'blur(3px)' }}>{children}</AbsoluteFill>
      <AbsoluteFill style={{ filter: 'blur(0.8px)', WebkitMaskImage: sharpMask, maskImage: sharpMask }}>{children}</AbsoluteFill>
    </>
  );
  const channel = (id: string, scale: number) => (
    <AbsoluteFill style={{ filter: `url(#${id})`, transformOrigin: '640px 360px', transform: scale !== 1 ? `scale(${scale})` : undefined, mixBlendMode: 'screen' }}>
      {blurred}
    </AbsoluteFill>
  );
  return (
    <AbsoluteFill style={{ backgroundColor: '#000', isolation: 'isolate' }}>
      <svg width={0} height={0} style={{ position: 'absolute' }}>
        <filter id="nph-r" colorInterpolationFilters="sRGB"><feColorMatrix type="matrix" values="1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0" /></filter>
        <filter id="nph-g" colorInterpolationFilters="sRGB"><feColorMatrix type="matrix" values="0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0" /></filter>
        <filter id="nph-b" colorInterpolationFilters="sRGB"><feColorMatrix type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0" /></filter>
      </svg>
      {channel('nph-r', 1.006)}
      {channel('nph-g', 1)}
      {channel('nph-b', 0.995)}
    </AbsoluteFill>
  );
};

export const NewsPageHighlight: React.FC<NewsPageHighlightProps> = (p) => {
  const frame = useCurrentFrame();
  const head = headlineLayout(p.headline);
  const pc = pageCamera(frame, head.panScale);
  const tc = textCamera(frame);
  const edge = wipeEdge(frame);
  const mark = markProgress(frame);
  const vblur = riseBlur(frame);
  const showPage = frame <= 66;
  const showText = frame >= 44;
  // 纸面往画面外多铺一圈：错色时蓝色那层缩小一点、虚化会往里吸边，不然四边会露出一道橙边
  const scene = (
    <AbsoluteFill>
      <div style={{ position: 'absolute', left: -40, top: -40, width: 1360, height: 800, background: PAPER }} />
      {showText && (
        <AbsoluteFill style={{ filter: vblur > 0.2 ? `url(#nph-vblur)` : undefined }}>
          <div style={{ position: 'absolute', left: 0, top: 0, transformOrigin: '0 0', transform: `translate(${tc.x.toFixed(2)}px, ${tc.y.toFixed(2)}px) scale(${tc.s.toFixed(5)})` }}>
            <TextLayer p={p} mark={mark} />
          </div>
        </AbsoluteFill>
      )}
      {showPage && (
        <div style={{ position: 'absolute', left: 0, top: 0, transformOrigin: '0 0', transform: `translate(${pc.x.toFixed(2)}px, ${pc.y.toFixed(2)}px) scale(${pc.s.toFixed(5)})` }}>
          <PageLayer p={p} head={head} edge={edge} />
        </div>
      )}
    </AbsoluteFill>
  );
  return (
    <AbsoluteFill style={{ backgroundColor: '#000', overflow: 'hidden' }}>
      <svg width={0} height={0} style={{ position: 'absolute' }}>
        <filter id="nph-vblur" x="-5%" y="-20%" width="110%" height="140%"><feGaussianBlur stdDeviation={`0 ${vblur.toFixed(2)}`} /></filter>
      </svg>
      <Lens>{scene}</Lens>
      {/* 屏幕网格：固定在画面上（不跟镜头走），周期 5.854，按原片实测的线型和位置预先画好的一张图，正片叠底 */}
      <Img src={bundledUrl('news-page-highlight/grid.png')} style={{ position: 'absolute', left: 0, top: 0, width: 1280, height: 720, mixBlendMode: 'multiply' }} />
      <AbsoluteFill style={{ background: vignetteGradient({ cx: 640, cy: 360, rx: 640, ry: 360, amount: 0.3, power: 2.56 }) }} />
    </AbsoluteFill>
  );
};
