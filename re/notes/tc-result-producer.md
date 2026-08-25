# ACTA — T-C: el PRODUCTOR de `result` (TOWN 0x159a) y el ciclo de `[0x65bf]`

Tarjeta **T-C** de `re/notes/talk-031e-resolucion.md` §5. Cierra la pregunta que aquella
acta dejó abierta en su §3.3: «el limitador de tasa interno de 0x1912 NO EXISTE … la
rareza de la demanda hay que buscarla en el PRODUCTOR de `result` (la escritura de
0x159a), el armado de `[0x65bf]` y el marcador `[0x65be]`».

Todas las lecturas son de primera mano sobre `re/disasm/{TOWN,TALK,NPC,CMDS}.OVL.asm` y
`re/disasm/ULTIMA.EXE.asm`. **Ningún destino de near-call se ha deducido del número
impreso**: todos van resueltos con `re/tools/dispatch_table.py`
(`overlay_near_call_base`, `near_calls_to_kernel`, `stubs`). El censo de las globales va
**por bytes sobre el binario**, con control positivo y control negativo (§4).

---

## §1 — `result` NO tiene un productor: tiene TRES, y sólo uno puede valer 2

`result` es `[bp-0xa]` del bucle de pueblo, TOWN 0x141e, (`re/disasm/TOWN.OVL.asm:2040`),
inicializado a **1** en 0x1431. La tecla leída queda en `[bp-6]`, 0x1492. El reparto es
por RANGO de la tecla:

| rango de la tecla | destino | cita |
|---|---|---|
| `< 0x20` | tabla de saltos LOCAL de TOWN (22 entradas en 0x1552, targets = word − 0x81d0) | 0x149d, `re/disasm/TOWN.OVL.asm:2072` |
| `'0'..'9'` | TOWN 0x0e34, near-call LOCAL | 0x1594, `re/disasm/TOWN.OVL.asm:2183` |
| resto | **kernel 0x3178**, near-call de overlay | 0x158c, `re/disasm/TOWN.OVL.asm:2180` |

```
1580: cmp word [bp - 6], 0x30 ; jb 0x158c
1586: cmp word [bp - 6], 0x39 ; jbe 0x1594
158c: push [bp-6] ; call 0xffffafa8   ; jmp 0x159a
1594: push [bp-6] ; call 0xe34
159a: mov word [bp - 0xa], ax          ← LA escritura de la tarjeta
```

**Resolución del near-call, por instrumento y no por el número impreso.**
`overlay_near_call_base(TOWN.OVL)` = **0x81d0**; `(0xafa8 + 0x81d0) & 0xFFFF` =
**0x3178**, y `near_calls_to_kernel('TOWN.OVL', 0x3178)` devuelve **exactamente
`['0x158f']`** — un único call. `near_calls_to_kernel` sobre MAINOUT y DUNGEON devuelve
`['0xc00']` y `['0x7a3']`: **una llamada por bucle de contexto**, tal y como
`re/notes/command-dispatch.md` declara para 0x3178. El otro brazo,
`(0xbeb0 + 0x81d0) & 0xFFFF` = **0x4080** (`near_calls_to_kernel` → `['0xef3']`).

### 1.1 El brazo de los dígitos NO produce 2

TOWN 0x0e34, (`re/disasm/TOWN.OVL.asm:1444`) arranca con `[bp-2] = 3` (0x0e3a) y sólo
escribe otro valor en 0x0ef6, con el retorno de kernel 0x4080. El KERNEL 0x4080,
(`re/disasm/ULTIMA.EXE.asm:7072`) es la selección de personaje activo por número:
`[bp-2] = 1` en 0x4087, `= 0` en 0x40b1, y `g_active_char` en 0x40a9/0x40da; el resto
del cuerpo no escribe ese hueco. **Rango {0, 1, 3}.** El 3, de vuelta en TOWN 0x159d,
significa «re-lee tecla»: `cmp [bp-0xa], 3 ; jne 0x15a6 ; jmp 0x148f`.

### 1.2 El brazo del kernel: el ÚNICO literal 2 del dispatcher está en la 'T'

Kernel 0x3178, (`re/disasm/ULTIMA.EXE.asm:5506`) devuelve `[bp-2]`, inicializado a **1**
en 0x317e (`:5509`). En todo el cuerpo del dispatcher (0x3178..0x351f, ret 2 en
`:5867`) hay exactamente **tres** escrituras de ese hueco:

- 0x317e — `= 1` (por defecto: el comando consume turno),
- 0x31e9, (`:5550`) — `= 0` (comando que NO consume turno),
- 0x3231, (`:5573`) — `= ax` (propaga el retorno de un entry de overlay),
- **0x3403, (`:5754`) — `= 2`. Único literal 2 del dispatcher.**

**Quién llega a 0x3403.** La cadena de comparaciones sitúa la tecla **0x54 = `'T'`** en
0x349e (línea `:5816`, donde el desensamblador está DESINCRONIZADO: los bytes reales son
`3d 54 00 / 75 03 / e9 1c ff` = `cmp ax, 0x54 ; jne 0x34a6 ; jmp 0x33c2`; el `jmp 0x33c2`
sí aparece impreso en `:5819`). El handler, 0x33c2, (`:5728`):

