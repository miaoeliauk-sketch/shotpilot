import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import { loadSettings, publicSettings, saveSettings } from '../src/core/settings.js';

describe('设置', () => {
  beforeEach(async () => {
    process.env.SHOTPILOT_DATA = await mkdtemp(join(tmpdir(), 'sp-settings-'));
  });

  it('Key 留空表示不改：界面上不用回显已保存的 Key', async () => {
    await saveSettings({ vision: { baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1/', apiKey: 'sk-abcdef1234', model: 'qwen-vl-max' } });
    await saveSettings({ vision: { baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1', apiKey: '', model: 'qwen-vl-plus' } });
    const s = await loadSettings();
    expect(s.vision).toEqual({ baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1', apiKey: 'sk-abcdef1234', model: 'qwen-vl-plus' });
  });

  it('给界面看的版本不带 Key，只露最后 4 位', async () => {
    const pub = publicSettings(await saveSettings({ vision: { baseUrl: 'https://x/v1', apiKey: 'sk-abcdef1234', model: 'm' } }));
    expect(JSON.stringify(pub)).not.toContain('sk-abcdef1234');
    expect(pub.vision?.keyHint).toBe('…1234');
  });

  it('Eagle 令牌能填能清空', async () => {
    await saveSettings({ eagle: { token: 't0k' } });
    expect((await loadSettings()).eagle?.token).toBe('t0k');
    await saveSettings({ eagle: { token: '' } });
    expect((await loadSettings()).eagle?.token).toBeUndefined();
  });
});
