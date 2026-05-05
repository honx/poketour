// Kodex screen: grid of all species, silhouette for uncaught, full sprite for
// caught, gold star for shiny-caught.

import { Application, Container, Graphics, Text } from "pixi.js";

import { api, type KodexEntry } from "../api";
import { audio } from "../audio";
import { consume } from "../input";
import { silhouette, tourist } from "../sprites";
import type { SceneHost } from "./scene-host";

const VIEW_W = 640;
const VIEW_H = 480;
const FONT = { fontFamily: "monospace", fontSize: 14, fill: 0xffffff } as const;
const FONT_SMALL = { fontFamily: "monospace", fontSize: 11, fill: 0xddddee } as const;
const FONT_BIG = { fontFamily: "monospace", fontSize: 22, fill: 0xffffff, fontWeight: "bold" } as const;

export class Kodex {
  view: Container;
  private app: Application;
  private host: SceneHost;
  private grid: Container;

  constructor(app: Application, host: SceneHost) {
    this.app = app;
    this.host = host;
    this.view = new Container();

    const bg = new Graphics().rect(0, 0, VIEW_W, VIEW_H).fill(0x080814);
    this.view.addChild(bg);

    const title = new Text({ text: "TOURISTEN-KODEX", style: FONT_BIG });
    title.x = 20;
    title.y = 12;
    this.view.addChild(title);

    const hint = new Text({ text: "X / Esc / Enter to close   ·   R to refill items", style: FONT_SMALL });
    hint.x = VIEW_W - 360;
    hint.y = 22;
    this.view.addChild(hint);

    this.grid = new Container();
    this.grid.x = 20;
    this.grid.y = 60;
    this.view.addChild(this.grid);

    this.load();
  }

  enter() {
    this.app.ticker.add(this.tick);
    audio.playLoop("ambient");
  }

  exit() {
    this.app.ticker.remove(this.tick);
  }

  private tick = () => {
    if (consume("cancel") || consume("menu")) {
      this.host.go("overworld");
    }
    if (consume("reset")) {
      void api.reset();
    }
  };

  private async load() {
    let entries: KodexEntry[] = [];
    try {
      entries = await api.kodex();
    } catch {
      const t = new Text({ text: "(failed to load Kodex)", style: FONT });
      this.grid.addChild(t);
      return;
    }

    const cellW = 200;
    const cellH = 110;
    const cols = 3;
    entries.forEach((e, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const cell = new Container();
      cell.x = col * cellW;
      cell.y = row * cellH;

      const frame = new Graphics()
        .rect(0, 0, cellW - 10, cellH - 10)
        .fill(e.caught ? 0x183038 : 0x101820)
        .stroke({ color: e.caught ? 0xa0c0d0 : 0x303040, width: 1 });
      cell.addChild(frame);

      const sprite = e.caught
        ? tourist({ speciesId: e.species_id, shiny: e.shiny_caught, scale: 2 })
        : silhouette();
      sprite.x = 8;
      sprite.y = 14;
      if (!e.caught) sprite.scale.set(2);
      cell.addChild(sprite);

      const name = new Text({
        text: e.caught ? e.name : "???",
        style: { ...FONT, fill: e.caught ? 0xffffff : 0x707080 },
      });
      name.x = 80;
      name.y = 20;
      cell.addChild(name);

      const sub = new Text({
        text: e.caught
          ? `caught ×${e.total_caught}${e.shiny_caught ? "  ★ shiny" : ""}`
          : "not yet seen",
        style: FONT_SMALL,
      });
      sub.x = 80;
      sub.y = 44;
      cell.addChild(sub);

      this.grid.addChild(cell);
    });

    const total = entries.length;
    const caught = entries.filter((e) => e.caught).length;
    const shinies = entries.filter((e) => e.shiny_caught).length;
    const summary = new Text({
      text: `Caught: ${caught}/${total}    Shinies: ${shinies}`,
      style: FONT,
    });
    summary.x = 20;
    summary.y = VIEW_H - 30;
    this.view.addChild(summary);
  }
}
