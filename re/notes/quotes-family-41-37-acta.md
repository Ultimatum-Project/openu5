# Acta #41 + #37 — LA FAMILIA DE COMILLAS: dos rojos de paridad adjudicados y el ruling del cierre

Carril `quotes-family`. Rama `re/quotes-family` sobre `main` @`683cffa1`.

Tres veredictos independientes, en un solo acta porque el tercero se apoya en el primero:

| § | tarjeta | qué se preguntaba | veredicto |
|---|---|---|---|
| 1 | #41 (1) | `jimmy-prisoner-town`: ¿quién miente, el careo o el clon? | **el CAREO** — el clon calca los bytes; el modelo llevaba una paráfrasis |
| 2 | #41 (2) | `town-postturn`: diagnosticar desde cero | **regresión de `4eccef89`** — y ★★ el orden que el careo fija es INDERIVABLE |
| 3 | #37 | ¿`quotePair()` (ii) o fragmento compuesto (i)? | **NINGUNA DE LAS DOS** — el binario emite DOS glifos independientes |

---

## 1. VEREDICTO #41(1) — `jimmy-prisoner-town`: las comillas van DENTRO del literal

**El careo esperaba lo viejo. Se re-sella el modelo con la cita.**

La divergencia era exactamente una:

```
field=message   expected(modelo Python) 'I thank thee!'
                clone(TS)               '\n"I thank thee!"\n'
```

### 1.1 La derivación, leída en los bytes

El emisor es SJOG 0x0EC4, en la rama de éxito del cepo/grilletes **en PUEBLO**
(`0x0e76 cmp [g_location],0x7f / 0x0e7b jae 0xee4` reparte: ≥0x7f = mazmorra):

```asm
0ec4: b8368b     mov ax, 0x8b36     ; DS del literal
0ec7: 50         push ax
0ec8: e8054a     call 0x58d0        ; print_string  ← NO es un putchar
```

`0x58d0` es el **print de cadena**, no el putchar de un carácter. Todo lo que salga por
pantalla está, por tanto, en el literal. Y el literal, leído de `DATA.OVL`:

| DS | fileoff | bytes |
|---|---|---|
| `0x8b36` | `0x8b46` | `b'\n"I thank thee!"\n'` ← **con las DOS comillas dentro** |
| `0x8b48` | `0x8b58` | `b'Unlocked\n'` (rama hermana, 0x0ef7) |
| `0x8b10` | `0x8b20` | `b'Key broke!\n'` (fallo, 0x0e6f) |

El delta DS→fileoff es `+0x10`, y queda **comprobado por dos anclas independientes** en la
misma rutina: `0x8b36→0x8b46` y `0x8b48→0x8b58` (la segunda es la rama `jae` de la misma
comparación, así que no puede ser coincidencia de un solo desplazamiento afortunado).

⇒ **el clon tiene razón**: emite el literal VERBATIM. El modelo `cmds_parity.py` se quedó
con la paráfrasis `"I thank thee!"` de antes de #142 y nadie volvió a él.

### 1.2 La comprobación cruzada que lo cierra

La cadena está en el corpus **con las comillas en la key**, y su traducción provee los DOS
glifos castellanos — que es la conducta SANA de esta familia (§3):

```
'\n"I thank thee!"\n'  →  '\n«¡Os lo agradezco!»\n'
```

No hay ningún glifo que componga el código. Éste es el **control positivo** del ruling de
§3: cuando las comillas viajan en el dato, no hace falta primitiva ninguna.

### 1.3 ⚠ Residuo DECLARADO (no se toca)

El campo `message` de `jimmyLock` tiene **convención MIXTA**: este miembro es verbatim, y
sus cuatro hermanos son etiquetas podadas (`"Key broke!"` contra el literal
`b'Key broke!\n'`, `"Unlocked"` contra `b'Unlocked\n'`). No es rojo —modelo y clon
coinciden en los cuatro— pero es una asimetría medida. La poda del `\n` final es carril de
terminadores de consola, no de este acta. **Se declara y no se mueve.**

---

## 2. VEREDICTO #41(2) — `town-postturn`: regresión de `4eccef89`, sobre un orden INDERIVABLE

### 2.1 El diagnóstico

La traza divergía en el índice 5 y de ahí en adelante (117 tiradas el modelo, 107 el clon):

```
idx 5   modelo {damageTick 0-63}   clon {swampTown 0-29}
```

**Una sola raíz.** El modelo corría `tile de daño` → `pantano`; el clon, `pantano` → `tile
de daño`. Todo lo demás (los `wake` que aparecen en una pata y no en la otra, los
`wind 0-4`/`wind 0-255` extra del clon) es **aguas abajo**: son la misma órbita del RNG
leída con desfase. Invertido el orden en el modelo, la traza casa ENTERA y la semilla final
también.

