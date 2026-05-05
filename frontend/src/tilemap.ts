// Karolinenviertel tilemap, painted region-by-region. Geography from north
// (top) to south (bottom):
//
//   y=0–3    Planten un Blomen — park strip, trees scattered, no encounters
//   y=4–6    Glacischaussee — E-W asphalt, sidewalks N+S
//   y=7–21   The big middle band:
//              cols 0–17   Messehallen (CCH) — two halls split by a central
//                          cross-aisle, each with inner Hinterhof courtyards
//              cols 18–21  Messeplatz approach — sidewalk strip between Messe
//                          and field; main spawn corridor for OMR/Internorga
//              cols 22–44  Heiligengeistfeld — open green, Dom funfair tiles
//                          clustered at the centre, small Buden at the edges
//              cols 45–55  Karolinenstraße east residential — two brick blocks
//                          with Hinterhöfe (stalls + tree)
//   y=22–24  Marktstraße — sidewalk · asphalt · sidewalk, full width
//   y=25–30  Karolinenviertel south block: Marktstraße bars (row 25), brick
//            buildings with N-S walking corridors at cols 11/28/38/48,
//            Karolinenstraße cobble at cols 18–19, Feldstraße U-Bahn at the
//            cols-11/12 corridor, Hochbunker (cols 0–7, contiguous brick mass)
//   y=31–33  Budapester Straße — second E-W road
//   y=34–37  Reeperbahn — cobble street + Bude-lined south kerb
//   y=38–43  Millerntor — plaza on the west, Millerntor-Stadion on the east
//            (cols 24–55) with two entrance corridors
//
// Spawn at (11, 28): the Feldstraße U-Bahn entrance — "you arrive in Hamburg".

import { Container, Graphics, Sprite } from "pixi.js";

import { tileTexture } from "./sprites";

export const TILE = 32;
export const MAP_W = 56;
export const MAP_H = 44;

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

export interface MapData {
  tiles: Tile[][];
  zones: (Zone)[][];
  width: number;
  height: number;
  spawn: { x: number; y: number };
}

