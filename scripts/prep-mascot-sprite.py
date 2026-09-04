#!/usr/bin/env python
"""
看板娘精灵图预处理：量图 → 分行预览 → 裁剪压缩成 baseline / full 两档。

用法：
  # 阶段一：量网格、数每行实际帧数、导出分行预览（挑 idle / react 用）
  python scripts/prep-mascot-sprite.py measure

  # 阶段二：裁掉用不到的行并压成两档
  #   --rows 是要保留的行号，按给出的顺序重新排列（所以新行号 = 参数里的下标）
  #   当前用的是 0 6 3 5 7 -> 站立A / 站立B / 挥手 / 情绪组(取睡姿) / 打字
  python scripts/prep-mascot-sprite.py build --rows 0 6 3 5 7

为什么要裁行：原图 8x9=72 帧约 2MB，而看板娘只用得到其中几行。
为什么两档同网格：baseline 和 full 只差分辨率，cols/rows/states 配置完全一致，
渐进升级时换个 src 就行，不用分叉配置。

⚠️ 选行时注意：有的行是「一个动作的中间帧」（可循环），有的行是「几个独立姿势的集锦」
（只能定格取单帧）。拿姿势集锦当循环播会像幻灯片，帧率再怎么调都救不回来 ——
用 measure 导出的分行预览逐行看过再定。
"""

import argparse
import os
import sys

try:
    from PIL import Image
except ImportError:
    sys.exit("需要 Pillow：pip install Pillow")

SRC = os.path.expanduser(r"~/.petdex/pets/elysia/spritesheet.webp")
OUT_DIR = os.path.join("apps", "web", "public", "mascot", "pets", "elysia")
PREVIEW_DIR = os.path.join("tmp-sprite-preview")

COLS, ROWS = 8, 9
# 前台按钮 144x156（移动端 120x130），见 apps/web/src/styles.css 的 .mascot-figure-button。
# baseline 每帧宽度取 144，正好等于 1x 屏的显示宽度，像素画不经缩放最清晰；
# 144/192 = 0.75 是整数比，纵向 208*0.75 = 156 也是整数，不会有半像素。
# full 保留原始 192x208 供 2x 屏使用。
BASELINE_FRAME_W = 144


def load():
    if not os.path.exists(SRC):
        sys.exit(f"找不到素材：{SRC}\n先执行：npx petdex install elysia")
    im = Image.open(SRC).convert("RGBA")
    fw, fh = im.size[0] // COLS, im.size[1] // ROWS
    return im, fw, fh


def cmd_measure():
    im, fw, fh = load()
    print(f"sheet : {im.size[0]} x {im.size[1]}")
    print(f"grid  : {COLS} cols x {ROWS} rows")
    print(f"frame : {fw} x {fh}")
    print()

    os.makedirs(PREVIEW_DIR, exist_ok=True)
    for r in range(ROWS):
        flags = []
        for c in range(COLS):
            cell = im.crop((c * fw, r * fh, (c + 1) * fw, (r + 1) * fh))
            flags.append(1 if cell.getchannel("A").getbbox() else 0)

        # 只有前 n 帧连续有内容才算有效帧数：中间空洞说明我们数错了网格
        filled = sum(flags)
        leading = 0
        for f in flags:
            if not f:
                break
            leading += 1
        warn = "" if leading == filled else "  ⚠ 帧不连续，网格可能不是 8x9"
        print(f"row {r}: {filled} frames  {flags}{warn}")

        strip = im.crop((0, r * fh, COLS * fw, (r + 1) * fh))
        strip.save(os.path.join(PREVIEW_DIR, f"row{r}.png"))

    print(f"\n分行预览已导出到 {PREVIEW_DIR}/row*.png")


def cmd_build(keep_rows):
    im, fw, fh = load()
    os.makedirs(OUT_DIR, exist_ok=True)

    out_rows = len(keep_rows)
    full = Image.new("RGBA", (COLS * fw, out_rows * fh), (0, 0, 0, 0))
    for new_r, src_r in enumerate(keep_rows):
        band = im.crop((0, src_r * fh, COLS * fw, (src_r + 1) * fh))
        full.paste(band, (0, new_r * fh))

    full_path = os.path.join(OUT_DIR, "sprite-full.webp")
    full.save(full_path, "WEBP", quality=90, method=6)

    scale = BASELINE_FRAME_W / fw
    baseline = full.resize(
        (round(full.width * scale), round(full.height * scale)),
        # 像素画缩小用 NEAREST 会产生断裂的锯齿，LANCZOS 保边更干净；
        # 前台再靠 image-rendering: pixelated 保持硬边观感。
        Image.LANCZOS,
    )
    baseline_path = os.path.join(OUT_DIR, "sprite.webp")
    baseline.save(baseline_path, "WEBP", quality=82, method=6)

    print(f"保留行 {keep_rows} -> 新网格 {COLS} x {out_rows}")
    for path in (baseline_path, full_path):
        print(f"  {path}  {os.path.getsize(path) / 1024:.0f} KB")
    print("\n把下面填进后台「看板娘 → 精灵图」的微调参数：")
    print(f'  "cols": {COLS}, "rows": {out_rows}')


def main():
    parser = argparse.ArgumentParser()
    sub = parser.add_subparsers(dest="cmd", required=True)
    sub.add_parser("measure")
    build = sub.add_parser("build")
    build.add_argument("--rows", type=int, nargs="+", required=True)
    args = parser.parse_args()

    if args.cmd == "measure":
        cmd_measure()
    else:
        cmd_build(args.rows)


if __name__ == "__main__":
    main()
