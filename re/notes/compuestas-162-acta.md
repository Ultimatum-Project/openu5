# Acta #162 — las «compuestas» NO fugaban inglés: fugan el GLIFO DE COMILLA (y la ficha buscaba la clave equivocada)

Carril `deriva-3`, tercer tramo. Rama `re/deriva-3` sobre `main` @`91779a93`
(+ los commits de #137 y #145).

**Veredicto: la premisa de la ficha es FALSA, y medirla destapó un defecto DISTINTO y vivo.**

---

## 0. Lo que decía la ficha, y lo que dice la medida

`sinks-209-acta.md` §5.1 fichó tres frases del intérprete de conversación —«You see»,
`"My name is`, `"I am called`— como **«candidatas a fuga de inglés»**, con este argumento:
*«tampoco están en `es.json`»*.

**Están las tres.** El fallo es de PUNTERÍA sobre la clave:

| lo que la ficha buscó | ¿en `es.json`? | lo que el código pasa a `t()` | ¿en `es.json`? |
|---|---|---|---|
| `'"My name is'` | **no** | `PHRASES.MY_NAME_IS + " "` = `'"My name is '` | **sí**, revisada |
| `'"I am called'` | **no** | `PHRASES.I_AM_CALLED + " "` = `'"I am called '` | **sí**, revisada |
| `'You see'` | **no** | `tf("You see {}", body)` (talk-console.ts:156) | **sí**, revisada |

La constante y la clave viva son cadenas DISTINTAS, y en esta familia se diferencian por un
espacio. Buscar la constante y concluir «no está traducida» es el mismo error de puntería que
[[familia-incompleta-invisible-a-cifras]]: la ausencia de una no es la ausencia de la otra.

**Y la refutación no se queda en el diccionario**: corrido el intérprete bajo `es` con el NPC
real (Zachariah, `assets/talk/towne.json`), las tres salen en castellano.

## 1. Lo que SÍ se fuga — medido, no leído

Mismo volcado, EN contra ES:

```
EN  You see a stately, white-haired man of many years.
ES  Veis a stately, white-haired man of many years.        ← (B), ver §4
EN  "I am called Zachariah"
ES  «Me llaman Zachariah"                                  ← ★ (A): abre « y cierra "
EN  "My name is Zachariah"
ES  «Me llamo Zachariah"                                   ← ★ (A)
```

**(A) El port compone comillas ASCII alrededor de texto YA traducido.** El literal del
binario trae la comilla de APERTURA dentro (por eso el castellano abre bien: la traducción de
`'"My name is '` es `'«Me llamo '`), pero el CIERRE lo pone el código:
`Conversation.endSpeech` hace `body + '"' + tail` con el literal CRUDO, sin pasar por `t()`.
Resultado: par descabalado en toda conversación en castellano.

★ **Y es invisible a los dos detectores de la casa**: `t(k) === k` no dispara (nadie llama a
`t()` con ese fragmento) y el censo de corpus tampoco (un fragmento de puntuación pura sin
entrada parece «nada que traducir», no «traducción que falta»). Misma firma que #213/#132.

## 2. El censo COMPLETO de la clase, con su control

Instrumento AST (parser de TypeScript, no regex — la lección de `i18n-barrido-287.md` §2):
todo argumento de `t()`/`tf()`/`tr()` que participe en una **concatenación**, resolviendo las
constantes de catálogo (`SHOP_UI.*`, `PHRASES.*`) contra su literal.

| clase | n |
|---|---|
| `CONST` (resuelta contra el catálogo) | 85 |
| `LITERAL` | 10 |
| `NO-RESOLUBLE` (el argumento viene de fuera de la función) | 32 |
| `CONST-NO-RESUELTO` | 2 |
| **POBLACIÓN** | **129** |

De las **95 resolubles**: **91 en el corpus, 4 ausentes.** ★ Ése es el control de que el
instrumento no devuelve ceros uniformes — 91 aciertos contra 4 ausencias, no 95 ausencias.

Las 4, leídas una a una:

| dónde | fragmento | qué es | veredicto |
|---|---|---|---|
| `ui/shop-console.ts:1118` | `'?" '` (DS 0x9fd8) | CIERRA el «anything else, sir/milady» del astillero | **fuga de glifo → arreglada** |
| `ui/shop-console.ts:1539` | `'\n"'` (DS 0x7ba4) | ABRE el insulto sin oro del herrero | **fuga de glifo → arreglada** |
| `ui/shop-console.ts:2409` | `'!"\n\n'` (DS 0x9cca) | CIERRA la compra parcial de la taberna | **fuga de glifo → arreglada** |
| `ui/shop-console.ts:1901` | `'?\n\n'` (DS 0x78d0) | cola del «What else, » del gremio | ★ **NO se toca** |

★ **El cuarto es un control negativo que sale de la propia lectura**: el inglés
(`'\n"Sold!"\nsays $.\n\n"What else, \n'` + `'?\n\n'`) **tampoco cierra** esa comilla.
Añadirle un `»` al castellano sería «arreglar» al original. Calcar incluye calcar lo que el
original deja abierto.

⚠ **Cota declarada del instrumento**: los 32 `NO-RESOLUBLE` y los 2 `CONST-NO-RESUELTO` no se
cierran aquí, y **tampoco cierra el caso que da nombre a la ficha**: en `conversation.ts` la
clave compuesta se asigna a un CAMPO (`this.pendingPrefix = PHRASES.I_AM_CALLED + " "`) y se
traduce después (`this.tr(this.pendingPrefix)`), así que hace falta flujo de datos, no AST
local. Ése se adjudicó a mano (§0) y por ejecución (§1).

## 3. ★★ La familia que arregla esto YA EXISTÍA, y estaba incompleta

El corpus tiene cuatro fragmentos de puntuación pura traducidos, y la discriminación
abre/cierra la hace **la FORMA del fragmento**, no una anotación:

| clave inglesa | castellano | papel |
|---|---|---|
| `'"'` | `'«'` | abre |
| `'\n\n"'` | `'\n\n«'` | abre |
| `'" '` | `'» '` | cierra |
| `'"\n'` | `'»\n'` | cierra |

Los tres arreglados de §2 encajan por forma en ese mismo esquema (`'?" '` es hermano de
`'" '`; `'\n"'` de `'\n\n"'`; `'!"\n\n'` de `'" '`). No se inventa mecanismo: **se completan
tres miembros que faltaban**, igual que #287 completó los 2/8 de Ztats.

## 4. Lo que NO se arregla y por qué (dos cosas distintas)

**(B) Marco traducido, cuerpo en inglés.** `Veis a stately, white-haired man of many years.`
La composición funciona —el marco `You see {}` se traduce— pero el CUERPO viene del asset
`.TLK`, que no está traducido. Lo mismo con `"Welcome,  Avatar, in these dark times."`. Eso
no es un defecto de composición: es el corpus `.TLK` sin traducir, que es un carril entero
(i18n ciudades/talk). **Se declara, no se toca.**

**(C) El cierre del discurso de `endSpeech` — ★ DESBLOQUEADO Y ARREGLADO en #37/#41.**
Ver `quotes-family-41-37-acta.md` §3, y la enmienda de §7 al pie de este acta: el bloqueo
que se declara abajo era REAL pero su premisa era demasiado estrecha —se buscaba la salida
DENTRO del corpus, y el cierre no es la traducción de un string sino una propiedad
tipográfica del idioma—. Lo que sigue se conserva como estaba el 20-07.

**(C, texto original) El cierre del discurso de `endSpeech`, DECLARADO Y BLOQUEADO por diseño.** El arreglo
natural sería pasar el `'"'` por `t()`, y no se puede: la clave inglesa `'"'` **ya está
tomada** por la comilla de APERTURA (traduce a `«`), y una tabla indexada por texto no puede
dar dos traducciones a la misma clave. Las salidas posibles —(i) componer `'"' + tail` como
un solo fragmento, que sólo cubre los casos con `tail` no vacío porque `'"\n'` sí existe pero
`'"'` a secas no; (ii) una primitiva `quotePair()` en la capa i18n— **son decisiones de
diseño del lead**, y una de ellas toca la derivación C8 del discurso (`speechOpen` /
`endSpeech`, que calcan el `putchar` de TALK 0x4da). No se fuerza: queda con el defecto
MEDIDO y sellado en rojo-explícito (§5), y el bloqueo nombrado.

## 5. Verificación

`game/tests/composed-quotes-162.test.ts`, 4 casos:

1. **La refutación por dos vías**: la constante pelada NO está en `es.json` (las tres) y la
   clave viva SÍ (las tres) — el mismo par de medidas que la ficha hizo a medias.
2. **La refutación EN VIVO**: el intérprete bajo `es` emite «Me llamo»/«Me llaman» y **cero**
   rastro del inglés.
3. **El defecto (C) sellado como DEFECTO**, no como conducta: el test exige que exista al
   menos una línea que abra con `«` y cierre con `"`. Si alguien lo arregla, este test se
   pondrá rojo — y eso es lo que se quiere: que el arreglo obligue a venir aquí.
   ★ **El sello CUMPLIÓ**: #37/#41 lo arregló, el test se puso rojo, el carril vino aquí y
   el caso 3 se re-escribió para exigir la conducta ARREGLADA. Ver §7.
4. **Los tres fragmentos nuevos**, con **control positivo** de los dos miembros previos de la
   familia (`'"'`→`«`, `'" '`→`» `) y **control negativo** del cuarto candidato
   (`guildQtail` sigue en `?\n\n`, sin `»`).

**Mutación**: retirada la entrada `'?" '` de `es.json`, el caso 4 se pone **rojo**; repuesta,
verde. El sello es sensible a la traducción concreta, no al hecho de que la tabla exista.

**Suite**: `tsc --noEmit` limpio; suite completa desde `game/` **320 ficheros / 4050 tests
verdes**. Las dos guardas de fabricación mordieron y se atendieron: `i18n-manifest` exigió que
las 3 claves nuevas tuvieran respaldo en el corpus inglés, y se dieron de alta en
`approved-strings.json` con clase `[D]` y su offset DS.

## 6. Residuos DECLARADOS

1. **(C) el cierre de `endSpeech`** — §4, con las dos salidas de diseño enumeradas. Tarjeta.
2. **(B) el corpus `.TLK` sin traducir** — carril propio.
3. **Los 32 `NO-RESOLUBLE` del censo**, 188 de los cuales viven en `ui/shop-console.ts` según
   #287. La cota es la misma que aquella acta declaró; este carril no la mueve.
4. **`skin/`, `main.ts` y `ui/savepanel.ts`** entran en el censo pero no se han leído uno a
   uno: `savepanel.ts:244` compone un `'"'` cuyo papel (abre o cierra) no se ha adjudicado, y
   `main.ts` está EMBARGADO para este carril.

---

## 7. ENMIENDA (#37/#41, carril `quotes-family`) — el bloqueo cede, y la familia era MÁS GRANDE

Acta completa: `quotes-family-41-37-acta.md`. Lo que corrige a este documento:

### 7.1 El bloqueo de §4(C) no era del corpus: era de la PREMISA

§4(C) enumeró dos salidas —(i) fragmento compuesto, (ii) `quotePair()`— y ambas buscaban el
cierre DENTRO del corpus. Ninguna es la buena. **El cierre no es la traducción de un
string**: es una propiedad tipográfica del idioma, y por eso vive en `meta.quotes`, fuera de
`strings`. Ahí no colisiona con la key `'"'` (que sigue siendo la de APERTURA, intacta) ni
entra en el manifest de corpus.

Y `quotePair()` habría sido activamente erróneo: TALK 0x04da es el **putchar de UN
carácter**, llamado desde 15 sitios, con el cierre CONDICIONAL (0x0bc5 `je`, 0x1172 `jne`:
si la sección acaba en op de transferencia, no se emite). Apertura y cierre son dos
emisiones independientes ⇒ `quoteOpen()` y `quoteClose()`, por separado.

### 7.2 ★★ La medida de §1 era de UNA vía, y la conclusión no aguanta las cuatro

§1 corrió `run("es", ["name"])` y concluyó «se fuga el CIERRE». Con las cuatro vías
habladas, **la respuesta de keyword y el saludo fugaban los DOS glifos** (`"Estudio las
estrellas."`): la apertura la compone `flushLine` con un `'"'` igual de crudo. La frase de
§1 «el literal del binario trae la comilla de APERTURA dentro (por eso el castellano abre
bien)» es cierta **sólo de las vías NAME / autopresentación / no-match** — que son las que
§1 midió— y falsa de las otras dos.

### 7.3 Y había un QUINTO miembro, el espejo exacto de éste

`conversation.ts:773` (handler AskName, TALK 0x0e78): el putchar `0x0e85` pone la
**APERTURA** y el literal DS 0x9468 (`What is thy name?"\n`) trae el **CIERRE** — al revés
que todas las demás. Bajo `es` salía `"¿Cuál es vuestro nombre?»`. Invisible a este acta
porque `["name"]` sobre `towne.json[0]` **nunca alcanza AskName** (hace falta
`castle.json[2]`, Treanna). Otra instancia de `familia-incompleta-invisible-a-cifras`.

### 7.4 Se cierra el residuo §6.4 (savepanel) y se corrige una errata vecina

- **`savepanel.ts:244`** — el `'"'` cuyo papel §6.4 dejó «sin adjudicar» no es ni apertura
  ni cierre: es un `case '"': return "&quot;"` de **escape HTML**. Fuera de la familia.
- **`effects.ts:112`** (errata, no de este acta pero de la misma familia): decía que las
  comillas de «Thou hast not enough gold!» «van en el literal». **No van** — `DATA.OVL`
  fileoff 0x9338 es la frase PELADA y los dos glifos son putchars (0x0657/0x0665 → 0x573a).

### 7.5 Lo que NO cambia

Los tres fragmentos de puntuación pura de §2 siguen en `strings` (ésos sí son cadenas del
binario, con texto o layout pegado), y el **control negativo de `guildQtail` se conserva
intacto**: sigue en `?\n\n` sin `»`, porque el inglés tampoco cierra esa comilla.
