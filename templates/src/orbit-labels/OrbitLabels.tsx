import React from 'react';
import { AbsoluteFill, Easing, Img, interpolate, random, useCurrentFrame } from 'remotion';
import { assetUrl } from '../asset';
import { Media } from '../media';

/**
 * 复刻：中心配图 + 周围几个关键词标签，一个椭圆把它们串起来（450 帧，1280×720 @30fps）
 *
 * ── 结构（第 449 帧量的，镜头停在 1 倍）───────────────────────────────
 *   中心    灰色方框「人才」x 470–685、y 240–398，右下叠一块深灰方框「流动」x 686–800、y 352–433；
 *           前面是人物配图（抠好图的 PNG），上方一个深蓝小圆点 (638, 211)
 *   标签    右 (1025, 362)、左 (255, 362)、上 (644, 102)：左边垫一块淡紫色菱形，大字粗宋、从深蓝渐变到亮蓝，下面一行斜体英文
 *   椭圆    中心 (623, 344)，横半径 421、竖半径 231，细灰线
 *
 * ── 动作 ─────────────────────────────────────────────────────────────
 *   镜头从 1.45 倍一路慢慢拉远到 1 倍（先快后慢，约 13 秒），中心 (635, 357)
 *   10–22 帧中心配图「故障切片」出现；30–50 帧「流动」方框滑出来
 *   标签依次出现（原片第 63、135、201 帧）：菱形放大淡入，大字从左往右刷出来，英文随后淡入
 *   椭圆从第一个标签开始顺时针画，经过每个标签时正好画到那里，最后一个标签出来后 35 帧画满一圈
 *   中心有一道蓝光时亮时暗
 *
 * 只复刻画面，底部口播字幕不在模板里。
 */

export type OrbitLabel = { text: string; english: string; side: 'right' | 'left' | 'top' | 'bottom'; at: number };

export type OrbitLabelsProps = {
  background: string;
  centerImage: string;
  word1: string;
  word1English: string;
  word2: string;
  labels: OrbitLabel[];
  accent: string;
  centerAt: number;
  durationInFrames: number;
};

const SERIF = '"Songti SC", "STSong", "Noto Serif CJK SC", "Source Han Serif SC", serif';
const LATIN = '"Georgia", "Times New Roman", serif';

const ELLIPSE = { cx: 623, cy: 344, rx: 421, ry: 231 };
export const SIDES: Record<OrbitLabel['side'], { x: number; y: number; angle: number }> = {
  right: { x: 1025, y: 362, angle: 0 },
  bottom: { x: 640, y: 590, angle: 90 },
  left: { x: 255, y: 362, angle: 180 },
  top: { x: 644, y: 102, angle: 270 },
};
const BOX1 = { left: 470, top: 240, width: 215, height: 158 };
const BOX2 = { left: 686, top: 352, width: 114, height: 81 };
const IMAGE = { left: 480, top: 236, width: 270, height: 254 };

const CAM_T = [0, 24, 40, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330, 360, 390, 450];
const CAM_S = [1.45, 1.375, 1.31, 1.255, 1.195, 1.15, 1.12, 1.09, 1.065, 1.05, 1.035, 1.02, 1.015, 1.01, 1.005, 1];
const CAM_ANCHOR = { x: 635, y: 357 };

const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;

/** 椭圆画到哪（0–1）：第一个标签出现时从 0 开始，经过每个标签的角度时正好到那里，最后一个之后 35 帧画满 */
export function orbitProgress(frame: number, labels: OrbitLabel[]): number {
  if (labels.length === 0) return 0;
  const sorted = [...labels].sort((a, b) => a.at - b.at);
  const first = SIDES[sorted[0]!.side].angle;
  const ts: number[] = [];
  const ps: number[] = [];
  let lastAngle = 0;
  sorted.forEach((l, i) => {
    let a = (SIDES[l.side].angle - first + 360) % 360;
    if (i > 0 && a <= lastAngle) a += 360 * Math.ceil((lastAngle - a + 1) / 360);
    ts.push(l.at);
    ps.push(Math.min(360, a) / 360);
    lastAngle = a;
  });
  ts.push(sorted[sorted.length - 1]!.at + 35);
  ps.push(1);
  return interpolate(frame, ts, ps, clamp);
}

