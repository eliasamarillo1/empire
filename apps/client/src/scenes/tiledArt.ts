import Phaser from "phaser";
import { FLIP_X, objectCell, parseKind, tileForGid, tileLayers, type TiledLayer, type TiledTile, type Tile, type TileKind, type TiledTileset } from "@empire/core";
import type { LoadedMap } from "../maps";
import { TW, iso } from "./iso";

/** Lugares que pueden desaparecer (una guarida vencida, unas ruinas excavadas): su imagen solo se ve mientras sigan ahí. */
const PLACES: TileKind[] = ["lair", "ruins", "kingdom", "home"];

interface Piece {
  img: Phaser.GameObjects.Image;
  kind?: TileKind;
}

const sheetKey = (ts: TiledTileset) => `tiled:${ts.image}`;
const imageKey = (url: string) => `tiled:${url}`;

/**
 * Imágenes de un mapa isométrico de Tiled, colocadas como las coloca Tiled.
 * Se crean una vez; en cada redibujado solo cambia qué se ve (niebla y lugares que ya no existen).
 */
export class TiledArt {
  private cells = new Map<number, Piece[]>();

  private constructor(readonly name: string, private size: number) {}

  /** Carga las imágenes que falten y monta todas las capas de casillas dentro de `layer`. */
  static async create(scene: Phaser.Scene, layer: Phaser.GameObjects.Container, loaded: LoadedMap): Promise<TiledArt> {
    const { map } = loaded;
    if (map.orientation !== "isometric") throw new Error("Solo se dibujan mapas isométricos");
    for (const ts of map.tilesets) {
      if (ts.image && !scene.textures.exists(sheetKey(ts)))
        scene.load.spritesheet(sheetKey(ts), ts.image, {
          frameWidth: ts.tilewidth ?? map.tilewidth, frameHeight: ts.tileheight ?? map.tileheight, margin: ts.margin ?? 0, spacing: ts.spacing ?? 0,
        });
      for (const t of ts.tiles ?? []) if (t.image && !scene.textures.exists(imageKey(t.image))) scene.load.image(imageKey(t.image), t.image);
    }
    if (scene.load.list.size > 0) {
      await new Promise<void>((resolve, reject) => {
        scene.load.once(Phaser.Loader.Events.COMPLETE, () => resolve());
        scene.load.once(Phaser.Loader.Events.FILE_LOAD_ERROR, (f: Phaser.Loader.File) => reject(new Error(`No se pudo cargar ${f.src}`)));
        scene.load.start();
      });
    }

    const art = new TiledArt(loaded.name, map.width);
    const scale = TW / map.tilewidth;
    for (const l of tileLayers(map)) {
      const data = l.data as number[];
      for (let y = 0; y < map.height; y++)
        for (let x = 0; x < map.width; x++) {
          const gid = data[y * map.width + x];
          const found = tileForGid(map, gid);
          if (!found) continue;
          const { tileset: ts, id, tile } = found;
          const img = tile?.image ? scene.add.image(0, 0, imageKey(tile.image)) : ts.image ? scene.add.image(0, 0, sheetKey(ts), id) : null;
          if (!img) continue;
          // Tiled apoya la imagen por su esquina inferior izquierda en la esquina oeste/sur de la casilla.
          const west = iso(x, y + 1), south = iso(x + 1, y + 1);
          img.setOrigin(0, 1).setScale(scale).setPosition(west.x + (ts.tileoffset?.x ?? 0) * scale, south.y + (ts.tileoffset?.y ?? 0) * scale);
          if (gid & FLIP_X) img.setFlipX(true);
          layer.add(img);
          art.add(x, y, img, tile);
        }
    }

    // Objetos con imagen (por ejemplo el castillo de un reino): Tiled los apoya por el centro de su borde inferior.
    const objectLayers: TiledLayer[] = [];
    const walk = (ls: TiledLayer[]) => ls.forEach((l) => (l.type === "group" ? walk(l.layers ?? []) : l.type === "objectgroup" && l.visible !== false && objectLayers.push(l)));
    walk(map.layers);
    for (const l of objectLayers)
      for (const o of l.objects ?? []) {
        const found = o.gid ? tileForGid(map, o.gid) : undefined;
        if (!found) continue;
        const { tileset: ts, id, tile } = found;
        const img = tile?.image ? scene.add.image(0, 0, imageKey(tile.image)) : ts.image ? scene.add.image(0, 0, sheetKey(ts), id) : null;
        if (!img) continue;
        const p = iso(o.x / map.tileheight, o.y / map.tileheight);
        img.setOrigin(0.5, 1).setScale(scale).setPosition(p.x + (ts.tileoffset?.x ?? 0) * scale, p.y + (ts.tileoffset?.y ?? 0) * scale);
        if (o.gid! & FLIP_X) img.setFlipX(true);
        layer.add(img);
        const cell = objectCell(map, o);
        art.add(cell.x, cell.y, img, tile, parseKind(o.class) ?? parseKind(o.type));
      }
    return art;
  }

  private add(x: number, y: number, img: Phaser.GameObjects.Image, tile?: TiledTile, kind?: TileKind) {
    kind ??= tile ? parseKind(tile.properties?.find((p) => p.name === "tipo")?.value ?? tile.class ?? tile.type) : undefined;
    const key = y * this.size + x;
    this.cells.set(key, [...(this.cells.get(key) ?? []), { img, kind }]);
  }

  /**
   * Muestra u oculta las imágenes de una casilla según el estado del juego.
   * Devuelve si Tiled ya pinta el suelo y si pinta el lugar que hay ahora (guarida, ruinas, reino).
   */
  show(x: number, y: number, t: Tile) {
    let ground = false, place = false;
    for (const p of this.cells.get(y * this.size + x) ?? []) {
      const isPlace = !!p.kind && PLACES.includes(p.kind);
      const visible = t.seen && (!isPlace || p.kind === t.kind);
      p.img.setVisible(visible);
      if (!visible) continue;
      if (isPlace) place = true;
      else ground = true;
    }
    return { ground, place };
  }

  destroy() {
    for (const list of this.cells.values()) for (const p of list) p.img.destroy();
    this.cells.clear();
  }
}
