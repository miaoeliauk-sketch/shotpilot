#!/bin/bash
# 像用户一样双击打开 ShotPilot.app，确认窗口背后的服务起来了，并截图。
# CI 的 Mac 上没人点「允许访问文稿文件夹」，这一步可能因系统权限失败，所以单独跑、失败只记警告。
# 用法：desktop/gui-test.sh <ShotPilot.app> <放截图和日志的目录>
set -uo pipefail
APP="$1"
OUT="$2"
mkdir -p "$OUT"
open "$APP"
ok=0
for _ in $(seq 1 60); do curl -sf "http://127.0.0.1:5174/api/health" >/dev/null && { ok=1; break; }; sleep 1; done
sleep 6
screencapture -x "$OUT/screenshot.png" || echo "（截图失败）"
osascript -e 'quit app "ShotPilot"' || true
cp "$HOME/Library/Logs/ShotPilot/server.log" "$OUT/server-app.log" 2>/dev/null || true
if [ $ok = 1 ]; then echo "✓ 双击打开后服务正常"; else echo "✗ 双击打开后服务没起来"; exit 1; fi
