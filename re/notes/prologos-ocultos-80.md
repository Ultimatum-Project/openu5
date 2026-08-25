# ACTA — Los prólogos ocultos del kernel: impacto real en el censo, y re-verificación de #71

Tarea **#80**. Fecha **2026-07-28**. Carril `prologos-80`, rama `re/prologos-80`.
Origen del hallazgo: **barrido-72 (#79 T1)**, commit de main `510fdc24`, §«CAUSA SISTEMICA
DE HABER IDO A CIEGAS — 35 PROLOGOS OCULTOS».

Instrumento re-ejecutable de esta acta: **`re/tools/hidden_prologues.py`**
(`--check` corre los controles y devuelve exit ≠ 0 si alguno no muerde;
sin flags imprime el censo de las 37; `--entries` el de entradas invisibles).

> **HIGIENE DE PROSA (añadida 2026-07-28 tras el incidente de `0x72fa`).** Esta nota, como
> todas las de `re/notes/`, alimenta `build_name_seeds` de `routine_census.py`. Su regex
> `_NAME_ADJ` toma **cualquier palabra minúscula de ≥4 letras pegada a un `0xNNNN`** como
> NOMBRE de esa rutina, y `_HEX_TOKEN` sólo reconoce hex en **minúsculas**. Consecuencias
> prácticas al escribir una nota: (1) poner una **coma** o una palabra de ≤3 letras entre la
> palabra y el offset rompe la semilla y **conserva** la cita; (2) pasar el hex a mayúsculas
> rompe la semilla **y también la cita**, así que NO sirve. Esta nota emitió al aterrizar 8
> semillas, 7 de ellas basura (`call`→`0x72fa`, `cuerpo`, `real`, `offset`); tras la
> corrección emite **1**, la legítima. La única que se deja a propósito es la del volcado
> literal de desensamblado en §B.1, donde el call a `0x08e6` es texto de capstone y el offset ya
> está nombrado en el ledger — se deja verbatim por fidelidad, y queda aquí declarada.
> Ver tarjeta **#84**.

**Canal de cita.** Todo lo derivado aquí sale de los **BYTES CRUDOS** de
`original/u5/ultima5/ULTIMA.EXE` (offsets de KERNEL: `file_offset = kernel_offset + 0x800`,
`binfiles.py` `code_offset=2048`), no del texto de `re/disasm/ULTIMA.EXE.asm` — que es
precisamente donde estas entidades **no existen**. Cuando se cita un vecino que sí está
en el .asm se dice explícitamente. **No se ha regenerado ni tocado ningún `.asm`.**

---

## RESUMEN EN UNA LÍNEA

Los 35 prólogos ocultos son reales y la enumeración se cierra por construcción (son **37**
en el corpus, 35 en el kernel + 2 en INTRO.OVL), pero **no son 35 agujeros del censo: son
UNO**. `routine_census.py` ya lleva desde el 27-07 la pata de *prólogo-leído-en-bytes* que
rescata 36 de los 37; el único que se le escapa es `ULTIMA.EXE 0x2316`, y es **código
muerto sin una sola referencia en todo el corpus**. El agujero grande del censo está en
**otra familia** que nadie había censado: **19 entradas reales** con llamador resuelto que
no caen en frontera de instrucción y no tienen prólogo (14 en los `.DRV`, 5 en el kernel),
más **2 manejadores de interrupción** instalados por vector. Y las **dos rutinas de #71 se
re-derivaron desde el prólogo real: los límites COINCIDEN y ninguna conclusión cambia**
(sólo una cifra: el cuerpo de `0x0f46` son 39 B de código, no 40 — el 40º es el relleno).

---

# FRENTE A — impacto en el censo

## A.0 · La enumeración, cerrada POR CONSTRUCCIÓN (y el patrón de bytes NO es el criterio)

barrido-72 describió el mecanismo bien: un byte de relleno `00` delante de `55 8b ec` se
decodifica como `add byte ptr [di-0x75], dl` (opcode `00 /r` con modrm `0x55`), devorando
el `55 8b` del prólogo; el `ec` sobrante sale como `in al, dx`. Pero **el patrón de bytes
`00 55 8B EC` no es el criterio de corte**, y por un margen grande:

| en `ULTIMA.EXE` | casos |
|---|---:|
| `55 8b ec` en cualquier posición | 181 |
| …de ellos, en frontera de instrucción (**visibles**) | 146 |
| …de ellos, **fuera** de frontera (**OCULTOS**) | **35** |
| patrón `00 55 8b ec` (el de la nota de #79) | 89 |
| …de ellos que **NO** son prólogo oculto (falsos positivos) | **54 (61 %)** |

De esos 54 falsos positivos, **52 son un `ret imm16`**: el `00` es el byte alto del
inmediato de `c2 XX 00` de la rutina anterior, o sea **ya está consumido** y el flujo llega
ALINEADO al prólogo siguiente. Los otros 2 son el byte alto del inmediato de un `add`.
Testigo citable, bytes del kernel en `0x1ceb`: `c2 02 00` = `ret 2`, y el `00` de `0x1ced`
es su byte alto; el prólogo de `0x1cee` que le sigue está **visible**.

El criterio que sí cierra la enumeración es **posicional**, no de patrón:

```
prólogo oculto  :=  bytes[p:p+3] == 55 8b ec  ∧  p ∉ {direcciones de instrucción
                    del barrido lineal de ese fichero}
```

Barrido de **todos** los ficheros de código por bytes (no por `.asm`), que es lo que pedía
el punto 4 del encargo:

| fichero | `55 8b ec` | visibles | **ocultos** |
|---|---:|---:|---:|
| ULTIMA.EXE | 181 | 146 | **35** |
| INTRO.OVL | 19 | 17 | **2** |
| los otros 22 overlays | 420 | 420 | 0 |
| EGA/CGA/HER/T1K.DRV | 0 | 0 | 0 |
| **TOTAL** | **620** | **583** | **37** |

Dos consecuencias:

1. **El «35» de barrido-72 es exacto para el kernel**, y la cifra del corpus es **37**:
   `INTRO.OVL 0x0010` y `INTRO.OVL 0x20AE` son del mismo género y no estaban en el volcado.
2. **Los cuatro `.DRV` no tienen ni un `push bp; mov bp,sp`** — son ensamblador a mano sin
   marco. Por eso no aparecen aquí… y por eso concentran la *otra* familia (§A.3).

## A.1 · Buckets — las 37, y suman exacto

Presencia comprobada **por offset** (nunca por nombre) contra
`re/notes/routine-census.json` y `re/ledger/frontier.json`.

Criterio del bucket, declarado antes de aplicarlo: **presente-bien** = hay fila en censo
Y en frontier, el `start` es el prólogo real, y el `end` no incluye más código ajeno que
relleno inerte (`00`/ceros de fin de fichero). **Presente-con-límite-mal** = hay fila pero
su cuerpo absorbe **código ejecutable de otra entidad**.

| bucket | n | quiénes |
|---|---:|---|
| **presentes-bien** | **35** | las 37 menos `0x20FA` y `0x2316` |
| **presentes-con-límite-mal** | **1** | `ULTIMA.EXE 0x20FA`: su fila se lleva los 19 B del ISR de INT 1Ch en `0x2159` (§A.4). ★ La causa **no** es su prólogo oculto — su `start` es correcto — sino que el ISR no tiene fila propia porque nadie lo alcanza por `call` |
| **AUSENTES** (sin fila en ninguno de los dos) | **1** | `ULTIMA.EXE 0x2316` |
| **suma** | **37** | ✔ partición exacta |

Restringido a las 35 del kernel del encargo: **33 presentes-bien + 1 límite-mal + 1
ausente = 35**. ✔

**Límites.** Para las 36 presentes se re-derivó el cuerpo desde el prólogo real por
**cierre de alcanzabilidad** (BFS del flujo: caída-en-secuencia + destinos de salto; el
`call` no se sigue pero sí su caída; `ret`/`retf`/`iret` cortan). Reparto exacto sobre las
36 presentes: **17 coinciden al byte**; **17 difieren en +1 byte**, que es el propio relleno
`00` que oculta el prólogo del vecino; `INTRO.OVL 0x20AE` difiere en **+9**, que son ceros
de fin de fichero; y `ULTIMA.EXE 0x20FA` difiere en **+19**, que es la **única discrepancia
real de límite** y cuya causa no es el prólogo oculto sino la tercera familia de §A.4.
Los +1 y los +9 no son límite mal: es que la fila del censo, que va de `start` al `start`
siguiente, se queda el relleno.

> **Autocrítica de instrumento, y por qué importa.** Mi primer cierre fue la heurística
> «primer `ret` cuyo fin supere el mayor destino de salto hacia delante visto». Sobre
> `putchar 0x16BA` dio **180 B** y habría reportado el censo (314 B) como *límite mal*.
> Es FALSO: el cuerpo real son 314 B. `0x176B` tiene un `ret 2` y **detrás sigue habiendo
> cuerpo alcanzable** — el despachador de códigos de control (`cmp dl,0xff` en `0x176E`,
> `cmp dl,0xfe`, …) que rebota a `0x16D5` y a `0x1767`, ambos DENTRO de la rutina. Un
> `ret` intermedio no cierra nada. Con el cierre de alcanzabilidad la discrepancia
> desaparece. Queda anotado porque el género («instrumento equivocado peor que ninguno»)
> ya tiene tarjeta en el repo: la conclusión de «límite mal» habría sido un falso positivo
> mío contra un censo que estaba bien.

## A.2 · Por qué el censo SÍ las ve — y por qué se le escapa exactamente una

`routine_census.function_starts` (`re/tools/routine_census.py:277-291`) aplica a todo
destino de call resuelto una prueba **CONJUNTIVA**: *llamador resuelto* **∧** *prólogo
canónico en los BYTES* (`has_prologue`, que lee el binario, no el `.asm`). Esa segunda
pata es justo la que sobrevive al desalineado. El comentario del propio fichero dice
«Medido: 36 entradas, entre ellas el putchar de `0x16ba` (380 llamadores) y el rand_range
de `0x2092` (171)» — **ese 36 es exactamente 34 del kernel + 2 de INTRO.OVL**, y esta
auditoría lo confirma de forma independiente.

**Contrafactual ejecutado** (llamando a la función real, no a ojo): monkeypatch de
`rc.has_prologue → False` y re-cálculo de `function_starts` fichero a fichero.

```
starts del kernel (real)                        = 230
starts del kernel (sin la pata de bytes)        = 196     delta = -34
de los 37 prólogos ocultos, perdidos sin la pata = 36
rescatados por la OTRA pata (terminador delante) = 0
```

O sea: **la afirmación de barrido-72 («cualquier barrido que enumere rutinas por `push bp;
mov bp,sp` sobre estos .asm tiene 35 agujeros») es cierta para un barrido del TEXTO del
.asm, y falsa para el censo de este repo**, que no usa el .asm para esto. La formulación
honesta es: *«35 agujeros para quien lea el .asm; 1 para el censo»*.

**El único ausente: `ULTIMA.EXE 0x2316`.** Falla la PRIMERA pata: no tiene **ni un
llamador**. Cuerpo entero (bytes del binario, file offset `0x2B16`):

```
2316  55        push bp
2317  8bec      mov  bp, sp
2319  83ec06    sub  sp, 6        ; reserva 6 B de locales
231c  8be5      mov  sp, bp       ; …y los desmonta sin tocarlos
231e  5d        pop  bp
231f  c3        ret               ; ret 0 = sin args
```

10 B, `ret` sin inmediato. **Cero referencias en todo el corpus**: 0 `call` resueltos y 0
menciones como inmediato en ningún módulo (barrido de los 28 ficheros). Es **código muerto**
— probablemente una función vaciada por el compilador que conservó su marco. Su ausencia
del censo **no oculta ninguna mecánica del juego**; el coste es que la fila de
`beep 0x22C0`… en realidad la de su vecina absorbe su cuerpo (§A.3, `0x230E`).

**¿La vería el criterio de corte si el prólogo fuera visible?** **Sí, sin condiciones**:
la pata «prólogos `push bp; mov bp,sp`» de `function_starts` (líneas 296-299) recorre el
flujo de instrucciones y añade **todo** par `push bp` / `mov bp,sp` sin exigir llamador.
`0x2316` está fuera del censo **única y exclusivamente** por el byte de relleno.

## A.3 · ★ El agujero que sí es grande, y NO es de prólogos ocultos

Barriendo los **887 destinos de `call` resueltos distintos** de todo el corpus contra las
filas del censo: **24 no tienen fila**. Y **ninguno de los 24 es un prólogo oculto** — la
pata de bytes ya los cubriría. Son la familia hermana: **hojas sin marco** cuyo offset
tampoco cae en frontera de instrucción (el relleno de delante se comió el primer byte),
así que fallan la pata 1-bis (`idx_of.get(off) is None` en `routine_census.py:285`) y
quedan **fundidas con su predecesora**.

Adjudicación de los 24 (leyendo el call-site, no sólo contando):

- **2 son artefactos demostrados**: `TOWN.OVL 0x0210` y `TOWN.OVL 0x030D`, cuyo único
  call-site está en la banda de datos PLINK del kernel (`≥ 0x7780`, la misma constante que
  el censo usa para marcar `kind = plink-data`): `ULTIMA.EXE 0x83C3` y `0x8429` no son
  `call`, son la tabla de stubs leída como código.
  > **CORRECCIÓN EN SITIO (2026-07-28, tarea #90 — `sin-marco-90.md` §3.1).** El veredicto
  > se sostiene (no son entradas de TOWN.OVL) pero **la razón de arriba es FALSA**. Los dos
  > call-sites **sí son `call` de código real**: `0x8429` está rodeado de aritmética
  > coherente sobre el contador de ticks, y sus destinos reales son dos rutinas de
  > **bootstrap** del kernel — `0x83E0`, que descifra un rango con `xor 0xDC`, y `0x84DD`,
  > que es `mov ah,0 / pushf / int 0x1a / popf / ret`, o sea leer el tick del BIOS. Lo que
  > falla no es el call-site: es que `resolve_near_call` **proyecta** todo CS ≥ `0x81D0` al
  > espacio de overlay, lo cual es cierto en runtime y falso en tiempo de arranque, que es
  > cuando esas llamadas ocurren. ⇒ El filtro `clean_calls` **acertó por el motivo
  > equivocado** y NO vale como criterio general de artefacto: descarta llamadas de
  > bootstrap que son reales. La banda `≥ 0x81D0` tiene código real y ninguna fila propia.
- **3 más son artefactos por lectura del call-site** (mismo género, call-site dentro de
  datos, sin cubrirlos la banda PLINK): `TOWN.OVL 0x11DC` (llamado desde `DNGLOOK.OVL
  0x0770`, precedido de `jmp 0x769 / nop` y seguido de `test ax, 0xa9ec` — basura),
  `SJOG.OVL 0x1478` (desde `FONT.OVL 0x0955`, precedido de `out 0xec,ax / out 0xfc,ax`) y
  `NPC.OVL 0x0D6F` (desde `SJOG.OVL 0x01bc`, precedido de `salc / rcr ah,0xc0 / loop`).
- **19 son ENTRADAS REALES sin fila en el censo**:

| destino | llamadas | qué es (leído) |
|---|---:|---|
| `EGA.DRV 0x2D5D` | **22** | `mov cx,0x80 / mov di,si / lodsb / mov ah,al / and al,0xf0 / shr×4…` — desempaquetado de nibbles |
| `T1K.DRV 0x1E0C` | **22** | los mismos bytes exactos que EGA `0x2D5D` |
| `ULTIMA.EXE 0x230E` | **5** | `in al,0x61 / and al,0xfc / out 0x61,al / ret` = **apagar el altavoz**, la pareja del `beep 0x22C0`…`0x22E2` |
| `EGA.DRV 0x27AF · 0x296A · 0x2BB2` | 2 c/u | trío simétrico del driver |
| `CGA.DRV 0x1ACC · 0x1C2A · 0x1E7E` | 2 c/u | ídem |
| `HER.DRV 0x1E66 · 0x1FC4 · 0x2236` | 2 c/u | ídem |
| `T1K.DRV 0x139C · 0x123E · 0x1CB4` | 2 c/u | ídem |
| `ULTIMA.EXE 0x082A` | 1 | `xor ch,ch / jcxz / shl ax,1 / rcl dx,1 / loop / ret` = shift largo de 32 bits |
| `ULTIMA.EXE 0x0836` | 1 | aritmética contra `[0x5214]`/`[0x520e]` (asignador) |
| `ULTIMA.EXE 0x7690` | 1 | `lcall ss:[0x5394]` con guarda `or al,al` |
| `ULTIMA.EXE 0x74A1` | 1 | preámbulo que entra en install_int_handler, `0x72fa` |

`ULTIMA.EXE 0x230E` es el caso que más duele: **código vivo con 5 llamadores en 3 módulos**
(kernel ×3, CAST.OVL, TOWN.OVL) que hoy está **absorbido en la fila de la rutina anterior**,
o sea atribuido a un nombre que no es el suyo — el mismo defecto que motivó adoptar el
criterio de terminador en frontera-27 (`0x4DAA`, «un nombre cubriendo código de GRÁFICOS
ajeno»).

## A.4 · ★ Tercera familia: entradas instaladas por VECTOR DE INTERRUPCIÓN

Hay entradas que **el grafo de llamadas no puede ver por construcción**: no las alcanza
ningún `call`, se instalan como puntero. En el kernel hay **2**, ambas por
`lea dx,[imm] … mov ah,0x25 / int 0x21` (DOS *Set Interrupt Vector*):

| instalador | manejador | ¿fila de censo? |
|---|---|---|
| `ULTIMA.EXE 0x11CD` | `0x1214` | **no** |
| `ULTIMA.EXE 0x212D` | `0x2159` | **no** |

`0x2159` es el manejador de **INT 1Ch (tick del temporizador)**: `sti / push ds / push ax /
push si / mov ax,0xf64 / mov ds,ax / lea si,[0x5448] / inc word ptr [si] / … / iret`, o sea
incrementa el contador `[0x5448]` que el instalador `0x20FA` **espera en bucle**
(`0x2138: mov ax,[0x5448] / cmp ax,[0x544a] / jb 0x2138`). Es el *delay* por ticks del
juego. Hoy sus 19 B están dentro de la fila de `0x20FA` — y ésta es la **única**
discrepancia de límite real de toda la §A.1, pero su causa no es el prólogo oculto sino
esta tercera familia.

## A.5 · Respuesta directa: ¿el 885 es el denominador real?

**No, pero los prólogos ocultos casi no tienen la culpa.** El censo declara
`total = 885` rutinas de código (886 filas, la 886ª es el pseudo-registro `plink-data` en
`ULTIMA.EXE 0x7780`, que `frontier.json` ya excluye — de ahí sus 885 filas exactas).
Los `.DRV` **sí** están dentro del 885 (EGA 44 + CGA 40 + HER 40 + T1K 39 = 163, que es
justo el `driver_routines: 163` del `summary` de frontier).

| familia de entrada invisible | filas que faltan |
|---|---:|
| prólogo oculto sin llamador (`0x2316`) | **1** |
| hoja sin marco fuera de frontera, con llamador resuelto | **19** |
| manejador instalado por vector de INT | **2** |
| rutina del bootstrap CS ≥ 0x81D0 (`0x84DD`) — **añadida por #90** | **1** |
| **total** | **23** |

Denominador honesto: **885 medidas, ~908 reales** (era ~907 hasta que #90 añadió la cuarta
familia), y **1 de las 23 que faltan** es
imputable a los 35 prólogos ocultos. La afirmación «el catálogo tiene 35 agujeros» **queda
RETIRADA** (no refutada en su mecanismo, sino en su consecuencia): el mecanismo es real, el
censo ya lo trataba, y el número de agujeros que produce es 1.

## A.6 · Controles ejecutados, con resultado

Los cuatro corren en `hidden_prologues.py --check`, en la misma invocación, y el comando
devuelve exit ≠ 0 si alguno no muerde (un control que no muerde no es un control):

| control | predicción calculada | resultado | ¿muerde? |
|---|---|---|---|
| **POSITIVO** — un prólogo VISIBLE debe salir «presente-bien» por mi misma vía | 146/146 | **146/146** | sí |
| **NEGATIVO** — direcciones inventadas (`0x0F47`, `0x16BB`, `0x1235`, `0x7FF1`) deben salir ausentes | 0/4 presentes | **0/4** | sí |
| **DISCRIMINACIÓN del patrón** — si el patrón `00 55 8b ec` no diera falsos positivos, la §A.0 no estaría midiendo nada | >0 falsos | **54 de 89 (61 %)** | sí |
| **CONTRAFACTUAL** — sin la pata de prólogo-en-bytes se pierden las ocultas | 36 de 37 | **36 de 37** | sí |

`--check` a **EXIT 0** con las cuatro. Las direcciones del control negativo se eligieron
adyacentes a las reales (`0x0F47 = 0x0F46+1`, `0x16BB = 0x16BA+1`) para que un instrumento
que se limitara a «buscar cerca» fallase el control.

---

# FRENTE B — re-verificación de #71 por cuerpo entero

Encargo: **no** se asume que #71 esté mal; se exige **re-derivar el límite** desde el
prólogo real, con el relleno contabilizado, y comparar con el cuerpo que usó la
adjudicación. Origen: commit `7a97daf4`, «re(#71): 0x0F46 = fx_rect_dissolve y 0x1CCA =
text_set_fg_color (por cuerpo), y el viento del fizzle NO son 32 sino 31».

## B.1 · `0x0F46` = `fx_rect_dissolve` → **LÍMITES-COINCIDEN**

Cuerpo re-derivado desde el prólogo real por cierre de alcanzabilidad, bytes del binario
(en el fichero, `0x1746`):

```
0f46  55         push bp                    ← prólogo OCULTO (relleno 00 en 0x0f45)
0f47  8bec       mov  bp, sp
0f49  56 57 1e   push si / push di / push ds
0f4c  8b460a     mov  ax, [bp+0xa]
0f4f  8b5e08     mov  bx, [bp+8]
0f52  8b4e06     mov  cx, [bp+6]
0f55  8b5604     mov  dx, [bp+4]
0f58  e88bf9     call 0x08e6                ← normalize_rect_to_screen
0f5b  f8         clc                        ← ★ el discriminante de rama del driver
0f5c  c70650536600  mov word ptr [0x5350], 0x66
0f62  ff1e5053   lcall [0x5350]
0f66  1f 5f 5e 5d   pop ds / pop di / pop si / pop bp
0f6a  c20800     ret  8                     ← fin del cuerpo, 0x0f6d
0f6d  00         ← RELLENO, y el prólogo oculto de 0x0f6e empieza aquí detrás
```

- **Cuerpo real, `0x0f46`–`0x0f6c`: 39 B de código, `ret 8` = 4 args.**
- Cuerpo que usó #71: `frontier-manual.json` (`ULTIMA.EXE:3910`) dice «CUERPO ENTERO LEIDO
  0x0f46-0x0f6d (40 B, `ret 8` = 4 args)». **El límite es el mismo**; los 40 B incluyen el
  byte de relleno en `0x0f6d`, que no es código.
- **Cada instrucción que #71 cita cae dentro de esos 39 B**: los cuatro `[bp+…]` en
  AX/BX/CX/DX, el call a `0x08e6`, el `clc`, el selector `0x66` y el `lcall`. Y el
  argumento del `clc` como hermano del `stc` de `fx_tile_fizzle_in 0x1068` **no depende del
  límite en absoluto**: depende de que el `clc` esté en el cuerpo, y lo está.

**VEREDICTO: conclusión FIRME, sin cambios.** Única corrección: la cifra 40 B → 39 B de
código + 1 de relleno. Aplicada **en sitio** en `re/notes/wind-rand-decision.md:112` (donde
la cifra se había propagado a la prosa que hereda el espejo), con fecha y sin borrar el
diagnóstico original. En `re/ledger/frontier-manual.json` queda como **propuesta** (§C.1):
ese fichero lo está tocando el carril heredados-168 y esta tarea es auditoría.

## B.2 · `0x1CCA` = `text_set_fg_color` → **LÍMITES-COINCIDEN (exacto, sin relleno)**

```
1cca  55         push bp                    ← prólogo OCULTO (relleno 00 en 0x1cc9)
1ccb  8bec       mov  bp, sp
1ccd  56 57 1e   push si / push di / push ds
1cd0  8b369a53   mov  si, [0x539a]          ← window-rect activa
1cd4  8b4604     mov  ax, [bp+4]
1cd7  240f       and  al, 0xf               ← nibble BAJO
1cd9  a2aa53     mov  [0x53aa], al          ← caché del color
1cdc  8a6406     mov  ah, [si+6]
1cdf  80e4f0     and  ah, 0xf0              ← conserva el nibble ALTO (fondo)
1ce2  0ae0       or   ah, al
1ce4  886406     mov  [si+6], ah
1ce7  1f 5f 5e 5d   pop ds / pop di / pop si / pop bp
1ceb  c20200     ret  2                     ← fin del cuerpo, 0x1cee
```

- **Cuerpo real, `0x1cca`–`0x1ced`: 36 B, `ret 2` = 1 arg.** Sin byte de relleno: el `00`
  que hay en `0x1ced` **es el byte alto del inmediato del `ret 2`**, y por eso el prólogo
  del vecino en `0x1cee` sí es visible (es uno de los 52 casos del §A.0).
- Cuerpo que usó #71: «CUERPO ENTERO LEIDO 0x1cca-0x1ced (36 B, `ret 2` = 1 arg)».
  **Idéntico byte a byte.**
- Cada afirmación de #71 se relee y se sostiene: `si=[0x539a]`, `al=[bp+4]&0x0F`, caché en
  `[0x53aa]`, `ah = ([si+6]&0xF0) | al → [si+6]`, y **no toca ni `[si+4]` ni `[si+5]`**, que
  es lo que sostiene el «no mueve el cursor».

**VEREDICTO: conclusión FIRME, sin cambios. Cero correcciones.**

## B.3 · Por qué #71 no salió dañada

Porque **partió del prólogo real** en los dos casos: `0x0F46` y `0x1CCA` ya eran filas del
censo (rescatadas por la pata de bytes), así que la adjudicación leyó el cuerpo correcto.
El prólogo oculto habría hecho daño a quien hubiese buscado la rutina *en el `.asm`* y se
hubiera encontrado con el cuerpo fundido en el vecino — que es exactamente lo que le pasó
a barrido-72 al enumerar primitivas gráficas, y de ahí el hallazgo.

---

# C — PROPUESTAS DE MAQUINARIA (no aplicadas: son del lead secuenciarlas)

Ningún fichero de `re/ledger/*.json`, `re/tools/frontier.py` ni `re/tools/routine_census.py`
ha sido tocado por este carril, por la restricción de colisión con heredados-168 y
oldnames-75. Lo que sigue son diffs listos, con su efecto **medido**.

## C.1 · Corrección de la cifra de `0x0f46` en `frontier-manual.json` (1 línea)

`re/ledger/frontier-manual.json`, clave `ULTIMA.EXE:3910`, primer `cites[].text`:

```diff
-CUERPO ENTERO LEIDO 0x0f46-0x0f6d (40 B, `ret 8` = 4 args).
+CUERPO ENTERO LEIDO 0x0f46-0x0f6c (39 B de codigo, `ret 8` = 4 args; el byte
+0x0f6d es el RELLENO 00 que oculta el prologo de 0x0f6e, ver prologos-ocultos-80.md).
```

Efecto: cosmético, ninguna conclusión cambia. **Ojo al régimen de `covered.json`**: si esta
cita está sellada por byte-identidad, la sustitución tiene que ser idéntica en ambos lados.

## C.2 · Admitir el prólogo oculto SIN llamador (+1 fila: 885 → 886)

`re/tools/routine_census.py`, en `function_starts`, junto a la pata de prólogos visibles:

```diff
     # prólogos push bp; mov bp,sp
     for a, b in zip(ins, ins[1:]):
         if (a.mnemonic == "push" and a.op_str == "bp"
                 and b.mnemonic == "mov" and b.op_str == "bp, sp"):
             starts.add(a.addr)
+    # PRÓLOGOS OCULTOS SIN LLAMADOR. La pata de `extra_targets` es conjuntiva
+    # (llamador resuelto ∧ prólogo en bytes) y por eso no ve una rutina con
+    # prólogo canónico a la que no llama nadie por `call` — que existe: es
+    # ULTIMA.EXE 0x2316 (código muerto, 0 referencias en todo el corpus). El
+    # prólogo en los BYTES es evidencia suficiente por sí sola porque el
+    # alineamiento del stream ya se ha demostrado no-oráculo; se exige además
+    # relleno delante para no admitir un `55 8b ec` que caiga dentro de datos.
+    # MEDIDO (tarea #80, re/tools/hidden_prologues.py): 37 prólogos ocultos en
+    # el corpus, 36 ya eran start por la vía de llamador ⇒ esta pata añade
+    # EXACTAMENTE 1 fila y no mueve ninguna otra frontera.
+    raw = raw_bytes(cf.name) or b""
+    for p in range(len(raw) - 2):
+        if (raw[p:p + 3] == PROLOGUE and p not in addrs
+                and p > 0 and raw[p - 1] in (0x00, 0x90)):
+            starts.add(p)
```

Efecto medido: **+1 fila** (`ULTIMA.EXE 0x2316`), 885 → 886. Cero falsos positivos: los 37
casos del corpus son rutinas leídas. Riesgo: bajo. Valor: bajo también — `0x2316` es código
muerto; lo que se gana es que deja de contaminar la fila de su vecina.

## C.3 · ★ La que de verdad importa: EMITIR los huérfanos en vez de absorberlos

> **ESTADO: IMPLEMENTADA** (2026-07-28, GO del lead). `routine_census.py` emite
> `orphan_call_targets` en el `.json` (con `calls`, `clean_calls`, `has_prologue`,
> `on_insn_boundary`, `absorbed_by` y la lista de módulos llamadores), dos contadores en
> `summary`, y una sección propia en el `.md`. **Cero filas nuevas: `total` sigue en 885.**
> Cinco tests en `test_routine_census.py`. `build_name_seeds` NO se ha tocado (es de #84).
> ⚠ El artefacto `routine-census.json` **no se regenera en este commit**: ver §C.5.

En vez de intentar un criterio nuevo que admita las 19 entradas reales de §A.3 (y que
arriesgaría admitir también los 5 artefactos), la propuesta es **hacerlos visibles**:
que el censo emita como salida de primera clase la lista de *destinos de call resueltos sin
fila*, para adjudicarlos a mano. Hoy desaparecen en silencio dentro de la rutina anterior,
que es la forma más cara de un error (un nombre cubriendo código ajeno, sin rastro).

```diff
 def census() -> dict:
     ...
+    # HUÉRFANOS: destinos de call resueltos que NO acabaron siendo fila. Hoy
+    # quedan absorbidos por la rutina anterior sin dejar rastro. MEDIDO (#80):
+    # 24 de 887 destinos distintos; 19 son entradas reales (14 en los .DRV y 5
+    # en el kernel, con ULTIMA.EXE 0x230E = apagar-altavoz y sus 5 llamadores
+    # a la cabeza) y 5 son artefactos de call-sites decodificados dentro de
+    # datos. Ver re/notes/prologos-ocultos-80.md §A.3 y
+    # re/tools/hidden_prologues.py --entries.
+    js["orphan_call_targets"] = [
+        {"file": f, "off": o, "calls": n, "absorbed_by": owner(f, o)}
+        for (f, o), n in sorted(orphans.items())
+    ]
```

Efecto: **0 filas nuevas**, 0 riesgo, y el defecto pasa de invisible a contable. Es la
precondición razonable para cualquier intento posterior de admitirlos.

## C.4 · Entradas por vector de interrupción (+2 filas)

Añadir como frontera el operando de `lea dx,[imm]` cuando en la ventana siguiente hay
`mov ah, 0x25` + `int 0x21`. Efecto medido: **+2** (`ULTIMA.EXE 0x1214` y `0x2159`), y
corrige de paso el único límite real discrepante de §A.1 (la fila de `0x20FA` deja de
llevarse el ISR de INT 1Ch). Propuesta con menos prioridad que C.3 porque son 2 filas, pero
es la única de las tres familias que el grafo de llamadas **no puede** ver nunca.

## C.5 · ⚠ BLOQUEO MEDIDO: `routine-census.json` no es reproducible desde su generador

Al implementar C.3 apareció algo que no era el encargo y que vale más que él. **Regenerar
el censo HOY, sin tocar una línea de código, ya produce 4075 inserciones de diff.** Medido
sobre `main` antes de mis cambios:

| qué cambia al regenerar | filas |
|---|---:|
| `summary` (todos los contadores) | **idéntico** |
| filas: conjunto de claves `(fichero, start)` | **idéntico**, 886 |
| filas cuyas `cites` cambian | 219 |
| filas cuyo **`name`** cambia | **15** |
| filas con `globals_touched` / `rare_globals` distintos | 5 |

Las 772 citas nuevas vienen de notas aterrizadas hoy (`kernel-sweep-4` 164,
`barrido-gfx-consumidores` 133, esta misma acta 118, `heredados-168-tanda1` 44…). Eso es
sano: el índice de citas se pone al día. **Los 15 nombres no lo son.** Entre ellos:

- `ULTIMA.EXE 0x72FA`: `install_int_handler (getvect+setvect)` → `call`. Es decir,
  **regenerar el censo DESHACE el fix que el lead acaba de aterrizar en `28a5b0aa`.**
- `ULTIMA.EXE 0x3702`, que pasa de `find_actor_at / is_occupied` a `kernel`.
- `ULTIMA.EXE 0x2C4C`: `maestro` → `enombre`; `0x637E`: `pinta` → `queda`;
  `0x4DEA`: `draw_char_boxed (Ztats render)` pierde el calificador.
- Seis filas que hoy no tienen nombre lo GANAN, y es prosa española suelta:
  `vecino`, `cuerpo`, `chrome`, `painter`, `redibuja`.
- Y cuatro que lo ganan **bien**: `udivmod32`, `gfx_line_dispatch`, `poll_key_timed`,
  `input_string_raw`.

Consecuencia operativa: **no se puede aterrizar un `routine-census.json` regenerado como
efecto colateral de otro cambio**, porque arrastra 15 re-atribuciones silenciosas. Por eso
este commit trae **sólo código y tests**, y deja el artefacto sin regenerar; la lista de
huérfanos se obtiene ejecutando el censo. Regenerarlo es una operación con dueño y ventana
propia, y su precondición es **#84**. Esta acta no propone el arreglo de
`build_name_seeds`: es de esa tarjeta.

---

# D — LO QUE ESTA ACTA **NO** CIERRA

- **No adjudica las 19 entradas reales de §A.3.** Están censadas, leídas por encima y
  clasificadas; ninguna tiene nombre ni veredicto. Las 14 de los `.DRV` van en tríos
  simétricos entre los cuatro drivers (mismo papel, distinto hardware) y probablemente se
  adjudiquen en bloque; las 5 del kernel piden lectura individual.
- **No toca `re/ledger/*.json` ni `frontier.py` ni `routine_census.py`.** C.1–C.4 son
  propuestas. El 885 sigue siendo el número publicado hasta que el lead decida.
- **No re-audita las otras 33 rutinas de prólogo oculto** más allá del límite: `0x16BA`
  (380 llamadas), `0x2092` (171, el `rand_range`) y `0x0A70` (104, el setcolor) tienen fila,
  límite correcto y nombre, pero esta acta no ha revisado sus *veredictos* de contenido.
- **No dice nada de si el port cubre `0x230E`, `0x2159` o `0x1214`.** Eso es careo contra
  `game/src`, y no era el encargo.

---

# E — TABLA DE LAS 37, ÍNTEGRA

`llam` = llamadas del corpus por el canal de `call` literal resuelto (con el sesgo de
overlay `kernel = (target + near_call_base) & 0xFFFF`); `ker` = las que salen del propio
kernel. `fin real` = cierre de alcanzabilidad desde el prólogo, **exclusivo** (el último
byte de código es `fin − 1`; por eso `0x0F46` figura con fin `0x0F6D` y su cuerpo es
`0x0f46`–`0x0f6c`). `fin censo` = campo `end` de la fila, también exclusivo. Regenerable
con `python3 re/tools/hidden_prologues.py`.

| rutina | llam | ker | fin real | fin censo | censo | frontier |
|---|---:|---:|---|---|---|---|
| ULTIMA.EXE 0x03A0 | 9 | 0 | 0x0401 | 0x0402 | sí | sí |
| ULTIMA.EXE 0x0402 | 3 | 2 | 0x0426 | 0x0426 | sí | sí |
| ULTIMA.EXE 0x0442 | 11 | 0 | 0x0476 | 0x0476 | sí | sí |
| ULTIMA.EXE 0x0496 | 4 | 0 | 0x0532 | 0x0532 | sí | sí |
| ULTIMA.EXE 0x0A70 | 104 | 25 | 0x0AA6 | 0x0AA6 | sí | sí |
| ULTIMA.EXE 0x0ACE | 14 | 2 | 0x0B10 | 0x0B10 | sí | sí |
| ULTIMA.EXE 0x0BAE | 14 | 0 | 0x0BE3 | 0x0BE4 | sí | sí |
| ULTIMA.EXE 0x0BE4 | 15 | 0 | 0x0BFC | 0x0BFC | sí | sí |
| ULTIMA.EXE 0x0E94 | 1 | 0 | 0x0F29 | 0x0F2A | sí | sí |
| ULTIMA.EXE 0x0F2A | 1 | 0 | 0x0F45 | 0x0F46 | sí | sí |
| ULTIMA.EXE 0x0F46 | 6 | 0 | 0x0F6D | 0x0F6E | sí | sí |
| ULTIMA.EXE 0x0F6E | 12 | 2 | 0x0F8F | 0x0F90 | sí | sí |
| ULTIMA.EXE 0x0F90 | 22 | 12 | 0x0FAE | 0x0FAE | sí | sí |
| ULTIMA.EXE 0x0FDC | 6 | 0 | 0x0FF4 | 0x0FF4 | sí | sí |
| ULTIMA.EXE 0x102E | 6 | 0 | 0x1043 | 0x1044 | sí | sí |
| ULTIMA.EXE 0x1044 | 7 | 1 | 0x1067 | 0x1068 | sí | sí |
| ULTIMA.EXE 0x1068 | 14 | 1 | 0x10DF | 0x10E0 | sí | sí |
| ULTIMA.EXE 0x10E0 | 8 | 4 | 0x1112 | 0x1112 | sí | sí |
| ULTIMA.EXE 0x1140 | 1 | 1 | 0x1158 | 0x1158 | sí | sí |
| ULTIMA.EXE 0x1674 | 10 | 4 | 0x16A6 | 0x16A6 | sí | sí |
| ULTIMA.EXE 0x16BA | 380 | 49 | 0x17F4 | 0x17F4 | sí | sí |
| ULTIMA.EXE 0x1CCA | 29 | 8 | 0x1CEE | 0x1CEE | sí | sí |
| ULTIMA.EXE 0x1FA0 | 6 | 6 | 0x2031 | 0x2032 | sí | sí |
| ULTIMA.EXE 0x207E | 6 | 0 | 0x2091 | 0x2092 | sí | sí |
| ULTIMA.EXE 0x2092 | 171 | 22 | 0x20C8 | 0x20C8 | sí | sí |
| ULTIMA.EXE 0x20FA | 28 | 3 | 0x2159 | 0x216C | sí | sí |
| ULTIMA.EXE 0x223C | 25 | 8 | 0x22BF | 0x22C0 | sí | sí |
| ULTIMA.EXE 0x22C0 | 8 | 1 | 0x22E1 | 0x22E2 | sí | sí |
| **ULTIMA.EXE 0x2316** | **0** | **0** | **0x2320** | **—** | **NO** | **NO** |
| ULTIMA.EXE 0x6F9E | 2 | 0 | 0x6FBB | 0x6FBC | sí | sí |
| ULTIMA.EXE 0x6FBC | 2 | 1 | 0x6FD6 | 0x6FD6 | sí | sí |
| ULTIMA.EXE 0x6FF0 | 5 | 5 | 0x703F | 0x7040 | sí | sí |
| ULTIMA.EXE 0x7040 | 9 | 9 | 0x70A6 | 0x70A6 | sí | sí |
| ULTIMA.EXE 0x7200 | 1 | 1 | 0x7233 | 0x7234 | sí | sí |
| ULTIMA.EXE 0x7234 | 1 | 1 | 0x7296 | 0x7296 | sí | sí |
| INTRO.OVL 0x0010 | 3 | 0 | 0x004F | 0x0050 | sí | sí |
| INTRO.OVL 0x20AE | 1 | 0 | 0x20C7 | 0x20D0 | sí | sí |

Suma de llamadas del corpus a las 35 del kernel: **941**. De ellas, **22 tienen al menos un
llamador desde el propio kernel** — la cifra de barrido-72, reproducida de forma
independiente. Matiz sobre el volcado de #79: allí se dijo «`0x0A70` (setcolor, ~25)»;
25 es el conteo **desde el kernel**, y el del **corpus entero** es **104**.
