# Especificación: Mapa del mundo como paisaje

**Rama**: `claude/motor-3d`

**Creada**: 2026-10-14

**Estado**: En curso

**Entrada**: Elias, 2026-10-14: "El mapa está fatal, no es nada que ver ni al mapa de Los Sims, ni
al de Social Empires ni a ninguno." Antes había pedido que el juego tuviera "un diseño como el de
Los Sims, con esa calidad de imagen".

## Aclaraciones

### Sesión 2026-10-14

- P: ¿Cámara cenital como Social Empires o la orbital inclinada? → R: la orbital inclinada actual.

## Escenarios de uso y pruebas *(obligatorio)*

### Historia 1: Ver el mundo como un paisaje (Prioridad: P1)

Al abrir la pestaña Mapa, el jugador ve una isla natural vista desde arriba: praderas, bosques,
colinas, montañas, lagos y costa, con su castillo en el centro. Nada recuerda a un tablero de
casillas.

**Por qué esta prioridad**: es la queja directa de Elias y lo primero que ve cualquier jugador.

**Prueba independiente**: abrir el mapa con todo explorado y comparar la captura con la versión
anterior; ninguna línea recta separa una casilla de otra.

**Escenarios de aceptación**:

1. **Dado** un mundo explorado, **cuando** abro el mapa, **entonces** el suelo es continuo, con
   relieve suave entre casillas vecinas y sin bordes cuadrados.
2. **Dada** una casilla de montaña, **cuando** la miro, **entonces** se eleva con laderas de roca y
   la cumbre más alta tiene nieve.
3. **Dada** una casilla de agua, **cuando** la miro, **entonces** se ve un lago o mar con orilla de
   arena, y el mar rodea la isla.
4. **Dada** una casilla de bosque, **cuando** la miro, **entonces** tiene árboles de varias especies
   y tamaños colocados sin cuadrícula, que se funden con los bosques vecinos.

---

### Historia 2: Descubrir lo que hay bajo las nubes (Prioridad: P2)

Lo que el jugador todavía no ha explorado está cubierto de nubes. Las casillas que puede explorar
ya (las vecinas de lo conocido) se ven con bruma ligera para invitar a ir.

**Por qué esta prioridad**: la exploración es el motor del mapa y antes se veía como un hueco negro.

**Prueba independiente**: partida nueva; solo el entorno del castillo está despejado y el resto
está bajo nubes blancas.

**Escenarios de aceptación**:

1. **Dada** una casilla inexplorada lejana, **cuando** miro el mapa, **entonces** la cubre una nube y
   no se ven sus objetos ni su etiqueta.
2. **Dada** una casilla vecina de lo explorado, **cuando** la miro, **entonces** se ve el terreno con
   bruma y sin objetos.
3. **Dada** una casilla que acabo de explorar, **cuando** termina la exploración, **entonces** la
   nube se deshace con una animación breve y aparece lo que había.

---

### Historia 3: Reconocer cada cosa de un vistazo (Prioridad: P3)

Guaridas de monstruos, reinos rivales, minas de oro, ruinas y recursos se distinguen sin tocar
nada, y sus etiquetas no tapan el paisaje.

**Por qué esta prioridad**: el mapa es para decidir adónde ir; si todo parece una roca, no sirve.

**Prueba independiente**: con todo explorado, una persona que no conoce el juego señala en una
captura dónde hay guaridas, reinos y oro.

**Escenarios de aceptación**:

1. **Dada** una guarida, **cuando** la miro, **entonces** se ve la entrada de una cueva con luz
   rojiza, distinta de una roca normal.
2. **Dado** un reino rival, **cuando** lo miro, **entonces** se ve un castillo con su color y una
   etiqueta con su nombre y nivel.
3. **Dada** una casilla de oro, **cuando** la miro, **entonces** se ven rocas con vetas o pepitas
   doradas que brillan, y menos cuanto más se haya agotado.

---

