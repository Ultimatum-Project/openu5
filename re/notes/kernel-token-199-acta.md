# ACTA #199 — el token «kernel» como selector de overlay: PRE-REGISTRO

> Carril `deriva-libre`, worktree `.claude/worktrees/deriva-libre`, rama **`re/deriva-libre`**,
> base **main `9a92024f`**.
> ⚠ **Este commit contiene SÓLO el pre-registro.** La medida va en el commit siguiente, sobre
> este mismo fichero. El orden de los dos commits es la prueba de que la predicción es previa;
> por eso no van juntos.

---

## 0. Qué es #199 y de dónde sale

Las citas del port escriben a veces `kernel 0xNNNN` para decir *«este offset no es del overlay
del que venimos hablando: es de `ULTIMA.EXE`»*. El extractor de la banda
(`re/tools/cita_rama_hermana.collect_cites`) **no conoce esa notación**: `kernel` no está en
`OVERLAY_TOKEN` ni veta nada. La tarjeta pregunta si eso FABRICA pares falsos — un offset del
kernel colgado de un overlay que no lo contiene.

Cuatro carriles anteriores se toparon con el token y aplicaron todos la misma regla —
**declarar, no aplicar** — dejando el barrido para esta tarjeta:

| acta | material | consecuencia que midió |
|---|---|---|
| `liston-207-acta.md` §4.1 | `MAINOUT.OVL:0x1c0b` → `0x5910` · `SHOPPES3.OVL:0x01ca` → `0x3ae6` | NULA: ningún par de la banda con esos offsets |
| `liston-b-207-sub2-acta.md` §3.4.1 | el mismo `0x5910` | NULA, re-medida |
| `sueltos-b-174-acta.md` §2.2 | `dungeon.ts:567` → `0x3310` y `0x7F32` | NULA, y con motivo NUEVO: *«`DNGLOOK.OVL` se acaba en `0x13ae`, así que caen FUERA de la extensión del overlay»* |
| `liston-c-207-t2-acta.md` §3.1.1 | `0x3ae6`, resuelto con `dispatch_table` | la cita ACIERTA; no cierra #199 |

★ La tercera es la que da la pista: la consecuencia no depende de qué overlay se hereda sino de
si el offset **aterriza dentro de él**. Este pre-registro convierte esa observación de caso en
un **criterio**, y apuesta por él ANTES de medir.

## 1. El criterio que se pre-registra (derivado, no medido)

Extensiones máximas de los 28 desensamblados de `re/disasm/` (dato de entrada, no del
extractor):

```
ULTIMA.EXE   0x0000-0x86ee   (14309 instrucciones)
EGA.DRV      0x0000-0x2d85   ← el overlay MÁS LARGO
HER.DRV      0x0000-0x237e
SJOG.OVL     0x0000-0x225e
CAST.OVL     0x0000-0x216e
INTRO.OVL    0x0000-0x20cf
… los 22 restantes, todos por debajo de 0x2000
```

⇒ **C1 — cota dura.** Un `kernel 0xNNNN` con `NNNN > 0x2d85` **no puede** fabricar: no existe
overlay en el que ese offset caiga. La inmunidad no es suerte de cada caso, es aritmética.

⇒ **C2 — dónde vive el peligro.** Sólo los `kernel 0xNNNN` con `NNNN <= 0x2d85`, y de ésos sólo
los que además sean frontera de instrucción en el overlay que la herencia elija.

⇒ **C3 — los dos canales del extractor**, leídos en `collect_cites` (líneas 209-285):
  - **estricto** (`CITE_RE`): exige nombre de overlay + hasta 24 caracteres no-dígito + el
    offset. Un `kernel` DENTRO de ese hueco no estorba: el hueco acepta letras.
  - **pegajoso**: hereda el último overlay nombrado en el fichero hasta 40 líneas atrás, y
    **se salta la línea si contiene un `OVERLAY_TOKEN`** (`continue`, línea 273). O sea: una
    línea que nombre un overlay NO puede fabricar por la vía pegajosa.

## 2. Población (entrada, cerrada antes de medir)

`kernel[^0-9]{0,24}?0x[0-9a-f]{3,5}` sobre `game/src/**/*.ts` en `9a92024f`:

| | |
|---|---|
| ocurrencias | **390** |
| offsets distintos | **153** |
| ocurrencias con `NNNN <= 0x2d85` | **93** |
| de ésas, con instrucción en ≥1 overlay | **69** |
| de ésas, sin instrucción en ninguno | **24** |

