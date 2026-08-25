# Verbo (U)se de endgame + mercaderes sin surface (Task #52)

> Derivación byte-a-byte del binario para: (a) el dispatcher de (U)se item y cada
> herramienta de endgame; (b) los mercaderes cuyo núcleo fiel ya existía pero no
> tenían cableado a la UI (Barkeeper/HorseSeller/Inn/Ztats). Autoridad: **asm**.
> Estándar de cita = "APÉNDICE ASM #51" de `content-audit.md`. Fuentes de flags:
> `content-audit.md` TOP #3/#6/#7/#9 + §Transporte (HMS Cape) + §Economía (FLAG 14-19).
> Fecha: 2026-07-16 · rama `fiel/use-merchants`.

---

## §Use — dispatcher de (U)se item (CAST.OVL 0x1792)

El comando (U)se abre un picker de items usables y despacha por un jump-table. Cadena
citada de `re/disasm/CAST.OVL.asm` (file offsets = CS − near_call_base(CAST)=0xBF80,
overlay-load-layout.md §1):

1. **Picker** — `0x17aa: push 0xb9ee` (tabla extendida de nombres, ZSTATS
   build_extended_item_table) `push 0x26`(=38 entradas) → `call 0xffffc012` (menú de
   selección). Devuelve el índice elegido en `[bp-4]`; `0xffff` = cancelado →
   `0x17bd` imprime **"No usable items!\n"** (DS 0x489f) y sale. El picker sólo lista
   items con count≥1 (la navegación salta qty 0), por eso el port construye la lista
   con `if (owned)` por item.
