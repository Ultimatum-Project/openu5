# #147 — Censo de FABRICACIÓN: mensajes del port sin fuente en el juego

Instrumento: `re/tools/detect_fabricated_strings.mjs` (re-ejecutable, sin e2e).
Origen: el careo de `'\nEnjoy!"'` (carril enjoy-146) destapó que `"Here thou art!"` se usa
como éxito genérico en tres tiendas y **no existe en ninguna fuente del juego**.

## 1. Construcción

**Numerador** — el extractor PROPIO del proyecto (`game/tools/extract-user-strings.mjs`),
el mismo que alimentan la guarda y el manifiesto: **848** strings user-facing. Hereda sus
límites declarados (sin indirección cross-módulo, sin construcción dinámica) y el punto
ciego de #132 (`t("…")`). Aquí esos límites juegan A FAVOR: menos numerador, menos falsos
positivos.

**Denominador** — una frase EXISTE si aparece en cualquiera de:
- **28 411** tiras imprimibles de TODO fichero de `original/u5/ultima5/` (DATA.OVL, los
  .OVL, ULTIMA.EXE, .DAT, .TLK…);
- **78 713** strings de `game/assets/**/*.json` (TLK decodificado, shoppe, look2, signs,
  endgame, story…).
Los `.TLK` van comprimidos por sustitución de palabras, así que la vía (a) NO los cubre de
verdad: la (b) no es un lujo, es la que hace legible el diálogo.

## 2. ★ La calibración: los DOS errores, medidos

El barrido pasó por dos versiones equivocadas antes de la buena, y las dos se detectaron
con casos concretos, no por intuición:

1. **Comilla pegada.** Con las comillas dentro de la comparación, `"pride` (con la `"`
   pegada) no casa `pride`, y frases que **sí** están en los binarios —verificado a mano:
   `Pride is a vice`, `In the bookshelf`, `thou dost find`— caían como fabricación.
   Inflaba el censo de 98 a 139.
2. **Puntuación disuelta.** Al pasarme al otro extremo (puntuación = separador),
   `"Here thou art!"` quedó **absorbida** por la línea del TLK `"Here thou art... "` — y el
   control positivo pre-registrado FALLÓ.

★ El fallo del control fue el hallazgo, no un estorbo: dice que **«fabricada» no es una
propiedad binaria del string sino de la política de puntuación**. `Here thou art!` no
existe byte a byte, pero su FRASE sí (otro flujo, otro texto). Por eso el instrumento
corre **las dos políticas** y reporta la INTERSECCIÓN.

**Controles finales (los dos deben pasar, y son opuestos a propósito):**
- ESTRICTA: `Here thou art!` debe SALIR (no existe byte a byte). ✔
- LAXA: la misma frase debe quedar ABSORBIDA por el TLK. ✔
Un control que pasara en las dos no discriminaría nada.

## 3. Resultado

| política | clase A (sin fuente ni parcial) | clase B (existe un original reconocible) |
|---|---|---|
| ESTRICTA (la puntuación cuenta) | 78 | 38 |
| LAXA (puntuación = separador)   | 68 | 30 |

**★ ROBUSTOS = 68** — clase A bajo AMBAS políticas: ausentes se mire como se mire.
La clase B es casi toda PLANTILLAS (`{}` parte la comparación) y **no** es hallazgo.

## 4. Triaje de los 68 — NO son 68 fabricaciones

Clasificación por lectura; sólo la primera clase es del género que motivó la tarjeta.

- **(F) Familia del caso confirmado — tiendas y party (~14).** `shops.ts` y `party.ts`:
  «Thou canst carry no more!», «Thou hast none to sell!», «There is no inn here.», «No such
  person.», «Welcome back!», «Buy how many?», «It shall be done.», «It is done.», «Rumor has
  it...», «Perhaps thou hast had enough.», «She awaits thee at the dock!», «{} is already in
  thy party.», «Thy party is full.», «{} joins thee!». Mismo fichero, mismo patrón y misma
  forma que `"Here thou art!"`. **Es aquí donde hay que leer los cuerpos** (SHOPPES/SHOPPES2).
- **(E) Familia «Enter X» (12), toda en `game.ts:4833`.** «Enter towne/castle/dungeon/
  village/ruins/keep/cave/mine/hut/lighthouse» + «Enter the Castle of Lord British!» y
  «Enter the palace of Blackthorn!». Coherente y grande: o el binario las tiene con otra
  forma, o el port se inventó el rótulo de entrada. Pide su propia lectura.
- **(V) Viento (4), `wind.ts:55`.** «Calm  Winds», «North/South/East Winds» — pero
  «West Winds» SÍ casa. Que tres hermanas fallen y una pase es señal de artefacto del
  barrido, no de fabricación: **sospechoso de falso positivo**, verificar antes de tocar.
