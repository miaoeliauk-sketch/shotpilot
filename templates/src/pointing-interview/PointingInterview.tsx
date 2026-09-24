import React, { useLayoutEffect, useMemo, useState } from 'react';
import { AbsoluteFill, Easing, Img, continueRender, delayRender, interpolate, useCurrentFrame } from 'remotion';
import { assetUrl, bundledUrl } from '../asset';
import { Media } from '../media';
import { inkMaskUrl } from '../news-headline/ink';

/**
 * 复刻：指向的人物 + 逐字标题 → 笔刷转场 → 面试场景 + 对话框（333 帧，1280×720 @30fps）
 *
 * ── 场景一（0–163）──────────────────────────────────────────────────
 *   镜头从 1.65 倍拉远到 0.98 倍（以画面左边 y=405 为中心），约 36 帧到位。
 *   人物（抠好图的 PNG）在左下，手指向右边。
 *   标题三行、四组字，一个字一个字从左往右「刷」出来（每个字 3 帧）：
 *     「他们把」粗黑窄体 · 「招人」斜体细字 · 「做成了一条」小号宋体 · 「流水线」大号窄体
 *   第 85 帧一块深蓝竖条从上面落下来（先快后慢，40 帧），盖在「流水线」后面；
 *   压在竖条上的字变白，竖条外面还是黑的。人物的手压在竖条上面。
 *
 * ── 转场（156–168）─────────────────────────────────────────────────
 *   干笔刷一道道扫过去，露出场景二（和「金色标题」模板同一套墨迹遮罩）。
 *
 * ── 场景二（156–333）───────────────────────────────────────────────
 *   浅灰墙 + 中间一面深灰背墙 + 地面，背墙上一个巨大的背景字（「面试」），
 *   前面是人物插图（抠好图的 PNG）。镜头从 1.85 倍慢慢拉远到 0.98 倍（以人物中心为准）。
 *   对话框：深色圆角条，从左往右展开、字跟着一个一个打出来。
 *
 * 只复刻画面，底部口播字幕不在模板里。
 */

export type SpeechBubble = { text: string; x: number; y: number; width: number; at: number };

export type PointingInterviewProps = {
  wall: string;
  figure: string;
  line1: string;
  line1b: string;
  line2: string;
  keyword: string;
  panelColor: string;
  scene2: string;
  people: string;
  bigWord: string;
  bubbles: SpeechBubble[];
  /** 转场开始的帧 */
  switchAt: number;
  /** 各组字开始出现的帧 */
  textAt: number;
  panelAt: number;
  durationInFrames: number;
};

const HEAVY = '"PingFang SC", "Noto Sans CJK SC", "Source Han Sans SC", sans-serif';
const SERIF = '"Songti SC", "STSong", "Noto Serif CJK SC", "Source Han Serif SC", serif';

const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;
const curve = (t: number, ks: number[], vs: number[]) => interpolate(t, ks, vs, clamp);

// ── 场景一 ────────────────────────────────────────────────────────────
/** 镜头缩放（相对最后停住的 0.979 倍），第 0–40 帧实测 */
const A_T = [0, 1, 2, 3, 4, 5, 6, 8, 10, 13, 16, 20, 26, 40];
const A_S = [1.69, 1.58, 1.51, 1.4398, 1.3876, 1.3455, 1.3096, 1.254, 1.2086, 1.1485, 1.1029, 1.0611, 1.0181, 0.9787];
const A_ANCHOR = { x: 0, y: 405 };
const FIGURE_BOX = { left: -60, top: 150, width: 1180, height: 600 };

/** 各组字（画面坐标，第 130 帧量的）：位置、字号、横向压缩、出现时间（相对 textAt）、每个字间隔 */
const GROUPS = {
  line1: { left: 424, top: 199, height: 138, width: 76, font: HEAVY, weight: 900, italic: false, at: 0, step: 5 },
  line1b: { left: 681, top: 255, height: 79, width: 79, font: HEAVY, weight: 300, italic: true, at: 17, step: 8 },
  line2: { left: 560, top: 354, height: 47, width: 51.4, font: SERIF, weight: 900, italic: false, at: 8, step: 4 },
  keyword: { left: 843, top: 264, height: 179, width: 93, font: HEAVY, weight: 900, italic: false, at: 27, step: 7 },
} as const;
const CHAR_WIPE = 3;

/** 深蓝竖条：x 830–1172，从上往下落，底边位置（相对 panelAt）实测 */
const PANEL = { left: 830, width: 342 };
const PANEL_T = [0, 1, 3, 5, 7, 9, 11, 13, 25, 45];
const PANEL_B = [0, 121, 275, 361, 421, 465, 503, 533, 644, 730];

// ── 转场 ─────────────────────────────────────────────────────────────
const SWITCH_FRAMES = 12;

