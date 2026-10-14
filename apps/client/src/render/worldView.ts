import { MeshBuilder, Scene, TransformNode, Vector3, type AbstractMesh, type Engine, type InstancedMesh } from "@babylonjs/core";
import { AdvancedDynamicTexture, Rectangle, TextBlock } from "@babylonjs/gui";
import { canExplore, homeOf, tileAt, type Tile, type TileKind, type World } from "@empire/core";
import { game, now } from "../game";
import { Materials, PALETTE, box, clampTarget, cone, cylinder, findMeta, onTap, orbitCamera, setupLighting } from "./common";
import { Kit } from "./kit";
import { mulberry } from "./kingdomView";
import { ModelLibrary } from "./models";
import { MeshPrefab, group, type Prefab } from "./prefab";
import type { View } from "./renderer";

interface Cell {
  sig: string;
  node: TransformNode;
  label?: Rectangle;
}

export class WorldView implements View {
  readonly scene: Scene;
  private mats: Materials;
  private kit: Kit;
  private shadows;
  private models: ModelLibrary;
  private gui: AdvancedDynamicTexture;
  private root: TransformNode;
  private cells = new Map<number, Cell>();
  private prefabs!: Record<string, Prefab>;
  private ring: AbstractMesh;
  private carts: InstancedMesh[] = [];
  private cartSource: AbstractMesh;
  private worldRef?: World;
  private unsubscribe: () => void;

  constructor(engine: Engine) {
    this.scene = new Scene(engine);
    this.mats = new Materials(this.scene);
    this.kit = new Kit(this.scene, this.mats);
    const { shadows } = setupLighting(this.scene, "#9fbccc", 0.018, game.world.size + 6);
    this.shadows = shadows;
    this.models = new ModelLibrary(this.scene);
    this.gui = AdvancedDynamicTexture.CreateFullscreenUI("etiquetas", true, this.scene);
    this.root = new TransformNode("mundo", this.scene);
    this.buildPrefabs();

    const w = game.world;
    const h = this.pos(w, homeOf(w).x, homeOf(w).y);
    const cam = orbitCamera(this.scene, h, 13, { min: 5, max: 45 });
    clampTarget(cam, -w.size / 2, w.size / 2, -w.size / 2, w.size / 2);

    // Mar alrededor del mapa
    const sea = MeshBuilder.CreateGround("mar", { width: 400, height: 400 }, this.scene);
    sea.position.y = -0.35;
    sea.material = this.mats.get("#2f5d78");
    sea.isPickable = false;

    this.ring = MeshBuilder.CreateTorus("seleccion", { diameter: 1.25, thickness: 0.06, tessellation: 4 }, this.scene);
    this.ring.rotation.y = Math.PI / 4;
    this.ring.material = this.mats.get(PALETTE.selection, { emissive: 0.8 });
    this.ring.isPickable = false;
    this.ring.setEnabled(false);

    this.cartSource = MeshBuilder.CreateSphere("recolector", { diameter: 0.22, segments: 6 }, this.scene);
    this.cartSource.material = this.mats.get(PALETTE.plaster);
    this.cartSource.isPickable = false;
    this.cartSource.setEnabled(false);

    onTap(this.scene, (mesh) => {
      const sel = findMeta<{ x: number; y: number }>(mesh);
      game.select(sel ? { view: "world", ...sel } : null);
    });
    this.unsubscribe = game.onChange(() => this.refresh());
    void this.models.ready.then(() => {
      this.cells.forEach((c) => (c.sig = ""));
      this.refresh();
    });
    this.refresh();
  }

  private pos(w: World, x: number, y: number) {
    return new Vector3(x - w.size / 2 + 0.5, 0, w.size / 2 - y - 0.5);
  }

