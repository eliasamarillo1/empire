# Empire: stack técnico recomendado

Objetivo: un solo código para web, Android e iOS, con servidor propio para guardar reinos y resolver ataques.

## Recomendación

| Capa | Elección | Por qué |
|---|---|---|
| Lenguaje | TypeScript en todo (cliente y servidor) | Un solo lenguaje; la lógica de combate se comparte entre cliente y servidor |
| Motor de juego | Phaser 3 | Motor 2D maduro para navegador, con mapas por casillas (Tiled), animaciones de sprites y buen rendimiento en móvil |
| Interfaz (menús, tiendas) | HTML/CSS por encima del canvas (o React si crece) | Más fácil que dibujar menús dentro del motor |
| Empaquetado móvil | Capacitor | Convierte la web en app de Android e iOS y da acceso a notificaciones push y compras |
| Servidor | Node.js con Fastify o NestJS | Mismo lenguaje; ejecuta la simulación de combate para validar ataques |
| Base de datos | PostgreSQL (con Supabase para empezar rápido) | Cuentas, reinos, edificios, tropas, informes de batalla |
| Tiempo real (opcional) | WebSockets (Socket.IO) o Colyseus | Para avisos en vivo y, más adelante, mapa del mundo compartido |
| Mapas | Tiled (editor gratuito) | Diseñar el mapa del mundo y exportarlo a Phaser |
| Arte | Sprites 2D isométricos; packs de itch.io o Kenney para prototipar | Social Empires usaba vista isométrica |

## Arquitectura

```
cliente (Phaser + TS) ──HTTP/WebSocket──> servidor (Node + TS) ──> PostgreSQL
        │                                       │
        └──── paquete compartido "core" ────────┘
              (reglas, costes, simulación de combate determinista)
```

- **Producción por tiempo**: el servidor no hace "ticks" por cada reino. Guarda la marca de tiempo de la última recogida y calcula lo producido al abrir el juego (`producción × tiempo transcurrido`, con tope de almacén).
- **Ataques**: el cliente pide una foto del rival, simula en local para que se vea fluido y envía las órdenes; el servidor repite la simulación con la misma semilla y aplica el resultado si coincide.
- **Seguridad**: el cliente nunca decide cuántos recursos tiene; solo pide acciones y el servidor las valida.

## Alternativas

- **Godot 4**: excelente motor, exporta a web y móvil, pero la versión web pesa más y el servidor tendría otro lenguaje.
- **Unity**: muy potente para móvil, pesado en web y con más fricción para un proyecto pequeño.

Para un juego 2D que debe ir bien en navegador y móvil, Phaser + Capacitor es el camino con menos fricción.

## Siguiente paso

Crear un repositorio en GitHub (por ejemplo `empire`) con un monorepo: `packages/core`, `apps/client`, `apps/server`. El prototipo actual (`prototipo/index.html`) ya separa las reglas del dibujado, así que esas reglas pasan casi tal cual a `core`.
