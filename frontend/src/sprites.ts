// Sprites: real PNG sprite sheet for tourists when available, with a pixel-grid
// fallback for any species whose asset is missing. Player still uses the
// pixel-grid system (no real sheet yet).

import { Assets, Container, Sprite, Texture, TextureSource } from "pixi.js";

import { drawGrid, overlay, type Grid, type Palette } from "./pixelart";

// Make every texture default to nearest-neighbor scaling so pixel-art stays
// crisp when scaled up in encounter / kodex scenes.
TextureSource.defaultOptions.scaleMode = "nearest";

const W = 32;
const H = 32;

// Track which species have real PNG assets loaded.
const SPECIES_TEXTURES: Record<string, Texture | undefined> = {};
const SHINY_TEXTURES: Record<string, Texture | undefined> = {};
let _assetsPreloadStarted = false;

export const TOURIST_PNG_IDS = [
  "sport_tourist",
  "omr_tourist",
  "internorga_tourist",
  "dom_tourist",
  "hanseboot_tourist",
  "reeperbahn_tourist",
  "kreuzfahrt_tourist",
  "musical_tourist",
  "fischmarkt_tourist",
  "hafengeburtstag_tourist",
];

// Player walk-cycle textures keyed as `${facing}_${frame}`
const PLAYER_TEXTURES: Record<string, Texture | undefined> = {};
const PLAYER_FRAMES = [
  "down_0", "down_1", "up_0", "up_1", "left_0", "left_1", "right_0", "right_1",
];

// Tilemap textures keyed by Tile name (matches names in tilemap.ts).
const TILE_TEXTURES: Record<string, Texture | undefined> = {};
const TILE_NAMES = [
  "grass", "park", "asphalt", "cobble", "sidewalk",
  "messe_wall", "building", "fence", "tree", "stall",
  "funfair", "ubahn",
];

export function tileTexture(name: string): Texture | undefined {
  return TILE_TEXTURES[name];
}

/** Kick off preloading of all sprite PNGs (tourists + player + tiles). Call once at boot. */
export async function preloadTouristAssets(): Promise<void> {
  if (_assetsPreloadStarted) return;
  _assetsPreloadStarted = true;
  await Promise.all([
    ...TOURIST_PNG_IDS.map(async (id) => {
      try {
        const tex = await Assets.load<Texture>(`/assets/sprites/tourists/${id}.png`);
        tex.source.scaleMode = "nearest";
        SPECIES_TEXTURES[id] = tex;
      } catch {
        // missing → pixel-grid fallback
      }
    }),
    ...TOURIST_PNG_IDS.map(async (id) => {
      try {
        const tex = await Assets.load<Texture>(`/assets/sprites/tourists/${id}_shiny.png`);
        tex.source.scaleMode = "nearest";
        SHINY_TEXTURES[id] = tex;
      } catch {
        // missing → fall back to tinting the regular texture
      }
    }),
    ...PLAYER_FRAMES.map(async (key) => {
      try {
        const tex = await Assets.load<Texture>(`/assets/sprites/player/${key}.png`);
        tex.source.scaleMode = "nearest";
        PLAYER_TEXTURES[key] = tex;
      } catch {
        // missing → pixel-grid fallback
      }
    }),
    ...TILE_NAMES.map(async (name) => {
      try {
        const tex = await Assets.load<Texture>(`/assets/tiles/${name}.png`);
        tex.source.scaleMode = "nearest";
        TILE_TEXTURES[name] = tex;
      } catch {
        // missing → procedural Graphics fallback in renderMap
      }
    }),
  ]);
}

// ---------- shared base body (32x32) ----------------------------------------
// Layout convention:
//   K = black outline
//   S = skin, s = skin shadow
//   H = hair, h = hair highlight
//   C = clothing primary, c = clothing shadow
//   B = clothing accent (badge/stripe)
//   P = pants, p = pants shadow
//   O = shoes
//   . = transparent
//
// All grids are 32 chars wide by 32 rows tall.
//
// Standing front-facing person:

