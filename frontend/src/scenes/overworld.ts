// Overworld: tilemap + camera-following player. Reports each completed step
// to /step which may roll a random encounter; on encounter it hands control
// to the encounter scene via the SceneHost.

import { Application, Container, Graphics } from "pixi.js";

import { api, type EncounterRoll } from "../api";
import { audio } from "../audio";
import { Player } from "../player";
import { MAP, MAP_H, MAP_W, renderMap, TILE } from "../tilemap";
import type { SceneHost } from "./scene-host";

const VIEW_W = 640;
const VIEW_H = 480;

export class Overworld {
  view: Container;
  private camera: Container;
  private player: Player;
  private host: SceneHost;
  private app: Application;
  private busy = false;
  private overlay: Graphics;

  constructor(app: Application, host: SceneHost) {
    this.app = app;
    this.host = host;
    this.view = new Container();

    this.camera = new Container();
    this.view.addChild(this.camera);

    this.camera.addChild(renderMap());

    this.player = new Player(MAP.spawn.x, MAP.spawn.y);
    this.camera.addChild(this.player.view);

    // Small dim overlay used during encounter transition.
    this.overlay = new Graphics().rect(0, 0, VIEW_W, VIEW_H).fill(0x000000);
    this.overlay.alpha = 0;
    this.view.addChild(this.overlay);

    this.player.setOnZoneEnter(() => {
      audio.sfx("step");
      void this.onStep();
    });
    this.updateCamera();
  }

  enter() {
    this.app.ticker.add(this.tick);
    audio.playLoop("over");
  }

  exit() {
    this.app.ticker.remove(this.tick);
  }

  private tick = () => {
    if (this.busy) return;
    this.player.tick();
    this.updateCamera();
  };

  private updateCamera() {
    const px = this.player.view.x + TILE / 2;
    const py = this.player.view.y + TILE / 2;
    let cx = px - VIEW_W / 2;
    let cy = py - VIEW_H / 2;
    cx = Math.max(0, Math.min(MAP_W * TILE - VIEW_W, cx));
    cy = Math.max(0, Math.min(MAP_H * TILE - VIEW_H, cy));
    this.camera.x = -cx;
    this.camera.y = -cy;
  }

  private async onStep() {
    if (this.busy) return;
    const z = this.player.zone();
    if (!z) return;
    this.busy = true;
    let roll: EncounterRoll;
    try {
      roll = await api.step(this.player.tileX, this.player.tileY, z);
    } catch {
      this.busy = false;
      return;
    }
    if (!roll.species) {
      this.busy = false;
      return;
    }
    audio.sfx("encounter");
    await this.flashAndTransition();
    this.host.go("encounter", { species: roll.species, shiny: roll.shiny });
  }

  private flashAndTransition(): Promise<void> {
    return new Promise((resolve) => {
      let f = 0;
      const dur = 24;
      const step = () => {
        f += 1;
        this.overlay.alpha = Math.min(1, f / dur);
        if (f >= dur) {
          this.app.ticker.remove(step);
          resolve();
        }
      };
      this.app.ticker.add(step);
    });
  }

  /** Called when re-entering from encounter — fade overlay back out. */
  onResume() {
    this.busy = false;
    let f = 24;
    const step = () => {
      f -= 1;
      this.overlay.alpha = Math.max(0, f / 24);
      if (f <= 0) this.app.ticker.remove(step);
    };
    this.app.ticker.add(step);
  }
}
