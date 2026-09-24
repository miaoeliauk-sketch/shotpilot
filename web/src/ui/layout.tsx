import React, { useEffect, useRef, useState } from 'react';

/**
 * 窗口里各块的骨架：顶部工具栏、中间预览、右边检查器、底部时间轴。
 * 每个页面自己决定放什么，位置和样式统一在这里。
 */

export function Toolbar({ children }: { children: React.ReactNode }) {
  return <header className="toolbar">{children}</header>;
}

export function Workspace({ children, inspector, bottom }: { children: React.ReactNode; inspector?: React.ReactNode; bottom?: React.ReactNode }) {
  return (
    <>
      <div className={`workspace${inspector ? '' : ' no-inspector'}`}>
        <div className="center">{children}</div>
        {inspector}
      </div>
      {bottom}
    </>
  );
}

export function Inspector({ label, title, subtitle, children, footer, aside }: {
  label: string;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  aside?: React.ReactNode;
}) {
  return (
    <aside className="inspector" aria-label={label}>
      <div className="inspector-head">
        <div className="inspector-heading">
          <h2 className="inspector-title">{title}</h2>
          {aside}
        </div>
        {subtitle && <div className="inspector-sub">{subtitle}</div>}
      </div>
      <div className="inspector-body">{children}</div>
      {footer && <div className="inspector-foot">{footer}</div>}
    </aside>
  );
}

/**
 * 底部面板，上沿可以拖动改高度（记住用户拖到多高）。
 */
export function BottomPanel({ label, children, storageKey, defaultHeight = 240 }: {
  label: string;
  children: React.ReactNode;
  storageKey: string;
  defaultHeight?: number;
}) {
  const [height, setHeight] = useState(() => {
    try {
      const saved = Number(localStorage.getItem(`panel:${storageKey}`));
      return saved >= 150 && saved <= 600 ? saved : defaultHeight;
    } catch {
      return defaultHeight;
    }
  });
  const drag = useRef<{ y: number; h: number } | null>(null);
  return (
    <section className="bottom-panel" aria-label={label} style={{ height }}>
      <div
        className="panel-resizer"
        role="separator"
        aria-orientation="horizontal"
        aria-label="拖动改变高度"
        onPointerDown={(e) => {
          drag.current = { y: e.clientY, h: height };
          (e.target as HTMLElement).setPointerCapture(e.pointerId);
        }}
        onPointerMove={(e) => {
          if (!drag.current) return;
          const max = Math.max(160, window.innerHeight - 320);
          setHeight(Math.round(Math.min(max, Math.max(150, drag.current.h - (e.clientY - drag.current.y)))));
        }}
        onPointerUp={() => {
          drag.current = null;
          try { localStorage.setItem(`panel:${storageKey}`, String(height)); } catch { /* 存不了就算了 */ }
        }}
      />
      {children}
    </section>
  );
}

/**
 * 在一个框里按比例放下 16:9（或别的比例）的画面，返回画面该有的宽高。
 * 视频和模板预览都要「尽量大、不变形、不出框」。
 */
export function useFitSize(aspect: number) {
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => {
      const cs = getComputedStyle(el);
      const w = el.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
      const h = el.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
      if (w <= 0 || h <= 0) return;
      const width = Math.floor(Math.min(w, h * aspect));
      setSize({ width, height: Math.floor(width / aspect) });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [aspect]);
  return { ref, ...size };
}

export function EmptyState({ icon, title, children, action }: { icon?: React.ReactNode; title: string; children?: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="empty">
      {icon && <div className="empty-icon">{icon}</div>}
      <div className="empty-title">{title}</div>
      {children && <div className="empty-text">{children}</div>}
      {action}
    </div>
  );
}
