import type React from 'react';
import type { Params, TemplateMeta } from './form';
import { DialogueShot } from './dialogue-shot/DialogueShot';
import * as dialogue from './dialogue-shot/params';
import { AvatarCard } from './avatar-card/AvatarCard';
import * as avatar from './avatar-card/params';
import { NewsHeadline } from './news-headline/NewsHeadline';
import * as news from './news-headline/params';

/**
 * 工作台里能用的模板。
 *
 * 同一份注册表给两处用：网页里的实时预览（@remotion/player）和导出视频用的 Remotion 打包。
 * 加新模板：写组件 + params.ts（简单参数、中文表单、换算），在这里登记一行。
 */
export type TemplateDef = TemplateMeta & {
  // 各模板的 props 类型不同，注册表里统一按宽松类型存
  component: React.FC<any>;
  toProps: (params: Params) => Record<string, unknown> & { durationInFrames: number };
};

export const TEMPLATES: TemplateDef[] = [
  {
    ...dialogue.meta,
    component: DialogueShot,
    toProps: (p) => dialogue.toProps(p as unknown as dialogue.DialogueParams),
  },
  {
    ...avatar.meta,
    component: AvatarCard,
    toProps: (p) => avatar.toProps(p as unknown as avatar.AvatarParams),
  },
  {
    ...news.meta,
    component: NewsHeadline,
    toProps: (p) => news.toProps(p as unknown as news.NewsParams),
  },
];

export function getTemplate(id: string): TemplateDef | undefined {
  return TEMPLATES.find((t) => t.id === id);
}
