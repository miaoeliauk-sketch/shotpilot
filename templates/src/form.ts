/**
 * 模板的中文表单描述。
 *
 * 模板组件的参数是给代码用的（贝塞尔曲线、帧号、像素），用户看不懂也不该碰。
 * 每个模板另外定义一份「简单参数」：几秒出现、从哪进来、什么颜色，
 * 表单只编辑简单参数，再由模板的 toProps 换算成组件参数。
 */

type FieldBase = {
  key: string;
  label: string;
  hint?: string;
  /** 和相邻的 half 字段并排放一行。右边面板窄，「出现 / 飞走」这种成对的参数放一起更好找 */
  half?: boolean;
  /** 返回 false 时这一项变灰不能改，比如选了「一直停到结尾」就用不着飞走时间 */
  enabledWhen?: (values: Params) => boolean;
};

export type Field =
  | (FieldBase & { kind: 'image' })
  /** 图片或视频都行（视频静音、循环播放），比如会动的背景 */
  | (FieldBase & { kind: 'media' })
  | (FieldBase & { kind: 'text'; placeholder?: string })
  | (FieldBase & { kind: 'number'; min: number; max: number; step: number; unit?: string })
  | (FieldBase & { kind: 'color' })
  | (FieldBase & { kind: 'select'; options: { value: string; label: string }[] })
  | (FieldBase & { kind: 'toggle' })
  | (FieldBase & {
      kind: 'list';
      itemLabel: string;
      fields: Field[];
      /** 新加一项时的默认值；拿到当前列表，方便把新气泡排在最后一个之后 */
      newItem: (items: Record<string, unknown>[]) => Record<string, unknown>;
    });

export type Section = { title: string; fields: Field[] };

export type Params = Record<string, unknown>;

/** 编辑时右边面板显示哪一块：表单的一节，或者列表里的一项（比如气泡 2） */
export type EditorSelection = { section: string } | { list: string; index: number };

/**
 * 时间轴上的一个色块。时间都是秒，从视频开头算。
 * phases 是块里的进场、离场这些阶段，画得浅一点，一眼看出气泡什么时候在动。
 */
export type TimelineItem = {
  id: string;
  label: string;
  start: number;
  end: number;
  phases?: { label: string; start: number; end: number }[];
  select: EditorSelection;
  /** 哪些地方能拖：move 整块挪，start / end 拖两头 */
  drag: { move?: boolean; start?: boolean; end?: boolean };
};

export type TimelineTrack = { id: string; label: string; kind: 'camera' | 'element'; items: TimelineItem[] };

/**
 * 模板的时间轴：怎么从简单参数画出色块，拖完怎么换算回简单参数。
 * 都是纯函数，界面只管画和拖，换算规则留在模板里（和 toProps 放在一起，改一处不会漏另一处）。
 */
export type TemplateTimeline = {
  tracks: (params: Params) => TimelineTrack[];
  /** edge = move 时 start、end 一起挪；start / end 只动那一头 */
  apply: (params: Params, itemId: string, edge: 'move' | 'start' | 'end', start: number, end: number) => Params;
};

export type TemplateMeta = {
  id: string;
  name: string;
  description: string;
  /** 这个模板复刻自哪里、实测相似度多少，给用户建立信任 */
  origin: string;
  width: number;
  height: number;
  fps: number;
  /** 列表里预览停在哪一帧（挑一帧最能看出这个模板是什么的） */
  posterFrame: number;
  form: Section[];
  defaultParams: Params;
  timeline?: TemplateTimeline;
};
