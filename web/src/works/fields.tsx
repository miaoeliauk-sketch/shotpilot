import React, { useRef, useState } from 'react';
import type { Field } from '../../../templates/src/form';
import { api } from '../api';
import { Button, ColorWell, FormRow, NumberInput, Slider, Switch, useFieldId } from '../ui/controls';
import { PopupButton } from '../ui/menu';

/**
 * 模板参数的表单控件。全部按模板的中文表单描述（templates/src/form.ts）生成，
 * 模板作者只写描述，不用为每个模板写界面。列表（气泡）由检查器自己处理。
 */

type Values = Record<string, unknown>;

function ImageField({ label, value, onChange, disabled }: { label: string; value: string; onChange: (v: string) => void; disabled?: boolean }) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [over, setOver] = useState(false);
  const pick = async (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) { setError('只能用图片（png、jpg、webp、gif）'); return; }
    setBusy(true);
    setError('');
    try {
      onChange((await api.uploadImage(file)).url);
    } catch (err) {
      setError(err instanceof Error ? err.message : '上传失败');
    } finally {
      setBusy(false);
      if (input.current) input.current.value = '';
    }
  };
  return (
    <div
      className={`image-well${over ? ' over' : ''}`}
      onDragOver={(e) => { e.preventDefault(); setOver(true); }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => { e.preventDefault(); setOver(false); void pick(e.dataTransfer.files[0]); }}
    >
      {value ? <img src={value} alt={label} /> : <span className="image-empty" />}
      <div className="image-well-side">
        <Button disabled={busy || disabled} onClick={() => input.current?.click()}>{busy ? '正在放进来…' : '换一张图…'}</Button>
        <span className="form-hint">也可以把图片拖到这里</span>
        {error && <span className="form-error">{error}</span>}
      </div>
      <input ref={input} type="file" accept="image/png,image/jpeg,image/webp,image/gif" hidden onChange={(e) => void pick(e.target.files?.[0])} />
    </div>
  );
}

function FieldControl({ field, values, onChange }: { field: Exclude<Field, { kind: 'list' }>; values: Values; onChange: (key: string, v: unknown) => void }) {
  const id = useFieldId(field.key);
  const value = values[field.key];
  const disabled = field.enabledWhen ? !field.enabledWhen(values) : false;
  const set = (v: unknown) => onChange(field.key, v);

  switch (field.kind) {
    case 'toggle':
      return (
        <div className={`toggle-row${disabled ? ' disabled' : ''}`}>
          <div>
            <div className="toggle-label">{field.label}</div>
            {field.hint && <div className="form-hint">{field.hint}</div>}
          </div>
          <Switch label={field.label} checked={Boolean(value)} disabled={disabled} onChange={set} />
        </div>
      );
    case 'image':
      return <FormRow label={field.label} hint={field.hint} disabled={disabled}><ImageField label={field.label} value={String(value ?? '')} onChange={set} disabled={disabled} /></FormRow>;
    case 'text':
      return (
        <FormRow label={field.label} htmlFor={id} hint={field.hint} disabled={disabled}>
          <input id={id} className="field" value={String(value ?? '')} placeholder={field.placeholder} disabled={disabled} onChange={(e) => set(e.target.value)} />
        </FormRow>
      );
    case 'number': {
      const n = Number(value);
      return (
        <FormRow label={field.label} hint={field.hint} disabled={disabled}>
          {field.half ? (
            <NumberInput label={field.label} value={n} min={field.min} max={field.max} step={field.step} unit={field.unit} disabled={disabled} onChange={set} />
          ) : (
            <div className="slider-row">
              <Slider label={field.label} value={n} min={field.min} max={field.max} step={field.step} disabled={disabled} onChange={set} />
              <NumberInput label={field.label} value={n} min={field.min} max={field.max} step={field.step} unit={field.unit} disabled={disabled} onChange={set} />
            </div>
          )}
        </FormRow>
      );
    }
    case 'color':
      return <FormRow label={field.label} hint={field.hint} disabled={disabled}><ColorWell label={field.label} value={String(value ?? '')} disabled={disabled} onChange={set} /></FormRow>;
    case 'select':
      return (
        <FormRow label={field.label} hint={field.hint} disabled={disabled}>
          <PopupButton label={field.label} value={String(value)} options={field.options} disabled={disabled} onChange={(v) => v !== null && set(v)} />
        </FormRow>
      );
  }
}

/**
 * 一组字段。相邻的 half 字段两两并排；列表字段交给 renderList（检查器里画成可点选的行）。
 */
export function FieldList({ fields, values, onChange, renderList }: {
  fields: Field[];
  values: Values;
  onChange: (key: string, v: unknown) => void;
  renderList?: (field: Extract<Field, { kind: 'list' }>) => React.ReactNode;
}) {
  const out: React.ReactNode[] = [];
  for (let i = 0; i < fields.length; i++) {
    const f = fields[i] as Field;
    if (f.kind === 'list') {
      out.push(<React.Fragment key={f.key}>{renderList?.(f)}</React.Fragment>);
      continue;
    }
    const next = fields[i + 1];
    if (f.half && next && next.half && next.kind !== 'list') {
      out.push(
        <div className="half-grid" key={f.key}>
          <FieldControl field={f} values={values} onChange={onChange} />
          <FieldControl field={next} values={values} onChange={onChange} />
        </div>,
      );
      i++;
      continue;
    }
    out.push(<FieldControl key={f.key} field={f} values={values} onChange={onChange} />);
  }
  return <div className="stack">{out}</div>;
}
