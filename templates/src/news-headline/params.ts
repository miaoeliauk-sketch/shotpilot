import type { Section, TemplateMeta, TemplateTimeline, TimelineItem } from '../form';
import type { NewsHeadlineProps } from './NewsHeadline';

/**
 * 「金色标题 → 墨迹转场 → 新闻稿划重点 → 推近」的简单参数和换算。
 * 曲线、位置都是原片逐帧实测的（见 NewsHeadline.tsx 顶部），这里只留用户会改的：
 * 字、图、几秒转场、几秒推近、推近对准哪。
 */

const FPS = 30;
/** 原片标题段 59 帧后开始转场，转场 11 帧 */
const TITLE_FRAMES = 59;
const WIPE_FRAMES = 11;
/** 划线从开始到画完 */
const UNDERLINE_SECONDS = 17 / FPS;

export type ParagraphParams = {
  text: string;
  highlight: string;
  /** 第几秒开始画线 */
  underlineAt: number;
  /** 整段左右挪多少 px */
  offsetX: number;
};

export type NewsParams = {
  image: string;
  title: string;
  subtitle: string;
  headline1: string;
  headline2: string;
  /** 标金色的词，空格隔开 */
  headlineGold: string;
  paragraphs: ParagraphParams[];
  titleColor: string;
  accentColor: string;
  /** 第几秒开始墨迹转场 */
  wipeAt: number;
  /** 第几秒切到特写 */
  punchAt: number;
  punchScale: number;
  /** 特写对准新闻稿的哪里（占画面宽高的百分比） */
  punchX: number;
  punchY: number;
  duration: number;
};

/** #rrggbb 每个通道乘一个系数（给一个数就三个通道一样） */
function shade(hex: string, k: number | [number, number, number]): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m?.[1]) return hex;
  const v = parseInt(m[1], 16);
  const ks = typeof k === 'number' ? [k, k, k] : k;
  const ch = (shift: number, f: number) => Math.max(0, Math.min(255, Math.round(((v >> shift) & 255) * f)));
  return `#${[16, 8, 0].map((s, i) => ch(s, ks[i]!).toString(16).padStart(2, '0')).join('')}`;
}

const frames = (sec: number) => Math.round(sec * FPS);

export function toProps(p: NewsParams): NewsHeadlineProps {
  const wipeAt = Math.max(10, frames(p.wipeAt));
  const durationInFrames = Math.max(wipeAt + WIPE_FRAMES + 1, frames(p.duration));
  return {
    image: p.image,
    title: p.title,
    subtitle: p.subtitle,
    headline: [p.headline1, p.headline2].filter((l) => l.trim() !== ''),
    headlineGold: p.headlineGold.split(/\s+/).filter(Boolean),
    paragraphs: p.paragraphs.map((x) => ({ text: x.text, highlight: x.highlight, underlineAt: x.underlineAt * FPS, offsetX: x.offsetX ?? 0 })),
    // 原片标题字：上面 (242,218,190)，下面 (215,192,168)
    titleColor: [p.titleColor, shade(p.titleColor, 0.885)],
    // 新闻标题里的金色：比正文的重点色更浓一点，上暗下亮
    goldColor: [shade(p.accentColor, [0.86, 0.84, 0.84]), shade(p.accentColor, [1, 0.97, 0.94])],
    whiteColor: '#f6f3f3',
    bodyColor: '#cccacb',
    accentColor: p.accentColor,
    titleSpeed: wipeAt / TITLE_FRAMES,
    wipeAt,
    punchAt: Math.max(wipeAt + WIPE_FRAMES, frames(p.punchAt)),
    punchScale: p.punchScale,
    punchX: (p.punchX / 100) * 1280,
    punchY: (p.punchY / 100) * 720,
    durationInFrames,
  };
}

