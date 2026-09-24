/** 后端接口。出错一律抛出带服务端中文消息的 Error，界面上不出现「未知错误」。 */
import type { ReelProject, Shot } from '../../src/core/types';

export type { ReelProject, Shot };

export type ProjectSummary = {
  id: string;
  title: string;
  filename: string;
  duration: number;
  shotCount: number;
  reviewedCount: number;
  unsortedCount: number;
  cover?: string;
  updatedAt: string;
  sourceExists: boolean;
};

export type Work = {
  id: string;
  name: string;
  templateId: string;
  params: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  lastRender?: string;
};

export type PublicSettings = {
  vision: { baseUrl: string; model: string; hasKey: boolean; keyHint: string } | null;
  eagle: { hasToken: boolean };
};

export type ReplicaCandidate = {
  projectId: string;
  projectTitle: string;
  shotId: string;
  index: number;
  roll: Shot['roll'];
  start: number;
  end: number;
  thumbnail?: string;
  templateFit: { fit: boolean; reason: string; source: string } | null;
  exportedDir: string | null;
};

async function request<T>(url: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(url, init);
  const type = res.headers.get('content-type') ?? '';
  const body = type.includes('json') ? await res.json() : await res.text();
  if (!res.ok) throw new Error(typeof body === 'object' && body?.error ? body.error : String(body));
  return body as T;
}

const json = (method: string, body: unknown): RequestInit => ({
  method,
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify(body),
});

export const thumbUrl = (projectId: string, file?: string) =>
  file ? `/api/projects/${projectId}/thumbs/${file}` : '';

export const api = {
  health: () => request<{ ok: boolean; message: string }>('/api/health'),
  vocabulary: () => request<{ visionConfigured: boolean }>('/api/vocabulary'),

  listProjects: () => request<ProjectSummary[]>('/api/projects'),
  getProject: (id: string) => request<ReelProject>(`/api/projects/${id}`),
  patchShot: (id: string, shotId: string, patch: Record<string, unknown>) =>
    request<Shot>(`/api/projects/${id}/shots/${shotId}`, json('PATCH', patch)),
  splitShot: (id: string, shotId: string, time: number) =>
    request<{ shots: Shot[] }>(`/api/projects/${id}/shots/${shotId}/split`, json('POST', { time })),
  autoSplitShot: (id: string, shotId: string, threshold: number) =>
    request<{ shots: Shot[]; added: number }>(`/api/projects/${id}/shots/${shotId}/autosplit`, json('POST', { threshold })),
  mergeShot: (id: string, shotId: string) =>
    request<{ shots: Shot[] }>(`/api/projects/${id}/shots/${shotId}/merge`, { method: 'POST' }),
  resplit: (id: string, opts: { threshold: number; minShotDuration?: number }) =>
    request<{ shotCount: number }>(`/api/projects/${id}/resplit`, json('POST', opts)),
  uploadVideo: (file: File) =>
    request<{ path: string }>('/api/videos', {
      method: 'POST',
      headers: { 'x-filename': encodeURIComponent(file.name) },
      body: file,
    }),
  replicaCandidates: () => request<ReplicaCandidate[]>('/api/replica-candidates'),

  listWorks: () => request<Work[]>('/api/works'),
  getWork: (id: string) => request<Work>(`/api/works/${id}`),
  createWork: (templateId: string, name: string, params: Record<string, unknown>) =>
    request<Work>('/api/works', json('POST', { templateId, name, params })),
  saveWork: (id: string, patch: { name?: string; params?: Record<string, unknown> }) =>
    request<Work>(`/api/works/${id}`, json('PUT', patch)),
  deleteWork: (id: string) => request<{ ok: true }>(`/api/works/${id}`, { method: 'DELETE' }),
  uploadImage: (file: File) =>
    request<{ url: string }>('/api/assets', {
      method: 'POST',
      headers: { 'x-filename': encodeURIComponent(file.name) },
      body: file,
    }),

  getSettings: () => request<PublicSettings>('/api/settings'),
  saveSettings: (patch: { vision?: { baseUrl: string; apiKey: string; model: string }; eagle?: { token: string } }) =>
    request<PublicSettings>('/api/settings', json('PUT', patch)),
  testVision: () => request<{ ok: true; model: string }>('/api/settings/test-vision', { method: 'POST' }),
  testEagle: () => request<{ ok: true; version: string }>('/api/settings/test-eagle', { method: 'POST' }),

  /** 在访达里显示。path 不填打开导出的视频文件夹；root 打开整个 ShotPilot 文件夹 */
  reveal: (path?: string) => request<{ ok: true }>('/api/reveal', json('POST', { path })),
  revealRoot: () => request<{ ok: true }>('/api/reveal', json('POST', { kind: 'root' })),
  revealReplicaFolder: () => request<{ ok: true }>('/api/reveal', json('POST', { kind: 'replicaOut' })),
};

/**
 * 读 SSE 流。分析、导出复刻包、导出视频都是分钟级的长任务，必须实时告诉用户进行到哪了。
 * 服务端出错时返回 {"error": "..."}，只把里面那句话给用户看。
 */
export async function streamPost(url: string, body: unknown, handlers: Record<string, (data: any) => void>): Promise<void> {
  const res = await fetch(url, json('POST', body));
  if (!res.ok || !res.body) {
    const text = await res.text();
    let message = text;
    let code: string | undefined;
    try {
      const parsed = JSON.parse(text);
      message = parsed.error ?? text;
      code = parsed.code;
    } catch { /* 不是 JSON，原样显示 */ }
    throw Object.assign(new Error(message || `请求失败：${res.status}`), { code });
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    // SSE 以空行分隔事件；最后一段可能不完整，留在 buffer 里等下一轮
    const blocks = buffer.split('\n\n');
    buffer = blocks.pop() ?? '';
    for (const block of blocks) {
      let event = 'message';
      let data = '';
      for (const line of block.split('\n')) {
        if (line.startsWith('event: ')) event = line.slice(7).trim();
        else if (line.startsWith('data: ')) data += line.slice(6);
      }
      if (!data) continue;
      let parsed: unknown;
      try { parsed = JSON.parse(data); } catch { continue; }
      handlers[event]?.(parsed);
    }
  }
}

/** 秒 → 0:04.4；超过一小时带小时 */
export function fmtTime(seconds: number, digits = 1): string {
  const factor = 10 ** digits;
  // 先按要显示的位数取整再拆分，不然 59.96 秒会显示成 0:60.0
  const total = Math.round((Number.isFinite(seconds) && seconds > 0 ? seconds : 0) * factor) / factor;
  const h = Math.floor(total / 3600);
  const m = Math.floor((total - h * 3600) / 60);
  const s = (total - h * 3600 - m * 60).toFixed(digits).padStart(digits > 0 ? 3 + digits : 2, '0');
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${s}` : `${m}:${s}`;
}

/** 刻度尺上的数字：整秒不带小数，放大到半秒、0.1 秒时带上 */
export function tickDigits(t: number): number {
  if (Number.isInteger(Math.round(t * 1000) / 1000)) return 0;
  return Number.isInteger(Math.round(t * 10000) / 1000) ? 1 : 2;
}

/** 「今天 14:20」「昨天」「9月20日」 */
export function fmtWhen(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const day = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = Math.round((day(now) - day(d)) / 86400000);
  const hm = `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
  if (diff === 0) return `今天 ${hm}`;
  if (diff === 1) return `昨天 ${hm}`;
  if (d.getFullYear() === now.getFullYear()) return `${d.getMonth() + 1}月${d.getDate()}日`;
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
}
