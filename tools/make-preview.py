"""Generate README preview assets for dsh-moe-bear-skin.

Renders a mock-up of the skin (transparent sidebar/topbar, frosted composer,
wallpaper behind everything) from the wallpaper cover image, so the screenshot
never contains anyone's real session content.

    python tools/make-preview.py     # -> docs/preview.png + docs/preview.gif
"""

import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parent.parent
DEFAULT_SOURCE = ROOT / "assets" / "leaf-fall-poster.webp"
DOCS = ROOT / "docs"
FONT = "C:/Windows/Fonts/msyh.ttc"
FONT_BOLD = "C:/Windows/Fonts/msyhbd.ttc"

W, H = 1600, 900
SIDEBAR = 264
COMPOSER_W, COMPOSER_H, COMPOSER_BOTTOM = 900, 96, 34

# 两套调色板：默认壁纸是浅色的落叶，浅色主题才还原实际观感；
# --dark 会按深色模式压暗壁纸并改用浅色文字。
PALETTES = {
    "light": {
        "scrim": 0.0,
        "text": (26, 46, 50, 246),
        "text_dim": (36, 60, 64, 200),
        "hover": (255, 255, 255, 96),
        "bubble": (255, 255, 255, 142),
        "bubble_user": (255, 255, 255, 205),
        "composer": (255, 255, 255, 112),
        "composer_tint": 130,
        "border": (255, 255, 255, 190),
        "shadow": (255, 255, 255, 120),
        "accent": (126, 184, 201, 240),
    },
    "dark": {
        "scrim": 0.46,
        "text": (238, 246, 244, 245),
        "text_dim": (222, 236, 232, 190),
        "hover": (255, 255, 255, 34),
        "bubble": (255, 255, 255, 34),
        "bubble_user": (255, 255, 255, 58),
        "composer": (255, 255, 255, 44),
        "composer_tint": 50,
        "border": (255, 255, 255, 120),
        "shadow": (0, 0, 0, 150),
        "accent": (126, 184, 201, 240),
    },
}

PALETTE = dict(PALETTES["light"])


def font(size: int, bold: bool = False) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(FONT_BOLD if bold else FONT, size)


def source_image() -> Path:
    """Wallpaper still used for the mock-up: argv[1], else the shipped default."""
    if len(sys.argv) > 1:
        return Path(sys.argv[1]).resolve()
    return DEFAULT_SOURCE


def cover_resize(image: Image.Image, width: int, height: int) -> Image.Image:
    scale = max(width / image.width, height / image.height)
    resized = image.resize((round(image.width * scale), round(image.height * scale)), Image.LANCZOS)
    left = (resized.width - width) // 2
    top = (resized.height - height) // 2
    return resized.crop((left, top, left + width, top + height))


def backdrop(width: int, height: int, zoom: float = 1.0) -> Image.Image:
    """Wallpaper layer: cover-cropped, optionally zoomed (the GIF animates this)."""
    base = cover_resize(Image.open(source_image()).convert("RGB"), width, height)
    if zoom != 1.0:
        crop_w, crop_h = round(width / zoom), round(height / zoom)
        left = (width - crop_w) // 2
        top = (height - crop_h) // 2
        base = base.crop((left, top, left + crop_w, top + crop_h)).resize((width, height), Image.LANCZOS)
    if PALETTE["scrim"] > 0:
        base = Image.blend(base, Image.new("RGB", base.size, (8, 14, 13)), PALETTE["scrim"])
    return base


def frosted_rect(canvas: Image.Image, box, radius: int) -> None:
    """What backdrop-filter: blur() looks like over the wallpaper."""
    x0, y0, x1, y1 = box
    region = canvas.crop(box).convert("RGB").filter(ImageFilter.GaussianBlur(18))
    region = Image.blend(region, Image.new("RGB", region.size, (255, 255, 255)), PALETTE["composer_tint"] / 255)
    mask = Image.new("L", region.size, 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, region.width - 1, region.height - 1), radius, fill=255)
    canvas.paste(region, (x0, y0), mask)
    overlay = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    ImageDraw.Draw(overlay).rounded_rectangle(box, radius, outline=PALETTE["border"], width=1)
    canvas.alpha_composite(overlay)


def text(draw: ImageDraw.ImageDraw, xy, value: str, size: int, *, bold=False, dim=False) -> None:
    """Draw with a 1px offset shadow so it survives a busy wallpaper."""
    face = font(size, bold)
    x, y = xy
    draw.text((x + 1, y + 1), value, font=face, fill=PALETTE["shadow"])
    draw.text((x, y), value, font=face, fill=PALETTE["text_dim"] if dim else PALETTE["text"])


