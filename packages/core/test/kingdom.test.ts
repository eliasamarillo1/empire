import { describe, expect, it } from "vitest";
import { advance, buildingCost, capacity, createKingdom, feed, hatch, startUpgrade, train, dragonLevel, MAX_OFFLINE_SECONDS } from "../src";

describe("reino", () => {
  it("produce recursos con el tiempo sin pasar la capacidad", () => {
    const k = createKingdom("Test", 0);
    advance(k, 10);
    expect(k.res.gold).toBeCloseTo(400 + 0.5 * 10);
    advance(k, 10 + MAX_OFFLINE_SECONDS * 2);
    expect(k.res.gold).toBe(capacity(k));
  });

  it("ningún edificio supera el nivel del castillo", () => {
    const k = createKingdom("Test", 0);
    expect(startUpgrade(k, "farm", 0)).toEqual({ ok: false, reason: "Sube el Castillo para mejorar más" });
    expect(startUpgrade(k, "castle", 0).ok).toBe(true);
  });

  it("cobra la obra y la termina al llegar su hora", () => {
    const k = createKingdom("Test", 0);
    const cost = buildingCost("castle", 1);
    startUpgrade(k, "castle", 0);
    expect(k.res.wood).toBe(400 - cost.wood!);
    expect(startUpgrade(k, "castle", 1)).toEqual({ ok: false, reason: "El constructor está ocupado" });
    const events = advance(k, k.upgrade!.endsAt);
    expect(events).toContainEqual({ type: "upgraded", key: "castle", level: 2 });
    expect(k.buildings.castle).toBe(2);
  });

  it("entrena en cola, una unidad detrás de otra", () => {
    const k = createKingdom("Test", 0);
    train(k, "inf", 3, 0);
    expect(k.queue).toHaveLength(3);
    advance(k, 4.01);
    expect(k.army.inf).toBe(8 + 2);
    advance(k, 6.01);
    expect(k.army.inf).toBe(8 + 3);
  });

  it("no deja entrenar unidades bloqueadas", () => {
    const k = createKingdom("Test", 0);
    expect(train(k, "cav", 1, 0).ok).toBe(false);
  });

  it("el dragón eclosiona, crece y el nido limita su nivel", () => {
    const k = createKingdom("Test", 0);
    expect(hatch(k, 0).ok).toBe(false);
    k.buildings.nest = 1;
    k.res.food = 5000;
    expect(hatch(k, 0, 0).ok).toBe(true);
    expect(feed(k).ok).toBe(false);
    advance(k, 30);
    let fed = 0;
    while (feed(k).ok) fed++;
    expect(dragonLevel(k.dragon!)).toBe(4);
    expect(fed).toBeGreaterThan(0);
  });
});
