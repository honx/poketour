// Hand-authored Karolinenviertel tilemap. Faithful-ish to real geography:
//
//   N  Planten un Blomen (park, north edge)
//   |  Karolinenstraße runs N-S along the east side of the field
//   |  Marktstraße cuts E-W in the south, café/bar zone
//   |  Heiligengeistfeld (huge open green) takes up the center
//   |  Messehallen complex (large building footprint) hugs the west
//   |  Hochbunker + Feldstraße U-Bahn at the south-center
//   |  Millerntor / St. Pauli edge in the south-east
//   S
//
// Phase 3 placeholder: tiles drawn with Pixi Graphics primitives, no PNG tileset
// yet. Map is 40x30 at 32px per tile = 1280x960 world.

import { Container, Graphics, Sprite } from "pixi.js";

import { tileTexture } from "./sprites";

export const TILE = 32;
export const MAP_W = 40;
export const MAP_H = 30;

export type Tile =
  | "grass"
  | "park"        // darker grass, trees scattered
  | "asphalt"
  | "cobble"
  | "sidewalk"
  | "messe_wall"  // Messehallen tan/glass
  | "building"    // generic HH brick
  | "fence"
  | "tree"
  | "stall"       // market stall
  | "funfair"     // Dom rides
  | "ubahn";

export type Zone =
  | null
  | "heiligengeistfeld"
  | "messehallen"
  | "karolinenstrasse"
  | "marktstrasse"
  | "millerntor"
  | "feldstrasse";

const TILE_COLORS: Record<Tile, number> = {
  grass: 0x4a7a3a,
  park: 0x35602a,
  asphalt: 0x3a3a40,
  cobble: 0x6e6258,
  sidewalk: 0x8a8678,
  messe_wall: 0xc8b878,
  building: 0x884030,
  fence: 0x806040,
  tree: 0x2a4a25,
  stall: 0xb05030,
  funfair: 0xc04080,
  ubahn: 0x202028,
};

const WALKABLE: Record<Tile, boolean> = {
  grass: true,
  park: true,
  asphalt: true,
  cobble: true,
  sidewalk: true,
  messe_wall: false,
  building: false,
  fence: false,
  tree: false,
  stall: false,
  funfair: true,
  ubahn: true,
};

// 40x30 world. Layout drawn ASCII-first then encoded:
//   . grass
//   , park
//   # building (HH brick, impassable)
//   M messe_wall (impassable)
//   T tree (impassable)
//   F fence (impassable)
//   S stall (impassable)
//   * funfair tile (walkable, on Heiligengeistfeld during Dom)
//   = asphalt road
//   ~ cobble road
//   _ sidewalk
//   U U-Bahn entrance
const MAP_ROWS: string[] = [
  // 0123456789012345678901234567890123456789
  ",,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,",  // 0  Planten un Blomen edge
  ",T,T,,,,T,,,,,,,T,,,,,T,,,T,,,,,,,T,,T,,",  // 1
  ",,,,,T,,,,,,,T,,,,,,,,,,,,,T,,,T,,,,,,,,",  // 2
  ",,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,T,",  // 3
  "________________________________________",  // 4   sidewalk strip
  "MMMMMMMMMM______........................",  // 5
  "MMMMMMMMMM______........................",  // 6
  "MMMMMMMMMM______........................",  // 7
  "MMMMMMMMMM______........................",  // 8   Heiligengeistfeld east of Messe
  "MMMMMMMMMM______........................",  // 9
  "MMMMMMMMMM______........................",  // 10
  "MMMMMMMMMM______........................",  // 11
  "MMMMMMMMMM______........................",  // 12
  "MMMMMMMMMM______........................",  // 13
  "MMMMMMMMMM______........................",  // 14
  "MMMMMMMMMM______........................",  // 15
  "MMMMMMMMMM______........................",  // 16
  "MMMMMMMMMM______..........F.F.F.F.F.F.F.",  // 17  field fence on east
  "________________........................",  // 18
  "================........................",  // 19  asphalt running E-W
  "________________........................",  // 20  Marktstraße sidewalk
  "##S##S##__####__........................",  // 21  Marktstraße bars/stalls north
  "##__##__~~~~~~~~~~~~~~~~................",  // 22  Karolinenstraße cobble S-bound
  "##__##__~~~~~~~~~~~~~~~~................",  // 23
  "##__##__~~UU~~~~~~~~~~~~##____##........",  // 24  Feldstraße U-Bahn entrance
  "##__##__~~~~~~~~~~~~~~~~##____##........",  // 25
  "________~~~~~~~~~~~~~~~~##____##........",  // 26
  "================~~~~~~~~##____##........",  // 27  Millerntorplatz approach
  "................~~~~~~~~..............T.",  // 28
  "................~~~~~~~~..............,,",  // 29
];

const CHAR_TO_TILE: Record<string, Tile> = {
  ",": "park",
  ".": "grass",
  "T": "tree",
  "F": "fence",
  "M": "messe_wall",
  "#": "building",
  "S": "stall",
  "*": "funfair",
  "=": "asphalt",
  "~": "cobble",
  "_": "sidewalk",
  "U": "ubahn",
};