**297 de las 390 quedan fuera por C1** — entre ellas las cuatro que las actas previas
declararon inofensivas caso a caso (`0x3ae6`, `0x5910`, `0x3310`, `0x7f32`).

## 3. PREDICCIONES — items concretos, con veredicto y mecanismo

Reglas del pre-registro: se nombran ITEMS, no cifras; cada uno con el overlay que predigo y el
motivo; y se acepta de antemano que un fallo se publica como fallo.

| # | item | canal predicho | overlay predicho | veredicto predicho |
|---|---|---|---|---|
| **I1** | `skin/fiel/frame.ts:6` — `kernel 0x0aa6,` | pegajoso | `EGA.DRV` | **FABRICA** |
| **I2** | `skin/fiel/frame.ts:7` — `kernel 0x0b10,` | pegajoso | `EGA.DRV` | **FABRICA** |
| **I3** | `skin/fiel/frame.ts:8` — `kernel 0x0f90,` | pegajoso | `EGA.DRV` | **FABRICA** |
| **I4** | `skin/fiel/frame.ts:10` — `kernel 0x16ba,` | pegajoso | `EGA.DRV` | **FABRICA** |
| **I5** | `skin/fiel/gemmap.ts:16` — `kernel 0x16BA,` | pegajoso | `DNGLOOK.OVL` | **no fabrica** — C1 local: `DNGLOOK.OVL` acaba en `0x13ae` |
| **I6** | `skin/fiel/gemmap.ts:19` — `kernel 0x1C9E,` | pegajoso | `DNGLOOK.OVL` | **no fabrica** — mismo motivo |
| **I7** | `skin/fiel/textwindow.ts:8` — `kernel 0x16ba,` | pegajoso | `ULTIMA.EXE` | **emite par, y es CORRECTO** — la cabecera nombra `ULTIMA.EXE`: herencia y token coinciden |
| **I8** | `core/combat/combat.ts:1158` — `kernel 0x2C4C,` | ninguno | — | **no fabrica** — la línea nombra `COMBAT` ⇒ la pasada pegajosa la SALTA (C3) |
| **I9** | `ui/troll-sneak.ts:4` y `skin/api.ts:559` — `kernel 0x3AE6,` | — | — | **no fabrica** — C1 |
| **I10** | `core/world/loops/hazards.ts` — `0x5910,` · `core/dungeon.ts:567` — `0x3310,`/`0x7F32,` | — | — | **no fabrica** — C1, y esto SUSTITUYE la explicación caso a caso de las tres actas previas por una sola |

### 3.1 El mecanismo que predigo para I1-I4, escrito entero

`frame.ts` línea 2 dice: *«CHROME EGA de la pantalla de juego (E1-S8b) …»*. `EGA` es **prosa
castellana sobre el modo de vídeo**, pero `_BASE` de `OVERLAY_TOKEN` se construye con
`o.split(".")[0]` sobre los ficheros del disasm, y ahí está `EGA.DRV` ⇒ el token `EGA` resuelve
a `EGA.DRV` y siembra el contexto pegajoso en la línea 2. Cuatro líneas más abajo empieza la
tabla de primitivas del kernel, ninguna con nombre de overlay, todas dentro de la ventana de 40.

⇒ predigo que los cuatro offsets se cuelgan de **`EGA.DRV`**, que es —y esto es lo que lo hace
peligroso— **el overlay más largo del corpus**, el único que llega a `0x2d85`.

⚠ **Riesgo asumido**: si `EGA.DRV` no tiene frontera de instrucción en alguno de los cuatro
offsets, esa fila falla. No lo he comprobado; ir a mirarlo antes sería medir.

★ Predigo además, sin haberlo contado, que **I1-I4 son de la misma familia que #217** («`npc`,
palabra de TypeScript, siembra `NPC.OVL`»): aquí el sembrador no es una variable sino una
palabra de la PROSA.

## 4. Control positivo comprometido de antemano

Un cero de fabricación no se acepta sin demostrar que el instrumento SABE fabricar. Antes de
publicar cualquier «no fabrica» se corre `collect_cites` con `src=` un directorio sintético que
contenga un fichero con un nombre de overlay en la cabecera y un `kernel 0xNNNN` debajo, con
`NNNN` elegido dentro de ese overlay. Si ese caso NO sale, el instrumento de medida está roto y
el acta no publica ningún cero.

