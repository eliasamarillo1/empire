import { describe, expect, it } from "vitest";
import { generateWorld, tileAt, center, canExplore, reveal } from "../src";

describe("mundo", () => {
  it("la misma semilla genera el mismo mapa", () => {
    expect(generateWorld(123)).toEqual(generateWorld(123));
  });

  it("pone tu reino en el centro y 8 reinos rivales", () => {
    const w = generateWorld(5);
    expect(tileAt(w, center(w), center(w))!.kind).toBe("home");
    expect(w.tiles.filter((t) => t.kind === "kingdom")).toHaveLength(8);
  });

  it("solo se explora junto a lo ya visto", () => {
    const w = generateWorld(9);
    expect(canExplore(w, 0, 0)).toBe(false);
    expect(canExplore(w, center(w) + 3, center(w))).toBe(true);
    reveal(w, center(w) + 3, center(w));
    expect(tileAt(w, center(w) + 4, center(w))!.seen).toBe(true);
  });
});
