# Expiración de anillos — «A ring has vanished!» (tarea #67)

Deriva el mecanismo completo detrás del testigo vivo del usuario (×2, 27-07: al entrar
a una sala de Covetous el original imprime «Entering room...» y acto seguido «A ring has
vanished!»), enumera **todos** los disparadores del corpus, y carea el port.

**VEREDICTO EN UNA LÍNEA:** hay un `rand` real y la hipótesis del usuario —**(a) tirada
aleatoria al entrar en el encuentro**— es la CORRECTA. No hay contador, no hay temporizador
y no hay nada determinista: es 1/16 **sin memoria**, por personaje que lleve anillo, tirado
una vez por *montaje de escena de party* (entrada a sala de mazmorra o arranque de encuentro
de combate).

---

## 0. Corrección de la premisa de la tarjeta

La tarjeta decía «el inmediato 0xa422/0xa432 tiene CERO hits directos en los 28 .asm ⇒ vía
indirecta». **Es falso.** El inmediato está, plano y único, en el kernel:

```
ULTIMA.EXE  6a25: b822a4    mov ax, 0xa422
```

Barrido en Python sobre los 28 .asm buscando `, 0xa422` al final del operando: **1 hit en
todo el corpus**, y es el emisor. No hizo falta ninguno de los tres canales indirectos
previstos (complemento a dos, cadena de llamadores, `globals_negdisp.py`). El fallo previo
es casi con seguridad el ya fichado en [subagentes/instrumento]: `grep -r` sobre un worktree
**salta los .asm en silencio porque son symlinks** (misma trampa anotada en la evidencia de
`g_combat_actor_records` en `re/ledger/globals.json`). Los .asm se leen en Python.

Cadenas citadas en esta nota, todas comprobadas como **INICIO EXACTO** de string contra
`DATA.OVL` (byte previo = 0x00):

| cita | fileoff | contenido |
|---|---|---|
| DS 0xa422 | fileoff 0xa432 | `A ring has vanished!\n` |
| DS 0x995e | fileoff 0x996e | `\n\nRing vanishes!\n` |
| DS 0x2c58 | fileoff 0x2c68 | `Entering room...\n` |
| DS 0x9916 | fileoff 0x9926 | `Only one magic ring may be worn at a time!` |