  /** Piezas que se repiten por todo el mapa: se construyen una vez y se copian. */
  private buildPrefabs() {
    const s = this.scene, k = this.kit, sh = this.shadows;
    const slab = (name: string, color: string, top = 0, h = 0.25) => {
      const m = box(name, 0.98, h, 0.98, s);
      m.position.y = top - h;
      m.material = this.mats.get(color);
      return new MeshPrefab(name, group(name, s, [m]), undefined, true);
    };
    const tree = new MeshPrefab("arbol", group("arbol", s, k.tree(0, 0, 1)), sh);
    const treeDark = new MeshPrefab("arbol-oscuro", group("arbol-oscuro", s, k.tree(0, 0, 1, true)), sh);
    const mountain = new MeshPrefab("montana", group("montana", s, [
      paint(cone("pico", 0.95, 0.9, s, 6), this.mats.get(PALETTE.stoneDark)),
      paint(cone("nieve", 0.36, 0.34, s, 6), this.mats.get(PALETTE.snow), 0.56),
    ]), sh);
    const rock = new MeshPrefab("roca", group("roca", s, [k.rock(0.13, PALETTE.stone)]), sh);
    const nugget = new MeshPrefab("pepita", group("pepita", s, [k.rock(0.08, PALETTE.gold)]), sh);
    const tuft = new MeshPrefab("hierba", group("hierba", s, [paint(cone("brizna", 0.08, 0.16, s, 4), this.mats.get("#86b05a"))]), undefined);
    const lair = new MeshPrefab("guarida", group("guarida", s, [
      k.rock(0.4, "#4a3f37", 0, -0.12, 0, 2),
      paint(cylinder("boca", 0.32, 0.04, s, 10), this.mats.get(PALETTE.danger, { emissive: 0.6 }), 0.12, 0, -0.33, Math.PI / 2),
      ...k.tree(0.3, 0.3, 0.6, true),
    ]), sh);
    const ruins = new MeshPrefab("ruinas", group("ruinas", s, [
      k.cyl(0.14, 0.5, "#c9bfa6", -0.22, 0, -0.1, 8),
      k.cyl(0.14, 0.3, "#c9bfa6", 0.18, 0, -0.2, 8),
      k.box(0.6, 0.08, 0.2, "#c9bfa6", 0, 0, 0.22),
      k.rock(0.08, "#c9bfa6", 0.25, 0, 0.15, 1),
    ]), sh);
    const castle = (name: string, wall: string, roof: string) => new MeshPrefab(name, group(name, s, [
      k.box(0.55, 0.35, 0.55, wall),
      k.cyl(0.2, 0.55, wall, -0.27, 0, -0.27), k.cone(0.26, 0.25, roof, -0.27, 0.55, -0.27),
      k.cyl(0.2, 0.55, wall, 0.27, 0, 0.27), k.cone(0.26, 0.25, roof, 0.27, 0.55, 0.27),
      k.box(0.28, 0.6, 0.28, wall), k.cone(0.4, 0.35, roof, 0, 0.6, 0, 4),
    ]), sh);
    this.prefabs = {
      grass: slab("hierba-suelo", PALETTE.grass), forestFloor: slab("suelo-bosque", "#4f7a3c"), rocky: slab("suelo-roca", "#8a8577"),
      goldFloor: slab("suelo-oro", "#9c8a52"), water: slab("agua", PALETTE.water, -0.14), sand: slab("arena", "#c9b98a", -0.02),
      fog: slab("niebla", "#18211d", -0.04), fogNear: slab("niebla-cerca", "#2c3a2b", -0.04), lairFloor: slab("suelo-guarida", "#5a6b43"),
      tree, treeDark, mountain, rock, nugget, tuft, lair, ruins,
      kingdom: castle("reino", PALETTE.stone, PALETTE.purple), home: castle("capital", PALETTE.plaster, PALETTE.roofGold),
    };
  }

  /** Redibuja solo las casillas que han cambiado desde la última vez. */
  private refresh() {
    if (this.scene.isDisposed) return;
    const w = game.world;
    if (this.worldRef && this.worldRef.size !== w.size) {
      this.cells.forEach((c) => this.disposeCell(c));
      this.cells.clear();
    }
    this.worldRef = w;
    const t0 = now();
    for (let y = 0; y < w.size; y++)
      for (let x = 0; x < w.size; x++) {
        const t = tileAt(w, x, y)!;
        const near = !t.seen && canExplore(w, x, y);
        const fill = t.max ? Math.ceil(((t.amount ?? 0) / t.max) * 3) : 0;
        const shield = t.kind === "kingdom" && (t.shieldUntil ?? 0) > t0;
        const sig = t.seen ? `${t.kind}|${t.level}|${fill}|${shield}|${this.models.version}` : near ? "near" : "fog";
        const i = y * w.size + x;
        const old = this.cells.get(i);
        if (old?.sig === sig) continue;
        if (old) this.disposeCell(old);
        this.cells.set(i, this.buildCell(w, t, x, y, sig, fill, shield));
      }
    this.placeRing();
  }

  private disposeCell(c: Cell) {
    c.node.dispose(false, false);
    c.label?.dispose();
  }

  private buildCell(w: World, t: Tile, x: number, y: number, sig: string, fill: number, shield: boolean): Cell {
    const node = new TransformNode(`casilla-${x}-${y}`, this.scene);
    node.parent = this.root;
    node.position = this.pos(w, x, y);
    node.metadata = { select: { x, y } };
    const p = this.prefabs;
    if (!t.seen) {
      (sig === "near" ? p.fogNear : p.fog).place(node, 0, 0);
      return { sig, node };
    }
    const rnd = mulberry(x * 92821 + y * 68917);
    const floor: Record<TileKind, Prefab> = {
      plain: p.grass, forest: p.forestFloor, mountain: p.rocky, gold: p.goldFloor, water: p.water,
      lair: p.lairFloor, ruins: p.grass, kingdom: p.grass, home: p.grass,
    };
    floor[t.kind].place(node, 0, 0);

    const model = this.models.tile(t.kind, Math.floor(rnd() * 100));
    if (model) {
      model.parent = node;
      for (const m of model.getChildMeshes(false)) {
        m.receiveShadows = true;
        this.shadows.addShadowCaster(m, false);
      }
    } else this.props(node, t.kind, fill, rnd);

    let label: Rectangle | undefined;
    if (t.kind === "lair") label = this.badge(node, String(t.level), PALETTE.danger, 0.9);
    if (t.kind === "kingdom") {
      label = this.badge(node, `${t.name} · ${t.level}`, "#4b3a6b", 1.4);
      if (shield) {
        const dome = MeshBuilder.CreateSphere("escudo", { diameter: 1.2, segments: 12, slice: 0.5 }, this.scene);
        dome.material = this.mats.get("#7fb3d6", { alpha: 0.28, emissive: 0.4 });
        dome.parent = node;
        dome.isPickable = false;
      }
    }
    return { sig, node, label };
  }