**Quién la introdujo y por qué no saltó:**

| commit | fecha | qué hizo |
|---|---|---|
| `1056c0b1` | 15-07 | arregló el modelo (le faltaba el `burn`); declaró `re:parity:all` 254/254 |
| `4eccef89` | 28-07 | reescribió el bloque del clon como el BUCLE de trampilla y, al transcribirlo, puso pantano antes que fuego |

`4eccef89` cerró con `npm test -w game` — la suite de vitest— y **no corrió el arnés de
pytest**, que es el único que mira esta traza. Ése es el hueco: un commit que toca
`turn.ts` mueve un careo que vive en `re/tools/`.

### 2.2 ★★ Lo que el diagnóstico destapa: el orden NO SE PUEDE DERIVAR

La cadena de peligros del suelo (TOWN `post_turn` 0x0F48-0x10C7) lee el tile **UNA sola
vez** y luego prueba ese único valor:

```asm
0f60: 8946f8         mov  [bp-8], ax        ; ← el tile, leído UNA vez
0f63: 3d8c00         cmp  ax, 0x8c          ; trampilla
0f68: e9e500         jmp  0x1050
1050: 837ef804       cmp  [bp-8], 4         ; pantano
1054: 7556           jne  0x10ac
...
106f: 7356           jae  0x10c7            ; ← la cola del pantano SALTA el 0x10ac
10ac: 817ef8bc00     cmp  [bp-8], 0xbc      ; fuego (Fireplace)
10b3: 817ef88f00     cmp  [bp-8], 0x8f      ; fuego (Lava)
```

Son **excluyentes por dos vías a la vez**: (a) un tile no puede valer 4 y 0xBC al mismo
tiempo, y (b) aunque pudiera, la cola del bucle del pantano sale por `0x106f jae 0x10c7`,
que **salta por encima** del test de fuego. El binario NUNCA ejecuta los dos en la misma
vuelta ⇒ **no hay orden entre ellos que calcar**.

`town-postturn` enciende los dos a la vez (`damageTile:true` + `onSwampTile:true`), que son
dos booleanos del ARNÉS; en el cableado vivo ambos salen del mismo `tileUnderParty()`. Es
un **estado inalcanzable en el binario**, encendido a propósito como estrés de stream.

★ **Por eso el orden que este careo fija es una CONVENCIÓN DEL ARNÉS, no un hecho
derivado.** Se deja escrito en los dos sitios (modelo y escenario) para que nadie lo cite
mañana como «orden derivado del asm». La convención elegida es el orden en que el CÓDIGO
prueba las guardas (pantano 0x1050 antes que fuego 0x10ac), que es lo que transcribe el
clon; el modelo llevaba el inverso, heredado del clon PRE-`4eccef89`.

**Se arregla el MODELO**, no el clon: el clon es la transcripción del bloque y no hay nada
en el binario que lo desmienta.

### 2.3 De propina, dos precondiciones del pantano confirmadas contra el asm

`0x1078 cmp [si+0x55b3],0x44` ('D') y `0x107f cmp ...,0x50` ('P') saltan al siguiente
miembro **ANTES** del rand de `0x1086` ⇒ muertos y ya-envenenados **no consumen tirada**.
El modelo ya lo hacía; ahora lleva la cita.

---

## 3. RULING #37 — ni `quotePair()` ni fragmento compuesto: **DOS glifos independientes**

### 3.1 La pregunta del lead y la medida que la contesta

> *si el binario emite apertura y cierre como PARES desde el mismo punto → `quotePair()`;
> si los emite por separado en puntos distintos → opción (i) o lo que la derivación
> sostenga.*

**Los emite por separado.** `TALK 0x04da` es, entero:

```asm
04da: b8a200     mov  ax, 0xa2      ; TLK-charset 0xa2, &0x7f = '"'
04dd: 50         push ax
04de: e8510a     call 0xf32         ; putchar
04e1: c3         ret
```

Cuatro instrucciones: **el putchar de UN carácter**. No hay par, no hay envoltura, no hay
estado. Y se llama desde **15 sitios independientes** de TALK.OVL (0xa3c, 0xa4a, 0xa7f,
0xac5, 0xad3, 0xb8a, 0xbb4, 0xc67, 0xc7a, 0xcf7, 0xd1e, 0xd2e, 0xe85, 0x1166, 0x1174).

### 3.2 Las TRES asimetrías que matan la idea de par atómico

