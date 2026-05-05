// Encounter scene: classic Pokemon battle layout, but the "fight" is
// persuasion. Top: tourist sprite + Skepsis bar + flavor. Bottom: log box
// and 4-button menu (Item / Ball / Talk / Run). Item and Ball open submenus.

import { Application, Container, Graphics, Text } from "pixi.js";

import { api, type EncounterState, type Inventory, type SpeciesOut } from "../api";
import { audio } from "../audio";
import { consume } from "../input";
import type { SceneHost } from "./scene-host";
import { tourist as makeTouristSprite } from "../sprites";

const VIEW_W = 640;
const VIEW_H = 480;

const FONT = { fontFamily: "monospace", fontSize: 14, fill: 0xffffff } as const;
const FONT_BIG = { fontFamily: "monospace", fontSize: 18, fill: 0xffffff, fontWeight: "bold" } as const;
const FONT_SMALL = { fontFamily: "monospace", fontSize: 11, fill: 0xddddee } as const;

export interface EncounterPayload {
  species: SpeciesOut;
  shiny: boolean;
}

type Menu = "main" | "items" | "balls" | "log" | "ended";

interface Choice {
  label: string;
  onSelect: () => void;
}

export class Encounter {
  view: Container;
  private app: Application;
  private host: SceneHost;
  private state: EncounterState;
  private inventory: Inventory = { items: {}, balls: {} };

  private skepsisBar: Graphics;
  private skepsisLabel: Text;
  private touristContainer: Container;
  private logBox: Text;
  private menuContainer: Container;
  private menu: Menu = "main";
  private choices: Choice[] = [];
  private cursor = 0;
  private cursorSprite: Graphics;
  private busy = false;

  constructor(app: Application, host: SceneHost, payload: EncounterPayload) {
    this.app = app;
    this.host = host;
    this.view = new Container();

    // Battle background — themed by the species' primary zone so a Dom-Tourist
    // shows up on the funfair, an OMR-Tourist in front of the Messe glass, etc.
    this.view.addChild(buildBattleBg(payload.species.zones[0] ?? null));

    // Tourist plinth (top-right)
    const plinth = new Graphics().ellipse(VIEW_W - 130, 170, 90, 14).fill(0x000000);
    plinth.alpha = 0.4;
    this.view.addChild(plinth);

    this.touristContainer = new Container();
    const sprite = makeTouristSprite({ speciesId: payload.species.id, shiny: payload.shiny, scale: 3 });
    sprite.x = VIEW_W - 130 - 48;
    sprite.y = 170 - 96;
    this.touristContainer.addChild(sprite);
    this.view.addChild(this.touristContainer);

    // Tourist info card (top-left)
    const card = new Graphics()
      .rect(20, 20, 280, 80)
      .fill(0x101820)
      .stroke({ color: 0xffffff, width: 2 });
    this.view.addChild(card);

    const nameTxt = new Text({
      text: (payload.shiny ? "★ " : "") + payload.species.name,
      style: FONT_BIG,
    });
    nameTxt.x = 32;
    nameTxt.y = 28;
    this.view.addChild(nameTxt);

    const skepLbl = new Text({ text: "Skepsis", style: FONT_SMALL });
    skepLbl.x = 32;
    skepLbl.y = 52;
    this.view.addChild(skepLbl);

    // Skepsis bar background
    const barBg = new Graphics().rect(32, 68, 256, 12).fill(0x202828).stroke({ color: 0x506060, width: 1 });
    this.view.addChild(barBg);

    this.skepsisBar = new Graphics();
    this.skepsisBar.x = 32;
    this.skepsisBar.y = 68;
    this.view.addChild(this.skepsisBar);

    this.skepsisLabel = new Text({ text: "", style: FONT_SMALL });
    this.skepsisLabel.x = 32;
    this.skepsisLabel.y = 84;
    this.view.addChild(this.skepsisLabel);

    // Bottom dialog/menu box
    const box = new Graphics()
      .rect(8, 320, VIEW_W - 16, 152)
      .fill(0x101820)
      .stroke({ color: 0xffffff, width: 2 });
    this.view.addChild(box);

    this.logBox = new Text({ text: "", style: { ...FONT, wordWrap: true, wordWrapWidth: 380 } });
    this.logBox.x = 24;
    this.logBox.y = 332;
    this.view.addChild(this.logBox);

    this.menuContainer = new Container();
    this.menuContainer.x = 420;
    this.menuContainer.y = 332;
    this.view.addChild(this.menuContainer);

    this.cursorSprite = new Graphics().poly([0, 0, 10, 6, 0, 12]).fill(0xffe040);
    this.menuContainer.addChild(this.cursorSprite);

    // Initial state from server (encounter was started by /step on backend)
    this.state = {
      species_id: payload.species.id,
      shiny: payload.shiny,
      skepsis: payload.species.max_skepsis,
      max_skepsis: payload.species.max_skepsis,
      ended: false,
      outcome: null,
      log: [`A wild ${payload.shiny ? "Shiny " : ""}${payload.species.name} appeared!`, payload.species.flavor],
    };
    this.refresh();

    // Load inventory + authoritative encounter state
    this.bootstrap();

    this.setMenu("main");
  }

