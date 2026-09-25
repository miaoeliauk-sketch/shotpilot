import React from 'react';
import { AbsoluteFill, Easing, Img, interpolate, useCurrentFrame } from 'remotion';
import { assetUrl } from '../asset';
import { BUNDLED_FONTS, useBundledFont } from '../fonts';
import { Media } from '../media';
import { vignetteGradient } from '../lens';

/**
 * 复刻：虚化的口播人物照片上，先打出一句提问 → 左边一张票 + 绿色大百分比 → 右边一张票 + 红色大百分比 → 两边甩走、镜头往右一摆，
 * 左上一个银色大数字 + 一叠钞票 → 最后甩出去（400 帧，1280×720 @30fps）
 *
 * 按原片量的（「照片坐标」= 第 100 帧的画面；照片比画面宽，框是 x −420–1420、y −50–770）：
 *   镜头：开头从左下推过来 1.07 → 1.01（24 帧），100 帧 1 倍，之后慢慢拉远到 0.886（300 帧），
 *     300–324 帧往右一摆（画面中心对着照片 x 898），之后 0.88 倍不动
 *   提问条：#383838、高 80、右边对齐到 x 691、顶 y 240，白字 40px；第 50 帧从右往左长出来（一道细线 → 整条，16 帧），
 *     57 帧起打字（每字 1.85 帧）；116 帧往右一滑淡掉（8 帧）
 *   左边：票（中心 (216, 263)、150×290、斜 −22°）第 116 帧从左下飞进来（16 帧）；绿色「5%」x 303–565、y 103–420，第 118 帧从虚到实
 *   右边：票（中心 (1259, 245)、斜 +11°）和红色「40%」x 859–1200，第 246 帧从右边飞进来
 *   两边第 300 帧往下甩走（14 帧，越来越快）
 *   钞票（x −153–215、y 326–599）第 320 帧落下来，银色「600」（x −165–108、y 60–315）第 326 帧从虚到实，旁边小字「块钱」
 *   第 388 帧钞票和数字往左下甩出去（14 帧）
 * 只复刻画面，底部口播字幕不在模板里。
 */

export type PercentSide = { image: string; value: string; at: number };

export type TicketPercentProps = {
  presenter: string;
  question: string;
  questionAt: number;
  left: PercentSide;
  right: PercentSide;
  swapAt: number;
  money: string;
  amount: string;
  unit: string;
  moneyOutAt: number;
  vignette: boolean;
  durationInFrames: number;
};

const SANS = '"Noto Sans CJK SC", "PingFang SC", "Source Han Sans SC", "Hiragino Sans GB", sans-serif';
const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;

export const PHOTO = { x: -420, y: -50, w: 1840, h: 820 };
export const BAR = { right: 691, top: 240, h: 80, size: 40, pad: 14, step: 1.85 };
const TICKET = { w: 150, h: 290 };
export const LEFT = { ticket: { x: 216, y: 263, rot: -22 }, num: { x: 303, top: 103, h: 317 } };
export const RIGHT = { ticket: { x: 1259, y: 245, rot: 11 }, num: { x: 859, top: 103, h: 317 } };
export const MONEY = { bills: { x: -153, y: 326, w: 368, h: 273 }, num: { x: -165, top: 60, h: 255 } };
const NUM_SIZE = 388;
const NUM_SQUEEZE = 0.45;

