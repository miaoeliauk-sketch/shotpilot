/** 文件名里去掉访达不允许或容易出问题的字符 */
export function safeFileName(name: string, fallback = '未命名作品'): string {
  const cleaned = name.replace(/[\\/:*?"<>|\n\r\t]/g, '_').trim().slice(0, 60);
  return cleaned || fallback;
}
