import { Engine, type Scene } from "@babylonjs/core";
import { KingdomView } from "./kingdomView";
import { WorldView } from "./worldView";
import { tuneEngine } from "./common";

/** Una pantalla 3D del juego (el reino o el mapa del mundo). */
export interface View {
  readonly scene: Scene;
  update(): void;
  dispose(): void;
}

export type ViewKey = "kingdom" | "world";

/** Motor 3D único para todo el juego; cambia de vista según la pestaña. */
export class Renderer {
  private engine: Engine;
  private view?: View;
  private key?: ViewKey;

  constructor(container: HTMLElement) {
    const canvas = document.createElement("canvas");
    canvas.style.width = "100%";
    canvas.style.height = "100%";
    canvas.style.touchAction = "none";
    canvas.addEventListener("contextmenu", (e) => e.preventDefault());
    container.appendChild(canvas);
    this.engine = new Engine(canvas, true, { stencil: true, preserveDrawingBuffer: false, powerPreference: "high-performance" }, true);
    tuneEngine(this.engine);
    window.addEventListener("resize", () => this.engine.resize());
    this.engine.runRenderLoop(() => {
      if (!this.view || document.hidden) return;
      this.view.update();
      this.view.scene.render();
    });
  }

  get active() {
    return this.key;
  }

  show(key: ViewKey) {
    if (key === this.key) return;
    this.view?.dispose();
    this.key = key;
    this.view = key === "kingdom" ? new KingdomView(this.engine) : new WorldView(this.engine);
  }

  /** Vuelve a crear la vista actual (por ejemplo, al entrar con otra cuenta y cambiar de mapa). */
  reload() {
    const k = this.key;
    this.key = undefined;
    if (k) this.show(k);
  }
}
