import React, { useRef, useState } from 'react';
import { api, streamPost } from '../api';
import { Button, Disclosure, FormRow, NumberInput, Progress, useFieldId } from '../ui/controls';
import { Icon } from '../ui/icons';
import { Sheet } from '../ui/overlay';

/**
 * 新建拉片：粘贴链接，或者选 / 拖一个视频文件进来。
 * 分析要一两分钟，面板不关，一直显示进行到哪一步，完成后直接打开项目。
 */

const STAGES: Record<string, string> = {
  upload: '把视频放进 ShotPilot',
  download: '下载视频',
  probe: '读取视频信息',
  cuts: '检测分镜切点',
  thumbnails: '抽取镜头缩略图',
  done: '完成',
};

export const VIDEO_TYPES = /\.(mp4|mov|m4v|webm|mkv)$/i;

function sizeText(bytes: number) {
  return bytes > 1024 * 1024 * 1024 ? `${(bytes / 1024 / 1024 / 1024).toFixed(1)} GB` : `${Math.max(1, Math.round(bytes / 1024 / 1024))} MB`;
}

export function NewProjectSheet({ initialFile, onCancel, onDone }: { initialFile?: File; onCancel: () => void; onDone: (projectId: string) => void }) {
  const [link, setLink] = useState('');
  const [file, setFile] = useState<File | null>(initialFile ?? null);
  const [threshold, setThreshold] = useState(0.3);
  const [minDur, setMinDur] = useState(0.4);
  const [phase, setPhase] = useState<'form' | 'running' | 'failed'>('form');
  const [stage, setStage] = useState('');
  const [log, setLog] = useState<string[]>([]);
  const [error, setError] = useState('');
  const picker = useRef<HTMLInputElement>(null);
  const linkId = useFieldId('link');

  const pick = (f: File | undefined) => {
    if (!f) return;
    if (!VIDEO_TYPES.test(f.name)) { setError('只能用视频文件（mp4、mov、m4v、webm、mkv）'); return; }
    setError('');
    setFile(f);
    setLink('');
  };

  const start = async () => {
    setPhase('running');
    setError('');
    setLog([]);
    const append = (line: string) => setLog((prev) => [...prev.slice(-40), line]);
    try {
      let path = link.trim();
      if (file) {
        setStage(STAGES.upload ?? '');
        append(`${file.name}（${sizeText(file.size)}）`);
        path = (await api.uploadVideo(file)).path;
      }
      let failed = '';
      await streamPost('/api/projects', { path, threshold, minShotDuration: minDur }, {
        progress: (d: { stage: string; detail?: string }) => {
          setStage(STAGES[d.stage] ?? d.stage);
          if (d.detail) append(d.detail);
        },
        done: (d: { id: string }) => onDone(d.id),
        failed: (d: { message: string }) => { failed = d.message; },
      });
      if (failed) throw new Error(failed);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setPhase('failed');
    }
  };

  const canStart = !!file || link.trim().length > 0;
  const running = phase === 'running';

  return (
    <Sheet
      title="新建拉片"
      width={520}
      busy={running}
      onCancel={onCancel}
      actions={(
        <>
          <Button onClick={onCancel} disabled={running}>取消</Button>
          <Button variant="primary" disabled={!canStart || running} onClick={() => void start()}>
            {running ? '正在分析…' : phase === 'failed' ? '再试一次' : '开始拉片'}
          </Button>
        </>
      )}
    >
      {running ? (
        <div className="analyze-status">
          <div className="analyze-stage">{stage || '准备中'}…</div>
          <Progress value={null} />
          <div className="analyze-log">{log.slice(-6).map((l, i) => <div key={i}>{l}</div>)}</div>
          <div className="form-hint">一般一两分钟。可以先去别的页面，但别关掉软件</div>
        </div>
      ) : (
        <div
          className="new-project"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => { e.preventDefault(); pick(e.dataTransfer.files[0]); }}
        >
          {file ? (
            <div className="file-chip">
              <Icon.film size={18} />
              <div className="file-chip-text">
                <div className="file-chip-name">{file.name}</div>
                <div className="form-hint">{sizeText(file.size)}</div>
              </div>
              <Button variant="plain" onClick={() => setFile(null)}>换一个</Button>
            </div>
          ) : (
            <>
              <FormRow label="视频链接" htmlFor={linkId} hint="抖音、B 站都行，整段分享文案直接粘贴进来也可以">
                <input
                  id={linkId}
                  className="field"
                  value={link}
                  placeholder="粘贴链接"
                  onChange={(e) => setLink(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && canStart) void start(); }}
                />
              </FormRow>
              <div className="or-line"><span>或者</span></div>
              <div className="drop-zone">
                <Icon.film size={28} />
                <div>把视频文件拖到这里</div>
                <Button onClick={() => picker.current?.click()}>选择视频文件…</Button>
                <input ref={picker} type="file" accept="video/*,.mkv" hidden onChange={(e) => pick(e.target.files?.[0])} />
              </div>
            </>
          )}
          <Disclosure title="切分设置" summary={`灵敏度 ${threshold} · 最短 ${minDur} 秒`} storageKey="new-project-advanced">
            <div className="half-grid">
              <FormRow label="切分灵敏度" hint="越小切得越碎。录屏、图文类视频调到 0.1 左右">
                <NumberInput label="切分灵敏度" value={threshold} min={0.05} max={0.95} step={0.05} onChange={setThreshold} />
              </FormRow>
              <FormRow label="最短镜头" hint="比这更短的不单独算一个镜头">
                <NumberInput label="最短镜头" value={minDur} min={0.1} max={5} step={0.1} unit="秒" onChange={setMinDur} />
              </FormRow>
            </div>
          </Disclosure>
          {error && <div className="form-error" role="alert">{error}</div>}
        </div>
      )}
    </Sheet>
  );
}
