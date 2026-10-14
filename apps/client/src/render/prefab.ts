import { Mesh, TransformNode, type AbstractMesh, type Scene, type ShadowGenerator } from "@babylonjs/core";

/**
 * Un objeto que se coloca muchas veces (un árbol, una roca, un castillo).
 * Se construye una vez, oculto, y cada copia reutiliza su geometría: muchos objetos, pocas llamadas de dibujo.
 */
export interface Prefab {
  place(parent: TransformNode, x: number, z: number, opts?: { rotation?: number; scale?: number; y?: number }): TransformNode;
}

/** Prefab hecho con mallas de Babylon (las figuras construidas en código). */
export class MeshPrefab implements Prefab {
  private meshes: Mesh[];
  private count = 0;

  constructor(private name: string, root: TransformNode, private shadows?: ShadowGenerator, receive = true) {
    root.computeWorldMatrix(true);
    this.meshes = root.getChildMeshes(false).filter((m): m is Mesh => m instanceof Mesh);
    for (const m of this.meshes) {
      // Cada malla guarda su transformación respecto a la raíz para poder copiarla.
      m.computeWorldMatrix(true);
      m.receiveShadows = receive;
      // El original no se ve ni se puede tocar; solo se ven sus copias.
      m.isVisible = false;
      m.isPickable = false;
    }
  }

  place(parent: TransformNode, x: number, z: number, opts: { rotation?: number; scale?: number; y?: number } = {}) {
    const node = new TransformNode(`${this.name}-${this.count++}`, parent.getScene());
    node.parent = parent;
    node.position.set(x, opts.y ?? 0, z);
    node.rotation.y = opts.rotation ?? 0;
    node.scaling.setAll(opts.scale ?? 1);
    for (const m of this.meshes) {
      const inst = m.createInstance(`${m.name}-i`);
      inst.parent = node;
      inst.position.copyFrom(m.position);
      inst.rotation.copyFrom(m.rotation);
      if (m.rotationQuaternion) inst.rotationQuaternion = m.rotationQuaternion.clone();
      inst.scaling.copyFrom(m.scaling);
      inst.isPickable = true;
      this.shadows?.addShadowCaster(inst, false);
    }
    return node;
  }
}

/** Agrupa mallas sueltas bajo una raíz y devuelve la raíz (para construir prefabs). */
export function group(name: string, scene: Scene, parts: AbstractMesh[]) {
  const root = new TransformNode(name, scene);
  for (const p of parts) p.parent = root;
  return root;
}