// ── 场景二 ────────────────────────────────────────────────────────────
const B_T = [0, 4, 8, 12, 22, 32, 44, 62, 82, 102, 122, 142, 162];
const B_S = [1.86, 1.84, 1.8, 1.76, 1.7, 1.58, 1.47, 1.36, 1.23, 1.13, 1.06, 1.01, 0.99];
const B_ANCHOR = { x: 610, y: 365 };
const PEOPLE_BOX = { left: 400, top: 210, width: 420, height: 310 };
/** 对话框：高 46，字 22px，展开 18 帧，打字每个字 1 帧 */
const BUBBLE = { height: 46, font: 22, grow: 18, perChar: 1, line: 30 };

export const PointingInterview: React.FC<PointingInterviewProps> = (p) => {
  const frame = useCurrentFrame();
  const rel = (frame - p.switchAt) * (12 / SWITCH_FRAMES) - 1;
  const inTransition = frame >= p.switchAt && frame < p.switchAt + SWITCH_FRAMES;
  const mask = useInkMask(inTransition ? rel : null);
  const showA = frame < p.switchAt + SWITCH_FRAMES;
  const showB = frame >= p.switchAt;
  const maskStyle: React.CSSProperties = mask
    ? { WebkitMaskImage: `url(${mask})`, maskImage: `url(${mask})`, WebkitMaskSize: '100% 100%', maskSize: '100% 100%' }
    : {};

  return (
    <AbsoluteFill style={{ backgroundColor: '#ddd', overflow: 'hidden' }}>
      {showB && <SceneB p={p} frame={frame} />}
      {showA && (
        <AbsoluteFill style={maskStyle}>
          <SceneA p={p} frame={frame} />
        </AbsoluteFill>
      )}
      <Img src={bundledUrl('doc-highlight/scratches.png')} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0.35 }} />
    </AbsoluteFill>
  );
};

function useInkMask(rel: number | null): string | null {
  const url = useMemo(() => (rel === null ? null : inkMaskUrl(rel)), [rel]);
  const [ready, setReady] = useState<string | null>(null);
  useLayoutEffect(() => {
    if (!url) return;
    const handle = delayRender('笔刷转场遮罩');
    const img = new Image();
    img.src = url;
    img.decode().then(() => { setReady(url); continueRender(handle); }, () => { setReady(url); continueRender(handle); });
  }, [url]);
  if (!url) return null;
  return ready === url ? url : ready ?? url;
}

const SceneA: React.FC<{ p: PointingInterviewProps; frame: number }> = ({ p, frame }) => {
  const s = curve(frame, A_T, A_S) / 0.9787;
  const cam = `translate(${A_ANCHOR.x}px, ${A_ANCHOR.y}px) scale(${s}) translate(${-A_ANCHOR.x}px, ${-A_ANCHOR.y}px)`;
  const bottom = curve(frame - p.panelAt, PANEL_T, PANEL_B);
  const t = frame - p.textAt;
  const words = (
    <>
      <Word text={p.line1} g={GROUPS.line1} t={t} />
      <Word text={p.line1b} g={GROUPS.line1b} t={t} />
      <Word text={p.line2} g={GROUPS.line2} t={t} />
      <Word text={p.keyword} g={GROUPS.keyword} t={t} />
    </>
  );
  return (
    <AbsoluteFill style={{ transformOrigin: '0 0', transform: cam }}>
      <div style={{ position: 'absolute', left: -40, top: -40, width: 1360, height: 800 }}>
        <Media src={p.wall} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />
      </div>
      {bottom > 0 && (
        <div style={{ position: 'absolute', left: PANEL.left, top: -40, width: PANEL.width, height: bottom + 40, backgroundColor: p.panelColor, boxShadow: '0 6px 18px rgba(0,0,0,0.25)' }} />
      )}
      <Img src={assetUrl(p.figure)} style={{ position: 'absolute', left: FIGURE_BOX.left, top: FIGURE_BOX.top, width: FIGURE_BOX.width, height: FIGURE_BOX.height, objectFit: 'contain', objectPosition: 'left bottom' }} />
      <div style={{ position: 'absolute', inset: 0, color: '#141414', filter: 'drop-shadow(0 0 0.6px rgba(0,0,0,0.5))' }}>{words}</div>
      {/* 压在竖条上的字变白：同一份字，白色，只露出竖条那一块 */}
      {bottom > 0 && (
        <div style={{ position: 'absolute', inset: 0, color: '#ececec', clipPath: `inset(0 ${1280 - PANEL.left - PANEL.width}px ${720 - bottom}px ${PANEL.left}px)` }}>{words}</div>
      )}
    </AbsoluteFill>
  );
};

type Group = (typeof GROUPS)[keyof typeof GROUPS];