```
33c2: cmp [g_location], 0    ; jne 0x33e0   → MUNDO exterior: 'Talk-' + 0x35ec ; ret 1
33e0: cmp [g_location], 0x20 ; jbe 0x33f2
33e7: mov ax, 0xa22c ('Talk-Funny, no response!') → ret 1    ← loc > 0x20 (mazmorra/combate)
33f2: mov ax, 0xa246 ('Talk-') ; print
33f9: call 0x8196            ; or ax,ax ; jne 0x3403
3400: (ax == 0) → ret 1
3403: mov word [bp - 2], 2   → ret 2
```

`stubs()[0x8196]` = **TALK.OVL 0x041c**. Es decir:

> **`result == 2` ⟺ el jugador pulsó `(T)alk` estando en un pueblo/castillo
> (1 ≤ `g_location` ≤ 0x20) Y el entry TALK 0x041c devolvió ≠ 0.**

### 1.3 Qué devuelve TALK 0x041c — y por qué el 2 es «el guardia te arrestó»

TALK 0x041c, (`re/disasm/TALK.OVL.asm:435`), leída ENTERA (0x041c..0x04d1):

- 0x0422 — `call 0x766c` = **kernel 0x35ec** (base TALK 0xbf80); 0 ⇒ `sub ax,ax`, ret **0**
  (dirección abortada). Es el MISMO 0x35ec, que usa la rama de exterior de 0x33c9.
- 0x043a..0x047b — destino = party + delta; si la casilla no tiene NPC (kernel 0x368e == 0)
  pero la casilla es «atravesable de mostrador» (TALK 0x0054 ≠ 0), **avanza un paso más en
  la misma dirección** (hablar por encima del mostrador).
- 0x048d — sigue sin NPC ⇒ DS 0x91d6 `\nNobody's here!\n`, ret **0**.
- 0x04b3/0x04b8 — tile 0x9d ⇒ DS 0x91f6 `\nNo response!\n`; tile 0xab ⇒ DS 0x91e8
  `\n"Zzzzzz..."\n`; ambos ret **0**.
- **0x04c8, (`:503`) — `push [bp-2] ; call 0x31e`, y CAE al epílogo, 0x04ce, (`:505`) sin
  tocar `ax`: TALK 0x041c PROPAGA tal cual el retorno de TALK 0x031E.**

Y por `talk-031e-resolucion.md` §2 (re-verificado aquí): TALK 0x031E devuelve 0 en TODAS
sus ramas salvo la de `dlgNum == 0xFF`, que llama a TALK 0x01e2 y propaga su retorno
(0x03e2 `jmp 0x414`, sin pasar por el `sub ax,ax` de 0x38e).

⇒ **`result == 2` significa, literalmente y sin más casos: «hablé con un guardia de
dlgNum 0xFF y la demanda salió mal».** No es un estado del mundo ni un contador: es el
canal por el que el comando `(T)alk` le dice al bucle de pueblo «arresta».

### 1.4 Los otros entries de pueblo — CERRADOS por lectura del VALOR DE RETORNO

El otro camino a un valor ≠ {0,1}, 0x3231, lo alimentan los entries de A/B/C/E/K/Y. Los
alcanzables desde un pueblo son A, B, C, K, Y (la 'E' está gateada a `g_location == 0`,
0x3254).

⚠ **Primer intento, y por qué NO bastaba.** Un barrido de LITERALES sobre el cuerpo de
cada entry no encuentra ningún 2 que llegue a un `ret` (los 4 hits son `push` de
argumento). Pero eso NO cierra nada, y el control positivo lo delata: **TALK 0x041c
tampoco tiene literal 2 y ES el productor**, porque PROPAGA. Hubo que ir al valor de
retorno de cada uno:

| entry | qué devuelve | escrituras de esa ranura | rango |
|---|---|---|---|
| TOWN.OVL 0x09e6 (A) | `[bp-4]`, en 0x0b79 | 0x09ed `= 1` · 0x0a1b `= 0` | **{0,1}** |
| CMDS.OVL 0x07f6 (B) | el `ax` vivo | 0x0811 `mov ax, 1` · 0x095b `sub ax,ax`; son los ÚNICOS dos accesos al epílogo, 0x095d | **{0,1}** |
| CAST.OVL 0x0dba (C) | `[bp-6]`, en 0x11d6 | 0x0dc4 `= ax`, con el `ax` puesto a **1** por el literal de 0x0dc1 · 0x1138 `= 0` | **{0,1}** |
| TOWN.OVL 0x0b82 (K) | `[bp-2]`, en 0x0c43 | 0x0b88 `= 0` · 0x0bd8 `= 1` · 0x0c3e `= 1` | **{0,1}** |
| CMDS.OVL 0x1418 (Y) | `[bp-0x22]`, en 0x14b3 | 0x141e `= 1` · 0x1496 `= ax` de CMDS.OVL 0x1030 | ver abajo |
| TALK.OVL 0x041c (T) | el `ax` de TALK 0x031E, 0x04c8 | — (propaga) | **0, o el ret de TALK 0x01e2** |

