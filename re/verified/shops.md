# Verificado: Tiendas — SHOPPES.OVL ×3 (Task 3.6)

Reglas re-derivadas del asm con citas (`re/notes/shops.md`) y portadas al clon
(`game/src/core/shops/shops.ts` + `shop-tables.ts`, UI `game/src/ui/shop.ts`). El
arnés `re/tools/test_shops_parity.py` cruza DOS reimplementaciones INDEPENDIENTES
del cálculo de precios/grants — el modelo asm-derivado en Python (`shops_parity`,
fórmulas + tablas del desensamblado) y el core del clon
(`__parity__/shops-run.ts`, shops.ts + assets/data.json) — exigiendo resultados
idénticos. Misma filosofía que test_npc_parity / test_dungeon_parity.

## Estado de la verificación (2026-07-10)

VERDE:
- `re/tools/test_shops_parity.py` — 10 passed, 1 skipped (live opt-in). 6 escenarios
  cruzan clon↔modelo: buy/sell sweep, reactivos por-ciudad (precio+cantidad),
  gremio/transporte/naves, posada/taberna, rumores, healer. Anclas de fórmula (buy
  dos pasos trunc 0, sell +1, trunc-hacia-cero) reproducidas.
- `npm test -w game` — 484 passed (shops.test.ts reescrito a las reglas exactas:  <!-- F.1 2026-07-11: total de la suite completa (484) -->
  regateo INT buy/sell, gremio lote fijo cap 99, caps de compra/venta, posada rest
  mata envenenados + MP por clase + pickup×meses, taberna ronda/vino-gate ==3/
  raciones/rumor, shipwright).
- Suite RE requerida — sin regresiones (`pytest re/tools -k "not live"`, verde).

## ✅ (asm + cruce modelo↔clon) Mecánicas exactas portadas + cruzadas

Con paridad clon↔modelo (escenario de `test_shops_parity.py`) o listado asm
reproducido byte a byte. NO son runtime-verificadas (ver ⚠️→formulado abajo); el ✅
aquí = mecánica exacta anclada por asm + cruce de dos reimplementaciones. Citas en
`re/notes/shops.md`:
- **Regateo por INTELIGENCIA** (§0, operando 0x55B6 = record+0x0E): compra
  `base + ⌊base·(100−3·INT)/100⌋` (DOS pasos, trunc hacia cero), venta
  `⌊3·INT·base/100⌋+1`. Sustituye DEX (equipo) y KARMA (reactivos) de Redux.
- **Reactivos por-ciudad 5×8 + cantidad fija** (§2): precio de la tabla
  `reagentBasePrices[town*8+slot]` regateado por INT; grant = `reagentQuantities`
  (input "how many" ignorado, RESUELTO en 0x05D6-0x0637). "Pay-what-you-want" era
  falso. Cruzado en `reagent-by-town.json` contra data.json extraído.
- **Gremio lote fijo** (§3): keys +3 / gems +4 / torches +5 cap 99, precios
  `guildPrices` por-town + INT.
- **Transporte** (§4/§7B): base binaria (caballo 100/130/160/190; F {600,753,650,
  700}; S {200,175,125,100}) + regateo; `2×base_bin==base_clon` verificado
  algebraicamente. Shipwright coloca la nave en coords de muelle 0x4D76/0x4D7A.
- **Healer** (§5): semántica (cure⇒P, heal⇒HP<max&vivo, resurrect⇒D) + precios
  PLANOS por ciudad, sin stat. Cruzado en `healer.json` (precios de las 7 ciudades +
  no-healer null) contra data.json extraído.
- **Posada exacta** (§6): rest `§0.1(rate·party)` cura vivos + MP por clase (A/M→
  INT, B→INT/2) + **P→D (mata al envenenado)** + S→G + reloj a 6:00 + capacidad;
  leave gratis (marca partyStatus=location, monthsAtInn=0); pickup
  `§0.1(rate·10)·meses` con P→D. Reemplaza el coste fijo 4/40·6/60 de Redux.
- **Caps del binario** (§1): compra rechaza a 99 (0x0A5E) y suma cap 99; reactivo
  rechaza a 99 antes de cobrar (0x0546) y cap 99; venta gold cap 9999 (0x0F3D). El
  herrero rechaza los ítems 0x1B/0x1D (0x0E7D) y los de precio-base 0.
- **Taberna completa** (§7A): ronda por vivos (excluye 'D'), vinos con **gate EXACTO
  en 3 servicios** (0x020A `cmp [bd20],3 ; jne`; el contador cuenta comida+bebida,
  0x01C4/0x0364; a 4+ no re-castiga) → **karma −1 (0x5D56=kernel 0x3F36
  sub_byte_floored) + borrachera 25 turnos**, raciones +25 comida/ud regateadas por
  INT, 26 rumores con precio.

## ⚠️→formulado (asm-derivado + cruce modelo↔clon; paridad runtime pendiente)