const BODY: Grid = [
  "................................", // 0
  "................................", // 1
  "................................", // 2
  "..........KKKKKKKK..............", // 3   head outline top
  ".........KHHHHHHHHK.............", // 4   hair
  "........KHhhhhhhhhHK............", // 5
  ".......KHhhhhhhhhhhHK...........", // 6
  ".......KSSSSSSSSSSSSK...........", // 7   forehead
  ".......KSSSSSSSSSSSSK...........", // 8
  ".......KSeeSSSSSSeeSK...........", // 9   eyes (e)
  ".......KSSSSSSSSSSSSK...........", // 10
  ".......KSsSSmmmmSSsSK...........", // 11  mouth (m)
  "........KsSSSSSSSSsK............", // 12  chin
  ".........KsssSSsssK.............", // 13
  "..........KKSSSSKK..............", // 14  neck
  ".........KCCCCCCCCK.............", // 15  collar
  "........KCCCCCCCCCCK............", // 16  upper torso
  ".......KCCBCCCCCCBCCK...........", // 17  shoulders + accent stripes B
  "......KCCCCCCCCCCCCCCK..........", // 18
  "......KCCCCCCCCCCCCCCK..........", // 19  chest
  "......KSCCCCCCCCCCCCSK..........", // 20  arms (skin) at sides
  ".......KSCCCCCCCCCCSK...........", // 21
  "........KCCCCCCCCCCK............", // 22
  "........KPPPPPPPPPPK............", // 23  belt
  ".......KPPPPPPPPPPPPK...........", // 24  hips
  ".......KPPPPpppPPPPPK...........", // 25
  ".......KPPPPpppPPPPPK...........", // 26
  ".......KPPPK..KPPPPPK...........", // 27  legs split
  ".......KPPPK..KPPPPPK...........", // 28
  "........KPPK..KPPPPK............", // 29
  ".......KOOOK..KOOOOK............", // 30  shoes
  "........KKKK..KKKKK.............", // 31
];

interface SpeciesArt {
  /** colors for body palette letters */
  palette: Palette;
  /** optional hat/accessory drawn over the body (full 32x32 grid) */
  accessory?: Grid;
}

// ---------- per-species art --------------------------------------------------

