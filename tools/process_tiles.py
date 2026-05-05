"""Slice the AI-generated tile sheet into per-tile-type PNGs.

Input:  frontend/public/assets/sprites/map.png  (1254x1254, 8 cols x 8 rows
        with ~10px white borders between cells and ~38px outer margins)
Output: frontend/public/assets/tiles/{tile_type}.png  (32x32 RGB)

The sheet has more variants per row than we currently use (8 cobble variants,
8 brick variants, …) — for now we pick one representative cell per tile_type
in `tilemap.ts`. Extra cells get saved as `{tile_type}_v{n}.png` so we can
swap them in later for visual variation without re-running the AI.
"""
from __future__ import annotations

from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SHEET = ROOT / "frontend/public/assets/sprites/map.png"
OUT_DIR = ROOT / "frontend/public/assets/tiles"

# Detected white seam bands (start, end_exclusive) including the outer margins.
# The image is 1254x1254 with eight ~140px tiles separated by ~10px white seams.
# Each tile occupies pixels [seam[i].end, seam[i+1].start). Note: horizontal
# seams (between rows) sit ~10–20px lower than vertical seams (between cols) —
# the AI sheet isn't on a perfect grid, so row/col bounds are detected
# independently via tools/inspect_seams.py.
COL_SEAMS = [
    (0, 38),       # outer left margin
    (178, 188),
    (328, 337),
    (472, 482),
    (619, 630),
    (768, 778),
    (915, 925),
    (1063, 1073),
    (1213, 1254),  # outer right margin
]
ROW_SEAMS = [
    (0, 35),       # outer top margin
    (179, 188),
    (332, 341),
    (485, 495),
    (638, 647),
    (787, 796),
    (935, 945),
    (1068, 1080),
    (1218, 1254),  # outer bottom margin
]
COL_BOUNDS = [(COL_SEAMS[i][1], COL_SEAMS[i + 1][0]) for i in range(8)]
ROW_BOUNDS = [(ROW_SEAMS[i][1], ROW_SEAMS[i + 1][0]) for i in range(8)]

TARGET = 32  # in-game tile size

# Mapping from (row, col) in sheet to tile filename.
# Row meaning (from looking at the sheet):
#   0 cobblestone street (light/dark/mid + edge variants)
#   1 red brick wall (plain + lit window + chimney + corners)
#   2 Messehallen glass facade (windows + MESSE entrance + corners)
#   3 asphalt road (yellow center stripe + intersections)
#   4 concrete sidewalk (seam grid + grass-corner variants)
#   5 park grass / dirt path / tufts / flowers / bush
#   6 fences (post-and-rail) + market stalls
#   7 U-Bahn entrance + sign + bench + funfair pink/yellow checker
PRIMARY: dict[tuple[int, int], str] = {
    (0, 0): "cobble",
    (1, 0): "building",
    (1, 2): "building_window",  # lit window variant
    (2, 0): "messe_wall",
    (2, 4): "messe_door",       # MESSE entrance
    (3, 0): "asphalt",
    (4, 0): "sidewalk",
    (5, 0): "park",             # darker park grass
    (5, 1): "dirt",
    (5, 3): "grass",            # lighter grass (path-grass)
    (5, 4): "tufts",
    (5, 6): "tree",             # bush/tree canopy
    (6, 0): "fence",
    (6, 5): "stall",
    (7, 0): "ubahn",
    (7, 1): "ubahn_sign",
    (7, 3): "funfair",
}


def slice_cell(sheet: Image.Image, row: int, col: int) -> Image.Image:
    x0, x1 = COL_BOUNDS[col]
    y0, y1 = ROW_BOUNDS[row]
    # 1px safety shrink in case seam detection was off by a pixel.
    pad = 1
    return sheet.crop((x0 + pad, y0 + pad, x1 - pad, y1 - pad))


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    sheet = Image.open(SHEET).convert("RGB")
    print(f"sheet: {sheet.size}")

    for (row, col), name in PRIMARY.items():
        cell = slice_cell(sheet, row, col)
        cell = cell.resize((TARGET, TARGET), Image.LANCZOS)
        out = OUT_DIR / f"{name}.png"
        cell.save(out, "PNG")
        print(f"  ({row},{col}) → {out.relative_to(ROOT)} ({cell.size[0]}x{cell.size[1]})")


if __name__ == "__main__":
    main()
