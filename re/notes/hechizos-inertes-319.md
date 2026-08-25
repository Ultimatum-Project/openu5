# Ficha #319 — cinco hechizos que producen un efecto que nadie consume

Acta de derivación del carril `hechizos-319`. Sujeto: el BINARIO (CAST.OVL / CAST2.OVL /
ULTIMA.EXE) y, en cada apartado, qué hace el port hoy.

## 0. El cardinal del censo, honesto

`re/tools/censo_efectos_sin_consumidor_278.py` detecta **6 huérfanos** sobre 33 productores.
No son 6 defectos: son **5 defectos + 1 centinela adjudicado**.

`castAnimOnly` **NO es defecto**. Quedó adjudicado en el aterrizaje de #278 (`0383fd5b`),
cuyo mensaje de merge lo declara textualmente «NO es defecto: centinela deliberado — el
predicado del censo es necesario, no suficiente». No se trabaja aquí y no cuenta como avería.

⇒ La lección que ese centinela deja escrita, y que vale para cualquiera que vuelva a correr
el censo: **«producido y no consumido» es necesario pero no suficiente — hay que leer el
productor.** Un censo que dé 6 y se reporte como «6 defectos» está inflando por construcción.

Los cinco defectos: In Wis (idx 9, `peer`) · An Grav (18, `dispelField`) ·
Wis An Ylem (33, `deathVision`) · In Quas Xen (38, `illusion`) · Vas Rel Por (46, `gateTravel`).

## 1. 🔴 TRAMPA DE LECTURA — `in_wis_peer_coords` son DIEZ BYTES

`CAST.OVL:0x04a4` mide exactamente diez bytes:

```
04a4: b80200   mov ax, 2
04a7: 50       push ax
04a8: e8dbbc   call 0xffffc186
04ab: e890bc   call 0xffffc13e
04ae: c3       ret
04af: 90       nop
04b0: 55       push bp     <-- RUTINA DISTINTA: prólogo propio
```

Quien la lea «de corrido» se lleva ~140 bytes de una rutina ajena creyéndolos cuerpo del
hechizo. El discriminante es el `ret` seguido de relleno y **un prólogo nuevo**, no la
distancia a la siguiente etiqueta.

## 2. 🔴 EL TRAMPOLÍN — y por qué no basta con resolver el `ljmp`

Ninguno de los tres brazos que se leen aquí llama a rutinas de CAST.OVL. Los cuatro `call`
cruzados caen en **una tabla de trampolines de ULTIMA.EXE**, entradas regulares de 12 B:

```
80a6: 9a ec02 2e07   lcall 0x72e:0x2ec     ; gestor de overlays
80ab: 12 00          (2 B de dato — el desensamblador los decodifica como instrucción)
80ad: ea 9ce9 0000   ljmp 0:0xe99c         ; destino, ya residente
```

**Control de que la resolución acierta:** `verify_cites.resolve` deja las cuatro citas sobre
entradas de una tabla de **22 entradas idénticas**. Una base equivocada aterriza a media
instrucción, no sobre 22 `lcall 0x72e,0x2ec` alineados.

**El destino NO está en ULTIMA.EXE, y es aritmética, no opinión:** `ULTIMA.EXE` mide
36.592 B (0x8EF0) y su desensamblado llega a `0x86ee` — cubre el fichero entero.
`ljmp 0:0xE1E0` (= 57.824) no cabe dentro. Los 22 destinos caen fuera.

### 2-bis. 🔴 LA VÍA CORRECTA YA EXISTÍA: `dispatch_table.stubs()`

**Antes que nada, la corrección de método**, porque es la parte reutilizable: yo derivé a mano
lo que **una herramienta del repo ya resuelve en una llamada**. `re/tools/dispatch_table.py`
parsea la tabla de stubs del kernel (`STUB_TABLE_START = 0x7A16`) y devuelve, por dirección de
stub, el overlay y el offset:

```python
dispatch_table.stubs()[0x8106]
# Stub(addr=33030, overlay_num=18, overlay='CAST2.OVL', entry_linear=57824, entry_file_off=0)
```

Los **2 bytes de dato** de cada stub —los que el desensamblador decodifica como basura
(`adc al, byte ptr [bx+si]`)— son el **NÚMERO de overlay**. Los cuatro míos llevan `12 00` = 18
= CAST2.OVL. El destino sale de restar la base de la banda al destino lineal del `ljmp`.

