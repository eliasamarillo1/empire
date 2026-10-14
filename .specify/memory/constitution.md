# Constitución de Empire

Empire es un juego de estrategia web y móvil inspirado en Social Empires: cada jugador levanta y
diseña su reino, explora un mapa del mundo, cría criaturas y ataca a otros reinos.

## Principios

### I. Las reglas viven en `packages/core`

Toda regla del juego (costes, producción, combate, exploración, mapas) MUST estar en
`packages/core`, escrita en TypeScript puro, sin dependencias del navegador ni del servidor, y ser
determinista: la misma entrada da siempre el mismo resultado. El cliente y el servidor importan
las mismas funciones. El dibujo (`apps/client/src/render`) MUST NOT contener reglas.

Motivo: así el servidor puede repetir y validar cualquier acción del cliente, y cambiar el motor
gráfico no toca el juego.

### II. El servidor tiene la última palabra

En partidas en línea, el servidor MUST validar cada acción con las reglas de `core` antes de
guardarla. El cliente puede adelantarse para que el juego responda al instante, pero MUST aceptar
el estado que devuelva el servidor.

Motivo: evitar trampas en el PvP asíncrono.

### III. Reglas con pruebas

Cada regla nueva o cambiada en `core` MUST llevar pruebas en Vitest. `npm run typecheck`,
`npm test` y `npm run build` MUST pasar antes de abrir o actualizar un PR.

### IV. Aspecto de juego terminado

El objetivo visual es la calidad de Los Sims y la claridad de Social Empires: un mundo 3D cálido y
legible, nunca un tablero de casillas. Cada cambio visual MUST comprobarse con capturas reales
(escritorio y móvil) antes de entregarse, y las capturas acompañan la entrega. Los modelos hechos
en código son provisionales y MUST poder sustituirse por modelos glTF desde
`public/models/modelos.json` sin tocar código.

### V. Funciona en un móvil normal

El juego MUST mantenerse fluido en un móvil de gama media: geometría repetida con instancias,
sombras y resolución reducidas en pantallas táctiles y controles táctiles de primera clase (girar,
pellizcar, desplazar con dos dedos). Toda dependencia nueva MUST justificarse por su peso en el
paquete descargado.

### VI. Contenido editable sin programar

Los mapas del mundo se dibujan en Tiled (`public/maps`), los modelos 3D se declaran en
`modelos.json` y el reino del jugador se edita dentro del juego. Añadir contenido MUST NOT exigir
cambios de código cuando el formato ya lo admite.

### VII. En español

Textos del juego, documentación, especificaciones y mensajes de commit MUST estar en español.
Los nombres de código pueden seguir en inglés cuando ya lo están.

## Tecnología

- Monorepo npm: `packages/core` (reglas), `apps/client` (Vite + Babylon.js), `apps/server`
  (Fastify). Node 22 o superior.
- Móvil con Capacitor sobre el mismo cliente web.
- Persistencia actual en JSON; PostgreSQL cuando haya mundo compartido (fase 6 del plan).

## Forma de trabajo

- Desarrollo guiado por especificaciones con Spec Kit: cada funcionalidad tiene su carpeta en
  `specs/NNN-nombre/` con `spec.md` (qué y por qué), `plan.md` (cómo) y `tasks.md` (pasos), en
  ese orden, antes de implementar. Los cambios de alcance se reflejan primero en la spec.
- Cada funcionalidad va en su propia rama y PR; la CI MUST estar en verde para fusionar.
- Las decisiones de Elias (dueño del producto) sobre aspecto y prioridades prevalecen sobre las
  recomendaciones técnicas, y quedan anotadas en la spec correspondiente.

## Gobierno

Esta constitución prevalece sobre cualquier otra costumbre del repositorio. Se modifica con un PR
que explique el cambio y suba la versión: MAJOR si se quita o redefine un principio, MINOR si se
añade uno o se amplía, PATCH para aclaraciones. Cada plan (`plan.md`) MUST incluir la
comprobación contra estos principios.

**Versión**: 1.0.0 | **Ratificada**: 2026-10-14 | **Última modificación**: 2026-10-14
