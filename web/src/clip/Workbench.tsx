import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { DIMENSIONS } from '../../../src/core/vocabulary';
import { api, fmtTime, streamPost, type ProjectSummary, type ReelProject, type Shot } from '../api';
import type { Nav } from '../App';
import { createClock, useClock, type Clock } from '../ui/clock';
import { Button, FormRow, IconButton, NumberInput, Spinner } from '../ui/controls';
import { Icon } from '../ui/icons';
import { Toolbar, Workspace, useFitSize } from '../ui/layout';
import { MenuButton, type MenuItem } from '../ui/menu';
import { Sheet, hud, useConfirm } from '../ui/overlay';
import { inKeyTrap, isTyping, physicalKey } from './keys';
import { NewProjectSheet } from './NewProjectSheet';
import { ROLL_COLORS, ShotInspector, draftToPatch, type AnnotationField, type InspectorTab, type TextDraft } from './ShotInspector';
import type { LibraryTags } from '../../../src/core/types';
import { openSettings } from '../settings/SettingsSheet';
import { ShotTimeline } from './ShotTimeline';

/**
 * 拉片工作台：中间看视频，右边标当前镜头，底下是整条视频的镜头时间轴。
 */

const ROLL_NAMES: Record<string, string> = { 'a-roll': 'A-roll', 'b-roll': 'B-roll', overlay: '叠加层', title: '字卡', unset: '没归类' };

type SheetState = null | { kind: 'resplit' } | { kind: 'autosplit'; shotId: string } | { kind: 'new' };

