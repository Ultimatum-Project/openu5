# ESC dentro de una SALA de mazmorra (.CBT) — derivación completa

**Carril:** bancos-residuales · **2026-07-25** · Cierra el banco «ESC-en-sala» de
`PLAN-VIVO.md §BANCOS` y el residual **(i)** de `re/notes/combat-esc-flee.md`
(«offset SJOG exacto de `0xffffdafe`» — era Clase-C desde el 2026-07-20).

Convenciones: `DS x` = offset de datos; fileoff DATA.OVL = `DS + 0x10`. Thunks
`call 0xffffXXXX` resueltos con la receta de `re/notes/overlay-load-layout.md §3`
(`re/tools/dispatch_table.py`).

---

## 0. Resultado en una frase

El ESC de combate **no tiene una rama de sala propia**: es el MISMO handler que el de
arena (`CMDS.OVL 0x17ec`), y ese handler lleva **un gate de sala explícito
(`0x1822`) colocado ANTES del gate de victoria (`0x183a`)**. Consecuencia:
**dentro de una sala de mazmorra el ESC NUNCA retira a nadie ni cierra el combate,
ni siquiera con la sala ya ganada** — sólo imprime `Escape-Not here!`.

---

## 1. El thunk, resuelto (residual (i) CERRADO)

```
COMBAT.OVL 0x0838   call 0x83dc            ; lector de tecla del turno del PJ
COMBAT.OVL 0x0864   cmp ax, 0x1b           ; ESC
             0x0869 jmp 0x9dc
COMBAT.OVL 0x09dc   call 0xffffdafe        ; ← el thunk que estaba sin resolver
             0x09df jmp 0x974              ; guarda AX y vuelve al bucle de comando (0x7ba)
```

Resolución mecánica:

| paso | valor |
|---|---|
| `near_call_base(COMBAT.OVL)` | `0xa290` (load_seg 0x0a29, nreloc=0) |
| `CS = (0xa290 + 0xdafe) & 0xFFFF` | **`0x7d8e`** |
| `0x7d8e < 0x81D0` → residente, y cae en la tabla de STUBS (0x7A16+) | `dispatch_table.stubs()[0x7d8e]` |
| stub | `overlay_num=15` → **`CMDS.OVL`**, `entry_file_off = 6124 = 0x17EC` |

⇒ **ESC de combate = `CMDS.OVL 0x17ec`.** Coincide con la rutina que
`combat-esc-flee.md` ya había localizado por otra vía (`combat_escape_check`) sin
poder demostrar que fuera el destino del ESC. Ahora está demostrado.

---

## 2. `CMDS.OVL 0x17ec` completo

```
17ec  push bp; mov bp,sp; sub sp,8; push di; push si
17f4  push 0x4574 ; call 0x58d0        ; imprime "Escape"        (SIEMPRE, sin \n)
17fb  ax=0 → [bp-4]=0 (retorno) ; [bp-2]=0 ; [bp-6]=0
1806  si = 0xba16                      ; tabla de 0x20 registros de combatiente, stride 8
180d  al = [si] ; and al,0xa0 ; cmp al,0x80
1813  jne 0x182e                       ; ¿registro = jugador ACTIVO? (bit 0x80 puesto, 0x20 limpio)
1815  dx = 1                           ; sí → hay party en el tablero
182e  si += 8 ; cx++ ; cmp cx,0x20 ; jge 0x1818 ; else loop 0x180d
1818  [bp-2]=dx ; [bp-6]=cx
181e  or dx,dx ; je 0x184d             ; NADIE del party en el tablero → teardown
1822  test byte [g_unk_58a1], 0x80     ; ★ GATE DE SALA ★
1827  je 0x183a
1829  ax = 0x457b                      ; "-Not here!\n"
182c  jmp 0x1844
183a  cmp byte [g_cmb_victory_flag],0  ; gate de VICTORIA (sólo se alcanza si NO es sala)
183f  jne 0x184d                       ; victoria en CAMPO → teardown
1841  ax = 0x4587                      ; "-Not yet!\n"
1844  push ax ; call 0x58d0 ; [bp-4]=1 ; (no hay teardown)
184d  cmp [bp-4],0 ; jne 0x18af        ; retorno 1 = "no hice nada"
--- TEARDOWN (sólo victoria en campo, o party ya vacía) ---
1853  push 0x21 ; call 0x573a          ; putchar '!'  → la línea queda "Escape!"
185f  for i in 0..0x1f: si [0xba16+i*8]!=0 → call 0xffffbe02(-(i+1)) ; call 0xffff9990
1881  for i in 0..0x1f: si [0x5c5a+i*8]!=0 → call 0xffffbe02(i+1)   ; call 0xffff9990
189c  push 0x4b0,0x7d0,1,0x28 ; call 0x842e   ; glide 1200→2000 (sfx-catalog.md «Escape»)
18af  [g_unk_a9fa]=1 (redraw) ; ax=[bp-4] ; ret
```

