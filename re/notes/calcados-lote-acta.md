# Acta del carril `calcados-lote` — #129 · #150 · #158

Tres fixes calcados encargados en un lote. Cada tarjeta lleva (a) la derivación con cita,
(b) **qué se verificó de la seña heredada y qué se corrigió de ella**, y (c) qué NO cierra.

Régimen: worktree propio `.claude/worktrees/calcados-lote`, rama `mech/calcados-lote`,
retenida (sin merge a main).

---

## A) #129 — Guarda de cabecera «Stay with ship!» (SJOG.OVL CS:0x1bb2)

### A.1 La seña heredada, y qué le pasaba

La seña venía del acta `re/notes/sapo-120-acta.md` §2, que la derivó bien en lo esencial
(la guarda existe, está a la cabeza, el port no la tiene) pero **con el dominio del gate
mal leído**: decía «`and 0xf8` recorta a **0x20-0x27 = barco + esquife**», copiando la
`meaning` que entonces tenía `re/ledger/globals.json` para `g_transport_tile`
(«0x20-0x2F barco (rumbo), **0x24-0x27 skiff** (censo parcial)»).

**Las dos afirmaciones son FALSAS, y con la prueba en el mismo overlay.** En
`CMDS.OVL`, dos gates consecutivos de la MISMA rutina reparten las familias:

```
090a: 24fe              and al, 0xfe
090c: 3c14              cmp al, 0x14
090e: 7504              jne 0x914
0910: fe06b057          inc byte ptr [g_carpets]     ; 0x14-0x15 = ALFOMBRA
0914: a07c58            mov al, byte ptr [g_transport_tile]
0917: 24fc              and al, 0xfc
0919: 3c28              cmp al, 0x28
091b: 7503              jne 0x920
091d: ff46fa            inc word ptr [bp - 6]        ; 0x28-0x2B = ESQUIFE (contador)
```

Y el corte velas-izadas / velas-arriadas dentro de la fragata lo fija `MAINOUT.OVL`:
`CS:0x0208 and al,0xfc / cmp al,0x24` → imprime `"Rowing!\n"` (DS 0x2982, file 0x2992),
mientras `CS:0x0499 cmp al,0x20` (izadas) consulta `g_sail_dir`.

⇒ El mapa correcto es **0x1C a pie · 0x12-0x13 caballo · 0x14-0x15 alfombra ·
0x20-0x23 fragata velas izadas · 0x24-0x27 fragata velas arriadas · 0x28-0x2B esquife**,
y por tanto `and 0xf8 / cmp 0x20` = **la FRAGATA y sólo la fragata**.

**Por qué importa y no es pedantería:** con la lectura vieja el fix se habría escrito
`isFrigate(t) || isSkiff(t)` y el port habría **denegado una huida que el original
permite**. El fix habría sido un bug nuevo con cita ASM al lado.

Nota irónica: **el port ya lo tenía bien**. `game/src/core/world/transport.ts:33-87`
define `TILE_SKIFF = 0x28` y `isFrigate = (tile & 0xf8) === 0x20` — la misma máscara
del gate. El error vivía sólo en el ledger y en el acta que lo citó.

CORREGIDOS en este commit: `re/ledger/globals.json` (addr 22652, `meaning` + `evidence`
con las cuatro citas) y `re/notes/sapo-120-acta.md` §2.1 (bloque de rectificación).

### A.2 La derivación (verificada byte a byte)

```
1bb2: 55            push bp
1bb3: 8bec          mov bp, sp
1bb5: a07c58        mov al, byte ptr [g_transport_tile]   ; DS:0x587C
1bb8: 24f8          and al, 0xf8
1bba: 3c20          cmp al, 0x20
1bbc: 750c          jne 0x1bca                            ; NO fragata → flujo normal
1bbe: b8768e        mov ax, 0x8e76
1bc1: 50            push ax
1bc2: e80b3d        call 0x58d0                           ; print_string (kernel 0x1850)
1bc5: 2bc0          sub ax, ax                            ; ★ RETORNA 0 = DENEGADA
1bc7: e98800        jmp 0x1c52
```

Cadena verificada con `xxd` sobre `original/u5/play/DATA.OVL`:
DS `0x8e76` → file `0x8e86` → `b'\nStay with ship!\n'`. (De paso, los hermanos:
`0x8e88`→`b'\nAll must use the same exit!\n'`, `0x8ea6`→`b'Leave!\n'`,
`0x8eae`→`b'Escape!\n'`, `0x8ed4`→`b'Blocked!\n'`.)

**Qué pasa con el turno** — la pregunta que la seña no respondía. El 0 vuelve intacto:
`move_combat_actor` (SJOG `CS:0x1cd6 call 0x1bb2` → `CS:0x1cd9 jmp 0x1d61`, que es su
propio epílogo) devuelve ese mismo `ax` a su caller. En esa rutina **1 = se movió/huyó,
0 = no** — la rama «Blocked!» (`CS:0x1d4a`, DS 0x8ed4) también sale con `sub ax,ax`.
⇒ **el rechazo NO consume turno**, exactamente como el gate de salida única
(`CS:0x1c1d jmp 0x1bc5`, que cae en el mismo `sub ax,ax`).