Reglas con cita asm y/o cruce modelo↔clon, pero SIN verificación runtime contra
DOSBox (convención de 3.2-3.5). El oráculo no se corrió en esta sesión (contención
con otros agentes) y el canal runtime está bloqueado (ver abajo).
- **Todas las fórmulas de precio/grant**: la paridad es modelo↔clon (Python
  asm-derivado ↔ core del clon), no runtime DOSBox. Anclada por los operandos y el
  orden de pushes citados. Cierra ✅ de fidelidad de mecánica; el ⚠️ de paridad
  runtime queda abierto hasta correr el oráculo con una compra real.
- **`post_purchase_gold_rand` (0x019A)** (§0.3): RESUELTO estáticamente
  (`gold -= rand(1,64)` con suelo). **Gate DECIDIDO**: `0x5958 =
  g_shadowlord_here_idx` (índice del Shadowlord presente en la ciudad; TOWN.OVL:
  0x02B6-0x0306 lo fija desde `g_shadowlord_locs` 0x58C8); la merma dispara con
  `==0` = **Falsehood en la ciudad**. **NO portado**: el efecto es real pero
  requiere el estado de posición de los Shadowlords (Task 3.10). Consume 1 rand del
  kernel por compra — impacto en paridad de RNG de mundo, no en el precio pagado.
- **Muerte por descanso (P→D)** (§6): asm-confirmada (0x0200-0x0282) y portada,
  pero no verificada en runtime (canal BSS).
- **Bonus RNG de comida baja** (§7A, `rand(0,1)+1` si g_food<3) y las 3 tiradas
  cosméticas de la taberna: consumen RNG; el core puro no las modela (como el
  0-rolls cosmético de combate/NPC). El precio de las raciones sí es exacto.
- **charIdx del dispatcher**: se asume que el kernel pasa el PJ activo/líder a cada
  entry (0x55B6 lo confirma como INT del comprador; el índice concreto no se
  observó en runtime).

### Inventario de RNG cosmético de SHOPPES.OVL (para la paridad de stream de F.2)

Además de la merma 0x019A (`rand(1,64)`, la ÚNICA que muta estado), SHOPPES.OVL
consume `call 0x7E02` en ~13 sitios COSMÉTICOS (frases de color, no afectan
precio/estado). Deben contarse al reproducir el stream de rand del kernel:
| offset | contexto | rango típico |
|---|---|---|
| 0x01C5 | shop_random_greeting (línea 1-de-4) | rand(0,3) |
| 0x021A, 0x0244 | shop_subprompt (frases de sub-selección) | rand(0,3) |
| 0x0A1F, 0x0A8F | buy_equipment (frases de compra) | rand(0,n) |
| 0x0B73 | blacksmith_buy_menu (frase de rejilla) | rand(0,n) |
| 0x0EF3 | sell_one_item (frase de venta) | rand(0,n) |
| 0x0F7D | blacksmith_sell_menu | rand(0,n) |
| 0x121D, 0x1280 | pick_party_member / draw (color) | rand(0,n) |
| 0x12D4, 0x1314, 0x1329 | blacksmith_entry greetings (2 líneas) | rand(0,1)/rand(0,3) |
Más las 3 de la taberna (SHOPPES2, §7A: 0x03FB rand(0,6), 0x0493 rand(0,1)+1,
0x063D rand(0,3)). El core puro del clon no reproduce ninguna (como el 0-rolls
cosmético de combate/NPC); listadas aquí para el arnés de stream de F.2.

## Verificación runtime DOSBox (2026-07-10)

### ⚠️ BLOQUEADO (con evidencia): entrada a tienda no disparable headless

`test_shops_parity.py::test_shop_buy_price_live` (opt-in `U5RE_LIVE=1`) hace
**skip** con evidencia: los arrays de trabajo de la tienda (`g_unk_b114` y las
tablas de stock/precio residentes) son BSS que **sólo** puebla la ENTRADA real al
mapa de la ciudad + el hook TALK que abre el mostrador — igual que los arrays de
NPC de 3.5 (`re/verified/npc.md`). Cargar SAVED.GAM headless no re-ejecuta la
carga de mapa ni el diálogo; disparar una compra exige inyección de teclas de
navegación a ciegas (salir al overworld, entrar al pueblo, hablar al tendero,
teclear Buy/ítem/Yes) — fuera del alcance de este canal.

⇒ Las reglas quedan ancladas por el asm citado + el cruce modelo↔clon (9 casos de
paridad sobre 5 escenarios). La verificación en vivo de una compra concreta
(sembrar INT/gold con `write_mem`, disparar el mostrador y leer g_gold 0x57AA
antes/después) queda ⚠️→formulado, como el live de `re/verified/dungeon.md`. Vía
para cerrarlo (F.2): armar un BP en la entrada de `buy_price_adjust`
(SHOPPES load_seg:0x02D8) con INT/gold sembrados y leer `g_shop_accum` 0xB118
tras el __ldiv, comparando contra `haggle_buy` del modelo.