export interface MapData {
  tiles: Tile[][];
  zones: (Zone)[][];
  width: number;
  height: number;
  spawn: { x: number; y: number };
}

function buildMap(): MapData {
  const tiles: Tile[][] = [];
  for (let y = 0; y < MAP_H; y++) {
    const row: Tile[] = [];
    const src = MAP_ROWS[y] ?? "";
    for (let x = 0; x < MAP_W; x++) {
      const ch = src[x] ?? ".";
      row.push(CHAR_TO_TILE[ch] ?? "grass");
    }
    tiles.push(row);
  }

  // Zone polygons (rectangles for MVP).
  const zones: Zone[][] = Array.from({ length: MAP_H }, () => Array<Zone>(MAP_W).fill(null));
  const fill = (x0: number, y0: number, x1: number, y1: number, z: Zone) => {
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) zones[y][x] = z;
  };
  // Messehallen zone covers the walls AND the sidewalk strip in front of them —
  // the walls themselves aren't walkable, so spawns must trigger from the
  // sidewalk approach (cols 10–15) and the strip below the building (row 18).
  fill(0, 5, 15, 18, "messehallen");
  fill(16, 5, 39, 17, "heiligengeistfeld");
  fill(8, 22, 23, 27, "karolinenstrasse");
  fill(0, 19, 39, 21, "marktstrasse");
  fill(8, 24, 13, 26, "feldstrasse");
  fill(24, 22, 31, 28, "millerntor");

  return { tiles, zones, width: MAP_W, height: MAP_H, spawn: { x: 11, y: 25 } };
}

export const MAP = buildMap();

export function isWalkable(x: number, y: number): boolean {
  if (x < 0 || y < 0 || x >= MAP_W || y >= MAP_H) return false;
  return WALKABLE[MAP.tiles[y][x]];
}

export function zoneAt(x: number, y: number): Zone {
  if (x < 0 || y < 0 || x >= MAP_W || y >= MAP_H) return null;
  return MAP.zones[y][x];
}

// Deterministic per-tile RNG so detail looks varied but is stable across reloads.
function tileSeed(x: number, y: number): number {
  let h = (x * 374761393 + y * 668265263) >>> 0;
  h = (h ^ (h >>> 13)) >>> 0;
  h = Math.imul(h, 1274126177) >>> 0;
  return h;
}

