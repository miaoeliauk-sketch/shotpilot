import { existsSync } from 'node:fs';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { dataRoot } from './paths.js';

/**
 * 软件设置：看图 AI 的地址 / Key / 模型，Eagle 的令牌。
 *
 * 存在「ShotPilot」文件夹里的 settings.json，只在这台电脑上。
 * Mac 软件里没法设环境变量，所以这些要能在界面里填；环境变量仍然可用（开发时方便），界面里填的优先。
 */

export type Settings = {
  vision?: { baseUrl: string; apiKey: string; model: string };
  eagle?: { baseUrl?: string; token?: string };
};

export function settingsFile(): string {
  return join(dataRoot(), 'settings.json');
}

export async function loadSettings(): Promise<Settings> {
  const file = settingsFile();
  if (!existsSync(file)) return {};
  try {
    return JSON.parse(await readFile(file, 'utf8')) as Settings;
  } catch {
    return {};
  }
}

const str = (v: unknown, max = 300) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

/** 合并保存。Key 留空表示「不改」，这样界面上不用把已保存的 Key 回显出来 */
export async function saveSettings(patch: unknown): Promise<Settings> {
  const prev = await loadSettings();
  const next: Settings = { ...prev };
  const p = (typeof patch === 'object' && patch !== null ? patch : {}) as Record<string, Record<string, unknown> | undefined>;
  if (p.vision) {
    const baseUrl = str(p.vision.baseUrl).replace(/\/+$/, '');
    const model = str(p.vision.model, 120);
    const apiKey = str(p.vision.apiKey, 500) || prev.vision?.apiKey || '';
    next.vision = baseUrl || model || apiKey ? { baseUrl, model, apiKey } : undefined;
    if (p.vision.clear === true) next.vision = undefined;
  }
  if (p.eagle) {
    const token = p.eagle.token === undefined ? prev.eagle?.token : str(p.eagle.token, 200);
    next.eagle = { baseUrl: prev.eagle?.baseUrl, token: token || undefined };
  }
  const file = settingsFile();
  await mkdir(dirname(file), { recursive: true });
  // 先写临时文件再改名，写到一半断电也不会把设置写坏
  await writeFile(`${file}.tmp`, JSON.stringify(next, null, 2), 'utf8');
  await rename(`${file}.tmp`, file);
  return next;
}

/** 给界面看的版本：Key 只露最后 4 位 */
export function publicSettings(s: Settings) {
  const key = s.vision?.apiKey ?? '';
  return {
    vision: s.vision
      ? { baseUrl: s.vision.baseUrl, model: s.vision.model, hasKey: key.length > 0, keyHint: key ? `…${key.slice(-4)}` : '' }
      : null,
    eagle: { hasToken: !!s.eagle?.token },
  };
}
