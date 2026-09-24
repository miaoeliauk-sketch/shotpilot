import { describe, expect, it } from 'vitest';
import {
  PENDING, applyAiTags, applyManualEdit, isOurTag, libraryAnnotation, libraryName, libraryTags, sanitizeLibrary,
} from '../src/core/library.js';
import { mapLibraryReply } from '../src/analyze/library-tagger.js';
import { emptyShot } from '../src/analyze/shots.js';
import type { ReelProject } from '../src/core/types.js';

function project(): ReelProject {
  const a = { ...emptyShot(0, 0, 2.2), roll: 'a-roll' as const };
  const b1 = { ...emptyShot(1, 2.2, 4.4), roll: 'b-roll' as const };
  const b2 = { ...emptyShot(2, 4.4, 13.5), roll: 'b-roll' as const };
  return {
    version: 1, id: 'p1', title: '品牌快闪活动案例',
    source: { path: '/tmp/x.mp4', filename: 'x.mp4', duration: 20, width: 1280, height: 720, fps: 30, hasAudio: false, size: 1 },
    shots: [a, b1, b2], note: '', createdAt: '2026-09-24T09:30:00', updatedAt: '',
  };
}

const aiReply = {
  '画面类型': '人物全景', '场景倾向': '专业', '基调': '亲和', '可用途': ['建议:封面', '口播B-roll', '乱写的'],
  '子场景': '讲台', '一句话描述': '站在台上对着观众讲解', '备注': '一人站在讲台前讲解，身后有投影。建议:口播B-roll', '把握度': '中',
};

describe('素材标签：AI 结果', () => {
  it('中文键名换成字段，选项不在清单里的丢掉，「建议:」前缀照认', () => {
    const lib = applyAiTags(undefined, mapLibraryReply(aiReply));
    expect(lib.frameType).toBe('人物全景');
    expect(lib.scene).toBe('专业');
    expect(lib.tone).toBe('亲和');
    expect(lib.uses).toEqual(['封面', '口播B-roll']);
    expect(lib.confidence).toBe('中');
    expect(lib.source).toBe('ai');
  });

  it('关系、身份、具体事件 AI 不碰：没确认就是「待人工确认」，人确认过的保留', () => {
    const sneaky = { ...mapLibraryReply(aiReply), relation: '学员', identity: '是本人', event: '某某大会' };
    const fresh = applyAiTags(undefined, sneaky);
    expect([fresh.relation, fresh.identity, fresh.event]).toEqual([PENDING, PENDING, PENDING]);
    const confirmed = { ...fresh, relation: '客户', identity: '是本人', event: '年会' };
    const again = applyAiTags(confirmed, sneaky);
    expect([again.relation, again.identity, again.event]).toEqual(['客户', '是本人', '年会']);
  });

  it('模型回一个用顿号连起来的字符串也认', () => {
    expect(mapLibraryReply({ '可用途': '封面、片头' }).uses).toEqual(['封面', '片头']);
  });
});

describe('素材标签：人工修改', () => {
  it('AI 打过再改记成「AI 打完人改过」，从没打过记成「人工」，把握度保留', () => {
    const ai = applyAiTags(undefined, mapLibraryReply(aiReply));
    const edited = applyManualEdit(ai, { ...ai, tone: '松弛', source: 'ai' });
    expect(edited.tone).toBe('松弛');
    expect(edited.source).toBe('ai-edited');
    expect(edited.confidence).toBe('中');
    expect(applyManualEdit(undefined, { frameType: '空镜' }).source).toBe('manual');
  });

  it('非法值、超长文字挡在外面', () => {
    const lib = sanitizeLibrary({ frameType: '特写', relation: '老板', identity: '谁知道', subScene: '讲_台/后面', uses: 'x' });
    expect(lib.frameType).toBeUndefined();
    expect(lib.relation).toBe(PENDING);
    expect(lib.identity).toBe(PENDING);
    expect(lib.subScene).toBe('讲台后面');
    expect(lib.uses).toEqual([]);
  });
});

describe('文件名、标签、注释', () => {
  const p = project();
  p.shots[2]!.library = applyAiTags(undefined, mapLibraryReply(aiReply));

  it('文件名：拉片那天_场景大类-子场景_一句话描述_这条视频里第几个 B-roll', () => {
    expect(libraryName(p, p.shots[2]!)).toBe('20260924_专业-讲台_站在台上对着观众讲解_02');
  });

  it('合影属于关系类：子场景先是「关系-待确认」，确认关系后换成具体关系', () => {
    const shot = { ...p.shots[1]!, library: { ...p.shots[2]!.library!, frameType: '合影' } };
    expect(libraryName(p, shot)).toBe('20260924_专业-关系-待确认_站在台上对着观众讲解_01');
    const confirmed = { ...shot, library: { ...shot.library, relation: '学员' } };
    expect(libraryName(p, confirmed)).toBe('20260924_专业-关系-学员_站在台上对着观众讲解_01');
  });

  it('标签带类别，「专业」分得清是场景还是基调；有没确认的就多一个「待人工确认」', () => {
    const tags = libraryTags(p.shots[2]!.library!);
    expect(tags).toContain('场景:专业');
    expect(tags).toContain('基调:亲和');
    expect(tags).toContain('建议:封面');
    expect(tags).toContain('关系:待人工确认');
    expect(tags).toContain(PENDING);
    expect(tags.every((t) => isOurTag(t))).toBe(true);
    expect(isOurTag('我自己加的')).toBe(false);
  });

  it('注释就是模板那段结果，加一行来源', () => {
    const text = libraryAnnotation(p, p.shots[2]!);
    expect(text.split('\n').slice(0, 10)).toEqual([
      '文件名：20260924_专业-讲台_站在台上对着观众讲解_02',
      '画面类型：人物全景',
      '场景倾向：专业',
      '基调：亲和',
      '可用途：建议:封面、建议:口播B-roll',
      '关系：待人工确认',
      '身份：待人工确认',
      '具体事件：待人工确认',
      '备注：一人站在讲台前讲解，身后有投影。建议:口播B-roll',
      '把握度（高/中/低）：中',
    ]);
    expect(text).toContain('来源：品牌快闪活动案例 00:04.4–00:13.5（s003）');
  });
});
