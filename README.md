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
npm run dev:server   # la API en http://localhost:3000 (guarda en apps/server/data/empire.json)
npm run dev          # el juego en http://localhost:5173, con /api redirigido al servidor
npm test             # tests de core y del servidor
npm run build        # versión para publicar en apps/client/dist
```

## Cómo funciona el combate

La batalla se simula por rondas con una semilla. Con los mismos ejércitos y la misma semilla el resultado es idéntico. En un ataque entre jugadores el cliente solo envía qué tropas manda; el servidor elige la semilla, simula y devuelve las rondas para que el cliente las reproduzca. Así nadie puede inventarse una victoria.

## Cuentas y modo sin conexión

Al abrir el juego puedes entrar con tu cuenta, crear una o jugar sin conexión.

- **Con cuenta**: el servidor guarda tu partida y decide todo (producción, obras, recolección, batallas y asaltos de la IA). El cliente solo envía órdenes y muestra lo que el servidor responde. Las casillas sin explorar no se envían, así que no se puede leer el mapa escondido. En Informes aparecen los rivales de tu rango de poder (70 % a 130 % del tuyo) y puedes atacarles aunque no estén conectados; ellos reciben el informe al volver.
- **Sin conexión**: la partida vive en el navegador y las mismas reglas de `core` se ejecutan en local.

Las contraseñas se guardan con scrypt y sal. La sesión es un token aleatorio que caduca a los 30 días.

Para apuntar el juego a un servidor en otra dirección (por ejemplo en la app móvil), compílalo con `VITE_API_URL=https://tu-servidor npm run build`.

## Mapas hechos con Tiled

El mapa del mundo se puede diseñar con [Tiled](https://www.mapeditor.org). El de ejemplo está en `apps/client/public/maps/mundo.tmj` y es el que usan las partidas nuevas, con y sin conexión. La guía [docs/mapas-tiled.md](docs/mapas-tiled.md) explica cómo marcar el terreno, las guaridas y los reinos. La variable `MAP_FILE` del servidor elige otro mapa; si la dejas vacía, vuelve el mapa generado al azar.

## Estado

- Hecho: reino, mapa, ejército, dragón, batallas, cuentas, guardado en el servidor y PvP asíncrono.
- El servidor guarda en un fichero JSON. Es suficiente para probar con amigos; para muchos jugadores tocará PostgreSQL.
- Próximos pasos: PostgreSQL, empaquetado para móvil con Capacitor y arte definitivo.
