# Especificación: Interfaz de juego

**Rama**: `claude/motor-3d`

**Creada**: 2026-10-14

**Estado**: En curso

**Entrada**: Elias, 2026-10-14: "Mejora la uix" (interfaz y experiencia de usuario).

## Diagnóstico de partida

Revisión con capturas de todas las pantallas en ordenador (1280 × 800) y móvil (390 × 844):

- La barra superior parece un panel de administración: cuadrados de color en vez de iconos, sin nombre
  de recurso, y la capacidad del almacén solo se intuye por "/1400".
- No se ve qué hace el constructor ni cuánto le queda sin abrir el edificio.
- En el reino, todos los edificios llevan un "1" encima que no dice nada, y los solares vacíos son
  rectángulos oscuros sin explicación. No se sabe qué se puede tocar ni qué conviene hacer.
- El panel de un edificio no dice qué gana el jugador al mejorarlo, y cuando faltan recursos solo
  aparece un botón desactivado.
- Las pestañas son texto plano.
- El ejército es una tabla que en el móvil se rompe en columnas estrechas.
- La pantalla de inicio pone primero las cuentas, aunque lo importante es jugar.

## Escenarios de uso y pruebas *(obligatorio)*

### Historia 1: Entender mi reino de un vistazo (Prioridad: P1)

La barra superior muestra cada recurso con su icono, cuánto tengo, cuánto cabe y cuánto gano por
minuto; mi nivel con su progreso; mi poder; y qué está construyendo el constructor y cuánto le queda.

**Prueba independiente**: una persona nueva dice, mirando solo la barra, cuánta madera tiene, si el
almacén está casi lleno y si hay una obra en marcha.

**Escenarios de aceptación**:

1. **Dado** el reino, **cuando** miro la barra, **entonces** cada recurso tiene un icono propio y
   una barra que indica lo lleno que está el almacén, en rojo cuando pasa del 90 %.
2. **Dada** una obra en marcha, **cuando** miro la barra, **entonces** veo el edificio y el tiempo
   que falta; al tocarlo, se selecciona ese edificio.
3. **Dado** el constructor libre, **cuando** miro la barra, **entonces** lo indica.

---

### Historia 2: Saber qué puedo hacer y qué gano (Prioridad: P1)

En el reino, los edificios que puedo mejorar ya llevan una flecha, y los solares que puedo construir
un signo más. Al tocar uno, el panel muestra el nivel actual y el siguiente con lo que cambia, el
coste, el tiempo y, si me falta algo, cuánto exactamente.

**Prueba independiente**: con recursos suficientes, la persona encuentra qué mejorar sin abrir
edificio por edificio.

**Escenarios de aceptación**:

1. **Dado** un edificio que puedo mejorar ahora, **cuando** miro el reino, **entonces** lleva una
   flecha verde encima; los demás no llevan etiqueta de nivel.
2. **Dado** un solar desbloqueado sin construir, **cuando** miro el reino, **entonces** lleva un
   signo más si puedo pagarlo.
3. **Dado** un edificio que produce, **cuando** lo abro, **entonces** veo "36 → 48 por minuto" (o
   lo que corresponda) para el siguiente nivel.
4. **Dado** que me faltan recursos, **cuando** abro el edificio, **entonces** el botón dice cuánto
   falta de cada recurso.
5. **Dado** un móvil, **cuando** abro un panel, **entonces** aparece como hoja desde abajo, con un
   asa, sin tapar la barra de pestañas.

---

### Historia 3: Moverme por el juego con claridad (Prioridad: P2)

Las pestañas tienen icono y texto, la activa se distingue claramente y los avisos (informes sin leer)
se ven como un número.

**Escenarios de aceptación**:

1. **Dada** cualquier pantalla, **cuando** miro las pestañas, **entonces** cada una tiene icono y
   nombre, y la activa está resaltada.
2. **Dado** un informe nuevo, **cuando** miro las pestañas, **entonces** Informes muestra el número.

---

### Historia 4: Entrenar tropas cómodamente en el móvil (Prioridad: P2)

El ejército se muestra como tarjetas por unidad: icono, ataque, vida, cuántas tengo y botones de
entrenar. Las bloqueadas aparecen atenuadas con lo que piden.

**Escenarios de aceptación**:

1. **Dado** un móvil, **cuando** abro Ejército, **entonces** no hay columnas estrechas ni texto
   partido palabra a palabra.
2. **Dada** una unidad bloqueada, **cuando** la miro, **entonces** veo un candado y el requisito.

---

### Historia 5: Empezar a jugar sin rodeos (Prioridad: P3)

La pantalla de inicio pone "Jugar" como acción principal; entrar con cuenta queda como opción
secundaria.

**Escenarios de aceptación**:

1. **Dada** la pantalla de inicio, **cuando** la abro, **entonces** el botón principal es "Jugar" y
   empieza la partida sin conexión.
2. **Dado** que quiero usar mi cuenta, **cuando** pulso "Entrar con cuenta", **entonces** aparece el
   formulario de usuario y contraseña.

### Casos límite

- Pantallas estrechas (320 px): la barra superior y los paneles caben sin desbordar.
- Recursos por encima de 100 000: se abrevian sin romper el diseño.
- Edificio al nivel máximo o limitado por el castillo: el panel lo explica en lugar de un botón.
- Partida en línea: el botón de mejorar respeta la respuesta del servidor (sin cambios de reglas).

## Requisitos *(obligatorio)*

### Requisitos funcionales

- **FR-001**: Cada recurso MUST mostrarse con un icono propio (oro, madera, piedra, comida), su
  cantidad, su producción por minuto y una barra de llenado del almacén.
- **FR-002**: La barra superior MUST mostrar el nivel del jugador con su progreso, el poder y el
  estado del constructor con el tiempo restante.
- **FR-003**: En el reino, solo los edificios mejorables al momento MUST llevar indicador (flecha);
  los solares construibles al momento, un signo más.
- **FR-004**: El panel de edificio MUST mostrar el efecto del siguiente nivel cuando el edificio
  produce, almacena o defiende.
- **FR-005**: Cuando falten recursos, el panel MUST indicar la cantidad que falta de cada uno.
- **FR-006**: Las pestañas MUST tener icono y nombre.
- **FR-007**: El ejército MUST mostrarse en tarjetas adaptables a cualquier ancho.
- **FR-008**: La pantalla de inicio MUST ofrecer "Jugar" como acción principal.
- **FR-009**: Todos los controles MUST tener un área táctil de al menos 40 × 40 px y foco visible
  con teclado.
- **FR-010**: Los iconos MUST estar dibujados en el propio juego (SVG), sin dependencias nuevas.

## Criterios de éxito *(obligatorio)*

- **SC-001**: Una persona nueva identifica sus recursos, su nivel y la obra en curso en menos de 5
  segundos mirando una captura.
- **SC-002**: Con recursos suficientes, la persona encuentra un edificio para mejorar sin abrir
  ninguno que no lo sea.
- **SC-003**: Ninguna pantalla tiene desbordamiento horizontal a 320 px de ancho.
- **SC-004**: Elias considera que la interfaz se siente de juego y no de panel de administración.

## Suposiciones

- Las reglas del juego no cambian; solo la presentación.
- Se mantiene la paleta oscura con dorado y la tipografía actual.
- El reino editable con colocación libre (fase 2 del plan) es otra especificación; aquí solo se
  mejora cómo se presenta lo que ya existe.
