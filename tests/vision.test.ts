import { describe, expect, it } from 'vitest';
import { extractJson, sanitizeAnnotation } from '../src/analyze/vision.js';

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
