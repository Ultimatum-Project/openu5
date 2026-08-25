# ACTA #264 — la CABEZA del cruce #255 leída par a par: amplía / contradice / redundante / rancio

> Rama `re/consumidor-243`, worktree `.claude/worktrees/consumidor-243`, base **main `ee9f1f5e`**.
> Cola de #255 (`re/notes/cruce-255-acta.md`, en main `ee9f1f5e`). Aquí SÍ se adjudica: #255 midió,
> #264 lee.

---

## 0. PRE-REGISTRO (escrito ANTES de leer un solo par)

### 0.1 EL CORTE, declarado con la cifra (la lección de #255)

En #255 pre-registré una cifra de fichas **sin registrar el corte** y la predicción quedó NO
ADJUDICABLE. Aquí van los dos, juntos y antes de mirar:

**CORTE: ≥ 10 menciones, canales A+B. POBLACIÓN: 66 pares sobre 23 fichas.** Es la cabeza que
propuse y que el lead aprobó. Toda proporción de esta acta se publica CON ese corte pegado.

### 0.2 LA TAXONOMÍA, cerrada antes de aplicarla

| veredicto | criterio |
|---|---|
| **AMPLÍA** | el documento aporta sobre esa dirección algo que la ficha NO dice (un consumidor, una extensión, una codificación de valores, un productor, una geometría) |
| **CONTRADICE** | el documento afirma algo incompatible con la ficha, o declara explícitamente que la ficha está incompleta o equivocada |
| **REDUNDANTE** | el documento usa la dirección pero no añade nada que la ficha no tenga ya |
| **RANCIO** | el documento habla de un estado del repo que ya no existe (dato caducado) ⇒ no se cruza, se declara |

### 0.3 PREDICCIÓN PRE-REGISTRADA (cifra Y corte)

Sobre los **66 pares del corte ≥10**:

- **AMPLÍA: 25-45** · **CONTRADICE: 2-8** · **REDUNDANTE: 15-35** · **RANCIO: 0-4**
- **Fichas que acaban corregidas: entre 8 y 16** (de 23).

Razonamiento auditable: la mayoría de los documentos de la cabeza son ACTAS de otras tarjetas que
estudiaron esa dirección a fondo (lectura-244, globals-98, idxrefs-240, particion-245b…), y una
acta que mide algo nuevo casi por definición amplía. CONTRADICE debería ser escaso: hace falta
que el documento choque, no sólo que añada.

**CONDICIONES DE FRACASO, escritas antes de leer:**
- Si **CONTRADICE = 0**, no firmo «el caso 0xAD14 era único» sin re-verificar a mano que ese par
  sigue leyéndose como contradicción — si mi propio criterio no marca el positivo vivo que me da
  la tarjeta, el criterio está roto, no el corpus.
- Si **AMPLÍA > 55** (83 % del corte), sospecho de mí: estaría llamando «amplía» a cualquier
  detalle que la ficha no repita, y el acta tendría que enseñar por qué eso es amplificación.

### 0.4 ★ PROCEDENCIA OBLIGATORIA antes de escribir una sola cita (encargo del lead)

Patrón de la mini-adenda de `lectura-244`: allí una cita FABRICADA casi entra por saltarse esto.
Para cada documento que yo añada a un `evidence`, verifico **las tres**, y lo dejo dicho:

1. el documento **EXISTE** en la ruta que voy a escribir;
2. **toca esa dirección** (por símbolo o por hex dentro del rango);
3. **dice LITERALMENTE** lo que yo afirmo que dice — con la frase a la vista, no de memoria.

Sin las tres, el par se declara y **no** se corrige.

### 0.5 TÉCNICA DE CORRECCIÓN

Quirúrgica: el `evidence` anterior **se conserva entero** y lo mío se **añade** detrás; nunca
reescribo lo que había. El `--stat` del commit debe enseñar sólo mis líneas.

### 0.6 RESERVAS HEREDADAS de #255, que siguen vivas

- **«No cita» NO es «está mal».** Esta acta SE PROPONE adjudicar 66 pares (lo que acabó
  adjudicando está en §3); los **349 restantes** del corte ≥3 siguen SIN LEER.
- La población **depende enteramente del corte** (≥1: 1536 · ≥3: 533 · ≥5: 239 · ≥10: 66).
- El **canal C** (hex desnudo, 2308 pares) sigue siendo COTA y no entra.
- 0xAD14 es el **primer par obligado**: cerrar el caso que parió la tarjeta.

---

## 1. ★★ HALLAZGO QUE CORRIGE A #255: el ledger cita por NÚMERO DE TARJETA, no por ruta

Salió leyendo el primer par obligado, y es un defecto de MI instrumento de #255, no del ledger.
El `evidence` de 0xAD14 dice literalmente:

> `★ #248, uso de gema: driver DNGLOOK.OVL 0x06a8`, con las colas X `0xa528` / Y `0xa628`

Eso **es** una cita del documento `re/notes/dnglook-248-acta.md` — por el NÚMERO de la tarjeta.
Mi `cita()` de #255 sólo casaba rutas, basenames y carpetas ⇒ **era ciego a esta convención**.

