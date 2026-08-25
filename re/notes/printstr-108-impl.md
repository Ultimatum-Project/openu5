# #108 — IMPLEMENTACIÓN de la aritmética de filas del impresor del kernel

**Carril:** printstr-108 (ventana e2e con mutex) · **Fecha:** 2026-07-28
**Rama:** `fix/printstr-108` — fix en `a60ae085` sobre `main@f9b1e633`, **mergeada
`main@a23ffefa`** (21 commits, SIN conflictos, ninguno tocaba los 3 ficheros del fix) en
`8fffa3c6`. **Todos los gates re-corridos sobre el estado MERGEADO** (§6).
**Regla implementada:** `re/notes/printstr-1850-derivacion.md` §7 (doble testigo ciego del ASM;
este carril NO re-deriva nada — implementa y re-sella).

---

## 0. Resumen ejecutivo

El fix está **implementado, verificado con testigo vivo y con la suite entera en verde**.

- **Testigo vivo del defecto y de su cura** (§4): tecleando tres teclas no-comando seguidas,
  la base imprime `W-What?` · *blanco* · `D-What?` · *blanco* · `W-What?` · *blanco*, y la rama
  imprime `W-What?` · `D-What?` · `W-What?`. Es exactamente la predicción pre-registrada §8.1
  de la derivación, medida sobre el log LÓGICO (`view.snapshot().console`), no sobre píxeles.
- **Población medida** (§5): **88 cadenas literales** llegan hoy a `pushConsole` acabadas en
  `\n` (14 por `hud.message/echo` + 74 por eventos del core). Cada una perdía UNA fila.
- **Gates**: vitest 3610/3610 · `tsc --noEmit` 0 · `tsc -p tsconfig.e2e.json` 0 · e2e 218
  pasan y **0 fallos nuevos** (los 2 rojos son flakies pre-existentes, probados con CONTROL
  en el commit base, §6).
- **Residuo DECLARADO y no tapado** (§3): el port no arrastra columna ENTRE llamadas, así que
  el discriminante fino §8.5 («\n\nItem: » a media fila) sigue divergiendo. Va como DETECTOR
  con su baseline medido, **no** como sello de fidelidad. Cerrarlo es tarjeta aparte.

---

## 1. Lo que se cambió (3 ficheros)

### 1.1 `game/src/skin/coreview.ts` — el choke

`pushConsole` empujaba un `ConsoleLine` por cada trozo de `rendered.split("\n")`. El trozo
vacío final de toda cadena terminada en `\n` era una fila en blanco espuria. Ahora:

```
this.rowOpen = false;                      // el port no arrastra columna entre llamadas (§3)
for (i, parte) of rendered.split("\n"):
    if (i > 0) closeRow(kind);             // cada \n VUELCA
    appendText(parte, kind, rune);         // texto vacío NO abre fila (no dibuja glifo)
if (this.rowOpen) closeRow(kind);          // envoltorio del call-site (0x4a3a / ZSTATS 0x004d)
```

con dos privadas nuevas y el campo `rowOpen`:

| Pieza | ASM que la fija |
|---|---|
| `closeRow`: si hay fila abierta la CIERRA; si no, empuja una fila VACÍA | `1742: inc byte ptr [si+5]` — FILA++ **sin ninguna guarda**. La asimetría no la produce ninguna rama: la produce el estado previo de la columna `[si+4]` |
| `appendText`: texto vacío no abre fila; si hay abierta, concatena | pintado `1a1c-1a28` carácter a carácter; una fila **solo existe si se dibujó glifo** |
| El envoltorio final (`if rowOpen → closeRow`) | kernel `4a3a: call 0x1850 / 4a3d: call 0x1f12 / or ax,ax / je` y ZSTATS `004d` byte a byte (thunks con sesgo +0xE1E0 verificado con 3 puntos) |
| Cadena vacía = no-op | `186a-186f`: sale antes de tocar la ventana. Sale **sola**: con `""` no se dibuja glifo, no se abre fila y no hay nada que cerrar |

### 1.2 `game/src/main.ts:1230` — una compensación retirada

