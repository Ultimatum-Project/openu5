# A3 — Espada del Caos (Sword of Chaos): posesión del portador

RE-VERIFICACIÓN propia del ASM (regla doble-ojo del lead; la spec del scout en
`censo-a346.md` se re-checa aquí). Cita: `re/disasm/COMBAT.OVL.asm` (fileoff; CS =
fileoff + 0xA290). VEREDICTO: la MECÁNICA de la spec es correcta; el matiz de offsets
se aclara abajo (no era un error, eran offsets de save-record).

## El gate del turno del PJ — COMBAT.OVL 0x0682-0x06c4 (verificado byte a byte)
```
0682: bl = g_cmb_actor ; bx = actor<<3            ; tabla de unidad de combate (-0x45ea, stride 8)
068c: test byte[bx-0x45ea], 0x80 ; je 0x6c8        ; GATE: bit 0x80 = miembro de PARTY (si no → turno normal)
0693: si = [bp-8] (índice de miembro) ; si <<= 5    ; record de roster (stride 32)
069a: cmp byte[si+0x55c3], 0x23 ; je 0x6a8          ; mano IZQUIERDA == 0x23 (Sword of Chaos)?
06a1: cmp byte[si+0x55c4], 0x23 ; jne 0x6c8         ; mano DERECHA == 0x23? (ninguna → turno normal)
06a8: bl = g_cmb_actor ; bx = actor<<3
06b2: or byte[bx-0x45ea], 1                          ; SET FLAG BIT 0x01 = charmed/poseído (en la UNIDAD de combate)
06b7: mov byte[g_active_char], 0xff                  ; limpia el activo (la IA toma el control)
06bc: mov byte[g_unk_a9fa], 1
06c1: call 0x3f4                                      ; ejecuta el turno por IA (COMBAT:0x03F4 = enemyTurn)
06c4: jmp 0xb79                                       ; fin del turno
```
- **Sin consumo de RNG** en toda la ruta 0x0682-0x06c4 (ninguna llamada a rand
  0x2092/0x6112/0x3aae): la posesión sólo REDIRIGE el control, no tira.
- **Flag bit 0x01** en la unidad de combate `[actor-0x45ea]` = el `charmed` del port
  (`combat.ts:139` «flag 1: lucha para el otro bando»). NO es el record del PJ.
