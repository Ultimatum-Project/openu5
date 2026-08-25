# Auditoría «byte-wrap / rango no esperado» (2026-07-22)

Disparador: veredicto del quirk DEX-99 (`game/tests/combat-rats-cycle.test.ts`) —
un save editado con DEX 99 hace que la recarga de iniciativa `0x24 − DEX` en BYTE
sin clamp dé 193 ticks y que el umbral de acierto `(DEX_def − vel + 30) >> 1` = 53
supere el `rand30()` máximo (30) → PJ intocable y casi inmóvil. Comportamiento
FIEL (el binario hace lo mismo). Este documento es el barrido sistemático de esa
CLASE: fórmulas del port que consumen un valor de save/estado editable y qué pasa
cuando el valor sale del rango que el juego original podía producir.

**Rango legítimo de referencia**: STR/DEX/INT ≤ 30 (ATTR_MAX de shrines,
`world/shrines.ts:27` = 0x1e; la creación de la gitana nunca supera ~25);
nivel ≤ 8 (exp cap 9999 → `bit_length(99)+1` = 8 exacto); oro/comida/exp ≤ 9999
(`add_word_capped` 0x9C84); keys/gems/torches/pociones/pergaminos/reagentes ≤ 99
(`add_byte_capped` 0x9C60 / SJOG 0x7f70); MP ≤ INT (A/M) o INT/2 (B).

**Regla de la clase**: el original opera casi todos los umbrales `CONST − stat`
en **16-bit** y parte con **`shr` (shift SIN SIGNO)** — un stat editado que hace
negativa la resta WRAPEA el umbral a ~0x7Fxx (≈32700) → la tirada `rand(1,30)`
no lo supera JAMÁS (fallo/percepción-fallida perpetuos). Un `>>` con signo en el
port da el comportamiento CONTRARIO (umbral negativo → éxito perpetuo). Las
excepciones que sí parten con `sar`/idiom con signo (`cdq; sub; sar`) no
wrapean: dan umbral > 30 (intocable) o negativo (acierto automático), también
absurdos pero SIN wrap — y el port ya las calcaba bien con `Math.trunc`/`>>`.

## Tabla