const CAM_T = [0, 4, 6, 8, 10, 14, 18, 24, 60, 80, 100, 120, 124, 128, 132, 136, 140, 150, 160, 200, 260, 300, 304, 308, 312, 316, 320, 324, 360, 400];
const CAM_S = [1.09, 1.0701, 1.0584, 1.0485, 1.0372, 1.0244, 1.0166, 1.0116, 1.0086, 1.005, 1, 0.9921, 0.9902, 0.989, 0.987, 0.985, 0.9813, 0.9754, 0.9677, 0.9284, 0.8959, 0.8857, 0.8861, 0.885, 0.8843, 0.8837, 0.8832, 0.8822, 0.88, 0.88];
const CAM_X = [555, 575.2, 588.1, 599.7, 609.8, 625, 634.8, 640, 640, 640, 640, 626.6, 605, 581.8, 571.6, 567.8, 567.2, 567.6, 568.2, 571.2, 573.6, 578.4, 594.3, 632.4, 715.6, 816.6, 868.3, 890.4, 898.2, 898.2];
const CAM_Y = [470, 447.3, 430.1, 414.4, 401, 380.7, 367.5, 360, 360, 360, 360, 360, 360, 360, 360, 360, 360, 360, 360, 360, 360, 360, 360, 360, 360, 360, 360, 360, 360, 360];

/** 镜头：屏幕 = c + s·(照片坐标 − 画面中心)；时间按「甩走」的时间伸缩（原片 300 帧） */
export function camera(frame: number, swapAt: number) {
  const k = swapAt / 300;
  const t = frame <= swapAt ? frame / Math.max(0.01, k) : 300 + (frame - swapAt);
  return { s: interpolate(t, CAM_T, CAM_S, clamp), x: interpolate(t, CAM_T, CAM_X, clamp), y: interpolate(t, CAM_T, CAM_Y, clamp) };
}

/** 提问条：长出来的进度、打到第几个字、离开的进度 */
export function questionState(frame: number, at: number, text: string) {
  const t = frame - at;
  const n = Array.from(text).length;
  return {
    grow: Easing.out(Easing.cubic)(interpolate(t, [0, 16], [0, 1], clamp)),
    tall: Easing.out(Easing.quad)(interpolate(t, [6, 16], [0, 1], clamp)),
    typed: Math.max(0, Math.min(n, Math.floor((t - 7) / BAR.step) + 1)),
  };
}

export const TicketPercent: React.FC<TicketPercentProps> = (p) => {
  const frame = useCurrentFrame();
  useBundledFont('oswald');
  const cam = camera(frame, p.swapAt);
  const leaveQ = interpolate(frame, [p.left.at, p.left.at + 8], [0, 1], clamp);
  const q = questionState(frame, p.questionAt, p.question);
  const swap = Easing.in(Easing.quad)(interpolate(frame, [p.swapAt, p.swapAt + 14], [0, 1], clamp));
  const moneyAt = p.swapAt + 20;
  const moneyOut = Easing.in(Easing.quad)(interpolate(frame, [p.moneyOutAt, p.moneyOutAt + 14], [0, 1], clamp));
  return (
    <AbsoluteFill style={{ backgroundColor: '#8a8a8a', overflow: 'hidden' }}>
      <AbsoluteFill style={{ transformOrigin: '640px 360px', transform: `translate(${(cam.x - 640).toFixed(2)}px, ${(cam.y - 360).toFixed(2)}px) scale(${cam.s.toFixed(4)})` }}>
        <div style={{ position: 'absolute', left: PHOTO.x, top: PHOTO.y, width: PHOTO.w, height: PHOTO.h }}>
          <Media src={p.presenter} style={{ width: '100%', height: '100%' }} />
        </div>
        {/* 左：票 + 绿色百分比 */}
        {swap < 1 && (
          <div style={{ position: 'absolute', inset: 0, transform: `translate(${(-260 * swap).toFixed(1)}px, ${(420 * swap).toFixed(1)}px) rotate(${(-14 * swap).toFixed(2)}deg)` }}>
            <Side side={p.left} layout={LEFT} frame={frame} from={-1} tone="green" />
          </div>
        )}
        {swap < 1 && (
          <div style={{ position: 'absolute', inset: 0, transform: `translate(${(300 * swap).toFixed(1)}px, ${(420 * swap).toFixed(1)}px) rotate(${(12 * swap).toFixed(2)}deg)` }}>
            <Side side={p.right} layout={RIGHT} frame={frame} from={1} tone="red" />
          </div>
        )}
        {/* 钞票 + 银色数字 */}
        {frame >= moneyAt && moneyOut < 1 && (
          <div style={{ position: 'absolute', inset: 0, transform: `translate(${(-420 * moneyOut).toFixed(1)}px, ${(520 * moneyOut).toFixed(1)}px) rotate(${(-18 * moneyOut).toFixed(2)}deg)`, transformOrigin: '0 300px' }}>
            <Money frame={frame} at={moneyAt} image={p.money} amount={p.amount} unit={p.unit} />
          </div>
        )}
      </AbsoluteFill>
      {/* 提问条（屏幕上不动） */}
      {frame >= p.questionAt && leaveQ < 1 && p.question && <Question text={p.question} state={q} leave={leaveQ} />}
      {p.vignette && <AbsoluteFill style={{ background: vignetteGradient({ cx: 640, cy: 360, rx: 740, ry: 460, amount: 0.4, power: 2.4 }) }} />}
    </AbsoluteFill>
  );
};

