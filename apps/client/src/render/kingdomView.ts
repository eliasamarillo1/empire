import { MeshBuilder, Scene, TransformNode, Vector3, type AbstractMesh, type Engine } from "@babylonjs/core";
import { AdvancedDynamicTexture, Control, Rectangle, TextBlock } from "@babylonjs/gui";
import { BUILDINGS, dragonLevel, dragonStage, isHatched, type BuildingKey } from "@empire/core";
import { game, now } from "../game";
import { Materials, PALETTE, clampTarget, findMeta, onTap, orbitCamera, setupLighting } from "./common";
import { Kit } from "./kit";
import { ModelLibrary } from "./models";
import type { View } from "./renderer";

/** Tamaño de la parcela del reino en casillas. La muralla ocupa el borde. */
export const SIZE = 13;

/** Dónde está cada edificio (esquina superior de su huella de 2×2). */
const LAYOUT: Partial<Record<BuildingKey, [number, number]>> = {
  castle: [5, 5], storage: [5, 2], house: [2, 2], farm: [8, 2], barracks: [2, 5],
  nest: [8, 5], den: [10, 5], sawmill: [2, 8], stable: [5, 8], quarry: [8, 8],
};

/** Centro de una casilla (o de un punto de la cuadrícula) en coordenadas 3D. */
const at = (x: number, y: number) => new Vector3(x - SIZE / 2, 0, SIZE / 2 - y);

export class KingdomView implements View {
  readonly scene: Scene;
  private mats: Materials;
  private kit: Kit;
  private shadows;
  private content: TransformNode;
  private gui: AdvancedDynamicTexture;
  private ring: AbstractMesh;
  private signature = "";
  private anchors = new Map<string, TransformNode>();
  private controls: Control[] = [];
  private progress?: { bar: Rectangle; fill: Rectangle; anchor: TransformNode };
  private dragon?: TransformNode;
  private unsubscribe: () => void;

  private models: ModelLibrary;

  constructor(engine: Engine) {
    this.scene = new Scene(engine);
    this.models = new ModelLibrary(this.scene);
    this.mats = new Materials(this.scene);
    this.kit = new Kit(this.scene, this.mats);
    const { shadows } = setupLighting(this.scene, "#a9c7d8", 0.012, 34);
    this.shadows = shadows;
    const cam = orbitCamera(this.scene, Vector3.Zero(), 17, { min: 7, max: 30 });
    clampTarget(cam, -SIZE / 2, SIZE / 2, -SIZE / 2, SIZE / 2);
    this.gui = AdvancedDynamicTexture.CreateFullscreenUI("etiquetas", true, this.scene);
    this.content = new TransformNode("reino", this.scene);
    this.scenery();

    this.ring = MeshBuilder.CreateTorus("seleccion", { diameter: 2.3, thickness: 0.08, tessellation: 40 }, this.scene);
    this.ring.material = this.mats.get(PALETTE.selection, { emissive: 0.8 });
    this.ring.isPickable = false;
    this.ring.setEnabled(false);

    onTap(this.scene, (mesh) => game.select(findMeta(mesh) ?? null));
    this.unsubscribe = game.onChange(() => this.refresh());
    void this.models.ready.then(() => {
      this.signature = "";
      this.refresh();
    });
    this.refresh();
  }

  /** Suelo, campo alrededor y árboles: lo que no cambia con el juego. */
  private scenery() {
    const field = MeshBuilder.CreateGround("campo", { width: 120, height: 120 }, this.scene);
    field.position.y = -0.06;
    field.material = this.mats.get(PALETTE.grassDark);
    field.receiveShadows = true;
    field.isPickable = true;
    const plot = MeshBuilder.CreateBox("parcela", { width: SIZE, depth: SIZE, height: 0.3 }, this.scene);
    plot.position.y = -0.15;
    plot.material = this.mats.get(PALETTE.grass);
    plot.receiveShadows = true;
    for (const [w, d] of [[SIZE - 2, 0.8], [0.8, SIZE - 2]]) {
      const path = MeshBuilder.CreateBox("camino", { width: w, depth: d, height: 0.02 }, this.scene);
      path.position.set(0.5 - 0.5, 0.01, 0);
      path.material = this.mats.get(PALETTE.path);
      path.receiveShadows = true;
      path.isPickable = false;
    }
    // Bosque alrededor de la parcela, siempre igual
    const rnd = mulberry(7);
    for (let i = 0; i < 90; i++) {
      const a = rnd() * Math.PI * 2, r = SIZE / 2 + 1.5 + rnd() * 9;
      const parts = this.kit.tree(Math.cos(a) * r, Math.sin(a) * r, 1.2 + rnd() * 0.8, rnd() > 0.5);
      for (const p of parts) {
        p.isPickable = false;
        this.shadows.addShadowCaster(p);
      }
    }
  }

