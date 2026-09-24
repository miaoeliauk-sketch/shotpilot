import React, { useEffect, useState } from 'react';
import { api, type PublicSettings } from '../api';
import { Button, FormRow, Spinner, useFieldId } from '../ui/controls';
import { Icon } from '../ui/icons';
import { PopupButton } from '../ui/menu';
import { Sheet, hud } from '../ui/overlay';

/**
 * 设置：看图 AI（素材打标、AI 初判用）和 Eagle。
 * Key 只存在这台 Mac 的「ShotPilot」文件夹里，界面上只显示最后 4 位。
 */

type Provider = 'qwen' | 'doubao' | 'openai' | 'custom';

const PROVIDERS: { value: Provider; label: string; baseUrl: string; model: string; modelHint: string }[] = [
  { value: 'qwen', label: '通义千问（阿里云百炼）', baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1', model: 'qwen-vl-max', modelHint: '看图的模型，比如 qwen-vl-max、qwen-vl-plus' },
  { value: 'doubao', label: '豆包（火山方舟）', baseUrl: 'https://ark.cn-beijing.volces.com/api/v3', model: '', modelHint: '填火山方舟控制台里能看图的模型名（或接入点 ID）' },
  { value: 'openai', label: 'OpenAI', baseUrl: 'https://api.openai.com/v1', model: 'gpt-4o-mini', modelHint: '比如 gpt-4o-mini、gpt-4o' },
  { value: 'custom', label: '其他（自己填地址）', baseUrl: '', model: '', modelHint: '需要支持看图、兼容 OpenAI 接口的模型' },
];

function providerOf(baseUrl: string): Provider {
  return PROVIDERS.find((p) => p.value !== 'custom' && p.baseUrl === baseUrl)?.value ?? (baseUrl ? 'custom' : 'qwen');
}

/** 别的地方（比如点「AI 打标」时发现还没设置）喊一声，就打开设置 */
export function openSettings(section?: 'vision' | 'eagle') {
  window.dispatchEvent(new CustomEvent('shotpilot:open-settings', { detail: section }));
}

export function SettingsSheet({ onClose, focus }: { onClose: (changed: boolean) => void; focus?: 'vision' | 'eagle' }) {
  const [current, setCurrent] = useState<PublicSettings | null>(null);
  const [provider, setProvider] = useState<Provider>('qwen');
  const [baseUrl, setBaseUrl] = useState('');
  const [model, setModel] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [token, setToken] = useState('');
  const [busy, setBusy] = useState<'vision' | 'eagle' | null>(null);
  const [visionMsg, setVisionMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [eagleMsg, setEagleMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [changed, setChanged] = useState(false);
  const ids = { url: useFieldId('url'), key: useFieldId('key'), model: useFieldId('model'), token: useFieldId('token') };

  useEffect(() => {
    api.getSettings().then((s) => {
      setCurrent(s);
      const p = providerOf(s.vision?.baseUrl ?? '');
      setProvider(p);
      const preset = PROVIDERS.find((x) => x.value === p);
      setBaseUrl(s.vision?.baseUrl || preset?.baseUrl || '');
      setModel(s.vision?.model || preset?.model || '');
    }).catch((e: Error) => hud(e.message, 'error'));
  }, []);

  const pickProvider = (p: Provider) => {
    setProvider(p);
    const preset = PROVIDERS.find((x) => x.value === p);
    if (preset && p !== 'custom') {
      setBaseUrl(preset.baseUrl);
      setModel(preset.model);
    }
  };

  const saveVision = async () => {
    setBusy('vision');
    setVisionMsg(null);
    try {
      const s = await api.saveSettings({ vision: { baseUrl, apiKey, model } });
      setCurrent(s);
      setApiKey('');
      setChanged(true);
      const r = await api.testVision();
      setVisionMsg({ ok: true, text: `连上了，用的是 ${r.model}` });
    } catch (err) {
      setVisionMsg({ ok: false, text: err instanceof Error ? err.message : String(err) });
    } finally {
      setBusy(null);
    }
  };

  const testEagle = async () => {
    setBusy('eagle');
    setEagleMsg(null);
    try {
      if (token.trim()) {
        setCurrent(await api.saveSettings({ eagle: { token: token.trim() } }));
        setToken('');
      }
      const r = await api.testEagle();
      setEagleMsg({ ok: true, text: `连上了 Eagle${r.version ? ` ${r.version}` : ''}` });
    } catch (err) {
      setEagleMsg({ ok: false, text: err instanceof Error ? err.message : String(err) });
    } finally {
      setBusy(null);
    }
  };

  const preset = PROVIDERS.find((p) => p.value === provider);

  return (
    <Sheet
      title="设置"
      width={540}
      busy={busy !== null}
      onCancel={() => onClose(changed)}
      actions={<Button variant="primary" onClick={() => onClose(changed)} disabled={busy !== null}>完成</Button>}
    >
      {!current ? <Spinner /> : (
        <>
          <section className="settings-section">
            <h3 className="settings-title"><Icon.sparkles size={15} />看图 AI</h3>
            <p className="sheet-text small-text">给 B-roll 自动打素材标签、AI 初判景别运镜都用它。按用量收费，每个镜头送 3 张小图，一般花不到一毛钱，费用从你自己的 AI 账号里扣。</p>
            <FormRow label="用哪家">
              <PopupButton label="用哪家" value={provider} options={PROVIDERS.map((p) => ({ value: p.value, label: p.label }))} onChange={(v) => v && pickProvider(v)} />
            </FormRow>
            {provider === 'custom' && (
              <FormRow label="接口地址" htmlFor={ids.url} hint="兼容 OpenAI 的地址，一般以 /v1 结尾">
                <input id={ids.url} className="field" value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} placeholder="https://…/v1" />
              </FormRow>
            )}
            <FormRow
              label="API Key"
              htmlFor={ids.key}
              hint={current.vision?.hasKey ? `已经保存过（${current.vision.keyHint}），不换就留空` : '在这家 AI 的控制台里创建，复制过来粘贴'}
            >
              <input id={ids.key} className="field" type="password" autoComplete="off" value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder={current.vision?.hasKey ? '留空表示不改' : 'sk-…'} />
            </FormRow>
            <FormRow label="模型名" htmlFor={ids.model} hint={preset?.modelHint}>
              <input id={ids.model} className="field" value={model} onChange={(e) => setModel(e.target.value)} />
            </FormRow>
            <div className="settings-actions">
              <Button onClick={() => void saveVision()} disabled={busy !== null || !baseUrl || !model || (!apiKey && !current.vision?.hasKey)}>
                {busy === 'vision' ? '正在测试…' : '保存并测试'}
              </Button>
              {visionMsg && <span className={`settings-msg ${visionMsg.ok ? 'ok' : 'bad'}`}>{visionMsg.ok ? <Icon.checkCircle size={13} /> : <Icon.warning size={13} />}{visionMsg.text}</span>}
            </div>
          </section>

          <section className={`settings-section${focus === 'eagle' ? ' focus' : ''}`}>
            <h3 className="settings-title"><Icon.folder size={15} />Eagle</h3>
            <p className="sheet-text small-text">放素材的时候 Eagle 要开着。一般不用填令牌；Eagle 提示要令牌时，在 Eagle 的设置里找到 API 令牌（Token）复制过来。</p>
            <FormRow label="API 令牌（可以不填）" htmlFor={ids.token} hint={current.eagle.hasToken ? '已经保存过，不换就留空' : undefined}>
              <input id={ids.token} className="field" type="password" autoComplete="off" value={token} onChange={(e) => setToken(e.target.value)} placeholder={current.eagle.hasToken ? '已保存' : '不需要就留空'} />
            </FormRow>
            <div className="settings-actions">
              <Button onClick={() => void testEagle()} disabled={busy !== null}>{busy === 'eagle' ? '正在连…' : '测试连接 Eagle'}</Button>
              {current.eagle.hasToken && (
                <Button variant="plain" disabled={busy !== null} onClick={() => void api.saveSettings({ eagle: { token: '' } }).then(setCurrent)}>清掉令牌</Button>
              )}
              {eagleMsg && <span className={`settings-msg ${eagleMsg.ok ? 'ok' : 'bad'}`}>{eagleMsg.ok ? <Icon.checkCircle size={13} /> : <Icon.warning size={13} />}{eagleMsg.text}</span>}
            </div>
          </section>
        </>
      )}
    </Sheet>
  );
}
