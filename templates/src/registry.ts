import type React from 'react';
import type { Params, TemplateMeta } from './form';
import { DialogueShot } from './dialogue-shot/DialogueShot';
import * as dialogue from './dialogue-shot/params';
import { AvatarCard } from './avatar-card/AvatarCard';
import * as avatar from './avatar-card/params';
import { NewsHeadline } from './news-headline/NewsHeadline';
import * as news from './news-headline/params';
import { BigNumber } from './big-number/BigNumber';
import * as bigNumber from './big-number/params';
import { DocHighlight } from './doc-highlight/DocHighlight';
import * as docHighlight from './doc-highlight/params';
import { ProductBubbles } from './product-bubbles/ProductBubbles';
import * as productBubbles from './product-bubbles/params';
import { PhotoTitle } from './photo-title/PhotoTitle';
import * as photoTitle from './photo-title/params';
import { PointingInterview } from './pointing-interview/PointingInterview';
import * as pointingInterview from './pointing-interview/params';
import { DropTitle } from './drop-title/DropTitle';
import * as dropTitle from './drop-title/params';
import { ClauseTypewriter } from './clause-typewriter/ClauseTypewriter';
import * as clauseTypewriter from './clause-typewriter/params';
import { OrbitLabels } from './orbit-labels/OrbitLabels';
import * as orbitLabels from './orbit-labels/params';
import { VerdictTitle } from './verdict-title/VerdictTitle';
import * as verdictTitle from './verdict-title/params';
import { TornCards } from './torn-cards/TornCards';
import * as tornCards from './torn-cards/params';
import { CompanyCards } from './company-cards/CompanyCards';
import * as companyCards from './company-cards/params';
import { CardsNote } from './cards-note/CardsNote';
import * as cardsNote from './cards-note/params';
import { NewsScreenshot } from './news-screenshot/NewsScreenshot';
import * as newsScreenshot from './news-screenshot/params';
import { PostTranslate, QuoteCloseup } from './post-translate/PostTranslate';
import * as postTranslate from './post-translate/params';
import * as quoteCloseup from './quote-closeup/params';
import { TweetTranslate } from './tweet-translate/TweetTranslate';
import * as tweetTranslate from './tweet-translate/params';
import { ArticleMarker } from './article-marker/ArticleMarker';
import * as articleMarker from './article-marker/params';
import { OfficeTags } from './office-tags/OfficeTags';
import * as officeTags from './office-tags/params';
import { NameplateStory } from './nameplate-story/NameplateStory';
import * as nameplateStory from './nameplate-story/params';
import { SpotlightDetour } from './spotlight-detour/SpotlightDetour';
import * as spotlightDetour from './spotlight-detour/params';
import { LogoTitleCards } from './logo-title-cards/LogoTitleCards';
import * as logoTitleCards from './logo-title-cards/params';
import { DocPortraitCount } from './doc-portrait-count/DocPortraitCount';
import * as docPortraitCount from './doc-portrait-count/params';
import { GoldCharsNews } from './gold-chars-news/GoldCharsNews';
import * as goldCharsNews from './gold-chars-news/params';
import { IconRedWords } from './icon-red-words/IconRedWords';
import * as iconRedWords from './icon-red-words/params';

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
  {
    ...bigNumber.meta,
    component: BigNumber,
    toProps: (p) => bigNumber.toProps(p as unknown as bigNumber.BigNumberParams),
  },
  {
    ...docHighlight.meta,
    component: DocHighlight,
    toProps: (p) => docHighlight.toProps(p as unknown as docHighlight.DocHighlightParams),
  },
  {
    ...productBubbles.meta,
    component: ProductBubbles,
    toProps: (p) => productBubbles.toProps(p as unknown as productBubbles.ProductBubblesParams),
  },
  {
    ...photoTitle.meta,
    component: PhotoTitle,
    toProps: (p) => photoTitle.toProps(p as unknown as photoTitle.PhotoTitleParams),
  },
  {
    ...pointingInterview.meta,
    component: PointingInterview,
    toProps: (p) => pointingInterview.toProps(p as unknown as pointingInterview.PointingInterviewParams),
  },
  {
    ...dropTitle.meta,
    component: DropTitle,
    toProps: (p) => dropTitle.toProps(p as unknown as dropTitle.DropTitleParams),
  },
  {
    ...clauseTypewriter.meta,
    component: ClauseTypewriter,
    toProps: (p) => clauseTypewriter.toProps(p as unknown as clauseTypewriter.ClauseTypewriterParams),
  },
  {
    ...orbitLabels.meta,
    component: OrbitLabels,
    toProps: (p) => orbitLabels.toProps(p as unknown as orbitLabels.OrbitLabelsParams),
  },
  {
    ...verdictTitle.meta,
    component: VerdictTitle,
    toProps: (p) => verdictTitle.toProps(p as unknown as verdictTitle.VerdictTitleParams),
  },
  {
    ...tornCards.meta,
    component: TornCards,
    toProps: (p) => tornCards.toProps(p as unknown as tornCards.TornCardsParams),
  },
  {
    ...companyCards.meta,
    component: CompanyCards,
    toProps: (p) => companyCards.toProps(p as unknown as companyCards.CompanyCardsParams),
  },
  {
    ...cardsNote.meta,
    component: CardsNote,
    toProps: (p) => cardsNote.toProps(p as unknown as cardsNote.CardsNoteParams),
  },
  {
    ...newsScreenshot.meta,
    component: NewsScreenshot,
    toProps: (p) => newsScreenshot.toProps(p as unknown as newsScreenshot.NewsScreenshotParams),
  },
  {
    ...postTranslate.meta,
    component: PostTranslate,
    toProps: (p) => postTranslate.toProps(p as unknown as postTranslate.PostTranslateParams),
  },
  {
    ...quoteCloseup.meta,
    component: QuoteCloseup,
    toProps: (p) => quoteCloseup.toProps(p as unknown as quoteCloseup.QuoteCloseupParams),
  },
  {
    ...tweetTranslate.meta,
    component: TweetTranslate,
    toProps: (p) => tweetTranslate.toProps(p as unknown as tweetTranslate.TweetTranslateParams),
  },
  {
    ...articleMarker.meta,
    component: ArticleMarker,
    toProps: (p) => articleMarker.toProps(p as unknown as articleMarker.ArticleMarkerParams),
  },
  {
    ...officeTags.meta,
    component: OfficeTags,
    toProps: (p) => officeTags.toProps(p as unknown as officeTags.OfficeTagsParams),
  },
  {
    ...nameplateStory.meta,
    component: NameplateStory,
    toProps: (p) => nameplateStory.toProps(p as unknown as nameplateStory.NameplateStoryParams),
  },
  {
    ...spotlightDetour.meta,
    component: SpotlightDetour,
    toProps: (p) => spotlightDetour.toProps(p as unknown as spotlightDetour.SpotlightDetourParams),
  },
  {
    ...logoTitleCards.meta,
    component: LogoTitleCards,
    toProps: (p) => logoTitleCards.toProps(p as unknown as logoTitleCards.LogoTitleCardsParams),
  },
  {
    ...docPortraitCount.meta,
    component: DocPortraitCount,
    toProps: (p) => docPortraitCount.toProps(p as unknown as docPortraitCount.DocPortraitCountParams),
  },
  {
    ...goldCharsNews.meta,
    component: GoldCharsNews,
    toProps: (p) => goldCharsNews.toProps(p as unknown as goldCharsNews.GoldCharsNewsParams),
  },
  {
    ...iconRedWords.meta,
    component: IconRedWords,
    toProps: (p) => iconRedWords.toProps(p as unknown as iconRedWords.IconRedWordsParams),
  },
];

export function getTemplate(id: string): TemplateDef | undefined {
  return TEMPLATES.find((t) => t.id === id);
}
