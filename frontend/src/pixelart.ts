// Pixel-grid sprite system. Each sprite is a string array where every character
// is one pixel and maps to a color in a per-sprite palette. This gives true
// pixel-art look (no anti-aliased shapes) and is trivial to author/iterate.
//
// Convention:
//   "." → transparent
//   any other char → palette[char]
//
// Example:
//   const grid = [
//     "..KKK..",
//     ".KSSSK.",
//     ".KSeSK.",
//   ];
//   const pal = { K: 0x000000, S: 0xf2c8a0, e: 0x000000 };

import { Container, Graphics } from "pixi.js";

export type Palette = Record<string, number>;
export type Grid = readonly string[];

export interface DrawOptions {
  pixelSize?: number;       // size in display units of one source pixel
  outline?: number;         // optional outline color drawn at transparency edges
}

/**
 * Render a pixel grid into a Container of Graphics rects.
 * Adjacent same-color pixels are merged horizontally for fewer draw calls.
 */
export function drawGrid(grid: Grid, palette: Palette, opts: DrawOptions = {}): Container {
  const px = opts.pixelSize ?? 1;
  const c = new Container();
  const g = new Graphics();

  const w = Math.max(...grid.map((r) => r.length));
  const h = grid.length;

  // optional thin outline at transparency boundaries — looks like classic 1-px black outline
  if (opts.outline !== undefined) {
    for (let y = 0; y < h; y++) {
      const row = grid[y];
      for (let x = 0; x < w; x++) {
        const ch = row[x] ?? ".";
        if (ch !== ".") continue;
        // if any 4-neighbor is solid, draw outline pixel
        const n =
          (grid[y - 1]?.[x] ?? ".") !== "." ||
          (grid[y + 1]?.[x] ?? ".") !== "." ||
          (row[x - 1] ?? ".") !== "." ||
          (row[x + 1] ?? ".") !== ".";
        if (n) g.rect(x * px, y * px, px, px).fill(opts.outline);
      }
    }
  }

  // Run-length merge fills per row
  for (let y = 0; y < h; y++) {
    const row = grid[y];
    let runStart = -1;
    let runChar = "";
    for (let x = 0; x <= w; x++) {
      const ch = row[x] ?? ".";
      const color = ch === "." ? -1 : palette[ch];
      if (runStart >= 0 && (ch !== runChar || color === undefined)) {
        const startCh = runChar;
        const startColor = startCh === "." ? -1 : palette[startCh];
        if (startColor !== undefined && startColor !== -1) {
          g.rect(runStart * px, y * px, (x - runStart) * px, px).fill(startColor);
        }
        runStart = -1;
        runChar = "";
      }
      if (ch !== "." && color !== undefined && runStart < 0) {
        runStart = x;
        runChar = ch;
      }
    }
  }

  c.addChild(g);
  return c;
}

/** Layer a top grid on top of a base grid (top "." pixels are transparent). */
export function overlay(base: Grid, top: Grid, ox = 0, oy = 0): string[] {
  const h = Math.max(base.length, top.length + oy);
  const w = Math.max(
    ...base.map((r) => r.length),
    ...top.map((r) => r.length + ox),
  );
  const out: string[] = [];
  for (let y = 0; y < h; y++) {
    const baseRow = (base[y] ?? "").padEnd(w, ".");
    let row = baseRow;
    const topRow = top[y - oy];
    if (topRow) {
      const arr = row.split("");
      for (let x = 0; x < topRow.length; x++) {
        const ch = topRow[x];
        if (ch !== ".") arr[x + ox] = ch;
      }
      row = arr.join("");
    }
    out.push(row);
  }
  return out;
}
