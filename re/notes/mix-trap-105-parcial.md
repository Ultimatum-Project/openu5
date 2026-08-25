# #105 — la TRAMPA (kernel CS 0x2FD0): derivación PARCIAL, carril interrumpido

> 🔴 **SUPERADA por `re/notes/mix-trap-105-acta.md`.** La cola de §2 está hecha entera.
> Se conserva porque el acta corrige **dos afirmaciones de aquí** y la corrección es en sí
> el hallazgo: (1) la premisa de §2.2 —«la conversión DS→fileoff de ULTIMA.EXE no es el
> +0x10 de DATA.OVL»— es **falsa**: las cadenas viven en DATA.OVL con el +0x10 de siempre,
> porque `DS` es el segmento compartido y no el fichero de la rutina; (2) «exactamente UNA
> tirada en las dos ramas» (§1.1) es un **suelo, no un conteo** — son 1..7, porque no se
> contaron los callees, que es el mismo defecto que esta tarjeta denunciaba. Y el nombre
> `combat_actor_take_damage` que el gate le hizo poner está **rancio**: hoy es
> `party_char_take_damage` (#59). Detalle en el acta §6. **No leer las cifras de aquí.**

> ⚠ **ESTADO: PARCIAL Y DECLARADO.** Este documento NO cierra #105. Recoge lo que quedó
> derivado y verificado, y dice con precisión qué falta, para que quien lo herede no
> re-haga lo hecho ni dé por bueno lo que no medí.
>
> Motivo de la interrupción: agotamiento de contexto del carril, no un bloqueo técnico.

---

## 1. Lo VERIFICADO (leído en `re/disasm/ULTIMA.EXE.asm`)

`0x2FD0` **no es una rutina de overlay**: vive en el kernel (ULTIMA.EXE). Por eso
`grep "call 0x2fd0"` sobre los `.asm` de overlay da **cero** — cada overlay la llama con su
propio desplazamiento de base. Ése cero es de notación, no de ausencia.

Cuerpo, una fila por sitio:

| offset | instrucción | qué |
|---|---|---|
| 0x2fd7 | `mov ax,0x28` / push | 3er arg |
| 0x2fdb | `mov ax,0xbb8` / push | 2º arg |
| 0x2fdf | `mov ax,0x1f4` / push | 1er arg |
| 0x2fe3 | `call 0x223c` | **noise_burst** — el golpe de sonido de la trampa |
| 0x2fe6 | `cmp byte [g_location], 0x7f` | ★ **GATE POR BANDA** |
| 0x2feb | `jbe 0x2ffa` | ≤ 0x7f ⇒ rama de tabla |
| 0x2ff4 | `call 0x2092` con (0, 1) | banda **> 0x7f**: `rand(0,1)` ⇒ el tipo, CRUDO |
| 0x3001 | `call 0x2092` con (0, 7) | banda **≤ 0x7f**: `rand(0,7)` |
| 0x3006 | `mov al,[bx+0x559e]` | …y el tipo sale de una **TABLA en DS 0x559e**, indexada por la tirada |
| 0x300c | `mov [bp-2],ax` | `trapKind` |
| 0x300f-0x3020 | `or ax,ax` / `cmp ax,1` / `cmp ax,2` / `cmp ax,3` | despacho de **4 casos** |
| 0x3022 | `jmp 0x306a` | tipo ≥ 4 ⇒ sale sin efecto |
| 0x3024 | `mov ax,0x5581` / `call 0x1850` | caso 0: imprime su cadena |
| 0x302e | `call 0x3abe` / 0x3032 `call 0x2a52` | caso 0: **daño** — 0x2a52 es, en el ledger, `combat_actor_take_damage` |
| 0x3038 | `mov ax,0x5588` / `call 0x1850` / 0x3042 `call 0x2fa6` | caso 1 |
| 0x3048 | `mov ax,0x5591` / `call 0x1850` | caso 2 |

### 1.1 ★ El resultado que la tarjeta pedía: **NO es «0 rand»**

`cmds.md §12` declara «0 rand» para Mix. **Falso por lectura directa**: la trampa consume
**exactamente UNA tirada en las dos ramas** — `rand(0,1)` en la banda alta y `rand(0,7)` en
la baja. Lo que cambia con la banda no es el conteo, es **el rango y la indirección**: en
la banda baja la tirada no da el tipo, da el índice de una tabla.

Ese matiz importa para cualquier paridad de stream: quien sólo apunte «1 rand» y no el
rango se equivocará de órbita en cuanto cruce la frontera 0x7f.

### 1.2 La banda 0x7f, en su contexto

El discriminador `g_location > 0x7f` es la MISMA frontera que ya adjudicó #150 para
`revealSecretDoor` (allí, `floor >= 0x80` = sótano/Underworld). Aquí gatea el **sorteo del
tipo de trampa**. No lo cierro como «es la misma semántica»: sólo dejo anotado que el
número coincide y que quien lo herede debe cotejarlo, no asumirlo.

---

## 2. Lo que NO está hecho (y no debe darse por bueno)

1. **El call-site de Mix.** No localicé qué offset de CMDS invoca 0x2FD0 al mezclar mal.
   `grep "call 0x2fd0"` no sirve (§1); hay que buscar por el desplazamiento
   `(0x2fd0 − base_del_overlay) & 0xFFFF` **o** por la vía del despachador. Sin ese
   call-site NO está probado que la trampa de Mix sea ésta y no otra.
2. **Las 4 cadenas** (DS 0x5581 / 0x5588 / 0x5591 / la del caso 3). Intenté volcarlas y **la
   conversión DS→fileoff de ULTIMA.EXE no es el `+0x10` de DATA.OVL**. No la resolví, así
   que **no hay texto verificado** y no invento ninguno.
3. **Los efectos de los casos 1, 2 y 3** — sólo leí que el 0 hace daño. `0x2fa6` (caso 1) sin
   identificar.
4. **El careo con el port**: no medido. No sé si el port lanza trampa al mezclar mal.
5. **La corrección de `cmds.md §12`**: la derivación de §1.1 la sostiene, pero no la escribí
   en la nota — queda para quien siga, con esta cita.

---

## 3. Para quien lo herede

El orden barato es: (a) el call-site de Mix, que es lo único que ata esta rutina a la
tarjeta; (b) el sesgo DS de ULTIMA.EXE, que desbloquea las 4 cadenas de golpe; (c) los
efectos 1-3; (d) el careo del port; (e) la corrección de `cmds.md §12`, que ya tiene su
derivación en §1.1 y es lo más barato de todo.

⚠ Y la precaución del día, que aquí aplica dos veces: `grep "call 0x2fd0"` dio **cero** y no
significa «nadie la llama» — significa que la notación del disasm es relativa a la base del
overlay. Un cero de censo sobre offsets **inter-overlay** no es una ausencia hasta que se
corre con el desplazamiento correcto.
