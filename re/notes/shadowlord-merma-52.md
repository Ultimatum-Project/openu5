# #52 — Shadowlord urbano: la semántica del flag físico, y qué diverge de verdad

> ## ✅ CABLEADA (propuesta A) — #54 tanda 2, 28-07. Y ★ UNA CORRECCIÓN QUE CAMBIA EL COSTE
>
> **Qué es la fila 4.** El §2 de esta nota dice: «como la fila 4 es la de entrada estándar,
> en la práctica cubre **la entrada normal a pueblo**». **Es FALSO**, y era el argumento del
> que colgaba todo el coste de la pieza. La entrada estándar es la fila **30**
> (`SMALL_MAP_ENTRY = {x:15, y:30}` en game.ts, y hay test que lo fija).
>
> La fila 4 es **la CELDA DE YEW**. El binario mete al arrestado en (25,**4**)
> —`0x1313 mov [g_party_x],0x19` · `0x1318 mov [g_party_y],4`, tras «The guard strikes thee
> unconscious!» (DS 0x281b) y «Thou dost awaken to...» (DS 0x2845)— y acto seguido RECARGA
> el pueblo: `0x12cd push 1 / call 0x11f0`, la MISMA rutina que coloca al Shadowlord en
> 0x1239 (comprobado: 0 `ret` entre 0x11f0 y 0x1239). ⇒ **la guarda existe para que despertar
> preso no coloque, ni anuncie, ni posea, ni merme.** Control independiente: el propio port
> ya situaba la celda en (25,4) citando TOWN 0x130e (`guardArrestJail`), sin relación con
> esta lectura.
>
> **Consecuencia sobre el coste.** El §3 decía que cablear (A) movería el RNG de tienda
> («la merma consume rand(1,64) ⇒ los digests de los specs de tienda se mueven»). Como la
> guarda NO se dispara en la entrada normal, eso **no ocurre**: medido, la suite entera pasa
> sin tocar un solo aserto de tienda. El único camino del juego que la dispara es el arresto.
> Igual que en la pieza (f), el «radio ALTO» estimado no se materializa.
>
> **Cableado**: `state.shadowlordHere` (flag físico, −1 = sentinel 0xFF) + `computeShadowlordHere`
> (la guarda) + `shadowlordHereIndex` (lector con fallback a la consulta lógica). Los tres
> consumidores del binario pasan a leerlo: merma (`postPurchaseGoldDrain`), colocación/anuncio/
> posesión (`applyUrbanShadowlord`). Se fija en `loadSmallMap` y en `guardArrestJail`.

Encargo: (1) leer la semántica EXACTA del `cmp ..., 0` de SHOPPES 0x019a y TALK 0x1187 —
sin cerrar sin la rama del sentinel 0xFF—; (2) censar el radio y **proponer sin cablear**.
Corpus 28/28 `.asm`, con control positivo. **Nada cableado.**

---

## 1. ★ La respuesta a la pregunta del sentinel: NI 1-based NI «alguno-especial»

`g_unk_5958` es un **índice 0-based** (0,1,2) con **0xFF como sentinel** de «ninguno». Los
lectores no preguntan «¿hay alguno?», preguntan **por un VALOR concreto**:

| lector | código | dispara si |
|---|---|---|
| **SHOPPES 0x019a** (merma de oro) | `cmp [g_unk_5958],0` · `jne 0x1b4` (ret) | **== 0** |
| **TALK 0x1187** | `cmp [g_unk_5958],0` · `je 0x1191` | **== 0** |
| **TOWN 0x1156** (posesión de NPC) | `cmp ax,1 / je` · `cmp ax,2 / je` · si no, `jmp 0x11b1` | **== 1 ó == 2** |
| TOWN 0x02dd · 0x1294 · 0x021a | `cmp …,0xFF` | test del **sentinel** |

