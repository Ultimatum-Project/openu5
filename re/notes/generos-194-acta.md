# #194 — GÉNERO «DOCBLOCK RANCIO»: censo, adjudicación y fixes de prosa

Carril `generos-194`, rama `re/generos-194`, árbol base `main@994d4fc2`.
Parte 1 de un encargo doble; la parte 2 (#142, comilla literal) va en `generos-194-t2-acta.md`.

**Titular**: el género existe y hay UN rancio real arreglado (`transport.ts`), pero el
hallazgo que transfiere es otro — **el eje que parecía cazar rancios cazó, 21 de 21, un
defecto del INSTRUMENTO**: la política PEGAJOSA de atribución de citas hereda el nombre de
overlay de tokens que son HOMÓGRAFOS en minúsculas (`font`, `cast`, `town`, `combat`…), y
bajo la política ESTRICTA ese eje da **CERO**. Uno de esos 21 llegó al expediente: el par
`FONT.OVL:0x03aa × skin.ts:1315`, adjudicado DOS VECES en las actas de #174 sobre el cuerpo
de un overlay que la cita nunca nombró. Retractado en las dos.

---

## 1. Método del censo, ANTES de las cifras

Instrumento: **extensión del extractor compartido**, `re/tools/cita_rama_hermana.py --rancio`
(la regla de la casa: parametrizar el canónico, jamás un escáner paralelo). Reutiliza
`collect_cites` sin tocar su cuerpo; lo único que añade es la **unidad de lectura**, que pasa
de LÍNEA a **DOCBLOCK** (`docblock_at`), porque una cabecera rancia casi nunca miente en el
renglón de la cita: miente en el párrafo.

**Unidad de cifra**: par `(overlay, offset)`. **Población**: comentarios de `game/src/**/*.ts`.
**Ancla**: `main@994d4fc2` (el productor está commiteado en esta rama; las cifras se
reproducen con el comando de arriba).

Tres ejes, con lo que cada uno afirma y lo que NO:

| eje | qué afirma | qué NO afirma |
|---|---|---|
| **A** careo de hermanos | dos o más DOCBLOCKS distintos hablan del mismo par | que se contradigan — eso es lectura |
| **B** atribución contradicha | la LÍNEA de la cita nombra una rutina que el ledger sitúa en otro overlay Y que CONTIENE el offset | cuál de los dos (comentario o atribución) es el equivocado |
| **C** corrección huérfana | el offset aparece en una sección de CORRECCIÓN/ERRATA/REFUTACIÓN de `re/notes` y sigue citado por un docblock | que el docblock esté rancio: puede ya llevar la corrección |

### Límites declarados (los cuatro, medidos)

1. **Sólo `game/src`.** Un docblock rancio en `re/notes` o en los tests no entra por aquí.
2. **Sólo citas resolubles**: el offset tiene que existir como instrucción en el disasm de
   ese overlay. Sin `re/disasm/*.asm` symlinkeados el barrido devolvería ceros MUDOS.
3. **El eje B depende del ledger.** Si `re/ledger/frontier.json` no está, el eje sale vacío
   (declarado en voz alta en `routine_index`, no en silencio).
4. **El eje B necesita ALIAS POR PREFIJO** y está medido que sí: la cita que motivó el eje
   dice `look_sky` y el ledger la tiene como `look_sky_sun_or_stars`. Con igualdad estricta
   el detector **no encuentra el caso que lo justifica**. Se exige frontera de `_` para que
   `cmd_get` no case con `cmd_getkey`.

### Control POSITIVO del censo

Los tres ejemplares confirmados del encargo tenían que salir, y salen los tres:

| ejemplar | lo caza | adjudicación |
|---|---|---|
| `COMSUBS.OVL:0x0568` × `combat.ts:1939` (canónico, #174 t4) | eje C | **YA ARREGLADO en main** (a3efe440) — el docblock de hoy dice lo contrario de lo rancio |
| `MAINOUT.OVL:0x01fe` × `transport.ts:334` («REMANDO») | eje C | **RANCIO REAL** — arreglado aquí |
| `FONT.OVL:0x03aa` × `skin.ts:1315` («noche») | ejes B y C | **FALSO POSITIVO del género y defecto del instrumento** — el port tenía razón |

---

## 2. Cifras (ancla `994d4fc2`, unidad = par `(overlay, offset)`)

| | ESTRICTA | PEGAJOSA |
|---|---|---|
| citas en `game/src` | 1957 | 5439 |
| pares distintos | 999 | 2909 |
| **(A)** pares con ≥2 docblocks | 387 | 1071 |
|  · de ellos con retractación asimétrica | 133 | 345 |
| **(B)** atribución contradicha por la línea | **0** | **21** |
| **(C)** offset corregido en notas y aún citado | 34 | 47 |

★★ **La fila que importa es la (B): 0 contra 21.** No es que la pegajosa «pueda» atribuir
mal — es que **los 21 conflictos que produce son 21/21 suyos**, y la estricta no genera
ninguno. Es la medida más limpia que tenemos hoy del coste de esa política, y es del mismo
género que #188 (ciego al segmento) y #84 (ctx pegajoso re-atribuye en silencio).

---

## 3. Eje B adjudicado al 100% — 21/21, y el port tiene razón en los 21

En los 21, la línea del port nombra una rutina, el ledger la sitúa en el overlay `Y`, y el
offset citado cae DENTRO de su cuerpo en `Y`; el extractor lo había colgado de `X ≠ Y`.
La lectura es la misma en todos: **el comentario es correcto y la atribución es falsa.**

| par atribuido | fichero del port | la línea nombra | vive en |
|---|---|---|---|
| `CAST2.OVL:0x0936`, `0x0986` | `world/shrine-ceremonies.ts:191` | `cmd_enter` | `MAINOUT.OVL:0x08de`+316 |
| `CMDS.OVL:0x1b28` | `core/game.ts:4908` | `cmd_get` | `SJOG.OVL:0x18ce`+614 |
| `COMBAT.OVL:0x0084` (×3) | `game.ts:594`, `:6146`, `:6307` | `dng_enter_room` | `DUNGEON.OVL:0x0000`+308 |
| `DNGLOOK.OVL:0x065a` | `dungeon/dungeon.ts:810` | `search_dungeon` | `SJOG.OVL:0x0646`+790 |
| `DUNGEON.OVL:0x0000` | `skin/fiel/skin.ts:1503` | `select_player` | `ZSTATS.OVL:0x0000`+130 |
| `DUNGEON.OVL:0x179e` | `__parity__/dungeon-run.ts:146` | `get_dungeon`→`get_dungeon_chest_contents` | `SJOG.OVL:0x179e`+304 |
| `EGA.DRV:0x01ac` | `skin/fiel/zodiac.ts:70` | `draw_zodiac_star` | `LOOKOBJ.OVL:0x01ac`+160 |
| `EGA.DRV:0x056f` | `skin/fiel/intro.ts:430` | `draw_menu_border` | `INTRO.OVL:0x04e0`+208 |
| `EGA.DRV:0x077f`, `0x0819` | `skin/fiel/skin.ts:2750` | `render_item_list` | `ZSTATS.OVL:0x06e8`+690 |
| `ENDGAME.OVL:0x05e2` | `core/usePicker.ts:97` | `print_list_row` | `ZSTATS.OVL:0x05e2`+262 |
| `INTRO.OVL:0x1132` | `skin/fiel/gemmap-overworld.ts:111` | `gem_view`→`gem_view_32x32` | `LOOKOBJ.OVL:0x10fc`+212 |
| `SJOG.OVL:0x1850` | `combat/combat.ts:2636` | `print_string` (la línea DICE «kernel») | `ULTIMA.EXE:0x1850`+494 |
| `EGA.DRV:0x0479` · `ULTIMA.EXE:0x041a`, `0x04a9`, `0x04b0` | `world/zodiac-view.ts:32/51/102/104` | `look_sky` | `LOOKOBJ.OVL:0x0366`+412 |
| `FONT.OVL:0x03aa` | `skin/fiel/skin.ts:1315` | `look_sky` | `LOOKOBJ.OVL:0x0366`+412 |

### 3.1 El MECANISMO, nombrado: HOMÓGRAFO DE NOMBRE DE OVERLAY

`OVERLAY_TOKEN` casa **sin distinguir mayúsculas**, y la mitad de los nombres de overlay de
este binario son palabras corrientes de TypeScript y de inglés: `font`, `cast`, `town`,
`npc`, `intro`, `combat`, `dungeon`, `talk`, `flames`, `her`. En la pasada pegajosa basta con
que una de ellas aparezca como identificador dentro de la ventana de 40 líneas para que
siembre el contexto.

El caso medido, con línea y distancia: `skin.ts:1276` declara el parámetro
`font: FaithfulFont` — TypeScript, no overlay — y **39 renglones más abajo**, en
`skin.ts:1315`, un offset desnudo, CS `0x03aa`, hereda el overlay `FONT.OVL`.

Censo del canal completo, misma corrida: **299** atribuciones pegajosas sembradas por un
token que NO está en mayúsculas, repartidas en `dungeon` 63 · `combat` 58 · `endgame` 53 ·
`town` 25 · `npc` 25 · `cast` 18 · `intro` 16 · `ultima` 12. Las 299 **no son 299 errores**
—la mayoría hablan de verdad de ese overlay— pero son 299 atribuciones cuyo único aval es
una palabra en minúsculas. El eje B es sólo el subconjunto en el que la propia línea aporta
la prueba de que la atribución es falsa.

### 3.2 Alcance del daño en el expediente: UNA, y estaba cerrada dos veces

De los 21 pares, **sólo uno, `FONT.OVL:0x03aa`, tiene entrada en las actas** (cotejado con `grep -F` sobre
`re/notes/*.md`, con control positivo: hay 6 actas que contienen la cadena literal
`FONT.OVL:0x03aa`, así que el grep no está mudo). Los otros 20 nunca llegaron a adjudicarse.

Ese par se cerró **dos veces sobre el cuerpo equivocado**:

- `sueltos-174-t7-acta.md §2.3` lo dio por «(a) en sus límites» leyendo el `cmp [bp+4],0` de
  FONT y concluyendo que «encaja con una rutina de cielo con modo día/noche».
- `sueltos-b-174-t2-acta.md §4.3` **refutó** la etiqueta «noche» del docblock del port
  midiendo que `[bp+4]` de FONT es un CONTADOR de repeticiones.

**Ambas leyeron bien un cuerpo que la cita del port no estaba citando.** Lo que `skin.ts:1315`
nombra es `look_sky`, y ahí `0x03aa` **sí** es la rama de noche:

| offset | instrucción | efecto |
|---|---|---|
| `LOOKOBJ.OVL:0x036e`, | `cmp byte ptr [g_hour], 6` / `jb 0x3aa` | antes de las 6 → salta a la noche |
| `LOOKOBJ.OVL:0x0375`, | `cmp byte ptr [g_hour], 0x12` / `jae 0x3aa` | 18:00 o más → salta a la noche |
| `LOOKOBJ.OVL:0x037c`, | `mov ax, 0x72f0` / `call 0x75c0` | día → «the sun!» |
| `LOOKOBJ.OVL:0x03ea`, | `mov word ptr [bp - 4], 0x50` | noche → 80 estrellas |

**Lo que NO se retira**: la derivación de FONT sigue en pie — `[bp+4]` se decrementa en
`FONT.OVL:0x0406` y sus cuatro call-sites pasan `{1,7}`, así que no es un booleano. Se retira
**a quién refutaba**. Retractaciones escritas en los dos ficheros.

★ **La lección que esto añade**: refutar una etiqueta exige leer el cuerpo **y** comprobar que
ese cuerpo es el que la prosa acusada citaba. Aquí lo primero se hizo bien y lo segundo no se
hizo, y una derivación correcta acabó absolviendo a un texto que no lo necesitaba y condenando
a uno que ya era fiel.

---

## 4. Los fixes de prosa (cero lógica, cero valores de aserción)

### 4.1 `game/src/core/world/transport.ts` — el rancio REAL

La cabecera de `shipTryMove` rotulaba como «REMANDO» el bloque CS `0x0312`-CS `0x0347`, y presentaba
«Blocked!» como el complemento del cactus. Las tres cosas están contradichas por
`re/notes/transport.md §7E` (corrección de #169) y por el cuerpo, que dice:

| offset | instrucción | qué es |
|---|---|---|
| `MAINOUT.OVL:0x0312`, | `cmp byte ptr [g_transport_tile], 0x20` / `jb 0x322` | discriminador A-PIE / VEHÍCULO, no «remar» |
| `MAINOUT.OVL:0x031e`, | `cmp al, 0xec` / `je 0x34a` | **tercera salida: SILENCIO**, sin mensaje ni beep |
| `MAINOUT.OVL:0x0322`, | `mov ax, 0x29ae` / `call 0xffff9680` | «Blocked!» — **antes** del test de cactus ⇒ en los DOS brazos |
| `MAINOUT.OVL:0x0329`, | `cmp word ptr [bp - 6], 0x2f` / `jne 0x33c` | el test de cactus |
| `MAINOUT.OVL:0x032f`, | `mov ax, 0x29b8` / `call 0xffff9680` / `call 0xffffa8d8` | «OUCH!» + daño al party |
| `MAINOUT.OVL:0x033c`, | `mov ax, 0xa5` / `mov ax, 0xc8` / `call 0xffffa0f0` | beep de choque (excluyente del OUCH) |

La cabecera nueva dice las tres: que la cola la comparten pie y vehículo, que el complemento
tiene TRES partes y no dos, y que la salida silenciosa es hoy **inexpresable** en esta firma
(cabo abierto de #178/#205: sin derivar qué devuelve la llamada de `MAINOUT.OVL:0x0236` ni qué
es `0xec` en ese dominio).

⚠ **Divergencia DECLARADA y no arreglada** (queda fuera del carril porque toca texto emitido):
`shipTryMove` devuelve **un solo** `message`, así que la vía naval emite «OUCH!» sin el
«Blocked!» previo. La vía a pie sí lo calca (`game.ts:1175-1184`, con testigo LP1 part07-g12
«Blocked! 0UCH!»). Declarado en el propio docblock.

### 4.2 `game/src/core/world/movement.ts` — el hermano, con DOS nombres vivos

El docblock de `onCactus` llamaba a la rutina `move_try`. Ese nombre **no existe en
`re/ledger/frontier.json`**: lo acuñó `cactus-ouch-acta.md`, y el ledger la tiene como
`ship_try_move` (`MAINOUT.OVL:0x01fe`+342). Eran dos nombres vivos para la misma rutina — la
enfermedad que #178 está curando. Además colgaba el print de «Blocked!» de `0x0329`, que es el
`cmp` del cactus, no el impresor. Corregidos los dos, con el orden exacto del binario.

### 4.3 `re/notes/sueltos-174-t7-acta.md` y `re/notes/sueltos-b-174-t2-acta.md`

Las dos retractaciones de §3.2, cada una con la tabla ASM que la respalda y con el alcance
exacto de lo que se cae y de lo que sigue en pie.

---

## 5. Lo que este carril NO ha hecho, y por qué

- **El eje A (387 pares estrictos / 1071 pegajosos) NO se ha leído.** Es una población de
  lectura humana, no un veredicto, y no cabía junto a la parte 2 del encargo. Queda ordenada
  por el criterio de retractación asimétrica (133 estrictos) y reproducible con el comando.
- **El eje C se ha adjudicado en sus 3 controles, no en los 47.** Y su calibración medida en
  esos tres es **1 rancio real de 3**: uno ya estaba arreglado en main y otro era el artefacto
  de atribución. El eje C detecta CO-OCURRENCIA (offset citado en una sección de corrección Y
  citado por el port), no rancidez; con esa precisión, extrapolar sería inventar.
- **`main.ts` no se ha tocado** (embargo post-GO). Ningún hit adjudicado vivía allí.
- **No se ha tocado ninguna lógica ni ningún valor de aserción.** El diff de `game/src` es
  íntegramente comentarios.
- **No se ha corregido `cactus-ouch-acta.md`**, que es donde nació `move_try`: renombrar en una
  nota mueve semillas de nombre (`seed_gate`), y eso es material de #178, que ya tiene el
  renombre completo con dueño.

## 6. Cabos que este carril deja apuntados

1. **El homógrafo de overlay como criterio del extractor** (299 atribuciones pegajosas
   sembradas por un token en minúsculas). Lo barato y monótono sería exigir MAYÚSCULAS al
   token sembrador de la pasada pegajosa, o degradar a AVISO las que no lo estén. Es cambio de
   instrumento con consumidores vivos (`cita_pegajosa_forma`, `cita_pegajosa_atribucion`,
   `verify_pool174_claims`): **no se toca sin ventana propia y sin re-medir la banda**.
2. **Los 20 pares del eje B que nunca llegaron a las actas** están hoy sin adjudicar, y con la
   atribución falsa viva en cualquier barrido pegajoso futuro.
3. **La divergencia naval del cactus** (§4.1): el port se come el «Blocked!».
4. **El detector se lee a sí mismo**: tras escribir estas retractaciones el eje C sube de 47 a
   49, porque mis propias tablas ASM son «secciones de corrección que nombran offsets». No es
   un fallo, es la definición del eje; conviene saberlo antes de leer la cifra como tendencia.

---

## 7. ★★ EFECTO LATERAL MEDIDO: editar un COMENTARIO mueve la banda pegajosa

No estaba previsto y es el hallazgo más barato de esta parte. Los fixes de §4.1 y §4.2 son
**íntegramente comentarios** —ni una línea de lógica— y aun así movieron el reparto de
`cita_pegajosa_forma.py`:

| corrida | FORZADA | LIMPIA | LEJANA | AMBIGUA | TOTAL |
|---|---|---|---|---|---|
| `main@994d4fc2` | 20 | 130 | 74 | 121 | 345 |
| tras los dos fixes de prosa | 20 | 129 | 72 | 120 | 341 |

El gate sigue en **EXIT 0** (es un trinquete de no-crecimiento), así que nadie se habría
enterado. El mecanismo, medido par a par:

- **Se cayeron `MAINOUT.OVL:0x034a` y `MAINOUT.OVL:0x0520`**, que vivían en un comentario del
  CUERPO de `shipTryMove` y heredaban su overlay del docblock de la cabecera. Al alargar yo el
  docblock, esas líneas quedaron **a más de 40 renglones** del token `MAINOUT` y la ventana
  pegajosa las soltó. La ventana se mide en LÍNEAS, no en ámbito: **escribir prosa encima de
  una cita la borra del corpus**.
- **Apareció `TOWN.OVL:0x032f`**, que es MAINOUT: mi propio texto nuevo de `movement.ts`
  estrenó un offset desnudo y la ventana le pegó el overlay que tenía a mano. Es decir,
  **arreglando prosa fabriqué una mis-atribución del mismo género que estaba denunciando.**

**Arreglado en el mismo carril**: los dos docblocks nombran ahora `MAINOUT` en la MISMA LÍNEA
de cada offset, así que las citas pasan a la política ESTRICTA y dejan de depender de la
ventana. Efecto medido: la estricta sube de 999 a **1009** pares, sale del corpus el par espurio `TOWN.OVL:0x032f`,
y los dos pares caídos —`MAINOUT.OVL:0x034a`, `MAINOUT.OVL:0x0520`— vuelven al corpus,
ahora por la vía estricta.

★ **Lo que esto añade al expediente de #84 y #204**: la banda pegajosa no es sólo sensible a
*qué* se escribe, sino a *cuánto* se escribe y *a qué distancia*. Cualquier cifra de la banda
sin SHA es una foto, y ahora sabemos que hasta un carril de PROSA la mueve. La defensa barata,
y es la que se ha aplicado aquí, es **nombrar el overlay en la misma línea del offset** al
escribir cualquier comentario nuevo con citas.