  enter() {
    this.app.ticker.add(this.tick);
    audio.playLoop("battle");
  }

  exit() {
    this.app.ticker.remove(this.tick);
  }

  private async bootstrap() {
    try {
      const [inv, server] = await Promise.all([api.inventory(), api.encounter()]);
      this.inventory = inv;
      if (server) this.state = server;
      this.refresh();
    } catch {
      // backend hiccup — keep local state
    }
  }

  private tick = () => {
    if (this.busy) return;
    if (consume("up")) this.move(-1);
    else if (consume("down")) this.move(+1);
    else if (consume("confirm")) this.select();
    else if (consume("cancel")) this.cancel();
  };

  private move(dir: number) {
    if (!this.choices.length) return;
    this.cursor = (this.cursor + dir + this.choices.length) % this.choices.length;
    audio.sfx("menu_move");
    this.layoutMenu();
  }

  private select() {
    const c = this.choices[this.cursor];
    if (c) {
      audio.sfx("menu_confirm");
      c.onSelect();
    }
  }

  private cancel() {
    if (this.menu === "items" || this.menu === "balls") {
      audio.sfx("menu_cancel");
      this.setMenu("main");
    } else if (this.menu === "ended") {
      this.exitToOverworld();
    }
  }

  private setMenu(m: Menu) {
    this.menu = m;
    this.cursor = 0;
    if (m === "main") {
      this.choices = [
        { label: "Item", onSelect: () => this.setMenu("items") },
        { label: "Ball", onSelect: () => this.setMenu("balls") },
        { label: "Talk", onSelect: () => this.doTalk() },
        { label: "Run",  onSelect: () => this.doRun() },
      ];
    } else if (m === "items") {
      const entries = Object.entries(this.inventory.items).filter(([, q]) => q > 0);
      this.choices = entries.map(([id, q]) => ({
        label: `${pretty(id)} ×${q}`,
        onSelect: () => this.doItem(id),
      }));
      if (!this.choices.length) this.choices = [{ label: "(no items) — Back", onSelect: () => this.setMenu("main") }];
      this.choices.push({ label: "← Back", onSelect: () => this.setMenu("main") });
    } else if (m === "balls") {
      const entries = Object.entries(this.inventory.balls).filter(([, q]) => q > 0);
      this.choices = entries.map(([id, q]) => ({
        label: `${pretty(id)} ×${q}`,
        onSelect: () => this.doThrow(id),
      }));
      if (!this.choices.length) this.choices = [{ label: "(no balls) — Back", onSelect: () => this.setMenu("main") }];
      this.choices.push({ label: "← Back", onSelect: () => this.setMenu("main") });
    } else if (m === "ended") {
      this.choices = [{ label: "Continue ▶", onSelect: () => this.exitToOverworld() }];
    }
    this.layoutMenu();
  }

  private layoutMenu() {
    // Clear existing menu text children (keep cursor)
    for (let i = this.menuContainer.children.length - 1; i >= 0; i--) {
      const ch = this.menuContainer.children[i];
      if (ch !== this.cursorSprite) this.menuContainer.removeChild(ch);
    }
    let y = 0;
    this.choices.forEach((c, idx) => {
      const t = new Text({ text: c.label, style: FONT });
      t.x = 18;
      t.y = y;
      this.menuContainer.addChild(t);
      if (idx === this.cursor) {
        this.cursorSprite.x = 0;
        this.cursorSprite.y = y + 4;
      }
      y += 22;
    });
  }

