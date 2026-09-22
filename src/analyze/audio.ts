import { spawn } from 'node:child_process';
import { FFMPEG } from './ffmpeg.js';
import type { AudioAnalysis, AudioSegment, Word } from '../core/types.js';

/** 包络采样率：每秒 100 个点。足够定位起音，又不至于让自相关算到天荒地老。 */
const ENVELOPE_HZ = 100;
/** 解码用的 PCM 采样率。能量包络不需要高保真，8k 足够且快。 */
const PCM_HZ = 8000;

/**
 * 把音轨解成单声道 PCM，在 Node 里算 RMS 能量包络。
 *
 * 走 PCM 而不是 ffmpeg 的 silencedetect，是因为后者只给"静音区间"，
 * 而我们还需要连续的能量曲线来做起音检测和 BPM 估算，一次解码全拿到。
 */
export function extractEnvelope(videoPath: string, timeoutMs = 10 * 60_000): Promise<Float32Array> {
  return new Promise((resolve, reject) => {
    const samplesPerFrame = Math.round(PCM_HZ / ENVELOPE_HZ);
    const child = spawn(FFMPEG, [
      '-hide_banner', '-nostats', '-loglevel', 'error',
      '-i', videoPath,
      '-vn', '-ac', '1', '-ar', String(PCM_HZ),
      '-f', 's16le', '-',
    ], { stdio: ['ignore', 'pipe', 'pipe'] });

    const envelope: number[] = [];
    let carry: Buffer<ArrayBufferLike> = Buffer.alloc(0);
    let sumSquares = 0;
    let countInFrame = 0;
    let stderr = '';
    let settled = false;

    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      child.kill('SIGKILL');
      reject(new Error(`音频解码超时（${timeoutMs}ms）`));
    }, timeoutMs);

    child.stderr.on('data', (d) => { stderr += d.toString(); });

    child.stdout.on('data', (chunk: Buffer) => {
      const buf = carry.length > 0 ? Buffer.concat([carry, chunk]) : chunk;
      const usable = buf.length - (buf.length % 2);
      for (let i = 0; i < usable; i += 2) {
        const sample = buf.readInt16LE(i) / 32768;
        sumSquares += sample * sample;
        countInFrame++;
        if (countInFrame === samplesPerFrame) {
          envelope.push(Math.sqrt(sumSquares / samplesPerFrame));
          sumSquares = 0;
          countInFrame = 0;
        }
      }
      carry = usable < buf.length ? buf.subarray(usable) : Buffer.alloc(0);
    });

    child.on('error', (err) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(err);
    });

    child.on('close', (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (code !== 0) {
        reject(new Error(`音频解码失败（退出码 ${code}）\n${stderr.trim().split('\n').slice(-4).join('\n')}`));
        return;
      }
      if (countInFrame > 0) envelope.push(Math.sqrt(sumSquares / countInFrame));
      resolve(Float32Array.from(envelope));
    });
  });
}

/** 线性幅度 → dBFS。零值钳到 -100，避免 log(0) 得到 -Infinity 污染后续计算。 */
export function toDb(amplitude: number): number {
  return amplitude <= 1e-5 ? -100 : 20 * Math.log10(amplitude);
}

/**
 * 起音检测：对能量包络求正向差分，超过动态阈值的点算一次起音。
 * 这是最朴素的 onset detection，对鼓点清晰的流行/电子 BGM 够用，
 * 对氛围音乐会漏——所以 bpm 可能返回 null，界面要能接受"没测出来"。
 */
export function detectOnsets(envelope: Float32Array): number[] {
  if (envelope.length < ENVELOPE_HZ) return [];

  const flux = new Float32Array(envelope.length);
  for (let i = 1; i < envelope.length; i++) {
    const diff = (envelope[i] as number) - (envelope[i - 1] as number);
    flux[i] = diff > 0 ? diff : 0;
  }

  // 动态阈值：局部均值 + 1.5 倍局部标准差，窗口 1 秒
  const win = ENVELOPE_HZ;
  const onsets: number[] = [];
  let lastOnsetFrame = -Infinity;

  for (let i = 1; i < flux.length; i++) {
    const lo = Math.max(0, i - win);
    const hi = Math.min(flux.length, i + win);
    let sum = 0;
    for (let j = lo; j < hi; j++) sum += flux[j] as number;
    const mean = sum / (hi - lo);
    let varSum = 0;
    for (let j = lo; j < hi; j++) {
      const d = (flux[j] as number) - mean;
      varSum += d * d;
    }
    const sd = Math.sqrt(varSum / (hi - lo));
    const threshold = mean + 1.5 * sd;

    // 至少间隔 100ms，否则一个鼓点会被算成好几次
    if ((flux[i] as number) > threshold && (flux[i] as number) > 0.005 && i - lastOnsetFrame >= ENVELOPE_HZ / 10) {
      onsets.push(i / ENVELOPE_HZ);
      lastOnsetFrame = i;
    }
  }
  return onsets;
}

