import type { Section, TemplateMeta, TemplateTimeline } from '../form';
import type { NewsScreenshotProps } from './NewsScreenshot';

const FPS = 30;

export type NewsScreenshotParams = {
  paragraphs: { text: string }[];
  heading: string;
  headingBefore: number;
  highlight: string;
  highlightColor: string;
  photo: string;
  headline1: string;
  headline2: string;
  translation: string;
  highlightAt: number;
  zoomAt: number;
  photoAt: number;
  duration: number;
};

export const defaultParams: NewsScreenshotParams = {
  // 原片是往回滚的：先看到下面的段落，最后停在重点句上。所以重点句后面要有足够多的段落
  paragraphs: [
    { text: 'ITC的裁决只是禁止苹果销售受影响的Apple Watch系列，消费者仍然可以通过亚马逊和百思买等其他商店购买。' },
    { text: '不过，到了12月25日之后，这些设备将被禁止进口到美国，苹果也将被禁止销售这些设备。因此，如果这一裁决得到维持，它随后也可能影响Apple Watch在其他市场的销售。' },
    { text: '苹果认为ITC的裁决是错误的，应该被推翻，并打算向联邦巡回上诉法院提出上诉，苹果也可以避免使用相关专利技术，选择对Apple Watch进行修改。Apple Watch侵犯的Masimo专利要到2028年8月才会到期。' },
    { text: 'ITC的裁决是苹果和Masimo之间跨越多个司法管辖区的知识产权之争的一部分。两家公司曾讨论了合作事宜，苹果讨论了将Masimo的技术整合到苹果产品中的可能性，但没有取得进展。' },
    { text: '苹果公司也曾试图收购Masimo，给出的估值超过10亿美元。但最终不了了之，而是开始挖角Masimo的工程师并致力于自行开发血氧技术。' },
    { text: '苹果公司认为，拜登政府应该积极介入并否决该裁决，因为这将损害苹果的可穿戴设备业务，并会对整体经济产生更大的影响。' },
    { text: '苹果的可穿戴设备业务在2023年第一季度假日季度创造了134.8亿美元的营收，Apple Watch对苹果公司及其更广泛的供应链经济的影响不容忽视。' },
  ],
  heading: '专利纠纷',
  headingBefore: 2,
  highlight: '到了12月25日之后，这些设备将被禁止进口到美国',
  highlightColor: '#c5d048',
  photo: '/template-assets/news-screenshot/sample-photo.jpg',
  headline1: 'Apple to disable blood-oxygen feature as part of',
  headline2: 'patent dispute',
  translation: '苹果将禁用血氧功能作为专利纠纷的一部分。',
  // 原片：第 32 帧标重点、第 51 帧推近、第 88 帧配图压下来
  highlightAt: 1.07,
  zoomAt: 1.7,
  photoAt: 2.93,
  duration: 7.3,
};

const frames = (sec: number) => Math.round(sec * FPS);

export function toProps(p: NewsScreenshotParams): NewsScreenshotProps {
  return {
    paragraphs: p.paragraphs.map((x) => x.text).filter((t) => t.trim() !== ''),
    heading: p.heading,
    headingBefore: p.headingBefore,
    highlight: p.highlight.trim(),
    highlightColor: p.highlightColor,
    photo: p.photo,
    headline: [p.headline1, p.headline2].filter((l) => l.trim() !== ''),
    translation: p.translation,
    highlightAt: frames(p.highlightAt),
    zoomAt: frames(p.zoomAt),
    photoAt: frames(p.photoAt),
    durationInFrames: Math.max(1, frames(p.duration)),
  };
}

