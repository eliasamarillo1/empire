# Cómo comprobar el mapa

## En tu ordenador

```
cd ~/empire
git fetch origin claude/motor-3d
git checkout claude/motor-3d
npm install
npm start
```

Abre http://localhost:5173, pulsa **Jugar sin conexión** y entra en la pestaña **Mapa**.

Para ver el mapa entero sin explorarlo, abre la consola del navegador (F12) y escribe:

```js
for (const t of empire.world.tiles) t.seen = true; empire.changed();
```

## Qué mirar

1. No hay bordes cuadrados entre casillas (historia 1).
2. Montañas con roca y nieve, lagos con orilla de arena y mar alrededor (historia 1).
3. Nubes sobre lo inexplorado y bruma en lo que puedes explorar ya (historia 2).
4. Guaridas, reinos rivales y oro se reconocen sin tocarlos (historia 3).
5. En el móvil, girar, pellizcar y arrastrar con dos dedos responden con fluidez (historia 4).
