import React, { useRef, useState } from 'react';
import type { Field } from '../../../templates/src/form';
import { studioApi } from './api';

/**
 * 表单控件。全部按模板的中文表单描述（templates/src/form.ts）生成，
 * 模板作者只写描述，不用为每个模板写界面。
 */

type Values = Record<string, unknown>;

function Hint({ text }: { text?: string }) {
  return text ? <div className="st-hint">{text}</div> : null;
}

function ImageField({ field, value, onChange }: { field: Extract<Field, { kind: 'image' }>; value: string; onChange: (v: string) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const pick = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    setError('');
    try {
      const { url } = await studioApi.uploadImage(file);
      onChange(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : '上传失败');
    } finally {
      setBusy(false);
      if (input.current) input.current.value = '';
    }
  };
  return (
    <div
      className="st-image"
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => { e.preventDefault(); void pick(e.dataTransfer.files[0]); }}
    >
      <img src={value} alt="" />
      <div>
        <button type="button" disabled={busy} onClick={() => input.current?.click()}>
          {busy ? '上传中…' : '换一张图'}
        </button>
        <div className="st-hint">也可以直接把图片拖到这里</div>
        {error && <div className="st-error">{error}</div>}
      </div>
      <input ref={input} type="file" accept="image/png,image/jpeg,image/webp,image/gif" hidden onChange={(e) => void pick(e.target.files?.[0])} />
    </div>
  );
}

function NumberField({ field, value, onChange }: { field: Extract<Field, { kind: 'number' }>; value: number; onChange: (v: number) => void }) {
  // 输入框里允许暂时是空的或打到一半（比如「1.」），失焦时再落回合法值
  const [draft, setDraft] = useState<string | null>(null);
  const clamp = (n: number) => Math.min(field.max, Math.max(field.min, n));
  return (
    <div className="st-number">
      <input
        type="range"
        min={field.min}
        max={field.max}
        step={field.step}
        value={Number.isFinite(value) ? value : field.min}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      <input
        type="number"
        min={field.min}
        max={field.max}
        step={field.step}
        value={draft ?? String(value)}
        onChange={(e) => {
          setDraft(e.target.value);
          const n = Number(e.target.value);
          if (e.target.value !== '' && Number.isFinite(n)) onChange(clamp(n));
        }}
        onBlur={() => setDraft(null)}
      />
      {field.unit && <span className="st-unit">{field.unit}</span>}
    </div>
  );
}

function ColorField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="st-color">
      <input type="color" value={/^#[0-9a-f]{6}$/i.test(value) ? value : '#000000'} onChange={(e) => onChange(e.target.value)} />
      <input type="text" value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

export function FieldRow({ field, values, onChange }: { field: Field; values: Values; onChange: (key: string, v: unknown) => void }) {
  const value = values[field.key];
  const set = (v: unknown) => onChange(field.key, v);
  let control: React.ReactNode = null;
  switch (field.kind) {
    case 'image':
      control = <ImageField field={field} value={String(value ?? '')} onChange={set} />;
      break;
    case 'text':
      control = <input type="text" value={String(value ?? '')} placeholder={field.placeholder} onChange={(e) => set(e.target.value)} />;
      break;
    case 'number':
      control = <NumberField field={field} value={Number(value)} onChange={set} />;
      break;
    case 'color':
      control = <ColorField value={String(value ?? '')} onChange={set} />;
      break;
    case 'select':
      control = (
        <select value={String(value)} onChange={(e) => set(e.target.value)}>
          {field.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      );
      break;
    case 'toggle':
      control = (
        <label className="st-toggle">
          <input type="checkbox" checked={Boolean(value)} onChange={(e) => set(e.target.checked)} />
          <span>{value ? '开' : '关'}</span>
        </label>
      );
      break;
    case 'list':
      return <ListField field={field} items={(value as Values[]) ?? []} onChange={set} />;
  }
  return (
    <div className="st-field">
      <label>{field.label}</label>
      {control}
      <Hint text={field.hint} />
    </div>
  );
}

function ListField({ field, items, onChange }: { field: Extract<Field, { kind: 'list' }>; items: Values[]; onChange: (v: Values[]) => void }) {
  const update = (i: number, key: string, v: unknown) => onChange(items.map((it, j) => (j === i ? { ...it, [key]: v } : it)));
  const remove = (i: number) => onChange(items.filter((_, j) => j !== i));
  const move = (i: number, d: -1 | 1) => {
    const j = i + d;
    if (j < 0 || j >= items.length) return;
    const next = items.slice();
    [next[i], next[j]] = [next[j] as Values, next[i] as Values];
    onChange(next);
  };
  return (
    <div className="st-list">
      <Hint text={field.hint} />
      {items.map((item, i) => (
        <div className="st-item" key={i}>
          <div className="st-item-head">
            <b>{field.itemLabel} {i + 1}</b>
            <span className="grow" />
            <button type="button" title="上移" disabled={i === 0} onClick={() => move(i, -1)}>↑</button>
            <button type="button" title="下移" disabled={i === items.length - 1} onClick={() => move(i, 1)}>↓</button>
            <button type="button" className="danger" onClick={() => remove(i)}>删除</button>
          </div>
          {field.fields.map((f) => (
            <FieldRow key={f.key} field={f} values={item} onChange={(k, v) => update(i, k, v)} />
          ))}
        </div>
      ))}
      <button type="button" onClick={() => onChange([...items, field.newItem(items)])}>＋ 加一个{field.itemLabel}</button>
    </div>
  );
}
