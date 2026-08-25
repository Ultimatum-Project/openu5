# #100 — los dos cabos de nombre-contradicho, y la CLASE que hay detrás del segundo

> Ficha #100. Los dos cabos se adjudican; el segundo resultó ser **un ejemplar de una clase
> de 58**, no un caso suelto, y eso cambia la pregunta del denominador que el lead reservó
> para sí. Medido sobre `main` = `2b7b84a1`, worktree `cabos-100`, cinco symlinks (28 `.asm`).

## 0. TITULAR

1. **`load_gfx_record` está contradicho y el renombre procede.** Abre `BRIT.CBT`, no un
   recurso gráfico. Corroboración independiente: **el global que escribe ya se llama bien.**
2. **La fila 0x07a2 SÍ es un contenedor**, y el mecanismo por el que existe es un **byte `00`
   de relleno que desincroniza el desensamblado lineal** — el mismo `00` de la ficha #9, con
   otra consecuencia: allí se pierde el PRÓLOGO de una fila, aquí se pierde **la fila entera**.
3. 🔴 **Y no es un caso suelto** — pero las cifras de este punto están **CORREGIDAS por #142**
   (ver el aviso de §2.2): lo que el censo no delimita son **22**, de las cuales **8 en ficheros
   de juego**; el 58 y el 44 unían dos clases distintas. La regla consistente cuesta **+5** filas
   de juego, no «hasta +44».

## 1. CABO 1 — `ULTIMA.EXE` en 0x60ec: el nombre dice «gfx» y el cuerpo abre `BRIT.CBT`

**Cuerpo entero leído** (0x60ec-0x614c, 100 B, 42 insn, `ret 2` = UN argumento):

```
60f4  push 0xa3f0                 ; ← DS:0xa3f0 = la cadena "BRIT.CBT"
60f8  push 0xad14                 ; ← destino
60fc  push 0x160                  ; 352 B por registro
6100  imul word ptr [bp+4]        ; desplazamiento = arg · 0x160
6104  call 0x256e                 ; kernel_load_dat_record
        …luego CUATRO `repne movsw` que reparten sub-arrays del búfer recién cargado
        a 0x1704 (8 words), 0x1714 (8), 0x1724 (3) y 0x172c (3)
```

**Los DOS llamadores, leídos** (no el primero que apareció): en 0x633d empuja un índice
calculado tras comparar contra 0x6a y 0x6b (identificadores de ubicación), y en 0x6366 empuja
literalmente 0. Los dos pasan **un índice de registro**, coherente con el `imul`.

★ **La corroboración que cierra el caso sin depender de mi lectura: el destino 0xad14 ya está
catalogado como `g_cbt_room_record`.** O sea que la capa de globales y el cuerpo dicen lo
mismo, y sólo el nombre de la rutina se quedó atrás — dos capas de nombrado independientes,
una correcta y otra no. **El nombre no sobrevive**: no hay «gfx» por ninguna parte, y
«record» no es más ancho de lo que parece, es literalmente el registro de sala de arena.

**Propuesto:** `load_cbt_room_record` — refleja el global que escribe, que es la parte ya
acreditada. NO aplicado aquí (toca capa manual ⇒ regeneración ⇒ aviso previo al lead).

## 2. CABO 2 — la fila 0x07a2 es un contenedor, y esto es POR QUÉ

**Confirmado byte a byte:** el span 0x07a2-0x0877 (214 B, `end` 0x0878) contiene **CUATRO
`ret`** — en 0x07c3, 0x0828, 0x0834 y 0x0872 — y el siguiente prólogo empieza justo en 0x0878.
La regla que la ficha enuncia se cumple aquí de manual: **el primer `ret` cierra a los 34 B
(0x07c3−0x07a2+1) y no el span, luego la fila es un contenedor.**

**Y tres de los cuatro cuerpos son destinos de `call` con llamador propio:**

| sub-cuerpo | llamadores intra-kernel | overlays |
|---|---|---|
| 0x07a2 | 1 (desde 0x320) | 0 |
| 0x07ca | **0 encontrados** | 0 |
| 0x082a | 1 (desde 0x484) | 0 |
| 0x0836 | 1 (desde 0x76e) | 0 |

