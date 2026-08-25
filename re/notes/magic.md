# Magia exacta: CAST.OVL + CAST2.OVL (Task 3.3)

Re-derivación EXACTA del subsistema de magia desde el desensamblado.
Direcciones: `CAST.OVL` fileoff (load_seg 0x0BF8, base CS 0xBF80);
`CAST2.OVL` fileoff (load_seg 0x0E1E, base CS 0xE1E0). Convención pascal:
el PRIMER push es el argumento de la izquierda. `rand(lo,hi)` =
`rng_rand_range` kernel 0x2092 (ambos inclusive, re/notes/rng.md);
`rand0(n)` = kernel 0x3AAE; `rand30()` = kernel 0x3ABE (1..30).

Port: `game/src/core/magic/{cast,tables}.ts`. Material de derivación del
scout: `.superpowers/sdd/task-3.3-derivation-draft.md` +
`task-3.3-cast2-handlers.md` (48 hechizos con citas). Este documento
recoge lo VERIFICADO instrucción a instrucción y lo portado.

## 0. Dispatcher del comando Cast — CAST:0x0dba

Verificado en `re/disasm/CAST.OVL.asm` (0e0a-0f1a). Orden EXACTO:

```
0e0a: CIRCLE = spellIndex/6 + 1                          ; idiv 6, inc
0e1a-0e8e: GATE DE UBICACIÓN (tabla DS:0x1C90[idx], 1 byte, 4 bits):
      loc==0 exterior→bit 0x08 · 1..0x20 pueblo→0x04 ·
      0x21..0x7F mazmorra→0x02 · >=0x80 combate→0x01
      loc==0x12 && g_crown(DS:0x57B4)==0 [= SIN corona] o loc==0x1D → "Absorbed!" (0x4624)
      ⚠ POLARIDAD (corregido 2026-08-07, cast-dispatch-48-brazos §4): antes decía
        «loc==0x12&&crown», que se lee como CON corona. El binario es
        `0e45: cmp byte [0x57b4],0` + `je 0e53` ⇒ absorbe cuando g_crown==0. Coincide
        con overworld-b34-regalia.md §3c, que ya lo tenía bien para el gate GEMELO de
        combate (COMBAT.OVL 0x0936). El gate es DOBLE: combate y este de fuera-de-combate.
      ⚠ las dos ramas Absorbed! sólo son alcanzables con loc en 1..0x7F (van detrás del
        `jbe 0x7f` y delante del reparto pueblo/mazmorra), y la de 0x1D no comprueba nada.
      bit ausente → "Not here!" (0x462F) + flash y salir
      ⚠ Absorbed! y Not here! salen por 0x11d9 (el `pop si` del epílogo), NO por la cola
        0x11a6: se saltan el `mov ax,[bp-6]` y devuelven el ax de la última llamada.
0ebb: si g_spell_qty[idx]==0 (DS:0x57F0) → "None mixed!" (0x463A), salir SIN consumir
0ec8: dec g_spell_qty[idx]                               ; CONSUME antes del check de maná
0ed3: MP = [caster*32+0x55B7]; si MP<CIRCLE → PRINT "M.P. too low!" (0x4647,
      call 0x58d0), result([bp-0xa])=0, jmp TAIL 0x11a6  ⚠ hechizo YA consumido
0ef8: MP -= CIRCLE                                       ; COSTE DE MANÁ = CÍRCULO
0efc: result([bp-0xa]) = 0xFFFF                          ; valor por defecto pre-gate
0f01: si LEVEL[caster*32+0x55BE] < CIRCLE → 0f0a jb 0xee5: result=0, jmp TAIL 0x11a6
      ⚠ el GATE en sí NO imprime, pero cae al tail con result=0. GATE DE NIVEL.
0f17: jmp cs:[idx*2 - 0x2f3a]                            ; jump table 48 words, fileoff 0x1146
```

### TAIL común del dispatcher — CAST:0x11a6 (epílogo compartido)

Verificado en `re/disasm/CAST.OVL.asm` (0x11a6-0x11dd, REALINEADO: el barrido lineal
se desincroniza sobre el salto; las instrucciones reales son las de abajo). TODO cast
—éxito o fallo de gate— pasa por aquí y despacha sobre el flag `result` = `[bp-0xa]`:

```
11a6: cmp word [bp-0xa], 1     ; result == 1 ?
11aa: jne 0x11b6
11ac: push 0x4656 ; call 0x58d0 → PRINT "Success!"   ; result==1
11b3: jmp 0x11d6
11b6: cmp word [bp-0xa], 0     ; result == 0 ?
11ba: jne 0x11d6
11bc: push 0x4660 ; call 0x58d0 → PRINT "Failed!"    ; result==0 (+ flash call 0x842e)
11d6: ret
```

Strings verificados directamente en `original/u5/play/DATA.OVL` (fileoff = DS+0x10,
cabecera OVL): 0x4656="Success!", 0x4660="Failed!", 0x4647="M.P. too low!".
- **result==1** → "Success!"  · **result==0** → "Failed!" (+flash) · **result==0xFFFF** (u
  otro) → NADA. Los handlers GLOBALES (In Lor, muros, viento…) dejan el default 0xFFFF ⇒
  éxito SILENCIOSO; los TARGETED (heal/cure/awaken/resurrect) fijan 1/0 ⇒ Success!/Failed!.
- Los DOS gates de fallo (maná 0ed3, nivel 0f01) fijan result=0 ⇒ el tail imprime
  **"Failed!"**. El de maná ADEMÁS imprimió antes su propia línea "M.P. too low!".

Divergencias que esto corrige en el clon (todas portadas):
- **Consumo ANTES del maná** (0ec8 vs 0ed3): un intento sin maná gasta el
  hechizo mezclado igualmente.
- **Coste = círculo** (idiv 6 en 0e0a; sub en 0ef8).
- **Gate de nivel NO silencioso** (corrección 2026-07-18, hilo cast-echo hallazgo-2): el
  gate 0f01 no imprime en su sitio, pero pone result=0 y cae al tail 0x11a6 → **"Failed!"**.
  (Antes esta nota decía "salir SILENCIOSO"; ERROR: sólo el GATE calla, el tail imprime.)
- **Maná insuficiente = DOS líneas**: "M.P. too low!" (0ede) + "Failed!" (tail).
- **Ventana temporal table-driven** (DS:0x1C90), no strings del JSON.

En el port, castSpell devuelve el `message` propio del fallo (p.ej. "M.P. too low!") y la
señal `consumed`; el "Failed!" del tail lo emite el llamador (main.ts) con `!ok && consumed`
—como el resto del tail Success!/Failed! de los efectos con objetivo.

### Tabla DS:0x1C90 (48 bytes, ventana temporal)
```
0e 01 0f 0f 0f 05 0f 01 08 08 01 0f 0e 01 03 03 03 09 03 0f 03 02 02 01
01 05 05 0f 01 0f 01 01 0f 0c 01 01 01 01 01 0e 01 01 0e 01 01 01 0e 0f
```
Bits: 0x08 exterior · 0x04 pueblo · 0x02 mazmorra · 0x01 combate. Portada
verbatim en `tables.ts:TIME_PERMITTED_BITS`.

## 1. Ataques directos — CAST:0x0032(weapon)

`g_cmb_weapon=weapon; call COMSUBS:0x0C52` → reutiliza el motor de combate
completo (acierto, armadura). Daño = **attackValues[weapon]** (DS:0x15FC),
NO círculo·6:
- Grav Por → weapon 0x30 → attackValues[0x30]=16 → rand(1,16).
- Vas Flam → weapon 0x31 → 30 → rand(1,30).
- Xen Corp → weapon 0x32 → 99 → muerte instantánea (ignora armadura).
Confirmado en `game/assets/data.json` (attackValues[0x30..0x36] =
16,30,99,18,0,21,0). El clon devuelve `{kind:"combatAttack", weaponId}`
para que el motor de combate (Task 3.2) lo resuelva con su propio RNG.

## 2. Muros de campo — CAST:0x004c(arg 0..3)

Fuera de combate: celda de enfrente = `tile = (old&8) | FIELD_TILE[arg]`,
FIELD_TILE=DS:0x4596={0x82,0x81,0x80,0x83} (fuego/veneno/sueño/energía).
En combate: `g_cmb_weapon = COMBAT_WEAPON[arg]`, DS:0x4592={0x35,0x33,0x34,
0x36} → siembra el campo. arg: 0=In Flam Grav,1=In Nox Grav,2=In Zu Grav,
3=In Sanct Grav. Portado como `{kind:"fieldWall", arg, overworldTile,
combatWeapon}`.

