import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from './icons';

/**
 * 菜单和弹出按钮，照 macOS 的样子：半透明毛玻璃底、选中项左边打勾、快捷键靠右灰色显示。
 * 菜单画在 body 上（portal），不会被右边面板的滚动区域裁掉。
 */

export type MenuItem =
  | { kind?: 'item'; label: string; shortcut?: string; checked?: boolean; disabled?: boolean; icon?: React.ReactNode; onSelect: () => void }
  | { kind: 'separator' }
  | { kind: 'header'; label: string };

type Selectable = Extract<MenuItem, { onSelect: () => void }>;
const isSelectable = (m: MenuItem): m is Selectable => (m.kind === undefined || m.kind === 'item') && !(m as Selectable).disabled;

function Menu({ items, anchor, onClose, align = 'start' }: {
  items: MenuItem[];
  anchor: DOMRect;
  onClose: (refocus: boolean) => void;
  align?: 'start' | 'end';
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ left: anchor.left, top: anchor.bottom + 4, visible: false });
  const firstChecked = items.findIndex((m) => isSelectable(m) && m.checked);
  const [active, setActive] = useState(firstChecked >= 0 ? firstChecked : items.findIndex(isSelectable));

  // 量好菜单大小再定位置：下面放不下就往上开，右边出界就往左挪
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const w = el.offsetWidth;
    const h = el.offsetHeight;
    let left = align === 'end' ? anchor.right - w : anchor.left;
    left = Math.max(8, Math.min(left, window.innerWidth - w - 8));
    let top = anchor.bottom + 4;
    if (top + h > window.innerHeight - 8) top = Math.max(8, anchor.top - h - 4);
    setPos({ left, top, visible: true });
    el.focus();
  }, [anchor, align]);

  useEffect(() => {
    const down = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) onClose(false);
    };
    const blur = () => onClose(false);
    document.addEventListener('pointerdown', down, true);
    window.addEventListener('blur', blur);
    window.addEventListener('resize', blur);
    return () => {
      document.removeEventListener('pointerdown', down, true);
      window.removeEventListener('blur', blur);
      window.removeEventListener('resize', blur);
    };
  }, [onClose]);

  const move = (dir: 1 | -1) => {
    for (let i = 1; i <= items.length; i++) {
      const j = (active + dir * i + items.length) % items.length;
      const item = items[j];
      if (item && isSelectable(item)) { setActive(j); return; }
    }
  };

  const choose = (item: MenuItem) => {
    if (!isSelectable(item)) return;
    onClose(true);
    item.onSelect();
  };

  return createPortal(
    <div
      ref={ref}
      className="menu"
      role="menu"
      tabIndex={-1}
      data-keytrap=""
      style={{ left: pos.left, top: pos.top, minWidth: Math.max(anchor.width, 160), visibility: pos.visible ? 'visible' : 'hidden' }}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === 'ArrowDown') { e.preventDefault(); move(1); }
        else if (e.key === 'ArrowUp') { e.preventDefault(); move(-1); }
        else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); const it = items[active]; if (it) choose(it); }
        else if (e.key === 'Escape') { e.preventDefault(); onClose(true); }
        else if (e.key === 'Tab') { e.preventDefault(); onClose(true); }
      }}
    >
      {items.map((item, i) => {
        if (item.kind === 'separator') return <div key={i} className="menu-sep" role="separator" />;
        if (item.kind === 'header') return <div key={i} className="menu-header">{item.label}</div>;
        const disabled = !!item.disabled;
        return (
          <div
            key={i}
            role={item.checked !== undefined ? 'menuitemradio' : 'menuitem'}
            aria-checked={item.checked}
            aria-disabled={disabled}
            className={`menu-item${i === active && !disabled ? ' active' : ''}`}
            onPointerEnter={() => !disabled && setActive(i)}
            onClick={() => choose(item)}
          >
            <span className="menu-check">{item.checked ? <Icon.check size={13} /> : null}</span>
            {item.icon && <span className="menu-icon">{item.icon}</span>}
            <span className="menu-label">{item.label}</span>
            {item.shortcut && <span className="menu-key">{item.shortcut}</span>}
          </div>
        );
      })}
    </div>,
    document.body,
  );
}

/** 点一下弹出菜单的按钮。trigger 用 render 函数，按钮长什么样由调用方决定 */
export function MenuButton({ items, align, children, label, className = '', disabled }: {
  items: MenuItem[] | (() => MenuItem[]);
  align?: 'start' | 'end';
  children: React.ReactNode;
  label?: string;
  className?: string;
  disabled?: boolean;
}) {
  const btn = useRef<HTMLButtonElement>(null);
  const [anchor, setAnchor] = useState<DOMRect | null>(null);
  const close = React.useCallback((refocus: boolean) => {
    setAnchor(null);
    if (refocus) btn.current?.focus();
  }, []);
  return (
    <>
      <button
        ref={btn}
        type="button"
        className={className}
        aria-haspopup="menu"
        aria-expanded={!!anchor}
        aria-label={label}
        title={label}
        disabled={disabled}
        onClick={() => setAnchor(anchor ? null : btn.current?.getBoundingClientRect() ?? null)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown' && !anchor) { e.preventDefault(); setAnchor(btn.current?.getBoundingClientRect() ?? null); }
        }}
      >
        {children}
      </button>
      {anchor && <Menu items={typeof items === 'function' ? items() : items} anchor={anchor} align={align} onClose={close} />}
    </>
  );
}

export type PopupOption<T extends string> = { value: T; label: string; shortcut?: string; hint?: string };

/**
 * 弹出按钮（NSPopUpButton）：显示当前选的，点开是带勾的菜单。
 * emptyLabel 给了就在最上面放一个「不选」的选项（标注里「没标」和「标了某个值」要分得开）。
 */
export function PopupButton<T extends string>({ id, value, options, onChange, emptyLabel, placeholder = '选择…', disabled, label }: {
  id?: string;
  value: T | null | undefined;
  options: PopupOption<T>[];
  onChange: (v: T | null) => void;
  emptyLabel?: string;
  placeholder?: string;
  disabled?: boolean;
  label?: string;
}) {
  const current = options.find((o) => o.value === value);
  const items: MenuItem[] = [
    ...(emptyLabel ? [{ label: emptyLabel, checked: !current, onSelect: () => onChange(null) }, { kind: 'separator' as const }] : []),
    ...options.map((o) => ({ label: o.label, shortcut: o.shortcut, checked: o.value === value, onSelect: () => onChange(o.value) })),
  ];
  return (
    <span id={id} className="popup-wrap">
      <MenuButton items={items} className="popup" label={label} disabled={disabled}>
        <span className={current ? 'popup-value' : 'popup-value placeholder'}>{current?.label ?? placeholder}</span>
        <Icon.upDown size={12} className="popup-chevrons" />
      </MenuButton>
    </span>
  );
}
