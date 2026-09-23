import React, { useEffect, useRef, useState } from 'react';
import { Player, type PlayerRef } from '@remotion/player';
import { TEMPLATES, getTemplate, type TemplateDef } from '../../../templates/src/registry';
import { studioApi, type Work } from './api';

/** 模板列表 + 我的作品 */
export function Gallery({ onOpen, onExit }: { onOpen: (workId: string) => void; onExit: () => void }) {
  const [works, setWorks] = useState<Work[] | null>(null);
  const [error, setError] = useState('');

  const load = () => studioApi.listWorks().then(setWorks).catch((e: Error) => setError(e.message));
  useEffect(() => { void load(); }, []);

  const create = async (t: TemplateDef) => {
    try {
      const w = await studioApi.createWork(t.id, t.name, { ...t.defaultParams });
      onOpen(w.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : '新建失败');
    }
  };

  const remove = async (w: Work) => {
    if (!window.confirm(`删除「${w.name}」？已经导出的视频不会被删。`)) return;
    await studioApi.deleteWork(w.id);
    void load();
  };

  return (
    <div className="st-gallery">
      <div className="st-top">
        <button onClick={onExit}>← 回到拉片</button>
        <h2>用模板做视频</h2>
        <span className="grow" />
        <button onClick={() => void studioApi.reveal()}>打开导出的视频文件夹</button>
      </div>
      {error && <div className="st-error">{error}</div>}

      <h3>选一个模板开始</h3>
      <p className="st-hint">这些都是从别人的视频里一帧一帧复刻出来的效果。选一个，换成你的图和文字，就能导出</p>
      <div className="st-cards">
        {TEMPLATES.map((t) => <TemplateCard key={t.id} template={t} onUse={() => void create(t)} />)}
      </div>

      <h3>我的作品</h3>
      {works === null ? <p className="st-hint">加载中…</p> : works.length === 0 ? (
        <p className="st-hint">还没有作品。在上面选一个模板开始</p>
      ) : (
        <div className="st-works">
          {works.map((w) => (
            <div className="st-work" key={w.id} onClick={() => onOpen(w.id)}>
              <div className="grow">
                <div>{w.name}</div>
                <div className="st-hint">
                  {getTemplate(w.templateId)?.name ?? '模板已不存在'} · 改于 {new Date(w.updatedAt).toLocaleString('zh-CN')}
                  {w.lastRender ? ' · 导出过' : ''}
                </div>
              </div>
              {w.lastRender && (
                <button onClick={(e) => { e.stopPropagation(); void studioApi.reveal(w.lastRender); }}>找到视频</button>
              )}
              <button className="danger" onClick={(e) => { e.stopPropagation(); void remove(w); }}>删除</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/** 模板卡片：停在最有代表性的一帧，鼠标移上去开始播放 */
function TemplateCard({ template: t, onUse }: { template: TemplateDef; onUse: () => void }) {
  const player = useRef<PlayerRef>(null);
  const props = t.toProps(t.defaultParams);
  return (
    <div
      className="st-card"
      onMouseEnter={() => player.current?.play()}
      onMouseLeave={() => { player.current?.pause(); player.current?.seekTo(t.posterFrame); }}
    >
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
        style={{ width: '100%', aspectRatio: `${t.width} / ${t.height}`, background: '#000' }}
      />
      <div className="st-card-body">
        <b>{t.name}</b>
        <div className="st-hint">{t.description}</div>
        <div className="st-origin">{t.origin}</div>
        <button className="primary" onClick={onUse}>用这个模板</button>
      </div>
    </div>
  );
}
