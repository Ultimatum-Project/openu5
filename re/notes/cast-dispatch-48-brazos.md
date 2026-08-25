# `CAST.OVL:0x0dba` `cast_command_dispatch` — CUERPO ENTERO (1060 B) y los 48 brazos

Lectura completa de la fila `CAST.OVL:3514` (span `0x0dba..0x11de`, 1060 B), hecha
**descodificando la imagen** `original/u5/play/CAST.OVL` (mapa de bytes: los `.OVL` son
IDENTIDAD, `fileoff = start`), no el listado. La razón está en §1 y hay que leerla antes
que nada. Base CS del overlay = `0xBF80` (`CS = fileoff + 0xBF80`).

Cierra la lectura PARCIAL previa (cita `asm-cola-ui-parcial`, ~470 de 1060 B), que dejó
sin mirar `0x0e20..0x0ef8` y 41 de los 48 brazos. Ambas regiones están abajo.
La cabecera y la cola ya estaban derivadas en `magic.md §0`, y lo que había allí
**se confirma instrucción a instrucción** salvo una polaridad (§4).

## 0. Es UNA rutina, y el detector se corrió sobre la IMAGEN

Sobre los 1060 bytes de la imagen: **un solo prólogo** `55 8b ec` (en `0x0dba`, el propio
inicio), y el último byte del span es el `c3` de un epílogo limpio
(`8b 46 fa · 5e · 8b e5 · 5d · c3` = `mov ax,[bp-6]; pop si; mov sp,bp; pop bp; ret`) que
cierra EXACTAMENTE en `start+size`. La fila es una rutina, no un contenedor.

## 1. 🔴 EL LISTADO NO VALE AQUÍ, Y AHORA LA DERIVA ESTÁ MEDIDA

La tabla de saltos vive DENTRO del span (`0x1146..0x11a6`, 96 B), así que el barrido
lineal del `.asm` descodifica los DATOS como instrucciones. Cifras exactas, medidas
comparando los inicios de instrucción del `.asm` contra los dos decodificados:

- Contra un decodificado ingenuo «todo de corrido» del span: **445 líneas del listado vs
  445 instrucciones, cero desacuerdos**. Es decir, el listado es EXACTAMENTE eso: decodificar
  de corrido. No hay ninguna heurística que salve la tabla.
- Contra el decodificado CORRECTO (tabla tratada como datos): **55 líneas del listado no son
  inicio de instrucción real**, y **2 instrucciones reales no tienen línea en el listado**.
- La deriva **no se para al acabar la tabla**: arrastra exactamente **6 bytes / 2
  instrucciones** más allá, y **re-sincroniza en `0x11ac`**.

🔴 **Y esas dos instrucciones tragadas son justo la guarda de la cola.** El listado imprime
`11a5: d0837ef6 rol byte [bp+di-0x982],1` y `11a9: 01750a add [di+0xa],si`, que se comen
`83 7e f6 01` (`cmp word [bp-0xa],1`) y `75 0a` (`jne 0x11b6`). Quien lea el listado ve la
cola empezando en `11ac: mov ax,0x4656; push; call print_string` **sin guarda delante**, y
concluye que la cola imprime "Success!" INCONDICIONALMENTE. El peligro no es que el listado
decodifique basura: es que decodifica una afirmación distinta, más fuerte y plausible.

## 2. Los 48 brazos (tabla `0x1146`, 48 words, offsets CS)

Valores crudos `0xcea0`..`0xd0c0`. **Son offsets CS**: restando la ranura `0xBF80` caen en
`0x0f20`..`0x1140`, 48 de 48 dentro del cuerpo, 48 valores únicos. Quien compruebe la tabla
sin restar la ranura obtiene «0 de 48 dentro del cuerpo» —limpio y rotundo— y concluirá que
está mal descodificada; se equivocará.

Los brazos ocupan `0x0f20..0x1146` sin hueco: el último (idx 47) acaba justo donde empieza
la tabla. **La tabla se indexa por el índice CRUDO de hechizo (`[bp-2]`), NO por el círculo.**
El nombre de la columna «hechizo» sale de `MagicDefinitions.json` en orden de fichero, y el
emparejamiento se corrobora solo: 42=In Mani Corp llama a `resurrect_apply`, 43=Kal Xen Corp
a `summon_daemon_kal_xen_corp`, 47=An Tym a `an_tym_stop_time`. `res` = `[bp-0xa]`, el flag
que despacha la cola.