## 5. Lo que este acta NO hará (comprometido aquí)

- **No toca el instrumento.** Ni `OVERLAY_TOKEN`, ni la ventana de 40, ni la política pegajosa.
  Cambiarlos mueve la población de la banda entera y es **#217**.
- **No re-adjudica** ningún par de la banda.
- **No toca `game/src`** ni `re/ledger`.
- **No regenera** `routine-census.json` ni `frontier.json`.

---

# ACTA #199 (segunda mitad) — LA MEDIDA

> Todo lo de aquí abajo se midió **después** de commitear el pre-registro, en el árbol
> **`a40aa9e8`** limpio (`git status` vacío). El pre-registro es el commit padre.

## 6. VEREDICTO

| | |
|---|---|
| **La tesis de la tarjeta** | **CONFIRMADA, y la consecuencia NO es nula** — contra lo que las tres actas previas habían medido |
| **Fabricaciones vivas** | **8 pares** con offset del kernel colgado de un overlay que no es `ULTIMA.EXE` |
| **De ésas, EN la banda adjudicable** | **1** — `EGA.DRV:0x0aa6,` clasificada **LIMPIA**; la cita vive en `frame.ts:6` |
| **Canal culpable** | **el pegajoso, en exclusiva**: por la vía estricta, **0 de 5** |
| **Aciertos del pre-registro** | **8 de 10 items**; 1 fallo y 1 fallo a medias, los dos con **el mismo mecanismo**, y ese mecanismo es un hallazgo nuevo |
| **Capacidad** | probada con control positivo: una cita `kernel` **sí** puede llegar a la banda |

## 7. Los 8 pares FABRICADOS, con su sembradora

Criterio de la medida: par emitido `(ov, off)` tal que la línea de la cita contiene
`kernel …0xoff` **y** `ov != ULTIMA.EXE`.

| par fabricado | cita | línea que SIEMBRA el overlay | qué es la sembradora |
|---|---|---|---|
| `EGA.DRV:0x0aa6,` | `skin/fiel/frame.ts:6` | L2 · `EGA` | ★ **prosa**: «CHROME EGA de la pantalla» = el modo de vídeo |
| `EGA.DRV:0x0b10,` | `skin/fiel/frame.ts:7` | L2 · `EGA` | ídem |
| `EGA.DRV:0x0f90,` | `skin/fiel/frame.ts:8` | L2 · `EGA` | ídem |
| `INTRO.OVL:0x0117,` | `skin/fiel/endgame-frame.ts:271` | L269 · `intro` | ★ **prosa**: «el atlas de la intro», sustantivo común en minúsculas |
| `SJOG.OVL:0x1850,` | `core/combat/combat.ts:2668` | L2657 · `SJOG.OVL` | referencia LEGÍTIMA a overlay, 11 líneas antes |
| `INTRO.OVL:0x207e,` | `core/game.ts:731` | L723 · `INTRO` | referencia legítima, 8 líneas antes |
| `SJOG.OVL:0x2092,` | `core/world/commands.ts:6` | L5 · `SJOG` (gana a `CMDS` por «el último manda») | referencia legítima, 1 línea antes |
| `CAST.OVL:0x2092,` | `skin/fiel/speaker.ts:367` | L362 · `CAST` | referencia legítima, 5 líneas antes |

★★ **Dos sub-familias, y hay que separarlas porque no se arreglan igual:**

- **(A) La sembradora NO es una referencia a overlay** (`EGA` = modo de vídeo, `intro` =
  sustantivo castellano). Miembros nuevos de la lista de **#217** —la del `npc` de
  `liston-d-207-acta.md` §3.3.3—, y esta vez ni siquiera son identificadores de TypeScript:
  son **palabras de la prosa castellana**. Cuatro de los ocho pares salen de aquí.
- **(B) La sembradora es legítima y el token debía haberla ANULADO.** Éste es el defecto de
  #199 puro: `kernel` es un selector explícito —el autor está diciendo *«éste no es del
  overlay del que venimos hablando»*— y el extractor lo lee como texto de relleno.

## 8. El par que SÍ está en la banda, y por qué es el peor caso posible

```
EGA.DRV:0x0aa6,  clase=LIMPIA   cand=11  dist=4  tok=1   fichero: frame.ts, linea 6
   | *   fill_rect(x0,y0,x1,y1)  kernel 0x0aa6  (x0=[bp+0xa]..y1=[bp+4])
```