### Los tres literales, leídos del binario (no de memoria)

| DS | fileoff DATA.OVL | bytes |
|---|---|---|
| `0x4574` | `0x4584` | `"Escape"` — **sin** `\n` |
| `0x457b` | `0x458b` | `"-Not here!\n"` |
| `0x4587` | `0x4597` | `"-Not yet!\n"` |

(La rama de teardown no imprime `\n`: `"Escape"` + `'!'` = `Escape!` y ahí se queda.)

### `g_unk_58a1` — de dónde sale el bit 0x80

`DUNGEON.OVL 0x00bf`: `mov byte ptr [g_unk_58a1], 0x82` justo antes de llamar al
combate de sala. El combate de CAMPO (`ULTIMA.EXE 0x5f86` mode=0) lo deja a 0, y el
**errante de pasillo** lo pone a **2** (`re/notes/dungeon-wanderer.md` 0x0c39-0x0c3e y
0x1d9a-0x1db5). Por tanto:

| combate | `58a1` | `&0x80` (gate del ESC) | `&0x82` (gate de triggers .CBT) |
|---|---|---|---|
| campo / overworld | 0 | no | no |
| emboscada de pasillo (errante) | 2 | **no** | **sí** |
| SALA de mazmorra (.CBT) | 0x82 | **sí** | **sí** |

⚠ Los dos gates NO son el mismo. El ESC usa **0x80** (sólo sala); los triggers de
`room-triggers.md` usan **0x82** (sala **y** emboscada de pasillo). El port modela el
ESC con `opts.roomCombat`, que se pone `true` sólo en `startDungeonRoomCombat`
(`game.ts:4953`) y `false` en la emboscada (`game.ts:5009`) ⇒ **para el ESC el mapeo
del port es correcto**. Si algún día se toca el gate de triggers, ojo: ahí la
equivalencia `roomCombat ↔ 0x82` sí colapsa dos casos distintos.

---

## 3. ¿Entonces cómo se SALE de una sala? (contexto que da sentido al gate)

`DUNGEON.OVL 0x00c4  call 0xfffffa62` → stub `0x7c32` → **`COMBAT.OVL 0x0B94`** = el
bucle de combate de sala. Su condición de salida (0x0ca6-0x0cc7):

```
0ca6  call 0xffffdbfa            ; → stub 0x7e8a → SJOG.OVL 0x1B6C = contador de bandos
0ca9  cmp [g_cmb_scratch_y],0    ; jugadores VIVOS Y NO RETIRADOS en el tablero
0cae  jne 0xce8                  ; queda party → sigue el bucle
0cb0  cmp [g_cmb_scratch_x],0    ; enemigos
0cb5  jne 0xcca
0cb7  [bp-2]=0 ; [bp-8]=1 ; jmp 0xd16   ; ambos bandos vacíos → SALE devolviendo 0
```

`SJOG.OVL 0x1B6C` cuenta saltándose los registros con `[si]==0` (hueco) o `[si]&0x20`
(**retirado/muerto** — el mismo bit que pone `0x0c0a` y que exige limpio el test
`and al,0xa0 == 0x80` del ESC).

Y el consumidor, `DUNGEON.OVL 0x00c7`: `or ax,ax ; jne 0xfa` → **sólo con AX==0** se
ejecuta el marcado de sala despejada (0x00de bit + 0x00f5 degrade) sobre la celda de
**ENTRADA** guardada en `[bp-6]/[bp-4]` (`dng_enter_room 0x0084`).

⇒ **La única salida de una sala es vaciar el bando del party del tablero: andando
fuera por un borde (o muriendo).** Por eso el ESC dice «-Not here!»: en una sala no
existe la retirada instantánea. Es coherente con `SJOG 0x1bb2` (careo T9), donde el
paso fuera del borde ecoa `Leave!` (0 enemigos) o `Escape!` (con enemigos), y con la
regla «All must use the same exit!» (`SJOG 0x1c04`, gate 0x80 — el MISMO bit).

**Matiz honesto sobre el marcado:** AX==0 exige *las dos* cosas (enemigos 0 **y** party
fuera del tablero). En el ORIGINAL ambas coinciden siempre, porque no hay forma de
terminar una sala sin vaciar el tablero — así que la lectura «gate 0x00c7 = sólo
victoria» de la auditoría #13 es operacionalmente correcta. La distinción sólo
importaría en el port, donde el ESC sí puede cerrar la sala sin que nadie salga.

---

## 4. Careo con el port

`Combat.playerEscapeQuick` (`game/src/core/combat/combat.ts:2411`):

| caso | binario | port | veredicto |
|---|---|---|---|
| campo, enemigos vivos | `Escape` + `-Not yet!`, sin turno | idem (`echo "Escape-Not yet!"`) | **FIEL** |
| campo, victoria | `Escape!` + retirada total + cierre + glide | idem | **FIEL** |
| **sala**, enemigos vivos | `Escape` + `-Not here!`, sin turno | idem (`echo "Escape-Not here!"`) | **FIEL** |
| **sala, victoria** | `Escape` + **`-Not here!`**, NO retira, NO cierra | **retira a todo el party y cierra** | **DIVERGENTE** |