| idx | círc | hechizo | brazo | qué hace el brazo |
|---:|---:|---|---|---|
| 0 | 1 | In Lor | `0x0f20` | `push 0x64` → `light_spell_set` · `push 1` → `time_spell_jingle_xor_flash` · TAIL |
| 1 | 1 | Grav Por | `0x0f32` | `push 0x30` → `cmb_set_weapon_then_attack` (0x0032) · TAIL |
| 2 | 1 | An Zu | `0x0f3c` | `an_zu_awaken` (0x0114) → **res** |
| 3 | 1 | An Nox | `0x0f46` | `an_nox_cure_poison` (0x01ae) → **res** |
| 4 | 1 | Mani | `0x0f4c` | `mani_caster` (0x01fa) → **res** |
| 5 | 1 | An Ylem | `0x0f52` | `an_ylem_dissolve_tile` (0x0230) → **res** |
| 6 | 2 | An Sanct | `0x0f58` | `an_sanct_unlock_disarm` (0x02d2) → **res** |
| 7 | 2 | An Xen Corp | `0x0f5e` | `repel_undead_an_xen_corp` (0x043e) · TAIL — **NO toca res** |
| 8 | 2 | Rel Hur | `0x0f64` | `prompt_direction_seed_target` → `push ax; push 0` → `rel_hur_set_wind` · TAIL |
| 9 | 2 | In Wis | `0x0f72` | `in_wis_peer_coords` (0x04a4) · TAIL — **NO toca res** |
| 10 | 2 | Kal Xen | `0x0f78` | `kal_xen_summon` (0x04b0) → **res** |
| 11 | 2 | In Xen Mani | `0x0f7e` | `in_xen_mani_add_food` (0x05b4) → **res** |
| 12 | 3 | Vas Lor | `0x0f84` | `push 0xff` → `light_spell_set` · `push 3` → `time_spell_jingle_xor_flash` · TAIL |
| 13 | 3 | Vas Flam | `0x0f90` | `push 0x31` → `cmb_set_weapon_then_attack` · TAIL |
| 14 | 3 | In Flam Grav | `0x0f96` | `push 0` → `cast_field_wall` (0x004c) → **res** |
| 15 | 3 | In Nox Grav | `0x0f9e` | `push 1` → `cast_field_wall` → **res** |
| 16 | 3 | In Zu Grav | `0x0fa4` | `push 2` → `cast_field_wall` → **res** |
| 17 | 3 | In Por | `0x0faa` | `in_por_blink_teleport` (0x05dc) → **res** |
| 18 | 4 | An Grav | `0x0fb0` | `push 1` → `an_grav_dispel_field` → **res** |
| 19 | 4 | In Sanct | `0x0fba` | `push 0x50, 0x14, 4` → `time_spell_state_writer` · TAIL |
| 20 | 4 | In Sanct Grav | `0x0fcc` | `push 3` → `cast_field_wall` → **res** |
| 21 | 4 | Uus Por | `0x0fd2` | si `g_location==0x28` → **salta a 0x0ee5** (res=0 ⇒ "Failed!"); si no `push 4`→jingle · `push -1, 1`→`dng_change_level`; si ax≠0 → `dng_exit` · TAIL |
| 22 | 4 | Des Por | `0x0ffc` | si `g_location==0x28` → **salta a 0x0ee5** (res=0 ⇒ "Failed!"); si no `push 4`→jingle · `push 1, 1`→`dng_change_level`; si ax≠0 → `dng_exit` · TAIL |
| 23 | 4 | Wis Quas | `0x1014` | `wis_quas_reveal_invisible` (0x074c) · TAIL — **NO toca res** |
| 24 | 5 | In Bet Xen | `0x101a` | `in_bet_xen_swarms` (0x07b4) → **res** |
| 25 | 5 | An Ex Por | `0x1020` | `an_ex_por_seal_door_sub` (0x0846) → **res** |
| 26 | 5 | In Ex Por | `0x1026` | `magic_door_open_worker` → **res**; si res==0xFFFF → TAIL; si no `push 5` → `time_spell_jingle_xor_flash` · TAIL |
| 27 | 5 | Vas Mani | `0x103a` | `vas_mani_full_heal` (0x08ac) → **res** |
| 28 | 5 | In Zu | `0x1040` | `push g_cmb_actor, 1, [0x13b6]` → `line_aoe_apply_effect` (0x1f60) · TAIL |
| 29 | 5 | Rel Tym | `0x1054` | `push 0x51, 0x1e, 5` → `time_spell_state_writer` · TAIL |
| 30 | 6 | In Vas Por Ylem | `0x1062` | `push [bp-4]` (índice del caster) → `in_vas_por_ylem_earthquake` (0x091e) · TAIL |
| 31 | 6 | Quas An Wis | `0x106c` | `push 0x43, 0x14, 6` → `time_spell_state_writer` · TAIL |
| 32 | 6 | In An | `0x107a` | `push 0x4e, 0x0a, 6` → `time_spell_state_writer` · TAIL |
| 33 | 6 | Wis An Ylem | `0x1084` | `push 6` → jingle · `white_potion_xray_reveal_anim` · TAIL |
| 34 | 6 | An Xen Ex | `0x1092` | `an_xen_ex_charm` (0x09a0) → **res** |
| 35 | 6 | Rel Xen Bet | `0x1098` | `rel_xen_bet_polymorph_rat` (0x0a5c) → **res** |
| 36 | 7 | Sanct Lor | `0x109e` | `sanct_lor_self_invisible` (0x0afe) → **res** |
| 37 | 7 | Xen Corp | `0x10a4` | `push 0x32` → `cmb_set_weapon_then_attack` · TAIL |
| 38 | 7 | In Quas Xen | `0x10aa` | `in_quas_xen_clone_creature` (0x0b28) → **res** |
| 39 | 7 | In Quas Wis | `0x10b0` | `push 7`→jingle · si `g_location>=0x21` → `gem_view_8x8_iconic_floor_map`; si no `push g_party_x, g_party_y` → `gem_view_32x32` · TAIL |
| 40 | 7 | In Nox Hur | `0x10d4` | `push g_cmb_actor, 2, [0x13b4]` → `line_aoe_apply_effect` · TAIL |
| 41 | 7 | In Quas Corp | `0x10e6` | `in_quas_corp_mass_fear` (0x0c98) · TAIL — **NO toca res** |
| 42 | 8 | In Mani Corp | `0x10ec` | `prompt_on_who_select_member` → `push ax; push 0` → `resurrect_apply` → **res** · `draw_status_panel` · TAIL |
| 43 | 8 | Kal Xen Corp | `0x1100` | `push 0` → `summon_daemon_kal_xen_corp` → **res** |
| 44 | 8 | In Vas Grav Corp | `0x110a` | `push g_cmb_actor, 4, [0x13b2]` → `line_aoe_apply_effect` · TAIL |
| 45 | 8 | In Flam Hur | `0x111c` | `push g_cmb_actor, 3, [0x13ae]` → `line_aoe_apply_effect` · TAIL |
| 46 | 8 | Vas Rel Por | `0x112e` | `vas_rel_por_phase_gate` (0x0cf0) → **res**; si res≠0 → **`[bp-6] = 0`** (cambia el RETORNO de la rutina) · TAIL |
| 47 | 8 | An Tym | `0x1140` | `an_tym_stop_time` (0x0d4c) → **res** |

