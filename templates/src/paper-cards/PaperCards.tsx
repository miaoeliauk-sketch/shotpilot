import React from 'react';
import { Easing, interpolate } from 'remotion';

/**
 * 一叠米黄色小纸片（「老牌律师 · 纸片堆」「文件截图 · 人物 · 金色数字」两个模板共用）。
 *
 * 每张纸 200×245：衬线大字（两行排不下就一行）、下面一行灰色英文小字、右上角圆圈编号、
 * 下面一个牛皮纸信封；纸片斜着，从某个点（比如手里）一张张飞出来：
 * 先小、虚、转得多，8 帧落到位置上（先快后慢）。
 */

export type PaperSlot = { x: number; y: number; rot: number; at: number; n: number; from?: [number, number] };

export const PAPER = { w: 200, h: 245 };
const SERIF = '"Noto Serif CJK SC", "Songti SC", "STSong", "Source Han Serif SC", serif';
const LATIN = '"Georgia", "Times New Roman", serif';
const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;

export function paperPose(slot: PaperSlot, frame: number, fly = 8) {
  const u = Easing.out(Easing.cubic)(interpolate(frame, [slot.at, slot.at + fly], [0, 1], clamp));
  const [fx, fy] = slot.from ?? [slot.x, slot.y + 120];
  return {
    visible: frame >= slot.at,
    x: fx + (slot.x - fx) * u,
    y: fy + (slot.y - fy) * u,
    rot: slot.rot + (1 - u) * 35,
    scale: 0.45 + 0.55 * u,
    blur: 6 * (1 - u),
    opacity: Math.min(1, u * 3),
  };
}

export const PaperCard: React.FC<{ title: string; sub: string; n: number; x: number; y: number; rot: number; scale?: number; blur?: number; opacity?: number }> = ({
  title, sub, n, x, y, rot, scale = 1, blur = 0, opacity = 1,
}) => (
  <div
    style={{
      position: 'absolute', left: x - PAPER.w / 2, top: y - PAPER.h / 2, width: PAPER.w, height: PAPER.h, transform: `rotate(${rot}deg) scale(${scale})`, opacity,
      background: 'linear-gradient(160deg, #f7efc4 0%, #f0e5b0 60%, #e6d89e 100%)', boxShadow: '0 8px 14px rgba(40,30,10,0.35), inset 0 0 0 1px rgba(150,130,80,0.35)',
      filter: blur > 0.1 ? `blur(${blur.toFixed(1)}px)` : undefined,
    }}
  >
    <div style={{ position: 'absolute', left: 14, right: 14, top: 22, textAlign: 'center', fontFamily: SERIF, fontSize: 34, lineHeight: '42px', color: '#2b2618', whiteSpace: 'pre' }}>{title}</div>
    {sub && <div style={{ position: 'absolute', left: 0, right: 0, top: 70, textAlign: 'center', fontFamily: LATIN, fontSize: 12, color: 'rgba(60,55,40,0.6)' }}>{sub}</div>}
    {/* 编号 */}
    <div
      style={{
        position: 'absolute', right: -8, top: 96, width: 34, height: 34, borderRadius: 17, background: '#f6eed0', boxShadow: 'inset 0 0 0 2px #6a5b3a, 0 2px 3px rgba(0,0,0,0.3)',
        textAlign: 'center', lineHeight: '34px', fontFamily: LATIN, fontSize: 22, color: '#3a3020',
      }}
    >
      {n}
    </div>
    {/* 信封 */}
    <svg viewBox="0 0 120 100" width={120} height={100} style={{ position: 'absolute', left: 38, top: 128 }}>
      <path d="M8 8 L112 4 L116 96 L10 98 Z" fill="#c9a07a" />
      <path d="M8 8 L112 4 L110 22 L10 26 Z" fill="#b88c64" />
      <rect x="48" y="12" width="24" height="6" rx="3" fill="#8a6446" />
      <circle cx="60" cy="56" r="5" fill="#f2e6d2" stroke="#6b4c34" strokeWidth="2" />
    </svg>
  </div>
);

export const PaperPile: React.FC<{ slots: PaperSlot[]; title: string; sub: string; frame: number; fly?: number }> = ({ slots, title, sub, frame, fly }) => (
  <>
    {slots.map((s, i) => {
      const p = paperPose(s, frame, fly);
      if (!p.visible) return null;
      return <PaperCard key={i} title={title} sub={sub} n={s.n} x={p.x} y={p.y} rot={p.rot} scale={p.scale} blur={p.blur} opacity={p.opacity} />;
    })}
  </>
);
