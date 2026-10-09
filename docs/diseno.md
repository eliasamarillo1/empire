# Empire: documento de diseño (v0.1)

Juego de estrategia en tiempo real para web y móvil, inspirado en Social Empires. El jugador construye y sube de nivel un reino, explora un mapa amplio para sacar recursos, cría dragones y otras criaturas, entrena ejércitos, fortifica su ciudad y ataca otros reinos (que también pueden atacarle a él).

## 1. Bucle de juego

**Bucle corto (una sesión de 5 a 15 minutos)**
1. Recoger lo producido mientras estabas fuera (granjas, minas, aserraderos).
2. Gastar recursos: construir, mejorar, entrenar tropas, alimentar criaturas.
3. Explorar: enviar exploradores a casillas nuevas del mapa y reclamar yacimientos.
4. Combatir: limpiar campamentos de monstruos (PvE) o atacar un reino (PvP).
5. Ver el informe de defensa: quién te atacó y qué perdiste.

**Bucle medio (días)**: subir el Castillo de nivel, lo que desbloquea edificios, tropas y criaturas nuevas, y amplía el territorio.

**Bucle largo (semanas)**: dragones de nivel alto, alianzas, ligas de ranking y eventos de temporada.

## 2. Recursos

| Recurso | Cómo se obtiene | Para qué sirve |
|---|---|---|
| Oro | Casas (impuestos), botín PvP | Tropas, mejoras |
| Madera | Aserraderos, bosques del mapa | Edificios, muros |
| Piedra | Canteras, montañas del mapa | Fortalezas, torres |
| Comida | Granjas, praderas del mapa | Mantener tropas y alimentar criaturas |
| Gemas (premium) | Logros, eventos, compra | Acelerar tiempos (con límites para no romper el equilibrio) |

Los yacimientos del mapa se agotan y reaparecen, lo que empuja a seguir explorando. Cada recurso tiene un almacén con capacidad máxima, y una parte de lo almacenado es saqueable.

## 3. El mapa

- **Mapa del reino** (tu ciudad): cuadrícula donde colocas edificios, muros y torres. Es lo que defiende tu reino.
- **Mapa del mundo**: mapa grande por casillas con niebla de guerra. Contiene bosques, montañas, praderas, minas de oro, ruinas con tesoros, guaridas de monstruos y los reinos de otros jugadores. Cuanto más lejos del centro, mejores recursos y enemigos más duros.

## 4. Edificios

| Edificio | Función | Nivel de castillo |
|---|---|---|
| Castillo | Nivel general del reino; limita todo lo demás | 1 |
| Granja, Aserradero, Cantera, Casa | Producción de recursos | 1 |
| Almacén | Capacidad y protección de recursos | 1 |
| Cuartel | Entrena infantería y arqueros | 1 |
| Establo | Caballería | 3 |
| Nido de dragón | Eclosiona y cría dragones | 4 |
| Guarida de bestias | Criaturas (lobos, grifos, golems) | 5 |
| Muro y Torres | Defensa pasiva | 2 |
| Taller de asedio | Catapultas y arietes | 6 |

Cada edificio tiene niveles (1 a 10 al principio). Mejorar cuesta recursos y tiempo.

## 5. Unidades y criaturas

Sistema de ventajas tipo piedra-papel-tijera:
- **Infantería** gana a caballería, pierde contra arqueros.
- **Arqueros** ganan a infantería y voladores, pierden contra caballería.
- **Caballería** gana a arqueros y asedio, pierde contra infantería.
- **Asedio** destruye muros y torres, es débil cuerpo a cuerpo.
- **Criaturas**: unidades únicas, fuertes y lentas de criar. Se alimentan con comida y suben de nivel combatiendo.
  - Dragones (fuego, hielo, tormenta): voladores, daño en área, ignoran muros.
  - Grifos: voladores rápidos, cazan arqueros.
  - Golems de piedra: tanques que absorben el daño de las torres.
  - Lobos: baratos, rápidos, buenos para saquear.

Los dragones evolucionan por etapas (huevo, cría, joven, adulto, anciano) y cada etapa cambia su aspecto y sus habilidades. Es el gancho principal del juego.

## 6. Progresión

- **Nivel del castillo**: puerta de acceso a contenido.
- **Nivel del jugador (XP)**: se gana construyendo, explorando y combatiendo; da recompensas.
- **Nivel de cada unidad y criatura**: investigación en edificios y experiencia en combate.
- **Poder del reino**: número que resume todo; sirve para emparejar rivales.

## 7. Combate PvP asíncrono

No hace falta que el defensor esté conectado:
1. El atacante elige un objetivo dentro de su rango de poder (por ejemplo, entre el 70% y el 130% del suyo).
2. El servidor carga la "foto" del reino rival: edificios, muros, torres y tropas de guarnición.
3. El atacante despliega sus tropas en el borde y la batalla se simula en tiempo real; él solo decide dónde y cuándo soltar unidades y habilidades de dragón.
4. Resultado: de 0 a 3 estrellas según la destrucción, y botín de una parte de los recursos no protegidos.
5. El defensor recibe un informe con repetición y puede vengarse.
6. Escudo de protección tras ser atacado, para que nadie sea saqueado sin parar.

**Anti-trampas**: la simulación es determinista (mismo resultado con la misma semilla y las mismas órdenes). El cliente envía solo las órdenes del atacante y el servidor vuelve a simular para validar el resultado.

## 8. Monetización (opcional, más adelante)

Gemas para acelerar, pase de temporada con cosméticos y aspectos de dragón. Nada que sea "pagar para ganar" directo en PvP.

## 9. Fases propuestas

1. **Prototipo** (hecho, ver `prototipo/`): reino, recursos, mapa con niebla, entrenamiento y ataque simulado a reinos IA.
2. **MVP de un jugador**: mapa de reino con colocación de edificios, combate visual en tiempo real contra campamentos IA, guardado en la nube.
3. **MVP multijugador**: cuentas, base de datos de reinos, PvP asíncrono con validación en servidor, informes de defensa.
4. **Móvil**: empaquetado para Android e iOS, notificaciones ("te están atacando", "tu dragón ha eclosionado").
5. **Contenido vivo**: alianzas, eventos, ligas.
