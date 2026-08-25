# ACTA #139 — Defecto F del detector de huérfanos: el comentario no emite

Carril `detector-139`, rama `re/detector-139`. Instrumento: `re/tools/detect_orphan_strings.py`.
Alcance real: `re/tools` + `re/notes`. CERO `game/src`, CERO e2e.

---

## 1. El defecto, y por qué era invisible

`emitted_literals()` corría `LIT_RE` sobre el fichero **crudo**. Un string citado dentro de
un comentario contaba como emisión del port. La idea contraria estaba **pagada en el mismo
módulo desde el defecto A**: `_codigo_sin_comentarios()` existe con su docblock explicando
que un nombre en un comentario no es un consumidor — y no se aplicaba aquí.

Segunda mitad, que se compone con la primera: la rama `clave_en_literal` (`n in lit_blob`)
no tenía suelo de longitud sobre la **clave**. `MIN_PIEZA = 4` guardaba
`cubierta_por_literales` pero no esta rama, así que era el **defecto B otra vez, del lado de
la clave**: una clave corta la absorbía cualquier literal que la contuviera por accidente.

### Radio medido (no estimado)

| | |
|---|---|
| literales normalizados, fichero CRUDO | 8327 |
| literales normalizados, sólo CÓDIGO | 3579 |
| vivían SÓLO en comentarios | **4753** |
| claves del catálogo que pierden su aval de comentario | **82** |

## 2. El control natural que lo delató — verificado en el binario, no heredado

`' AM.\n'` salía en el censo de huérfanos y su gemela `' PM.\n'` no. Es imposible por
construcción: son las dos ramas del mismo `if/else` y el port no emite ninguna de las dos.

Leído en `re/disasm/CAST.OVL.asm:2851-2857` (lo verifiqué yo; el encargo traía la cita y no
la di por buena):

```
1b1a: 803e7f580b   cmp byte ptr [g_hour], 0xb
1b1f: 7607         jbe 0x1b28
1b21: b84f4a       mov ax, 0x4a4f      ; hora > 0x0b  → DS 0x4a4f = ' PM.\n'
1b28: b8554a       mov ax, 0x4a55      ; hora <= 0x0b → DS 0x4a55 = ' AM.\n'
```

Las dos cadenas resueltas por `routine_census.resolve_string`. A `' PM.\n'` la absolvía el
comentario `H:MM AM/PM.` de `game/src/core/game.ts:469`, por la rama `clave_en_literal`:
`norm()` recorta los blancos y deja la clave en «PM.», **tres** caracteres, por debajo del
suelo que no existía. Las dos mitades del fix la destapan por separado.

## 3. ★ LA PREDICCIÓN PRE-REGISTRADA FALLÓ, y el modelo estaba mal, no el fix

La predicción de la tarjeta era: **el censo sube en ~79**, y `' PM.\n'` aparece junto a
`' AM.\n'`. Umbral de parada declarado: si sube <60, parar y re-derivar.

**Medido: el censo sube 122 → 140. Delta = +18.** Paré.

`' PM.\n'` **sí** aparece (segunda mitad de la predicción, cumplida). Ninguna clave sale del
censo: no hay regresión. Pero la cifra falla por más del doble, así que re-derivé el modelo
antes de tocar nada más — no ajusté el fix hasta que cuadrase.

### Por qué falla: el clasificador es una CADENA DE PRIORIDAD, no una disyunción

«82 claves mal clasificadas» y «82 huérfanas nuevas» son poblaciones **distintas**. Una
clave que sale de `emitido_exacto` no cae al huérfano: cae al **primer bucket posterior que
la acepte**. Reparto medido de las 82:

| pierde el aval en | aterriza en | n |
|---|---|---|
| `emitido_exacto` | `clave_en_literal` | 36 |
| `clave_en_literal` | `de_datos` | 15 |
| `emitido_exacto` | `de_datos` | 12 |
| `emitido_exacto` | `compuesta` | 1 |
| `emitido_exacto` | **HUÉRFANO** | 15 |
| `clave_en_literal` | **HUÉRFANO** | 3 |

El defecto era real en las 82 — todas estaban clasificadas por una razón falsa. Lo que la
predicción daba por hecho es que la razón falsa era la **única**, y en 64 de 82 hay una
absolución independiente detrás. La aritmética de la tarjeta sumaba buckets como si fueran
disyuntos.

## 4. Control 4/4 del hallazgo: sale 3/4, y el cuarto destapa el defecto G

| clave | tras el fix |
|---|---|
| `'A moonstone!\n'` | HUÉRFANA ✔ |
| `'Thrown out of bed!\n'` | HUÉRFANA ✔ |
| `'Magic absorbed!\n'` | HUÉRFANA ✔ |
| `'Sheets in irons!\n'` | **absuelta por `de_datos`** ✘ |

La cuarta no falla por el defecto F —que también la tapaba— sino por uno **distinto que
queda vivo detrás**, y que sólo se ve al quitar F de en medio.

### ★ DEFECTO G (medido, NO arreglado): el arreglo de A tiene la granularidad del POOL