Mis cuatro stubs, resueltos por la herramienta:

| stub | overlay | offset | hechizo |
|---|---|---|---|
| 0x80a6 | CAST2.OVL | 0x07bc | An Grav |
| 0x80be | CAST2.OVL | 0x06ec | In Wis (efecto) |
| 0x80fa | CAST2.OVL | 0x046c | Wis An Ylem (efecto) |
| 0x8106 | CAST2.OVL | 0x0000 | jingle (In Wis y Wis An Ylem) |

**Coinciden 4 de 4 con mi adjudicación por prólogos** (§2-ter), que queda como corroboración
independiente y como método de reserva — no como la vía primaria.

★★ **La lección es la de siempre en este repo, en un sitio nuevo: reimplementar a mano un
predicado que ya existe es donde se pierden las condiciones.** Antes de derivar una resolución
de direcciones, buscar en `re/tools/` si ya está resuelta. Mi versión funcionó, pero costó una
tarde y no cubre las bandas que la herramienta sí conoce.

**CONTROLES POSITIVOS** (obligatorios antes de fiarse de la receta), contra destinos que el
corpus ya acreditaba por vías ajenas a mí:

| cita | resuelve a | el corpus dice | |
|---|---|---|---|
| `call 0xffffc16e` | CAST2.OVL:0x0768 | «worker que escribe 0x97→0xB8 / 0x98→0xBA» (combat-spells.md:86) | ✓ |
| `call 0xffffc186` | CAST2.OVL:0x0000 | «anim de casteo efecto 6» (combat-spells.md:142) | ✓ |

El primero es además el que yo leí **y descarté por ajeno** al recorrer el disasm: el corpus
confirma que descartarlo estuvo bien. El segundo acredita, por una vía independiente, que
`CAST2:0x0000` es el despachador de jingle.

*(Nota de instrumento a favor: `verify_cites.resolve('CAST', …)` sin el sufijo devuelve
`{'error': 'overlay desconocido'}` — falla RUIDOSAMENTE en vez de devolver una resolución
plausible y falsa. El nombre lleva `.OVL`.)*

### 2-bis-2. Lo que esto dice de #110 (base COMSUBS 0xbf80 vs 0xE1E0)

🔴 **0xE1E0 no es «la base de COMSUBS»: es la base de un ÁREA COMPARTIDA por SEIS overlays**
— ZSTATS, CAST2, SHOPPES2, SHOPPES3, COMSUBS y FONT dan todos base 0xE1E0. 0xBF80 es la base
de CAST.OVL, un área anterior.

Consecuencia dura: **un trampolín no identifica su destino por sí solo.** El mismo `ljmp`
significa seis rutinas distintas según quién esté residente. Las dos cifras del corpus pueden
ser ciertas en sentidos distintos; lo que estaba mal era leer 0xE1E0 como propiedad *de
COMSUBS*.

### 2-ter. Cómo se desambigua (método, reutilizable por #311)

Candidatos plausibles desde CAST.OVL: CAST2 y COMSUBS. Los cuatro offsets son
`0x0000`, `0x046c`, `0x06ec`, `0x07bc`.

| offset | CAST2.OVL | COMSUBS.OVL |
|---|---|---|
| 0x0000 | prólogo `push bp / mov bp,sp` | prólogo `push bp / mov bp,sp` |
| 0x046c | prólogo limpio | **ni siquiera es frontera de instrucción** |
| 0x06ec | frontera limpia, cuerpo coherente | cae a media rutina |
| 0x07bc | prólogo limpio | cae a media rutina |

⇒ El residente es **CAST2.OVL**, y coincide con lo que da `stubs()` en los cuatro (§2-bis).
El control negativo va incluido: el candidato rival falla justo donde el bueno acierta.
★★ **Un destino de trampolín se adjudica con el candidato rival medido al lado, nunca con el
que encaja a solas.** Este método sirve cuando la herramienta no cubre un caso, y sirve para
CAREARLA; no para sustituirla.

### 2-ter-2. Consecuencia para #311: de «bloqueo» a ARITMÉTICA

La ficha #311 declara su far-call (`0x72E:0x2EC`) pendiente de refinamiento **por oráculo**.
Con lo de arriba, ese far-call es el *thunk del cargador de overlays* — el mismo que llevan los
22 stubs— y **resolver el DESTINO de un `ljmp` no necesita el valor relocado en runtime**: sale
en frío de (número de overlay del stub, base de banda). La vía-oráculo sigue siendo válida como
respaldo, pero deja de ser el camino obligatorio.