const ART: Record<string, SpeciesArt> = {
  sport_tourist: {
    palette: skinPal({
      H: 0x202020, h: 0x404040,
      C: 0x202060, c: 0x101040, B: 0xffffff, // away kit
      P: 0x404040, p: 0x202020,
      O: 0xe0e0e0,
    }),
    // headband + sweat drop
    accessory: [
      "................................",
      "................................",
      "................................",
      ".........KKKKKKKKKK.............",
      ".........KrRrRrRrRK.............",   // red headband
      "................................",
      "................................",
      "................................",
      "................................",
      "................................",
      "..............ww................",   // sweat drop
      "..............ww................",
      "................................",
    ],
  },

  omr_tourist: {
    palette: skinPal({
      H: 0x402010, h: 0x603020,
      C: 0x303030, c: 0x101010, B: 0xffe040, // black hoodie + yellow strings
      P: 0x202840, p: 0x101020,
      O: 0xe0e0e0,
    }),
    accessory: [
      "................................",
      "................................",
      "................................",
      "................................",
      "................................",
      "................................",
      "................................",
      "................................",
      "................................",
      "................................",
      "................................",
      "................................",
      "................................",
      "................................",
      "..............LL................",   // lanyard
      "..............LL................",
      "..............LL................",
      "..............LL................",
      "..............LL................",
      "..............LL................",
      ".............NNNN...............",   // badge
      ".............NNNN...............",
      ".............NNNN...............",
    ],
  },

  internorga_tourist: {
    palette: skinPal({
      H: 0x603020, h: 0x80502a,
      C: 0xc0a060, c: 0x806030, B: 0xffffff, // beige blazer
      P: 0x303030, p: 0x101010,
      O: 0x402010,
    }),
    // tote bag bursting with samples (right side)
    accessory: [
      "................................",
      "................................",
      "................................",
      "................................",
      "................................",
      "................................",
      "................................",
      "................................",
      "................................",
      "................................",
      "................................",
      "................................",
      "................................",
      "................................",
      "................................",
      "................................",
      "................................",
      "................................",
      "..................TTtT..........",   // tote
      ".................TwwwT..........",
      "................TTwwwTT.........",
      "................TwwYwwT.........",   // Y = sausage poking out
      "................TwwwwwT.........",
      "................TTTTTTT.........",
    ],
  },

  dom_tourist: {
    palette: skinPal({
      H: 0x402010, h: 0x603020,
      C: 0xe04040, c: 0x801818, B: 0xffffff, // red zip hoodie
      P: 0x303040, p: 0x101020,
      O: 0x603020,
    }),
    // cotton candy on a stick + Lebkuchenherz
    accessory: [
      ".....................CCC.......",   // cotton candy
      "....................CCCCC......",
      "...................CCCCCCC.....",
      "....................CCCCC......",
      "................................",
      "....................W...........",   // stick
      "....................W...........",
      "....................W...........",
      "....................W...........",
      "................................",
      "................................",
      "................................",
      "................................",
      "................................",
      "................................",
      "................................",
      "................................",
      ".....HH..HH.....................",   // Lebkuchenherz held in left
      "....HHHHHHHH....................",
      "....HHrHHrHH....................",
      "....HHHHHHHH....................",
      ".....HHHHHH.....................",
      "......HHHH......................",
      ".......HH.......................",
    ],
  },

  hanseboot_tourist: {
    palette: skinPal({
      H: 0x806040, h: 0xa08050,
      C: 0xffffff, c: 0xa0a0c0, B: 0x002060, // white shirt + navy stripes
      P: 0x202060, p: 0x101030,
      O: 0x202020,
    }),
    // skipper cap + anchor on chest
    accessory: [
      "................................",
      "...........KKKKKKKK.............",
      "..........KbbbbbbbbK............",   // navy cap top
      ".........KbbbbbbbbbbK...........",
      "........KbbbbbbbbbbbbK..........",
      "........KwwwwwwwwwwwwK..........",   // white band
      "................................",
      "................................",
      "................................",
      "................................",
      "................................",
      "................................",
      "................................",
      "................................",
      "................................",
      "................................",
      "................................",
      "................................",
      "..............YY................",   // anchor (yellow accent)
      ".............YYYY...............",
      "............YY..YY..............",
      "............YY..YY..............",
      ".............YYYY...............",
    ],
  },

  reeperbahn_tourist: {
    palette: skinPal({
      H: 0x202020, h: 0x404040,
      C: 0x402020, c: 0x201010, B: 0x808080, // leather jacket
      P: 0x202020, p: 0x101010,
      O: 0x101010,
    }),
    // sunglasses overlay on eyes + beer bottle in right hand
    accessory: [
      "................................",
      "................................",
      "................................",
      "................................",
      "................................",
      "................................",
      "................................",
      "................................",
      "................................",
      ".......KGGGGGGGGGGGGK...........",   // sunglasses across eyes
      ".......KGgGGggggGGgGK...........",
      "................................",
      "................................",
      "................................",
      "................................",
      "................................",
      "................................",
      "................................",
      "................................",
      "................................",
      "..................BB............",   // bottle neck
      ".................BbbB...........",
      ".................BbbB...........",
      ".................BBBB...........",
      ".................BlbB...........",   // bottle body w label
      ".................BbbB...........",
      ".................BbbB...........",
      ".................BBBB...........",
    ],
  },

  kreuzfahrt_tourist: {
    palette: skinPal({
      H: 0xc0c0c0, h: 0xe0e0e0,            // grey hair
      C: 0xff8040, c: 0xc05020, B: 0x40c060, // hawaiian orange + green
      P: 0xc0a060, p: 0x806030,             // beige shorts
      O: 0xffffff,
    }),
    // sun hat + camera around neck
    accessory: [
      "................................",
      "......YYYYYYYYYYYYYY............",   // wide hat brim
      "......YyyyYYYYYyyyYY............",
      ".........YYYYYYYY...............",
      ".........YyyyyyYY...............",
      "................................",
      "................................",
      "................................",
      "................................",
      "................................",
      "................................",
      "................................",
      "................................",
      "..............KKKK..............",   // camera body
      ".............KbbbbK.............",
      ".............KbBBbK.............",   // lens
      ".............KbbbbK.............",
      "..............KKKK..............",
    ],
  },

  musical_tourist: {
    palette: skinPal({
      H: 0x804020, h: 0xa05030,
      C: 0x6020a0, c: 0x301050, B: 0xffe040, // purple coat
      P: 0x202020, p: 0x101010,
      O: 0x402010,
    }),
    // playbill in hands + scarf
    accessory: [
      "................................",
      "................................",
      "................................",
      "................................",
      "................................",
      "................................",
      "................................",
      "................................",
      "................................",
      "................................",
      "................................",
      "................................",
      "................................",
      "..........YYYYYYYYY.............",   // scarf
      "..........YyYyYyYyY.............",
      "................................",
      "................................",
      "................................",
      "................................",
      "..............WWWW..............",   // playbill
      ".............WWWWWW.............",
      ".............WyyyyW.............",   // gold text
      ".............WWWWWW.............",
      ".............WWWWWW.............",
    ],
  },

  fischmarkt_tourist: {
    palette: skinPal({
      H: 0x806040, h: 0xa08050,
      C: 0xc0e040, c: 0x709020, B: 0xffe040, // hi-vis yellow
      P: 0x404060, p: 0x202030,
      O: 0x202020,
    }),
    // fish in right hand
    accessory: [
      "................................",
      "................................",
      "................................",
      "................................",
      "................................",
      "................................",
      "................................",
      "................................",
      "................................",
      "................................",
      "................................",
      "................................",
      "................................",
      "................................",
      "................................",
      "................................",
      "................................",
      "................................",
      "................................",
      "................................",
      "................................",
      "................FFFFFF..........",   // fish body
      "..............FFFffffFF.........",
      "..............FfffffffFF........",
      "...............FfFFffFFF........",   // gills
      "..............FFFffffFF.........",
      "................FFFFFF..........",
      "..................FF..F.........",   // tail
    ],
  },

  hafengeburtstag_tourist: {
    palette: skinPal({
      H: 0x402010, h: 0x603020,
      C: 0xffffff, c: 0xa0a0c0, B: 0x002060, // white sailor outfit
      P: 0xffffff, p: 0xc0c0c0,
      O: 0x000060,
    }),
    // paper sailor hat + Franzbrötchen
    accessory: [
      "................................",
      "................................",
      "..........KKKKKKKKKK............",   // paper hat
      ".........KwwwwwwwwwwK...........",
      "........KwwwwwwwwwwwwK..........",
      "........KwwwwwwwwwwwwK..........",
      "................................",
      "................................",
      "................................",
      "................................",
      "................................",
      "................................",
      "................................",
      "................................",
      "................................",
      "................................",
      "................................",
      "................................",
      "................................",
      "...........BBBBBB...............",   // Franzbrötchen
      "..........BbBBBBbB..............",
      "..........BBbbbBBB..............",
      "...........BBBBBB...............",
    ],
  },
};

