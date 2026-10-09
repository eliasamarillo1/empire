import type { Kingdom } from "@empire/core";

/**
 * Almacén de reinos. De momento en memoria; la misma interfaz se implementará
 * sobre PostgreSQL cuando haya cuentas de jugador.
 */
export interface KingdomStore {
  create(kingdom: Kingdom): string;
  get(id: string): Kingdom | undefined;
  list(): [string, Kingdom][];
}

export function memoryStore(): KingdomStore {
  const data = new Map<string, Kingdom>();
  let next = 1;
  return {
    create(kingdom) {
      const id = String(next++);
      data.set(id, kingdom);
      return id;
    },
    get: (id) => data.get(id),
    list: () => [...data.entries()],
  };
}