const Question: React.FC<{ text: string; state: ReturnType<typeof questionState>; leave: number }> = ({ text, state, leave }) => {
  const chars = Array.from(text);
  // 整条宽度按整句定：40px 字 + 左右留白
  const w = chars.reduce((s, ch) => s + (/[\x00-\xff]/.test(ch) ? 0.5 : 1) * BAR.size, 0) * 0.98 + BAR.pad * 2;
  const shown = w * state.grow;
  const h = 4 + (BAR.h - 4) * state.tall;
  return (
    <div
      style={{
        position: 'absolute', left: BAR.right - shown + 40 * leave, top: BAR.top + BAR.h - h, width: shown, height: h, opacity: 1 - leave,
        background: 'rgba(52,52,52,0.96)', boxShadow: '4px 6px 12px rgba(0,0,0,0.3)', overflow: 'hidden',
      }}
    >
      <div style={{ position: 'absolute', left: BAR.pad, top: 0, height: BAR.h, lineHeight: `${BAR.h}px`, whiteSpace: 'pre', fontFamily: SANS, fontSize: BAR.size, color: '#f2f2f2' }}>
        {chars.slice(0, state.typed).join('')}
      </div>
    </div>
  );
};

type SideLayout = { ticket: { x: number; y: number; rot: number }; num: { x: number; top: number; h: number } };

const Side: React.FC<{ side: PercentSide; layout: SideLayout; frame: number; from: -1 | 1; tone: 'green' | 'red' }> = ({ side, layout, frame, from, tone }) => {
  const t = frame - side.at;
  if (t < 0) return null;
  const u = Easing.out(Easing.cubic)(interpolate(t, [0, 16], [0, 1], clamp));
  const numU = Easing.out(Easing.quad)(interpolate(t, [2, 14], [0, 1], clamp));
  const grad = tone === 'green' ? 'linear-gradient(to bottom, #c6f5dd 0%, #9fe6bf 45%, #6fd29d 100%)' : 'linear-gradient(to bottom, #f5b3b4 0%, #dd8587 45%, #c85e62 100%)';
  const edge = tone === 'green' ? '#4fa77a' : '#a8484c';
  const glow = tone === 'green' ? 'rgba(120,230,170,0.55)' : 'rgba(240,110,110,0.5)';
  return (
    <>
      {side.value && (
        <div
          style={{
            position: 'absolute', left: layout.num.x, top: layout.num.top - NUM_SIZE * 0.17, height: NUM_SIZE * 1.2, lineHeight: `${NUM_SIZE * 1.2}px`, whiteSpace: 'pre',
            fontFamily: `"${BUNDLED_FONTS.oswald.family}", ${SANS}`, fontWeight: 700, fontSize: NUM_SIZE, transform: `scaleX(${NUM_SQUEEZE})`, transformOrigin: '0 50%',
            opacity: numU, filter: `${numU < 0.98 ? `blur(${(10 * (1 - numU)).toFixed(1)}px) ` : ''}drop-shadow(0 0 16px ${glow})`,
          }}
        >
          <span style={{ position: 'absolute', left: 5, top: 5, color: edge }}>{side.value}</span>
          <span style={{ position: 'relative', color: 'transparent', backgroundImage: grad, WebkitBackgroundClip: 'text', backgroundClip: 'text' }}>{side.value}</span>
        </div>
      )}
      {side.image && (
        <div
          style={{
            position: 'absolute', left: layout.ticket.x - TICKET.w / 2, top: layout.ticket.y - TICKET.h / 2, width: TICKET.w, height: TICKET.h, opacity: Math.min(1, u * 3),
            transform: `translate(${(from * 380 * (1 - u)).toFixed(1)}px, ${(220 * (1 - u)).toFixed(1)}px) rotate(${(layout.ticket.rot + from * 40 * (1 - u)).toFixed(2)}deg)`,
            filter: `drop-shadow(8px 12px 12px rgba(0,0,0,0.35))${u < 0.95 ? ` blur(${(5 * (1 - u)).toFixed(1)}px)` : ''}`,
          }}
        >
          <Img src={assetUrl(side.image)} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
        </div>
      )}
    </>
  );
};