⇒ **A, B, C y K no pueden devolver 2.** Ni por literal ni por propagación: sus ranuras de
retorno sólo reciben 0 y 1.

**Y (yell) reduce a su callee, CMDS.OVL 0x1030** (0x1030..0x1201, la rutina del
shadowlord: DS 0x4425 `'\nA shadowlord appears\n'`). Devuelve `[bp-4]`, en 0x11e4, y esa
ranura la escriben SÓLO dos sitios, 0x1038, con `= 1`, y 0x11df, con `= 0` ⇒ **{0,1} por su vía normal**. Pero su
epílogo, 0x11fa, tiene **TRES** entradas, no una: además de 0x11e7, la que carga
`[bp-4]`, entran también 0x1086 y 0x10aa — **dos vías de error que saltan al epílogo SIN escribir
`ax`**, justo tras imprimir DS 0x440b / DS 0x4418 `'\nNo effect!\n'` con el kernel 0x1850.
Y el kernel 0x1850 es void-ish: su `ax` en el `ret`, 0x1a3b, es el residuo de un cálculo
(0x19f1 `sub ax, dx`), no un código de retorno.

⇒ **En A/B/C/K/Y no hay NINGÚN 2 por diseño.** Lo único que sobrevive no es «otro
productor de 2» sino un `ax` INDETERMINADO en dos ramas de error (§6, residuo R1).

---

## §2 — El ciclo de vida de `[0x65bf]` y `[0x65be]`: UN TURNO, y sin persistencia

El consumo de `result` está en 12 instrucciones seguidas, TOWN 0x1662..0x1683
(`re/disasm/TOWN.OVL.asm:2258-2271`):

```
1662: cmp word [bp - 0xa], 2 ; jge 0x1671        ← result >= 2 SALTA la llamada de abajo
1668: mov al, [g_hour] ; sub ah,ah ; push ax
166e: call 0xfffff8e2                            = stub 0x7ab2 → NPC.OVL 0x0db4
1671: cmp byte [0x65bf], 0 ; jne 0x167e
1678: cmp word [bp - 0xa], 2 ; jne 0x1686
167e: mov ax,[bp-0xa] ; dec ax ; push ax ; call 0x1352   = npc_engine(result − 1)
```

`(0xf8e2 + 0x81d0) & 0xFFFF` = **0x7ab2**, y `stubs()[0x7ab2]` = **NPC.OVL 0x0db4**
(instrumento, no lectura del número impreso).

**NPC.OVL 0x0db4, (`re/disasm/NPC.OVL.asm:1358`), limpia AMBAS globales en su prólogo:**

```
0dc1: mov byte [0x65be], 0     (re/disasm/NPC.OVL.asm:1364)
0dc6: mov byte [0x65bf], 0     (re/disasm/NPC.OVL.asm:1365)
0dcb: mov word [bp - 2], 1     ← idx = 1 ; jmp al test del bucle
1267: cmp word [bp - 2], 0x20 ; jge (salir)      (re/disasm/NPC.OVL.asm:1791)
1270: cmp byte [bx + 0x659e], 0 ; je (siguiente idx)
1261: call 0xd00                                  (re/disasm/NPC.OVL.asm:1789)
```

y NPC.OVL 0x0d00 es el ÚNICO llamador de NPC.OVL 0x06e4, y el barrido de bytes `E8 rel16`
sobre NPC.OVL ⇒ callers de 0x06e4 = **`['0xd97']`**, callers de 0x0d00 = **`['0x1261']`**,
callers de 0x0db4 = **`[]`** (sólo se entra por el stub). La cadena, cerrada:

> **stub 0x7ab2 → NPC.OVL 0x0db4, que LIMPIA → 0x0d00 → 0x06e4, que ARMA → vuelta a TOWN 0x1671
> (lee).**

**El fast-path que ARMA, NPC.OVL 0x06e4, (`re/disasm/NPC.OVL.asm:683`), leído literal:**

```
071d: call 0x6a0 → manhattan          0723: cmp ax,1 ; jne 0x75a   (no adyacente → loop de MOVIMIENTO)
0728: cmp [bp-2], 3 ; jle 0x75a       ← aiType <= 3 → loop
072e/0734: aiType == 4 || == 5 → 0x73d      073a: (6/7) → 0x7be
073d: bx = rt ; cmp word [bx + 0xa], 0 ; je 0x75a    ← dlgNum == 0 → loop, NO arma NADA
0746: mov byte [0x65be], 0x74         (re/disasm/NPC.OVL.asm:720)
074b: mov al, [bp + 6]                ← el ÍNDICE del NPC, argumento
074e: mov byte [0x65bf], al           (re/disasm/NPC.OVL.asm:722)
0751: [bp-2] = 1 ; jmp 0x92f          ← y SALE: ese NPC no se mueve este turno
07be: mov byte [0x65be], 0x61         (re/disasm/NPC.OVL.asm:763)   ← aiType 6/7, hostil
```

