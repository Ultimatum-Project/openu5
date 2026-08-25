# ACTA shop-saludo — el SELECTOR de variante del saludo de tienda (ficha F4-g)

**Veredicto: FALSO.** No hay sapo. El port elige la variante con **exactamente el mismo
criterio que el binario** — `rand(0,3)` uniforme del stream VIVO, **por visita** — y la
premisa de la ficha F4-g («la de `sanctum` es la que grabó el LP, la de `solace` es la que
emite el port») **es falsa como enunciado**: el LP grabó **las cuatro**, y grabó a la
MISMA curandera con dos variantes distintas **dentro de una misma parte**.

Encargo: adjudicar F4-g de `anclas-f4-acta.md` §6.3-bis/§7 contra el binario.
Criterio madre aplicado: manda el binario; el testigo LP dice qué salió **en su run**.

---

## §1 — EL SELECTOR, DERIVADO DEL ASM

Emisor único: **`SHOPPES.OVL` 0x01b6** (`re/disasm/SHOPPES.OVL.asm:201-216`):

```
01b6: 56                push si
01b7: b82200            mov ax, 0x22            ; '"'
01ba: 50                push ax
01bb: e86c72            call 0x742a             ; putchar — comilla de apertura
01be: 2bc0              sub ax, ax              ; lo = 0
01c0: 50                push ax
01c1: b80300            mov ax, 3               ; hi = 3
01c4: 50                push ax
01c5: e83a7c            call 0x7e02             ; kernel rand_range(0,3)  ← EL SELECTOR
01c8: 8bf0              mov si, ax
01ca: d1e6              shl si, 1               ; variante ×2 (word)
01cc: 8b1e16b1          mov bx, word ptr [0xb116]   ; TIPO de tienda
01d0: b103              mov cl, 3
01d2: d3e3              shl bx, cl              ; ×8 = 4 word-ptrs por fila
01d4: ffb02a3b          push word ptr [bx + si + 0x3b2a]  ; tabla 2D [tipo][variante]
01d8: e89fff            call 0x17a              ; carga el registro de SHOPPE.DAT y lo imprime
```

**El único dato que entra en la variante es el rand.** No hay hora, ni ciudad, ni contador
de visitas, ni identidad del tendero en el camino:

- `[0xb116]` = **tipo** de tienda, y elige la **FILA**, no la columna. Lo escribe
  `re/disasm/TALK.OVL.asm:127-130` (`0x0122: mov ax,[bp+4] / sub ax,0x81` →
  `0x0125: mov [0xb116],ax`): es el código de comando menos 0x81. Nada más lo toca.
- `0x7e02` es el `rand_range(lo,hi)` del kernel (= CS 0x2092), **stream vivo**, inclusive
  en ambos extremos. El orden de pushes es el mismo patrón que el `rand(1,64)` de la merma
  post-compra (`SHOPPES.OVL.asm:0x019a-0x01ad`, `push 1 / push 0x40`), ya adjudicado en
  `shops.md` §0.3 ⇒ aquí es `(lo=0, hi=3)`: **4 variantes, uniforme**.
- La hora **sí** existe en el flujo, pero **aguas abajo y en otra cosa**: es el `@` de la
  plantilla (parte del día), que resuelve el expansor en `SHOPPES` 0x00d8-0x00fa sobre
  `g_hour`. Elige *palabra*, no *plantilla*.

### §1.1 — Es la rutina VIVA, y es la ÚNICA (control de overlay)

La memoria del proyecto avisa de las tablas duplicadas de DATA.OVL y de los kernels
por-call-site, así que se censó el consumidor de la tabla en **los 28 overlays**:

```
$ grep -n "0x3b2a" re/disasm/*.asm
re/disasm/SHOPPES.OVL.asm:215:01d4: ffb02a3b   push word ptr [bx + si + 0x3b2a]
```

**Un solo sitio.** No hay rutina de saludo duplicada en `SHOPPES2`/`SHOPPES3`: esos
overlays **llaman a ésta** por el stub del kernel. Verificado el rebase:

| llamador | overlay | tipo | resolución |
|---|---|---|---|
| `SHOPPES.OVL:0x04b1` | — | GuildMaster | `call 0x1b6` near, directo |
| `SHOPPES.OVL:0x076d` | — | MagicSeller | `call 0x1b6` near, directo |
| `SHOPPES.OVL:0x08be` | — | HorseSeller | `call 0x1b6` near, directo |
| `SHOPPES.OVL:0x14ff` | — | Healer | `call 0x1b6` near, directo |
| `SHOPPES2.OVL:0x0685` | Barkeeper | `call 0xffff9e06` | (0x9e06 + 0xE1E0) & 0xFFFF = **0x7FE6** |
| `SHOPPES2.OVL:0x0ace` | Shipwright | `call 0xffff9e06` | ídem |
| `SHOPPES3.OVL:0x08eb` | InnKeeper | `call 0xffff9e06` | ídem |

y el stub `ULTIMA.EXE.asm:13491-13493`:

```
7fe6: 9aec022e07        lcall 0x72e, 0x2ec      ; cargador de overlay
7fed: ea46a40000        ljmp 0:0xa446
```

`0xa446` = `SHOPPES.OVL:0x01b6` rebasado (`0x01b6 + 0xA290`). **Confirmado**: los 7 tipos
de tienda con fila en la tabla pasan por el MISMO `rand(0,3)`. El **herrero** no: su fila
está a cero y saluda por vía propia (`SHOPPES` 0x12b2), ya derivada en
`shoppe-greetings.ts`.

---

## §2 — EL PORT: mismo criterio, misma aridad, mismo stream

`game/src/ui/shop-console.ts:401`

```ts
const template = pool[indices[this.game.shopGreetingRand(0, 3)]!];
```

con `indices = SHOPPE_GREETING_INDEX[this.type]` (la fila de la tabla DS 0x3b2a) y

- `game/src/core/game.ts:3939-3941` — `shopGreetingRand(lo,hi) { return this.rand(lo,hi); }`
- `game/src/core/game.ts:634` — `rand = (lo,hi) => this.liveRng.next(lo,hi)`
- `game/src/core/game.ts:632` — `liveRng = new OriginalRng(0)`, el generador
  add/rotate/xor del kernel bit a bit (`game/src/core/rng-original.ts:60-86`), con
  `next(lo,hi) = lo + ((raw & 0x7fff) % (hi-lo+1))` — inclusive, uniforme sobre 4.

Es decir: **una tirada, `(0,3)`, del stream vivo, indexando la fila del tipo**. Calcado.
Y el orden respecto al resto del flujo también: en el ESTABLO el escaneo de hueco va
ANTES del saludo (ASM 0x07cb precede a 0x08be; port `shop-console.ts:335`), así que sin
sitio no hay saludo **ni rand** — la cadencia del stream se respeta.

---

## §3 — EL CONTROL QUE ADJUDICA: el propio corpus del LP usa LAS CUATRO

Sonda commiteada: **`re/tools/censo_saludos_tienda.py`** (~90 s sobre las 87 432 líneas
de `routes-ad` + `routes`). Adjudica cada línea del LP contra las 28 plantillas de saludo
(7 tipos × 4) por parecido sobre los tramos literales, con criba previa de 8-gramas.
Colapsa por `(parte, ocrLn)` y reporta aparte la banda dudosa 0.72-0.80.

```
SALUDOS DE TIENDA adjudicados (>= 0.8): 98
  banda dudosa 0.72-0.8 (NO cuentan): 43

  Barkeeper    10 saludo(s), variantes [0, 2, 3]
  HorseSeller   1 saludo(s), variantes [0]
  Shipwright    4 saludo(s), variantes [0, 1]
  MagicSeller  22 saludo(s), variantes [0, 1, 2, 3]
  GuildMaster  14 saludo(s), variantes [0, 1, 2, 3]
  Healer       28 saludo(s), variantes [0, 1, 2, 3]
  InnKeeper    19 saludo(s), variantes [0, 1, 2, 3]
```

⚠️ **El 98 es una cota superior, no un censo de saludos**: incluye líneas de
CONTINUACIÓN del mismo saludo (`ad01` 3064 abre y 3070 remata) y algún falso positivo de
la clase «otra frase del juego que se parece» (`ad11` 82 «run the Poor House»). **La cifra
que adjudica no es el total** — son los pares mismo-tendero de abajo, todos ellos líneas
de apertura (`Talk-…`) con el nombre del tendero dentro y parecido ≥ 0.86.

### §3.1 — ★★ MISMO TENDERO, VARIANTE DISTINTA, **DENTRO DE LA MISMA PARTE**

**Regina** (curandera de Minoc, «The Healers Mission») saluda 7 veces adjudicadas:

| parte:ocrLn | var | texto del LP |
|---|---|---|
| `ad04`:1198 | **0** | `Talk-East "I bid thee welcome in our Sunvtum, wanderer. I am Regina, dost` |
| `ad04`:3488 | **3** | `Talk-South "Fair morning, adventurer. I, Regina, do bid thee welcome unto The ` |
| `ad06`:4993 | **3** | `Talk-South "Fair afternoon adventurer. I, Regina, do bid thee welcome unto The` |
| `ad06`:5243 | **0** | `Talk-South "I bid thee welcome in our Sunvtum, wanderer. I am Regina, dost` |
| `ad10`:3660 | 3 | `Talk-South "Fair morning, adventurer. I, Regina, do bid thee welcome unto The ` |
| `ad19`:807 | 0 | `sanctum, wanderer. I am Regina, dost thou need the help of T` |
| `part03`:726 | 3 | `"Fair afternoon adventurer. I, Regina, do bid thee welcome unto The Healer Mis` |

**`ad04` cambia de variante consigo misma. `ad06` también.** Dos flips independientes,
mismo tendero, misma tienda, misma parte del LP. Y `ad06` 4993→5243 descarta además la
hipótesis «lo elige la hora»: van de `afternoon`+var3 a var0 en el mismo tramo.

