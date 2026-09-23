import { Composition } from 'remotion';
import { AvatarCard, avatarCardDefaults } from './AvatarCard';

export const RemotionRoot: React.FC = () => (
  <Composition
    id="AvatarCard"
    component={AvatarCard}
    width={1280}
    height={720}
    fps={30}
    // 原片这一段是 2.17 秒 = 65 帧；导出的片段多截到了下一个镜头的第一帧，不算在内
    durationInFrames={65}
    defaultProps={avatarCardDefaults}
  />
);
