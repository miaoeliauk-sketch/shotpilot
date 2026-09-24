/**
 * ShotPilot Mac 软件的主程序（Electron）。
 *
 * 做三件事：
 *   1. 在后台起工作台服务（dist/server/index.mjs），把自带的 ffmpeg、yt-dlp、
 *      渲染用的浏览器、打包好的模板都通过环境变量告诉它
 *   2. 等服务就绪后打开窗口
 *   3. 服务意外退出时告诉用户，而不是留一个白屏
 *
 * 用户数据放在「文稿/ShotPilot」，程序本身只读，更新软件不会碰到用户的作品。
 */
import { app, BrowserWindow, dialog, Menu, nativeTheme, screen, shell, utilityProcess } from 'electron';
import { createWriteStream, existsSync, mkdirSync, readdirSync, statSync } from 'node:fs';
import { createServer } from 'node:net';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const APP_DIR = dirname(dirname(fileURLToPath(import.meta.url)));
const BIN = join(APP_DIR, 'bin');

let mainWindow = null;
let server = null;
let serverPort = 0;
let quitting = false;

/** 优先用 5174（和以前的网页版一样，书签还能用），被占了就随便找一个空端口 */
function pickPort(preferred) {
  return new Promise((resolve) => {
    const probe = createServer();
    probe.once('error', () => {
      const any = createServer();
      any.listen(0, '127.0.0.1', () => {
        const { port } = any.address();
        any.close(() => resolve(port));
      });
    });
    probe.listen(preferred, '127.0.0.1', () => probe.close(() => resolve(preferred)));
  });
}

/** 渲染用的浏览器：构建时下载好放在 chrome/ 里（见 stage.sh），找到那个可执行文件 */
function findChrome() {
  const root = join(APP_DIR, 'chrome');
  const stack = [root];
  while (stack.length > 0) {
    const dir = stack.pop();
    let entries = [];
    try { entries = readdirSync(dir); } catch { continue; }
    for (const name of entries) {
      const p = join(dir, name);
      let st;
      try { st = statSync(p); } catch { continue; }
      if (st.isDirectory()) stack.push(p);
      else if (name === 'chrome-headless-shell') return p;
    }
  }
  return '';
}

function logFile() {
  const dir = app.getPath('logs');
  mkdirSync(dir, { recursive: true });
  return join(dir, 'server.log');
}

async function waitForHealth(port, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/api/health`);
      if (res.ok) return true;
    } catch {
      // 还没起来
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  return false;
}

async function startServer() {
  serverPort = await pickPort(5174);
  // 用户数据放「文稿/ShotPilot」，在访达里好找。系统不让写文稿（拒绝了权限）时退到软件自己的目录
  let dataRoot = join(app.getPath('documents'), 'ShotPilot');
  try {
    mkdirSync(dataRoot, { recursive: true });
  } catch {
    dataRoot = join(app.getPath('userData'), 'data');
    mkdirSync(dataRoot, { recursive: true });
  }
  const env = {
    ...process.env,
    SHOTPILOT_PORT: String(serverPort),
    SHOTPILOT_DATA: dataRoot,
    SHOTPILOT_FFMPEG: join(BIN, 'ffmpeg'),
    SHOTPILOT_FFPROBE: join(BIN, 'ffprobe'),
    SHOTPILOT_YTDLP: join(BIN, 'yt-dlp'),
    SHOTPILOT_BROWSER: findChrome(),
    SHOTPILOT_REMOTION_BUNDLE: join(APP_DIR, 'dist', 'remotion-bundle'),
  };
  const log = createWriteStream(logFile(), { flags: 'a' });
  log.write(`\n==== ${new Date().toISOString()} 启动，端口 ${serverPort} ====\n`);
  server = utilityProcess.fork(join(APP_DIR, 'dist', 'server', 'index.mjs'), [], {
    env,
    cwd: APP_DIR,
    stdio: 'pipe',
    serviceName: 'ShotPilot 工作台服务',
  });
  server.stdout?.pipe(log);
  server.stderr?.pipe(log);
  server.on('exit', (code) => {
    server = null;
    if (quitting) return;
    dialog.showErrorBox(
      'ShotPilot 出了点问题',
      `后台服务意外退出（代码 ${code}）。请重新打开软件。\n\n如果反复出现，把这个文件发给 AI 看：\n${logFile()}`,
    );
    app.quit();
  });
  return waitForHealth(serverPort, 30_000);
}

function createWindow() {
  // 界面是深色的（和 Final Cut Pro 一样），系统是浅色模式时也用深色的毛玻璃和系统控件，不然左边一栏会发灰
  nativeTheme.themeSource = 'dark';
  // 笔记本屏幕放不下 1440×900 时按屏幕可用区域缩小，别让窗口伸出屏幕外
  const work = screen.getPrimaryDisplay().workAreaSize;
  const width = Math.min(1440, work.width);
  const height = Math.min(900, work.height);
  mainWindow = new BrowserWindow({
    width,
    height,
    minWidth: Math.min(1100, width),
    minHeight: Math.min(680, height),
    title: 'ShotPilot',
    // 和 Mac 自带软件一样：没有单独的标题栏，红黄绿三个按钮放在左边工具栏顶上，
    // 左边工具栏透出系统的毛玻璃（界面里那一栏是半透明的，其余部分都有自己的底色）
    titleBarStyle: 'hidden',
    trafficLightPosition: { x: 12, y: 19 },
    vibrancy: 'sidebar',
    visualEffectState: 'followWindow',
    backgroundColor: '#00000000',
    show: false,
  });
  mainWindow.once('ready-to-show', () => mainWindow?.show());
  // 工作台里「在这里播放」之类的链接开新窗口；外部网址交给默认浏览器
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith(`http://127.0.0.1:${serverPort}/`)) return { action: 'allow' };
    void shell.openExternal(url);
    return { action: 'deny' };
  });
  mainWindow.on('closed', () => { mainWindow = null; });
  void mainWindow.loadURL(`http://127.0.0.1:${serverPort}/`);
}

