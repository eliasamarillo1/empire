# Diseñar el mapa del mundo con Tiled

El mapa del mundo se puede dibujar con [Tiled](https://www.mapeditor.org), un editor de mapas gratuito. El juego lee el archivo y lo convierte en el mapa que exploras: el terreno, los recursos, las guaridas y los reinos rivales salen de Tiled. Los edificios de tu reino no están en este mapa; se colocan dentro del propio juego.

## Probar el mapa de ejemplo

1. Instala Tiled y abre `apps/client/public/maps/mundo.tmj`.
2. Cambia lo que quieras y guarda (Ctrl+S).
3. Con `npm run dev` y el servidor en marcha, crea una partida nueva: sin conexión, con «Empezar de nuevo»; con cuenta, registrando un usuario nuevo. Las partidas que ya existen conservan su mapa.

## Reglas del mapa

- **Orientación isométrica**, casillas de 64 × 32 píxeles. El juego escala si usas otro tamaño, pero mantén la proporción 2:1.
- **Cuadrado** (por ejemplo 25 × 25), entre 7 y 200 casillas de lado.
- **No infinito**: desmarca «Infinito» en las propiedades del mapa.
- **Formato de capa CSV**: en las propiedades del mapa, «Formato de capa de patrones» = CSV.
- Guarda como **JSON** (`.tmj`). Los tilesets pueden ser externos (`.tsj`) o estar incrustados.

## Qué es cada casilla

En el tileset, selecciona una casilla y escribe en su campo **Clase** (o en una propiedad personalizada `tipo`) uno de estos tipos. Da igual que lleven tildes o mayúsculas.

| Tipo | En el juego |
| --- | --- |
| `pradera` | Comida |
| `bosque` | Madera |
| `montaña` | Piedra |
| `oro` | Mina de oro |
| `agua` | No se puede recoger nada |
| `guarida` | Monstruos a los que atacar |
| `ruinas` | Se excavan una vez |

Una casilla sin tipo cuenta como pradera. Puedes tener varias capas: se leen de abajo arriba y gana la última casilla que tenga tipo. El mapa de ejemplo usa una capa `terreno` y otra `lugares` encima, con las guaridas y las ruinas. Así, cuando vences una guarida o excavas unas ruinas, su imagen desaparece y vuelve a verse el terreno de debajo.

## Tu reino y los reinos rivales

En una capa de objetos:

- Un objeto de clase **`inicio`** marca dónde está tu reino. Si no lo pones, va al centro del mapa.
- Cada objeto de clase **`reino`** es un reino rival. El nombre del objeto es el nombre del reino.

Pueden ser puntos o casillas insertadas como objeto (con imagen, como los castillos del ejemplo).

## Niveles

Por defecto, el nivel de una guarida, un yacimiento o un reino crece con la distancia a tu reino. Para fijarlo a mano, añade una propiedad personalizada **`nivel`** (número) a la casilla del tileset o al objeto.

## Usar otro mapa

- **Servidor**: la variable `MAP_FILE` indica qué mapa usan las partidas nuevas (por defecto `apps/client/public/maps/mundo.tmj`). Con `MAP_FILE=` vacío vuelve el mapa generado al azar.
- **Cliente**: carga las imágenes desde `maps/<nombre>.tmj`, donde el nombre es el del archivo del servidor. Guarda el mapa y sus tilesets en `apps/client/public/maps/`.

Si el mapa tiene algún problema, el servidor no arranca y explica qué cambiar en Tiled (por ejemplo, «El mapa tiene que ser cuadrado»).
