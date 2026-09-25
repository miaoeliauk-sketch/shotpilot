import React from 'react';
import { AbsoluteFill, Img, interpolate, useCurrentFrame } from 'remotion';
import { assetUrl } from '../asset';
import { BUNDLED_FONTS, useBundledFont } from '../fonts';
import { Media } from '../media';
import { vignetteGradient } from '../lens';

/**
 * 复刻：一张发黄的旧档案表从左下角转着飞进来、铺满画面，前四栏一个字一个字填上内容，镜头慢慢推近（152 帧，1280×720 @30fps）
 *
 * 按原片量的（「表格坐标」= 原片最后停住时的画面，表格左上 (125, −2)、1050×702，SIFT 逐帧对齐）：
 *   飞进来：16 帧，中心从 (365, 848) 到 (650, 350)，顺时针歪 11.6° → 0，0.98 倍 → 0.916 倍
 *   之后以表格中心 (650, 350) 慢慢推近：0.916 → 1 倍（126 帧）→ 1.005
 *   版面：左边一块深色照片框 (140–413, 168–510，左上角切掉一角)；照片右边一道深灰杂色横条 (422–1130, 133–183)；
 *     六行「英文标签 + 虚线」，行距 60；下面又一道杂色横条 (155–1143, 532–592)，再下面一排表头
 *   填字：前四栏各三个字符（像手写的细体），第 16、26、50、70 帧开始，每 8 帧写一个
 * 只复刻画面，底部口播字幕不在模板里。
 */

export type SheetField = { label: string; value: string; at: number };

export type RecordSheetProps = {
  background: string;
  title1: string;
  title2: string;
  photo: string;
  fields: SheetField[];
  enterAt: number;
  vignette: boolean;
  durationInFrames: number;
};

const LABEL_FONT = '"Arial Narrow", "Helvetica Neue", Arial, sans-serif';
const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;

export const SHEET = { x: 125, y: -2, w: 1050, h: 702, cx: 650, cy: 350 };
/** 每一格：标签的左边、虚线从哪到哪（表格坐标）；前四格可以填字 */
export const ROWS: { y: number; cells: { label: number; line: [number, number] }[] }[] = [
  { y: 210, cells: [{ label: 430, line: [500, 800] }, { label: 815, line: [880, 1135] }] },
  { y: 268, cells: [{ label: 430, line: [562, 848] }, { label: 862, line: [922, 1137] }] },
  { y: 328, cells: [{ label: 433, line: [487, 850] }, { label: 864, line: [960, 1137] }] },
  { y: 388, cells: [{ label: 434, line: [530, 852] }, { label: 866, line: [956, 1138] }] },
  { y: 448, cells: [{ label: 437, line: [603, 880] }, { label: 903, line: [1047, 1138] }] },
  { y: 509, cells: [{ label: 437, line: [528, 610] }, { label: 634, line: [776, 916] }, { label: 944, line: [1021, 1140] }] },
];
const FIXED_LABELS = ['EYES', 'HAIR', 'WEIGHT', 'HEIGHT', 'DATE OF BIRTH', 'CASE NUMBER', 'CITIZEN', 'NATIONALITY', 'CRIME'];
const BOTTOM = [
  { x: 193, text: 'DATE' }, { x: 322, text: 'OFFENSE CODE' }, { x: 543, text: 'INSTITUTION' }, { x: 744, text: 'CHARGE & DESCRIPTION' }, { x: 1045, text: 'TERM' },
];

const IN_T = [0, 2, 4, 6, 8, 10, 12, 14, 16];
const IN_S = [0.9811, 0.9752, 0.9629, 0.9452, 0.9295, 0.9218, 0.9176, 0.9161, 0.9164];
const IN_R = [11.6, 10.57, 8.6, 5.31, 2.64, 1.19, 0.45, 0.1, 0];
const IN_X = [365.4, 390.8, 439.5, 519.1, 584.6, 620.2, 638.3, 646.8, 649.2];
const IN_Y = [847.9, 803.4, 717.5, 578.8, 463.8, 401.8, 369.8, 355, 350.9];
const PUSH_T = [16, 20, 26, 36, 46, 66, 86, 106, 126, 151];
const PUSH_S = [0.9164, 0.917, 0.919, 0.9237, 0.93, 0.948, 0.97, 0.9887, 1, 1.005];