## 3. La región `0x0e20..0x0ef8` que faltaba — el GATE DE UBICACIÓN, entero

Es la prueba de ubicación de `magic.md §0`, y **el orden de las comparaciones importa**
porque las dos ramas «Absorbed!» se evalúan EN MEDIO, no al final:

```
0e1a: cmp byte [g_location 0x5893], 0   ; ¿EXTERIOR?
      jne 0e2c   →  test byte [bx+0x1c90], 8   ; bx = índice de hechizo
0e2c: cmp byte [0x5893], 0x7f
      jbe 0e3e   →  (si >0x7f) test byte [bx+0x1c90], 1        ; COMBATE
0e3e: cmp byte [0x5893], 0x12   ; ¿Palacio de Blackthorn?
      jne 0e4c
0e45: cmp byte [g_crown 0x57b4], 0
      je  0e53                  ; ★ ABSORBED si NO tienes la corona
0e4c: cmp byte [0x5893], 0x1d   ; ¿trono de LB?
      jne 0e74 ; si igual →  0e53   ; ABSORBED, SIN condición
0e53: print DS 0x4624 "Absorbed!" ; push 0x2648,1,0x6d60,0x3e8,2 ; call tone_sweep (K 0x2192)
      jmp 0x11d9   ; ★ SALE POR EL EPÍLOGO, NO por la cola 0x11a6
0e74: cmp byte [0x5893], 0x21
      jae 0e86   →  test byte [bx+0x1c90], 2    ; MAZMORRA (0x21..0x7f)
      si no      →  test byte [bx+0x1c90], 4    ; PUEBLO   (0x01..0x20)
0e8e: jne 0e95 ; si el bit NO está → [bp-0xc] = 0
0e95: si [bp-0xc]==0 → print DS 0x462f "Not here!" ; push 0x320,0x7d0,1,0x32
      ; call pcspeaker_glide (K 0x43ae) ; jmp 0x11d9  (TAMBIÉN por el epílogo)
```

