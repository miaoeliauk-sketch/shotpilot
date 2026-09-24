import React, { useEffect, useState } from 'react';
import {
  BROLL_NEEDS, CAMERA_ANGLES, CAMERA_MOVES, COMPOSITIONS, FOCAL_LENGTHS, LIGHTING, ROLL_KINDS, SHOT_SIZES, TRANSITIONS,
  type Term,
} from '../../../src/core/vocabulary';
import { fmtTime, type Shot } from '../api';
import { Button, Disclosure, FormRow, Kbd, Segmented, Tokens, useFieldId } from '../ui/controls';
import { Icon } from '../ui/icons';
import { Inspector } from '../ui/layout';
import { PopupButton } from '../ui/menu';
import { LibraryPanel } from './LibraryPanel';
import type { LibraryTags } from '../../../src/core/types';
import type { ReelProject } from '../api';

/**
 * 右边的镜头参数：归类、景别、运镜、构图，更多标注收起来，最下面导出复刻包。
 */

export const ROLL_COLORS: Record<string, string> = {
  'a-roll': 'var(--roll-a)',
  'b-roll': 'var(--roll-b)',
  overlay: 'var(--roll-o)',
  title: 'var(--roll-t)',
  unset: 'var(--roll-u)',
};

export type AnnotationField = keyof Shot['annotation'];

/** 备注、元素这些文本框的草稿。元素、特效在框里是一行逗号分隔的字 */
export type TextDraft = { note: string; elements: string; effects: string; brollContent: string };

export function draftOf(shot: Shot): TextDraft {
  return { note: shot.note, elements: shot.elements.join('，'), effects: shot.effects.join('，'), brollContent: shot.brollContent ?? '' };
}

export function draftToPatch(d: TextDraft) {
  const split = (v: string) => v.split(/[,，、]/).map((s) => s.trim()).filter(Boolean);
  return { note: d.note, elements: split(d.elements), effects: split(d.effects), brollContent: d.brollContent };
}

const tip = (t: Term) => [t.hint, t.key ? `快捷键 ${t.key.toUpperCase()}` : ''].filter(Boolean).join(' · ') || undefined;
const popupOptions = (terms: readonly Term[]) => terms.map((t) => ({ value: t.value, label: t.label, shortcut: t.key?.toUpperCase() }));

export type InspectorTab = 'shot' | 'library';

export type LibraryProps = {
  project: ReelProject;
  onChange: (shotId: string, lib: LibraryTags, textual: boolean) => void;
  onAutoTag: () => void;
  onSend: () => void;
  tagging: boolean;
  sending: boolean;
  visionConfigured: boolean;
  onSetupVision: () => void;
};

