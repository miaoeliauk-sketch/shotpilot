import React, { useEffect, useId, useState } from 'react';
import { Icon } from './icons';

/**
 * 苹果风格的基础控件：按钮、分段控件、开关、输入框、滑块、颜色、折叠组。
 * 样式在 web/css/app.css，这里只管结构和行为。所有控件都是真的 button / input，键盘能用。
 */

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'default' | 'primary' | 'plain';
  size?: 'regular' | 'large';
  block?: boolean;
};

export function Button({ variant = 'default', size = 'regular', block, className = '', type = 'button', ...rest }: ButtonProps) {
  const cls = ['btn', variant !== 'default' && variant, size === 'large' && 'large', block && 'block', className].filter(Boolean).join(' ');
  return <button type={type} className={cls} {...rest} />;
}

/** 只有图标的按钮必须带 label（读屏软件念这个，鼠标停上去也显示） */
export function IconButton({ label, className = '', type = 'button', ...rest }: React.ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return <button type={type} className={`icon-btn ${className}`} aria-label={label} title={label} {...rest} />;
}

export type SegmentOption<T extends string> = { value: T; label: React.ReactNode; title?: string; dot?: string };

/** 分段控件（NSSegmentedControl）。allowEmpty：再点一下已选中的那段就取消 */
export function Segmented<T extends string>({ options, value, onChange, allowEmpty, label }: {
  options: SegmentOption<T>[];
  value: T | null;
  onChange: (v: T | null) => void;
  allowEmpty?: boolean;
  label: string;
}) {
  return (
    <div className="seg" role="group" aria-label={label}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            aria-pressed={on}
            title={o.title}
            onClick={() => onChange(on && allowEmpty ? null : o.value)}
          >
            {o.dot && <span className="dot" style={{ background: o.dot }} />}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/** 可多选的胶囊按钮（构图、光线） */
export function Tokens<T extends string>({ options, values, onToggle, label }: {
  options: { value: T; label: string; title?: string }[];
  values: T[];
  onToggle: (v: T) => void;
  label: string;
}) {
  return (
    <div className="tokens" role="group" aria-label={label}>
      {options.map((o) => (
        <button key={o.value} type="button" className="token" aria-pressed={values.includes(o.value)} title={o.title} onClick={() => onToggle(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Switch({ checked, onChange, label, disabled }: { checked: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      className="switch"
      onClick={() => onChange(!checked)}
    >
      <span className="knob" />
    </button>
  );
}

/** 表单里的一项：上面标签，下面控件，最下面灰色小字提示 */
export function FormRow({ label, htmlFor, hint, badge, children, disabled, trailing }: {
  label: React.ReactNode;
  htmlFor?: string;
  hint?: React.ReactNode;
  badge?: React.ReactNode;
  children: React.ReactNode;
  disabled?: boolean;
  trailing?: React.ReactNode;
}) {
  return (
    <div className={`form-row${disabled ? ' disabled' : ''}`}>
      <div className="form-label">
        {htmlFor ? <label htmlFor={htmlFor}>{label}</label> : <span>{label}</span>}
        {badge}
        {trailing && <span className="form-trailing">{trailing}</span>}
      </div>
      {children}
      {hint && <div className="form-hint">{hint}</div>}
    </div>
  );
}

export function useFieldId(prefix: string) {
  return `${prefix}-${useId().replace(/:/g, '')}`;
}

/**
 * 数字输入：允许暂时是空的或打到一半（比如「1.」），失焦时再落回合法值。
 * 旁边的上下箭头和键盘 ↑↓ 按 step 加减。
 */
export function NumberInput({ id, value, min, max, step, unit, onChange, disabled, label }: {
  id?: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit?: string;
  onChange: (v: number) => void;
  disabled?: boolean;
  label?: string;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const clamp = (n: number) => Math.min(max, Math.max(min, n));
  const decimals = (String(step).split('.')[1] ?? '').length;
  const bump = (dir: 1 | -1) => onChange(clamp(Number((value + dir * step).toFixed(Math.max(decimals, 2)))));
  const shown = Number.isFinite(value) ? String(Number(value.toFixed(3))) : '';
  return (
    <div className="numfield">
      <input
        id={id}
        className="field num"
        inputMode="decimal"
        aria-label={label}
        disabled={disabled}
        value={draft ?? shown}
        onChange={(e) => {
          setDraft(e.target.value);
          const n = Number(e.target.value);
          if (e.target.value.trim() !== '' && Number.isFinite(n)) onChange(clamp(n));
        }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowUp') { e.preventDefault(); setDraft(null); bump(1); }
          if (e.key === 'ArrowDown') { e.preventDefault(); setDraft(null); bump(-1); }
          if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
        }}
        onBlur={() => setDraft(null)}
      />
      <div className="stepper">
        <button type="button" tabIndex={-1} aria-label="加" disabled={disabled} onClick={() => bump(1)}><Icon.chevronUp size={10} /></button>
        <button type="button" tabIndex={-1} aria-label="减" disabled={disabled} onClick={() => bump(-1)}><Icon.chevronDown size={10} /></button>
      </div>
      {unit && <span className="unit">{unit}</span>}
    </div>
  );
}

/** 滑块。左边走过的一段用强调色填上，像系统滑块一样 */
export function Slider({ value, min, max, step, onChange, disabled, label }: {
  value: number; min: number; max: number; step: number; onChange: (v: number) => void; disabled?: boolean; label: string;
}) {
  const pct = max > min ? ((Math.min(max, Math.max(min, value)) - min) / (max - min)) * 100 : 0;
  return (
    <input
      type="range"
      className="slider"
      aria-label={label}
      min={min}
      max={max}
      step={step}
      value={Number.isFinite(value) ? value : min}
      disabled={disabled}
      style={{ '--fill': `${pct}%` } as React.CSSProperties}
      onChange={(e) => onChange(Number(e.target.value))}
    />
  );
}

export function ColorWell({ value, onChange, label, disabled }: { value: string; onChange: (v: string) => void; label: string; disabled?: boolean }) {
  const valid = /^#[0-9a-f]{6}$/i.test(value);
  return (
    <div className="colorfield">
      <input type="color" className="well" aria-label={label} disabled={disabled} value={valid ? value : '#000000'} onChange={(e) => onChange(e.target.value)} />
      <input className="field mono" aria-label={`${label}（色值）`} disabled={disabled} value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

/**
 * 可折叠的一组（Xcode、Keynote 检查器里那种）。
 * storageKey 给了就记住开合状态，下次打开还是用户上次的样子。
 */
export function Disclosure({ title, summary, children, defaultOpen = false, storageKey, open: forced }: {
  title: React.ReactNode;
  summary?: React.ReactNode;
  children: React.ReactNode;
  defaultOpen?: boolean;
  storageKey?: string;
  open?: boolean;
}) {
  const [open, setOpen] = useState(() => {
    if (!storageKey) return defaultOpen;
    try {
      const saved = localStorage.getItem(`disclosure:${storageKey}`);
      return saved === null ? defaultOpen : saved === '1';
    } catch {
      return defaultOpen;
    }
  });
  useEffect(() => { if (forced !== undefined) setOpen(forced); }, [forced]);
  const toggle = () => {
    const next = !open;
    setOpen(next);
    if (storageKey) { try { localStorage.setItem(`disclosure:${storageKey}`, next ? '1' : '0'); } catch { /* 存不了就算了 */ } }
  };
  return (
    <section className={`disclosure${open ? ' open' : ''}`}>
      <button type="button" className="disclosure-head" aria-expanded={open} onClick={toggle}>
        <Icon.chevronRight size={12} className="disclosure-chevron" />
        <span className="disclosure-title">{title}</span>
        {!open && summary && <span className="disclosure-summary">{summary}</span>}
      </button>
      {open && <div className="disclosure-body">{children}</div>}
    </section>
  );
}

export function Spinner({ size = 16 }: { size?: number }) {
  return <span className="spinner" style={{ width: size, height: size }} aria-hidden="true" />;
}

export function Progress({ value }: { value: number | null }) {
  return (
    <div className={`progress${value === null ? ' indeterminate' : ''}`} role="progressbar" aria-valuenow={value ?? undefined} aria-valuemin={0} aria-valuemax={100}>
      <div style={{ width: value === null ? undefined : `${Math.max(2, value)}%` }} />
    </div>
  );
}

export function Kbd({ children }: { children: React.ReactNode }) {
  return <kbd className="kbd">{children}</kbd>;
}