**Orden**: la guarda es la PRIMERA instrucción tras el prólogo, muy por delante del
`test [g_unk_58a1],0x80` de `CS:0x1c04`. A bordo el original dice «Stay with ship!»,
**nunca** «All must use the same exit!», aunque ambas condiciones se cumplan.

Segundo caller: `cmd_klimb_combat` `CS:0x1ded call 0x1bb2` con código de salida 5/6
(Up/Down). El port no expone Klimb con la party embarcada, así que no hay segundo punto
de cableado; queda anotado, no fabricado.

### A.3 El fix

`game/src/core/combat/combat.ts` → `playerEscape`, guarda insertada **antes** del gate de
salida única, con el comentario de derivación completo. Lee `this.opts.state.transportTile`
(`CombatOpts.state` ya es el `GameState` VIVO en los tres call-sites de `new Combat`).

### A.4 El test y su control

`game/tests/combat-escape-ship-guard.test.ts` — 11 casos:
* 4 POSITIVOS: 0x20, 0x23, 0x24, 0x27 → «Stay with ship!», ni «Leave!» ni «Escape!»,
  actor no marcado `fled` y `currentUnit` sin cambiar (turno intacto).
* 5 NEGATIVOS (controles): a pie 0x1C, caballo 0x12, alfombra 0x14 y **esquife 0x28 y
  0x2B** → huyen normal. Los del esquife son el control que ancla la corrección de §A.1.
* 1 de `transportTile === undefined` (default a pie).
* 1 de PRECEDENCIA: sala de mazmorra + fragata + dos bordes distintos → «Stay with ship!»
  las dos veces y NUNCA «All must use the same exit!».

**Control failing-first** (medido, no supuesto): sustituyendo la condición de la guarda
por `if (false)`, `EXIT=1` con **5 fallidos / 6 verdes** — caen los 4 positivos + el de
precedencia, y los 6 controles negativos siguen verdes. Es la forma esperada: si hubieran
caído también los negativos, el test estaría midiendo otra cosa.

i18n: `"Stay with ship!"` (forma trimada, la convención del fichero para los mensajes de
combate — `Leave!`/`Escape!`/`Blocked!` conviven así con su forma `\n`) añadida a
`game/tests/fixtures/approved-strings.json` con clase `[D]` + cita, y a
`game/src/i18n/es.json` («¡Permaneced con la nave!»).

### A.5 ★ CENSO DEL GÉNERO — guardas de cabecera sobre `g_transport_tile`

Instrumento (re-ejecutable): barrer **los 30 `.asm`** buscando
`mov al, byte ptr [g_transport_tile]` y quedarse con las que estén a **≤8 instrucciones
del `push bp` anterior** (= dentro de la cabecera de la rutina). No es cero: salen **12**.

| # | rutina | máscara / gate | qué hace | ¿en el port? |
|---|--------|----------------|----------|--------------|
| 1 | `CAST.OVL:0x0cf6` | `and 0xf0 / cmp 0x20` (0x20-0x2F, barco **o** esquife) | si va embarcado **salta el prompt** `"To phase: "` (DS 0x45e7) y retorna 0 | ✗ **la cadena no se emite en ningún sitio de `game/src`** — pero es la rutina ENTERA la que no está portada (único caller `CAST:0x112e`); género distinto |
| 2 | `CMDS.OVL:0x1423` | `and 0xf8 / cmp 0x20` + `cmp [g_location],0x80 / jae` | (Y)ell: en fragata iza/arría velas | ✓ `game.ts:3696` |
| 3 | `MAINOUT.OVL:0x00e5` | despacho por familia (0x10/0x14/0x20) | `transport_face` | ✓ `game.ts:1083`, `transport.ts:180` |
| 4 | `MAINOUT.OVL:0x0205` | `and 0xfc / cmp 0x24` | `"Rowing!"` (DS 0x2982) al entrar al paso | ✓ `game.ts:1455/1460` |
| 5 | `MAINOUT.OVL:0x0496` | `and 0xfc / cmp 0x20` + `g_sail_dir` | movimiento naval / vira | ✓ `game.ts:1321/1359` |
| 6 | `MAINOUT.OVL:0x10a4` | `and 0xf8 / cmp 0x20` | `damage_ship` sólo aplica a fragata | ✓ `transport.ts:295` |
| 7 | **`SJOG.OVL:0x1bb5`** | `and 0xf8 / cmp 0x20` | **«Stay with ship!» + salida denegada** | ✗ **ESTE FIX** |
| 8 | `TALK.OVL:0x00ed` | `and 0xfe / cmp 0x12` (caballo) **y** `[bp+4] != 0x83` | imprime `A merchant says:\n"GET THAT HORSE OUT OF HERE!"\n` (DS 0x9072) y **aborta la conversación** (`jmp 0x1da`) | ✗ **CANDIDATO VIVO** — ver abajo |
| 9 | `TOWN.OVL:0x057f` | despacho por familia | `town_transport_face` | ✓ `game.ts:1402`, `transport.ts:181` |
| 10 | `TOWN.OVL:0x0607` | `cmp 0x1c` (pie) ó `and 0xfe / cmp 0x12` (caballo) | `town_move` | ✓ `game.ts:1350/1405` |
| 11 | `TOWN.OVL:0x0b94` | `and 0xfe / cmp 0x12` | Klimb montado → `"-On foot!"` (DS 0x272a) | ✓ `game.ts:3026/3035` |
| 12 | — | (`MAINOUT:0x00da` y `TOWN:0x057c`, contadas una sola vez cada una; el barrido no duplica) | | |