Tres cosas que sólo se ven leyendo esta región:

1. **Las dos salidas de este gate (`Absorbed!` y `Not here!`) NO pasan por la cola común.**
   Saltan a `0x11d9` = el `pop si` del epílogo, saltándose incluso el `mov ax,[bp-6]` de
   `0x11d6`. El valor devuelto en esos caminos es **el `ax` que dejó la última llamada**
   (`tone_sweep` / `pcspeaker_glide`), no `[bp-6]`. Lo mismo vale para las tres salidas
   tempranas de la cabecera (`0x0ddf`, `0x0dfb`, `0x0e07`) y para la de `Absorbed!`.
2. **Las dos ramas «Absorbed!» sólo son alcanzables para `g_location` en 1..0x7f**: quedan
   detrás del `jbe 0x7f` y delante del reparto pueblo/mazmorra. Fuera de ese rango no existen.
3. La rama `0x1d` (trono de LB) **no comprueba nada**: absorbe siempre.

## 4. 🔴 POLARIDAD INVERTIDA en dos sitios: es SIN corona, no CON corona

El binario, en `0x0e45`, es `cmp byte [g_crown 0x57b4], 0` + `je` → la rama «Absorbed!»
se toma **cuando `g_crown == 0`**, es decir cuando NO tienes la corona.

- `magic.md` línea 22 dice `loc==0x12&&crown o loc==0x1D → "Absorbed!"` — se lee como
  «con corona». **Corregido en este mismo commit.**
- `game/src/core/magic/cast.ts:269` dice `loc==0x12 con corona`. Es un COMENTARIO
  (no cambia comportamiento), pero es el comentario que orienta a quien vaya a cablear el gate.
- La nota hermana `overworld-b34-regalia.md §3c` ya lo tenía BIEN («NO llevas la Corona
  (`g_crown==0`)») para el gate GEMELO de combate (`COMBAT.OVL 0x0936`). Es decir: el corpus
  se contradecía a sí mismo y el que estaba bien era el que nadie citaba.

**Y el gate es DOBLE**: `COMBAT.OVL 0x0936` (el (C)ast de combate, que `overworld-b34-regalia`
documenta) y ESTE, `CAST.OVL 0x0e3e`, el (C)ast de fuera de combate. Quien arregle uno solo
arregla la mitad.

## 5. 🔴 PORT-CHECK MEDIDO: `ctx.magicAbsorbed` no tiene NINGÚN productor

`game/src/core/magic/cast.ts` declara `magicAbsorbed?: boolean` (línea 49) y lo lee
(línea 273). `grep -rn "magicAbsorbed"` sobre TODO el repo (excluyendo `node_modules`
y `.git`) devuelve **4 aciertos, los 4 dentro de `cast.ts`**: declaración, lectura y dos
comentarios. **Cero escritores, en código y en tests.** El propio comentario dice «la
lógica de cuándo activarlo vive en la capa de mundo» — y ahí no está.

⇒ En el clon, el (C)ast **fuera de combate** en el Palacio de Blackthorn sin corona, o en el
trono de LB, **nunca da "Absorbed!"**: cae al gate de ventana temporal y sigue. El gate de
COMBATE sí está cableado (`combatCastAbsorbed`, `main.ts:2160`), así que la divergencia es
exactamente la mitad no-combate. No mueve stream (el binario sale antes de tocar el RNG y
antes de consumir el hechizo mezclado). **No he tocado `game/src`.**

