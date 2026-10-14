import {
  ArcRotateCamera, Color3, Color4, DirectionalLight, HemisphericLight, Mesh, MeshBuilder, PointerEventTypes, Scene,
  ShadowGenerator, StandardMaterial, TransformNode, Vector3, VertexData, type AbstractMesh, type Engine,
} from "@babylonjs/core";

/** Paleta del juego: colores planos, cálidos y algo apagados, para un aspecto de maqueta. */
export const PALETTE = {
  grass: "#6f9a4a",
  grassDark: "#5d8740",
  path: "#b39a6b",
  dirt: "#7a5b3a",
  stone: "#a6a093",
  stoneDark: "#7d786d",
  brick: "#a65a3e",
  wood: "#8a6239",
  woodDark: "#5e4128",
  roofRed: "#b5523b",
  roofBlue: "#4d6e9e",
  roofGold: "#d9a648",
  plaster: "#e6dcc3",
  water: "#3f7fa6",
  leaves: "#3f7a3a",
  leavesDark: "#2f6230",
  snow: "#f1efe8",
  gold: "#f2c14e",
  fog: "#1a2420",
  purple: "#7d62b3",
  danger: "#9b2f26",
  selection: "#ffd36b",
} as const;

/** Materiales mate compartidos por color: muchos objetos, pocos materiales. */
export class Materials {
  private cache = new Map<string, StandardMaterial>();
  constructor(private scene: Scene) {}

  get(hex: string, opts: { alpha?: number; emissive?: number } = {}) {
    const key = `${hex}|${opts.alpha ?? 1}|${opts.emissive ?? 0}`;
    let m = this.cache.get(key);
    if (!m) {
      m = new StandardMaterial(key, this.scene);
      m.diffuseColor = Color3.FromHexString(hex);
      m.specularColor = new Color3(0.06, 0.06, 0.06);
      if (opts.emissive) m.emissiveColor = Color3.FromHexString(hex).scale(opts.emissive);
      if (opts.alpha !== undefined && opts.alpha < 1) m.alpha = opts.alpha;
      this.cache.set(key, m);
    }
    return m;
  }
}

/** Cielo, niebla, luz de ambiente y sol con sombras suaves. */
export function setupLighting(scene: Scene, sky: string, fogDensity: number, shadowSize: number) {
  const c = Color3.FromHexString(sky);
  scene.clearColor = new Color4(c.r, c.g, c.b, 1);
  scene.fogMode = Scene.FOGMODE_EXP2;
  scene.fogColor = c;
  scene.fogDensity = fogDensity;
  scene.ambientColor = new Color3(0.25, 0.25, 0.25);

  const hemi = new HemisphericLight("cielo", new Vector3(0.2, 1, 0.1), scene);
  hemi.intensity = 0.55;
  hemi.groundColor = new Color3(0.32, 0.3, 0.36);

  const sun = new DirectionalLight("sol", new Vector3(-0.7, -0.75, 0.45), scene);
  sun.position = new Vector3(28, 30, -18);
  sun.intensity = 0.95;
  sun.diffuse = new Color3(1, 0.95, 0.85);

  // Zona fija de sombras alrededor del centro: si se calcula sola abarca todo y las sombras se pierden.
  sun.shadowFrustumSize = shadowSize;
  sun.autoCalcShadowZBounds = true;

  const mobile = matchMedia("(pointer: coarse)").matches;
  const shadows = new ShadowGenerator(mobile ? 1024 : 2048, sun);
  shadows.usePercentageCloserFiltering = true;
  shadows.filteringQuality = mobile ? ShadowGenerator.QUALITY_LOW : ShadowGenerator.QUALITY_MEDIUM;
  shadows.bias = 0.002;
  shadows.normalBias = 0.02;
  shadows.darkness = 0.2;
  return { sun, shadows };
}

/**
 * Cámara al estilo de Los Sims: un dedo (o el botón izquierdo) gira alrededor, la rueda o el pellizco acercan,
 * y dos dedos (o el botón derecho) desplazan. La inclinación está limitada para no meterse bajo el suelo.
 */
export function orbitCamera(scene: Scene, target: Vector3, radius: number, limits: { min: number; max: number }) {
  const cam = new ArcRotateCamera("camara", -Math.PI / 4, 0.95, radius, target, scene);
  cam.lowerBetaLimit = 0.35;
  cam.upperBetaLimit = 1.2;
  cam.lowerRadiusLimit = limits.min;
  cam.upperRadiusLimit = limits.max;
  cam.wheelDeltaPercentage = 0.01;
  cam.pinchDeltaPercentage = 0.004;
  cam.panningSensibility = 60;
  cam.panningAxis = new Vector3(1, 0, 1);
  cam.useNaturalPinchZoom = true;
  cam.inertia = 0.82;
  cam.panningInertia = 0.82;
  cam.angularSensibilityX = 900;
  cam.angularSensibilityY = 1400;
  cam.minZ = 0.5;
  cam.maxZ = 400;
  cam.attachControl(scene.getEngine().getRenderingCanvas()!, true);
  return cam;
}