### 2.1 Las cuatro consecuencias mecánicas

1. **`[0x65bf]` NO persiste entre turnos.** Se pone a 0 en el prólogo de cada pasada de
   NPCs y se lee 3 instrucciones después de que la pasada termine. Su vida útil es una
   ventana de un turno; **no hay memoria de «este guardia ya me paró»**.
2. **No hay limitador de tasa, en ninguna capa.** Ni en TALK 0x031E ni en TALK 0x01e2
   (§3) ni aquí. La condición completa para que la intercepción dispare cada turno es
   `manhattan == 1 ∧ aiType ∈ {4,5} ∧ dlgNum ≠ 0` — se re-evalúa entera, desde cero, en
   cada turno de pueblo. ~~**Estar pegado a un guardia de palacio dispara la demanda TODOS
   los turnos.**~~

   🔴 **CORREGIDO POR #304 (14-08) — la frase tachada es FALSA, y el resto de este punto
   es cierto.** No hay ningún limitador *dedicado*: en eso esta acta acierta. Pero la
   condición, al re-evaluarse «desde cero», lee un dato que **el despacho anterior mutó**.
   El prólogo de `talk_converse_dispatch` —que esta acta nombra pero **no abrió**— hace,
   ANTES del reparto por `dlgNum`:

   ```
   0350: cmp byte ptr [si], cl   ; cl = 4, si = &aiTypes[tramo] (0x5d5e + idx*16)
   0354: mov byte ptr [si], 1    ; el aiType 4 pasa a 1, EN LA TABLA VIVA
   ```

   y el `aiType == 4` es justo uno de los tres conjuntos de la condición (NPC.OVL 0x0728
   `cmp [bp-2],3 / jle`). ⇒ **el guardia demanda UNA vez por entrada al pueblo**, no todos
   los turnos: no por memoria, sino porque se desarma a sí mismo. Los 13 guardias de
   tributo de la extracción son aiType **4** (cero llevan 5, que es el que NO se
   normaliza: el `cmp` es igualdad). La tabla sólo recupera el 4 al recargar el `.NPC`
   entrando al mapa. Derivación entera y censo en `tienda-proximidad-304.md` §3.

   ★★ La lección de método, que es lo que hace falta que sobreviva: **«se re-evalúa desde
   cero» no implica «da el mismo resultado»** si alguno de los operandos es estado vivo que
   la propia rutina escribe. Censar los MARCADORES (que era lo que esta acta hacía, y bien)
   no cubre los operandos.
3. **Gana el ÚLTIMO, no el primero.** El bucle recorre idx ascendente 1..0x1f y cada
   fast-path PISA `[0x65bf]`. Con dos guardias adyacentes, el que llega a TOWN 0x1352 es
   el de índice MAYOR.
4. **`result == 2` se salta la pasada de NPCs entera** (0x1662 `jge 0x1671`). En el turno
   del arresto-por-(T)alk, `[0x65bf]` y `[0x65be]` conservan lo que dejó el turno
   anterior — y da igual, porque la disyunción de 0x1671/0x1678 pasa por el segundo
   término y TOWN 0x13b4 salta a 0x13d6 **sin leer `[0x65bf]`**.

### 2.2 Corrección a `blackthorn.md` §2.1b/§2.1c y un consumidor NO censado

El censo por bytes (§4) contradice en un punto la prosa vigente y añade un consumidor:

- `blackthorn.md` §2.1c dice de `[0x65be]`: «**2 escrituras** 0x0746/0x07be, ambas
  post-adyacencia». **Son TRES**: falta el reset **NPC.OVL 0x0dc1** (`= 0`). La
  conclusión de aquella acta no cambia (las dos que ARMAN siguen siendo post-adyacencia),
  pero la cifra sí, y el reset es justo la pieza que prueba la no-persistencia de §2.1.
- El censo de `[0x65bf]` («EXACTAMENTE 2 escrituras, 0x074e y 0x0dc6») **se confirma**.
- **Consumidor nuevo, fuera de TOWN: `CMDS.OVL 0x05c2`,
  (`re/disasm/CMDS.OVL.asm:551`) — `cmp byte [0x65be], 0x61 ; jne 0x5d0`.** El prólogo que
  lo contiene es CMDS.OVL 0x0552, y `stubs()` lo ata al stub **0x802e**, que el
  dispatcher llama en 0x32c6 tras exigir tile `0xab` y estampar DS 0xa170 `'Hole up- '` /
  DS 0xa17a `'Only in bed!\n'`: es el acampar/descansar. Dentro de su bucle horario, el
  marcador `0x61` (NPC **hostil** adyacente, aiType 6/7) **rompe el descanso**. No es la
  vía del tributo (0x74 ≠ 0x61), pero es una lectura de la global que ninguna acta
  registraba, y toca al port si algún día se calca la interrupción del campamento.

---

## §3 — TALK 0x01e2 releída ENTERA: el mecanismo del tributo, y CERO estado

`re/disasm/TALK.OVL.asm:202-325` (0x01e2..0x031c). Tres ramas por `g_location`:

**(a) `g_location == 0x12` (Palacio) — 0x01e9 → 0x02a4, (`:278`)**
```
02a4: cmp byte [g_time_spell], 0x1d ; je 0x2ae ; else jmp 0x216 (mov ax,1 / ret)
02ae: '"' + DS 0x90fc + '"' + DS 0x9128 ; getstring(0xe) → [bp-0x10]     (kernel 0x3b1c)
02e0: push 0x4a9a ; push &[bp-0x10] ; call 0    ; or ax,ax ; jne 0x2f2 ; else ret 1
02f2: DS 0x913a 'Pass, friend!' → jmp 0x22b (sub ax,ax) → ret 0
```
DS 0x90fc = `'Give now the\npassword, bearer\nof the Badge!'`; la constante **DS 0x4a9a
resuelve en DATA.OVL 0x4aaa a la cadena `IMPE`**. Sin la insignia (`≠ 0x1d`) el retorno
es 1 **antes de imprimir nada**: arresto SILENCIOSO.

**(b) `g_location == 5` (Minoc) — 0x01f3 → 0x01fa**
DS 0x90a2 = `'Thou wilt give\nhalf thy gold to\ncharity!'`; prompt sí/no, y si acepta:
`cx=2 ; ax=g_gold ; cdq ; idiv cx ; g_gold = ax` (0x021c..0x0225) — **la mitad del oro**,
luego kernel 0x2900 y ret 0.

**(c) resto de pueblos — 0x0230**
```
023a: si party_size != 0: si = 0x55b3 ; dx = si + (party_size << 5)
025a: cmp byte [si], 0x44 ; je (saltar) ; else cx += 0xa ; si += 0x20   (:248)
0269: [bp-0x14] = cx
026c: DS 0x90cc 'A guard demands\na ' + print_number(cx,2,0x20) + DS 0x90e0 ' gp tribute\nto Blackthorn!'
0288: call 0xac  ; or ax,ax ; jne 0x216      ← NO ⇒ ret 1 (arresto)
028f: cmp [bp-0x14], g_gold ; ja 0x216       ← no lo puede pagar ⇒ ret 1 (arresto)
029a: g_gold -= [bp-0x14] ; → 0x228 kernel 0x2900 ; ret 0
```

> **La tarifa es `10 gp × (miembros de la party cuyo byte de estado en 0x55b3 + i·0x20 NO
> es `0x44` = 'D')`.** El registro de party mide 0x20 bytes y su byte 0 es el estado; que
> `'D'` sea muerto lo corrobora, independientemente, kernel 0x40c9/0x40d0, que descarta
> `0x44` y `0x53` ('S', dormido) al elegir personaje activo.

**Polaridad del sí/no, verificada.** TALK 0x00ac, (`re/disasm/TALK.OVL.asm:79`): imprime
DS 0x9052 `'\n\nDost thou pay?\n\n:'`, y en bucle: `'Y'` (0x59) ⇒ DS 0x9066 `'Yes\n'` y
**`sub ax,ax` = 0**; `'N'` (0x4e) ⇒ DS 0x906c `'No!\n'` y **`mov ax,1` = 1**; cualquier
otra tecla vuelve a leer. ⇒ en 0x0288 `jne 0x216` con retorno 1 = **el jugador dijo NO**;
en la rama de Minoc, 0x0214 `je 0x21c` con retorno 0 = **dijo SÍ y paga**.

**Y lo que NO hay.** En las 0x13b bytes de TALK 0x01e2 las ÚNICAS escrituras a estado
global son las de `g_gold`: en 0x0225, la mitad; en 0x029d, la resta. **Cero flags, cero contadores, cero
marcas por-NPC, cero marca de día.** El «pase» del password no se guarda en ninguna parte:
`'Pass, friend!'` sólo devuelve 0 para ESA interacción. Esto confirma por segunda vía la
§3.2 de `talk-031e-resolucion.md` y ahora también para la vía del TRIBUTO, que aquella
acta no había abierto.

---

## §4 — El censo: por bytes, con control positivo Y control de FORMA

Instrumento: barrido del par de bytes del `disp16` sobre los 24 ficheros de código del
pool de `re/tools/binfiles.py` (DATA.OVL excluido: es datos), re-desensamblando desde los
7 bytes previos y aceptando la instrucción que (a) empieza en el candidato, (b) CUBRE el
par y (c) capstone renderiza con la dirección absoluta.

🔴 **El primer intento dio CERO en falso para `[0x65be]`, y la culpa era del filtro, no
del binario.** La v1 exigía que la instrucción TERMINASE justo tras el `disp16` — cierto
para `A2/A3 disp16` y `8A/8B` pero **falso para las formas con inmediato** `C6 06 disp16
ib` y `C7 06 disp16 iw`, que son precisamente las tres escrituras de `[0x65be]`. Se
detectó porque el control positivo elegido (`g_location`, DS 0x5893, población grande)
**no cubría esa FORMA**: da 290 instrucciones sin necesitar ni una con inmediato. Se
añadió entonces un control positivo **de forma** (DS 0x594f, con `mov byte [x], imm` en
CMDS.OVL 0x0d36, COMBAT.OVL 0x0bcf, TOWN.OVL 0x041d/0x07e6) y un control **negativo**, la
vecina inmediata DS 0x65c0 ⇒ **0 instrucciones**. Con los tres controles a la vez, el
censo:

| global | instrucciones | ESCRITURAS (excluidas `cmp`/`test`/`push`) |
|---|---|---|
| `[0x65be]` | 6 (1 basura de desincronía: `shufps` en 0x07bd) | **3**: NPC.OVL 0x0746 `= 0x74`, NPC.OVL 0x07be `= 0x61`, NPC.OVL 0x0dc1 `= 0` |
| `[0x65bf]` | 12 (2 basura: `and` en TOWN 0x1398 y 0x1401, que se comen el `a0 bf 65` siguiente) | **2**: NPC.OVL 0x074e `= al`, NPC.OVL 0x0dc6 `= 0` |

Lecturas de `[0x65bf]`: TOWN.OVL 0x135e, 0x1380, 0x1399, 0x13ba, 0x13e2, 0x1402, 0x140e
(todas dentro de `npc_engine`) y **TOWN.OVL 0x1671** (el gate). Lecturas de `[0x65be]`:
TOWN.OVL 0x1379 y **CMDS.OVL 0x05c2** (§2.2).

**Cero escrituras fuera de NPC.OVL, en los 24 ficheros.** Y este cero SÍ está calibrado:
el mismo instrumento, en la misma corrida, encuentra 3 escrituras con la forma que el
filtro v1 se comía.

---

## §5 — Veredicto: el limitador real, y por qué el port está aparcado de más

> 🔴 **§5 CORREGIDA POR #304 (14-08).** El veredicto «sin memoria / todos los turnos» se
> mantiene para los MARCADORES y se **retira** como conducta observable: el prólogo
> 0x0348-0x0354 de `talk_converse_dispatch` normaliza el `aiType 4 → 1` y desarma el
> disparador. Frecuencia real = **una vez por NPC y por entrada al pueblo**. Lo tachado
> abajo queda para que nadie lo reabra desde el texto viejo; el razonamiento entero, con
> su control positivo de que esta acta nunca leyó el prólogo, en `tienda-proximidad-304.md`
> §3.2. ⚠ Consecuencia incómoda: el modelo que el port tenía ANTES de esta acta
> (`npc.tributeDemanded`, «1 por entrada de pueblo») describía bien la conducta y fue
> retirado por «conservador». Vuelve a ser el correcto — ahora derivado.

**El limitador que el port espera no existe en ninguna de las dos vías.** Lo que hay son
dos disparadores distintos, ambos sin memoria:

**Vía B — INTERCEPCIÓN (la iniciada por el NPC), `result == 1`.**
Cada turno de pueblo: pasada de NPCs (limpia) → un guardia con `manhattan == 1`,
`aiType ∈ {4,5}` y `dlgNum ≠ 0` arma `[0x65be] = 0x74` y `[0x65bf] = idx` → TOWN 0x1671
pasa → `npc_engine(0)` → 0x1379 marcador ≠ 0x61 → 0x13b4 `[bp+4] == 0` → 0x13ba `dlgNum ≠ 0`
→ 0x13ce TALK 0x031E → `0xFF` → TALK 0x01e2 → ret ≠ 0 → 0x12ae captura.
**Frecuencia real: TODOS los turnos que pases adyacente al guardia.** Su rareza en los LPs
no es un limitador: es que no se suele estar pegado a un guardia de palacio.

**Vía A — (T)alk (la iniciada por el jugador), `result == 2`.**
`'T'` en pueblo → TALK 0x041c → TALK 0x031E → `0xFF` → TALK 0x01e2 → ret 1 → dispatcher
0x3403 → `result = 2` → **se salta la pasada de NPCs** → `npc_engine(1)` → 0x13b4 salta
directo a 0x12ae. Si TALK 0x01e2 devuelve 0 (pagó / dijo IMPE), TALK 0x041c devuelve 0, el
dispatcher deja `[bp-2] = 1` y el turno es normal.

**Las dos vías desembocan en la MISMA rutina, TALK 0x01e2, con el mismo estado y sin
distinguir quién la invocó.** Ésa es la simetría que el port rompe hoy.

### Estado de la tarjeta

| pieza de T-C | estado |
|---|---|
| productor de `result == 2` | **DERIVADO** (§1.2/§1.3), único literal + semántica |
| productor de `result == 1` | **DERIVADO**: es el DEFECTO del dispatcher (0x317e), no un cálculo |
| ciclo de `[0x65bf]`/`[0x65be]` | **DERIVADO Y CERRADO** (§2, §4): un turno, sin persistencia |
| «limitador interno» | **DERIVADO COMO INEXISTENTE**, ahora también en la vía del tributo |
| fórmula del tributo | **DERIVADA**: 10 gp × miembros no-'D' (§3c) |
| exclusividad de A/B/C/K/Y | **COTA**, no cierre (§1.4, residuo R1) |

---

## §6 — Residuos declarados

