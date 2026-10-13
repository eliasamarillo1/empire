import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createKingdom, defenses, garrison, ordersToGroups, simulate } from "@empire/core";
import { buildApp } from "../src/app";
import { DEFAULT_MAP_FILE, loadTiledWorld, mapFromEnv } from "../src/maps";
import { Store } from "../src/store";

function setup(store = new Store()) {
  let now = 1000;
  const app = buildApp({ store, clock: () => now, seed: () => 1234 });
  return { app, store, tick: (s: number) => (now += s) };
}
type App = ReturnType<typeof buildApp>;
const post = (app: App, url: string, payload: object, token?: string) =>
  app.inject({ method: "POST", url, payload, headers: token ? { authorization: `Bearer ${token}` } : {} });
const get = (app: App, url: string, token: string) => app.inject({ method: "GET", url, headers: { authorization: `Bearer ${token}` } });
const register = async (app: App, username: string) => (await post(app, "/api/auth/register", { username, password: "contraseña1" })).json();

describe("cuentas", () => {
  it("registra, entra y rechaza contraseñas malas", async () => {
    const { app } = setup();
    const r = await post(app, "/api/auth/register", { username: "elias", password: "contraseña1", kingdom: "Valdoria" });
    expect(r.statusCode).toBe(201);
    expect(r.json().player.kingdom.name).toBe("Valdoria");
    expect((await post(app, "/api/auth/register", { username: "ELIAS", password: "otra-clave" })).statusCode).toBe(409);
    expect((await post(app, "/api/auth/login", { username: "elias", password: "mala-clave" })).statusCode).toBe(401);
    const ok = await post(app, "/api/auth/login", { username: "Elias", password: "contraseña1" });
    expect(ok.statusCode).toBe(200);
    expect(ok.json().player.username).toBe("elias");
  });

  it("valida usuario y contraseña", async () => {
    const { app } = setup();
    expect((await post(app, "/api/auth/register", { username: "a", password: "contraseña1" })).statusCode).toBe(400);
    expect((await post(app, "/api/auth/register", { username: "elias", password: "corta" })).statusCode).toBe(400);
  });

  it("pide sesión para jugar y la cierra al salir", async () => {
    const { app } = setup();
    expect((await app.inject({ method: "GET", url: "/api/me" })).statusCode).toBe(401);
    const { token } = await register(app, "elias");
    expect((await get(app, "/api/me", token)).statusCode).toBe(200);
    await post(app, "/api/auth/logout", {}, token);
    expect((await get(app, "/api/me", token)).statusCode).toBe(401);
  });

  it("no envía el mapa sin explorar", async () => {
    const { app } = setup();
    const { player } = await register(app, "elias");
    const hidden = player.world.tiles.filter((t: { seen: boolean }) => !t.seen);
    expect(hidden.length).toBeGreaterThan(0);
    expect(hidden.every((t: { kind: string; name?: string }) => t.kind === "plain" && !t.name)).toBe(true);
    expect(player.world.seed).toBe(0);
  });

  it("guarda las partidas en disco y las recupera", async () => {
    const file = join(mkdtempSync(join(tmpdir(), "empire-")), "db.json");
    const first = setup(new Store(file));
    const { token } = await register(first.app, "elias");
    await post(first.app, "/api/me/upgrade", { building: "castle" }, token);
    first.store.flush();
    const second = setup(new Store(file));
    const me = (await get(second.app, "/api/me", token)).json();
    expect(me.player.kingdom.upgrade.key).toBe("castle");
  });
});

describe("partida en el servidor", () => {
  it("aplica la producción según el reloj del servidor", async () => {
    const { app, tick } = setup();
    const { token } = await register(app, "elias");
    tick(60);
    const k = (await get(app, "/api/me", token)).json().player.kingdom;
    expect(k.res.gold).toBeCloseTo(400 + 0.5 * 60);
  });

  it("rechaza mejoras no permitidas", async () => {
    const { app } = setup();
    const { token } = await register(app, "elias");
    expect((await post(app, "/api/me/upgrade", { building: "farm" }, token)).statusCode).toBe(409);
    expect((await post(app, "/api/me/upgrade", { building: "castle" }, token)).statusCode).toBe(200);
  });

  it("explora y envía recolectores", async () => {
    const { app } = setup();
    const { token, player } = await register(app, "elias");
    const c = Math.floor(player.world.size / 2);
    expect((await post(app, "/api/me/explore", { x: c + 3, y: c }, token)).statusCode).toBe(200);
    expect((await post(app, "/api/me/explore", { x: 0, y: 0 }, token)).statusCode).toBe(409);
  });
});

describe("PvP", () => {
  it("resuelve el ataque con la semilla del servidor y avisa al defensor", async () => {
    const { app } = setup();
    const a = await register(app, "atacante");
    const d = await register(app, "defensor");
    const targets = (await get(app, "/api/me/targets", a.token)).json().targets;
    expect(targets.map((t: { id: string }) => t.id)).toEqual([d.player.id]);

    // El cliente puede reproducir la batalla por su cuenta con la semilla devuelta
    const k = createKingdom("x", 1000);
    const expected = simulate(ordersToGroups(k, { units: { inf: 8 }, dragon: false }), garrison(k, 1000), defenses(k), 1234);

    const res = await post(app, "/api/me/attack-player", { defenderId: d.player.id, orders: { units: { inf: 8 }, dragon: false } }, a.token);
    expect(res.statusCode).toBe(200);
    expect(res.json().battle.seed).toBe(1234);
    expect(res.json().battle.result.rounds).toEqual(expected.rounds);

    const defender = (await get(app, "/api/me", d.token)).json().player;
    expect(defender.reports[0]).toMatchObject({ kind: "defense", title: `Reino de atacante atacó tu reino` });
    expect((await post(app, "/api/me/attack-player", { defenderId: d.player.id, orders: { units: { inf: 1 } } }, a.token)).statusCode).toBe(409);
  });

  it("no deja mandar más tropas de las que tienes ni atacarte a ti mismo", async () => {
    const { app } = setup();
    const a = await register(app, "atacante");
    const d = await register(app, "defensor");
    expect((await post(app, "/api/me/attack-player", { defenderId: d.player.id, orders: { units: { inf: 500 } } }, a.token)).statusCode).toBe(400);
    expect((await post(app, "/api/me/attack-player", { defenderId: a.player.id, orders: { units: { inf: 1 } } }, a.token)).statusCode).toBe(400);
  });
});

describe("mapas de Tiled", () => {
  it("las partidas nuevas usan el mapa de ejemplo y el cliente sabe cuál dibujar", async () => {
    const world = loadTiledWorld(DEFAULT_MAP_FILE);
    const app = buildApp({ store: new Store(), clock: () => 1000, seed: () => 1234, world });
    const { player } = await register(app, "elias");
    expect(player.world.map).toBe("mundo");
    expect(player.world.size).toBe(world.size);
    expect(player.world.home).toEqual(world.home);
    // Lo que no has explorado sigue oculto aunque el mapa venga de Tiled
    const hidden = player.world.tiles.filter((t: { seen: boolean }) => !t.seen);
    expect(hidden.length).toBeGreaterThan(0);
    expect(hidden.every((t: { kind: string }) => t.kind === "plain")).toBe(true);
  });

  it("MAP_FILE vacío vuelve al mapa generado", () => {
    expect(mapFromEnv("")).toBeUndefined();
    expect(mapFromEnv(undefined)?.map).toBe("mundo");
  });
});
