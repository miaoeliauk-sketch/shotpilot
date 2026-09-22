import { readFile } from 'node:fs/promises';
import { run } from './ffmpeg.js';
import type { Word } from '../core/types.js';

/**
 * 转写要的是**词级**时间戳，不是句级。
 *
 * 原因在 hypit 那边：SVML 把元素锚定在词上而不是秒上，改一句话时间轴会自动 reflow。
 * 普通 SRT 只有句级时间，喂过去就丢掉了这个能力。所以这里所有实现都必须产出 Word[]，
 * 只有 SRT 导入是例外（它本来就没有词级信息，会按字符数均摊，并在日志里说清楚）。
 */

export interface TranscribeResult {
  words: Word[];
  /** 数据怎么来的，写进项目文件，避免日后分不清是真词级还是均摊出来的 */
  method: string;
  /** 时间戳是否真的是词级。均摊出来的为 false，界面要弱化显示。 */
  wordLevel: boolean;
}

/** whisperx / faster-whisper --output_format json 的结构 */
interface WhisperJson {
  segments?: Array<{
    text?: string;
    start?: number;
    end?: number;
    words?: Array<{ word?: string; text?: string; start?: number; end?: number; score?: number; probability?: number; speaker?: string }>;
  }>;
  word_segments?: Array<{ word?: string; start?: number; end?: number; score?: number; speaker?: string }>;
}

/** 解析 whisperx / faster-whisper 的 JSON 输出。两者字段名略有出入，都兼容。 */
export function parseWhisperJson(raw: string): Word[] {
  let data: WhisperJson;
  try {
    data = JSON.parse(raw) as WhisperJson;
  } catch {
    throw new Error('转写结果不是合法 JSON');
  }

  const words: Word[] = [];
  const push = (text: unknown, start: unknown, end: unknown, conf: unknown, speaker: unknown) => {
    const t = typeof text === 'string' ? text : '';
    if (!t.trim()) return;
    if (typeof start !== 'number' || typeof end !== 'number') return;
    if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return;
    const w: Word = { text: t, start, end };
    if (typeof conf === 'number' && Number.isFinite(conf)) w.confidence = conf;
    if (typeof speaker === 'string' && speaker) w.speaker = speaker;
    words.push(w);
  };

  // whisperx 对齐后会给一个扁平的 word_segments，优先用它
  if (Array.isArray(data.word_segments) && data.word_segments.length > 0) {
    for (const w of data.word_segments) push(w.word, w.start, w.end, w.score, w.speaker);
    if (words.length > 0) return words.sort((a, b) => a.start - b.start);
  }

  for (const seg of data.segments ?? []) {
    for (const w of seg.words ?? []) {
      push(w.word ?? w.text, w.start, w.end, w.score ?? w.probability, w.speaker);
    }
  }
  return words.sort((a, b) => a.start - b.start);
}

const SRT_TIME = /(\d{2}):(\d{2}):(\d{2})[,.](\d{3})\s*-->\s*(\d{2}):(\d{2}):(\d{2})[,.](\d{3})/;

function srtTimeToSeconds(h: string, m: string, s: string, ms: string): number {
  return Number(h) * 3600 + Number(m) * 60 + Number(s) + Number(ms) / 1000;
}

/**
 * SRT 兜底导入。
 *
 * SRT 没有词级时间，这里按字符数把句子时长均摊到每个词上。这是**近似**，
 * 不是真实对齐——所以返回的 wordLevel 为 false，界面和导出都会标明，
 * 免得有人拿它当真词级去做卡点。中文按字切，英文按空格切。
 */