## 3. Curación / estado a 1 PJ

Layout del record (base 0x55A8+slot·0x20): +0x0A clase, +0x0B status,
+0x0E int(=maxMP), +0x0F MP, +0x10 HP(word), +0x12 maxHP(word), +0x14
exp(word), +0x16 nivel. (docs/formats/tlk-npc-dataovl-gam.md §4.)

- **Mani** (CAST2:0x03c2): `HP = min(HP + rand30(), maxHP)`; no cura 'D'.
  El clon fijaba 25 → CORREGIDO a rand30() (1..30). `applyMani`.
- **Vas Mani** (CAST:0x08ac): `HP = maxHP`; no cura 'D'. El clon fijaba 50
  → CORREGIDO a curación total. `applyVasMani`.
- **An Nox** (CAST:0x01ae): status 'P'→'G' sólo si envenenado. `applyCure`.
- **An Zu** (CAST:0x0114): status 'S'→'G' sólo si dormido. `applyAwaken`.

## 4. Estados temporales globales — CAST2:0x08f8(status, dur, circle)

`g_time_spell (DS:0x587A) = status; g_time_spell_turns (DS:0x588E) = dur`.
**Un ÚNICO global**; cada lanzamiento pisa al anterior. Duración en turnos:

| hechizo | status | dur |
|---------|--------|-----|
| In Sanct (protección) | 'P' 0x50 | 20 |
| Rel Tym (quickness) | 'Q' 0x51 | 30 |
| Quas An Wis (confusión) | 'C' 0x43 | 20 |
| In An (negate magic) | 'N' 0x4E | 10 |
| An Tym (time stop) | 'T' 0x54 | 10 (inline CAST:0x0d4c) |

El clon usaba `In_Sanct turns:100`; CORREGIDO a P/20 en el global único.
`tables.ts:TIME_STATUS`.

**An Tym — precondición NO modelada** (CAST:0x0d4c 0d60-0d9b): antes de fijar
'T'/10, el handler recorre la tabla de objetos (DS:0x5C5A, 32×8) y si ALGÚN
objeto tiene `tile == 0xFC` imprime "Magic absorbed!" (DS:0x45F2) + msgbox
(0x6212) y FALLA sin aplicar el time-stop — con maná y hechizo YA gastados por
el dispatcher. ⚠ PREGUNTA ABIERTA: ¿qué objeto es tile 0xFC? (candidato:
moongate/campo/objeto especial de mapa). El clon no lo modela (requiere el
modelo de objetos de mapa/combate); se cierra en la integración de mundo/combate.

## 5. Luz — CAST2:0x08ea(mins)

`g_light_spell_mins (DS:0x58A6) = arg`. In Lor 100, Vas Lor 255. **MINUTOS**,
escribe (no suma). El clon usaba turns:100/200 → CORREGIDO.

## 6. Resurrección — In Mani Corp, CAST2:0x05e0(slot, mode)

Verificado en `re/disasm/CAST2.OVL.asm` 05fd-06be:
```
05fd: si status != 'D' → (mode!=0: "Not dead!") return 0
0629: status = 'G' ; 062d: HP = 1
0632: clase: 'A'/'M' → MP=int(+0x0E) ; 'B' → MP=int>>1 ; otra → MP intacto
064e: si karma<0x62(98): exp = exp*karma/100  (mul 0x2262 / div 0x22b6)
0680: cx=exp/100; dx=1; while(cx>0){dx++; cx>>=1}   ; nivel = bitlength(exp/100)+1
06b3: nivel = dx ; 06bb: maxHP = 0x1E(30)·nivel
```
⚠ La prosa del draft ("floor(log2(exp/100))+1") está off-by-one; el BUCLE
da `bitlength(exp/100)+1` (cx=0→1, cx=1→2, cx=3→3, cx=5→4). Portado el
bucle tal cual en `tables.ts:resurrectionLevel`. `applyResurrect`.
**Nota**: maxMP = int (record+0x0E); el clon guarda `intelligence`.

## 7. Otros efectos (portados como descriptor; asm-derivados)

