import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, isAbsolute, join } from 'node:path';
import { dataDir } from '../core/paths.js';
import { FFMPEG, FFPROBE } from './ffmpeg.js';

/**
 * 从链接下载视频（抖音、B 站、YouTube 等），靠本机的 yt-dlp。
 *
 * 目的是让拉片不用先去终端下载：在工作台里粘链接就能开始。
 */

const YTDLP = process.env.SHOTPILOT_YTDLP ?? 'yt-dlp';

/** 下载到哪。位置规则见 paths.ts */
export function downloadsDir(): string {
  return dataDir('downloads');
}

/**
 * 从一段文字里挑出第一个链接。
 *
 * 用户从抖音「分享 → 复制链接」拿到的往往是一整段文案，
 * 例如「7.43 复制打开抖音，看看【某某的作品】… https://v.douyin.com/xxxx/ ABC:/」，
 * 不能要求他们自己把链接抠出来。
 */
export function extractUrl(text: string): string | null {
  const m = /https?:\/\/[^\s"'<>，。、；！？）」】]+/i.exec(text);
  if (!m) return null;
  // 去掉粘贴时常带上的结尾标点
  return m[0].replace(/[.,;:!?)\]]+$/, '');
}

/** yt-dlp 失败是不是因为要浏览器 cookie（抖音常见：Fresh cookies ... are needed） */
export function needsCookies(stderr: string): boolean {
  return /cookies?/i.test(stderr) && /(needed|required|log ?in|sign ?in|--cookies)/i.test(stderr);
}

/** 从 yt-dlp 的一行输出里读下载进度百分比 */
export function parseProgress(line: string): number | null {
  const m = /\[download\]\s+(\d+(?:\.\d+)?)%/.exec(line);
  return m?.[1] !== undefined ? Number(m[1]) : null;
}

export interface DownloadResult {
  path: string;
  title: string;
  /** 用了哪个浏览器的 cookie，没用则为 null */
  cookiesFrom: string | null;
}

interface AttemptResult { ok: boolean; stderr: string; info: { filepath?: string; title?: string } | null }

function attempt(
  url: string, outDir: string, cookiesFrom: string | null,
  onProgress: (percent: number) => void,
): Promise<AttemptResult> {
  return new Promise((resolvePromise, reject) => {
    const args = [
      '--no-playlist',
      '--newline',            // 进度逐行输出，便于解析
      '--progress',           // --print 会隐含安静模式，这里强制仍输出进度
      '-f', 'bv*+ba/b',
      '--merge-output-format', 'mp4',
      '-o', join(outDir, '%(extractor)s-%(id)s.%(ext)s'),
      // 下载并合并完成后，把最终文件路径和标题以 JSON 打出来
      '--print', 'after_move:%(.{filepath,title})j',
    ];
    if (cookiesFrom) args.push('--cookies-from-browser', cookiesFrom);
    // Mac 软件里 ffmpeg 和 ffprobe 放在同一个自带目录，告诉 yt-dlp 去那里找（合并音视频要用）。
    // 开发时它们分散在两个 npm 包里，就让 yt-dlp 用系统里的
    if (isAbsolute(FFMPEG) && dirname(FFMPEG) === dirname(FFPROBE)) args.push('--ffmpeg-location', dirname(FFMPEG));
    args.push(url);

    const child = spawn(YTDLP, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stderr = '';
    let info: AttemptResult['info'] = null;
    let buf = '';

    const onLine = (line: string) => {
      const p = parseProgress(line);
      if (p !== null) { onProgress(p); return; }
      const t = line.trim();
      if (t.startsWith('{') && t.endsWith('}')) {
        try { info = JSON.parse(t); } catch { /* 不是那行 JSON，忽略 */ }
      }
    };
    const feed = (chunk: Buffer) => {
      buf += chunk.toString();
      const lines = buf.split(/\r?\n/);
      buf = lines.pop() ?? '';
      lines.forEach(onLine);
    };
    child.stdout.on('data', feed);
    child.stderr.on('data', (d: Buffer) => { stderr += d.toString(); feed(d); });
    child.on('error', (err) => {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
        reject(new Error('没找到 yt-dlp，下载不了链接。Mac 上装一次就行：brew install yt-dlp'));
      } else reject(err);
    });
    child.on('close', (code) => {
      if (buf) onLine(buf);
      resolvePromise({ ok: code === 0 && !!info?.filepath, stderr, info });
    });
  });
}

/**
 * 下载链接里的视频。
 *
 * 先不带 cookie 试；如果平台要求 cookie（抖音常见），依次借 Chrome、Safari 的 cookie 再试。
 * 这一步以前要用户自己在终端里加 --cookies-from-browser，现在自动处理。
 */
export async function downloadVideo(
  url: string,
  onProgress: (message: string) => void = () => {},
): Promise<DownloadResult> {
  const outDir = downloadsDir();
  await mkdir(outDir, { recursive: true });

  const browsers: (string | null)[] = [null, 'chrome', 'safari'];
  let lastErr = '';
  for (const browser of browsers) {
    onProgress(browser ? `平台要求登录信息，借用 ${browser === 'chrome' ? 'Chrome' : 'Safari'} 的 cookie 重试…` : '开始下载…');
    let lastShown = -10;
    const r = await attempt(url, outDir, browser, (p) => {
      // 每涨 10% 报一次，别刷屏
      if (p - lastShown >= 10 || p >= 100) { lastShown = p; onProgress(`下载中 ${p.toFixed(0)}%`); }
    });
    if (r.ok && r.info?.filepath && existsSync(r.info.filepath)) {
      return { path: r.info.filepath, title: r.info.title ?? '', cookiesFrom: browser };
    }
    lastErr = r.stderr;
    // 不是 cookie 问题就别再换浏览器重试了，直接报错
    if (!needsCookies(r.stderr)) break;
  }

  const tail = lastErr.trim().split('\n').filter((l) => /error/i.test(l)).slice(-2).join('\n') || lastErr.trim().split('\n').slice(-2).join('\n');
  throw new Error(`${explainDownloadError(lastErr)}\n（原始信息：${tail}）`);
}

/** 把 yt-dlp 的常见报错翻成人话。认不出的就只给原文。 */
export function explainDownloadError(stderr: string): string {
  if (needsCookies(stderr)) return '下载失败：平台要求登录信息。先用 Chrome 打开一次这个链接（不用登录），再回来重试。';
  if (/HTTP Error 404|not found/i.test(stderr)) return '下载失败：链接打不开（404），视频可能已被删除，或链接复制得不完整。';
  if (/HTTP Error 403|forbidden/i.test(stderr)) return '下载失败：平台拒绝了访问（403），过一会儿再试，或先在浏览器里打开一次这个链接。';
  if (/Unsupported URL/i.test(stderr)) return '下载失败：不支持这个网站的链接。';
  if (/timed out|Unable to connect|Connection (refused|reset)|Temporary failure in name resolution/i.test(stderr)) {
    return '下载失败：连不上这个网站，检查一下网络。';
  }
  return '下载失败。';
}
