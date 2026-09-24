import React, { useMemo } from 'react';
import { AbsoluteFill, Easing, Img, interpolate, useCurrentFrame } from 'remotion';
import { bundledUrl } from '../asset';
import { Media } from '../media';
import { layoutBody, type BodyChar } from '../text-layout';

/**
 * 复刻：旧墙上升起一张新闻稿 → 推近 → 切到正文特写，荧光笔划重点（154 帧，1280×720 @30fps）
 *
 * ── 坐标 ─────────────────────────────────────────────────────────────
 *   整张纸按「原片第 40 帧的画面坐标」排版（下面叫纸面坐标）：纸 x 160–1090、顶边 y 128，
 *   标题字心 (642.5, 220)，正文 30px、行距 53.5、左边 210。
 *   每一帧只是给这张纸套一个相似变换（平移、缩放、旋转），都是逐帧量出来的。
 *
 * ── 三段 ─────────────────────────────────────────────────────────────
 *   0–58   纸从画面下沿升上来，一路减速；标题从 y=805 升到 191
 *   58–72  镜头往纸上推，越推越快（1 → 1.12 倍）
 *   73–    硬切到正文特写：2.0 倍、顺时针斜 2.4°，之后继续慢慢推到 2.28 倍、斜 5°
 *          一开始整体是虚的（对焦），之后中间两行实、上下虚
 *   89–100 两道黄色荧光笔同时从左往右划过重点句（正片叠底，字还是黑的）
 *
 * 景深：远景段左右两边虚、中间实；特写段上下虚、中间实。做法是同一张纸画两遍，
 * 一遍模糊垫底，一遍清晰的用渐变蒙版只露出对焦的那一带。
 * 墙上的划痕和暗角盖在最上面（原片划痕也压在纸上）。只复刻画面，底部口播字幕不在模板里。
 */

export type DocHighlightProps = {
  background: string;
  title: string;
  subtitle: string;
  paragraphs: string[];
  highlight: string;
  highlightColor: string;
  /** 纸开始升起的帧 */
  riseAt: number;
  /** 开始推近的帧 */
  pushAt: number;
  /** 切到特写的帧 */
  cutAt: number;
  /** 荧光笔开始划的帧 */
  highlightAt: number;
  /** 划痕叠层的不透明度（背景图自己已经有划痕时可以关掉） */
  scratches: number;
  durationInFrames: number;
};

const SANS = '"PingFang SC", "Noto Sans CJK SC", "Source Han Sans SC", "Hiragino Sans GB", sans-serif';
const SERIF = '"Songti SC", "STSong", "Noto Serif CJK SC", "Source Han Serif SC", serif';

// ── 纸面排版（原片第 40 帧实测）──────────────────────────────────────
const PAPER = { left: 160, right: 1090, top: 128, bottom: 1500, color: '#ece4d5' };
const TITLE = { cx: 642.5, cy: 220, size: 74 };
const SUBTITLE = { cx: 610.5, cy: 305, size: 29 };
export const BODY = { left: 210, right: 1036, firstCenter: 380, size: 30, lineHeight: 53.9, paragraphGap: 0, indent: 2 };
const TEXT_COLOR = '#403b33';

// ── 远景段：纸升起（标题字心的位置，第 0–58 帧）──────────────────────
const RISE_T = [0, 1, 2, 3, 4, 5, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24, 26, 28, 30, 32, 34, 36, 38, 40, 42, 44, 46, 48, 50, 52, 54, 56, 58];
const RISE_Y = [805, 752, 700, 656, 620, 588, 560, 517, 477, 443, 413, 387, 360, 340, 321, 304, 289, 276, 264, 253, 243, 234, 227, 220, 214, 209, 205, 201, 198, 196, 194, 193, 191];
const RISE_X = [637.5, 643.5];

// ── 推近（第 58–72 帧，相对开始推近）────────────────────────────────
const PUSH_T = [0, 2, 4, 6, 8, 10, 12, 14];
const PUSH_S = [1, 1.01, 1.01, 1.02, 1.04, 1.05, 1.08, 1.12];
const PUSH_X = [643.5, 644.5, 644.5, 646.5, 648, 650, 655, 661.5];
const PUSH_Y = [191, 188.5, 185.5, 181, 174, 164.5, 150.5, 128.5];

