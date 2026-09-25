import React from 'react';
import { Img } from 'remotion';
import { assetUrl } from '../asset';
import { measure } from '../text-layout';

/**
 * 社交平台帖子截图（「帖子截图 · 翻译黑条」「翻译金句 · 特写横移」两个模板共用）。
 *
 * 按原片量的（卡片坐标，宽 763）：
 *   顶上「← 帖子」；上面一条被回复的帖子（头像 52px、名字加粗 19px、正文 19px 行距 26、一排互动数字 17px）
 *   头像下面一条竖线连到主帖；主帖名字、账号，「显示翻译」一行，正文 21.5px 行距 31，最后一行发布时间
 *   翻译黑条压在「显示翻译」右边：x 135 起、高 37，字是窄的黑体（25px 横向压到 0.66），白字
 *
 * 高度随正文行数变，所以位置都由 layoutPost 算出来，特写镜头也按同一份位置找黑条。
 */

export type PostAuthor = { name: string; handle: string; avatar: string };

export type PostCardData = {
  header: string;
  parent: PostAuthor & { time: string; text: string; replies: string; reposts: string; likes: string; views: string };
  post: PostAuthor & { text: string; date: string; views: string };
  translateLabel: string;
  translation: string;
};

export const SANS = '"Noto Sans CJK SC", "PingFang SC", "Source Han Sans SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif';
export const CARD_WIDTH = 763;
const INK = '#0f1419';
const GREY = '#536471';
const BLUE = '#1d9bf0';

/** 翻译黑条：窄黑体、白字 */
export const BAR = { left: 135, height: 37, size: 25, squeeze: 0.662, padLeft: 13, padRight: 1, maxWidth: 612, color: '#1c1b1b', text: '#f1f1f2' };

const PARENT = { left: 84, width: 668, size: 19, line: 26 };
const MAIN = { left: 24, width: 723, size: 21.5, line: 31 };

