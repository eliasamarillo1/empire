# Tareas: Mapa del mundo como paisaje

**Entrada**: [spec.md](./spec.md) y [plan.md](./plan.md).

## Formato: `[ID] [P?] [Historia] Descripción`

- **[P]**: se puede hacer en paralelo (otro archivo, sin dependencias).
- **[H1]…[H4]**: historia de usuario de la spec.

## Fase 1: Preparación

- [X] T001 Añadir Spec Kit al repositorio (`.specify/`, `.claude/skills/speckit-*`) y la constitución
- [X] T002 Guardar capturas de referencia del mapa anterior (tablero) para comparar

## Fase 2: Base común

- [X] T003 Hacer que `onTap` devuelva también el punto tocado en `apps/client/src/render/common.ts`
- [X] T004 [P] Añadir el árbol de copa redonda `broadleaf` en `apps/client/src/render/kit.ts`

## Fase 3: Historia 1, ver el mundo como un paisaje (P1) 🎯

**Objetivo**: el mapa es una isla continua con relieve, agua y bosques.

**Prueba independiente**: captura con todo explorado sin bordes rectos entre casillas.

- [X] T005 [H1] Tablas por casilla con margen de mar (altura, montaña, llano) en `worldView.ts`
- [X] T006 [H1] `heightAt` con interpolación suavizada, ondulación y picos de ruido en `worldView.ts`
- [X] T007 [H1] Malla de terreno y normales en `worldView.ts`
- [X] T008 [H1] Colores por vértice: hierba, bosque, oro, guarida, roca, nieve, arena y fondo en `worldView.ts`
- [X] T009 [H1] Plano de agua translúcido para mar y lagos en `worldView.ts`
- [X] T010 [H1] Bosques mixtos, arbustos y flores apoyados en el terreno, nunca en el agua
- [X] T011 [H1] Selección de casilla a partir del punto tocado en el terreno
- [X] T012 [H1] Capturas y vista previa publicadas para que Elias las revise
- [X] T012b [H1] Deformar las coordenadas con ruido para que la costa y los cambios de terreno no sigan líneas rectas

**Punto de control**: Elias revisa el paisaje (SC-001).

## Fase 4: Historia 2, descubrir lo que hay bajo las nubes (P2)

- [X] T013 [H2] Nubes sobre lo inexplorado y bruma en lo explorable en `worldView.ts`
- [X] T014 [H2] Animación de la nube al disiparse cuando se explora una casilla (FR-006) en `worldView.ts`

## Fase 5: Historia 3, reconocer cada cosa de un vistazo (P3)

- [X] T015 [P] [H3] Guarida como entrada de cueva con luz rojiza en una colina (FR-007) en `worldView.ts`
- [X] T016 [P] [H3] Vetas de oro brillantes que disminuyen al agotarse en `worldView.ts`
- [X] T017 [H3] Etiquetas más discretas: solo nivel en guaridas, y ocultarlas al alejar la cámara

## Fase 6: Historia 4, moverse con comodidad en el móvil (P3)

- [X] T018 [H4] Capturas a tamaño de móvil (390 × 844) y revisión de la interfaz sobre el mapa (barra de recursos en una fila en `style.css`)
- [ ] T019 [H4] Bajar la resolución del terreno y las sombras en pantallas táctiles si hace falta
- [ ] T020 [H4] Medir imágenes por segundo en un móvil real (SC-004)

## Fase 7: Pulido

- [ ] T021 [P] Comprobar mapas de Tiled de otros tamaños (casos límite)
- [ ] T022 Actualizar `docs/mapas-tiled.md` con cómo se ve cada tipo de casilla en 3D

## Dependencias

- Fase 2 antes que las historias. Las historias 2, 3 y 4 son independientes entre sí una vez hecha
  la historia 1.
- T015 y T016 pueden hacerse a la vez.
