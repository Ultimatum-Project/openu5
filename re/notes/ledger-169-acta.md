# ACTA #169 — barrido del género «derivado en el ledger, archivado como UI en la nota»

> Rama `re/ledger-169`, worktree `.claude/worktrees/ledger-169`, RETENIDA.
> Todas las cifras de esta acta están medidas en el árbol de **`7c4aa56c`** (base de la
> rama) con `re/tools/capa_vs_mecanica.py`, que se commitea aquí y es re-ejecutable.
> Ninguna mecánica portada en este carril: el encargo era censar y adjudicar.

---

## 1. El género son DOS géneros, y el censo NO los suma

`re/notes/bola-144-acta.md` §7 avisa de no aplanarlos, y tenía razón por una razón
operativa: se detectan con instrumentos distintos.

| | dónde vive la etiqueta | qué hace falta para verla | detector |
|---|---|---|---|
| **#144** bola de cristal | en la NOTA, lejos de la derivación | cruzar ledger × nota | **D-CAPA** |
| **#157** cactus | en el NOMBRE, dentro del propio registro | leer el ledger consigo mismo | **D-ALCANCE** |

D-ALCANCE es barato y preciso: una rutina cuyo nombre asevera un alcance (`ship_`, `dng_`,
`draw_`…) y cuya PROPIA derivación describe conducta fuera de ese alcance. Autocontenido.

D-CAPA es el caro: mecánica en la derivación del ledger × etiqueta de capa
(render/UI/presentación/«es del comando X») más un descargo («NO portado», «pendiente») en
un bloque de una nota.

## 2. ★ El control positivo REFUTÓ el primer diseño, y ésa es la lección del carril

La primera versión de D-CAPA emparejaba rutina↔nota por **offset hex y nombre**. El
control #144 salió **ROJO**. El motivo, verificado sobre el blob `c91e78ff^`:

> el bloque de `lookobj.md` que archivaba la bola de cristal **no cita ni `0x099c` ni
> `cmd_look`**. Habla de «Esfera de cristal (0x29)» — el TILE.

Eso no es un accidente de esa nota: **es el mecanismo del género**. La prosa que archiva
mal una rutina tiende a no nombrarla, porque quien la escribe no está pensando en ella
como rutina. Un detector por offset habría devuelto CERO candidatos, y el cero habría
parecido una buena noticia. (Firma de `cero-emisiones-no-es-cero-capacidad` y de
`instrumento-equivocado-peor-que-ninguno`.)

El puente que sí funciona son los **TOKENS CONCRETOS COMPARTIDOS** — constantes hex y
cadenas entrecomilladas presentes a la vez en la derivación y en el bloque. Sobre el
control, el bloque tiene **4 tokens** y **3 son de frecuencia documental 1** en las 554
derivaciones (`"Death vision!"`, `"Strange vision!"`, `0xffffa6f8`): identifican la rutina
sin nombrarla. Criterio fijado: ≥2 tokens compartidos con df ≤ 3.

**Los tres controles, todos verdes** (`capa_vs_mecanica.py --self-test`, EXIT 0):

