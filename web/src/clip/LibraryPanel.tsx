import React, { useEffect, useState } from 'react';
import {
  FRAME_TYPES, IDENTITIES, PENDING, RELATIONS, SCENES, TONES, USES, emptyLibrary, libraryName,
} from '../../../src/core/library';
import type { LibraryTags } from '../../../src/core/types';
import { fmtWhen, type ReelProject, type Shot } from '../api';
import { Button, FormRow, Segmented, Tokens, useFieldId } from '../ui/controls';
import { Icon } from '../ui/icons';
import { PopupButton } from '../ui/menu';

/**
 * 素材标签（只有 B-roll 有），照用户的打标模板：
 * 上面是 AI 看画面判断的几项（可以改），下面是「要你确认」的三项，AI 不碰。
 * 最上面实时显示放进 Eagle 后的文件名。
 */

const opts = (list: string[]) => list.map((v) => ({ value: v, label: v }));

export function LibraryPanel({ project, shot, onChange, onAutoTag, tagging, visionConfigured, onSetupVision }: {
  project: ReelProject;
  shot: Shot;
  /** textual = 打字类的改动，攒一下再存；点选类马上存 */
  onChange: (lib: LibraryTags, textual: boolean) => void;
  onAutoTag: () => void;
  tagging: boolean;
  visionConfigured: boolean;
  onSetupVision: () => void;
}) {
  const [lib, setLib] = useState<LibraryTags>(() => shot.library ?? emptyLibrary());
  // 换了镜头、或者 AI 刚打完（taggedAt 变了），才用服务端的；自己打字时不被保存结果打断
  useEffect(() => setLib(shot.library ?? emptyLibrary()), [shot.id, shot.start, shot.library?.taggedAt]); // eslint-disable-line react-hooks/exhaustive-deps

  const set = (patch: Partial<LibraryTags>, textual = false) => {
    const next = { ...lib, ...patch };
    setLib(next);
    onChange(next, textual);
  };
  const ids = { sub: useFieldId('sub'), sum: useFieldId('sum'), note: useFieldId('lnote'), event: useFieldId('event') };
  const name = libraryName(project, { ...shot, library: lib });
  const groupPhoto = lib.frameType === '合影';
  const sameBounds = !!shot.eagle && Math.abs(shot.eagle.start - shot.start) < 1e-3 && Math.abs(shot.eagle.end - shot.end) < 1e-3;

  const status = !shot.library?.source
    ? '还没打标'
    : shot.library.source === 'ai'
      ? `AI 打的 · 把握度：${shot.library.confidence ?? '—'}`
      : shot.library.source === 'ai-edited'
        ? `AI 打完你改过 · AI 把握度：${shot.library.confidence ?? '—'}`
        : '你手动填的';

  return (
    <>
      <div className="lib-ai">
        <div className="lib-ai-text">
          <span className="lib-ai-status">{status}</span>
          {!visionConfigured && <span className="form-hint">AI 打标要先在「设置」里填看图 AI 的 Key</span>}
        </div>
        {visionConfigured ? (
          <Button onClick={onAutoTag} disabled={tagging}><Icon.sparkles size={14} />{tagging ? '正在看画面…' : shot.library?.source ? '重新 AI 打标' : 'AI 打标'}</Button>
        ) : (
          <Button onClick={onSetupVision}><Icon.gear size={14} />去设置</Button>
        )}
      </div>

      <div className="lib-name" title="放进 Eagle 后的名称">
        <span className="form-label">文件名</span>
        <span className="lib-name-value">{name}</span>
      </div>

      <FormRow label="画面类型">
        <PopupButton label="画面类型" value={lib.frameType} options={opts(FRAME_TYPES)} emptyLabel="未选" placeholder="未选" onChange={(v) => set({ frameType: v ?? undefined })} />
      </FormRow>
      <FormRow label="场景倾向">
        <Segmented label="场景倾向" allowEmpty value={lib.scene ?? null} onChange={(v) => set({ scene: v ?? undefined })} options={opts(SCENES)} />
      </FormRow>
      <FormRow label="基调">
        <Segmented label="基调" allowEmpty value={lib.tone ?? null} onChange={(v) => set({ tone: v ?? undefined })} options={opts(TONES)} />
      </FormRow>
      <FormRow label="可用途（建议，可多选）">
        <Tokens
          label="可用途"
          values={lib.uses}
          options={opts(USES)}
          onToggle={(v) => set({ uses: lib.uses.includes(v) ? lib.uses.filter((u) => u !== v) : [...lib.uses, v] })}
        />
      </FormRow>
      <div className="half-grid">
        <FormRow label="子场景" htmlFor={ids.sub} hint={groupPhoto ? '合影算关系类，文件名里先写「关系-待确认」' : '比如 讲台、机场'} disabled={groupPhoto}>
          <input id={ids.sub} className="field" value={lib.subScene} disabled={groupPhoto} onChange={(e) => set({ subScene: e.target.value }, true)} />
        </FormRow>
        <FormRow label="一句话描述" htmlFor={ids.sum} hint="15 个字以内">
          <input id={ids.sum} className="field" value={lib.summary} onChange={(e) => set({ summary: e.target.value }, true)} />
        </FormRow>
      </div>
      <FormRow label="备注" htmlFor={ids.note} hint="只写画面里看得到的，加上建议用途；不写身份、地名、情绪故事">
        <textarea id={ids.note} className="field" rows={3} value={lib.note} onChange={(e) => set({ note: e.target.value }, true)} />
      </FormRow>

      <div className="lib-confirm">
        <div className="group-caption">要你确认（AI 不猜）</div>
        <div className="half-grid">
          <FormRow label="关系">
            <PopupButton label="关系" value={lib.relation === PENDING ? null : lib.relation} options={opts(RELATIONS)} emptyLabel={PENDING} placeholder={PENDING} onChange={(v) => set({ relation: v ?? PENDING })} />
          </FormRow>
          <FormRow label="身份（是不是本人）">
            <PopupButton label="身份" value={lib.identity === PENDING ? null : lib.identity} options={opts(IDENTITIES)} emptyLabel={PENDING} placeholder={PENDING} onChange={(v) => set({ identity: v ?? PENDING })} />
          </FormRow>
        </div>
        <FormRow label="具体事件" htmlFor={ids.event}>
          <input
            id={ids.event}
            className="field"
            value={lib.event === PENDING ? '' : lib.event}
            placeholder={PENDING}
            onChange={(e) => set({ event: e.target.value.trim() ? e.target.value : PENDING }, true)}
          />
        </FormRow>
      </div>

      <div className="lib-eagle">
        <Icon.folder size={14} />
        {shot.eagle
          ? sameBounds
            ? <span>已放进 Eagle · {fmtWhen(shot.eagle.sentAt)}。改了标签再点一次就会更新</span>
            : <span>镜头边界改过（补刀或合并），要重新放一次</span>
          : <span>还没放进 Eagle</span>}
      </div>
    </>
  );
}
