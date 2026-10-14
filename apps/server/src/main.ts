import { buildApp } from "./app";
import { mapFromEnv } from "./maps";
import { Store } from "./store";

const port = Number(process.env.PORT ?? 3000);
const store = new Store(process.env.DATA_FILE ?? "data/empire.json");
const world = mapFromEnv(process.env.MAP_FILE);
const app = buildApp({ store, world });
console.log(world ? `Partidas nuevas con el mapa «${world.map}» (${world.size} × ${world.size})` : "Partidas nuevas con mapa generado");

for (const signal of ["SIGINT", "SIGTERM"] as const)
  process.on(signal, () => {
    store.flush();
    process.exit(0);
  });

app.listen({ port, host: "0.0.0.0" }).then(() => console.log(`Servidor de Empire en http://localhost:${port}`));