  /** Reconstruye el reino solo si cambió algo que se ve (niveles, obras, dragón). */
  private refresh() {
    if (this.scene.isDisposed) return;
    const k = game.kingdom;
    const hatched = isHatched(k.dragon);
    const sig = JSON.stringify([k.buildings, k.upgrade?.key, hatched, k.dragon ? dragonStage(dragonLevel(k.dragon)) : -1, this.models.version]);
    if (sig !== this.signature) {
      this.signature = sig;
      this.rebuild();
    }
    this.placeRing();
  }

  private rebuild() {
    const k = game.kingdom;
    this.content.getChildren().slice().forEach((c) => c.dispose(false, false));
    this.controls.forEach((c) => c.dispose());
    this.controls = [];
    this.anchors.clear();
    this.progress = undefined;
    this.dragon = undefined;

    for (const [key, [bx, by]] of Object.entries(LAYOUT) as [BuildingKey, [number, number]][]) {
      const level = k.buildings[key];
      const locked = k.buildings.castle < BUILDINGS[key].unlock;
      const node = this.models.building(key, level) ?? this.kit.building(key, level, locked);
      this.add(node, at(bx + 1, by + 1), { view: "kingdom", key });
      if (level > 0) this.badge(key, String(level), at(bx + 1, by + 1), 2.6);
      if (key === "nest" && k.dragon) {
        const d = this.kit.dragon(isHatched(k.dragon) ? dragonStage(dragonLevel(k.dragon)) : 0, !isHatched(k.dragon));
        d.parent = this.content;
        d.position = at(bx + 1, by + 1);
        this.cast(d);
        if (isHatched(k.dragon)) this.dragon = d;
      }
    }

    // Muralla en el borde de la parcela, con una puerta en el centro de cada lado
    const wall = k.buildings.wall, tower = k.buildings.tower;
    for (let i = 1; i < SIZE - 1; i++)
      for (const [x, y, ry] of [[i, 0, 0], [i, SIZE - 1, 0], [0, i, Math.PI / 2], [SIZE - 1, i, Math.PI / 2]] as [number, number, number][]) {
        const p = at(x + 0.5, y + 0.5);
        if (wall > 0) {
          const seg = this.kit.wallSegment(wall, i === 6);
          seg.rotation.y = ry;
          this.add(seg, p, { view: "kingdom", key: "wall" });
        } else this.add(this.ghost(1, 0.4, ry), p, { view: "kingdom", key: "wall" });
      }
    for (const [x, y] of [[0, 0], [SIZE - 1, 0], [0, SIZE - 1], [SIZE - 1, SIZE - 1]]) {
      const p = at(x + 0.5, y + 0.5);
      this.add(tower > 0 ? this.kit.tower(tower, wall) : this.ghost(0.7, 0.7, 0), p, { view: "kingdom", key: "tower" });
    }
    if (wall > 0) this.badge("wall", `Muralla ${wall}`, at(SIZE / 2, SIZE - 0.5), 1.5);
    if (tower > 0) this.badge("tower", `Torres ${tower}`, at(0.5, SIZE - 0.5), 2.2);

    // Obra en curso: andamio y barra de progreso
    const up = k.upgrade;
    if (up) {
      const pos = LAYOUT[up.key];
      const c = pos ? at(pos[0] + 1, pos[1] + 1) : at(SIZE / 2, SIZE - 0.5);
      if (pos) this.scaffold(c);
      this.progressBar(c, pos ? 3.2 : 2);
    }
  }

  private add(node: TransformNode, p: Vector3, select: unknown) {
    node.parent = this.content;
    node.position.addInPlace(p);
    node.metadata = { ...(node.metadata ?? {}), select };
    this.cast(node);
  }

  private cast(node: TransformNode) {
    for (const m of node.getChildMeshes(false)) {
      m.receiveShadows = true;
      m.isPickable = true;
      this.shadows.addShadowCaster(m, false);
    }
  }

  /** Contorno translúcido de algo que aún no está construido. */
  private ghost(w: number, d: number, ry: number) {
    const m = MeshBuilder.CreateBox("fantasma", { width: w, depth: d, height: 0.1 }, this.scene);
    m.position.y = 0.05;
    m.rotation.y = ry;
    m.material = this.mats.get(PALETTE.selection, { alpha: 0.18 });
    const n = new TransformNode("fantasma", this.scene);
    m.parent = n;
    return n;
  }

