import React from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { Media } from '../media';
import { CARD, PersonCard, type PersonCardData } from '../person-card/PersonCard';

/**
 * 复刻：两张人物卡片的特写，中间一段字打出来，一根红线把两张卡片连起来（78 帧，1280×720 @30fps）
 *
 * 接在「公司名大字 · 横甩到人物卡片」后面用：同样两张卡片（内容都已经出齐），镜头推到 2 倍，
 * 对准两张卡片中间（卡片坐标 636.5, 368 → 画面 662, 389）。两张卡片一起上下浮动，镜头往左慢慢漂。
 *
 * 中间的字：左边对齐在 x 484，三行，行距 45；英文是细斜体，中文 28px；
 * 打字速度：中文每字 3.4 帧、英文每字 0.9 帧，换行停 6 帧，末尾一个光标（按原片第 0、20、40、69 帧打到哪个字反推的）。
 * 红线：左卡片右上 (470, 145) → 右卡片 (865, 212)，另外两根从画面顶上垂下来吊着卡片。
 *
 * 只复刻画面，底部口播字幕不在模板里。
 */

export type CardsNoteProps = {
  background: string;
  cards: PersonCardData[];
  lines: string[];
  /** 打字开始的帧（原片开头第一行已经快打完了，所以是负数） */
  typeAt: number;
  threadColor: string;
  durationInFrames: number;
};

const SANS = '"PingFang SC", "Noto Sans CJK SC", "Source Han Sans SC", sans-serif';
const LATIN = '"Avenir Next", "Avenir", "Helvetica Neue", "Noto Sans CJK SC", sans-serif';

const ZOOM = { s: 2, worldX: 636.5, worldY: 368, screenX: 662, screenY: 389, driftPerFrame: -0.17 };
const CARD_POS = [{ x: 372, y: 367 }, { x: 896, y: 368 }];
const NOTE = { left: 484, firstTop: 290, lineHeight: 45, size: 28 };
const PER_CHAR = { cjk: 3.4, latin: 0.9, linePause: 6 };

/** 每个字出现的帧（相对开始打字）：中文慢、英文快 */
export function typeSchedule(lines: string[]): number[][] {
  let t = 0;
  return lines.map((line, li) => {
    if (li > 0) t += PER_CHAR.linePause;
    return Array.from(line).map((ch) => {
      const at = t;
      t += /[\x00-\xff]/.test(ch) ? PER_CHAR.latin : PER_CHAR.cjk;
      return at;
    });
  });
}

export const CardsNote: React.FC<CardsNoteProps> = (p) => {
  const frame = useCurrentFrame();
  const bob = 9 * Math.cos((2 * Math.PI * (frame + 30)) / 128);
  const drift = ZOOM.driftPerFrame * frame;
  const cam = `translate(${ZOOM.screenX + drift}px, ${ZOOM.screenY}px) scale(${ZOOM.s}) translate(${-ZOOM.worldX}px, ${-ZOOM.worldY}px)`;
  const schedule = typeSchedule(p.lines);
  const t = frame - p.typeAt;
  let cursor: { line: number; index: number } | null = null;
  schedule.forEach((times, li) => times.forEach((at, ci) => { if (t >= at) cursor = { line: li, index: ci }; }));

  return (
    <AbsoluteFill style={{ backgroundColor: '#e2e2e2', overflow: 'hidden' }}>
      <AbsoluteFill style={{ transform: `translateX(${drift}px) scale(1.15)` }}>
        <Media src={p.background} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', filter: 'blur(2px)' }} />
      </AbsoluteFill>

      {/* 红线（画面坐标，跟着卡片一起浮动） */}
      <svg width={1280} height={720} style={{ position: 'absolute', left: 0, top: 0, transform: `translate(${drift}px, ${bob * ZOOM.s}px)` }}>
        <line x1={470} y1={145} x2={865} y2={212} stroke={p.threadColor} strokeWidth={2.5} />
        <line x1={160} y1={-40} x2={160} y2={40} stroke={p.threadColor} strokeWidth={2} opacity={0.8} />
        <line x1={1225} y1={-40} x2={1225} y2={45} stroke={p.threadColor} strokeWidth={2} opacity={0.8} />
      </svg>

      {/* 镜头对焦在中间的字上，卡片是虚的 */}
      <AbsoluteFill style={{ transformOrigin: '0 0', transform: cam, filter: 'blur(2.2px)' }}>
        {p.cards.slice(0, 2).map((c, i) => {
          const pos = CARD_POS[i]!;
          return (
            <div key={i} style={{ position: 'absolute', left: pos.x - CARD.width / 2, top: pos.y + bob - CARD.height / 2, width: CARD.width, height: CARD.height }}>
              <PersonCard card={c} t={999} seed={`n${i}`} />
            </div>
          );
        })}
      </AbsoluteFill>

      {/* 中间打字 */}
      {p.lines.map((line, li) => {
        const chars = Array.from(line);
        const shown = chars.filter((_, ci) => t >= schedule[li]![ci]!).length;
        if (shown === 0) return null;
        const latin = /^[\x00-\xff]*$/.test(line);
        return (
          <div
            key={li}
            style={{
              position: 'absolute', left: NOTE.left + drift, top: NOTE.firstTop + li * NOTE.lineHeight, height: NOTE.lineHeight, lineHeight: `${NOTE.lineHeight}px`, whiteSpace: 'pre',
              fontFamily: latin ? LATIN : SANS, fontStyle: latin ? 'italic' : 'normal', fontWeight: 400, fontSize: NOTE.size, color: '#2b2b2b',
            }}
          >
            {chars.slice(0, shown).join('')}
            {cursor && (cursor as { line: number }).line === li && frame % 16 < 10 && <span style={{ fontStyle: 'normal', color: '#555' }}>|</span>}
          </div>
        );
      })}
      <AbsoluteFill style={{ background: 'radial-gradient(ellipse 72% 78% at 50% 48%, rgba(0,0,0,0) 55%, rgba(0,0,0,0.18) 85%, rgba(0,0,0,0.38) 100%)' }} />
    </AbsoluteFill>
  );
};

