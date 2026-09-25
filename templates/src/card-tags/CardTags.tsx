import React from 'react';
import { AbsoluteFill, Easing, Img, interpolate, useCurrentFrame } from 'remotion';
import { assetUrl } from '../asset';
import { Media } from '../media';
import { vignetteGradient } from '../lens';

/**
 * 复刻：口播画面压暗，左上一张斜放的纸卡片（里面换几页、贴小标签），右边几个橙色词条；最后卡片甩出去（200 帧，1280×720 @30fps）
 *
 * 按原片量的：
 *   卡片 826×446、圆角 30，中心 (468, 284)，逆时针斜 3.9°；米灰纸色，左下暗、右上亮
 *     每页：一张图（放中间或铺满）、左边一个很大的淡灰水印字、底下一行白色小字
 *     换页：往上滚过去（8 帧，带竖向拖影），或者淡入淡出
 *     小标签：黑色毛边底 + 白色宋体（或白纸底 + 黑字），从虚到实弹出来（8 帧）
 *   右边词条三个位置：上 y 252、中 y 416、下 y 559（中心），x 中心约 888
 *     橙色方块：#fba600 圆角、四周发光，白色粗宋体 72px，右下一行英文小字
 *     发光字：白色粗宋体 54px，外面一圈橙色光；可以挑几个字标红（原片的「补」）
 *     出来：从 0.85 倍长到 1，淡进来（12 帧）
 *   背景口播画面压暗 60%、四周更暗；甩出去：卡片往左下飞、越转越斜、淡掉（24 帧），词条 20 帧后淡掉，背景 10 帧后慢慢亮回来
 * 只复刻画面，底部口播字幕不在模板里。
 */

export type CardPage = { image: string; fill: boolean; watermark: string; caption: string; at: number; scroll: boolean };
export type CardLabel = { text: string; page: number; x: number; y: number; dark: boolean; at: number };
export type SideTag = { text: string; sub: string; accent: string; glow: boolean; slot: 'top' | 'middle' | 'bottom'; at: number };

export type CardTagsProps = {
  background: string;
  pages: CardPage[];
  labels: CardLabel[];
  tags: SideTag[];
  exitAt: number;
  durationInFrames: number;
};

const SERIF = '"Noto Serif CJK SC", "Songti SC", "STSong", "Source Han Serif SC", serif';
const SANS = '"Noto Sans CJK SC", "PingFang SC", "Source Han Sans SC", "Hiragino Sans GB", sans-serif';
const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;

export const CARD = { w: 826, h: 446, x: 468, y: 284, rot: -3.9, radius: 30 };
export const SLOTS = { top: 252, middle: 416, bottom: 559 } as const;
const TAG_X = 888;

const EXIT_T = [0, 4, 8, 12, 16, 20, 24];
const EXIT_X = [0, -60, -125, -260, -380, -470, -540];
const EXIT_Y = [0, 25, 55, 110, 150, 180, 200];
const EXIT_R = [0, -2.1, -6.1, -12.1, -17.1, -21.1, -24.1];
const EXIT_O = [1, 1, 1, 0.85, 0.6, 0.3, 0];

export function cardExit(frame: number, exitAt: number) {
  const t = frame - exitAt;
  return {
    dx: interpolate(t, EXIT_T, EXIT_X, clamp),
    dy: interpolate(t, EXIT_T, EXIT_Y, clamp),
    rot: CARD.rot + interpolate(t, EXIT_T, EXIT_R, clamp),
    opacity: interpolate(t, EXIT_T, EXIT_O, clamp),
  };
}

/** 现在在第几页、换页进度（0–1）：往上滚或淡入淡出 */
export function pageState(frame: number, pages: CardPage[]) {
  let cur = 0;
  for (let i = 1; i < pages.length; i++) if (frame >= pages[i]!.at) cur = i;
  const next = pages[cur];
  const u = cur === 0 || !next ? 1 : Easing.inOut(Easing.cubic)(interpolate(frame, [next.at, next.at + 8], [0, 1], clamp));
  return { cur, u };
}

