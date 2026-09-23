import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Player } from '@remotion/player';
import type { TemplateDef } from '../../../templates/src/registry';
import { studioApi, streamRender, type Work } from './api';
import { FieldRow } from './fields';

type SaveState = 'saved' | 'saving' | 'dirty' | 'error';
type ExportState =
  | { kind: 'idle' }
  | { kind: 'running'; message: string; percent: number | null }
  | { kind: 'done'; file: string; url: string }
  | { kind: 'failed'; message: string };

/**
 * 编辑一个作品：右边改参数，左边实时预览，改完自动保存，一个按钮导出。
 */
export function Editor({ work, template, onBack }: { work: Work; template: TemplateDef; onBack: () => void }) {
  // 模板后来加了新参数时，老作品里没有，用默认值补上
  const [params, setParams] = useState<Record<string, unknown>>({ ...template.defaultParams, ...work.params });
  const [name, setName] = useState(work.name);
  const [save, setSave] = useState<SaveState>('saved');
  const [exp, setExp] = useState<ExportState>({ kind: 'idle' });
  const pending = useRef<{ name: string; params: Record<string, unknown> } | null>(null);
  const timer = useRef<number | undefined>(undefined);

  // 换算出的组件参数；换算出错（比如填了半截的数字）时保留上一次能用的，预览不至于白屏
  const lastGood = useRef<ReturnType<TemplateDef['toProps']> | null>(null);
  const props = useMemo(() => {
    try {
      lastGood.current = template.toProps(params);
    } catch {
      /* 保留上一次 */
    }
    return lastGood.current ?? template.toProps(template.defaultParams);
  }, [params, template]);

  const flush = async () => {
    window.clearTimeout(timer.current);
    const next = pending.current;
    if (!next) return;
    pending.current = null;
    setSave('saving');
    try {
      await studioApi.saveWork(work.id, next);
      setSave(pending.current ? 'dirty' : 'saved');
    } catch {
      setSave('error');
    }
  };

  const queueSave = (nextName: string, nextParams: Record<string, unknown>) => {
    pending.current = { name: nextName, params: nextParams };
    setSave('dirty');
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => void flush(), 600);
  };

  // 离开页面前把没存的存掉
  useEffect(() => () => { void flush(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const change = (key: string, value: unknown) => {
    setParams((prev) => {
      const next = { ...prev, [key]: value };
      queueSave(name, next);
      return next;
    });
  };

  const rename = (value: string) => {
    setName(value);
    queueSave(value, params);
  };

  const reset = () => {
    if (!window.confirm('把所有参数恢复成模板默认值？你换的图和改的文字都会还原。')) return;
    const next = { ...template.defaultParams };
    setParams(next);
    queueSave(name, next);
  };

  const doExport = async () => {
    await flush();
    setExp({ kind: 'running', message: '准备中…', percent: 0 });
    try {
      await streamRender(
        { compositionId: template.id, inputProps: props, name: name || template.name, workId: work.id },
        {
          progress: (d) => setExp({ kind: 'running', message: d.message, percent: d.percent }),
          done: (d) => setExp({ kind: 'done', file: d.file, url: d.url }),
          failed: (d) => setExp({ kind: 'failed', message: d.message }),
        },
      );
    } catch (err) {
      setExp({ kind: 'failed', message: err instanceof Error ? err.message : String(err) });
    }
  };

  const back = async () => {
    await flush();
    onBack();
  };

  const saveText = { saved: '已自动保存', saving: '保存中…', dirty: '有改动，马上保存', error: '保存失败，检查一下工作台是否还开着' }[save];

  return (
    <div className="st-editor">
      <div className="st-top">
        <button onClick={() => void back()}>← 返回</button>
        <input className="st-name" value={name} onChange={(e) => rename(e.target.value)} placeholder="给这条视频起个名字" />
        <span className={`st-save ${save}`}>{saveText}</span>
        <span className="grow" />
        <button onClick={reset}>恢复默认</button>
        <button className="primary" disabled={exp.kind === 'running'} onClick={() => void doExport()}>
          {exp.kind === 'running' ? '导出中…' : '导出视频'}
        </button>
      </div>
      <div className="st-body">
        <div className="st-preview">
          <Player
            component={template.component}
            inputProps={props}
            durationInFrames={props.durationInFrames}
            compositionWidth={template.width}
            compositionHeight={template.height}
            fps={template.fps}
            controls
            loop
            autoPlay
            clickToPlay
            acknowledgeRemotionLicense
            style={{ width: '100%', aspectRatio: `${template.width} / ${template.height}`, background: '#000', borderRadius: 8 }}
          />
          <div className="st-hint">预览是实时的：右边一改，这里马上变。预览偶尔掉帧不影响导出的视频</div>
          <ExportPanel state={exp} />
        </div>
        <div className="st-form">
          <div className="st-origin">{template.origin}</div>
          {template.form.map((section) => (
            <section key={section.title}>
              <h3>{section.title}</h3>
              {section.fields.map((f) => (
                <FieldRow key={f.key} field={f} values={params} onChange={change} />
              ))}
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}

function ExportPanel({ state }: { state: ExportState }) {
  if (state.kind === 'idle') return null;
  if (state.kind === 'running') {
    return (
      <div className="st-export">
        <div>{state.message}{state.percent !== null ? ` ${state.percent}%` : ''}</div>
        <div className="st-bar"><div style={{ width: `${state.percent ?? 0}%` }} /></div>
      </div>
    );
  }
  if (state.kind === 'failed') {
    return <div className="st-export failed">导出失败：{state.message}</div>;
  }
  return (
    <div className="st-export done">
      <div>✓ 导出完成，已经在访达里打开</div>
      <div className="st-hint">{state.file}</div>
      <div className="st-actions">
        <a href={state.url} target="_blank" rel="noreferrer">在这里播放</a>
        <button onClick={() => void studioApi.reveal(state.file)}>在访达中显示</button>
      </div>
    </div>
  );
}
