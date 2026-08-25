# Objetos-actor en los ficheros .NPC (cofres, artefactos) — responde parcialmente a O5

> Hallazgo 2026-07-13 (exploración de datos para el censo de cofres). Relevante
> para la pregunta abierta **O5** del scout de F1.5 ("origen del contenido
> inicial de cofres de pueblo") y para F1.10 (posiciones canónicas de trama).

## El hecho

Los 32 slots de actor de cada fichero .NPC no solo contienen personas: el campo
`type` es `tile − 0x100`, y hay slots cuyo tile es un **objeto**. Censo completo
(assets/npcs.json, extraído byte a byte de TOWNE/DWELLING/CASTLE/KEEP.NPC):

| type | tile | objeto | location (enum maestro) | slot | pos (x,y,z) |
|---|---|---|---|---|---|
| 1 | 257 Chest | cofre | 17 LB Castle | 23 | (16,21) z=0xFF (sótano) |
| 1 | 257 Chest | cofre | 17 LB Castle | 24 | (17,22) z=0xFF |
| 1 | 257 Chest | cofre | 17 LB Castle | 25 | (13,23) z=0xFF |
| 14 | 270 SandalwoodBox | caja de sándalo | 17 LB Castle | 31 | (18,12) z=2 |
| 181 | 437 Crown | Corona de LB | 18 Blackthorn | 1 | (15,13) z=3 |
| 182 | 438 Sceptre | Cetro de LB | 29 Stonegate | 9 | (15,15) z=0 |

(También hay caballos 272/273, skiffs 296/297, alfombra 283, cadáver 286 como
actores; los 3 Shadowlords son type 252 en sus pueblos.)

## Implicaciones

- **O5 (posiciones)**: los cofres iniciales de pueblo se colocan como actores
  .NPC — los ÚNICOS del mundo civil son los 3 de la cámara sur del sótano de LB.
  El CONTENIDO/quality no está en el .NPC (8 bytes de schedule + type + dialog);
  pendiente confirmar si el contenido sale de la tabla de botín al abrir
  (loot_fixed/loot_random como los cofres de combate) — encaja con SJOG 0x112C.
- **F1.10**: Corona y Cetro ya tienen posición canónica AQUÍ (no hace falta
  re-derivar del EXE para estos dos; el Amuleto no aparece como actor — ese sí
  requiere la vía del EXE/diálogo).
- Cofres fijos de mazmorra (celdas type 4 en dungeons.json): Deceit N8 (5,5),
  Shame N4 (1,0)+(3,0). Total mundo: 6 cofres fijos.
- **✅ RESUELTO en task #3**: el clon ya materializa estos actores-objeto en
  `worldObjects` al ENTRAR al mapa (`Game.hydrateInteriorObjects` + clasificador
  `npcSlotObjectKind` en `npc/manager.ts`, tipos {1 chest, 14/27/30 prop}). Los 3
  cofres del sótano de LB existen en juego (abribles por la rama F1.5), el cadáver
  y la alfombra/caja se hidratan como `kind:"prop"` (inertes). Se REGENERAN por
  re-entrada (fiel a O6). El `contents` inicial sigue Clase C (O5,
  `INTERIOR_CHEST_CONTENTS=8`). Corona/Cetro NO se hidratan aquí (siguen en el
  sistema de items de trama F1.10); type 0 StarPattern queda en NpcManager (ambiguo
  con el marcador de slot vacío).
