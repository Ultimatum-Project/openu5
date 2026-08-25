# Lote D — witnesses de runtime (carril oráculo, RELEVO 2026-07-18)

Continúa `lote-D-witnesses.md` (predecesor). Capturas contra oráculo headless propio
(run-dir `/private/tmp/<oracle-rundir>-batch-446857`, JAMÁS `original/u5/play`). Cada
sección adjudica un fleco del `asm-frontier-plan.md §LOTE D`.

## Obj 2 — LOS-opacity (`0x6a14`) vs passability (`0x54d4`): **TABLAS DISTINTAS** · ADJUDICADO

`combat-spells.md:201` marcaba **pendiente el volcado de los 32 bytes** de estos
bitmaps (no están en el disasm de código, sólo en el DS del binario). Volcados EN VIVO
(overworld, `read_mem_gameseg`):

```
passability  DS:0x54d4 = 70 0c 00 28 01 f3 00 bd 72 3f ff ff ff cf ff ff  ← bitmap 32B
                         fc f6 0f ff ff fc 7f ff 7f 03 ff ff 3f ff ff be
LOS-opacity  DS:0x6a14 = ff f3 c3 8f ff ff ff c0 dd f8 03 df ff ff 00 00  ← bitmap 32B
                         ff ff ff ff ff ff ff 3f ff ff ff fe ff ff ff ff
light-opac   DS:0x6a86 = 09 0a 0c 0d 4d 4e 4f 5a 97 b8 b9 bc d0 d1 d2 d3 f8 fe ff  ← LISTA 19 (memchr)
radial 6x6   DS:0x6aa8 = 32 29 22 1d 1a 19 · 29 20 19 14 11 10 · 22 19 12 0d 0a 09
                         · 1d 14 0d 08 05 04 · 1a 11 0a 05 02 01 · 19 10 09 04 01 00
```

> **⚠ §Obj 2 SUPERADO EN SU POLARIDAD Y EN SU CENSO DE CALLERS (2026-07-30, auditoría general
> 30-07 ALTA-4).** Los BYTES volcados aquí son buenos y se siguen usando; lo que está mal es el
> sentido del bit de `0x6a14` y, colgando de él, los rótulos de los dos conjuntos y el
> «Recordatorio» del final. **En `0x6a14`: bit SET = TRANSPARENTE (210) · bit CLEAR = OPACO
> (46)** — derivado del consumidor (kernel `0x3f6e` devuelve 1 con el bit PUESTO; `CAST.OVL
> 0x1dfb: or ax,ax; je` manda el 0 a PARAR; y el brazo de fuera-de-tablero de `0x1bb0` devuelve
> 0, que fuera del tablero sólo puede querer decir «corta»). En consecuencia: «bloquean paso
> PERO transparentes» son en realidad **opacas Y bloqueantes**, y «opacas pero pisables» son
> **pisables Y transparentes**. Además, `0x3f6e` **no tiene un único caller**: son **DOS**
> (`CAST.OVL 0x1c28` + `COMSUBS.OVL 0x142a`), y el trazado de proyectil de combate es de
> `0x6a14`, **no** de `0x5dfe`/`0x6a86` (los 2 call-sites de kernel `0x5DFE` son `0x5bfe` y
> `0x5cb4`, ambos del flood del viewport). El veredicto de esta sección —**son tablas
> SEPARADAS**— NO se toca: sigue en pie con la polaridad corregida. Derivaciones:
> `proyectil-los-0x6a14-derivacion.md` y `los-passability-audit.md` (banner de 2026-07-30).
> Se conserva el texto de abajo como registro.

Ambos predicados (kernel `0x2bd4` passability, kernel `0x3f6e` LOS) usan la MISMA
mecánica de bitmap ~~`bloquea ⟺ bit (0x80>>(tile&7)) de bm[tile>>3]`~~ — la MECÁNICA sí es la
misma (`bit = (0x80>>(tile&7))` de `bm[tile>>3]`, MSB), el SENTIDO no (⚠ 2026-07-30). Aplicada
byte a byte a los 256 tiles:

- **passability bloquea 182 tiles**; **LOS ~~opaca a~~ deja TRANSPARENTES 210 tiles** (⚠ 2026-07-30).
- **Bloquean paso PERO transparentes a LOS (39 tiles)** ~~rótulo invertido; son **opacas Y
  bloqueantes**~~ (⚠ 2026-07-30): `0c 0d 1a 3a 3b 3c 3d 3f 42
  46 4d 4e 4f 50 51 52 53 54 55 5a 70 71 72 73 74 75 76 77 78 79 7a 7b 7c 7d 7e 7f b8
  b9 df` (~~agua, mobiliario bajo, campos… se ven a través pero no se pisan~~).
- **Opacas a LOS pero se pueden pisar (66 tiles)** ~~rótulo invertido; son **pisables Y
  transparentes**~~ — y el CARDINAL está mal: la lista de abajo tiene **67** entradas, no 66
  (⚠ 2026-07-30). **La LISTA, en cambio, es la buena**: recomputada hoy contra la tabla de
  pasabilidad canónica `DATA.OVL @0x54e4`, sale idéntica tile a tile (67/67). Dicho de otro
  modo: `los-passability-audit.md` acertó al corregir el 66→67 pero se equivocó al declarar
  «erratas de transcripción» en esta lista, y la sustituyó por una recomputada contra el
  volcado EN VIVO de aquí arriba, que está CORRUPTO en `0xa8-0xe7`. Lista buena, la de aquí:
  `00 04 05 06 07 08 09 0a 0b 0e 0f
  10 11 16 17 18 1d 1e 1f 20 21 22 23 24 25 26 2c 2d 30 31 32 33 34 35 36 37 39 40 44
  45 47 48 49 6a 6b 86 87 8c 8f 90 91 92 93 aa ab ac bc c4 c5 c6 c7 c8 c9 dc dd f9 ff`.
- Ambos (muro sólido): 143 tiles.

⇒ **VEREDICTO: opacidad-LOS y passability son tablas SEPARADAS con divergencias en
ambos sentidos** — confirma la nota (`combat-spells.md §6`) con los bytes reales. NO
son el mismo predicado; cablear una en lugar de la otra sería infiel. (Recordatorio ⚠
**CORREGIDO 2026-07-30 — decía dos cosas falsas**: `0x3f6e`/`0x6a14` es LOS de
apuntado de hechizos de línea/área **Y del vuelo del proyectil de combate**,
~~único caller `CAST:0x1c28`~~ **DOS call-sites: `CAST.OVL 0x1c28` + `COMSUBS.OVL 0x142a`**;
~~el combate usa `0x5dfe`/lista `0x6a86`~~ **el combate a distancia usa `0x6a14`; `0x5dfe`/
`0x6a86` es SÓLO el flood de luz del viewport, cuyos 2 call-sites son `0x5bfe` y `0x5cb4`**;
y el paso usa `0x2bd4`/`0x54d4`. Tres subsistemas, tres tablas, ahora volcadas — pero **dos
consumidores en la de LOS**, no uno.)

## Obj 1 — entrada de combate: la línea real es **"Attacked!"** (enemy-init) / grupo + "+++ CONFLICT +++"; **"{name} attacks!" del port es FABRICADO** · ADJUDICADO

> **CORRECCIÓN + IMPLEMENTADO (2026-07-18, carril fiel/combat-intro-ui):** el banner NO es
> "+++ CONFLICT +++" (transcripción a ojo de la captura) — es **"*** CONFLICT ***\n"**
> (ASTERISCOS), byte-verificado en DATA.OVL DS 0xa438. La secuencia entera está cableada en
> el port: `startCombat` emite <pre-línea> → **grupo CENTRADO** (`monsterNamesUpper[index]`,
> ancho-16 → "GIANT RATS"→"   GIANT RATS") → **"*** CONFLICT ***\n"** → combat-started.
> Las 3 vías (player/enemy/camp) comparten grupo+CONFLICT tras su pre-línea. El
> "{name} attacks!" fabricado se purgó en el carril fiel/attacked-fix (d759792).

