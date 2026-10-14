# Modelos 3D del juego

El juego dibuja cada edificio y cada casilla del mapa con un modelo provisional hecho en código
(`apps/client/src/render/kit.ts`). Para cambiar uno por un modelo de verdad (comprado o descargado):

1. Copia el archivo `.glb` (o `.gltf` con sus texturas) en esta carpeta.
2. Crea aquí un archivo `modelos.json` que diga qué modelo usar para cada cosa.
3. Recarga el juego. Lo que no aparezca en `modelos.json` sigue usando el modelo provisional.

## Formato de `modelos.json`

```json
{
  "edificios": {
    "castle": [
      { "archivo": "castillo_pequeno.glb", "escala": 0.8 },
      { "archivo": "castillo_grande.glb", "desde": 7, "escala": 0.8 }
    ],
    "house": { "archivo": "casa.glb", "giro": 90 }
  },
  "casillas": {
    "forest": [{ "archivo": "bosque_1.glb" }, { "archivo": "bosque_2.glb" }],
    "mountain": { "archivo": "montana.glb", "escala": 1.2, "altura": -0.1 }
  }
}
```

Cada modelo admite estos campos:

| Campo     | Para qué sirve                                                        |
| --------- | --------------------------------------------------------------------- |
| `archivo` | Nombre del archivo dentro de esta carpeta (obligatorio).               |
| `desde`   | Solo edificios: nivel a partir del cual se usa (por defecto, 1).       |
| `escala`  | Tamaño. 1 = el modelo tal cual; una casilla mide 1 unidad de lado.     |
| `giro`    | Giro en grados alrededor del eje vertical.                             |
| `altura`  | Sube (positivo) o baja (negativo) el modelo, en casillas.              |

Si un edificio tiene varios modelos, se usa el de mayor `desde` que no supere su nivel: así un castillo
puede cambiar de aspecto al subir. Si una casilla tiene varios, se reparten entre las casillas del mapa
para que no todas se vean iguales.

## Nombres

- Edificios: `castle`, `house`, `farm`, `sawmill`, `quarry`, `storage`, `barracks`, `stable`, `den`, `nest`.
  Las murallas y las torres se construyen por tramos y por material, y siguen siendo de código por ahora.
- Casillas: `plain`, `forest`, `mountain`, `gold`, `water`, `lair`, `ruins`, `kingdom`, `home`.

## Modelos actuales

Los edificios del reino (salvo murallas, torres, nido y cubil) y los bosques, ruinas y castillos del mapa usan el
**KayKit Medieval Hexagon Pack** de Kay Lousberg (CC0), en la carpeta `kaykit/`. Para cambiar uno, edita
`modelos.json`: no hace falta tocar código. El pack completo trae más piezas (iglesia, taberna, herrería, torres,
murallas de piedra…); si quieres usar otra, copia su `.gltf` y su `.bin` en `kaykit/` (la textura
`hexagons_medieval.png` ya está).

## De dónde sacar más modelos

Sirven los packs de estilo low-poly con licencia para juegos, por ejemplo otros packs de KayKit, Quaternius o
Synty POLYGON Fantasy Kingdom. Si vienen en `.fbx`, conviértelos a `.glb` con Blender (Archivo → Exportar →
glTF 2.0).