Y el índice 0 es **la FALSEDAD**: la tabla de nombres del anuncio (`0x27dc`) da
`[0]=falsehood [1]=hatred [2]=cowardice` (extraída de DATA.OVL en #38-b).

⇒ **`cmp 0` NO es «hay un Shadowlord», es «el Shadowlord es el de la Falsedad».** Con
0xFF (ninguno) el `jne` se cumple igual que con 1 ó 2, así que la rama del sentinel y la de
«otro Shadowlord» **colapsan en el mismo camino** — por eso el `cmp 0` basta y no hace falta
comparar 0xFF. Cerrada la pregunta sin dejar la rama abierta.

### 1.1 ★ Y el hallazgo que ensancha #52: la guarda suprime TRES cosas, no una
`TOWN 0x1156` (que el briefing no listaba) conmuta por **1 y 2** = la **posesión de NPCs**
por Astaroth/Nosfentor, y se llama en `0x12a4`, justo tras el anuncio. Sumado a la merma
(SHOPPES) y a TALK:

> La guarda `y == 4` de `town_place_shadowlord` deja el flag en 0xFF ⇒ **anula la merma de
> oro, la rama de TALK Y la posesión de NPCs**, las tres a la vez.

### 1.2 Cuándo corre la colocación (acota el alcance)
Sólo **2 llamadores**, ambos de CARGA, ninguno por turno:
- `0x1239` — carga de pueblo, con `0x122e mov [g_unk_5958],0xFF` **inmediatamente antes**.
- `0x09df` — dentro de `0x09BC`. ⚠ **CORREGIDO por #201**: esta línea decía «rutina corta
  (`ret 2`) de cambio de planta». **Es FALSO.** `0x09BC` es la **entrada a COMBATE URBANO**:
  su `[bp+4]` es un SLOT DE NPC (lo fija el `shl bx,4` de 0x09c8 sobre `g_npc_rt`), y sus
  dos llamadores son el jugador embistiendo a un NPC, en 0x0b3a, y el NPC atacando, en
  0x1408, precedido de la impresión de DS 0x2881 = `"\nAttacked!\n"`. Al volver del
  combate recarga el mapa y re-coloca. **No existe ningún caller de la colocación en un
  cambio de planta.** Derivación entera en `shadowlord-residuos-acta.md §1`.

⇒ El flag se fija **una vez por carga de mapa/planta**, con la `y` que tenga el party **en
ese instante**. No se re-evalúa al moverse dentro del pueblo.

### 1.3 Censo del flag, por las DOS vías + la trampa del lead
Hex **y** símbolo+offset-decimal sobre los 28 `.asm`, con control positivo (debe ver los 2
lectores conocidos: ✓). **11 accesos, 3 escritores** — `0x02b6` (init 0xFF), `0x02d9`
(`= cl`), `0x122e` (reset 0xFF). Coincide con tu censo.
⚠ **Trampa confirmada y excluida**: `ULTIMA.EXE 0x5061 mov [0x5859],al` es **1** acceso a
una dirección DISTINTA (dígitos traspuestos de 0x5958). **No contado.**

---

## 2. Qué diverge REALMENTE en el port (y qué no)

**NO diverge la semántica del valor.** El port ya la tiene bien, con cita:
- `shops.ts:877` — `if (shadowlordPresentIndex(state) !== 0) return 0; // 0x019f jne ret:
  gate ANTES del rand` (incluso respeta que el gate va **antes** del `rand`).
- `blackthorn.ts:476` — mismo `!== 0`, y su JSDoc dice «si el Shadowlord presente es la
  **Falsedad (índice 0)**».

**Diverge SÓLO la FUENTE de la presencia:**

| | binario | port |
|---|---|---|
| fuente | flag **FÍSICO** `g_unk_5958`, escrito por la colocación | tabla **LÓGICA** `shadowlordLocs` (`shadowlordPresentIndex`) |
| efecto de `y==4` | flag queda 0xFF ⇒ **sin merma, sin TALK, sin posesión** | la tabla no sabe de `y` ⇒ **todo se aplica igual** |

⇒ **Divergencia confirmada, y su alcance exacto es: las cargas de mapa/planta en las que el
party está en la fila 4.** No «toda la fila 4 siempre» — sólo cuando la carga ocurre con
`y==4`. Como la fila 4 es la de entrada estándar, en la práctica cubre **la entrada normal a
pueblo**, y deja de aplicarse en cuanto cambias de planta desde otra fila.

---

## 3. RADIO (censo, sin tocar)

**Consumidores en `game/src`:**
`shops.ts:877-878` (merma viva, con su `rand(1,64)`) · `blackthorn.ts:476`
(`postPurchaseGoldDrain`) · `game.ts:4562` (`applyUrbanShadowlord` → sprite + anuncios +
posesión) · `shadowlord-urban.ts:82` · `__parity__/blackthorn-run.ts:206` (arnés de paridad).

**Tests/specs que lo asertan (5 + el arnés):**
`merma-live.test.ts` · `blackthorn.test.ts` (`:243/:246/:247/:251`) · `shop-buy-flow.test.ts`
· **`falsedad-drain-scope.test.ts`** (por el nombre, el que define el ALCANCE de la merma —
el primero que se movería) · `shops.test.ts`.

**Lo que se movería si se cablea:** cualquier caso que compre en tienda tras una entrada
estándar a pueblo con la Falsedad presente **dejaría de mermar**. Y como la merma consume
`rand(1,64)` del stream vivo, **suprimirla desplaza el RNG** ⇒ los digests de los specs de
tienda se mueven aunque el oro final coincida. Ése es el coste real, no el oro.

---

## 4. PROPUESTA (sin cablear — decides tú)

**A. Calcar el flag físico (fidelidad completa).** Añadir al estado un `shadowlordHereIdx`
(0-2 / 0xFF) escrito al cargar mapa/planta con la guarda `y==4`, y hacer que la merma, la
rama de TALK y la posesión lo lean a él en vez de a `shadowlordPresentIndex`. Es lo fiel y
**arregla las tres a la vez**. Coste: toca el stream de RNG de tienda ⇒ ventana e2e.

**B. Sólo el NPC físico.** Modelar la colocación y dejar la merma como está. **No lo
recomiendo**: la merma seguiría divergiendo, y ya sabemos por qué.

**C. Diferir con la divergencia declarada.** Escribir el quirk en
`deliberate-divergences.md` y dejar el port como está.

**Mi lectura, para lo que valga:** (A) es la única que cierra el punto, y su radio es
**medible y acotado** (5 ficheros de test + el arnés de paridad), pero al mover el RNG de
tienda encaja mejor en el LOTE DE MECÁNICA pre-ventana (#54) que suelto.

⚠ Y un matiz que sigue vivo del acta anterior: la rutina del binario es un **SPAWN** y la del
port una **CONSULTA**. (A) no es traducción mecánica — exige decidir que el port modela la
colocación física. Esa parte sigue siendo decisión de diseño.

## 5. Gates
Sólo notas: **ningún `.ts` tocado** ⇒ tsc no aplica (declarado). Cero playwright.
