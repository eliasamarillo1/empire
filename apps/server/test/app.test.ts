import { describe, expect, it } from "vitest";
import { simulate, ordersToGroups, garrison, defenses, createKingdom } from "@empire/core";
import { buildApp } from "../src/app";

function setup() {
  let now = 1000;
  const app = buildApp({ clock: () => now, seed: () => 1234 });
  return { app, tick: (s: number) => (now += s) };
}
const post = (app: ReturnType<typeof buildApp>, url: string, payload: object) => app.inject({ method: "POST", url, payload });

describe("API", () => {
  it("crea un reino y lo consulta", async () => {
    const { app } = setup();
    const res = await post(app, "/api/kingdoms", { name: "Valdoria" });
    expect(res.statusCode).toBe(201);
    const { id } = res.json();
    const got = await app.inject({ method: "GET", url: `/api/kingdoms/${id}` });
    expect(got.json().kingdom.name).toBe("Valdoria");
  });

  it("aplica la producción según el reloj del servidor", async () => {
    const { app, tick } = setup();
    const { id } = (await post(app, "/api/kingdoms", { name: "A" })).json();
    tick(60);
    const k = (await app.inject({ method: "GET", url: `/api/kingdoms/${id}` })).json().kingdom;
    expect(k.res.gold).toBeCloseTo(400 + 0.5 * 60);
  });

  it("rechaza mejoras no permitidas", async () => {
    const { app } = setup();
    const { id } = (await post(app, "/api/kingdoms", { name: "A" })).json();
    const res = await post(app, `/api/kingdoms/${id}/upgrade`, { building: "farm" });
    expect(res.statusCode).toBe(409);
    expect((await post(app, `/api/kingdoms/${id}/upgrade`, { building: "castle" })).statusCode).toBe(200);
  });

  it("resuelve un ataque con la semilla del servidor y da escudo al defensor", async () => {
    const { app } = setup();
    const a = (await post(app, "/api/kingdoms", { name: "A" })).json().id;
    const d = (await post(app, "/api/kingdoms", { name: "D" })).json().id;
    const targets = (await app.inject({ method: "GET", url: `/api/kingdoms/${a}/targets` })).json().targets;
    expect(targets.map((t: { id: string }) => t.id)).toEqual([d]);

    // Lo que el cliente puede reproducir por su cuenta con la semilla devuelta
    const k = createKingdom("x", 1000);
    const expected = simulate(ordersToGroups(k, { units: { inf: 8 }, dragon: false }), garrison(k, 1000), defenses(k), 1234);

    const res = await post(app, "/api/attacks", { attackerId: a, defenderId: d, orders: { units: { inf: 8 }, dragon: false } });
    expect(res.statusCode).toBe(200);
    expect(res.json().seed).toBe(1234);
    expect(res.json().result.rounds).toEqual(expected.rounds);

    const again = await post(app, "/api/attacks", { attackerId: a, defenderId: d, orders: { units: { inf: 1 }, dragon: false } });
    expect(again.statusCode).toBe(409);
  });

  it("no deja mandar más tropas de las que tienes", async () => {
    const { app } = setup();
    const a = (await post(app, "/api/kingdoms", { name: "A" })).json().id;
    const d = (await post(app, "/api/kingdoms", { name: "D" })).json().id;
    const res = await post(app, "/api/attacks", { attackerId: a, defenderId: d, orders: { units: { inf: 500 } } });
    expect(res.statusCode).toBe(400);
  });
});