La causa es de ORDEN: el port comprueba primero «¿quedan enemigos?» y sólo dentro de
esa rama mira `roomCombat`; el binario mira **sala primero** (0x1822) y **victoria
después** (0x183a). El arreglo es de dos líneas — mover el gate `roomCombat` fuera de
la condición de enemigos:

```ts
if (this.opts.roomCombat) return [{ kind: "echo", text: "Escape-Not here!" }];
if (this.anyActiveOnSide("monsters")) return [{ kind: "echo", text: "Escape-Not yet!" }];
// … retirada total (sólo campo)
```

### ✅ APLICADO el 2026-07-31 (task #28) — y el bloqueo de abajo estaba RANCIO

El parche de dos líneas está en `Combat.playerEscapeQuick`. El motivo por el que este banco lo
dejó sin aplicar —«ch35 r7 se atasca y el sello THROWea»— **se re-midió y no se reproduce** en
`main` actual: A/B en la misma ventana, `digest=7:VICTORY|0:VICTORY|2:VICTORY|1:DEADEND` con el
gate viejo **y** con el fiel. Como ese digest es ciego a si la party salió (`conquerRoom` puntúa
VICTORY con `victory && enemiesAlive===0`, sin mirar el tablero), se midió aparte con una sonda:
r7, r0 y r2 quedan en `inCombat:false` con el gate fiel ⇒ la salida ANDANDO por el borde
funciona y `escapeFirstStep` dejó de ser código muerto sin necesidad de tocarlo.

**Residuo NO tocado, por honestidad de atribución:** la rotación de `exitDir` de
`resolveArenaCombat` (nav.ts:2487) y `fleeCombat` (:2694) contradice «All must use the same
exit!» — una vez el motor fija `escapeBorder` (combat.ts:2694), cambiar de borde sólo produce
rechazos. En las salas medidas esa rama NO se ejecuta. Y **no es inerte**: rotando cuatro veces
se vuelve al borde original, así que la rotación también funciona como espera y tocarla movería
secuencias de teclas. Se deja fichado y se decide con lo que enseñe la corrida completa.

### Por qué NO se aplicaba en este carril (registro histórico)

Ya está catalogado como **divergencia declarada** (`re/deliberate-divergences.md`
addendum T9, `b5e8a895`) y el bloqueo es del ARNÉS, no del motor:

- `nav.ts:2366` (`resolveArenaCombat`, post-victoria) pulsa ESC ×2 en superficie de
  mazmorra y **retorna si el combate cerró** — hoy cierra, así que la salida ANDANDO
  que hay justo debajo (`escapeFirstStep`, BFS al borde) es **código muerto en salas**.
  Su comentario dice «en SALA el ESC post-victoria es INOCUO» — eso describe el
  comportamiento FIEL, no el actual; **está desactualizado respecto al motor**.
- `nav.ts:2542` (`fleeCombat`, desatasco tras DEADEND) hace lo mismo antes de andar.
- Con el gate fiel puesto, ambas rutas caen a la salida a pie, y se midió que
  **ch35 Hythloth r7 (par emparedado) se atasca y el sello THROWea**.

⇒ Aplicarlo exige **re-sellar la cadena de salas** (112 selladas) = ventana del lead.
Lo que este banco aporta es que la derivación ya no tiene huecos: gate, orden,
literales byte-exactos, y el porqué estructural (la sala sólo termina vaciando el
tablero). El parche está escrito arriba y es de 2 líneas.

---

## 5. Evidencia

- `re/disasm/COMBAT.OVL.asm` 0x0838, 0x0864, 0x09dc, **0x0B94** (bucle de sala),
  0x0c0a (bit 0x20 = retirado), 0x0ca6-0x0cc7 (condición de salida), 0x0cf6 (VICTORY!).
- `re/disasm/CMDS.OVL.asm` **0x17ec** completo (gate de sala 0x1822, gate de victoria
  0x183a, teardown 0x1853-0x18ac).
- `re/disasm/DUNGEON.OVL.asm` 0x00bf (`58a1=0x82`), 0x00c4 (llamada al bucle),
  0x00c7 (gate del marcado), 0x00de/0x00f5 (bit + degrade sobre la celda de entrada).
- `re/disasm/SJOG.OVL.asm` **0x1B6C** (contador de bandos), 0x1bb2 (`Leave!`/`Escape!`),
  0x1c04 (`All must use the same exit!`).
- `original/u5/ultima5/DATA.OVL` fileoff 0x4584 / 0x458b / 0x4597 (los 3 literales).
- `re/tools/dispatch_table.py` (`stubs()[0x7d8e]`, `stubs()[0x7c32]`, `stubs()[0x7e8a]`).
