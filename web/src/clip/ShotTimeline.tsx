import React, { useEffect, useRef, useState } from 'react';
import { fmtTime, thumbUrl, tickDigits, type ReelProject } from '../api';
import { type Clock, useClock } from '../ui/clock';
import { Kbd, Slider } from '../ui/controls';
import { Icon } from '../ui/icons';
import { BottomPanel } from '../ui/layout';
import { Playhead, Ruler, timeAt, useFollowPlayhead, useTimelineScale } from '../ui/timeline';
import { ROLL_COLORS } from './ShotInspector';

/**
 * 底部时间轴：每个镜头一块，宽窄和镜头长短一样，颜色是归类，底图是镜头缩略图。
 * 点一块选中它并跳到点的位置；点刻度尺拖动播放头；按住 ⌘ 滚动或双指捏合缩放。
 */

const LEGEND = [
  { label: 'A-roll', color: ROLL_COLORS['a-roll'] },
  { label: 'B-roll', color: ROLL_COLORS['b-roll'] },
  { label: '叠加层', color: ROLL_COLORS.overlay },
  { label: '字卡', color: ROLL_COLORS.title },
  { label: '没归类', color: ROLL_COLORS.unset },
];

const ROLL_NAMES: Record<string, string> = { 'a-roll': 'A-roll', 'b-roll': 'B-roll', overlay: '叠加层', title: '字卡', unset: '没归类' };

export function ShotTimeline({ project, activeIndex, clock, playing, onSelect, onSeek, onSplit, onMerge, onAutoSplit }: {
  project: ReelProject;
  activeIndex: number;
  clock: Clock;
  playing: boolean;
  onSelect: (index: number, time: number) => void;
  onSeek: (time: number) => void;
  onSplit: () => void;
  onMerge: () => void;
  onAutoSplit: () => void;
}) {
  const duration = Math.max(0.1, project.source.duration);
  const [zoomPos, setZoomPos] = useState(0); // 0–100，按对数换算成 1–40 倍
  const zoom = Math.pow(40, zoomPos / 100);
  const { ref: scroller, pxPerSec } = useTimelineScale(duration, zoom);
  const track = useRef<HTMLDivElement>(null);

  // 触控板双指捏合（浏览器里表现为按住 ctrl 的滚轮）缩放时间轴
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

  const active = project.shots[activeIndex];
  // 放大时把选中的镜头滚到眼前
  useEffect(() => {
    const el = scroller.current;
    if (!el || !active) return;
    const x = active.start * pxPerSec;
    if (x < el.scrollLeft || x > el.scrollLeft + el.clientWidth - 60) el.scrollLeft = Math.max(0, x - 80);
  }, [active, pxPerSec, scroller]);

  return (
    <BottomPanel label="时间轴" storageKey="clip-timeline">
      <div className="tl-head">
        <span className="tl-title">时间轴</span>
        <div className="legend">
          {LEGEND.map((l) => <span key={l.label}><i style={{ background: l.color }} />{l.label}</span>)}
        </div>
        <div className="spacer" />
        <button type="button" className="tool-btn" onClick={onSplit} title="在播放头的位置把镜头切成两个（场景检测没切开的地方用它补）">
          <Icon.scissors size={14} />切一刀 <Kbd>S</Kbd>
        </button>
        <button type="button" className="tool-btn" onClick={onMerge} title="把选中的镜头并进前一个（多切了一刀时用）">
          <Icon.merge size={14} />合并到前一个 <Kbd>M</Kbd>
        </button>
        <button type="button" className="tool-btn" onClick={onAutoSplit} title="只对选中的镜头用更高的灵敏度重新找切点">
          <Icon.wand size={14} />细切这个镜头…
        </button>
        <div className="zoom">
          <button type="button" className="icon-btn small" aria-label="缩小时间轴" title="缩小时间轴" onClick={() => setZoomPos((z) => Math.max(0, z - 15))}><Icon.zoomOut size={15} /></button>
          <Slider label="时间轴缩放" value={zoomPos} min={0} max={100} step={1} onChange={setZoomPos} />
          <button type="button" className="icon-btn small" aria-label="放大时间轴" title="放大时间轴" onClick={() => setZoomPos((z) => Math.min(100, z + 15))}><Icon.zoomIn size={15} /></button>
        </div>
      </div>
      <div className="tl-body">
        <div className="tl-labels">
          <div className="tl-label shots">镜头</div>
        </div>
        <div className="tl-scroll" ref={scroller}>
          <div className="tl-content" style={{ width: duration * pxPerSec + 24 }}>
            <Ruler duration={duration} pxPerSec={pxPerSec} format={(t) => fmtTime(t, tickDigits(t))} onScrub={onSeek} />
            <div
              ref={track}
              className="tl-track shots"
              style={{ width: duration * pxPerSec }}
              onClick={(e) => { if (e.target === track.current) onSeek(timeAt(e, track.current, pxPerSec, duration)); }}
            >
              {project.shots.map((s, i) => {
                const w = Math.max(2, (s.end - s.start) * pxPerSec - 2);
                const selected = i === activeIndex;
                return (
                  <button
                    key={s.id}
                    type="button"
                    className={`shot-block${selected ? ' selected' : ''}`}
                    style={{ left: s.start * pxPerSec, width: w }}
                    aria-pressed={selected}
                    aria-label={`镜头 ${i + 1}，${ROLL_NAMES[s.roll] ?? ''}，${(s.end - s.start).toFixed(1)} 秒${s.reviewed ? '，看完了' : ''}`}
                    title={`${s.id} · ${ROLL_NAMES[s.roll] ?? ''} · ${(s.end - s.start).toFixed(1)} 秒`}
                    onClick={(e) => track.current && onSelect(i, timeAt(e, track.current, pxPerSec, duration))}
                  >
                    {s.thumbnail && <img src={thumbUrl(project.id, s.thumbnail)} alt="" loading="lazy" draggable={false} />}
                    <span className="shot-bar" style={{ background: ROLL_COLORS[s.roll] }} />
                    {w > 22 && (
                      <span className="shot-cap">
                        <b>{i + 1}</b>
                        {w > 58 && <span>{(s.end - s.start).toFixed(1)}s</span>}
                      </span>
                    )}
                    {s.reviewed && w > 28 && <span className="shot-check"><Icon.checkCircle size={13} /></span>}
                  </button>
                );
              })}
            </div>
            <ClockPlayhead clock={clock} pxPerSec={pxPerSec} scroller={scroller} playing={playing} />
          </div>
        </div>
      </div>
    </BottomPanel>
  );
}

function ClockPlayhead({ clock, pxPerSec, scroller, playing }: { clock: Clock; pxPerSec: number; scroller: React.RefObject<HTMLDivElement | null>; playing: boolean }) {
  const t = useClock(clock);
  const x = t * pxPerSec;
  useFollowPlayhead(scroller, x, playing);
  return <Playhead x={x} />;
}