// 原片的字（时间 = 实测帧号 ÷ 30）
export const defaultParams: NewsParams = {
  image: '/template-assets/news-headline/sample.jpg',
  title: '苹果状告OpenAI',
  subtitle: 'Apple Sues OpenAI',
  headline1: '苹果起诉OpenAI及两名员工',
  headline2: '窃取产品机密：曾要求带着“零部件”去面试',
  headlineGold: 'OpenAI及两名员工 窃取产品机密',
  paragraphs: [
    {
      text: '当地时间7月10日，苹果公司在美国北加州联邦法院起诉OpenAI，指控OpenAI有组织地获取苹果未发布产品的商业机密，以推进自有AI硬件研发，以绕开苹果这类硬件厂商。',
      highlight: '以推进自有AI硬件研发，以绕开苹果这类硬件厂商。',
      underlineAt: 2.7,
      offsetX: 0,
    },
    {
      text: '苹果在一份法律文件中称：“从技术人员到首席硬件官，OpenAI在各个层级的人员都与商业伙伴合作，窃取苹果的商业秘密和机密信息。”',
      highlight: 'OpenAI在各个层级的人员都与商业伙伴合作，窃取苹果的商业秘密和机密信息。',
      underlineAt: 2.22,
      offsetX: -12,
    },
  ],
  titleColor: '#f2dabe',
  accentColor: '#dfba92',
  wipeAt: 1.97,
  punchAt: 3.77,
  punchScale: 2,
  punchX: 50.4,
  punchY: 68.1,
  duration: 5,
};

const form: Section[] = [
  {
    title: '开场大标题',
    fields: [
      { kind: 'media', key: 'image', label: '背景', hint: '横版图片或视频，1280×720 或更大。开场会放大 2.4 倍再慢慢拉远，越清楚越好' },
      { kind: 'text', key: 'title', label: '大标题', hint: '8–10 个字最好看，英文会自动拉高压窄' },
      { kind: 'text', key: 'subtitle', label: '标题下的小字', placeholder: '比如英文标题（留空不要）' },
      { kind: 'color', key: 'titleColor', label: '标题颜色', hint: '会自动做成上亮下暗的渐变' },
      { kind: 'number', key: 'wipeAt', label: '第几秒转场', min: 0.5, max: 20, step: 0.1, unit: '秒', hint: '大标题停留多久。镜头拉远、字浮现的快慢跟着一起变' },
    ],
  },
  {
    title: '新闻稿',
    fields: [
      { kind: 'text', key: 'headline1', label: '新闻标题第一行' },
      { kind: 'text', key: 'headline2', label: '新闻标题第二行', placeholder: '留空就只有一行' },
      { kind: 'text', key: 'headlineGold', label: '标金色的词', placeholder: '多个词用空格隔开', hint: '必须和标题里的字完全一样，其余是白色' },
      {
        kind: 'list',
        key: 'paragraphs',
        label: '正文',
        itemLabel: '段落',
        hint: '一段一段依次浮现。重点句变橙色，最长那一行下面会画一道手绘线',
        fields: [
          { kind: 'text', key: 'text', label: '这一段' },
          { kind: 'text', key: 'highlight', label: '重点句', placeholder: '留空不标', hint: '必须和上面这一段里的某一句完全一样' },
          { kind: 'number', key: 'underlineAt', label: '第几秒画线', min: 0, max: 60, step: 0.1, unit: '秒', half: true },
          { kind: 'number', key: 'offsetX', label: '左右挪动', min: -100, max: 100, step: 1, unit: 'px', half: true, hint: '正数往右、负数往左，一般不用动' },
        ],
        newItem: (items) => {
          const last = items[items.length - 1] as ParagraphParams | undefined;
          return { text: '新的一段正文', highlight: '', underlineAt: Math.round(((last?.underlineAt ?? 2.2) + 0.5) * 10) / 10, offsetX: 0 };
        },
      },
      { kind: 'color', key: 'accentColor', label: '重点颜色', hint: '重点句、划线和标题里的金色都用它' },
    ],
  },
  {
    title: '推近特写',
    fields: [
      { kind: 'number', key: 'punchAt', label: '第几秒切特写', min: 1, max: 60, step: 0.1, unit: '秒', hint: '设得比视频时长还晚就不切' },
      { kind: 'number', key: 'punchScale', label: '放大', min: 1.2, max: 3, step: 0.05, unit: '倍' },
      { kind: 'number', key: 'punchX', label: '对准·左右', min: 0, max: 100, step: 1, unit: '%', half: true, hint: '0 最左，100 最右' },
      { kind: 'number', key: 'punchY', label: '对准·上下', min: 0, max: 100, step: 1, unit: '%', half: true, hint: '0 最上，100 最下' },
      { kind: 'number', key: 'duration', label: '视频时长', min: 1, max: 60, step: 0.1, unit: '秒' },
    ],
  },
];