export function ShotInspector({ shot, index, total, onRoll, onTemplateFit, onAnnotate, onText, onReview, onExport, exporting, tab, onTab, library }: {
  shot: Shot;
  index: number;
  total: number;
  onRoll: (roll: Shot['roll']) => void;
  onTemplateFit: (fit: boolean | null) => void;
  onAnnotate: (field: AnnotationField, value: string | string[] | null) => void;
  onText: (shotId: string, draft: TextDraft) => void;
  onReview: () => void;
  onExport: () => void;
  exporting: boolean;
  tab: InspectorTab;
  onTab: (t: InspectorTab) => void;
  library: LibraryProps;
}) {
  // 文本框草稿跟着镜头走：换了镜头才重置，保存回来的结果不去打断正在打的字
  const [draft, setDraft] = useState<TextDraft>(() => draftOf(shot));
  useEffect(() => setDraft(draftOf(shot)), [shot.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const edit = (patch: Partial<TextDraft>) => {
    const next = { ...draft, ...patch };
    setDraft(next);
    onText(shot.id, next);
  };

  const a = shot.annotation;
  const ai = (field: AnnotationField) =>
    shot.annotationSource?.[field] === 'ai' ? <span className="ai-badge" title="AI 初判的，还没人改过">AI</span> : null;
  const noteId = useFieldId('note');
  const elementsId = useFieldId('elements');
  const effectsId = useFieldId('effects');
  const brollId = useFieldId('broll');
  const toggle = (field: 'composition' | 'lighting', value: string) => {
    const list = new Set<string>(a[field] ?? []);
    if (list.has(value)) list.delete(value);
    else list.add(value);
    onAnnotate(field, list.size ? [...list] : null);
  };
  const moreCount = [a.focalLength, a.angle, a.transitionIn, a.brollNeed].filter(Boolean).length + (a.lighting?.length ?? 0);
  // 素材标签只给 B-roll 打（用户定的），别的镜头不显示分页
  const isBroll = shot.roll === 'b-roll';
  const showLibrary = isBroll && tab === 'library';
  const sentBefore = !!shot.eagle && Math.abs(shot.eagle.start - shot.start) < 1e-3 && Math.abs(shot.eagle.end - shot.end) < 1e-3;
  const reviewButton = (
    <Button size="large" block onClick={onReview}>
      {shot.reviewed ? '标成没看完' : <>看完了，下一个 <Kbd>⏎</Kbd></>}
    </Button>
  );

  return (
    <Inspector
      label="镜头参数"
      title={`镜头 ${shot.id}`}
      subtitle={<><span className="mono">{fmtTime(shot.start)} – {fmtTime(shot.end)} · {(shot.end - shot.start).toFixed(1)} 秒</span> · 第 {index + 1} / {total} 个</>}
      aside={shot.reviewed ? <span className="reviewed-badge"><Icon.checkCircle size={14} />看完了</span> : null}
      tabs={isBroll ? (
        <Segmented
          label="右边显示"
          value={tab}
          onChange={(v) => v && onTab(v)}
          options={[{ value: 'shot', label: '拉片标注' }, { value: 'library', label: '素材标签' }]}
        />
      ) : undefined}
      footer={showLibrary ? (
        <>
          <Button variant="primary" size="large" block disabled={library.sending} onClick={library.onSend}>
            <Icon.folder size={15} />{library.sending ? '正在放进 Eagle…' : sentBefore ? '更新 Eagle 里的这条' : '放进 Eagle'}
          </Button>
          {reviewButton}
        </>
      ) : (
        <>
          <Button variant="primary" size="large" block disabled={exporting} onClick={onExport}>
            <Icon.share size={15} />{exporting ? '正在导出…' : '导出这个镜头的复刻包'}
          </Button>
          {reviewButton}
        </>
      )}
    >
      {showLibrary ? (
        <LibraryPanel
          project={library.project}
          shot={shot}
          onChange={(lib, textual) => library.onChange(shot.id, lib, textual)}
          onAutoTag={library.onAutoTag}
          tagging={library.tagging}
          visionConfigured={library.visionConfigured}
          onSetupVision={library.onSetupVision}
        />
      ) : (<>
      <FormRow label="镜头归类" badge={shot.rollSource === 'ai' ? <span className="ai-badge" title="AI 初判的，还没人改过">AI</span> : null}>
        <Segmented
          label="镜头归类"
          allowEmpty
          value={shot.roll === 'unset' ? null : shot.roll}
          onChange={(v) => onRoll(v ?? 'unset')}
          options={ROLL_KINDS.filter((t) => t.value !== 'unset').map((t) => ({ value: t.value, label: t.label, title: tip(t), dot: ROLL_COLORS[t.value] }))}
        />
      </FormRow>

      <FormRow
        label="适合做模板吗"
        badge={shot.templateFit?.source === 'ai' ? <span className="ai-badge" title="AI 初判的，还没人改过">AI</span> : null}
        hint={shot.templateFit?.fit
          ? `${shot.templateFit.reason ? `${shot.templateFit.reason}。` : ''}导出复刻包，把 clip.mp4 发给 Claude 就能做成模板`
          : shot.templateFit?.reason || '文字、图形、插画、图片动效这类代码画得出来的才适合；真人实拍做不了'}
      >
        <Segmented
          label="适合做模板吗"
          allowEmpty
          value={shot.templateFit ? (shot.templateFit.fit ? 'yes' : 'no') : null}
          onChange={(v) => onTemplateFit(v === null ? null : v === 'yes')}
          options={[{ value: 'yes', label: '适合做模板' }, { value: 'no', label: '做不了' }]}
        />
      </FormRow>

      <div className="half-grid">
        <FormRow label="景别" badge={ai('shotSize')}>
          <PopupButton label="景别" value={a.shotSize} options={popupOptions(SHOT_SIZES)} emptyLabel="没标" placeholder="没标" onChange={(v) => onAnnotate('shotSize', v)} />
        </FormRow>
        <FormRow label="运镜" badge={ai('cameraMove')}>
          <PopupButton label="运镜" value={a.cameraMove} options={popupOptions(CAMERA_MOVES)} emptyLabel="没标" placeholder="没标" onChange={(v) => onAnnotate('cameraMove', v)} />
        </FormRow>
      </div>

      <FormRow label="构图（可多选）" badge={ai('composition')}>
        <Tokens label="构图" values={a.composition ?? []} onToggle={(v) => toggle('composition', v)} options={COMPOSITIONS.map((t) => ({ value: t.value, label: t.label, title: tip(t) }))} />
      </FormRow>

      <Disclosure title="更多标注" summary={moreCount ? `已标 ${moreCount} 项` : '焦段 · 光线 · 机位 · 转场'} storageKey="shot-more">
        <div className="stack">
          <div className="half-grid">
            <FormRow label="焦段" badge={ai('focalLength')}>
              <PopupButton label="焦段" value={a.focalLength} options={popupOptions(FOCAL_LENGTHS)} emptyLabel="没标" placeholder="没标" onChange={(v) => onAnnotate('focalLength', v)} />
            </FormRow>
            <FormRow label="机位" badge={ai('angle')}>
              <PopupButton label="机位" value={a.angle} options={popupOptions(CAMERA_ANGLES)} emptyLabel="没标" placeholder="没标" onChange={(v) => onAnnotate('angle', v)} />
            </FormRow>
          </div>
          <FormRow label="入点转场" badge={ai('transitionIn')}>
            <PopupButton label="入点转场" value={a.transitionIn} options={popupOptions(TRANSITIONS)} emptyLabel="没标" placeholder="没标" onChange={(v) => onAnnotate('transitionIn', v)} />
          </FormRow>
          <FormRow label="光线（可多选）" badge={ai('lighting')}>
            <Tokens label="光线" values={a.lighting ?? []} onToggle={(v) => toggle('lighting', v)} options={LIGHTING.map((t) => ({ value: t.value, label: t.label, title: tip(t) }))} />
          </FormRow>
          <FormRow label="复刻需求" badge={ai('brollNeed')}>
            <Segmented label="复刻需求" allowEmpty value={a.brollNeed ?? null} onChange={(v) => onAnnotate('brollNeed', v)} options={BROLL_NEEDS.map((t) => ({ value: t.value, label: t.label, title: t.hint }))} />
          </FormRow>
          <FormRow label="画面里有什么" htmlFor={elementsId} hint="用逗号隔开，比如：标题文字，产品图">
            <input id={elementsId} className="field" value={draft.elements} onChange={(e) => edit({ elements: e.target.value })} />
          </FormRow>
          <FormRow label="特效" htmlFor={effectsId} hint="用逗号隔开">
            <input id={effectsId} className="field" value={draft.effects} onChange={(e) => edit({ effects: e.target.value })} />
          </FormRow>
          <FormRow label="复刻时这里放什么画面" htmlFor={brollId}>
            <input id={brollId} className="field" value={draft.brollContent} onChange={(e) => edit({ brollContent: e.target.value })} />
          </FormRow>
        </div>
      </Disclosure>

      <FormRow label="备注" htmlFor={noteId}>
        <textarea id={noteId} className="field" rows={3} placeholder="为什么这么拍？学到了什么？" value={draft.note} onChange={(e) => edit({ note: e.target.value })} />
      </FormRow>
      </>)}
    </Inspector>
  );
}