- **A (#157 cactus), VIVO en HEAD** — nadie renombró `ship_try_move` al aterrizar el fix,
  así que D-ALCANCE debe encontrarlo hoy. Lo encuentra.
- **B (#144 bola), CORREGIDO en main** — se calibra contra `c91e78ff^:re/notes/lookobj.md`,
  leído con `git show` en tiempo de test. Anclarlo a un SHA y no a una copia a mano es lo
  que impide que el control se pudra cuando alguien reescriba la nota otra vez.
- **NEGATIVO** — el mismo #144 en HEAD **no** debe disparar. Al principio disparaba: la
  prosa que NARRA el arreglo repite «renderer = UI» y «sin portar» en pasado. Se añadió la
  exclusión por marcador de RESOLUCIÓN, que distingue un archivado vivo de la cicatriz de
  uno cerrado.

⚠ Un cero de este instrumento **sin sus tres verdes no significa nada**, y por eso el
censo no se emite si el self-test falla (`return 1`).

## 3. Censo (árbol de `7c4aa56c`)

**Población:** 554 rutinas en `frontier-manual.json`, **205** con marcador de MECÁNICA en
su derivación; 367 notas en `re/notes/`.

**D-CAPA: 11 candidatos · D-ALCANCE: 8.** No se suman.

### Adjudicación — 2 reales de 19

| rutina | detector | veredicto |
|---|---|---|
| **ULTIMA.EXE:19076 `draw_sky_strip`** | **AMBOS** | ★ **(b) MAL ARCHIVADA, portada** + residuo sin portar |
| **MAINOUT.OVL:510 `ship_try_move`** | D-ALCANCE | **(b) MAL ARCHIVADA, portada** (#157); etiqueta viva |
| ULTIMA.EXE:17746 `bytecode` (0x4552) ×2 | D-CAPA | (a) bien archivada — pero destapó un hallazgo (§5) |
| ULTIMA.EXE:10496 `draw_status_panel` | D-ALCANCE | (a) FP léxico: «escribe» = *imprime*; cuerpo 0x2900-0x2a26 sin una sola escritura fuera de la pila |
| ULTIMA.EXE:19946 `draw_char_boxed` | D-ALCANCE | (a) FP léxico: «daño» venía de «Daños colaterales… NULOS», prosa de un merge (#84) |
| LOOKOBJ.OVL:4348 `gem_view_32x32` | D-ALCANCE | (a) ★ FP por **NEGACIÓN**: la cita dice «no hay ni una tirada»; los 3 `rand` del overlay están fuera del cuerpo |
| LOOKOBJ.OVL:2820 `gem_glyph_filled_cell` | D-ALCANCE | (a) FP léxico: «bitmap» = patrón de trama del rasterizador |
| COMBAT.OVL:2964 `combat_main_loop` | D-ALCANCE | (a) FP léxico: «bucle **exterior**» |
| DUNGEON.OVL:7432 `dng_exit` | D-ALCANCE | (a) correcto: salir de una mazmorra *es* reposicionar en el exterior |
| ULTIMA.EXE:8338 `rand_range` | D-CAPA | (a) es el callee citado, no lo archivado |
| 3 de `espejo-fase2.md:63` + 1 de `kernel-sweep-4.md:321` + 2 de `serpent-ranged-derivation.md:34` + 1 de `sonda-0xec:23` | D-CAPA | (a) **defecto de VENTANA** (§4) |

**Cero candidatos de la clase (c)** — mecánica ausente *entre los candidatos del censo*.
El único (c) del carril salió por otra vía y está en §5.

## 4. Defectos MEDIDOS del instrumento (declarados, no todos arreglados)

1. **Offsets cortos no son puente.** `0x0`, `0x72`… identifican tiles y constantes. La
   primera corrida emparejó las 7 rutinas de offset 0 con todo bloque que contuviera
   «0x0»: **60 de 69 candidatos, todos basura**. Arreglado: sólo forma rellena a 4 dígitos
   y offset ≥ 0x100.
2. **La ventana es el bloque markdown**, así que una TABLA larga o una lista numerada
   entran como UNO: la etiqueta viene de una fila y el descargo de otra, sin relación.
   4 candidatos eran eso. Igual con los bloques ```-cercados de listados de call-sites.
   **Sin arreglar.**
3. **El puente por nombre empareja por SUBCADENA**: `los_flood` disparó dentro de
   `los_flood_fill`. **Sin arreglar.**
4. **El léxico no entiende negaciones** (caso `gem_view_32x32`). Insalvable léxicamente;
   por eso todo candidato exige leer el cuerpo. **Sin arreglar, y es el límite del método.**
5. ⚠ **La prosa correctiva vuelve a disparar.** Tras escribir la corrección de
   `ui-text-layer.md`, el censo pasa de 11 a 12 candidatos y el nuevo es *mi propio bloque*
   (`ui-text-layer.md:237`). **No es un falso positivo**: ese bloque declara de verdad un
   residuo SIN PORTAR (el latch de §5). El detector está señalando la tarjeta que este
   carril acaba de abrir, que es lo correcto.

Candados en `re/tools/test_capa_vs_mecanica.py` (4 tests): los tres controles, que el
control #144 entre **por tokens y no por cita**, que los offsets cortos no puenteen, y que
`RESOLUTION` no se coma un «NO portado».
⚠ Ese último test existe porque el fallo ocurrió: `\bPORTADO\b` emparejaba **dentro** de
«NO portado» y la exclusión de resolución se comía justo los archivados que se buscaban.

## 5. Los dos hallazgos reales

### 5.1 `draw_sky_strip` (CS 0x4a84) — la rutina de dibujo que decide adónde te teleporta una moongate

Los **dos** detectores la marcaron por separado, y ahí estaba. Escribe estado del mundo:
`0x4aeb mov [0x5885],al` y `0x4b25 mov [0x5886],al` son las **únicas escrituras** de las
dos fases lunares en todo el corpus (censo sobre `re/disasm/*.asm`: 6 accesos = 2
escrituras + 2 relecturas internas + **2 lecturas externas** en `moongate_enter` 0x48a8,
que acaba fijando el destino del teleport).

**(b): la mecánica SÍ está portada** (`moongates.ts:59`/`:88`, misma tabla `DATA.OVL fo
0x1EEA`, mismo `-0x30`). Lo mal archivado era la PROSA. Corregidas la nota y la cita del
ledger. De propina, dos defectos del mismo cuerpo: el llamador único tiene **tres guardas**
que la cita omitía, y la **rama del underworld está MUERTA** por construcción (el llamador
ya filtra `floor>=0x80`).

★ **RESIDUO SIN PORTAR → tarjeta propia.** El original **latchea** las fases y sólo las
refresca en frontera de hora **y** en superficie, mientras `g_day` sube sin guardas
(`0x5051`). ⇒ **pasar medianoche en mazmorra o bajo tierra CONGELA las fases en las de
ayer**, y fase distinta ⇒ moonstone distinta ⇒ **destino de teleport distinto**. El port
recalcula por día en cada llamada y no tiene el par latcheado en estado (censado: 0
ocurrencias en `game/src`). ⚠ Que el latch sobreviva a save/load es **inferencia
aritmética, no verificación byte a byte**; declarado sin sellar.

### 5.2 ★★ An Tym: `antim-freeze.md` NIEGA un gate que sí existe — y la negación selló el hueco

Salió **siguiendo los callers** de un candidato adjudicado (a), no del candidato.

`antim-freeze.md` §2 afirma en negrita que el reloj de tiles «**NO está gateado por
`g_time_spell`**» y concluye que agua, cataratas, antorchas y banderas siguen animando bajo
An Tym. La derivación se paró **un nivel corto**: acertó que el call-site es único
(`0x46f7`) y que el cuerpo `0x4552-0x4701` no tiene `cmp g_time_spell` — pero **el gate
está en el CALLER**:

```
0x591D  cmp [g_time_spell], 0x54    ; 'T'
0x5924  mov byte ptr [0x5891], 0    ; LATCH a 0 en la cabecera de viewport_redraw
0x5933  cmp [0x5891],0 / je 0x5954  ; SALTA por encima de...
0x5941  call 0x4552                 ;   el tick de animación (y sus dos colas)
0x5944  call 0x2f62                 ;   y maybe_change_wind
```

⇒ **en el original, An Tym congela también terreno, fuego, banderas y viento.** La
respuesta que la nota daba al testigo era exactamente al revés.

**El corpus ya se contradecía**: `ambient-audio-audit.md:81` describe bien el latch y
`deliberate-divergences.md:1240` dice «Congelable con `g_time_spell==0x54`».

**(c) MECÁNICA AUSENTE Y SELLADA.** §3 de esa nota justifica el fix del port con «*el
terreno sigue*»; censado, `timeStopped` tiene **un único consumidor** en `game/src`
(`skin/fiel/skin.ts:2296`). **NO se porta aquí** (fuera de encargo); queda con tarjeta y
con las señas en la corrección de la propia nota. Firma de #151 (aserto de AUSENCIA sobre
la capa equivocada): «no hay gate» era cierto *de la rutina* y falso *del comportamiento*.

## 6. ANEXO — unificados los dos nombres de CS 0x4988

**GANADOR `resolve_command_char`; PERDEDOR `prompt_active_player`**, decidido por conducta
sobre el cuerpo leído entero (0x4988-0x4a83, 252 B, `ret` sin argumentos):

- **tres de los cuatro caminos devuelven SIN preguntar** — combate (`0x4995`, umbral
  estricto `>0x80`), `g_active_char != 0xFF` (`0x49b2`), y ≤1 elegible (`0x49fa`).
- Existe un **gemelo, ZSTATS.OVL 0x0000**, con el mismo esqueleto (rama de combate, prompt
  «Player: », eco del nombre, −1→«None!»). Lo que 0x4988 **añade** es precisamente el
  mecanismo para NO llegar al prompt. ⇒ `prompt_` nombra lo que la rutina **delega**.
- Convención: los seis `prompt_*` del ledger preguntan SIEMPRE; éste sería el único que
  puede volver sin preguntar.

⚠ **Auditoría honesta del ganador**: `command` **no lo justifica el cuerpo** — la rutina no
sabe qué comando la llamó. Lo aporta el call-site, y ahí es sólido (los 7 llamadores del
ledger son handlers de comando), pero queda declarado como **atributo de los llamadores**
para no reproducir el género «nombre que el cuerpo no sostiene».

★ **Dos correcciones al encargo, ambas verificadas:**

1. **El campo NO es `old_names[]`.** Ése es de `globals.json` (globales, lista). Para
   RUTINAS el campo es **`renamed_from`** (string), usado por 106 entradas de
   `frontier-manual.json`. Aplicado **encadenado**: `"kernel -> prompt_active_player"`.
2. **Renombrar una rutina NO pone a cero ningún canal de símbolos.** La premisa del encargo
   («la memoria del repo exige old_names para no romper el canal») vale para GLOBALES,
   cuyos nombres `disasm.to_asm` imprime dentro del `.asm`. El `.asm` **no imprime nombres
   de rutinas**. `re/notes/old-names-75-diseno.md:75-95` ya lo estableció, y corrige un
   encargo anterior idéntico.

Sustituidas **10 ocurrencias** (el campo `name` + 9 citas de prosa de los llamadores),
contadas antes y después; `frontier.json` **regenerado** con `frontier.py`, nunca a mano.

### 6.1 Dos hallazgos del cuerpo, apuntados y NO tocados

- **Falta el test del bit 0x80** en la rama de combate (`0x499c`): sus dos parientes —el
  selector de miembro de party en CS 0x2d7a y el gemelo de ZSTATS— sí comprueban «esto es
  un PJ, no un monstruo». Si el actor en turno es un monstruo, 0x4988 devuelve su campo +3
  como índice de party. Además el umbral discrepa del hermano por un valor (`>0x80` vs
  `>0x7f`).
- **La rama −2 es INALCANZABLE**: sólo la produce el selector de CS 0x2d7a con argumento
  ≠0, y 0x4988 entra por su envoltura de CS 0x2e8e, que fuerza el argumento a 0.
- Fidelidad del port, fuera de encargo: `pickCommandChar` (`ui/pickers.ts:118`) implementa
  los caminos 2-4 pero **no tiene la rama de combate**.

## 7. `ship_try_move`: por qué NO se renombra aquí

La etiqueta de alcance sigue viva en el nombre del ledger y en `transport.md`, y es la que
causó #157. **No se renombra**: `git grep -c` en el árbol del ancla da ocurrencias vivas en
**20 ficheros**, incluidos `game/src/core/world/transport.ts`, `game/src/core/game.ts`,
cuatro de tests y `re/notes/routine-census.json`. Un renombre a medias dejaría dos nombres
vivos — la enfermedad que el anexo acaba de curar para 0x4988. Corregida la PROSA (nota
con sección al final) y abierta tarjeta para el renombre completo.

## 8. Cola que deja este carril

1. ★ **Latch de fases lunares** (§5.1) — mecánica ausente, señas completas.
2. ★★ **Congelación de terreno/fuego/banderas/viento bajo An Tym** (§5.2) — mecánica
   ausente, señas completas, y una nota que hoy la declara inexistente ya corregida.
3. **Renombre completo de `ship_try_move`** (20 ficheros) — §7.
4. **Bit 0x80 y umbral 0x80/0x7f de 0x4988**, y la rama de combate ausente en
   `pickCommandChar` — §6.1.
5. Defectos 2, 3 y 4 del instrumento (§4), sin arreglar y con su coste declarado.

## 9. Gates (cada uno con su EXIT leído por separado, sin pipes, RE-CORRIDOS tras el `git add`)

```
python3 re/tools/seed_gate.py                        EXIT=0   (4 notas ✓)
python3 -m pytest re/tools/test_frontier.py -q       EXIT=0   (42 passed)
python3 re/tools/genero.py                           EXIT=0
python3 -m pytest re/tools/test_capa_vs_mecanica.py  EXIT=0   (4 passed, nuevo)
python3 re/tools/capa_vs_mecanica.py --self-test     EXIT=0   (3 controles verdes)
```

El `git add` fue ANTES de esta corrida a propósito: un gate corrido sobre `git ls-files`
antes del `add` es CIEGO a lo untracked y da verde en falso
(`gate-ls-files-ciego-a-lo-untracked`), y este carril añade tres ficheros nuevos.

⚠ **`pytest re/tools` COMPLETO: NO corrido, y con motivo.** Se lanzó y se abortó a los
~13 min **matando sólo mis dos PIDs** (16279/16306). `re/tools/test_combat_parity.py`
contiene `test_combat_trace_parity_live`, que es un test de oráculo EN VIVO: correrlo
desde este carril viola la REGLA 3 del régimen (jamás tocar el DOSBox del usuario).
Verificado que mi corrida **no llegó a levantar ningún proceso dosbox** (`pgrep dosbox`
vacío antes y después). Lo único que este carril toca de ese fichero es un COMENTARIO;
comprobado aparte que el módulo **importa** y que `ANIM_RAND_SITES` sigue valiendo
`(0x4625, 0x466d, 0x469f)`, y que sus 7 tests **colectan** sin error.

Nada de e2e, nada de playwright, `routine-census.json` no regenerado (EMBARGO respetado).
`frontier.json` regenerado con `frontier.py`, nunca a mano.