- **Persiste MIENTRAS SU BANDO AGUANTE** (corregido 2026-08-16, ficha #349): el `or` no se
  limpia en esta ruta y cada turno suyo lo conduce la IA vía el mismo flag… pero SÍ lo limpia
  **`SJOG.OVL:0x21CE`** (`and byte[si],0xfe` en 0x21eb) en cuanto el bando party se vacía.
  🔴 Este bullet decía «el `or` no se limpia; una vez poseído, el miembro sigue charmed el
  resto del combate» y «el "desmayo" del clue book = estado TERMINAL emergente (party
  aniquilada → fin de combate), NO un opcode aparte». Las DOS mitades son FALSAS: el desmayo
  es un opcode aparte, con su string propio (**DS 0x8f56 `" passes out!"`**), su tono, su
  `unequip_item(0x23)` y su `kernel 0x68ae` que lo duerme — y **no termina el combate**, lo
  CONTINÚA (COMBAT 0x0cca `inc ax / jne 0xd08`). Derivación completa en combat.md §2.1. La
  misma frase rancia vivía en el docblock de `maybePossessWithChaosSword` (también corregida).

## Aclaración de offsets (el matiz del doble-ojo)
El scout citó «roster+0x1B/+0x1C». El ASM usa direcciones DS `0x55c3`/`0x55c4` con
`si = miembro<<5`. La base del record en DS es **0x55a8** (stride 32): status en +0x0B
(→ DS 0x55b3, confirmado en COMBAT.OVL 0x55b3='D'/'G'/'P' líneas 1238/2452/2454, y en el
bebedor CAST 0x55b3), armas en **+0x1B / +0x1C** (→ DS 0x55c3/0x55c4). Es decir:
- `[si+0x55c3]` = record **+0x1B** = **`CharacterState.weapon`** (`saveNative.ts:193 d[base+0x1b]`).
- `[si+0x55c4]` = record **+0x1C** = **`CharacterState.shield`** (`saveNative.ts:194 d[base+0x1c]`).

⇒ los «+0x1B/+0x1C» del scout son los offsets de SAVE-RECORD y mapean EXACTO a
`weapon`/`shield`. No había error; sólo dos bases distintas (DS-absoluta vs record). El
port comprueba `record.weapon == 0x23 || record.shield == 0x23` (mano izq/dcha).

## Cableado en el port (reusa infraestructura existente)
- `WEAPON_CHAOS_SWORD = 0x23` (`formulas.ts:19`); ya es AUTO_HIT + mágica (id≥0x23).
- `Combatant.charmed` + `sideOf` (`combat.ts:714-716`): un PJ charmed cuenta como
  «monsters» → la IA (`selectTarget`) le apunta al bando party. `tickEnemyTurns:1865`
  YA conduce a cualquier combatiente charmed (`kind!=='enemy' && !charmed → break`).
- FALTA: (1) fijar `charmed=true` al INICIO del turno del portador de 0x23 (espejo de
  0x0682→0x069a); (2) que el driver de la UI arranque la IA para un PJ charmed
  (`pumpCombat`/`handleCombatKey` decidían input-vs-IA sólo por `kind==='enemy'`).
- Hook de posesión = en `currentUnit` (resuelve el actor nuevo; cubre turno 1 y sucesivos;
  `activeActor`/render NO lo dispara). Idempotente. Silencioso (el binario no imprime).

## FIX v2 (tras revert 84aa9198) — la RAÍZ era el conteo de fin por `kind`

La v1 se revirtió porque colgaba el resolvedor de sala de ch14b (Deceit tiene daemons).
Diagnóstico re-derivado del ASM:

- El daemon `possessCharm` (COMSUBS 0x017a `or [si-0x45ea],1`) y la espada (COMBAT 0x06b2)
  ponen **el MISMO flag 0x01** = charmed. Son EL MISMO estado; el binario AI-conduce a
  ambos (turno por bando, `combat.md` línea 81: `si kernel_0x5646(idx) → IA 0x03F4`).
- **La raíz del cuelgue NO era la colisión de flags** (es correcta y fiel), sino que el
  port cerraba el combate por `kind` (`anyPlayerActive`=hay `kind==='player'` vivo) en vez
  de por BANDO. El binario cuenta el fin por bando: SJOG:0x1B6C recuenta los vivos
  partiéndolos con el clasificador de bando 0x96c6 (función, no flag crudo).
- Con conteo por kind, un PJ poseído que mataba a la party real quedaba solo como «party
  viva» → `over` nunca true → `pumpCombat` (IA) agotaba su guard sin llegar a un PJ normal
  → UI colgada sin a quién pedir input. Bug LATENTE, enmascarado mientras los charmed
  tomaban input (v0); la posesión de la espada (IA ataca a la party) lo destapó.

**Fix:** `anyActiveOnSide(side)` por `sideOf` (commit del fix raíz, separado). VICTORY /
BATTLE-IS-LOST se cierran por bando vacío. La posesión de la espada (v1) se re-aplica TAL
CUAL encima — ya no cuelga porque el combate cierra por bando. Test de aceptación: ch14b
verde + los 5 tests de la espada + 2 de regresión del over-by-bando.

## Investigación (C) — la TASA de posesión del daemon es FIEL (COMSUBS 0x013b-0x017a)

¿El port posee de más y por eso pierde la sala? NO. Derivación (COMSUBS bias 0xe1e0):
- **Slot**: `rand(0,31)` — COMSUBS 0x013d `call 0x3eb2` → kernel 0x2092 `rand_range(0,0x1f)`.
  El port: `crng.rand0(0x1f)` (misma distribución 0..31, mismo stream base 0x2092). ✓
- **Gate del objetivo** (0x0157/0x015d): flag 0x80 (party) Y NOT flags 0x3d
  (0x20 muerto | 0x10 invisible | 0x08 dormido | 0x04 arrastrado | 0x01 charmed). El port:
  `kind==='player' && isActive && !charmed && !sleeping && !invisible` — casa salvo dos
  edge-cases inmateriales (el port excluye 'fled' que el ASM no; no excluye 'dragged' 0x04
  que el ASM sí). Ninguno aplica en esta sala.
- **Contest de INT** (0x0163 `call 0`): `contest = (defINT − atkINT + 30)/2 > rand30()`
  (COMSUBS 0x0000: ret 1 si threshold > rand → el caller 0x016f `jne` = RESISTE; ret 0 →
  POSEE). `call 0x58de` → kernel 0x3ABE = **rand30**. El port: `threshold > rand30() →
  RESIST`. **IDÉNTICO** (mi sospecha de «invertido» era falsa: no había visto el `jne`).

⇒ La posesión del port es FIEL en rand, gate y umbral. Bajo seed-0 el daemon posee a
Shamino + Avatar legítimamente; con combate FIEL (over-by-bando + IA conduce al poseído)
la party PIERDE la sala de forma fiel. La victoria del tour dependía del over-by-KIND
infiel (poseídos cuentan como party). **VERDICT: el paquete (over-by-bando + A3) espera al
re-trabajo del tour (brief-ch15-combate), que resolverá la sala con TODAS las fidelidades
juntas (posesión IA + fantasma-Shamino + resolvedor). No hay atajo por la tasa.**

### (C) — ¿reintento por turno? NO: 1 intento único (COMSUBS 0x00f4 enemySpecial)
`enemySpecial` (COMSUBS 0x00f4) hace UN solo pick de slot por turno de daemon (0x013d
`rand(0,31)`). No hay loop de reintento: éxito → 0x01c4 `ret 1` (exit); resistido/slot
inválido → 0x01ca, que CAE (fall-through) a la cadena de invisibilidad (test flag 0x800,
0x01cf) → daemon-summon (0x023e), SIN volver a re-pickear. El port lo replica: `enemySpecial`
hace un `possessCharm` (un slot) y cae a invisibilidad→daemon. ⇒ probabilidad por turno
IDÉNTICA (1 tirada de slot + 1 de contest). CIERRA (C): tasa 100% fiel, sin atajo.
