import { api, streamPost } from './api.js';

const root = document.getElementById('app');
const state = {
  view: 'home',
  projects: [],
  dimensions: [],
  visionConfigured: false,
  project: null,
  activeIndex: 0,
  video: null,
  saveTimer: null,
  log: [],
};

const fmt = (s) => {
  const safe = Number.isFinite(s) && s > 0 ? s : 0;
  const m = Math.floor(safe / 60);
  return `${String(m).padStart(2, '0')}:${(safe - m * 60).toFixed(1).padStart(4, '0')}`;
};
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/**
 * 输入状态提示。
 *
 * 焦点落进备注/元素这些文本框时，所有标注快捷键都会让路——这是对的，
 * 否则打字会触发标注。但如果不告诉用户，快捷键就是**静默失效**：
 * 按 Z 按 6 都没反应，界面上却没有任何解释。这条提示让它可见。
 */
function setTypingIndicator(typing) {
  const bar = document.getElementById('keyhint');
  if (!bar) return;
  bar.innerHTML = typing
    ? '<b style="color:var(--broll)">正在输入文字 · 快捷键已暂停</b>　按 Esc 或点视频区域退出输入'
    : '空格 播放/暂停　←→ 切镜头　<b>S 补刀</b>　<b>M 并入上一个</b>　Enter 已审并下一个';
}

