import React from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';

/**
 * 界面入口，打包成 web/js/app.js（scripts/build-ui.ts）。
 *
 * 在 Mac 软件里（Electron）窗口没有系统标题栏：红黄绿三个按钮画在左边工具栏顶上，
 * 左边工具栏透出系统的毛玻璃。浏览器里打开时没有这些，给 html 打个标记，样式按情况走。
 */
const ua = navigator.userAgent;
if (/Electron\//.test(ua) && /Macintosh/.test(ua)) document.documentElement.classList.add('mac-app');

/**
 * 像 Mac 一样：用鼠标点按钮不会把键盘焦点抢走。
 * 不然点了一下时间轴上的镜头，再按空格就成了「再点一次这个按钮」，而不是播放；
 * 正在备注框里打字时点一下「B-roll」，也不会把光标从备注框里拿走。用 Tab 键走焦点照常。
 */
document.addEventListener('mousedown', (e) => {
  const target = e.target as HTMLElement | null;
  const btn = target?.closest?.('button, [role="button"]');
  if (btn && !btn.closest('.sheet')) e.preventDefault();
});

const el = document.getElementById('app');
if (el) createRoot(el).render(<App />);
