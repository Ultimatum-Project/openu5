# #353 — SIEMBRA de los objetos de arena del `.CBT` (sprites `<0x40`): orden RNG y leyes de cantidad, derivados

**Ficha #353**: los 281 sprites `<0x40` en 68 de los 112 registros de `DUNGEON.CBT` no son
relleno — 1988 los COLOCA como objetos de la arena (cofres, oro, pociones, gemas…) y el
port sólo los EXCLUÍA del roster sin sembrarlos. Este documento deriva la fase que
faltaba: **el orden exacto de consumo de RNG** y **las leyes de cantidad**, con las
tablas volcadas del binario. La clasificación tipo-2/tipo-0 y la fase 2 del colocador ya
estaban derivadas en `sprite-frame-drop-tercer-sapo-cargador.md` (leídas ENTERAS las dos
rutinas); aquí se re-verificó cada cita sobre el árbol antes de usarla.

## 1. El bucle de DNGLOOK, entero: ranura a ranura, post-proceso INLINE

`DNGLOOK.OVL 0x1267-0x1393` (función `0x117e`, la última del overlay). La estructura que
gobierna la paridad de RNG:

```
1267: mov ax,0xb ; [bp-0xa]=[bp-0xc]=[bp-2]=11      ; índice de RANURA arranca en 11
1273: sub si,si                                      ; ── PRE-ROLL (ANTES del bucle) ──
1275: push 0 / push 7 / call 0x7e02                  ; rand(0,7)   [primer push = MIN]
1281: mov al,[bx+0x385e] / 1285: mov [bp+si-6],al    ; pool[si] ← tabla de 8
1288: inc si / cmp si,4 / jl 0x1275                  ; CUATRO tiradas, SIEMPRE
1291: [bp-0xe]=0x10 ; 1296: [bp-0x20]=0x10           ; 16 ranuras (cols 11-26)
12a1: al = fila5[ranura]  (sprite, [bx-0x524c]=0xadb4)
12ab: or al,al / jne ; jmp 0x1385                    ; sprite==0 → siguiente (ÚNICO descarte)
12b2..12e3: clasificación → tipo 2 (<0x40 · 0xb4 · 0xe8, si=sprite crudo)
                          → tipo 0 (enemigo, si=(sprite−0x40)>>2)
12e5..12fc: familia 0xec → si = pool[sprite&3]       ; (consumo del pre-roll)
12fe..1318: push si,tipo,X,Y,planta ; call 0xffffc276 ; = kernel_spawn_actor 0x6506
131d: cmp [bp-0x12],2 / jne 0x1385                   ; post-proceso SÓLO tipo 2 ↓
1323..1381: LEY DE CANTIDAD (inline, ver §3) → [di*8+0x5c5f]
1385: inc ranura ; 138e: dec contador ; jne 0x12a1   ; …y la RANURA SIGUIENTE
```

**⇒ El orden es RANURA A RANURA con el post-proceso INLINE, no fases separadas.** El
consumo de RNG de las cantidades queda INTERCALADO con el de los spawns de enemigos:

| paso | consume |
|---|---|
| pre-roll del pool 0xec (0x1273-0x128c) | **4 × rand(0,7)** — incondicional |
| ranura con enemigo (tipo 0) | **1 rand** — la velocidad de spawn (`0x6506 65d2: push 7 / call 0x3aae`, rand0(7)) |
| ranura con dinero (si=2) | **1 rand** — rand(1, 10·planta+10) |
| ranura con ítem (3≤si≤15) | **1 rand** — rand(0, SPAN[si]−1), también si SPAN=1 |
| ranura con cofre (si=1) / decorado (si≥0x10) / vacía | **0 rands** |

Control del orden: con la réplica del kernel (ley de `re/notes/rng.md`), el registro 9
(cm25) con seed 0x1234 y planta 3 da oro `[5, 38]` intercalado y daría `[16, 5]` con
fases separadas — el test del port asierta los primeros (§5).

## 2. `call 0x7e02` NO se lee crudo: banda de stubs, resuelto y ya adjudicado