`camp-ambush-resolution.md` punto 4 dejaba como residual de runtime si la entrada de
combate kernel-residente `0xdf80` añade "{name} attacks!" (hipótesis de
`asm-frontier-plan.md:187`). Cerrado con **DOS capturas** — las dos vías de encuentro
overworld — atacando/encontrando Giant Rats:

**Vía A (player-initiated, atacar):**  (`combat_entry_live/settled.png`)
```
>Attack-East          ← eco del comando de overworld
   GIANT RATS         ← identificación del grupo enemigo
+++ CONFLICT +++      ← banner de inicio de combate
Elwood, armed with Long Sword:   ← 1er turno del PJ
```

**Vía B (enemy-initiated, el errante pisa al grupo):**  (`enemy_initiated.png`)
```
>Pass                 ← turno pasado
Attacked!             ← ← la línea del encuentro enemy-initiated (SIN nombre)
   GIANT RATS         ← identificación del grupo
+++ CONFLICT +++      ← banner
Elwood, armed with Long Sword:
```

⇒ **U5 NUNCA imprime "{name} attacks!"** en ninguna de las dos vías. La línea del
encuentro enemy-initiated es **"Attacked!"** (literal, sin nombre); el **nombre del
enemigo aparece como línea de identificación de grupo** ("GIANT RATS"), seguida del
banner **"+++ CONFLICT +++"**. La emboscada de camp es la MISMA estructura con su
variante de pre-línea: **"Ambushed!"** (CMDS `0x0247`) en lugar de "Attacked!".

**HALLAZGO DE FIDELIDAD (accionable, ui-flow):** el port fabrica la intro
`tf("{} attacks!", def.name)` en **`game/src/core/game.ts:4736`** (rama no-suprimida de
`startCombat`). Esa cadena **NO existe en U5** — es infiel. Lo fiel:
- Encuentro overworld enemy-initiated → **"Attacked!"** (sin nombre) + identificación de
  grupo ("GIANT RATS") + **"+++ CONFLICT +++"**.
- Camp-ambush → **"Ambushed!"** (ya modelado) + grupo + CONFLICT. El `suppressIntro:true`
  del camp (`game.ts:4773`) es CORRECTO en espíritu (no repetir la pre-línea), pero
  suprime una cadena que de todos modos era inventada.
- El port debería (a) reemplazar `"{} attacks!"` por **"Attacked!"** (o el pre-texto
  correcto por contexto) y (b) considerar emitir la identificación de grupo +
  "+++ CONFLICT +++" como parte de la presentación de entrada a combate (Clase C /
  catálogo AV, task de UI de combate fiel). Esto encaja con `ui-flow-fidelity-gap`
  (paridad de mecánica ≠ presentación).

Residual mínimo: screenshot de una emboscada de camp REAL (≈10%/noche) para ver si
"Ambushed!" precede la identificación de grupo igual que "Attacked!" — captura a demanda,
no bloqueante (la estructura ya está probada por las vías A y B).

Capturas: `combat_entry_live.png`, `combat_entry_settled.png` (vía A),
`enemy_initiated.png`, `enemy_initiated_2.png` (vía B) — scratchpad del carril.

## Obj 4 — dissolve `0x0d72` vía muerte en combate: **NO dispara** · BANCO (dato negativo)

Con los 3 PJ a HP=1 (roster `0x55B8`, el HP vivo) y turnos pasados dejando que las ratas
ataquen, **`0x0d72` no picó en 200 resumes**. Confirma la lección del predecesor: el poke
de HP (aun a 1, aun con golpes de enemigos en combate) **no alcanza el game-over/dissolve**
por esta vía (el motor no registró party-wipe, o el game-over usa otra primitiva que el
helper de 7 líneas). Bancado por doctrina (2ª ventana sin caer). Candidatos que quedan
para naming a demanda: cartas de historia/lore del intro (el hit del predecesor en
resume 7, superficie sin identificar), recap/endgame. `probe_dissolve_death.py`.