// ── 时间轴 ──────────────────────────────────────────────────────────────

const snap = (t: number) => Math.round((Math.round(t * FPS) / FPS) * 100) / 100;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export const timeline: TemplateTimeline = {
  tracks: (raw) => {
    const p = raw as unknown as NewsParams;
    const wipeEnd = p.wipeAt + WIPE_FRAMES / FPS;
    const punching = p.punchAt < p.duration;
    const articleEnd = punching ? p.punchAt : p.duration;
    const camera: TimelineItem[] = [
      {
        id: 'title', label: '大标题 · 拉远', start: 0, end: p.wipeAt,
        phases: [{ label: '墨迹转场', start: p.wipeAt, end: Math.min(wipeEnd, articleEnd) }],
        select: { section: '开场大标题' }, drag: { end: true },
      },
      {
        id: 'article', label: '新闻稿 · 慢慢拉远', start: p.wipeAt, end: articleEnd,
        select: { section: '新闻稿' }, drag: { end: punching },
      },
    ];
    if (punching) {
      camera.push({
        id: 'punch', label: '特写', start: p.punchAt, end: p.duration,
        select: { section: '推近特写' }, drag: { end: true },
      });
    }
    return [
      { id: 'camera', label: '镜头', kind: 'camera', items: camera },
      ...p.paragraphs.map((para, i) => ({
        id: `para-${i}`, label: `段落 ${i + 1}`, kind: 'element' as const,
        items: para.highlight
          ? [{
              id: `underline-${i}`, label: `划线：${para.highlight}`,
              start: para.underlineAt, end: para.underlineAt + UNDERLINE_SECONDS,
              select: { list: 'paragraphs', index: i }, drag: { move: true },
            }]
          : [],
      })),
    ];
  },
  apply: (raw, itemId, _edge, start, end) => {
    const p = raw as unknown as NewsParams;
    if (itemId === 'title') {
      // 大标题拖长拖短，后面的划线、特写、总时长一起顺延，新闻稿那段的节奏不变
      const wipeAt = clamp(snap(end), 0.5, 20);
      const d = wipeAt - p.wipeAt;
      const shift = (t: number) => Math.round((t + d) * 100) / 100;
      return {
        ...raw,
        wipeAt,
        punchAt: shift(p.punchAt),
        duration: clamp(shift(p.duration), 1, 60),
        paragraphs: p.paragraphs.map((x) => ({ ...x, underlineAt: Math.max(0, shift(x.underlineAt)) })),
      };
    }
    if (itemId === 'article') return { ...raw, punchAt: clamp(snap(end), p.wipeAt + WIPE_FRAMES / FPS, p.duration) };
    if (itemId === 'punch') return { ...raw, duration: clamp(snap(end), p.punchAt + 0.1, 60) };
    const i = Number(/^underline-(\d+)$/.exec(itemId)?.[1] ?? -1);
    const para = p.paragraphs[i];
    if (!para) return raw;
    const next = { ...para, underlineAt: clamp(snap(start), 0, 60) };
    return { ...raw, paragraphs: p.paragraphs.map((x, j) => (j === i ? next : x)) };
  },
};

export const meta: TemplateMeta = {
  id: 'news-headline',
  name: '金色标题 · 墨迹转场 · 新闻划重点',
  description: '金色大标题逐字浮现、镜头拉远，墨迹扫开换到新闻稿，重点句变色并手绘划线，最后切到特写',
  origin: '复刻自一条新闻解读视频的开头 5 秒，和原片的相似度 86.8%（开场背景用原片画面比）',
  width: 1280,
  height: 720,
  fps: FPS,
  posterFrame: 50,
  form,
  defaultParams: defaultParams as unknown as Record<string, unknown>,
  timeline,
};
