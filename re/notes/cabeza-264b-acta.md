# ACTA #264b — RELEVO de la cabeza del cruce: los pares restantes, leídos par a par

> Rama `re/cabeza-264b`, worktree `.claude/worktrees/cabeza-264b`, base **main `f6979e86`**.
> Relevo del parcial de #264 (`re/notes/cabeza-264-acta.md`), que a su vez adjudica la medida
> de #255 (`re/notes/cruce-255-acta.md`). Aquí se sigue LEYENDO, no midiendo.

---

## 0. PRE-REGISTRO (escrito ANTES de leer un solo par — commit propio, el orden lo prueba `git log --reverse`)

### 0.1 EL CORTE Y LA POBLACIÓN, declarados con la cifra

Heredo el corte de #264 sin tocarlo, porque cambiarlo a mitad haría incomparables las dos mitades:

**CORTE: ≥ 10 menciones, canales A+B. POBLACIÓN DE PARTIDA: 66 pares sobre 23 fichas.**

De esos 66, el parcial de #264 dejó cerrados:

| cerrado por #264 | pares |
|---|---|
| CITADO POR Nº DE TARJETA (falsos «no citado» del matcher de #255) | 4 |
| ADJUDICADO por lectura (el par obligado `g_cbt_room_record` ↔ `lectura-244-acta`) | 1 |

★ **Discrepancia aritmética que declaro ANTES de empezar, porque afecta a mi denominador**: el
acta de #264 y la tarjeta dicen «quedan **62**», que es 66 − 4. Pero uno de los cerrados por
lectura (`lectura-244-acta`) **no** está entre los 4 de cita-por-número — el propio §2 de #264
dice que «no estaba cruzado por ninguna vía». El otro sí lo está (`dnglook-248-acta`, que es a la
vez el par adjudicado y uno de los 4). Luego los cerrados son **5 distintos**, no 4, y

**MI POBLACIÓN ES 61, no 62.** Publico toda proporción sobre 61 y con el corte pegado. Si al
re-verificar la vía de cita-por-número (§1) salieran más de 4, la población baja otra vez y lo
diré con la cifra nueva, no en silencio.

### 0.2 LA TAXONOMÍA — heredada de #264 §0.2 SIN cambios (para que las dos mitades sumen)

| veredicto | criterio |
|---|---|
| **AMPLÍA** | el documento aporta sobre esa dirección algo que la ficha NO dice (un consumidor, una extensión, una codificación de valores, un productor, una geometría) |
| **CONTRADICE** | el documento afirma algo incompatible con la ficha, o declara explícitamente que la ficha está incompleta o equivocada |
| **REDUNDANTE** | el documento usa la dirección pero no añade nada que la ficha no tenga ya |
| **RANCIO** | el documento habla de un estado del repo que ya no existe (dato caducado) ⇒ no se cruza, se declara |

Añado una celda que #264 no necesitó y yo sí voy a necesitar, y la declaro ahora para no
inventármela a mitad:

| veredicto | criterio |
|---|---|
| **CITADO** | la ficha SÍ cruza el documento (por ruta, por carpeta o por `#nº` de tarjeta) ⇒ no era hueco; sale de la población |

### 0.3 PREDICCIÓN PRE-REGISTRADA (cifra Y corte Y condición de fracaso)

Sobre los **61 pares** del corte ≥10 que quedan sin leer:

- **AMPLÍA: 18-40** · **CONTRADICE: 1-6** · **REDUNDANTE: 15-38** · **RANCIO: 0-5** ·
  **CITADO (falsos huecos que aún se me escapen): 0-6**
- **Fichas que acabo corrigiendo: entre 4 y 13** (de las 22 fichas vivas).

Razonamiento auditable: la cabeza está poblada por actas de tarjetas que estudiaron esa dirección
a fondo, y una acta que mide algo nuevo casi por definición amplía; pero muchos de estos
documentos son **barridos transversales** (`kernel-render-sweep`, `catalogo-191-acta`,
`derivaciones-152-acta`) que tocan decenas de globales de pasada, y ésos deberían caer del lado
REDUNDANTE. Por eso mi banda de REDUNDANTE es tan ancha como la de AMPLÍA, al revés que #264.

**CONDICIONES DE FRACASO, escritas antes de leer:**

- Si **CONTRADICE = 0**: no firmo «la contradicción es un caso aislado» sin antes pasar por mi
  propio criterio el positivo vivo que me da el material — el par ya adjudicado
  `g_cbt_room_record` ↔ `lectura-244-acta`, que #264 leyó como CONTRADICE. Si mi criterio no lo
  marca, el roto es el criterio, no el corpus.
- Si **AMPLÍA > 50** (82 %): sospecho de mí antes que del ledger — estaría llamando amplificación
  a cualquier detalle que la ficha no repita, y el acta tendría que enseñar por qué no lo es.
- Si **REDUNDANTE > 45** (74 %): sospecho igual, en el sentido contrario — sería la firma de una
  lectura superficial que archiva como «no añade nada» lo que no ha leído hasta el final. En ese
  caso debo exhibir tres redundantes con la frase del documento y la frase de la ficha al lado.
- Si acabo **corrigiendo más de 16 fichas**: paro y pido revisión, porque tocar dos tercios de la
  cabeza en un solo carril es una edición masiva disfrazada de lectura.

### 0.4 ★ PROCEDENCIA OBLIGATORIA, las tres, antes de escribir una sola cita

Regla heredada de #264 §0.4, y está ahí porque en `lectura-244` una cita FABRICADA casi entra por
saltársela. Para cada documento que yo añada a un `evidence` verifico **las tres** y lo dejo dicho:

1. el documento **EXISTE** en la ruta que voy a escribir;
2. **toca esa dirección** (por símbolo, o por hex que cae dentro de `addr .. addr+size-1`);
3. **dice LITERALMENTE** lo que afirmo que dice — con la frase a la vista, no de memoria.

Sin las tres, el par se declara y **no** se corrige.

### 0.5 TÉCNICA DE CORRECCIÓN

Quirúrgica: sustitución de cadena sobre el fichero, **jamás round-trip** de JSON (un round-trip
impone mi formateador a todo el catálogo y el `--stat` deja de ser legible). El `evidence` anterior
se conserva **entero** y lo mío se **añade** detrás con `||`. El `--stat` debe enseñar sólo mis
líneas.

### 0.6 RESERVAS, impresas junto a toda cifra de esta acta

- **«No cita» NO es «está mal»** — puede ser redundante, puede estar rancio el documento, puede ser
  una mención de pasada. Ninguna celda de aquí es por sí sola un defecto.
- **La población de #255 es una COTA SUPERIOR** — corrección de #264 §1: su matcher era ciego a la
  cita por `#nº de tarjeta`, y 4 de 66 en esta cabeza eran falsos huecos.
- **Candidato ≠ defecto.** Lo que yo marque AMPLÍA es material para una corrección, no la prueba de
  que la ficha estuviera mal.
- **La población depende ENTERAMENTE del corte** (≥1: 1536 · ≥3: 533 · ≥5: 239 · ≥10: 66). Los 349
  restantes del corte ≥3 siguen sin leer.
- El **canal C** (hex desnudo, 2308 pares) sigue siendo COTA y no entra.

### 0.7 LA REGLA DE ORO del relevo, que aplico a TODOS los pares antes de adjudicar

Antes de marcar un par como hueco, comprobar si la ficha cita el documento por **`#nº de tarjeta`**
(`★ #248`). Si no se comprueba, se acusa en falso. Lo re-verifico yo con instrumento propio sobre
los 61 (§1), no lo doy por hecho: el hallazgo es de #264 y la re-verificación es barata.

---

## 1. ★★ LA REGLA DE ORO RE-VERIFICADA — y salen DOS falsos huecos MÁS (la cota de #255 baja otra vez)

Re-corrí la vía de cita-por-número con instrumento propio sobre los 66, y luego, leyendo, apareció
una convención que ni #255 ni #264 ni mi primer matcher veían.

| vía de cita | pares | quién la vio |
|---|---|---|
| por RUTA / carpeta / basename | 1 | #255 (y yo) |
| por **`#nº de tarjeta`** | **5** | #264 vio 4; el 5º lo añado yo |
| por **NOMBRE DE CARRIL** (sin sufijo `-acta`, y con SHA) | **1** | nadie hasta aquí |

- El 5º de cita-por-número: `g_char_anim_states` ↔ `re/notes/particion-245b-acta.md`. La ficha dice
  literalmente «*cifra que coincide exacta con la de **#245** por vía independiente*».
- ★ El de nombre de carril: `g_char_anim_states` ↔ `re/notes/cama-241-acta.md`. La ficha lo cita DOS
  veces y una con SHA: «*hallazgo de **cama-241**, verificado aquí instrucción por instrucción*» y
  «*Procedencia del hallazgo: **cama-241** (main 567ae5b2)*». Mi matcher buscaba `cama-241-acta`, no
  `cama-241`, y por eso lo acusaba en falso.

⇒ **Falsos huecos en la cabeza: 6 de 66 (9 %)**, no 4 (6 %). La corrección de #264 a #255 va en la
dirección correcta y se queda CORTA. **La población de #255 sigue siendo una COTA SUPERIOR, y ahora
por TRES convenciones de citación, no una.**

**MI POBLACIÓN VIVA baja de 61 a 60.** Lo declaro con la cifra, como pre-registré en §0.1.

## 2. TANDA 1 — las 11 de `g_char_anim_states` (0x5C5A), la ficha más tocada del ledger

Recordatorio pegado a la tabla: **«no cita» NO es «está mal»**, y **candidato ≠ defecto**.

| # | documento | veredicto | qué aporta (o por qué no) |
|---|---|---|---|
| 1 | `ui-render-map.md` | **REDUNDANTE** | su contenido sobre 0x5C5A (el pintor de la capa de personajes, `ULTIMA.EXE 0x5394`, vuelca transporte/x/y/planta) ya está en la ficha, y con MEJOR derivación (`ULTIMA.EXE 0x53a6` .. `ULTIMA.EXE 0x53be`). Ver §2.1: además su cita es en parte ESPURIA |
| 2 | `endgame-derivation.md` | **AMPLÍA** | reparte los slots POR PAPEL: #0-5 party, **#6 = el Orb**, **#0x1F = Lord British** (0x5c5a+248 = 0x5d52), y enseña el borrado por escritura de 0 en +0/+1 |
| 3 | `witness-o1-0x6b4.md` | **AMPLÍA (fuerte)** | mapa COMPLETO de los 8 campos con el escritor genérico de seis campos, `ULTIMA.EXE 0x3a82` .. `ULTIMA.EXE 0x3aa5`, y la equivalencia con el fichero de partida (DS:0x5C5A ≡ offset 0x6B4); +5 = HULL, +7 = esquifes a bordo |
| 4 | `cama-241-acta.md` | **CITADO** | por nombre de carril + SHA (§1) ⇒ nunca fue hueco |
| 5 | `overworld-ai-rng.md` | **AMPLÍA** | el barrido de turno es **31→1 DESCENDENTE y excluye el slot 0** (MAINOUT 0x1AB6); +5/+7 como contadores de fase y de viento |
| 6 | `catalogo-191-acta.md` | **AMPLÍA** | el campo +5 (0x5c5f) no tiene entrada propia y es el candidato a `g_hull`, con la decisión declarada ABIERTA |
| 7 | `kernel-render-sweep.md` | **AMPLÍA (fuerte)** | productor que la ficha no nombraba: `0x6936 party_anim_build` limpia los registros a paso 8 y escribe 0x40/0x44/0x48/0x4c por clase; y lee +0 **enmascarando los dos bits bajos** (`& 0xfc`) |
| 8 | `deriv-211-acta.md` | **AMPLÍA (instrumento)** | ★ el literal `5c5c` es **dos cosas**: la global absoluta impresa por símbolo y el acceso indexado a la tabla; un censo ciego al modo de direccionamiento las mezcla |
| 9 | `liston-b-207-sub2-acta.md` | **AMPLÍA** | los consumidores que hacen de +5 un casco: `cmp [0x5c5f], 0x32` y `sub [0x5c5f], al`. ⚠ y él mismo se niega a firmar contra el ledger: «*no digo que el ledger esté mal*» ⇒ **NO lo cuento como CONTRADICE** |
| 10 | `kernel-sweep-3.md` | **★★ AMPLÍA (cierra un hueco declarado)** | §2.2 |
| 11 | `derivaciones-152-acta.md` | **AMPLÍA (leve)** | 0x5C5A cae DENTRO de la ventana del save ⇒ los objetos colocados PERSISTEN; es la propiedad que gobierna el caballo del Wish en el port |

**Recuento tanda 1: AMPLÍA 9 · CONTRADICE 0 · REDUNDANTE 1 · RANCIO 0 · CITADO 1.**

### 2.1 La cita de `ui-render-map` es en parte ESPURIA — y destapa una global SIN FICHAR

`ui-render-map.md:101` anota el barrido del painter B así: «*recorre el buffer `[-0x54fE]` (tile-id)
en paralelo con `[-0x539C]` (**0x5C64**)*». **La aritmética no da eso**: `(-0x539C) & 0xFFFF =
0xAC64`, no 0x5C64. Verificado en el disasm (`56d4: 80b864ac16  cmp byte ptr [bx + si - 0x539c],
0x16`). O sea que esa mención NO toca 0x5C5A y el par casa en parte por una **errata del documento**.

★ Y la errata tapa algo: el segundo búfer del painter avanza de **16 en 16** (`572e: add word ptr
[bp - 0xe], 0x10`) mientras el de tiles avanza de 32 en 32, y son 11 filas ⇒ **0xAC64 .. 0xAD13, 176
bytes, y terminan EXACTAMENTE donde empieza `g_cbt_room_record` (0xAD14)**. El ledger no tiene
NINGUNA entrada entre 0xAC61 (fin de `g_vis_buffer`) y 0xAD14: es un hueco de 176 B con un
consumidor real. `kernel-render-sweep.md:176` lo llama «capa de personajes» y **arrastra la misma
errata** (`[-0x539c]` (0x5c64)) ⇒ el fallo está PROPAGADO en dos documentos. Y `0xAC74`, que es la
tarjeta #61 («único acceso en el corpus»), es exactamente **fila 1, columna 0 de ese búfer**.
⇒ **cabo con tarjeta propuesta**, no lo toco aquí.

> 🔴 **RETRACTADO EN PARTE — leer §5 ANTES de usar este párrafo.** Al llegar a los pares de
> `g_vis_buffer` descubrí que la aritmética de 0xAC64 (y hasta la identificación de 0xAC74 como su
> fila 1) YA estaba derivada, y no en un sitio recóndito: en DOS documentos y **en el propio
> ledger**. Lo único mío que sobrevive es la ERRATA de los dos documentos. Mi encuadre de
> «global que la errata TAPA» era falso.

### 2.2 ★★ EL PAR QUE CIERRA UN HUECO QUE LA PROPIA FICHA DECLARABA ABIERTO

La ficha terminaba diciendo: «*⚠ Lo que NO está derivado: que +1 sea el fotograma actual y +0 el
tile base (los dos reciben el mismo valor en el slot 0); eso pide leer **un escritor de slot >= 1***».

`kernel-sweep-3.md` §11 tiene ese escritor. Y **lo verifiqué byte a byte antes de citarlo**, porque
importar la lectura de un documento sin cotejarla es exactamente lo que el régimen prohíbe:

```
67c8: 8a5f04            mov bl, byte ptr [bx + 4]     ; slot, del registro de actor de combate
67cf: d3e3              shl bx, cl                    ; cl = 3  =>  slot * 8
67d1: c6875b5c1d        mov byte ptr [bx + 0x5c5b], 0x1d
```

El Ring of Invisibility (anillo `0x2a`) escribe el **tile 0x1D en el campo +1** de un slot
arbitrario **sin tocar +0**. ⇒ que +0 y +1 llevaran el mismo valor era una propiedad **del slot 0**,
no del formato. **Lo que NO firmo**: que +1 sea un FOTOGRAMA. Esto es una SUSTITUCIÓN de tile
(volverse invisible), no un ciclo de animación; el hueco se estrecha, no se cierra del todo.

### 2.3 CORRECCIÓN APLICADA — una sola ficha, `--stat` de 2 líneas

`re/ledger/globals.json`, entrada `g_char_anim_states`: dos sustituciones de cadena (**sin
round-trip**), el texto anterior conservado ENTERO y lo mío añadido detrás con `||`.
`--stat` = `1 file changed, 2 insertions(+), 2 deletions(-)`, y las dos líneas son las dos que toco.

**Procedencia 3/3 verificada para cada cita añadida**: los cinco documentos EXISTEN en la ruta
escrita, TOCAN 0x5C5A por símbolo o por hex dentro de 0x5C5A..0x5D59, y DICEN LITERALMENTE lo
citado (leído en el fichero, no de memoria). Las dos derivaciones fuertes (0x6794 y 0x56ac) van
además cotejadas contra el disasm.

---

## 3. TANDA 2 — las 7 de `g_location` (0x5893), y aquí el reparto es UNÁNIME

La ficha entera decía, de significado: «*location actual (0=Britannia/Underworld)*». **Cuarenta
caracteres** para la dirección que su propia evidencia llama «*la MÁS compartida del censo*»
(268 referencias en 20 ficheros). Los siete documentos amplían, y ninguno contradice.

| # | documento | veredicto | qué aporta |
|---|---|---|---|
| 12 | `combat-light-verdict.md` | **AMPLÍA** | el centinela 0xFF de combate **con su protocolo guarda/restaura**, y la familia de gates de render que bifurcan por la frontera |
| 13 | `dungeon-map-buffers.md` | **AMPLÍA (fuerte)** | la CODIFICACIÓN de la banda de mazmorra: 0x21..0x28, escrita como `si + 1`, con `dungIdx = g_location - 0x21` y las ocho mazmorras en orden |
| 14 | `liston-c-207-acta.md` | **AMPLÍA** | los gates de banda (`cmp 0x20`/`jbe` + `cmp 0x29`/`jae`) y ★ los DOS umbrales que no coinciden |
| 15 | `combat-frame-adjudication.md` | **AMPLÍA** | los tres consumidores de render con su umbral exacto cada uno, y el despachador de «modo especial de pantalla» que guarda la global |
| 16 | `intro-demo-scene.md` | **AMPLÍA** | ★ DOS valores que NADIE más da: **0x40 = modo DEMO/attract** y **0x42 = ENDGAME**, con su escritor y su lector |
| 17 | `liston-d-207-acta.md` | **AMPLÍA** | la MAGNITUD del discriminador: 56 sitios en 6 ficheros; y que el port lo implementa LITERAL, no por la glosa |
| 18 | `resolve-command-char-178c-acta.md` | **AMPLÍA** | el par de hermanas que difiere exactamente en `g_location == 0x80`, y el censo de escrituras |

**Recuento tanda 2: AMPLÍA 7 · CONTRADICE 0 · REDUNDANTE 0 · RANCIO 0 · CITADO 0.**

### 3.1 Por qué NINGUNO es CONTRADICE, dicho explícitamente

Es tentador leer «la ficha sólo dice 0=Britannia» como que la ficha está mal. **No lo está**: lo
que dice es cierto y ningún documento lo desmiente. Está INCOMPLETA, que es otra cosa y es
exactamente la celda AMPLÍA. Y dos de los documentos se niegan ellos mismos a firmar contra el
ledger — `liston-c-207-acta` escribe «*Lo que NO firmo: no digo qué ES la banda `g_location >=
0x7f`*» y `liston-d-207-acta` remite a la tarjeta #184. **Respeto esa reserva y no la resuelvo**:
mi corrección mete el MAPA DE VALORES y la EXISTENCIA de los dos umbrales, y deja escrito que qué
significa la banda sigue abierto.

### 3.2 ★ UN ERROR MÍO, con su re-medición

Al verificar «`0887: mov [g_location], al` = `si + 1`» busqué el offset en **`DUNGEON.OVL`** —
porque el documento habla de mazmorras— y no encontré ninguna escritura ahí. Estuve a un paso de
declarar la cita del documento como errónea. **El bloque de código es de `MAINOUT.OVL 0x0790`**, y
el documento lo dice en su propia cabecera; el equivocado era yo, no él. Re-medido en el fichero
correcto, cuadra byte a byte:

```
0887: 8a46fe            mov al, byte ptr [bp - 2]
088a: fec0              inc al
088c: a29358            mov byte ptr [g_location], al
```

Es la lección de «cita equivocada > ninguna» en su forma de instrumento: **el fichero es parte de
la cita**, y un cero-en-falso por buscar en el overlay que la INTUICIÓN sugiere (mazmorras ⇒
DUNGEON) en vez de en el que la cita DICE es la misma familia de la ceguera al segmento.

### 3.3 CORRECCIÓN APLICADA — `--stat` de 2 líneas

`re/ledger/globals.json`, entrada `g_location`: dos sustituciones de cadena, sin round-trip, texto
anterior conservado entero. `--stat` = `1 file changed, 2 insertions(+), 2 deletions(-)`.

**Los 11 offsets que escribo van cotejados UNO A UNO contra el disasm**, no importados del
documento: `MAINOUT.OVL 0x088c` · `INTRO.OVL 0x0ca3` · `FONT.OVL 0x04f0`, `FONT.OVL 0x050a` y
`FONT.OVL 0x0522` · `ULTIMA.EXE 0x5fa8`, `ULTIMA.EXE 0x5fb4` y `ULTIMA.EXE 0x6094` ·
`ULTIMA.EXE 0x4995` y `ULTIMA.EXE 0x2d91` (las dos hermanas) · `ULTIMA.EXE 0x4408`.

---

## 4. TANDA 3 — `g_party_records` (6) y `g_dng_map` (6)

Añado una columna que el pre-registro no tenía y que declaro aquí: **¿va a la ficha?** AMPLÍA
significa «el documento aporta algo que la ficha no dice»; NO significa que yo lo propague. Un
AMPLÍA leve se cuenta y no se escribe, y así la cifra sigue siendo honesta sin que el catálogo
engorde. Es la forma operativa de **candidato ≠ defecto**.

### 4.1 `g_party_records` (0x55A8) — 6 documentos, 6 AMPLÍA

| # | documento | veredicto | ¿a la ficha? |
|---|---|---|---|
| 19 | `oracle-ring-regen.md` | **AMPLÍA (fuerte)** | SÍ — mapa de campos + el mislabel corregido por oráculo |
| 20 | `kernel-sweep-4.md` | **AMPLÍA** | SÍ (corrobora el mislabel por vía independiente) |
| 21 | `sword-of-chaos.md` | **AMPLÍA** | SÍ (+0x1B / +0x1C = manos) |
| 22 | `ring-expiry-derivation.md` | **AMPLÍA** | SÍ (+0x1D anillo, +0x19..+0x1E el bloque de equipo) |
| 23 | `liston-207-t2-acta.md` | **AMPLÍA** | SÍ (+0x0A..+0x0F por consumidor, con la base derivada por DOS overlays que no se citan) |
| 24 | `sueltos-174-t4-acta.md` | **AMPLÍA** | SÍ — confirma `size` y paso por aritmética |

★★ **Lo que esta ficha tenía mal medido, y no es la semántica sino el CENSO**: su evidencia dice
«*censo: 3 refs desde 2 ficheros*» para una tabla de 512 bytes que el juego entero lee. Esas 3 son
los accesos a la BASE `0x55a8`; **todo el uso real entra por campo INTERIOR** (la familia de
#240 / #242 / #247). Sólo en estos seis documentos se citan **catorce direcciones interiores
distintas en seis overlays**. Lo dejo dicho como COTA y **no publico un censo nuevo**: medirlo bien
exige instrumento con partición declarada, y una cifra sin partición es lo que esta tarjeta existe
para no repetir.

★ **Confirmación independiente del `size`, de un tramo que no se lo proponía**: `BLCKTHRN.OVL
0x04c2`, `mov di, 0x5788` es el destino de un `repne movsw` de `cx` = 0x10 palabras — 32 B, un
registro entero — y `0x55a8 + 15 × 32 = 0x5788` es el slot 15; dos instrucciones después,
`BLCKTHRN.OVL 0x04cf`, con destino `g_party_records+511` = `0x57a7`, el ÚLTIMO byte de ese mismo
slot. Dos comprobaciones que caen solas y que sellan `size` 512 con paso 32.

### 4.2 `g_dng_map` (0x595A) — 5 AMPLÍA + **1 REDUNDANTE**, el primero limpio

| # | documento | veredicto | ¿a la ficha? |
|---|---|---|---|
| 25 | `dungeon-map-buffers.md` | **AMPLÍA (fuerte)** | no (el veredicto de búfer único ya tiene su nota; no lo dupliqué) |
| 26 | `idxrefs-240-acta.md` | **AMPLÍA (fuerte)** | SÍ — la ceguera de canal y los 4 que son de la global VECINA |
| 27 | `derivaciones-134-acta.md` | **AMPLÍA (fuerte)** | SÍ — las TRES formas de escritura |
| 28 | `derivaciones-152-acta.md` | **AMPLÍA** | SÍ — el escritor de campos mágicos |
| 29 | `lectura-244-acta.md` | **AMPLÍA (leve)** | **no** — aporta 2 cargas de base por el quinto canal, las dos reales; cierto y demasiado fino para el catálogo |
| 30 | `particion-245b-acta.md` | **REDUNDANTE** | no — §4.3 |

### 4.3 ★ EL PRIMER REDUNDANTE LIMPIO, y es exactamente la reserva de #255

`particion-245b-acta.md` toca `g_dng_map` en **UNA** línea, y de pasada: la usa como vara de medir
para OTRA cosa — «*una caída > 15 %, peor que el ~10 % de `g_dng_map`, que es el único borde medido
hasta hoy*». No dice nada de la global que la ficha no sepa; la nombra para comparar. **Con 11
menciones**, este par entra en el corte ≥10 igual que los que amplían de verdad.

Es el ejemplar que le faltaba a la reserva heredada: **«el documento toca la dirección» y «el
documento tiene algo que decir sobre la dirección» son cosas distintas**, y el corte por número de
menciones no las separa. Cuenta como REDUNDANTE, no como defecto de nadie.

### 4.4 Correcciones aplicadas y su procedencia

Dos fichas, `--stat` de **5 líneas** en total (2 en `g_party_records`, 3 en `g_dng_map`), todas
por sustitución de cadena y conservando el texto anterior entero.

**Cotejado contra el disasm ANTES de escribirlo, uno a uno**: `ULTIMA.EXE 0x4022` (los cuatro
punteros a campo) · `ULTIMA.EXE 0x69f0` y `ULTIMA.EXE 0x6a02` (los dos anillos) · `OUTSUBS.OVL
0x077c` y `OUTSUBS.OVL 0x07ed` · `BLCKTHRN.OVL 0x04c2`, `BLCKTHRN.OVL 0x04cd` y `BLCKTHRN.OVL
0x04cf` · `DUNGEON.OVL 0x1758` y `DUNGEON.OVL 0x15ca` (las dos escrituras por puntero construido) ·
`CAST.OVL 0x00af` y `CAST.OVL 0x00e6`.

★ Y con un tropiezo propio que repite el de §3.2 en pequeño: `derivaciones-152-acta` da el escritor
de campos mágicos en dos offsets **sin overlay a la vista en la tabla** (`0x00af` de lectura y `0x00e6` de escritura), y lo localicé
barriendo los 30 `.asm` por el par (offset, literal) en vez de suponer. Salió `CAST.OVL`, que no
era mi primera apuesta.

---

## 5. 🔴 RETRACTACIÓN DE MI PROPIO §2.1 — la «global sin fichar» ya estaba derivada TRES veces

En §2.1 presenté el búfer de 0xAC64 como un hallazgo que una errata mantenía tapado. **Al leer los
pares de `g_vis_buffer` se cae la parte de «tapado», y con ella la de «hallazgo».** Lo declaro aquí
entero en vez de dejarlo enterrado, porque un informe de lectura es TESTIMONIO y el mío se estaba
acreditando una novedad que no le corresponde.

Lo que encontré después, y que estaba desde antes:

1. `re/notes/globals-negdisp-adjudicacion.md` lo dice **con todas las letras**: «*`0xAC64` es un
   búfer 11 filas × stride 16 que contiene una ventana de tiles 11×11, y `0xAC74 = 0xAC64 + 16` =
   fila 1, columna 0*». O sea que **hasta el enlace con la tarjeta #61 que yo presenté como mío
   estaba escrito**.
2. `re/notes/globals-size-semantica.md` repite la misma aritmética como una de sus tres
   comprobaciones de geometría.
3. ★★ Y **el propio ledger lo lleva**: la evidencia de `g_vis_buffer` contiene «*las fronteras
   cuadran al byte, 0xAC64-0xAB02 = 354 = 11*32+2 y 0xAD14-0xAC64 = 0xB0 = 11*16*» y la carga de
   fichero de `BLCKTHRN.OVL 0x070e`. No hay ENTRADA para 0xAC64, pero descrito lo está.

**Qué sobrevive, y es bastante menos:**

- ✅ **La errata es real y es mía**: `ui-render-map.md:101` y `kernel-render-sweep.md:176` anotan
  `[-0x539c]` como «(0x5C64)» cuando la aritmética da **0xAC64**. Sigue siendo un error vivo en dos
  documentos, y sigue siendo la razón por la que esos dos pares casan en parte por un hex espurio.
- ✅ **0xAC64 no tiene entrada propia** pese a estar derivado tres veces. Eso es una pregunta
  legítima de catálogo — la misma familia que el `0x5c5f` / `g_hull` de la tanda 1 — pero es
  «¿merece entrada?», no «nadie lo ha visto».
- ❌ **Muere**: «búfer SIN FICHAR que una errata mantiene tapado» y «0xAC74 es su fila 1 y nadie lo
  había atado». Las dos eran mías y las dos eran falsas.

**Por qué me pasó, que es lo aprovechable**: leí el par 1 de 66 y tenía delante la aritmética
sin tener delante los documentos que la contienen — que estaban **en mi propia cola**, treinta
pares más abajo. La cola ordenada por menciones no está ordenada por dependencia, y un hallazgo
anunciado en el par 1 puede quedar refutado por el par 31. **Regla que me aplico para lo que
queda: antes de anunciar una dirección como no-derivada, mirar si otra ficha del ledger la
describe en su evidencia** — el vecino de al lado es el sitio más probable, y es una consulta de
diez segundos.

## 6. TANDA 4 — las 6 de `g_vis_buffer` (0xAB02), y aparece la QUINTA variante de «no citado»

| # | documento | veredicto | ¿a la ficha? |
|---|---|---|---|
| 31 | `globals-negdisp-adjudicacion.md` | **REDUNDANTE** | no — §6.1 |
| 32 | `globals-size-semantica.md` | **REDUNDANTE** | no — §6.1 |
| 33 | `derivaciones-189-acta.md` | **AMPLÍA** | SÍ — el productor con la base COMO ARGUMENTO |
| 34 | `interactions-piano-fire-audit.md` | **AMPLÍA (leve)** | no — los 4 vecinos del centro son aritmética directa del paso 32 |
| 35 | `lectura-244-acta.md` | **AMPLÍA (leve)** | no — los 4 sitios del quinto canal, ya cubiertos por la entrada vecina |
| 36 | `quinto-242-acta.md` | **AMPLÍA (leve)** | no — 5 cargas del quinto canal, y él mismo advierte que carga ≠ acceso |

**Recuento tanda 4: AMPLÍA 4 (1 sustantiva) · REDUNDANTE 2 · CONTRADICE 0 · RANCIO 0 · CITADO 0.**

### 6.1 ★★ LA QUINTA VARIANTE: el contenido YA CRUZÓ, lo que falta es la CITA

Los dos REDUNDANTE de arriba no lo son por ser menciones de pasada — al revés: son documentos que
estudiaron la dirección a fondo. Lo son porque **su contenido ya está DENTRO de la ficha, casi
palabra por palabra, sin que la ficha los nombre**. Compárese:

| `globals-size-semantica.md` | evidencia de `g_vis_buffer` en el ledger |
|---|---|
| «*Tres comprobaciones independientes de la geometría: 1. Las fronteras cuadran al byte: `0xAC64 − 0xAB02 = 354 = 11*32 + 2`*» | «*Tres comprobaciones independientes de la geometria: (1) las fronteras cuadran al byte, 0xAC64-0xAB02 = 354 = 11*32+2*» |

⇒ **una quinta variante de «par no citado», y es la más benigna de todas**: la ficha ABSORBIÓ el
documento y se dejó la atribución. Las cuatro anteriores (ruta · `#nº` de tarjeta · nombre de
carril · mención de pasada) ya estaban; ésta es nueva y **es la prueba más fuerte que ha dado esta
tarjeta de que «no cita» NO es «está mal»**: aquí el cruce OCURRIÓ, y lo único ausente es el
crédito. Un instrumento que mida citación no puede distinguirla de un hueco real, y por eso la
población de #255 sigue siendo una COTA SUPERIOR.

### 6.2 La corrección aplicada — un productor que ningún censo por literal encuentra

`derivaciones-189-acta.md` sí aporta algo que la ficha no tenía: el flood-fill `ULTIMA.EXE 0x5a28`
recibe **la base de destino como ARGUMENTO** y tiene dos llamadores con bases distintas —
`ULTIMA.EXE 0x5d5d`, con `0xab02`, y `ULTIMA.EXE 0x5f53`, con `0xad14`, cada uno con selector de
modo distinto. Verificado contra el disasm antes de escribirlo. Consecuencia práctica: **un censo
de productores de 0xAB02 que busque literales dentro del cuerpo del flood-fill no encuentra
ninguno**, porque la dirección entra por la pila. `--stat` = 1 línea.

---

## 7. TANDA 5 — los 24 restantes: 4 de `g_cbt_room_record`, 8 de fichas con 2 documentos y los 12 SUELTOS

| # | ficha ↔ documento | veredicto | ¿a la ficha? |
|---|---|---|---|
| 37 | `g_cbt_room_record` ↔ `globals-98-acta` | REDUNDANTE | no — contenido absorbido (§6.1) |
| 38 | `g_cbt_room_record` ↔ `trigger-sala-impacto-distancia` | REDUNDANTE | no — absorbido, incluida la aritmética del complemento |
| 39 | `g_cbt_room_record` ↔ `canal5-interiores-247-acta` | **AMPLÍA** | SÍ — la trampa de ensanchar a 1024 |
| 40 | `g_cbt_room_record` ↔ `combat-frame-adjudication` | REDUNDANTE | no — absorbido (el umbral 0x7f ya está) |
| 41 | `g_alive_a` ↔ `tavern-192-acta` | **AMPLÍA** | SÍ — el PRODUCTOR |
| 42 | `g_alive_a` ↔ `pool-resto-b-acta` | **AMPLÍA** | SÍ — los CONSUMIDORES |
| 43 | `g_floor` ↔ `dungeon-map-buffers` | **AMPLÍA** | SÍ — dominio 0..7 y topes duros |
| 44 | `g_floor` ↔ `dungeon` | **AMPLÍA (leve)** | (mismo material, se funde con el 43) |
| 45 | `g_gold` ↔ `falsedad-merma-tiendas` | **AMPLÍA** | no — ya adjudicado como ejemplar en #255 §3 |
| 46 | `g_gold` ↔ `consumidor-243-acta` | **REDUNDANTE** | no — §7.2 |
| 47 | `g_npc_dead_bitmap` ↔ `shadowlord-urban` | **★★ CONTRADICE** | SÍ — §7.1 |
| 48 | `g_npc_dead_bitmap` ↔ `shadowlord-ritual` | REDUNDANTE | no — misma tesis, menos detalle |
| 49 | `g_farm_harvest_day` ↔ `lote-mecanica-pendiente` | **AMPLÍA** | no |
| 50 | `g_food` ↔ `inmediato-232-acta` | **AMPLÍA** | no |
| 51 | `g_kbd_buffer_on` ↔ `oracle-input` | **AMPLÍA** | no |
| 52 | `g_moongate_anim` ↔ `catalogo-191-acta` | REDUNDANTE | no — es el acta que la fichó |
| 53 | `g_moonstone_loc` ↔ `idxrefs-240-acta` | **AMPLÍA** | SÍ — §7.3 |
| 54 | `g_npc_attack_tile` ↔ `blackthorn` | **AMPLÍA** | no |
| 55 | `g_npc_sched` ↔ `shadowlord-urban` | **AMPLÍA** | no |
| 56 | `g_rng_seed` ↔ `rng-186-acta` | **AMPLÍA** | no |
| 57 | `g_sail_dir` ↔ `transport` | **AMPLÍA** | no |
| 58 | `g_shadowlord_here_idx` ↔ `rng-186-acta` | **AMPLÍA** | no |
| 59 | `g_time_spell` ↔ `antim-freeze` | **AMPLÍA** | no |
| 60 | `g_wind` ↔ `transport` | **AMPLÍA** | no — ya adjudicado en #255 §3 |

**Recuento tanda 5: AMPLÍA 17 · CONTRADICE 1 · REDUNDANTE 6 · RANCIO 0 · CITADO 0.**

### 7.1 ★★ EL ÚNICO CONTRADICE DE LOS 60, y es una discrepancia de ETIQUETA, no de dirección

El marcado de la ciudad arrasada por un Shadowlord vive en `CAST.OVL 0x171d`, y es `or word ptr
[g_npc_dead_bitmap+112], ax`, y 112 = 28 × 4. Las dos notas de Shadowlord lo leen como
«`base 0x5B5A + 28×4`, Windemere, location 28», citando el índice de `npcs.json` del port. Pero la
ficha declara que el eje de location es **1-BASED**, con base de indexación 0x5B56: bajo esa regla
ese MISMO byte es la ranura **29**, no la 28.

Las dos lecturas **coinciden en la dirección y discrepan en la etiqueta**. Es la firma exacta del
off-by-one silencioso entre la numeración del binario y la de `npcs.json`, sobre un dato que decide
qué ciudad queda arrasada. **No lo resuelvo**: la propia ficha dice que su 1-based se apoya en
cuatro patas «y NINGUNA es un testigo», así que resolverlo por aritmética sería elegir una de las
dos convenciones a dedo. Queda DECLARADO en la ficha y propuesto como cabo.

★ Y en la dirección contraria, el mismo documento aporta una **QUINTA pata** para el 1-based, desde
un tercer overlay y sobre la global VECINA: escriben `TALK.OVL 0x0d6c` con `TALK.OVL 0x0d70`, y
leen `TALK.OVL 0x0d9e` con `TALK.OVL 0x0da2`, todos con base 0x5BD6, que es `g_npc_met_bitmap` (0x5BDA)
menos 4. Verificado contra el disasm. El patrón base-menos-4 aparece en tres overlays y en las dos
globales de la banda — sigue sin ser testigo, y por tanto sigue sin cerrar nada.

### 7.2 El segundo REDUNDANTE de mención de pasada, y el más nítido

`consumidor-243-acta` toca `g_gold` diez veces, y las diez usan `sub [g_gold]` como **ejemplar de
una CONVENCIÓN DE CITACIÓN** — le da igual el oro; le importa cómo se escribe la cita. Un
documento puede nombrar una dirección muchas veces sin decir nada de ella.

### 7.3 La rectificación que sí merecía entrar: una cifra sin su ventana no significa nada

`idxrefs-240-acta` publicó «0x5840: **793 desnudos / 24 indexados**» y **se retractó en el mismo
documento**: la ventana eran 64 bytes inventados, no los 8 que declara la ficha. Con la extensión
real: **0 desnudos y 7 indexados**, los siete legítimos. Los 789 restantes eran de las globales de
al lado. Va a la ficha porque es el ejemplar limpio de que **una cifra de accesos no significa nada
sin la EXTENSIÓN contra la que se midió**, y esta entrada mide 8 B en una banda densa.

---

## 8. CIERRE — los 60 adjudicados, la predicción ADJUDICADA (y FALLADA), y lo que queda

### 8.1 El recuento final, con el corte pegado

**CORTE ≥ 10 menciones, canales A+B. Población 60** (66 menos las 6 ya cerradas, §1).

| veredicto | pares | % |
|---|---|---|
| **AMPLÍA** | **48** | 80 % |
| **REDUNDANTE** | **10** | 17 % |
| **CONTRADICE** | **1** | 2 % |
| **CITADO** (falso hueco hallado leyendo) | **1** | 2 % |
| **RANCIO** | **0** | 0 % |

### 8.2 ★ MI PREDICCIÓN, ADJUDICADA — y FALLA en dos de las cinco celdas

| celda | pre-registrado (§0.3) | real | veredicto |
|---|---|---|---|
| AMPLÍA | 18-40 | **48** | ❌ **FALLA**, por arriba |
| REDUNDANTE | 15-38 | **10** | ❌ **FALLA**, por abajo |
| CONTRADICE | 1-6 | 1 | ✅ (en el borde inferior) |
| RANCIO | 0-5 | 0 | ✅ |
| CITADO | 0-6 | 1 | ✅ |
| fichas corregidas | 4-13 | **10** | ✅ |

**Falla, y en la dirección que yo mismo había razonado mal.** Pre-registré una banda ancha de
REDUNDANTE porque esperaba que los barridos transversales (`kernel-render-sweep`,
`catalogo-191-acta`, `derivaciones-152-acta`) tocasen las direcciones de pasada. Los leí: **los
tres AMPLÍAN**. Un barrido transversal que mide algo de verdad aporta sobre cada dirección que
toca; el que no aporta nada es el que la usa de EJEMPLO (`consumidor-243-acta`) o de VARA DE MEDIR
(`particion-245b-acta`), y ésos son pocos.

★ **La condición de fracaso explícita NO se disparó** (escribí «si AMPLÍA > 50, sospecho de mí», y
salió 48), y aun así **la banda está fallada**. Lo digo entero en vez de escudarme en el umbral:
una predicción se adjudica contra la banda que se registró, no contra el salvavidas.

### 8.3 Lo que esta tarjeta establece, y lo que NO

**Establece**, sobre la cabeza del corte ≥10 y sólo sobre ella:
- Que en esta cabeza **el hueco de citación es real pero casi nunca es un defecto**: 48 de 60 pares
  aportan algo, y sólo **1** choca con la ficha.
- Que la población de #255 es **COTA SUPERIOR por CINCO vías de citación distintas** — ruta ·
  `#nº` de tarjeta · nombre de carril · mención de pasada · **contenido absorbido sin cita** (§6.1).
  Las tres últimas no las veía ningún instrumento previo.
- **10 fichas corregidas** con procedencia 3/3 y con los offsets cotejados uno a uno contra el
  disasm: `g_char_anim_states` · `g_location` · `g_party_records` · `g_dng_map` · `g_vis_buffer` ·
  `g_cbt_room_record` · `g_alive_a` · `g_floor` · `g_npc_dead_bitmap` · `g_moonstone_loc`.

**NO establece:**
- Nada sobre los **349 pares restantes del corte ≥3**, ni sobre los 1476 del corte ≥1. La cabeza es
  la zona MÁS tocada del ledger y no tiene por qué parecerse a la cola.
- **Ninguna proporción de esta acta es exportable a otro corte.** 80 % de AMPLÍA es un dato de la
  cabeza, con su corte pegado, y punto.
- El **canal C** (2308 pares, hex desnudo) sigue sin entrar y sigue siendo cota.
- Los **12 AMPLÍA contados y NO escritos** (§4, columna «¿a la ficha?») son cola servida, no deuda
  saldada: quien los quiera en el catálogo tiene la lista en las tablas de §4, §6 y §7.

### 8.4 Cabos que propongo (ninguno tocado aquí)

1. **La etiqueta 28-vs-29 de la ciudad arrasada** (§7.1) — pide testigo, no aritmética.
2. **La errata `[-0x539c]` → «0x5C64»** en `ui-render-map.md:101` y `kernel-render-sweep.md:176`:
   el valor real es 0xAC64, y el error está propagado en dos documentos (residuo REAL de §5, ya
   re-encuadrado; es lo único que sobrevive de mi §2.1).
3. **¿Merecen entrada propia** 0xAC64 (176 B, derivado tres veces) y 0x5C5F (el `g_hull` del port)?
   Son la misma pregunta de catálogo, y la decisión es del lead.

---

## 9. ADENDA — el **RANCIO = 0** re-probado contra main de HOY, y por qué la celda salió vacía

El lead avisó dos veces, para las zonas densas (`g_dng_map`, `g_vis_buffer`,
`g_cbt_room_record`), de que un documento que cite cifras anteriores a un cierre reciente es
**candidato a RANCIO legítimo, no a contradicción**, y de que hay que cotejar contra la ficha
ACTUAL. Mi RANCIO = 0 se midió contra las fichas de **mi base** (`f6979e86`, 200 entradas) y main
va ya por 214. Una cifra de censo sin SHA es una FOTO, así que la re-mido en vez de defenderla.

### 9.1 Primero, lo que NO cambió: las fichas

De las 22 fichas que toqué o leí, **5 difieren entre mi base y main de hoy** — y las cinco son
**mis propias ediciones ya aterrizadas** (tandas 1-4). Ningún tercero movió ninguna. Luego mis
veredictos no se midieron contra prosa caducada por otro carril.

### 9.2 La prueba de verdad: ¿algún DOCUMENTO afirma una cifra ya superada?

Barrí los 60 documentos buscando cifras que cierres posteriores dejaron atrás — el `size` 121 de
`g_vis_buffer` (→ 352 en #68), el «793 desnudos / 24 indexados» de 0x5840 (→ 0/7), el «7 refs desde
3 ficheros» de 0x5C5A (→ 172 en #251) y las afirmaciones de ausencia del tipo «nadie lo toca».

**20 ocurrencias. Y las 20 son FALSOS POSITIVOS**, por tres razones y ninguna casual:

| ocurrencia | por qué NO es rancia |
|---|---|
| `idxrefs-240-acta` con el «793 / 24» (×2) | aparece porque **el documento se está retractando**: «*Es falso. Usé una ventana de 64 B*» |
| `idxrefs-240-acta` y `shadowlord-urban` con «nadie lo toca» / «nadie LEE» (×4) | están **entrecomilladas como la tesis que se refuta**, no afirmadas |
| `globals-negdisp-adjudicacion` y `globals-size-semantica` con el 121 (×5) | son **los documentos que DERIVAN el cambio** 121→352; son la fuente de #68, no arrastran su estado viejo |
| `derivaciones-189-acta` «121 celdas, 11 filas × 11 B» | **es correcto hoy**: 121 son las CELDAS ÚTILES, y la ficha actual lo dice igual («OCUPADO 331 B») |

### 9.3 ★★ Lo que esto establece, y es un resultado, no un alivio

**El RANCIO = 0 sobrevive**, y ahora se sabe POR QUÉ, que es lo que faltaba: **en este corpus las
cifras superadas viven casi siempre dentro de su propia retractación, o dentro de la derivación que
las supera**. El número viejo y su refutación comparten fichero.

⇒ **Un detector de RANCIO que pregunte «¿contiene el documento la cifra vieja?» habría marcado 20
casos y se habría equivocado en los 20** — precisión 0/20. Cualquier detector futuro de esta celda
tiene que exigir que la cifra caduca esté **AFIRMADA**, no citada-para-refutarla ni derivada-para-
sustituirla; y distinguir esas tres cosas es análisis de POLARIDAD, no búsqueda de texto.

Es la familia del bucket demasiado ancho y la del control negativo que no valida un guarda: la
celda vacía sólo vale algo cuando se enseña que el instrumento sabía llenarla. **Aquí se enseña al
revés y sirve igual**: el instrumento ingenuo la habría llenado con 20 falsos, y por eso el 0
medido a mano es la cifra buena.

### 9.4 Reserva que sigue en pie

Esto NO dice que no haya documentos rancios en el repo. Dice que **en estos 60 pares, con el corte
≥10 pegado, no hay ninguno**, y que la vía barata de buscarlos por la cifra vieja no funciona.
