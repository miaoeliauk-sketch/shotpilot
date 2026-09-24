import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Player, type PlayerRef } from '@remotion/player';
import type { EditorSelection, Params } from '../../../templates/src/form';
import type { TemplateDef } from '../../../templates/src/registry';
import { api, streamPost, type Work } from '../api';
import type { Nav } from '../App';
import { isTyping } from '../clip/keys';
import { createClock, useClock, type Clock } from '../ui/clock';
import { Button, IconButton, Progress, Spinner } from '../ui/controls';
import { Icon } from '../ui/icons';
import { Toolbar, Workspace, useFitSize } from '../ui/layout';
import { MenuButton } from '../ui/menu';
import { hud, useConfirm } from '../ui/overlay';
import { EditorInspector } from './EditorInspector';
import { EditorTimeline } from './EditorTimeline';

/**
 * 用模板做视频：中间实时预览，右边改选中那块的参数，底下拖时间，改完自动保存，一个按钮导出。
 */

type SaveState = 'saved' | 'saving' | 'dirty' | 'error';
type ExportState =
  | { kind: 'idle' }
  | { kind: 'running'; message: string; percent: number | null }
  | { kind: 'done'; file: string; url: string }
  | { kind: 'failed'; message: string };

/** 一打开先选中第一个气泡（有列表的话），右边直接就是最常改的东西 */
function firstSelection(template: TemplateDef, params: Params): EditorSelection | null {
  for (const s of template.form) {
    for (const f of s.fields) {
      if (f.kind === 'list' && Array.isArray(params[f.key]) && (params[f.key] as unknown[]).length > 0) return { list: f.key, index: 0 };
    }
  }
  return template.form[0] ? { section: template.form[0].title } : null;
}