  private async doItem(itemId: string) {
    this.busy = true;
    try {
      const s = await api.useItem(itemId);
      this.state = s;
      const inv = await api.inventory();
      this.inventory = inv;
      audio.sfx("item");
      this.refresh();
      this.afterAction();
    } catch (e) {
      this.appendLog(`(can't: ${(e as Error).message})`);
    } finally {
      this.busy = false;
    }
  }

  private async doTalk() {
    this.busy = true;
    try {
      this.state = await api.talk();
      this.refresh();
      this.afterAction();
    } finally {
      this.busy = false;
    }
  }

  private async doThrow(ballId: string) {
    this.busy = true;
    audio.sfx("ball_throw");
    try {
      this.state = await api.throwBall(ballId);
      const inv = await api.inventory();
      this.inventory = inv;
      if (this.state.outcome === "caught") audio.sfx("caught");
      else if (this.state.outcome === "fled") audio.sfx("fail");
      this.refresh();
      this.afterAction();
    } catch (e) {
      this.appendLog(`(can't: ${(e as Error).message})`);
    } finally {
      this.busy = false;
    }
  }

  private async doRun() {
    this.busy = true;
    try {
      this.state = await api.run();
      this.refresh();
      this.afterAction();
    } finally {
      this.busy = false;
    }
  }

  private afterAction() {
    if (this.state.ended) {
      // Animate sprite based on outcome
      if (this.state.outcome === "caught") {
        this.touristContainer.alpha = 0.3;
      } else if (this.state.outcome === "fled" || this.state.outcome === "ran") {
        this.touristContainer.x += 60;
        this.touristContainer.alpha = 0.5;
      }
      this.setMenu("ended");
    } else {
      this.setMenu("main");
    }
  }

  private appendLog(line: string) {
    this.state.log.push(line);
    this.refresh();
  }

  private refresh() {
    const ratio = Math.max(0, this.state.skepsis / this.state.max_skepsis);
    this.skepsisBar.clear();
    const w = Math.round(256 * ratio);
    const color = ratio > 0.5 ? 0x40c060 : ratio > 0.2 ? 0xe0c040 : 0xe04040;
    this.skepsisBar.rect(0, 0, w, 12).fill(color);
    this.skepsisLabel.text = `${this.state.skepsis} / ${this.state.max_skepsis}`;

    // Show last 4 log lines
    const tail = this.state.log.slice(-4);
    this.logBox.text = tail.join("\n");
  }

  private exitToOverworld() {
    this.host.go("overworld");
  }
}

