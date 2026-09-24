import React, { useEffect, useRef, useState } from 'react';
import { Player, type PlayerRef } from '@remotion/player';
import { TEMPLATES, type TemplateDef } from '../../../templates/src/registry';
import { api, fmtTime, streamPost, thumbUrl, type ReplicaCandidate } from '../api';
import type { Nav } from '../App';
import { ROLL_COLORS } from '../clip/ShotInspector';
import { Button, Spinner } from '../ui/controls';
import { Icon } from '../ui/icons';
import { BottomPanel, Inspector, Toolbar, Workspace } from '../ui/layout';
import { Sheet, hud } from '../ui/overlay';
import { WorkCard } from '../works/WorkCard';
import { useWorks } from '../works/useWorks';

/**
 * 「模板」页：中间挑模板，右边看选中模板的介绍和实时预览，底下是最近的作品。
 */

const ROLL_NAMES: Record<string, string> = { 'b-roll': 'B-roll', overlay: '叠加层', title: '字卡' };

export function TemplatesView({ nav }: { nav: Nav }) {
  const [selectedId, setSelectedId] = useState(TEMPLATES[0]?.id ?? '');
  const [candidates, setCandidates] = useState<ReplicaCandidate[] | null>(null);
  const [creating, setCreating] = useState(false);
  const [exportingKey, setExportingKey] = useState<string | null>(null);
  const [howTo, setHowTo] = useState(false);
  const { works, remove, confirmElement } = useWorks();
  const selected = TEMPLATES.find((t) => t.id === selectedId) ?? TEMPLATES[0];

  // 适合做模板的排在前面：它们就是下一步要发给 Claude 的
  const loadCandidates = () => api.replicaCandidates()
    .then((rows) => setCandidates([...rows].sort((a, b) => Number(!!b.templateFit?.fit) - Number(!!a.templateFit?.fit))))
    .catch(() => setCandidates([]));
  useEffect(() => { void loadCandidates(); }, []);

  const create = async (t: TemplateDef) => {
    setCreating(true);
    try {
      const w = await api.createWork(t.id, t.name, { ...t.defaultParams });
      nav({ view: 'works', workId: w.id });
    } catch (err) {
      hud(`新建失败：${err instanceof Error ? err.message : err}`, 'error');
      setCreating(false);
    }
  };

  const exportCandidate = async (c: ReplicaCandidate) => {
    const key = `${c.projectId}/${c.shotId}`;
    setExportingKey(key);
    try {
      let failed = '';
      await streamPost(`/api/projects/${c.projectId}/replica`, { shotId: c.shotId }, {
        done: () => hud(`${c.shotId} 的复刻包导出好了，已经在访达里打开`, 'success'),
        failed: (d: { message: string }) => { failed = d.message; },
      });
      if (failed) throw new Error(failed);
      await loadCandidates();
    } catch (err) {
      hud(`导出失败：${err instanceof Error ? err.message : err}`, 'error');
    } finally {
      setExportingKey(null);
    }
  };

  return (
    <>
      <Toolbar>
        <div className="toolbar-titles">
          <h1 className="toolbar-title">模板</h1>
          <span className="toolbar-sub">从拉片里复刻出来的镜头，换上自己的图和字就能出视频</span>
        </div>
      </Toolbar>
      <Workspace
        inspector={selected ? <TemplateInspector template={selected} creating={creating} onUse={() => void create(selected)} /> : undefined}
        bottom={(
          <BottomPanel label="我的作品" storageKey="templates-works" defaultHeight={236}>
            <div className="tl-head">
              <span className="tl-title">我的作品</span>
              <span className="tl-hint">自动保存在「ShotPilot / 我的作品」</span>
              <div className="spacer" />
              <button type="button" className="tool-btn" onClick={() => void api.reveal().catch((e: Error) => hud(e.message, 'error'))}>
                <Icon.folder size={14} />导出的视频
              </button>
              <button type="button" className="tool-btn" onClick={() => nav({ view: 'works' })}>全部作品<Icon.chevronRight size={12} /></button>
            </div>
            <div className="strip">
              {works === null ? <Spinner /> : works.length === 0 ? (
                <div className="strip-empty">还没有作品。选一个模板，点「用这个模板做视频」</div>
              ) : works.map((w) => (
                <WorkCard key={w.id} work={w} compact onOpen={() => nav({ view: 'works', workId: w.id })} onDelete={() => void remove(w)} />
              ))}
            </div>
          </BottomPanel>
        )}
      >
        <div className="scroll">
          <h2 className="section-title">全部模板 · {TEMPLATES.length}</h2>
          <div className="card-grid">
            {TEMPLATES.map((t) => (
              <TemplateCard key={t.id} template={t} selected={t.id === selected?.id} onSelect={() => setSelectedId(t.id)} onUse={() => void create(t)} />
            ))}
            <button type="button" className="card placeholder-card" onClick={() => setHowTo(true)}>
              <div className="card-media dashed">
                <Icon.plus size={22} />
                <span>做一个新模板</span>
                <span className="small">点这里看怎么做</span>
              </div>
            </button>
          </div>

          <h2 className="section-title">标成要复刻的镜头</h2>
          <p className="section-hint section-hint-top">想把哪个做成模板：导出复刻包，把里面的 clip.mp4 发给 Claude</p>
          {candidates === null ? <Spinner /> : candidates.length === 0 ? (
            <p className="section-hint">在「拉片」里把镜头标成 B-roll、叠加层或字卡，就会列在这里</p>
          ) : (
            <div className="list">
              {candidates.map((c) => {
                const key = `${c.projectId}/${c.shotId}`;
                return (
                  <div className="list-row" key={key}>
                    {c.thumbnail ? <img className="row-thumb" src={thumbUrl(c.projectId, c.thumbnail)} alt="" /> : <span className="row-thumb" />}
                    <span className="dot" style={{ background: ROLL_COLORS[c.roll] }} />
                    <span className="row-title">{c.shotId} · {ROLL_NAMES[c.roll] ?? c.roll}</span>
                    {c.templateFit?.fit && <span className="fit-chip" title={c.templateFit.reason || undefined}><Icon.templates size={11} />适合做模板</span>}
                    <span className="row-sub">{c.projectTitle} · {(c.end - c.start).toFixed(1)} 秒 · {fmtTime(c.start)}</span>
                    {c.exportedDir ? (
                      <button type="button" className="tool-btn" onClick={() => void api.reveal(c.exportedDir ?? undefined).catch((e: Error) => hud(e.message, 'error'))}>
                        <Icon.checkCircle size={13} />复刻包已导出
                      </button>
                    ) : (
                      <Button disabled={exportingKey !== null} onClick={() => void exportCandidate(c)}>
                        {exportingKey === key ? '正在导出…' : '导出复刻包'}
                      </Button>
                    )}
                    <button type="button" className="link-btn" onClick={() => nav({ view: 'clip', projectId: c.projectId, shotId: c.shotId })}>看镜头</button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </Workspace>
      {confirmElement}
      {howTo && <HowToSheet onClose={() => setHowTo(false)} />}
    </>
  );
}

/**
 * 做新模板的步骤。软件自己做不出模板：复刻要一帧一帧对比着写代码，这一步由 Claude 来做，
 * 做好的模板随软件更新一起到。这里把步骤说清楚，别让人以为导出复刻包后模板会自己冒出来。
 */
function HowToSheet({ onClose }: { onClose: () => void }) {
  return (
    <Sheet
      title="做一个新模板"
      width={500}
      onCancel={onClose}
      actions={(
        <>
          <Button onClick={() => void api.revealReplicaFolder().catch((e: Error) => hud(e.message, 'error'))}><Icon.folder size={14} />打开复刻包文件夹</Button>
          <Button variant="primary" onClick={onClose}>知道了</Button>
        </>
      )}
    >
      <ol className="steps">
        <li><b>导出复刻包</b>：在「拉片」里选中想复刻的镜头，点「导出这个镜头的复刻包」。已经导出过的，下面列表里会显示「复刻包已导出」</li>
        <li><b>发给 Claude</b>：打开复刻包文件夹，找到这个镜头的文件夹（名字是「视频名-镜头号」），把里面的 <code>clip.mp4</code> 直接拖进和 Claude 的对话里，说「把这个做成模板」</li>
        <li><b>更新软件</b>：Claude 做好、对比过和原片一样之后，会告诉你下载新的安装包。装好后新模板就出现在这里</li>
      </ol>
      <p className="sheet-text small-text">为什么不能一键生成：复刻要一帧一帧和原片对比、反复调整，才能做到现在这两个模板这么像。</p>
    </Sheet>
  );
}

/** 模板卡片：停在最有代表性的一帧，鼠标移上去开始播放；双击直接用 */
function TemplateCard({ template: t, selected, onSelect, onUse }: { template: TemplateDef; selected: boolean; onSelect: () => void; onUse: () => void }) {
  const player = useRef<PlayerRef>(null);
  const props = t.toProps(t.defaultParams);
  const seconds = props.durationInFrames / t.fps;
  return (
    <button
      type="button"
      className={`card${selected ? ' selected' : ''}`}
      aria-pressed={selected}
      onClick={onSelect}
      onDoubleClick={onUse}
      onMouseEnter={() => player.current?.play()}
      onMouseLeave={() => { player.current?.pause(); player.current?.seekTo(t.posterFrame); }}
    >
      <div className="card-media">
        <Player
          ref={player}
          component={t.component}
          inputProps={props}
          durationInFrames={props.durationInFrames}
          compositionWidth={t.width}
          compositionHeight={t.height}
          fps={t.fps}
          initialFrame={t.posterFrame}
          loop
          acknowledgeRemotionLicense
          style={{ width: '100%', height: '100%', pointerEvents: 'none' }}
        />
        <span className="badge">{seconds.toFixed(1)}s</span>
      </div>
      <div className="card-text">
        <span className="card-title">{t.name}</span>
        <span className="card-sub">{t.description}</span>
      </div>
    </button>
  );
}

function TemplateInspector({ template: t, creating, onUse }: { template: TemplateDef; creating: boolean; onUse: () => void }) {
  const props = t.toProps(t.defaultParams);
  const seconds = props.durationInFrames / t.fps;
  return (
    <Inspector
      label="模板介绍"
      title={t.name}
      footer={(
        <Button variant="primary" size="large" block disabled={creating} onClick={onUse}>
          {creating ? '正在新建…' : '用这个模板做视频'}
        </Button>
      )}
    >
      <div className="preview-box">
        <Player
          key={t.id}
          component={t.component}
          inputProps={props}
          durationInFrames={props.durationInFrames}
          compositionWidth={t.width}
          compositionHeight={t.height}
          fps={t.fps}
          autoPlay
          loop
          acknowledgeRemotionLicense
          style={{ width: '100%', aspectRatio: `${t.width} / ${t.height}` }}
        />
      </div>
      <p className="body-text">{t.description}</p>
      <p className="origin-text"><Icon.checkCircle size={13} />{t.origin}</p>
      <div className="form-row">
        <div className="form-label"><span>能改的地方</span></div>
        <div className="tokens static">
          {t.form.map((s) => <span key={s.title} className="token">{s.title}</span>)}
        </div>
      </div>
      <dl className="facts">
        <div><dt>时长</dt><dd>{seconds.toFixed(1)} 秒（能改）</dd></div>
        <div><dt>画面</dt><dd>{t.width}×{t.height} {t.width >= t.height ? '横屏' : '竖屏'}</dd></div>
        <div><dt>帧率</dt><dd>{t.fps} 帧/秒</dd></div>
      </dl>
    </Inspector>
  );
}