def paint_ui(size, scale: float = 1.0) -> Image.Image:
    """The chrome the skin keeps transparent, drawn as an RGBA overlay."""
    ui = Image.new("RGBA", size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(ui)
    s = lambda value: round(value * scale)  # noqa: E731

    # 顶栏：完全透明，只有文字
    text(draw, (s(22), s(13)), "自嘲熊动态壁纸 · dsh-moe-bear-skin", 15, bold=True)
    text(draw, (s(W - 150), s(14)), "标准模式", 13, dim=True)

    # 侧栏：不做毛玻璃，文字直接浮在壁纸上
    draw.rounded_rectangle((s(14), s(56), s(SIDEBAR - 14), s(92)), s(10), fill=PALETTE["hover"])
    text(draw, (s(26), s(66)), "新会话", 14, bold=True)
    y = s(120)
    for row, bold in (("工作区", True), ("  dsh-moe-bear-skin", False), ("会话", True), ("  自嘲熊壁纸研究", False)):
        text(draw, (s(24), y), row, 13, bold=bold, dim=not bold)
        y += s(26 if bold else 30)
    draw.rounded_rectangle((s(14), s(H - 132), s(SIDEBAR - 14), s(H - 96)), s(10), fill=PALETTE["hover"])
    text(draw, (s(26), s(H - 126)), "设置", 13)

    # 正文：透明，气泡本身带一点点白，证明内容区没有底色
    left = SIDEBAR + s(64)
    draw.rounded_rectangle((left, s(150), left + s(560), s(214)), s(14), fill=PALETTE["bubble"])
    text(draw, (left + s(18), s(166)), "壁纸换好了，侧栏和顶栏现在是透明的。", 15)
    right = W - s(120)
    draw.rounded_rectangle((right - s(430), s(240), right, s(296)), s(14), fill=PALETTE["bubble_user"])
    text(draw, (right - s(412), s(256)), "下边框也透明掉，要铺满整屏。", 15)
    draw.rounded_rectangle((left, s(322), left + s(700), s(386)), s(14), fill=PALETTE["bubble"])
    text(draw, (left + s(18), s(338)), "已清掉 composerSeat 的 180deg 渐变。", 15)
    text(draw, (left + s(18), s(360)), "输入框保留毛玻璃，正文保持通透。", 14, dim=True)

    # 底部输入区：容器透明，只有输入框本体是毛玻璃
    box = ((s(W) - s(COMPOSER_W)) // 2, s(H - COMPOSER_BOTTOM - COMPOSER_H), (s(W) + s(COMPOSER_W)) // 2, s(H - COMPOSER_BOTTOM))
    draw.rounded_rectangle(box, s(24), fill=PALETTE["composer"])
    text(draw, (box[0] + s(26), box[1] + s(27)), "给智能体发消息…", 15, dim=True)
    draw.rounded_rectangle((box[2] - s(64), box[3] - s(44), box[2] - s(18), box[3] - s(18)), s(12), fill=PALETTE["accent"])
    draw.text((box[2] - s(52), box[3] - s(40)), "→", font=font(s(18), True), fill=(12, 24, 28, 235))

    text(draw, (s(22), s(H - 26)), "示意图 · 实际由壁纸视频驱动", 11, dim=True)
    return ui


def compose(width: int, height: int, zoom: float = 1.0) -> Image.Image:
    canvas = backdrop(width, height, zoom).convert("RGBA")
    scale = width / W
    box = (
        (width - round(COMPOSER_W * scale)) // 2,
        round((H - COMPOSER_BOTTOM - COMPOSER_H) * scale),
        (width + round(COMPOSER_W * scale)) // 2,
        round((H - COMPOSER_BOTTOM) * scale),
    )
    frosted_rect(canvas, box, round(24 * scale))
    canvas.alpha_composite(paint_ui(canvas.size, scale))
    return canvas.convert("RGB")


def main() -> None:
    global PALETTE
    DOCS.mkdir(exist_ok=True)
    PALETTE = dict(PALETTES["dark" if "--dark" in sys.argv else "light"])

    preview = compose(W, H)
    preview.save(DOCS / "preview.png", optimize=True)
    print("docs/preview.png", preview.size, f"{(DOCS / 'preview.png').stat().st_size // 1024} KB")

    frames = []
    steps = 16
    for index in range(steps):
        zoom = 1.0 + 0.035 * (index / (steps - 1))
        frames.append(compose(800, 450, zoom).convert("P", palette=Image.ADAPTIVE, colors=96))
    frames[0].save(
        DOCS / "preview.gif",
        save_all=True,
        append_images=frames[1:],
        duration=110,
        loop=0,
        optimize=True,
    )
    print("docs/preview.gif", f"{(DOCS / 'preview.gif').stat().st_size // 1024} KB")


if __name__ == "__main__":
    main()
