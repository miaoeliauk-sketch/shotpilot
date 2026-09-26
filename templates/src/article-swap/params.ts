import type { Section, TemplateMeta, TemplateTimeline } from '../form';
import type { Article, ArticleSwapProps } from './ArticleSwap';

const FPS = 30;

export type ArticleSwapParams = {
  firstPrefix: string;
  firstHighlight: string;
  firstEnglish: string;
  firstBody: string;
  secondPrefix: string;
  secondHighlight: string;
  secondEnglish: string;
  secondBody: string;
  swapAt: number;
  duration: number;
};

export const defaultParams: ArticleSwapParams = {
  firstPrefix: '冲击全球市场的',
  firstHighlight: 'Kimi K3, 到底有多强?',
  firstEnglish: 'How strong is the Kimi K3, which is impacting the global market?',
  firstBody: '震动美股的Kimi K3，到底有多强？实测的这几天，我们用K3复现了券商研报、搭建了实时选题监控系统，甚至用一段提示词和一张参考截图做出了一个有六种3D鱼类的“大鱼吃小鱼”游戏。但这些，可能还没发挥出K3真正的水平——有人用它在2小时内完成了一项通常需要天体物理研究员两周的计算，期间还发现了已发表论文中的公式问题。\n有人让它连续自主运行48小时，用开源EDA工具独立完成了一颗芯片的设计和验证。',
  secondPrefix: 'Kimi K3:',
  secondHighlight: '前端竞技场第一碾压Fable 5',
  secondEnglish: 'Kimi K3 has gone crazy: the front-end arena first crushes Fable 5',
  secondBody: '在七个细分领域中，K3拿下了品牌营销、参考图设计、数据分析、消费产品、模拟和内容创作工具六项第一，仅在游戏类排名第二。有人用Agent集群模式复刻MacOS 27界面，花了约6个小时完成。得到的不仅是一个界面，而是除了浏览器和电话等其他功能都能用的网页版操作系统。\n设计机械手模拟器与Fable 5对比，画面更精美，功能也更全。可以基于Three.js和Web GPU计算构建一个完全程序化的基于浏览器的3D游戏。',
  // 原片：第 50 帧换第二篇，一共 97 帧
  swapAt: 1.67,
  duration: 3.23,
};

const frames = (sec: number) => Math.round(sec * FPS);

const article = (prefix: string, highlight: string, english: string, body: string): Article => ({
  prefix: prefix.trim(), highlight: highlight.trim(), english: english.trim(), body: body.split('\n').map((x) => x.trim()).filter(Boolean),
});

export function toProps(p: ArticleSwapParams): ArticleSwapProps {
  const swapAt = Math.max(30, frames(p.swapAt));
  return {
    first: article(p.firstPrefix, p.firstHighlight, p.firstEnglish, p.firstBody),
    second: article(p.secondPrefix, p.secondHighlight, p.secondEnglish, p.secondBody),
    swapAt,
    durationInFrames: Math.max(swapAt + 31, frames(p.duration)),
  };
}

const articleFields = (k: 'first' | 'second') => [
  { kind: 'text' as const, key: `${k}Prefix`, label: '标题前半截（白字）', half: true, placeholder: '留空不要' },
  { kind: 'text' as const, key: `${k}Highlight`, label: '标题后半截（压米黄条）', half: true, placeholder: '留空不要' },
  { kind: 'text' as const, key: `${k}English`, label: '英文小标题', placeholder: '留空不要' },
  { kind: 'text' as const, key: `${k}Body`, label: '正文', hint: '换行分段，每段首行空两格；大概五六行就满了' },
];

const form: Section[] = [
  { title: '第一篇（一个字一个字打出来）', fields: articleFields('first') },
  {
    title: '第二篇（从大缩回来盖上去）',
    fields: [
      ...articleFields('second'),
      { kind: 'number', key: 'swapAt', label: '第几秒换第二篇', min: 1, max: 60, step: 0.1, unit: '秒', hint: '至少 1 秒，第一篇要先打完' },
    ],
  },
  { title: '时长', fields: [{ kind: 'number', key: 'duration', label: '视频时长', min: 2, max: 60, step: 0.1, unit: '秒', hint: '最短到第二篇缩回来之后 1 秒' }] },
];

const snap = (t: number) => Math.round((Math.round(t * FPS) / FPS) * 100) / 100;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export const timeline: TemplateTimeline = {
  tracks: (raw) => {
    const p = raw as unknown as ArticleSwapParams;
    const end = Math.max(p.duration, p.swapAt + 31 / FPS);
    return [
      {
        id: 'camera', label: '镜头', kind: 'camera',
        items: [{ id: 'cam', label: '横移 → 缩回来 → 拉远', start: 0, end, phases: [{ label: '移回来', start: 0, end: 1 }, { label: '换篇', start: p.swapAt, end: p.swapAt + 1 }], select: { section: '时长' }, drag: { end: true } }],
      },
      {
        id: 'elements', label: '元素', kind: 'element',
        items: [
          { id: 'first', label: `${p.firstPrefix}${p.firstHighlight}`, start: 0, end: p.swapAt + 0.83, phases: [{ label: '打字', start: 0, end: 0.8 }], select: { section: '第一篇（一个字一个字打出来）' }, drag: {} },
          { id: 'second', label: `${p.secondPrefix}${p.secondHighlight}`, start: p.swapAt, end, phases: [{ label: '缩回来', start: p.swapAt, end: p.swapAt + 1 }], select: { section: '第二篇（从大缩回来盖上去）' }, drag: { start: true } },
        ],
      },
    ];
  },
  apply: (raw, itemId, _edge, start, end) => {
    const p = raw as unknown as ArticleSwapParams;
    if (itemId === 'cam') return { ...raw, duration: clamp(snap(end), p.swapAt + 1.04, 60) };
    if (itemId === 'second') {
      const swapAt = clamp(snap(start), 1, 59);
      return { ...raw, swapAt, duration: Math.max(p.duration, swapAt + 1.04) };
    }
    return raw;
  },
};

export const meta: TemplateMeta = {
  id: 'article-swap',
  name: '文章标题打字 · 高亮条 · 换下一篇',
  description: '深蓝网点底上一篇文章：标题一个字一个字打出来、后半截压着米黄色高亮条，正文一行行扫出来；然后第二篇从很大很虚缩回来盖上去',
  origin: '复刻自一条讲开源大模型的视频里的一个镜头，和原片的相似度 81.0%',
  width: 1280,
  height: 720,
  fps: FPS,
  posterFrame: 30,
  form,
  defaultParams: defaultParams as unknown as Record<string, unknown>,
  timeline,
};