document.addEventListener('focusin', (e) => {
  const tag = e.target?.tagName;
  setTypingIndicator(tag === 'INPUT' || tag === 'TEXTAREA');
});
document.addEventListener('focusout', () => {
  // 延后一拍：焦点在两个输入框之间跳时不要闪
  setTimeout(() => {
    const a = document.activeElement;
    setTypingIndicator(!!a && (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA'));
  }, 0);
});

function toast(message) {
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = message;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 2600);
}

/* ------------------------------------------------------------------ 首页 */

function renderHome() {
  root.innerHTML = `
    <div class="home">
      <h1>ShotPilot 拉片工作台</h1>
      <p class="sub">导入视频 → 自动切分镜 → 逐镜标注景别/运镜/光线 → 导出笔记与 hypit 素材</p>

      <div class="new-box">
        <h3 style="margin:0 0 8px">新建拉片</h3>
        <input id="path" placeholder="视频的绝对路径，例如 /Users/you/Downloads/ref.mp4">
        <div class="row">
          <label>切分灵敏度</label>
          <input id="threshold" type="number" step="0.05" min="0.05" max="0.95" value="0.3" style="width:90px">
          <label>最短镜头(秒)</label>
          <input id="minDur" type="number" step="0.1" min="0.1" value="0.4" style="width:90px">
          <label>转写</label>
          <select id="transcribe" style="width:auto">
            <option value="none">不转写</option>
            <option value="whisperx">本地 WhisperX</option>
            <option value="subtitles">导入字幕文件</option>
          </select>
        </div>
        <div class="row" id="subRow" style="display:none">
          <label>字幕路径</label>
          <input id="subPath" placeholder="/path/to/subtitle.srt 或 whisper 输出的 .json">
        </div>
        <div class="row">
          <button class="primary" id="go">开始分析</button>
          <span class="meta" id="status"></span>
        </div>
        <div class="log" id="log" style="display:none"></div>
      </div>

      <h3 style="color:var(--muted);font-size:13px">已有项目</h3>
      <div id="list">${state.projects.length === 0 ? '<p class="meta">还没有项目</p>' : ''}</div>
    </div>`;

  const list = root.querySelector('#list');
  for (const p of state.projects) {
    const el = document.createElement('div');
    el.className = 'proj';
    el.innerHTML = `
      <div class="grow">
        <div>${esc(p.title)}</div>
        <div class="meta">${esc(p.filename)} · ${fmt(p.duration)} · ${p.shotCount} 个镜头 · 已审 ${p.reviewedCount}/${p.shotCount}</div>
        ${p.sourceExists ? '' : '<div class="warn">⚠ 源视频已移动或删除，无法播放</div>'}
      </div>
      <div class="meta">${new Date(p.updatedAt).toLocaleString('zh-CN')}</div>`;
    el.onclick = () => openProject(p.id);
    list.appendChild(el);
  }

  const transcribeSel = root.querySelector('#transcribe');
  transcribeSel.onchange = () => {
    root.querySelector('#subRow').style.display = transcribeSel.value === 'subtitles' ? 'flex' : 'none';
  };
  root.querySelector('#go').onclick = startAnalyze;
}

async function startAnalyze() {
  const path = root.querySelector('#path').value.trim();
  if (!path) return toast('请填写视频路径');

  const btn = root.querySelector('#go');
  const logEl = root.querySelector('#log');
  const statusEl = root.querySelector('#status');
  btn.disabled = true;
  logEl.style.display = 'block';
  logEl.textContent = '';
  state.log = [];

  const append = (line) => {
    state.log.push(line);
    logEl.textContent = state.log.join('\n');
    logEl.scrollTop = logEl.scrollHeight;
  };

  try {
    await streamPost('/api/projects', {
      path,
      threshold: Number(root.querySelector('#threshold').value),
      minShotDuration: Number(root.querySelector('#minDur').value),
      transcribe: root.querySelector('#transcribe').value,
      subtitlePath: root.querySelector('#subPath')?.value.trim() || undefined,
    }, {
      progress: (d) => append(`[${d.stage}] ${d.detail ?? ''}`),
      done: (d) => { append('完成'); openProject(d.id); },
      failed: (d) => { append(`失败：${d.message}`); statusEl.textContent = '分析失败'; },
    });
  } catch (err) {
    append(`失败：${err.message}`);
  } finally {
    btn.disabled = false;
  }
}

/* ------------------------------------------------------------ 工作台 */

async function openProject(id) {
  state.project = await api.getProject(id);
  state.activeIndex = 0;
  state.view = 'workbench';
  history.replaceState(null, '', `?id=${id}`);
  renderWorkbench();
}

function activeShot() {
  return state.project?.shots[state.activeIndex] ?? null;
}

function renderWorkbench() {
  const p = state.project;
  root.innerHTML = `
    <div class="workbench">
      <div class="stage">
        <div class="topbar">
          <span class="title">${esc(p.title)}</span>
          <span class="meta">${p.shots.length} 镜头 · 已审 <b id="reviewCount">${p.shots.filter((s) => s.reviewed).length}</b></span>
          <span class="grow"></span>
          <button id="btnResplit">重新切分</button>
          <button id="btnAi" ${state.visionConfigured ? '' : 'disabled title="未配置 SHOTPILOT_VISION_API_KEY"'}>AI 初判</button>
          <button id="btnMd">导出笔记</button>
          <button id="btnSvml">导出 SVML</button>
          <button id="btnHome">返回</button>
        </div>
        <div class="player"><video id="video" src="/api/projects/${p.id}/video" controls preload="metadata"></video></div>
        <div id="audiobar"></div>
        <div class="transport">
          <span class="time" id="clock">00:00.0</span>
          <span class="grow"></span>
          <span class="meta" id="keyhint">空格 播放/暂停　←→ 切镜头　<b>S 补刀</b>　<b>M 并入上一个</b>　Enter 已审并下一个</span>
        </div>
      </div>
      <div class="strip"><div class="filmstrip" id="strip"></div></div>
      <div class="side" id="side"></div>
    </div>`;

  state.video = root.querySelector('#video');
  state.video.addEventListener('timeupdate', () => {
    root.querySelector('#clock').textContent = fmt(state.video.currentTime);
  });

  root.querySelector('#btnHome').onclick = () => { history.replaceState(null, '', '/'); boot(); };
  root.querySelector('#btnMd').onclick = () => window.open(`/api/projects/${p.id}/export/md`);
  root.querySelector('#btnSvml').onclick = () => window.open(`/api/projects/${p.id}/export/svml`);
  root.querySelector('#btnResplit').onclick = doResplit;
  root.querySelector('#btnAi').onclick = doAutoAnnotate;

  renderAudioBar();
  renderStrip();
  renderSide();
}

function renderAudioBar() {
  const host = root.querySelector('#audiobar');
  const audio = state.project.audio;
  if (!audio || audio.segments.length === 0) { host.innerHTML = ''; return; }

  const total = state.project.source.duration;
  const bar = document.createElement('div');
  bar.className = 'audiobar';
  bar.title = audio.bpm ? `BGM 节奏 BPM ≈ ${audio.bpm} · ${audio.method}` : audio.method;
  for (const seg of audio.segments) {
    const d = document.createElement('div');
    d.className = `aud-${seg.kind}`;
    d.style.width = `${((seg.end - seg.start) / total) * 100}%`;
    d.title = `${fmt(seg.start)}–${fmt(seg.end)} ${seg.kind}`;
    bar.appendChild(d);
  }
  bar.onclick = (e) => {
    const rect = bar.getBoundingClientRect();
    seekTo(((e.clientX - rect.left) / rect.width) * total);
  };
  host.innerHTML = '';
  host.appendChild(bar);
}

function renderStrip() {
  const strip = root.querySelector('#strip');
  strip.innerHTML = '';
  state.project.shots.forEach((shot, i) => {
    const cell = document.createElement('div');
    cell.className = `cell roll-${shot.roll}${i === state.activeIndex ? ' active' : ''}${shot.reviewed ? ' reviewed' : ''}`;
    const img = shot.thumbnail
      ? `<img loading="lazy" src="/api/projects/${state.project.id}/thumbs/${shot.thumbnail}" alt="${shot.id}">`
      : '<div class="noimg">无缩略图</div>';
    cell.innerHTML = `${img}<div class="bar"></div><div class="cap"><span>${shot.id}</span><span>${(shot.end - shot.start).toFixed(1)}s</span></div><div class="dot"></div>`;
    cell.onclick = () => selectShot(i);
    strip.appendChild(cell);
  });
  const active = strip.children[state.activeIndex];
  active?.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' });
}

function shotWords(shot) {
  return state.project.words
    .filter((w) => w.start < shot.end && w.end > shot.start)
    .map((w) => w.text)
    .join('')
    .trim();
}

function renderSide() {
  const side = root.querySelector('#side');
  const shot = activeShot();
  if (!shot) { side.innerHTML = '<div class="empty">没有镜头</div>'; return; }

  const text = shotWords(shot);
  let html = `
    <div class="shot-head">
      <span class="id">${shot.id}</span>
      <span class="t">${fmt(shot.start)} → ${fmt(shot.end)}</span>
      <span class="t">${(shot.end - shot.start).toFixed(2)}s</span>
    </div>
    <div class="hint">${shot.index + 1} / ${state.project.shots.length}</div>
    ${text ? `<div class="quote">${esc(text)}</div>` : '<div class="hint">这个镜头没有口播（或未做转写）</div>'}
    <div class="group"><h3>备注</h3><textarea id="note" placeholder="为什么这么拍？学到什么？">${esc(shot.note)}</textarea></div>`;

  for (const dim of state.dimensions) {
    const current = dim.field === 'roll' ? shot.roll : shot.annotation[dim.field];
    const selected = new Set(dim.multi ? (current ?? []) : current ? [current] : []);
    const src = shot.annotationSource?.[dim.field];
    html += `<div class="group"><h3>${dim.label}${src === 'ai' ? ' <span style="color:var(--broll)">AI 初判</span>' : ''}</h3><div class="chips">`;
    for (const term of dim.terms) {
      if (term.value === 'unset') continue;
      const on = selected.has(term.value);
      html += `<span class="chip${on ? ' on' : ''}${on && src === 'ai' ? ' ai' : ''}" data-field="${dim.field}" data-value="${term.value}" data-multi="${dim.multi}" title="${esc(term.hint ?? '')}">${esc(term.label)}${term.key ? `<span class="k">${term.key.toUpperCase()}</span>` : ''}</span>`;
    }
    html += '</div></div>';
  }

  html += `
    <div class="group"><h3>元素（逗号分隔）</h3><input id="elements" value="${esc(shot.elements.join('，'))}"></div>
    <div class="group"><h3>特效（逗号分隔）</h3><input id="effects" value="${esc(shot.effects.join('，'))}"></div>
    <div class="group"><h3>B-roll 内容</h3><input id="brollContent" value="${esc(shot.brollContent ?? '')}" placeholder="复刻时这里要放什么画面"></div>
    <div class="group"><button id="btnAutoSplit" style="width:100%">在此镜头内细切（降低阈值重测）</button></div>
    <div class="group"><button class="primary" id="btnReview" style="width:100%">${shot.reviewed ? '✓ 已审（点击取消）' : '标记已审并下一个 (Enter)'}</button></div>`;

  side.innerHTML = html;

  side.querySelectorAll('.chip').forEach((chip) => {
    chip.onclick = () => toggleTerm(chip.dataset.field, chip.dataset.value, chip.dataset.multi === 'true');
  });
  for (const id of ['elements', 'effects', 'brollContent', 'note']) {
    const el = side.querySelector(`#${id}`);
    el.oninput = () => queueSave();
  }
  side.querySelector('#btnAutoSplit').onclick = autoSplitCurrent;
  side.querySelector('#btnReview').onclick = () => {
    const s = activeShot();
    patchShot({ reviewed: !s.reviewed });
    if (!s.reviewed) return;
    if (state.activeIndex < state.project.shots.length - 1) selectShot(state.activeIndex + 1);
  };
}

/* ------------------------------------------------------- 标注读写 */

function toggleTerm(field, value, multi) {
  const shot = activeShot();
  if (!shot) return;

  if (field === 'roll') {
    shot.roll = shot.roll === value ? 'unset' : value;
    patchShot({ roll: shot.roll });
    renderStrip();
    renderSide();
    return;
  }

  const annotation = { ...shot.annotation };
  if (multi) {
    const list = new Set(annotation[field] ?? []);
    list.has(value) ? list.delete(value) : list.add(value);
    annotation[field] = [...list];
    if (annotation[field].length === 0) delete annotation[field];
  } else {
    if (annotation[field] === value) delete annotation[field];
    else annotation[field] = value;
  }
  shot.annotation = annotation;
  // 只把改动的那个字段发过去，让服务端精确标记来源为 manual
  patchShot({ annotation: { [field]: annotation[field] ?? null } });
  renderSide();
}

/** 把当前面板里的文本字段读出来。必须在面板被重新渲染之前调用。 */
function readTextFields() {
  const side = root.querySelector('#side');
  if (!side?.querySelector('#note')) return null;
  const split = (v) => v.split(/[,，]/).map((s) => s.trim()).filter(Boolean);
  return {
    elements: split(side.querySelector('#elements').value),
    effects: split(side.querySelector('#effects').value),
    brollContent: side.querySelector('#brollContent').value,
    note: side.querySelector('#note').value,
  };
}

/**
 * 文本框防抖保存。
 *
 * 目标镜头在**排队那一刻**就锁定，不在定时器触发时才去读 activeShot()——
 * 否则打完字 600ms 内切了镜头，定时器读到的是新镜头的空文本框、写给的也是新镜头，
 * 旧镜头的备注就这么丢了。拉片的节奏正是「写一句 → 马上下一个」，这个窗口天天会撞上。
 */
function queueSave() {
  const shotId = activeShot()?.id;
  if (!shotId) return;
  clearTimeout(state.saveTimer);
  state.pendingSave = { shotId };
  state.saveTimer = setTimeout(flushSave, 600);
}

/** 立即执行排队中的保存。切镜头、离开页面前必须调用。 */
function flushSave() {
  clearTimeout(state.saveTimer);
  state.saveTimer = null;
  const pending = state.pendingSave;
  state.pendingSave = null;
  if (!pending) return;
  const fields = readTextFields();
  if (fields) patchShot(fields, pending.shotId);
}

// 关页面/刷新前把没存的备注冲出去，别让最后一句白写
window.addEventListener('beforeunload', flushSave);

/**
 * 保存镜头改动。
 *
 * shotId 显式传入，响应回来后**按 id 找位置**写回，而不是写到 activeIndex——
 * 等服务器响应的那几十毫秒里用户可能已经切了镜头，按 activeIndex 写会把
 * 旧镜头的数据覆盖到新镜头上。
 */
async function patchShot(patch, shotId = activeShot()?.id) {
  if (!shotId) return;
  try {
    const updated = await api.patchShot(state.project.id, shotId, patch);
    const index = state.project.shots.findIndex((s) => s.id === shotId);
    if (index !== -1) state.project.shots[index] = updated;
    const counter = root.querySelector('#reviewCount');
    if (counter) counter.textContent = String(state.project.shots.filter((s) => s.reviewed).length);
    renderStrip();
  } catch (err) {
    toast(`保存失败：${err.message}`);
  }
}

function seekTo(time) {
  if (!state.video) return;
  state.video.currentTime = Math.max(0, time);
}

function selectShot(index) {
  if (index < 0 || index >= state.project.shots.length) return;
  // 必须在 activeIndex 变化、面板重绘之前把没存的文字冲出去
  flushSave();
  // 焦点若还留在备注框里，切到下一个镜头后按键会继续往文本框里打，
  // 而不是触发标注快捷键。主动移开，让键盘操作接得上。
  const active = document.activeElement;
  if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA')) active.blur();
  state.activeIndex = index;
  const shot = activeShot();
  // 往里挪 50ms，避免正好落在切点上取到上一个镜头的末帧
  seekTo(shot.start + 0.05);
  renderStrip();
  renderSide();
}

/* ------------------------------------------------------- 手动补刀 */

/**
 * 在当前播放位置把当前镜头切成两半。
 * 场景检测抓不到「同一个人、同一背景、只换机位」的切换，这是唯一的补救手段。
 */
async function splitAtPlayhead() {
  flushSave();
  const shot = activeShot();
  if (!shot || !state.video) return;
  const time = state.video.currentTime;
  if (time <= shot.start || time >= shot.end) {
    return toast(`播放位置不在当前镜头范围内（${fmt(shot.start)}–${fmt(shot.end)}）`);
  }
  try {
    const r = await api.splitShot(state.project.id, shot.id, time);
    state.project.shots = r.shots;
    // 停在切出来的后半段：你按 S 就是因为发现这里换画面了，下一步多半要标它
    const next = r.shots.findIndex((x) => Math.abs(x.start - time) < 0.05);
    state.activeIndex = next === -1 ? state.activeIndex : next;
    renderStrip();
    renderSide();
    toast(`已在 ${fmt(time)} 补刀，现在 ${r.shots.length} 个镜头`);
  } catch (err) {
    toast(`补刀失败：${err.message}`);
  }
}

/** 把当前镜头并入上一个，撤销多余的刀。 */
/**
 * 只对当前镜头用更低阈值重新检测。
 * 录屏演示这类内容的场景分数比口播低一个数量级，全局阈值顾此失彼，
 * 只能对选中的段落单独调。
 */
async function autoSplitCurrent() {
  flushSave();
  const shot = activeShot();
  if (!shot) return;
  const input = prompt(
    `只对 ${shot.id}（${fmt(shot.start)}–${fmt(shot.end)}）重新检测。\n` +
    '录屏/图文演示建议 0.05–0.08，真人画面建议 0.15–0.25。',
    '0.08',
  );
  if (input === null) return;
  const threshold = Number(input);
  if (!Number.isFinite(threshold) || threshold <= 0 || threshold >= 1) return toast('阈值要在 0 和 1 之间');

  toast('检测中…');
  try {
    const r = await api.autoSplitShot(state.project.id, shot.id, threshold);
    state.project.shots = r.shots;
    renderStrip();
    renderSide();
    toast(r.added > 0
      ? `切出 ${r.added} 个新镜头，现在共 ${r.shots.length} 个`
      : `阈值 ${threshold} 下没找到切点，再调低试试`);
  } catch (err) {
    toast(`局部重切失败：${err.message}`);
  }
}

async function mergeIntoPrevious() {
  flushSave();
  const shot = activeShot();
  if (!shot) return;
  if (state.activeIndex === 0) return toast('第一个镜头前面没有镜头可以合并');
  try {
    const r = await api.mergeShot(state.project.id, shot.id);
    state.project.shots = r.shots;
    state.activeIndex = Math.max(0, state.activeIndex - 1);
    renderStrip();
    renderSide();
    toast(`已合并，现在 ${r.shots.length} 个镜头`);
  } catch (err) {
    toast(`合并失败：${err.message}`);
  }
}

/* ------------------------------------------------------- 批量操作 */

async function doResplit() {
  const threshold = Number(prompt('场景灵敏度 0.05–0.95（越小切得越碎）', '0.3'));
  if (!Number.isFinite(threshold)) return;
  toast('重新切分中…已有标注会按时间重叠迁移');
  try {
    const r = await api.resplit(state.project.id, { threshold });
    state.project = await api.getProject(state.project.id);
    state.activeIndex = 0;
    renderWorkbench();
    toast(`重新切出 ${r.shotCount} 个镜头`);
  } catch (err) {
    toast(`重新切分失败：${err.message}`);
  }
}

async function doAutoAnnotate() {
  if (!confirm('AI 初判会调用视觉模型并产生费用。只处理未审的镜头，不会覆盖你手动改过的字段。继续？')) return;
  const btn = root.querySelector('#btnAi');
  btn.disabled = true;
  try {
    await streamPost(`/api/projects/${state.project.id}/autoannotate`, { onlyUnreviewed: true }, {
      progress: (d) => { btn.textContent = `AI ${d.done}/${d.total}`; if (d.error) console.warn(d.shotId, d.error); },
      done: async () => {
        state.project = await api.getProject(state.project.id);
        renderWorkbench();
        toast('AI 初判完成，请逐镜复核');
      },
      failed: (d) => toast(`AI 初判失败：${d.message}`),
    });
  } catch (err) {
    toast(`AI 初判失败：${err.message}`);
  } finally {
    btn.disabled = false;
    btn.textContent = 'AI 初判';
  }
}

/* ------------------------------------------------------- 键盘 */

/**
 * 从事件里取出「用户按的是哪个物理键」。
 *
 * 不能只看 e.key：中文输入法开着的时候，字母键会被输入法截走当拼音，
 * e.key 变成 'Process' 或直接是候选汉字，页面收不到原本的字母——
 * 对一个中文用户的键盘驱动工具来说这是致命的。
 * e.code 给的是物理键位（KeyZ / Digit6），不受输入法和键盘布局影响。
 */
function physicalKey(e) {
  const code = e.code ?? '';
  if (code.startsWith('Key')) return code.slice(3).toLowerCase();
  if (code.startsWith('Digit')) return code.slice(5);
  if (code === 'Semicolon') return ';';
  // 没有 code 的老浏览器回落到 e.key
  return typeof e.key === 'string' && e.key.length === 1 ? e.key.toLowerCase() : '';
}

document.addEventListener('keydown', (e) => {
  if (state.view !== 'workbench') return;
  const tag = e.target.tagName;
  // 在输入框里打字时不抢键
  if (tag === 'INPUT' || tag === 'TEXTAREA') {
    if (e.key === 'Escape') e.target.blur();
    return;
  }
  // 走到这里说明焦点不在输入框，快捷键是生效的
  setTypingIndicator(false);

  // 正在用输入法组字时一律放行，否则会把半成品拼音当成快捷键
  if (e.isComposing) return;

  if (e.key === ' ' || e.code === 'Space') {
    e.preventDefault();
    state.video?.paused ? state.video.play() : state.video?.pause();
    return;
  }
  if (e.key === 'ArrowRight') { e.preventDefault(); return selectShot(state.activeIndex + 1); }
  if (e.key === 'ArrowLeft') { e.preventDefault(); return selectShot(state.activeIndex - 1); }
  if (e.key === 'Enter') {
    e.preventDefault();
    patchShot({ reviewed: true }, activeShot()?.id);
    return selectShot(state.activeIndex + 1);
  }

  // Ctrl / Cmd 组合是浏览器自己的（复制、刷新等），不抢
  if (e.ctrlKey || e.metaKey) return;

  const key = physicalKey(e);
  if (!key) return;

  // 结构编辑优先于标注：S/M 必须在词汇表查找之前处理，
  // 否则 S 会被构图的「三分法」抢走
  if (key === 's') { e.preventDefault(); return void splitAtPlayhead(); }
  if (key === 'm') { e.preventDefault(); return void mergeIntoPrevious(); }

  // 词汇表快捷键
  for (const dim of state.dimensions) {
    const term = dim.terms.find((t) => t.key === key);
    if (term) {
      e.preventDefault();
      toggleTerm(dim.field, term.value, dim.multi);
      return;
    }
  }
});

/* ------------------------------------------------------- 启动 */

async function boot() {
  try {
    const [vocab, projects, health] = await Promise.all([api.vocabulary(), api.listProjects(), api.health()]);
    state.dimensions = vocab.dimensions;
    state.visionConfigured = vocab.visionConfigured;
    state.projects = projects;
    if (!health.ok) toast(health.message);
  } catch (err) {
    root.innerHTML = `<div class="home"><h1>启动失败</h1><p class="warn">${esc(err.message)}</p></div>`;
    return;
  }

  const id = new URLSearchParams(location.search).get('id');
  if (id) {
    try { return await openProject(id); } catch { history.replaceState(null, '', '/'); }
  }
  state.view = 'home';
  renderHome();
}

boot();