export function Workbench({ projectId, initialShot, nav, visionConfigured }: {
  projectId: string;
  initialShot?: string;
  nav: Nav;
  visionConfigured: boolean;
}) {
  const [project, setProject] = useState<ReelProject | null>(null);
  const [loadError, setLoadError] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [rate, setRate] = useState(1);
  const [exporting, setExporting] = useState<'one' | 'all' | null>(null);
  const [aiProgress, setAiProgress] = useState<string | null>(null);
  const [sheet, setSheet] = useState<SheetState>(null);
  const [others, setOthers] = useState<ProjectSummary[]>([]);
  const [videoError, setVideoError] = useState<null | 'missing' | 'format'>(null);
  const [tab, setTab] = useState<InspectorTab>('shot');
  const [tagging, setTagging] = useState<string | null>(null);
  const [sending, setSending] = useState<string | null>(null);
  const video = useRef<HTMLVideoElement>(null);
  const clock = useMemo(() => createClock(0), []);
  const confirm = useConfirm();

  const load = useCallback(async (keepShotId?: string) => {
    const p = await api.getProject(projectId);
    setProject(p);
    const i = keepShotId ? p.shots.findIndex((s) => s.id === keepShotId) : -1;
    setActiveIndex(i >= 0 ? i : 0);
    return p;
  }, [projectId]);

  useEffect(() => {
    load(initialShot).catch((e: Error) => setLoadError(e.message));
    api.listProjects().then(setOthers).catch(() => undefined);
  }, [load, initialShot]);

  const shots = project?.shots ?? [];
  const active = shots[activeIndex];

  // ── 保存 ────────────────────────────────────────────────────────────────

  /**
   * 保存镜头改动。shotId 显式传入，响应回来后按 id 找位置写回，而不是写到当前选中的——
   * 等服务器那几十毫秒里用户可能已经切了镜头。
   */
  const patchShot = useCallback(async (shotId: string, patch: Record<string, unknown>) => {
    try {
      const updated = await api.patchShot(projectId, shotId, patch);
      setProject((p) => (p ? { ...p, shots: p.shots.map((s) => (s.id === shotId ? updated : s)) } : p));
    } catch (err) {
      hud(`保存失败：${err instanceof Error ? err.message : err}`, 'error');
    }
  }, [projectId]);

  /**
   * 文本框防抖保存。目标镜头和内容在排队那一刻就锁定，
   * 打完字 0.6 秒内切了镜头，旧镜头的备注照样存到旧镜头上，不会丢、不会串。
   */
  const pending = useRef<{ shotId: string; draft: TextDraft } | null>(null);
  const pendingLib = useRef<{ shotId: string; lib: LibraryTags } | null>(null);
  const timer = useRef<number | undefined>(undefined);
  const flushSave = useCallback(async () => {
    window.clearTimeout(timer.current);
    const p = pending.current;
    const l = pendingLib.current;
    pending.current = null;
    pendingLib.current = null;
    await Promise.all([
      p ? patchShot(p.shotId, draftToPatch(p.draft)) : undefined,
      l ? patchShot(l.shotId, { library: l.lib }) : undefined,
    ]);
  }, [patchShot]);
  /** 素材标签：点选的马上存，打字的攒 0.6 秒再存（和备注一样按镜头锁定） */
  const queueLibrary = useCallback((shotId: string, lib: LibraryTags, textual: boolean) => {
    if (pendingLib.current && pendingLib.current.shotId !== shotId) void flushSave();
    pendingLib.current = { shotId, lib };
    window.clearTimeout(timer.current);
    if (textual) timer.current = window.setTimeout(() => void flushSave(), 600);
    else void flushSave();
  }, [flushSave]);
  const queueText = useCallback((shotId: string, draft: TextDraft) => {
    if (pending.current && pending.current.shotId !== shotId) void flushSave();
    pending.current = { shotId, draft };
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => void flushSave(), 600);
  }, [flushSave]);
  useEffect(() => {
    const before = () => { void flushSave(); };
    window.addEventListener('beforeunload', before);
    return () => { window.removeEventListener('beforeunload', before); void flushSave(); };
  }, [flushSave]);

  /** 先改界面再存（点选标注要跟手） */
  const updateLocal = (shotId: string, fn: (s: Shot) => Shot) =>
    setProject((p) => (p ? { ...p, shots: p.shots.map((s) => (s.id === shotId ? fn(s) : s)) } : p));

  const setTemplateFit = (fit: boolean | null) => {
    if (!active) return;
    updateLocal(active.id, (s) => ({
      ...s,
      templateFit: fit === null ? undefined : { fit, reason: fit === s.templateFit?.fit ? s.templateFit.reason : '', source: 'manual' },
    }));
    void patchShot(active.id, { templateFit: fit === null ? null : { fit } });
  };

  const setRoll = (roll: Shot['roll']) => {
    if (!active) return;
    updateLocal(active.id, (s) => ({ ...s, roll }));
    void patchShot(active.id, { roll });
  };

  const setAnnotation = (field: AnnotationField, value: string | string[] | null) => {
    if (!active) return;
    updateLocal(active.id, (s) => {
      const annotation = { ...s.annotation } as Record<string, unknown>;
      if (value === null) delete annotation[field];
      else annotation[field] = value;
      return { ...s, annotation: annotation as Shot['annotation'], annotationSource: { ...s.annotationSource, [field]: 'manual' } };
    });
    // 只把改动的那个字段发过去，服务端据此把来源标成「手动」，之后 AI 不会覆盖它
    void patchShot(active.id, { annotation: { [field]: value } });
  };

  // ── 播放 ────────────────────────────────────────────────────────────────

  const seek = useCallback((t: number) => {
    const v = video.current;
    clock.set(t);
    if (v) v.currentTime = Math.max(0, t);
  }, [clock]);

  /** 在刻度尺上拖、点空白处：播放头挪过去，右边也换成那里的镜头 */
  const scrubTo = useCallback((t: number) => {
    seek(t);
    const i = shots.findIndex((s) => t >= s.start && t < s.end);
    if (i >= 0 && i !== activeIndex) {
      flushSave();
      setActiveIndex(i);
    }
  }, [seek, shots, activeIndex, flushSave]);

  const selectShot = useCallback((index: number, time?: number) => {
    const s = shots[index];
    if (!s) return;
    // 必须在换镜头之前把没存的文字冲出去
    flushSave();
    // 焦点还留在备注框里的话，换镜头后按键会继续打进文本框，而不是触发快捷键
    const el = document.activeElement as HTMLElement | null;
    if (isTyping(el)) el?.blur();
    setActiveIndex(index);
    // 往里挪 50ms，避免正好落在切点上取到上一个镜头的末帧
    seek(time ?? s.start + 0.05);
  }, [shots, flushSave, seek]);

  const togglePlay = useCallback(() => {
    const v = video.current;
    if (!v) return;
    if (v.paused) void v.play(); else v.pause();
  }, []);

  // 播放时时间轴的播放头每帧都跟上；选中的镜头跟着播放位置走（正在打字时不跟，免得打断）
  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    const tick = () => {
      const v = video.current;
      if (v) clock.set(v.currentTime);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, clock]);

  useEffect(() => {
    if (!playing) return;
    return clock.subscribe(() => {
      const t = clock.get();
      if (isTyping(document.activeElement)) return;
      const i = shots.findIndex((s) => t >= s.start && t < s.end);
      if (i >= 0 && i !== activeIndex) {
        flushSave();
        setActiveIndex(i);
      }
    });
  }, [playing, clock, shots, activeIndex, flushSave]);

  useEffect(() => { if (video.current) video.current.playbackRate = rate; }, [rate]);

  // ── 切分、合并 ────────────────────────────────────────────────────────

  /**
   * 在播放头的位置切一刀，切的是播放头下面那个镜头（和剪辑软件的刀片一样），不一定是选中的那个。
   * 场景检测抓不到「同一个人、同一背景、只换机位」的切换，靠它补。
   */
  const splitAtPlayhead = async () => {
    flushSave();
    const t = video.current?.currentTime ?? clock.get();
    const target = shots.find((s) => t > s.start + 0.05 && t < s.end - 0.05);
    if (!target) {
      hud('播放头正好在两个镜头的交界上，往里挪一点再切', 'error');
      return;
    }
    try {
      const r = await api.splitShot(projectId, target.id, t);
      setProject((p) => (p ? { ...p, shots: r.shots } : p));
      // 停在切出来的后半段：按 S 就是因为发现这里换画面了，下一步多半要标它
      const next = r.shots.findIndex((x) => Math.abs(x.start - t) < 0.05);
      if (next >= 0) setActiveIndex(next);
      hud(`在 ${fmtTime(t)} 切了一刀，现在 ${r.shots.length} 个镜头`, 'success');
    } catch (err) {
      hud(`切不了：${err instanceof Error ? err.message : err}`, 'error');
    }
  };

  const mergeIntoPrevious = async () => {
    flushSave();
    if (!active) return;
    if (activeIndex === 0) { hud('第一个镜头前面没有镜头可以合并', 'error'); return; }
    try {
      const r = await api.mergeShot(projectId, active.id);
      setProject((p) => (p ? { ...p, shots: r.shots } : p));
      setActiveIndex(Math.max(0, activeIndex - 1));
      hud(`合并好了，现在 ${r.shots.length} 个镜头`, 'success');
    } catch (err) {
      hud(`合并失败：${err instanceof Error ? err.message : err}`, 'error');
    }
  };

  // ── 导出 ────────────────────────────────────────────────────────────────

  /**
   * 导出复刻包。shotId 为 null 时导出所有 B-roll / 叠加层 / 字卡；fitOnly 时只导「适合做模板」的。
   * 完成后服务端在访达里打开。
   */
  const exportReplica = async (shotId: string | null, fitOnly = false) => {
    flushSave();
    setExporting(shotId ? 'one' : 'all');
    hud(shotId ? `正在导出 ${shotId} 的复刻包…` : fitOnly ? '正在导出适合做模板的复刻包…' : '正在导出复刻包…');
    try {
      let failed = '';
      await streamPost(`/api/projects/${projectId}/replica`, shotId ? { shotId } : fitOnly ? { fit: true } : {}, {
        progress: (d: { done: number; total: number; shotId: string }) => { if (d.total > 1) hud(`导出中 ${d.done + 1} / ${d.total}：${d.shotId}`); },
        done: (d: { dirs: string[] }) => hud(`导出了 ${d.dirs.length} 个复刻包，已经在访达里打开`, 'success'),
        failed: (d: { message: string }) => { failed = d.message; },
      });
      if (failed) throw new Error(failed);
    } catch (err) {
      hud(`导出失败：${err instanceof Error ? err.message : err}`, 'error');
    } finally {
      setExporting(null);
    }
  };

  const download = (format: 'md' | 'json') => {
    const a = document.createElement('a');
    a.href = `/api/projects/${projectId}/export/${format}`;
    a.download = '';
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const autoAnnotate = async () => {
    const ok = await confirm.ask({
      title: 'AI 初判',
      message: 'AI 会看每个还没看完的镜头：先分成 A-roll / B-roll / 叠加层 / 字卡，标出适不适合做模板，再标上景别、运镜这些。会调用看图 AI，按用量收费。你手动改过的不会被覆盖。',
      confirm: '开始',
    });
    if (!ok) return;
    setAiProgress('准备中');
    try {
      let failed = '';
      await streamPost(`/api/projects/${projectId}/autoannotate`, { onlyUnreviewed: true }, {
        progress: (d: { done: number; total: number }) => setAiProgress(`${d.done} / ${d.total}`),
        done: () => undefined,
        failed: (d: { message: string }) => { failed = d.message; },
      });
      if (failed) throw new Error(failed);
      const p = await load(active?.id);
      const brolls = p.shots.filter((s) => s.roll === 'b-roll').length;
      const fits = p.shots.filter((s) => s.templateFit?.fit).length;
      hud(`AI 初判完成：B-roll ${brolls} 个，适合做模板 ${fits} 个。逐个看一眼对不对`, 'success');
    } catch (err) {
      hud(`AI 初判失败：${err instanceof Error ? err.message : err}`, 'error');
    } finally {
      setAiProgress(null);
    }
  };

  // ── 素材库（B-roll → Eagle）──────────────────────────────────────────

  /** AI 打素材标签。shotId 为 null 时打所有还没打过的 B-roll */
  const autoTag = async (shotId: string | null) => {
    await flushSave();
    setTagging(shotId ?? 'all');
    try {
      let failed = '';
      let result: { tagged: number; errors: string[] } | null = null;
      await streamPost(`/api/projects/${projectId}/library/autotag`, shotId ? { shotId } : {}, {
        progress: (d: { done: number; total: number; shotId: string }) => { if (d.total > 1) hud(`AI 打标 ${d.done + 1} / ${d.total}：${d.shotId}`); },
        done: (d: { tagged: number; errors: string[] }) => { result = d; },
        failed: (d: { message: string }) => { failed = d.message; },
      });
      if (failed) throw new Error(failed);
      await load(active?.id);
      const r = result as { tagged: number; errors: string[] } | null;
      if (r && r.errors.length > 0) hud(`打好了 ${r.tagged} 个，${r.errors.length} 个没打成：${r.errors[0]}`, 'error');
      else hud(shotId ? 'AI 打好标签了，看一眼对不对' : `AI 打好了 ${r?.tagged ?? 0} 个 B-roll，逐个看一眼`, 'success');
    } catch (err) {
      hud(`AI 打标失败：${err instanceof Error ? err.message : err}`, 'error');
    } finally {
      setTagging(null);
    }
  };

  /** 放进 Eagle。shotId 为 null 时放所有打过标的 B-roll */
  const sendEagle = async (shotId: string | null) => {
    await flushSave();
    setSending(shotId ?? 'all');
    try {
      let failed: { message: string; code?: string } | null = null;
      let result: { added: number; updated: number; skipped: number } | null = null;
      await streamPost(`/api/projects/${projectId}/eagle`, shotId ? { shotId } : {}, {
        progress: (d: { done: number; total: number; shotId: string }) => { if (d.total > 1) hud(`放进 Eagle ${d.done + 1} / ${d.total}：${d.shotId}`); },
        done: (d: { added: number; updated: number; skipped: number }) => { result = d; },
        failed: (d: { message: string; code?: string }) => { failed = d; },
      });
      const f = failed as { message: string; code?: string } | null;
      if (f) throw Object.assign(new Error(f.message), { code: f.code });
      await load(active?.id);
      const r = result as { added: number; updated: number; skipped: number } | null;
      const parts = [r?.added ? `新放进 ${r.added} 个` : '', r?.updated ? `更新了 ${r.updated} 个` : ''].filter(Boolean).join('，');
      hud(`${parts || '完成'}，在 Eagle 的「ShotPilot 素材库」里${r?.skipped ? `（${r.skipped} 个 B-roll 还没打标，没放）` : ''}`, 'success');
    } catch (err) {
      const code = (err as { code?: string }).code;
      hud(err instanceof Error ? err.message : String(err), 'error');
      if (code === 'token') openSettings('eagle');
    } finally {
      setSending(null);
    }
  };

  const toggleReview = () => {
    if (!active) return;
    const reviewed = !active.reviewed;
    updateLocal(active.id, (s) => ({ ...s, reviewed }));
    void patchShot(active.id, { reviewed });
    if (reviewed && activeIndex < shots.length - 1) selectShot(activeIndex + 1);
  };

  // ── 键盘 ────────────────────────────────────────────────────────────────

  const keys = useRef<(e: KeyboardEvent) => void>(() => undefined);
  keys.current = (e: KeyboardEvent) => {
    if (!project || inKeyTrap(e.target)) return;
    if (isTyping(e.target)) {
      if (e.key === 'Escape') (e.target as HTMLElement).blur();
      return;
    }
    // 正在用输入法组字时一律放行，否则会把半成品拼音当成快捷键
    if (e.isComposing) return;
    // 菜单按钮、分段控件有焦点时空格和回车留给它们自己
    const onControl = (e.target as HTMLElement | null)?.tagName === 'BUTTON';
    if ((e.key === ' ' || e.code === 'Space') && !onControl) { e.preventDefault(); togglePlay(); return; }
    if (e.key === 'ArrowRight') { e.preventDefault(); selectShot(activeIndex + 1); return; }
    if (e.key === 'ArrowLeft') { e.preventDefault(); selectShot(activeIndex - 1); return; }
    if (e.key === 'Enter' && !onControl) {
      e.preventDefault();
      if (active && !active.reviewed) {
        updateLocal(active.id, (s) => ({ ...s, reviewed: true }));
        void patchShot(active.id, { reviewed: true });
      }
      selectShot(activeIndex + 1);
      return;
    }
    // ⌘ / Ctrl 组合是系统自己的（复制、刷新等），不抢
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const key = physicalKey(e);
    if (!key) return;
    // 切分、合并优先于标注：S 不能被构图的「三分法」抢走
    if (key === 's') { e.preventDefault(); void splitAtPlayhead(); return; }
    if (key === 'm') { e.preventDefault(); void mergeIntoPrevious(); return; }
    for (const dim of DIMENSIONS) {
      const term = (dim.terms as readonly { value: string; key?: string }[]).find((t) => t.key === key);
      if (!term || !active) continue;
      e.preventDefault();
      if (dim.field === 'roll') {
        setRoll(active.roll === term.value ? 'unset' : (term.value as Shot['roll']));
      } else if (dim.multi) {
        const list = new Set<string>((active.annotation[dim.field as 'composition'] as string[] | undefined) ?? []);
        if (list.has(term.value)) list.delete(term.value); else list.add(term.value);
        setAnnotation(dim.field as AnnotationField, list.size ? [...list] : null);
      } else {
        const cur = active.annotation[dim.field as AnnotationField];
        setAnnotation(dim.field as AnnotationField, cur === term.value ? null : term.value);
      }
      return;
    }
  };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => keys.current(e);
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  // ── 画面 ────────────────────────────────────────────────────────────────

  if (loadError) {
    return (
      <>
        <Toolbar><h1 className="toolbar-title">拉片</h1></Toolbar>
        <Workspace>
          <div className="scroll"><div className="empty"><div className="empty-title">打不开这个项目</div><div className="empty-text">{loadError}</div><Button onClick={() => nav({ view: 'clip' })}>回到项目列表</Button></div></div>
        </Workspace>
      </>
    );
  }
  if (!project) {
    return (
      <>
        <Toolbar><h1 className="toolbar-title">拉片</h1></Toolbar>
        <Workspace><div className="loading"><Spinner /></div></Workspace>
      </>
    );
  }

  const unsorted = shots.filter((s) => s.roll === 'unset').length;
  const fitCount = shots.filter((s) => s.templateFit?.fit).length;
  const projectMenu: MenuItem[] = [
    { kind: 'header', label: '最近的项目' },
    ...others.slice(0, 12).map((p) => ({
      label: p.title,
      checked: p.id === projectId,
      onSelect: () => { flushSave(); nav({ view: 'clip', projectId: p.id }); },
    })),
    { kind: 'separator' },
    { label: '所有项目…', onSelect: () => { flushSave(); nav({ view: 'clip' }); } },
    { label: '新建拉片…', onSelect: () => setSheet({ kind: 'new' }) },
  ];
  const moreMenu: MenuItem[] = [
    { label: '重新切分…', icon: <Icon.refresh size={14} />, onSelect: () => setSheet({ kind: 'resplit' }) },
    {
      label: visionConfigured ? 'AI 初判（分 B-roll、找适合做模板的）…' : 'AI 初判（先在「设置」里填看图 AI）',
      icon: <Icon.sparkles size={14} />,
      disabled: aiProgress !== null,
      onSelect: () => (visionConfigured ? void autoAnnotate() : openSettings('vision')),
    },
    {
      label: fitCount > 0 ? `只导出适合做模板的复刻包（${fitCount} 个）` : '只导出适合做模板的复刻包（还没有）',
      icon: <Icon.templates size={14} />,
      disabled: fitCount === 0 || exporting !== null,
      onSelect: () => void exportReplica(null, true),
    },
    { kind: 'separator' },
    {
      label: visionConfigured ? 'AI 给还没打标的 B-roll 打标…' : 'AI 给 B-roll 打标（先去设置里填 Key）',
      icon: <Icon.tag size={14} />,
      disabled: tagging !== null,
      onSelect: () => (visionConfigured ? void autoTag(null) : openSettings('vision')),
    },
    { label: '把打过标的 B-roll 都放进 Eagle', icon: <Icon.folder size={14} />, disabled: sending !== null, onSelect: () => void sendEagle(null) },
    { kind: 'separator' },
    { label: '导出拉片笔记（Markdown）', icon: <Icon.doc size={14} />, onSelect: () => download('md') },
    { label: '导出拉片数据（JSON）', icon: <Icon.doc size={14} />, onSelect: () => download('json') },
  ];

  return (
    <>
      <Toolbar>
        <MenuButton items={projectMenu} className="title-menu" label="切换项目">
          <span className="toolbar-title">{project.title}</span>
          <Icon.chevronDown size={12} />
        </MenuButton>
        <span className="toolbar-sub">
          {fmtTime(project.source.duration, 0)} · {shots.length} 个镜头 · {unsorted ? `还有 ${unsorted} 个没归类` : '都归好类了'}
          {aiProgress !== null && ` · AI 初判 ${aiProgress}`}
        </span>
        <div className="spacer" />
        <MenuButton items={moreMenu} align="end" className="icon-btn" label="更多">
          <Icon.ellipsis size={18} />
        </MenuButton>
        <Button variant="primary" size="large" disabled={exporting !== null} onClick={() => void exportReplica(null)} title="把标成 B-roll / 叠加层 / 字卡的镜头都导出成复刻包">
          <Icon.share size={15} />{exporting === 'all' ? '正在导出…' : '导出复刻包'}
        </Button>
      </Toolbar>

      <Workspace
        inspector={active ? (
          <ShotInspector
            shot={active}
            index={activeIndex}
            total={shots.length}
            onRoll={setRoll}
            onTemplateFit={setTemplateFit}
            onAnnotate={setAnnotation}
            onText={queueText}
            onReview={toggleReview}
            onExport={() => void exportReplica(active.id)}
            exporting={exporting !== null}
            tab={tab}
            onTab={setTab}
            library={{
              project,
              onChange: queueLibrary,
              onAutoTag: () => void autoTag(active.id),
              onSend: () => void sendEagle(active.id),
              tagging: tagging !== null,
              sending: sending !== null,
              visionConfigured,
              onSetupVision: () => openSettings('vision'),
            }}
          />
        ) : undefined}
        bottom={(
          <ShotTimeline
            project={project}
            activeIndex={activeIndex}
            clock={clock}
            playing={playing}
            onSelect={selectShot}
            onSeek={scrubTo}
            onSplit={() => void splitAtPlayhead()}
            onMerge={() => void mergeIntoPrevious()}
            onAutoSplit={() => active && setSheet({ kind: 'autosplit', shotId: active.id })}
          />
        )}
      >
        <Viewer
          project={project}
          videoRef={video}
          clock={clock}
          error={videoError}
          onError={() => {
            // 播不了有两种：源视频被挪走了（服务端回 410），或者格式浏览器不认。提示不一样
            fetch(`/api/projects/${projectId}/video`, { headers: { Range: 'bytes=0-1' } })
              .then((r) => setVideoError(r.status === 410 || r.status === 404 ? 'missing' : 'format'))
              .catch(() => setVideoError('missing'));
          }}
          onPlayState={setPlaying}
          onTogglePlay={togglePlay}
        />
        <Transport
          clock={clock}
          duration={project.source.duration}
          playing={playing}
          rate={rate}
          onRate={setRate}
          onPrev={() => selectShot(activeIndex - 1)}
          onNext={() => selectShot(activeIndex + 1)}
          onToggle={togglePlay}
        />
      </Workspace>

      {sheet?.kind === 'new' && (
        <NewProjectSheet onCancel={() => setSheet(null)} onDone={(id) => { setSheet(null); nav({ view: 'clip', projectId: id }); }} />
      )}
      {sheet?.kind === 'resplit' && (
        <ResplitSheet
          onCancel={() => setSheet(null)}
          onRun={async (threshold, minShotDuration) => {
            flushSave();
            const r = await api.resplit(projectId, { threshold, minShotDuration });
            await load();
            setSheet(null);
            hud(`重新切出 ${r.shotCount} 个镜头`, 'success');
          }}
        />
      )}
      {sheet?.kind === 'autosplit' && (
        <AutoSplitSheet
          shot={shots.find((s) => s.id === sheet.shotId)}
          onCancel={() => setSheet(null)}
          onRun={async (threshold) => {
            flushSave();
            const r = await api.autoSplitShot(projectId, sheet.shotId, threshold);
            setProject((p) => (p ? { ...p, shots: r.shots } : p));
            setSheet(null);
            hud(r.added > 0 ? `切出 ${r.added} 个新镜头，现在共 ${r.shots.length} 个` : `灵敏度 ${threshold} 下没找到切点，再调小一点试试`, r.added > 0 ? 'success' : 'info');
          }}
        />
      )}
      {confirm.element}
    </>
  );
}

