#!/bin/bash
# 在 Mac 上把软件需要的所有东西放进 app-stage/，之后由 @electron/packager 打成 ShotPilot.app。
# 先跑过 pnpm build（界面、模板、服务都打包好了）。只在 macOS（Apple 芯片）上跑。
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
STAGE="$ROOT/app-stage"
VERSION="$(node -p "require('$ROOT/package.json').version")"
REMOTION_VERSION="$(node -p "require('$ROOT/node_modules/@remotion/renderer/package.json').version")"

echo "== 准备 app-stage（版本 ${VERSION}，Remotion ${REMOTION_VERSION}）"
rm -rf "$STAGE"
mkdir -p "$STAGE/bin" "$STAGE/dist" "$STAGE/templates" "$STAGE/desktop"
cp -R "$ROOT/dist/server" "$ROOT/dist/remotion-bundle" "$STAGE/dist/"
cp -R "$ROOT/web" "$STAGE/web"
rm -rf "$STAGE/web/src"                      # 界面源码已经打包进 web/js/studio.js
cp -R "$ROOT/templates/public" "$STAGE/templates/public"
cp "$ROOT/desktop/main.mjs" "$STAGE/desktop/"

cat > "$STAGE/package.json" <<EOF
{
  "name": "shotpilot",
  "productName": "ShotPilot",
  "version": "$VERSION",
  "private": true,
  "type": "module",
  "main": "desktop/main.mjs",
  "dependencies": {
    "@remotion/renderer": "$REMOTION_VERSION"
  }
}
EOF

echo "== 安装运行时依赖（渲染器 + 它的 Apple 芯片二进制）"
(cd "$STAGE" && npm install --omit=dev --no-audit --no-fund)

echo "== 下载渲染用的浏览器（chrome-headless-shell）"
(cd "$STAGE" && node --input-type=module -e "const r = await import('@remotion/renderer'); await r.ensureBrowser(); console.log('浏览器就绪')")
# Remotion 下载到隐藏目录 node_modules/.remotion，打包工具会漏掉隐藏目录，挪到普通目录 chrome/
CHROME_DIR="$(dirname "$(find "$STAGE/node_modules/.remotion" -name chrome-headless-shell -type f | head -1)")"
[ -n "$CHROME_DIR" ] && [ -d "$CHROME_DIR" ] || { echo "没找到下载好的 chrome-headless-shell"; exit 1; }
mv "$CHROME_DIR" "$STAGE/chrome"
rm -rf "$STAGE/node_modules/.remotion"
ls "$STAGE/chrome" | sed 's/^/   /'

echo "== ffmpeg / ffprobe（Apple 芯片版）"
# ffprobe-static 的 macOS 版其实是 Intel 的，装了 Rosetta 才能跑；换成真正的 arm64 版
TMP="$(mktemp -d)"
(cd "$TMP" && npm init -y >/dev/null && npm install --no-audit --no-fund ffmpeg-static@5 @ffprobe-installer/darwin-arm64@5 >/dev/null)
cp "$(cd "$TMP" && node -p "require('ffmpeg-static')")" "$STAGE/bin/ffmpeg"
cp "$TMP/node_modules/@ffprobe-installer/darwin-arm64/ffprobe" "$STAGE/bin/ffprobe"
rm -rf "$TMP"

echo "== yt-dlp（下载抖音、B 站链接用）"
curl -L --fail --retry 3 -o "$STAGE/bin/yt-dlp" https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_macos
chmod +x "$STAGE/bin/"*

echo "== 检查：自带程序必须都能在 Apple 芯片上原生运行（用户的 Mac 不一定装了 Rosetta）"
check_arm64() {
  if lipo -archs "$1" 2>/dev/null | grep -qw arm64; then
    echo "   ✓ $(basename "$1")：$(lipo -archs "$1")"
  else
    echo "   ✗ $1 不是 Apple 芯片版（$(lipo -archs "$1" 2>/dev/null || echo 未知)）"
    exit 1
  fi
}
for f in "$STAGE/bin/"* "$STAGE/chrome/chrome-headless-shell" "$STAGE"/node_modules/@remotion/compositor-darwin-arm64/remotion; do
  check_arm64 "$f"
done
du -sh "$STAGE" | sed 's/^/   总大小 /'