## Obj 5 — `0x0f46` NO es un "fizzle": es **`gfx_blit_sel66`** (blit de imagen grande, SEL 0x66) · ADJUDICADO (estático-fuerte)

El nombre "fizzle" del backlog era una conjetura. `0x0f46` está **derivado byte-a-byte** en
`intro-blit-formats.md §1` (y censado en `kernel-sweep-4.md:222`, `intro-scene-tables.md:308`):
es **`gfx_blit_sel66`**, el blit de IMAGEN GRANDE a pantalla completa vía driver SEL 0x66.
Cuerpo (disasm real, entrada alcanzada solo por call — el barrido lineal la desincroniza):
```
0f46: push bp; mov bp,sp; push si; push di; push ds
0f4c: mov ax,[bp+0xa] / bx,[bp+8] / cx,[bp+6] / dx,[bp+4]   ; 4 args (x/y/w/h/subidx/ptr)
0f58: call 0x8e6                     ; marshalling a los globals de arg del driver
0f5c: mov word [g_snd_driver_fn], 0x66 ; SEL 0x66
0f62: lcall [g_snd_driver_fn]        ; → EGA/CGA/HER/T1K.DRV (blit de bloque grande)
```
El intro lo llama vía `0x8d86→0x0f46` para sus escenas full-screen 4bpp
(`intro.md:297`, `intro-scene-tables.md:308`). El "blit vs fizzle" no vive en un wrapper:
`0x0f46` SIEMPRE es el blit de imagen; el efecto de wipe/disolución (si lo hay) es del
propio SEL 0x66 dentro del `.DRV` (`drivers-drv.md §1-3`).

**Runtime (2 intentos, arnés headless EGA, ambos LIMPIOS y con 0 hits):**
1. BP en `0x0f46` armado tras `wait_kbd_poll`, dejando correr el intro-attract (200 resumes): **0 hits**.
2. BP armado JUSTO tras `boot()` (antes de la secuencia de logo/título, 280 resumes): **0 hits**.

⇒ El BP funciona (mismo mecanismo con que `ring_regen` picó 38×), así que los ceros son
datos reales: en los estados de intro/boot que el oráculo headless alcanza **no se invoca
SEL 0x66**. Interpretación (no forzada): el intro-attract que el arnés recorre pinta con
tiles/otras primitivas y el `Enter`-skip de `send_keys_until_main_menu` salta las escenas
full-screen ANTES de que blitteen, o el camino de intro de la build EGA usa otra ruta que
la analizada (posible VGA/upgrade). **Veredicto estático-fuerte:** `0x0f46 = gfx_blit_sel66`
(no "fizzle"); su trigger son escenas de imagen a pantalla completa (intro/endgame/story),
CONFIRMACIÓN de runtime pendiente de un escenario que las exhiba en el arnés — a demanda,
como la muerte-dissolve. NO se quema más ventana en esto (acuerdo con el lead).

## Obj 3 — flood `0x5a28` DISPARA en overworld + máscara viva leída · CONFIRMADO (parcial)

`kernel-flood-0x5a28.md §6` ya derivó la divergencia (el binario es Moore 8-conexo SIN
gate de flancos; el port gatea las diagonales → sub-revela la celda diagonal detrás de
una esquina). El witness pedido era confirmar que el flood corre y (idealmente) una
escena de esquina.

- **BP en `0x5a28` DISPARA en overworld** (2 hits en 30 resumes con movimiento), lo que
  confirma la rama `loc<0x80` (mundo/pueblo) — coherente con que el flood NO corre en
  combate (`combat-light-verdict.md`).
- **Máscara de visibilidad viva leída** de `0xab02` (11×11, stride 32): mayormente `ff`
  (celda plenamente visible/propaga, campo abierto de hierba) con un bloque 3×3 central
  de tiles vistos (`21 25 05 / 32 00 32 / 03 03 03`). Confirma la semántica de valores
  de §5 (0xff propaga / tileVal visto / 0x00 negro).