⚠ El cero de 0x07ca se declara como **«0 encontrados por este instrumento»**, no como «no
tiene llamadores»: la cita vieja lo describe como `ltoa` COMPARTIDO, y un cero limpio con
llamadores vivos es precisamente el fallo que ya mordió en el corpus (llamada por puntero,
notación distinta, `call` relativo). Sin resolver.

### 2.1 EL MECANISMO — un `00` de relleno desincroniza el decodificado

`function_starts` sí añade como inicio de fila todo destino de `call` resuelto… **pero sólo si
ese offset es frontera de instrucción** (`if r[1] in addrs`). Y aquí no lo es:

```
0828: c3                ret                              ← fin del cuerpo anterior
0829: 0032              add byte ptr [bp + si], dh       ← el `00` de relleno se traga el 0x82a
082b: ed                in ax, dx
…
0834: c3                ret
0835: 008bd003          add byte ptr [bp + di + 0x3d0], cl   ← otro `00`, se traga el 0x836
```

El byte `00` de alineación antes de cada helper hace que el decodificado lineal empiece la
instrucción **un byte antes**, así que 0x082a y 0x0836 no existen como direcciones de
instrucción, el filtro los descarta, y sus cuerpos se funden en la fila anterior.

★★ **Es la misma raíz que la ficha #9 y una consecuencia distinta.** #9 caza la firma
`00 55 8b` — el relleno delante de una función CON marco, y lo que se pierde es su prólogo.
Aquí el relleno va delante de un helper SIN marco (`32 ed` = `xor ch,ch`; `8b d0` = `mov dx,ax`),
y lo que se pierde es **la fila entera**. La población de #9 es un SUBCONJUNTO de ésta.

### 2.2 EL CENSO — 58 destinos que el DECODIFICADO no ve (y 22 que el censo no delimita)