**Medido sobre los 66 del corte ≥10** (extrayendo el nº del NOMBRE del documento y buscando
`#nº` en la ficha):

| | pares |
|---|---|
| **CITADO POR Nº DE TARJETA** (falso «no citado» de #255) | **4** |
| NO citado por ninguna vía | 26 |
| el documento no lleva nº de tarjeta en el nombre (no aplica) | 36 |

Los cuatro: `g_cbt_room_record` ↔ dnglook-248 (#248) · `g_char_anim_states` ↔ lote-251-252
(#251) · `g_char_anim_states` ↔ idxrefs-240 (#240) · `g_vis_tile_south` ↔ old-names-75 (#75).

⇒ **La cifra de #255 es una COTA SUPERIOR**: 4 de 66 en la cabeza (6 %) eran falsos positivos.
No re-mido los 415 aquí (sería re-abrir #255), pero **queda declarado que su población está
inflada en una fracción de este orden**, y que cualquier consumidor debe leerla así.

---

## 2. EL PAR OBLIGADO — 0xAD14, adjudicado y CERRADO

| documento | veredicto |
|---|---|
| `re/notes/dnglook-248-acta.md` | **CITADO POR Nº** (`★ #248` ×2 en el evidence) ⇒ no era hueco |
| `re/notes/lectura-244-acta.md` | ★ **CONTRADICE + AMPLÍA**, y no estaba cruzado por ninguna vía |

**Procedencia verificada, las tres (§0.4), antes de escribir nada:**
1. **EXISTE**: `re/notes/lectura-244-acta.md`.
2. **TOCA la dirección**: su §3.2 se titula literalmente «`0xAD14` (#219) — 9 sitios».
3. **DICE LITERALMENTE** (§4.2 punto 2): «*La ficha del ledger de `g_cbt_room_record` atribuye
   la carga a `DUNGEON.OVL` y el segundo uso a `ULTIMA.EXE:0x5e4a`; `DNGLOOK` no aparece.*»

★ **Y el matiz que impide exagerar**: esa queja concreta **ya está remediada** — #248 metió el
contenido de `DNGLOOK` en el `evidence`. Lo que seguía ausente, y he verificado token a token
que no estaba (`COTA`, `interior`, `sexto`, `12` los cuatro ausentes del `evidence`), es la otra
mitad de lo que #244 mide: **las 9 cargas son una COTA de cargas DE LA BASE; hay 12 cargas más
de bytes INTERIORES y 12 del sexto canal**.

Nota de proceso que cierra el círculo: `lectura-244-acta` termina diciendo «*No he editado
`re/ledger/globals.json`: la corrección de una tarjeta cerrada la decide el lead*». El lead la ha
decidido en este encargo; la corrección la aplico aquí.

**CORREGIDO** en `re/ledger/globals.json`, entrada `g_cbt_room_record`, técnica quirúrgica: el
`evidence` anterior se conserva ENTERO y lo mío se añade detrás. `--stat` = **1 línea** (retiré
un salto de línea final que mi round-trip había añadido, para que el diff no llevase nada mío
que no fuera la cita).

---

## 3. HASTA DÓNDE HE LLEGADO — y lo que queda SERVIDO

**Adjudicados: 2 de 66** (los dos del par obligado) + **66 de 66 clasificados** por la vía de
cita-por-número (§1, mecánica).

**NO adjudicados: 64 pares.** No los he leído y **no los presento como nada**. El contexto de
este carril se ha consumido en #243 + F9 + #255 + esta cabeza, y prefiero entregar 2 pares
leídos de verdad y un hallazgo que corrige la medida anterior, antes que 64 veredictos de
lectura superficial — que es exactamente el testimonio de baja calidad contra el que el repo
tiene reglas.

**Mi predicción de §0.3 queda SIN ADJUDICAR por cobertura insuficiente** (2 de 66), y lo digo
antes de que la cifra parezca un resultado. No es «no adjudicable por criterio» como en #255:
es «no medida», que es distinto y peor de esconder.

### COLA SERVIDA para el relevo (material listo, sin re-derivar)

- La lista de los 66 pares con ficha · documento · canal · menciones está reproducible con el
  script del scratchpad; el corte y la partición están en §0.1 y en `cruce-255-acta.md`.
- **Los 4 de cita-por-número (§1) ya están resueltos**: no hay que leerlos.
- **Quedan 62** para leer, y la prioridad natural es por menciones: `g_char_anim_states` (14
  docs, el más tocado del ledger), `g_vis_buffer` (6), `g_party_records` (6), `g_dng_map` (6),
  `g_location` (7).
- **Regla de oro para quien siga**, aprendida aquí: antes de marcar un par como hueco,
  comprobar si la ficha cita por **`#nº de tarjeta`** — si no, se acusa en falso.

---

## 4. RESERVAS (heredadas de #255 y vivas)

- «No cita» **NO** es «está mal».
- La población depende **enteramente del corte** (≥1: 1536 · ≥3: 533 · ≥5: 239 · ≥10: 66), y
  ahora además **está inflada** por la vía de cita-por-número (§1).
- Los **349** pares restantes del corte ≥3 siguen sin leer, y los **62** de esta cabeza también.
- El canal C (2308) sigue siendo COTA y no entra.