// ── 特写（相对切过去那一帧）：缩放、旋转、画面点 (640, 300) 对准纸面上哪一点 ──
const CLOSE_T = [0, 1, 3, 5, 7, 11, 17, 27, 37, 47, 57, 67, 80];
const CLOSE_S = [1.8835, 1.9332, 1.9801, 2.0127, 2.0402, 2.0827, 2.1323, 2.1906, 2.2266, 2.2525, 2.2675, 2.2786, 2.2838];
const CLOSE_R = [2.38, 2.65, 2.98, 3.16, 3.34, 3.66, 3.96, 4.35, 4.63, 4.81, 4.92, 4.95, 5.01];
const CLOSE_X = [740.8, 737.3, 733.9, 731.8, 730.0, 727.4, 724.6, 721.4, 719.5, 718.0, 717.0, 716.2, 715.9];
const CLOSE_Y = [531.4, 536.2, 540.5, 543.2, 545.4, 548.9, 552.6, 556.9, 559.6, 561.4, 562.5, 562.9, 562.6];
/** 切过去时整体是虚的，约 19 帧对上焦 */
const FOCUS_PULL = { frames: 19, blur: 4 };

// ── 荧光笔 ───────────────────────────────────────────────────────────
/** 条高 37.5（纸面坐标，正好盖住一行字），两头各多出一点；11 帧划完，先快后慢 */
const MARKER = { height: 37.5, pad: 6, frames: 11 };

export const VIGNETTE = 'radial-gradient(ellipse 800px 600px at 640px 360px, rgba(20,18,10,0) 0%, rgba(20,18,10,0.01) 20%, rgba(20,18,10,0.06) 35%, rgba(20,18,10,0.12) 40%, rgba(20,18,10,0.14) 45%, rgba(20,18,10,0.25) 55%, rgba(20,18,10,0.37) 65%, rgba(20,18,10,0.51) 75%, rgba(20,18,10,0.73) 100%)';

const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;
const curve = (t: number, ks: number[], vs: number[]) => interpolate(t, ks, vs, clamp);

type Seg = { x0: number; x1: number; center: number };

/** 重点句在每一行上的那一段 */
export function highlightSegments(chars: BodyChar[]): Seg[] {
  const segs: Seg[] = [];
  for (const c of chars) {
    if (!c.highlight) continue;
    const last = segs[segs.length - 1];
    if (last && last.center === c.center) last.x1 = c.x + c.width;
    else segs.push({ x0: c.x, x1: c.x + c.width, center: c.center });
  }
  return segs;
}

/** 纸面坐标 → 画面：第 frame 帧的 CSS 变换，和是不是在特写段 */
function docTransform(p: DocHighlightProps, frame: number): { css: string; close: boolean; camera: number } {
  if (frame >= p.cutAt) {
    const t = frame - p.cutAt;
    const s = curve(t, CLOSE_T, CLOSE_S);
    const r = curve(t, CLOSE_T, CLOSE_R);
    const cx = curve(t, CLOSE_T, CLOSE_X);
    const cy = curve(t, CLOSE_T, CLOSE_Y);
    return { css: `translate(640px, 300px) rotate(${r}deg) scale(${s}) translate(${-cx}px, ${-cy}px)`, close: true, camera: s };
  }
  if (frame >= p.pushAt) {
    const t = frame - p.pushAt;
    const s = curve(t, PUSH_T, PUSH_S);
    const x = curve(t, PUSH_T, PUSH_X);
    const y = curve(t, PUSH_T, PUSH_Y);
    return { css: `translate(${x}px, ${y}px) scale(${s}) translate(${-TITLE.cx}px, ${-TITLE.cy}px)`, close: false, camera: s };
  }
  const t = frame - p.riseAt;
  const y = curve(t, RISE_T, RISE_Y);
  const x = curve(t, [6, 58], RISE_X);
  return { css: `translate(${x}px, ${y}px) translate(${-TITLE.cx}px, ${-TITLE.cy}px)`, close: false, camera: 1 };
}

