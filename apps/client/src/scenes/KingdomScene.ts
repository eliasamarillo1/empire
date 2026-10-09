import Phaser from "phaser";
import { BUILDINGS, type BuildingKey } from "@empire/core";
import { game, now } from "../game";
import { cameraControls, fit } from "./camera";
import { TH, TW, drawBlock, fillDiamond, fromIso, iso, shade, strokeDiamond } from "./iso";

/** Tamaño de la parcela del reino en casillas. La muralla ocupa el borde. */
const SIZE = 13;

/** Dónde está cada edificio (esquina superior de su huella de 2×2). */
const LAYOUT: Partial<Record<BuildingKey, [number, number]>> = {
  castle: [5, 5], storage: [5, 2], house: [2, 2], farm: [8, 2], barracks: [2, 5],
  nest: [8, 5], den: [10, 5], sawmill: [2, 8], stable: [5, 8], quarry: [8, 8],
};

interface Look {
  wall: number;
  roof?: number;
  /** Altura base y extra por nivel. */
  h: number;
  per: number;
  roofH: number;
}
const LOOKS: Partial<Record<BuildingKey, Look>> = {
  castle: { wall: 0xb9ae94, roof: 0xd6a64c, h: 34, per: 6, roofH: 26 },
  storage: { wall: 0x9b8462, roof: 0x6b5a3e, h: 20, per: 3, roofH: 14 },
  house: { wall: 0xd8cdb2, roof: 0xa5523a, h: 16, per: 3, roofH: 16 },
  barracks: { wall: 0xa49a86, roof: 0x7b3b34, h: 18, per: 3, roofH: 12 },
  nest: { wall: 0x4a3a34, roof: 0xe2653c, h: 14, per: 3, roofH: 10 },
  den: { wall: 0x3f4a35, roof: 0x2c5233, h: 14, per: 3, roofH: 12 },
  sawmill: { wall: 0x8d6a3f, roof: 0x5a4127, h: 14, per: 3, roofH: 12 },
  stable: { wall: 0xb08a5a, roof: 0x6e4b2d, h: 14, per: 3, roofH: 14 },
  quarry: { wall: 0x8e8b82, h: 8, per: 2, roofH: 0 },
};

export class KingdomScene extends Phaser.Scene {
  private world!: Phaser.GameObjects.Container;
  private progress!: Phaser.GameObjects.Graphics;
  private unsubscribe?: () => void;

  constructor() {
    super("kingdom");
  }

  create() {
    this.cameras.main.setBackgroundColor("#111915");
    this.world = this.add.container(0, 0);
    this.progress = this.add.graphics().setDepth(1000);
    const c = iso(SIZE / 2, SIZE / 2);
    fit(this, c.x, c.y + TH, SIZE * TW + 40, SIZE * TH + 160);
    cameraControls(this, (x, y) => this.tap(x, y));
    const refit = () => fit(this, c.x, c.y + TH, SIZE * TW + 40, SIZE * TH + 160);
    this.scale.on("resize", refit);
    this.unsubscribe = game.onChange(() => this.draw());
    this.events.once("shutdown", () => {
      this.unsubscribe?.();
      this.scale.off("resize", refit);
    });
    this.draw();
  }

  private tap(wx: number, wy: number) {
    const { x, y } = fromIso(wx, wy);
    if (x < 0 || y < 0 || x >= SIZE || y >= SIZE) return game.select(null);
    const hit = (Object.entries(LAYOUT) as [BuildingKey, [number, number]][]).find(([, [bx, by]]) => x >= bx && x < bx + 2 && y >= by && y < by + 2);
    if (hit) return game.select({ view: "kingdom", key: hit[0] });
    const corner = (x === 0 || x === SIZE - 1) && (y === 0 || y === SIZE - 1);
    const border = x === 0 || y === 0 || x === SIZE - 1 || y === SIZE - 1;
    if (corner) return game.select({ view: "kingdom", key: "tower" });
    if (border) return game.select({ view: "kingdom", key: "wall" });
    game.select(null);
  }