const form: Section[] = [
  {
    title: '网页正文',
    fields: [
      {
        kind: 'list', key: 'paragraphs', label: '段落', itemLabel: '段落',
        hint: '会排成一张网页往下滚。重点句所在的那段放在中间最好',
        fields: [{ kind: 'text', key: 'text', label: '这一段' }],
        newItem: () => ({ text: '新的一段正文' }),
      },
      { kind: 'text', key: 'heading', label: '蓝色小标题', placeholder: '留空不要', half: true },
      { kind: 'number', key: 'headingBefore', label: '放在第几段前面', min: 0, max: 20, step: 1, half: true, hint: '从 0 数' },
      { kind: 'text', key: 'highlight', label: '标出来的句子', hint: '必须和正文里的某一句完全一样；会垫黑条、字变黄，镜头推到它上面' },
      { kind: 'color', key: 'highlightColor', label: '标出来的字的颜色' },
    ],
  },
  {
    title: '标题和配图',
    fields: [
      { kind: 'media', key: 'photo', label: '配图', hint: '横版图片或视频，从上面压下来' },
      { kind: 'text', key: 'headline1', label: '英文标题第一行' },
      { kind: 'text', key: 'headline2', label: '英文标题第二行', placeholder: '留空就一行' },
      { kind: 'text', key: 'translation', label: '中文翻译', hint: '黑底白字的框，一个字一个字出来' },
    ],
  },
  {
    title: '时间',
    fields: [
      { kind: 'number', key: 'highlightAt', label: '第几秒标重点', min: 0, max: 60, step: 0.1, unit: '秒', half: true },
      { kind: 'number', key: 'zoomAt', label: '第几秒推近', min: 0, max: 60, step: 0.1, unit: '秒', half: true },
      { kind: 'number', key: 'photoAt', label: '第几秒压下配图', min: 0, max: 60, step: 0.1, unit: '秒', half: true },
      { kind: 'number', key: 'duration', label: '视频时长', min: 1, max: 60, step: 0.1, unit: '秒', half: true },
    ],
  },
];

const snap = (t: number) => Math.round((Math.round(t * FPS) / FPS) * 100) / 100;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export const timeline: TemplateTimeline = {
  tracks: (raw) => {
    const p = raw as unknown as NewsScreenshotParams;
    return [
      {
        id: 'camera', label: '镜头', kind: 'camera',
        items: [
          { id: 'article', label: '正文滚动', start: 0, end: p.photoAt, phases: [{ label: '推近', start: p.zoomAt, end: Math.min(p.photoAt, p.zoomAt + 0.57) }], select: { section: '网页正文' }, drag: { end: true } },
          { id: 'headline', label: '配图 · 标题', start: p.photoAt, end: p.duration, phases: [{ label: '刷黑', start: p.photoAt + 1.33, end: Math.min(p.duration, p.photoAt + 2.8) }], select: { section: '标题和配图' }, drag: { end: true } },
        ],
      },
      { id: 'hl', label: '标重点', kind: 'element', items: [{ id: 'hl', label: p.highlight || '（还没写）', start: p.highlightAt, end: p.photoAt, select: { section: '网页正文' }, drag: { move: true } }] },
      { id: 'zoom', label: '推近', kind: 'element', items: [{ id: 'zoom', label: '推到重点句上', start: p.zoomAt, end: p.zoomAt + 0.57, select: { section: '时间' }, drag: { move: true } }] },
    ];
  },
  apply: (raw, itemId, _edge, start, end) => {
    const p = raw as unknown as NewsScreenshotParams;
    if (itemId === 'article') return { ...raw, photoAt: clamp(snap(end), p.zoomAt, p.duration - 0.5) };
    if (itemId === 'headline') return { ...raw, duration: clamp(snap(end), p.photoAt + 0.5, 60) };
    if (itemId === 'hl') return { ...raw, highlightAt: clamp(snap(start), 0, 60) };
    if (itemId === 'zoom') return { ...raw, zoomAt: clamp(snap(start), 0, p.photoAt) };
    return raw;
  },
};

export const meta: TemplateMeta = {
  id: 'news-screenshot',
  name: '网页新闻截图 · 标重点 · 刷黑标题',
  description: '网页正文往下滚，重点句垫黑条变黄、镜头推进去；配图压下来，英文标题被黑色笔刷刷过、配中文翻译',
  origin: '复刻自一条新闻解读视频里的一个镜头，和原片的相似度 79.7%',
  width: 1280,
  height: 720,
  fps: FPS,
  posterFrame: 200,
  form,
  defaultParams: defaultParams as unknown as Record<string, unknown>,
  timeline,
};