`0x7e02` cae en la banda de stubs (0x7A16-0x81C6). No se toma el cuerpo en la dirección
cruda (trampa de `el-call-cross-overlay-no-se-lee-crudo-en-el-asm-del-residente`): la
resolución **ya está adjudicada en pool** — `citas-pool-adjudicacion.md` §fila 6:
`0x7e02 → ULTIMA.EXE CS:0x2092 rand_range(min,max)`, 44 calls desde 7 overlays, todos
banda 0xa290, convención **primer push = MIN** (también `liston-207-t2-acta.md`).
Control positivo de esta nota: la misma convención en `0x1275` (`push 0 / push 7`)
produce exactamente el índice 0..7 que la tabla de 8 entradas `0x385e` necesita, y el
`push 1 / push 10·planta+10` del dinero (0x1341-0x1357) el rango 1..N del oro.

## 3. Las leyes de cantidad, con direcciones

Post-proceso de tipo 2, despachado por `si` = el sprite crudo `<0x40`:

- **si == 1 — COFRE** (`0x1323-0x1339`): `al = planta; shl al,1; add al,cl; add al,7`
  ⇒ **contenido = 3·planta + 7**. DETERMINISTA, 0 rands. Se escribe pelado (nunca
  `|0x80`: el cofre sembrado no lleva trampa). El byte va a `[di*8+0x5c5f]` = campo `+5`
  del objeto — el mismo que `open_chest_world` (SJOG 0x112C) resuelve luego con
  `chestLoot`.
- **si == 2 — DINERO** (`0x1341-0x1358`): `push 1; ax=planta; ax=10·ax+10; push;
  call 0x7e02` ⇒ **qty = rand(1, 10·planta+10)**. 1 rand.
- **3 ≤ si ≤ 15 — ÍTEM** (`0x1360-0x1377`): `cmp si,0x10 / jge 0x1385` deja fuera los
  decorados; si no: `push 0; al=[si+0x383f]; dec ax; push; call 0x7e02;
  cl=[si+0x384d]; add cl,al` ⇒ **qty = BASE[si] + rand(0, SPAN[si]−1)**. 1 rand SIEMPRE
  (si=14 sandalwood: SPAN=1 ⇒ rand(0,0), que igualmente consume).
- **si ≥ 0x10 — DECORADO** (cadáver 0x1e, mancha 0x1f, espejo 0x3c): sin cantidad, sin
  rand — el objeto ya quedó colocado por la fase 2 de `0x6506` con sprite/X/Y/planta.

### Las tablas, VERBATIM (`DATA.OVL`, fileoff = DS + 0x10)

Mapeo DS→fileoff verificado con control positivo: DS `0x385e` → fileoff `0x386e` da
`14 15 16 22 21 18 1f 18`, la EC_GROUP_TABLE ya careada en `0xec-mecanismo-derivado.md`.

```
tabla SPAN = DS 0x383f → fileoff 0x384f: 4c 06 00 08 08 04 03 08 08 04 03 06 03 08 01 08
tabla BASE = DS 0x384d → fileoff 0x385d: 01 08 00 00 00 1e 04 01 01 00 2a 09 2d 01 01 01
```

Los índices 0..2 no se leen nunca (cofre y dinero llevan ley propia) pero viajan tal
cual para que la fila sea careable. La interpretación se AUTO-CONFIRMA contra el switch
de (G)et (`SJOG 0x1458`): si=3 poción → rand(0,7) = el COLOR 0..7 que `apply_item_grant`
indexa; si=10 anillo → 0x2a+rand(0,2) = ids de anillo 42..44; si=12 amuleto →
0x2d+rand(0,2) = 45..47; si=5 arma → 0x1e+rand(0,3) = ids de arma 30..33. Nota: las
tablas SOLAPAN (0x383f+14 = 0x384d) — es el dato del binario, no un error de volcado.

## 4. Censo sobre `DUNGEON.CBT` (112 registros, careado json↔binario 112/112)

281 unidades `<0x40` en 68 registros: cofre(1)×72 · dinero(2)×21 · ítems 3..15 ×139
(destacan gema(8)×77 — sic, es lo que dicen los datos — poción(3)×10, scroll(4)×15) ·
decorados ×49 (cadáver 0x1e×44, mancha 0x1f×5, espejo 0x3c×1).

**Radio de RNG**: sólo las ranuras 2..15 consumen — **35 registros mueven el stream**
(159 rands nuevos en total; registros: 5 8 9 10 16 17 18 22 23 24 31 34 48 49 62 63 65
67 68 69 70 72 73 74 77 78 79 81 83 84 85 86 92 93 94) y otros 33 reciben objetos
SIN mover el stream (sólo cofres/decorados).

## 5. Qué se portó (port, con citas)

