import React, { useEffect, useState } from 'react';
import { api, fmtTime, fmtWhen, thumbUrl, type ProjectSummary } from '../api';
import type { Nav, Route } from '../App';
import { Button, Spinner } from '../ui/controls';
import { Icon } from '../ui/icons';
import { EmptyState, Toolbar, Workspace } from '../ui/layout';
import { hud } from '../ui/overlay';
import { NewProjectSheet, VIDEO_TYPES } from './NewProjectSheet';
import { Workbench } from './Workbench';

/** 「拉片」页：没打开项目时是项目列表，打开了就是工作台 */
export function ClipView({ route, nav, visionConfigured }: { route: Extract<Route, { view: 'clip' }>; nav: Nav; visionConfigured: boolean }) {
  if (route.projectId) {
    return <Workbench projectId={route.projectId} initialShot={route.shotId} nav={nav} visionConfigured={visionConfigured} />;
  }
  return <Library nav={nav} />;
}

function Library({ nav }: { nav: Nav }) {
  const [projects, setProjects] = useState<ProjectSummary[] | null>(null);
  const [sheet, setSheet] = useState<{ file?: File } | null>(null);
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    api.listProjects().then(setProjects).catch((e: Error) => { hud(e.message, 'error'); setProjects([]); });
  }, []);

  const open = (id: string) => nav({ view: 'clip', projectId: id });

  return (
    <>
      <Toolbar>
        <div className="toolbar-titles">
          <h1 className="toolbar-title">拉片</h1>
          <span className="toolbar-sub">把别人的视频拆成一个个镜头，看清楚每个镜头怎么拍的</span>
        </div>
        <div className="spacer" />
        <Button variant="primary" size="large" onClick={() => setSheet({})}>
          <Icon.plus size={14} />新建拉片
        </Button>
      </Toolbar>
      <Workspace>
        <div
          className={`scroll library${dragging ? ' dragging' : ''}`}
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            const f = e.dataTransfer.files[0];
            if (f && VIDEO_TYPES.test(f.name)) setSheet({ file: f });
            else if (f) hud('只能拖入视频文件（mp4、mov、m4v、webm、mkv）', 'error');
          }}
        >
          {projects === null ? (
            <div className="loading"><Spinner /></div>
          ) : projects.length === 0 ? (
            <EmptyState
              icon={<Icon.film size={44} />}
              title="还没有拉片项目"
              action={<Button variant="primary" size="large" onClick={() => setSheet({})}><Icon.plus size={14} />新建拉片</Button>}
            >
              粘贴抖音、B 站链接，或者直接把视频文件拖进这个窗口
            </EmptyState>
          ) : (
            <>
              <h2 className="section-title">最近的项目</h2>
              <div className="card-grid">
                {projects.map((p) => (
                  <button key={p.id} type="button" className="card" onClick={() => open(p.id)}>
                    <div className="card-media">
                      {p.cover ? <img src={thumbUrl(p.id, p.cover)} alt="" /> : <div className="card-placeholder"><Icon.film size={28} /></div>}
                      <span className="badge">{fmtTime(p.duration, 0)}</span>
                    </div>
                    <div className="card-text">
                      <span className="card-title">{p.title}</span>
                      <span className="card-sub">
                        {p.shotCount} 个镜头 · 看完 {p.reviewedCount} 个 · {fmtWhen(p.updatedAt)}
                      </span>
                      {!p.sourceExists && <span className="card-warn"><Icon.warning size={12} /> 源视频找不到了，播放不了</span>}
                    </div>
                  </button>
                ))}
              </div>
              <p className="drop-hint">也可以直接把视频文件拖进这个窗口</p>
            </>
          )}
        </div>
      </Workspace>
      {sheet && <NewProjectSheet initialFile={sheet.file} onCancel={() => setSheet(null)} onDone={(id) => { setSheet(null); open(id); }} />}
    </>
  );
}
