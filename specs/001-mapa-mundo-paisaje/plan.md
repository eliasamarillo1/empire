# Plan de implementación: Mapa del mundo como paisaje

**Rama**: `claude/motor-3d` | **Fecha**: 2026-10-14 | **Spec**: [spec.md](./spec.md)

**Entrada**: especificación de `specs/001-mapa-mundo-paisaje/spec.md`.

## Resumen

Sustituir las losas cuadradas del mapa por una única malla de terreno generada a partir de las
casillas: cada tipo aporta una altura y un color, que se interpolan suavemente entre casillas y se
modulan con ruido para que el relieve sea natural. Un plano de agua translúcido hace de mar y de
lagos. Los objetos se colocan con la misma función de altura. Las nubes sustituyen a la niebla
oscura y se disipan al explorar.

## Contexto técnico

**Lenguaje/versión**: TypeScript 5.8, Node 22.

**Dependencias principales**: Babylon.js 9.27 (`@babylonjs/core`, `@babylonjs/gui`), Vite 6.

**Almacenamiento**: no aplica; el estado del mundo ya existe en `core`.

**Pruebas**: Vitest para `core` (sin cambios); capturas con Playwright y Chromium para lo visual.

**Plataforma**: navegadores de escritorio y móvil; después, Capacitor.

**Tipo de proyecto**: monorepo web (cliente, servidor, `core`).

**Objetivos de rendimiento**: 30 fps o más en móvil de gama media; recoloreado al explorar en menos
de 100 ms.

**Restricciones**: un solo material para el terreno; objetos repetidos con instancias; el terreno
de un mapa de 25 × 25 con margen de 8 casillas tiene unos 42 000 vértices.

**Escala**: mapas de Tiled hasta unos 64 × 64 casillas.

## Comprobación de la constitución

| Principio | Cumple | Nota |
|-----------|--------|------|
| I. Reglas en `core` | Sí | Solo cambia `apps/client/src/render/worldView.ts` (y `kit.ts`, `common.ts`). |
| II. El servidor manda | Sí | No se toca el servidor ni las acciones. |
| III. Reglas con pruebas | Sí | No hay reglas nuevas; typecheck, tests y build pasan. |
| IV. Aspecto terminado | Sí | Capturas antes (`mapa-antes.png`) y después en `docs/capturas/`. |
| V. Móvil | Pendiente | Falta medir en un móvil real (tarea T020). |
| VI. Contenido sin programar | Sí | `modelos.json` sigue sustituyendo cualquier casilla. |
| VII. En español | Sí | Código comentado, textos y documentos en español. |

## Diseño

### Terreno

- Malla `CreateGround` de `(tamaño + 2 × MARGEN) × SUB` subdivisiones (SUB = 5 vértices por casilla).
- Tablas por casilla (incluido el margen): altura base por tipo, peso de montaña, peso de llano
  (bajo castillos) y bruma. Fuera del mapa la altura es de fondo marino.
- Antes de interpolar, las coordenadas se deforman con ruido (±0,55 casillas) para que ni la costa
  ni los cambios de terreno sigan líneas rectas.
- `heightAt(x, z)` = interpolación bilineal suavizada de la altura base + ondulación de ruido
  (anulada bajo los castillos) + picos de ruido proporcionales al cuadrado del peso de montaña.
- Color por vértice: hierba con variación, mezclas de bosque, oro y guarida, roca según pendiente y
  altura, nieve en las cumbres, arena en la orilla, verdes azulados y azul oscuro bajo el agua, y
  gris claro de bruma sobre lo inexplorado.
- Se reconstruye solo si cambia la firma de tipos; se recolorea solo si cambia la firma de bruma.

### Agua

Un plano de 3000 × 3000 (su borde no se ve ni con la cámara más alejada) a `WATER = -0.12`, translúcido (alpha 0.78) y con algo de brillo especular.

### Objetos y nubes

- Prefabs con instancias: pinos, robles, arbustos, flores, rocas, peñas, pepitas, guarida, ruinas,
  castillos y nube (5 esferas aplanadas).
- `place()` apoya cada objeto en `heightAt` y descarta los que caerían al agua.
- Las casillas cambian por firma (tipo, nivel, cantidad, escudo, versión de modelos, niebla) y solo
  se redibujan las que cambian.

### Selección

`onTap` devuelve también el punto tocado; si se toca el terreno, la casilla se calcula a partir de
ese punto.

## Estructura del proyecto

### Documentación

```text
specs/001-mapa-mundo-paisaje/
├── spec.md
├── plan.md
├── quickstart.md
└── tasks.md
```

### Código

```text
apps/client/src/render/
├── common.ts       # onTap devuelve el punto tocado
├── kit.ts          # nuevo árbol de copa redonda (broadleaf)
└── worldView.ts    # terreno, agua, objetos, nubes, selección
```

**Decisión de estructura**: todo queda dentro de la vista del mundo del cliente; no hacen falta
módulos nuevos.

## Seguimiento de complejidad

Sin infracciones de la constitución.
