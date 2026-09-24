import React, { useMemo } from 'react';
import { Thumbnail } from '@remotion/player';
import { getTemplate } from '../../../templates/src/registry';
import { api, fmtWhen, type Work } from '../api';
import { Icon } from '../ui/icons';
import { MenuButton } from '../ui/menu';
import { hud } from '../ui/overlay';

/** 作品卡片：封面是用这个作品自己的参数渲染出来的一帧，一眼认出是哪条 */
export function WorkCard({ work, onOpen, onDelete, compact }: { work: Work; onOpen: () => void; onDelete: () => void; compact?: boolean }) {
  const template = getTemplate(work.templateId);
  const props = useMemo(() => {
    if (!template) return null;
    try {
      return template.toProps({ ...template.defaultParams, ...work.params });
    } catch {
      return null;
    }
  }, [template, work.params]);

  return (
    <div className={`card work-card${compact ? ' compact' : ''}`}>
      <button type="button" className="card-hit" onClick={onOpen} aria-label={`打开「${work.name}」`}>
        <div className="card-media">
          {template && props ? (
            <Thumbnail
              component={template.component}
              inputProps={props}
              durationInFrames={props.durationInFrames}
              compositionWidth={template.width}
              compositionHeight={template.height}
              fps={template.fps}
              frameToDisplay={Math.min(template.posterFrame, props.durationInFrames - 1)}
              style={{ width: '100%', height: '100%' }}
            />
          ) : (
            <div className="card-placeholder"><Icon.works size={28} /></div>
          )}
          {work.lastRender && <span className="badge done">已导出</span>}
        </div>
        <div className="card-text">
          <span className="card-title">{work.name}</span>
          <span className="card-sub">{template?.name ?? '模板已经不在了'} · {fmtWhen(work.updatedAt)}</span>
        </div>
      </button>
      <MenuButton
        className="card-more icon-btn small"
        label="更多操作"
        align="end"
        items={[
          ...(work.lastRender ? [{ label: '在访达里找到导出的视频', onSelect: () => void api.reveal(work.lastRender).catch((e: Error) => hud(e.message, 'error')) }] : []),
          { label: '删除…', onSelect: onDelete },
        ]}
      >
        <Icon.ellipsis size={16} />
      </MenuButton>
    </div>
  );
}
