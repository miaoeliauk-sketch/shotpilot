import React, { useEffect, useRef, useState } from 'react';

/**
 * 两个时间轴（拉片的镜头条、模板编辑的动作条）共用的零件：刻度尺、播放头、缩放。
 */

const STEPS = [0.1, 0.25, 0.5, 1, 2, 5, 10, 15, 30, 60, 120, 300, 600];

/** 按缩放挑刻度间隔：两个大刻度之间至少 72 像素，数字不挤在一起 */
export function tickStep(pxPerSec: number): { major: number; minor: number } {
  const major = STEPS.find((s) => s * pxPerSec >= 72) ?? 600;
  const minor = major >= 60 ? major / 6 : major >= 10 ? major / 5 : major / 4;
  return { major, minor };
}

/** 把指针位置换算成时间（考虑横向滚动） */
export function timeAt(e: { clientX: number }, el: HTMLElement, pxPerSec: number, duration: number): number {
  const rect = el.getBoundingClientRect();
  return Math.min(duration, Math.max(0, (e.clientX - rect.left) / pxPerSec));
}

export function Ruler({ duration, pxPerSec, format, onScrub, onScrubEnd }: {
  duration: number;
  pxPerSec: number;
  format: (t: number) => string;
  onScrub: (t: number) => void;
  onScrubEnd?: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const { major, minor } = tickStep(pxPerSec);
  const majors: number[] = [];
  for (let t = 0; t <= duration + 1e-6; t += major) majors.push(Number(t.toFixed(3)));
  const minors: number[] = [];
  for (let t = minor; t <= duration + 1e-6; t += minor) {
    if (Math.abs(t / major - Math.round(t / major)) > 1e-6) minors.push(t);
  }
  const scrubbing = useRef(false);
  return (
    <div
      ref={ref}
      className="tl-ruler"
      style={{ width: duration * pxPerSec }}
      onPointerDown={(e) => {
        if (!ref.current) return;
        scrubbing.current = true;
        ref.current.setPointerCapture(e.pointerId);
        onScrub(timeAt(e, ref.current, pxPerSec, duration));
      }}
      onPointerMove={(e) => {
        if (scrubbing.current && ref.current) onScrub(timeAt(e, ref.current, pxPerSec, duration));
      }}
      onPointerUp={() => { scrubbing.current = false; onScrubEnd?.(); }}
    >
      {minors.map((t) => <span key={`m${t}`} className="tick minor" style={{ left: t * pxPerSec }} />)}
      {majors.map((t) => (
        <span key={t} className="tick" style={{ left: t * pxPerSec }}>
          <span className="tick-label">{format(t)}</span>
        </span>
      ))}
    </div>
  );
}

export function Playhead({ x }: { x: number }) {
  return (
    <div className="playhead" style={{ transform: `translateX(${x}px)` }} aria-hidden="true">
      <div className="playhead-head" />
    </div>
  );
}

/**
 * 时间轴的横向缩放。zoom = 1 时整条正好铺满可见宽度，往上最多放大 40 倍。
 * 返回每秒多少像素，和一个放在容器上的 ref（量可见宽度用）。
 */
export function useTimelineScale(duration: number, zoom: number) {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(800);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setWidth(el.clientWidth));
    ro.observe(el);
    setWidth(el.clientWidth);
    return () => ro.disconnect();
  }, []);
  const fit = Math.max(1, width - 24) / Math.max(0.1, duration);
  return { ref, pxPerSec: fit * zoom };
}

/** 播放时让播放头保持在可见范围里：快跑出右边时整体往前翻一屏 */
export function useFollowPlayhead(scroller: React.RefObject<HTMLDivElement | null>, x: number, active: boolean) {
  useEffect(() => {
    const el = scroller.current;
    if (!el || !active) return;
    const left = el.scrollLeft;
    const right = left + el.clientWidth;
    if (x > right - 40 || x < left) el.scrollLeft = Math.max(0, x - 60);
  }, [scroller, x, active]);
}