⚠ **Trampa de homónimos que el barrido casi me cuela**. Buscando por offset desnudo en
`game/src` sale `skin/fiel/gemmap-overworld.ts:27`, que cita `LOOKOBJ 0x109e` — **otro
overlay**, no `MAINOUT.OVL`.
La cobertura de la fila 6 la acredita `transport.ts:295`, que cita `MAINOUT` explícitamente.

**Resultado del censo: 9 de 12 portadas, 1 arreglada aquí (#7), 1 fuera de género (#1),
y 1 CANDIDATO VIVO NUEVO (#8).**

#### Candidato #8 — TALK.OVL 0x00e6, el mercader y el caballo

```
00e6: 55                push bp
00e7: 8bec              mov bp, sp
00e9: 83ec04            sub sp, 4
00ec: 56                push si
00ed: a07c58            mov al, byte ptr [g_transport_tile]
00f0: 24fe              and al, 0xfe
00f2: 3c12              cmp al, 0x12            ; ← A CABALLO (0x12-0x13)
00f4: 7512              jne 0x108
00f6: 817e048300        cmp word ptr [bp + 4], 0x83   ; ← EXCEPCIÓN por dialogNumber
00fb: 740b              je 0x108
00fd: b87290            mov ax, 0x9072
0100: 50                push ax
0101: e8cc57            call 0x58d0
0104: e9d300            jmp 0x1da               ; ← ABORTA la conversación
```

DS 0x9072 → file 0x9082 → `b'A merchant says:\n"GET THAT HORSE OUT OF HERE!"\n'`.
`[bp+4]` es el mismo argumento que a dos instrucciones (`0x0122 sub ax, 0x81`) se
convierte en el índice de diálogo ⇒ **el gate de excepción es el `dialogNumber`**, la
misma forma que destapó #130 («Nay!»).

Estado: la cadena **no aparece en `game/src`** (sólo como key de `es.json`, o sea está en
el corpus pero sin emisor), y el interior de la rutina **sí está portado** (el port cita
`TALK.OVL 0x01e2/0x02a4`, `0x041c`, `0x08c8`, `0x0a33` en cinco módulos). Es decir: el
perfil EXACTO de #129 — rama de cabecera sin cablear dentro de rutina portada, y la rama
que falta es una GUARDA. **No la arreglo aquí** (fuera del encargo del lote, y el `0x83`
pide adjudicar a qué NPC corresponde); queda con tarjeta propia y la derivación ya hecha.

### A.6 Lo que #129 NO cierra

* **No he medido si es alcanzable hoy.** Para que la guarda dispare hace falta entrar en
  combate embarcado en fragata. `startCombat` no filtra por transporte, así que
  estructuralmente lo es, pero **no lo he verificado en vivo** (cero e2e: el mutex no es
  de este carril).
* El caller `cmd_klimb_combat` (0x1ded) no se cablea: el port no expone Klimb embarcado.
* La predicción de `sapo-120-acta.md` §4 (que `'\nStay with ship!\n'` salga del censo de
  huérfanos por `emitido_exacto` y el recuento baje de 126 a 125) **no se cumplirá tal
  cual**: el port emite la forma **trimada** `"Stay with ship!"`, siguiendo la convención
  del propio fichero para `Leave!`/`Escape!`/`Blocked!`. Si el detector normaliza
  `\n` de borde, bajará; si no, la huérfana seguirá contada. Queda anotado como
  predicción CORREGIDA, no como predicción cumplida.

---

## B) #150 — `revealSecretDoor` se gatea por `g_floor`, no por «mazmorra»

### B.1 La seña, verificada

La rama entera del binario (`SJOG.OVL`):

```
0b33: 837ef24e    cmp word ptr [bp - 0xe], 0x4e     ; el tile apuntado
0b37: 7535        jne 0xb6e
0b39: b8488a      mov ax, 0x8a48                    ; DATA.OVL file 0x8a58 =
0b3c: 50          push ax                           ;   b'a hidden door!\n'
0b3d: e8904d      call 0x58d0                       ; print_string
0b40: 803e955880  cmp byte ptr [g_floor], 0x80      ; ★ DS:0x5895, BYTE SIN SIGNO
0b45: 7311        jae 0xb58
0b47: ff76f8      push word ptr [bp - 8]            ; ── floor < 0x80 ──
0b4d: e83279      call 0x8482                       ; tile_addr
0b52: c607b9      mov byte ptr [bx], 0xb9           ;   → 0xB9
0b55: eb0f        jmp 0xb66
0b58: ff76f8      push word ptr [bp - 8]            ; ── floor >= 0x80 ──
0b5e: e82179      call 0x8482
0b63: c607b8      mov byte ptr [bx], 0xb8           ;   → 0xB8
0b66: 800ee62402  or byte ptr [g_unk_24e6], 2       ; turno consumido
```

⇒ el discriminador es `g_floor >= 0x80`. **Seña CONFIRMADA.**

Y hay un argumento adicional que la refuerza: **«es mazmorra» no puede ser el criterio
porque esta rama es inalcanzable en mazmorra.** La cabecera de la MISMA rutina desvía
antes todo el rango de mazmorra:

```
0969: 803e935820  cmp byte ptr [g_location], 0x20
096e: 760e        jbe 0x97e
0970: 803e935829  cmp byte ptr [g_location], 0x29
0975: 7307        jae 0x97e
0977: e8ccfc      call 0x646                        ; búsqueda de MAZMORRA
097a: e92702      jmp 0xba4                         ; …y retorna
```

El `inDungeon` del port no sólo estaba fijado a `false` en su único call-site: describía
un caso que el flujo nunca alcanza.

`g_unk_24e6 |= 2` (0x0b66) = marca de turno consumido — el port **ya lo hace**
(`runContextTurn({consumed:true})` en el call-site). No es un hueco.

### B.2 ★ Lo que la seña NO decía, y es lo que decide el fix

`floor >= 0x80` **escrito literal sobre el `floor` del port es un no-op para la población
viva**: en el port `floor` es un número **con signo** y los sótanos son `z = −1`
(`smallmaps.json`), no `0xFF`. Hay que enmascarar a byte. No lo invento: `survival.ts
lightLevel` ya deriva el mismo gate (`0x50BA cmp byte [g_floor],0x7f; ja`) y documenta
literalmente esta trampa.

**Medido con DOS controles failing-first** sobre el test nuevo:

| variante del código | EXIT | fallidos |
|---|---|---|
| sin gate (`return REVEALED_DOOR_ABOVE`) | 1 | **3** / 33 verdes |
| la seña LITERAL (`floor >= 0x80`, sin máscara) | 1 | **1** / 35 verdes |
| el fix (`(floor & 0xff) >= 0x80`) | 0 | 0 |

y el único que cae en la variante literal es **exactamente el del sótano**.

### B.3 Población, contada (no estimada)

Conteo de tiles `0x4E` sobre los assets:

| piso | puertas secretas | mapas | efecto del fix |
|---|---|---|---|
| `z = −1` (sótano) | **8** | Yew 2 · Lord British's Castle 1 · Palace of Blackthorn 3 · Serpent's Hold 2 | ★ pasan de 0xB9 a 0xB8 |
| `z = 0` | 26 | 14 mapas | ya correctas |
| `z = 1` | 9 | 4 mapas | ya correctas |
| `z = 2` | 2 | 2 mapas | ya correctas |
| Underworld | **0** | — | ninguno |

⇒ el título de la tarjeta («sótano/Underworld») es correcto en la derivación, pero **el
Underworld aporta CERO al conjunto vivo**: el 100% del efecto son los 8 sótanos. Anotarlo
importa porque una comprobación futura que buscara el cambio en el Underworld mediría
un cero y lo leería como «el fix no hace nada».

### B.4 El test que había SELLABA lo contrario

`commands.test.ts:273-279` decía «tile 0x4E → 0xB9 en el mundo, **0xB8 en mazmorra**» y lo
asertaba pasando `true`. Prosa sin derivación, sellando el caso inalcanzable. Sustituido
por 5 casos derivados (no-0x4E, plantas 0..3, ★ sótano `z=−1`, Underworld `0xFF`, y la
frontera del `jae`: `0x7f` arriba / `0x80` abajo).

### B.5 Lo que #150 NO cierra

* **Género hermano, visto y NO barrido**: hay al menos cinco sitios más del port con
  `floor >= 0x80` escrito literal — `encounters.ts:206`, `use-tools.ts:152`,
  `use-tools.ts:178` (`floor > 0x7f`), `coreview.ts:1568`, `coreview.ts:1593`,
  `spawn.ts:38` (`floor > 0x7f`). Si alguno es alcanzable con `floor = −1` tiene el mismo
  defecto que acabo de arreglar aquí. **No los he auditado** (fuera del encargo): cada uno
  necesita saber si su flujo puede correr en un sótano. Tarjeta propia sugerida.
* No he verificado en vivo el 0xB8 en pantalla (cero e2e en este carril).

---

## C) #158 — SNAP de NPCs al despertar en la posada

### C.1 La derivación: el punto EXACTO de la secuencia

`SHOPPES3.OVL`, salida del bucle nocturno:

```
01f4: 75d4        jne 0x1ca         ; fin del bucle de la noche (g_hour == 6)
01f6: b8514e      mov ax, 0x4e51    ; DATA.OVL file 0x4e61 = b'Morning!\n' (xxd)
01fa: e87334      call 0x3670       ; print_string
01fd: e8ae96      call 0xffff98ae   ; ★ el snap — la instrucción SIGUIENTE al mensaje
0200: c746f80000  mov word ptr [bp - 8], 0
```

Destino resuelto **con el instrumento, no supuesto**: SHOPPES3 está en la BANDA 4
(`near_call_base` 0xe1e0) ⇒ crudo `0x98ae` → CS `0x7a8e`, dentro de la banda de stubs
kernel→overlay `[0x7a16,0x81c6)`; `re/tools/dispatch_table.py stubs()[0x7a8e]` devuelve
`Stub(overlay='TOWN.OVL', entry_file_off=5780)` = **TOWN.OVL:0x1694**.
Control de la base dentro del mismo bucle: el crudo `0x98ba` de `0x01ec` → CS `0x7a9a` →
`entry_file_off=368` = TOWN.OVL:0x0170, el refresco horario que #122 ya cableó.

`TOWN.OVL:0x1694 npc_activate_all_town` (cuerpo leído `0x1694-0x1725`): pone a cero los 32
slots (`0x16a2-0x16b9`) y, para cada NPC con horario no nulo (`0x16c9 cmp byte
[si+0x659e],0`), resuelve el índice de tramo por `g_hour` (`0x16d1` + `call 0xfffff966`) y
lo coloca en la x/y/z de ese tramo (`[bx+0x5d61]/[bx+0x5d64]/[bx+0x5d67]` → `call 0x1726`).

Callers de 0x1694 en el binario: **dos**, y sólo dos. `TOWN 0x051d`, que vive dentro de
`TOWN.OVL CS:0x0408` — la rutina que el ledger llama `town_load_floor` — y está gateado
por `[bp+4]!=0`; y este de SHOPPES3 vía stub.

### C.2 ★ Corrección de la seña: el género NO es «portado y sin llamar»

La tarjeta dice que `npc_activate_all_town` «está PORTADO en el port pero SIN LLAMAR».
La segunda mitad es cierta; **la primera no**: `git grep 1694 -- game/src` da **cero**. En
el port no existe una función portada de 0x1694. Lo que existe es
**`NpcManager.enterMap`** (`npc/manager.ts:177`), que hace exactamente lo mismo
(`scheduleIndex(s.times, state.time.hour)` y colocación en `x[idx]/y[idx]/z[idx]`) pero
bajo otro nombre y con **un solo call-site conceptual: entrar a un mapa**.

⇒ el género correcto es **«portado bajo otro nombre y con UN call-site de menos»**. Es una
distinción con consecuencia práctica: buscando por el offset (que es como se localizan los
huecos de «portado y sin llamar») esta función es **invisible**, y el barrido habría
devuelto «no portada» en vez de «le falta un caller». Quien herede la tarjeta y confíe en
la etiqueta buscará la función equivocada.

El port ya tenía el caller equivalente al de `TOWN 0x051d`, que es `Game.enterLocation` →
`enterMap`;
le faltaba el de SHOPPES3.

### C.3 El fix

`Game.innWakeSnapNpcs()` (game.ts) con la derivación completa, llamado desde
`shop-console.ts` **después** de `message(innMorning)` — el orden del binario. No dentro
de `innSleepUntilMorning`, que lo pondría antes del mensaje.

Efecto: sin esto los NPC amanecen en su puesto de las 21:00 y caminan al de las 6:00 un
paso por turno. **Sin impacto de stream**: ni 0x1694 ni `enterMap` tiran RNG (test
explícito). No duplica ni contradice #122, que cableó el bucle nocturno y dejó ESTA
llamada declarada-y-no-hecha en su propio mensaje de commit.

Nota declarada, no afirmada fiel: `enterMap` reconstruye los runtimes, así que limpia
`tributeDemanded` (npc/manager.ts:54-61). Es coherente con el contrato que ese campo se
declara a sí mismo («se limpia solo al re-entrar»), pero el limitador real del binario
(handler opaco 0x1912) no está derivado. [⚠ 30-07: el handler se resolvió y NO contiene
limitador — vive en el productor de result (TOWN 0x159a), sin derivar;
re/notes/talk-031e-resolucion.md §3.3]

### C.4 Los tests, en DOS niveles

El defecto clásico es sellar la lógica y dejar el cableado muerto, así que van los dos:

1. **MECANISMO** (`inn-wake-npc-snap.test.ts`, NpcManager real + assets reales): las
   posiciones de las 21:00 y las 06:00 difieren (control de instrumento — sin ese
   contraste un snap que no hiciera nada pasaría), un NPC desplazado a mano vuelve a su
   puesto de las 06:00 tras el snap, y el snap no consume RNG.
2. **CABLEADO Y ORDEN** (`inn-flow.test.ts`, conductor real): se llama exactamente una
   vez; **va después de «Morning!»**; y control negativo — si no se descansa, no se llama.

**Controles failing-first medidos:**

| variante | EXIT | fallidos |
|---|---|---|
| sin la llamada en shop-console | 1 | **2** / 21 verdes (llamada + orden; el negativo sigue verde) |
| con la llamada pero ANTES de «Morning!» | 1 | **1** / 22 verdes — cae *sólo* el test de ORDEN |
| el fix | 0 | 0 |

El segundo control es el que acredita que el aserto de orden no es decorativo.

### C.5 Lo que #158 NO cierra

* **No verificado en vivo** (cero e2e en este carril): el efecto visible —los NPC en su
  sitio de las 6:00 al salir de la posada— no está medido en el navegador.
* El otro caller del binario — `TOWN 0x051d`, gateado por `[bp+4]!=0`, dentro de
  `TOWN.OVL CS:0x0408` — **no lo he careado**: el port llama a `enterMap` desde
  `enterLocation`, pero no he comprobado que el gate `[bp+4]` case con las condiciones del
  port. Queda declarado, no verificado.

---

# SEGUNDA TANDA — los huecos que abrieron las descripciones ampliadas

Las tarjetas #129/#150/#158 volvieron a llegar por el canal con `timestamp` **02:06**,
anterior al hito de este carril (04:30). Son las asignaciones ORIGINALES llegando tarde,
no encargos nuevos: no se re-ejecuta nada. Pero traían detalle que el brief no tenía, y
cuatro cosas quedaban sin hacer. Van aquí.

## D) #150 — ★ POR QUÉ el binario distingue: no es cosmético, es una PUERTA CERRADA

La descripción preguntaba «¿por qué el binario distingue? ¿0xB8 es puerta-normal y 0xB9
secreta-de-mundo?». Contra la tabla de tiles (`game/src/core/data/TileData.json`):

| tile | Name | walkable |
|---|---|---|
| `0x4E` | `StoneBrickWallSecret` | no |
| `0xB8` | **`RegularDoor`** | no |
| `0xB9` | **`LockedDoor`** | no |
| `0x44` | `BrickFloor` | sí |

⇒ La mecánica **no** es «puerta de mundo vs de mazmorra». Es:

* **bajo tierra** (`g_floor >= 0x80`) → la puerta secreta se revela **NORMAL**: se abre con
  `(O)pen`;
* **superficie / plantas altas** → se revela **CERRADA CON LLAVE**: `(O)pen` dice
  «Locked!» y hace falta llave o `(J)immy`.

El propio port lo confirma en su capa de puertas: `doors.ts:8` («0xB9/0xBB → "Locked!"
(NO abren, NO gastan llaves)»), `doors.ts:28` (`locked: 185`) y `commands.ts:176` (Jimmy
sobre 0xB9 → `tile−1` = 0xB8, con `rand(0,29)` contra DEX). Y encaja con lo que vio la
sonda #121: `0xB8 → 0x44` al abrir, que es exactamente `RegularDoor → BrickFloor`.

**Esto sube la severidad de #150.** Antes del fix, las **8 puertas secretas de sótano**
(Yew, castillo de Lord British, palacio de Blackthorn, Serpent's Hold) salían **CERRADAS**
donde el original las da **abiertas**: no es un id de tile distinto, es cobrarle al jugador
una llave o una tirada de Jimmy —que puede fallar y romper la ganzúa— en sitios donde el
original no le cobra nada. Es un cambio de *gating*, y en un sótano de castillo puede ser
un tapón de progresión.

## E) #129 — ALCANZABILIDAD, medida (era la precondición explícita de la tarjeta)

La tarjeta pedía medir ANTES de implementar si el port genera encuentros marítimos. Se
implementó primero y se midió después; la medida sale a favor, pero el orden fue el
equivocado y queda dicho.

El modelo de spawn del port es `spawnThreshold` (`world/loops/spawn.ts`, calco de
`MAINOUT 0x0D8C`): agua = tiles `[0x20,0x26]` → base **0**; bonus nocturno **+3** sólo si
`hour < 5`. Y el gate es `threshold > roll` con `roll = rand(1,30)`. Por tanto, sobre agua:

* **de día** (05:00-23:59): `threshold = 0` ⇒ `0 > roll` es imposible ⇒ **cero encuentros**;
* **de noche** (00:00-04:59): `threshold = 3` ⇒ dispara con `roll ∈ {1,2}` = **2/30 ≈ 6,7%
  por turno**.

⇒ La guarda **no es teórica**: es alcanzable navegando de madrugada. Y `startCombat` no
filtra por transporte, así que el combate arranca con la fragata en `state.transportTile`.
No verificado en vivo (cero e2e en este carril); es derivación sobre el modelo del port,
que a su vez cita el ASM.

## F) #158 — ★★ ERA UN CERO EN FALSO: hay DOS call-sites, no uno

La tarjeta preguntaba, sobre el snap de `SHOPPES3 CS:0x01fd`, si además de la posada
hay otros despertares que lo ejecuten — «¿camp? ¿sólo posada?».
Mi primera respuesta fue **«sólo posada»**, y **era falsa**. La saqué de
`grep -rn "call 0xffff98ae" re/disasm/*.asm` → 1 resultado.

**El grep por BYTES CRUDOS es el instrumento equivocado**: el mismo destino se codifica
distinto en cada overlay según su `near_call_base`. Resolviendo por banda
—`(crudo + base) & 0xFFFF == 0x7a8e`— salen **DOS por stub** (y ver la corrección de abajo:
los SITIOS de llamada de la rutina son **TRES**):

```
SHOPPES3.OVL CS:0x01fd   crudo 0xffff98ae + base 0xe1e0   ← posada (ya cableado)
CMDS.OVL     CS:0x0677   crudo 0xffffbb0e + base 0xbf80   ← ★ dormir en CAMA de pueblo
```

> ⚠ **CORREGIDO por #173 — son TRES sitios de llamada, no dos.** Los dos de arriba son los
> que entran POR STUB (que es lo que este barrido buscaba). Preguntando por el destino ya
> resuelto —`TOWN.OVL:0x1694`— con `re/tools/callers_por_banda.py` en `99c07474` sale un
> tercero: **`TOWN.OVL:0x051d`**, **INTRA**-overlay, dentro de la rutina 0x0408 y tras
> `cmp word ptr [bp+4],0 / je`. No es un caller inter-overlay perdido —un grep DENTRO de
> TOWN lo habría visto— pero el conteo de esta sección se quedaba corto: la rutina tiene
> **2 por stub + 1 intra**. Que el tercero sea intra es justo lo que explica por qué el
> barrido no lo buscó: preguntaba por el stub, no por la rutina.

`CMDS.OVL CS:0x0552` es la rutina del prompt `"For how many hours? "` (DS 0x4209, file
0x4219) — el *hole up* en cama de pueblo—, y el snap va justo tras su bucle de horas:

```
0667: a07f58   mov al, byte ptr [g_hour]
0671: e8f464   call 0x6b68
0674: e80963   call 0x6980            ; draw_status_panel
0677: e894b4   call 0xffffbb0e        ; ★ → CS 0x7a8e → TOWN.OVL:0x1694
```

El camp de **intemperie** es otra rutina (kernel `0x3C9A`) y **no** lo llama — coherente:
allí `location` es 0 y no hay NPCs que recolocar.

**Fix**: `Game.bedSleep` llama al snap. Y el método se renombra `innWakeSnapNpcs` →
**`wakeSnapNpcs`**, porque ya no es de posada. Failing-first medido: quitando la llamada
de `bedSleep`, EXIT=1 con 1 fallido / 4 verdes.

★ Lo aprovechable más allá de esta tarjeta: **cualquier censo de callers inter-overlay
hecho con `grep` sobre el texto del disasm está mal por construcción.** Hay que resolver
por banda. El fallo aquí fue benigno porque el instrumento *petó ruidosamente* al primer
intento (la API pedía un objeto, no un string) en vez de devolver 0 en silencio.

## G) #129 — EL BARRIDO DE LOS CUATRO CRITERIOS

Instrumento nuevo, re-ejecutable: **`re/tools/cita_rama_hermana.py`**.

```
python3 re/tools/cita_rama_hermana.py             # informe completo
python3 re/tools/cita_rama_hermana.py --calibrar  # las dos políticas de atribución
```

Corpus: 28 overlays × `game/src/**/*.ts` → **1880 citas**, **959 pares (overlay,offset)**
distintos.

### G.1 Resultados

| criterio | qué hace | resultado |
|---|---|---|
| **(4)** cita a DESTINO DE SALTO CONDICIONAL | mecánico y completo | **cifra MÓVIL — ver §G.4/§G.5** |
| **(2)** de esos, la rama hermana EMITE CADENA | sub-clase de (4), perfil odd-key/HMS-Cape | **59** (estable) |
| **(1)** guarda de cabecera en rutina citada | cabecera con `cmp`+`jXX`+puntero+`call` | ver informe |
| **(3)** docblock de early-returns | **NO mecanizado** — exige saber cuál es la rama de ÉXITO, que es semántico | declarado, no barrido |

Reparto de las 59 clase-2 por overlay: MAINOUT 8 · SHOPPES 7 · SHOPPES2 6 · TALK 5 ·
SJOG 5 · CAST2 5 · LOOKOBJ 4 · CMDS 4 · TOWN 3 · DNGLOOK 3 · OUTSUBS 2 · y **7** overlays
con 1 (ZSTATS · SHOPPES3 · ENDGAME · DUNGEON · COMBAT · CAST · BLCKTHRN).

> **Corregido por #172:** aquí ponía «6 overlays con 1», y con 6 el desglose **suma 58**, no
> 59 — se contradecía con su propio titular. La cola son SIETE; con 7 suma 59 y cuadra con
> el instrumento en los tres árboles medidos. Éste **sí** era un defecto de transcripción,
> a diferencia de los totales (§G.5).

### G.2 La predicción pre-registrada, ADJUDICADA

`lote-133-acta.md §8.1` decía: *«el barrido encontrará MÁS casos; si sale vacío, el
criterio está mal formulado, no el corpus»*. **No sale vacío: 154.** La predicción se
cumple.

Pero el número hay que leerlo bien: **154 no son 154 defectos.** El criterio es
deliberadamente sobre-inclusivo —«sospechosa POR CONSTRUCCIÓN» significa *ve a mirar*, no
*está mal*—, y muchas serán legítimas (el port modela las dos ramas, o la hermana es
irrelevante). Es un POOL de trabajo, no un veredicto. Las 59 de clase-2 son la cabeza de
lista por perfil.

### G.3 Controles positivos, y el que se escapa

| caso conocido | ¿lo reencuentra? |
|---|---|
| `SJOG.OVL:0x15dc` — HMS Cape (#133), el que motivó el criterio | **SÍ**, por (4) |
| `SJOG.OVL:0x1bb2` — la guarda de barco (#129), con su puntero 0x8e76 | **SÍ**, por (1) |
| `SJOG.OVL:0x158e` — odd key (#133) | **NO** con la política estricta |

El tercero es la parte honesta. `0x158e` **sí** es destino de salto (`156c: jle 0x158e`) y
el port **sí** lo cita (`commands.ts:512`), pero esa línea —`// 0x158E, DS 0x8CB4`— **no
nombra el overlay**, y mi política de atribución exige el overlay EN LA MISMA LÍNEA.

### G.4 Calibración con las dos políticas OPUESTAS

Un detector no se cree hasta correr las dos políticas opuestas y mirar la intersección:

⚠ **LOS TOTALES DE ESTA TABLA VAN ANCLADOS A SHA, Y NO SON UNA CONSTANTE** (corregido por
#172/#173; ver §G.5). La población incluye las citas ASM de `game/src`, que CRECEN cada vez
que un carril aterriza comentarios de derivación. Medido con el instrumento commiteado:

| política | `73034b9d` | `eae497b7` | `28444f53` |
|---|---|---|---|
| ESTRICTA (overlay en la misma línea) | **155** | **155** | **156** |
| PEGAJOSA (hereda el overlay hasta 40 líneas) | **479** | **479** | **481** |
| INTERSECCIÓN | 155 | 155 | 156 |
| sólo pegajosa | 324 | 324 | 325 |
| **sólo estricta** | **0** | **0** | **0** |
| **★ clase-2** | **59** | **59** | **59** |
| corpus (citas / pares) | — | 1880 / 959 | 1901 / 972 |
| control HMS Cape | estricta SÍ · pegajosa SÍ | ídem | ídem |
| control odd key | estricta **NO** · pegajosa **SÍ** | ídem | ídem |

Las cifras que esta sección publicaba (154 / 476 / 322) no se sustituyen por otras peladas:
**no reproducen en ningún árbol y no podían, porque la cifra caduca.** Lo que SÍ es estable
—y es lo único que dirige trabajo— son las **59 clase-2**, idénticas en los tres árboles
medidos. La cifra viva de cualquier corrida se saca del artefacto, no de aquí:
`python3 re/tools/cita_hermana_emitida.py --json`.

La estricta es subconjunto propio de la pegajosa. Y —esto es lo que decide cómo usarlo—
**un positivo VERDADERO conocido (odd key) vive en la banda que sólo ve la pegajosa**: la
banda estricta **no es suficiente**, sólo es la de alta confianza. Las 322 de la banda
pegajosa necesitan revisar la atribución una a una antes de creerles, porque heredar el
overlay de una línea anterior es exactamente el defecto que re-atribuye en silencio.

**Uso recomendado**: empezar por las 59 clase-2 de la banda estricta (atribución
garantizada + perfil de defecto), y después la banda pegajosa con verificación de
atribución por caso.

### G.5 ★ El total del pool es un BLANCO MÓVIL (añadido por #172/#173)

Las cifras originales de §G.1/§G.4 (154 · 476 · 322) **no reproducen en ningún árbol**, y
el diagnóstico que #172 dio primero —«es transcripción»— **era falso**. La causa es
estructural:

> **La población del pool incluye las citas ASM de `game/src`, y esas CRECEN cada vez que
> un carril aterriza comentarios de derivación** — o sea, varias veces por noche. El corpus
> pasó de 1880 citas / 959 pares a 1901 / 972 en unas horas, y con él el total: 155 → 156.

Corolarios, que entran al régimen:

1. **Una cifra de censo sin SHA no es un dato, es una foto.** Todo total de este pool va
   anclado (`155 medido en 73034b9d`) o no va; si se quiere la cifra viva, se saca del
   artefacto: `python3 re/tools/cita_hermana_emitida.py --json`.
2. El 154 original **era correcto para su árbol y caducó DENTRO de su propio commit** (se
   midió antes de la última edición del mismo commit). Es la familia de «correr los gates
   antes del `git add`»: la medida y lo medido se separan sin que nadie toque nada.
3. **Distinguir cifra MÓVIL de cifra ESTABLE es parte del censo.** Aquí el total se mueve y
   las **59 clase-2 no** (idénticas en `73034b9d`, `eae497b7` y `28444f53`). Lo que dirige
   trabajo es lo estable; el total sólo dice cuánto queda por mirar, y para eso basta con
   re-correr.
4. ⚠ **Cómo se llegó al diagnóstico falso** (para no repetirlo): #172 midió en DOS árboles,
   vio 155 en ambos y concluyó «el instrumento es determinista ⇒ el fallo es de
   transcripción». Pero esos dos árboles tenían el **mismo `game/src`** — o sea, el control
   era **degenerado**: variaba el SHA y no la variable de la que depende la población. Dos
   medidas iguales sobre el mismo corpus no son una replicación.

## H) Cola que dejan estas cuatro

1. **Adjudicar el pool de (4)/(2)** — 59 clase-2 estrictas primero. Tarjeta propia.
2. **Mecanizar el criterio (3)** o declararlo definitivamente no-mecanizable.
3. **Los 6 `floor >= 0x80` literales** del port (residuo de #150, ya con tarjeta).
4. **`TALK.OVL CS:0x00ed`** — la guarda del mercader y el caballo (ya con tarjeta).
5. **Auditar otros censos de callers inter-overlay hechos por grep de texto** — si el de
   #158 era un cero en falso, los demás del repo con la misma forma también pueden serlo.
