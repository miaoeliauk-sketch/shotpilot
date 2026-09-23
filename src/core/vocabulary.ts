/**
 * 拉片标注词汇表。
 *
 * 这里的每个维度都对应逐字稿里点名要标注的项：构图、景别、焦段、运镜、光线，
 * 外加特效与元素。全部做成受控枚举而非自由文本，原因有三：
 *   1. 标注时用快捷键点选，比打字快一个数量级（拉片是重复劳动，手感决定能不能坚持）；
 *   2. 同一维度跨片子可聚合统计（"这个博主 70% 是中近景 + 固定镜头"）；
 *   3. AI 复刻阶段需要把标注喂回生成指令，自由文本无法稳定映射。
 *
 * value 用英文 slug 存盘（跨语言稳定），label 是界面显示的中文。
 */

export interface Term {
  readonly value: string;
  readonly label: string;
  /** 标注面板里的快捷键，单字符。同一维度内唯一。 */
  readonly key?: string;
  readonly hint?: string;
}

/** 景别 —— 主体在画面中的占比 */
export const SHOT_SIZES = [
  { value: 'extreme-wide', label: '大远景', key: '1', hint: '人极小，交代环境' },
  { value: 'wide', label: '远景', key: '2', hint: '全身加大量环境' },
  { value: 'full', label: '全景', key: '3', hint: '全身顶天立地' },
  { value: 'medium-full', label: '中全景', key: '4', hint: '膝盖以上' },
  { value: 'medium', label: '中景', key: '5', hint: '腰部以上' },
  { value: 'medium-close', label: '中近景', key: '6', hint: '胸部以上，口播最常用' },
  { value: 'close', label: '近景', key: '7', hint: '肩部以上' },
  { value: 'closeup', label: '特写', key: '8', hint: '脸部或局部' },
  { value: 'extreme-closeup', label: '大特写', key: '9', hint: '眼睛、手指等细节' },
  { value: 'insert', label: '空镜/插入', key: '0', hint: '无人物的物件或环境镜头' },
] as const satisfies readonly Term[];

/** 运镜 —— 摄影机自身的运动 */
export const CAMERA_MOVES = [
  { value: 'static', label: '固定', key: 'q', hint: '机位不动' },
  { value: 'push-in', label: '推', key: 'w', hint: '向主体靠近' },
  { value: 'pull-out', label: '拉', key: 'e', hint: '远离主体' },
  { value: 'pan', label: '摇', key: 'r', hint: '机位不动，水平转动' },
  { value: 'tilt', label: '俯仰摇', key: 't', hint: '机位不动，垂直转动' },
  { value: 'track', label: '移', key: 'y', hint: '机位平移' },
  { value: 'follow', label: '跟', key: 'u', hint: '跟随主体运动' },
  { value: 'crane', label: '升降', key: 'i', hint: '垂直升降' },
  { value: 'handheld', label: '手持', key: 'o', hint: '刻意的晃动感' },
  { value: 'orbit', label: '环绕', key: 'p', hint: '绕主体转' },
  { value: 'zoom', label: '变焦', hint: '光学变焦，非物理移动' },
  { value: 'whip', label: '甩镜', hint: '快速摇，常用于转场' },
] as const satisfies readonly Term[];

/** 构图 */
export const COMPOSITIONS = [
  { value: 'center', label: '中心构图', key: 'a' },
  { value: 'rule-of-thirds', label: '三分法', key: ';' },
  { value: 'symmetry', label: '对称', key: 'd' },
  { value: 'frame-in-frame', label: '框中框', key: 'f' },
  { value: 'leading-lines', label: '引导线', key: 'g' },
  { value: 'negative-space', label: '留白', key: 'h' },
  { value: 'over-shoulder', label: '过肩', key: 'j' },
  { value: 'diagonal', label: '对角线', key: 'k' },
  { value: 'fill-frame', label: '满构图', key: 'l' },
] as const satisfies readonly Term[];

/** 焦段 —— 存等效焦距档位；需要精确值时用 annotation.focalLengthMm */
export const FOCAL_LENGTHS = [
  { value: 'ultra-wide', label: '超广角', hint: '≤ 20mm，畸变明显' },
  { value: 'wide', label: '广角', hint: '24–35mm，手机主摄常见' },
  { value: 'normal', label: '标准', hint: '40–58mm，接近人眼' },
  { value: 'short-tele', label: '中长焦', hint: '70–105mm，人像压缩感' },
  { value: 'tele', label: '长焦', hint: '≥ 135mm，强压缩、背景虚化' },
  { value: 'macro', label: '微距' },
] as const satisfies readonly Term[];