Cabo menor del mismo sitio: `cast.ts:42` y `cast.ts:268` citan «CAST:0x0e37» para
«Absorbed!». `0x0e37` no es inicio de instrucción — cae dentro del `test byte [bx+0x1c90],1`
de `0x0e36`. Las direcciones reales son `0x0e3e` (el gate) y `0x0e53` (la impresión).

## 6. La cola común `0x11a6` y el índice sin camino de error

```
11a6: cmp word [bp-0xa], 1  ; jne 11b6  →  print DS 0x4656 "Success!" ; jmp 11d6
11b6: cmp word [bp-0xa], 0  ; jne 11d6  →  print DS 0x4660 "Failed!"
                                           push 0x320,0x7d0,1,0x32 ; call pcspeaker_glide
11d6: mov ax,[bp-6] ; pop si ; mov sp,bp ; pop bp ; ret
```

El `jbe` es SIN SIGNO: un índice negativo (0xFFFF) también cae fuera. `[bp-0xa]` («res»)
arranca en **1** (`0x0dd2`)… pero **no llega así al gate**, y ahí estaba el error de la
primera versión de esta sección.

> ⚠️ **ERRATA — 07-08, carril `asm-cast-dispatch` (segunda lectura independiente del span).**
> Esta sección decía: *«el gate de rango manda el fuera-de-rango a `0x11a6` con el 1 todavía
> puesto ⇒ un índice inválido imprime "Success!"»*, y encima construía una consecuencia sobre
> el hechizo nº 49 («si el lector devolviera 48, el jugador vería "Success!" sin efecto»).
> **Las dos cosas están RETIRADAS: son falsas.**

**Lo medido, tres canales.**

1. Descodificando la **imagen** desde un arranque independiente (`0x0eee`, para no heredar el
   sincronismo de nadie): `0efc: c7 46 f6 ff ff` = `mov word [bp-0xa], 0xFFFF`, **dieciocho
   bytes ANTES** del gate de rango que esta misma sección cita (`0x0f0f`).
2. **Censo exhaustivo** de saltos y llamadas que aterrizan en `[0x0efc..0x0f16]`: **ninguno**,
   en dos canales (capstone sobre la imagen y barrido del `.asm`) ⇒ la única entrada al gate
   es la **caída**, que pasa por `0x0efc`. El censo se declara operativo: encuentra 80 destinos
   distintos en el span y da los cardinales correctos en los de control
   (`0x11a6`←22, `0x0f3f`←18, `0x0f17`←1). Un «ninguno» de un censo roto es idéntico a uno
   verdadero, así que la cifra de control va con el resultado.
3. **Censo completo de escrituras a `[bp-0xa]`** en los 1060 B: `0x0dd2` (=1), `0x0ee5` (=0),
   `0x0efc` (=0xFFFF) y cuatro `= ax` en brazos (`0x0f3f`, `0x1029`, `0x10f6`, `0x1131`). De
   los **22** saltos a la cola, **sólo uno sale antes de `0x0efc`** — el `0x0eea` de
   «M.P. too low!», precedido de `res=0` en `0x0ee5`.

⇒ **el índice fuera de rango SALE EN SILENCIO.** Y el enunciado correcto es más fuerte que la
negación: **la inicialización a 1 de `0x0dd2` es ALMACENAMIENTO MUERTO** — ningún camino llega
a la cola con ese 1 intacto. Si el lector de nombres devolviera 48, el jugador no vería
"Success!": no vería **nada**. (Lo que sí sigue en pie: el `jbe` sin signo, y que el 49º
hechizo cae fuera de la tabla de 48.)

**★★ Por qué sobrevivió, que es lo que hay que llevarse de aquí.** La §1 de esta misma nota
advierte literalmente de este error: *«quien lea el listado desalineado ve la cola sin guarda
delante y concluye que imprime "Success!" incondicionalmente»*. Y sin embargo: el autor
**arregló** el decodificado, **transcribió** la guarda correcta con sus bytes (el bloque de
código de arriba es correcto)… **y la conclusión no se movió**.

