import { useCallback, useEffect, useState } from 'react';
import { api, type Work } from '../api';
import { hud, useConfirm } from '../ui/overlay';

/** 作品列表和删除（删之前问一句）。模板页底部和作品页都用 */
export function useWorks() {
  const [works, setWorks] = useState<Work[] | null>(null);
  const confirm = useConfirm();
  const reload = useCallback(() => api.listWorks().then(setWorks).catch((e: Error) => { hud(e.message, 'error'); setWorks([]); }), []);
  useEffect(() => { void reload(); }, [reload]);
  const remove = async (w: Work) => {
    const ok = await confirm.ask({
      title: `删除「${w.name}」？`,
      message: '作品的参数会删掉。已经导出的视频还在「导出的视频」文件夹里，不会被删。',
      confirm: '删除',
      destructive: true,
    });
    if (!ok) return;
    try {
      await api.deleteWork(w.id);
      await reload();
    } catch (err) {
      hud(`删除失败：${err instanceof Error ? err.message : err}`, 'error');
    }
  };
  return { works, reload, remove, confirmElement: confirm.element };
}
