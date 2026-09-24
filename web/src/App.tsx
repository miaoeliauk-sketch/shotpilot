import React, { useCallback, useEffect, useRef, useState } from 'react';
import { api } from './api';
import { Icon } from './ui/icons';
import { HudHost, hud } from './ui/overlay';
import { ClipView } from './clip/ClipView';
import { TemplatesView } from './templates/TemplatesView';
import { WorksView } from './works/WorksView';
import { SettingsSheet } from './settings/SettingsSheet';

/**
 * 整个窗口：左边一条工具栏（拉片 / 模板 / 作品），右边是当前页面。
 * 页面状态写在地址栏里（?view=clip&project=…），刷新或重开窗口还在原来的地方。
 */

export type Route =
  | { view: 'clip'; projectId?: string; shotId?: string }
  | { view: 'templates' }
  | { view: 'works'; workId?: string };

export type Nav = (route: Route) => void;

function parseRoute(search: string): Route {
  const q = new URLSearchParams(search);
  // 旧版地址：?id=项目 / ?studio=1&work=作品，书签还能用
  if (q.get('id')) return { view: 'clip', projectId: q.get('id') ?? undefined };
  if (q.get('studio')) return q.get('work') ? { view: 'works', workId: q.get('work') ?? undefined } : { view: 'templates' };
  const view = q.get('view');
  if (view === 'templates') return { view: 'templates' };
  if (view === 'works') return { view: 'works', workId: q.get('work') ?? undefined };
  return { view: 'clip', projectId: q.get('project') ?? undefined, shotId: q.get('shot') ?? undefined };
}

function routeToSearch(r: Route): string {
  const q = new URLSearchParams({ view: r.view });
  if (r.view === 'clip' && r.projectId) q.set('project', r.projectId);
  if (r.view === 'works' && r.workId) q.set('work', r.workId);
  return `?${q.toString()}`;
}

const RAIL: { view: Route['view']; label: string; icon: React.ReactNode }[] = [
  { view: 'clip', label: '拉片', icon: <Icon.film size={22} /> },
  { view: 'templates', label: '模板', icon: <Icon.templates size={22} /> },
  { view: 'works', label: '作品', icon: <Icon.works size={22} /> },
];

export function App() {
  const [route, setRoute] = useState<Route>(() => parseRoute(location.search));
  const [visionConfigured, setVisionConfigured] = useState(false);
  const [settings, setSettings] = useState<null | { focus?: 'vision' | 'eagle' }>(null);
  // 每个页面上次停在哪：从模板切回拉片，还是刚才打开的那个项目
  const last = useRef<Partial<Record<Route['view'], Route>>>({});

  const nav: Nav = useCallback((r) => {
    setRoute(r);
    history.replaceState(null, '', routeToSearch(r));
  }, []);

  useEffect(() => { last.current[route.view] = route; }, [route]);
  useEffect(() => { history.replaceState(null, '', routeToSearch(route)); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    api.health().then((h) => { if (!h.ok) hud(h.message, 'error'); }).catch(() => hud('连不上工作台服务，请重新打开软件', 'error'));
    api.vocabulary().then((v) => setVisionConfigured(v.visionConfigured)).catch(() => undefined);
    const open = (e: Event) => setSettings({ focus: (e as CustomEvent).detail });
    window.addEventListener('shotpilot:open-settings', open);
    return () => window.removeEventListener('shotpilot:open-settings', open);
  }, []);

  const go = (view: Route['view']) => {
    if (view === route.view) {
      // 已经在这个页面上再点一下：回到这个页面的首页（项目列表 / 作品列表）
      nav({ view } as Route);
      return;
    }
    nav(last.current[view] ?? ({ view } as Route));
  };

  return (
    <div className="app">
      <nav className="rail" aria-label="主导航">
        <div className="rail-top">
          <div className="app-mark" aria-hidden="true"><Icon.film size={18} /></div>
        </div>
        {RAIL.map((item) => (
          <button
            key={item.view}
            type="button"
            className="rail-item"
            aria-current={route.view === item.view ? 'page' : undefined}
            onClick={() => go(item.view)}
          >
            {item.icon}
            <span>{item.label}</span>
          </button>
        ))}
        <div className="rail-spacer" />
        <button
          type="button"
          className="rail-item"
          title="在访达里打开 ShotPilot 文件夹（拉片项目、复刻包、导出的视频都在里面）"
          onClick={() => api.revealRoot().then(() => hud('已在访达里打开 ShotPilot 文件夹')).catch((e: Error) => hud(e.message, 'error'))}
        >
          <Icon.folder size={22} />
          <span>文件夹</span>
        </button>
        <button type="button" className="rail-item" onClick={() => setSettings({})}>
          <Icon.gear size={22} />
          <span>设置</span>
        </button>
      </nav>
      <main className="main">
        {route.view === 'clip' && <ClipView key={route.projectId ?? 'library'} route={route} nav={nav} visionConfigured={visionConfigured} />}
        {route.view === 'templates' && <TemplatesView nav={nav} />}
        {route.view === 'works' && <WorksView key={route.workId ?? 'library'} route={route} nav={nav} />}
      </main>
      <HudHost />
      {settings && (
        <SettingsSheet
          focus={settings.focus}
          onClose={(changed) => {
            setSettings(null);
            if (changed) api.vocabulary().then((v) => setVisionConfigured(v.visionConfigured)).catch(() => undefined);
          }}
        />
      )}
    </div>
  );
}