  private draw() {
    this.world.removeAll(true);
    const k = game.kingdom;
    const sel = game.selection?.view === "kingdom" ? game.selection.key : null;

    // Suelo: hierba con caminos hacia el castillo
    const ground = this.add.graphics();
    for (let y = 0; y < SIZE; y++)
      for (let x = 0; x < SIZE; x++) {
        const path = (x === 6 || y === 6) && x > 0 && y > 0 && x < SIZE - 1 && y < SIZE - 1;
        const base = path ? 0x8a7a58 : (x + y) % 2 ? 0x4f6b3a : 0x547240;
        fillDiamond(ground, x, y, base);
      }
    // Borde de la parcela (tierra)
    const edge = this.add.graphics();
    const s = iso(SIZE, SIZE), e = iso(SIZE, 0), w = iso(0, SIZE);
    edge.fillStyle(0x3b2f22, 1);
    edge.fillPoints([new Phaser.Math.Vector2(w.x, w.y), new Phaser.Math.Vector2(s.x, s.y), new Phaser.Math.Vector2(s.x, s.y + 14), new Phaser.Math.Vector2(w.x, w.y + 14)], true);
    edge.fillStyle(0x2c231a, 1);
    edge.fillPoints([new Phaser.Math.Vector2(s.x, s.y), new Phaser.Math.Vector2(e.x, e.y), new Phaser.Math.Vector2(e.x, e.y + 14), new Phaser.Math.Vector2(s.x, s.y + 14)], true);
    this.world.add([edge, ground]);

    // Cosas que ocupan casillas, ordenadas de atrás adelante
    const items: { depth: number; draw: (g: Phaser.GameObjects.Graphics) => void; label?: { key: BuildingKey; x: number; y: number } }[] = [];

    // Muralla y torres
    const wallLvl = k.buildings.wall, towerLvl = k.buildings.tower;
    for (let i = 0; i < SIZE; i++)
      for (const [x, y] of [[i, 0], [0, i], [i, SIZE - 1], [SIZE - 1, i]] as [number, number][]) {
        const corner = (x === 0 || x === SIZE - 1) && (y === 0 || y === SIZE - 1);
        if (corner) continue;
        const gate = (x === 6 || y === 6);
        items.push({
          depth: x + y,
          draw: (g) => {
            if (!wallLvl) return strokeDiamond(g, x, y, 0xd6a64c, 1, sel === "wall" ? 0.6 : 0.15);
            if (gate) return drawBlock(g, x, y, 1, 1, 6, 0x6b5a3e, undefined, 0, 0.1);
            drawBlock(g, x, y, 1, 1, 10 + wallLvl * 2, sel === "wall" ? 0xc9c2b0 : 0x9d978a, undefined, 0, 0.05);
          },
        });
      }
    for (const [x, y] of [[0, 0], [SIZE - 1, 0], [0, SIZE - 1], [SIZE - 1, SIZE - 1]] as [number, number][])
      items.push({
        depth: x + y + 0.5,
        draw: (g) => {
          if (!towerLvl) return strokeDiamond(g, x, y, 0xd6a64c, 1, sel === "tower" ? 0.6 : 0.15);
          drawBlock(g, x, y, 1, 1, 26 + towerLvl * 3, sel === "tower" ? 0xc9c2b0 : 0x8f897c, 0x7b3b34, 14, 0.12);
        },
      });

    // Edificios
    for (const [key, [bx, by]] of Object.entries(LAYOUT) as [BuildingKey, [number, number]][]) {
      const level = k.buildings[key];
      const locked = k.buildings.castle < BUILDINGS[key].unlock;
      const selected = sel === key;
      items.push({
        depth: bx + by + 2,
        label: level > 0 ? { key, x: bx, y: by } : undefined,
        draw: (g) => {
          if (level === 0) {
            fillDiamond(g, bx + 0.15, by + 0.15, 0x2a2219, locked ? 0.25 : 0.55, 1.7, 1.7);
            strokeDiamond(g, bx + 0.15, by + 0.15, 0xd6a64c, selected ? 2 : 1, locked ? 0.2 : selected ? 1 : 0.5, 1.7, 1.7);
            return;
          }
          if (selected) fillDiamond(g, bx, by, 0xd6a64c, 0.35, 2, 2);
          drawBuilding(g, key, bx, by, level);
        },
      });
    }

    items.sort((a, b) => a.depth - b.depth);
    for (const it of items) {
      const g = this.add.graphics();
      it.draw(g);
      this.world.add(g);
      if (it.label) this.world.add(this.levelBadge(it.label.key, it.label.x, it.label.y));
    }
  }

