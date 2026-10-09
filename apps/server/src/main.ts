import { buildApp } from "./app";
import { Store } from "./store";

const port = Number(process.env.PORT ?? 3000);
const store = new Store(process.env.DATA_FILE ?? "data/empire.json");
const app = buildApp({ store });

for (const signal of ["SIGINT", "SIGTERM"] as const)
  process.on(signal, () => {
    store.flush();
    process.exit(0);
  });

app.listen({ port, host: "0.0.0.0" }).then(() => console.log(`Servidor de Empire en http://localhost:${port}`));