> 🔴 **CORREGIDO EL 2026-08-10 POR SU AUTOR (#142).** Este apartado decía «58 rutinas llamables
> en todo el corpus que **el censo no delimita** (44 en ficheros de juego)». **La cifra 58 es
> correcta y la afirmación es FALSA.** El 58 es el cardinal del predicado literal de la tabla
> —«destino de `call` resuelto que no cae en frontera de instrucción»— y ese predicado **une dos
> clases con destino opuesto**: 36 tienen prólogo canónico en los bytes y **el censo SÍ las
> delimita** (las rescata `has_prologue`; son la clase de #9), y sólo **22** no lo tienen y se
> quedan fuera. De esas 22, **8 en ficheros de juego** y 14 en `.DRV`.
> **Todo lo que este apartado y el §3 derivan del 44 queda retirado**: el coste real de aplicar
> la regla a la clase es **+5 filas de juego**, no «hasta +44». Reproducción del 58, partición en
> las dos clases, control y cifras nuevas en `clase-142-cuerpos-fundidos.md` §1.
> También queda retirado el «la población de #9 es un SUBCONJUNTO de ésta» de §2.1: es subconjunto
> de la población del PREDICADO, y **disjunta** de la clase que esta ficha quería nombrar.

Destinos de `call` **resueltos** que no son frontera de instrucción, sobre el corpus entero
(cifras de la corrida original, **conservadas para que la corrección sea auditable**):

| fichero | nº |
|---|---:|
| `ULTIMA.EXE` | **39** |
| `EGA.DRV` · `T1K.DRV` | 4 · 4 |
| `CGA.DRV` · `HER.DRV` | 3 · 3 |
| `INTRO.OVL` | 2 |
| `NPC.OVL` · `SJOG.OVL` · `TOWN.OVL` | 1 · 1 · 1 |
| **TOTAL** | **58** ⚠ **este total NO es «lo que el censo no delimita»** — son 36 de la clase de #9 (delimitadas) + 22 de la clase real (8 de juego + 14 de driver). Ver el aviso de arriba |

## 3. LO QUE ESTO LE HACE A LA PREGUNTA DEL DENOMINADOR (decisión del lead)

La pregunta reservada era «¿722 → 725?». **Medido, la respuesta es que ese 725 sólo vale si se
parte ESTA fila y ninguna más**, y eso sería tratar distinto a 43 casos idénticos.

- **Opción A — partir sólo 0x07a2:** +3 filas de juego (722 → 725). Barato y **inconsistente**:
  deja 43 contenedores conocidos sin partir, con la regla ya escrita en la ficha.
- **Opción B — aplicar la regla a la clase:** ~~hasta **+44** filas de juego~~ → **RETIRADO por
  #142: son +5**, y las cinco lecturas ya están escritas dentro de las citas de las filas
  contenedoras, así que el coste es re-atribuir, no leer. Sigue siendo la opción consistente y
  deja de ser la cara. Cifras en `clase-142-cuerpos-fundidos.md` §5.
- **Opción C — no partir y sellar declarando el contenido**, que es el precedente de la memoria
  «una fila contiene a la rutina que la nombra y a su propio llamador».

🔴 **El coste que las tres comparten y que conviene mirar antes que el cardinal:** toda fila
nueva nace **SIN sello de cuerpo leído**. `understood_depth_C_or_E` está hoy en 722/722; con la
opción B pasaría a 722/766 — **el eje E3, declarado al 100 % esta misma semana, dejaría de
estarlo por un cambio de instrumento, no por una regresión de conocimiento.** Eso es una
decisión de contabilidad pública, no de limpieza, y por eso no la tomo.

⚠ Acotación honesta del 44: es «destinos llamables en ficheros de juego». **No he comprobado
fila por fila cuál absorbe a cada uno** ni si alguno cae en la banda `plink-data` o en la fila
estructural excluida. El número exacto que movería el denominador es ≤44, no exactamente 44.

## 4. EL RENOMBRE PROPUESTO EN LA FICHA — procede, con el matiz de por qué

Cuerpo de 0x07a2 (34 B) leído entero:

```
07a3  xor si, si          ; si = 0  → recorre desde DS:0
07a5  mov cx, 0x42        ; 66 bytes
07a8  xor ah, ah
07ab  lodsb / xor ah, al / loop 0x7ab     ; XOR acumulado de 66 bytes
07b0  xor ah, 0x55        ; contra el valor esperado
07b3  je 0x7c2            ; si cuadra, sigue
07b5  call 0x586 ; push 1 ; call 0x55d    ; si no: mensaje y salida
```

**`anti_tamper_checksum_ds` describe bien el MECANISMO y afirma mal la INTENCIÓN.** Es
literalmente una suma XOR sobre DS, sí — pero «anti_tamper» dice anti-copia, y lo que el
código hace es comprobar que **los 66 primeros bytes de DGROUP no han cambiado**, que es la
guarda de escritura por puntero nulo del runtime de MSC. `crt0_nullcheck_dgroup` **procede**.

⚠ Frontera de lo derivado: de los bytes se deriva *checksum XOR de 0x42 bytes desde DS:0 contra
0x55, con salida si falla*. Que eso sea el `_nullcheck` de MSC es **identificación por patrón**
(rutina conocida del runtime), no derivación — corroboración fuerte, no prueba. Y el literal de
copyright en DS:0 que la ficha menciona **no lo he verificado**: el resolvedor de cadenas no
devuelve nada en ese offset.

## 5. LO QUE ESTA NOTA NO HACE

- No aplica ningún renombre ni parte ninguna fila: las tres cosas tocan capa manual y por tanto
  regeneración, que va con aviso previo.
- No adjudica el `ltoa` de 0x07ca: su cero de llamadores está sin explicar.
- No re-adjudica `ULTIMA.EXE:0x6360`, aunque de paso se vio que **empieza llamando a la carga
  del registro de arena**. 🔴 **CORREGIDO POR #142: la fila NO se llama `refresh_view_and_light`
  — ese nombre no existe en ninguna fila del ledger.** Se llama `load_gfx_record_then_4`, lo
  escribí de memoria sin comprobarlo. El cabo queda **adjudicado** en
  `clase-142-cuerpos-fundidos.md` §6: el nombre cae por sus dos términos y sí era de la misma
  familia, pero por una vía nueva — lo contradice el renombre de la fila a la que NOMBRA.
