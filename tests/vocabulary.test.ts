import { describe, expect, it } from 'vitest';
import { DIMENSIONS, isValidTerm, labelOf } from '../src/core/vocabulary.js';

describe('vocabulary', () => {
  it('同一维度内快捷键不重复', () => {
    for (const dim of DIMENSIONS) {
      const keys = dim.terms.map((t) => ('key' in t ? t.key : undefined)).filter(Boolean);
      expect(new Set(keys).size, `${dim.label} 的快捷键有冲突`).toBe(keys.length);
    }
  });

  it('跨维度快捷键也不冲突，否则一个按键会触发两个标注', () => {
    const all: string[] = [];
    for (const dim of DIMENSIONS) {
      for (const t of dim.terms) if ('key' in t && t.key) all.push(t.key);
    }
    expect(new Set(all).size).toBe(all.length);
  });

  it('labelOf 把 slug 翻成中文', () => {
    expect(labelOf('shotSize', 'closeup')).toBe('特写');
    expect(labelOf('cameraMove', 'push-in')).toBe('推');
  });

  it('未知值原样返回而不是静默吞掉', () => {
    expect(labelOf('shotSize', 'what')).toBe('what');
    expect(labelOf('shotSize', undefined)).toBe('');
  });

  it('isValidTerm 认合法值、拒非法值', () => {
    expect(isValidTerm('lighting', 'back')).toBe(true);
    expect(isValidTerm('lighting', 'backlight')).toBe(false);
  });
});

describe('保留键', () => {
  // S = 补刀，M = 合并。这两个是结构编辑，在键盘处理里排在词汇表之前，
  // 词汇表若占用它们，那条标注就会永远点不到——静默失效，很难察觉。
  const RESERVED = ['s', 'm'];

  it('词汇表不得占用 S / M', () => {
    for (const dim of DIMENSIONS) {
      for (const term of dim.terms) {
        if (!('key' in term) || !term.key) continue;
        expect(RESERVED, `${dim.label}「${term.label}」占用了保留键 ${term.key}`).not.toContain(term.key);
      }
    }
  });
});