### Historia 4: Moverse con comodidad en el móvil (Prioridad: P3)

En un móvil el jugador gira, acerca y desplaza el mapa con los dedos, y el mapa responde con
fluidez.

**Prueba independiente**: abrir la vista previa en un móvil de gama media y recorrer el mapa
completo.

**Escenarios de aceptación**:

1. **Dado** el mapa en un móvil, **cuando** arrastro con un dedo, pellizco o arrastro con dos dedos,
   **entonces** la cámara gira, acerca o se desplaza.
2. **Dada** una casilla, **cuando** la toco, **entonces** queda seleccionada y aparece su panel.

### Casos límite

- Mapas de Tiled de otros tamaños (más pequeños o más grandes que 25 × 25).
- Casillas de agua en el borde del mapa: deben unirse al mar sin escalones.
- Un reino junto a una montaña: el terreno bajo el castillo queda llano.
- Casillas que se exploran o se agotan durante la partida: solo se redibuja lo que cambia.
- Partidas guardadas antiguas: se ven con el nuevo mapa sin perder nada.

## Requisitos *(obligatorio)*

### Requisitos funcionales

- **FR-001**: El mapa MUST dibujarse como una superficie de terreno continua, sin separaciones ni
  bordes visibles entre casillas.
- **FR-002**: Cada tipo de casilla MUST tener una altura y un color característicos que se mezclan
  suavemente con los vecinos: pradera, bosque, montaña, agua, oro, guarida, ruinas y reinos.
- **FR-003**: El agua MUST ser una superficie translúcida a una altura fija, con orilla de arena y
  fondo más oscuro cuanto más profundo; el mar MUST rodear el mapa.
- **FR-004**: Árboles, rocas y demás objetos MUST apoyarse sobre el terreno y no aparecer en el agua.
- **FR-005**: Las casillas inexploradas lejanas MUST cubrirse con nubes; las explorables MUST verse
  con bruma y sin objetos.
- **FR-006**: Al explorar una casilla, su nube MUST disiparse con una animación de menos de un
  segundo.
- **FR-007**: Guaridas, reinos, oro y ruinas MUST tener una silueta propia, reconocible sin etiqueta.
- **FR-008**: Tocar cualquier punto del terreno MUST seleccionar la casilla que hay debajo.
- **FR-009**: Cada tipo de casilla MUST poder usar un modelo glTF de `modelos.json` en lugar del
  modelo provisional.
- **FR-010**: El terreno MUST reconstruirse solo cuando cambian los tipos de casilla, y recolorearse
  solo cuando cambia lo explorado.

### Entidades clave

- **Casilla**: tipo, nivel, cantidad de recurso restante y si está explorada. Viene de `core` y del
  mapa de Tiled; esta funcionalidad no la cambia.
- **Mundo**: cuadrícula de casillas con tamaño variable y la posición del reino del jugador.

## Criterios de éxito *(obligatorio)*

### Resultados medibles

- **SC-001**: Elias, al ver las capturas y la vista previa, considera que el mapa parece un paisaje
  de juego y no un tablero.
- **SC-002**: En una captura del mapa completo no hay ningún borde recto entre casillas de tipos
  distintos.
- **SC-003**: Una persona nueva identifica en una captura al menos 4 de cada 5 guaridas, reinos y
  minas de oro.
- **SC-004**: El mapa se mueve a 30 imágenes por segundo o más en un móvil de gama media.
- **SC-005**: Explorar una casilla actualiza el mapa en menos de 100 ms en un portátil normal.

## Suposiciones

- La referencia visual es un estilo 3D de maqueta cálido (low-poly suave), coherente con el reino;
  la calidad final llegará al sustituir los modelos provisionales por un pack profesional.
- Las reglas de exploración, recursos y combate no cambian.
- El mapa sigue siendo una cuadrícula en las reglas; solo el dibujo deja de mostrarla.
- La cámara del mapa es la orbital inclinada actual (decisión de Elias, 2026-10-14: "Mantenla así").
