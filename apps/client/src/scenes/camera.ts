import Phaser from "phaser";

const MIN_ZOOM = 0.35;
const MAX_ZOOM = 2.5;

/**
 * Arrastrar para mover, rueda o pellizco para hacer zoom y toque para seleccionar.
 * Un toque solo cuenta si el dedo apenas se movió.
 */
export function cameraControls(scene: Phaser.Scene, onTap: (worldX: number, worldY: number) => void) {
  const cam = scene.cameras.main;
  scene.input.addPointer(1);
  let moved = false;
  let startX = 0, startY = 0, pinch = 0;
  const zoom = (z: number) => cam.setZoom(Phaser.Math.Clamp(z, MIN_ZOOM, MAX_ZOOM));

  scene.input.on("pointerdown", (p: Phaser.Input.Pointer) => {
    startX = p.x;
    startY = p.y;
    moved = false;
  });
  scene.input.on("pointermove", (p: Phaser.Input.Pointer) => {
    const a = scene.input.pointer1, b = scene.input.pointer2;
    if (a.isDown && b.isDown) {
      const d = Phaser.Math.Distance.Between(a.x, a.y, b.x, b.y);
      if (pinch) zoom((cam.zoom * d) / pinch);
      pinch = d;
      moved = true;
      return;
    }
    pinch = 0;
    if (!p.isDown) return;
    if (Math.hypot(p.x - startX, p.y - startY) > 8) moved = true;
    if (moved) {
      cam.scrollX -= (p.x - p.prevPosition.x) / cam.zoom;
      cam.scrollY -= (p.y - p.prevPosition.y) / cam.zoom;
    }
  });
  scene.input.on("pointerup", (p: Phaser.Input.Pointer) => {
    if (!moved) {
      const w = cam.getWorldPoint(p.x, p.y);
      onTap(w.x, w.y);
    }
    pinch = 0;
  });
  scene.input.on("wheel", (_p: unknown, _o: unknown, _dx: number, dy: number) => zoom(cam.zoom * (dy > 0 ? 0.9 : 1.1)));
}

/** Centra la cámara en un punto y ajusta el zoom para que quepa un ancho/alto dados. */
export function fit(scene: Phaser.Scene, cx: number, cy: number, width: number, height: number) {
  const cam = scene.cameras.main;
  const z = Math.min(cam.width / width, cam.height / height);
  cam.setZoom(Phaser.Math.Clamp(z, MIN_ZOOM, MAX_ZOOM));
  cam.centerOn(cx, cy);
}