export function renderMap(): Container {
  const c = new Container();
  // Procedural-fallback layer goes underneath sprites so textured tiles always
  // win and partial fills (NEEDS_GRASS_BASE) don't bleed through.
  const ground = new Graphics();
  c.addChild(ground);
  // Tiles whose texture overlay sits on top of grass need a grass base painted
  // first (textures may have transparent margins from the slicer). Cheaper than
  // adding a second Sprite per cell.
  const NEEDS_GRASS_BASE: Partial<Record<Tile, true>> = {
    fence: true, tree: true, stall: true,
  };
  for (let y = 0; y < MAP_H; y++) {
    for (let x = 0; x < MAP_W; x++) {
      const t = MAP.tiles[y][x];
      const px = x * TILE;
      const py = y * TILE;
      const seed = tileSeed(x, y);

      const tex = tileTexture(t);
      if (tex) {
        if (NEEDS_GRASS_BASE[t]) {
          const base = tileTexture("grass");
          if (base) {
            const bs = new Sprite(base);
            bs.x = px; bs.y = py; bs.width = TILE; bs.height = TILE;
            c.addChild(bs);
          } else {
            ground.rect(px, py, TILE, TILE).fill(TILE_COLORS.grass);
          }
        }
        const sp = new Sprite(tex);
        sp.x = px;
        sp.y = py;
        sp.width = TILE;
        sp.height = TILE;
        c.addChild(sp);
        continue;
      }

      // Fallback: procedural Graphics for any tile without a PNG.
      ground.rect(px, py, TILE, TILE).fill(TILE_COLORS[t]);

      switch (t) {
        case "grass": {
          // tufts
          const dark = 0x3a5a2a;
          for (let i = 0; i < 4; i++) {
            const sx = (seed >>> (i * 4)) & 0x1f;
            const sy = (seed >>> (i * 4 + 1)) & 0x1f;
            ground.rect(px + (sx % 28), py + (sy % 28), 2, 1).fill(dark);
          }
          break;
        }
        case "park": {
          // mossier dark patches + speckles
          ground.rect(px + 4, py + 6, 6, 3).fill(0x2a4a20);
          ground.rect(px + 18, py + 20, 8, 4).fill(0x2a4a20);
          for (let i = 0; i < 6; i++) {
            const sx = (seed >>> (i * 3)) & 0x1f;
            const sy = (seed >>> (i * 3 + 2)) & 0x1f;
            ground.rect(px + (sx % 30), py + (sy % 30), 1, 1).fill(0x508036);
          }
          break;
        }
        case "asphalt": {
          // dashed center line
          ground.rect(px, py + 14, TILE, 4).fill(0x2a2a30);
          for (let i = 0; i < 2; i++) {
            ground.rect(px + 4 + i * 16, py + 15, 8, 2).fill(0xc0c040);
          }
          break;
        }
        case "cobble": {
          // staggered cobblestones
          const dk = 0x5a4f48;
          const lt = 0x7a6e62;
          for (let row = 0; row < 4; row++) {
            const offset = row % 2 === 0 ? 0 : 4;
            for (let col = 0; col < 4; col++) {
              const cx = px + col * 8 + offset;
              const cy = py + row * 8;
              ground.rect(cx + 1, cy + 1, 6, 6).fill(lt);
              ground.rect(cx + 1, cy + 1, 6, 1).fill(0x8a7e72);
              ground.rect(cx + 1, cy + 6, 6, 1).fill(dk);
            }
          }
          break;
        }
        case "sidewalk": {
          // tile grid
          ground.rect(px + 16, py, 1, TILE).fill(0x6e6a5e);
          ground.rect(px, py + 16, TILE, 1).fill(0x6e6a5e);
          ground.rect(px + 14, py + 14, 2, 2).fill(0x9a968a);
          break;
        }
        case "messe_wall": {
          // glass-and-tan modern facade with horizontal lines
          ground.rect(px + 2, py + 4, TILE - 4, 6).fill(0x9aa8c0); // glass band
          ground.rect(px + 2, py + 20, TILE - 4, 6).fill(0x9aa8c0);
          ground.rect(px, py + 2, TILE, 1).fill(0x806040);
          ground.rect(px, py + 16, TILE, 1).fill(0x806040);
          ground.rect(px, py + 30, TILE, 1).fill(0x806040);
          break;
        }
        case "building": {
          // red brick courses with offset rows + windows
          const brickDark = 0x5a2418;
          const mortar = 0x401818;
          for (let row = 0; row < 4; row++) {
            ground.rect(px, py + row * 8, TILE, 1).fill(mortar);
            const offset = row % 2 === 0 ? 0 : 4;
            for (let col = 0; col < 5; col++) {
              const bx = px + col * 8 + offset - 4;
              if (bx + 7 < px || bx >= px + TILE) continue;
              ground.rect(Math.max(bx, px), py + row * 8 + 1, Math.min(7, px + TILE - bx), 6).fill(brickDark);
            }
          }
          // 2 lit windows
          ground.rect(px + 6, py + 10, 6, 6).fill(0xfff080).stroke({ color: 0x202020, width: 1 });
          ground.rect(px + 20, py + 10, 6, 6).fill(0xfff080).stroke({ color: 0x202020, width: 1 });
          break;
        }
        case "stall": {
          // market stall: striped awning + counter
          ground.rect(px + 2, py + 6, TILE - 4, 6).fill(0xe04040);
          ground.rect(px + 2, py + 6, TILE - 4, 2).fill(0xffffff);
          ground.rect(px + 2, py + 10, TILE - 4, 2).fill(0xffffff);
          ground.rect(px + 2, py + 14, TILE - 4, 12).fill(0x806040);
          ground.rect(px + 2, py + 14, TILE - 4, 2).fill(0xa0805a);
          break;
        }
        case "tree": {
          // canopy + trunk, base on grass
          ground.rect(px, py, TILE, TILE).fill(0x3a5e2a);
          ground.circle(px + 16, py + 14, 12).fill(0x2a4a25);
          ground.circle(px + 12, py + 11, 5).fill(0x3a6a30);
          ground.circle(px + 22, py + 18, 4).fill(0x3a6a30);
          ground.rect(px + 14, py + 24, 4, 6).fill(0x5a3818);
          break;
        }
        case "fence": {
          // wooden fence: posts + horizontal rails
          ground.rect(px, py, TILE, TILE).fill(0x4a7a3a); // grass behind
          ground.rect(px + 4, py + 6, 2, 22).fill(0x5a3818);
          ground.rect(px + 14, py + 6, 2, 22).fill(0x5a3818);
          ground.rect(px + 24, py + 6, 2, 22).fill(0x5a3818);
          ground.rect(px, py + 10, TILE, 2).fill(0x5a3818);
          ground.rect(px, py + 22, TILE, 2).fill(0x5a3818);
          break;
        }
        case "ubahn": {
          // U-Bahn entrance: blue U on tan paving
          ground.rect(px, py, TILE, TILE).fill(0xa89a78);
          ground.rect(px + 6, py + 6, 6, 18).fill(0x004a90);
          ground.rect(px + 20, py + 6, 6, 18).fill(0x004a90);
          ground.rect(px + 6, py + 18, 20, 6).fill(0x004a90);
          ground.rect(px + 8, py + 8, 2, 14).fill(0x80b8e8);
          break;
        }
        case "funfair": {
          // pink/yellow festival paving
          ground.rect(px, py, TILE, TILE).fill(0xc04080);
          ground.rect(px + 4, py + 4, 4, 4).fill(0xffe040);
          ground.rect(px + 20, py + 12, 4, 4).fill(0xffe040);
          ground.rect(px + 12, py + 22, 4, 4).fill(0xffffff);
          break;
        }
      }
    }
  }
  return c;
}