/** 屏幕顶上的菜单栏，用中文。「编辑」菜单不能省：没有它，输入框里 ⌘C / ⌘V 在 Mac 上不起作用 */
function setMenu() {
  const sep = { type: 'separator' };
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    {
      label: app.name,
      submenu: [
        { role: 'about', label: '关于 ShotPilot' },
        sep,
        { role: 'hide', label: '隐藏 ShotPilot' },
        { role: 'hideOthers', label: '隐藏其他' },
        { role: 'unhide', label: '全部显示' },
        sep,
        { role: 'quit', label: '退出 ShotPilot' },
      ],
    },
    {
      label: '编辑',
      submenu: [
        { role: 'undo', label: '撤销' },
        { role: 'redo', label: '重做' },
        sep,
        { role: 'cut', label: '剪切' },
        { role: 'copy', label: '拷贝' },
        { role: 'paste', label: '粘贴' },
        { role: 'selectAll', label: '全选' },
      ],
    },
    {
      label: '显示',
      submenu: [
        { role: 'reload', label: '重新载入' },
        sep,
        { role: 'resetZoom', label: '实际大小' },
        { role: 'zoomIn', label: '放大' },
        { role: 'zoomOut', label: '缩小' },
        sep,
        { role: 'togglefullscreen', label: '进入全屏幕' },
      ],
    },
    {
      label: '窗口',
      role: 'windowMenu',
      submenu: [
        { role: 'minimize', label: '最小化' },
        { role: 'zoom', label: '缩放' },
        sep,
        { role: 'front', label: '前置全部窗口' },
      ],
    },
  ]));
}

function selfCheck() {
  const missing = ['ffmpeg', 'ffprobe', 'yt-dlp'].filter((n) => !existsSync(join(BIN, n)));
  if (!findChrome()) missing.push('chrome-headless-shell');
  if (!existsSync(join(APP_DIR, 'dist', 'remotion-bundle', 'index.html'))) missing.push('remotion-bundle');
  console.log(missing.length ? `缺少：${missing.join('、')}` : `自带组件齐全（渲染浏览器：${findChrome()}）`);
  app.exit(missing.length ? 1 : 0);
}

if (process.argv.includes('--self-check')) {
  // 构建时跑一遍，确认自带的东西都在
  selfCheck();
} else if (!app.requestSingleInstanceLock()) {
  // 已经开着一个了：把那个窗口叫到前面（见 second-instance），这个退出
  app.quit();
} else {
  app.on('second-instance', () => {
    if (!mainWindow) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  });

  app.whenReady().then(async () => {
    const ok = await startServer();
    if (!ok) {
      dialog.showErrorBox('ShotPilot 启动失败', `工作台服务 30 秒内没有启动起来。\n\n把这个文件发给 AI 看：\n${logFile()}`);
      quitting = true;
      server?.kill();
      app.quit();
      return;
    }
    setMenu();
    createWindow();
    app.on('activate', () => {
      if (!mainWindow) createWindow();
    });
  });

  // 关掉窗口不退出（Mac 的习惯），从程序坞点图标会重新打开窗口；Cmd+Q 才真正退出
  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });

  app.on('before-quit', () => {
    quitting = true;
    server?.kill();
  });
}
