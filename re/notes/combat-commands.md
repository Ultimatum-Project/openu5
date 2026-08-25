# Dispatcher de comandos en COMBATE — tabla derivada (COMBAT.OVL 0x0838)

**Carril:** COMBAT-CMDS · **Fecha:** 2026-07-20 · Cita: `re/disasm/COMBAT.OVL.asm`
(fileoff; CS = fileoff + 0xA290, load_seg 0xA29). Strings: DATA.OVL (`fileoff = DS + 0x10`).

El bucle de turno del jugador (COMBAT:0x063E) lee la tecla en **0x0838** (`call 0x83dc` →
AL) y la despacha por un árbol de compares + jump-tables. Dos tablas y varios compares
sueltos cubren el rango de teclas:
- **0x0abe**: `sub ax,0x42; cmp 7; jmp cs:[bx-0x52a2]` → teclas **B..I** (delta de rebase
  0xA290; verificado porque 'C'=0x43 aterriza EXACTO en el gate de Cast 0x8f0).
- **0x0ae6**: `sub ax,0x4b; cmp 6; jmp cs:[bx-0x5278]` → teclas **K..Q**.
- Compares sueltos: S(0x53) T(0x54) U(0x55) W(0x57) X(0x58) Y(0x59) Z(0x5a), dígitos
  '0'-'9' (0x0ab7 rango 0x30-0x36 → Set Active Plr), 0xfc (arma-mágica interno).

## Funnel `combat_cmd` (COMBAT:0x0544)

Los comandos "de acción con nombre" pasan por `combat_cmd(strPtr@bp+6, code@bp+4)`:
```
0547: print strPtr                          ; nombre del comando (DS 0x6e14…)
054d: test byte[g_cmb_actor - 0x45ea], 0x80 ; GATE: bit 0x80 = miembro de party
055c:   je 0x5a4 → print "Can't!" (DS 0x6d98), ret 1   ; enemigo/no-party → Can't!
055e: dispatch por code (0..5) a thunks de overlay (SJOG):
       0→0xffffdb76  1→0xffffdb82  2→0xffffdb8e  3→0xffffdbbe  4→0xffffdb9a  5→0xffffdbb2
```
Otros comandos NO usan el funnel: imprimen su nombre con `print 0x75c0` y llaman su thunk
directo.

## RESOLUCIÓN DE STUBS (dispatch_table.py — funnel 0x0544, COMBAT.OVL near_call_base 0xA290)

Los thunks `call 0xffffdbNN` del funnel NO son kernel: son stubs kernel→overlay. Resueltos:
| code | thunk (CS) | rutina REAL | = overworld? |
|------|-----------|-------------|--------------|
| 0 Get   | 0x7e06 | **SJOG.OVL:0x18ce** | SÍ (mismo Get del mundo) |
| 1 Jimmy | 0x7e12 | SJOG.OVL:0x0d4a | SÍ (cmd_jimmy) |
| 2 Open  | 0x7e1e | **SJOG.OVL:0x1374** | SÍ (mismo Open del mundo) |
| 3 Ready | 0x7e4e | ZSTATS.OVL:0x1296 | SÍ |
| 4 Search| 0x7e2a | SJOG.OVL:0x095c | SÍ |
| 5 Use   | 0x7e42 | CAST.OVL:0x1792 | SÍ |

⇒ **Get/Open de combate = las MISMAS rutinas del overworld**, y AMBAS hacen getdir DENTRO:
`SJOG:0x1374` (Open) `call 0x766c` @0x139f; `SJOG:0x18ce` (Get) `call 0x766c` @0x18ea. Target =
`g_party_x/y + g_cmb_scratch(dir)` (celda VECINA). En combate el handler de turno COMBAT.OVL
0x063e copia la (x,y) del combatiente activo (`g_cmb_actor<<3 -0x45e6/-0x45e5`) a g_party_x/y
@0x0651-0x065c ANTES del dispatch ⇒ **objetivo = actor_activo + dirección (adyacente), NO celda
propia**. El cofre (tile 1, COMBAT:0x1574 172c) es IMPASABLE (slot de pasabilidad de tile 1 =
Water1). El eco = el del overworld (open_chest_world 0x112C): "Trapped!" + "Found:" + línea por
pieza / "Chest empty!". (Mi 1er veredicto — celda-propia + "Thou dost find N gold!" — era FALSO:
paré en la frontera del stub sin resolver; el usuario tenía razón en los 3 puntos.)

