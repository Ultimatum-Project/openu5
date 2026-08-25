# Mimic/Corpser disfraz-revelado — SPEC (no cableado: paint no derivable limpio)

**Carril:** regalia-fixes (SCOUT) · **Fecha:** 2026-07-18 · Encargo: cablear el disfraz
del Mimic con CAUTELA — si el paint no sale limpio del ASM, SPEC + reporte, NO fabricar
(orden del lead). **Resultado: NO se cablea. Aquí la spec derivada + lo que falta.**

## Lo que SÍ está derivado (COMBAT.OVL)

El byte **+6** del registro de actor de combate (`DS:0x5C5A + idx*8`, i.e. `0x5C60+idx*8`)
es el **estado de sprite**: `0xFF` dormido · `0x20` revelado · `0` oculto (`combat.md:43-44`).

- **Revelado al melé:** en el ataque melé de la IA (COMBAT.OVL 0x02F8-0304 y 0x031A-0327),
  si el atacante es **Mimic (tipo 0x1A)** o **tipo 0x2D (Corpser)**, se escribe
  `[0x5C60+idx*8] = 0x20` → "se revelan" (`combat.md:331`).
- **Re-ocultado (Corpser):** al inicio de su turno, el Corpser (0x2D) vuelve a `sprite off`
  → `[0x5C60+idx*8] = 0` (COMBAT.OVL 0x046A-047F, `combat.md:306`). También el ataque que
  "arrastra bajo" (dragged under, flag 4) va con "sprite oculto" (`combat.md:249`, 0x03AA-03F9).
- **Semántica real = sprite OCULTO-hasta-atacar** (submarino/al acecho), NO "dibujado como
  cofre". El Mimic comparte exactamente el mecanismo del Corpser (tentáculo que emerge). El
  "disguised as a treasure chest" del Book of Lore (`book-of-lore.md:553`) es sabor del
  manual; el binario lo modela como **sprite off → on**, no como un tile de cofre.

## Lo que NO sale limpio del ASM (por eso NO se cablea)

1. **No hay READ localizado del byte +6.** `grep 0x5C60` en COMBAT/COMSUBS/SJOG sólo
   encuentra ESCRITURAS (0x0304, 0x0327 → 0x20; 0x047A → 0). El bucle de dibujo que CONSUME
   +6 para decidir qué se pinta no está en los overlays desensamblados a mano — vive en el
   pase de render del viewport de combate (kernel/ULTIMA.EXE no barrido aquí). Sin ese
   consumidor no se sabe QUÉ tile (o ninguno) se pinta con +6=0 vs 0x20.
2. **`0x20` no es obviamente un tile.** El sprite del enemigo se calcula aparte como
   `type*4 + 0x40` (`combat.md:45`, kernel 0x6643). `0x20` escrito en +6 parece un MARCADOR
   de estado/visibilidad, no un índice de tile de cofre. Interpretarlo como "pinta el tile
   0x20" sería fabricar.
3. **Superficie del port sin mapear.** `game/src/skin/fiel/combat.ts` no tiene hoy manejo de
   sprite-oculto/disfraz de enemigo (grep invisible/hidden/sprite = 0). Cablear el estado
   +6 exige primero derivar el consumidor de render del binario y luego su equivalente en el
   pase de dibujo de la arena del port — dos piezas no triviales.

## Recomendación

DIFERIR el cableo. Es un hueco de **presentación de combate** (el Mimic/Corpser hoy se
dibujan siempre visibles; el fiel los oculta hasta que atacan). Para cerrarlo con fidelidad
hace falta UNA de estas dos:
- **(a) Derivar el consumidor de +6** en el pase de render de combate (kernel/ULTIMA.EXE):
  qué se dibuja con +6∈{0,0x20,0xFF}. Entonces el cableo es: estado `spriteState` por
  combatant (Mimic/Corpser init OCULTO), pintar según el estado, conmutar a 0x20 al melé y
  a 0 al re-ocultarse (Corpser).
- **(b) Testigo de oráculo**: capturar en DOSBox una sala con Mimic/Corpser y ver si el
  disfraz se dibuja como cofre, como nada (invisible), o como el sprite durmiente — resuelve
  la ambigüedad del punto 2 de una.

Hasta entonces, el port es OBSERVABLEMENTE distinto (enemigos siempre visibles) pero no
FABRICA nada. El scout §B3 del censo debe reetiquetarse: el mecanismo es "sprite oculto
hasta atacar" (como el Corpser), no "cofre-trampa".