/**
 * 从起音间隔估 BPM。
 * 对间隔做直方图投票而不是取平均——平均会被漏检和误检拉偏，众数稳得多。
 */
export function estimateBpm(onsets: number[]): number | null {
  if (onsets.length < 8) return null;

  const votes = new Map<number, number>();
  for (let i = 1; i < onsets.length; i++) {
    const interval = (onsets[i] as number) - (onsets[i - 1] as number);
    if (interval <= 0) continue;
    let bpm = 60 / interval;
    // 折叠到 60–180 的常见区间：半拍、双拍都算同一个速度
    while (bpm > 180) bpm /= 2;
    while (bpm < 60) bpm *= 2;
    if (!Number.isFinite(bpm)) continue;
    const bucket = Math.round(bpm);
    votes.set(bucket, (votes.get(bucket) ?? 0) + 1);
  }

  let bestBpm: number | null = null;
  let bestVotes = 0;
  // 容忍 ±2 BPM 的抖动，把邻桶票数合并再比
  for (const [bpm] of votes) {
    let total = 0;
    for (let d = -2; d <= 2; d++) total += votes.get(bpm + d) ?? 0;
    if (total > bestVotes) {
      bestVotes = total;
      bestBpm = bpm;
    }
  }
  // 票数太少说明节奏不规律，宁可返回 null 也不给一个假数字
  return bestVotes >= 6 ? bestBpm : null;
}

/**
 * 切音频段落。
 *
 * 人声与音乐的区分不靠频谱分类器，而是拿 ASR 的词级时间戳做判据：
 * 有词 = 人声；有声但没词 = 音乐或音效。这比自己写一个半吊子的
 * speech/music 分类器准得多，而且解释性强——用户能明白为什么这样标。
 * 代价是没跑转写时只能给出"有声/静音"两档，函数会如实反映这一点。
 */
export function segmentAudio(envelope: Float32Array, words: Word[], duration: number): AudioSegment[] {
  if (envelope.length === 0) return [];

  // 静音门限：用全片能量中位数往下压 18dB，比固定门限更能适应不同片子的整体响度
  const sorted = Float32Array.from(envelope).sort();
  const median = sorted[Math.floor(sorted.length / 2)] as number;
  const gate = Math.max(median * 0.12, 0.002);

  const frameHasSpeech = new Uint8Array(envelope.length);
  for (const w of words) {
    const from = Math.max(0, Math.floor(w.start * ENVELOPE_HZ));
    const to = Math.min(envelope.length, Math.ceil(w.end * ENVELOPE_HZ));
    for (let i = from; i < to; i++) frameHasSpeech[i] = 1;
  }

  const hasWords = words.length > 0;
  const kindAt = (i: number): AudioSegment['kind'] => {
    const audible = (envelope[i] as number) > gate;
    if (!audible) return 'silence';
    if (!hasWords) return 'music';           // 没转写就只能说"有声"，归到 music 档并在 method 里说明
    return frameHasSpeech[i] ? 'speech-music' : 'music';
  };

  const segments: AudioSegment[] = [];
  let currentKind = kindAt(0);
  let startFrame = 0;
  let energySum = 0;

  const flush = (endFrame: number) => {
    const start = startFrame / ENVELOPE_HZ;
    const end = Math.min(duration, endFrame / ENVELOPE_HZ);
    if (end - start < 0.25) return;          // 丢掉 250ms 以下的碎段，全是抖动
    const frames = Math.max(1, endFrame - startFrame);
    segments.push({ start, end, kind: currentKind, loudness: Math.round(toDb(energySum / frames) * 10) / 10 });
  };

  for (let i = 0; i < envelope.length; i++) {
    const kind = kindAt(i);
    if (kind !== currentKind) {
      flush(i);
      currentKind = kind;
      startFrame = i;
      energySum = 0;
    }
    energySum += envelope[i] as number;
  }
  flush(envelope.length);

  return segments;
}

export async function analyzeAudio(
  videoPath: string,
  words: Word[],
  duration: number,
): Promise<AudioAnalysis> {
  const envelope = await extractEnvelope(videoPath);
  const onsets = detectOnsets(envelope);
  const bpm = estimateBpm(onsets);
  const segments = segmentAudio(envelope, words, duration);

  return {
    segments,
    beats: onsets,
    bpm,
    method: words.length > 0
      ? 'RMS 包络 + 词级时间戳判定人声（本地 ffmpeg，无外部服务）'
      : 'RMS 包络（未做转写，无法区分人声与音乐，有声段一律标为音乐）',
  };
}
