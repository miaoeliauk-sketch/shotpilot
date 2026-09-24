import React, { useEffect, useRef, useState } from 'react';
import type { EditorSelection, Params, TimelineItem, TimelineTrack } from '../../../templates/src/form';
import type { TemplateDef } from '../../../templates/src/registry';
import { type Clock, useClock } from '../ui/clock';
import { Slider } from '../ui/controls';
import { Icon } from '../ui/icons';
import { BottomPanel } from '../ui/layout';
import { Playhead, Ruler, timeAt, useFollowPlayhead, useTimelineScale } from '../ui/timeline';

/**
 * 模板编辑的时间轴：镜头动作一条，每个气泡一条。
 * 拖整块改出现时间，拖两头改长短；拖的时候预览跟着变，松手自动保存。
 */

type Drag = {
  item: TimelineItem;
  edge: 'move' | 'start' | 'end';
  x0: number;
  base: Params;
  moved: boolean;
};

const sameSel = (a: EditorSelection | null, b: EditorSelection) =>
  !!a && JSON.stringify(a) === JSON.stringify(b);

export function EditorTimeline({ template, params, duration, clock, fps, playing, selection, onSelect, onSeek, onParams }: {
  template: TemplateDef;
  params: Params;
  duration: number;
  clock: Clock;
  fps: number;
  playing: boolean;
  selection: EditorSelection | null;
  onSelect: (s: EditorSelection) => void;
  onSeek: (seconds: number) => void;
  onParams: (next: Params) => void;
}) {
  const tracks: TimelineTrack[] = template.timeline
    ? template.timeline.tracks(params)
    : [{
        id: 'all', label: '视频', kind: 'element',
        items: [{ id: 'all', label: template.name, start: 0, end: duration, select: { section: template.form[0]?.title ?? '' }, drag: {} }],
      }];
  // 右边多留一点，能把结尾那头往外拖（比如把头像卡片拖长）
  const range = Math.max(duration * 1.06, duration + 0.3);
  const [zoomPos, setZoomPos] = useState(0);
  const { ref: scroller, pxPerSec } = useTimelineScale(range, Math.pow(20, zoomPos / 100));
  const drag = useRef<Drag | null>(null);
  const [dragText, setDragText] = useState('');

  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const wheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      setZoomPos((z) => Math.min(100, Math.max(0, z - e.deltaY * 0.5)));
    };
    el.addEventListener('wheel', wheel, { passive: false });
    return () => el.removeEventListener('wheel', wheel);
  }, [scroller]);

  const startDrag = (e: React.PointerEvent, item: TimelineItem, edge: Drag['edge']) => {
    e.stopPropagation();
    onSelect(item.select);
    const allowed = edge === 'move' ? item.drag.move : edge === 'start' ? item.drag.start : item.drag.end;
    if (!allowed || !template.timeline) return;
    drag.current = { item, edge, x0: e.clientX, base: params, moved: false };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const moveDrag = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d || !template.timeline) return;
    const dx = e.clientX - d.x0;
    if (!d.moved && Math.abs(dx) < 3) return;
    d.moved = true;
    const dt = dx / pxPerSec;
    let s = d.item.start;
    let en = d.item.end;
    if (d.edge === 'move') { s += dt; en += dt; }
    if (d.edge === 'start') s += dt;
    if (d.edge === 'end') en += dt;
    const next = template.timeline.apply(d.base, d.item.id, d.edge, Math.max(0, s), Math.max(0, en));
    onParams(next);
    // 拖的时候在标题栏旁边显示新时间，松手前就知道拖到了哪
    const moved = template.timeline.tracks(next).flatMap((t) => t.items).find((it) => it.id === d.item.id);
    if (moved) setDragText(`${d.item.label.slice(0, 12)}：${moved.start.toFixed(2)} 秒 → ${moved.end.toFixed(2)} 秒`);
  };

  const endDrag = () => {
    drag.current = null;
    setDragText('');
  };

  const fmt = (t: number) => `${Number(t.toFixed(2))}s`;

  return (
    <BottomPanel label="时间轴" storageKey="editor-timeline" defaultHeight={236}>
      <div className="tl-head">
        <span className="tl-title">时间轴</span>
        <span className="tl-hint">{dragText || (template.timeline ? '拖动色块改出现时间，拖两头改停多久' : '这个模板没有能拖的动作，时长在右边改')}</span>
        <div className="spacer" />
        <span className="tl-hint">总长 <b className="mono">{duration.toFixed(1)}</b> 秒</span>
        <div className="zoom">
          <button type="button" className="icon-btn small" aria-label="缩小时间轴" title="缩小时间轴" onClick={() => setZoomPos((z) => Math.max(0, z - 20))}><Icon.zoomOut size={15} /></button>
          <Slider label="时间轴缩放" value={zoomPos} min={0} max={100} step={1} onChange={setZoomPos} />
          <button type="button" className="icon-btn small" aria-label="放大时间轴" title="放大时间轴" onClick={() => setZoomPos((z) => Math.min(100, z + 20))}><Icon.zoomIn size={15} /></button>
        </div>
      </div>
      <div className="tl-body">
        <div className="tl-labels">
          {tracks.map((t) => {
            const on = t.items.some((it) => sameSel(selection, it.select));
            return <div key={t.id} className={`tl-label${on ? ' on' : ''}`}>{t.label}</div>;
          })}
        </div>
        <div className="tl-scroll" ref={scroller}>
          <div className="tl-content" style={{ width: range * pxPerSec + 24 }}>
            <Ruler duration={range} pxPerSec={pxPerSec} format={fmt} onScrub={(t) => onSeek(Math.min(t, duration))} />
            {tracks.map((t) => (
              <div
                key={t.id}
                className="tl-lane"
                style={{ width: range * pxPerSec }}
                onPointerDown={(e) => { if (e.target === e.currentTarget) onSeek(Math.min(duration, timeAt(e, e.currentTarget, pxPerSec, range))); }}
              >
                <div className="lane-end" style={{ left: duration * pxPerSec }} />
                {t.items.map((it) => {
                  const selected = sameSel(selection, it.select);
                  const left = it.start * pxPerSec;
                  const width = Math.max(6, (it.end - it.start) * pxPerSec);
                  // 文字放在进场和离场两段之间，不和「落下」「飞走」叠在一起
                  const phases = it.phases ?? [];
                  const enter = phases.find((p) => Math.abs(p.start - it.start) < 1e-6);
                  const exit = phases.find((p) => p !== enter && Math.abs(p.end - it.end) < 1e-6);
                  const labelLeft = enter ? (enter.end - it.start) * pxPerSec : 0;
                  const labelRight = exit ? (it.end - exit.start) * pxPerSec : 0;
                  return (
                    <div
                      key={it.id}
                      role="button"
                      tabIndex={0}
                      aria-pressed={selected}
                      aria-label={`${t.label}：${it.label}，${it.start.toFixed(2)} 秒到 ${it.end.toFixed(2)} 秒`}
                      className={`clip-item ${t.kind}${selected ? ' selected' : ''}${it.drag.move ? ' movable' : ''}`}
                      style={{ left, width }}
                      onPointerDown={(e) => startDrag(e, it, 'move')}
                      onPointerMove={moveDrag}
                      onPointerUp={endDrag}
                      onPointerCancel={endDrag}
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(it.select); } }}
                    >
                      {phases.map((p) => (
                        <span
                          key={p.label}
                          className="clip-phase"
                          style={{ left: (p.start - it.start) * pxPerSec, width: Math.max(0, (p.end - p.start) * pxPerSec) }}
                        >
                          {(p.end - p.start) * pxPerSec > 36 ? p.label : ''}
                        </span>
                      ))}
                      <span className="clip-label" style={{ left: labelLeft, right: labelRight }}>{it.label}</span>
                      {it.drag.start && (
                        <span className="clip-handle start" onPointerDown={(e) => startDrag(e, it, 'start')} onPointerMove={moveDrag} onPointerUp={endDrag} onPointerCancel={endDrag} />
                      )}
                      {it.drag.end && (
                        <span className="clip-handle end" onPointerDown={(e) => startDrag(e, it, 'end')} onPointerMove={moveDrag} onPointerUp={endDrag} onPointerCancel={endDrag} />
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
            <FramePlayhead clock={clock} fps={fps} pxPerSec={pxPerSec} scroller={scroller} playing={playing} />
          </div>
        </div>
      </div>
    </BottomPanel>
  );
}

function FramePlayhead({ clock, fps, pxPerSec, scroller, playing }: { clock: Clock; fps: number; pxPerSec: number; scroller: React.RefObject<HTMLDivElement | null>; playing: boolean }) {
  const frame = useClock(clock);
  const x = (frame / fps) * pxPerSec;
  useFollowPlayhead(scroller, x, playing);
  return <Playhead x={x} />;
}
