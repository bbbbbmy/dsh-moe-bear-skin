"""Generate the multi-scene gallery for the README.

Four 16:9 mock-ups on a 2x2 grid, all drawn from original artwork:

    1. 默认：原创落叶动效（assets/leaf-fall-poster.webp）+ 浅色主题
    2. wallpaper: 'bear' —— 内置 SVG 自嘲熊（这里用 Pillow 复刻同一张图）
    3. 深色模式（同一张壁纸，走 dark 调色板）
    4. 自定义壁纸 —— 换一张自己的图/视频（示例背景也是本项目原创）

    python tools/make-gallery.py     # -> docs/preview-gallery.png
"""

from __future__ import annotations

import importlib.util
import math
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont

# make-preview.py 的文件名带连字符，不能直接 import，按路径加载。
_spec = importlib.util.spec_from_file_location(
    "make_preview", Path(__file__).resolve().with_name("make-preview.py")
)
mp = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(mp)

DOCS = Path(__file__).resolve().parent.parent / "docs"
TILE_W, TILE_H = 800, 450
GAP = 0
LABEL_FONT = "C:/Windows/Fonts/msyhbd.ttc"


def legend_bar(width: int, entries: list[tuple[str, str]]) -> Image.Image:
    """Dark strip under each tile row: bold caption + the CONFIG that produces it."""
    bar = Image.new("RGBA", (width, 36), (20, 28, 32, 236))
    draw = ImageDraw.Draw(bar)
    face = ImageFont.truetype(LABEL_FONT, 15)
    mono = ImageFont.truetype("C:/Windows/Fonts/msyh.ttc", 13)
    for index, (caption, note) in enumerate(entries):
        x = 18 + index * (width // 2)
        draw.text((x, 9), caption, font=face, fill=(255, 255, 255, 246))
        offset = x + draw.textlength(caption, font=face) + 14
        draw.text((offset, 10), note, font=mono, fill=(150, 214, 205, 240))
    return bar


def bear_scene(width: int = 1600, height: int = 1000) -> Image.Image:
    """Pillow replica of the built-in WALLPAPER_SVG (same geometry/palette)."""
    canvas = Image.new("RGB", (width, height))
    draw = ImageDraw.Draw(canvas)
    top, bottom = (234, 246, 251), (227, 242, 232)
    for y in range(height):
        ratio = y / (height - 1)
        draw.line(
            [(0, y), (width, y)],
            fill=tuple(round(top[i] + (bottom[i] - top[i]) * ratio) for i in range(3)),
        )
    for cx, cy, radius, color, alpha in (
        (300, 190, 170, (207, 233, 240), 110),
        (1330, 300, 130, (214, 236, 221), 100),
        (1220, 820, 220, (207, 233, 216), 95),
    ):
        blob = Image.new("RGBA", (width, height), (0, 0, 0, 0))
        ImageDraw.Draw(blob).ellipse((cx - radius, cy - radius, cx + radius, cy + radius), fill=(*color, alpha))
        canvas = Image.alpha_composite(canvas.convert("RGBA"), blob).convert("RGB")

    bear = Image.new("RGBA", (width, height), (255, 255, 255, 0))
    pen = ImageDraw.Draw(bear)
    outline = (238, 241, 239)
    body, inner = (255, 253, 249), (246, 230, 220)
    pen.ellipse((500, 720, 1100, 1090), fill=(*body, 255), outline=(*outline, 255), width=3)  # shoulders
    for cx in (652, 948):
        pen.ellipse((cx - 66, 312, cx + 66, 444), fill=(*body, 255))  # ears
        pen.ellipse((cx - 31, 347, cx + 31, 409), fill=(*inner, 255))  # inner ear
    pen.ellipse((595, 373, 1005, 717), fill=(*body, 255), outline=(*outline, 255), width=3)  # head
    for cx in (742, 858):
        pen.ellipse((cx - 25, 505, cx + 25, 565), fill=(47, 47, 47, 255))  # eyes
    for cx in (700, 900):
        pen.ellipse((cx - 36, 592, cx + 36, 632), fill=(246, 201, 196, 140))  # blush
    pen.ellipse((702, 550, 898, 690), fill=(251, 243, 236, 255))  # muzzle
    pen.ellipse((775, 571, 825, 605), fill=(58, 58, 58, 255))  # nose
    pen.arc((772, 600, 828, 650), start=20, end=160, fill=(58, 58, 58, 255), width=7)  # mouth
    return Image.alpha_composite(canvas.convert("RGBA"), bear).convert("RGB")


def sea_scene(width: int = 1600, height: int = 1000) -> Image.Image:
    """Abstract jade water — an original stand-in for "your own video"."""
    canvas = Image.new("RGB", (width, height))
    draw = ImageDraw.Draw(canvas)
    top, bottom = (36, 92, 84), (168, 214, 198)
    for y in range(height):
        ratio = y / (height - 1)
        draw.line([(0, y), (width, y)], fill=tuple(round(top[i] + (bottom[i] - top[i]) * ratio) for i in range(3)))

    rng = __import__("random").Random(7)
    for _ in range(26):
        cx, cy = rng.uniform(0, width), rng.uniform(0, height)
        radius = rng.uniform(90, 320)
        tint = rng.choice([(255, 255, 255, 26), (198, 240, 226, 40), (46, 118, 106, 46)])
        blob = Image.new("RGBA", (width, height), (0, 0, 0, 0))
        ImageDraw.Draw(blob).ellipse((cx - radius, cy - radius * 0.5, cx + radius, cy + radius * 0.5), fill=tint)
        blob = blob.filter(ImageFilter.GaussianBlur(46))
        canvas = Image.alpha_composite(canvas.convert("RGBA"), blob).convert("RGB")

    caustics = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    pen = ImageDraw.Draw(caustics)
    for index in range(18):
        y = rng.uniform(0, height)
        points = [
            (x, y + math.sin(x / width * math.tau * rng.uniform(1, 2) + index) * rng.uniform(6, 26))
            for x in range(0, width + 1, 40)
        ]
        pen.line(points, fill=(255, 255, 255, rng.randint(18, 42)), width=rng.randint(2, 6), joint="curve")
    caustics = caustics.filter(ImageFilter.GaussianBlur(9))
    return Image.alpha_composite(canvas.convert("RGBA"), caustics).convert("RGB")


def aurora_scene(width: int = 1600, height: int = 1000) -> Image.Image:
    """Violet/teal aurora — a third original option for the gallery."""
    canvas = Image.new("RGB", (width, height))
    draw = ImageDraw.Draw(canvas)
    top, bottom = (26, 22, 44), (52, 96, 104)
    for y in range(height):
        ratio = y / (height - 1)
        draw.line([(0, y), (width, y)], fill=tuple(round(top[i] + (bottom[i] - top[i]) * ratio) for i in range(3)))

    rng = __import__("random").Random(11)
    for _ in range(9):
        band = Image.new("RGBA", (width, height), (0, 0, 0, 0))
        pen = ImageDraw.Draw(band)
        color = rng.choice([(126, 184, 201, 60), (156, 194, 168, 55), (186, 150, 214, 55)])
        base_y = rng.uniform(120, height * 0.7)
        points_top = [
            (x, base_y + math.sin(x / width * math.tau * rng.uniform(1.0, 2.0)) * rng.uniform(30, 90))
            for x in range(0, width + 1, 30)
        ]
        points_bottom = [(x, y + rng.uniform(90, 220)) for x, y in reversed(points_top)]
        pen.polygon(points_top + points_bottom, fill=color)
        band = band.filter(ImageFilter.GaussianBlur(38))
        canvas = Image.alpha_composite(canvas.convert("RGBA"), band).convert("RGB")

    stars = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    pen = ImageDraw.Draw(stars)
    for _ in range(220):
        x, y = rng.uniform(0, width), rng.uniform(0, height * 0.75)
        radius = rng.uniform(0.6, 1.9)
        pen.ellipse((x - radius, y - radius, x + radius, y + radius), fill=(255, 255, 255, rng.randint(60, 190)))
    return Image.alpha_composite(canvas.convert("RGBA"), stars).convert("RGB")


def tile(scene: Image.Image, theme: str) -> Image.Image:
    mp.PALETTE = dict(mp.PALETTES[theme])
    # 场景按 16:9 cover 裁到 tile 尺寸，再叠加 UI（render 不会自己缩放）
    base = mp.cover_resize(scene, TILE_W, TILE_H)
    return mp.render(base, TILE_W, TILE_H).convert("RGBA")


def main() -> None:
    DOCS.mkdir(exist_ok=True)
    leaf = Image.open(mp.DEFAULT_SOURCE).convert("RGB")

    rows = [
        (
            [
                (tile(leaf, "light"), "默认 · 落叶动效", "wallpaper: 'image'（随包自带）"),
                (tile(bear_scene(), "light"), "内置自嘲熊", "wallpaper: 'bear'（不要素材）"),
            ]
        ),
        (
            [
                (tile(leaf, "dark"), "深色模式", "壁纸压暗 + 浅色文字（#9CC2A8）"),
                (tile(sea_scene(), "light"), "自定义壁纸", "wallpaper: 'video' / 'image'"),
            ]
        ),
    ]

    bar_h = 36
    grid = Image.new("RGBA", (TILE_W * 2, (TILE_H + bar_h) * len(rows)), (20, 28, 32, 255))
    for row_index, row in enumerate(rows):
        top = row_index * (TILE_H + bar_h)
        for column, (image, caption, note) in enumerate(row):
            grid.alpha_composite(image, (column * TILE_W, top))
        captions = [(caption, note) for _, caption, note in row]
        grid.alpha_composite(legend_bar(TILE_W * 2, captions), (0, top + TILE_H))

    grid.convert("RGB").save(DOCS / "preview-gallery.png", optimize=True)
    print("docs/preview-gallery.png", grid.size, f"{(DOCS / 'preview-gallery.png').stat().st_size // 1024} KB")

    mp.PALETTE = dict(mp.PALETTES["dark"])
    aurora = mp.render(mp.cover_resize(aurora_scene(), 1600, 900), 1600, 900).convert("RGB")
    aurora.save(DOCS / "preview-aurora.png", optimize=True)
    print("docs/preview-aurora.png", aurora.size, f"{(DOCS / 'preview-aurora.png').stat().st_size // 1024} KB")


if __name__ == "__main__":
    main()
