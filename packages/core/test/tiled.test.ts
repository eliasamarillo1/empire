import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  attackTile, createPlayer, distance, externalTilesets, gather, homeOf, parseKind, tileAt, TiledError, withTilesets, worldFromTiled,
  type TiledMap, type TiledTileset,
} from "../src";

const tileset: TiledTileset = {
  firstgid: 1, tilewidth: 64, tileheight: 64, tilecount: 4, columns: 4, image: "t.png", imagewidth: 256, imageheight: 64,
  tiles: [
    { id: 0, type: "pradera" },
    { id: 1, class: "Bosque" },
    { id: 2, properties: [{ name: "tipo", value: "montaña" }] },
    { id: 3, type: "guarida", properties: [{ name: "nivel", value: 5 }] },
  ],
};

/** Mapa de 9×9: pradera, una columna de bosque, una montaña, una guarida encima del bosque y dos objetos. */
function smallMap(): TiledMap {
  const n = 9;
  const ground: number[] = Array.from({ length: n * n }, (_, i) => (i % n === 6 ? 2 : 1));
  ground[2 * n + 2] = 3;
  const top = new Array(n * n).fill(0);
  top[7 * n + 6] = 4;
  return {
    width: n, height: n, tilewidth: 64, tileheight: 32, orientation: "isometric", infinite: false, tilesets: [tileset],
    layers: [
      { type: "tilelayer", name: "terreno", data: ground },
      { type: "tilelayer", name: "lugares", data: top },
      {
        type: "objectgroup", name: "reinos", objects: [
          { id: 1, type: "inicio", x: 3.5 * 32, y: 4.5 * 32 },
          { id: 2, class: "reino", name: "Valdoria", x: 8.2 * 32, y: 0.5 * 32, properties: [{ name: "nivel", value: 4 }] },
        ],
      },
    ],
  };
}

describe("mapas de Tiled", () => {
  it("entiende los tipos en español, sin tildes ni mayúsculas", () => {
    expect(parseKind("Montaña")).toBe("mountain");
    expect(parseKind("montana")).toBe("mountain");
    expect(parseKind("RUINAS")).toBe("ruins");
    expect(parseKind("castillo")).toBeUndefined();
  });

  it("convierte capas y objetos en el mapa del mundo", () => {
    const w = worldFromTiled(smallMap(), "prueba");
    expect(w.size).toBe(9);
    expect(w.map).toBe("prueba");
    expect(homeOf(w)).toEqual({ x: 3, y: 4 });
    expect(tileAt(w, 3, 4)!.kind).toBe("home");
    expect(tileAt(w, 0, 0)!.kind).toBe("plain");
    expect(tileAt(w, 6, 0)!.kind).toBe("forest");
    expect(tileAt(w, 2, 2)!.kind).toBe("mountain");
    expect(tileAt(w, 2, 2)!.amount).toBeGreaterThan(0);
    // La guarida se pintó encima del bosque: tiene nivel propio y recuerda el terreno de debajo
    const lair = tileAt(w, 6, 7)!;
    expect(lair).toMatchObject({ kind: "lair", level: 5, base: "forest" });
    const k = tileAt(w, 8, 0)!;
    expect(k).toMatchObject({ kind: "kingdom", name: "Valdoria", level: 4, treasure: 1200 });
    // Se ve el entorno de tu reino y nada más
    expect(tileAt(w, 5, 6)!.seen).toBe(true);
    expect(tileAt(w, 6, 4)!.seen).toBe(false);
    expect(distance(w, 3, 4)).toBe(0);
  });

  it("al vencer una guarida vuelve el terreno que había debajo", () => {
    const p = createPlayer("Prueba", 1, 0, worldFromTiled(smallMap(), "prueba"));
    p.kingdom.army.inf = 400;
    p.kingdom.army.cav = 200;
    const lair = tileAt(p.world, 6, 7)!;
    lair.seen = true;
    lair.level = 1;
    const r = attackTile(p, 6, 7, { units: { inf: 400, cav: 200 }, dragon: false }, 0);
    expect(r.ok && r.value.result.attackerWon).toBe(true);
    expect(lair.kind).toBe("forest");
    expect(lair.amount).toBeGreaterThan(0);
    expect(gather(p, 6, 7, 0).ok).toBe(true);
  });

  it("cada partida recibe su propia copia del mapa", () => {
    const w = worldFromTiled(smallMap(), "prueba");
    const a = createPlayer("A", 1, 0, w);
    tileAt(a.world, 2, 2)!.amount = 0;
    expect(tileAt(w, 2, 2)!.amount).toBeGreaterThan(0);
  });

  it("explica lo que hay que cambiar en Tiled", () => {
    const rect = { ...smallMap(), width: 9, height: 8 };
    expect(() => worldFromTiled(rect, "x")).toThrow(/cuadrado/);
    const zipped = smallMap();
    zipped.layers[0] = { type: "tilelayer", name: "terreno", data: "eJzt", encoding: "base64" };
    expect(() => worldFromTiled(zipped, "x")).toThrow(/CSV/);
    const outside = smallMap();
    outside.layers[2].objects!.push({ id: 3, type: "reino", x: 20 * 32, y: 0 });
    expect(() => worldFromTiled(outside, "x")).toThrow(TiledError);
  });

  it("lee el mapa de ejemplo del juego con su tileset externo", () => {
    const dir = new URL("../../../apps/client/public/maps/", import.meta.url);
    const map = JSON.parse(readFileSync(new URL("mundo.tmj", dir), "utf8")) as TiledMap;
    expect(externalTilesets(map)).toEqual(["terreno.tsj"]);
    const ts = JSON.parse(readFileSync(new URL("terreno.tsj", dir), "utf8")) as TiledTileset;
    const w = worldFromTiled(withTilesets(map, { "terreno.tsj": ts }), "mundo");
    expect(w.tiles.filter((t) => t.kind === "kingdom")).toHaveLength(8);
    expect(w.tiles.filter((t) => t.kind === "home")).toHaveLength(1);
    // El castillo de inicio es un objeto con imagen, anclado por la esquina sur de su casilla
    expect(w.home).toEqual({ x: 12, y: 12 });
    expect(w.tiles.some((t) => t.kind === "lair")).toBe(true);
  });
});