function skinPal(extra: Palette): Palette {
  return {
    K: 0x101820, // outline
    S: 0xf2c8a0, s: 0xd9a679,
    e: 0x101820, m: 0x6a3030,
    // common accent letters used in accessory grids
    r: 0xff3030, R: 0xc02020,
    L: 0x202020, N: 0xffffff,
    T: 0xc04040, t: 0x801818, w: 0xffffff, W: 0xddccaa, Y: 0xffd040, y: 0xc09020,
    C: 0xffaad4, // cotton candy default — overridden if species defines C
    H: 0xc04040, // heart default — overridden if species defines H
    b: 0x002060, B: 0xc0c0c0, // hat / accents (sport)
    G: 0x101010, g: 0x303030, // sunglasses
    l: 0xe0e040, // bottle label
    F: 0x80a0c0, f: 0xc0d0e0, // fish
    p: 0x808080, // pants shadow default
    P: 0x303030, // pants default
    h: 0x603020, // hair highlight default
    O: 0x202020, // shoes default
    ...extra,
  };
}

// ---------- public sprite factories -----------------------------------------

export interface TouristOptions {
  speciesId: string;
  shiny?: boolean;
  scale?: number;
}

export function tourist(opts: TouristOptions): Container {
  const c = new Container();
  const shinyTex = opts.shiny ? SHINY_TEXTURES[opts.speciesId] : undefined;
  const tex = shinyTex ?? SPECIES_TEXTURES[opts.speciesId];

  if (tex) {
    // Real PNG: draw at 32x32 (the in-game logical sprite size). Source PNG is
    // 64x64 but Pixi will scale-down with the nearest filter — still crisp.
    const sp = new Sprite(tex);
    sp.width = W;
    sp.height = H;
    // Only tint when we don't have a dedicated shiny PNG
    if (opts.shiny && !shinyTex) sp.tint = 0xffe0a0;
    c.addChild(sp);
  } else {
    // Fallback: procedural pixel-grid sprite.
    const art = ART[opts.speciesId];
    const palette = art ? art.palette : skinPal({
      H: 0x402010, h: 0x603020,
      C: 0x408040, c: 0x205020, B: 0xffffff,
      P: 0x202020, p: 0x101010,
      O: 0x202020,
    });
    const finalPal = opts.shiny ? shinyShift(palette) : palette;
    let grid: Grid = BODY;
    if (art?.accessory) grid = overlay(BODY, art.accessory);
    c.addChild(drawGrid(grid, finalPal, { pixelSize: 1 }));
  }

  if (opts.shiny) {
    const star = drawGrid(STAR, { Y: 0xffe040, w: 0xffffff }, { pixelSize: 1 });
    star.x = 1;
    star.y = 1;
    c.addChild(star);
  }

  c.scale.set(opts.scale ?? 1);
  return c;
}

