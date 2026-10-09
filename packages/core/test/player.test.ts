import { describe, expect, it } from "vitest";
import { attackTile, center, createPlayer, explore, gather, tickPlayer, tileAt, FIRST_RAID } from "../src";

describe("partida", () => {
  it("explorar cuesta comida y descubre casillas", () => {
    const p = createPlayer("A", 7, 0);
    const c = center(p.world);
    const food = p.kingdom.res.food;
    expect(explore(p, c + 3, c).ok).toBe(true);
    expect(p.kingdom.res.food).toBeLessThan(food);
    expect(tileAt(p.world, c + 4, c)!.seen).toBe(true);
    expect(explore(p, 0, 0).ok).toBe(false);
  });

  it("los recolectores vuelven con el botín", () => {
    const p = createPlayer("A", 7, 0);
    const c = center(p.world);
    const t = tileAt(p.world, c + 1, c)!;
    t.kind = "forest";
    t.max = t.amount = 500;
    const r = gather(p, c + 1, c, 0);
    expect(r.ok).toBe(true);
    const wood = p.kingdom.res.wood;
    const events = tickPlayer(p, r.ok ? r.value.end : 0, { raids: false });
    expect(events.some((e) => e.type === "expedition")).toBe(true);
    expect(p.kingdom.res.wood).toBeGreaterThan(wood);
  });

  it("atacar una guarida cambia la casilla y deja informe", () => {
    const p = createPlayer("A", 7, 0);
    const c = center(p.world);
    const t = tileAt(p.world, c, c - 1)!;
    t.kind = "lair";
    t.level = 1;
    p.kingdom.army.inf = 30;
    const r = attackTile(p, c, c - 1, { units: { inf: 30 }, dragon: false }, 0);
    expect(r.ok && r.value.result.attackerWon).toBe(true);
    expect(t.kind).not.toBe("lair");
    expect(p.reports[0].kind).toBe("attack");
  });

  it("la IA asalta tras el primer plazo y deja escudo", () => {
    const p = createPlayer("A", 7, 0);
    const events = tickPlayer(p, FIRST_RAID);
    expect(events.some((e) => e.type === "raid")).toBe(true);
    expect(p.kingdom.shieldUntil).toBe(FIRST_RAID + 240);
    expect(p.reports[0].kind).toBe("defense");
  });

  it("la misma semilla da la misma partida", () => {
    const a = createPlayer("A", 3, 0), b = createPlayer("A", 3, 0);
    tickPlayer(a, FIRST_RAID);
    tickPlayer(b, FIRST_RAID);
    expect(a).toEqual(b);
  });
});