**(a) El cierre es CONDICIONAL.** Si la sección acaba en op de transferencia
(JoinParty/End/Goto → `talk_say_section` `0x07aa` con retorno ≠0), el cierre **no se emite**:

```asm
; saludo                          ; respuesta de keyword
1166: call 0x4da   ← abre         0bb4: call 0x4da   ← abre
116d: call 0x7aa                  0bc0: call 0x7aa
1170: or ax, ax                   0bc3: or ax, ax
1172: jne 0x112e   ← se VA        0bc5: je  0xb8a    ← sólo cierra si ax==0
1174: call 0x4da   ← cierra       0bc7: (se va sin cerrar)
```

**(b) A veces la APERTURA no es un putchar, sino parte del literal de DATA.OVL** — y
entonces sólo el cierre sale del putchar:

| vía | apertura | cierre |
|---|---|---|
| saludo (0x1166/0x1174) | putchar | putchar |
| keyword (0x0bb4/0x0b8a) | putchar | putchar |
| NAME (0x0aa8/0x0ad3) | literal `"My name is ` DS 0x93c2 | putchar |
| autopresentación (0x115a) | literal `"I am called ` DS 0x94ce | putchar |
| no-match (0x0b83/0x0b8a) | literal `"I cannot help thee…` DS 0x9420 | putchar |
| AskName (0x0e85) | **putchar** | **literal** `What is thy name?"\n` DS 0x9468 |

★ La última fila es la que rompe cualquier simetría: es la ÚNICA en la que el par va al
revés (código abre, dato cierra).

**(c) Hay cierres a los que se llega por caminos que nunca pasaron por su apertura**:
`0x0ab7 je 0xad3` salta directo al cierre esquivando el `0x0ac5`.

