import { getRemotionEnvironment, staticFile } from 'remotion';

/**
 * 模板里的图片地址。
 *
 * 工作台里的图片都是站内地址（/template-assets/…、/files/assets/…），预览时浏览器直接能取；
 * 导出视频时服务端会把它们补成 http://127.0.0.1:端口/…，让渲染用的浏览器也能取到。
 * 只有在 Remotion Studio 里单独开模板时，才会用到 public/ 下的相对文件名。
 */
export function assetUrl(src: string): string {
  if (src.startsWith('/') || /^[a-z][a-z0-9+.-]*:/i.test(src)) return src;
  return staticFile(src);
}

/**
 * 模板自带、不让用户换的素材（字体、纸张纹理这些），放在 templates/public/ 下。
 * 预览时从工作台的 /template-assets/ 取；导出时从打包好的模板里取。
 */
export function bundledUrl(path: string): string {
  return getRemotionEnvironment().isPlayer ? `/template-assets/${path}` : staticFile(path);
}