export function Editor({ work, template, nav }: { work: Work; template: TemplateDef; nav: Nav }) {
  // 模板后来加了新参数时，老作品里没有，用默认值补上
  const [params, setParams] = useState<Params>(() => ({ ...template.defaultParams, ...work.params }));
  const [name, setName] = useState(work.name);
  const [lastRender, setLastRender] = useState(work.lastRender);
  const [save, setSave] = useState<SaveState>('saved');
  const [exp, setExp] = useState<ExportState>({ kind: 'idle' });
  const [selection, setSelection] = useState<EditorSelection | null>(() => firstSelection(template, { ...template.defaultParams, ...work.params }));
  const [playing, setPlaying] = useState(false);
  const [loop, setLoop] = useState(true);
  const player = useRef<PlayerRef>(null);
  const clock = useMemo(() => createClock(0), []);
  const confirm = useConfirm();

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
  const duration = props.durationInFrames / template.fps;

  // ── 自动保存 ──
  const pending = useRef<{ name: string; params: Params } | null>(null);
  const timer = useRef<number | undefined>(undefined);
  const flush = useCallback(async () => {
    window.clearTimeout(timer.current);
    const next = pending.current;
    if (!next) return;
    pending.current = null;
    setSave('saving');
    try {
      await api.saveWork(work.id, next);
      setSave(pending.current ? 'dirty' : 'saved');
    } catch {
      setSave('error');
    }
  }, [work.id]);
  const queueSave = useCallback((nextName: string, nextParams: Params) => {
    pending.current = { name: nextName, params: nextParams };
    setSave('dirty');
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => void flush(), 600);
  }, [flush]);
  useEffect(() => () => { void flush(); }, [flush]);
  useEffect(() => {
    const before = () => { void flush(); };
    window.addEventListener('beforeunload', before);
    return () => window.removeEventListener('beforeunload', before);
  }, [flush]);

  const nameRef = useRef(name);
  nameRef.current = name;
  const setAll = useCallback((next: Params) => {
    setParams(next);
    queueSave(nameRef.current, next);
  }, [queueSave]);
  const change = (key: string, value: unknown) => setAll({ ...params, [key]: value });
  const rename = (value: string) => {
    setName(value);
    queueSave(value, params);
  };

  // ── 播放 ──
  useEffect(() => {
    const p = player.current;
    if (!p) return;
    const onFrame = (e: { detail: { frame: number } }) => clock.set(e.detail.frame);
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    p.addEventListener('frameupdate', onFrame);
    p.addEventListener('seeked', onFrame);
    p.addEventListener('play', onPlay);
    p.addEventListener('pause', onPause);
    p.addEventListener('ended', onPause);
    return () => {
      p.removeEventListener('frameupdate', onFrame);
      p.removeEventListener('seeked', onFrame);
      p.removeEventListener('play', onPlay);
      p.removeEventListener('pause', onPause);
      p.removeEventListener('ended', onPause);
    };
  }, [clock]);

  const seek = (seconds: number) => {
    const f = Math.max(0, Math.min(props.durationInFrames - 1, Math.round(seconds * template.fps)));
    player.current?.seekTo(f);
    clock.set(f);
  };
  const toggle = () => player.current?.toggle();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isTyping(e.target) || (e.target as HTMLElement | null)?.closest?.('[data-keytrap]')) return;
      if ((e.key === ' ' || e.code === 'Space') && (e.target as HTMLElement | null)?.tagName !== 'BUTTON') {
        e.preventDefault();
        player.current?.toggle();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  // ── 导出 ──
  const doExport = async () => {
    await flush();
    setExp({ kind: 'running', message: '准备中…', percent: 0 });
    try {
      let failed = '';
      await streamPost('/api/render', { compositionId: template.id, inputProps: props, name: name || template.name, workId: work.id }, {
        progress: (d: { message: string; percent: number | null }) => setExp({ kind: 'running', message: d.message, percent: d.percent }),
        done: (d: { file: string; url: string }) => { setExp({ kind: 'done', file: d.file, url: d.url }); setLastRender(d.file); },
        failed: (d: { message: string }) => { failed = d.message; },
      });
      if (failed) throw new Error(failed);
    } catch (err) {
      setExp({ kind: 'failed', message: err instanceof Error ? err.message : String(err) });
    }
  };

  const reset = async () => {
    const ok = await confirm.ask({
      title: '恢复成模板默认的样子？',
      message: '所有参数都回到模板原来的设置，你换的图和改的文字都会还原。',
      confirm: '恢复默认',
      destructive: true,
    });
    if (!ok) return;
    setAll({ ...template.defaultParams });
    setSelection(firstSelection(template, template.defaultParams));
  };

  const back = async () => {
    await flush();
    nav({ view: 'works' });
  };

  const saveText = { saved: '已自动保存', saving: '正在保存…', dirty: '有改动，马上保存', error: '保存失败，检查一下软件是否还开着' }[save];

  return (
    <>
      <Toolbar>
        <Button variant="plain" onClick={() => void back()}><Icon.chevronLeft size={14} />作品</Button>
        <span className="toolbar-divider" />
        <input className="title-field" aria-label="作品名" value={name} placeholder="给这条视频起个名字" onChange={(e) => rename(e.target.value)} />
        <span className="toolbar-sub">模板：{template.name}</span>
        <div className="spacer" />
        <span className={`save-state ${save}`}>
          {save === 'saved' ? <Icon.check size={13} /> : save === 'error' ? <Icon.warning size={13} /> : <Spinner size={11} />}
          {saveText}
        </span>
        <MenuButton
          className="icon-btn"
          label="更多"
          align="end"
          items={[
            { label: '恢复成模板默认的样子…', onSelect: () => void reset() },
            ...(lastRender ? [{ label: '在访达里找到上次导出的视频', onSelect: () => void api.reveal(lastRender).catch((e: Error) => hud(e.message, 'error')) }] : []),
          ]}
        >
          <Icon.ellipsis size={18} />
        </MenuButton>
        <Button variant="primary" size="large" disabled={exp.kind === 'running'} onClick={() => void doExport()}>
          <Icon.share size={15} />
          {exp.kind === 'running' ? `导出中${exp.percent !== null ? ` ${exp.percent}%` : '…'}` : '导出视频'}
        </Button>
      </Toolbar>
      <Workspace
        inspector={<EditorInspector template={template} params={params} selection={selection} onSelect={setSelection} onChange={change} />}
        bottom={(
          <EditorTimeline
            template={template}
            params={params}
            duration={duration}
            clock={clock}
            fps={template.fps}
            playing={playing}
            selection={selection}
            onSelect={setSelection}
            onSeek={seek}
            onParams={setAll}
          />
        )}
      >
        <PreviewStage template={template} props={props} playerRef={player} loop={loop} onToggle={toggle} />
        <div className="transport">
          <FrameTimecode clock={clock} fps={template.fps} duration={duration} />
          <div className="transport-buttons">
            <IconButton label="回到开头" onClick={() => seek(0)}><Icon.toStart size={18} /></IconButton>
            <IconButton label={playing ? '暂停（空格）' : '播放（空格）'} className="play" onClick={toggle}>
              {playing ? <Icon.pause size={20} /> : <Icon.play size={20} />}
            </IconButton>
            <IconButton label={loop ? '循环播放：开' : '循环播放：关'} className={loop ? 'on' : ''} aria-pressed={loop} onClick={() => setLoop(!loop)}>
              <Icon.loop size={17} />
            </IconButton>
          </div>
          <div className="transport-right"><span className="transport-hint">改了马上就能看到，不用等导出</span></div>
        </div>
        <ExportBar state={exp} onClose={() => setExp({ kind: 'idle' })} />
      </Workspace>
      {confirm.element}
    </>
  );
}