| # | Fórmula (fichero) | Cita binaria | Rango seguro | Comportamiento en extremo (original) | Veredicto |
|---|---|---|---|---|---|
| 1 | Recarga iniciativa `0x24−vel` byte (`combat/formulas.ts:initiativeReset`; countdown `(c−1)&0xff` combat.ts) | kernel 0x6506 @65a8; COMBAT 0x0B94 @0c4b | DEX ≤ 35 (0x23) | DEX 99 → 193 ticks: actúa 1 vez por ~12 de una rata | **FIEL-QUIRK** (test combat-rats-cycle) |
| 2 | Umbral de acierto `(def−atk+30)>>1` con signo (`formulas.ts:hitThreshold`) | COMBAT 0x14D6 @154d-155b (idiom `cdq;sub;sar`) | stats ≤ 30 | defensor 99 → umbral ≥ 53 > rand30 máx = INTOCABLE; atacante 99 → umbral < 1 = acierto garantizado. Sin wrap (con signo) | **FIEL-QUIRK** (test combat-rats-cycle) |
| 3 | Contest de charm/posesión `(INT_v−INT_a+30)/2` (`combat/combat.ts:2702`) | COMSUBS 0x0000 @0x0044-0x0047 `cdq;sub;sar` (verificado en esta auditoría: CON signo) | INT ≤ 30 | INT 99 → umbral > 30 = resiste SIEMPRE (inmune a charm) | **FIEL-QUIRK** (Math.trunc = sar-trunc, correcto) |
| 4 | Jimmy cofre-OBJETO `((tile&0x7f)−DEX+30)>>1` (`world/commands.ts:jimmyLock chestObject`) | SJOG 0x0BAA: 0x0be7 `sub` word · 0x0bec `shr` · 0x0bee trunc a AL · cmp 0x0bfc-0x0c03 | DEX ≤ dif+30 (≤ 30 cubre todo) | DEX 99 → umbral 226 (byte del wrap) → «Key broke!» SIEMPRE | **DIVERGENCIA → FIX** (port usaba `>>` con signo → éxito perpetuo) |
| 5 | Jimmy cofre-MAZMORRA `(floor·2−DEX+30)>>1` (`world/commands.ts:jimmyLock dungeonChest`) | SJOG 0x0C3E: 0x0ca6 `shr`, umbral WORD (0x0ca8/0x0cf1 `jle`) | DEX ≤ floor·2+30 | DEX 99 → umbral 32733+ → «Key broke!» SIEMPRE | **DIVERGENCIA → FIX** (ídem; `dungeon.ts:jimmyHere` YA era fiel — inconsistencia interna resuelta) |
| 6 | Trap-check de cofre `(30−INT)>>1` / `(dif−INT+30)>>1` (`world/traps.ts:trapThreshold`) | SJOG 0x02EA: ramas convergen en 0x0330 `shr`; no-atrapado 0x0311-0x0314 `sub ax,0x1e; neg ax` word | INT ≤ 30 (no-atrap.) / ≤ dif+30 | INT 99 → umbral 32733 → percepción FALLA SIEMPRE (falsos «a trap!» / trampas invisibles) | **DIVERGENCIA → FIX** (+ re-baseline de `chest-object.test.ts` que asumía el comportamiento divergente con INT 99) |
| 7 | Search de mazmorra `(floor·2−DEX+30)>>1` (`dungeon/dungeon.ts:search`) | SJOG 0x0646: 0x06c5-0x06cf `shl/sub/add/shr`, umbral WORD 0x06d1 | DEX ≤ floor·2+30 | DEX 99 → umbral 32733 → NUNCA «No trap» (clasifica trampa siempre, también en cofres limpios… la rama de cofre siempre tira) | **DIVERGENCIA → FIX** |
| 8 | Peaje troll: gate del prompt + importe `0x63−3·STR` (`world/loops/hazards.ts:trollToll` + `game.ts` outdoor) | MAINOUT 0x1B3E: 0x1b5e-0x1b65 `shl/add/sub/neg` WORD CON SIGNO; prompt SIEMPRE tras fallo de DEX; pago 0x1ba9 `sub g_gold,ax` | STR ≤ 32 (toll > 0) | STR ≥ 33 → toll ≤ 0; STR 99 → toll −198 y PAGAR REGALA 198 de oro | **DIVERGENCIA → FIX** (el port suprimía el prompt con `toll > 0`) |
| 9 | Solvencia del peaje (`game.ts:resolveTrollToll`) | MAINOUT 0x1ba9 `sub` word + 0x1bb2 `jge` CON SIGNO (reembolso 0x1bb9) | oro ≤ 32767 (legítimo 9999) | oro editado > 32767 → el word firmado se ve NEGATIVO → nunca puede pagar → combate | **DIVERGENCIA → FIX** (port comparaba unsigned) |
| 10 | Nivel por exp `bit_length(exp/100)+1` (`quest/lordbritish.ts:levelForExp`) | OUTSUBS 0x06ea `inc dx; sar cx,1; jg` — SIN clamp (verificado) | exp ≤ 9999 (→ nivel 8 exacto) | exp editada 65535 → nivel 11, maxHP 330 (original); el port clampa a 8 (`Math.min(MAX_LEVEL)`) | **DIVERGENCIA CONSCIENTE, SIN FIX** — guarda deliberada ya documentada en código (lordbritish.ts:26-28); solo alcanzable con exp editada. `resurrectionLevel` (magic/tables.ts) NO clampa → ya fiel. Decisión de calcado estricto = del lead |
| 11 | Munición: `dec` u8 con wrap (`combat/combat.ts:consumeAmmo`) | COMSUBS 0x099c `dec`+`jne` | qty ≥ 1 al disparar | disparar con 0 → 255 flechas gratis, arco no se desequipa | **FIEL-QUIRK** portado bug-for-bug (#18, FIDELITY-CONTRACT) |
| 12 | Regateo compra `base+⌊base(100−3·INT)/100⌋` (`shops/shops.ts:shopBuyPrice`; posadas innRest/innMonthly) | SHOPPES 0x02D8-0x0318 (sin clamp de mínimo) | INT ≤ 33 (precio > 0 sano) | INT 34-66 → abarata bajo base; INT ≥ 67 → precio NEGATIVO (comprar paga al comprador) | **FIEL-QUIRK** (docstring del port ya lo declara: «sin clamp, el binario no lo tiene») |
| 13 | Regateo venta `⌊3·INT·base/100⌋+1` (`shops.ts:shopSellPrice`) | SHOPPES 0x0EB9-0x0ED6 | INT ≤ 30 | INT 99 → vende a ~3× base. Monotónico, sin wrap | **FIEL** (ventaja lineal) |
| 14 | Jimmy puerta `DEX>rand(0,29)` / prisionero ídem (`commands.ts door/prisoner`) | SJOG 0x0dd4 / 0x0e54 | cualquiera | DEX ≥ 30 → éxito garantizado. Compare directo, sin resta → sin wrap posible | **INOFENSIVO** |
| 15 | Esquivas/contests DEX monotónicos: catarata (game.ts:1488), pantano exterior/pueblo (hazards), sneak del troll, klimb (commands.ts:60), trampas mazmorra (dungeon.ts contestDex) | kernel 0x04d0; OUTSUBS 0x5FC; TOWN 0x108D; MAINOUT 0x1c76-0x1c80; DUNGEON 0x0970/0x0a09 | cualquiera | DEX ≥ 30 → inmunidad total (cmp directo stat vs rand30, sin resta) | **INOFENSIVO** (god-mode fiel) |
| 16 | Peso equipo ≤ STR (`equip.ts:271`) | (compare directo) | cualquiera | STR 99 → carga todo. Monotónico | **INOFENSIVO** |
| 17 | MP := INT / INT>>1 (posada `commands.ts:682` / `shops.ts:333`, resurrección `cast.ts:389`) | CMDS 0x0499/0x04d6; CAST2 | cualquiera | INT 99 → MP 99 al dormir. Asignación directa | **INOFENSIVO** |
| 18 | Contadores capped (`counters.ts`) oro/comida/exp 9999, ítems u8 99 | kernel 0x9C84 [= CS 0x3f14 → ULTIMA.EXE:0x3f14 add_word_capped] / 0x9C60 / SJOG 0x7f70 | (caps modelados) | sumar nunca wrapea; valores editados por encima se quedan (solo #9 los consume mal) | **INOFENSIVO** |
| 19 | Velocidad spawn enemigo `(dex+rand0(7)−4)&0xff` con guard `>0x1e` (`formulas.ts:enemySpawnSpeed`) | kernel 0x6506 @65d2-65f1 | (dex de TABLA, no save) | el guard ya modela el underflow del byte | **INOFENSIVO** (no consume save) |
| 20 | Creación gitana acumuladores `&0xff` (`creation/gypsy.ts`) | (flujo de creación) | n/a | no consume valores editados | **INOFENSIVO** |

## Fixes aplicados (esta rama)

- `game/src/core/world/commands.ts` — jimmyLock `chestObject` (#4: shr 16-bit +
  trunc AL) y `dungeonChest` (#5: shr 16-bit word).
- `game/src/core/world/traps.ts` — `trapThreshold` ambas ramas (#6).
- `game/src/core/dungeon/dungeon.ts` — umbral del `search` (#7).
- `game/src/core/game.ts` — gate del prompt del peaje (payerIndex, no signo del
  toll) (#8) + solvencia con `jge` firmado de 16 bits (#9).
- Tests: `game/tests/audit-byte-wrap.test.ts` (nuevo, citas por sitio) + 2 tests
  en `prompts-troll.test.ts` (STR 99 → toll −198 regala oro; oro 40000 →
  insolvente) + re-baseline de `chest-object.test.ts` («INT alta percibe» ahora
  INT 30/diff 3 — el INT 99 anterior codificaba el comportamiento DIVERGENTE).

Nota de paridad: los caminos corregidos solo cambian con stats FUERA del rango
legítimo — el arnés de paridad (oráculo con stats reales) no se ve afectado.

## Saves y tooling (fuera del repo, mismos entregables)

- `original/u5/saves-lib/`: 5 escenarios con el roster completo trucado a
  99/99/99/99 (STR/DEX/INT/MP) saneados por offset (registros 32B desde 0x02;
  +0x0c/0x0d/0x0e/0x0f) copiando los valores del donante ya sano
  `puertas-doom-sin-caja` (party 30/30/30, roster natural 12-26). HP/nivel/
  equipo/posición intactos (HP altos = inofensivos). Verificado: re-lectura
  byte-a-byte (solo cambian esos 4 offsets × 16 registros) + boot por el motor
  (`parseSaveWindow`+`createNewGame`) de los 7 escenarios.
- `~/bin/u5save`: nueva guarda `warn_stats()` — al `install`/`add` avisa si
  algún registro lleva STR/DEX/INT > 0x23 (35), citando el quirk y esta nota.
- El save del web es localStorage propio del port (u5save no lo genera); los
  escenarios entran al web importando el .gam — ya saneado en origen.
