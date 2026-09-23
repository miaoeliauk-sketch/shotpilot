import type { Section, TemplateMeta } from '../form';
import type { AvatarCardProps } from './AvatarCard';

const FPS = 30;

export type AvatarParams = {
  avatar: string;
  avatarBg: string;
  background: string;
  ringColor: string;
  duration: number;
};

export const defaultParams: AvatarParams = {
  avatar: '/template-assets/avatar-card/sample-avatar.png',
  avatarBg: '#C2E3FD',
  background: '#FBFBFB',
  ringColor: '#FFFFFF',
  // 原片 65 帧
  duration: 2.17,
};

export function toProps(p: AvatarParams): AvatarCardProps {
  return {
    avatar: p.avatar,
    avatarBg: p.avatarBg,
    background: p.background,
    ringColor: p.ringColor,
    showPillarbox: false,
    durationInFrames: Math.max(1, Math.round(p.duration * FPS)),
  };
}

const form: Section[] = [
  {
    title: '头像',
    fields: [
      {
        kind: 'image', key: 'avatar', label: '头像',
        hint: '最好是去掉背景的透明 PNG（正方形），人物放在中间。头发可以超出圆圈，会压在白环上',
      },
      { kind: 'color', key: 'avatarBg', label: '头像底色', hint: '头像图片透明的地方露出这个颜色' },
    ],
  },
  {
    title: '画面',
    fields: [
      { kind: 'color', key: 'background', label: '背景色' },
      { kind: 'color', key: 'ringColor', label: '圆环颜色' },
      { kind: 'number', key: 'duration', label: '视频时长', min: 1, max: 30, step: 0.1, unit: '秒', hint: '投影一直在转，时长越长转得越多' },
    ],
  },
];

export const meta: TemplateMeta = {
  id: 'avatar-card',
  name: '圆形头像卡片',
  description: '白环圆形头像，投影绕着头像慢慢转一圈，适合人物出场、口播开头',
  origin: '复刻自一条抖音视频的第 2 个镜头，和原片的相似度 99.6%',
  width: 1280,
  height: 720,
  fps: FPS,
  form,
  defaultParams: defaultParams as unknown as Record<string, unknown>,
};