- **(C) COMPOSICIÓN — falso positivo declarado.** «{} odd keys!» sale porque el binario
  compone `" odd key"` + `"s!\n"`: la forma contigua no existe aunque la emisión sea fiel.
  (Ironía útil: viene de mi propio fix de #133.) Toda plantilla cuyo original se arme por
  piezas caerá aquí.
- **(U) Chrome del port — legítimo, no es contenido del juego.** «Save failed!», «Game
  loaded.», «Speaker on./off.», «Music on./off.», «Cancelled.» — el juego del 88 no tiene
  equivalente; son la cáscara del port. NO tocar.
- **(Q) Prosa de quest/endgame** (`lordbritish.ts`, `shadowlords.ts`): frases largas que el
  endgame arma desde ENDMSG/END.DAT. Probable composición; verificar por pieza.

## 5. Lo que este acta NO cierra

- **No he leído ni un cuerpo** de las clases (F), (E), (V) y (Q): el censo las ACOTA, no las
  adjudica. La única fabricación **probada** sigue siendo `"Here thou art!"` (carril
  enjoy-146, con su careo del vino contra SHOPPES2 0x0368).
- El numerador hereda el punto ciego de #132: los `t("…")` no entran, así que el censo es
  **cota inferior**.
- Las clases (C) y (Q) exigen un comparador por PIEZAS (la frase compuesta del binario), que
  este instrumento no tiene. Es la mejora natural y está sin hacer.

## 6. Predicción falsable

Si alguien lee la familia (F) contra SHOPPES/SHOPPES2, **al menos otra** de las ~14 resultará
tener, como el vino, un original distinto en su mismo punto de flujo. Si las 14 resultan
tener original exacto y el barrido simplemente no lo encontró, el denominador está mal
construido y hay que revisar la extracción de assets antes que el código del port.

---

# ADENDA — familia (F) leída: NO son ~14 fabricaciones sueltas, es UN defecto estructural

GO del lead sobre la familia (F) (shops.ts/party.ts). El careo cambia el diagnóstico entero.

## 7. ★★ El port tiene DOS capas de cadenas y la de transacciones ignora la fiel

`game/src/core/world/cmd-strings.ts` es una tabla de cadenas **derivadas, verbatim y con su
DS citado**, y cubre prácticamente todos los flujos de tienda: gremio, herbolario, venta,
posada, taberna, sanador, caballos, herrero. `game/src/core/shops/shops.ts` —la capa que
ejecuta las transacciones y produce los mensajes que el jugador ve— **no usa ni una**.

Pares confirmados (izquierda = lo que el port EMITE; derecha = lo que el port YA TIENE derivado):

| `shops.ts` emite | `cmd-strings.ts` tiene, con DS |
|---|---|
| :593 «Here thou art!» (FABRICADA) | `reagentThanks` `'\n"I thank thee!"\nsays $.\n'` DS 0x7988 |
| :585 «Thou canst carry no more!» | `reagentFull` `'\n\n"Thou canst not carry any more!"\n\n'` DS 0x792c |
| :544 «Thou canst carry no more!» | `buyFull` `'\n"Thou canst not carry any more!"\n'` DS 0x7b76 |
| :553 «A pleasure doing business!» | `buySold` `"\nSold!\n"` DS 0x7bb4 |
| :570 «I thank thee!» | `sellDealYes` `'Yes\n\n"Done!"\nsays $.'` DS 0x7d76 |
| :234 «Thou couldst not afford to feed it!» | `horseBroke` con su `\nyells $.\n` DS 0x7a7e+0x7a9e |
| :456 «Welcome back!» | `innPleasant` `'"Have a pleasant\nnight, '` DS 0x4e13 |
| :669 «Enjoy!» | la copia DS 0x9b16 `'\nEnjoy!"\n\n'` |
| :710 «Here thou art!» (FABRICADA) | DS 0x9c40 `'\nEnjoy!"'` (derivado en enjoy-146) |

Verificación del herbolario a CUERPO ENTERO (SHOPPES 0x0546-0x064b): tope-99 → DS 0x792c;
prompt Y/N; N → DS 0x7970, Y → DS 0x7982. La rama de ÉXITO empieza en CS 0x61c y hace:
`sub [g_gold],ax`, luego la suma con tope sobre DS 0x5850 (cap 0x63), y por último imprime
DS 0x7988 y DS 0x79a2. Ni rastro de «Here thou art!».

⇒ **La familia (F) no son ~14 sapos independientes: son ~14 SÍNTOMAS de un solo defecto de
arquitectura.** Y explica por qué nadie lo vio: quien auditaba `cmd-strings.ts` encontraba un
port fiel y bien citado; la infidelidad vive en la capa que de verdad habla.

## 8. Consecuencia para el fix — y por qué NO lo hago aquí

El lead fijó la regla: «los fixes SOLO si son calcado trivial con la cadena real en la mano;
si un flujo pide diseño, se declara y va a tarjeta». Esto pide **diseño**:
- no es sustituir 14 literales, es **cablear `shops.ts` a `cmd-strings.ts`**;
- varias fieles llevan **expansor `$`** (nombre del tendero) y `%` (precio), que la capa de
  transacciones hoy no recibe: hay que decidir si el mensaje se compone en `shops.ts` o si
  `shops.ts` devuelve una clave y compone el consumidor;
- algunas fieles son **multi-línea con epílogo** (`'"Anything else?\n\n'`), o sea que el
  flujo del original emite VARIOS mensajes donde el port devuelve uno.
⇒ **Va a tarjeta.** Es un lote de un carril, no un parche.

## 9. Lo que queda SIN derivar (declarado)

- **`buyGuildItem`**: no he leído su cuerpo. `cmd-strings.ts` tiene la familia `guild*`
  (`guildYes`, `guildConcern`, `guildDealNo`, `guildRowGems`, `guildMlady`, `guildQtail`)
  pero **ninguna de éxito**, así que el mensaje de compra hay que sacarlo del ASM.
- `party.ts` (`{} joins thee!`, `Thy party is full.`) — toca party, no tiendas; sin leer.
- (V) viento y (E) «Enter X» siguen pendientes.

## 10. Estado de la predicción del §6

**CONFIRMADA y superada.** Predije «al menos otra de las ~14 tendrá original distinto en su
mismo punto de flujo». Han salido **al menos siete** con contraparte derivada distinta
(tabla del §7), y una segunda fabricación no aparece: lo que aparece es algo peor y más
barato de arreglar — las fieles ya estaban escritas al lado.