Réplica en otro tipo de tienda: **Nilrem** (MagicSeller, The Herbalist) en `ad04` — ln4617
var3 y ln4790 var0. Otra vez dentro de una parte.

De los 13 tenderos con ≥2 saludos adjudicados, **11 cambian de variante**. Los 2 que no
(Donya, Madam Pendra) tienen 2 muestras cada uno: a 1/4 por tirada, repetir es lo esperado
en 1 de cada 4 pares.

⇒ **En el ORIGINAL la variante es una tirada por visita.** Es exactamente lo que dice el
ASM, y cierra de paso el «objetivo #3» que `shoppe-greetings-witness.md` dejó abierto el
22-07 por falta de material («NINGÚN tendero saluda dos veces» en los walkthroughs): el
corpus del espejo **sí** lo tiene, siete veces sólo con Regina.

### §3.2 — El bloque concreto de F4-g

`ad07` ln84 (Cove, Jessica): el LP grabó `Talk-East "I bid thee welcome in our Sunvtum,
wanderer. I am Jessica, dost` = **variante 0** (shoppe.json[165]). El port emitió la
variante 3 (`anclas-f4-acta.md` §6.3, medición del lead). **Una tirada distinta de un
dado de 4 caras.** No hay criterio que reconciliar porque el criterio ya es el mismo.

---

## §4 — CONSECUENCIA PARA LA MEDICIÓN (esto sí es accionable)

El saludo de tienda es **estructuralmente no-adjudicable por el espejo**: con el port
perfectamente calcado, la probabilidad de que su tirada coincida con la del LP es **1/4**.
Cada bloque de saludo del LP tiene por tanto un prior de **3/4 de salir `divergent` por
construcción**, y ningún fix lo mejora — sólo lo haría clavar la variante, que es
justamente romper la fidelidad.

⇒ **Los bloques de saludo de tienda no deben contar como señal de conformidad** en las
cifras del espejo, ni su `divergent` leerse como defecto. Es la misma clase de material
que F4-f (churn del comparador): ruido con nombre, no deuda. Si el lead quiere una cifra
de tienda comparable entre shas, la vía es excluir el beat del saludo del denominador, no
perseguirlo.

**Los 6 bloques `covered`→`divergent` de material de tienda** que la ficha F4-g arrastra
(`anclas-f4-acta.md` §6.5: continuación del shipwright, lista del herrero, cierre del
regateo) **no se adjudican aquí**: son otro material (pitches y listas, no saludos) y su
pérdida de casado la explica F4-f. Quedan donde estaban.

---

## §5 — LO QUE SE DEJA CLAVADO EN TESTS

`game/tests/shop-saludo-selector.test.ts` (6 tests, nuevo). `shoppe-greetings.test.ts` ya
fijaba la FORMA de la tabla (7×4) pero **nada fijaba el selector**, que es justo el sujeto
de F4-g. Se pinchan contra el ASM: la variante ES el rand; las 4 son alcanzables y
distintas; **una sola** tirada y es `(0,3)`; la hora no entra; el tipo elige la fila; y dos
visitas del mismo tendero pueden diferir.

**Mutante (dientes medidos)** — se aplicó al port el «arreglo» ingenuo que esta ficha
invitaba a hacer (clavar `indices[0]` para casar con el LP, consumiendo igual el rand):

| suite | con el mutante |
|---|---|
| `shoppe-greetings.test.ts` (la que existía) | **8/8 VERDE** — ciega al defecto |
| `shop-saludo-selector.test.ts` (nueva) | **4 de 6 ROJOS** |

Revertido el mutante y re-verificado verde. Ese contraste **es** el valor del fichero: el
hueco existía y ahora está tapado.

---

## §6 — LO QUE NO SE MIDIÓ

- **No se corrió el espejo** (instrucción del encargo; F4-f manda: el churn del comparador
  contamina deltas). La emisión del port en `ad07` se toma de la medición del lead en
  `anclas-f4-acta.md` §6.3, no de una corrida propia.
- **La CADENCIA del stream no se adjudica.** Que el selector sea el mismo no dice que el
  port llegue a la tienda con la misma semilla ni tras el mismo número de tiradas que el
  original — eso es otra ventana (y no lo puede decidir el LP). Aquí sólo se afirma que la
  **regla de elección** es idéntica.
- La sonda del §3 tiene **43 líneas en banda dudosa** que no se auditaron una a una; se
  listan en su salida. Ninguna de ellas sostiene ninguna afirmación de esta acta. Ojo con
  una clase concreta que aparece ahí: el welcome del HERRERO («Good morning, and welcome
  to Iolo's Bows!») roza a 0.727 la variante 0 del gremio. Es coherente con la derivación
  (el herrero tiene texto propio, no pool) y por eso queda excluido, pero explica el grueso
  de la banda.
- `HorseSeller` tiene **1 sola** muestra adjudicada y `Shipwright` **4**: para esos dos
  tipos el corpus no dice nada sobre reparto de variantes. No se extrapola.
