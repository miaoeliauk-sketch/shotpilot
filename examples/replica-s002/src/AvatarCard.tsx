import { AbsoluteFill, Img, staticFile, useCurrentFrame } from 'remotion';

/**
 * 复刻：圆形头像卡片（ref.mp4 · s002，01:10.5–01:12.7）
 *
 * ── 结构（固定，全部来自逐帧实测，不是目测）──────────────────────────
 *   画布 1280×720 @30fps，背景 #FBFBFB，左右各约 4.7px 黑边（原片缩放残留）
 *   外圆（白环）  中心 (640.1, 357.0)  半径 227px  —— 梯度法拟合，残差 0.27px
 *   内圆（头像区）中心 (639.7, 356.0)  半径 183px  —— 最小二乘拟合，残差 0.98px
 *                 两圆不同心，差约 1px
 *   投影          绕头像顺时针旋转：偏移 45px，1.422°/帧，65 帧从正上转到正右
 *   头像可以破框：头发越出内圆约 14px，压在白环上
 *   字幕          白字身 + 灰细描边 + 右下投影，字形被水平压窄（字高 47 / 字宽约 34）
 *
 * ── 槽位（换掉就是下一条视频）──────────────────────────────────────
 *   avatar    头像：带透明通道的图片，或逐帧 PNG 序列（数字人会说话就用序列）
 *   avatarBg  头像底色，头像素材本身透明时露出来
 *   captions  字幕时间轴：[{ from: 帧号, text }]
 */

export type AvatarSource =
  | { kind: 'image'; src: string }
  | { kind: 'sequence'; dir: string; count: number; pad: number };

export interface CaptionStyle {
  /** 原片字体不是思源黑体。拿到原字体文件后放进 public/，在这里引用即可 */
  fontFamily: string;
  glyphTop: number;
  glyphHeight: number;
  fontSize: number;
  fontWeight: number;
  scaleX: number;
  color: string;
  stroke: string;
  shadow: string;
  offsetX: number;
}

// 用 type 而非 interface：Remotion 要求 props 可赋值给 Record<string, unknown>，
// interface 没有隐式索引签名，过不了类型检查
export type AvatarCardProps = {
  avatar: AvatarSource;
  captionStyle?: Partial<CaptionStyle>;
  avatarBg: string;
  captions: { from: number; text: string }[];
  background: string;
  ringColor: string;
  showPillarbox: boolean;
};

export const avatarCardDefaults: AvatarCardProps = {
  // 默认填原片头像，用于验证结构；实际使用时换成你自己的头像
  avatar: { kind: 'sequence', dir: 'avatar', count: 65, pad: 3 },
  avatarBg: '#C2E3FD',
  captions: [
    { from: 0, text: '教会你怎么用agent办公效率直接拉满' },
    { from: 37, text: '像我们活动策划' },
  ],
  background: '#FBFBFB',
  ringColor: '#FFFFFF',
  showPillarbox: true,
};

// ── 实测几何 ──
// 内外圆**不同心**，分别拟合：
//   内圆：浅蓝底左右两侧的外沿点做最小二乘，残差 0.98px
//   外圆：沿 360 条射线找亮度变化最陡处（不用阈值——白环外沿有抗锯齿，阈值法会低估半径），
//         残差 0.27px。第一版假设同心、用了 r=225，右沿差了 3px，比对时被抓出来
const CX = 639.7;
const CY = 356.0;
const R_IN = 183;
const OUTER = { cx: 640.1, cy: 357.0, r: 227.0 };
// 头像素材的裁剪框（与生成素材时一致）
const AVATAR_BOX = { left: 410, top: 126, size: 460 };

// 投影：**会转**。光源绕头像顺时针扫过，这是这个镜头唯一的结构性动效。
//
// 第一版只拿第 1 帧拟合，当成静态投影——第 1 帧误差 0.55，第 65 帧涨到 13.4。
// 逐帧用极坐标重新拟合（偏移长度 + 方向角），每帧误差都压回 0.4–0.8：
//   偏移长度  恒定 ≈ 45px（std 1.0）
//   方向角    θ = −90.9° + 1.422°/帧（线性残差 0.65°）——65 帧从正上方转到正右方，共 91°
//   模糊      σ=13 → CSS blur 26，α=0.25
const SHADOW_ORBIT = {
  distance: 44.9,
  startDeg: -90.9,
  degPerFrame: 1.422,
  blur: 26,
  alpha: 0.25,
};

function ringShadow(frame: number): string {
  const t = ((SHADOW_ORBIT.startDeg + SHADOW_ORBIT.degPerFrame * frame) * Math.PI) / 180;
  const dx = SHADOW_ORBIT.distance * Math.cos(t);
  const dy = SHADOW_ORBIT.distance * Math.sin(t);
  return `${dx.toFixed(2)}px ${dy.toFixed(2)}px ${SHADOW_ORBIT.blur}px rgba(0,0,0,${SHADOW_ORBIT.alpha}), 0px 4px 4px rgba(0,0,0,0.02)`;
}

