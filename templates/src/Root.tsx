import React from 'react';
import { Composition } from 'remotion';
import { TEMPLATES } from './registry';

/** 导出视频用的打包入口：每个模板一个 Composition，时长跟着参数走 */
export const RemotionRoot: React.FC = () => (
  <>
    {TEMPLATES.map((t) => {
      const defaults = t.toProps(t.defaultParams);
      return (
        <Composition
          key={t.id}
          id={t.id}
          component={t.component}
          width={t.width}
          height={t.height}
          fps={t.fps}
          durationInFrames={defaults.durationInFrames}
          defaultProps={defaults}
          calculateMetadata={({ props }) => ({ durationInFrames: Number(props.durationInFrames) || defaults.durationInFrames })}
        />
      );
    })}
  </>
);
