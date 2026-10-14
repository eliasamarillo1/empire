# Plan de implementación: Aspecto con los packs de arte

**Rama**: `claude/motor-3d` | **Fecha**: 2026-10-14 | **Spec**: [spec.md](./spec.md)

## Resumen

Copiar al cliente solo las piezas que se usan de cada pack, vestir la interfaz con `border-image`,
mapear edificios y casillas a KayKit en `modelos.json`, iluminar con el HDRI y añadir un módulo de
sonido.

## Contexto técnico

**Dependencias**: ninguna nueva (Babylon ya trae el cargador glTF y `HDRCubeTexture`).
**Pruebas**: typecheck, Vitest de `core` y capturas con Playwright en 1280 × 800, 390 × 844 y 320 × 640.

## Comprobación de la constitución

| Principio | Cumple | Nota |
|-----------|--------|------|
| I. Reglas en `core` | Sí | Solo presentación. |
| II. El servidor manda | Sí | Sin cambios. |
| III. Pruebas | Sí | Checks completos antes del PR. |
| IV. Aspecto terminado | Sí | Capturas antes y después; modelos por `modelos.json`. |
| V. Móvil | Sí | Capturas a 390 y 320 px. |
| VI. Contenido sin programar | Sí | Cambiar un modelo es editar `modelos.json`. |
| VII. En español | Sí | |

## Estructura

```text
apps/client/public/
├── ui/                  # 16 PNG del kit de Kenney + licencia
├── sonidos/             # 9 OGG de Kenney + licencia
├── env/cielo.hdr        # Aarfontein Sunrise reducido a 1024 × 512
└── models/
    ├── modelos.json     # edificio o casilla → archivo, escala, nivel
    └── kaykit/          # glTF + .bin usados, textura común y licencia
apps/client/src/
├── sound.ts             # nuevo: sonidos y silencio
├── style.css            # bloque "Piel del juego (spec 003)"
└── render/common.ts     # entorno HDR
docs/creditos.md         # nuevo: autores y licencias
```

## Correspondencia de modelos

| Juego | KayKit |
|-------|--------|
| castle | building_castle_blue |
| house | building_home_A_blue (nivel 1-3), building_home_B_blue (4+) |
| farm | building_grain (1-3), building_windmill_blue (4+) |
| sawmill | building_lumbermill_blue |
| quarry | building_mine_blue |
| storage | building_market_blue |
| barracks | building_barracks_blue |
| stable | building_archeryrange_blue |
| casilla forest | trees_A/B large y medium |
| casilla mountain | mountain_A/B_grass_trees, mountain_C_grass |
| casilla ruins | building_destroyed |
| casilla kingdom | building_castle_red |
| casilla home | building_castle_blue |
