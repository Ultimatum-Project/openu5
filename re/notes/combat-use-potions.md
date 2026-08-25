# (U)se en COMBATE + efectos de combate de Purple/Black — derivación

Follow-up del Clase-C de pociones/pergaminos: ¿existe (U)se en la arena del DOS y qué
hacen de verdad Purple/Black? Cita: `re/disasm/COMBAT.OVL.asm` (fileoff; CS = fileoff +
0xA290, load_seg 0xA29) y `CAST.OVL.asm`. Strings: DATA.OVL (`fileoff = DS + 0x10`).

## FASE 1 — VEREDICTO: (U)se SÍ existe en combate

El bucle de turno de combate (COMBAT.OVL, dispatcher de teclas ~0x08a9) acepta comandos
del PJ activo. El compare de la 'U':
```
COMBAT.OVL 0b20: cmp ax, 0x55 ('U') ; jne 0xb28 ; jmp 0x9b6
         09b6: mov ax, 0x6e42 ("Use item\n\n") ; push ax ; mov ax, 5 ; jmp 0x970
         0970: push 5 ; call 0x544 (combat_cmd)
```
`combat_cmd(strPtr@bp+6, code@bp+4)` (COMBAT.OVL 0x0544):
```
0547: print strPtr                       ; "Use item\n\n" (DS 0x6e42)
054d: test byte[g_cmb_actor - 0x45ea], 0x80 ; je 0x5a4   ; GATE: bit 0x80 = miembro de party
                                                          ; si NO → "Can't!\n" (DS 0x6d98), ret
055e: dispatch por code: 0→..db76 1→..db82 2→..db8e 3→..dbbe 4→..db9a 5→0x59e (Use → ..dbb2)
```
El code 5 (Use) abre el item picker (misma máquina que overworld, ZSTATS 'U' mode) que
despacha a CAST cmd_use_item (0x1792) → **bebedor de pociones (0x135a)** / lector de
pergaminos (0x11de). El bebedor YA tiene la rama de combate:
```
CAST.OVL 1375: cmp g_location, 0x7f ; jbe 0x138e   ; <=0x7f: selChar (party picker)
        137c: (combate, loc>0x7f) target = g_cmb_actor (el bebedor ACTIVO), sin picker
```
⇒ En combate la poción la bebe el **PJ activo del turno** (no se elige objetivo). El
port ya modela g_location>=0x80 al entrar a la arena (`magic/cast.ts` CastContext).

Comandos que el dispatcher de arena imprime (name-table DS 0x6e14…): Get, Jimmy, Open,
Push, Ready, Search, **Use item**, Yell, Z-stats, Pass, etc. — pero muchos van a "Can't!".
El (U)se está entre los aceptados (code 5) para un PJ de party.

## FASE 2 — Efectos reales de Purple/Black (CAST.OVL bebedor, rama combate)

Tabla `0x5c5a` = tile de DISPLAY por actor (stride 8: +0/+1 = tile, +2 = col, +3 = row;
`camp-scene.md:45`, `demo-scene-data.md:59`). El bebedor la escribe para el actor activo.

### Purple (color 5) — CAST.OVL 0x14a0
```
14a0: cmp g_location, 0x7f ; jbe 0x14d2   ; fuera de combate → "\nNo noticeable effect now!"
14a7: print "Poof!" (DS 0x4739)
14ae: si = tile-idx del actor (byte[actor-0x45e8]) ; addr = 0x5c5a + si<<3 → [bp-4]
14ca: byte[addr] = byte[addr+1] = 0x90     ; DISPLAY TILE → 0x90
```
**Tile 0x90 = RATA** (`combat.md:467` "ratas (0x90)"). ⇒ Purple = **polimorfia a rata**
(el clue book acierta: "Purple=polimorfia"). Es un cambio de sprite COSMÉTICO: SOLO toca
el tile de display, NINGÚN stat/flag/comportamiento. No hay timer → persiste todo el combate.

### Black (color 6) — CAST.OVL 0x14dc
```
14dc: cmp g_location, 0x7f ; jbe 0x14d2   ; fuera de combate → "\nNo noticeable effect now!"
14e3: or byte[actor-0x45ea], 0x10          ; SET FLAG 0x10 = INVISIBLE
14fc: print "Invisible!" (DS 0x4740)
1506: byte[addr] = byte[addr+1] = 0x1d      ; DISPLAY TILE → 0x1d (blanco/invisible)
```
Flag 0x10 = el bit de invisibilidad que el port YA modela (`Combatant.invisible`):
- Ring of Invisibility (`combat.ts:388`), Sanct Lor (`combat.ts:1520 cur.invisible=true`).
- Targeting: `combat.ts:1885` los invisibles NO son seleccionables salvo el Shadowlord
  (type 0x2f, "ve invisibles", COMBAT:0x0D30). Render: `combat.ts:1578` no los pinta.
- Wis Quas (`combat.ts:1789`) limpia invisible SOLO de NO-jugadores ⇒ la invisibilidad de
  poción del PJ NO se disipa con Wis Quas: **persiste todo el combate** (sin timer). Fiel.

⇒ **Black = `cur.invisible = true`** reusa toda la infraestructura existente. **Purple =
rata** exige un override de tile de display en el Combatant (cosmético).

