import { describe, expect, it } from 'vitest';
import { extractJson, mergeAiResult, sanitizeAnnotation } from '../src/analyze/vision.js';
import { emptyShot } from '../src/analyze/shots.js';

describe('extractJson', () => {
  it('吃裸 JSON', () => {
    expect(extractJson('{"shotSize":"closeup"}')).toEqual({ shotSize: 'closeup' });
  });
  it('吃 ```json 围栏包裹的 JSON', () => {
    expect(extractJson('这是结果：\n```json\n{"a":1}\n```')).toEqual({ a: 1 });
  });
  it('吃前后带废话的 JSON', () => {
    expect(extractJson('好的，分析如下 {"a":2} 以上。')).toEqual({ a: 2 });
  });
  it('没有 JSON 时抛错', () => {
    expect(() => extractJson('我无法分析这张图')).toThrow(/没有找到 JSON/);
  });
});

describe('sanitizeAnnotation', () => {
  it('保留合法枚举值', () => {
    const { annotation } = sanitizeAnnotation({ shotSize: 'closeup', cameraMove: 'push-in', angle: 'low' });
    expect(annotation).toEqual({ shotSize: 'closeup', cameraMove: 'push-in', angle: 'low' });
  });

  it('丢弃模型编造的枚举值，不写进项目', () => {
    const { annotation } = sanitizeAnnotation({ shotSize: '大特写超级近', cameraMove: 'teleport' });
    expect(annotation).toEqual({});
  });

  it('多选字段去重并过滤非法项', () => {
    const { annotation } = sanitizeAnnotation({ composition: ['center', 'center', 'nonsense', 'symmetry'] });
    expect(annotation.composition).toEqual(['center', 'symmetry']);
  });

  it('elements 最多保留 5 个且去掉空串', () => {
    const { elements } = sanitizeAnnotation({ elements: ['a', '', 'b', 'c', 'd', 'e', 'f'] });
    expect(elements).toEqual(['a', 'b', 'c', 'd', 'e']);
  });

  it('置信度超出 0–1 的一律丢弃', () => {
    const { confidence } = sanitizeAnnotation({ confidence: { shotSize: 0.8, cameraMove: 5, angle: -1 } });
    expect(confidence).toEqual({ shotSize: 0.8 });
  });

  it('模型返回 null 或字符串时不炸', () => {
    expect(sanitizeAnnotation(null).annotation).toEqual({});
    expect(sanitizeAnnotation('nope').annotation).toEqual({});
  });
});

describe('AI 初判：归类和适不适合做模板', () => {
  const base = () => ({ ...emptyShot(0, 0, 3) });

  it('归类只认四种；适不适合做模板必须是真假值，理由限长', () => {
    const got = sanitizeAnnotation({ roll: 'b-roll', templateFit: true, templateReason: '图形文字动画，代码画得出来而且理由写得特别特别长' });
    expect(got.roll).toBe('b-roll');
    expect(got.templateFit?.fit).toBe(true);
    expect(got.templateFit!.reason.length).toBeLessThanOrEqual(20);
    expect(sanitizeAnnotation({ roll: 'unset' }).roll).toBeUndefined();
    expect(sanitizeAnnotation({ roll: 'c-roll', templateFit: 'yes' })).toMatchObject({ roll: undefined, templateFit: undefined });
  });

  it('没标过的镜头：AI 填上归类和适不适合做模板，来源记成 AI', () => {
    const next = mergeAiResult(base(), sanitizeAnnotation({ roll: 'b-roll', templateFit: true, templateReason: '插画动画', shotSize: 'full' }));
    expect(next.roll).toBe('b-roll');
    expect(next.rollSource).toBe('ai');
    expect(next.templateFit).toEqual({ fit: true, reason: '插画动画', source: 'ai' });
    expect(next.annotation.shotSize).toBe('full');
  });

  it('人标过的归类不动，老项目里没有来源记录的也当人标的', () => {
    const manual = { ...base(), roll: 'a-roll' as const, rollSource: 'manual' as const };
    expect(mergeAiResult(manual, sanitizeAnnotation({ roll: 'b-roll' })).roll).toBe('a-roll');
    const legacy = { ...base(), roll: 'a-roll' as const };
    expect(mergeAiResult(legacy, sanitizeAnnotation({ roll: 'b-roll' })).roll).toBe('a-roll');
    const byAi = { ...base(), roll: 'a-roll' as const, rollSource: 'ai' as const };
    expect(mergeAiResult(byAi, sanitizeAnnotation({ roll: 'b-roll' })).roll).toBe('b-roll');
  });

  it('人改过的「适不适合做模板」不动', () => {
    const manual = { ...base(), templateFit: { fit: false, reason: '', source: 'manual' as const } };
    expect(mergeAiResult(manual, sanitizeAnnotation({ templateFit: true })).templateFit?.fit).toBe(false);
  });
});
