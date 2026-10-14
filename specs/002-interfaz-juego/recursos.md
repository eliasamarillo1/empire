# Recursos para mejorar la interfaz

**Fecha**: 2026-10-14. **Entrada**: Elias: "La UI sigue siendo muy básica, ¿qué recursos necesitamos para mejorarla?"

## Por qué sigue pareciendo básica

La interfaz actual está hecha solo con CSS e iconos SVG dibujados a mano. Los juegos como Social
Empires o Los Sims usan **arte hecho por ilustradores**: marcos de madera y pergamino, botones con
relieve, iconos pintados con sombras, una tipografía con carácter, sonidos al pulsar y modelos 3D
detallados. Eso no se consigue con código; hace falta material gráfico. Hay dos caminos: packs ya
hechos (gratis o de pago) o un ilustrador.

## Lo que hace falta

| Recurso | Para qué | Gratis (recomendado) | De pago (más acabado) |
|---------|----------|----------------------|------------------------|
| Kit de interfaz | Marcos, paneles, botones, barras, pestañas | **Kenney UI Pack** y **UI Pack RPG Expansion** (kenney.nl, CC0) | Packs "fantasy GUI" o "medieval UI" en itch.io (aprox. 10–40 €) |
| Iconos | Recursos, edificios, unidades, acciones | **game-icons.net** (más de 4000 SVG, CC BY 3.0: hay que citar a los autores en los créditos). Encaja con nuestro sistema de iconos SVG | Packs de iconos RPG pintados en itch.io (aprox. 10–30 €) |
| Tipografía | Títulos y números con aspecto de juego | **Cinzel** o **MedievalSharp** (Google Fonts, licencia OFL), junto a las actuales | No hace falta |
| Modelos 3D | Edificios, murallas, árboles, unidades | **KayKit Medieval** de Kay Lousberg (kaylousberg.itch.io, CC0, glTF) y **Quaternius** (quaternius.com, CC0) | **Synty POLYGON Fantasy Kingdom** (aprox. 50–100 €; revisar licencia para web) |
| Cielo e iluminación | Luz y reflejos realistas en el 3D | Un HDRI de **Poly Haven** (polyhaven.com, CC0) | No hace falta |
| Sonidos | Clics, construir, monedas, combate | **Kenney Interface Sounds** y **RPG Audio** (CC0) | Packs de efectos medievales (aprox. 10–30 €) |
| Música | Ambiente del reino y del mapa | Kevin MacLeod, incompetech.com (CC BY) | Packs de música medieval en itch.io (aprox. 10–40 €) |
| Ilustrador (opcional) | Estilo propio y único | — | Encargo de un "UI skin" completo (desde unos cientos de euros) |

## Recomendación

1. Empezar por la ruta **gratuita CC0**: Kenney UI + RPG Expansion, game-icons.net, KayKit Medieval,
   Kenney Interface Sounds y RPG Audio, y un HDRI de Poly Haven. Todo combina en estilo low-poly
   cálido y se puede usar en un juego comercial.
2. Cuando la jugabilidad esté cerrada, valorar un pack de pago o un ilustrador para darle identidad.

## Qué tiene que hacer Elias

El contenedor donde trabajo no puede descargar de esas webs (el proxy lo bloquea), así que hace falta
que Elias descargue los zip y los suba al proyecto (o los añada al repo en una carpeta `recursos/`).
Lista mínima:

- Kenney: UI Pack, UI Pack RPG Expansion, Interface Sounds, RPG Audio.
- KayKit: Medieval Hexagon Pack (o Medieval Builder Pack) y Adventurers.
- Un HDRI de Poly Haven (por ejemplo, uno de cielo despejado de día, en 1k o 2k, formato .hdr).

Los iconos de game-icons.net y las fuentes de Google se pueden añadir sin descargas manuales si el
proxy lo permite; si no, también en un zip.

## Lo que haré con ellos

- Paneles, botones y pestañas con los marcos del kit (CSS `border-image`).
- Iconos pintados en lugar de los SVG planos.
- Modelos KayKit en `modelos.json` para edificios, murallas, árboles y castillos (sin tocar código de
  reglas).
- Sonidos al pulsar, construir y cobrar, con un botón para silenciar.
- Iluminación con el HDRI y postprocesado (antialiasing, bloom suave, oclusión ambiental).