  private levelBadge(key: BuildingKey, bx: number, by: number) {
    const level = game.kingdom.buildings[key];
    const look = LOOKS[key];
    const c = iso(bx + 1, by + 1);
    const top = key === "farm" ? 10 : (look?.h ?? 10) + (look?.per ?? 0) * level + (look?.roofH ?? 0);
    const container = this.add.container(c.x, c.y - top - 12);
    const bg = this.add.circle(0, 0, 10, 0x111915, 0.85).setStrokeStyle(1.5, 0xd6a64c);
    const t = this.add.text(0, 0, String(level), { fontFamily: '"IBM Plex Mono", monospace', fontSize: "12px", color: "#ebe5d4" }).setOrigin(0.5);
    container.add([bg, t]);
    return container;
  }

  update() {
    // Barra de obra encima del edificio en construcción
    const g = this.progress;
    g.clear();
    const up = game.kingdom.upgrade;
    if (!up) return;
    let cx: number, cy: number;
    const pos = LAYOUT[up.key];
    if (pos) {
      const c = iso(pos[0] + 1, pos[1] + 1);
      cx = c.x;
      cy = c.y - 70;
    } else {
      const c = iso(SIZE / 2, 0);
      cx = c.x;
      cy = c.y - 50;
    }
    const f = Phaser.Math.Clamp(1 - (up.endsAt - now()) / up.duration, 0, 1);
    g.fillStyle(0x111915, 0.9).fillRoundedRect(cx - 32, cy - 5, 64, 10, 4);
    g.fillStyle(0xd6a64c, 1).fillRoundedRect(cx - 30, cy - 3, 60 * f, 6, 3);
  }
}

function drawBuilding(g: Phaser.GameObjects.Graphics, key: BuildingKey, x: number, y: number, level: number) {
  if (key === "farm") {
    // Campo de cultivo con surcos y un granero pequeño
    fillDiamond(g, x + 0.1, y + 0.1, 0x8a7a3a, 1, 1.8, 1.8);
    for (let i = 0; i < 4; i++) {
      const a = iso(x + 0.2 + i * 0.4, y + 0.2), b = iso(x + 0.2 + i * 0.4, y + 1.8);
      g.lineStyle(3, shade(0x9cc35a, -10 + level * 2), 1).lineBetween(a.x, a.y, b.x, b.y);
    }
    drawBlock(g, x + 1.2, y + 1.2, 0.7, 0.7, 8, 0xa5523a, 0x7b3b34, 6, 0.05);
    return;
  }
  const look = LOOKS[key]!;
  const h = look.h + look.per * level;
  if (key === "castle") {
    drawBlock(g, x, y, 2, 2, h, look.wall, undefined, 0, 0.05);
    // Torreones en las esquinas y torre del homenaje
    for (const [ox, oy] of [[0, 0], [1.45, 0], [0, 1.45], [1.45, 1.45]])
      drawBlock(g, x + ox, y + oy, 0.55, 0.55, h + 12, shade(look.wall, 6), 0x7b3b34, 10, 0.02);
    drawBlock(g, x + 0.6, y + 0.6, 0.8, 0.8, h + 22, shade(look.wall, 10), look.roof, look.roofH, 0.02);
    return;
  }
  if (key === "quarry") {
    fillDiamond(g, x + 0.1, y + 0.1, 0x5e5a52, 1, 1.8, 1.8);
    drawBlock(g, x + 0.3, y + 0.3, 0.7, 0.6, h, look.wall, undefined, 0, 0.05);
    drawBlock(g, x + 1.0, y + 0.9, 0.6, 0.7, h + 4, shade(look.wall, 8), undefined, 0, 0.05);
    return;
  }
  if (key === "nest") {
    drawBlock(g, x, y, 2, 2, h, look.wall, undefined, 0, 0.2);
    const c = iso(x + 1, y + 1);
    g.fillStyle(0xe2653c, 0.9).fillEllipse(c.x, c.y - h - 4, 26, 12);
    g.fillStyle(0xffd77a, 0.9).fillEllipse(c.x, c.y - h - 6, 12, 6);
    return;
  }
  drawBlock(g, x, y, 2, 2, h, look.wall, look.roof, look.roofH, 0.2);
}
