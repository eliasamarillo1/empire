// Arranca el servidor y el juego a la vez: `npm start`. Ctrl+C para los dos.
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { networkInterfaces } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
/** Ruta del ejecutable de un paquete instalado en un workspace (sin pasar por npm ni por una shell, para poder pararlo bien). */
const bin = (workspace, pkg, file) => join(dirname(createRequire(join(root, workspace, "package.json")).resolve(`${pkg}/package.json`)), file);

const [major] = process.versions.node.split(".").map(Number);
if (major < 22) {
  console.error(`Empire necesita Node 22 o más nuevo y tienes ${process.version}. Descárgalo en https://nodejs.org`);
  process.exit(1);
}

const colors = { servidor: "\x1b[35m", juego: "\x1b[36m" };
const children = [];

function run(name, workspace, args) {
  const child = spawn(process.execPath, args, { cwd: join(root, workspace), env: process.env });
  const prefix = `${colors[name]}[${name}]\x1b[0m `;
  const pipe = (stream, out) => {
    let rest = "";
    stream.on("data", (chunk) => {
      const lines = (rest + chunk).split("\n");
      rest = lines.pop();
      for (const line of lines) out.write(prefix + line + "\n");
    });
  };
  pipe(child.stdout, process.stdout);
  pipe(child.stderr, process.stderr);
  child.on("exit", (code) => {
    if (stopping) return;
    console.error(`${prefix}se ha parado (código ${code}). Paro también lo demás.`);
    stop(code ?? 1);
  });
  children.push(child);
}

let stopping = false;
function stop(code = 0) {
  stopping = true;
  for (const c of children) c.kill();
  process.exit(code);
}
process.on("SIGINT", () => stop());
process.on("SIGTERM", () => stop());

run("servidor", "apps/server", [bin("apps/server", "tsx", "dist/cli.mjs"), "watch", "src/main.ts"]);
run("juego", "apps/client", [bin("apps/client", "vite", "bin/vite.js")]);

const lan = Object.values(networkInterfaces()).flat().find((i) => i && i.family === "IPv4" && !i.internal)?.address;
setTimeout(() => {
  console.log("\n\x1b[1mEmpire está listo\x1b[0m");
  console.log("  En este ordenador:  http://localhost:5173");
  if (lan) console.log(`  En tu móvil (misma wifi):  http://${lan}:5173`);
  console.log("  Para pararlo: Ctrl+C\n");
}, 3000);