⇒ **el ruling**: dos primitivas de locale independientes, `quoteOpen()` y `quoteClose()`,
pedidas exactamente donde el binario emite cada putchar. La opción (ii) (`quotePair()`)
modelaría como atómico algo que el binario parte en dos y a veces deja a medias; la (i)
(componer `'"' + tail` como fragmento) haría depender el GLIFO del espaciado que le siga,
y además sólo cubre `tail` no vacío (lo que la propia acta #162 §4 ya avisaba).

### 3.3 Dónde viven, y por qué NO en el corpus

En `meta.quotes` de la tabla de idioma, **fuera de `strings`**. Razón: `t()` es una tabla
indexada por el string INGLÉS, y el inglés usa el MISMO carácter para abrir y cerrar — la
key `'"'` ya está tomada por la de apertura (traduce a `«`), y una tabla por texto no puede
dar dos traducciones a la misma key. Ése era el bloqueo que #162 §4(C) declaró y no podía
resolver dentro del corpus.

La salida no es forzar el corpus: es **reconocer que el cierre no es la traducción de un
string**, sino una propiedad TIPOGRÁFICA del idioma. En `meta` no colisiona, no entra en el
manifest de corpus (que gobierna traducciones de texto del binario) y no puede quedarse
huérfana. Los fragmentos que SÍ llevan texto o layout pegado (`'?" '`, `'\n"'`, `'!"\n\n'`
— #162 §2) siguen donde estaban: ésos sí son cadenas del binario.

En `en` ambas devuelven `'"'` ⇒ **el calco queda byte-idéntico** (sellado con control
positivo explícito).

### 3.4 ★★ Al arreglarlo se destapó que la familia medida estaba INCOMPLETA

#162 midió **una sola vía** (`run("es", ["name"])`) y concluyó «se fuga el CIERRE». Corridas
las CUATRO vías habladas, la conclusión no se sostiene entera:

| vía | antes (es) | después |
|---|---|---|
| keyword | `"Estudio las estrellas."` ← **fugaba los DOS glifos** | `«Estudio las estrellas.»` |
| saludo | `"Welcome,  Avatar…"` ← **los DOS** | `«Welcome,  Avatar…»` |
| no-match | `«En eso no puedo ayudaros."` | `«En eso no puedo ayudaros.»` |
| NAME | `«Me llamo Zachariah"` | `«Me llamo Zachariah»` |
| **AskName** | `"¿Cuál es vuestro nombre?»` ← **el ESPEJO: ASCII abre contra `»`** | `«¿Cuál es vuestro nombre?»` |

La última no la había visto nadie: es el defecto de #162 **al revés**, vive en el mismo
fichero (`conversation.ts:773`) y era invisible a su medida porque `["name"]` sobre
`towne.json[0]` nunca alcanza el handler AskName. Hace falta un NPC que lo tenga en la ruta
(`castle.json[2]`, Treanna). Es otra instancia de
`familia-incompleta-invisible-a-cifras`: **el hueco de un miembro no se ve en la cifra de
los demás**.

⚠ Y tiene una lección de diseño propia: en AskName el par está PARTIDO entre las dos capas
(código abre, corpus cierra). Si el glifo compuesto y el del literal se eligen por vías
distintas, **una traducción ausente basta para descabalar el par** aunque el código sea
correcto. Aquí no muerde porque la key está traducida y lleva `»`.

### 3.5 Censo de cierre de la familia, con sus adjudicaciones

Barrido AST-ligero de toda composición de `'"'` en `game/src/`, leído uno a uno:

| sitio | qué es | veredicto |
|---|---|---|
| `conversation.ts` `flushLine` | apertura del discurso, putchar 0x4da | → `quoteOpen()` |
| `conversation.ts` `endSpeech` | cierre del discurso, putchar 0x4da | → `quoteClose()` |
| `conversation.ts:773` AskName | apertura, putchar 0x0e85 | → `quoteOpen()` (miembro nuevo, §3.4) |
| `effects.ts:118` oro insuficiente | los 2 glifos plegados en la key del corpus | **no se toca** (ver ⚠ abajo) |
| `camp.ts:403` discurso de KARMA | los 2 glifos en el record de KARMA.DAT | **no se toca** |
| `shrine-ceremonies.ts` CODEX_PAGES | los 2 glifos en el literal de MISCMSG | **no se toca** |
| `savepanel.ts:244` | `case '"': return "&quot;"` — **escape HTML** | ★ **fuera de la familia** |

★ La última fila cierra el residuo #162 §6.4, que dejaba el papel de ese `'"'` «sin
adjudicar»: no es ni apertura ni cierre, es un `switch` de escape HTML. No pertenece a esta
familia y nunca perteneció.

⚠ **Errata corregida de camino** (`effects.ts:112`): el docblock afirmaba que las comillas
de «Thou hast not enough gold!» «van en el literal». **No van.** El asm es
`0x0657 mov ax,0x22 → 0x573a` (putchar), print DS 0x9328, `0x0665 mov ax,0x22 → 0x573a`
(putchar), print DS 0x9344; y `DATA.OVL` fileoff `0x9338` es
`b'Thou hast not enough gold!'` **pelado**. El comentario se contradecía a sí mismo dentro
de la misma frase («son chars impresos … van en el literal»). El CÓDIGO no cambia: pliega
los dos glifos en la key del corpus y la traducción provee ambos, así que la salida es
correcta en los dos idiomas y no queda glifo que componga el código.

---

## 4. Verificación

| gate | resultado |
|---|---|
| `tsc --noEmit` (game) | **0 errores** |
| `vitest run` (game, completa) | **325 ficheros / 4137 tests verdes** (+1 skip) |
| `re:parity:all` bloque PURO | **259/259 verdes, 0 skips** — los 2 rojos preexistentes ADJUDICADOS |
| `test_frontier.py` | verde |
| `tour:manifest` + `verify:corpus` | sin diff / verde |

### 4.1 Mutación — los sellos nuevos son sensibles

Cuatro mutaciones, cada una repuesta después:

| mutación | efecto |
|---|---|
| `endSpeech` vuelve a `'"'` crudo | **2 rojos** |
| `flushLine` vuelve a `'"'` crudo (lado APERTURA) | **2 rojos** |
| AskName vuelve a `'"'` crudo | **1 rojo** (el miembro de §3.4) |
| se retira `meta.quotes` de `es.json` | **3 rojos** |

★ La cuarta importa aparte: prueba que el fallback al suelo (`'"'`) **no enmascara** la
ausencia de la tabla. Sin ella, «verde» podría significar «el idioma no tiene par definido»
en vez de «el par está bien».

### 4.2 Controles que se CONSERVAN

- **`guildQtail` sigue en `?\n\n`, sin `»`** — el inglés (`"What else, ` + `?\n\n`) tampoco
  cierra esa comilla. Calcar incluye calcar lo que el original deja abierto. (#162 §2.)
- **La sección que AskName interrumpe queda ABIERTA** (`«Me llaman Treanna ` sin cierre) —
  es la predicción discriminante de §3.2(a): el op de transferencia se lleva el control y
  el putchar de cierre no se emite. **Sellado como control positivo**, no como defecto.
- **`en` byte-idéntico**: las 6 líneas habladas del barrido abren y cierran en ASCII.

## 5. Residuos DECLARADOS

1. **Convención mixta del `message` de `jimmyLock`** (§1.3) — 4 etiquetas podadas contra 1
   verbatim. No es rojo; es carril de terminadores de consola.
2. **El orden pantano↔fuego es convención del arnés** (§2.2) — inderivable por
   construcción. Anotado en `loops_parity.py` y en este acta. Que nadie lo cite como
   derivado.
3. **El hueco de proceso que dejó pasar la regresión** (§2.1): un commit que toca
   `game/src/core/world/loops/turn.ts` mueve un careo que vive en `re/tools/`, y el gate
   de vitest no lo ve. Vale una tarjeta de proceso, no de código.
4. **El cuerpo `.TLK` sin traducir** (#162 §4(B)) — `«Welcome,  Avatar, in these dark
   times.»` sale con las comillas bien y el cuerpo en inglés. Carril propio, intacto.

---

## 6. ★★ HALLAZGO DE PROCESO — este carril PERTURBÓ el detector de nombres-marcador DOS veces

`test_frontier.py` pasó de 44/44 en `main` a **42/44** en esta rama, y ninguno de los dos
rojos tenía que ver con comillas ni con paridad. Los dos son **realimentación del
instrumento**: `genero.Trinquete` y `routine_census.build_name_seeds` construyen su corpus
leyendo **el propio repo** —`re/notes/**/*.md`, `docs/**/*.md` y `game/src/**/*.ts`—, así
que escribir código o prosa **mueve el clasificador que juzga los nombres del ledger**.

Calibrado como manda `criterio-que-sobrevive-al-arreglo`: worktree `--detach` en
`683cffa1` con los mismos symlinks, para no confundir «rojo mío» con «rojo del entorno».
(El primer intento dio 32 rojos **en main** por correr sin los `.asm` symlinkeados: un
entorno incompleto acusa en falso a todo el mundo.)

### 6.1 Un `const` en CASTELLANO dentro de `game/src/` desarma una regla TIER-1

Escribí `const cierre = quoteClose()` y `const apertura = quoteOpen()`. El corpus de CÓDIGO
de `genero.build_corpora` se construye con
`r"\b(?:function|const|let|var|…)\s+([A-Za-z_$][\w$]*)"` sobre `game/src/**/*.ts` ⇒
**`cierre` pasó a ser un identificador del código**. Y la regla que marcaba `EGA.DRV:0x1e68`
era precisamente `r4b_prose_word_not_in_code` («palabra de la prosa, ausente del inglés **y
del código**»). Al entrar en el código, la regla dejó de disparar, la población de
enmascaradas se vació y **cayó el CONTROL POSITIVO** de
`test_el_enmascaramiento_del_trinquete_es_MEDIBLE`.

Medido en los dos worktrees, mismo predicado: `'cierre' in code` → `True` en la rama,
`False` en `main`.

**Arreglo**: renombrar a `closeGlyph` / `openGlyph`. Los comentarios NO importan
(`build_corpora` los tira antes de extraer identificadores) — sólo las **declaraciones**.

⚠ Regla que se lleva: **nombrar en castellano una variable de `game/src/` puede
reclasificar el nombre de una rutina del ledger**, y el único síntoma aparece tres capas
más allá, en un test de `re/`.

### 6.2 Citar un offset en prosa INYECTA una semilla que pisa un nombre curado

Mi §3.2 escribía `` `0x07aa` devuelve ≠0 ``. `build_name_seeds` atribuye por contexto de
línea ⇒ la semilla de `TALK.OVL:0x07aa` pasó de **`None`** (en `main`) a **`'devuelve'`**.
Y como el generador aplica **PRIORIDAD, no disyunción** (`routine_census.py:537` la semilla;
`:652` el rol **sólo si la semilla dejó vacío`), la próxima regeneración del censo habría
sustituido el nombre curado `talk_say_section` por `devuelve` — en silencio.

`test_no_orphan_names_only_the_stale_census_could_explain` lo cazó, que es exactamente para
lo que existe. **La guarda funcionó.**

**Arreglo elegido**: citar la rutina **por su nombre curado** —
`` `talk_say_section` `0x07aa` con retorno ≠0 `` — con lo que la semilla pasa a valer
`'talk_say_section'`: ahora la prosa **refuerza** el nombre en vez de destruirlo.

★ Se descarta a propósito el remedio que el propio test propone en su docstring (fijarlo en
`re/ledger/frontier-manual.json`): eso cambia el `build()` y obligaría a **regenerar
`frontier.json`**, y regenerar ledgers está EXPLÍCITAMENTE fuera del encargo de este carril.
Se deja anotado por si el lead prefiere el pin.

⚠ Regla que se lleva: **una cita de offset en prosa es un acto de escritura sobre el
censo**, no sólo documentación. Al citar un offset, cítalo con su nombre curado al lado.