2. **Mapa selección→item-id** — `0x17e7: push [bp-4]; push 0xff; push 0x55; call
   0xffffc1f2` → id en `[bp-0x12]`. Rango del despacho:
   - `<0`     → sale.
   - `0..7`   → `call 0x11de` (anillos/…; ya fuera de #52).
   - `8..0xf` → `call 0x135a` (pociones/…).
   - `0x15..0x1c` → `call 0x153c` (pergaminos/…).
   - resto (`0x10..0x14`, `0x1d..0x25`) → **jump-table** `0x185d:
     jmp word cs:[bx-0x2522]` con `bx=(id-0x10)*2`.
3. **Jump-table** (file 0x1b5e, 22 `dw`; cada word = CS_target = file+0xBF80):

   | id  | file-target | herramienta | string (DS) |
   |-----|-------------|-------------|-------------|
   | 0x10| 0x1862 | Magic Carpet (embarca alfombra) | "Carpet\n\n" 0x48bf |
   | 0x11| 0x18c4 | **Skull Key** (ya portado, task #22) | "Skull Key\n" 0x48fe |
   | 0x12| 0x1908 | Amuleto de LB | "Amulet\n\n" 0x4914 |
   | 0x13| 0x193e | Corona de LB | "Crown\n\n" 0x4930 |
   | 0x14| 0x1966 | Cetro de LB | "Sceptre\n\n" 0x4950 |
   | 0x1d-0x1f | 0x1a2c | **Shards** (ya portado; `call 0x15b4(id-0x1d)`) | — |
   | 0x20| 0x1a3a | Spyglass | "Spyglass\n\n" 0x498d |
   | 0x21| 0x1a76 | **HMS Cape** ("Plans") | "Plans\n\n" 0x49ba |
   | 0x22| 0x1a96 | Sextant | "Sextant\n\n" 0x49fc |
   | 0x23| 0x1ad4 | Pocket Watch | "Watch\n\n…" 0x4a30 |
   | 0x24| 0x1b2e | Black Badge | "Badge\n\n" 0x4a5b |
   | 0x25| 0x1b58 | Wooden Box | "Box\n\nHow?\n" 0x4a70 |

4. **Tail común** (0x1b8a): `if [bp-0xa]!=0 → salida limpia; else → "Failed!\n" (0x4a7b)
   + beep`. `[bp-0xa]` se inicia en 1 (0x179a) y SÓLO las ramas de anillo/poción/
   pergamino lo pisan; las herramientas del jump-table lo dejan en 1 ⇒ **nunca imprimen
   "Failed!"** y **no consumen RNG**. El (U)se no rueda turno en el port (igual que
   `useSkullKey`/`useShard`, que tampoco llaman `runContextTurn`).

### Ramas derivadas (offsets exactos)

- **HMS Cape / "Plans"** (0x1a76): `al = g_transport_tile & 0xF8; cmp 0x20; jne` →
  en fragata (0x20-0x27) `0x1a86: or g_hms_cape,0x80` + **"Ship rigged for double
  speed!\n"** (0x49c2); si no → **"Only usable on shipboard!\n"** (0x49e1). El efecto
  (mitad de coste naval) YA es fiel (`navalStepCost`, transport.md §5); faltaba el
  verbo que setea el flag. Port: `game.useHmsCape()` (transport === "ship").
- **Spyglass** (0x1a3a): gate `g_location<0x21 && g_floor<0x80` (si no → "Not here!\n"
  0x49af); de día `hora∈[6,0x12]` → "No stars!\n" (0x49a4); de noche → "Looking...\n"
  (0x4998) + vista celeste (`call 0xffffbf9a`, cosmética, no portada). `game.useSpyglass()`.
- **Sextant** (0x1a96): gate `g_floor<=0x7f && g_location==0` (exterior; si no →
  "Only outdoors!\n" 0x4a06); noche `hora<=5 || hora>=0x13` (si no → "Only at night!\n"
  0x4a16); imprime "Position:" (0x4a26) + coords. `game.useSextant()`.
- **Pocket Watch** (0x1ad4): sin gate. `H = hora%12 (0→12)`, `MM` a 2 dígitos, AM si
  `hora<=0xb` (0x1b1a) si no PM: "The pocket watch reads H:MM AM/PM.\n". `game.usePocketWatch()`.
- **Black Badge** (0x1b2e): toggle `g_time_spell 0x1d` (helper 0x1764): puesto →
  "Removed!\n" (0x4895); si no → "Badge worn!\n" (0x4a63) + `g_time_spell=0x1d` perm.
  Port: `state.wornBadge` (toggle). El disfraz de Blackthorn queda diferido.
- **Amuleto** (0x1908) / **Corona** (0x193e): toggle `g_time_spell 0xe`/`0x1c` + set
  (efecto 9, permanente). Strings "Wearing the Amulet of Lord British...\n" (0x491d+
  0x4a84) / "Thou dost don the Crown of Lord British...\n" (0x4938+0x4a84) / "Removed!".
  Port: `state.wornAmulet`/`wornCrown` (toggle fiel); el bonus de combate del efecto 9
  es endgame profundo (#20/#44) → diferido, documentado.
- **Cetro** (0x1966): "Wielding the Sceptre of Lord British...\n" (0x495a+0x4a84) +
  disuelve campos de fuerza contiguos ("Field dissolved!\n" 0x496f / "No effect!\n"
  0x4981). En juego normal no hay campos alcanzables → observa "No effect!"; el barrido
  de disolución diferido. `game.useSceptre()`.
- **Wooden Box** (0x1b58): sólo imprime "Box\n\nHow?\n" (0x4a70) y sale — la caja no
  tiene efecto por (U)se normal (su carga = escena del trono, endgame #20). `game.useWoodenBox()`.

### Estado / save
- Nuevo `specialItems.pocketWatch` (.gam **0x217**, entre Sextant 0x216 y Black Badge
  0x218 — hueco que el port no leía). Round-trip en `saveNative.ts`; default false en
  `createState` (el `initial-state.json` del extractor es previo al campo).
- `wornAmulet/wornCrown/wornBadge`: flags runtime (no persistidos) que dirigen el toggle
  del mensaje; el efecto profundo queda para #20/#44.

### Tests
`game/tests/use-tools.test.ts` (14): HMS Cape en/fuera de barco, Spyglass noche/día/
mazmorra, Sextant noche/pueblo/día, Watch 12h AM/PM, Badge toggle, Amuleto/Corona
toggle, Cetro "No effect!", Box "How?".

---

## §Horse — HorseSeller / buyHorse (SHOPPES.OVL 0x07BE)

El núcleo tenía sólo `horsePrice()`; faltaba la compra. Cadena del binario:
1. **Escaneo de casilla** (0x07E5-0x086a): 4 desplazamientos de DS 0x3C38 (dx =
   `[0,0,1,-1]`) × 0x3C40 (dy = `[1,-1,0,0]`) = **S, N, E, O**. Por cada uno: `get_tile_ptr`
   (0xffffa172) → tile `si`; `call 0xffff93fe` (¿ocupada?) → si !=0 salta; acepta si
   `si ∈ {0x44,0x45,0x05}` (0x0820-0x082d). Sin casilla válida → **"The stables are
   closed.\n"** (0x7a48), sin cobrar.
2. **Precio** (0x0876): `transportPrices[b114*2 + 0x3C30]` = HORSE_PRICES {100,130,160,190}
   regateado por INT del comprador (record+0x0E). Núcleo puro = `buyHorse(state, idx, INT)`.
3. **Pago** (0x092b-0x097b): si `gold<precio` → "Thou couldst not afford to feed it!\n"
   (0x7a7e/0x7a9e). Si hay oro: `gold-=precio`, **merma de la Falsedad** (0x0951 call 0x19a,
   grupo SHOPPES.OVL), y COLOCA la montura (obj+0/1 = tile **0x10**, obj+2/3 = celda,
   obj+4 = floor) en la casilla hallada. "Yes!" (0x7a78).

Port: `buyHorse` (shops.ts, oro puro) + `game.stableHorse(idx, INT)` (escaneo S/N/E/O +
gate stables-closed + drain + `setMapOverride(0x10)`). ⚠ **Clase C (objeto-vs-tile)**: el
binario coloca un OBJETO del mundo; el port fija un map-override tile 0x10 — que es como el
port ya modela las monturas boardables (board() lee el tile del mapa, transport.ts:board →
0x10 → "horse"). UI: rama HorseSeller de `ui/shop.ts` ("A steed — precio gp").

## §Barkeeper — taberna (SHOPPES2.OVL 0x066C)

Núcleo byte-fiel ya existía (`buyTavernRound`/`buyWine`/`buyRations`/`buyRumor`), sin
cablear; la UI vendía un placeholder sintético (Food+Torch vía `buyProvisions`). Ahora la
rama Barkeeper de `ui/shop.ts` cabla:
- **Ronda de comida** (0x01D2): `precio_por_cabeza[bar] · vivos` (excluye muertos). `served++`.
- **Raciones** (0x0380): `+25` comida/unidad, regateo por INT.
- **Carta de vinos** (0x01F4): 6 copas (Rose/Claret/Sauterne/Muscatel/Moselle/Chablis). El
  gate de borrachera salta con `served==3` (contador de servicios de la visita, en el panel):
  `buyWine` aplica **karma −1** (fiel) antes de cobrar; el **timer de borrachera (25 turnos)
  NO se modela** en el port (cosmético, sin g_drunk_timer) — documentado.
- **Rumor** (0x0508): input de texto → `buyRumor` (prefix-match contra 26 keywords).
> ⛔ **REFUTADO (2026-07-25, barrido de citas).** El párrafo de abajo era falso y la línea
> que lo sostenía era una cita sin pasar por la regla. `0x9dfa` **no es una dirección de
> kernel**: es el destino near-call CRUDO que imprime el disasm de SHOPPES2/SHOPPES3, que
> viven en la BANDA 4 (`near_call_base` 0xe1e0). Aplicando `overlay-load-layout.md §3`:
> `(0xe1e0 + 0x9dfa) & 0xFFFF = 0x7FDA`, que cae en el pool de stubs kernel→overlay y
> salta a **SHOPPES.OVL:0x019a** — es decir, **`0x9dfa` Y `0x19a` SON LA MISMA RUTINA**
> (`shop_falsehood_gold_theft`). SHOPPES2/3 no pueden llamarla directo por estar en otra
> banda, y por eso pasan por el stub.
>
> ⇒ **La taberna y la posada SÍ aplican la merma de la Falsedad.** Los 6 call-sites del
> literal siguen todos al descuento de oro; verificados en contexto 4 de ellos:
> SHOPPES2 `0x0140` (`sub [g_gold],ax` → `0x0147 call`) ronda de taberna, SHOPPES2
> `0x035d`→`0x0361` copa de vino (precio de la tabla `0x4c48`), SHOPPES3 `0x011d`→`0x0121`
> `inn_rest_until_morning`, SHOPPES3 `0x07af`→`0x07b3` `inn_pick_up_companion`.
> (Recordatorio: `shop_falsehood_gold_theft` sólo actúa con `g_shadowlord_here_idx == 0`,
> o sea con Faulinei en el pueblo; fuera de eso retorna sin tocar el oro.)
>
> ⇒ **SAPO DEL PORT (abierto):** `game/src/ui/shop-console.ts:1168-1175` documenta y
> aplica justo la regla refutada («NO en ventas ni en taberna/posada/astillero
> (SHOPPES2/3)»), igual que el `ShopPanel` del DOM. Corregirlo es un carril aparte: hay
> que decidir call-site por call-site (esta nota sólo establece que taberna y posada SÍ
> drenan; las **ventas** no las he comprobado y quedan sin adjudicar).

~~La taberna es SHOPPES2 ⇒ **NO** aplica la merma de la Falsedad (los pagos van seguidos de
kernel 0x9dfa [= CS 0x7fda → SHOPPES.OVL:0x019a shop_falsehood_gold_theft], no de 0x19a); por eso `drainOnPurchase` NO se llama en esta rama.~~

`served` = campo del panel reiniciado en `open()` (equivale a g_cups_served 0xBD20 por visita).

## §Inn — Leave / Pick up (SHOPPES3.OVL)

El núcleo `innLeave`/`innPickup`/`innPickupPrice` ya existía (byte-fiel); la UI sólo tenía
"Rest until morning". Ahora la rama InnKeeper de `ui/shop.ts` cabla:
- **(L)eave** (0x02AE): un botón "Leave <nombre>" por cada miembro EN el party salvo el
  Avatar (idx 0). NO cobra ahora (se paga al recoger); `innLeave` rechaza si party==1
  ("One must first be left behind!") o si es el Avatar ("Thy friend will not leave thee!").
  Marca `partyStatus=location`, `monthsAtInn=0`, party−1.
- **(P)ick up** (0x04E6): un botón por cada miembro con `partyStatus==location` (hospedado
  AQUÍ). Precio = `haggle(rate·10, INT)·max(1, meses)`. Rechaza si party==6 o falta oro; si
  murió envenenado esperando → "Thy friend has died, by the way." Reincorpora (party+1).
El panel re-renderiza tras Leave/Pickup para refrescar ambas listas.

## §Ztats — páginas de inventario (ZSTATS.OVL)

El Ztats sólo mostraba Food/Gold/Keys/Gems/Torches/Karma; las cantidades de reactivos/
pociones/pergaminos/equipo existían en el estado (`reagentQuantities`/`potionQuantities`/
`scrollQuantities`/`equipmentQuantities`) sin surface. El original cicla PÁGINAS con Z;
el port las apila como secciones con sólo las filas POSEÍDAS (qty>0): **Reagents** (8),
**Potions** (8 colores), **Scrolls** (8 hechizos), **Weapons & Armour** (equipmentQuantities,
nombres de InventoryDetails.json). Los nombres de pociones/pergaminos (color/hechizo) son
convención estándar de U5 (= debug/registry potionLabels/scrollLabels); ⚠ Clase C (el orden
y las cadenas exactas de la tabla del Ztats no se derivaron byte-a-byte, sólo el conjunto y
las cantidades). Ver `ui/ztats.ts`.

## Tests
- `game/tests/use-tools.test.ts` (16): verbo (U)se + `stableHorse` (placement/gate).
- `game/tests/shops.test.ts`: `buyHorse` núcleo (cobro/rechazo). Barkeeper/Inn ya cubiertos.
- `string-manifest` (F1.12): 26 strings nuevos declarados [D] con cita DATA.OVL.
- Suite completa: 1706 verdes; `tsc --noEmit` limpio.