/** 按单词换行（中文按字）；量字宽用的字体和画的时候一样 */
export function wrapWords(text: string, font: string, maxWidth: number): string[] {
  const tokens = text.match(/[A-Za-z0-9'’@#$%&*+\-.,:;!?/()"“”]+|\s+|./gu) ?? [];
  const lines: string[] = [];
  let cur = '';
  for (const tok of tokens) {
    if (tok === '\n') {
      lines.push(cur.trimEnd());
      cur = '';
      continue;
    }
    const next = cur + tok;
    if (cur.trim() && !/^\s+$/.test(tok) && measure(next.trimEnd(), font) > maxWidth) {
      lines.push(cur.trimEnd());
      cur = tok.trimStart();
    } else {
      cur = next;
    }
  }
  if (cur.trim() || lines.length === 0) lines.push(cur.trimEnd());
  return lines;
}

export type PostLayout = {
  parentLines: string[];
  mainLines: string[];
  /** 各行的基线（卡片坐标） */
  y: {
    parentName: number;
    parentText: number;
    stats: number;
    avatar2: number;
    name2: number;
    handle2: number;
    bar: number;
    mainText: number;
    date: number;
    height: number;
  };
  barWidth: number;
  /** 翻译字太多、黑条放不下时整体缩小 */
  barScale: number;
};

/** 「·」用西文字体画（中文字体里的「·」是全角的，原片是窄的） */
const DOT_FONT = '"Helvetica Neue", Arial, "Liberation Sans", sans-serif';

function splitDots(text: string): string[] {
  return text.split(/(\s*·\s*)/);
}

/** 量带「·」的一行有多宽（和 Dotted 画出来的一致） */
export function measureDotted(text: string, size: number, weight = 400): number {
  return splitDots(text).reduce((w, part, i) => w + (i % 2 ? measure(' · ', `${weight} ${size}px ${DOT_FONT}`) : measure(part, `${weight} ${size}px ${SANS}`)), 0);
}

const Dotted: React.FC<{ text: string }> = ({ text }) => (
  <>
    {splitDots(text).map((part, i) => (i % 2 ? <span key={i} style={{ fontFamily: DOT_FONT }}>{' · '}</span> : <React.Fragment key={i}>{part}</React.Fragment>))}
  </>
);

export function barFont(): string {
  return `500 ${BAR.size}px ${SANS}`;
}

/**
 * 黑条里的字有多宽（压窄以后）。句尾是「。」「”」这种全角标点时，字形只占格子左边一小半，
 * 黑条收在字形后面一点（原片就是这样），不留整格。
 */
export function barTextWidth(text: string): number {
  const w = measure(text, barFont()) * BAR.squeeze;
  const trailing = /[。，、；：！？）」』”’]$/u.test(text) ? 0.25 * BAR.size * BAR.squeeze : 0;
  return Math.max(0, w - trailing);
}

export function layoutPost(d: PostCardData): PostLayout {
  const parentLines = d.parent.text.trim() ? wrapWords(d.parent.text, `${PARENT.size}px ${SANS}`, PARENT.width) : [];
  const mainLines = d.post.text.trim() ? wrapWords(d.post.text, `${MAIN.size}px ${SANS}`, MAIN.width) : [];
  // 原片里上面那条正文两行：第一行基线 121.5，互动数字行心 181，主帖头像顶 225
  const extra = (Math.max(1, parentLines.length) - 2) * PARENT.line;
  const extraMain = (Math.max(1, mainLines.length) - 2) * MAIN.line;
  const full = barTextWidth(d.translation) + BAR.padLeft + BAR.padRight;
  const barScale = Math.min(1, BAR.maxWidth / Math.max(1, full));
  return {
    parentLines,
    mainLines,
    y: {
      parentName: 93.5,
      parentText: 121.5,
      stats: 181 + extra,
      avatar2: 225 + extra,
      name2: 243 + extra,
      handle2: 268.5 + extra,
      bar: 304 + extra,
      mainText: 350 + extra,
      date: 429 + extra + extraMain,
      height: 444 + extra + extraMain,
    },
    barWidth: full * barScale,
    barScale,
  };
}

/** 一行字，按基线放（Noto / 苹方的基线大约在行框中线往下 0.43em） */
const Line: React.FC<{ x: number; baseline: number; size: number; weight?: number; color?: string; children: React.ReactNode; style?: React.CSSProperties }> = ({ x, baseline, size, weight = 400, color = INK, children, style }) => (
  <div
    style={{
      position: 'absolute', left: x, top: baseline - size * 0.75 - size * 0.43, height: size * 1.5, lineHeight: `${size * 1.5}px`,
      fontFamily: SANS, fontSize: size, fontWeight: weight, color, whiteSpace: 'pre', WebkitTextStroke: `${(size * 0.016).toFixed(2)}px ${color}`, ...style,
    }}
  >
    {children}
  </div>
);

const Icon: React.FC<{ x: number; cy: number; size?: number; color?: string; children: React.ReactNode }> = ({ x, cy, size = 20, color = GREY, children }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} style={{ position: 'absolute', left: x, top: cy - size / 2 }} fill="none" stroke={color} strokeWidth={size > 26 ? 1.7 : 2} strokeLinecap="round" strokeLinejoin="round">
    {children}
  </svg>
);

const ICONS = {
  reply: <path d="M4 11.5c0-4 3.4-7 8-7s8 3 8 7-3.4 7-8 7c-1 0-2-.1-2.9-.4L5 20l1-3.6C4.7 15 4 13.3 4 11.5z" />,
  repost: (
    <>
      <path d="M5 16V8.5A2.5 2.5 0 0 1 7.5 6H16" />
      <path d="M13 3l3 3-3 3" />
      <path d="M19 8v7.5a2.5 2.5 0 0 1-2.5 2.5H8" />
      <path d="M11 21l-3-3 3-3" />
    </>
  ),
  like: <path d="M12 20s-7.5-4.6-7.5-10A4.3 4.3 0 0 1 12 7.4 4.3 4.3 0 0 1 19.5 10c0 5.4-7.5 10-7.5 10z" />,
  views: (
    <>
      <path d="M5 20V11" />
      <path d="M10 20V4" />
      <path d="M15 20v-7" />
      <path d="M20 20v-4" />
    </>
  ),
  bookmark: <path d="M6.5 3.5h11v17L12 16.5l-5.5 4z" />,
  share: (
    <>
      <path d="M12 15V3.5" />
      <path d="M7.5 8L12 3.5 16.5 8" />
      <path d="M4 14v4.5A1.5 1.5 0 0 0 5.5 20h13a1.5 1.5 0 0 0 1.5-1.5V14" />
    </>
  ),
  /** 右上角那个斜杠圆圈 */
  slashed: (
    <>
      <circle cx="12" cy="12" r="7" />
      <path d="M5 19L19 5" />
    </>
  ),
};

const More: React.FC<{ x: number; cy: number }> = ({ x, cy }) => (
  <div style={{ position: 'absolute', left: x, top: cy - 2, display: 'flex', gap: 3 }}>
    {[0, 1, 2].map((i) => (
      <div key={i} style={{ width: 3.6, height: 3.6, borderRadius: 2, backgroundColor: GREY }} />
    ))}
  </div>
);

/** 认证标：蓝色花边圆 + 白色对勾 */
const Badge: React.FC<{ x: number; cy: number }> = ({ x, cy }) => (
  <svg viewBox="0 0 24 24" width={21} height={21} style={{ position: 'absolute', left: x, top: cy - 10.5 }}>
    <path
      fill={BLUE}
      d="M12 1.8l2.2 1.7 2.7-.4 1.1 2.5 2.5 1.1-.4 2.7 1.7 2.2-1.7 2.2.4 2.7-2.5 1.1-1.1 2.5-2.7-.4L12 22.2l-2.2-1.7-2.7.4-1.1-2.5-2.5-1.1.4-2.7L2.2 12l1.7-2.2-.4-2.7 2.5-1.1 1.1-2.5 2.7.4z"
    />
    <path d="M7.6 12.3l3 2.9 5.8-6" fill="none" stroke="#fff" strokeWidth={2.3} strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const Avatar: React.FC<{ src: string; top: number }> = ({ src, top }) => (
  <div style={{ position: 'absolute', left: 21, top, width: 52, height: 52, borderRadius: 26, overflow: 'hidden', backgroundColor: '#cfd9de' }}>
    {src && <Img src={assetUrl(src)} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
  </div>
);

/** 名字 + 认证标 + 灰色的账号、时间，一行排开 */
const NameRow: React.FC<{ x: number; baseline: number; name: string; rest: string }> = ({ x, baseline, name, rest }) => {
  const nameW = measure(name, `700 19px ${SANS}`);
  return (
    <>
      <Line x={x} baseline={baseline} size={19} weight={700}>{name}</Line>
      <Badge x={x + nameW + 4} cy={baseline - 6} />
      {rest && <Line x={x + nameW + 32} baseline={baseline} size={19} color={GREY}><Dotted text={rest} /></Line>}
    </>
  );
};

/**
 * 整张卡片（不含外面的镜头）。barProgress 0–1：翻译黑条从左往右刷出来的进度。
 * showBar=false 时不画黑条（特写镜头里黑条单独一层画在前面）。
 */
export const PostCard: React.FC<{ data: PostCardData; layout: PostLayout; barProgress: number; showBar?: boolean }> = ({ data: d, layout: L, barProgress, showBar = true }) => {
  const y = L.y;
  const statsCx = [85, 234, 386, 538];
  const stats = [
    { icon: ICONS.reply, value: d.parent.replies },
    { icon: ICONS.repost, value: d.parent.reposts },
    { icon: ICONS.like, value: d.parent.likes },
    { icon: ICONS.views, value: d.parent.views },
  ];
  const dateW = measureDotted(`${d.post.date} · `, 17.5);
  const viewsW = measure(d.post.views, `700 17.5px ${SANS}`);
  return (
    <div style={{ position: 'absolute', left: 0, top: 0, width: CARD_WIDTH, height: y.height, backgroundColor: '#fff', overflow: 'hidden' }}>
      {/* 顶栏 */}
      <Icon x={24} cy={26} size={19} color={INK}>
        <path d="M20 12H5" />
        <path d="M11 5l-7 7 7 7" />
      </Icon>
      <Line x={93} baseline={34} size={24} weight={700}>{d.header}</Line>

      {/* 上面那条 */}
      <Avatar src={d.parent.avatar} top={75} />
      <div style={{ position: 'absolute', left: 46.5, top: 132, width: 2, height: y.avatar2 - 136, backgroundColor: '#cfd9de' }} />
      <NameRow x={84} baseline={y.parentName} name={d.parent.name} rest={[d.parent.handle, d.parent.time].filter(Boolean).join(' · ')} />
      <Icon x={684} cy={87} size={32}>{ICONS.slashed}</Icon>
      <More x={727} cy={86} />
      {L.parentLines.map((line, i) => (
        <Line key={i} x={PARENT.left} baseline={y.parentText + i * PARENT.line} size={PARENT.size}>{line}</Line>
      ))}
      {stats.map((s, i) => (
        <React.Fragment key={i}>
          <Icon x={statsCx[i]! - 3} cy={y.stats} size={26}>{s.icon}</Icon>
          <Line x={statsCx[i]! + 28} baseline={y.stats + 6} size={17} color={GREY}>{s.value}</Line>
        </React.Fragment>
      ))}
      <Icon x={683} cy={y.stats} size={25}>{ICONS.bookmark}</Icon>
      <Icon x={723} cy={y.stats} size={25}>{ICONS.share}</Icon>

      {/* 主帖 */}
      <Avatar src={d.post.avatar} top={y.avatar2} />
      <NameRow x={84} baseline={y.name2} name={d.post.name} rest="" />
      <Line x={85} baseline={y.handle2} size={19} color={GREY}>{d.post.handle}</Line>
      <Icon x={684} cy={y.name2 - 7} size={32}>{ICONS.slashed}</Icon>
      <More x={727} cy={y.name2 - 7} />

      {d.translateLabel && (
        <>
          <Icon x={18} cy={y.bar + 8.5} size={28} color="#5b7083">{ICONS.slashed}</Icon>
          <Line x={52} baseline={y.bar + 15} size={16} color={BLUE}>{d.translateLabel}</Line>
        </>
      )}
      {showBar && <TranslationBar data={d} layout={L} progress={barProgress} />}

      {L.mainLines.map((line, i) => (
        <Line key={i} x={MAIN.left} baseline={y.mainText + i * MAIN.line} size={MAIN.size}>{line}</Line>
      ))}
      <Line x={29} baseline={y.date} size={17.5} color="#8b98a5"><Dotted text={`${d.post.date} · `} /></Line>
      <Line x={29 + dateW} baseline={y.date} size={17.5} weight={700} color={INK}>{d.post.views}</Line>
      <Line x={29 + dateW + viewsW + 5} baseline={y.date} size={17.5} color="#8b98a5">查看</Line>
    </div>
  );
};

/** 黑条上的字：银色，上亮下灰（原片字形顶上 234、底下 150） */
export const BarText: React.FC<{ text: string }> = ({ text }) => (
  <span
    style={{
      display: 'inline-block', lineHeight: 1, color: 'transparent', WebkitBackgroundClip: 'text', backgroundClip: 'text',
      backgroundImage: `linear-gradient(to bottom, ${BAR.text} 10%, #9a9a9a 92%)`,
    }}
  >
    {text}
  </span>
);

/**
 * 翻译黑条：从左往右刷出来，刷的那条边有点斜；字跟着黑条一起露出来。
 * 画在卡片坐标里（left 135、行心 layout.y.bar）。
 */
export const TranslationBar: React.FC<{ data: PostCardData; layout: PostLayout; progress: number; style?: React.CSSProperties }> = ({ data, layout, progress, style }) => {
  if (progress <= 0 || !data.translation) return null;
  const w = layout.barWidth;
  const shown = w * Math.min(1, progress);
  // 刷的那条边：上面比下面往右多 7px，刷完以后是直的
  const slant = progress >= 1 ? 0 : 3.5;
  const clip = `polygon(0 0, ${shown + slant}px 0, ${shown - slant}px 100%, 0 100%)`;
  return (
    <div
      style={{
        position: 'absolute', left: BAR.left, top: layout.y.bar - (BAR.height * layout.barScale) / 2, width: w + 4, height: BAR.height * layout.barScale,
        clipPath: clip, WebkitClipPath: clip, ...style,
      }}
    >
      <div style={{ position: 'absolute', left: 0, top: 0, width: w, height: '100%', backgroundColor: BAR.color }} />
      <div
        style={{
          position: 'absolute', left: BAR.padLeft * layout.barScale, top: 0, height: '100%', display: 'flex', alignItems: 'center', whiteSpace: 'pre',
          fontFamily: SANS, fontWeight: 500, fontSize: BAR.size * layout.barScale,
          transform: `scaleX(${BAR.squeeze})`, transformOrigin: '0 50%',
        }}
      >
        <BarText text={data.translation} />
      </div>
    </div>
  );
};
