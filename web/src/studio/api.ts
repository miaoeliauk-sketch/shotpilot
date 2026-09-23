/** 模板工作室用到的后端接口。出错一律抛出带服务端中文消息的 Error。 */

export type Work = {
  id: string;
  name: string;
  templateId: string;
  params: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  lastRender?: string;
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

export const studioApi = {
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
  reveal: (path?: string) => request<{ ok: true }>('/api/reveal', json('POST', { path })),
};

/** 读导出进度（SSE）。导出要几十秒到几分钟，必须实时告诉用户进行到哪了 */
export async function streamRender(
  body: unknown,
  handlers: {
    progress?: (d: { message: string; percent: number | null }) => void;
    done?: (d: { file: string; url: string }) => void;
    failed?: (d: { message: string }) => void;
  },
): Promise<void> {
  const res = await fetch('/api/render', json('POST', body));
  if (!res.ok || !res.body) {
    const text = await res.text();
    let message = text;
    try { message = JSON.parse(text).error ?? text; } catch { /* 不是 JSON，原样显示 */ }
    throw new Error(message || `请求失败：${res.status}`);
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
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
      const parsed = JSON.parse(data);
      if (event === 'progress') handlers.progress?.(parsed);
      else if (event === 'done') handlers.done?.(parsed);
      else if (event === 'failed') handlers.failed?.(parsed);
    }
  }
}
