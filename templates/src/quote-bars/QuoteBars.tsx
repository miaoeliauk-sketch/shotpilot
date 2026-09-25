import React from 'react';
import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from 'remotion';
import { Media } from '../media';
import { layoutBody, measure } from '../text-layout';
import { vignetteGradient } from '../lens';

/**
 * 复刻：深色网格底上一个人名大标题、一段引文，之后白条金句一条条斜着扫出来（410 帧，1280×720 @30fps）
 *
 * 按原片量的（镜头 1 倍 = 原片第 45 帧）：
 *   标题：中文粗黑斜体（83px、压到 0.94），x 25 起，字身 y 45–122；后面英文名金色、压窄的衬线斜体，括号括起来
 *     0–20 帧从左往右扫出来（边上软）；标题下面 y 161 一道两头淡的细亮线
 *   引文：25px 白字、字距 5.5、行距 52.5，首行缩进 1.3 字，x 32–1257；重点句淡金色、底下一道细线
 *     一行一行从左往右扫出来：第 0、9、17、24 帧起，各 12 帧
 *   背景：15–24 帧从黑里亮起来（#161616，118px 的淡网格）
 *   白条：#ebedeb，高 83、行距 110.6，第一条条顶 y 403；字 44px 黑色粗斜体、字距 5.9，左右各留 22；暗角只压背景
 *     一条出来：从左边 70px 外滑进来（20 帧），同时斜着的软边从左往右扫（上沿比下沿快 340px，每帧 32px）
 *   镜头（以画面中心）：45 帧后慢慢拉远到 0.914 倍，最后一条白条出来时再推回 1.005 倍
 * 只复刻画面，底部口播字幕不在模板里。
 */

export type QuoteBar = { text: string; at: number };

export type QuoteBarsProps = {
  background: string;
  name: string;
  nameEn: string;
  body: string;
  highlight: string;
  bars: QuoteBar[];
  durationInFrames: number;
};

const SANS = '"Noto Sans CJK SC", "PingFang SC", "Source Han Sans SC", "Hiragino Sans GB", sans-serif';
const SERIF = '"Noto Serif CJK SC", "Songti SC", "STSong", "Source Han Serif SC", serif';
const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;

export const TITLE = { left: 25, top: 26.5, size: 83, squeeze: 0.94, skew: -11, weight: 700 };
export const BODY = { left: 32, right: 1257, firstCenter: 214, size: 25, lineHeight: 52.5, letterSpacing: 5.5, indent: 1.3 };
export const BAR = { left: 30, top: 403, h: 83, pitch: 110.6, size: 44, spacing: 5.9, weight: 700, pad: 22, slant: 340, speed: 32, slide: 70 };
const LINE_STARTS = [0, 9, 17, 24];

/** 镜头：45 帧前 1.005 → 1，之后拉远到 0.914（约 225 帧），最后一条白条出来时推回 1.005（约 135 帧） */
export function cameraScale(frame: number, lastBarAt: number): number {
  const pullT = [0, 15, 30, 45, 60, 75, 90, 105, 120, 135, 150, 165, 180, 195, 210, 225, 240, 255, 270];
  const pullS = [1.005, 1.005, 1.0027, 1, 0.9961, 0.991, 0.9846, 0.9767, 0.9679, 0.9585, 0.9492, 0.9406, 0.9331, 0.927, 0.9222, 0.9186, 0.9161, 0.9146, 0.9143];
  const pushStart = Math.max(46, lastBarAt + 8);
  // 拉远的曲线按「推回开始」伸缩（原片 270 帧开始推回，那时 0.914 倍）
  const k = (pushStart - 45) / (270 - 45);
  const pullFrame = frame <= 45 ? frame : 45 + (Math.min(frame, pushStart) - 45) / k;
  const pulled = interpolate(pullFrame, pullT, pullS, clamp);
  if (frame <= pushStart) return pulled;
  const bottom = pullS[pullS.length - 1]!;
  const pushT = [0, 15, 30, 45, 60, 75, 90, 105, 120, 135];
  const pushS = [0, 0.033, 0.105, 0.227, 0.396, 0.587, 0.759, 0.883, 0.961, 1];
  return bottom + (1.005 - bottom) * interpolate(frame - pushStart, pushT, pushS, clamp);
}

/** 标题扫出来的软边位置（x） */
export function titleEdge(frame: number): number {
  return interpolate(frame, [0, 2, 4, 6, 8, 10, 14, 20], [-60, 110, 260, 600, 720, 860, 1180, 1400], clamp);
}