**LIMPIA** es la etiqueta que significa *«atribución sin problemas»*. La saca porque el dueño
verdadero —`ULTIMA.EXE`— no se nombra en ninguna parte de la ventana: `tok=1` («no hay
competidor») y `dist=4` («el overlay está en el mismo párrafo»). Los dos ejes miden la cercanía
del competidor, y aquí el competidor es un binario entero que nadie nombró.

⇒ **Tercera instancia del molde de `liston-d-207-acta.md` §3.3.2** («cuanto más lejos está el
dueño verdadero, más limpio parece el par»), y la primera en la que el usurpador entra por una
palabra de la prosa. `cand=11` confirma además que el eje FORZADA tampoco protege.

## 9. Los DOS fallos del pre-registro — y tienen el mismo mecanismo

### 9.1 I4 falló: `frame.ts:10` → `kernel 0x16ba,` NO fabrica

Predije el par `EGA.DRV:0x16ba,` y no sale. `0x16ba,` **no es frontera de instrucción en `EGA.DRV`** —
cae dentro del `mov word ptr es:[di + …]` que empieza en `0x16b7`—, así que el filtro
`off in asm[ctx].text` lo descarta. La fila falla y se publica como fallo.

### 9.2 I7 falló a medias, y aquí está el hallazgo NUEVO

Predije que `textwindow.ts:8` (`kernel 0x16ba,`) emitiría un par **correcto** bajo
`ULTIMA.EXE`, porque la cabecera del fichero nombra `ULTIMA.EXE`. La otra mitad de la
predicción —`textwindow.ts:11`, `0x1850,`— **acertó** y salió como `ULTIMA.EXE:0x1850,`. La de
`0x16ba` **no salió**, y el motivo no es el que yo daba:

```
16b5: 5f                pop di
16b6: 5e                pop si
16b7: 5d                pop bp
16b8: c3                ret
16b9: 00558b            add byte ptr [di - 0x75], dl     ← el desensamblador se DESINCRONIZA
16bc: ec                in al, dx
```

El byte de `16b9` es `00`: un **byte de relleno** tras el `ret`. El barrido lineal se lo traga
y arrastra con él el `55 8b` de la instrucción siguiente. Re-sincronizando en `16ba` sale
`55 8b ec` = `push bp` / `mov bp, sp` —el prólogo canónico—, seguido de `56 57 1e`
(`push si`/`push di`/`push ds`) y `8b 7e 04` (`mov di, word ptr [bp + 4]`): **una rutina de un
solo argumento**, que es exactamente lo que el port cita como `putchar(code)`.

⇒ ★★ **La cita del port es CORRECTA y el instrumento la tira.** No es una fabricación: es un
**falso negativo**, y el mecanismo es la familia ya documentada de los **prólogos ocultos por
byte de relleno** (`asm-prologos-ocultos-pad-byte`). `0x16ba` se cita en al menos cinco sitios
del port y ninguno llega a la banda.

⇒ **Los dos fallos del pre-registro son el mismo fallo**: `off in asm[ov].text` no pregunta
«¿es este offset una dirección real de ese binario?» sino «¿acertó mi desensamblador lineal a
partirlo ahí?». Material directo para #217, y de signo CONTRARIO al de #199: uno mete pares
falsos, el otro tira pares buenos.

## 10. Puntuación del pre-registro, item a item

| item | predicho | medido | |
|---|---|---|---|
| I1 `frame.ts:6` | FABRICA / `EGA.DRV` | fabrica, `EGA.DRV`, **y en la banda como LIMPIA** | ✓ |
| I2 `frame.ts:7` | FABRICA / `EGA.DRV` | fabrica, `EGA.DRV` | ✓ |
| I3 `frame.ts:8` | FABRICA / `EGA.DRV` | fabrica, `EGA.DRV` | ✓ |
| I4 `frame.ts:10` | FABRICA / `EGA.DRV` | **no fabrica** (§9.1) | ✗ |
| I5 `gemmap.ts:16` | no fabrica | no fabrica | ✓ |
| I6 `gemmap.ts:19` | no fabrica | no fabrica | ✓ |
| I7 `textwindow.ts:8` | par correcto bajo `ULTIMA.EXE` | **no sale** (§9.2); la hermana `:11` sí | ½ |
| I8 `combat.ts:1158` | no fabrica | no fabrica; `combat.ts:1174` sale bien bajo `ULTIMA.EXE` | ✓ |
| I9 `0x3AE6,` | no fabrica | no fabrica | ✓ |
| I10 `0x5910,`/`0x3310,`/`0x7F32,` | no fabrica | no fabrica; `main.ts:181` sale bien bajo `ULTIMA.EXE` | ✓ |

