import React from 'react';
import { AbsoluteFill, Easing, Img, interpolate, useCurrentFrame } from 'remotion';
import { assetUrl, bundledUrl } from '../asset';
import { Media } from '../media';

/**
 * 复刻：暗色做旧背景上，撕纸边的产品图卡片一张接一张（160 帧，1280×720 @30fps）
 *
 * ── 动作（跟踪卡片里的产品量的）──────────────────────────────────────
 *   第一张  534×534，从左下角画面外斜着升上来：顺时针斜 16° → 摆正，三次方减速，第 3–53 帧；
 *           停在 (620, 364)，第 48 帧开始往左越甩越快，28 帧出画
 *   之后每张 392×392，从右边画面外滑进来，停在画面中间 (640, 360)；
 *           减速很有特点：离终点的距离每 8 帧减半（指数减速），一直慢慢挪到最后
 *   前一张在下一张进来前 24 帧开始往左甩出去
 *
 * 卡片：白底 + 产品图，边缘是撕纸的毛边（一圈棕色细边，往里十几像素有灰色斑点），用自带的遮罩和叠层做。
 * 只复刻画面，底部口播字幕不在模板里。
 */

export type Card = { image: string; size: number; at: number };

export type TornCardsProps = {
  background: string;
  cards: Card[];
  durationInFrames: number;
};

const FIRST_IN = { frames: 50, fromX: 300, fromY: 860, fromRot: 16, toX: 620, toY: 364 };
const SLIDE_IN = { fromX: 1480, halfLife: 8 };
/** 甩出去：往左的位移（相对开始甩的那一帧，每 4 帧量一次），越来越快 */
const EXIT_T = [0, 4, 8, 12, 16, 20, 24, 28];
const EXIT_D = [0, 5, 46, 88, 207, 384, 760, 1100];
const EXIT = { lead: 24 };

const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;

/** 第 i 张卡片在第 frame 帧的位置、角度；不在画面里返回 null */
export function cardPose(i: number, cards: Card[], frame: number): { x: number; y: number; rot: number } | null {
  const c = cards[i]!;
  const t = frame - c.at;
  if (t < 0) return null;
  let x: number;
  let y: number;
  let rot = 0;
  if (i === 0) {
    const u = Easing.out(Easing.cubic)(interpolate(t, [0, FIRST_IN.frames], [0, 1], clamp));
    x = FIRST_IN.fromX + (FIRST_IN.toX - FIRST_IN.fromX) * u;
    y = FIRST_IN.fromY + (FIRST_IN.toY - FIRST_IN.fromY) * u;
    rot = FIRST_IN.fromRot * (1 - Easing.out(Easing.quad)(interpolate(t, [0, FIRST_IN.frames], [0, 1], clamp)));
  } else {
    x = 640 + (SLIDE_IN.fromX - 640) * 2 ** (-t / SLIDE_IN.halfLife);
    y = 360;
  }
  const next = cards[i + 1];
  if (next) {
    const te = frame - (next.at - EXIT.lead);
    if (te >= EXIT_T[EXIT_T.length - 1]!) return null;
    x -= interpolate(te, EXIT_T, EXIT_D, clamp);
  }
  return { x, y, rot };
}

export const TornCards: React.FC<TornCardsProps> = (p) => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{ backgroundColor: '#0c0c0c', overflow: 'hidden' }}>
      <Media src={p.background} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />
      {p.cards.map((c, i) => {
        const pose = cardPose(i, p.cards, frame);
        if (!pose) return null;
        const mask = `url(${bundledUrl('torn-cards/mask.png')})`;
        return (
          <div
            key={i}
            style={{
              position: 'absolute', left: pose.x - c.size / 2, top: pose.y - c.size / 2, width: c.size, height: c.size,
              transform: `rotate(${pose.rot.toFixed(3)}deg)`,
            }}
          >
            <div style={{ position: 'absolute', inset: 0, backgroundColor: '#f6f6f6', WebkitMaskImage: mask, maskImage: mask, WebkitMaskSize: '100% 100%', maskSize: '100% 100%' }}>
              <Img src={assetUrl(c.image)} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
              <Img src={bundledUrl('torn-cards/edge.png')} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />
            </div>
          </div>
        );
      })}
      <AbsoluteFill style={{ background: 'radial-gradient(ellipse 70% 75% at 50% 45%, rgba(0,0,0,0) 50%, rgba(0,0,0,0.5) 100%)' }} />
    </AbsoluteFill>
  );
};
