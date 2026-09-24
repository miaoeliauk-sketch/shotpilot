/**
 * 从事件里取出「用户按的是哪个物理键」。
 *
 * 不能只看 e.key：中文输入法开着的时候，字母键会被输入法截走当拼音，
 * e.key 变成 'Process' 或直接是候选汉字，页面收不到原本的字母——
 * 对一个中文用户的键盘驱动工具来说这是致命的。
 * e.code 给的是物理键位（KeyZ / Digit6），不受输入法和键盘布局影响。
 */
export function physicalKey(e: KeyboardEvent): string {
  const code = e.code ?? '';
  if (code.startsWith('Key')) return code.slice(3).toLowerCase();
  if (code.startsWith('Digit')) return code.slice(5);
  if (code === 'Semicolon') return ';';
  return typeof e.key === 'string' && e.key.length === 1 ? e.key.toLowerCase() : '';
}

/** 焦点在输入框里（在打字）：快捷键全部让路 */
export function isTyping(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el) return false;
  return el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable;
}

/** 菜单、弹出面板里按的键不算快捷键 */
export function inKeyTrap(target: EventTarget | null): boolean {
  return !!(target as HTMLElement | null)?.closest?.('[data-keytrap]') || !!document.querySelector('.sheet-backdrop');
}
