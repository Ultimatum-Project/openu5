# Acta del carril `citas-109` — handlers de COMBATE citando el DESPACHADOR

**Tarjeta #109.** Rama `re/citas-109`, worktree `.claude/worktrees/citas-109`. CERO e2e.
Fecha: 2026-07-28.

---

## 0. TL;DR

1. **El instrumento con el que se iba a barrer estaba roto y da CEROS EN FALSO.**
   `git grep -E` **ignora `\b`** y devuelve 0 aciertos sin error y sin avisar (cero-en-falso). Mi primer
   censo con `git grep -n -E '0x(a1f0|a16a|…)\b'` dio **vacío** (cero-en-falso); el mismo barrido con
   `[^0-9a-fA-F]` da 96 citas. §1. **[ACOTADO t#114: es SÓLO `-E`; ver §1.]**
2. **La clase está DERIVADA, no supuesta**: las dos tablas tienen emisores **DISJUNTOS**
   en `re/disasm/` (columna arena = sólo `COMBAT.OVL.asm`, columna kernel = sólo
   `ULTIMA.EXE.asm`), 14 pares + 3 fragmentos. §2.
3. La cota que circulaba, «0x6df6-0x6e76», **no está derivada y es falsa por los dos
   extremos**: la real es **0x6d98-0x6ee6**, y **0x6e76 no lo empuja NADIE** en todo el
   disasm (es un puntero a mitad de la cadena de 0x6e66). §2.3.
4. **Censo completo: 96 citas** de la familia en ficheros *tracked* de `main`.
   **4 defectuosas**, 92 correctas. §4.
5. Las **3 ya conocidas siguen MAL EN `main`** — los arreglos (`ecba0697`, `d9abf8e0`)
   viven sólo en ramas de preview. Sirven de **control positivo: mi barrido las cazó las
   3**. NO las he re-arreglado (colisión garantizada con dos carriles vivos): van como
   PENDIENTE-DE-LEAD con fila y texto exactos. §5.
6. **★ CASO NUEVO, ARREGLADO**: `derive-dungeon-ops.mjs` citaba `DS 0xa1a0` para el
   `Klimb-` del **pasillo**, y el 0xa1a0 del kernel está tras un gate `g_location==0`
   ⇒ sólo overworld. El emisor del pasillo es DUNGEON.OVL `DS 0x6cce`. §6.
7. **Familia hermana medida**: 62 grupos de cadena duplicada en DATA.OVL con emisores
   disjuntos. La pareja arena/kernel es 1 de 62. Lista y herramienta re-ejecutable. §7.

---

## 1. ★ El instrumento: `git grep -E` descarta `\b` (CERO EN FALSO) (cero-en-falso)

Control, sobre un fichero donde la cadena **existe**
(`game/e2e/espejo-tour/ocr-profile.ts:346` contiene `DS 0xa1f0`):

```
git grep -c -E '0xa1f0'                     -- $F   →  $F:1      ✅
git grep -c -E '0xa1f0\b'                   -- $F   →  (vacío)   ❌ CERO EN FALSO (cero-en-falso)
git grep -c -E '0xa1f0([^0-9a-fA-F]|$)'     -- $F   →  $F:1      ✅
grep    -cE '0xa1f0\b'                         $F   →  1         ✅  (BSD/GNU grep SÍ)
```

`git grep` usa su propio motor de regex; `\b` no es un átomo válido **en el modo `-E`** (cero-en-falso) y
**no da error**: simplemente no casa nunca. Exit 1 = «sin coincidencias», indistinguible
de «no hay».

> ★ **ACOTACIÓN MEDIDA (tarea #114, 2026-07-28).** La frase «git grep no soporta `\b`» es
> DEMASIADO AMPLIA y desaconseja formas que sí funcionan. Medido sobre un fichero con
> `0x1578` y `0x15789`: con **`-E`** → exit 1 y 0 aciertos (roto); en el modo **por
> defecto** (BRE) → 1 acierto; con **`-G`** → 1 acierto; con **`-P`** → 1 acierto. O sea
> que **sólo `-E` descarta el `\b`** (cero-en-falso). Quien escribió `git grep '\bfoo\b'` SIN `-E` obtuvo
> resultados CORRECTOS y no hay que re-barrer lo suyo.
Es hermano de `grep -r` sobre symlinks y de `grep -i` sin plegar acentos: los tres
producen la respuesta *ausente* en vez de la respuesta *equivocada*, que es peor porque
cierra la pregunta.

**Consecuencia para el corpus:** cualquier barrido previo que usara `git grep -E` con
`\b` alrededor de un offset **está sin hacer aunque su acta diga que salió limpio**. No he
censado cuáles; queda apuntado como cola (§8).

**Barrido bueno** (el que se usa aquí): Python sobre `git ls-files`, con
`re.finditer(r'0x([0-9a-fA-F]{4})(?![0-9a-fA-F])', linea)`. Reproducible entero desde
`original/u5/ultima5/DATA.OVL` + `re/disasm/` sin depender de ninguna nota.

---

## 2. La derivación de las dos tablas

### 2.1 Método (evidencia, no inferencia)

1. Extraer de `DATA.OVL` todas las cadenas NUL-terminadas con su offset DS
   (`fileoff = DS + 0x10`) → 2 295 cadenas, **178 textos con más de un offset**.
2. Indexar `re/disasm/*.asm` por inmediato de 4 dígitos → offset ⇒ conjunto de ficheros
   que lo mencionan.
3. Un grupo duplicado es una **trampa de atribución** si sus miembros citados tienen
   emisores **disjuntos**: cada offset lo usa un overlay y sólo uno.

Para la pareja arena/kernel el resultado es limpio: **cada offset de la columna arena
aparece sólo en `COMBAT.OVL.asm`; cada uno de la columna kernel, sólo en `ULTIMA.EXE.asm`.**
Cero solapes. Eso es lo que convierte «los bytes coinciden» en derivación.

### 2.2 El mapa (14 pares + los 3 fragmentos de `Buffer On/Off`)

| cadena | arena DS | empujado en COMBAT.OVL | kernel DS | empujado en ULTIMA.EXE |
|---|---|---|---|---|
| `"Cast...\n"` | 0x6df6 | 0x08f0 | 0xa142 | (despachador) |
| `"Get-"` | 0x6e14 | 0x096a | 0xa16a | |
| `"Jimmy-"` | 0x6e1a | 0x097a | 0xa198 | 0x32da |
| `"Open-"` | 0x6e22 | 0x098a | 0xa1ce | |
| `"Push-"` | 0x6e28 | 0x0994 | 0xa1e4 | |
| `"Ready...\n\n"` | 0x6e2e | 0x09a2 | 0xa1f0 | |
| `"Search-"` | 0x6e3a | 0x09ac | 0xa1fc | |
| `"Use item\n\n"` | 0x6e42 | 0x09b6 | 0xa24c | |
| `"Yell "` | 0x6e4e | 0x09c0 | 0xa286 | |
| `"Z-stats...\n"` | 0x6e54 | 0x09ce | 0xa28c | |
| `"Pass\n"` | 0x6e60 | 0x09e2 | 0xa134 / 0xa2a0 | 0x3210 / 0x3645 |
| `"D-What?\n"` | 0x6e84 | 0x0a3a | 0xa14c | 0x324e |
| `"Look"` | 0x6eb0 | 0x0a66 | 0xa1a8 | 0x3310 |
| `"W-What?\n"` | 0x6ed6 | 0x0a8e | 0xa276 | 0x3450 |
| `"Buffer O"` | 0x6dd2 | 0x088a | 0xa110 | 0x31c6 |
| `"ff\n"` | 0x6ddc | 0x08a1 | 0xa11a | 0x31dd |
| `"n\n"` | 0x6de0 | 0x08a6 | 0xa11e | 0x31e2 |

Sin gemelo (propias de la arena): `"Set active plr:\nNone!\n"` 0x6e66 (@0x09f1) ·
`"What?\n"` 0x6ee6 (@0x0ab7) · `"Absorbed!\n"` 0x6e00 (@0x093d, gemelo en CAST 0x4624) ·
`"Can't!\n"` 0x6e0c (@0x0964) y 0x6d98 (@0x05a4, gate no-party).

### 2.3 ★ La cota «0x6df6-0x6e76» es un artefacto, no una derivación

`0x6e76` **no aparece como inmediato en NINGÚN `.asm` del corpus**. No es una entrada de
la tabla: es un puntero *a mitad* de `"Set active plr:\nNone!\n"` (0x6e66 + 16 = 0x6e76,
justo donde empieza `None!`). Nadie lo empuja. Salió de leer el volcado de bytes y trocear
por `\n`, no de leer un emisor.

La cota real, definida **por alcance de emisor** (el run de `mov ax, imm` de COMBAT.OVL
0x05a4 … 0x0ab7), es **DS 0x6d98 … 0x6ee6**: se queda corta por abajo (0x6d98 `"Can't!"`) y
por arriba (hasta 0x6ee6 `"What?"`) respecto a la que circulaba. Misma lección que
`prologos-ocultos`: **los límites se fijan por ALCANZABILIDAD, no por dónde parece que
acaba el bloque de bytes.**

### 2.4 ⚠ `0x6e60` es ambiguo entre espacios de direcciones

`DS 0x6e60` = `"Pass\n"` (COMBAT 0x09e2). **`CS 0x6e60` = `unequip_item`**
(`ULTIMA.EXE 0x6a48: call 0x6e60`). Una cita a «0x6e60» sin decir DS o CS no identifica
nada, y el corpus tiene citas de las dos clases (`equip.ts:198/204` y `ring-expiry` usan la
de CS; `cmd-strings`/`combat.ts:2034` la de DS). Ninguna está mal — pero la coincidencia es
gratuita y conviene saberlo antes de «arreglar» una.

---

## 3. Control positivo del barrido

La tarjeta pedía verificar los 3 casos ya cazados y usarlos de control. Resultado:

| caso | ¿en `main`? | ¿lo caza mi barrido? |
|---|---|---|
| Ready `0xa1f0` (`main.ts:2122`) | **NO arreglado** (fix en `ecba0697`, rama `skin/ready-flow-fidel`) | ✅ |
| Get `0xa16a` (`main.ts:2181`) | **NO arreglado** (fix en `d9abf8e0`, rama `skin/movil-cmds-fixes`) | ✅ |
| Open `0xa1ce` (`main.ts:2186`) | **NO arreglado** (ídem `d9abf8e0`) | ✅ |

`git merge-base --is-ancestor ecba0697 main` → falso; ídem `d9abf8e0`. Ambos sólo en
`skin/ready-flow-fidel`, `skin/movil-cmds-fixes` y `skin/mobile-preview`. **El encargo daba
por hecho que estaban en main; no lo están.** 3 de 3 cazados ⇒ el barrido no está mal.

---

## 4. CENSO: 96 citas de la familia en ficheros tracked de `main`

Regla de adjudicación: *¿el contexto de la cita es la arena, y el offset citado es el del
kernel (o al revés)?* Los ficheros y líneas son de `main` @ `e3be65a1`.

### 4.1 DEFECTUOSAS — 4

| # | fichero:línea | cita | veredicto | corrección |
|---|---|---|---|---|
| D1 | `game/src/main.ts:2122` | `Eco "Ready...\n\n" DS 0xa1f0` | **MAL** — dentro de `handleCombatKey` (1842-2201) | `DS 0x6e2e` (COMBAT.OVL 0x09a2) — **NO tocada aquí**, §5 |
| D2 | `game/src/main.ts:2181` | `// "Get-" (DS 0xa16a)` | **MAL** — ídem | `DS 0x6e14` (COMBAT.OVL 0x096a) — **NO tocada aquí**, §5 |
| D3 | `game/src/main.ts:2186` | `// "Open-" (DS 0xa1ce)` | **MAL** — ídem | `DS 0x6e22` (COMBAT.OVL 0x098a) — **NO tocada aquí**, §5 |
| D4 | `game/e2e/espejo-tour/tools/derive-dungeon-ops.mjs:132-133` | `// DS 0xa1a0 + Up!/Down!` | **MAL** — contexto pasillo, offset del kernel gateado a overworld | `DS 0x6cce + 0x6c74/0x6c6c` — **ARREGLADA**, §6 |

### 4.2 HUECO (ausencia de cita, no cita equivocada) — 1

`game/src/main.ts:2023` — `hud.echo(CMD_STRINGS.cast)` dentro de `handleCombatKey`, **sin
offset**. Emisor derivado: **COMBAT.OVL 0x08f0 → DS 0x6df6** (única referencia del corpus,
`combat-cast-gate-0x08F0.md:12`). No la he añadido: `main.ts` lo tocan 4 ramas vivas
(§5). Texto propuesto en §5.

### 4.3 CORRECTAS — 91 (muestreo de las que más se parecen a un defecto)

| fichero:línea | cita | por qué está BIEN |
|---|---|---|
| `main.ts:2110`, `2114` | `"Use item" DS 0x6e42` | arena citando la arena — **control positivo del lado bueno** |
| `main.ts:2738` (`doCast`) | `"Cast...\n" DS 0xa142` | fuera de combate; el eco es del despachador |
| `main.ts:2821` (`doDungeonCast`) | `"Cast...\n" DS 0xa142` | `"Cast...\n"` no tiene copia en DUNGEON.OVL; el pasillo usa la del kernel |
| `main.ts:3913` (`openUsePicker`) | `"Use item\n\n" DS 0xa24c` | overworld |
| `main.ts:181`, `973`, `3841` | `"Look" DS 0xa1a8` (+`0xa1ae`) | kernel 0x3310 imprime `"Look"` **incondicionalmente** y añade `"...\n"` si 0x20<loc<0x29 ⇒ vale para overworld Y pasillo |
| `main.ts:1003`, `1629` | `"Jimmy-" 0xa198`, `"Yell " 0xa286` | overworld |
| `derive-dungeon-ops.mjs:134,135,137` | `Search... 0xa204` · `Look 0xa1a8+0xa1ae` · `Pass 0xa134` | 0xa204 sin duplicado; `Pass` del kernel 0x3210 se alcanza con loc≠0 ⇒ vale en pasillo. **Tres aciertos y un fallo en el MISMO fichero** = control positivo interno |
| `e2e/dungeon-dispatch.spec.ts:77` | `"Pass\n" DS 0xa134` | ídem |
| `cmd-strings.ts:22-41`, `cmd-strings.test.ts` | tabla 0xa1xx/0xa2xx | el módulo *es* la tabla del kernel; correcto en su ámbito (pero ver §5b) |
| `dungeon.ts:425` | `"What?\n" DS 0x6cb2` | DUNGEON.OVL citando DUNGEON.OVL |
| `printstr-1850-derivacion.md:588,591` | `0x6e2e / 0xa1f0`, `0x6eb0 / 0xa1a8` | **cita las DOS**: la forma ejemplar |
| `combat-commands.md:72-73`, `combat-use-potions.md`, `combat-get-treasure-dispatch.md`, `combat-cast-gate-0x08F0.md` | tabla 0x6exx | notas de arena citando la arena |
| `equip.ts:426`, `equip.test.ts:119`, `deliberate-divergences.md:709` | `"Ready...\n\n" DS 0xa1f0` | la frase habla del **dispatch** de overworld; correcta en su ámbito, aunque la arena eche el mismo texto desde 0x6e2e |

### 4.4 Fuera de esta clase, apuntadas sin adjudicar

- `game/src/core/game.ts:1425` y `:1449` citan **`0xa11e`** como si fuera un **sfx**
  («sfx (0xa11e …)», «sacudida/estruendo … 0xa11e»). `DS 0xa11e` es el fragmento
  `"n\n"` de `"Buffer On"` (kernel 0x31e2, toggle del buffer de teclado) — **no puede ser un
  tono**. Es cita de **offset desnudo** sin espacio de direcciones declarado: género de la
  tarjeta **#69**, no de esta. Apuntada, **no adjudicada** (no tengo la derivación del
  emisor de sonido de la catarata).
- `approved-strings.json` cataloga cada literal **una sola vez**, así que `"Ready...\n\n"`,
  `"Open-"`, `"Get-"`, `"Look"`, `"Z-stats...\n"`, `"Pass\n"` llevan sólo el offset del
  kernel aunque el port los emita también desde la arena. No es cita equivocada (el
  fichero indexa por texto), pero **el modelo del fichero no puede expresar dos emisores**.
  Fichero contestado por `skin/mix-flow-fidel` y `skin/mobile-preview` ⇒ §5.
  (`"Use item"` sí tiene entrada propia con `0x6e42`, así que la convención existe.)

---

## 5. PENDIENTE-DE-LEAD — colisión con carriles vivos

`game/src/main.ts` lo modifican **4 ramas** (`skin/ready-flow-fidel` +221/-15,
`skin/movil-cmds-fixes` +222/-14, `skin/mix-flow-fidel` +225/-23, `skin/mobile-preview`
+331/-33); `game/src/core/world/cmd-strings.ts`, **3**; `approved-strings.json`, **2**.
D1-D3 **ya están arregladas** en `ecba0697`/`d9abf8e0`. Re-arreglarlas aquí garantiza
conflicto y dos versiones del mismo comentario. **No las toco.** Filas exactas:

**(a) D1-D3 — se resuelven ATERRIZANDO `ecba0697` + `d9abf8e0`.** Si esas ramas no
aterrizan, el texto mínimo es:

```
main.ts:2122   … Eco "Ready...\n\n" DS 0x6e2e (COMBAT.OVL 0x09a2 — NO el 0xa1f0 del kernel).
main.ts:2181   hud.echo(CMD_STRINGS.get);  // "Get-"  (COMBAT.OVL, DS 0x6e14 — NO el 0xa16a del kernel)
main.ts:2186   hud.echo(CMD_STRINGS.open); // "Open-" (COMBAT.OVL, DS 0x6e22 — NO el 0xa1ce del kernel)
```

**(b) `main.ts:2023` — el hueco del (C)ast de arena.** Añadir a la línea
`hud.echo(CMD_STRINGS.cast);` de `handleCombatKey`:

```ts
hud.echo(CMD_STRINGS.cast); // "Cast...\n" (COMBAT.OVL 0x08f0, DS 0x6df6 — NO el 0xa142 del kernel)
```

**(c) `cmd-strings.ts` — cabecera del módulo.** El objeto `CMD_STRINGS` *es* la tabla del
kernel y `handleCombatKey` lo reusa para los ecos de la arena (mismos bytes, correcto en
conducta). Propuesta de nota de cabecera:

```
Los offsets de este módulo son los del DESPACHADOR (ULTIMA.EXE 0x3178). Los overlays que
NO pasan por él tienen copias BYTE-IDÉNTICAS con otro offset: COMBAT.OVL 0x6df6-0x6ee6
(arena), DUNGEON.OVL 0x6cba/0x6cce (Klimb del pasillo), TOWN 0x2723, SJOG 0x8ede. Reusar
estas constantes fuera del despachador es correcto; CITAR este offset desde ahí, NO.
Mapa completo en re/notes/combat-commands.md y re/notes/citas-109-acta.md.
```

**(d) `approved-strings.json`** — añadir el gemelo de arena a la descripción de las 6
entradas de §4.4 (`"Ready...\n\n"`, `"Open-"`, `"Get-"`, `"Look"`, `"Z-stats...\n"`,
`"Pass\n"`), con la forma que ya usa `"Use item"`. Sólo prosa de descripción.

Nada de esto toca un valor de aserción.

---

## 6. ★ CASO NUEVO ARREGLADO: el `Klimb-` del pasillo

`game/e2e/espejo-tour/tools/derive-dungeon-ops.mjs` (vocabulario cerrado del pasillo 3D)
citaba `DS 0xa1a0` para `Klimb-Up!` / `Klimb-Down!`. Derivación de por qué está mal:

```
ULTIMA.EXE 32e8: cmp byte ptr [g_location], 0
           32ed: jne 0x32fc            ; loc != 0 → NO pasa por aquí
           32ef: mov ax, 0xa1a0        ; "Klimb-"  ← SÓLO overworld
           32f2: push ax / call 0x1850 ; print
           32fc: cmp byte ptr [g_location], 0x21
           3301: jae 0x330a            ; loc ≥ 0x21 (mazmorra) →
           3303: call 0x7aca           ;   pueblo → TOWN.OVL
           330a: call 0x7c86           ;   mazmorra → DUNGEON.OVL
```

Y el emisor del pasillo:

```
DUNGEON.OVL 1e10: (prólogo de klimb)  … 1e9c: mov ax, 0x6cba  ; "Klimb-U/D-" (caben las dos)
                                        1efa: mov ax, 0x6cce  ; "Klimb-"     (sólo una)
                                        1ed8: mov ax, 0x6cc6  ; "Pass\n\n"   (ninguna)
DUNGEON.OVL 1c7b: mov ax, 0x6c6c ; "Down!\n"   ·   1c80: mov ax, 0x6c74 ; "Up!\n"
```

`"Klimb-"` tiene **cuatro** copias, una por contexto — TOWN/SHOPPES3 0x2723 ·
DUNGEON 0x6cce · SJOG 0x8ede (arena, `cmd_klimb_combat`) · DS 0xa1a0 (dato del kernel, no CS) — y los cuatro
conjuntos de emisor son disjuntos entre sí. **Corregido a `DS 0x6cce + 0x6c74/0x6c6c` con la derivación en el comentario.**

Lo valioso del caso: en el **mismo fichero**, `Search...`, `Look...` y `Pass` citan
offsets del kernel y están **BIEN** (0xa204 no tiene duplicado; `Look` del kernel se
imprime sin gate de loc; `Pass` del kernel se alcanza precisamente con loc≠0). O sea,
«offset del kernel en un fichero de pasillo» **no** es el criterio: el criterio es leer el
gate del emisor. Tres controles positivos y un fallo, en 4 líneas contiguas.

---

## 7. La familia entera: 62 grupos de cadena duplicada con emisores DISJUNTOS

`DATA.OVL` tiene **178** textos repetidos; **150** con ≥2 miembros citados en el disasm;
**62** con emisores disjuntos = 62 trampas de atribución del mismo género. La arena/kernel
es **una** de ellas. Las de mayor superficie en el port:

- `"Klimb-"` — TOWN 0x2723 · DUNGEON 0x6cce · SJOG 0x8ede · DS 0xa1a0 (dato del kernel, §6).
- `"Ride "/"Fly "/"Row "` — TOWN 0x2666/0x266c/0x2671 vs MAINOUT 0x2946/0x294c/0x2951.
  ⚠ toca el verbo de transporte (`verbo-transporte-0x00da`): **pueblo y overworld imprimen
  desde offsets distintos.** Sin adjudicar aquí.
- Campos de mazmorra (`"A sleep field.\n"`, `"A poison gas field.\n"`, `"A wall of fire.\n"`,
  `"An electric field.\n"`, `"An energy field.\n"`, `"nothing of note.\n"`) — DNGLOOK
  0x754c-0x7598/0x769a vs SJOG 0x87d6-0x8822/0x86cc. **Pasillo vs sala**, seis pares.
- `"Sound "/"Off\n"/"On\n"` — TOWN · MAINOUT · DUNGEON · COMBAT, cuatro copias cada uno.
- `"Zzzzzz...\n"`, `"Exit to DOS? "`, `"1.16"` — TOWN · MAINOUT · DUNGEON.
- `"Absorbed!\n"` CAST 0x4624 vs COMBAT 0x6e00 · `"Success!\n"` CAST vs SJOG ·
  `"Healed!\n"` CAST 0x470e vs DNGLOOK 0x772e · `"Item: "` CAST 0x48b1 vs ZSTATS 0x9998.

Herramienta re-ejecutable (no depende de ninguna nota; sale de `DATA.OVL` + `re/disasm/`):
`re/tools/dup_string_emitters.py` — imprime los grupos, sus emisores y marca los disjuntos.

---

## 8. Cola declarada

1. ~~**Re-barrer lo que se barrió con `git grep -E … \b`** (cero-en-falso). Cualquier acta que
   cerrara «cero ocurrencias» con ese patrón está sin hacer. No he censado cuáles.~~
   **HECHO en la tarea #114 (2026-07-28): censado y la población sale VACÍA.** Las 6
   ocurrencias de la forma rota en ficheros versionados son **documentación del propio
   defecto** (este acta y el aviso de `dup_string_emitters.py`); **ningún barrido real** la
   usó, y el historial sólo tiene dos commits que tocan el texto «git grep». Además se
   re-ejecutaron con instrumento bueno las declaraciones de ausencia con offset de
   `re/notes` y **todas se sostienen**. Detalle: `ceros-114-acta.md`.
2. Los 4 arreglos de §5 (contestados por ramas vivas), incluido el hueco de `main.ts:2023`.
3. `game.ts:1425/1449` — `0xa11e` como sfx: género #69 (offset desnudo), sin derivación.
4. Los 61 grupos disjuntos restantes de §7 — ninguno adjudicado. Los de campos de mazmorra
   (DNGLOOK vs SJOG) y el verbo de transporte (TOWN vs MAINOUT) son los que más citas
   tienen en el port.
5. **`combat-commands.md` siembra 2 nombres y PISA uno curado — defecto PREEXISTENTE, no
   mío.** `seed_diff` sobre la versión de `main` da exactamente el mismo resultado que
   sobre la mía (siembra `COMBAT.OVL:0x09ce → 'thunk'` y `COMBAT.OVL:0x1458 →
   'get_item_switch'`, y este último **sobrescribe** `ULTIMA.EXE:0x1482 'pasabilidad'`).
   Mi diff aporta **0 semillas nuevas**; medido moviendo mi versión y restaurando la de
   `main`. Alguien tendrá que separar esas dos celdas del §Notas de fidelidad.

## 9. Predicciones falsables

- **P1.** Si se re-barre el corpus con el regex bueno, aparecerán **≥1** citas más de la
  clase en grupos de §7 que hoy figuran como «verificados» por barridos con `\b`.
- **P2.** Ningún arreglo de este carril cambia una sola línea de conducta: los bytes de las
  dos tablas son idénticos. Un `vitest`/`e2e` que cambie de color tras estos diffs es
  señal de que se tocó algo que no era un comentario.
- **P3.** `0x6e76` no aparecerá como emisor en ninguna regeneración futura del disasm.
  Si aparece, la cota de §2.3 (DS 0x6d98-0x6ee6) está mal y hay que rehacerla.

---

## 10. Gates

- `npx tsc --noEmit` (game/) — **EXIT 0**, leído aparte, sin pipe.
- `npm run typecheck:e2e` (game/) — **EXIT 0**. ⚠ El encargo lo llamaba `tsc:e2e`, que
  **no existe** en `game/package.json` (falla con `Missing script`, EXIT 1, y un lector
  descuidado lo tomaría por gate rojo). El script real es `typecheck:e2e`
  (`tsc --noEmit -p tsconfig.e2e.json`).
- `npx vitest run tests/cmd-strings.test.ts` — **EXIT 0**, 5/5 (el fichero que edité).
- `seed_diff re/notes/citas-109-acta.md` — **limpia, 0 sembradas / 0 cambiadas**.
  `combat-commands.md` sigue con su siembra PREEXISTENTE, idéntica a la de `main` (§8.5).
- Cero playwright, cero e2e, cero valores de aserción tocados.