/** 白条：滑进来的偏移、斜边扫到哪（上沿相对条左边的 x） */
export function barReveal(frame: number, at: number) {
  const t = frame - at;
  return {
    dx: -BAR.slide * (1 - Easing.out(Easing.cubic)(interpolate(t, [0, 20], [0, 1], clamp))),
    edge: BAR.speed * Math.max(0, t),
  };
}

/** 从左往右扫的软边遮罩（edge = 软边中点，soft = 软边宽） */
const sweepMask = (edge: number, soft: number): React.CSSProperties => {
  const m = `linear-gradient(to right, #000 ${(edge - soft / 2).toFixed(1)}px, transparent ${(edge + soft / 2).toFixed(1)}px)`;
  return { WebkitMaskImage: m, maskImage: m };
};

export const QuoteBars: React.FC<QuoteBarsProps> = (p) => {
  const frame = useCurrentFrame();
  const lastBarAt = p.bars.length ? Math.max(...p.bars.map((b) => b.at)) : 1e4;
  const cam = cameraScale(frame, lastBarAt);
  const bgU = interpolate(frame, [15, 24], [0, 1], clamp);
  const layout = layoutBody([{ text: p.body, highlight: p.highlight }], { ...BODY, paragraphGap: 0 }, SANS);
  // 重点句的底线：重点字最多的那一行，从第一个到最后一个重点字
  const hlByLine = new Map<number, { x0: number; x1: number; center: number; n: number }>();
  for (const c of layout.chars) {
    if (!c.highlight) continue;
    const cur = hlByLine.get(c.line) ?? { x0: c.x, x1: c.x + c.width, center: c.center, n: 0 };
    cur.x0 = Math.min(cur.x0, c.x);
    cur.x1 = Math.max(cur.x1, c.x + c.width - BODY.letterSpacing);
    cur.n += 1;
    hlByLine.set(c.line, cur);
  }
  const underline = [...hlByLine.entries()].sort((a, b) => b[1].n - a[1].n)[0];
  const tEdge = titleEdge(frame);
  return (
    <AbsoluteFill style={{ backgroundColor: '#000', overflow: 'hidden' }}>
      <AbsoluteFill style={{ transformOrigin: '640px 360px', transform: `scale(${cam.toFixed(4)})` }}>
        {/* 背景：深色 + 淡网格（或者自己的图） */}
        <div style={{ position: 'absolute', left: -60, top: -34, width: 1400, height: 788, opacity: bgU }}>
          {p.background ? (
            <Media src={p.background} style={{ width: '100%', height: '100%' }} />
          ) : (
            <div
              style={{
                width: '100%', height: '100%', backgroundColor: '#161616',
                backgroundImage: 'linear-gradient(to right, rgba(255,255,255,0.045) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.045) 1px, transparent 1px)',
                backgroundSize: '118px 118px', backgroundPosition: '44px 12px',
              }}
            />
          )}
        </div>
        {/* 暗角只压背景，白条、字不受影响 */}
        <AbsoluteFill style={{ background: vignetteGradient({ cx: 640, cy: 360, rx: 780, ry: 480, amount: 0.3, power: 2.4 }), opacity: bgU }} />
        {/* 标题 */}
        <div style={{ position: 'absolute', left: 0, top: 0, width: 1280, height: 180, ...sweepMask(tEdge, 160) }}>
          <Title name={p.name} nameEn={p.nameEn} />
        </div>
        {/* 细亮线 */}
        <div
          style={{
            position: 'absolute', left: 0, top: 160, width: 1280, height: 2.5, opacity: interpolate(frame, [6, 18], [0, 1], clamp),
            background: 'linear-gradient(to right, rgba(255,255,255,0) 0%, rgba(235,235,235,0.9) 14%, rgba(240,240,240,0.95) 50%, rgba(235,235,235,0.9) 86%, rgba(255,255,255,0) 100%)',
          }}
        />
        {/* 引文：一行一行扫出来 */}
        {Array.from({ length: layout.lines }, (_, li) => {
          const start = LINE_STARTS[li] ?? LINE_STARTS[LINE_STARTS.length - 1]! + (li - LINE_STARTS.length + 1) * 7;
          const edge = interpolate(frame, [start, start + 12], [BODY.left - 150, BODY.right + 150], clamp);
          if (frame < start) return null;
          const chars = layout.chars.filter((c) => c.line === li);
          return (
            <div key={li} style={{ position: 'absolute', left: 0, top: 0, width: 1280, height: 720, ...sweepMask(edge, 260) }}>
              {chars.map((c, k) => (
                <div
                  key={k}
                  style={{
                    position: 'absolute', left: c.x, top: c.center - BODY.size * 0.7, height: BODY.size * 1.4, lineHeight: `${BODY.size * 1.4}px`, whiteSpace: 'pre',
                    fontFamily: SANS, fontSize: BODY.size, fontWeight: c.highlight ? 500 : 400, color: c.highlight ? '#dcbc9f' : '#ececec',
                  }}
                >
                  {c.ch}
                </div>
              ))}
              {underline && underline[0] === li && (
                <div
                  style={{
                    position: 'absolute', left: underline[1].x0 - 10, width: underline[1].x1 - underline[1].x0 + 20, top: underline[1].center + BODY.size * 0.72, height: 2,
                    background: 'linear-gradient(to right, rgba(220,190,150,0), rgba(235,215,190,0.95) 12%, rgba(240,225,205,0.95) 85%, rgba(220,190,150,0))',
                  }}
                />
              )}
            </div>
          );
        })}
        {/* 白条 */}
        {p.bars.map((b, i) => (
          <Bar key={i} text={b.text} top={BAR.top + i * BAR.pitch} frame={frame} at={b.at} />
        ))}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

const Title: React.FC<{ name: string; nameEn: string }> = ({ name, nameEn }) => {
  const zhFont = `${TITLE.weight} ${TITLE.size}px ${SANS}`;
  const zhW = measure(name, zhFont) * TITLE.squeeze;
  const en = nameEn.trim();
  return (
    <>
      <div
        style={{
          position: 'absolute', left: TITLE.left, top: TITLE.top, height: TITLE.size * 1.3, lineHeight: `${TITLE.size * 1.3}px`, whiteSpace: 'pre',
          fontFamily: SANS, fontWeight: TITLE.weight, fontSize: TITLE.size, color: '#fbfbfb', transformOrigin: '0 50%',
          transform: `skewX(${TITLE.skew}deg) scaleX(${TITLE.squeeze})`, textShadow: '0 2px 6px rgba(0,0,0,0.5)',
        }}
      >
        {name}
      </div>
      {en && (
        <div
          style={{
            position: 'absolute', left: TITLE.left + zhW + 22, top: TITLE.top - 4, height: TITLE.size * 1.3, lineHeight: `${TITLE.size * 1.3}px`, whiteSpace: 'pre',
            fontFamily: SERIF, fontWeight: 600, fontSize: TITLE.size * 1.15, transformOrigin: '0 50%',
            transform: `skewX(${TITLE.skew}deg) scaleX(0.61)`, color: 'transparent',
            backgroundImage: 'linear-gradient(to bottom, #f3dcc0 10%, #d9ad82 55%, #b98a5e 95%)', WebkitBackgroundClip: 'text', backgroundClip: 'text',
          }}
        >
          {`( ${en} )`}
        </div>
      )}
    </>
  );
};

const Bar: React.FC<{ text: string; top: number; frame: number; at: number }> = ({ text, top, frame, at }) => {
  if (frame < at) return null;
  const { dx, edge } = barReveal(frame, at);
  const font = `${BAR.weight} ${BAR.size}px ${SANS}`;
  const w = measure(text, font) + BAR.spacing * Array.from(text).length + BAR.pad * 2;
  const h = BAR.h;
  // 斜边：x + k·y = edge（上沿在前）；CSS 渐变沿着法线方向
  const k = BAR.slant / h;
  const n = Math.hypot(1, k);
  const dir = [1 / n, k / n] as const;
  const theta = (Math.atan2(dir[0], -dir[1]) * 180) / Math.PI;
  const L = w * Math.abs(dir[0]) + h * Math.abs(dir[1]);
  const s0 = [w / 2 - (L / 2) * dir[0], h / 2 - (L / 2) * dir[1]];
  const c = [edge - (k * h) / 2, h / 2];
  const tc = (c[0]! - s0[0]!) * dir[0] + (c[1]! - s0[1]!) * dir[1];
  const soft = 40;
  const mask = `linear-gradient(${theta.toFixed(2)}deg, #000 ${(tc - soft / 2).toFixed(1)}px, transparent ${(tc + soft / 2).toFixed(1)}px)`;
  return (
    <div
      style={{
        position: 'absolute', left: BAR.left + dx, top, width: w, height: h, background: '#ebedeb', boxShadow: '0 6px 14px rgba(0,0,0,0.35)',
        WebkitMaskImage: mask, maskImage: mask,
      }}
    >
      <div
        style={{
          position: 'absolute', left: BAR.pad, top: -1, height: h, lineHeight: `${h}px`, whiteSpace: 'pre', fontFamily: SANS, fontWeight: BAR.weight, fontSize: BAR.size, letterSpacing: BAR.spacing,
          color: '#141414', transform: 'skewX(-10deg)', transformOrigin: '0 60%',
        }}
      >
        {text}
      </div>
    </div>
  );
};