export const DocHighlight: React.FC<DocHighlightProps> = (p) => {
  const frame = useCurrentFrame();
  const layout = useMemo(
    () => layoutBody(p.paragraphs.map((text) => ({ text, highlight: p.highlight && text.includes(p.highlight) ? p.highlight : '' })), BODY, SANS),
    [p.paragraphs, p.highlight],
  );
  const segs = useMemo(() => highlightSegments(layout.chars), [layout]);
  const { css, close, camera } = docTransform(p, frame);

  const marker = Easing.out(Easing.quad)(interpolate(frame, [p.highlightAt, p.highlightAt + MARKER.frames], [0, 1], clamp));
  const doc = <Doc p={p} chars={layout.chars} segs={segs} marker={marker} />;

  // 景深：远景段左右虚，特写段上下虚；特写刚切过来时整体没对上焦
  const pull = close ? FOCUS_PULL.blur * (1 - interpolate(frame - p.cutAt, [0, FOCUS_PULL.frames], [0, 1], { ...clamp, easing: Easing.inOut(Easing.quad) })) : 0;
  const focusMask = close
    ? 'linear-gradient(to bottom, transparent 22%, #000 33%, #000 58%, transparent 68%)'
    : 'linear-gradient(to right, transparent 18%, #000 32%, #000 64%, transparent 76%)';
  const outBlur = close ? 4.5 : 3.2;

  return (
    <AbsoluteFill style={{ backgroundColor: '#cfcdbd', overflow: 'hidden' }}>
      {/* 墙：推近时跟着镜头一起放大 */}
      <AbsoluteFill style={{ transform: `scale(${close ? 1 : camera})`, transformOrigin: '660px 300px' }}>
        <Media src={p.background} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />
      </AbsoluteFill>

      <AbsoluteFill style={{ filter: `blur(${(outBlur + pull).toFixed(2)}px)` }}>
        <AbsoluteFill style={{ transformOrigin: '0 0', transform: css }}>{doc}</AbsoluteFill>
      </AbsoluteFill>
      <AbsoluteFill style={{ WebkitMaskImage: focusMask, maskImage: focusMask, filter: pull > 0.05 ? `blur(${pull.toFixed(2)}px)` : undefined }}>
        <AbsoluteFill style={{ transformOrigin: '0 0', transform: css }}>{doc}</AbsoluteFill>
      </AbsoluteFill>

      {/* 暗角（按原片第 0 帧的空墙量的：中间最亮，左右边缘剩一半，四角剩三成）+ 划痕，盖在最上面 */}
      <AbsoluteFill style={{ background: VIGNETTE }} />
      {p.scratches > 0 && <Img src={bundledUrl('doc-highlight/scratches.png')} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: p.scratches }} />}
    </AbsoluteFill>
  );
};

const Doc: React.FC<{ p: DocHighlightProps; chars: BodyChar[]; segs: Seg[]; marker: number }> = ({ p, chars, segs, marker }) => (
  <div style={{ position: 'absolute', left: 0, top: 0, width: 1280, height: 720 }}>
    {/* 纸：左边一道厚度的暗边，投影落在墙上 */}
    <div
      style={{
        position: 'absolute',
        left: PAPER.left,
        top: PAPER.top,
        width: PAPER.right - PAPER.left,
        height: PAPER.bottom - PAPER.top,
        backgroundColor: PAPER.color,
        boxShadow: '-10px 0 18px rgba(30,26,18,0.35), 0 -2px 10px rgba(30,26,18,0.18)',
        overflow: 'hidden',
      }}
    >
      <Img
        src={bundledUrl('doc-highlight/paper.jpg')}
        style={{ position: 'absolute', left: 0, top: 0, width: 1024, height: 1024, mixBlendMode: 'multiply' }}
      />
      <Img
        src={bundledUrl('doc-highlight/paper.jpg')}
        style={{ position: 'absolute', left: 0, top: 1024, width: 1024, height: 1024, mixBlendMode: 'multiply', transform: 'scaleY(-1)' }}
      />
      <div style={{ position: 'absolute', left: 0, top: 0, width: 7, height: '100%', background: 'linear-gradient(to right, rgba(40,34,24,0.55), rgba(40,34,24,0))' }} />
    </div>

    <div
      style={{
        position: 'absolute', left: 0, width: 1280, top: TITLE.cy - TITLE.size / 2, height: TITLE.size,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        transform: `translateX(${TITLE.cx - 640}px)`,
        fontFamily: SERIF, fontWeight: 900, fontSize: TITLE.size, lineHeight: 1, color: '#1a1714', whiteSpace: 'pre',
      }}
    >
      {p.title}
    </div>
    <div
      style={{
        position: 'absolute', left: 0, width: 1280, top: SUBTITLE.cy - SUBTITLE.size / 2, height: SUBTITLE.size,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        transform: `translateX(${SUBTITLE.cx - 640}px)`,
        fontFamily: SERIF, fontWeight: 600, fontSize: SUBTITLE.size, lineHeight: 1, color: '#8d877c', whiteSpace: 'pre',
      }}
    >
      {p.subtitle}
    </div>

    {chars.map((c, i) => (
      <span
        key={i}
        style={{
          position: 'absolute', left: c.x, top: c.center - BODY.lineHeight / 2 - BODY.size * 0.05,
          lineHeight: `${BODY.lineHeight}px`, fontFamily: SANS, fontSize: BODY.size, color: TEXT_COLOR, whiteSpace: 'pre',
        }}
      >
        {c.ch}
      </span>
    ))}

    {/* 荧光笔：每行一条，同时从左往右划；正片叠底，字还是黑的 */}
    {marker > 0 && segs.map((s, i) => {
      const w = (s.x1 - s.x0 + MARKER.pad * 2) * marker;
      return (
        <div
          key={i}
          style={{
            position: 'absolute', left: s.x0 - MARKER.pad, top: s.center - MARKER.height / 2, width: w, height: MARKER.height,
            backgroundColor: p.highlightColor, mixBlendMode: 'multiply', borderRadius: 3,
          }}
        />
      );
    })}
  </div>
);