Era:

```ts
const consoleRows = view.snapshot().console;
if ((consoleRows[consoleRows.length - 1]?.text ?? "x") !== "") hud.message("");
```

Ahora: `hud.message("\n");`

**Por qué NO es cosmética y por qué había que tocarla.** Las dos piezas eran compensación del
propio defecto, y con la regla fiel las dos quedan mal:

1. `hud.message("")` **deja de imprimir nada** (0x186f). Si no se toca, la fila en blanco que
   separa cada bloque de turno de combate **desaparece en silencio** — habría sido una
   regresión introducida por mí, invisible para la suite.
2. La guarda «no dupliques si la anterior ya está vacía» existía porque `"*** CONFLICT ***\n"`
   metía un blanco espurio que **ya no existe**. Y el `putchar` del binario es INCONDICIONAL
   (COMBAT `@0x06f1 push 0xa; call 0x742a`), sin mirar qué había antes; §7.3 trampa 3 dice
   explícitamente que los blancos no se des-duplican.

No se ha tocado **ninguna cadena** del binario (regla de flota): `"\n"` no es prosa, es el
`putchar` que la propia cabecera del call-site ya citaba.

### 1.3 `game/tests/skin-coreview.test.ts` — 9 tests nuevos, failing-first

Bloque `#108 CoreViewImpl aritmética de filas (print_string 0x1850)`. **7 en rojo antes del
fix, 9 en verde después.** Cada `expect` lleva la cita ASM en su mensaje.

Los **2 que ya pasaban antes del fix son CONTROL POSITIVO**, no relleno: `"a\n\n\nb"` (blancos
interiores) y `"Spell name:\n:"` (DS 0x4603) son los casos que el port ya hacía bien. Que sigan
verdes prueba que el fix **no mueve lo que ya era correcto** — sin ellos, 7 verdes nuevos no
distinguirían «arreglado» de «cambiado a otra cosa».

---

## 2. ★ ADJUDICACIÓN del hueco §7.4: `pushConsole` es el ENVOLTORIO, no el impresor crudo

La derivación deja esto abierto y me obliga a resolverlo para poder implementar:

> «el idioma "consulta la columna y salta solo si no es 0" de §4.3: con fila abierta el port ya
> puede expresarlo, pero **ningún call-site del port lo usa hoy** y no he auditado cuáles
> deberían.»

**Adjudico que `pushConsole` modela el envoltorio del call-site** (kernel 0x4a3a: imprime,
mide columna, y baja de fila solo si no es 0), **no** el impresor crudo 0x1850. Evidencia,
por si alguien la quiere refutar:

1. **Censo de call-sites**: de 69 literales analizables en `hud.message/echo`, **51 no llevan
   `\n` ninguno** (`"Saving..."`, `"Save failed!"`, `"Welcome to Britannia!"`…) y cada uno es
   evidentemente una fila propia. Con el impresor CRUDO todos dejarían la fila abierta y el
   mensaje siguiente se pegaría al anterior.
2. **El port ya tiene la variante cruda, como primitiva aparte**: `messageAppend` / `echoAppend`
   existen justo para «continuar la fila viva», y sus cabeceras citan los flujos crudos del
   original (getdir 0x35EC `"Open-"`+`"North"`; Ready `"Item: "`+`"Done"` @0x123e). Si
   `pushConsole` fuese el impresor crudo, esas primitivas no harían falta.
3. **La convención está escrita en el propio repo**: `core/world/cmd-strings.ts:68` — *«Las
   cadenas llevan el `\n`/`--` de control fuera; el modelo de consola parte líneas.»*

La alternativa (impresor crudo, sin cerrar) queda **descartada por medición**, no por gusto:
con ella `hud.message("Saving...")` tras `messageAppend("Yes")` daría `"Save game? YesSaving..."`.

---

## 3. ★ RESIDUO DECLARADO — el port no arrastra COLUMNA entre llamadas