(Escritas en la forma `DS 0xNNNN`/`fileoff 0xNNNN` A PROPÓSITO: así quedan **dentro** del
trinquete de `re/tools/verify_strcites.py`. La forma desnuda `0xNNNN` entre comillas
invertidas es invisible al censo — es justamente el hueco de la tarea #69.)

---

## 1. El emisor: `ULTIMA.EXE:0x6936` (`party_anim_build`), bloque en 0x69f0-0x6a4b

`party_anim_build` recorre el party (`[bp-4]` = 0..`g_party_size`-1; salta al muerto en
0x69e1 si el status `[bx<<5 + 0x55b3]` == 0x44 `'D'` — el **dormido `'S'` NO se salta**).
Para cada miembro vivo:

```
69f0: 80bfc5552a  cmp byte ptr [bx + 0x55c5], 0x2a   ; slot de ANILLO == 42?
69f5: 7504        jne 0x69fb
69f7: c646f22a    mov byte ptr [bp - 0xe], 0x2a
6a02: 80bfc5552c  cmp byte ptr [bx + 0x55c5], 0x2c   ; slot de ANILLO == 44?
6a07: 7504        jne 0x6a0d
6a09: c646f22c    mov byte ptr [bp - 0xe], 0x2c
6a0d: 807ef200    cmp byte ptr [bp - 0xe], 0
6a11: 743c        je 0x6a4f                          ; sin anillo -> NO tira
6a13: 2bc0 50     push 0                             ; \ rand sobre el rango
6a16: b80f00 50   push 0xf                           ; / 0..15 inclusive (16 salidas)
6a1a: e875b6      call 0x2092                        ; rand_range (ledger, verified)
6a20: 3d0b00      cmp ax, 0xb                        ; == 11  => 1/16
6a23: 7526        jne 0x6a4b
6a25: b822a4 50   push 0xa422                        ; "A ring has vanished!\n"
6a29: e824ae      call 0x1850                        ; print_string (ledger, verified)
6a3c: e86fd9      call 0x43ae                        ; glide/tono (0x28, 1, 0x7d0, 0x4b0)
6a48: e81504      call 0x6e60                        ; unequip_item(itemId, partyIdx)
```

`0x55c5` corresponde a `g_party_records` (base en 0x55a8; 16 registros × 32 B, ledger) + **0x1d** = el **slot de
anillo**, coherente con el layout ya derivado en `game/src/core/equip.ts` (+0x19 helmet,
+0x1a armor, +0x1b manoA, +0x1c manoB, **+0x1d ring**, +0x1e amulet).

⚠ El `rand` se consume **SOLO si el miembro lleva anillo 0x2a/0x2c**. Un party sin esos
anillos es 0-RNG en este bloque (ya anotado en `camp-scene.md:51`, aquí confirmado con la
razón exacta: el gate está *antes* del `call 0x2092`).

## 2. Qué hace de verdad `0x6e60` — NO es «el efecto», es **quitar el item**

El ledger ya lo llama `unequip_item` (verified) y la lectura del cuerpo lo confirma y lo
amplía. `unequip_item(itemId, partyIdx)` recorre los **6 slots** del personaje en orden
(`0x55c1`..`0x55c6`, o sea record +0x19..+0x1e), y al primero que valga `itemId` le escribe
**0xFF** (`Equipment.Nothing`):

```
6e80: c604ff      mov byte ptr [si], 0xff
```

El anillo se **destruye**: no vuelve al inventario (no hay incremento de
`equipmentQuantities`). Al final llama `0x6da8(partyIdx)` (ledger: `member_armor_rating`,
verified=false) — recalcular defensa tras quitar equipo. Devuelve 1 si lo encontró en
+0x19..+0x1e, 0 si solo estaba en +0x1e (rama 0x6f09).

**★ Caso especial del slot de anillo, en 0x6eca-0x6eeb — hallazgo nuevo:**

```
6eca: c604ff        mov byte ptr [si], 0xff       ; si = record + 0x1d (anillo)
6ecd: 837e042a      cmp word ptr [bp + 4], 0x2a   ; ¿es el anillo 42?
6ed3: 803e93587f    cmp byte ptr [g_location], 0x7f
6ed8: 7634          jbe 0x6f0e                    ; solo si location > 0x7f
6eda: 803e9e5820    cmp byte ptr [g_cmb_actor], 0x20
6edf: 732d          jae 0x6f0e                    ; solo si actor < 32
6eeb: 80a716baef    and byte ptr [bx - 0x45ea], 0xef   ; APAGA el bit 0x10
```

`[bx*8 - 0x45ea]` = `0xBA16` = `g_combat_actor_records` (0xBA14, 32 registros × 8 B) **+2 =
el byte de flags**, exactamente el campo cuyo layout ya fija el ledger («+2 flags (bit 0x80
miembro del party, bit 0x20 caido)»). Este cuerpo **añade al layout el bit 0x10**:

> **`g_combat_actor_records[i]+2` bit 0x10 = INVISIBLE.** Se apaga cuando expira el anillo 42.

Y con eso queda derivado, sin depender de ninguna tabla de nombres:

> **item 0x2a (42) = Ring of Invisibility** (es el único cuya retirada apaga el bit de
> invisibilidad del actor).

## 3. Qué anillos caducan (y cuál NO)

`TYPE_TABLE` (DATA.OVL DS 0x1a7e, ya extraída al port) tipa 42/43/44 como anillo (0x02) y
45/46/47 como amuleto (0x04). El pool `weaponNamesShort` de DATA.OVL (extraído en
`game/assets/data.json`, 15 entradas que cubren los items 32..46) da el orden posicional:
índice 10 = `Inv. Ring`, 11 = `Prot. Ring`, 12 = `Regen Ring` ⇒ items 42, 43, 44. La
posición 42 = Invisibility concuerda con la derivación **independiente** del §2 (dos canales,
uno de código y otro de datos).

| id | anillo | ¿en el gate 0x69f0/0x6a02? | ¿caduca? |
|---|---|---|---|
| 0x2a (42) | Invisibility | sí | **SÍ** |
| 0x2b (43) | Protection | **no** | **NO** |
| 0x2c (44) | Regeneration | sí | **SÍ** |

**El Ring of Protection no expira nunca.** Es una asimetría deliberada del gate (dos `cmp`
explícitos, no un rango), y ningún sitio del corpus toca 0x2b.

## 4. El disparador: enumeración CERRADA (esto decide las 3 hipótesis)

`party_anim_build` (0x6936) tiene, en los 28 .asm, exactamente **dos** llamadores; y el que
vive en overlay solo se alcanza por **un** stub. La cadena entera:

```
(1) DUNGEON.OVL:0x0000  dng_enter_room  (ledger, verified)
    0008: mov ax,0x2c58 / call 1850     -> "Entering room...\n"    <-- el testigo
    00b5: push [bp+4]; push 3
    00b9: call stub 0x7c3e ─────────────┐
                                        │
(2) ULTIMA.EXE:0x5f86   run_combat_encounter (ledger, verified)
    6021: push 1; push dir              │
    6028: call 0x6bc2 render_animated_tile
          └─ 6bec: test [bp+6],4 = 1 -> bit limpio -> 6bee: call 0x6936  ✔ TIRA
    6052: push 0; push 2                │
    6059: call stub 0x7c3e ─────────────┤
                                        │
    stub 0x7c3e (bytes: 9a ec02 2e07 / dw 0x000a / ea 0eb4 0000)
        = «asegura overlay 10 (DNGLOOK)» + ljmp 0:0xb40e            <-- byte-exacto
                                        │
                                        ▼
    DNGLOOK.OVL:0x117e -> lineal 0xb40e; corridor_sprite_overlay (ledger, verified)
        1195: cmp word ptr [bp+4],1 / jne  -> arg==1 SALTA el montaje
        11c1: call 0x6936                                          ✔ TIRA (arg 3 y 2 ≠ 1)
```

Los dos sitios llaman con argumento ≠ 1 (**3** desde `dng_enter_room`, **2** desde
`run_combat_encounter`), así que **ambos tiran**. `run_combat_encounter` con flags=4 (p. ej.
desde el wrapper 0x6360) coge la rama `0x8076` y **no** tira.

> **⚠ CORRECCIÓN 2026-07-28 (heredados-b, tanda 6). Los sitios que entran ahí no son dos,
> son CUATRO — y el que faltaba es justo el que NO tira.**
> Lo que sigue en pie: `party_anim_build` tiene **dos llamadores** en los .asm (este párrafo
> no se toca), y los dos caminos dibujados arriba tiran de verdad.
> Lo que estaba incompleto: la enumeración de **cómo se llega a la rutina de arriba**. El
> censo de `gate-117e-adjudicacion` encontró cuatro call-sites del stub, y los he verificado
> por mi cuenta parseando los `.asm` y leyendo el push del primer argumento en cada uno:
> `DUNGEON` `0x00b9`, con **3**; `ULTIMA.EXE` `0x6059`, con **2** —los dos de arriba—; y
> además `CMDS` `0x0058`, con **0**, y `CMDS` `0x02ef`, con **1**, los dos en la escena de
> campamento.
> **Por qué importa a la tesis de esta sección:** el `cmp` de la línea de arriba dice que un
> argumento igual a 1 SALTA el montaje, así que `CMDS` `0x02ef` **nunca llega** a la llamada
> a `party_anim_build`. O sea que existe un camino real que no tira, y era precisamente el
> que no estaba en la lista. El «ambos tiran» es cierto de los dos enumerados, no de todos.
> No borro nada: el razonamiento original es correcto sobre su propio conjunto.

Controles del instrumento (los ceros no se firman sin control):
- **Sesgo por overlay, especificidad:** con el sesgo declarado, 56-77% de los near-calls
  fuera de rango resuelven sobre arranques de función del kernel; con los **tres sesgos
  equivocados, 0%** en cada overlay (DNGLOOK 61/108 vs 0/0/0; COMBAT 97/160 vs 1/0/0;
  COMSUBS 55/95; SJOG 177/231; DUNGEON 127/188). El resto cae en el pool de stubs.
- **Control positivo cruzado:** `unequip_item` (0x6e60) se alcanza desde **cuatro sesgos
  distintos** (COMBAT 0xA290, COMSUBS/ZSTATS 0xE1E0, SJOG 0xBF80) y los cuatro caen en el
  mismo 0x6E60. Un sesgo malo dispersaría.
- **Parser de stubs:** recorre el pool [0x7A16,0x81C6) y saca **164 stubs**, la cifra que ya
  documenta `re/tools/dispatch_table.py`. Barriendo los 164, **un solo stub** apunta a
  0xb40e: el 0x7c3e. No hay segunda ruta a `corridor_sprite_overlay`.

⚠ **Matiz honesto sobre el nombre `corridor_sprite_overlay`**: pese al nombre, esta rutina
**no** es el repintado por-fotograma del pasillo 3D — en todo el corpus se la llama desde
exactamente 2 sitios (entrada de sala y arranque de encuentro). Si fuera per-frame o
per-paso, un anillo se evaporaría en ~16 pasos. No sello aquí un renombre; lo dejo apuntado
para el pase de #7/#59.

### Veredicto de las 3 hipótesis

| | hipótesis | veredicto |
|---|---|---|
| **(a)** | roll aleatorio por entrada a combate — **del USUARIO** | ✅ **CONFIRMADA.** Hay `rand` sobre 0..15 y el disparo es por evento de entrada (encuentro / sala). |
| (b) | determinista al entrar a sala | ❌ **REFUTADA.** El `cmp ax,0xb` cuelga de `rand_range`. |
| (c) | timer por turnos | ❌ **REFUTADA.** No existe contador: ni en el registro de personaje (los 32 B están todos adjudicados) ni en global alguno. El proceso es **sin memoria**. |

El matiz que el usuario ya había puesto (las 2 ocurrencias con la misma semilla no
discriminan) queda resuelto por el binario, sin necesitar la sonda de quemar tiradas: el
`call 0x2092` está ahí, plano, y el `cmp` es contra un valor concreto del rango.

### ¿Vive el estado en SAVED.GAM?

**No hay estado nuevo que persistir.** Todo el estado del anillo es el byte del slot
(record+0x1d) dentro de `g_party_records` (base en 0x55a8), que ya es parte del roster del .GAM. No
hay duración, ni carga, ni turnos restantes. El bit 0x10 de `g_combat_actor_records` es
caché de escena (se reconstruye en cada montaje), no estado de partida.

## 5. El HERMANO ya portado: la tirada al EQUIPAR (ZSTATS 0x0e01)

Existe un **segundo** sitio 1/16, distinto y ya modelado, que conviene no confundir:

```
ZSTATS.OVL 0e01: 83fb2a  cmp bx,0x2a   / je    ; mismos dos ids
           0e06: 83fb2c  cmp bx,0x2c   / je
           0e10: push 0 ; 0e11: push 0xf ; 0e15: call rand_range   ; rango 0..15
           0e18: 0bc0    or ax,ax / je         ; == 0   => 1/16
           0e1f: mov ax,0x995e / call print    ; "\n\nRing vanishes!\n"
           0e2d: c687c555ff  mov byte [bx+0x55c5],0xff   ; borra el slot EN SITIO
           0e32..: call 0x43ae (0x28, 1, 0x7d0, 0x4b0)   ; MISMO tono
```

Los dos sitios comparten ids, probabilidad y tono, pero difieren en tres cosas: **comparando**
(`==0` al equipar vs `==0xb` al montar escena), **mensaje** (0x995e vs 0xa422) y **vía de
borrado** (escritura directa al slot vs `unequip_item`). Que ambos cuerpos den el mismo tono
con los mismos 4 inmediatos es control interno de que los dos están bien leídos.

**El port es FIEL en este hermano:** `equip.ts:331-337` gatea por `equipId === 0x2a ||
equipId === 0x2c`, tira `randRange(0,15)` y compara `roll === 0` — que es exactamente el
`or ax,ax / je` de 0x0e18.

## 6. Careo con el port

| pieza | original | port | estado |
|---|---|---|---|
| Tirada 1/16 al **equipar** + `Ring vanishes!` | ZSTATS 0x0e01 | `game/src/core/equip.ts:330-337`; SFX en `main.ts:2946`/`3390` | ✅ **FIEL** |
| Invisibilidad por llevar el anillo 42 | bit 0x10 de `g_combat_actor_records+2` | `combat/combat.ts:556` y `:2080` — `invisible: record.ring === RING_INVIS` | ✅ equivalente (el port lo **computa** del slot en vez de cachear un bit; al borrar el slot la invisibilidad cae sola, así que el «apagar bit» del §2 es no-op por construcción) |
| **Expiración 1/16 al entrar a sala/encuentro** + `A ring has vanished!` | ULTIMA.EXE 0x6936 | **NADA** | ❌ **HUECO** |
| `unequip_item` genérico (6 slots, destruye el item) | 0x6e60 | `unequipWeaponById` solo barre `ATTACK_SLOTS` y **devuelve al inventario** | ❌ no hay análogo ⟨**CADUCADA**: esta fila describe el árbol del día de la tarjeta #67. Hoy `unequipItemById` (equip.ts) ES el análogo —se creó con esta misma nota— y desde #36 (2026-08-06) `unequipWeaponById` YA NO devuelve al inventario: esa rama murió porque su `+1` con tope 99 era de OTRA rutina (ZSTATS 0x0ccd) y se estaba colando en la munición. La fila se deja en pie como testimonio de cuándo se detectó el hueco⟩ |
| Anillo de Protection (43) inmune | gate de 2 ids | n/a (no hay expiración) | ❌ arrastrado por el hueco |

**Género «string catalogado pero nunca emitido» (detector de #47):** la cadena ya está
**traducida** en `game/src/i18n/es.json:244` (`"A ring has vanished!\n"` →
`"¡Un anillo se ha desvanecido!\n"`, `reviewed: true`) y **ningún `.ts` la emite**. Es un
huérfano vivo: la traducción se revisó sin que existiera el emisor.

## 7. Propuesta de pieza para el lote #54

Acotada, sin estado nuevo y con impacto de RNG **condicionado** (el `rand` solo se consume si
alguien lleva 42/44, así que un party sin esos anillos no mueve el stream):

1. **`equip.ts`** — `unequipItemById(state, charIdx, itemId)`: barre los **6** slots en el
   orden +0x19..+0x1e, pone `EQUIPMENT_NOTHING`, **NO** devuelve al inventario (calco de
   `unequip_item` 0x6e60). Reutilizable; no toca `unequipWeaponById`.
2. **`equip.ts`** — `rollRingExpiry(state, randRange): {charIdx, ringId}[]`: por miembro con
   status ≠ `'D'` (el dormido SÍ entra) y `ring ∈ {0x2a, 0x2c}`, tira `randRange(0,15)` y
   dispara con **`=== 11`** (0x6a20 — NO `=== 0`, ése es el hermano de equipar).
3. **Call-sites**: montaje de escena de party — entrada a sala de mazmorra (calco de
   `dng_enter_room` → justo **después** de emitir «Entering room...», que es el orden del
   testigo) y arranque de encuentro de combate (`run_combat_encounter`). **Una sola tirada
   por evento**, nunca por fotograma ni por turno.
4. **Mensaje**: emitir la clave ya traducida `A ring has vanished!\n` + SFX reutilizando
   `ring-vanishes` (`sfx.ts:97`, `speaker.ts:427` — mismo tono en el binario, §5).

Riesgos declarados: (i) el call-site de combate exige decidir cuál de las dos ramas de
`run_combat_encounter` corresponde al arranque en el port — en el original tiran las dos
(flags 0 y flags&2) y no la de flags&4; (ii) tocar la entrada a sala roza la máquina de
cadenas continuas ya fichada como frágil ([ch26-continuous-model-stream-brittleness]) ⇒ la
tirada debe ir **OPT-IN por call-site**, no colgada de un tick global.

## 8. Lo que esta nota NO cierra

- El renombre de `corridor_sprite_overlay` (§4) — apuntado, no sellado.
- La identidad de `0x8076` (rama flags&4 de `run_combat_encounter`), sin nombre en el ledger.
- `party_anim_build` (0x6936), `render_animated_tile` (0x6bc2) y `member_armor_rating`
  (0x6da8) siguen `verified=false` en el ledger; esta nota lee sus cuerpos pero no toca el
  ledger (es de otro carril).
- El testigo del usuario no discrimina 1/16 de otra probabilidad; la probabilidad viene del
  binario, no del testigo.
