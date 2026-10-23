"""Compose the README gallery from the example wallpapers in docs/examples/.

Each tile is 800x450 with the skin's chrome drawn on top (transparent sidebar
and topbar, frosted composer). The theme is chosen from the wallpaper's own
brightness, so light wallpapers get the light palette and dark ones the dark
palette — exactly what the skin does at runtime when you switch appearance.

    python tools/make-examples.py     # -> docs/preview-gallery.png
"""

from __future__ import annotations

import importlib.util
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
DOCS = ROOT / "docs"
EXAMPLES = DOCS / "examples"

_spec = importlib.util.spec_from_file_location("make_preview", HERE / "make-preview.py")
mp = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(mp)

TILE_W, TILE_H = 800, 450
BAR_H = 36
BOLD = "C:/Windows/Fonts/msyhbd.ttc"
REGULAR = "C:/Windows/Fonts/msyh.ttc"

# filename -> (title, config note)
SCENES = [
    ("wallpaper-1.webp", "毛毡黑猫", "自定义动图 / 静图"),
    ("wallpaper-2.webp", "草地野餐", "亮色壁纸 → 浅色主题"),
    ("wallpaper-3.webp", "报纸房间", "暗色壁纸 → 深色主题"),
    ("wallpaper-4.webp", "花瓣少女", "亮色壁纸 → 浅色主题"),
]


def brightness(image: Image.Image) -> float:
    small = image.convert("L").resize((32, 32))
    data = small.tobytes()
    return sum(data) / len(data) / 255


def tile(image: Image.Image, theme: str) -> Image.Image:
    mp.PALETTE = dict(mp.PALETTES[theme])
    base = mp.cover_resize(image, TILE_W, TILE_H)
    return mp.render(base, TILE_W, TILE_H).convert("RGBA")


def bear_scene(width: int = 1600, height: int = 1000) -> Image.Image:
    """Pillow replica of the built-in WALLPAPER_SVG (`wallpaper: 'bear'`)."""
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

    bear = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    pen = ImageDraw.Draw(bear)
    outline, body, inner = (238, 241, 239), (255, 253, 249), (246, 230, 220)
    pen.ellipse((500, 720, 1100, 1090), fill=(*body, 255), outline=(*outline, 255), width=3)
    for cx in (652, 948):
        pen.ellipse((cx - 66, 312, cx + 66, 444), fill=(*body, 255))
        pen.ellipse((cx - 31, 347, cx + 31, 409), fill=(*inner, 255))
    pen.ellipse((595, 373, 1005, 717), fill=(*body, 255), outline=(*outline, 255), width=3)
    for cx in (742, 858):
        pen.ellipse((cx - 25, 505, cx + 25, 565), fill=(47, 47, 47, 255))
    for cx in (700, 900):
        pen.ellipse((cx - 36, 592, cx + 36, 632), fill=(246, 201, 196, 140))
    pen.ellipse((702, 550, 898, 690), fill=(251, 243, 236, 255))
    pen.ellipse((775, 571, 825, 605), fill=(58, 58, 58, 255))
    pen.arc((772, 600, 828, 650), start=20, end=160, fill=(58, 58, 58, 255), width=7)
    return Image.alpha_composite(canvas.convert("RGBA"), bear).convert("RGB")


def legend(width: int, entries: list[tuple[str, str, str]]) -> Image.Image:
    bar = Image.new("RGBA", (width, BAR_H), (20, 28, 32, 238))
    draw = ImageDraw.Draw(bar)
    face = ImageFont.truetype(BOLD, 15)
    note_font = ImageFont.truetype(REGULAR, 13)
    for index, (title, note, mode) in enumerate(entries):
        x = 18 + index * (width // 2)
        draw.text((x, 9), title, font=face, fill=(255, 255, 255, 246))
        offset = x + draw.textlength(title, font=face) + 12
        draw.text((offset, 10), f"{note}", font=note_font, fill=(150, 214, 205, 235))
        offset += draw.textlength(note, font=note_font) + 12
        draw.text((offset, 10), mode, font=note_font, fill=(196, 214, 210, 200))
    return bar


def main() -> None:
    rows: list[list[tuple[Image.Image, str, str, str]]] = []
    for start in (0, 2):
        row = []
        for filename, title, note in SCENES[start : start + 2]:
            path = EXAMPLES / filename
            if not path.exists():
                raise SystemExit(f"missing {path}")
            image = Image.open(path).convert("RGB")
            theme = "light" if brightness(image) > 0.55 else "dark"
            row.append((tile(image, theme), title, note, f"渲染：{theme}"))
        rows.append(row)

    grid = Image.new("RGBA", (TILE_W * 2, (TILE_H + BAR_H) * len(rows)), (20, 28, 32, 255))
    for row_index, row in enumerate(rows):
        top = row_index * (TILE_H + BAR_H)
        for column, (image, *_rest) in enumerate(row):
            grid.alpha_composite(image, (column * TILE_W, top))
        grid.alpha_composite(
            legend(TILE_W * 2, [(title, note, mode) for _, title, note, mode in row]),
            (0, top + TILE_H),
        )

    target = DOCS / "preview-gallery.webp"
    grid.convert("RGB").save(target, quality=87, method=6)
    print("docs/preview-gallery.webp", grid.size, f"{target.stat().st_size // 1024} KB")

    # 零素材兜底：wallpaper: 'bear' 用内置 SVG 小熊，单独出一张全尺寸示意图。
    mp.PALETTE = dict(mp.PALETTES["light"])
    bear = mp.render(mp.cover_resize(bear_scene(), 1600, 900), 1600, 900).convert("RGB")
    bear_target = DOCS / "preview-bear.webp"
    bear.save(bear_target, quality=88, method=6)
    print("docs/preview-bear.webp", bear.size, f"{bear_target.stat().st_size // 1024} KB")


if __name__ == "__main__":
    main()