> ### ✅ ADENDA 2026-08-05 (carril `printstr-reconc`) — la cifra fue IMPUGNADA y SOBREVIVE
>
> `printstr-108-testigo-dosbox.md` §4-ter observó (replicado ×2) **0 blancos** donde esta
> sección declara que el original deja **1**, y avisó de que, de confirmarse, la divergencia
> sería «2 contra 0» — **una cota declarada de menos**. Reconciliado leyendo el ASM:
> **la cifra de esta tabla es CORRECTA y no se toca.**
>
> El oráculo midió la pantalla del Ready, que imprime **DS 0x9998 = `"Item: "` PELADO**
> (`cmd_ready` @0x12cc) — no `"\n\nItem: "`. Esta sección habla de **DS 0x97d8**, que sí se
> imprime, pero en la envoltura de **rechazo** ZSTATS 0x0bee (único llamador 0x0d30,
> *«Thou hast no ammunition for that weapon!»*). Son dos pantallas distintas.
>
> **La divergencia sigue siendo «2 contra 1»**, el residuo sigue abierto y el test DETECTOR
> de `skin-coreview.test.ts:506` ya estaba bien atribuido (su comentario cita 0x0bee).
> Ver `printstr-108-reconciliacion.md`.

**Lo que no cubre el fix.** `rowOpen` es estado INTRA-llamada: `pushConsole` entra en `false` y
sale en `false`. Por tanto el discriminante fino §8.5 **no se reproduce**:

| Caso | Original (derivado §5) | Port CON el fix |
|---|---|---|
| `"\n\nItem: "` desde columna 0 | 2 blancos | 2 blancos ✔ |
| `"\n\nItem: "` a media fila (tras `*Append`) | **1 blanco** | **2 blancos** ✘ |

**Por qué no lo he cerrado, y por qué no basta con poner `rowOpen = true` en `*Append`.**
En el original esas rutinas dejan el cursor en columna > 0, así que marcar la fila abierta sería
lo fiel. Pero **sus call-sites podaron el `\n` final de la cadena del binario**:

| Call-site | Cadena del binario | Lo que pasa el port |
|---|---|---|
| `main.ts:836` | `0x967a "Yes\n"` | `messageAppend("Yes")` |
| `main.ts:833` | `0x9676 "No\n"` | `messageAppend("No")` |
| `main.ts:814` | `"N\n"` | `messageAppend("N")` |
| `main.ts:2929`, `:3360` | `0x9970 "Done\n"` | `messageAppend(READY_UI.done)` |
| `ui/pickers.ts:134/137/144/149` | nombre / `0x96be "None!\n"` | `messageAppend(...)` |

Con la fila marcada como abierta, el `hud.message("Saving...")` de `main.ts:837` se pegaría al
`"Save game? Yes"` de la línea anterior. **La información de cierre está perdida en el
call-site, no en el impresor** — que es justo la forma que §4.3 predice para este hueco: el
idioma vive en quien llama.

**Cómo cerrarlo (tarjeta aparte, NO hecha aquí):** devolver a esas cadenas el `\n` podado y
dejar que `*Append` marque la fila abierta. Es un cambio de CADENAS, que mi encargo excluye
explícitamente y que necesita su propia auditoría verbatim.

**Instrumento dejado en su sitio:** el test
`DETECTOR: «\n\nItem: » tras messageAppend deja DOS blancos (original: UNO)` fija el **baseline
medido del port**, con el comentario diciendo que el original da UNO y que ponerse rojo
significa «el port cambió», **no** «el port se volvió fiel». Al cerrar el residuo, el valor
esperado pasa a `["Item: Ring", "", "Item: "]`.

---

## 4. Testigo VIVO: el defecto y su cura, medidos

Sonda temporal (no commiteada) sobre el log lógico, misma fuente que pinta la consola fiel.
Tres teclas no-comando seguidas (`w`, `d`, `w`) → dispatcher default 0x34D8/0x3450, las
cadenas `"W-What?\n"` / `"D-What?\n"` que **sí** llegan con su `\n`:

| CONTROL (`main@f9b1e633`, sin fix) | RAMA (con fix) |
|---|---|
| `"W-What?"`, `""`, `"D-What?"`, `""`, `"W-What?"`, `""` | `"W-What?"`, `"D-What?"`, `"W-What?"` |