`'Sheets in irons!\n'` vive en el pool `textCreateCharCmdsCrt` de `game/assets/data.json`.
Ese pool cuenta como tabla de datos **viva** porque su nombre aparece entrecomillado en
`game/src/main.ts:458` — la regla que arregló el defecto A. Pero:

- el pool tiene **151** cadenas;
- `game/src/main.ts:478-479` lee **dos**, buscándolas por prefijo de contenido
  (`"By what name"`, `"Art thou"`);
- las otras 149 son el mismo volcado verbatim de DATA.OVL contra el que se acuñó A, y entre
  ellas hay cadenas de flujos sin relación con la creación de personaje: `'Sheets in irons!'`,
  `'Pass\n'`, `'Board '`, `'Cast...\n'`.

Un pool vivo absuelve 151 cadenas a cuenta de 2 lecturas. **Radio medido: 90 claves del
catálogo quedan absueltas EXCLUSIVAMENTE por pertenecer a uno de los 2 pools vivos**, sin
ninguna otra fuente de datos detrás. Entre ellas `'A ring has vanished!\n'`, que es el
hallazgo del testigo vivo de #67.

No lo arreglo aquí: excede el encargo y movería una población que necesita su propia
predicción y su propia adjudicación. Queda con **test de MEDIDA**
(`test_defecto_G_declarado_y_MEDIDO_no_supuesto`) que se pone rojo si el número se mueve sin
que nadie toque el criterio, y que **avisa explícitamente** si alguien arregla G para que la
cuarta del control suba al bloque duro.

## 5. Calibración del suelo de longitud (con los datos, no por analogía)

Bucket `clave_en_literal` tras el fix F1: 140 claves. Cuántas caen al huérfano por suelo:

| suelo | caen | las que caen |
|---|---|---|
| 3 | 2 | `s!`, `gp` |
| **4** | **8** | `Bow`, `One`, `the`, `es!`, `s!`, `gp`, `ME!`, `Ah,` |
| 5 | 14 | + `Quit`, `None`, `Yes.`, `hit!`, `says`, `U/D-` |
| 6 | 28 | + `Month`, `food!`, `gold!`, `die!"`… |
| 8 | 46 | + `Exit to`, `"Hail,`, `Day of`… |

Fijado en **4 = `MIN_PIEZA`**, por simetría: es el mismo umbral por debajo del cual una
coincidencia de subcadena ya se declaró ruido en el otro lado de la comparación (defecto B).
Las 8 que caen a suelo 4 son todas coincidencia de subcadena. A partir de 5 empiezan a
entrar candidatas plausibles (`Quit`, `None`, `Yes.`), y subirlo sería inventar huérfanos.

## 6. Lo que el encargo daba por hecho y no era

- **«los conteos 134/126/123 se mueven»**: no existen. `re/tools/test_detect_orphan_strings.py`
  no tiene ningún conteo de fixture hardcodeado; el único número es `len(inst) < 200`, que
  no se mueve. Los 82 tests de los cuatro ficheros del gate pasaban **sin tocarlos** tras el
  fix. No recalibré nada porque no había nada que recalibrar; añadí regresiones nuevas.
- **«el control 4/4»**: es 3/4, por el defecto G (§4).
- **«sube ~79»**: sube 18, por la cadena de prioridad (§3).

## 7. Control positivo VISTO SUSPENDER

Con las dos líneas del fix revertidas en disco y el resto del fichero intacto:

```
FAILED test_las_tapadas_por_comentario_salen_huerfanas
FAILED test_el_par_AM_PM_se_clasifica_IGUAL
2 failed, 20 passed
```

Restaurado el fix: **88 passed, exit 0** sobre
`test_detect_orphan_strings.py test_orphan_emitters.py test_frontier.py test_seed_gate.py`.

## 8. Adjudicación de los 18 nuevos

Depositada en `re/ledger/orphan-strings-139-anexo.json` — **fichero aparte, no el ledger
principal**, porque el carril `sapos-120b` lo tiene abierto en su rama para la tanda en curso
de #120. Le pedí coordinación por mensaje y no ha contestado, así que el anexo es la vía que
él mismo autoriza si urge. Formato idéntico al del ledger para que la fusión sea mecánica.

Método: call-site del original con `re/tools/orphan_emitters.py` (inmediato consumido **como
puntero**, no mera aparición) + careo con el port leído a mano. Reparto:

| clase | n | qué son |
|---|---|---|
| **hueco-del-port** | 5 | nadie las emite en el port |
| **ruido** (el port SÍ las emite por vía invisible al extractor) | 10 | |
| **familia-de-datos** | 3 | sin call-site: se consumen indexando una tabla |

### Los 5 huecos, y cuáles suben el denominador de #120

- **`'A moonstone!\n'`** — SJOG 0x148c en `apply_item_grant` (0x1458). La rutina **está
  portada**: `quest/items.ts:81 grantPlotItem` cubre amuleto/corona/cetro/caja/alfombra con
  los strings hermanos byte-exactos, y `plotItemForNpcType` no tiene caso para el tile de la
  moonstone. → **tanda B de #120**.