export const CardTags: React.FC<CardTagsProps> = (p) => {
  const frame = useCurrentFrame();
  const exit = cardExit(frame, p.exitAt);
  const dim = interpolate(frame, [p.exitAt + 10, p.exitAt + 30], [1, 0], clamp);
  const tagsOut = interpolate(frame, [p.exitAt + 20, p.exitAt + 28], [1, 0], clamp);
  const { cur, u } = pageState(frame, p.pages);
  return (
    <AbsoluteFill style={{ backgroundColor: '#000', overflow: 'hidden' }}>
      <AbsoluteFill style={{ filter: dim > 0.01 ? `blur(${(1.5 * dim).toFixed(2)}px)` : undefined }}>
        <Media src={p.background} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />
      </AbsoluteFill>
      {dim > 0.01 && (
        <>
          <AbsoluteFill style={{ backgroundColor: `rgba(0,0,0,${(0.55 * dim).toFixed(3)})` }} />
          <AbsoluteFill style={{ background: vignetteGradient({ cx: 640, cy: 360, rx: 720, ry: 440, amount: 0.55, power: 2.2 }), opacity: dim }} />
        </>
      )}
      {/* 卡片 */}
      {exit.opacity > 0.01 && p.pages.length > 0 && (
        <div
          style={{
            position: 'absolute', left: CARD.x - CARD.w / 2 + exit.dx, top: CARD.y - CARD.h / 2 + exit.dy, width: CARD.w, height: CARD.h, opacity: exit.opacity,
            transform: `rotate(${exit.rot.toFixed(2)}deg)`, borderRadius: CARD.radius, overflow: 'hidden', boxShadow: '18px 24px 40px rgba(0,0,0,0.55)',
            background: 'linear-gradient(200deg, #e9e5dc 0%, #d9d3c8 45%, #a9a398 100%)',
          }}
        >
          {p.pages.map((pg, i) => {
            if (i !== cur && i !== cur - 1) return null;
            // 这一页相对卡片往上挪多少（滚动换页）或多透明（淡入淡出）
            const incoming = i === cur;
            const scroll = p.pages[cur]!.scroll;
            const y = cur === 0 ? 0 : scroll ? (incoming ? (1 - u) * CARD.h : -u * CARD.h) : 0;
            const op = cur === 0 || scroll ? 1 : incoming ? u : 1 - u;
            if (!incoming && u >= 1) return null;
            const moving = cur > 0 && scroll && u > 0 && u < 1;
            return (
              <div key={i} style={{ position: 'absolute', left: 0, top: y, width: CARD.w, height: CARD.h, opacity: op, filter: moving ? `blur(${(4 * Math.sin(Math.PI * u)).toFixed(2)}px)` : undefined }}>
                <Page page={pg} />
                {p.labels.filter((l) => l.page === i).map((l, k) => (
                  <Label key={k} label={l} frame={frame} />
                ))}
              </div>
            );
          })}
        </div>
      )}
      {/* 右边的词条 */}
      {tagsOut > 0.01 && p.tags.map((t, i) => <Tag key={i} tag={t} frame={frame} fade={tagsOut} />)}
    </AbsoluteFill>
  );
};

const Page: React.FC<{ page: CardPage }> = ({ page }) => (
  <>
    {page.watermark && (
      <div
        style={{
          position: 'absolute', left: 120, top: 40, fontFamily: SERIF, fontWeight: 900, fontSize: 330, lineHeight: 1, whiteSpace: 'pre', color: 'rgba(90,86,80,0.16)',
          filter: 'blur(1.5px)',
        }}
      >
        {page.watermark}
      </div>
    )}
    {page.image &&
      (page.fill ? (
        <Media src={page.image} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />
      ) : (
        <Img src={assetUrl(page.image)} style={{ position: 'absolute', left: CARD.w * 0.28, top: CARD.h * 0.12, width: CARD.w * 0.44, height: CARD.h * 0.66, objectFit: 'contain', filter: 'drop-shadow(8px 12px 12px rgba(0,0,0,0.35))' }} />
      ))}
    {page.caption && (
      <div style={{ position: 'absolute', left: 0, right: 0, top: CARD.h * 0.86, textAlign: 'center', fontFamily: SANS, fontSize: 24, color: '#fbfbfb', whiteSpace: 'pre', textShadow: '0 1px 4px rgba(0,0,0,0.6)' }}>
        {page.caption}
      </div>
    )}
  </>
);