function buildMap(): MapData {
  const w = MAP_W;
  const h = MAP_H;
  const tiles: Tile[][] = Array.from({ length: h }, () =>
    Array<Tile>(w).fill("grass"),
  );
  const set = (x: number, y: number, t: Tile) => {
    if (x >= 0 && y >= 0 && x < w && y < h) tiles[y][x] = t;
  };
  const rect = (x0: number, y0: number, x1: number, y1: number, t: Tile) => {
    for (let y = y0; y <= y1; y++)
      for (let x = x0; x <= x1; x++) set(x, y, t);
  };
  // Tiny xorshift so scattered features (trees, courtyard props) don't change
  // between runs but still look organic.
  const scatter = (
    x0: number, y0: number, x1: number, y1: number,
    t: Tile, density: number, seed: number,
  ) => {
    let s = seed | 0;
    const r = () => {
      s = Math.imul(s ^ (s >>> 15), 0x85ebca6b);
      s ^= s >>> 13;
      s = Math.imul(s, 0xc2b2ae35);
      s ^= s >>> 16;
      return (s >>> 0) / 0x100000000;
    };
    for (let y = y0; y <= y1; y++)
      for (let x = x0; x <= x1; x++)
        if (r() < density) set(x, y, t);
  };

  // 1. Planten un Blomen — north park edge.
  rect(0, 0, w - 1, 3, "park");
  scatter(0, 0, w - 1, 3, "tree", 0.22, 0xd00d_be_ef);

  // 2. Glacischaussee — sidewalk · asphalt · sidewalk strip.
  rect(0, 4, w - 1, 4, "sidewalk");
  rect(0, 5, w - 1, 5, "asphalt");
  rect(0, 6, w - 1, 6, "sidewalk");

  // 3. Messehallen complex (cols 0–17, rows 7–21).
  // Two big halls split by an E-W aisle at row 14, plus a central N-S aisle
  // at cols 8–9, plus four small Hinterhof courtyards inside the quadrants.
  rect(0, 7, 17, 21, "messe_wall");
  rect(8, 7, 9, 21, "sidewalk");          // central N-S aisle
  rect(0, 14, 17, 14, "sidewalk");        // central E-W aisle
  rect(2, 8, 3, 9, "sidewalk");           // NW Hinterhof (Hall A west)
  rect(14, 8, 15, 9, "sidewalk");         // NE Hinterhof (Hall A east)
  rect(2, 16, 3, 17, "sidewalk");         // SW Hinterhof (Hall B west)
  rect(14, 16, 15, 17, "sidewalk");       // SE Hinterhof (Hall B east)

  // 4. Messeplatz approach — sidewalk strip between Messe and field.
  rect(18, 7, 21, 22, "sidewalk");

  // 5. Heiligengeistfeld (cols 22–44, rows 7–21). Default grass; stamp Dom
  // funfair tiles in a diamond at the centre and a few stalls at the edges.
  for (let dy = -3; dy <= 3; dy++) {
    for (let dx = -4; dx <= 4; dx++) {
      if (Math.abs(dx) + Math.abs(dy) <= 4) set(33 + dx, 14 + dy, "funfair");
    }
  }
  set(25, 9, "stall");
  set(40, 10, "stall");
  set(28, 18, "stall");
  set(41, 19, "stall");
  // Field fence along the south edge, leaving gaps so the player can step out.
  for (const fx of [22, 25, 28, 31, 34, 37, 40, 43]) set(fx, 21, "fence");

  // 6. Karolinenstraße east residential (cols 45–55).
  rect(45, 7, 45, 22, "sidewalk");        // outer kerb
  rect(46, 7, 55, 13, "building");        // north Block
  rect(48, 9, 53, 12, "sidewalk");        // Hinterhof
  set(49, 10, "tree");
  set(52, 11, "stall");
  set(50, 13, "sidewalk");                // courtyard gateway
  rect(46, 14, 55, 14, "sidewalk");       // alley between blocks
  rect(46, 15, 55, 21, "building");       // south Block
  rect(48, 17, 53, 20, "sidewalk");
  set(49, 18, "tree");
  set(52, 19, "stall");
  set(50, 15, "sidewalk");

  // 7. Marktstraße belt (rows 22–24).
  rect(0, 22, w - 1, 22, "sidewalk");
  rect(0, 23, w - 1, 23, "asphalt");
  rect(0, 24, w - 1, 24, "sidewalk");

  // 8. South block (rows 25–30) — Marktstraße bars + Karolinenviertel housing.
  rect(0, 25, w - 1, 30, "building");     // base: brick everywhere
  rect(0, 27, w - 1, 27, "sidewalk");     // E-W alley
  rect(0, 27, 7, 27, "building");         // …except Hochbunker (cols 0–7) is solid
  for (const cx of [11, 28, 38, 48]) {    // N-S walking corridors
    rect(cx, 25, cx + 1, 30, "sidewalk");
  }
  rect(18, 25, 19, 30, "cobble");         // Karolinenstraße (south leg, cobble)
  // Marktstraße bar/stall fronts (row 25) — only on building tiles, the
  // corridors carved above stay walkable.
  for (const sx of [3, 7, 14, 22, 25, 33, 41, 47, 51]) {
    if (tiles[25][sx] === "building") set(sx, 25, "stall");
  }
  // Feldstraße U-Bahn entrance (overlays the col 11 corridor).
  set(11, 28, "ubahn");
  set(12, 28, "ubahn");

  // 9. Budapester Straße — second E-W road.
  rect(0, 31, w - 1, 31, "sidewalk");
  rect(0, 32, w - 1, 32, "asphalt");
  rect(0, 33, w - 1, 33, "sidewalk");

  // 10. Reeperbahn (rows 34–37). Cobble street with a Bude-lined south kerb.
  rect(0, 34, w - 1, 35, "cobble");
  rect(0, 36, w - 1, 36, "building");
  for (const sx of [3, 9, 15, 21, 27, 33, 39, 45, 51]) set(sx, 36, "stall");
  for (const cx of [6, 12, 18, 24, 30, 36, 42, 48, 54]) set(cx, 36, "sidewalk");
  rect(0, 37, w - 1, 37, "sidewalk");

  // 11. Millerntor — plaza (cols 0–23) + Millerntor-Stadion (cols 24–55).
  rect(0, 38, w - 1, 38, "sidewalk");
  rect(0, 39, 23, 43, "sidewalk");
  set(8, 41, "tree");
  set(15, 41, "tree");
  set(11, 40, "stall");
  rect(24, 39, 55, 43, "messe_wall");     // stadium concourse facade
  rect(28, 39, 31, 43, "sidewalk");       // west entrance corridor
  rect(40, 39, 43, 43, "sidewalk");       // east entrance corridor

  // ---- Zones --------------------------------------------------------------
  const zones: Zone[][] = Array.from({ length: h }, () => Array<Zone>(w).fill(null));
  const zone = (x0: number, y0: number, x1: number, y1: number, z: Zone) => {
    for (let y = y0; y <= y1; y++)
      for (let x = x0; x <= x1; x++) zones[y][x] = z;
  };
  // Messehallen covers walls + approach plaza so spawns trigger from the
  // sidewalks and inner aisles.
  zone(0, 7, 21, 22, "messehallen");
  zone(22, 7, 44, 21, "heiligengeistfeld");
  zone(45, 7, 55, 22, "karolinenstrasse");          // east residential
  zone(0, 23, w - 1, 30, "marktstrasse");           // belt + south block
  zone(18, 25, 19, 30, "karolinenstrasse");         // cobble overrides
  zone(8, 27, 17, 30, "feldstrasse");               // U-Bahn approach
  zone(0, 31, w - 1, 37, "marktstrasse");           // Budapester + Reeperbahn
  zone(0, 38, w - 1, 43, "millerntor");

  return { tiles, zones, width: w, height: h, spawn: { x: 11, y: 28 } };
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