/** 一组字：每个字固定宽高（竖向拉长、横向压窄），从左往右一个一个刷出来 */
const Word: React.FC<{ text: string; g: Group; t: number }> = ({ text, g, t }) => (
  <>
    {Array.from(text).map((ch, i) => {
      const u = interpolate(t - g.at - i * g.step, [0, CHAR_WIPE], [0, 1], clamp);
      if (u <= 0) return null;
      const latin = /[\x00-\xff]/.test(ch);
      return (
        <div
          key={i}
          style={{
            position: 'absolute', left: g.left + i * g.width, top: g.top, width: g.width * (latin ? 0.6 : 1), height: g.height,
            clipPath: u < 1 ? `inset(0 ${(1 - u) * 100}% 0 0)` : undefined, overflow: 'visible',
          }}
        >
          <div
            style={{
              position: 'absolute', left: 0, top: 0, width: g.height, height: g.height,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: g.font, fontWeight: g.weight, fontSize: g.height * 0.95, lineHeight: 1,
              transform: `${g.italic ? 'skewX(-14deg) ' : ''}scaleX(${g.width / g.height})`, transformOrigin: '0 0',
            }}
          >
            {ch}
          </div>
        </div>
      );
    })}
  </>
);

const SceneB: React.FC<{ p: PointingInterviewProps; frame: number }> = ({ p, frame }) => {
  const t = frame - p.switchAt;
  const s = curve(t, B_T, B_S);
  const cam = `translate(${B_ANCHOR.x}px, ${B_ANCHOR.y}px) scale(${s}) translate(${-B_ANCHOR.x}px, ${-B_ANCHOR.y}px)`;
  return (
    <AbsoluteFill style={{ transformOrigin: '0 0', transform: cam }}>
      <div style={{ position: 'absolute', left: -700, top: -500, width: 2680, height: 1700 }}>
        <Media src={p.scene2} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />
      </div>
      {/* 背墙，墙上一个巨大的背景字（只露出墙这一块，下半截被地面挡住） */}
      <div style={{ position: 'absolute', left: 420, top: -300, width: 436, height: 742, overflow: 'hidden', background: 'linear-gradient(to bottom, #5b5b5b, #5d5d5d 60%, #3e3e3e)' }}>
        <div
          style={{
            position: 'absolute', left: 0, top: 300 + 12, width: 436, height: 205, display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: HEAVY, fontWeight: 900, fontSize: 205, lineHeight: 1, color: '#151515', whiteSpace: 'pre',
            transform: 'scaleY(2.05)', transformOrigin: '50% 0', opacity: 0.92, letterSpacing: -6,
          }}
        >
          {p.bigWord}
        </div>
      </div>
      {/* 地面：从背墙底边往前铺开，桌子底下一团暗影 */}
      <div style={{ position: 'absolute', left: 0, top: 0, width: 1280, height: 1100, background: 'linear-gradient(to bottom, #6f6f6f, #a9a9a9 60%)', clipPath: 'polygon(420px 441px, 856px 441px, 1180px 1100px, 60px 1100px)' }} />
      <div style={{ position: 'absolute', left: 400, top: 420, width: 460, height: 170, borderRadius: '50%', background: 'radial-gradient(closest-side, rgba(20,20,20,0.9), rgba(20,20,20,0))' }} />
      <Img src={assetUrl(p.people)} style={{ position: 'absolute', left: PEOPLE_BOX.left, top: PEOPLE_BOX.top, width: PEOPLE_BOX.width, height: PEOPLE_BOX.height, objectFit: 'contain', objectPosition: 'center bottom' }} />
      {p.bubbles.map((b, i) => <BubbleView key={i} b={b} t={frame - b.at} />)}
    </AbsoluteFill>
  );
};

/** 对话框：从左往右展开，字一个一个打出来；太长自动换行 */
const BubbleView: React.FC<{ b: SpeechBubble; t: number }> = ({ b, t }) => {
  if (t < 0) return null;
  const grow = Easing.out(Easing.cubic)(interpolate(t, [0, BUBBLE.grow], [0, 1], clamp));
  const chars = Array.from(b.text);
  const shown = Math.max(0, Math.floor((t - 3) / BUBBLE.perChar));
  const perLine = Math.max(1, Math.floor((b.width - 28) / BUBBLE.font));
  const lines = Math.max(1, Math.ceil(chars.length / perLine));
  const height = BUBBLE.height + (lines - 1) * BUBBLE.line;
  return (
    <div
      style={{
        position: 'absolute', left: b.x, top: b.y, width: b.width, height, borderRadius: 14,
        backgroundColor: 'rgba(22,22,22,0.92)', boxShadow: '0 4px 14px rgba(0,0,0,0.35)',
        clipPath: `inset(0 ${(1 - grow) * 100}% 0 0 round 14px)`,
      }}
    >
      <div
        style={{
          position: 'absolute', left: 14, top: (BUBBLE.height - BUBBLE.line) / 2, width: b.width - 28, lineHeight: `${BUBBLE.line}px`,
          fontFamily: HEAVY, fontSize: BUBBLE.font, color: '#e4e4e4', wordBreak: 'break-all', whiteSpace: 'pre-wrap',
        }}
      >
        {chars.slice(0, shown).join('')}
      </div>
    </div>
  );
};
