#!/bin/bash
# 双击启动 ShotPilot 拉片工作台。不用敲任何命令。
#
# 它会：尝试更新（连不上 GitHub 就跳过）→ 依赖有变化才重装 → 关掉没关的旧服务
#       → 启动工作台 → 自动打开浏览器。用完直接关掉这个窗口即可。

# 找到项目目录。从桌面上的快捷方式启动时 $0 在桌面，退回默认位置
DIR="$(cd "$(dirname "$0")" && pwd)"
[ -f "$DIR/package.json" ] || DIR="$HOME/shotpilot"
cd "$DIR" || { echo "找不到 ShotPilot 目录：$DIR"; read -r -p "按回车关闭"; exit 1; }

# 双击启动时拿不到你在 .zshrc 里设置的 PATH（node、pnpm 装在哪都记在那里）。
# 让你的登录 shell 把它打印出来照搬过来，这样用的 node 和你在终端里用的是同一个。
# 加标记再截取，是因为有些 .zshrc 启动时会顺带打印别的东西
USER_PATH="$("${SHELL:-/bin/zsh}" -ilc 'printf "__SP__%s" "$PATH"' 2>/dev/null | sed -n 's/.*__SP__//p' | tail -1)"
[ -n "$USER_PATH" ] && export PATH="$USER_PATH"
# 常见安装位置作为兜底，加在最后，不抢在你自己的设置前面
export PATH="$PATH:$HOME/.npm-global/bin:$HOME/Library/pnpm:/opt/homebrew/bin:/usr/local/bin"

PORT="${SHOTPILOT_PORT:-5174}"
URL="http://127.0.0.1:$PORT"

echo ""
echo "  ShotPilot 拉片工作台 启动中…"
echo ""

if ! command -v pnpm >/dev/null 2>&1; then
  echo "  没找到 pnpm。在终端里运行一次 npm i -g pnpm，然后再双击我。"
  read -r -p "  按回车关闭"
  exit 1
fi

# 1. 桌面上放一个快捷方式，以后从桌面双击就行（只做一次）
if [ -d "$HOME/Desktop" ] && [ ! -e "$HOME/Desktop/ShotPilot.command" ]; then
  ln -s "$DIR/ShotPilot.command" "$HOME/Desktop/ShotPilot.command" 2>/dev/null \
    && echo "  · 已在桌面放了一个 ShotPilot 快捷方式"
fi

# 2. 尝试更新。最多等 10 秒（正常 1–3 秒就完成）；连不上 GitHub 就用现有版本，不影响使用
echo "  · 检查更新（最多 10 秒）…"
BEFORE="$(git rev-parse HEAD 2>/dev/null)"
git pull --ff-only --quiet >/tmp/shotpilot-update.log 2>&1 &
PULL_PID=$!
( sleep 10; kill "$PULL_PID" 2>/dev/null ) >/dev/null 2>&1 &
WATCHER=$!
if wait "$PULL_PID"; then
  if [ "$(git rev-parse HEAD 2>/dev/null)" != "$BEFORE" ]; then
    echo "    已更新到最新版本"
  else
    echo "    已经是最新版本"
  fi
else
  echo "    这次没连上 GitHub，先用现有版本"
fi
kill "$WATCHER" 2>/dev/null

# 3. 依赖有变化才重新安装（平时跳过，秒开）
HASH_FILE="node_modules/.shotpilot-lock-hash"
NEW_HASH="$(shasum pnpm-lock.yaml 2>/dev/null | cut -d' ' -f1)"
if [ ! -d node_modules ] || [ "$(cat "$HASH_FILE" 2>/dev/null)" != "$NEW_HASH" ]; then
  echo "  · 安装依赖（第一次或更新后需要，稍等）…"
  # 不加这个选项时 pnpm 可能要重建依赖目录并等人确认，而输出写在日志里用户看不到，窗口会像卡住一样
  if pnpm install --config.confirmModulesPurge=false >/tmp/shotpilot-install.log 2>&1; then
    echo "$NEW_HASH" > "$HASH_FILE"
  else
    echo "    依赖安装失败，先尝试用现有依赖启动。错误信息："
    tail -5 /tmp/shotpilot-install.log | sed 's/^/      /'
  fi
fi

# 4. 关掉之前没关的旧服务，免得端口被占
OLD="$(lsof -ti:"$PORT" 2>/dev/null)"
if [ -n "$OLD" ]; then
  echo "  · 关闭之前没关的工作台"
  kill $OLD 2>/dev/null
  sleep 1
fi

# 5. 服务起来后自动打开浏览器
(
  for _ in $(seq 1 60); do
    if curl -sf -o /dev/null "$URL/api/health"; then
      command -v open >/dev/null 2>&1 && open "$URL"
      exit 0
    fi
    sleep 0.5
  done
) &

echo "  · 工作台地址：$URL"
echo "  · 用完直接关掉这个窗口即可"
echo ""
pnpm dev
