import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { getTemplate } from '../../../templates/src/registry';
import { studioApi, type Work } from './api';
import { Editor } from './Editor';
import { Gallery } from './Gallery';

/**
 * 模板工作室：用复刻出来的模板做自己的视频。
 *
 * 拉片界面是原生 JS 写的；这里要用 Remotion 的播放器做实时预览，所以单独用 React，
 * 打包成 web/js/studio.js，由拉片界面在切到「用模板做视频」时动态加载。
 */

function setUrl(workId: string | null) {
  const q = workId ? `?studio=1&work=${workId}` : '?studio=1';
  history.replaceState(null, '', q);
}

function Studio({ initialWork, onExit }: { initialWork: string | null; onExit: () => void }) {
  const [workId, setWorkId] = useState<string | null>(initialWork);
  const [work, setWork] = useState<Work | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    setUrl(workId);
    setWork(null);
    setError('');
    if (!workId) return;
    studioApi.getWork(workId).then(setWork).catch((e: Error) => { setError(e.message); setWorkId(null); });
  }, [workId]);

  if (!workId) {
    return (
      <>
        {error && <div className="st-error st-banner">{error}</div>}
        <Gallery onOpen={setWorkId} onExit={onExit} />
      </>
    );
  }
  if (!work) return <div className="st-loading">加载中…</div>;
  const template = getTemplate(work.templateId);
  if (!template) {
    return (
      <div className="st-loading">
        这个作品用的模板「{work.templateId}」已经不在了。<button onClick={() => setWorkId(null)}>返回</button>
      </div>
    );
  }
  return <Editor key={work.id} work={work} template={template} onBack={() => setWorkId(null)} />;
}

/** 挂到页面上，返回卸载函数 */
export function mountStudio(el: HTMLElement, opts: { workId: string | null; onExit: () => void }): () => void {
  const root = createRoot(el);
  root.render(<Studio initialWork={opts.workId} onExit={opts.onExit} />);
  return () => root.unmount();
}