## Cableado en el port
- `handleCombatKey` (main.ts:1134) es el bucle de comandos de la arena (ya tiene (A)ttack,
  (C)ast, (K)…). Añadir 'u' → item picker → bebedor con `location = arena (>=0x80)`,
  objetivo = `combat.currentUnit` (el PJ activo). Gate: sólo si el turno es de un PJ (el
  port ya exige `cur.kind === "player"`; equivale al bit 0x80).
- Efectos: reusar `applyPotionEffect(target, color, rng, location>=0x80)` del carril
  anterior. Black → `cur.invisible=true`. Purple → override de tile (nuevo campo).
- Expiración: NINGUNA (persisten hasta fin de combate) — derivado (sin timer en el handler).

⚠ Paridad de combate: beber consume 1 rand SOLO en Yellow (applyMani rand30) y en la
reroll (2 rands: rand(0,15) + posible rand(0,7)). Mismo `combat.rng` stream. Punto exacto:
tras elegir (U)se, ANTES de aplicar el efecto (equivale a 0x13a1 del binario).

## FASE 3 — PERGAMINOS en la arena (carril scrolls-arena)

El mismo item picker de combate (código 5, `item_page_controller` modo 'U') lista la tabla
EXTENDIDA: **scrolls 0-7 + potions 8-0xf**. El port sólo listaba pociones; ahora lista ambos
(`openCombatUsePicker` filtra `potion|scroll`). El lector es CAST 0x11de (mismo que (U)se
overworld), y `readScroll(state, idx, 0x80)` YA modela los gates por `location` — en combate
(loc>=0x80) el comportamiento por scroll, verificado instrucción a instrucción en
`re/disasm/CAST.OVL.asm` (0x11de-0x1350):

| idx | scroll | en COMBATE (loc>=0x80) | offset |
|-----|--------|------------------------|--------|
| 0 | Vas Lor | "Light!" + luz 240 (aplica, sin gate) | 0x120a |
| 1 | Rel Hur | "Wind change!" + getdir SIN efecto (loc>=0x21 → result=0) | 0x1222 |
| 2 | In Sanct | "Protection!" + `g_time_spell='P'`/100 (aplica) | 0x124a |
| 3 | In An | "Negate magic!" + `'N'`/20 (aplica; el motor lee 'N' = negate) | 0x1264 |
| 4 | In Quas Wis | "View!" + **"Not here!"** (gate loc>0x7f, 0x1284) | 0x1278 |
| 5 | Kal Xen Corp | "Summon Daemon!" + **SUMMON** (gate loc<=0x7f→Not here!, 0x12bb) | 0x12b4 |
| 6 | In Mani Corp | "Resurrection!" + **"Not here!"** (gate loc>=0x80, 0x12df) | 0x12d8 |
| 7 | An Tym | "Negate time!" + `'T'`/20 (aplica; el motor lee 'T' = time-stop) | 0x1300 |

Globales sobre `state.timeSpell`/`lightSpellMins` (readScroll) → el motor de combate los LEE
de `this.opts.state` (combat.ts: 'N' 0x0928, 'T' 0x0846/0x1912, 'C' confusión). El scroll se
CONSUME siempre lo primero (0x11ec) y el (U)se gasta el turno (playerCast).

### Kal Xen Corp del PERGAMINO = SIEMPRE ALIADO (CAST2 0x04c2, arg 1)

Pieza gorda. El summon (CAST2 0x04c2) recibe un arg que distingue scroll (1) de cast (0):
```
04cf: cmp [bp+4], 0 ; jne → anim 5 (else anim 8)
0594: cmp [bp+4], 0 ; jne 0x5c0   ; arg!=0 (SCROLL) → SALTA el contest, rama ALLY directa
059a-05be: (arg==0, CAST) contest: al=g_cmb_actor; call 0x58de (rand30); if rand30<INT → ally,
           else print DS 0x9532 (hostil) + result=0xffff
05c0: or byte[actor-0x45ea], 1   ; FLAG 0x01 = aliado (bando party) = `Combatant.charmed`
```
⇒ **El pergamino salta el contest → daemon SIEMPRE aliado, y NO consume el rand30**. El Cast
(Kal Xen Corp hechizo) SÍ tira el contest `rand30()<INT`. Diferencia de PARIDAD load-bearing:
el scroll gasta un rand MENOS. Portado: `castSummonDaemon(caster, alwaysAlly)` + efecto
`{kind:"summonDaemon", alwaysAlly:true}` desde el scroll. El spawn: monstruo 0x26 (Daemon) en
celda libre; el ASM reintenta hasta 8 veces (0x04e6-0x0521) con un buscador de celda
(`0xffff9cb6`) — el port usa `randomBoardCell` de un tiro (Clase-C compartida con el cast; el
conteo exacto de rands por intento es kernel-opaco → witness de oráculo si se quiere paridad
byte-exacta de la POSICIÓN).

⚠ Simplificaciones Clase-C: (a) Rel Hur en combate omite el prompt getdir (sin consecuencia
observable: no hay viento en loc>=0x21); (b) si "Not here!"/no-efecto consumen el turno igual
que un scroll aplicado — modelado como que SÍ (el (U)se se realizó); (c) el retry/posición del
summon (arriba).