/** 光线 */
export const LIGHTING = [
  { value: 'front', label: '顺光' },
  { value: 'side', label: '侧光' },
  { value: 'back', label: '逆光' },
  { value: 'rim', label: '轮廓光' },
  { value: 'top', label: '顶光' },
  { value: 'soft', label: '柔光' },
  { value: 'hard', label: '硬光' },
  { value: 'low-key', label: '低调/暗调' },
  { value: 'high-key', label: '高调/亮调' },
  { value: 'natural', label: '自然光' },
  { value: 'practical', label: '场景光源', hint: '画面内可见的灯' },
  { value: 'mixed-color', label: '混色光', hint: '霓虹、双色片等' },
] as const satisfies readonly Term[];

/** 机位角度 */
export const CAMERA_ANGLES = [
  { value: 'eye-level', label: '平视' },
  { value: 'high', label: '俯拍' },
  { value: 'low', label: '仰拍' },
  { value: 'birds-eye', label: '鸟瞰' },
  { value: 'dutch', label: '斜角' },
  { value: 'pov', label: '主观视角' },
] as const satisfies readonly Term[];

/** 转场 —— 标在镜头的入点上 */
export const TRANSITIONS = [
  { value: 'cut', label: '硬切' },
  { value: 'match-cut', label: '匹配剪辑' },
  { value: 'dissolve', label: '叠化' },
  { value: 'fade', label: '淡入淡出' },
  { value: 'whip-pan', label: '甩转场' },
  { value: 'mask', label: '遮罩转场' },
  { value: 'zoom-transition', label: '缩放转场' },
] as const satisfies readonly Term[];

/**
 * A-roll / B-roll 归类。
 * 逐字稿里这是复刻的关键分叉："分清楚哪个地方是需要进行 B-roll 拆解的，
 * 哪个地方是只有进行口播就可以了"。
 */
export const ROLL_KINDS = [
  { value: 'a-roll', label: 'A-roll', key: 'z', hint: '口播/主线人物画面' },
  { value: 'b-roll', label: 'B-roll', key: 'x', hint: '铺垫、示意、补充画面' },
  { value: 'overlay', label: '叠加层', key: 'c', hint: '画中画、截图、图表压在 A-roll 上' },
  { value: 'title', label: '字卡', key: 'v', hint: '纯文字画面' },
  { value: 'unset', label: '未分类' },
] as const satisfies readonly Term[];

/** 复刻时这一段需不需要拆 B-roll —— 直接服务于后续的 AI 复刻 */
export const BROLL_NEEDS = [
  { value: 'none', label: '纯口播即可', hint: '复刻时不需要任何补充画面' },
  { value: 'optional', label: '可选', hint: '有更好，没有也成立' },
  { value: 'required', label: '必须拆', hint: '这段的信息量依赖画面，光靠口播撑不住' },
] as const satisfies readonly Term[];

export type ShotSize = (typeof SHOT_SIZES)[number]['value'];
export type CameraMove = (typeof CAMERA_MOVES)[number]['value'];
export type Composition = (typeof COMPOSITIONS)[number]['value'];
export type FocalLength = (typeof FOCAL_LENGTHS)[number]['value'];
export type Lighting = (typeof LIGHTING)[number]['value'];
export type CameraAngle = (typeof CAMERA_ANGLES)[number]['value'];
export type Transition = (typeof TRANSITIONS)[number]['value'];
export type RollKind = (typeof ROLL_KINDS)[number]['value'];
export type BrollNeed = (typeof BROLL_NEEDS)[number]['value'];

/** 界面按维度渲染面板，顺序即面板从上到下的顺序 */
export const DIMENSIONS = [
  { field: 'roll', label: '镜头归类', terms: ROLL_KINDS, multi: false },
  { field: 'shotSize', label: '景别', terms: SHOT_SIZES, multi: false },
  { field: 'cameraMove', label: '运镜', terms: CAMERA_MOVES, multi: false },
  { field: 'composition', label: '构图', terms: COMPOSITIONS, multi: true },
  { field: 'focalLength', label: '焦段', terms: FOCAL_LENGTHS, multi: false },
  { field: 'lighting', label: '光线', terms: LIGHTING, multi: true },
  { field: 'angle', label: '机位', terms: CAMERA_ANGLES, multi: false },
  { field: 'transitionIn', label: '入点转场', terms: TRANSITIONS, multi: false },
  { field: 'brollNeed', label: '复刻需求', terms: BROLL_NEEDS, multi: false },
] as const;

const TERM_INDEX = new Map<string, Term>();
for (const dim of DIMENSIONS) {
  for (const term of dim.terms) TERM_INDEX.set(`${dim.field}:${term.value}`, term);
}

/** 把存盘的 slug 还原成中文标签，用于导出笔记。未知值原样返回，不静默吞掉。 */
export function labelOf(field: string, value: string | undefined): string {
  if (!value) return '';
  return TERM_INDEX.get(`${field}:${value}`)?.label ?? value;
}

/** 校验某个维度的取值是否合法。导入外部标注（含 AI 产出）时必须过这一关。 */
export function isValidTerm(field: string, value: string): boolean {
  return TERM_INDEX.has(`${field}:${value}`);
}
