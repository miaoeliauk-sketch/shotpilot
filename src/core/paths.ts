import { join, resolve } from 'node:path';

/**
 * 用户数据放在哪。
 *
 * 开发时在项目目录下（projects/、downloads/…，都在 .gitignore 里）。
 * Mac 软件里设了 SHOTPILOT_DATA（「文稿/ShotPilot」），子文件夹用中文名，
 * 用户在访达里一眼能看懂哪个是哪个。单项仍可用各自的环境变量改到别处（比如外置硬盘）。
 */

type Kind = 'projects' | 'downloads' | 'replicaOut' | 'works' | 'assets' | 'renders';

const DEV_NAMES: Record<Kind, string> = {
  projects: 'projects',
  downloads: 'downloads',
  replicaOut: 'replica-out',
  works: 'works',
  assets: 'assets',
  renders: 'renders',
};

const APP_NAMES: Record<Kind, string> = {
  projects: '拉片项目',
  downloads: '下载的视频',
  replicaOut: '复刻包',
  works: '我的作品',
  assets: '素材',
  renders: '导出的视频',
};

const OVERRIDES: Partial<Record<Kind, string>> = {
  projects: 'SHOTPILOT_PROJECTS',
  downloads: 'SHOTPILOT_DOWNLOADS',
  replicaOut: 'SHOTPILOT_REPLICA_OUT',
};

export function dataDir(kind: Kind): string {
  const envVar = OVERRIDES[kind];
  const override = envVar ? process.env[envVar] : undefined;
  if (override) return resolve(override);
  const appRoot = process.env.SHOTPILOT_DATA;
  return appRoot ? resolve(appRoot, APP_NAMES[kind]) : resolve(join(process.cwd(), DEV_NAMES[kind]));
}
