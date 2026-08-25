# Moongate reveal = fn32 SCRAMBLE 0x9248 (no rect) — traza de EGA.DRV

Carril transiciones (2026-07-18), tarea moongate-scramble B(3). Desbloqueado por el oráculo:
el reveal del moongate es SCRAMBLE-LFSR (poly 0x9248) y EGA.DRV **no tiene primitiva de
rect-creciente** → la forma actual de `moongate.ts` (rect anclado abajo que crece, blit parcial
`0x1112`/fn-0x60) es INFIEL confirmada. Esta nota traza el dispatch fn32 hasta los bucles.
Desensamblado directo de `original/u5/ultima5/EGA.DRV` (ndisasm, delta 0 = file=addr, verificado
con el índice `[cs:(w-2)*2+0x254d]` del fizzle).

## El scramble (idéntico en los 3 bucles) = visualLfsr.ts, byte-exacto

Los TRES bucles fn32 empiezan con EL MISMO paso, calcado en `game/src/core/transition/visualLfsr.ts`:
```
add ax,0x9248 ; ror ax,1 ×3 ; xor ax,0x9248 ; add ax,0x11
```
(0x1fac, 0x27c0, 0x2a07 lo llevan idéntico). ⇒ el núcleo del reveal YA está aterrizado; el
upgrade lo reusa. Difieren solo en QUÉ hacen con el valor scrambled:

- **0x1fac — RUIDO-DE-TILE:** loop `cx=0x20` (32); por iteración estampa `al` (byte bajo del
  scramble) en 9 posiciones de un buffer en `si=0xf400` (offsets 3,0x83,0x103,0x183,0x82,0x102,
  1,0x80,0x180; filas a 0x80=128 de separación), `si+=4`. Genera un patrón de RUIDO/dither de
  tile (umbral de dissolve por píxel).
- **0x27c0 — AUDIO (warble del moongate):** scramble → DIV-RANGE: `cx=[0x27a7]>>1 − 100 + 1`,
  `div cx`, `dx+=100` → mapea a `[100, …)`; ese valor es la FRECUENCIA de un tono PIT canal 2
  (`out 0x42`, `0x34de/cx`) + delay busy-wait; loop hasta `[0x27ad] ≥ [0x27a9]`. ⇒ **el moongate
  del original SUENA** (warble regido por el mismo scramble 0x9248). Cobertura de audio del port
  A AUDITAR (aparte de este carril).
- **0x2a07 — SCREEN (fizzle de pantalla):** scramble → índice de píxel `dx`: `x = dx&7` (bit),
  `dx>>3` (byte), máscara de bit `[cs:bx+0x246]` → plot por planos. Es el fizzle de pantalla
  completa en orden de scramble.
- **@0x24d6 — wrapper de PLOT planar** (destino común): guarda/restaura la región de 0x40 words
  en 0x8b00, rama `bl==0xff` (fuente 0x2200 vs 0x280), y llama a **0x1637** = helper de dirección
  de píxel (`bx<<7`, `di>>3`, tabla de scanlines `[cs:si+0x72]`).

## Veredicto para el upgrade

- El reveal del moongate es un **DISSOLVE por scramble 0x9248** de la tile de la puerta
  (`0xDC`, 16×16), NO un rect-desde-abajo. El contador `g_moongate_anim` 1..15 controla el
  **PROGRESO del dissolve** (cuántos píxeles revelados en orden de scramble), no la altura de un
  rect; `anim`==0 ausente, ≥0x10 llena. Confirma al oráculo (sin primitiva de rect).
- El SCRAMBLE base ya está aterrizado (`visualLfsr.ts`), así que el upgrade lo reusa.

## Pendiente (bloque de upgrade, en fresco)

1. **Pinchar el bucle exacto de la TILE 16×16 + el mapeo `anim`→píxel:** cuál de 0x1fac
   (ruido-de-tile) / 0x2a07 (screen-plot) aplica la puerta y cómo `anim` umbraliza. Requiere una
   pasada de traza del handler `fn-0x60` / `0x1112` en el KERNEL (ULTIMA.EXE) que invoca el reveal
   con `(anim,x,y)`. (0x1fac huele a la tile por "ruido-de-tile"; 0x2a07 es pantalla completa.)
2. **Reescribir `moongate.ts`:** dissolve por orden de scramble (visualLfsr) proporcional a `anim`
   en lugar del rect. Mantener contador 0..16 (`stepMoongateStage`/`advanceMoongateStageMs`) y la
   cadencia Clase-C (reloj de la piel). El core no cambia (contrato coreview).
3. **Validar vs `video-K-moongate.mov`** (la puerta saliendo del suelo → comparar con el dissolve).
