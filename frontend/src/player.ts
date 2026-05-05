// Grid-locked player movement with a 2-frame walk cycle.
// Pokemon-style: a direction press starts a 1-tile slide; held → keeps stepping.

import { Container } from "pixi.js";

import { isWalkable, TILE, zoneAt, type Zone } from "./tilemap";
import { player as makePlayerSprite, type Facing } from "./sprites";
import { isHeld } from "./input";

const STEP_FRAMES = 12; // 12 frames @ 60fps ≈ 0.2s/tile

export class Player {
  view: Container;
  private inner: Container;
  tileX: number;
  tileY: number;
  facing: Facing = "down";

  private moving = false;
  private fromX = 0;
  private fromY = 0;
  private toX = 0;
  private toY = 0;
  private progress = 0;
  private stepParity: 0 | 1 = 1;
  private currentFrame: 0 | 1 = 0;
  private onZoneEnter?: (z: Zone) => void;

  constructor(tileX: number, tileY: number) {
    this.view = new Container();
    this.inner = makePlayerSprite("down", 0);
    this.view.addChild(this.inner);
    this.tileX = tileX;
    this.tileY = tileY;
    this.view.x = tileX * TILE;
    this.view.y = tileY * TILE;
  }

  setOnZoneEnter(cb: (z: Zone) => void) {
    this.onZoneEnter = cb;
  }

  tick(): boolean {
    if (!this.moving) {
      let dx = 0, dy = 0;
      if (isHeld("up")) { dy = -1; this.faceTo("up"); }
      else if (isHeld("down")) { dy = 1; this.faceTo("down"); }
      else if (isHeld("left")) { dx = -1; this.faceTo("left"); }
      else if (isHeld("right")) { dx = 1; this.faceTo("right"); }

      if (dx === 0 && dy === 0) return false;
      const nx = this.tileX + dx;
      const ny = this.tileY + dy;
      if (!isWalkable(nx, ny)) return false;
      this.startStep(nx, ny);
      return false;
    }

    this.progress += 1;
    const t = Math.min(1, this.progress / STEP_FRAMES);
    this.view.x = this.fromX * TILE + (this.toX - this.fromX) * TILE * t;
    this.view.y = this.fromY * TILE + (this.toY - this.fromY) * TILE * t;

    // Walk frame is on during the middle ~60% of each step. stepParity flips
    // every step so alternating steps show frame_0/frame_1 → visible bob even
    // though the sheet only has two frames per facing.
    const midStep = t > 0.2 && t < 0.85;
    const wantFrame: 0 | 1 = midStep ? this.stepParity : 0;
    if (wantFrame !== this.currentFrame) this.swapFrame(wantFrame);

    if (t >= 1) {
      this.moving = false;
      this.tileX = this.toX;
      this.tileY = this.toY;
      this.view.x = this.tileX * TILE;
      this.view.y = this.tileY * TILE;
      this.stepParity = (this.stepParity ^ 1) as 0 | 1;
      this.swapFrame(0);
      if (this.onZoneEnter) this.onZoneEnter(zoneAt(this.tileX, this.tileY));
      return true;
    }
    return false;
  }

  private faceTo(f: Facing) {
    if (this.facing === f) return;
    this.facing = f;
    this.swapFrame(0);
  }

  private swapFrame(frame: 0 | 1) {
    this.view.removeChild(this.inner);
    this.inner = makePlayerSprite(this.facing, frame);
    this.view.addChild(this.inner);
    this.currentFrame = frame;
  }

  private startStep(nx: number, ny: number) {
    this.moving = true;
    this.progress = 0;
    this.fromX = this.tileX;
    this.fromY = this.tileY;
    this.toX = nx;
    this.toY = ny;
  }

  zone(): Zone {
    return zoneAt(this.tileX, this.tileY);
  }
}