🔴 El matiz que evita la lectura al revés: el oráculo de #311 hace falta para **el valor
relocado del far-call en ejecución**, que es otra pregunta. Lo que aquí se desbloquea es la
resolución ESTÁTICA de destinos, no aquélla.

**Corroboración independiente:** las cadenas de estos hechizos son **contiguas** en DATA.OVL
(`", ` en DS 0x9548 y `Field destroyed!` en DS 0x954c, pegadas), lo que enlaza los dos
brazos con el mismo bloque de datos por una vía que no pasa por el trampolín.

### 2-quater. `CAST2.OVL:0x0000` es un despachador compartido

Toma un entero y lo compara con 9 (`cmp word ptr [bp+4], 9`). In Wis le pasa **2**,
Wis An Ylem le pasa **6**, y el brazo de An Grav le pasa **4** desde dentro del efecto.
Encaja con el «jingle» que la tabla de despacho ya anotaba.

### 2-quinquies. 🔴 TRAMPA: un `call 0xNNNN` PELADO dentro de un overlay NO es local

El desensamblado de CAST2 imprime `call 0x34da`, `call 0x3abe`, `call 0x3670`, `call 0x6372`,
`call 0x7b2a`… sin ninguna marca de cruce (nada de `0xffffXXXX`). Parecen locales. **No lo son:**

```
CAST2.OVL.asm  max = 0x11be     fichero = 4544 B (0x11c0)   ← el disasm cubre el overlay ENTERO
```

Todos esos destinos son **mayores que 0x11c0**, o sea que caen fuera de la imagen de CAST2.
No es que el desensamblado esté truncado —cubre el fichero completo—: es que el `call near`
es relativo al **segmento de código**, y ese segmento abarca más que el overlay.

⇒ Quien busque `0x34da` en `CAST2.OVL.asm` no lo encontrará y podrá concluir que «falta
disasm». La conclusión correcta es la contraria: **el destino existe, pero no en este
fichero.** El discriminante barato es la aritmética `destino >= tamaño del overlay`, y va
antes que cualquier teoría sobre el corpus.

**Y la resolución TAMBIÉN está ya en la herramienta** — `dispatch_table.overlay_near_call_base(o)`,
cuyo propio docstring lo dice: «base a sumar al target base-0 de un near-call para obtener el
offset kernel», con `base = load_seg*16 − overlay_reloc_header(o)`. Para CAST2 da `0xe1e0`
(sin cabecera de reloc). Con eso, los `call` pelados de mis dos hechizos resuelven así:

| en CAST2 | → ULTIMA.EXE | qué es |
|---|---|---|
| `0x34da` | `0x16ba` | putchar (In Wis) |
| `0x3abe` | `0x1c9e` | atributo de texto on/off (In Wis) |
| `0x3670` | `0x1850` | print string (In Wis) |
| `0x6372` | **`0x4552`** | **el condicional bajo hechizo de tiempo — CONSUME RNG (§5)** |
| `0x71b4` / `0x74cc` | `0x5394` / `0x56ac` | repintado (Wis An Ylem) |
| `0x3f1a` | `0x20fa` | espera de un fotograma |
| `0x7b2a` / `0x7730` | `0x5d0a` / `0x5910` | marca revelación / restaura |

### 2-quinquies-bis. 🔴 LA REGLA «MISMO ESPACIO, SIN BASE» ES FALSA — y las DOS lecturas encajan

Se propuso una regla alternativa: que `destino ≥ tamaño del overlay` cae en el residente **con
la misma numeración**, o sea buscar `0x6372` tal cual en `ULTIMA.EXE.asm`. **Medido: es falsa**,
y el motivo por el que engaña es lo importante.