/** 表格的位置：中心点、缩放、角度（t 从飞进来那一帧算） */
export function sheetPose(t: number) {
  if (t < 16) {
    return { x: interpolate(t, IN_T, IN_X, clamp), y: interpolate(t, IN_T, IN_Y, clamp), s: interpolate(t, IN_T, IN_S, clamp), rot: interpolate(t, IN_T, IN_R, clamp) };
  }
  return { x: 650, y: 350, s: interpolate(t, PUSH_T, PUSH_S, clamp), rot: 0 };
}

/** 一栏写到第几个字：每 8 帧一个 */
export function written(t: number, field: SheetField): number {
  return Math.max(0, Math.min(Array.from(field.value).length, Math.floor((t - field.at) / 8) + 1));
}

export const RecordSheet: React.FC<RecordSheetProps> = (p) => {
  const frame = useCurrentFrame();
  useBundledFont('oswald');
  const t = frame - p.enterAt;
  if (t < 0) {
    return (
      <AbsoluteFill style={{ backgroundColor: '#999' }}>
        <Media src={p.background} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />
      </AbsoluteFill>
    );
  }
  const pose = sheetPose(t);
  const leftLabels = p.fields.map((f) => f.label);
  return (
    <AbsoluteFill style={{ backgroundColor: '#999', overflow: 'hidden' }}>
      <Media src={p.background} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />
      <div
        style={{
          position: 'absolute', left: SHEET.x, top: SHEET.y, width: SHEET.w, height: SHEET.h, transformOrigin: `${SHEET.cx - SHEET.x}px ${SHEET.cy - SHEET.y}px`,
          transform: `translate(${(pose.x - SHEET.cx).toFixed(1)}px, ${(pose.y - SHEET.cy).toFixed(1)}px) rotate(${pose.rot.toFixed(2)}deg) scale(${pose.s.toFixed(4)})`,
          boxShadow: '14px 20px 36px rgba(0,0,0,0.45)',
        }}
      >
        <Paper />
        {/* 所有东西按表格坐标摆（减去表格左上角） */}
        <div style={{ position: 'absolute', left: -SHEET.x, top: -SHEET.y, width: 1280, height: 720 }}>
          <div style={{ position: 'absolute', left: 297, top: 28, fontFamily: `"${BUNDLED_FONTS.oswald.family}", ${LABEL_FONT}`, fontWeight: 600, fontSize: 38, lineHeight: '38px', color: '#2c2a27', letterSpacing: 0.5 }}>
            <div>{p.title1}</div>
            <div>{p.title2}</div>
          </div>
          <div style={{ position: 'absolute', left: 1040, top: 19, fontFamily: LABEL_FONT, fontSize: 13, fontWeight: 700, color: '#3c3a36' }}>FILE NUMBER</div>
          {/* 照片框 */}
          <div style={{ position: 'absolute', left: 140, top: 168, width: 273, height: 342, clipPath: 'polygon(20% 0, 100% 0, 100% 100%, 0 100%, 0 22%)', background: '#1c1c1b', boxShadow: '3px 0 0 #efe9df' }}>
            {p.photo && <Img src={assetUrl(p.photo)} style={{ width: '100%', height: '100%', objectFit: 'cover', filter: 'grayscale(1) contrast(1.1) brightness(0.8)' }} />}
          </div>
          <Grunge x={422} y={133} w={708} h={50} seed="a" />
          <Grunge x={155} y={532} w={988} h={60} seed="b" />
          {ROWS.map((row, ri) =>
            row.cells.map((c, ci) => {
              const idx = ri < 4 && ci === 0 ? ri : -1;
              const label = idx >= 0 ? leftLabels[idx] ?? '' : FIXED_LABELS[ri < 4 ? ri : ri === 4 ? 4 + ci : 6 + ci]!;
              return (
                <React.Fragment key={`${ri}-${ci}`}>
                  <div style={{ position: 'absolute', left: c.label, top: row.y - 14, whiteSpace: 'pre', fontFamily: LABEL_FONT, fontSize: 21, lineHeight: '24px', color: '#3a3834', transform: 'scaleX(0.95)', transformOrigin: '0 50%' }}>{label}</div>
                  <div style={{ position: 'absolute', left: c.line[0], top: row.y + 8, width: c.line[1] - c.line[0], borderTop: '1.5px dashed rgba(60,56,50,0.8)' }} />
                </React.Fragment>
              );
            }),
          )}
          {/* 填的字 */}
          {p.fields.slice(0, 4).map((f, i) => {
            const n = written(t, f);
            if (n <= 0) return null;
            const row = ROWS[i]!;
            return (
              <div key={i} style={{ position: 'absolute', left: row.cells[0]!.line[0] + 6, top: row.y - 20, whiteSpace: 'pre', fontFamily: `"${BUNDLED_FONTS.oswald.family}", ${LABEL_FONT}`, fontWeight: 300, fontSize: 26, lineHeight: '28px', color: '#2a2724', letterSpacing: 1 }}>
                {Array.from(f.value).slice(0, n).join('')}
              </div>
            );
          })}
          {BOTTOM.map((b) => (
            <div key={b.text} style={{ position: 'absolute', left: b.x, top: 602, whiteSpace: 'pre', fontFamily: LABEL_FONT, fontSize: 19, fontWeight: 700, color: '#3c3a36' }}>{b.text}</div>
          ))}
          <div style={{ position: 'absolute', left: 160, top: 638, width: 980, borderTop: '1.5px solid #6a655c' }} />
          {/* 右边几道随手画的线 */}
          <svg width={1280} height={720} style={{ position: 'absolute', left: 0, top: 0 }}>
            <path d="M1030 210 C1080 230 1140 240 1170 250 M1100 150 C1160 160 1180 220 1150 300 C1130 360 1170 380 1175 420" fill="none" stroke="rgba(40,36,30,0.55)" strokeWidth={1.4} />
            <path d="M205 20 C190 80 170 140 150 200" fill="none" stroke="rgba(40,36,30,0.45)" strokeWidth={1.2} />
          </svg>
        </div>
      </div>
      {p.vignette && <AbsoluteFill style={{ background: vignetteGradient({ cx: 640, cy: 360, rx: 740, ry: 460, amount: 0.3, power: 2.4 }) }} />}
    </AbsoluteFill>
  );
};