/** Mantiene el centro de la cámara dentro de una zona para no perderse. */
export function clampTarget(cam: ArcRotateCamera, minX: number, maxX: number, minZ: number, maxZ: number) {
  cam.onViewMatrixChangedObservable.add(() => {
    const t = cam.target;
    const x = Math.min(maxX, Math.max(minX, t.x)), z = Math.min(maxZ, Math.max(minZ, t.z));
    if (x !== t.x || z !== t.z || t.y !== 0) cam.target = new Vector3(x, 0, z);
  });
}

/** Un toque solo cuenta si el dedo apenas se movió: así girar la cámara no selecciona nada. */
export function onTap(scene: Scene, handler: (mesh: AbstractMesh | null, point: Vector3 | null) => void) {
  let sx = 0, sy = 0, moved = false, fingers = 0;
  scene.onPointerObservable.add((info) => {
    const e = info.event as PointerEvent;
    if (info.type === PointerEventTypes.POINTERDOWN) {
      fingers++;
      if (fingers === 1) {
        sx = e.clientX;
        sy = e.clientY;
        moved = false;
      } else moved = true;
    } else if (info.type === PointerEventTypes.POINTERMOVE) {
      if (Math.hypot(e.clientX - sx, e.clientY - sy) > 8) moved = true;
    } else if (info.type === PointerEventTypes.POINTERUP) {
      fingers = Math.max(0, fingers - 1);
      if (moved || e.button > 0) return;
      const pick = scene.pick(scene.pointerX, scene.pointerY, (m) => m.isPickable && m.isEnabled());
      handler(pick?.hit ? pick.pickedMesh : null, pick?.hit ? pick.pickedPoint : null);
    }
  });
}

/** Sube por la jerarquía hasta el primer nodo con datos de selección. */
export function findMeta<T>(mesh: AbstractMesh | null): T | undefined {
  let n: TransformNode | AbstractMesh | null = mesh;
  while (n) {
    if (n.metadata?.select !== undefined) return n.metadata.select as T;
    n = n.parent as TransformNode | null;
  }
  return undefined;
}

/** Tejado a dos aguas: un prisma triangular de ancho w, fondo d y alto h, apoyado en y=0. */
export function gableRoof(name: string, w: number, d: number, h: number, scene: Scene) {
  const hw = w / 2, hd = d / 2;
  // Dos faldones, dos hastiales; cada cara con sus propios vértices para que la luz marque las aristas.
  const p = [
    -hw, 0, -hd, hw, 0, -hd, hw, h, 0, -hw, h, 0, // faldón delantero
    hw, 0, hd, -hw, 0, hd, -hw, h, 0, hw, h, 0, // faldón trasero
    -hw, 0, hd, -hw, 0, -hd, -hw, h, 0, // hastial izquierdo
    hw, 0, -hd, hw, 0, hd, hw, h, 0, // hastial derecho
  ];
  const idx = [0, 2, 1, 0, 3, 2, 4, 6, 5, 4, 7, 6, 8, 10, 9, 11, 13, 12];
  const normals: number[] = [];
  VertexData.ComputeNormals(p, idx, normals);
  const vd = new VertexData();
  vd.positions = p;
  vd.indices = idx;
  vd.normals = normals;
  const m = new Mesh(name, scene);
  vd.applyToMesh(m);
  return m;
}

export const box = (name: string, w: number, h: number, d: number, scene: Scene) => {
  const m = MeshBuilder.CreateBox(name, { width: w, height: h, depth: d }, scene);
  m.position.y = h / 2;
  m.bakeCurrentTransformIntoVertices();
  return m;
};

export const cylinder = (name: string, diameter: number, h: number, scene: Scene, tessellation = 10, top?: number) => {
  const m = MeshBuilder.CreateCylinder(name, { diameterBottom: diameter, diameterTop: top ?? diameter, height: h, tessellation }, scene);
  m.position.y = h / 2;
  m.bakeCurrentTransformIntoVertices();
  return m;
};

export const cone = (name: string, diameter: number, h: number, scene: Scene, tessellation = 8) => cylinder(name, diameter, h, scene, tessellation, 0);

/** Ajusta la resolución al dispositivo sin pasarse en pantallas muy densas (ahorra batería en el móvil). */
export function tuneEngine(engine: Engine) {
  engine.setHardwareScalingLevel(1 / Math.min(window.devicePixelRatio || 1, 2));
}
