import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import type { Player } from "@empire/core";

export interface Account {
  id: string;
  username: string;
  passwordHash: string;
  salt: string;
  createdAt: number;
}

export interface Session {
  accountId: string;
  expiresAt: number;
}

export interface Data {
  accounts: Record<string, Account>;
  players: Record<string, Player>;
  sessions: Record<string, Session>;
  nextId: number;
}

/**
 * Almacén de cuentas y partidas. Vive en memoria y, si se le da un fichero, se guarda en disco
 * tras cada cambio. La misma interfaz se podrá implementar sobre PostgreSQL.
 */
export class Store {
  data: Data;
  private timer: NodeJS.Timeout | null = null;

  constructor(private file?: string) {
    this.data = { accounts: {}, players: {}, sessions: {}, nextId: 1 };
    if (file) {
      try {
        this.data = JSON.parse(readFileSync(file, "utf8")) as Data;
      } catch (e) {
        if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e;
      }
    }
  }

  newId() {
    return String(this.data.nextId++);
  }

  findAccount(username: string) {
    const u = username.toLowerCase();
    return Object.values(this.data.accounts).find((a) => a.username.toLowerCase() === u);
  }

  /** Marca cambios. La escritura se agrupa para no tocar el disco en cada petición. */
  changed() {
    if (!this.file || this.timer) return;
    this.timer = setTimeout(() => this.flush(), 200);
  }

  flush() {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    if (!this.file) return;
    mkdirSync(dirname(this.file), { recursive: true });
    const tmp = this.file + ".tmp";
    writeFileSync(tmp, JSON.stringify(this.data));
    renameSync(tmp, this.file);
  }
}
