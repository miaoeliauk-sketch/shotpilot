import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

/**
 * 弹出面板（macOS 的 sheet）和屏幕下方的提示条。
 *
 * Mac 软件（Electron）里不能用 window.prompt，所以要用户填东西（新建拉片、重新切分的灵敏度）
 * 都走 Sheet；确认类的问题也用它，按钮文字写清楚会发生什么。
 */

export function Sheet({ title, children, actions, onCancel, width = 480, busy }: {
  title: React.ReactNode;
  children: React.ReactNode;
  actions: React.ReactNode;
  onCancel: () => void;
  width?: number;
  busy?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    const first = el?.querySelector<HTMLElement>('input, textarea, [data-autofocus]');
    (first ?? el)?.focus();
  }, []);
  return createPortal(
    <div className="sheet-backdrop">
      <div
        ref={ref}
        className="sheet"
        role="dialog"
        aria-modal="true"
        aria-label={typeof title === 'string' ? title : undefined}
        tabIndex={-1}
        data-keytrap=""
        style={{ width }}
        onKeyDown={(e) => {
          e.stopPropagation();
          if (e.key === 'Escape' && !busy) { e.preventDefault(); onCancel(); }
        }}
      >
        <h2 className="sheet-title">{title}</h2>
        <div className="sheet-body">{children}</div>
        <div className="sheet-actions">{actions}</div>
      </div>
    </div>,
    document.body,
  );
}

/** 让用户确认一件事。返回 Promise<boolean>，用法像 window.confirm，但长得像 Mac 的 */
export function useConfirm() {
  const [state, setState] = useState<{ title: string; message: string; confirm: string; destructive?: boolean; resolve: (ok: boolean) => void } | null>(null);
  const ask = (opts: { title: string; message: string; confirm: string; destructive?: boolean }) =>
    new Promise<boolean>((resolve) => setState({ ...opts, resolve }));
  const done = (ok: boolean) => { state?.resolve(ok); setState(null); };
  const element = state ? (
    <Sheet
      title={state.title}
      width={420}
      onCancel={() => done(false)}
      actions={(
        <>
          <button type="button" className="btn" onClick={() => done(false)}>取消</button>
          <button type="button" className={`btn ${state.destructive ? 'destructive' : 'primary'}`} data-autofocus="" onClick={() => done(true)}>{state.confirm}</button>
        </>
      )}
    >
      <p className="sheet-text">{state.message}</p>
    </Sheet>
  ) : null;
  return { ask, element };
}

type Hud = { id: number; text: string; tone: 'info' | 'error' | 'success' };
let listeners: ((h: Hud) => void)[] = [];
let seq = 0;

/** 在窗口下方弹一条提示，几秒后自己消失 */
export function hud(text: string, tone: Hud['tone'] = 'info') {
  const h = { id: ++seq, text, tone };
  listeners.forEach((l) => l(h));
}

export function HudHost() {
  const [items, setItems] = useState<Hud[]>([]);
  useEffect(() => {
    const add = (h: Hud) => {
      // 同一时间只留最新的两条，连续操作时不会堆一屏
      setItems((prev) => [...prev.slice(-1), h]);
      window.setTimeout(() => setItems((prev) => prev.filter((x) => x.id !== h.id)), h.tone === 'error' ? 6000 : 2800);
    };
    listeners.push(add);
    return () => { listeners = listeners.filter((l) => l !== add); };
  }, []);
  return createPortal(
    <div className="hud-stack" aria-live="polite">
      {items.map((h) => <div key={h.id} className={`hud ${h.tone}`}>{h.text}</div>)}
    </div>,
    document.body,
  );
}