Es el patrón §8.1 (*«tres filas CONSECUTIVAS, sin ninguna fila en blanco entre ellas»*) y la
nota de la derivación sobre el port (*«hoy muestra Pass, blanco, Pass, blanco…»*), confirmado
sobre el binario portado y curado por el fix.

**Corrección honesta a mi propio primer intento:** probé primero con `(P)ass` —el caso literal
de §8.1— y salió **igual en las dos ramas**, sin blancos. No es que el fix no hiciera nada: es
que `game.pass()` (`core/game.ts:2073`) emite `{kind:"message", text:"Pass"}` **con el `\n` ya
podado**, aunque `CMD_STRINGS.pass` valga `"Pass\n"` verbatim (DS 0xa134). O sea: el port
compensaba el defecto **de dos maneras distintas e incoherentes** —podando en origen unas
cadenas y dejando pasar el blanco en otras—, y por eso el caso canónico del acta no lo
exhibía. Hubo que buscar una cadena que llegase entera. **Si me hubiera quedado en la primera
sonda habría concluido «no cambia nada» y habría sido un cero en falso.**

---

## 5. Población afectada (medida, no estimada)

| Censo | Cifra |
|---|---|
| Literales en `game/src` que acaban en `\n` | 465 (48 ficheros) — **cota superior, engañosa**: muchos se podan antes de emitirse |
| **Los que LLEGAN a `pushConsole` con `\n` final** | **88** = 14 (`hud.message/echo` directos) + 74 (eventos `{kind:"message"\|"echo", text}` del core) |
| Call-sites `hud.message/echo` totales | 157 (69 con literal simple: 51 sin `\n`, 13 acabados en `\n`, 5 con `\n` solo interior) |

Las 88 perdían **exactamente una fila en blanco cada vez que se emitían**. Es cota INFERIOR:
no cuenta plantillas con interpolación ni `tf()`.

**Re-medido tras el merge de `main@a23ffefa`: sigue en 88** (14 + 74) — los 21 commites nuevos
de main no añaden cadenas de este género, así que la población del fix no se movió.

`i18n/es.json`: **0 valores acaban en `\n`** ⇒ la vía de traducción no mete filas de más y el
fix no cambia el conteo entre idiomas.

---

## 6. Gates (leídos por separado, SIN pipe)

Corridos **sobre el merge `8fffa3c6`** (main@a23ffefa dentro). Exits leídos por separado, sin pipe.

| Gate | Resultado (post-merge) |
|---|---|
| `vitest run` (todo `game/`) | **EXIT 0** — 282 ficheros, **3631 pasan**, 1 skip |
| `tsc --noEmit` | **EXIT 0** |
| `tsc -p tsconfig.e2e.json --noEmit` | **EXIT 0** |
| e2e SUITE COMPLETA | 217 pasan, 17 skip, **3 rojos — ninguno mío** (§6.1) |

(Pre-merge, sobre `f9b1e633`: vitest 3610 EXIT 0 · tsc ×2 EXIT 0 · e2e de consola —cmd-prompts,
cmd-fidelity, prompts, commands, ztats-echo, magic-ready— **33/33 EXIT 0** · espejo fase2 a..e
con `U5_ESPEJO_FASE2=1` **16/16 EXIT 0** · suite completa 218 pasan / 2 rojos del mismo pool.)

### 6.1 ⚠ La suite e2e completa NO da EXIT 0 — y tampoco lo da en `main` LIMPIO

El encargo pedía «suite e2e completa EXIT 0». **No se cumple, y está probado que no es por este
fix.** Dos worktrees de CONTROL, uno por cada base, no una sospecha:

| Corrida | Rojos |
|---|---|
| RAMA post-merge (`8fffa3c6`), suite completa | `shell-menu:137`, `shell-menu:185`, `shrines:160` |
| **CONTROL en `main@a23ffefa` LIMPIO**, suite completa | `shell-menu:137`, `shrines:160` |
| CONTROL en `main@a23ffefa` limpio, los 2 specs | `shell-menu:137` |
| RAMA pre-merge (`f9b1e633`), suite completa | `shell-menu:137`, `shrines:160` |
| **CONTROL en `f9b1e633` LIMPIO**, suite completa | `shell-menu:185`, `shrines:160` |
| RAMA, los 3 specs ×3 repeticiones | 3 rojos / 54 corridas, todos en `shell-menu` |

La **unión de rojos de todas las corridas es un pool de 3**: `shell-menu:137` («Atlas & guide»
abre el companion en pestaña nueva), `shell-menu:185` (drawer SISTEMA en `lang=es`) y
`shrines:160` (pozo «Horse»). **Los tres se han visto fallar en un control PRISTINO**, y los
recuentos cuadran (217+3 = 218+2 = 220). Fallan por `toHaveCount` / `expect.poll` sobre el DOM
del shell o la posición de la party: **ninguno lee el log de consola**, que es lo único que
este fix toca.

**Conclusión: 0 fallos nuevos, ni antes ni después del merge.** El gate «e2e completa verde»
está **bloqueado por flakies pre-existentes**, y queda como cabo para el lead — no lo he
arreglado porque está fuera del encargo y tocarlo sería ampliar alcance sin mandato.

---

## 7. Interacción con el separador de turno (declarada, no tocada)

`skin/fiel/console.ts:166` (`withTurnSeparatorsRich`) inyecta una fila en blanco antes de cada
fila que abre grupo, modelando el LF que el envoltorio de getkey imprime antes de leer cada
comando (MAINOUT `0x5cd`, gateado por `[0x5956]`). **Este fix cambia su entrada**: antes muchas
filas venían seguidas de un blanco espurio y la guarda «no dupliques si la previa ya está
vacía» **suprimía** el separador; ahora el blanco espurio no existe y el separador **se emite**.

Efecto neto en pantalla: el espaciado entre bloques de turno se mantiene, pero **su procedencia
cambia** — antes lo ponía el defecto, ahora lo pone el mecanismo derivado (0x5cd). Es una
mejora de causa, no de aspecto, y explica por qué la suite no se movió.

Cabo señalado, **no** arreglado: esa guarda de no-duplicar es en sí una colapsadora de blancos
y §7.3 trampa 3 dice que los blancos consecutivos son reales. Vive en otro mecanismo, tiene sus
propios tests y su propia derivación ⇒ fuera de esta tarjeta.

---

## 8. Impacto sobre el ESPEJO (declaración, sin re-correr)

El transcript del espejo sale del mismo log. Con este fix **cada cadena terminada en `\n` deja
una fila menos** ⇒ los conteos de fila del transcript cambian para las 88 cadenas de §5.

- La corrida **#45 selló su acta con el formato VIEJO** (con los blancos espurios). Su ancla
  **no se re-mide aquí** — no es trabajo de este carril, solo se declara el impacto.
- `cobertura-divergentes.ts` y el runner comparan por CONTENIDO de fila; las filas vacías extra
  eran ruido en el denominador. Al desaparecer, el número de filas comparables baja algo y la
  alineación con el OCR del original debería **mejorar** (el original tampoco tenía esos
  blancos). **Predicción falsable, no medida.**
- Las 5 specs del espejo fase2 pasan con el flag ON (16/16), así que el arnés no se rompe.

---

## 9. Qué queda abierto

1. **Residuo de columna entre llamadas** (§3) — tarjeta nueva: devolver el `\n` podado a las
   cadenas de los `*Append` y marcar fila abierta. Cierra el discriminante §8.5.
2. **Flakies de `shell-menu`** (§6.1) — pre-existentes, bloquean el «e2e completa verde».
3. **La guarda anti-duplicado del separador de turno** (§7) — colapsa blancos contra §7.3.
4. **Testigo DOSBox de §8** de la derivación — sigue opcional y ahora **más barato**: el port ya
   se comporta como la predicción, así que un testigo que muestre blancos entre `Pass` y `Pass`
   refutaría acta **y** fix a la vez.