function Viewer({ project, videoRef, clock, error, onError, onPlayState, onTogglePlay }: {
  project: ReelProject;
  videoRef: React.RefObject<HTMLVideoElement>;
  clock: Clock;
  error: null | 'missing' | 'format';
  onError: () => void;
  onPlayState: (playing: boolean) => void;
  onTogglePlay: () => void;
}) {
  const aspect = project.source.width > 0 && project.source.height > 0 ? project.source.width / project.source.height : 16 / 9;
  const fit = useFitSize(aspect);
  const t = useClock(clock);
  const current = project.shots.find((s) => t >= s.start && t < s.end) ?? project.shots[project.shots.length - 1];
  return (
    <div className="viewer" ref={fit.ref}>
      <div className="frame" style={{ width: fit.width, height: fit.height }}>
        {error ? (
          <div className="frame-error">
            <Icon.warning size={28} />
            {error === 'missing' ? (
              <>
                <div>源视频找不到了，可能被移动或删掉了</div>
                <div className="mono small">{project.source.path}</div>
              </>
            ) : (
              <>
                <div>这个视频的格式在这里播放不了</div>
                <div className="small">用 QuickTime 或剪映另存为 MP4 再新建拉片就行，镜头切分和标注不受影响</div>
              </>
            )}
          </div>
        ) : (
          <video
            ref={videoRef}
            src={`/api/projects/${project.id}/video`}
            preload="auto"
            playsInline
            onClick={onTogglePlay}
            onPlay={() => onPlayState(true)}
            onPause={() => onPlayState(false)}
            onEnded={() => onPlayState(false)}
            onSeeked={(e) => clock.set(e.currentTarget.currentTime)}
            onTimeUpdate={(e) => { if (e.currentTarget.paused) clock.set(e.currentTarget.currentTime); }}
            onError={onError}
          />
        )}
        {current && !error && (
          <div className="frame-tag">
            <span className="dot" style={{ background: ROLL_COLORS[current.roll] }} />
            {current.id} · {ROLL_NAMES[current.roll]}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * 焦点在备注这类文本框里时，快捷键会让路（不然打字会触发标注）。
 * 但不说一声的话就是静默失效：按 Z 按 6 都没反应，界面上又没有任何解释。这里让它看得见。
 */
function useTyping() {
  const [typing, setTyping] = useState(false);
  useEffect(() => {
    const on = (e: FocusEvent) => setTyping(isTyping(e.target));
    // 延后一拍：焦点在两个输入框之间跳时不要闪
    const off = () => window.setTimeout(() => setTyping(isTyping(document.activeElement)), 0);
    document.addEventListener('focusin', on);
    document.addEventListener('focusout', off);
    return () => {
      document.removeEventListener('focusin', on);
      document.removeEventListener('focusout', off);
    };
  }, []);
  return typing;
}

function Transport({ clock, duration, playing, rate, onRate, onPrev, onNext, onToggle }: {
  clock: Clock;
  duration: number;
  playing: boolean;
  rate: number;
  onRate: (r: number) => void;
  onPrev: () => void;
  onNext: () => void;
  onToggle: () => void;
}) {
  const t = useClock(clock);
  const typing = useTyping();
  return (
    <div className="transport">
      <div className="timecode">{fmtTime(t)} <span>/ {fmtTime(duration)}</span></div>
      <div className="transport-buttons">
        <IconButton label="上一个镜头（←）" onClick={onPrev}><Icon.prev size={18} /></IconButton>
        <IconButton label={playing ? '暂停（空格）' : '播放（空格）'} className="play" onClick={onToggle}>
          {playing ? <Icon.pause size={20} /> : <Icon.play size={20} />}
        </IconButton>
        <IconButton label="下一个镜头（→）" onClick={onNext}><Icon.next size={18} /></IconButton>
      </div>
      <div className="transport-right">
        {typing
          ? <span className="transport-hint typing">正在输入文字，快捷键先停一下 · 按 Esc 退出输入</span>
          : <span className="transport-hint">空格 播放 · ← → 换镜头 · 回车 看完下一个</span>}
        <MenuButton
          className="rate-btn"
          label="播放速度"
          align="end"
          items={[0.25, 0.5, 1, 1.5, 2].map((r) => ({ label: `${r}×`, checked: r === rate, onSelect: () => onRate(r) }))}
        >
          {rate}×
        </MenuButton>
      </div>
    </div>
  );
}

function ResplitSheet({ onCancel, onRun }: { onCancel: () => void; onRun: (threshold: number, minDur: number) => Promise<void> }) {
  const [threshold, setThreshold] = useState(0.3);
  const [minDur, setMinDur] = useState(0.4);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const run = async () => {
    setBusy(true);
    setError('');
    try { await onRun(threshold, minDur); } catch (err) { setError(err instanceof Error ? err.message : String(err)); setBusy(false); }
  };
  return (
    <Sheet
      title="重新切分整条视频"
      busy={busy}
      onCancel={onCancel}
      actions={(
        <>
          <Button onClick={onCancel} disabled={busy}>取消</Button>
          <Button variant="primary" onClick={() => void run()} disabled={busy}>{busy ? '正在切分…' : '重新切分'}</Button>
        </>
      )}
    >
      <p className="sheet-text">已经标好的内容会按时间搬到新的镜头上，不会丢。</p>
      <div className="half-grid">
        <FormRow label="切分灵敏度" hint="越小切得越碎">
          <NumberInput label="切分灵敏度" value={threshold} min={0.05} max={0.95} step={0.05} onChange={setThreshold} />
        </FormRow>
        <FormRow label="最短镜头">
          <NumberInput label="最短镜头" value={minDur} min={0.1} max={5} step={0.1} unit="秒" onChange={setMinDur} />
        </FormRow>
      </div>
      {error && <div className="form-error" role="alert">{error}</div>}
    </Sheet>
  );
}

function AutoSplitSheet({ shot, onCancel, onRun }: { shot?: Shot; onCancel: () => void; onRun: (threshold: number) => Promise<void> }) {
  const [threshold, setThreshold] = useState(0.08);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const run = async () => {
    setBusy(true);
    setError('');
    try { await onRun(threshold); } catch (err) { setError(err instanceof Error ? err.message : String(err)); setBusy(false); }
  };
  return (
    <Sheet
      title={`细切镜头 ${shot?.id ?? ''}`}
      busy={busy}
      onCancel={onCancel}
      actions={(
        <>
          <Button onClick={onCancel} disabled={busy}>取消</Button>
          <Button variant="primary" onClick={() => void run()} disabled={busy}>{busy ? '正在检测…' : '开始细切'}</Button>
        </>
      )}
    >
      <p className="sheet-text">
        只对这一个镜头（{shot ? `${fmtTime(shot.start)} – ${fmtTime(shot.end)}` : ''}）用更高的灵敏度重新找切点。
        录屏、图文演示建议 0.05–0.08，真人画面建议 0.15–0.25。
      </p>
      <FormRow label="灵敏度">
        <NumberInput label="灵敏度" value={threshold} min={0.01} max={0.95} step={0.01} onChange={setThreshold} />
      </FormRow>
      {error && <div className="form-error" role="alert">{error}</div>}
    </Sheet>
  );
}
