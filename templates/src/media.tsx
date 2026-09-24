import React from 'react';
import { Img, Loop, OffthreadVideo, useVideoConfig } from 'remotion';
import { assetUrl } from './asset';

/**
 * 模板里「图片或视频」的槽位。
 *
 * 上传的视频地址后面带着时长（…mp4#dur=4.93，见 src/core/works.ts 的 saveAsset），
 * 这里按时长循环播放；视频一律静音——模板只管画面。
 * 导出用 OffthreadVideo（ffmpeg 逐帧取画面，不依赖浏览器能不能解这种编码），预览时它自己会换成普通的 video。
 */

export type MediaInfo = { url: string; video: boolean; seconds: number | null };

export function parseMedia(src: string): MediaInfo {
  const [url = '', hash = ''] = src.split('#');
  const video = /\.(mp4|mov|m4v|webm)(\?|$)/i.test(url);
  const dur = /(?:^|&)dur=([\d.]+)/.exec(hash)?.[1];
  const seconds = dur && Number(dur) > 0 ? Number(dur) : null;
  return { url, video, seconds };
}

export const Media: React.FC<{ src: string; style?: React.CSSProperties }> = ({ src, style }) => {
  const { fps } = useVideoConfig();
  const m = parseMedia(src);
  const fill: React.CSSProperties = { objectFit: 'cover', ...style };
  if (!m.video) return <Img src={assetUrl(m.url)} style={fill} />;
  const player = <OffthreadVideo src={assetUrl(m.url)} muted style={fill} />;
  if (!m.seconds) return player;
  return (
    <Loop durationInFrames={Math.max(1, Math.floor(m.seconds * fps))} layout="none">
      {player}
    </Loop>
  );
};
