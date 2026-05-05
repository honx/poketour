import { Application, Container, Graphics, Text } from "pixi.js";

import { api } from "./api";
import { audio } from "./audio";
import { attachInput, clearJustPressed, consume } from "./input";
import { Encounter, type EncounterPayload } from "./scenes/encounter";
import { Kodex } from "./scenes/kodex";
import { Overworld } from "./scenes/overworld";
import { Settings } from "./scenes/settings";
import { Title } from "./scenes/title";
import type { SceneHost } from "./scenes/scene-host";
import { preloadTouristAssets } from "./sprites";

const VIEW_W = 640;
const VIEW_H = 480;

interface Scene {
  view: Container;
  enter(): void;
  exit(): void;
  onResume?(): void;
}

class Game implements SceneHost {
  app: Application;
  current: Scene | null = null;
  overworld!: Overworld;
  status: Text;
  muteBtn: Container;
  muteLabel: Text;

  constructor(app: Application) {
    this.app = app;
    this.status = new Text({
      text: "loading…",
      style: { fontFamily: "monospace", fontSize: 11, fill: 0xaaaaaa },
    });
    this.status.x = 8;
    this.status.y = VIEW_H - 16;
    this.app.stage.addChild(this.status);

    this.muteBtn = new Container();
    const bg = new Graphics()
      .roundRect(0, 0, 36, 24, 4)
      .fill(0x101820)
      .stroke({ color: 0xffffff, width: 1 });
    this.muteBtn.addChild(bg);
    this.muteLabel = new Text({
      text: "♪ ON",
      style: { fontFamily: "monospace", fontSize: 11, fill: 0xffffff, fontWeight: "bold" },
    });
    this.muteLabel.x = 5;
    this.muteLabel.y = 5;
    this.muteBtn.addChild(this.muteLabel);
    this.muteBtn.x = VIEW_W - 44;
    this.muteBtn.y = 8;
    this.muteBtn.eventMode = "static";
    this.muteBtn.cursor = "pointer";
    this.muteBtn.on("pointertap", () => {
      audio.unlock();
      this.toggleMute();
    });
    this.app.stage.addChild(this.muteBtn);
  }

  private toggleMute() {
    const muted = audio.toggleMute();
    this.muteLabel.text = muted ? "♪ OFF" : "♪ ON";
    this.muteLabel.style.fill = muted ? 0x888888 : 0xffffff;
  }

  async start() {
    try {
      const h = await api.health();
      const p = await api.player();
      this.status.text = `connected · player #${p.id} · ${h.species} species, ${h.events} events`;
    } catch (e) {
      this.status.text = `backend offline: ${(e as Error).message}`;
    }

    await preloadTouristAssets();

    this.overworld = new Overworld(this.app, this);
    this.swap(new Title(this.app, this));

    // Global hotkeys for the overworld:
    //   Enter  → Kodex
    //   E      → Settings (event-active overrides)
    //   R      → restore items + balls
    //   M      → mute toggle (works in any scene)
    this.app.ticker.add(() => {
      if (consume("mute")) this.toggleMute();
      if (this.current !== this.overworld) return;
      if (consume("menu")) this.go("kodex");
      if (consume("settings")) this.go("settings");
      if (consume("reset")) void this.resetInventory();
    });
  }

  async resetInventory() {
    try {
      const inv = await api.reset();
      const itemCount = Object.values(inv.items).reduce((a, b) => a + b, 0);
      const ballCount = Object.values(inv.balls).reduce((a, b) => a + b, 0);
      this.status.text = `inventory restored · ${itemCount} items, ${ballCount} balls`;
    } catch (e) {
      this.status.text = `reset failed: ${(e as Error).message}`;
    }
  }

  go(name: "title" | "overworld" | "encounter" | "kodex" | "settings", payload?: unknown): void {
    if (name === "title") {
      this.swap(new Title(this.app, this));
    } else if (name === "overworld") {
      this.swap(this.overworld);
      this.overworld.onResume();
    } else if (name === "encounter") {
      const enc = new Encounter(this.app, this, payload as EncounterPayload);
      this.swap(enc);
    } else if (name === "kodex") {
      const kx = new Kodex(this.app, this);
      this.swap(kx);
    } else if (name === "settings") {
      const st = new Settings(this.app, this);
      this.swap(st);
    }
  }

  private swap(next: Scene) {
    if (this.current) {
      this.current.exit();
      this.app.stage.removeChild(this.current.view);
    }
    // Drop any one-shot key presses that happened during the transition. Without
    // this, a tap that lands while the new scene is being constructed gets
    // consumed by its first tick — e.g. landing in the Items submenu instead
    // of the encounter root menu because A was tapped just as the scene
    // swapped in.
    clearJustPressed();
    this.current = next;
    this.app.stage.addChildAt(next.view, 0);
    next.enter();
  }
}

async function main() {
  const app = new Application();
  await app.init({
    width: VIEW_W,
    height: VIEW_H,
    background: "#101820",
    antialias: false,
    roundPixels: true,
  });
  document.getElementById("game")!.appendChild(app.canvas);
  attachInput();

  const game = new Game(app);
  await game.start();
}

main().catch((e) => {
  console.error(e);
  document.body.innerHTML = `<pre style="color:#f88">${(e as Error).stack}</pre>`;
});
