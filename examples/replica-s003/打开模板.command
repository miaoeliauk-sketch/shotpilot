#!/bin/bash
# 双击打开这个模板的预览和编辑页面（Remotion Studio）。不用敲命令。
#
# 浏览器里右侧「Props」面板就是所有旋钮：换图、改气泡文字、调时间和颜色，改完画面立刻更新。
# 用完直接关掉这个窗口即可。

cd "$(dirname "$0")" || { echo "找不到模板目录"; read -r -p "按回车关闭"; exit 1; }

# 双击启动时拿不到 .zshrc 里的 PATH，照搬登录 shell 的（和 ShotPilot.command 同一个做法）
USER_PATH="$("${SHELL:-/bin/zsh}" -ilc 'printf "__SP__%s" "$PATH"' 2>/dev/null | sed -n 's/.*__SP__//p' | tail -1)"
[ -n "$USER_PATH" ] && export PATH="$USER_PATH"
export PATH="$PATH:$HOME/.npm-global/bin:$HOME/Library/pnpm:/opt/homebrew/bin:/usr/local/bin"

echo ""
echo "  对话气泡模板 启动中…"
echo ""

if command -v pnpm >/dev/null 2>&1; then
  INSTALL="pnpm install --config.confirmModulesPurge=false"
  RUN="pnpm exec"
elif command -v npm >/dev/null 2>&1; then
  INSTALL="npm install --no-audit --no-fund"
  RUN="npx"
else
  echo "  没找到 Node.js。先按 ShotPilot 的「第一次安装」装好，再双击我。"
  read -r -p "  按回车关闭"
  exit 1
fi

# 依赖有变化才重装（平时跳过）
HASH_FILE="node_modules/.template-pkg-hash"
NEW_HASH="$(shasum package.json 2>/dev/null | cut -d' ' -f1)"
if [ ! -d node_modules ] || [ "$(cat "$HASH_FILE" 2>/dev/null)" != "$NEW_HASH" ]; then
  echo "  · 第一次打开，安装依赖（1–3 分钟）…"
  if $INSTALL >/tmp/template-install.log 2>&1; then
    echo "$NEW_HASH" > "$HASH_FILE"
  else
    echo "    安装失败。错误信息："
    tail -5 /tmp/template-install.log | sed 's/^/      /'
    read -r -p "  按回车关闭"
    exit 1
  fi
fi

echo "  · 浏览器会自动打开预览页面"
echo "  · 换图：把图片放进这个文件夹里的 public/，再在右侧 image 一栏填文件名"
echo "  · 用完直接关掉这个窗口即可"
echo ""
$RUN remotion studio src/index.ts
