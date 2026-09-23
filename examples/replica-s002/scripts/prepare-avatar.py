"""
从原片片段抠出头像槽位素材（带透明通道的逐帧 PNG）。

只保留头像本身：内圆里的画面 + 越出内圆、压在白环上的头发（破框效果）。
白环、投影、背景、字幕一律不从原片抠——那些是结构，必须由代码画出来，
否则比对分数再高也只是在比原片和原片。

用法：把 ShotPilot 导出的 clip.mp4 放在本目录，然后
    python3 scripts/prepare-avatar.py [clip.mp4]
依赖：ffmpeg、pip install pillow numpy
"""
import subprocess, sys, tempfile
from pathlib import Path
import numpy as np
from PIL import Image

CLIP = Path(sys.argv[1] if len(sys.argv) > 1 else 'clip.mp4')
OUT = Path('public/avatar')

# 与 src/AvatarCard.tsx 中的实测几何保持一致
CX, CY, R_IN = 639.7, 356.0, 183.0
X0, Y0, S = 410, 126, 460          # 裁剪框，容纳外圆 r=227
BAND_OUTER = 222                   # 白环带外沿（不含投影）

if not CLIP.exists():
    sys.exit(f'找不到 {CLIP}。把 ShotPilot 复刻包里的 clip.mp4 拷到这里。')

OUT.mkdir(parents=True, exist_ok=True)
with tempfile.TemporaryDirectory() as tmp:
    subprocess.run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-i', str(CLIP),
                    '-vsync', '0', f'{tmp}/f%03d.png'], check=True)
    frames = sorted(Path(tmp).glob('f*.png'))
    yy, xx = np.mgrid[Y0:Y0 + S, X0:X0 + S].astype(float)
    r = np.hypot(xx - CX, yy - CY)
    inner = np.clip(R_IN + 0.5 - r, 0, 1)
    band = (r >= R_IN - 1) & (r < BAND_OUTER)
    for i, f in enumerate(frames, start=1):
        crop = np.asarray(Image.open(f).convert('RGB')).astype(float)[Y0:Y0 + S, X0:X0 + S]
        lum = crop.mean(axis=2)
        # 白环带里只有比白环暗的像素才属于头像层（头发）；白色透明，露出代码画的白环
        overflow = np.where(band, np.clip((250 - lum) / 40, 0, 1), 0)
        alpha = np.maximum(inner, overflow)
        Image.fromarray(np.dstack([crop, alpha * 255]).astype(np.uint8), 'RGBA').save(OUT / f'f{i:03d}.png')
print(f'已生成 {len(frames)} 帧头像素材 → {OUT}/')
if len(frames) != 65:
    print(f'注意：组件按 65 帧写的，这里是 {len(frames)} 帧。改 src/Root.tsx 的 durationInFrames '
          f'和 src/AvatarCard.tsx 里 avatar.count 让它们一致。')
