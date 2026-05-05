"""Slice the AI-generated player sprite sheet into 8 frame PNGs.

Input:  frontend/public/assets/sprites/character.png  (1774x887, 4 cols x 2 rows)
Output: frontend/public/assets/sprites/player/{facing}_{frame}.png  (64x64 RGBA)

Layout (matches the player prompt in tools/sprite-prompts.md):
  Row 0: down_0, down_1, up_0, up_1
  Row 1: left_0, left_1, right_0, right_1

A single bounding box across all 8 frames is used so the character keeps a
consistent size and footprint between frames (avoids per-frame jitter).
"""
from __future__ import annotations

from pathlib import Path

from PIL import Image

# reuse the bg-removal helpers
from process_sprites import remove_bg

ROOT = Path(__file__).resolve().parent.parent
SHEET = ROOT / "frontend/public/assets/sprites/character.png"
OUT_DIR = ROOT / "frontend/public/assets/sprites/player"
COLS = 4
ROWS = 2
TARGET_SIZE = 64

ORDER = [
    "down_0", "down_1", "up_0", "up_1",
    "left_0", "left_1", "right_0", "right_1",
]


def main() -> None:
    sheet = Image.open(SHEET).convert("RGBA")
    sw, sh = sheet.size
    print(f"sheet: {sw}x{sh}")

    OUT_DIR.mkdir(parents=True, exist_ok=True)

    cw = sw / COLS
    ch = sh / ROWS

    cleaned: list[Image.Image] = []
    for i in range(COLS * ROWS):
        col = i % COLS
        row = i // COLS
        x0 = round(col * cw)
        y0 = round(row * ch)
        x1 = round((col + 1) * cw)
        y1 = round((row + 1) * ch)
        cell = sheet.crop((x0, y0, x1, y1))
        cell = remove_bg(cell)
        cleaned.append(cell)

    # Compute one shared bbox over all frames so character size is consistent.
    bb_l = min((c.getbbox() or (c.width, c.height, 0, 0))[0] for c in cleaned)
    bb_t = min((c.getbbox() or (c.width, c.height, 0, 0))[1] for c in cleaned)
    bb_r = max((c.getbbox() or (0, 0, 0, 0))[2] for c in cleaned)
    bb_b = max((c.getbbox() or (0, 0, 0, 0))[3] for c in cleaned)
    pad = 4
    cw_i = cleaned[0].width
    ch_i = cleaned[0].height
    bb_l = max(0, bb_l - pad)
    bb_t = max(0, bb_t - pad)
    bb_r = min(cw_i, bb_r + pad)
    bb_b = min(ch_i, bb_b + pad)
    print(f"shared bbox: ({bb_l},{bb_t})–({bb_r},{bb_b})  size {bb_r-bb_l}x{bb_b-bb_t}")

    for name, cell in zip(ORDER, cleaned):
        cropped = cell.crop((bb_l, bb_t, bb_r, bb_b))
        # Resize keeping aspect, paste centered + bottom-aligned onto target square.
        w, h = cropped.size
        scale = TARGET_SIZE / max(w, h)
        new_w = max(1, round(w * scale))
        new_h = max(1, round(h * scale))
        resized = cropped.resize((new_w, new_h), Image.LANCZOS)
        canvas = Image.new("RGBA", (TARGET_SIZE, TARGET_SIZE), (0, 0, 0, 0))
        ox = (TARGET_SIZE - new_w) // 2
        oy = TARGET_SIZE - new_h
        canvas.paste(resized, (ox, oy), resized)
        out = OUT_DIR / f"{name}.png"
        canvas.save(out, "PNG")
        print(f"  {name}: → {out.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
