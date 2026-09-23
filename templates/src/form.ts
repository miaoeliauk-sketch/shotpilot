/**
 * 模板的中文表单描述。
 *
 * 模板组件的参数是给代码用的（贝塞尔曲线、帧号、像素），用户看不懂也不该碰。
 * 每个模板另外定义一份「简单参数」：几秒出现、从哪进来、什么颜色，
 * 表单只编辑简单参数，再由模板的 toProps 换算成组件参数。
 */

export type Field =
  | { kind: 'image'; key: string; label: string; hint?: string }
  | { kind: 'text'; key: string; label: string; hint?: string; placeholder?: string }
  | { kind: 'number'; key: string; label: string; hint?: string; min: number; max: number; step: number; unit?: string }
  | { kind: 'color'; key: string; label: string; hint?: string }
  | { kind: 'select'; key: string; label: string; hint?: string; options: { value: string; label: string }[] }
  | { kind: 'toggle'; key: string; label: string; hint?: string }
  | {
      kind: 'list';
      key: string;
      label: string;
      hint?: string;
      itemLabel: string;
      fields: Field[];
      /** 新加一项时的默认值；拿到当前列表，方便把新气泡排在最后一个之后 */
      newItem: (items: Record<string, unknown>[]) => Record<string, unknown>;
    };

export type Section = { title: string; fields: Field[] };

export type Params = Record<string, unknown>;

export type TemplateMeta = {
  id: string;
  name: string;
  description: string;
  /** 这个模板复刻自哪里、实测相似度多少，给用户建立信任 */
  origin: string;
  width: number;
  height: number;
  fps: number;
  form: Section[];
  defaultParams: Params;
};
