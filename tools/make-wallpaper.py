"""Generate the default wallpaper effect for dsh-moe-bear-skin.

Draws a seamless looping "falling leaves" animation (soft blue-green dawn sky,
muted leaves drifting down and swaying) and writes:

    assets/leaf-fall.webp          animated WebP, used as the default wallpaper
    assets/leaf-fall-poster.webp   still frame, shown before the animation loads

Both files are original artwork by this project (MIT), so they can live in the
repository. The loop is exact: every leaf's vertical travel and spin are integer
multiples of the frame count, and the sway period divides it.

    python tools/make-wallpaper.py
"""

from __future__ import annotations

import math
import random
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageOps

ROOT = Path(__file__).resolve().parent.parent
ASSETS = ROOT / "assets"

W, H = 1280, 720
FRAMES = 60
FPS = 20
MARGIN = 90  # leaves enter/leave above and below the frame

LEAF_COLORS = [
    (126, 184, 201),  # 雾蓝 #7EB8C9
    (156, 194, 168),  # 灰绿 #9CC2A8
    (183, 217, 207),
    (224, 201, 166),
    (143, 185, 168),
]

SKY_TOP = (228, 242, 246)
SKY_BOTTOM = (198, 226, 218)


def sky() -> Image.Image:
    """Vertical gradient + a few soft light blobs + vignette."""
    canvas = Image.new("RGB", (W, H))
    draw = ImageDraw.Draw(canvas)
    for y in range(H):
        ratio = y / (H - 1)
        color = tuple(round(SKY_TOP[i] + (SKY_BOTTOM[i] - SKY_TOP[i]) * ratio) for i in range(3))
        draw.line([(0, y), (W, y)], fill=color)

    glow = Image.new("RGB", (W, H), (255, 255, 255))
    mask = Image.new("L", (W, H), 0)
    mask_draw = ImageDraw.Draw(mask)
    for cx, cy, radius, strength in ((300, 150, 360, 70), (1010, 210, 300, 55), (760, 560, 420, 40)):
        mask_draw.ellipse((cx - radius, cy - radius, cx + radius, cy + radius), fill=strength)
    mask = mask.filter(ImageFilter.GaussianBlur(120))
    canvas = Image.composite(glow, canvas, mask)

    vignette = Image.new("L", (W, H), 0)
    ImageDraw.Draw(vignette).ellipse((-W * 0.15, -H * 0.2, W * 1.15, H * 1.2), fill=255)
    vignette = vignette.filter(ImageFilter.GaussianBlur(160))
    shade = Image.new("RGB", (W, H), (150, 176, 172))
    return Image.composite(canvas, shade, vignette)


def leaf_sprite(size: int, color: tuple[int, int, int]) -> Image.Image:
    """One leaf: pointed almond outline, curved midrib, short stem."""
    pad = 8
    box = size + pad * 2
    sprite = Image.new("RGBA", (box, box), (0, 0, 0, 0))
    draw = ImageDraw.Draw(sprite)
    mid = box / 2
    half = size / 2
    steps = 28

    def edge(t: float) -> tuple[float, float, float]:
        """t: 0 = stem end, 1 = tip. Returns (y, half-width, sideways bend)."""
        y = mid + half - t * size
        width = half * 0.44 * math.sin(math.pi * t) ** 1.02
        bend = half * 0.22 * math.sin(math.pi * t)
        return y, width, bend

    left: list[tuple[float, float]] = []
    right: list[tuple[float, float]] = []
    spine: list[tuple[float, float]] = []
    for index in range(steps + 1):
        t = index / steps
        y, width, bend = edge(t)
        left.append((mid - width + bend, y))
        right.append((mid + width + bend, y))
        spine.append((mid + bend, y))

    draw.polygon(left + right[::-1], fill=(*color, 242))
    darker = tuple(max(0, round(channel * 0.72)) for channel in color)
    draw.line(spine, fill=(*darker, 150), width=max(1, round(size / 30)))
    draw.line(
        [(mid + 1, mid + half), (mid + 1, mid + half + size * 0.12)],
        fill=(*darker, 130),
        width=max(1, round(size / 34)),
    )
    return sprite.filter(ImageFilter.GaussianBlur(0.5))


class Leaf:
    def __init__(self, rng: random.Random, depth: float) -> None:
        self.depth = depth  # 0 = far/small/slow, 1 = near/big/fast
        self.size = round(30 + depth * 56)
        self.color = rng.choice(LEAF_COLORS)
        self.sprite = leaf_sprite(self.size, self.color)
        self.x0 = rng.uniform(-MARGIN, W + MARGIN)
        self.y0 = rng.uniform(-MARGIN, H + MARGIN)
        self.sway = rng.uniform(28, 74) * (0.6 + depth)
        self.sway_cycles = rng.choice([1, 2])           # integer → seamless
        self.phase = rng.uniform(0, math.tau)
        self.spin_cycles = rng.choice([1, 2, 3])        # integer turns per loop
        self.spin_phase = rng.uniform(0, 360)
        self.fall_cycles = 1                            # one screen per loop
        self.opacity = 0.55 + depth * 0.4

    def placement(self, frame: int) -> tuple[float, float, float, float]:
        t = frame / FRAMES
        travel = H + MARGIN * 2
        y = (self.y0 + travel * self.fall_cycles * t) % travel - MARGIN
        x = self.x0 + self.sway * math.sin(self.sway_cycles * math.tau * t + self.phase)
        angle = self.spin_phase + 360 * self.spin_cycles * t
        return x, y, angle, self.opacity


def render(frames: int = FRAMES) -> list[Image.Image]:
    rng = random.Random(20261023)
    background = sky()

    far = [Leaf(rng, depth=0.15) for _ in range(12)]
    mid = [Leaf(rng, depth=0.5) for _ in range(9)]
    near = [Leaf(rng, depth=0.9) for _ in range(5)]

    out: list[Image.Image] = []
    for index in range(frames):
        canvas = background.copy().convert("RGBA")
        for layer, blur in ((far, 1.6), (mid, 0.7), (near, 0.0)):
            layer_canvas = Image.new("RGBA", (W, H), (0, 0, 0, 0))
            for leaf in layer:
                x, y, angle, opacity = leaf.placement(index)
                sprite = leaf.sprite.rotate(angle, resample=Image.BICUBIC, expand=True)
                if opacity < 0.99:
                    alpha = sprite.getchannel("A").point(lambda value: round(value * opacity))
                    sprite.putalpha(alpha)
                layer_canvas.alpha_composite(sprite, (round(x - sprite.width / 2), round(y - sprite.height / 2)))
            if blur > 0:
                layer_canvas = layer_canvas.filter(ImageFilter.GaussianBlur(blur))
            canvas.alpha_composite(layer_canvas)
        out.append(canvas.convert("RGB"))
    return out


def main() -> None:
    ASSETS.mkdir(exist_ok=True)
    frames = render()

    poster = frames[0].copy()
    poster.save(ASSETS / "leaf-fall-poster.webp", quality=88, method=6)
    print("assets/leaf-fall-poster.webp", f"{(ASSETS / 'leaf-fall-poster.webp').stat().st_size // 1024} KB")

    frames[0].save(
        ASSETS / "leaf-fall.webp",
        save_all=True,
        append_images=frames[1:],
        duration=round(1000 / FPS),
        loop=0,
        quality=76,
        method=4,
    )
    size = (ASSETS / "leaf-fall.webp").stat().st_size
    print("assets/leaf-fall.webp", f"{size // 1024} KB", f"{len(frames)} frames @ {FPS}fps", f"{W}x{H}")


if __name__ == "__main__":
    main()