- **La confirmación de la diagonal-de-esquina** (celda diagonal con AMBOS flancos opacos)
  requiere geometría de esquina de muro (mazmorra/pueblo/castillo), no disponible en el
  campo abierto del spawn. Es la traza F3 / píxel-diff que la nota pide (`§6`, "parado en
  una esquina de muro con el hueco diagonal abierto"). Escenario dedicado, a demanda del
  carril de visibilidad; la divergencia YA está derivada estáticamente y el port
  sub-revela (lado seguro de la regla #2).

## Método / evidencia

Probes (scratchpad del carril): `probe_los_pass_dump.py` (obj 2 + flood obj 3),
`probe_combat_entry_text.py` (obj 1). Patrón: `oracle.boot()` →
`send_keys_until_main_menu()` → `exit_to_overworld`/`enter_combat` → volcado / captura.
`_foreign_dosbox()` chequeado antes de cada boot (sin dosbox ajeno vivo).

## Micro-probe (fuera de lote D, a pedido del lead) — OBJECT-ID de la alfombra = **0x1b (27)** · ADJUDICADO (estático)

Desbloquea `applySearchGrant` del carril de la alfombra. Resuelto por vía ESTÁTICA
(SJOG.OVL.asm, near_call_base=0xbf80; load_seg 0x0bf8 sin cabecera de reubicación).

**El id de la alfombra es `0x1b` (27).** Cita:
- `0x1756: cmp ax, 0x1b` → `jne 0x175e` → `0x175b: jmp 0x149e`.
- `0x149e` = rama alfombra: `0x14a5: inc byte ptr [g_carpets]` (el +1 carpet); `0x14a9-0x14b0`
  clamp a 99 (si ==0x64 → 0x63). ÚNICO ORIGEN DEL SALTO a esa rama **[vocabulario corregido por #173: `0x149e` es destino de `jmp` (ver dos líneas arriba, en SJOG CS 0x175b, el `jmp` a esta dirección), NO de `call` — llamarlo «caller» hacía el número incomprobable con cualquier herramienta de call-graph, que por eso devuelve 0]**.
- **PRECISIÓN (lead, a1ffbf2):** el grant (`inc g_carpets` + clamp) es **INCONDICIONAL** — va
  ANTES del `0x14b5: cmp byte ptr [g_location], 0x11`. El gate loc==0x11 (LB Castle) controla
  SOLO el **borrado del slot** del objeto buscado (`0x14bf: ax=0x16; call 0xffffbb92`, slot
  0x16=22). Con un único Carpet2 en los datos (loc 17, slot 22, (15,18) z2) es inobservable,
  pero el modelo exacto es: conceder siempre, borrar-slot solo en LB Castle. (Mi redacción
  previa "gateada en 0x14b5" era imprecisa.)

**Por qué el pattern-match del carril contra la jump-table no cuadraba:** la alfombra NO
está en la jump-table `jmp cs:[bx-0x2962]` (dispatch de ids 1-8 en `0x147d`, indexada con
`(id-1)*2`; sus 8 destinos son 0x1482/0x1620/0x163c/0x15c6/0x1670/0x1670/0x1568/0x153c —
ninguno es 0x149e). Vive en un **switch secundario por VALOR de object-tile**, al que se
entra por `0x1464: jmp 0x172e`: `cmp ax,0x19 / 0xd / 0xe / 0xf / 0x1b(→alfombra 0x149e) /
0xb4 / 0xb5(g_crown) / 0xb6(g_sceptre) / 0xb7(g_amulet_lb)`. Que 0xb5/0xb6/0xb7 sean
corona/cetro/amuleto confirma que `ax` es el object-tile id. El modelo "candidatos
{3,4,5} de la jump-table" no aplica.

**Doble check contra el port (ya usa 0x1b):** `game/src/core/world/transport.ts:414`
(`dropTile: 0x1b`) y `game/src/core/npc/manager.ts:92` (`case 27: // tile 283 Carpet2`).
Coherente. `applySearchGrant` debe conceder la alfombra cuando el object-tile == 0x1b (27)
en LB Castle (loc 0x11).