La conclusión **nunca dependió del instrumento**. Venía de otro sitio — seguir `res` desde su
inicialización sin ver una reasignación intermedia — así que arreglar el decodificado no podía
tocarla; pero dio la **sensación** de haberla validado.

> **Corregir el instrumento no corrige la afirmación que el instrumento no produjo.
> Un verde de decodificado no es un verde de razonamiento.**

Regla operativa que se deja escrita: **toda afirmación sobre el VALOR de una variable en un
punto exige el censo de ESCRITURAS entre la inicialización y ese punto, más el censo de saltos
ENTRANTES al tramo.** Seguir el valor desde el `mov` inicial es «leer en orden de fichero
supone la caída» aplicado a **datos** en vez de a código.

Y el hallazgo de método por encima del hallazgo técnico: **dos lecturas independientes del
mismo span discreparon, y la discrepancia era real.** No fue trabajo duplicado — fue el único
control que había.

## 7. Hueco declarado de la cita anterior: CERRADO

La parcial dejaba abierto «qué hace `0x0f2a` con el `ax=5` que deja el brazo 26».
`0x0f2a` es `push ax` + `call time_spell_jingle_xor_flash` (CAST2:0x0000) — es la cola
compartida del brazo 0. Y el `[bp-0xa]` del brazo 26 **no lo pone `0x0f2a`**: lo puso
`0x1029` con el retorno de `magic_door_open_worker` (CAST2:0x0768). Si ese retorno es
`0xFFFF` el brazo salta a la cola sin sonar; si no, suena y la cola despacha sobre ese
mismo retorno. La pregunta se traslada intacta a `magic_door_open_worker`.

## 8. RNG

- **Profundidad 0 (este cuerpo, los 1060 B): CERO tiradas.** Enumerados los 41 destinos de
  `call` del cuerpo; ninguno resuelve a `rng_seed_from_dos_clock` (0x2056), `srand` (0x207e),
  `rand_range` (0x2092), `rand0` (0x3aae) ni `rand30` (0x3abe).
- **Profundidad 1 (cuerpo entero de los 46 callees directos): 5 SÍ tiran** —
  `kal_xen_summon` (0x04c6 rand_range), `in_xen_mani_add_food` (0x05c7 rand_range),
  `in_vas_por_ylem_earthquake` (0x094f rand30 + 0x0972 rand_range),
  `line_aoe_apply_effect` (0x20c8 rand30 + 0x20ed rand0) y
  `summon_daemon_kal_xen_corp` (CAST2 0x05aa rand30).
- **Profundidad ≥2: NO MEDIDA.** «Profundidad 1 medida» no es «no mueve stream».

## 9. 🔴 TRAMPA DE INSTRUMENTO: `verify_cites._landing` adjudica mal DENTRO del propio overlay

`resolve()` (`re/tools/verify_cites.py:88-95`) recorre los overlays y se queda con el
PRIMERO cuya banda `[load_seg*16, end_seg*16)` contiene el CS. **Cuatro overlays comparten
la ranura `0xbf80`**: SJOG (hi `0xe1e0`), CMDS (`0xdc90`), CAST (`0xe0f0`) y TALK (`0xd290`),
y SJOG va primero en la lista. Resultado medido: el `call 0x1f60` de `0x104e` —que es una
llamada INTRA-overlay a `CAST.OVL:0x1f60 line_aoe_apply_effect`— lo resuelve `_landing` como
`SJOG.OVL:0x1f60`, con `inside: echo_cmd_failure_beep`. Nombre plausible, fichero equivocado.

Regla de uso: `_landing` es fiable para los destinos que salen de la banda propia (los
`0xffffXXXX` a residente o a otro slot). Para un destino que cae DENTRO de la banda del
overlay que llama, la respuesta correcta es el propio overlay, y hay que resolverla a mano.

## 10. Lo que esta nota NO dice

- No he leído el CUERPO de ningún callee salvo para el barrido de RNG de §8 (que mira los
  destinos de `call`, no la semántica).
- No me pronuncio sobre la alcanzabilidad de ningún brazo, ni sobre si el lector de nombres
  puede devolver 48.
- Los tres argumentos de `time_spell_state_writer` (brazos 19/29/31/32) y los de
  `line_aoe_apply_effect` (28/40/44/45) están CITADOS pero no INTERPRETADOS: no he abierto
  esos callees.