- **R1 — CERRADO en lo esencial, con un hazard nombrado.** La exclusividad de
  `result == 2` ya no es cota: se leyó el valor de retorno de los cinco entries de pueblo
  (§1.4) y A/B/C/K sólo devuelven 0 o 1; Y reduce a CMDS.OVL 0x1030, que devuelve {0,1}
  por su vía normal. **Ningún comando de pueblo produce un 2 por diseño salvo la 'T'.**
  Lo que queda es OTRA cosa y merece su propia tarjeta: CMDS.OVL 0x1030 deja `ax`
  **INDETERMINADO** en dos ramas de error, 0x1086 y 0x10aa, y ese `ax` viaja a
  `[bp-0x22]` de Y, de ahí a `[bp-2]` del dispatcher y de ahí a `result`. Si alguna vez
  valiese 2, un `'\nNo effect!\n'` de yell ARRESTARÍA a la party. No es un mecanismo: es
  un `ax` sin inicializar del compilador. No se calca; se anota.
- **R2 — kernel 0x2900**, llamado tras pagar en las dos ramas de PAGO (0x0228), no se ha
  leído. No afecta al retorno: en 0x022b, `sub ax,ax` lo fuerza a 0, pero podría imprimir o alterar
  algo visible.
- **R3 — TALK 0x0000** (el comparador que valida `IMPE`, 0x02e8) no se ha leído: se
  asume comparación de cadena por el argumento y la polaridad `jne` ⇒ «≠0 = coincide».
- **R5 — el comando (T)alk del clon no consume turno de mundo** (`main.ts:2381`). En el
  binario sí (`result` 1 o 2 alimenta el bucle de pueblo), y de ahí sale la Diferencia 2
  de §8.1: el turno de `result==2` suprime la pasada de NPCs. Mientras el hueco siga, esa
  supresión no es observable; cuando se cierre, hay que calcarla. No lo tapa este cambio.
- **R4 — MAINOUT 0x0c00 y DUNGEON 0x07a3** reciben el mismo `result` del mismo
  dispatcher. Este acta NO ha mirado qué hacen sus bucles con un 2. Fuera del alcance de
  T-C, pero es población conocida y sin adjudicar.

---

## §7 — Propuesta de cableado (TARJETA — **no aplicada**, este carril no toca el port)

El limitador conservador del port es doble: `npc.tributeDemanded` (marca por NPC, que
convierte la demanda en «una vez») y `guardTributeTrigger.enabled = false` (el sistema
entero aparcado). El binario no tiene ninguno de los dos. Cableado fiel propuesto, para
que el lead lo adjudique:

1. **Retirar `npc.tributeDemanded`.** No hay contrapartida en el binario: §3 prueba cero
   escrituras de estado en TALK 0x01e2 y §2.1 prueba que `[0x65bf]` se limpia cada turno.
   La demanda es RE-ENTRANTE por diseño.
2. **Encender `guardTributeTrigger`** con la guarda literal de NPC.OVL 0x06e4, evaluada
   cada turno de pueblo y en este orden: `manhattan(party, npc) == 1` **∧**
   `aiType ∈ {4,5}` **∧** `dlgNum ≠ 0`. Nada más: sin RNG, sin cooldown, sin marca.
3. **Desempate por índice.** Si hay varios candidatos en el turno, gana el de índice
   MAYOR (§2.1.3) — hoy el port no modela ese desempate.
4. **Unificar las dos entradas** en una sola función `guardDemand(npc)` con el corte por
   `location` de §3 (0x12 = insignia+password; 5 = mitad del oro; resto = tributo), y
   llamarla desde **ambos** sitios: el turno de mundo (intercepción) y el comando
   `(T)alk`. Hoy el port sólo la tiene colgada de `(T)alk`; ése es el bug que comparte con
   la tarjeta T-A.
5. **Fórmula del tributo**: `10 × (miembros con estado ≠ 'D')`. Rehusar **o** no poder
   pagarlo ⇒ arresto; pagar ⇒ `gold -= tributo` y el turno sigue. Minoc: `gold = floor(gold / 2)`
   (`idiv` con signo sobre el word, 0x021f).
6. **Cerrar R1 antes de sellar** cualquier test que afirme exclusividad del 2.

Fuera de alcance de esta tarjeta pero destapado aquí: la interrupción del descanso por NPC
hostil adyacente (CMDS.OVL 0x05c2, §2.2) merece tarjeta propia.

---

## §8 — APLICADO (2026-07-30, rama `re/blackthorn-fiel`)

La propuesta de §7 está IMPLEMENTADA. Lo que cambió en el port, y lo que eso implica:

**Retirados** (eran modelo del clon, no del binario): `guardTributeTrigger.enabled`
(gate `false` que aparcaba el sistema entero), `npc.tributeDemanded` (limitador «1 por
entrada de pueblo») y `state.blackthornPassGranted` (pase PERMANENTE) — este último
también de `saveNative`, del API de depuración y del editor de saves.