  /** Decorado de una casilla según su tipo. `fill` (0-3) indica cuánto le queda al yacimiento. */
  private props(node: TransformNode, kind: TileKind, fill: number, rnd: () => number) {
    const p = this.prefabs;
    const spot = () => [(rnd() - 0.5) * 0.7, (rnd() - 0.5) * 0.7] as const;
    switch (kind) {
      case "plain":
        for (let i = 0; i < 2 + fill; i++) p.tuft.place(node, ...spot());
        break;
      case "forest":
        for (let i = 0; i < 1 + fill * 2; i++) (rnd() > 0.5 ? p.tree : p.treeDark).place(node, ...spot(), { scale: 0.55 + rnd() * 0.35, rotation: rnd() * 6 });
        break;
      case "mountain":
        p.mountain.place(node, 0, 0, { scale: 0.7 + 0.12 * fill, rotation: rnd() * 6 });
        for (let i = 0; i < fill; i++) p.rock.place(node, ...spot(), { rotation: rnd() * 6 });
        break;
      case "gold":
        for (let i = 0; i < 2; i++) p.rock.place(node, ...spot(), { scale: 1.4 });
        for (let i = 0; i < 1 + fill * 2; i++) p.nugget.place(node, ...spot());
        break;
      case "lair":
        p.lair.place(node, 0, 0, { rotation: rnd() * 6 });
        break;
      case "ruins":
        p.ruins.place(node, 0, 0, { rotation: rnd() * 6 });
        break;
      case "kingdom":
        p.kingdom.place(node, 0, 0);
        break;
      case "home":
        p.home.place(node, 0, 0, { scale: 1.25 });
        break;
      case "water":
        break;
    }
  }

  private badge(node: TransformNode, text: string, color: string, h: number) {
    const a = new TransformNode("ancla", this.scene);
    a.parent = node;
    a.position.y = h;
    const r = new Rectangle();
    r.adaptWidthToChildren = true;
    r.height = "20px";
    r.cornerRadius = 10;
    r.thickness = 1.5;
    r.color = "#ebe5d4";
    r.background = color;
    r.isPointerBlocker = false;
    const t = new TextBlock();
    t.text = text;
    t.color = "#ebe5d4";
    t.fontSize = 11;
    t.fontFamily = '"IBM Plex Mono", monospace';
    t.resizeToFit = true;
    t.paddingLeft = "7px";
    t.paddingRight = "7px";
    r.addControl(t);
    this.gui.addControl(r);
    r.linkWithMesh(a);
    return r;
  }

  private placeRing() {
    const sel = game.selection?.view === "world" ? game.selection : null;
    this.ring.setEnabled(!!sel);
    if (sel) this.ring.position = this.pos(game.world, sel.x, sel.y).add(new Vector3(0, 0.04, 0));
  }

  update() {
    // Recolectores yendo y volviendo desde tu reino
    const w = game.world;
    const h = homeOf(w);
    const t0 = now();
    const exps = game.player.expeditions;
    while (this.carts.length < exps.length) {
      const c = (this.cartSource as unknown as { createInstance(n: string): InstancedMesh }).createInstance("recolector");
      this.shadows.addShadowCaster(c, false);
      this.carts.push(c);
    }
    this.carts.forEach((c, i) => {
      const e = exps[i];
      c.setEnabled(!!e);
      if (!e) return;
      const f = Math.min(1, Math.max(0, (t0 - e.start) / (e.end - e.start)));
      const k = f < 0.5 ? f * 2 : 2 - f * 2;
      const p = this.pos(w, h.x + (e.x - h.x) * k, h.y + (e.y - h.y) * k);
      c.position.set(p.x, 0.14 + Math.abs(Math.sin(t0 * 6)) * 0.05, p.z);
    });
    this.ring.rotation.y = Math.PI / 4;
  }

  dispose() {
    this.unsubscribe();
    this.scene.dispose();
  }
}

function paint<T extends AbstractMesh>(m: T, material: AbstractMesh["material"], y = 0, x = 0, z = 0, rx = 0): T {
  m.material = material;
  m.position.set(x, y, z);
  m.rotation.x = rx;
  return m;
}
