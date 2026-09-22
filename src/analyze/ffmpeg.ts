import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';

const require_ = createRequire(import.meta.url);

/**
 * 解析 ffmpeg/ffprobe 可执行文件。
 *
 * 优先用 npm 自带的静态二进制，这样用户不必预装 ffmpeg —— 拉片工具的目标用户是
 * 做内容的人，不该被"先去配环境"劝退。装不上时回落到系统 PATH，
 * 再不行就抛出可读的错误而不是让 spawn 报 ENOENT。
 */
function resolveBinary(pkg: string, envVar: string, fallback: string): string {
  const fromEnv = process.env[envVar];
  if (fromEnv) return fromEnv;
  try {
    const mod = require_(pkg);
    const p: unknown = typeof mod === 'string' ? mod : mod?.path ?? mod?.default;
    // 光解析出路径不够：ffmpeg-static 的 postinstall 在代理或离线环境下会静默失败，
    // 包目录在、二进制不在。必须确认文件真的存在，否则回落系统 PATH。
    if (typeof p === 'string' && p.length > 0 && existsSync(p)) return p;
  } catch {
    // 静态包没装，回落系统 PATH
  }
  return fallback;
}

export const FFMPEG = resolveBinary('ffmpeg-static', 'SHOTPILOT_FFMPEG', 'ffmpeg');
export const FFPROBE = resolveBinary('ffprobe-static', 'SHOTPILOT_FFPROBE', 'ffprobe');

export interface RunResult {
  stdout: string;
  stderr: string;
  code: number;
}

/**
 * 跑一个子进程并收集输出。
 * ffmpeg 的分析信息大多写在 stderr，所以两路都要留着，不能只看 stdout。
 */
export function run(bin: string, args: string[], opts: { timeoutMs?: number } = {}): Promise<RunResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(bin, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    let settled = false;

    const timer = opts.timeoutMs
      ? setTimeout(() => {
          if (settled) return;
          settled = true;
          child.kill('SIGKILL');
          reject(new Error(`${bin} 超时（${opts.timeoutMs}ms）：${args.slice(0, 6).join(' ')}`));
        }, opts.timeoutMs)
      : undefined;

    child.stdout.on('data', (d) => { stdout += d.toString(); });
    child.stderr.on('data', (d) => { stderr += d.toString(); });

    child.on('error', (err) => {
      if (settled) return;
      settled = true;
      if (timer) clearTimeout(timer);
      const hint =
        (err as NodeJS.ErrnoException).code === 'ENOENT'
          ? `找不到 ${bin}。请 pnpm install 安装 ffmpeg-static，或设置环境变量 SHOTPILOT_FFMPEG / SHOTPILOT_FFPROBE 指向已有的二进制。`
          : err.message;
      reject(new Error(hint));
    });

    child.on('close', (code) => {
      if (settled) return;
      settled = true;
      if (timer) clearTimeout(timer);
      resolve({ stdout, stderr, code: code ?? -1 });
    });
  });
}

/** 跑 ffmpeg 并在非零退出时抛错，错误里带上 stderr 尾部，方便定位。 */
export async function runOrThrow(bin: string, args: string[], opts?: { timeoutMs?: number }): Promise<RunResult> {
  const res = await run(bin, args, opts ?? {});
  if (res.code !== 0) {
    const tail = res.stderr.trim().split('\n').slice(-8).join('\n');
    throw new Error(`${bin} 退出码 ${res.code}\n${tail}`);
  }
  return res;
}

/** 环境自检，启动时跑一次，把问题提前暴露给用户而不是等到点了"分析"才炸。 */
export async function checkToolchain(): Promise<{ ok: boolean; ffmpeg: string; ffprobe: string; message: string }> {
  const probe = async (bin: string) => {
    try {
      const r = await run(bin, ['-version'], { timeoutMs: 10_000 });
      return r.code === 0 ? (r.stdout.split('\n')[0] ?? 'ok') : '';
    } catch {
      return '';
    }
  };
  const [v1, v2] = await Promise.all([probe(FFMPEG), probe(FFPROBE)]);
  const ok = Boolean(v1 && v2);
  return {
    ok,
    ffmpeg: v1,
    ffprobe: v2,
    message: ok ? 'ffmpeg 工具链就绪' : 'ffmpeg 或 ffprobe 不可用，请运行 pnpm install（会装 ffmpeg-static）',
  };
}