/** 发黄的纸：底色渐变 + 细颗粒（SVG 噪点）+ 几块污渍 + 四边发暗 */
const Paper: React.FC = () => (
  <>
    <div
      style={{
        position: 'absolute', inset: 0, borderRadius: 3,
        background: [
          'radial-gradient(ellipse 260px 180px at 18% 30%, rgba(120,100,70,0.10), rgba(120,100,70,0) 70%)',
          'radial-gradient(ellipse 320px 200px at 78% 72%, rgba(110,90,60,0.12), rgba(110,90,60,0) 70%)',
          'radial-gradient(ellipse 700px 420px at 50% 50%, rgba(0,0,0,0) 60%, rgba(70,55,35,0.28) 100%)',
          'linear-gradient(160deg, #e2d6c2 0%, #d8cab2 50%, #cfc0a6 100%)',
        ].join(', '),
      }}
    />
    <svg width={SHEET.w} height={SHEET.h} style={{ position: 'absolute', left: 0, top: 0, mixBlendMode: 'multiply', opacity: 0.35 }}>
      <filter id="rs-paper" x="0" y="0" width="100%" height="100%">
        <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves={2} seed={3} />
        <feColorMatrix values="0 0 0 0 0.45  0 0 0 0 0.4  0 0 0 0 0.33  0 0 0 0.9 0" />
      </filter>
      <rect width="100%" height="100%" filter="url(#rs-paper)" />
    </svg>
  </>
);

/** 深灰杂色横条：SVG 噪点做出来的斑驳 */
const Grunge: React.FC<{ x: number; y: number; w: number; h: number; seed: string }> = ({ x, y, w, h, seed }) => {
  const id = `rs-grunge-${seed}`;
  return (
    <svg width={w} height={h} style={{ position: 'absolute', left: x, top: y }}>
      <filter id={id} x="0" y="0" width="100%" height="100%">
        <feTurbulence type="fractalNoise" baseFrequency="0.035 0.25" numOctaves={3} seed={seed === 'a' ? 7 : 11} />
        <feColorMatrix values="0 0 0 0 0.2  0 0 0 0 0.2  0 0 0 0 0.19  0 0 0 -2.2 1.9" />
      </filter>
      <rect width={w} height={h} fill="#5e5b56" />
      <rect width={w} height={h} filter={`url(#${id})`} />
    </svg>
  );
};