// 字幕。几何（字号 / 压窄 / 位置）由三轮扫参对齐墨迹框，误差 ±2px；
// 样式没有按像素误差选——见下方说明。
//
// 为什么不用像素误差最优的那组：原片字体不是思源黑体，笔画位置天然对不上。
// 这种情况下多画一笔灰会被扣两次分（原片有墨复刻没有 + 复刻有墨原片没有），
// 所以像素指标系统性地偏爱「画得更淡」——误差最低的候选（2px 模糊投影，9.72）
// 肉眼看又细又空；挤出式硬投影（10.4）分数略差，却还原了原片那道灰色立体侧边。
// 字形对不上时，按肉眼选。
export const CAPTION_DEFAULT: CaptionStyle = {
  fontFamily: '"Noto Sans CJK SC", "Noto Sans SC", "Source Han Sans SC", "PingFang SC", sans-serif',
  glyphTop: 624,
  glyphHeight: 47,
  fontSize: 47,
  fontWeight: 400,
  scaleX: 0.74,
  color: '#FFFFFF',
  stroke: '0.8px #AAAAAA',
  shadow: '1px 1px 0 #A0A0A0, 2px 2px 0 #A8A8A8, 3px 3px 0 #B0B0B0, 4px 4px 1px #C4C4C4',
  offsetX: 1.5,
};

const PILLAR_COLUMNS: { x: number; color: string }[] = [
  ...[0, 1, 2, 3].map((x) => ({ x, color: '#000000' })),
  { x: 4, color: 'rgb(78,78,78)' },
  { x: 5, color: '#FFFFFF' },
  { x: 1273, color: 'rgb(248,248,248)' },
  { x: 1274, color: '#FFFFFF' },
  { x: 1275, color: 'rgb(83,83,83)' },
  ...[1276, 1277, 1278, 1279].map((x) => ({ x, color: '#000000' })),
];

function avatarSrc(a: AvatarSource, frame: number): string {
  if (a.kind === 'image') return staticFile(a.src);
  const i = Math.min(frame, a.count - 1) + 1;
  return staticFile(`${a.dir}/f${String(i).padStart(a.pad, '0')}.png`);
}

export const AvatarCard: React.FC<AvatarCardProps> = (props) => {
  const frame = useCurrentFrame();
  const caption = [...props.captions].reverse().find((c) => frame >= c.from)?.text ?? '';
  const CAPTION = { ...CAPTION_DEFAULT, ...props.captionStyle };

  return (
    <AbsoluteFill style={{ backgroundColor: props.background }}>
      {/* 白环 + 投影 */}
      <div
        style={{
          position: 'absolute',
          left: OUTER.cx - OUTER.r,
          top: OUTER.cy - OUTER.r,
          width: OUTER.r * 2,
          height: OUTER.r * 2,
          borderRadius: '50%',
          backgroundColor: props.ringColor,
          boxShadow: ringShadow(frame),
        }}
      />

      {/* 头像底色（头像素材透明时露出） */}
      <div
        style={{
          position: 'absolute',
          left: CX - R_IN,
          top: CY - R_IN,
          width: R_IN * 2,
          height: R_IN * 2,
          borderRadius: '50%',
          backgroundColor: props.avatarBg,
        }}
      />

      {/* 头像：不做圆形裁切，允许破框——素材自带透明通道决定形状 */}
      <Img
        src={avatarSrc(props.avatar, frame)}
        style={{
          position: 'absolute',
          left: AVATAR_BOX.left,
          top: AVATAR_BOX.top,
          width: AVATAR_BOX.size,
          height: AVATAR_BOX.size,
        }}
      />

      {/* 字幕 */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: CAPTION.glyphTop,
          height: CAPTION.glyphHeight,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          transform: `translateX(${CAPTION.offsetX}px)`,
        }}
      >
        <span
          style={{
            display: 'inline-block',
            fontFamily: CAPTION.fontFamily,
            fontWeight: CAPTION.fontWeight,
            fontSize: CAPTION.fontSize,
            lineHeight: 1,
            color: CAPTION.color,
            WebkitTextStroke: CAPTION.stroke,
            textShadow: CAPTION.shadow,
            transform: `scaleX(${CAPTION.scaleX})`,
            whiteSpace: 'nowrap',
          }}
        >
          {caption}
        </span>
      </div>

      {/* 原片左右黑边：逐列实测。4 列纯黑 + 1 列半灰(78) + 1 列白色亮边(放大时锐化留下的振铃) */}
      {props.showPillarbox &&
        PILLAR_COLUMNS.map((c) => (
          <div
            key={c.x}
            style={{ position: 'absolute', left: c.x, top: 0, width: 1, height: '100%', backgroundColor: c.color }}
          />
        ))}
    </AbsoluteFill>
  );
};
