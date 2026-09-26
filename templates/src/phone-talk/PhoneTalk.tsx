import React from 'react';
import { AbsoluteFill, Img, interpolate, useCurrentFrame } from 'remotion';
import { assetUrl } from '../asset';

/**
 * 复刻：浅灰底上，一个拿着手机的人从下面升上来，手机那里伸出一个黑色尖角连到白色对话框，
 * 框里一个字一个字打出一句话；过一会儿下面弹出第二个框（回复），也一个字一个字打出来（303 帧，1280×720 @30fps）
 *
 * 按原片量的（最终位置）：
 *   人：左下，框 x 95 起、y 160–720
 *   第一个框：x 552–1100、y 245–329，圆角 26，深灰细边（2px）、浅灰白底，一点投影；字 35px 细黑体、字距 0.8，左 567、字底 299.5（在框里上下居中）
 *     尖角：从框的左下（555,306）–（566,326）收到手机那一点（默认 420,440），黑色、往尖那头渐淡一点
 *   第二个框：x 497–1097、y 373–529；字 31px、字距 1.1，左 537.5，两行字底 438.5 / 493（两行在框里上下居中），第一行空 70，第一句后面手动换行
 *   入场：人从下面 520 升上来，越来越慢（66 帧到位）；对话框跟着升（只升人的 0.82 倍，有点前后层次）；
 *     框里的字升得更快，第 26 帧就到位（字先到、框后到）
 *   打字：第一个框第 2 帧起每 6.1 帧一个字，直接出现、后面跟一根常亮的竖线（光标）；
 *     第二个框第 121 帧弹出（4 帧），第 156 帧起每 3 帧一个字，每个新字先从左往右露出来（3 帧）、同时从下面 12 像素升上来（6 帧）
 * 只复刻画面，底部口播字幕不在模板里。
 */

export type PhoneTalkProps = {
  person: string;
  tipX: number;
  tipY: number;
  ask: string;
  reply: string;
  askAt: number;
  askStep: number;
  replyAt: number;
  replyTypeAt: number;
  replyStep: number;
  durationInFrames: number;
};

const SANS = '"Noto Sans CJK SC", "PingFang SC", "Source Han Sans SC", "Hiragino Sans GB", sans-serif';
const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;

export const PERSON = { left: 95, top: 160, height: 560 };
export const ASK = { x0: 552, y0: 245, x1: 1100, y1: 329, size: 35, spacing: 0.8, left: 567, base: 299.5 };
export const REPLY = { x0: 497, y0: 373, x1: 1097, y1: 529, size: 31, spacing: 1.1, left: 537.5, bases: [438.5, 493], indent: 70, width: 545 };

/**
 * 行框里字底的位置：行高 lh 的一行，字底在行框顶往下 lh/2 + 0.436×字号（思源黑体的上下伸展算出来的；苹方差 2 像素左右）。
 * 反过来由想要的字底算行框顶。
 */
export function lineTop(base: number, size: number, lineHeight: number): number {
  return base - lineHeight / 2 - 0.436 * size;
}

const RISE_T = [0, 4, 6, 8, 10, 12, 14, 16, 20, 24, 28, 36, 46, 66];
const RISE_Y = [520, 350, 288.7, 240, 200, 167, 140, 116.5, 80.4, 55.6, 38.9, 19.1, 5.3, 0];
/** 第一个框里的字升得更快（比框先到位） */
const TEXT_T = [0, 4, 7, 10, 13, 16, 19, 22, 26];
const TEXT_Y = [260, 168, 114, 74, 48, 30, 16, 8, 0];

/** 人往下偏了多少（升上来的过程） */
export function rise(frame: number): number {
  return interpolate(frame, RISE_T, RISE_Y, clamp);
}

export function textRise(frame: number): number {
  return interpolate(frame, TEXT_T, TEXT_Y, clamp);
}

/** 回复框里新打出来的字：从左往右露出来（3 帧），同时从下面 12 像素升上来（6 帧，越来越慢） */
export function charIn(t: number): { wipe: number; dy: number } {
  const wipe = interpolate(t, [0, 3], [0.35, 1], clamp);
  const u = interpolate(t, [0, 6], [0, 1], clamp);
  return { wipe, dy: 12 * (1 - u) * (1 - u) };
}
/** 最后几个字还在动（其余的字已经落定，当普通文字排） */
const RISE_CHARS = 3;

export function typed(frame: number, at: number, step: number, total: number): number {
  if (frame < at) return 0;
  return Math.min(total, Math.floor((frame - at) / step) + 1);
}

