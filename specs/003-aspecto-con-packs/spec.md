# Especificación: Aspecto con los packs de arte

**Rama**: `claude/motor-3d`

**Creada**: 2026-10-14

**Estado**: En curso

**Entrada**: Elias, 2026-10-14: "La UI sigue siendo muy básica, ¿qué recursos necesitamos para mejorarla?".
Después descargó los packs recomendados en [recursos.md](../002-interfaz-juego/recursos.md): Kenney UI Pack,
UI Pack RPG Expansion, Interface Sounds, RPG Audio, KayKit Medieval Hexagon Pack y un cielo HDRI de Poly
Haven (Aarfontein Sunrise).

## Escenarios de uso y pruebas *(obligatorio)*

### Historia 1: Una interfaz que parece de juego (Prioridad: P1)

Paneles, botones, pestañas y barras usan el arte del kit: marcos de madera y pergamino, botones con
relieve y una barra de pestañas de madera, en lugar de rectángulos planos de CSS.

**Prueba independiente**: comparar capturas antes y después en ordenador y móvil.

**Escenarios de aceptación**:

1. **Dado** el reino, **cuando** abro un edificio, **entonces** el panel tiene marco de madera y el
   botón principal es un botón verde con relieve que se hunde al pulsarlo.
2. **Dada** cualquier pantalla, **cuando** miro las pestañas, **entonces** son de madera y la activa
   parece un botón de pergamino.
3. **Dada** una pantalla de 320 px, **cuando** la recorro, **entonces** nada se desborda.

---

### Historia 2: Un reino con edificios de verdad (Prioridad: P1)

El castillo, las casas, la granja, el aserradero, la cantera, el almacén, el cuartel y el establo se
dibujan con los modelos KayKit en lugar de las figuras provisionales. En el mapa, bosques, montañas,
ruinas y castillos también usan KayKit.

**Prueba independiente**: abrir el reino y el mapa y comprobar en capturas que cada edificio se reconoce.

**Escenarios de aceptación**:

1. **Dado** un edificio construido, **cuando** miro el reino, **entonces** se ve su modelo KayKit
   dentro de su parcela de 2 × 2, sin invadir las vecinas.
2. **Dadas** las casas, **cuando** pasan del nivel 4, **entonces** cambian de modelo.
3. **Dado** que se cambia `modelos.json`, **cuando** recargo, **entonces** se usa el modelo nuevo sin
   tocar código (principio VI).

---

### Historia 3: Luz natural (Prioridad: P2)

Los modelos se iluminan con el cielo HDRI, de forma que los materiales no se ven planos ni oscuros.

**Escenarios de aceptación**:

1. **Dados** los modelos KayKit, **cuando** los miro, **entonces** sus colores se ven como en las
   imágenes del pack, ni apagados ni quemados.

---

### Historia 4: Sonidos (Prioridad: P2)

Pulsar botones, cambiar de pestaña, abrir y cerrar paneles, empezar una obra, entrenar, atacar y
recibir un error suenan. Un botón en la barra superior silencia el juego y se recuerda.

**Escenarios de aceptación**:

1. **Dado** el juego con sonido, **cuando** empiezo una mejora, **entonces** suena una obra.
2. **Dado** el botón de silencio, **cuando** lo pulso y recargo, **entonces** sigue en silencio.

### Casos límite

- Si un modelo, una imagen o un sonido no carga, el juego sigue con el modelo provisional, el estilo
  CSS o en silencio.
- Muros, torres, nido y guarida siguen con los modelos provisionales: tienen niveles de material
  (madera → piedra → ladrillo → fortaleza) que KayKit no cubre.
- El navegador bloquea el sonido hasta la primera interacción del jugador.

## Requisitos *(obligatorio)*

- **FR-001**: Paneles, botones, pestañas, píldoras y barras MUST usar las imágenes del kit con
  `border-image`, escaladas sin deformar las esquinas.
- **FR-002**: Los edificios y las casillas MUST cargarse desde `public/models/modelos.json`.
- **FR-003**: Las vistas 3D MUST usar `public/env/cielo.hdr` como luz ambiental.
- **FR-004**: El juego MUST tener sonidos para las acciones principales y un control de silencio que
  se guarde en el dispositivo.
- **FR-005**: Los créditos y licencias de cada pack MUST quedar en el repositorio.
- **FR-006**: El peso añadido a la descarga MUST ser menor de 6 MB.

## Criterios de éxito *(obligatorio)*

- **SC-001**: Elias considera que la interfaz ya no parece básica.
- **SC-002**: Una persona nueva reconoce en una captura del reino el castillo, las casas, la granja y
  el aserradero.
- **SC-003**: Ninguna pantalla tiene desbordamiento horizontal a 320 px.

## Suposiciones

- Todo el material es CC0 (Kenney, KayKit, Poly Haven); no exige créditos, pero se citan.
- El cielo de 4K (84 MB) se reduce a 1024 × 512 en formato `.hdr` (2 MB): para iluminar basta.