`game/src/core/combat/combat.ts`:
- `seedArenaObject` (+ tablas `OBJ_QTY_SPAN`/`OBJ_QTY_BASE` junto a `EC_GROUP_TABLE`):
  la siembra, llamada INLINE desde el bucle de unidades de `placeEnemies` (rama
  mazmorra), en la misma posición que el binario — tras el pre-roll del pool y ranura a
  ranura con los `makeEnemy` (que ya consumían la velocidad de spawn en orden).
- Cofre → `chestContents`/`lootLayer` (los mismos del kill-drop; el (O)pen existente ya
  resuelve `chestLoot(3·planta+7)`). Dinero e ítems → `lootPiles` (pieza recogible con
  (G)et, pila LIFO de `loot_place`). Decorados → `lootLayer` (capa visual `+0x100`).
- `CombatOpts.dungeonFloor` (espejo de `g_floor` DS:0x5895, 0..7) lo pasa
  `game.ts startDungeonRoomCombat`; los combates de pasillo/encuentro no siembran (el
  cargador es de SALA: DNGLOOK).
- Tests: `game/tests/siembra-objetos-cbt-353.test.ts` — esperados EN CRUDO (volcado del
  `.CBT` + réplica independiente en Python del rand_range 0x2092), incluye el
  discriminador de orden (§1) y el careo del stream entero (seed final 0xcbbc).

## 6. Veredictos que CADUCAN con este cambio

Todo veredicto/digest de sala MEDIDO antes de esta siembra sobre los 35 registros de §4
se calculó sobre OTRO stream (y sobre un tablero sin botín). En particular:
- los registros 48/49 (= cm64/cm65 de Covetous) — los veredictos de
  `remolinos-causa-unica-deadends.md` ya estaban declarados pendientes de re-adjudicar
  por el roster 0xec; ahora además su stream se mueve por la siembra.
- cualquier digest de cadena/capítulo (ch24/ch24b y sucesores) que atraviese esas salas.
- Tests del árbol: censados los consumidores de salas de mazmorra
  (`sala-sin-enemigos`, `ranged-room-drive-r15` [cm31, sin objetos],
  `conquer-room-plates`/`room-triggers` [cm29, sin objetos], `salas-selladas-mazmorra`
  [cm118, sólo decorados = 0 rands], `victory-fanfare-212`, parity runner
  [encuentros, no salas]): **ninguno aserta hoy una secuencia RNG de una sala afectada**
  — sus asertos son de identidad/pertenencia o de salas sin ranuras 2..15. Ninguno
  enrojece por esto (MEDIDO: gate acotado de combate/salas, 35 ficheros / 339 tests
  VERDES con la siembra puesta, `vitest run tests/{combat,room,sala,loot,cbt,…}`).

## 7. Cabos (declarados al aterrizar; DOS de tres resueltos por el carril cabos-353, 2026-08-16)

- **Ticket amplio** de `sprite-frame-drop-tercer-sapo-cargador.md` §TICKET SEPARADO:
  las familias `0xb4`/`0xe8` (campos In*Grav) también son tipo 2 y el original también
  las siembra por la misma fase 2; ~~y `combat.ts` descarta los objetos-campo `0x70` del
  `.CBT`~~ [TACHADO 2026-08-23, carril cargador-ticket-amplio: la pata `0x70` era una
  cita de port FALSA — no existe tal descarte en ningún árbol, y el sprite `0x70` de
  fila 5 es el GUARDIA (índice 12), que el port ya crea igual; ver
  `cargador-ticket-amplio-0xb4-0xe8-0x70.md` §4]. Saltárselas aquí NO mueve el stream
  (su `si` ≥ 0x10 = rama sin rand), así que
  el cabo es de FIDELIDAD VISUAL/mecánica, no de paridad RNG. **ADJUDICADO 2026-08-23**
  (`cargador-ticket-amplio-0xb4-0xe8-0x70.md`): la pata `0xb4` es VACUA en datos (0
  unidades y 0 triggers en los 128 registros, careado JSON↔.CBT crudos) y la pata `0xe8`
  queda medida (26 unidades: cm18 Deceit-r2 12×`0xEB` · cm20 Deceit-r4 8×`0xE8` · cm121
  Doom-r9 6×`0xE8`) con todo el lado de consumo ya derivado — resta SOLO el cableado del
  port (ficha en esa nota §6). Dato
  nuevo para quien lo tome: el barrido de `cmd_get` (abajo) ACEPTA la familia `0xb4`
  (`0x197b: and al,0xfc / cmp al,0xb4`) y la despacha por la rama >0xc de
  `get_item_switch` (`0x1464 → 0x172e`) — al sembrar los campos habrá que carear también
  su (G)et.