export const OrbitLabels: React.FC<OrbitLabelsProps> = (p) => {
  const frame = useCurrentFrame();
  const s = interpolate(frame, CAM_T, CAM_S, clamp);
  const cam = `translate(${CAM_ANCHOR.x}px, ${CAM_ANCHOR.y}px) scale(${s}) translate(${-CAM_ANCHOR.x}px, ${-CAM_ANCHOR.y}px)`;
  const orbit = orbitProgress(frame, p.labels);
  const firstAngle = p.labels.length ? SIDES[[...p.labels].sort((a, b) => a.at - b.at)[0]!.side].angle : 0;
  const circumference = Math.PI * (3 * (ELLIPSE.rx + ELLIPSE.ry) - Math.sqrt((3 * ELLIPSE.rx + ELLIPSE.ry) * (ELLIPSE.rx + 3 * ELLIPSE.ry)));
  const glow = 0.25 + 0.75 * Math.max(0, Math.sin(((frame - 60) / 85) * Math.PI * 2));

  return (
    <AbsoluteFill style={{ backgroundColor: '#d8d8d8', overflow: 'hidden' }}>
      <AbsoluteFill style={{ transformOrigin: '0 0', transform: cam }}>
        <div style={{ position: 'absolute', left: -320, top: -180, width: 1920, height: 1080 }}>
          <Media src={p.background} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />
        </div>

        {/* 椭圆：从第一个标签的位置顺时针画 */}
        {orbit > 0 && (
          <svg width={1280} height={720} style={{ position: 'absolute', left: 0, top: 0, overflow: 'visible' }}>
            <ellipse
              cx={ELLIPSE.cx} cy={ELLIPSE.cy} rx={ELLIPSE.rx} ry={ELLIPSE.ry} fill="none" stroke="rgba(60,60,64,0.75)" strokeWidth={2}
              strokeDasharray={`${circumference * orbit} ${circumference}`}
              transform={`rotate(${firstAngle} ${ELLIPSE.cx} ${ELLIPSE.cy})`}
            />
          </svg>
        )}

        <Center p={p} frame={frame} glow={glow} />

        {p.labels.map((l, i) => <LabelView key={i} l={l} frame={frame} accent={p.accent} />)}
      </AbsoluteFill>
      <AbsoluteFill style={{ background: 'radial-gradient(ellipse 70% 75% at 50% 48%, rgba(0,0,0,0) 50%, rgba(0,0,0,0.22) 80%, rgba(0,0,0,0.5) 100%)' }} />
    </AbsoluteFill>
  );
};