const STAR: Grid = [
  "..w..",
  ".YYY.",
  "wYYYw",
  ".YYY.",
  "..w..",
];

function shinyShift(p: Palette): Palette {
  const out: Palette = { ...p };
  // bias clothing colors toward gold
  for (const k of ["C", "B"] as const) {
    if (out[k] !== undefined) out[k] = mixToward(out[k], 0xffd040, 0.35);
  }
  return out;
}

function mixToward(a: number, b: number, t: number): number {
  const ar = (a >> 16) & 0xff, ag = (a >> 8) & 0xff, ab = a & 0xff;
  const br = (b >> 16) & 0xff, bg = (b >> 8) & 0xff, bb = b & 0xff;
  const r = Math.round(ar + (br - ar) * t);
  const g = Math.round(ag + (bg - ag) * t);
  const bl = Math.round(ab + (bb - ab) * t);
  return (r << 16) | (g << 8) | bl;
}

// ---------- player ----------------------------------------------------------

export type Facing = "down" | "up" | "left" | "right";

const PLAYER_PAL: Palette = {
  K: 0x101820,
  S: 0xf2c8a0, s: 0xd9a679,
  e: 0x101820, m: 0x6a3030,
  H: 0x202020, h: 0x404040,           // black cap/hair
  C: 0xa03030, c: 0x602020, B: 0xffe040, // red jacket + yellow accent
  P: 0x303060, p: 0x181838,
  O: 0x000000,
};

// Player front-facing, frame 0 (legs together)
const PLAYER_DOWN_0: Grid = [
  "................................",
  "................................",
  "................................",
  "..........KKKKKKKK..............",
  ".........KhhhhhhhhK.............",   // cap
  "........KHHHHHHHHHHK............",
  ".......KHHHHHHHHHHHHK...........",
  ".......KSSSSSSSSSSSSK...........",
  ".......KSSSSSSSSSSSSK...........",
  ".......KSeeSSSSSSeeSK...........",
  ".......KSSSSSSSSSSSSK...........",
  ".......KSsSSmmmmSSsSK...........",
  "........KsSSSSSSSSsK............",
  ".........KsssSSsssK.............",
  "..........KKSSSSKK..............",
  ".........KCBCCCCBCK.............",
  "........KCCCCCCCCCCK............",
  ".......KCCCCCCCCCCCCK...........",
  "......KCCCCCCCCCCCCCCK..........",
  "......KCCCCCCCCCCCCCCK..........",
  "......KSCCCCCCCCCCCCSK..........",
  ".......KSCCCCCCCCCCSK...........",
  "........KCCCCCCCCCCK............",
  "........KPPPPPPPPPPK............",
  ".......KPPPPPPPPPPPPK...........",
  ".......KPPPPpppPPPPPK...........",
  ".......KPPPPpppPPPPPK...........",
  ".......KPPPK..KPPPPPK...........",
  ".......KPPPK..KPPPPPK...........",
  "........KPPK..KPPPPK............",
  ".......KOOOK..KOOOOK............",
  "........KKKK..KKKKK.............",
];