function pretty(id: string): string {
  return id
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

// Stable per-zone PRNG so star/light positions don't flicker between frames.
function mulberry32(a: number): () => number {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function buildBattleBg(zone: string | null): Container {
  const c = new Container();
  const g = new Graphics();
  c.addChild(g);
  const HZ = 280; // horizon line — sprites stand around y=170 plinth

  switch (zone) {
    case "messehallen": {
      // Convention center: dusk sky, tan facade with glass bands + spotlights
      g.rect(0, 0, VIEW_W, HZ).fill(0x4a3858);
      g.rect(0, 0, VIEW_W, 90).fill(0x6a4868);
      // Spotlight cones
      g.poly([90, 0, 200, HZ, 60, HZ]).fill({ color: 0xffe8a0, alpha: 0.08 });
      g.poly([VIEW_W - 90, 0, VIEW_W - 60, HZ, VIEW_W - 200, HZ]).fill({ color: 0xffe8a0, alpha: 0.08 });
      // Messehallen facade — three tan modules with glass bands
      for (let i = 0; i < 3; i++) {
        const x = 60 + i * 180;
        g.rect(x, 140, 160, HZ - 140).fill(0xc8b878);
        g.rect(x + 4, 150, 152, 18).fill(0x9aa8c0);
        g.rect(x + 4, 180, 152, 18).fill(0x9aa8c0);
        g.rect(x + 4, 210, 152, 18).fill(0x9aa8c0);
        g.rect(x, 138, 160, 2).fill(0x806040);
      }
      // Ground (asphalt forecourt)
      g.rect(0, HZ, VIEW_W, VIEW_H - HZ).fill(0x2a2a30);
      g.rect(0, HZ, VIEW_W, 4).fill(0x806040);
      // Lane markings
      for (let i = 0; i < 8; i++) g.rect(40 + i * 80, HZ + 60, 40, 3).fill(0xc0c040);
      break;
    }

    case "heiligengeistfeld": {
      // Dom funfair: starry night, Riesenrad silhouette, fairground lights
      g.rect(0, 0, VIEW_W, HZ).fill(0x0a0820);
      g.rect(0, 0, VIEW_W, 80).fill(0x1a0c30);
      const rng = mulberry32(0x4f);
      for (let i = 0; i < 60; i++) {
        const sx = Math.floor(rng() * VIEW_W);
        const sy = Math.floor(rng() * (HZ - 40));
        g.rect(sx, sy, 1, 1).fill(0xffffff);
      }
      // Riesenrad (Ferris wheel) — center-left
      const wx = 180, wy = 160, wr = 90;
      g.circle(wx, wy, wr).stroke({ color: 0xa0a0c0, width: 2 });
      g.circle(wx, wy, 8).fill(0x808090);
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        const ex = wx + Math.cos(a) * wr;
        const ey = wy + Math.sin(a) * wr;
        g.moveTo(wx, wy).lineTo(ex, ey).stroke({ color: 0x808090, width: 1 });
        g.rect(ex - 6, ey - 4, 12, 8).fill(i % 3 === 0 ? 0xe04040 : i % 3 === 1 ? 0x40a0e0 : 0xffd64a);
      }
      // String of lights
      for (let i = 0; i < 16; i++) {
        const lx = 320 + i * 20;
        const ly = 90 + Math.sin(i * 0.7) * 8;
        g.circle(lx, ly, 2).fill(i % 2 === 0 ? 0xffd64a : 0xe04040);
      }
      // Ground (trampled grass + sawdust)
      g.rect(0, HZ, VIEW_W, VIEW_H - HZ).fill(0x4a3a20);
      g.rect(0, HZ, VIEW_W, 4).fill(0x2a200a);
      break;
    }

    case "karolinenstrasse":
    case "marktstrasse": {
      // Reeperbahn-ish night street: brick walls, neon signs
      g.rect(0, 0, VIEW_W, HZ).fill(0x100818);
      g.rect(0, 0, VIEW_W, 110).fill(0x1a0820);
      // Brick wall blocks behind
      for (let by = 110; by < HZ; by += 10) {
        const off = (by / 10) % 2 === 0 ? 0 : 16;
        for (let bx = -16; bx < VIEW_W; bx += 32) {
          g.rect(bx + off, by, 30, 8).fill(0x40181c);
          g.rect(bx + off, by, 30, 1).fill(0x2a0a10);
        }
      }
      // Lit windows scattered
      const rng = mulberry32(0xae);
      for (let i = 0; i < 14; i++) {
        const x = Math.floor(rng() * (VIEW_W - 24));
        const y = 130 + Math.floor(rng() * 100);
        g.rect(x, y, 14, 18).fill(0xffe080).stroke({ color: 0x101010, width: 1 });
      }
      // Neon "ASTRA" sign top-left
      g.rect(40, 30, 140, 36).fill(0x100408).stroke({ color: 0xff4080, width: 2 });
      const astra = new Text({
        text: "ASTRA",
        style: { fontFamily: "monospace", fontSize: 22, fill: 0xff80c0, fontWeight: "bold" },
      });
      astra.x = 60;
      astra.y = 36;
      c.addChild(astra);
      // Neon "BAR" top-right
      g.rect(VIEW_W - 130, 50, 90, 30).fill(0x100408).stroke({ color: 0x40e0ff, width: 2 });
      const bar = new Text({
        text: "BAR",
        style: { fontFamily: "monospace", fontSize: 18, fill: 0x80f0ff, fontWeight: "bold" },
      });
      bar.x = VIEW_W - 110;
      bar.y = 56;
      c.addChild(bar);
      // Cobble street
      g.rect(0, HZ, VIEW_W, VIEW_H - HZ).fill(0x2a241e);
      for (let cy = HZ + 4; cy < VIEW_H; cy += 8) {
        const off = ((cy - HZ) / 8) % 2 === 0 ? 0 : 4;
        for (let cx = -4; cx < VIEW_W; cx += 8) {
          g.rect(cx + off + 1, cy + 1, 6, 6).fill(0x4a4038);
          g.rect(cx + off + 1, cy + 1, 6, 1).fill(0x6a5e52);
        }
      }
      break;
    }

    case "millerntor": {
      // St. Pauli stadium edge: brick wall, FC banner, day pitch
      g.rect(0, 0, VIEW_W, 60).fill(0x6890b8);
      g.rect(0, 60, VIEW_W, HZ - 60).fill(0x401818);
      // Brick courses
      for (let by = 60; by < HZ; by += 10) {
        const off = (by / 10) % 2 === 0 ? 0 : 16;
        for (let bx = -16; bx < VIEW_W; bx += 32) {
          g.rect(bx + off, by, 30, 8).fill(0x5a2418);
          g.rect(bx + off, by, 30, 1).fill(0x2a0a10);
        }
      }
      // FC St. Pauli banner: brown w/ white skull-square
      g.rect(220, 100, 200, 80).fill(0x3a201a).stroke({ color: 0xffffff, width: 2 });
      g.rect(280, 120, 80, 40).fill(0xffffff);
      g.circle(320, 138, 10).fill(0x000000);
      g.rect(312, 144, 4, 16).fill(0x000000);
      g.rect(324, 144, 4, 16).fill(0x000000);
      // Pitch
      g.rect(0, HZ, VIEW_W, VIEW_H - HZ).fill(0x2a6a2a);
      for (let i = 0; i < 5; i++) {
        g.rect(0, HZ + i * 40, VIEW_W, 20).fill(i % 2 === 0 ? 0x3a7a3a : 0x2a6a2a);
      }
      g.rect(0, HZ, VIEW_W, 3).fill(0xffffff);
      break;
    }

    case "feldstrasse": {
      // Hochbunker concrete monolith + grey sky
      g.rect(0, 0, VIEW_W, HZ).fill(0x707880);
      g.rect(0, 0, VIEW_W, 80).fill(0x808890);
      // Bunker block
      g.rect(80, 100, 480, HZ - 100).fill(0x484a4c);
      g.rect(80, 100, 480, 4).fill(0x303234);
      // concrete texture lines
      for (let by = 110; by < HZ; by += 28) g.rect(80, by, 480, 1).fill(0x383a3c);
      for (let bx = 120; bx < 560; bx += 60) g.rect(bx, 100, 1, HZ - 100).fill(0x383a3c);
      // tiny window slits
      for (let i = 0; i < 6; i++) g.rect(140 + i * 70, 200, 12, 4).fill(0x101418);
      // U-Bahn sign on the bunker
      g.rect(290, 240, 60, 30).fill(0x004a90);
      const u = new Text({
        text: "U",
        style: { fontFamily: "monospace", fontSize: 22, fill: 0xffffff, fontWeight: "bold" },
      });
      u.x = 312;
      u.y = 245;
      c.addChild(u);
      // Cobble sidewalk
      g.rect(0, HZ, VIEW_W, VIEW_H - HZ).fill(0x6e6258);
      g.rect(0, HZ, VIEW_W, 3).fill(0x404040);
      break;
    }

    default: {
      // Fallback: park / Planten un Blomen daytime
      g.rect(0, 0, VIEW_W, HZ).fill(0x88b8d8);
      g.rect(0, 0, VIEW_W, 100).fill(0xa8d0e8);
      // distant tree line
      const rng = mulberry32(0x91);
      for (let i = 0; i < 14; i++) {
        const tx = Math.floor(rng() * VIEW_W);
        const ty = HZ - 30 - Math.floor(rng() * 20);
        g.circle(tx, ty, 24).fill(0x2a4a25);
        g.circle(tx + 8, ty - 6, 18).fill(0x3a6a30);
      }
      g.rect(0, HZ, VIEW_W, VIEW_H - HZ).fill(0x4a7a3a);
      g.rect(0, HZ, VIEW_W, 3).fill(0x2a4a25);
    }
  }

  return c;
}