- ~~El **gate de entrada** del bloque no está derivado~~ — **RESUELTO: ya estaba
  derivado y adjudicado en `gate-117e-adjudicacion.md` (#73)** (este cabo se declaró sin
  censar las notas: la frase «no está derivado» era FALSA al escribirse). Re-verificado
  sobre el árbol de hoy byte a byte (gate `0x1248-0x1264`; `dng_enter_room` empuja el
  TILE crudo en `0x00b1` vs el `and ax,0xf` del roomNo en `0x0024`; la degradación
  `&0xAF` en `0x00f5`): el bloque B corre si `arg1>0 ∧ (arg1<3 ∨ arg2>0xEF)` — modo 3 =
  sala de mazmorra sólo con tile vivo `0xFn`. **CAREO CON EL PORT: PARIDAD de selección
  de registros.** (a) Modo 3: el port sólo dispara `combat-room` con la sala sin
  despejar (`dungeon.ts` `onEnterCell` 1298-1315 y `pitFall` 1404-1415, espejo del tile
  `0xFn` + bitmap persistente) y dentro del registro siembra toda ranura `sprite≠0`
  (`combat.ts:826` = `0x12ab`). (b) Modo 1 (campamento, `CMDS 0x02EF`): bloque B sin
  gate de tile, pero su búfer es el registro 0 (CampFire) — MEDIDO: cero unidades
  `<0x40` en los 16 registros de territorio (0-15) ⇒ siembra vacua en 1988 y en el
  port. (c) Modo 2 (`flags&2` de `run_combat_encounter 0x5f86`; llamadores censados con
  `dispatch_table.near_calls_to_kernel`: DUNGEON.OVL `0xc53`/`0x1db5`, ambos flags=2 =
  combate de PASILLO; los del kernel van con flags 0/4/6 y no pasan por aquí): su búfer
  es la arena PROCEDURAL de DNGLOOK `0x0d3e`, cuya fila 5 sólo recibe `0x40+tipo·4`
  (`0x0f9e-0x0fa5`, siempre ≥0x40) ⇒ también vacua. El único camino con `<0x40` reales
  son los registros de sala de DUNGEON.CBT, y ahí la selección coincide.
- ~~**(G)et sobre decorados**: la rama exacta no está careada~~ — **RESUELTO, PARIDAD.**
  La rama no está en `get_item_switch`: los decorados NO LLEGAN a él. El barrido de la
  tabla de objetos de `cmd_get` (SJOG `0x18ce`, el mismo que corre en la arena vía el
  funnel de COMBAT.OVL) sólo acepta `kind<0x10`, `0x19`, `0x1b` o familia `0xb4`
  (`0x196a-0x197d`); cadáver `0x1e`, mancha `0x1f` y espejo `0x3c` no casan → el barrido
  agota los 31 slots (`0x19b7`: `si≥0x5d5a` sale con slot=0x20) y cae al fallback por
  TILE (`0x19c0`), que sobre suelo de arena termina en «Nothing to get!» (`0x1b28`, DS
  `0x8e64`), SIN retirar el objeto y consumiendo la acción (régimen de arena ya
  derivado en `combat-commands.md` §residual-2). El port hace exactamente eso
  (`resolveBoardGet`: sin rama para `lootLayer`-sin-pila → mismo mensaje, decorado
  intacto); test que lo clava: `siembra-objetos-cbt-353.test.ts` §cabo (G)et.
  **Divergencia COLATERAL hallada en el mismo cuerpo (ficha aparte, NO de decorados)**:
  el fallback por TILE de 1988 también corre en la arena, y 24 de los 128 combatmaps
  tienen ANTORCHAS de pared `0xb0`/`0xb1` (MEDIDO sobre combatmaps.json) — en 1988 un
  (G)et hacia ellas en pleno combate da «Borrowed!», tile→`0x44` y `g_torch_mins=100`
  (`0x19e8-0x1a27`; el guard `0x19fb` sólo salta el repintado con `location≥0x80`). El
  port no tiene Get-por-tile en arena. Arrastra sistema (tiles de arena mutables +
  estado de antorchas): documentado aquí, no arreglado.