export const PhoneTalk: React.FC<PhoneTalkProps> = (p) => {
  const frame = useCurrentFrame();
  const r = rise(frame);
  const rb = 0.82 * r;
  const askChars = Array.from(p.ask);
  const nAsk = typed(frame, p.askAt, p.askStep, askChars.length);
  const replyChars = Array.from(p.reply);
  const nReply = typed(frame, p.replyTypeAt, p.replyStep, replyChars.length);
  const replyU = interpolate(frame, [p.replyAt, p.replyAt + 4], [0, 1], clamp);
  const lineGap = REPLY.bases[1]! - REPLY.bases[0]!;
  const box: React.CSSProperties = { position: 'absolute', borderRadius: 26, border: '2px solid #262626', background: 'linear-gradient(to bottom, #e6e6e3, #dcdcd9)', boxShadow: '2px 4px 8px rgba(0,0,0,0.18)', boxSizing: 'border-box' };
  // 原片的光标打字时一直亮着（不闪），打完就没了
  const cursor = (n: number, total: number) => n > 0 && n < total ? <span style={{ opacity: 0.6 }}>|</span> : null;
  return (
    <AbsoluteFill style={{ backgroundColor: '#dadad7', overflow: 'hidden' }}>
      <AbsoluteFill style={{ background: 'radial-gradient(ellipse 820px 520px at 700px 330px, #e4e4e1 0%, #d9d9d6 55%, #bdbdba 100%)' }} />
      {/* 人 */}
      {p.person && (
        <div style={{ position: 'absolute', left: PERSON.left, top: PERSON.top + r, height: PERSON.height }}>
          <Img src={assetUrl(p.person)} style={{ height: PERSON.height, width: 'auto', display: 'block', filter: 'drop-shadow(-10px 6px 14px rgba(0,0,0,0.25))' }} />
        </div>
      )}
      {/* 对话框（跟着人升上来，慢一点） */}
      <AbsoluteFill style={{ transform: `translateY(${rb.toFixed(1)}px)` }}>
        {p.ask && (
          <>
            <svg width={1280} height={720} style={{ position: 'absolute', left: 0, top: 0, overflow: 'visible' }}>
              <defs>
                <linearGradient id="pt-tail" gradientUnits="userSpaceOnUse" x1={p.tipX} y1={p.tipY - (r - rb)} x2={560} y2={316}>
                  <stop offset="0" stopColor="#2a2a2a" stopOpacity={0.55} /><stop offset="1" stopColor="#111" />
                </linearGradient>
              </defs>
              <polygon points={`${p.tipX},${(p.tipY + r - rb).toFixed(1)} 555,306 568,327`} fill="url(#pt-tail)" />
            </svg>
            <div style={{ ...box, left: ASK.x0, top: ASK.y0, width: ASK.x1 - ASK.x0, height: ASK.y1 - ASK.y0 }} />
            {nAsk > 0 && (
              <div style={{ position: 'absolute', left: ASK.left, top: lineTop(ASK.base, ASK.size, ASK.size) + textRise(frame) - rb, whiteSpace: 'pre', fontFamily: SANS, fontWeight: 300, fontSize: ASK.size, lineHeight: `${ASK.size}px`, letterSpacing: ASK.spacing, color: '#1e1e1e' }}>
                {askChars.slice(0, nAsk).join('')}{cursor(nAsk, askChars.length)}
              </div>
            )}
          </>
        )}
        {p.reply && replyU > 0 && (
          <>
            <div style={{ ...box, left: REPLY.x0, top: REPLY.y0, width: REPLY.x1 - REPLY.x0, height: REPLY.y1 - REPLY.y0, opacity: replyU, transform: `scale(${(0.94 + 0.06 * replyU).toFixed(3)})` }} />
            {nReply > 0 && (
              <div
                style={{
                  position: 'absolute', left: REPLY.left, top: lineTop(REPLY.bases[0]!, REPLY.size, lineGap), width: REPLY.width, fontFamily: SANS, fontWeight: 300, fontSize: REPLY.size,
                  lineHeight: `${lineGap}px`, letterSpacing: REPLY.spacing, textIndent: REPLY.indent, color: '#1e1e1e', whiteSpace: 'pre-wrap', overflow: 'hidden', maxHeight: lineGap * 2 + 4,
                }}
              >
                {replyChars.slice(0, Math.max(0, nReply - RISE_CHARS)).join('')}
                {replyChars.slice(Math.max(0, nReply - RISE_CHARS), nReply).map((ch, k) => {
                  const i = Math.max(0, nReply - RISE_CHARS) + k;
                  const t = frame - (p.replyTypeAt + i * p.replyStep);
                  if (ch === '\n' || ch === ' ') return ch;
                  const c = charIn(t);
                  return (
                    <span key={i} style={{ display: 'inline-block', textIndent: 0, transform: `translateY(${c.dy.toFixed(1)}px)`, clipPath: c.wipe < 1 ? `inset(-20% ${((1 - c.wipe) * 100).toFixed(0)}% -20% 0)` : undefined }}>{ch}</span>
                  );
                })}
              </div>
            )}
          </>
        )}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