- **In Lor/Vas Lor** luz (§5). **In Xen Mani**: food += rand(1,3) cap 9999.
- **Kal Xen** (CAST:0x04b0): tipo por rand(0,15): <6→0x14,<0xB→0x16,
  <0xE→0x15,else 0x22. `kalXenSummonType`.
- **In Bet Xen**: hasta 4 enjambres 0x1F aliados. **Kal Xen Corp**
  (CAST2:0x04c2): 1 Daemon 0x26; contest rand30()<INT → aliado/hostil.
- **Rel Hur** (CAST2:0x040a): lee flecha (1=O,2=E,3=N,4=S,Space=0) → remap
  `ARROW_TO_WIND[dir]` {0,4,3,1,2} → g_wind (DS:0x5892). Sólo exterior.
- **In Vas Por Ylem** (terremoto): rand(1,20) a cada enemigo + XP.
- **An Ex Por** (#25, CAST:0x1020 → sub 0x846): SELLA la puerta enfrente —
  getdir + efecto, y sobre el tile 0xB8/0xB9→0x97, 0xBA/0xBB→0x98; NO consume
  skull key. **In Ex Por** (#26, CAST:0x1026): 🔴 **CORREGIDO 2026-08-07 — SÍ ABRE
  PUERTAS.** Este párrafo decía «getdir + animación de casteo (efecto 5) y NADA MÁS —
  NO abre puertas ni toca g_skull_keys». **Falso.** La primera instrucción del brazo es
  `call 0xffffc16e` → stub `0x80ee` → **`CAST2.OVL:0x0768`**, que escribe `0x97→0xB8` /
  `0x98→0xBA` en el mapa vivo: **el MISMO worker que usa la Skull Key** desde
  `CAST:0x18dd`. **Un worker, DOS llamadores.** Lanzable en pueblo y combate
  (máscara `DS:0x1c90` = `0x05`). El «efecto 5» es sólo el `ax=5` que el brazo pasa a
  la cola `0xf2a`, **que nadie ha leído todavía**. Y el `0xffffc186` que se citaba
  como la anim **no está en `0x1026-0x1037`**: resuelve a `CAST2.OVL:0x0000` y aparece
  34 veces en el fichero, ninguna en ese rango.
  ★ **«y NADA MÁS» no es propiedad del rango leído: es propiedad del CALLEE.** El rango
  `0x1026-0x1037` estaba bien citado; lo que faltó fue abrir el callee.
  Derivación: `inexpor-dos-llamadores-acta.md`.
  Las skull doors se abren **también** con **(U)se → Skull Key** (CAST:0x18c4,
  rama del dispatcher de (U)se item → 0x97→0xB8 / 0x98→0xBA;
  ver `game.ts::useSkullKey`) — esa mitad sigue siendo correcta.
- **Blink, An Ylem (POOF), An Sanct, An Grav (disipa), Wis Quas,
  An/In Quas Corp (repele/miedo),
  An Xen Ex (charm), Rel Xen Bet (polymorph rata), Sanct Lor
  (invisibilidad), In Wis (peer), Wis An Ylem (death vision: kernel 0x5D0A
  rellena buffer DS:0xAB02 con 0xFF), Vas Rel Por (gate travel), Uus/Des
  Por (mazmorra ±1 nivel)**: descriptor de efecto con parámetros exactos;
  su aplicación al mapa/combate pertenece a la integración de mundo/combate.
- **Hechizos de LÍNEA** (CAST:0x1f60): In Zu(mode1,len2), In Nox Hur(2,1),
  In Flam Hur(3,2), In Vas Grav Corp(4,1). Traza Bresenham; por celda:
  mode1 dormir (contest INT), mode2 veneno, mode3 daño ~rand(1,30),
  mode4 muerte 99 (contest INT). `{kind:"lineAoe", mode, len}`.

## 8. Estado de verificación

- **asm + spot-check disasm**: dispatcher (§0, orden completo verificado en
  0e0a-0f1a), attackValues (§1), resurrección (§6, bucle de nivel corregido).
- **asm-derivado (scout, alta confianza) + tests unitarios del clon**: el
  resto de §1-§7. Paridad RUNTIME contra el binario: harness en
  `re/tools/magic_parity.py` (pura siempre; live opt-in U5RE_LIVE=1),
  escenarios en `re/parity/magic/`. Ver re/verified/magic.md para qué
  está runtime-verificado y qué queda ⚠ pendiente.
