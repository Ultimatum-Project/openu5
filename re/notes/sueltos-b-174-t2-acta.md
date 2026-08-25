# ACTA #174 — SUB-TANDA 2 del carril B: el encargo estaba DUPLICADO, y la duplicación rinde

> Rama `re/sueltos-b-174`, worktree `.claude/worktrees/sueltos-b-174`.
> Base de la sub-tanda 1: main `3dd2fea4`. **Main ha avanzado a `bd54abf6` mientras se trabajaba.**
> RETENIDA: aterriza el lead. Continúa `sueltos-b-174-acta.md` §3.

---

## 0. LO PRIMERO, PORQUE CAMBIA LA LECTURA DE TODO LO DEMÁS

El encargo de este carril decía: *«Carril `sueltos-174` CERRADO (4 actas con método medido); RELEVO
FRESCO para los 16»*. **No estaba cerrado.** Mientras esta rama adjudicaba sus 7 de `core`, el
carril `sueltos-174` siguió trabajando la MISMA cola y aterrizó tres sub-tandas más:

| commit en main | contenido |
|---|---|
| `f6a4f132`, | sub-tanda 5 — seis de `core` |
| `bf052e5b`, | sub-tanda 6 — cinco de `skin`/`ui`, con **1 (d)** |
| `bd54abf6`, | sub-tanda 7 — los cinco últimos; declara la celda **CERRADA 64/64** |

⇒ **encargo duplicado, artefacto del canal.** La consecuencia NO es que este carril haya sido
inútil: es que sus 7 pares pasan a ser lo que la banda pegajosa nunca había tenido en 64
adjudicaciones — **una SEGUNDA lectura independiente**. Este acta cobra esa diferencia.

**Re-ancla tras el avance de main** (el disparador se activó y hay que re-medir, no suponer):
`git diff 3dd2fea4..main -- game/src` → **VACÍO**. Los tres commits son sólo `re/notes/`. La
población y la celda no se pueden haber movido por esta vía.

## 1. ★★ EL RESULTADO QUE SÓLO EXISTE POR LA DUPLICACIÓN: 8 de 8 CONCUERDAN

Toda la banda pegajosa —64 pares, nueve sub-tandas— se ha adjudicado con **un solo lector por par**.
Aquí hay, por primera vez, pares leídos DOS veces por agentes distintos, desde el mismo disasm pero
sin verse el trabajo. **Coinciden los ocho.**

| par | veredicto de `sueltos-174` | veredicto de este carril | ¿concuerda? |
|---|---|---|---|
| `MAINOUT.OVL:0x0468` | (a) | (a) | ✓ |
| `DNGLOOK.OVL:0x0013` | (a) | (a) | ✓ |
| `SHOPPES.OVL:0x1596` | (a) | (a) | ✓ |
| `SHOPPES2.OVL:0x0194` | (a) | (a) | ✓ |
| `TOWN.OVL:0x0204` | (a) | (a) | ✓ |
| `ZSTATS.OVL:0x1230` | (a) | (a) | ✓ |
| `CMDS.OVL:0x1ac6` | (a) — su t6 | (a) | ✓ |
| `ULTIMA.EXE:0x535e` | **(d)** — su t6 | **(d)** — re-leído aquí (§2) | ✓ |

★ **Y concuerdan por DERIVACIONES DISTINTAS**, que es lo que hace que el control valga. Ejemplos:
en el plato de la taberna, ellos derivan que norte y sur se distinguen «por UN opcode» (el
`dec`/`inc`) y este carril lo deriva por los cuatro extremos de rango y por la topología del salto
negativo; y en el controller de la ficha, ellos lo leen como «el fork por MODO en la tecla ENTER»
mientras aquí sale por la salida compartida, o sea por quién hace que el bucle continúe. Dos
caminos, un veredicto.

⇒ **el método de adjudicación de la banda queda con un control de reproducibilidad que no tenía**,
y sale limpio 8/8. Es una cota, no una prueba: 8 pares de 64, y todos de la celda `DIVERGE`.

## 2. El (d) de `ULTIMA.EXE:0x535e`, RE-LEÍDO — porque un (d) quita un par de la población

Un (a) equivocado deja un par mal contado; un **(d) equivocado retira un par del universo**, que es
más caro de deshacer. Por eso se re-lee, sin mirar su tabla hasta después:

| call-site | instrucción | destino |
|---|---|---|
| `ULTIMA.EXE:0x5356`, | `cmp ax, 0xab` / `jne 0x535e` | `0x529a` si casa |
| `ULTIMA.EXE:0x535e`, | `cmp ax, 0xc8` / `jne 0x5366` | `0x528a` si casa |
| `ULTIMA.EXE:0x5366`, | `cmp ax, 0xc9` / `jne 0x536e` | `0x5292` si casa |
| `ULTIMA.EXE:0x536e`, | `jmp 0x532c` | `0x532c` |

