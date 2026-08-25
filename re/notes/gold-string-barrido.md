# Barrido de «Thou hast not the gold!» — censo, alcanzabilidad y veredicto por call-site

Carril `re/gold-string` · 2026-07-30 · anclado a `main` = `2b1f8fd0`.

Encargo: la cadena resultó FABRICACIÓN en el `(P)ick up` de la posada (el binario usa
SHOPPE.DAT registro 193). Censar los demás call-sites y derivar, para cada uno, su cadena
real del binario. **Sin asumir fabricación en bloque.**

---

## 1. CENSO — son SIETE, no seis

Barrido por CONTENIDO sobre todo lo tracked (`git grep`), no por la cifra heredada. Los
siete viven en `game/src/core/shops/shops.ts`, cada uno en un flujo distinto:

| # | línea | función | flujo |
|---|---:|---|---|
| 1 | 547 | `innPickup` | posada, recoger compañero |
| 2 | 664 | `buyEquipment` | armería / herrería |
| 3 | 716 | `buyReagent` | reactivos |
| 4 | 735 | `buyProvisions` | provisiones |
| 5 | 788 | `buyGuildItem` | gremio |
| 6 | 1027 | `buyShip` | astillero |
| 7 | 1064 | `healerHeal` | sanador |

(Fuera del código: `es.json` y `approved-strings.json` la registran, y
`shoppe-greetings.ts:427` ya la documenta como fabricación **para el caso de la posada**.)

## 2. LO QUE CAMBIA EL ENCARGO: la cadena NO se emite por donde parecía

Antes de derivar siete registros de SHOPPE.DAT hay que medir **quién emite qué**, porque el
port tiene DOS capas y no coinciden:

- **`shops.ts` (core)** devuelve un `message` en el resultado.
- **`shop-console.ts` (UI)** decide si lo usa **o si lo sustituye** por el registro real de
  SHOPPE.DAT (`this.deps.shoppeTexts?.[ÍNDICE]`).

**Medido, y hay tres regímenes distintos:**

**(a) La UI PRE-COMPRUEBA el oro y nunca llama al core** — la cadena del core es
**inalcanzable** por esta vía. Es el caso de la **posada** (`shop-console.ts:1991-1996`:
comprueba `s.gold < price`, imprime `INN_PICKUP_BROKE_INDEX` = 193 y **sale sin llamar** a
`innPickup`) y de la rama «sorry» del **sanador** (`:711`, con `HEALER_SORRY_INDEX` = 173).
⇒ El registro correcto **ya está cableado**; lo que quedó fue la cadena muerta en el core.

**(b) La UI SÍ emite `r.message`, pero sólo en DEGRADACIÓN** — `if (!template)`, o sea
cuando el pool de SHOPPE.DAT no está disponible (`:1476`, `:1622`, `:1726`, `:1837`). En ese
camino **la fabricación SÍ sale por pantalla**.

★ **Y ahí hay un segundo defecto, en el comentario que justifica esa rama:** dice
*«Degradación sin pool: el core ya devuelve la cadena DERIVADA (#147)»*. Es cierto para los
mensajes de éxito, y **FALSO para la rama del oro**, que es justo la fabricación. El
comentario cubre con una cita general un caso que no cumple.

**(c) `buyProvisions` NO TIENE NINGÚN CONSUMIDOR.** Cero llamadas fuera de `shops.ts`
(medido sobre `game/src/ui` y `game/src/core`). Su cadena no la ve nadie: es fabricación
**inerte**, y la pregunta que abre no es qué registro le toca, sino **por qué existe la
función**.

## 3. VEREDICTO POR CALL-SITE (lo medido, sin derivar todavía)

> ⚠ **ERRATA, corregida en `gold-string-36-acta.md` §1 — no uses esta tabla ni las líneas
> de §2(b) sin leer antes aquella.** El emparejamiento línea→tienda de esta nota está
> **CORRIDO UN SITIO**: `:1622` no es reactivos sino `sellEquipment` (la VENTA del herrero,
> que no tiene rama de oro), `:1726` es reactivos, `:1837` es gremio, y el astillero no está
> en `:1837` sino en `:1095` (donde la cadena **no** sale). Además falta un emisor: `:1945`
> `pickHealMember`, la vía degradada del **sanador** — que sí la emitía, y en crudo.
> Los VIVOS son **cuatro**, no tres. Causa: se emparejó por número de línea en vez de por la
> función llamada, sobre cuatro ramas casi idénticas.

| # | flujo | ¿alcanzable? | veredicto |
|---|---|---|---|
| 1 | posada | **NO** (UI pre-comprueba, registro 193 cableado) | cadena MUERTA en el core |
| 2 | armería | **SÍ, en degradación sin pool** | fabricación VIVA |
| 3 | reactivos | **SÍ, en degradación sin pool** | fabricación VIVA |
| 4 | provisiones | **NO** (sin consumidor) | fabricación INERTE |
| 5 | gremio | **SÍ, en degradación sin pool** | fabricación VIVA |
| 6 | astillero | por medir (llamada en `:1095`) | pendiente |
| 7 | sanador | **mixto**: la rama «sorry» no llega; `:1945` emite `r.message` en crudo | pendiente |

## 4. LO QUE FALTA, y por qué se declara en vez de improvisarse

Queda **derivar el registro real de cada flujo vivo**. El método está probado y no hay que
inventarlo: offset de fichero de SHOPPE.DAT → índice de registro, con **tres controles ya
validados** (104 → 0x1643, 173 → 0x23AB, y 193 de anoche). Lo que **no** se puede hacer es
dar por supuesto que a los seis restantes les toca «su» registro equivalente al 193: cada
tienda tiene su propio conjunto, alguna puede tirar de `DATA.OVL`, y **alguna podría ser
legítima**. Por eso el encargo dice medir uno a uno, y por eso aquí sólo se publica **lo
medido**.

**Recomendación de orden**, por alcanzabilidad: primero los tres VIVOS de degradación
(armería, reactivos, gremio), luego los dos pendientes (astillero y la vía en crudo del
sanador), y al final los dos que no se ven (posada y provisiones) — que son limpieza, no
defecto.

★ Y el arreglo del comentario de la rama de degradación **no debería esperar** a la
derivación: hoy afirma que el core devuelve cadena derivada en un caso en que no la
devuelve, y esa frase es exactamente lo que haría que el próximo lector no mirara.