**Cableado nuevo:**
- **T-A** — con `wornBadge`, la intercepción arma el reto de password en vez de capturar
  (`CaptureCtx.challengePassword`), y el FALLO escala a la escena de captura
  (`GuardCtx.runCapture` → `runCaptureScene`). El origen del reto viaja en el propio
  prompt (`{ from: "talk" | "interception" }`) porque decide qué pasa al fallar.
- **T-B** — acertar ya no escribe nada: el turno siguiente, con el guardia pegado, se
  re-reta. Un `blackthornPassGranted` heredado de un save viejo ya NO suprime la captura
  (hay test que lo fija).
- **F2-T4** — `checkGuardTribute` calca el fast-path: `manhattan == 1`, `aiType > 3`,
  `dlgNum != 0` para 4/5, y **el candidato de índice MAYOR PISA a los anteriores**. Un NPC
  normal de índice mayor ABSORBE el slot y suprime la demanda del guardia de índice menor.

⚠ **EL CALCADO REAL MOVERÁ SELLOS DEL TOUR, Y ESO ES ESPERADO.** El ruling 2026-07-22
aparcó este sistema por PARIDAD DE CADENA: con el modelo conservador el tour convergía, y
el disparo por adyacencia lo hacía dependiente del camino (ch05-Minoc disparaba en una
corrida y no en otra), rompía el tour de economía drenada (oro≈1 ⇒ pagar imposible ⇒
arresto ⇒ teletransporte a Yew a mitad de ch06 + llaves confiscadas) y cascadeaba de ch08
a ch09+. Nada de eso era un defecto del calcado: era el síntoma de que el modelo
conservador NO es el mecanismo. Ahora el mecanismo está derivado, así que **cualquier
sello del tour que se mueva se adjudica CONTRA esta acta** (§2 y §4), no contra el modelo
viejo. Un sello que NO se mueva donde la derivación dice que debería moverse es la señal
de alarma, no al revés.

**★ §6 APLICADO (ruling del lead, 2026-07-30): la vía (T)alk falla ⇒ ARRESTA.** Lo que
era residuo declarado está calcado. Cadena completa: `guard_demand` ret 1 → lo propaga
TALK 0x031E, en 0x03e2 → lo vuelve a propagar TALK 0x041c, en 0x04c8, de donde sale el
`result = 2` del dispatcher (kernel 0x3403) → TOWN 0x1678 pasa por el segundo término de
la disyunción → npc_engine(1) → 0x13b4 `jne` → 0x12ae.

### 8.1 — ¿Son el MISMO camino las dos escaladas? El destino sí; upstream NO

Pregunta del lead antes de unificarlas, derivada leyendo `npc_engine` (TOWN 0x1352)
entero, (`re/disasm/TOWN.OVL.asm:1959`):

- **El DESTINO es idéntico**: las dos llegan a 0x13d6 `call 0x12ae`, y 0x12ae RE-GATEA
  para ambas (`cmp [g_location],0x12` en 0x12b9, y `party_conscious_state >= 0` en
  0x12c0/0x12c5). Por eso unificar la ESCENA es correcto — y por eso el cableado hace
  pasar la escalada por ese gate, no por debajo de él.
- **Diferencia 1 — quién corre la demanda.** Con `[bp+4]==1` (vía (T)alk) la comparación
  0x13b4 salta a 0x13d6 **sin releer `dlgNum`** (el `cmp word [bx+0x5f68],0` de 0x13c7 ni
  se ejecuta) y **sin volver a llamar a TALK**: la demanda ya corrió durante el comando.
  Con `[bp+4]==0` (intercepción) la demanda corre DENTRO de npc_engine, en 0x13cf, y la
  captura queda condicionada a su valor de retorno — 0x13d2, `or ax,ax ; je 0x13dc`. En ambos casos
  **la demanda corre EXACTAMENTE UNA VEZ** — no hay doble cobro ni doble reto.
- **Diferencia 2 — la pasada de NPCs.** El turno de `result==2` **NO la corre**: TOWN
  0x1662 `cmp [bp-0xa],2 / jge 0x1671` se salta el `call` al stub 0x7ab2. En el turno de
  la intercepción esa pasada SÍ corrió (es la que armó `[0x65bf]`). ⚠ Hoy esta diferencia
  es **INOBSERVABLE en el port**, y por un hueco APARTE y preexistente: el comando (T)alk
  del clon **no consume turno de mundo** (`main.ts:2381` aplica los eventos y vuelve). Se
  declara como residuo propio (R5) en vez de darlo por bueno: el día que (T)alk consuma
  turno, esa supresión de la pasada hay que calcarla.

### 8.2 — Esto mueve AÚN MÁS sellos del tour

El calcado de F2-T4 ya movía sellos (arriba). Añadir la escalada por (T)alk amplía la
población: **cualquier punto del tour donde se hable con un guardia del Palacio y se falle
el password pasa de «no ocurre nada» a ARRESTO** (captura + interrogatorio, o depósito
directo con los 8 santuarios caídos), con confiscación de llaves y reubicación. Vale el
mismo criterio de §8: se adjudican **CONTRA esta acta**, y el sello que NO se mueva donde
la derivación dice que debe moverse es la alarma.