// frame 1: shifted leg positions
const PLAYER_DOWN_1: Grid = [
  "................................",
  "................................",
  "................................",
  "..........KKKKKKKK..............",
  ".........KhhhhhhhhK.............",
  "........KHHHHHHHHHHK............",
  ".......KHHHHHHHHHHHHK...........",
  ".......KSSSSSSSSSSSSK...........",
  ".......KSSSSSSSSSSSSK...........",
  ".......KSeeSSSSSSeeSK...........",
  ".......KSSSSSSSSSSSSK...........",
  ".......KSsSSmmmmSSsSK...........",
  "........KsSSSSSSSSsK............",
  ".........KsssSSsssK.............",
  "..........KKSSSSKK..............",
  ".........KCBCCCCBCK.............",
  "........KCCCCCCCCCCK............",
  ".......KCCCCCCCCCCCCK...........",
  "......KCCCCCCCCCCCCCCK..........",
  "......KCCCCCCCCCCCCCCK..........",
  "......KSCCCCCCCCCCCCSK..........",
  ".......KSCCCCCCCCCCSK...........",
  "........KCCCCCCCCCCK............",
  "........KPPPPPPPPPPK............",
  ".......KPPPPPPPPPPPPK...........",
  ".......KPPPPpppPPPPPK...........",
  ".......KPPPPpppPPPPPK...........",
  ".......KPPPPK..KPPPPK...........",
  "........KPPK..KPPPPK............",
  ".........KPK..KPPPPK............",
  "........KOOK.KOOOOK.............",
  "........KKKK..KKKKK.............",
];

const PLAYER_UP_0: Grid = [
  "................................",
  "................................",
  "................................",
  "..........KKKKKKKK..............",
  ".........KhhhhhhhhK.............",
  "........KHHHHHHHHHHK............",
  ".......KHHHHHHHHHHHHK...........",
  ".......KHHHHHHHHHHHHK...........",   // back of head — no face
  ".......KHHHHHHHHHHHHK...........",
  ".......KHHHHHHHHHHHHK...........",
  ".......KHHHHHHHHHHHHK...........",
  ".......KHHHHHHHHHHHHK...........",
  "........KHHHHHHHHHHK............",
  ".........KHHHsHHHHK.............",
  "..........KKsssssKK.............",
  ".........KCBCCCCBCK.............",
  "........KCCCCCCCCCCK............",
  ".......KCCCCCCCCCCCCK...........",
  "......KCCCCCCCCCCCCCCK..........",
  "......KCCCCCCCCCCCCCCK..........",
  "......KCCCCCCCCCCCCCCK..........",
  ".......KCCCCCCCCCCCCK...........",
  "........KCCCCCCCCCCK............",
  "........KPPPPPPPPPPK............",
  ".......KPPPPPPPPPPPPK...........",
  ".......KPPPPpppPPPPPK...........",
  ".......KPPPPpppPPPPPK...........",
  ".......KPPPK..KPPPPPK...........",
  ".......KPPPK..KPPPPPK...........",
  "........KPPK..KPPPPK............",
  ".......KOOOK..KOOOOK............",
  "........KKKK..KKKKK.............",
];

const PLAYER_UP_1 = PLAYER_UP_0; // single back-walk frame is fine for MVP

