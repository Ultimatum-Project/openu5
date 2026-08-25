# LEDGER DEL ESPEJO-2 (corpus AD, Alex Diener) — derivación de los deltas de transacción

Relevo-3b, 2026-07-25. Hermano de `espejo-careo-precios.md` (que adjudicó el guild −954 / helm
+36 del corpus LP1 y trianguló el **INT=25** del avatar de aulddragon).

**Punto de partida**: el corpus AD tenía **CERO anclas de ledger** (`grep` de `seedGold`/
`seedInt`/`anchor.expectDelta` en `routes-ad/` = 0 ocurrencias), frente a las 2 verdes de LP1
(guild −954 en part05, venta +36 en part04). Este documento es la derivación de las que SÍ son
derivables del corpus, y —igual de importante— la constancia de las que NO lo son.

## 1. Censo: ~~402~~ beats con precio/peaje en el corpus AD

> **⚠ EL 402 NO ES REPRODUCIBLE — re-medido 2026-07-30.** Repetido el mismo barrido sobre
> **tres SHA distintos**, el censo da **355**, no 402. La cifra publicada aquí abajo **no se
> ha podido reproducir ni una vez**, así que **no debe citarse como población**: úsese 355,
> y aun ése con la cautela de que el barrido depende de qué `expect` estén presentes en el
> `route.json` del momento.
>
> **Qué NO cambia:** el REPARTO en tres familias y sus propiedades para el ledger —que es lo
> que esta sección existe para fijar— se sostiene igual; lo que cae es el TOTAL. Una cifra de
> censo sin SHA es una foto, y ésta se tomó sin él.

Barrido de los `expect` de las 25 rutas (el `route.json` es el artefacto commiteado del OCR):
~~402~~ bloques mencionan `N gp` / `N gold` / `toll` / `price` / `asking`. Se reparten en tres
familias con propiedades MUY distintas para el ledger:

| familia | nº | delta comparable? |
|---|---|---|
| peajes de troll | 4 | **el AMOUNT sí, el delta NO** (§2) |
| tributo de guardia | 1 | no adjudicado (§3) |
| compras/ventas de tienda (herbolario, sanador, astillero, armas…) | ~397 | sí, pero cada una exige `seedInt` + que la tienda ENGANCHE (§4) |

## 2. Los 4 peajes de troll: un ORÁCULO DE STR exacto, y delta CERO

El peaje NO es aleatorio. `game.ts:295` + `:548` (MAINOUT `troll_toll` 0x1B3E):

> `toll` = **99 − 3·STR** del primer miembro consciente

Aplicando la fórmula a los 4 beats del corpus:

| parte | segmento | OCR | peaje | STR derivada |
|---|---|---|---|---|
| ad01 | ad01-g04 | 2308 | 39 gp | **20** ✓ entera |
| ad04 | ad04-g10 | 1496 | 39 gp | **20** ✓ entera |
| ad04 | ad04-g17 | 2746 | 39 gp | **20** ✓ entera |
| ad05 | ad05-g03 | 245 | 36 gp | **21** ✓ entera |

Dos comprobaciones que hacen la derivación firme, no una coincidencia:

1. **4/4 dan STR ENTERA.** Con una fórmula equivocada los importes no dividirían limpio por 3
   (`(99−amt)/3` entero es 1 de cada 3 importes por azar; que salga 4 veces de 4 es ~1/81).
2. **La progresión es MONÓTONA y del tamaño correcto**: STR 20 en ad01→ad04 (tres beats
   independientes, los tres a 39) y 21 en ad05. Es exactamente lo que hace una partida real —
   el mismo patrón que trianguló el INT=25 de aulddragon en el careo de precios.

**Pero el delta de oro de los cuatro es 0**: Diener **RECHAZÓ todos los peajes**. Los cuatro
beats cierran con `Dost thou pay?` seguido de **`N`** y a continuación `TR0LLS` (y en ad05,
explícito, `*** CVNFLICT **` + el roster de combate `Barnabas, armed…`). Es la rama de rechazo
del original: **MAINOUT `troll_toll` 0x1B3E → spawn 0xb714** (citada en `game.ts:470`), peaje no
pagado → combate con los trolls.