/** 卡片上的小标签：黑色毛边底白字，或白纸黑字；从虚到实弹出来 */
const Label: React.FC<{ label: CardLabel; frame: number }> = ({ label, frame }) => {
  const t = frame - label.at;
  if (t < 0) return null;
  const u = Easing.out(Easing.cubic)(interpolate(t, [0, 8], [0, 1], clamp));
  const size = label.dark ? 30 : 34;
  return (
    <div
      style={{
        position: 'absolute', left: label.x, top: label.y, transform: `translate(-50%, -50%) rotate(-2deg) scale(${(1.25 - 0.25 * u).toFixed(3)})`, opacity: u,
        filter: u < 1 ? `blur(${(6 * (1 - u)).toFixed(2)}px)` : undefined, whiteSpace: 'pre', fontFamily: SERIF, fontWeight: 700, fontSize: size, lineHeight: 1,
        padding: label.dark ? '12px 26px' : '8px 14px', color: label.dark ? '#f4f4f4' : '#1b1b1b',
        background: label.dark
          ? 'radial-gradient(ellipse at 50% 50%, rgba(20,20,20,0.95) 55%, rgba(20,20,20,0.6) 75%, rgba(20,20,20,0) 100%)'
          : 'linear-gradient(180deg, #f7f5f0, #e4e0d8)',
        boxShadow: label.dark ? undefined : '3px 4px 8px rgba(0,0,0,0.35)',
      }}
    >
      {label.dark && <span style={{ position: 'absolute', left: 10, top: '42%', width: 6, height: 6, borderRadius: 3, background: '#e03030' }} />}
      {label.text}
    </div>
  );
};

const Tag: React.FC<{ tag: SideTag; frame: number; fade: number }> = ({ tag, frame, fade }) => {
  const t = frame - tag.at;
  if (t < 0) return null;
  const u = Easing.out(Easing.back(1.4))(interpolate(t, [0, 12], [0, 1], clamp));
  const cy = SLOTS[tag.slot];
  const base: React.CSSProperties = {
    position: 'absolute', left: TAG_X, top: cy, transform: `translate(-50%, -50%) scale(${(0.85 + 0.15 * u).toFixed(3)})`, opacity: Math.min(1, t / 8) * fade, whiteSpace: 'pre',
  };
  if (tag.glow) {
    return (
      <div style={{ ...base, fontFamily: SERIF, fontWeight: 900, fontSize: 54, lineHeight: 1, color: '#fff', textShadow: '0 0 8px rgba(255,150,0,0.95), 0 0 22px rgba(255,140,0,0.8), 0 0 40px rgba(255,120,0,0.55)' }}>
        <Accented text={tag.text} accent={tag.accent} />
      </div>
    );
  }
  return (
    <div
      style={{
        ...base, padding: '14px 34px 22px', borderRadius: 14, background: '#fba600', boxShadow: '0 0 18px 8px rgba(251,166,0,0.75), 0 0 40px 14px rgba(251,140,0,0.35)',
        fontFamily: SERIF, fontWeight: 900, fontSize: 72, lineHeight: 1, color: '#fff', textShadow: '0 2px 3px rgba(150,70,0,0.45)',
      }}
    >
      <Accented text={tag.text} accent={tag.accent} />
      {tag.sub && <div style={{ position: 'absolute', right: 34, bottom: 4, fontFamily: '"Georgia", "Times New Roman", serif', fontSize: 15, fontWeight: 400, textShadow: 'none' }}>{tag.sub}</div>}
    </div>
  );
};

/** 词条里要标红的字（比如「补」） */
const Accented: React.FC<{ text: string; accent: string }> = ({ text, accent }) => {
  const marks = new Set(Array.from(accent.trim()));
  if (marks.size === 0) return <>{text}</>;
  return (
    <>
      {Array.from(text).map((ch, i) => (marks.has(ch) ? <span key={i} style={{ color: '#e8322a' }}>{ch}</span> : <React.Fragment key={i}>{ch}</React.Fragment>))}
    </>
  );
};