const PLAYER_LEFT_0: Grid = [
  "................................",
  "................................",
  "................................",
  "..........KKKKKKKK..............",
  ".........KhhhhhhhhK.............",
  "........KHHHHHHHHHHK............",
  ".......KHHHHHHHHHHHHK...........",
  ".......KHHSSSSSSSSSSK...........",
  ".......KHSSSSSSSSSSSK...........",
  ".......KHSeSSSSSSSSSK...........",   // single eye visible
  ".......KHSSSSSSSSSSSK...........",
  ".......KHSSmmSSSSsSSK...........",
  "........KHSSSSSSSsK.............",
  ".........KHsssSSsK..............",
  "..........KKSSSSK...............",
  ".........KCBCCCCBCK.............",
  "........KCCCCCCCCCCK............",
  ".......KCCCCCCCCCCCCK...........",
  "......KCCCCCCCCCCCCCCK..........",
  "......KSCCCCCCCCCCCCK...........",   // arm forward (left side)
  ".......KSCCCCCCCCCCCK...........",
  "........KCCCCCCCCCCCK...........",
  "........KCCCCCCCCCCK............",
  "........KPPPPPPPPPPK............",
  ".......KPPPPPPPPPPPPK...........",
  ".......KPPPPpppPPPPPK...........",
  ".......KPPPPpppPPPPPK...........",
  ".......KPPPK..KPPPPPK...........",
  ".......KPPPK..KPPPPPK...........",
  "........KPPK..KPPPPK............",
  ".......KOOOK..KOOOOK............",
  "........KKKK..KKKKK.............",
];

const PLAYER_LEFT_1 = PLAYER_LEFT_0;

const PLAYER_RIGHT_0: Grid = mirrorGrid(PLAYER_LEFT_0);
const PLAYER_RIGHT_1 = PLAYER_RIGHT_0;

function mirrorGrid(g: Grid): Grid {
  return g.map((r) => r.split("").reverse().join(""));
}

const PLAYER_GRIDS: Record<Facing, [Grid, Grid]> = {
  down: [PLAYER_DOWN_0, PLAYER_DOWN_1],
  up: [PLAYER_UP_0, PLAYER_UP_1],
  left: [PLAYER_LEFT_0, PLAYER_LEFT_1],
  right: [PLAYER_RIGHT_0, PLAYER_RIGHT_1],
};

export function player(facing: Facing = "down", frame: 0 | 1 = 0): Container {
  const tex = PLAYER_TEXTURES[`${facing}_${frame}`];
  if (tex) {
    const c = new Container();
    const sp = new Sprite(tex);
    sp.width = W;
    sp.height = H;
    c.addChild(sp);
    return c;
  }
  return drawGrid(PLAYER_GRIDS[facing][frame], PLAYER_PAL, { pixelSize: 1 });
}

// silhouette for un-caught Kodex entries
const SILH: Grid = [
  "................................",
  "................................",
  "................................",
  "................................",
  "..........KKKKKKKK..............",
  ".........KKKKKKKKKK.............",
  "........KKKKKKKKKKKK............",
  ".......KKKKKKKKKKKKKK...........",
  ".......KKKKKKKKKKKKKK...........",
  ".......KKKKKKKKKKKKKK...........",
  ".......KKKKKKKKKKKKKK...........",
  ".......KKKKKKKKKKKKKK...........",
  "........KKKKKKKKKKKK............",
  ".........KKKKKKKKKK.............",
  "..........KKKKKKKK..............",
  ".........KKKKKKKKKK.............",
  "........KKKKKKKKKKKK............",
  ".......KKKKKKKKKKKKKK...........",
  "......KKKKKKKKKKKKKKKK..........",
  "......KKKKKKKKKKKKKKKK..........",
  "......KKKKKKKKKKKKKKKK..........",
  ".......KKKKKKKKKKKKKK...........",
  "........KKKKKKKKKKKK............",
  "........KKKKKKKKKKKK............",
  ".......KKKKKKKKKKKKKK...........",
  ".......KKKKKKKKKKKKKK...........",
  ".......KKKKKKKKKKKKKK...........",
  ".......KKKK..KKKKKKKK...........",
  ".......KKKK..KKKKKKKK...........",
  "........KKK..KKKKKKK............",
  ".......KKKK..KKKKKKK............",
  "........KKKK..KKKKK.............",
];

export function silhouette(): Container {
  return drawGrid(SILH, { K: 0x202028 }, { pixelSize: 1 });
}

// Used by older callers that expected a 32x32 default size
export const SPRITE_W = W;
export const SPRITE_H = H;