const Money: React.FC<{ frame: number; at: number; image: string; amount: string; unit: string }> = ({ frame, at, image, amount, unit }) => {
  const t = frame - at;
  const billsU = Easing.out(Easing.cubic)(interpolate(t, [0, 10], [0, 1], clamp));
  const numU = Easing.out(Easing.quad)(interpolate(t, [6, 14], [0, 1], clamp));
  const unitU = interpolate(t, [12, 18], [0, 1], clamp);
  const size = MONEY.num.h / 0.845;
  return (
    <>
      {image && (
        <div
          style={{
            position: 'absolute', left: MONEY.bills.x, top: MONEY.bills.y, width: MONEY.bills.w, height: MONEY.bills.h, opacity: billsU,
            transform: `translateY(${(-160 * (1 - billsU)).toFixed(1)}px) scale(${(1.15 - 0.15 * billsU).toFixed(3)})`,
            filter: `drop-shadow(10px 14px 14px rgba(0,0,0,0.45))${billsU < 0.95 ? ` blur(${(6 * (1 - billsU)).toFixed(1)}px)` : ''}`,
          }}
        >
          <Img src={assetUrl(image)} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
        </div>
      )}
      {amount && (
        <div
          style={{
            position: 'absolute', left: MONEY.num.x, top: MONEY.num.top - size * 0.22, height: size * 1.2, lineHeight: `${size * 1.2}px`, whiteSpace: 'pre', opacity: numU,
            fontFamily: `"${BUNDLED_FONTS.oswald.family}", ${SANS}`, fontWeight: 700, fontSize: size, transform: `scaleX(0.59)`, transformOrigin: '0 50%',
            filter: numU < 0.98 ? `blur(${(8 * (1 - numU)).toFixed(1)}px)` : undefined,
          }}
        >
          <span style={{ position: 'absolute', left: 6, top: 6, color: '#5b5b5b' }}>{amount}</span>
          <span style={{ position: 'relative', color: 'transparent', backgroundImage: 'linear-gradient(to bottom, #f4f4f4 0%, #bdbdbd 45%, #8d8d8d 100%)', WebkitBackgroundClip: 'text', backgroundClip: 'text' }}>{amount}</span>
        </div>
      )}
      {unit && (
        <div style={{ position: 'absolute', left: MONEY.num.x + 290, top: MONEY.num.top + MONEY.num.h - 62, whiteSpace: 'pre', fontFamily: SANS, fontWeight: 900, fontSize: 46, color: '#6c6c6c', opacity: unitU }}>
          {unit}
        </div>
      )}
    </>
  );
};
