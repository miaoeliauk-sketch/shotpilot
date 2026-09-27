import React from 'react';
import { Img, interpolate, random } from 'remotion';
import { assetUrl, bundledUrl } from '../asset';
import { measure } from '../text-layout';

/**
 * 人物卡片（「公司介绍 · 人物卡片」和「两张人物卡片 · 中间打字」两个模板共用）。
 *
 * 按原片量的（卡片坐标，317×342，整张顺时针斜 5°）：
 *   黑色卡片，边缘毛糙；顶上两道灰条（短的 x 30–62、长的 x 90–290，y 45）
 *   左边斜插一张配图（原片是针筒），压在卡片左边缘外面
 *   名字：白色粗宋、竖向拉长，外面一圈暗红色的光，y 125–200，从 x 62 开始（让开左边的配图）；下面一行英文名 16px
 *   职位标签：橙色长条 x 45–340（伸出卡片右边一点）、y 270–325，深色粗宋字，右端一个深色小方块，
 *            英文职位用浅色斜体放在标签右下，字多了自动缩小，不压到中文职位
 *
 * 动作（相对卡片出现）：标签第 6 帧从左往右刷出来、字闪几下出来；配图第 14 帧淡入；
 * 名字第 24 帧起一个字一个字出来，每个字 3 帧。
 */

export type PersonCardData = {
  name: string;
  english: string;
  role: string;
  roleEnglish: string;
  image: string;
};

export const CARD = { width: 317, height: 342, tilt: 5 };
/** 名字从 x 62 开始（配图压在卡片左边 x −48–82，名字不能被它挡住），最宽 262 */
export const NAME = { left: 62, width: 262 };
/** 职位标签：宽 295，中文从 12 开始 32px，右端小方块占到 36 */
export const TAG = { width: 295, textLeft: 12, size: 32, square: 36, english: 14 };

/** 英文职位的字号：放在中文和小方块之间，放不下就缩小（最小 9） */
export function roleEnglishSize(role: string, english: string): number {
  if (!english) return 0;
  const roleW = Array.from(role).length * TAG.size;
  const room = TAG.width - TAG.square - 8 - (TAG.textLeft + roleW + 10);
  const w = measure(english, `italic ${TAG.english}px Georgia, serif`);
  return Math.max(9, Math.min(TAG.english, (TAG.english * room) / Math.max(1, w)));
}
const T = { tag: 6, tagWipe: 6, image: 14, name: 24, perChar: 3 };

const SERIF = '"Songti SC", "STSong", "Noto Serif CJK SC", "Source Han Serif SC", serif';
const LATIN = '"Georgia", "Times New Roman", serif';

const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;

/** 卡片内容全部出齐要多少帧 */
export function cardSettleFrames(name: string): number {
  return T.name + Array.from(name).length * T.perChar;
}

export const PersonCard: React.FC<{ card: PersonCardData; t: number; seed: string }> = ({ card, t, seed }) => {
  const mask = `url(${bundledUrl('torn-cards/mask.png')})`;
  const tagU = interpolate(t, [T.tag, T.tag + T.tagWipe], [0, 1], clamp);
  // 标签上的字：刷出来以后闪两下
  const tagText = t >= T.tag + T.tagWipe - 2 && !(t < T.tag + T.tagWipe + 4 && random(`${seed}-f${Math.floor(t)}`) < 0.4);
  const imgQ = interpolate(t, [T.image, T.image + 5], [0, 1], clamp);
  const shown = Math.max(0, Math.floor((t - T.name) / T.perChar) + 1);
  const name = Array.from(card.name).slice(0, t >= T.name ? shown : 0).join('');
  const nameScale = Math.min(1, NAME.width / Math.max(1, Array.from(card.name).length * 41));
  const roleEn = roleEnglishSize(card.role, card.roleEnglish);

  return (
    <div style={{ position: 'absolute', left: 0, top: 0, width: CARD.width, height: CARD.height, transform: `rotate(${CARD.tilt}deg)` }}>
      <div
        style={{
          position: 'absolute', inset: 0, backgroundColor: '#1b1b1c', WebkitMaskImage: mask, maskImage: mask, WebkitMaskSize: '100% 100%', maskSize: '100% 100%',
          backgroundImage: 'linear-gradient(125deg, rgba(255,255,255,0) 35%, rgba(255,255,255,0.07) 48%, rgba(255,255,255,0) 60%)',
        }}
      >
        <Img src={bundledUrl('doc-highlight/scratches.png')} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0.35 }} />
        <div style={{ position: 'absolute', left: 30, top: 43, width: 32, height: 5, backgroundColor: '#6d655d' }} />
        <div style={{ position: 'absolute', left: 90, top: 43, width: 200, height: 5, backgroundColor: '#5f5953' }} />
      </div>

      {/* 名字 */}
      <div
        style={{
          position: 'absolute', left: NAME.left, top: 118, height: 80, display: 'flex', alignItems: 'center', whiteSpace: 'pre',
          fontFamily: SERIF, fontWeight: 900, fontSize: 46 * nameScale, lineHeight: 1, color: '#f2f0f0', letterSpacing: -4,
          transform: 'scaleY(1.6)', transformOrigin: '0 50%',
          textShadow: '0 0 6px rgba(190,30,30,0.85), 3px 3px 0 rgba(120,20,20,0.6)',
        }}
      >
        {name}
      </div>
      {card.english && t >= T.name && (
        <div style={{ position: 'absolute', left: NAME.left + 8, top: 208, fontFamily: LATIN, fontWeight: 700, fontSize: 13, color: '#bdb7b2', whiteSpace: 'pre', opacity: interpolate(t, [T.name, T.name + 6], [0, 1], clamp) }}>
          {card.english}
        </div>
      )}

      {/* 职位标签 */}
      {tagU > 0 && (
        <div
          style={{
            position: 'absolute', left: 45, top: 268, width: 295, height: 56, backgroundColor: '#d9843c',
            clipPath: `inset(0 ${(1 - tagU) * 100}% 0 0)`, boxShadow: '0 2px 6px rgba(0,0,0,0.35)',
          }}
        >
          <Img src={bundledUrl('doc-highlight/scratches.png')} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0.4, mixBlendMode: 'multiply' }} />
          {tagText && (
            <div style={{ position: 'absolute', left: 12, top: 8, fontFamily: SERIF, fontWeight: 900, fontSize: 32, lineHeight: '40px', color: '#2a1a10', whiteSpace: 'pre' }}>{card.role}</div>
          )}
          <div style={{ position: 'absolute', right: 16, top: 12, width: 20, height: 20, backgroundColor: '#3a2618' }} />
          {tagText && card.roleEnglish && (
            <div style={{ position: 'absolute', right: TAG.square + 8, bottom: 3, fontFamily: LATIN, fontStyle: 'italic', fontSize: roleEn, color: 'rgba(255,230,210,0.6)', whiteSpace: 'pre' }}>{card.roleEnglish}</div>
          )}
        </div>
      )}

      {/* 配图：斜插在左边，压在卡片边缘外面 */}
      {imgQ > 0 && card.image && (
        <Img
          src={assetUrl(card.image)}
          style={{ position: 'absolute', left: -48, top: 70, width: 130, height: 240, objectFit: 'contain', opacity: imgQ, filter: 'drop-shadow(2px 4px 4px rgba(0,0,0,0.45))' }}
        />
      )}
    </div>
  );
};
