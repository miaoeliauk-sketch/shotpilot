import React, { useEffect, useState } from 'react';
import { getTemplate } from '../../../templates/src/registry';
import { api, type Work } from '../api';
import type { Nav, Route } from '../App';
import { Button, Spinner } from '../ui/controls';
import { Icon } from '../ui/icons';
import { EmptyState, Toolbar, Workspace } from '../ui/layout';
import { hud } from '../ui/overlay';
import { Editor } from './Editor';
import { WorkCard } from './WorkCard';
import { useWorks } from './useWorks';

/** 「作品」页：没打开作品时是作品列表，打开了就是编辑器 */
export function WorksView({ route, nav }: { route: Extract<Route, { view: 'works' }>; nav: Nav }) {
  if (route.workId) return <EditorLoader workId={route.workId} nav={nav} />;
  return <WorksLibrary nav={nav} />;
}

function EditorLoader({ workId, nav }: { workId: string; nav: Nav }) {
  const [work, setWork] = useState<Work | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    api.getWork(workId).then(setWork).catch((e: Error) => setError(e.message));
  }, [workId]);

  const template = work ? getTemplate(work.templateId) : undefined;
  if (error || (work && !template)) {
    return (
      <>
        <Toolbar><h1 className="toolbar-title">作品</h1></Toolbar>
        <Workspace>
          <EmptyState icon={<Icon.warning size={40} />} title="打不开这个作品" action={<Button onClick={() => nav({ view: 'works' })}>回到作品列表</Button>}>
            {error || `它用的模板「${work?.templateId}」已经不在了`}
          </EmptyState>
        </Workspace>
      </>
    );
  }
  if (!work || !template) {
    return (
      <>
        <Toolbar><h1 className="toolbar-title">作品</h1></Toolbar>
        <Workspace><div className="loading"><Spinner /></div></Workspace>
      </>
    );
  }
  return <Editor key={work.id} work={work} template={template} nav={nav} />;
}

function WorksLibrary({ nav }: { nav: Nav }) {
  const { works, remove, confirmElement } = useWorks();
  return (
    <>
      <Toolbar>
        <div className="toolbar-titles">
          <h1 className="toolbar-title">作品</h1>
          <span className="toolbar-sub">用模板做的视频，改到一半的也在这里</span>
        </div>
        <div className="spacer" />
        <Button onClick={() => void api.reveal().catch((e: Error) => hud(e.message, 'error'))}><Icon.folder size={14} />导出的视频</Button>
        <Button variant="primary" size="large" onClick={() => nav({ view: 'templates' })}><Icon.plus size={14} />用模板做新视频</Button>
      </Toolbar>
      <Workspace>
        <div className="scroll">
          {works === null ? <div className="loading"><Spinner /></div> : works.length === 0 ? (
            <EmptyState
              icon={<Icon.works size={44} />}
              title="还没有作品"
              action={<Button variant="primary" size="large" onClick={() => nav({ view: 'templates' })}>去挑一个模板</Button>}
            >
              在「模板」里选一个，换上自己的图和字，就是你的第一条视频
            </EmptyState>
          ) : (
            <>
              <h2 className="section-title">全部作品 · {works.length}</h2>
              <div className="card-grid">
                {works.map((w) => <WorkCard key={w.id} work={w} onOpen={() => nav({ view: 'works', workId: w.id })} onDelete={() => void remove(w)} />)}
              </div>
            </>
          )}
        </div>
      </Workspace>
      {confirmElement}
    </>
  );
}