export function parseSrt(raw: string): Word[] {
  const words: Word[] = [];
  const blocks = raw.replace(/\r\n/g, '\n').split(/\n\s*\n/);

  for (const block of blocks) {
    const lines = block.split('\n').map((l) => l.trim()).filter(Boolean);
    if (lines.length < 2) continue;
    const timeLine = lines.find((l) => SRT_TIME.test(l));
    if (!timeLine) continue;
    const m = SRT_TIME.exec(timeLine);
    if (!m) continue;

    const start = srtTimeToSeconds(m[1] as string, m[2] as string, m[3] as string, m[4] as string);
    const end = srtTimeToSeconds(m[5] as string, m[6] as string, m[7] as string, m[8] as string);
    const textLines = lines.slice(lines.indexOf(timeLine) + 1);
    const text = textLines.join(' ').trim();
    if (!text || end <= start) continue;

    // 中文按字、英文按词切分；两者混排时也能正确分段
    const tokens = text.match(/[一-鿿㐀-䶿]|[A-Za-z0-9''-]+|[^\s]/g) ?? [];
    if (tokens.length === 0) continue;

    const totalChars = tokens.reduce((sum, t) => sum + t.length, 0);
    let cursor = start;
    for (const token of tokens) {
      const share = (end - start) * (token.length / totalChars);
      words.push({ text: token, start: cursor, end: cursor + share });
      cursor += share;
    }
  }
  return words.sort((a, b) => a.start - b.start);
}

export interface TranscribeOptions {
  /** 语言代码，如 zh / en。留空让模型自动判断。 */
  language?: string;
  timeoutMs?: number;
}

/**
 * 调用本机的 whisperx。
 * 选 whisperx 而不是原版 whisper，是因为它做强制对齐，词级时间戳精度高一个档次，
 * 而这正是喂给 hypit 所必需的。hypit 自己也用 WhisperX（provider-whisperx-local）。
 */
export async function transcribeWithWhisperX(
  audioPath: string,
  outputDir: string,
  opts: TranscribeOptions = {},
): Promise<TranscribeResult> {
  const args = [audioPath, '--output_format', 'json', '--output_dir', outputDir, '--model', process.env.SHOTPILOT_WHISPER_MODEL ?? 'medium'];
  if (opts.language) args.push('--language', opts.language);

  const res = await run('whisperx', args, { timeoutMs: opts.timeoutMs ?? 60 * 60_000 });
  if (res.code !== 0) {
    throw new Error(`whisperx 执行失败（退出码 ${res.code}）。未安装可用 pip install whisperx，或改用 SRT 导入。\n${res.stderr.trim().split('\n').slice(-5).join('\n')}`);
  }

  const base = audioPath.replace(/\.[^./\\]+$/, '').split(/[/\\]/).pop() ?? 'audio';
  const jsonPath = `${outputDir}/${base}.json`;
  const raw = await readFile(jsonPath, 'utf8');
  return { words: parseWhisperJson(raw), method: 'WhisperX 本地强制对齐', wordLevel: true };
}

/** 从视频里抽出 16k 单声道 wav，转写用。whisper 系模型都吃这个规格。 */
export async function extractAudioTrack(videoPath: string, outputPath: string): Promise<string> {
  const { FFMPEG } = await import('./ffmpeg.js');
  const res = await run(FFMPEG, [
    '-hide_banner', '-nostats', '-loglevel', 'error',
    '-i', videoPath, '-vn', '-ac', '1', '-ar', '16000',
    '-c:a', 'pcm_s16le', '-y', outputPath,
  ], { timeoutMs: 30 * 60_000 });
  if (res.code !== 0) throw new Error(`抽取音轨失败：${res.stderr.trim().split('\n').slice(-3).join('\n')}`);
  return outputPath;
}

/** 导入已有的字幕文件，支持 whisper JSON 和 SRT。 */
export async function importSubtitles(path: string): Promise<TranscribeResult> {
  const raw = await readFile(path, 'utf8');
  if (path.toLowerCase().endsWith('.json')) {
    return { words: parseWhisperJson(raw), method: `导入 ${path}`, wordLevel: true };
  }
  return {
    words: parseSrt(raw),
    method: `导入 SRT ${path}（句级时间按字符数均摊到词，非真实词级对齐）`,
    wordLevel: false,
  };
}