function PreviewStage({ template, props, playerRef, loop, onToggle }: {
  template: TemplateDef;
  props: ReturnType<TemplateDef['toProps']>;
  playerRef: React.RefObject<PlayerRef>;
  loop: boolean;
  onToggle: () => void;
}) {
  const fit = useFitSize(template.width / template.height);
  return (
    <div className="viewer" ref={fit.ref}>
      <div className="frame" style={{ width: fit.width, height: fit.height }} onClick={onToggle}>
        <Player
          ref={playerRef}
          component={template.component}
          inputProps={props}
          durationInFrames={props.durationInFrames}
          compositionWidth={template.width}
          compositionHeight={template.height}
          fps={template.fps}
          loop={loop}
          autoPlay
          acknowledgeRemotionLicense
          style={{ width: '100%', height: '100%' }}
        />
      </div>
    </div>
  );
}

function FrameTimecode({ clock, fps, duration }: { clock: Clock; fps: number; duration: number }) {
  const frame = useClock(clock);
  return <div className="timecode">{(frame / fps).toFixed(2)} <span>/ {duration.toFixed(2)} 秒</span></div>;
}

function ExportBar({ state, onClose }: { state: ExportState; onClose: () => void }) {
  if (state.kind === 'idle') return null;
  if (state.kind === 'running') {
    return (
      <div className="export-bar">
        <div className="export-text">{state.message}</div>
        <Progress value={state.percent} />
      </div>
    );
  }
  if (state.kind === 'failed') {
    return (
      <div className="export-bar failed" role="alert">
        <Icon.warning size={15} />
        <div className="export-text">导出失败：{state.message}</div>
        <Button variant="plain" onClick={onClose}>知道了</Button>
      </div>
    );
  }
  return (
    <div className="export-bar done">
      <Icon.checkCircle size={16} />
      <div className="export-text">导出好了，已经在访达里打开</div>
      <Button onClick={() => void api.reveal(state.file).catch((e: Error) => hud(e.message, 'error'))}>在访达中显示</Button>
      <Button onClick={() => window.open(state.url, '_blank')}>播放</Button>
      <IconButton label="关掉这条提示" onClick={onClose}><Icon.plus size={14} className="rot45" /></IconButton>
    </div>
  );
}