**Confirmado**: en `0x535e` hay un `cmp` de una cadena de despacho por código de tecla, no una tabla.
Y la cita que lo ancla habla de *«tabla runtime»* con coordenadas de píxel de la consola. Coinciden
además las dos cifras que su acta da del partidor: `LEJANA(dist=16)` para `0x535e` y `dist=19` para
`0x5356` ✓ (leídas del volcado de `cita_pegajosa_atribucion.py` de esta rama).

★ **Un dato que la re-lectura añade y refuerza el (d)**: el tramo que envuelve a la cadena escribe
BYTES en dos arreglos distintos —`0x534e mov byte ptr [bx + si - 0x551e], 0x9e` con `si = arg << 5`,
y `0x537d mov byte ptr [bx + si - 0x539c], al` con `si = arg << 4`—, o sea que la rutina edita una
rejilla de bytes indexada por argumento. Es una rutina de EDICIÓN de pantalla despachada por tecla:
positivamente identificada como otra cosa, no sólo «no es una tabla». El (d) se sostiene.

## 3. Lo que la lectura de este carril AÑADE a la de `sueltos-174`

No es reproche: son dos lecturas con foco distinto. Cotejado grep a grep contra sus actas t5/t6/t7,
**nada de esto aparece en ellas**:

| hallazgo | dónde | estado en las actas de `sueltos-174` |
|---|---|---|
| El eje `fila+1` corroborado desde OTRO overlay (trampa #70) | acta 1 §2.6 | ausente |
| Dos «no verificado» suyos de `TOWN`, CERRADOS | acta 1 §2.6 | declarados sin verificar en su t5 §2.5 |
| `globals.json` cotejado: `g_alive_a` @48410, `g_cups_served` @48416 | acta 1 §2.5 | ausente |
| Seña para #105: la frase vive también en `main.ts:2720` | acta 1 §2.1 | ausente |
| Imprecisión de notación (jle por `or`/`jg`) | acta 1 §2.1 | ausente |
| Ambigüedad #194 en `itemPageController.ts:40` | acta 1 §2.7 | ausente |
| La lente #199 sobre `DNGLOOK`, con motivo de extensión | acta 1 §2.2 | su t5 §4 dice «ninguna de las 6 citas lleva el token» |

★ **El último merece precisión, porque NO es una contradicción.** Su t5 afirma que ninguna de sus
seis citas lleva el token `kernel`, y es cierto **para la ventana de la cita** (la línea del par ±
unas pocas). El token está en `dungeon.ts:567`, diez líneas por encima de la línea del par, o sea
**en el mismo DOCBLOCK pero fuera de la ventana**. ⇒ la seña operativa para #199 es de ALCANCE:
*la lente hay que pasarla a escala de DOCBLOCK, no de ventana de cita*; y cuando se pasa así,
`DNGLOOK:0x0013` sí la lleva, y sale benigna por la extensión del overlay (§2.2 del acta 1).

## 4. ★★ TRES DE LOS CUATRO CABOS DE #205, CERRADOS

La tarjeta #205 recoge cuatro cabos declarados por el cierre. Tres caen con material ya medido:

### 4.1 Cabo (3) — «`[bp-4]` de `CMDS.OVL:0x1ac6` sin derivar»: **DERIVADO** (acta 1 §2.1)

`[bp-4]` es el **flag de re-pregunta**, y su ciclo de vida entero cabe en tres instrucciones:

| call-site | instrucción | papel |
|---|---|---|
| `CMDS.OVL:0x1a78`, | `mov word ptr [bp - 4], 1` | siembra a 1 en CADA pasada, justo antes del prompt |
| `CMDS.OVL:0x1aae`, | `mov word ptr [bp - 4], 0` | lo borra al hallar un reagente MARCADO insuficiente |
| `CMDS.OVL:0x1ac6`, | `cmp word ptr [bp - 4], 0` / `je 0x1a78` | si está a 0, vuelve al prompt |

Son **los únicos tres accesos** de la rutina `0x1a70-0x1ad4` ⇒ enumeración completa, no muestra.

### 4.2 Cabo (2) — «el CUARTO argumento del spawn de `ULTIMA.EXE:0x6b85`»: **no hay cuarto, hay CINCO**

| call-site | instrucción | qué empuja |
|---|---|---|
| `ULTIMA.EXE:0x6b85`, | `mov ax, 1` / `push ax` | **1** |
| `ULTIMA.EXE:0x6b89`, | `mov ax, 2` / `push ax` | **2** |
| `ULTIMA.EXE:0x6b8d`, | `mov ax, 5` / `push ax` (en `0x6b90`) | **5** |
| `ULTIMA.EXE:0x6b91`, | `push ax` — **sin `mov` propio** | **5 otra vez** |
| `ULTIMA.EXE:0x6b92`, | `mov al, [g_floor]` / `sub ah, ah` / `push ax` | **g_floor** |
| `ULTIMA.EXE:0x6b98`, | `call 0x6506` | el spawn |

★★ **El cabo existe por un punto ciego de censo, no por un argumento oscuro.** Hay **CUATRO `mov`
productores y CINCO `push`**: el `push ax` de CS `0x6b91`, que reutiliza el `ax` que dejó el `mov ax, 5` de
CS `0x6b8d`, **no tiene `mov` propio**. Un censo que empareje cada `push` con un `mov ax, imm`
precedente cuenta cuatro argumentos donde hay cinco, y el que se pierde es un DUPLICADO del
anterior — invisible justo porque su valor ya estaba en el registro.

⇒ los cinco valores empujados son **1, 2, 5, 5, `g_floor`**. (El reparto a posiciones de origen
depende del convenio del callee y NO se afirma aquí; lo derivado es el CONJUNTO ORDENADO de pushes
y su cardinalidad.) Y la guarda que gobierna todo el bloque es `0x6b7e cmp byte ptr [g_unk_adb9],
0xdc` / `jne 0x6bbb`.

★ Familia: `censos-rutinas-puntos-ciegos`. La regla que deja: **contar argumentos por `mov` es
contar productores, no argumentos; el contador correcto es el `push`.**

### 4.3 Cabo (4) — «el flag de `FONT.OVL:0x03aa` (`[bp+4]`)»: ★★ **NO ES UN FLAG, y la etiqueta «noche» queda REFUTADA**
> ⚠ **BANNER 2026-07-30 — la ATRIBUCIÓN de este par ya no la sostiene la banda (ruling
> #204/#217).** Con `sower_upper` encendido por omisión, `FONT.OVL:0x03aa,` SALE de la
> banda pegajosa: `skin/fiel/skin.ts` nunca nombra `FONT.OVL` en MAYÚSCULAS, así que el
> único aval de la atribución era un token en minúsculas. Es el control positivo del
> criterio (`pegajosa-instrumento-217-acta.md` §4) y el caso que `generos-194-acta.md`
> §3.2 ya había marcado como **cerrado DOS VECES sobre el cuerpo equivocado**. Lo que
> sigue se conserva como REGISTRO; no se re-adjudica aquí. El arreglo constructivo no es
> revertir el criterio: es nombrar el overlay en mayúsculas en el docblock del port.


La rutina que contiene el par va de `0x02fc` a `0x0415` (prólogo anterior y siguiente medidos), y
`[bp+4]` es su ÚNICO argumento (`ret 2`). Tiene **exactamente dos accesos** en todo el cuerpo:

| call-site | instrucción | qué hace con el argumento |
|---|---|---|
| `FONT.OVL:0x03aa`, | `cmp word ptr [bp + 4], 0` / `je 0x3b7` | lo COMPARA con 0 |
| `FONT.OVL:0x0406`, | `dec word ptr [bp + 4]` / `je 0x40e` | lo **DECREMENTA** |
| `FONT.OVL:0x040b`, | `jmp 0x304` | y si no ha llegado a 0, **vuelve al cuerpo** |
| `FONT.OVL:0x040e`, | `sub ax, ax` / `ret 2` | agotado ⇒ devuelve 0 |

**Un booleano no se decrementa.** `[bp+4]` es un CONTADOR DE REPETICIONES: la rutina corre su cuerpo
N veces y sale cuando la cuenta expira.

Y los CUATRO call-sites de la rutina, dentro del propio overlay, lo confirman por DOMINIO:

| call-site | instrucción | argumento |
|---|---|---|
| `FONT.OVL:0x065f`, | `mov ax, 1` / `push ax` / `call 0x2fc` | **1** |
| `FONT.OVL:0x06be`, | `mov ax, 1` / `push ax` / `call 0x2fc` | **1** |
| `FONT.OVL:0x07f0`, | `mov ax, 1` / `push ax` / `call 0x2fc` | **1** |
| `FONT.OVL:0x0919`, | `mov ax, 7` / `push ax` / `call 0x2fc` | **7** |

★★ **Un flag no vale 7.** El dominio observado es `{1, 7}`, no `{0, 1}`.

⇒ **el cabo (4) se cierra, y en dirección más fuerte de la que pedía**: `sueltos-174` adjudicó el
offset como discriminador y se abstuvo, con razón, de la etiqueta «noche»; aquí la etiqueta queda
**positivamente refutada**, no meramente sin verificar. Lo que discrimina ese `cmp`, el de CS `0x03aa`, es «¿queda
cuenta por gastar?», y de ahí no sale un brazo «de noche».

★ Lección de método, y es la que ya está catalogada como «acota el DOMINIO antes de dar de alta un
nombre»: **un `cmp X, 0` PARECE un test booleano; sólo el dominio del argumento dice si lo es.**
Aquí bastó con censar los cuatro call-sites — cuatro líneas de grep — para tumbar una etiqueta.

> ★★ **ACOTACIÓN DE ESTE §4.3 — #194, 2026-07-29.** Todo lo de arriba sobre el CUERPO de
> `FONT.OVL` **queda intacto y verificado**: `[bp+4]` se decrementa en `0x0406`, los cuatro
> call-sites pasan `{1,7}`, y no es un booleano. Lo que se retira es **a quién refutaba**.
> La frase «la etiqueta «noche» **del docblock del port** queda refutada» es falsa: el
> docblock del port (`skin.ts:1315`) nunca habló de FONT. Nombra `look_sky`, que el ledger
> sitúa en `LOOKOBJ.OVL:0x0366`+412 ⇒ contiene `0x03aa`, y allí `0x03aa` **es** la rama de
> noche: a ella saltan los dos brazos del gate de hora, `LOOKOBJ.OVL:0x036e`, y `LOOKOBJ.OVL:0x0375`. El
> par `FONT.OVL:0x03aa × skin.ts:1315` lo fabricó la política PEGAJOSA heredando el token
> `font` del parámetro `font: FaithfulFont` de `skin.ts:1276`. Ver la retractación gemela
> en `sueltos-174-t7-acta.md §2.3` y el eje B de
> `python3 re/tools/cita_rama_hermana.py --rancio`.
>
> ★ **La lección que esto añade a la de arriba**: refutar una etiqueta exige leer el cuerpo
> **Y** comprobar que ese cuerpo es el que la prosa acusada estaba citando. Aquí lo primero
> se hizo bien y lo segundo no se hizo, y por eso una derivación correcta acabó absolviendo
> a un texto que no la necesitaba y condenando a uno que ya era fiel.

**Cabo (1) NO se toca**: la salida silenciosa de `MAINOUT.OVL:0x031e` y qué devuelve `0xffffb4be`
es una derivación mayor y solapa con #178. Queda entero para #205.

## 5. Lo que esta sub-tanda NO ha hecho

- **No ha tocado `game/src` ni `re/tools`.** Ni una línea.
- **No ha re-leído los 8 pares restantes** de `skin`/`ui` que `sueltos-174` cerró en t6/t7. Con la
  celda cerrada en main, re-leerlos era duplicación sin control añadido; se prefirió gastar el
  presupuesto en el (d) —el único veredicto que retira un par— y en los cabos de #205.
- **No ha verificado** las cifras de conteo de las actas t5/t6/t7 más allá de los ocho pares
  cotejados y de las dos distancias del partidor de §2.
- **No propone** re-abrir la celda: `DIVERGE × (FORZADA+LIMPIA)` sigue **64/64**, y estas 8
  re-lecturas la confirman, no la mueven.

## 6. Gates (EXIT por separado, sin pipes, re-corridos tras el `git add`)

```
python3 re/tools/seed_gate.py                        EXIT=0
python3 -m pytest re/tools/test_frontier.py -q       EXIT=0
python3 -m pytest re/tools/test_genero.py -q         EXIT=0
python3 -m pytest re/tools/test_cita_segmento.py -q  EXIT=0
python3 re/tools/genero.py                           EXIT=0
python3 re/tools/cita_pegajosa_forma.py              EXIT=0   (3 controles verdes)
python3 re/tools/cita_pegajosa_atribucion.py         EXIT=0   (3 controles verdes)
```

`game/src` no se ha tocado ⇒ no aplican `tsc` ni `vitest`. Sin e2e (mutex ajeno).
`routine-census.json` NO regenerado (EMBARGO). `pytest re/tools` COMPLETO no corrido.

---

## 7. Nombres de overlay usados aquí (sección FINAL a propósito)

Al final por el ctx pegajoso de #84. Overlays nombrados: `CMDS.OVL`, `DNGLOOK.OVL`, `FONT.OVL`,
`MAINOUT.OVL`, `SHOPPES.OVL`, `SHOPPES2.OVL`, `TOWN.OVL`, `ULTIMA.EXE`, `ZSTATS.OVL`.
