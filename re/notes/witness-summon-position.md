# Witness #5 — Posición de aparición del monstruo INVOCADO (summon) · DERIVACIÓN ESTÁTICA

**Carril:** oracle-queue (rama `re/oracle-queue`) · **Fecha:** 2026-07-19 · Encargo del lead:
derivar dónde coloca el binario al invocado (¿celda adyacente? ¿tirada con reintentos? orden
de rands). Contraste con el port: `combat.ts:castSummon`/`castSummonDaemon` usan **UN**
`randomBoardCell` (COMBAT:0x120E) y si falla, saltan el spawn.

## VEREDICTO: el port NO es fiel al picker de summon (Clase-C confirmada)

El summon del binario **NO usa `randomBoardCell`** (el picker de tablero global 0x120E =
`x=rand0(15); y=rand0(15)`, válido si ambos ≤10, 2 rands, 1 intento). Usa un **picker
LOCAL-AL-CASTER con validación de pasabilidad/ocupación**, y el daemon-cast lo envuelve en un
**bucle de hasta 8 intentos**. Dos rutinas de spawn distintas comparten el picker:

### A) Daemon por CAST (Kal Xen Corp #43) — `CAST2:0x04c2` — RETRY-8
```
04cf: cmp [bp+4],0 ; je 0x4da         ; arg: 0=cast, !=0=pergamino
04d5: mov ax,5      ; pergamino → radio 5
04da: mov ax,8      ; cast      → radio 8
04dd: push ax ; call 0                ; init del picker con el radio (5/8)
04e1: mov [bp-6],0                    ; contador de reintentos = 0
--- BUCLE 0x04ec ---
04ec: call 0xffff9cb6                 ; PICKER local-al-caster → g_cmb_scratch_x/y
04ef: or ax,ax ; je 0x518             ;   falla el pick → reintenta
04f3: push 0xd8; push scratch_x/y ; call 0xffff9b96   ; ¿celda PASABLE? (bitmap 0xd8)
0502: or ax,ax ; je 0x518             ;   no pasable → reintenta
0506: push scratch_x/y ; call 0x6222  ; tile/ocupante en la celda
0511: cmp byte[bx],0xff ; jne 0x524   ;   != 0xFF (libre) → SPAWN 0x524; ==0xFF → reintenta
--- fin iteración ---
0518: inc [bp-6] ; cmp [bp-6],8 ; jge 0x542(abandona) ; else jmp 0x04ec
0524: (SPAWN) push 0x26(Daemon) ... call 0x8326        ; makeEnemy en scratch_x/y, floor
```
⇒ **hasta 8 intentos**; cada intento: pick local + check pasable (0x9b96) + check libre
(0x6222 == 0xFF). Radio del pick = **8 (cast) / 5 (pergamino)** — otra desviación de paridad
del pergamino, además del rand30 del contest (ya notada en `combat.ts:castSummonDaemon`).

### B) Summon por COMSUBS — `COMSUBS:0x0260` — 1 INTENTO
```
0260: call 0xffff9cb6                 ; MISMO picker local-al-caster
0263: or ax,ax ; jne 0x26a ; else jmp 0x127(fin)   ; sin bucle: falla → no spawnea
026a: push 0xd8; push scratch_x/y ; call 0xffff9b96 ; pasable?
0280: (SPAWN) push 0x26 ... call 0xffff8326          ; makeEnemy 0x26 en scratch_x/y
```
⇒ variante de **1 intento** (sin retry) del mismo picker. (Spawnea 0x26=Daemon también;
probable ruta de pergamino/otro disparador. Ambas rutas spawnean por `0x8326`/`0x6506`.)

## Respuestas a las 3 preguntas del lead

1. **¿Celda adyacente?** NO. Es una celda **local al caster dentro de un radio** (8 en cast,
   5 en pergamino/COMSUBS-init), elegida por el picker ~~kernel~~ `0x9cb6` = **COMBAT.OVL:0x120e `random_board_cell`** (resuelto 2026-07-25 por la regla de banda: CAST2/COMSUBS son banda 4, `(0xe1e0+0x9cb6)&0xFFFF = 0x7E96` → stub → COMBAT 0x120e; 2 tiradas `rand_range(0x0f)`, x luego y) (escribe
   `g_cmb_scratch_x`=DS:0x5876 / `g_cmb_scratch_y`=DS:0x5878), no la celda de enfrente ni una
   del tablero entero.
2. **¿Tirada con reintentos?** SÍ en el daemon-cast (`CAST2:0x04c2`): **hasta 8 intentos**,
   cada uno validando **pasabilidad** (`0x9b96`, bitmap 0xd8) y **celda libre** (`0x6222`==0xFF).
   La variante COMSUBS es 1 intento. En NINGÚN caso es `randomBoardCell`.
3. **Orden de rands:** por intento, 1 llamada al picker `0x9cb6` (Nº de rands internos =
   pendiente, ver abajo); tras colocar, `makeEnemy`/`0x8326`(=`0x6506`) consume **1 rand0(7)**
   de velocidad (ya modelado en `combat.ts:makeEnemy`). El contest aliado/hostil del daemon
   (`rand30 < INT`) va DESPUÉS del spawn (`CAST2:0x0594+`, sólo en el cast, no en pergamino).

## Lo que falta para CERRAR (sub-pregunta del orden exacto de rands)

El **nº y orden de rands DENTRO del picker `0x9cb6`** no está derivado con certeza: el rebase
del `call 0xffff9cb6` a la EXE del kernel es **incierto** (la fórmula MAINOUT `(xxxx+0x81D0)&
0xFFFF`=0x1E86 cae a media rutina — no es el picker; el rebase de CAST2/COMSUBS puede diferir).
Para cerrarlo hace falta UNA de:
- **(a)** identificar y desensamblar `0x9cb6` en `ULTIMA.EXE.asm` con el rebase correcto (contar
  sus `call rand`), o
- **(b) witness vivo**: entrar en combate con un caster que tenga Kal Xen Corp, sembrar la
  semilla RNG, castear el summon, y leer (i) `g_cmb_scratch_x/y` (0x5876/0x5878) = celda
  elegida, (ii) el registro del daemon spawneado en 0xBA14 (x=+6,y=+7) y (iii) el consumo de
  semilla 0x5420 antes/después para el orden de rands. BP fiable en `0x8326`(spawn) para contar
  intentos.

## Accionable para el port (combat.ts)

`castSummon`/`castSummonDaemon` deberían: (1) picker **local al caster** con radio 8 (cast) /
5 (scroll), no `randomBoardCell`; (2) **bucle hasta 8 intentos** con check pasable + libre;
(3) el fallo tras 8 = no spawnea (ya lo hace por otro camino). La desviación es OBSERVABLE (el
invocado del clon puede caer en cualquier celda del tablero ≤10; el fiel cae cerca del caster).

## Evidencia
- `re/disasm/CAST2.OVL.asm:517-569` (daemon retry-8), `re/disasm/COMSUBS.OVL.asm:248-269`
  (variante 1-intento), `re/disasm/COMBAT.OVL.asm:1791-1806` (0x120E = randomBoardCell, el que
  usa el port; su ÚNICO caller 0x0f53 es move-AI, no summon).
- Port: `game/src/core/combat/combat.ts:1864-1894` (castSummon/castSummonDaemon),
  `game/src/core/combat/formulas.ts:272` (randomBoardCell).
- Contexto: `re/notes/combat-spells.md §8.3`.