## TABLA COMPLETA (tecla → handler → destino → estado en el port)

| Tecla | Handler (file) | Despacho | Semántica | Port (main.ts handleCombatKey) |
|-------|----------------|----------|-----------|-------------------------------|
| A 0x41 | aim/ataque | COMSUBS 0x0D96 | Attack (aim + triple-golpe por slot) | ✅ cableado |
| B 0x42 | 0xacbc | — | (Board — ⚠ sin trazar, prob. Can't! en arena) | ✖ |
| C 0x43 | 0x08f0 | gate Cast | Cast (In An / corona LB → Absorbed!) | ✅ cableado |
| G 0x47 | 0x096a | funnel code0 → SJOG:0x18ce | (G)et DIRECCIONAL (getdir→actor+dir) | ✅ **cableado direccional (fix)** |
| J 0x4a | 0x097a | funnel code1 → SJOG:0x0d4a | (J)immy DIRECCIONAL (cmd_jimmy del overworld) | ✅ **cableado (carril fix-121)** |
| K 0x4b | 0xac14 | klimb-escape | Klimb-Up/Down! + Escape! (huida por escalera de sala) | ✅ cableado |
| O 0x4f | 0x098a | funnel code2 → SJOG:0x1374 | (O)pen DIRECCIONAL (getdir→actor+dir, abre cofre) | ✅ **cableado direccional (fix)** |
| Push 0x994 | 0x0994 | directo → da7a = **CMDS:0x161a** | (P)ush DIRECCIONAL (cmd_push del overworld) | ✅ **cableado (carril fix-121)** |
| R | 0x09a2 | funnel code3 → dbbe | (R)eady — picker de equipo ZSTATS | ✅ cableado |
| S 0x53 | 0x09ac | funnel code4 → db9a = SJOG:0x095c | (S)earch DIRECCIONAL (cmd_search del overworld) | ✅ **cableado (carril fix-121)** |
| U 0x55 | 0x09b6 | funnel code5 → dbb2 | (U)se item — bebedor de pociones / lector | ✅ cableado |
| Y 0x59 | 0x09c0 | directo → dada = **CMDS:0x1418** | (Y)ell — "what?\n:" + getstring(30) → No effect! | ✅ **cableado (carril fix-121)** |
| Z 0x5a | 0x09ce | directo → dba6 | (Z)-stats — cmd_zstats (ficha del PJ, sin turno) | ✅ **cableado (este carril)** |
| 0-9 | 0x09ec/0x09fe | set-active | Set Active Plr (g_active_char) | ✅ cableado |
| Esc | 0x0864 | flee | huida rápida del miembro activo ("Escape!") | ✅ cableado |
| Space | 0x… | pass | "Pass" (turno sin acción) | ✅ cableado |
| flechas | SJOG 0x1C56 | mov/huida | mover / salir por el borde | ✅ cableado |

Nombres del name-table (DS): 0x6e14 Get · 0x6e1a Jimmy · 0x6e22 Open · 0x6e28 Push ·
0x6e2e Ready · 0x6e3a Search · 0x6e42 "Use item" · 0x6e4e Yell · 0x6e54 Z-stats · 0x6e0c
"Can't!" · 0x6d98 "Can't!" (gate no-party).

### ⚠ La tabla de la arena tiene un GEMELO BYTE-IDÉNTICO en el kernel

COMBAT.OVL **no pasa por el despachador**: tiene su propia copia de los nombres. DATA.OVL
guarda las dos, con los MISMOS BYTES y offsets distintos, así que una cita al offset del
kernel desde un handler de arena *cuadra* y es **invisible en ejecución** — sólo se caza
leyendo el emisor. Regla: en un handler de combate, citar el offset del despachador es
sospechoso POR DEFECTO.

Extensión REAL del bloque de COMBAT (por emisor, no por contigüidad de bytes): **DS
0x6d98 … 0x6ee6**, empujado desde el run de `mov ax, imm` de COMBAT.OVL 0x05a4-0x0ab7.
Cada offset de esa columna aparece en `re/disasm/` **sólo** en COMBAT.OVL.asm, y cada uno
de la columna kernel **sólo** en ULTIMA.EXE.asm (emisores DISJUNTOS = la derivación).

| cadena | arena (COMBAT.OVL) | emisor | kernel (despachador) |
|---|---|---|---|
| `"Cast...\n"` | 0x6df6 | 0x08f0 | 0xa142 |
| `"Get-"` | 0x6e14 | 0x096a | 0xa16a |
| `"Jimmy-"` | 0x6e1a | 0x097a | 0xa198 |
| `"Open-"` | 0x6e22 | 0x098a | 0xa1ce |
| `"Push-"` | 0x6e28 | 0x0994 | 0xa1e4 |
| `"Ready...\n\n"` | 0x6e2e | 0x09a2 | 0xa1f0 |
| `"Search-"` | 0x6e3a | 0x09ac | 0xa1fc |
| `"Use item\n\n"` | 0x6e42 | 0x09b6 | 0xa24c |
| `"Yell "` | 0x6e4e | 0x09c0 | 0xa286 |
| `"Z-stats...\n"` | 0x6e54 | 0x09ce | 0xa28c |
| `"Pass\n"` | 0x6e60 | 0x09e2 | 0xa134 / 0xa2a0 |
| `"D-What?\n"` | 0x6e84 | 0x0a3a | 0xa14c |
| `"Look"` | 0x6eb0 | 0x0a66 | 0xa1a8 |
| `"W-What?\n"` | 0x6ed6 | 0x0a8e | 0xa276 |
| `"Buffer O"`/`"ff\n"`/`"n\n"` | 0x6dd2/0x6ddc/0x6de0 | 0x088a/0x08a1/0x08a6 | 0xa110/0xa11a/0xa11e |

Sin gemelo en el kernel (propias de la arena): `"Set active plr:\nNone!\n"` 0x6e66 (@0x09f1)
y `"What?\n"` 0x6ee6 (@0x0ab7). **0x6e76 NO es un emisor**: es un puntero a mitad de la
cadena de 0x6e66 y no lo empuja NADIE en todo `re/disasm/` — la cota «0x6df6-0x6e76» que
circulaba no está derivada, la real es 0x6d98-0x6ee6.

⚠ `0x6e60` es AMBIGUO entre espacios de direcciones: DS 0x6e60 es `"Pass\n"`, pero
**CS 0x6e60 es `unequip_item`** (ULTIMA.EXE, `call 0x6e60` @0x6a48). Una cita a 0x6e60 sin
decir DS o CS no identifica nada.

**Familia hermana — el pasillo:** `"Klimb-"` tiene CUATRO copias, una por contexto:
TOWN 0x2723 · DUNGEON.OVL 0x6cce (y 0x6cba `"Klimb-U/D-"` cuando caben las dos) ·
SJOG 0x8ede (arena) · DS 0xa1a0 (dato del kernel, no CS). Y el del kernel está tras `cmp byte [g_location],0 /
jne` (ULTIMA.EXE 0x32e8-0x32f3) ⇒ **0xa1a0 sólo se emite en overworld**; con loc≥0x21 el
kernel salta a 0x330a → DUNGEON.OVL. Censo completo en `citas-109-acta.md`.

## Notas de fidelidad

1. **Get/Open = DIRECCIONALES, celda ADYACENTE al actor activo** (getdir DENTRO de SJOG
   0x18ce/0x1374 — ver §Resolución; el getdir NO está en COMBAT.OVL sino en la rutina SJOG que
   el thunk invoca, la misma del overworld). El cofre (tile 1) es IMPASABLE: NO se pisa, se abre
   apuntando la dirección desde al lado. El port cablea getdir en combate (main.ts
   `pendingCombatDir`) + `resolveBoardChest` sobre actor+dir + cofre impasable
   (`isWalkable`/`cellFreeForDef` rechazan `chestAt`). Eco = overworld ("Found:" + pieza).
   **Opción A IMPLEMENTADA (carril chest-reveal, 2026-07-24)**: la ⚠ Clase-C opción-B (acreditar
   al abrir) queda CERRADA — (O)pen deja el botín AL SUELO (pila LIFO por celda, `Combat.lootPiles`,
   espejo de loot_place 0x0F88 slots 31→1) con "Found:" + línea por pieza (dispatcher 0x12A);
   cada (G)et posterior recoge UNA pieza (cmd_get 0x18CE barrido ascendente 1→31 = LIFO) con su
   nombre/cantidad (get_item_switch 0x1458, lootItemName); (G)et sobre cofre (cerrado o anidado
   al tope) → "Open it first!" (0x1482/0x8C3E) sin retirarlo; (O)pen sin cofre → "Nothing to
   open!" (0x8b6c). Testigo: ad_ep14.ocrlog.txt:3310-3365 (Open→Found:+lista; Gets uno-a-uno en
   orden INVERSO a la colocación). CORRIGE `combat-get-treasure-dispatch.md`, que
   asumió celda-propia + crédito directo (paró en la frontera del stub sin resolver).