- **`'Magic absorbed!\n'`** — CAST 0x0d4c, precondición 0x0d60-0x0d9b. **El port lo declara
  pendiente él mismo** en `magic/cast.ts:163-168`. → **tanda B de #120**.
- **`'Thrown out of bed!\n'`** — CMDS 0x0552/0x0688. `world/camp.ts:133 bedSleep` porta la
  rutina (emite la hermana «Zzzzzzz...») y declara la interrupción Clase C. → **tanda B de
  #120**, prioridad baja.
- **`'Items:'`** — DS 0x48b8. **Ruling ya existente** en `cmd-strings.ts:134`: Clase C
  declarada, la piel reusa el banner de Ready. No es hallazgo nuevo, no va a la tanda B.
- **`'\nSomething was stolen!\n'`** — TALK 0x1180. Flujo del Shadowlord urbano **sin portar
  entero** (`shadowlord-urban.ts:16`), no hueco-en-rutina-portada. No va a la tanda B.

**Para sapos-120b: son TRES los que suben tu denominador**, no cinco.

### Los 10 «ruido» no son basura: son ceguera del instrumento

Tres mecanismos, y los tres tiran **en sentido contrario** al defecto F:

1. **Instancia de plantilla (punto ciego E2)** — `' PM.\n'`: `endgame/use-tools.ts:182` emite
   `` `…${ampm}.` `` con `ampm = hour <= 0xb ? "AM" : "PM"`. Los huecos son literales inline
   de un ternario, no una tabla del fichero, así que `instancias_de_plantilla()` no los
   enumera.
2. **Cola `\n:` podada en el call-site** (familia #135) — `'Your interest?\n:'`,
   `'You respond-\n:'`, `'\nYou respond-\n:'`, `'what?\n:'`,
   `'Thou art empty-\nhanded!\n'`: el port guarda el literal sin la cola (o sin el `\n`
   interno) y el prompt lo compone el getstring. `cmd-strings.ts:74/96/97` llevan la forma
   del binario **en el comentario de al lado**.
3. **Fragmento de composición del binario** — `'es!\n'`, `'s!\n'`, `' gp\n'`,
   `'Box\n\nHow?\n'`: no son mensajes. Derivado en el binario:
   ```
   1512: mov ax,0x8c8a   ; " torch"      → print
   1519: cmp word [bp+6],1
   151f: mov ax,0x8c92   ; "!\n"    (singular)
   1524: mov ax,0x8c96   ; "es!\n"  (plural)
   ```
   y el vecindario de DATA.OVL lo confirma: `' torch' · '!\n' · 'es!\n' · ' gem' · '!\n' ·
   's!\n' · ' odd key' · ' key'`. Son **sufijos de plural**. El port compone el plural en
   TypeScript. `'Box\n\nHow?\n'` es la entrada concatenada del pool que `use-tools.ts:342`
   emite **en dos mensajes**.

## 9. ★ Una adjudicación de #116 REFUTADA — y la refutación la predijo ella misma

`' AM.\n'` ya estaba en el censo desde #86 y **#116 la adjudicó `hueco-del-port`**
(«Ningun literal ni plantilla sustancial del port la emite», confianza media). Pero su campo
`limite` declaraba exactamente cómo podía estar equivocada:

> «sujeto al punto ciego E (instancia de plantilla): si el port la emitiera desde una
> plantilla de parte literal corta, este barrido no lo veria»

Es lo que pasa: `use-tools.ts:182` la emite. **La entrada vieja no era falsa por descuido:
era falsable por diseño, y se falsó.** El anexo la **retracta** con la cita del emisor. Es el
único choque de claves del anexo; los otros 18 son altas.

⚠ **Y no está sola.** En `re/ledger/orphan-strings.json` hay **78 entradas `hueco-del-port`
con literalmente el mismo campo `limite`**, 38 de ellas con `rutina_portada: true`. Acabo de
probar que al menos una de las 78 se refuta por el mecanismo que el propio límite anunciaba.
**Consecuencia para #120: el denominador puede BAJAR, no sólo subir** — el encargo daba por
hecho lo contrario. No he re-adjudicado las otras 77: es el capítulo de `sapos-120b` y
necesita su propio barrido, con un criterio mecánico que hoy no existe (enumerar plantillas
cuyo hueco sea un ternario de literales inline, que es justo lo que `instancias_de_plantilla`
no cubre). Queda como **medida**, no como veredicto.

## 10. Predicciones falsables que deja esta acta

1. Si alguien ataca el defecto G con la regla «una entrada de pool sólo es dato si el código
   la lee por índice o por contenido», el censo debe subir en **≤ 90** y `'Sheets in irons!\n'`
   y `'A ring has vanished!\n'` deben aparecer. Si sube más de 90, la regla se pasó de rosca.
2. El bucket `clave_en_literal` (132 tras el fix) es el que queda más débil: sigue siendo una
   apuesta de subcadena para claves de ≥4 caracteres. Si se endurece a cobertura real como se
   hizo con B, deberían caer del orden de las 36 que aterrizaron ahí en §3.
3. Ninguna clave debe **salir** del censo por estos cambios. Medido hoy: 0 salen.