  private scaffold(c: Vector3) {
    const parts: AbstractMesh[] = [];
    for (const [x, z] of [[-0.95, -0.95], [0.95, -0.95], [-0.95, 0.95], [0.95, 0.95]]) parts.push(this.kit.box(0.06, 1.8, 0.06, PALETTE.wood, x, 0, z));
    for (const y of [0.6, 1.2, 1.75]) for (const [x, z, ry] of [[0, -0.95, 0], [0, 0.95, 0], [-0.95, 0, Math.PI / 2], [0.95, 0, Math.PI / 2]]) parts.push(this.kit.box(1.9, 0.05, 0.05, PALETTE.wood, x, y, z, ry));
    const n = new TransformNode("andamio", this.scene);
    for (const p of parts) {
      p.parent = n;
      p.isPickable = false;
    }
    n.parent = this.content;
    n.position = c;
    for (const p of parts) this.shadows.addShadowCaster(p, false);
  }

  private anchor(id: string, p: Vector3, h: number) {
    const a = new TransformNode(`ancla-${id}`, this.scene);
    a.parent = this.content;
    a.position = p.add(new Vector3(0, h, 0));
    this.anchors.set(id, a);
    return a;
  }

  /** Etiqueta con el nivel encima de un edificio. */
  private badge(id: string, text: string, p: Vector3, h: number) {
    const a = this.anchor(id, p, h);
    const r = new Rectangle(`etiqueta-${id}`);
    r.adaptWidthToChildren = true;
    r.height = "22px";
    r.cornerRadius = 11;
    r.thickness = 1.5;
    r.color = "#d6a64c";
    r.background = "rgba(17,25,21,0.85)";
    r.isPointerBlocker = false;
    const t = new TextBlock();
    t.text = text;
    t.color = "#ebe5d4";
    t.fontSize = 12;
    t.fontFamily = '"IBM Plex Mono", monospace';
    t.resizeToFit = true;
    t.paddingLeft = "8px";
    t.paddingRight = "8px";
    r.addControl(t);
    this.gui.addControl(r);
    this.controls.push(r);
    r.linkWithMesh(a);
  }

  private progressBar(p: Vector3, h: number) {
    const anchor = this.anchor("obra", p, h);
    const bar = new Rectangle("obra");
    bar.width = "70px";
    bar.height = "12px";
    bar.cornerRadius = 6;
    bar.thickness = 0;
    bar.background = "rgba(17,25,21,0.9)";
    const fill = new Rectangle("obra-relleno");
    fill.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    fill.height = "8px";
    fill.left = "2px";
    fill.cornerRadius = 4;
    fill.thickness = 0;
    fill.background = "#d6a64c";
    bar.addControl(fill);
    this.gui.addControl(bar);
    this.controls.push(bar);
    bar.linkWithMesh(anchor);
    bar.linkOffsetY = -12;
    this.progress = { bar, fill, anchor };
  }

  private placeRing() {
    const sel = game.selection?.view === "kingdom" ? game.selection.key : null;
    const pos = sel ? LAYOUT[sel] : undefined;
    this.ring.setEnabled(!!pos);
    if (pos) this.ring.position = at(pos[0] + 1, pos[1] + 1).add(new Vector3(0, 0.05, 0));
  }

  update() {
    const up = game.kingdom.upgrade;
    if (up && this.progress) {
      const f = Math.min(1, Math.max(0, 1 - (up.endsAt - now()) / up.duration));
      this.progress.fill.width = `${Math.max(2, Math.round(66 * f))}px`;
    }
    // El dragón da vueltas sobre su nido batiendo las alas
    if (this.dragon) {
      const t = performance.now() / 1000;
      const nest = at(LAYOUT.nest![0] + 1, LAYOUT.nest![1] + 1);
      this.dragon.position.set(nest.x + Math.cos(t * 0.6) * 1.6, 2.2 + Math.sin(t * 1.3) * 0.2, nest.z + Math.sin(t * 0.6) * 1.6);
      this.dragon.rotation.y = -t * 0.6;
      const wings = this.dragon.metadata?.wings as AbstractMesh[] | undefined;
      if (wings) {
        wings[0].rotation.z = Math.sin(t * 8) * 0.5;
        wings[1].rotation.z = -Math.sin(t * 8) * 0.5;
      }
    }
    this.ring.rotation.y += 0.01;
  }

  dispose() {
    this.unsubscribe();
    this.scene.dispose();
  }
}

/** Generador pseudoaleatorio pequeño para colocar decorado siempre igual. */
export function mulberry(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