**Las dos direcciones contienen rutinas REALES y plausibles:**
- `ULTIMA.EXE:0x6372` — sin fila en `0x6372` (clase #9, byte absorbido), luego `call 0x5f86` ·
  `call 0x5e4a` · `pop bp` · `ret 4`. Cuerpo trivial, coherente, legible.
- `ULTIMA.EXE:0x4552` — prólogo limpio, barrido de pool, tres `rand_range`. También coherente.

⇒ ★★ **Leer un cuerpo que encaja NO acredita la resolución de la dirección.** Las dos hipótesis
sobrevivieron a «ábrelo y mira si tiene sentido», que por eso no es un control. Lo que decide es
un control sobre la ARITMÉTICA, con un caso cuyo destino ya esté acreditado aparte.

**EL CONTROL** (`consumidor-243-acta.md:125-127` documenta SEIS conversiones, verificadas par a
par por otro carril contra el destino que declara cada comentario). Reproduzco una entera:

```
CMDS.OVL contiene `call 0x7b9c` ×3      tamaño de CMDS.OVL = 0x1d10
0x7b9c > 0x1d10   ⇒ NO puede ser local
0x7b9c + 0xbf80 (base de su banda) = 0x3b1c
ULTIMA.EXE:0x3b1c → push bp · mov bp,sp · … · mov ax,[g_kbd_buffer_on]   = input_string ✓
```

🔴 Y la trampa dentro de la trampa: **`ULTIMA.EXE:0x7b9c` TAMBIÉN existe** (el disasm llega a
0x86ee). La regla sin base habría dado ahí una respuesta con pinta de buena. El único
discriminante es que el corpus acredita `0x3b1c` por otra vía.

**TERCER CONTROL**, aportado por el lead al retractarse y verificado aquí — y es el que más
convence porque el contraejemplo estaba *en la misma fila* que él había leído:

```
SHOPPES2.OVL contiene `call 0x593c` ×1     tamaño de SHOPPES2.OVL = 0x0b20
0x593c > 0x0b20  ⇒ NO puede ser local
0x593c + 0xe1e0 = 0x3b1c                   = el mismo input_string
(su «delta 0x1e20» es la misma base en negativo: 0xe1e0 ≡ −0x1e20 mod 0x10000 ✓)
```

### LA FÓRMULA, con el envolvimiento explícito

```
residente = (destino + base_de_banda) mod 0x10000
base_de_banda = dispatch_table.overlay_near_call_base(o) = load_seg×16 − reloc_header
```

🔴 **El `mod 0x10000` NO es decorativo: los tres casos DESBORDAN los 16 bits.** Sin el
envolvimiento la fórmula no da ninguno de los tres:

| overlay | suma cruda | mod 2¹⁶ | acreditado | |
|---|---|---|---|---|
| CMDS (banda 3) | `0x7b9c + 0xbf80` = **0x13b1c** | `0x3b1c` | `input_string` | ✓ |
| SHOPPES2 (banda 4) | `0x593c + 0xe1e0` = **0x13b1c** | `0x3b1c` | el mismo, por otra banda | ✓ |
| CAST2 (banda 4) | `0x6372 + 0xe1e0` = **0x14552** | `0x4552` | §5, tres `rand_range` | ✓ |

Las **dos bandas y las seis conversiones del corpus salen de esta única fórmula**. Y el «delta
0x1e20» que circuló es `0x10000 − 0xe1e0`: la misma base expresada como resta, válida **sólo
para banda 4** — enunciarla así invita a aplicarla donde no toca.

⇒ **La resolución de §5 se mantiene.**

### 2-quinquies-ter. Las DOS autocorrecciones, con nombre

Se dejan escritas porque el par enseña más que cualquiera de las dos sola:

- **Mía (§2-bis):** derivé a mano una resolución que `re/tools/` ya hacía. La herramienta es la
  vía primaria; mi adjudicación por prólogos con candidato rival queda de **reserva y de careo**.
- **Del lead:** su lectura de `0x6372` fue **errónea dos veces** — aplicó «mismo espacio de
  numeración» sin el descuento de base (leyendo una rutina ajena de `ULTIMA.EXE.asm` en crudo) y
  **le inventó encima una explicación de clase #9** para la línea que faltaba. Él mismo lo
  clasifica: es el patrón de *la-explicación-que-reconcilia-a-todos* más el de
  *el-testigo-elegido*. La lectura cruda queda **superseded**, no borrada.

★★ Lo transferible: **una explicación que encaja con lo que ves NO es evidencia de que estés
mirando el sitio correcto.** Cuando la dirección misma está en disputa, primero se acredita la
ARITMÉTICA con un caso de destino conocido; sólo después se lee el cuerpo. Al revés, el cuerpo
siempre «tiene sentido» — las dos direcciones candidatas aquí lo tenían.

★★ Segunda instancia en el mismo día de la misma lección (§2-bis): **la resolución que iba a
derivar a mano ya estaba escrita en `re/tools/`.** Buscar ahí primero no es cortesía, es lo que
evita firmar una aritmética propia sin los descuentos que la herramienta sí aplica — aquí, el
de la cabeza de relocalización, que en overlays con `nreloc≠0` desplaza media función.

## 3. In Wis (idx 9) — es LOCALIZAR, y emite coordenadas de SEXTANTE

`CAST.OVL:0x0f72` → `push 2` (jingle) → **`CAST2.OVL:0x06ec`**, que es emisión de texto pura
(termina en `ret` en `0x0767`, sin tocar `res`, como decía la tabla de despacho).

La secuencia exacta, en orden:

| paso | binario | emite |
|---|---|---|
| 1 | `push 1; call 0x3abe` | atributo de texto ON |
| 2 | `push 0x0a; call 0x34da` | `\n` |
| 3 | `(g_party_y & 0xf0) >> 4 + 0x41` | letra `A`+nibble ALTO de Y |
| 4 | `push 0x27` | `'` |
| 5 | `(g_party_y & 0x0f) + 0x41` | letra `A`+nibble BAJO de Y |
| 6 | `push 0x9548; call 0x3670` | la cadena `", ` |
| 7 | `(g_party_x & 0xf0) >> 4 + 0x41` | letra `A`+nibble ALTO de X |
| 8 | `push 0x27` | `'` |
| 9 | `(g_party_x & 0x0f) + 0x41` | letra `A`+nibble BAJO de X |
| 10 | `push 0x22` | `"` |
| 11 | `push 0; call 0x3abe` | atributo OFF |
| 12 | `push 0x0a; call 0x34da` | `\n` |

⇒ Formato completo: `\n` `Yhi` `'` `Ylo` `", ` `Xhi` `'` `Xlo` `"` `\n`.
Cada nibble es una letra del rango `A`..`P` (0x41 + 0..15). Es la misma notación del sextante.

**Cadena verificada en crudo:** DS `0x9548` → DATA.OVL fileoff `0x9558` (convención
`fileoff = DS_off + 0x10`), bytes `22 2c 20 00` = `", `.

**RNG: CERO.** Ninguna de las doce llamadas es a `rand_range`; el cuerpo es aritmética de
nibbles y emisión. In Wis **no mueve stream**.

**Port hoy:** `game/src/core/magic/cast.ts:195-196` devuelve `{ kind: "peer" }` y **nadie lo
consume** — huérfano confirmado por el censo. No hay emisor de coordenadas en ninguna parte.

## 4. An Grav (idx 18) — dispela el campo, y el argumento es EL SONIDO

`CAST.OVL:0x0fb0` → `push 1` → **`CAST2.OVL:0x07bc`**.

1. **Gate de localización:** `cmp byte ptr [g_location], 0x80` / `jb` — este brazo es el de
   `g_location < 0x80`. El complementario salta a `0x866` (otra rama, sin leer aquí).
2. **El argumento decide el JINGLE, no el efecto:** `cmp word ptr [bp+4], 0` / `jne` →
   `push 4; call 0x0000`. Con el `push 1` de An Grav, suena; con 0, el mismo efecto es mudo.
   🔴 Quien lea el `1` como «una unidad de algo» del efecto se equivoca de campo.
3. **Celda bajo el grupo:** dirección = `(g_floor << 6) + (g_party_y << 3) + g_party_x + 0x595a`.
   Es la rejilla de mazmorra 8×8 por planta.
4. Si `tile & 0xf0 == 0x80` (hay campo bajo los pies) → se dispela **ahí**.
5. Si no → se recalcula con el delta de `g_dng_facing` (tablas de pares en `0x24d6` y `0x24de`,
   indexadas `facing*2`), **con envolvimiento `& 7`** en las dos coordenadas → la celda **DE
   ENFRENTE**.
6. Segunda comprobación `tile & 0xf0 == 0x80`; si falla → rama de fracaso en `0x85e`.
7. Éxito: **`and byte ptr [bx], 8`** — no borra la celda, **conserva el bit 3**. Y emite la
   cadena de DS `0x954c` = **`Field destroyed!`** (verificada en crudo, contigua a la de In Wis).

⇒ Dos detalles que un port «razonable» pierde: el `& 7` (envolvimiento de la celda de
enfrente dentro de la sala) y el `& 8` (la máscara preserva un bit, no escribe suelo limpio).

**Port hoy:** `cast.ts:211` devuelve `{ kind: "dispelField" }`, huérfano.

## 5. Wis An Ylem (idx 33) — es una ANIMACIÓN de 20 fotogramas, y ahí está el RNG

`CAST.OVL:0x1084` → `push 6` (jingle) → **`CAST2.OVL:0x046c`**.

```
push -1
push (g_party_x - g_chunk_origin_x)
push (g_party_y - g_chunk_origin_y)
push 0x20
call 0x7b2a                      ; marca la revelación
si = 0x14                        ; VEINTE fotogramas
bucle:
  if (g_time_spell != 0x54) call 0x6372   ; <-- CONDICIONAL
  call 0x71b4 ; call 0x74cc               ; repintado
  push 1; call 0x3f1a                     ; espera 1 fotograma
  dec si; jnz bucle
call 0x7730                      ; restaura
```

Es el mismo revelado que la tabla de despacho llamaba `white_potion_xray_reveal_anim` — o
sea, **Wis An Ylem y la poción blanca comparten animación** (toca #326, que ficha «revelado
de la poción blanca» por separado).

🔴 **RNG — CANDIDATO A VENTANA, y la forma es la de #38.** La llamada a `0x6372` está
**gateada por el hechizo de tiempo** (`g_time_spell != 0x54`). Si `0x6372` consume RNG, el
hechizo mueve stream **20 veces por lanzamiento, y sólo cuando An Tym no está activo** — un
consumo condicional invisible a una traza que no cruce las dos condiciones.

**MEDIDO: SÍ CONSUME. VENTANA OBLIGATORIA.** `0x6372` es un near-call al KERNEL, no a CAST2
(§2-quinquies): con `dispatch_table.overlay_near_call_base(CAST2.OVL) = 0xe1e0`, resuelve a
**`ULTIMA.EXE:0x4552`**, que sí está en el corpus legible. Su cuerpo (174 filas, `ret` en
`0x4701`) llama a `rand_range` (cuerpo `0x2092`) en **TRES sitios**: `0x4625`, `0x466d`, `0x469f`.

Y arranca barriendo un pool con paso 8 desde `0x595a`… no: desde **`0x5c5a`** —
`mov word [bp-0xe],0` · `shl ax,3` · `add ax,0x5c5a`— que es **el pool de 23 ranuras de la
ficha #103**. Corroboración cruzada: la aritmética de ranura coincide con la que #103 declara.

⇒ **Wis An Ylem mueve stream**, y de la peor forma para la paridad:
- se consume **por fotograma**, y hay **20** por lanzamiento;
- va **gateado por el hechizo de tiempo** (`g_time_spell != 0x54`) ⇒ consumo CONDICIONAL, la
  misma firma que #38 y #77;
- las tres tiradas viven **dentro del barrido del pool**, así que **el número exacto depende de
  la población de actores** — no es una constante. Aquí sólo se acredita **que consume**; el
  cardinal por lanzamiento **no está medido** y no se estima (familia #31/#101: consumo no
  acotado, se declara como tal).

🔴 Para quien cablee el consumidor: **la ventana de sellos es obligatoria** y el port no puede
fijar un número de tiradas «razonable» — habría que derivar el barrido entero de `0x4552`
primero. Lo honrado mientras tanto es cablear el EFECTO VISIBLE y declarar el stream aparte.

**Port hoy:** `cast.ts:266` devuelve `{ kind: "deathVision" }`, huérfano.

## 5-bis. In Quas Xen (idx 38) — PARCIAL: es de COMBATE, con dos guardas de fallo

> 🔴 **SUPERSEDED por `in-quas-xen-340-derivacion.md` (ficha #340). Esta sección tiene DOS
> afirmaciones falsas y no se debe citar sin leer aquélla.**
> 1. **«91 filas, `ret` en `0x0c01`» es un CORTE, no el final.** `0x0c01` es
>    `lea di,[bx+0x5c5a]`, a media rutina; el `ret` está en **`0x0c97`** y el cuerpo son
>    **154 filas**. Lo delata la aritmética: los cuatro `call` que censa esta sección son
>    exactamente los que caben en el tramo corto — el cuerpo entero tiene **seis**.
> 2. **El veredicto de RNG queda INVERTIDO por ese corte.** «Ninguna llamada DIRECTA a
>    `rand_range`» es cierto, pero el tramo no leído llama al picker de tablero
>    (COMBAT.OVL:`0x120e`, 2 `rand0(15)` por intento) **en un bucle SIN COTA**: el hechizo
>    **MUEVE STREAM** y su cardinal no está acotado.
> 3. Y el `0xf` de la «guarda 1» **no es un predicado sobre el lanzador**: COMSUBS:`0x0504`
>    es el **cursor de apuntado** interactivo y `0xf` su ALCANCE; devolver 0 es **ESC del
>    jugador**. Los «tres cruces sin resolver» eran **cinco**, y están los cinco resueltos.


`CAST.OVL:0x10aa` es `call 0xb28` + `jmp 0xf3f` — sin `push` previo: el brazo no le pasa nada.
`CAST2`… no: **`in_quas_xen_clone_creature` vive en CAST.OVL:0x0b28** (91 filas, `ret` en `0x0c01`).

Lo derivado hasta aquí, y **el sujeto es lo que más cambia respecto a lo que suponía la ficha**:
las variables que lee son `g_cmb_actor`, `g_cmb_aim_x`, `g_cmb_aim_y` ⇒ **es un hechizo de
COMBATE que actúa sobre la criatura APUNTADA**, no un efecto de mundo.

```
0b30  push 0x45dc ; call 0x58d0      ; emisión (cadena DS 0x45dc — sin transcribir aún)
0b37  push g_cmb_actor ; push 0xf
0b41  call 0xffffc1c2                ; guarda 1 — si devuelve 0 → ret -1 (FALLO)
0b4e  push 7 ; call 0xffffc186       ; jingle 7 (el despachador de §2-quater)
0b55  push g_cmb_aim_x ; push g_cmb_aim_y
0b5f  call 0xffffc1ce                ; localiza el objetivo
0b65  jge …                          ; guarda 2 — si el índice es NEGATIVO → [bp-6]=0 y sale
```

**RNG: ninguna llamada DIRECTA a `rand_range`** en las 91 filas. Quedan sin resolver tres
cruces (`0xffffc1c2`, `0xffffc1ce` y `0x58d0`), así que **el veredicto de stream es PARCIAL**:
no se puede firmar «cero» sin mirarlos — la lección de §2-quinquies-bis aplica aquí también.

### El lado PORT, medido contra el árbol ENTERO (no sólo `cast.ts`)

Al ser de combate, el consumidor podría existir por otro camino — es el patrón que salvó a
**Rel Hur en #7**, donde la ficha lo daba por ausente por haber buscado en `main.ts`. Medido:

```
grep -rn "illusion" game/src --include=*.ts   (sin tests)
  cast.ts:142   | { kind: "illusion" }      ← la unión de tipo
  cast.ts:282     return { kind: "illusion" } ← el productor
  … y NADA MÁS. Cero en combat.ts, cero en main.ts.
```

**CONTROL POSITIVO del método** (para que el cero no sea un cero de búsqueda ciega): el mismo
grep sobre `"blink"`, un kind que SÍ se consume, da `main.ts:3547` (`fx.kind === "blink"`) y la
cita de `game.ts:3370-3371` que nombra a `combat.ts:2257` como su consumidor. ⇒ el instrumento
encuentra consumidores cuando los hay.

⇒ **`illusion` es huérfano confirmado contra el árbol entero**, no sólo contra `cast.ts`.

🔴 Las **dos guardas de fallo** son lo que un port ingenuo pierde: el hechizo puede fracasar
por (1) el actor lanzador no cumple el predicado `0xf`, y (2) no hay objetivo en las
coordenadas apuntadas. Los dos caminos salen SIN clonar y con retornos distintos (`-1` vs
`[bp-6]=0`), lo que sugiere que el despachador los distingue.

## 6. Pendientes de este acta

- `CAST2.OVL:0x6372` — ¿consume RNG? Decide la ventana de Wis An Ylem (§5).
- La rama `g_location >= 0x80` de An Grav (`0x866`), sin leer.
- In Quas Xen (idx 38) — `in_quas_xen_clone_creature` (CAST.OVL `0x0b28`).
- Vas Rel Por (idx 46) — `vas_rel_por_phase_gate` (`0x0cf0`). **Antes de cablear nada** hay
  que derivar por qué el brazo pone `[bp-6] = 0` cuando `res != 0`: altera el retorno del
  despachador, lo que huele a «el hechizo consume el turno de otra forma». Cambiar la forma
  del brazo sin esa semántica es adivinar.