Conclusión para el ledger: **el corpus AD no ofrece NI UN delta de peaje pagado**. Lo que ofrece
es (a) el importe como oráculo de STR y (b) la rama de rechazo→spawn como comparable de
mecánica. Anotar un delta −39 aquí sería FABRICAR una transacción que el LP no hizo.

## 3. El tributo de guardia de ad03: NO adjudicado

`ad03-g11` OCR 2378: «Blocked! A guard demands a **20 gp** tribute to Blackthorn! Dost thou
pay?». La fórmula del port es `tributo = 10·vivos` (TALK 0x0230, `game.ts:281/295`), que daría
**2 vivos** — inverosímil en ad03 (la party del LP2 ya es mayor). Y la continuación del OCR no
es un cobro sino la rama represiva: `:Yes "Thou art under arrest!" "Wilt thou come quietly?" …
strikes thee unconscious!`.

Con dos incógnitas a la vez (¿el `Yes` responde al tributo o al «come quietly»? ¿la fórmula
`10·vivos` está bien derivada?) **no se adjudica**. Queda como ticket de careo con oráculo, en la
misma clase que el careo del guild: primero se fija la fórmula contra el ASM, después se mide.

## 4. Las ~397 compras/ventas: la vía real, y su prerrequisito

Son la fuente gorda de deltas (herbolario de ad03/ad04/ad05 con sus 5 reactivos, sanador
—«heal for 65 gold», «raise from the dead for 262 gold»—, astillero —«186 gp», «968 gold»—,
armerías, posadas). Su aritmética YA está calcada y adjudicada por el relevo-2
(`shopBuyPrice` = calco exacto de `buy_price_adjust` SHOPPES 0x02D8; venta = `sell_one_item`
0x0E76), así que **no hace falta RE reverse-engineering: hace falta INSTRUMENTO**. Cada una
necesita, como las dos verdes de LP1:

1. `seedInt` con el INT del avatar de Diener — **que hay que triangular todavía** (el de
   aulddragon salió 25 por triangulación ×3; el de Diener saldrá de los precios de gema/posada
   del propio corpus AD, con el mismo método);
2. `seedGold` (solvencia) y, para las ventas, `seedEquip`;
3. que el `anchor` de NPC ENGANCHE la tienda — y aquí está el cuello de botella real medido en
   esta ventana: **295 `typed` descartados en ad05 solo** porque no había sumidero de entrada
   vivo, es decir, las conversaciones no conectan bajo deriva. Sin tienda abierta no hay
   transacción que medir.

**Orden correcto, por tanto**: primero conectar las conversaciones (resync a NPC), después el
`seedInt` triangulado, y sólo entonces los deltas. Poner los `expectDelta` antes de eso produce
un ledger de ceros que no distingue «el port cobró mal» de «la tienda no abrió».

## 5. Petición de instrumento (para el lead)

Dos ops de arnés que el corpus AD necesita y LP1 no tenía:

- **`seedStr`** (gemelo de `seedInt`): sin él los 4 peajes no son comparables — el port cobraría
  `99−3·STR_del_port` en vez de los 39/36 del LP. Con él, el importe del peaje es un comparable
  EXACTO en 4 beats.
- **`expectDelta` a nivel de OP** (hoy sólo existe colgado de `anchor.kind === "npc"`,
  `runner.ts:1367`): un peaje/tributo no es una tienda, es un disparo de terreno, así que no
  puede llevar ancla de NPC. Con un `op.expectDelta` suelto, peajes y tributos entran al ledger
  con la misma maquinaria ya probada (`ledgerDeltaResult`).

Ninguna de las dos se implementa en este relevo: la ventana estaba ocupada por la re-corrida de
la cadena y editar `runner.ts` a mitad de cadena habría hecho inconsistente la medición (partes
1-3 con un código y 4-25 con otro).
