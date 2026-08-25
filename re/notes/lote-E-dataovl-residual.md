# LOTE E.2 — residual de tablas DATA.OVL "sin refs" (carril oráculo/estático, relevo 2026-07-18)

`asm-frontier-plan.md §LOTE E.2` lista ~8 tablas numéricas de DATA.OVL con refs débiles.
Este doc adjudica las dos marcadas "sin refs directas en el censo" hallando su CALLER en
los overlays (que el censo del kernel no barre). Regla de offset: `DS = fileoff − 0x10`
(anclada por "Ambushed!" fileoff 0x41f0 = DS 0x41e0; `camp-ambush-spec.md`).

## `table_unk_3a34` (fileoff 0x3A34 = **DS 0x3A24**, 7 words) — parámetros de una escena de OUTSUBS · CALLER HALLADO

Census (`coverage.json:1584`): "7 words (0x000A, 0x0A3C×3, 0x0E74, 0x0F3C, 0x1040); OUTSUBS
carga el ptr DS 0x3A26 (imm); propósito pendiente".

**Caller = `OUTSUBS.OVL:0x0683`** (bucle de impresión):
```
065f..067b: escena — set anim de personajes + print con imm 0x0A3C / 0x2710(10000) / 0x9C4(2500)
0683: mov si, 0x3a26          ; &tabla[+1] (salta la word[0]=0x000A)
0686: push [si] ; push 1 ; push 0x1388(5000) ; push 0xc8(200) ; push 0xd(13)
0698: call 0x7f02             ; print número en caja (mismo 0x7f02 boxed-print de combat-cast-gate)
069b: add si, 2 ; cmp si, 0x3a32 ; jb 0x686   ; recorre words[1..6] = 0x0A3C,0x0A3C,0x0A3C,0x0E74,0x0F3C,0x1040
06a4..06c2: sigue la escena (g_char_anim_states[80..83], call 0x6dd8)
```
⇒ **NO es tabla de precios**: son los 6 valores numéricos que una **escena de OUTSUBS.OVL**
imprime en caja (`0x7f02`) junto a una animación de personajes, con escalas imm 5000/10000.
La word[0] (0x000A) no se imprime en el bucle. Semántica exacta de la escena (¿score/karma/
meditación?) no cerrada, pero el rol de la tabla (data de esa pantalla, no prices) sí:
**"sin refs" → CALLER en OUTSUBS.OVL 0x0683**. Sugerencia de rename: `outsubsSceneNums_3a24`.

## `table_unk_3db6` (fileoff 0x3DB6 = **DS 0x3DA6**, 24 words / 48 B) — bloque de datos de ENDGAME.OVL · CALLER HALLADO

Census (`coverage.json:1661`): "words tras resurrectPrices; sin refs directas en el censo".

**Caller = `ENDGAME.OVL:0x005e-0x0072`** (carga 5 punteros inmediatos DENTRO del rango de la
tabla):
```
005e: mov [bp-0xe],  0x3da6
0063: mov [bp-0x10], 0x3da7
0068: mov [bp-0x12], 0x3db2
006d: mov [bp-0x14], 0x3db4
0072: mov [bp-0x16], 0x3dca
0077+: bucle de secuencia de endgame (lee [bx+0x3df4], indexa 0x261a, calls 0x6954/0x691e/0x6992/0x742a…)
```
Las 5 direcciones (0x3da6/0x3da7/0x3db2/0x3db4/0x3dca) caen en 0x3DA6..0x3DD6 (la tabla). ⇒
**es el bloque de datos/punteros de la secuencia de ENDGAME**, CONTIGUO con `endgameTables3de6`
(0x3DE6, `coverage.json:1668`) — misma familia. El censo no lo veía porque los overlays no se
barren y los ptrs se cargan como inmediatos, no indexados. **"sin refs" → CALLER en
ENDGAME.OVL 0x005e**. Sugerencia de rename: `endgameData_3da6` (fusionable con endgameTables3de6).

## Método
Rebase DS=fileoff−0x10; `grep` de los offsets DS en TODOS los `re/disasm/*.asm` (overlays
incluidos). Los hits en `ULTIMA.EXE.asm` (jb/je 0x3a26, 0x3da6…) son saltos de código con
dirección coincidente, NO refs de datos — descartados. Ninguna tabla necesita oráculo.

## `table_unk_1d00` (fileoff 0x1D00 = **DS 0x1CF0**, 21 words) — tabla de trabajo de CAST.OVL · CALLER HALLADO

Census (`coverage.json`): "21 words simétricos 10,12,14,16,20,25,35,50,80,190,2000,190,…,10;
sin refs directas". La forma es una **curva simétrica con pico 2000 en el centro** (índice 10
de 21), tapering a 10 en ambos extremos.

**Caller = `CAST.OVL:0x1cb2`**:
```
1caa: mov cx, 0x15          ; 21 (= nº de words de la tabla)
1caf: mov di, 0xa9d0        ; buffer de trabajo DS:0xa9d0
1cb2: mov si, 0x1cf0        ; src = table_unk_1d00
1cb7: repne movsw           ; copia las 21 words de la tabla al buffer de spell
```
⇒ CAST.OVL **copia la tabla completa a `DS:0xa9d0`** al preparar un efecto de hechizo. La
forma (falloff simétrico pico-centro) sugiere **peso radial / intensidad por distancia de un
hechizo de área**. El port NO la modela (grep en game/src/core/magic|combat: sin la curva) →
posible hueco para el carril CAST. "sin refs" → **CALLER en CAST.OVL 0x1cb2** (rename sugerido
`castRadialWeights_1cf0`). Naming exacto del hechizo = a demanda del carril CAST.

## Tablas SIN ref de datos hallable (negativos útiles)

- `table_unk_1cd6` (DS 0x1cc6, 42B bit-packed): adyacente a la data de CAST (justo antes de
  1cf0) pero **sin ref directa** en overlays; el loop CAST 0x1cc4-0x1cd8 es cómputo runtime
  entre buffers, no la lee. Sin caller identificado.
- `table_unk_1f22` (DS 0x1f12, 48B): los `call 0x1f12` del kernel son **código coincidente**
  (0x1f12 es una RUTINA del kernel), NO refs a la tabla de DATA.OVL. Sin ref de datos.
- `table_unk_1ab8` (DS 0x1aa8, 6B `02 02 02 04 04 04`): solo un `jg 0x1aa8` de código
  coincidente. Sin ref de datos (probable padding/patrón antes de reqStrengthEquip).

Estas 3 quedan como candidatas a inert/dead o base-indexed desde una base no censada; no
consumen oráculo y su resolución rinde poco — bancadas salvo demanda.
