"""Slice the AI-generated tourist sprite sheet, remove the JPG checkerboard
background, trim, downscale, and emit per-species PNGs for the game.

Input:  frontend/public/assets/sprites/tourists.jpg  (1600x639, 5 cols x 2 rows)
Output: frontend/public/assets/sprites/tourists/{species_id}.png  (64x64 RGBA)

Order in the sheet (matches tools/sprite-prompts.md):
  Row 0: sport, omr, internorga, dom, hanseboot
  Row 1: reeperbahn, kreuzfahrt, musical, fischmarkt, hafengeburtstag
"""
from __future__ import annotations

import sys
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
OUT_DIR = ROOT / "frontend/public/assets/sprites/tourists"

# Each entry: (sheet relative path, filename suffix appended to species_id)
# e.g. ("tourists.jpg", "") → dom_tourist.png
#      ("shinies.png",  "_shiny") → dom_tourist_shiny.png
SHEETS: list[tuple[str, str]] = [
    ("tourists.jpg", ""),
    ("shinies.png", "_shiny"),
]

COLS = 5
ROWS = 2
ORDER = [
    "sport_tourist", "omr_tourist", "internorga_tourist", "dom_tourist", "hanseboot_tourist",
    "reeperbahn_tourist", "kreuzfahrt_tourist", "musical_tourist", "fischmarkt_tourist", "hafengeburtstag_tourist",
]
TARGET_SIZE = 64  # output PNG size; chosen so AI native pixel grid (~64) survives intact


def is_checkerboard(rgb: tuple[int, int, int], tol: int = 30) -> bool:
    """Detect the JPEG-compressed transparency checkerboard.

    The pattern is light gray (~204,204,204) and white (~255,255,255). JPEG
    artifacts smear the boundary, so we accept anything desaturated and bright.
    """
    r, g, b = rgb
    if max(r, g, b) - min(r, g, b) > 18:
        return False  # has color → keep
    avg = (r + g + b) // 3
    return avg >= 195  # light gray to white


def remove_bg(cell: Image.Image) -> Image.Image:
    """Flood-fill the checkerboard from each border, then make those pixels transparent.
    Anything reachable from the border that matches the checkerboard test becomes alpha=0.
    """
    cell = cell.convert("RGBA")
    px = cell.load()
    w, h = cell.size

    visited = bytearray(w * h)
    stack: list[tuple[int, int]] = []
    for x in range(w):
        stack.append((x, 0))
        stack.append((x, h - 1))
    for y in range(h):
        stack.append((0, y))
        stack.append((w - 1, y))

    while stack:
        x, y = stack.pop()
        if x < 0 or y < 0 or x >= w or y >= h:
            continue
        idx = y * w + x
        if visited[idx]:
            continue
        r, g, b, _a = px[x, y]
        if not is_checkerboard((r, g, b)):
            continue
        visited[idx] = 1
        px[x, y] = (0, 0, 0, 0)
        stack.append((x + 1, y))
        stack.append((x - 1, y))
        stack.append((x, y + 1))
        stack.append((x, y - 1))

    return cell


def trim_alpha(im: Image.Image, padding: int = 2) -> Image.Image:
    """Crop to the alpha bbox with a small padding."""
    bbox = im.getbbox()
    if not bbox:
        return im
    l, t, r, b = bbox
    l = max(0, l - padding)
    t = max(0, t - padding)
    r = min(im.width, r + padding)
    b = min(im.height, b + padding)
    return im.crop((l, t, r, b))


def fit_to_square(im: Image.Image, size: int) -> Image.Image:
    """Resize keeping aspect, paste centered onto transparent square."""
    w, h = im.size
    scale = size / max(w, h)
    new_w = max(1, round(w * scale))
    new_h = max(1, round(h * scale))
    resized = im.resize((new_w, new_h), Image.LANCZOS)
    canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    ox = (size - new_w) // 2
    oy = size - new_h  # bottom-align (feet to bottom of cell)
    canvas.paste(resized, (ox, oy), resized)
    return canvas


def process_sheet(sheet_path: Path, suffix: str) -> None:
    if not sheet_path.exists():
        print(f"  (skipping {sheet_path.name} — not found)")
        return
    sheet = Image.open(sheet_path).convert("RGBA")
    sw, sh = sheet.size
    print(f"\n{sheet_path.name}: {sw}x{sh} (suffix={suffix or 'none'})")

    cw = sw / COLS
    ch = sh / ROWS

    for i, species_id in enumerate(ORDER):
        col = i % COLS
        row = i // COLS
        x0 = round(col * cw)
        y0 = round(row * ch)
        x1 = round((col + 1) * cw)
        y1 = round((row + 1) * ch)

        cell = sheet.crop((x0, y0, x1, y1))
        cell = remove_bg(cell)
        cell = trim_alpha(cell, padding=2)
        cell = fit_to_square(cell, TARGET_SIZE)

        out_path = OUT_DIR / f"{species_id}{suffix}.png"
        cell.save(out_path, "PNG")
        print(f"  {species_id}{suffix}: {x1-x0}x{y1-y0} → {TARGET_SIZE}px → {out_path.relative_to(ROOT)}")


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    selected = sys.argv[1:] if len(sys.argv) > 1 else [name for name, _ in SHEETS]
    for sheet_name, suffix in SHEETS:
        if sheet_name in selected or Path(sheet_name).stem in selected:
            process_sheet(ROOT / "frontend/public/assets/sprites" / sheet_name, suffix)


if __name__ == "__main__":
    main()