/** 中心：两块方框 + 配图 + 小圆点。开头「故障切片」出现：横条一条条错位闪出来 */
const Center: React.FC<{ p: OrbitLabelsProps; frame: number; glow: number }> = ({ p, frame, glow }) => {
  const t = frame - p.centerAt;
  if (t < 0) return null;
  const settle = interpolate(t, [0, 12], [0, 1], clamp);
  const bands = 7;
  const box2 = Easing.out(Easing.cubic)(interpolate(t, [20, 34], [0, 1], clamp));
  const word2 = interpolate(t, [26, 40], [0, 1], clamp);
  const content = (
    <>
      <div
        style={{
          position: 'absolute', ...BOX1, background: 'linear-gradient(100deg, #7d7d80 0%, #a9a9ad 45%, #c9ccd6 75%, #b5b8c2 100%)',
          boxShadow: '0 6px 16px rgba(0,0,0,0.18)',
        }}
      >
        <div style={{ position: 'absolute', left: 95, top: 12, fontFamily: SERIF, fontWeight: 700, fontSize: 64, lineHeight: 1, color: '#3c3c40', whiteSpace: 'pre' }}>{p.word1}</div>
        <div style={{ position: 'absolute', left: 104, top: 118, fontFamily: LATIN, fontSize: 18, color: 'rgba(255,255,255,0.55)', whiteSpace: 'pre' }}>{p.word1English}</div>
      </div>
      <div
        style={{
          position: 'absolute', left: BOX2.left - BOX2.width * (1 - box2), top: BOX2.top, width: BOX2.width, height: BOX2.height, opacity: box2,
          background: 'linear-gradient(90deg, #8c8c90, #6e6e72)', boxShadow: '0 6px 16px rgba(0,0,0,0.2)',
        }}
      >
        <div
          style={{
            position: 'absolute', left: 16, top: 16, fontFamily: SERIF, fontWeight: 900, fontSize: 44, lineHeight: 1, whiteSpace: 'pre', opacity: word2,
            backgroundImage: `linear-gradient(90deg, #1d2a66, ${p.accent})`, WebkitBackgroundClip: 'text', backgroundClip: 'text', WebkitTextFillColor: 'transparent',
          }}
        >
          {p.word2}
        </div>
      </div>
      {/* 蓝光 */}
      <div style={{ position: 'absolute', left: 520, top: 250, width: 200, height: 230, background: 'radial-gradient(closest-side, rgba(150,180,255,0.75), rgba(150,180,255,0))', opacity: glow, mixBlendMode: 'screen' }} />
      <div style={{ position: 'absolute', left: 470, top: 455, width: 330, height: 50, borderRadius: '50%', background: 'radial-gradient(closest-side, rgba(20,20,20,0.7), rgba(20,20,20,0))' }} />
      <Img src={assetUrl(p.centerImage)} style={{ position: 'absolute', ...IMAGE, objectFit: 'contain', objectPosition: 'center bottom' }} />
    </>
  );
  return (
    <>
      {t >= 4 && <div style={{ position: 'absolute', left: 629, top: 202, width: 18, height: 18, borderRadius: '50%', backgroundColor: '#1a1d3a' }} />}
      {settle >= 1 ? content : Array.from({ length: bands }, (_, i) => {
        const seed = `${Math.floor(t)}-${i}`;
        if (random(`s${seed}`) > 0.3 + 0.7 * settle) return null;
        const dx = (random(`x${seed}`) - 0.5) * 60 * (1 - settle);
        const top = 236 + (i / bands) * 260;
        const h = 260 / bands;
        return (
          <div key={i} style={{ position: 'absolute', inset: 0, transform: `translateX(${dx}px)`, clipPath: `inset(${top}px 0 ${720 - top - h}px 0)` }}>{content}</div>
        );
      })}
    </>
  );
};

const LabelView: React.FC<{ l: OrbitLabel; frame: number; accent: string }> = ({ l, frame, accent }) => {
  const t = frame - l.at;
  if (t < 0) return null;
  const pos = SIDES[l.side];
  const d = Easing.out(Easing.back(1.4))(interpolate(t, [0, 10], [0, 1], clamp));
  const wipe = Easing.out(Easing.cubic)(interpolate(t, [3, 15], [0, 1], clamp));
  const en = interpolate(t, [10, 18], [0, 1], clamp);
  // 原片的字是窄高的：字号 37、竖向拉长 1.45 倍，每个字占 35px
  const size = 37;
  const chars = Array.from(l.text).length;
  const width = chars * size * 0.95;
  const left = pos.x - width / 2;
  return (
    <>
      <div
        style={{
          position: 'absolute', left: left - 36, top: pos.y - 36, width: 72, height: 72, opacity: 0.85 * d,
          transform: `rotate(45deg) scale(${d})`, background: 'linear-gradient(135deg, rgba(190,194,245,0.95), rgba(214,216,250,0.55))',
        }}
      />
      <div
        style={{
          position: 'absolute', left, top: pos.y - size * 0.9, width: width + 20, height: size * 1.25, whiteSpace: 'pre',
          fontFamily: SERIF, fontWeight: 900, fontSize: size, lineHeight: 1.2, clipPath: `inset(0 ${(1 - wipe) * 100}% 0 0)`,
          transform: 'scaleY(1.45)', transformOrigin: '0 0',
          backgroundImage: `linear-gradient(90deg, #1b2461 0%, #2d3c8f 50%, ${accent} 100%)`, WebkitBackgroundClip: 'text', backgroundClip: 'text', WebkitTextFillColor: 'transparent',
          filter: 'drop-shadow(0 2px 3px rgba(40,50,120,0.25))',
        }}
      >
        {l.text}
      </div>
      {l.english && (
        <div style={{ position: 'absolute', left, width: width + 20, top: pos.y + size * 0.85, display: 'flex', justifyContent: 'flex-end', paddingRight: 20, opacity: en, fontFamily: LATIN, fontStyle: 'italic', fontSize: 13, color: '#4a4f6a', whiteSpace: 'pre' }}>
          {l.english}
        </div>
      )}
    </>
  );
};
