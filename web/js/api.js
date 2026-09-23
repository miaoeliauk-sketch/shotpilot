/** 后端接口薄封装。所有非 2xx 一律抛出带服务端消息的 Error，避免界面上出现"未知错误"。 */

async function request(url, options = {}) {
  const res = await fetch(url, options);
  const type = res.headers.get('content-type') ?? '';
  const body = type.includes('json') ? await res.json() : await res.text();
  if (!res.ok) throw new Error(typeof body === 'object' && body?.error ? body.error : String(body));
  return body;
}

export const api = {
  health: () => request('/api/health'),
  vocabulary: () => request('/api/vocabulary'),
  listProjects: () => request('/api/projects'),
  getProject: (id) => request(`/api/projects/${id}`),
  patchProject: (id, patch) =>
    request(`/api/projects/${id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(patch),
    }),
  patchShot: (id, shotId, patch) =>
    request(`/api/projects/${id}/shots/${shotId}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(patch),
    }),
  splitShot: (id, shotId, time) =>
    request(`/api/projects/${id}/shots/${shotId}/split`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ time }),
    }),
  autoSplitShot: (id, shotId, threshold) =>
    request(`/api/projects/${id}/shots/${shotId}/autosplit`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ threshold }),
    }),
  mergeShot: (id, shotId) =>
    request(`/api/projects/${id}/shots/${shotId}/merge`, { method: 'POST' }),
  resplit: (id, opts) =>
    request(`/api/projects/${id}/resplit`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(opts),
    }),
};

/**
 * 读 SSE 流。
 * 分析和 AI 标注都是分钟级的长任务，必须有实时进度，否则用户不知道是在跑还是卡死了。
 */
export async function streamPost(url, body, handlers) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok || !res.body) {
    const text = await res.text();
    // 服务端出错时返回 {"error": "..."}，只把里面那句话给用户看
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
      try {
        handlers[event]?.(JSON.parse(data));
      } catch {
        // 单条事件解析失败不该中断整个流
      }
    }
  }
}
