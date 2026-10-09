# Empire

Juego de estrategia web y móvil inspirado en Social Empires: reino leveleable, mapa explorable con recursos, dragones y otras criaturas, ejércitos y fortalezas, y ataques entre reinos.

## Estructura

```
packages/core   Reglas del juego: recursos, edificios, unidades, dragón, mundo y combate determinista.
                Lo usan tanto el cliente como el servidor, así las reglas son las mismas en los dos lados.
apps/client     El juego: Phaser 3 + TypeScript con vista isométrica (reino y mapa del mundo).
apps/server     API en Node (Fastify) que guarda reinos y resuelve los ataques entre jugadores.
prototipo/      El primer prototipo en un solo archivo HTML, como referencia.
docs/           Documento de diseño y stack técnico.
```

## Cómo arrancarlo

Necesitas Node 22.

```bash
npm install
npm run dev          # el juego en http://localhost:5173
npm run dev:server   # la API en http://localhost:3000
npm test             # tests de core y del servidor
npm run build        # versión para publicar en apps/client/dist
```

## Cómo funciona el combate

La batalla se simula por rondas con una semilla. Con los mismos ejércitos y la misma semilla el resultado es idéntico. En un ataque entre jugadores el cliente solo envía qué tropas manda; el servidor elige la semilla, simula y devuelve las rondas para que el cliente las reproduzca. Así nadie puede inventarse una victoria.

## Estado

- El cliente funciona solo, con la partida guardada en el navegador y reinos rivales controlados por la máquina.
- El servidor ya tiene la API de reinos y ataques, con almacenamiento en memoria.
- Próximos pasos: cuentas de jugador, PostgreSQL, conectar el cliente al servidor y empaquetar para móvil con Capacitor.