2. **(Z)stats en combate** (cableado en este carril): el bucle de comando de combate acepta
   la 'Z' igual que el del overworld (thunk 0x9ce→dba6 = cmd_zstats). El port lo gestiona la
   piel fiel/shader (mismo keyHandler de captura que el overworld). Antes NO abría en combate
   porque el snapshot apagaba `awaitingInput` con `&& game.combat == null` (correcto para el
   cursor de consola, que el original NO pinta en combate, pero NO para el gate del comando Z).
   Fix: nuevo campo de snapshot `awaitingCommand` (= `this.awaiting`, SIN el apagón de
   combate) usado sólo por el gate de Ztats; sigue protegiendo la 'Z' rúnica del Cast en
   combate (ahí `this.awaiting` está en false por el getstring). Presentación pura: NO consume
   turno (verificado en vivo: abrir select→ficha→cerrar deja el turno del PJ intacto).

3. **~~Clase-C sin trazar (Jimmy/Search/Push/Yell)~~ RESUELTO (carril fix-121, 2026-08-17).**
   La conjetura «casi todos caen a Can't!» era FALSA: el gate 0x80 del funnel pasa para todo
   PJ y los cuatro comandos SON FUNCIONALES en la arena. Thunks resueltos con
   `dispatch_table.stubs()` (controles 6/6 contra la tabla §Resolución): db82→SJOG:0x0d4a ·
   db9a→SJOG:0x095c (ya estaban en §Resolución) · **da7a → CS 0x7d0a → CMDS.OVL:0x161a
   (cmd_push)** · **dada → CS 0x7d6a → CMDS.OVL:0x1418 (cmd_yell)**. Board (0x42→0xacbc)
   sigue sin trazar. Derivación por comando:

   **§J — Jimmy (SJOG:0x0d4a en arena).** Gates en orden: llaves==0 → "No Keys!\n"
   (DS 0x8ad0) ANTES del getdir (0x0d66<0x0d78); getdir; despacho por tile:
   0xB9/0xBB → 0x0dc8 rand(0,29) vs DEX (0x55b5) — éxito tile−1 al buffer vivo +
   "Unlocked!\n" 0x8ae6, fallo "Key broke!\n" 0x8ada + llave · 0x97/0x98 → 0x0e1c
   "Key broke!\n" 0x8af2 + llave SIN tirada · 0x84/0x85 → 0x0e22 (check de ocupante
   0x770e SALTADO con loc≥0x80) rand(0,29) vs DEX — éxito rama loc≥0x7f 0x0ee4: tile
   0x44 + "Unlocked\n" 0x8b48 (SIN '!'), fallo "Key broke!\n" 0x8b10 + llave · resto →
   barrido del pool 0x0f2c (planta saltada @0x0f56) por cofre → 0x0baa desarme:
   bit 0x80 limpio → "Key broke!\n" 0x8a58 + llave SIN tirada (gate 0x0bc7); armado →
   umbral ((byte&0x7f)−DEX+30)>>1, rand(1,30) — éxito limpia el bit + "Success!\n"
   0x8a64, fallo "Key broke!\n" 0x8a6e + llave; sin cofre → "No lock!\n" 0x8b52.
   El actor lo da kernel 0x4988 rama loc>0x80 (@0x499c: charIdx del combatiente de
   turno, sin prompt). Beep del fallo de cofre (0x842e @0x0c31) NO portado → ficha #161.

   **§S — Search (SJOG:0x095c en arena).** getdir; barrido del pool por cofre ANTES del
   switch de tile (0x09be, planta saltada @0x09ec): cofre → "\nThou dost find\n"
   (DS 0x892c) + trap-check 0x02ea: INT (0x55b6) vs rand(1,30), SÓLO REPORTA —
   "no trap!\n" 0x864a (éxito sin trampa Y fallo con trampa), "a simple/complex
   trap!\n" 0x8654/0x8664 (éxito, byte<0xa/>0x14), "a trap!\n" 0x8676 (éxito valor
   medio Y **falso positivo**: fallo sobre cofre limpio). Sin cofre, **SONDA DE
   RESTOS** (0x0a3e call 0x7782 = kernel 0x3702: barrido DESCENDENTE 31→1 del pool
   por (x,y), planta saltada en arena, devuelve el TIPO del objeto — ⚠ NO es una
   sonda de moongate, que fue mi primera atribución y era falsa): ==0x1F (SANGRE,
   lo que dejan las muertes de la arena) → "\nThou dost find\n" (DS 0x893e, gemela
   byte-idéntica de 0x892c) + `search_remains_outcome` SJOG:0x01f2 (la hermana del
   trap-check; su lado de OVERWORLD sigue sin emisor = ficha #323):
     · rand(0,7) SIEMPRE (0x01fd). ≠0 (7/8): el resto se BORRA (0x0212 call 0x7af4 =
       kernel 0x3a74 pool_object_write con seis ceros) + rand(0,0x1f) (0x021c):
       ==0x13 → "Plague!\n" 0x8606 + tono NB(500,3000,40) (0x0237 → 0x62bc; NO
       portado, catálogo sfx con #161/#323) + record+0 del BUSCADOR = 0x50 'P'
       (0x0241; el flag 0x0246 g_unk_a9fa=1 = repintado, no portado); si no →
       tirada ANIDADA `rand(0, rand(0,3))` (0x0256/0x025a — el 2º call consume el
       cero sobrante del 1º) → 0 "nothing!\n" 0x8610 · 1 "worms!\n" 0x861a ·
       2 "guts!\n" 0x8622 · 3 "a bloody pulp!\n" 0x862a.
     · ==0 (1/8): el resto se TRANSFORMA (0x028e): rand(0,3)==0 → "food!\n" 0x863a
       tipo 0xf / ≠0 → "gold!\n" 0x8642 tipo 2 (0x02be escribe +0/+1) + qty =
       rand(1,3) al byte +5 (0x02c6) + redibujo; el (G)et lo recoge (id 0xf/2).
     Un cadáver 0x1E NO dispara la rama (0x1e ≠ 0x1f → switch de tile).
   Después, switch de tile 0x0a6a → prosa de mueble + "hou dost find\n"; 0x4E →
   revela 0xB9 (0xB8 con g_floor≥0x80, 0x0b40) + "a hidden door!\n" 0x8a48; resto →
   cadena 0x03a8 (moonstones: location jamás 0xFF) → 0x045a (hierbas: coords
   (182,54)/(97,165)/(44,137), todas >10) → 0x0514 (tabla fija por location: jamás
   0xFF) ⇒ las tres INALCANZABLES en arena → "nothing of note.\n" 0x86cc.

   **§P — Push (CMDS:0x161a en arena).** 0x39cc (restaura-tile) inerte (gate pueblo);
   getdir; sustituye g_party por la celda del actor (0x164f-0x1671, copia propia del
   patrón de COMBAT 0x063e); **placa de sala** (0x1695 call 0xffffbf3a = stub CS
   0x7eba → COMBAT.OVL:0x111a, el 2º caller del sistema de triggers): placa `at` viva →
   dispara y sale EN SILENCIO; celda ocupada (0x770e = kernel 0x368E, pool con
   combatientes Y objetos, planta saltada) o tile no empujable (clasificador 0x14ba) →
   "Won't budge!\n" 0x4559; fill = 0x45 clase cañón (tile&0xFC)==0xB4 / 0x44 resto;
   detrás libre y == fill → EMPUJE 0x1548 "Pushed!\n" 0x4547 con REORIENTACIÓN 0x1504
   para clases 0x90/0xB4 (N+0/E+1/S+2/O+3); si no y el suelo del actor == fill → TIRÓN
   0x15b0 "Pulled!\n" 0x4550 (orientación XOR 2); si no → "Won't budge\n" 0x4567
   (SIN '!'). El actor AVANZA a la celda vaciada por SUMA CRUDA (0x178a + slot del pool
   0x17b6-0x17d6 + redraw 0x5910) — sin pasar por el mover SJOG 0x1d3c ⇒ NO dispara la
   placa que pise al entrar. CERO rand.

   **§Y — Yell (CMDS:0x1418 en arena).** La rama de velas exige fragata Y loc<0x80
   (0x142c) ⇒ inalcanzable; "what?\n:" (DS 0x4529) + getstring(30) (0x1463); vacío →
   "Nothing\n" 0x4531; con palabra → putchar('\n') (0x147e call 0x573a = kernel 0x16ba,
   acreditado en cmds.md:414) + "\nNo effect!\n" 0x453a @0x14ac (loc 0xFF ∉ [1,0x20] y
   ≠0 — la palabra da igual). CERO rand (getstring crudo, #268).

   **TURNO — los cuatro consumen SIEMPRE** (incluida la cancelación del getdir): el
   bucle deja `[bp-4]=1` @0x083e, el funnel descarta el retorno (`sub ax,ax` @0x05b0)
   y P/Y ni miran el suyo (jmp 0x7ba). El getdir del kernel (0x35EC @0x363b-0x364e)
   acepta ESC (0x1b) O Space (0x20), ecoa **"Pass\n"** (DS 0xa2a0) y devuelve 0.
   ⚠ DIVERGENCIA PREEXISTENTE del port en (G)et/(O)pen: su ESC es silencioso y SIN
   turno, y no acepta Space (main.ts pendingCombatDir, carril chest-reveal) — misma
   mecánica en el binario, así que también les tocaría "Pass"+turno; no se tocó en
   fix-121 para no mover digests del tour. Queda declarado aquí para su ficha.
   ~~⚠ Y DIVERGENCIAS PREEXISTENTES del push de OVERWORLD (game.push): no imprime
   "Pushed!\n"/"Pulled!\n", no reorienta 0x90/0xB4 (0x1504) y funde "Won't budge!\n"/
   "Won't budge\n" en una sola cadena. Declaradas, fuera del alcance de fix-121.~~
   **CERRADAS por #289 (carril fix-289)**: game.push imprime las dos cadenas de éxito,
   reorienta 0x90/0xB4 vía `pushOrientedTile` (slide flip=0 / pull flip=1) y separa
   0x4559 («Won't budge!\n») de 0x4567 («Won't budge\n»). Sigue declarada SOLO la capa
   de objetos `0x770e` (modelo del clon sin objeto-encima-de-mueble).

   Port: `Combat.playerJimmy/playerSearch/playerPush/playerYell/playerDirCancel`
   (game/src/core/combat/combat.ts) + handlers j/s/p/y de handleCombatKey (main.ts)
   reusando `jimmyLock`/`trapCheck`/`furnitureSearchProse`/`revealSecretDoor`/
   `isPushableTile`/`pushFillTile` y el nuevo `pushOrientedTile` (world/commands.ts).
   Tests: game/tests/combat-jspy-121.test.ts (25, esperados en crudo + gemelo de
   semilla para el stream + 5 mutantes verificados). RNG del port: censo del 17-08 —
   NINGÚN artefacto existente (tours espejo, walkthrough, e2e) pulsa j/s/p/y dentro de
   combate ⇒ el cableado no mueve ningún digest/sello existente; las tiradas nuevas
   sólo entran al stream cuando el jugador usa los comandos.

## Evidencia viva
- `docs/verdicts/combat-cmds/ztats-en-combate.png`: ficha de Z-stats abierta en plena arena
  (troll en el tablero), Player: Avatar / Str=15 HP:60 / …
- `docs/verdicts/combat-cmds/despues.png`: secuencia fiel del cofre — "Nothing to get!"
  (off-chest) → "Trapped! ACID!" → "Thou dost find 59 gold!".

## RESIDUALES CERRADOS (carril chest-residuales, 2026-07-24)

Los 3 residuales declarados por el carril chest-reveal quedan derivados y calcados
(rama `fiel/chest-residuales`):

1. **Formato "Trapped!" = DOS líneas.** DATA.OVL DS 0x8b7e = `"Trapped!\n"` (la string
   lleva SU propio \n; open_chest_world 0x112C @0x1218 push + 0x121c print 0x58d0) y el
   TIPO lo imprime el kernel 0x2FD0 (= SJOG 0x7050) en línea aparte vía 0x1850:
   DS 0x5581 `"ACID!\n"` / 0x5588 `"POISON!\n"` / 0x5591 `"BOMB!\n"` / 0x5598 `"GAS!\n"`.
   El "Trapped! X" en una línea del port era Clase-C → dos messages separados en
   game.openChestObject y Combat.openChestIntoPile. OJO: el open de PASILLO 3D (0x12D4)
   NO imprime "Trapped!" (0x131a llama 0x7050 directo) — dungeon.ts ya era fiel.

2. **Turno en early-exits = SOLO overworld.** cmd_get 0x18CE: el fall-through
   "Nothing to get!" (0x1b28, str 0x8e64) y el rechazo "Open it first!" del cofre id1
   (get_item_switch 0x1482 → jmp 0x1798) salen SIN tocar [g_unk_24e6] (el éxito marca en
   0x178e/0x19f6/0x1a38/0x1a7e/0x1aa6/0x1b04); "Nothing to open!" (0x112C 0x118c→0x12c8→
   ret) tampoco (el marcador de open es 0x11e4, post-hallazgo). game.get() ya no cobra
   turno en esas dos ramas. **La ARENA es lo contrario y el port ya era fiel**: el bucle
   de turno de COMBAT.OVL marca salida-de-turno por DEFECTO tras la tecla (`mov [bp-4],1`
   @0x083e) y el funnel 0x0544 DESCARTA el resultado SJOG (`sub ax,ax` @0x05b0; solo el
   gate "Can't!" devuelve 1 y re-prompta vía 0x0b56→0x06f1) ⇒ "Nothing to get!/open!"
   consume la acción del combatiente.

3. **Cofre de pasillo 3D: el (O)pen NO entrega botín — lo entrega el (G)et, ACREDITANDO
   (no derrama objetos-suelo).** open_dungeon 0x12D4: trampa (test tile&7) + tile
   `(t&8)+0x70` (0x134a-0x1351) + "\nChest opened\n" (0x8b96) y NADA más. get_dungeon
   0x179E sobre el 0x70: `tile &= 8` (0x181a), cabecera `"contents\nof chest\nYou
   find:\n"` (DS 0x8dbc @0x181f) y 7 filas de loot acreditadas UNA a una con
   apply_item_grant 0x1458 (slot arg 0x20 @0x18a7 ⇒ sin borrado de objeto; 0x178e marca
   turno) — CERO llamadas a loot_place 0x0F88 en 0x179E: el "derrame" del testigo
   ad_ep14 es el propio tile-cofre-abierto 0x70 entre O y G, no una pila de objetos.
   El port ya NO colapsa O+G: DungeonState.openChest = trampa+tile+eco;
   DungeonState.getHere(state) = vaciado+cabecera+acreditación (celda queda pasillo).
