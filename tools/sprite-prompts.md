# Sprite generation prompts

Prompts for generating replacement art for the placeholder sprites in
`frontend/src/sprites.ts`. Once real sprite PNGs are produced and dropped into
`frontend/public/assets/sprites/`, swap the procedural pixel-grid renderer for
a `Texture.from(...)` lookup keyed by species id.

## Master sprite-sheet prompt

```
A 16-bit JRPG sprite sheet, SNES-era pixel art style (reference: Earthbound,
Chrono Trigger, Final Fantasy VI overworld characters). 10 distinct human
character sprites arranged in a 5×2 grid, each cell 32×32 pixels, transparent
background, sharp pixel edges with NO anti-aliasing, NO blur, NO drop shadows.
Limited 16-color palette per character. Top-down ¾-view, each character
front-facing, single standing pose, full body visible head to toe.

The 10 characters are stylized Hamburg event tourists, drawn with strong
silhouette differences so they read at a glance:

  Row 1 (left to right):
   1. SPORT-TOURIST: athletic build, blue football jersey with white stripes,
      black shorts, white sneakers, red sweatband, single sweat drop on cheek.
   2. OMR-TOURIST: skinny jeans, black hoodie, white sneakers, big white
      conference lanyard with yellow badge over chest, holding a phone.
   3. INTERNORGA-TOURIST: beige blazer, dark trousers, brown shoes, oversized
      red canvas tote bag overflowing with food samples (a sausage poking out).
   4. DOM-TOURIST: red zip-up hoodie, blue jeans, brown shoes, holding a stick
      of pink cotton candy in right hand and a heart-shaped Lebkuchen
      gingerbread on a ribbon in left hand.
   5. HANSEBOOT-TOURIST: navy-blue captain's cap with white band, white sailor
      shirt with horizontal navy stripes, navy trousers, black boots, small
      gold anchor pin on chest.

  Row 2 (left to right):
   6. REEPERBAHN-TOURIST: black leather jacket, dark jeans, black boots, black
      sunglasses, holding a brown beer bottle in right hand.
   7. KREUZFAHRT-TOURIST: wide-brimmed straw sun hat, bright orange Hawaiian
      shirt with green leaves, beige shorts, white sneakers, large black
      camera hanging on neck strap.
   8. MUSICAL-TOURIST: purple knee-length coat, red-and-yellow striped scarf,
      black trousers, brown shoes, holding a yellow theatre playbill in front.
   9. FISCHMARKT-TOURIST: hi-vis yellow rain jacket, dark trousers, black
      rubber boots, holding a silver fish in right hand.
  10. HAFENGEBURTSTAG-TOURIST: white-and-navy paper sailor hat, white sailor
      collar with navy trim, white shirt, white trousers, navy shoes, holding
      a brown Franzbrötchen pastry.

Style: clean readable pixel art, bold outlines (1px black), saturated colors,
no gradients, no rendering, no realism, just crisp 32×32 retro game sprites.
```

## Per-character solo prompts

Use these if the sheet generation comes out muddy. Run one at a time at 256×256
or 512×512 → downscale to 32×32 in Aseprite/GIMP with **nearest-neighbor**.

```
[CHARACTER]: 16-bit SNES JRPG sprite, 32×32 pixels, top-down ¾ view,
front-facing standing pose, full body, transparent background, sharp pixels,
no anti-aliasing, 16-color limited palette, 1px black outline. [DESCRIPTION]
Style reference: Earthbound, Chrono Trigger NPC sprites.
```

Replace `[CHARACTER]` and `[DESCRIPTION]` with each entry from the master prompt.

## Player character (4 facings × 2 walk frames)

```
A 16-bit JRPG player character sprite sheet, 8 cells in a 4×2 grid,
each cell 32×32 pixels, transparent background, sharp pixel art, no
anti-aliasing, 1px black outlines, limited palette.

Same character in all 8 cells: a young trainer in a black flat cap with yellow
band, dark red bomber jacket with yellow trim, navy jeans, black boots.

Layout (left to right, top to bottom):
  Row 1: facing DOWN (toward camera) — frame A (idle, legs together),
         facing DOWN — frame B (walk, left leg forward),
         facing UP (away from camera) — frame A,
         facing UP — frame B.
  Row 2: facing LEFT — frame A,
         facing LEFT — frame B,
         facing RIGHT — frame A,
         facing RIGHT — frame B.

Reference style: Pokemon Gen 3 / Fire Red Leaf Green overworld trainer sprites,
Earthbound NESS-era proportions. Crisp readable 32×32 sprites.
```

## Shiny variants

For each tourist, optionally generate a "shiny" recolor:

```
Same character as before, identical pose and proportions, recolored with a
shifted palette: clothing tinted toward warm gold/amber tones, hair slightly
lighter, accessory color shifted to a complementary hue. Add a small white
4-point sparkle in the upper-left of the sprite cell.
```

## Tile / environment prompts (later)

For when the procedural tile renderer in `tilemap.ts` gets replaced with a
real tileset:

```
A 16-bit top-down JRPG tileset, 32×32 tiles, 8×8 grid (64 tiles), transparent
where appropriate, sharp pixel art, SNES-era. Tiles needed:
- Hamburg cobblestone street (light and dark variants, edges)
- North-German red brick building wall (with lit yellow window variant)
- Modern glass-and-tan exhibition hall facade (Messehallen)
- Asphalt road with yellow center stripe
- Concrete sidewalk with seam grid
- Park grass (dark) and path grass (light), tufts variant
- Deciduous tree, full canopy from above
- Wooden fence (post and rail)
- Market stall with red-white striped awning
- U-Bahn entrance (blue "U" sign on tan paving)
- Funfair ride paving (Dom): pink and yellow checkered
```

## Workflow tips

1. **Most AI models cannot produce pixel-perfect 32×32.** Generate at 512×512
   or higher, then downscale with nearest-neighbor in Aseprite or GIMP.
2. **Negative prompt** (if supported): `blurry, anti-aliased, smooth gradients,
   3d render, photorealistic, drop shadow, glow effects, jpeg artifacts,
   oversaturated`.
3. **Best models tested**: Midjourney v6 (`--style raw`), Stable Diffusion XL
   with a pixel-art LoRA (search Civitai for "pixel art" / "JRPG"), Imagen 3
   for clean style. DALL-E 3 understands the request but rarely outputs true
   pixels.
4. **Consistency across the sheet is the hard part.** If a sheet generation
   produces inconsistent styles, generate each character solo with the same
   seed + style suffix and composite in Aseprite.
5. **Final cleanup is manual.** Plan ~10–20 min per sprite in Aseprite to
   reduce to 16 colors and tidy stray pixels. AI gets you 80% there.

## Wiring real PNGs back in

When sprites are ready:

1. Drop them into `frontend/public/assets/sprites/tourists/{species_id}.png`
   and a single `frontend/public/assets/sprites/player.png` sheet.
2. In `frontend/src/sprites.ts`, replace the body of `tourist()` and `player()`
   with `Texture.from(url)` lookups + `new Sprite(texture)`. The pixel-grid
   functions can stay as a fallback for any species without an asset.
3. Keep the `speciesId → filename` mapping the same as the YAML id
   (`dom_tourist.png`, `omr_tourist.png`, etc.) so no extra config is needed.
