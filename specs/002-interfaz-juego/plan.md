# Plan de implementación: Interfaz de juego

**Rama**: `claude/motor-3d` | **Fecha**: 2026-10-14 | **Spec**: [spec.md](./spec.md)

## Resumen

Rehacer la capa HTML que va encima del 3D (barra superior, pestañas, paneles, ejército e inicio) con
iconos SVG propios y un aspecto de juego, y cambiar las etiquetas 3D del reino para que indiquen
acciones posibles (mejorar, construir) en lugar de niveles.

## Contexto técnico

**Lenguaje/versión**: TypeScript 5.8. **Dependencias**: ninguna nueva; HTML y CSS a mano, Babylon GUI
para las etiquetas 3D. **Pruebas**: typecheck, Vitest para `core` y capturas con Playwright en
1280 × 800, 390 × 844 y 320 × 640. **Plataforma**: navegador de escritorio y móvil.

## Comprobación de la constitución

| Principio | Cumple | Nota |
|-----------|--------|------|
| I. Reglas en `core` | Sí | La interfaz solo lee `core` (costes, producción, `upgradeBlocker`). |
| II. El servidor manda | Sí | Las acciones siguen pasando por `game`. |
| III. Pruebas | Sí | Sin reglas nuevas; checks completos antes del PR. |
| IV. Aspecto terminado | Sí | Capturas antes y después en `docs/capturas/interfaz-*`. |
| V. Móvil | Sí | Diseño pensado primero para 390 px; áreas táctiles de 40 px. |
| VI. Contenido sin programar | No aplica | |
| VII. En español | Sí | |

## Diseño

- `apps/client/src/icons.ts` (nuevo): iconos SVG en línea (oro, madera, piedra, comida, castillo,
  mapa, espadas, pergamino, martillo, reloj, escudo, estrella, flecha, más, candado, corazón) que
  heredan `currentColor`.
- Barra superior: píldoras de recurso con icono, cantidad, producción y barra de llenado; a la
  derecha, emblema de nivel con anillo de progreso, poder y estado del constructor (botón que
  selecciona el edificio en obras).
- Pestañas: icono encima del nombre; la activa con fondo y color dorado.
- Panel: cabecera con icono del edificio o casilla, nombre y nivel; bloque "ahora → siguiente";
  botón principal con nivel destino y tiempo; lista de lo que falta. En móvil, hoja inferior con asa.
- Ejército: rejilla de tarjetas (`auto-fill, minmax(260px, 1fr)`).
- Inicio: "Jugar" principal, "Entrar con cuenta" despliega el formulario.
- Reino 3D: la firma de redibujado incluye el conjunto de edificios mejorables; las etiquetas pasan
  a ser una flecha verde (mejorable) o un más (construible).

## Estructura

```text
apps/client/src/
├── icons.ts              # nuevo
├── ui.ts                 # barra, pestañas, panel, ejército, inicio
├── style.css             # estilos de juego
└── render/kingdomView.ts # etiquetas de acción en lugar de niveles
```