**8 aciertos, 1 fallo, 1 medio.** Lo que el pre-registro NO predijo: **cinco** de las ocho
fabricaciones (las de la sub-familia B y la de `intro`). La predicción nombraba items, no una
cifra, así que las cinco son material nuevo y se publican como no previstas.

★ La cota C1 se sostiene entera: **297 de las 390 ocurrencias** son inmunes por aritmética, y
eso **sustituye por un solo criterio** las tres explicaciones caso a caso que las actas previas
habían dado para `0x3ae6`, `0x5910`, `0x3310` y `0x7f32`.

## 11. Controles

| control | resultado |
|---|---|
| **POSITIVO** — `src` sintético: cabecera con `TOWN.OVL 0x0100,` + línea `kernel 0x1002,` | el extractor emite `TOWN.OVL:0x1002,` **OK** — sabe fabricar |
| **NEGATIVO** — el mismo fichero SIN nombre de overlay en la cabecera | **0 pares** — el positivo no es un artefacto |
| **CAPACIDAD sobre la BANDA** — sintético con un offset que además es destino de salto condicional en `TOWN.OVL` | llega a `sweep4` **OK** — el «sólo 1 de 8 entra en la banda» es empírico, no estructural |
| **estricta vs pegajosa** | 5 citas seleccionadas por token en la estricta, **0 fabricadas**; 28 en la pegajosa, 8 fabricadas |

## 12. ⚠ Un cero MÍO que era falso, y lo escribo porque casi lo publico

Mi primera comprobación de «¿llega alguno de los 8 a la banda?» dio **0 de 8**, encajaba con lo
que las tres actas previas habían medido, y estuve a punto de escribirlo como veredicto. Era
**mío**: el comparador leía `h.get('off')` y la clave del diccionario que devuelve `sweep4` es
**`'offset'`**. `.get()` sobre una clave que no existe devuelve `None` sin quejarse ⇒ ningún par
casaba nunca y el barrido salía vacío **por construcción**.

Lo destapó no fiarme de que el cero confirmara lo que yo esperaba y volver a mirar el tipo de
dato que devuelve la función. Corregido: **1 de 8**, y ese 1 es el hallazgo del acta.

⇒ Familia `vaciar-la-entrada-es-vaciar-sus-productores` e `instrumento-equivocado-peor-que-ninguno`:
**un cero que confirma tu hipótesis previa es justo el que hay que volver a medir.**

## 13. Lo que este acta NO hace

- **No toca el instrumento.** Los tres arreglos que la medida pide —que `kernel` seleccione
  `ULTIMA.EXE`, que `OVERLAY_TOKEN` no case palabras de prosa, y que `off in asm[ov].text` no
  descarte por desincronización del desensamblador— son **#217**, con re-medición de banda
  detrás.
- **No re-adjudica** `EGA.DRV:0x0aa6,` ni ningún otro par de la banda. Se declara.
- **No toca `game/src`**: la cita de `frame.ts:6` es correcta; quien está mal es quien la lee.
- **No regenera** `routine-census.json` ni `frontier.json`.
- **No resuelve** si `0x16ba,` está en el censo de prólogos ocultos ya inventariado o es nuevo.

## 14. Reproducción

```
base                              main 9a92024f
pre-registro                      a40aa9e8   (árbol limpio; todas las cifras son de ahí)
poblacion                         390 ocurrencias · 153 offsets · 93 bajo cota · 69 aterrizan
collect_cites(sticky=False)       2093 pares ·  5 seleccionados por token ·  0 fabricados
collect_cites(sticky=True)        5685 pares · 28 seleccionados por token ·  8 fabricados
sweep4(pegajosa)                  534 pares  ·  1 fabricado dentro (EGA.DRV:0x0aa6, LIMPIA)
cita_pegajosa_atribucion.py       529 citas / 359 pares · 3 controles verdes · EXIT=0
```

## 15. Nombres de overlay usados aquí (sección FINAL a propósito)

`EGA.DRV` · `INTRO.OVL` · `SJOG.OVL` · `CAST.OVL` · `TOWN.OVL` · `DNGLOOK.OVL` · `COMBAT.OVL` ·
`ULTIMA.EXE`.
