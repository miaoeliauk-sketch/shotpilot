#!/bin/bash
# 构建好的 ShotPilot.app 冒烟测试（在 Mac 上跑）：
#   自带组件齐全 → 服务能起 → 两个模板都能导出视频 → 拉片切分能跑 → yt-dlp 能用
# 双击打开窗口的测试在 gui-test.sh
# 用法：desktop/smoke-test.sh <ShotPilot.app> <放截图和日志的目录>
set -euo pipefail

APP="$1"
OUT="$2"
RES="$APP/Contents/Resources/app"
EXE="$APP/Contents/MacOS/ShotPilot"
WORK="$(mktemp -d)"
mkdir -p "$OUT" "$WORK/req"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

fail() { echo "✗ $1"; echo "---- 服务日志 ----"; cat "$WORK/server.log" 2>/dev/null || true; cp "$WORK/server.log" "$OUT/" 2>/dev/null || true; exit 1; }

echo "== 1. 自检"
"$EXE" --self-check || fail "自带组件不全"

echo "== 2. 用软件自带的 Node 起服务"
CHROME="$(find "$RES/chrome" -name chrome-headless-shell -type f | head -1)"
PORT=5190
SHOTPILOT_PORT=$PORT SHOTPILOT_DATA="$WORK/data" \
  SHOTPILOT_FFMPEG="$RES/bin/ffmpeg" SHOTPILOT_FFPROBE="$RES/bin/ffprobe" SHOTPILOT_YTDLP="$RES/bin/yt-dlp" \
  SHOTPILOT_BROWSER="$CHROME" SHOTPILOT_REMOTION_BUNDLE="$RES/dist/remotion-bundle" \
  ELECTRON_RUN_AS_NODE=1 "$EXE" "$RES/dist/server/index.mjs" > "$WORK/server.log" 2>&1 &
SERVER_PID=$!
trap 'kill $SERVER_PID 2>/dev/null || true' EXIT
for _ in $(seq 1 60); do curl -sf "http://127.0.0.1:$PORT/api/health" >/dev/null && break; sleep 1; done
HEALTH="$(curl -sf "http://127.0.0.1:$PORT/api/health")" || fail "服务没起来"
echo "   $HEALTH"
echo "$HEALTH" | grep -q '"ok":true' || fail "ffmpeg 工具链不可用"

echo "== 3. 两个模板各导出 1 秒"
(cd "$ROOT" && pnpm exec tsx desktop/smoke-requests.ts "$WORK/req")
for req in "$WORK/req/"*.json; do
  name="$(basename "$req" .json)"
  started=$(date +%s)
  curl -sN -X POST -H 'content-type: application/json' --data @"$req" "http://127.0.0.1:$PORT/api/render" > "$WORK/$name.sse"
  grep -q '^event: done' "$WORK/$name.sse" || { cat "$WORK/$name.sse"; fail "$name 导出失败"; }
  file="$(grep -A1 '^event: done' "$WORK/$name.sse" | sed -n 's/^data: //p' | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>console.log(JSON.parse(s).file))')"
  dur="$("$RES/bin/ffprobe" -v error -show_entries format=duration -of csv=p=0 "$file")"
  echo "   ${name}：${dur} 秒，用时 $(( $(date +%s) - started )) 秒"
  "$RES/bin/ffmpeg" -v error -y -ss 0.5 -i "$file" -frames:v 1 "$OUT/render-$name.png"
done

echo "== 4. 拉片：生成一段中途换画面的测试视频，走一遍自动切分"
"$RES/bin/ffmpeg" -v error -y -f lavfi -i "testsrc=duration=2:size=640x360:rate=30" \
  -f lavfi -i "color=c=red:duration=2:size=640x360:rate=30" \
  -filter_complex "[0:v][1:v]concat=n=2:v=1[v]" -map "[v]" -pix_fmt yuv420p "$WORK/test.mp4"
curl -sN -X POST -H 'content-type: application/json' -d "{\"path\":\"$WORK/test.mp4\"}" "http://127.0.0.1:$PORT/api/projects" > "$WORK/analyze.sse"
grep -q '^event: done' "$WORK/analyze.sse" || { cat "$WORK/analyze.sse"; fail "拉片切分失败"; }
echo "   切分完成"

echo "== 5. yt-dlp"
"$RES/bin/yt-dlp" --version || fail "yt-dlp 不能运行"

kill $SERVER_PID 2>/dev/null || true
trap - EXIT
cp "$WORK/server.log" "$OUT/server-smoke.log"

echo "✓ 冒烟测试全部通过"
