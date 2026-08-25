# Discriminadores para el resello — las 4 preguntas que el run debe contestar solo

**Carril:** bancos-residuales · **2026-07-25** · Encargo del lead: dejar cada pregunta escrita
de forma que **un run la conteste sin interpretación**, para que el resello no necesite una
segunda pasada.

Contexto: `re/notes/proyectil-los-0x6a14-derivacion.md` (el LOS de proyectil es `0x6a14`, no
`0x6a86`) y `re/notes/censo-reauditoria-0x6a14.md` (de 112 salas, **3 sellos** dependen de la
tabla). El fix ya está en main (`e217ace4`).

---

## 0. Instrumentación — HECHA, no pendiente

`recordCombatRound` grababa `enemies` como **conteo**. Con eso se sabe *que* cayó alguien,
pero no **cuál** ni **por qué línea** — y las tres preguntas de abajo son exactamente eso.

Añadido (este commit, `tsc:e2e` verde):

| campo | dónde | para qué |
|---|---|---|
| `enemyCells: string[]` | ambos call-sites (`resolver: "room"` y `"arena"`) | celdas «x,y» de los enemigos VIVOS por ronda ⇒ la baja se identifica por diferencia de conjuntos entre rondas |
| `sceptreUsed: boolean` | resolver de arena | ¿ya se usó el (U)se Cetro cuando ocurrió esa ronda? |

El dato ya estaba en el snapshot (`s.enemies` es `Array<{x,y}>`); sólo se descartaba al
registrar. Coste: dos líneas por call-site.

**Con eso, las tres preguntas se contestan post-hoc desde el JSONL + `combatmaps.json`, sin
tocar el run.** El analizador necesita: `ax,ay` (tirador), la celda que desaparece de
`enemyCells` (víctima), y el raycast de `isRangedPathClear` sobre los tiles de la sala.

---

## 1. #103 Hythloth r7 — ¿VICTORY fabricada?

**Estado**: censo = **VICTORY**. Los 6 enemigos están tras `0x42 WoodFloorShipTie` ×16, que
el binario **BLOQUEA** y el port (antes del fix) dejaba pasar. `0x42` **no** es barrera del
Shadowlord ⇒ el Cetro no lo disuelve ⇒ **no hay mecanismo legítimo de reserva**.

> **PREGUNTA**: ¿existe alguna ronda en la que una celda desaparezca de `enemyCells`
> mientras el tirador (`ax,ay`) NO estaba adyacente a esa celda (Chebyshev > 1) **y** el
> segmento entre ambos contiene al menos un `0x42`?

- **SÍ** → la baja vino por un disparo que el original no permite ⇒ **la VICTORY se retira**
  y #103 pasa a dead-end fiel.
- **NO** (todas las bajas con Chebyshev ≤ 1, o sin `0x42` en medio) → VICTORY legítima.

**Predicción con el fix ya aplicado**: el port ya no dispara a través de `0x42`, así que lo
esperable es que #103 **flipe a DEADEND por sí sola**. Si sigue dando VICTORY, hay una vía que
no habíamos modelado (movilidad enemiga, trigger) y **eso** hay que mirarlo.

## 2. #65 Covetous r1 — ¿DEAD-END fabricado? (cerrado en estático, falta confirmar en vivo)

**Estado**: censo = **DEADEND-fiel**. Ya está resuelto por lectura
(`censo-reauditoria-0x6a14.md` §Addendum 3): los 10 enemigos del bolsillo oeste son
alcanzables a través de `(4,5)=0x8a` lápida + vacío `0xff`, ambos **transparentes** en
`0x6a14`; el port bloqueaba `0xff`. El sello **es fabricado**.

> **PREGUNTA**: ¿desaparece alguna celda de `enemyCells` con `x ≤ 3` y `4 ≤ y ≤ 6` (el
> bolsillo), habiendo estado el tirador en `x ≥ 5`?

- **SÍ** → confirmado en vivo: el dead-end era fabricado y #65 pasa a VICTORY.
- **NO** → el estático dice que debería poder; si no ocurre, el resolvedor no está
  intentando el disparo (problema de ARNÉS, no de fidelidad) y hay que mirar por qué.

**Predicción**: con el fix, #65 **flipa de DEADEND a VICTORY**. Es el flip esperado, **no una
regresión** — que el resello no lo lea como rojo.

## 3. #125 Doom r13 — ¿coartada del Cetro?

**Estado**: censo = **VICTORY**. 14/16 enemigos sólo alcanzables con la tabla del port, pero
sus tiles son `0x7X ShadowlordBoundary`, que **el Cetro SÍ disuelve** — y el capítulo usa
Cetro. La coartada es plausible; hay que confirmarla.

> **PREGUNTA**: de las rondas en que desaparece una celda de `enemyCells`, ¿**todas** tienen
> `sceptreUsed === true`?

- **TODAS posteriores** → coartada **confirmada**: las bajas ocurren con la barrera ya
  disuelta ⇒ VICTORY legítima.
- **ALGUNA anterior** → hubo bajas con la barrera EN PIE ⇒ ese subconjunto es fabricado y la
  VICTORY se revisa.

## 4. ch18 — **CERRADO EN ESTÁTICO: LIMPIO**. No requiere discriminador

Encargo explícito: «no lo asumas en ninguna dirección». Medido, no asumido — y por el camino
salió una trampa que conviene dejar escrita:

**ch18 NO juega la sala #103.** Su spec la llama «#103 (5 Dragon)», pero eso es el **campo
`index`** del JSON, no la posición del array. `index = 103` ⇒ **posición 119 = Doom r7**
(5 unidades ✓). La posición 103 es **Hythloth r7** (6 unidades). Es exactamente la trampa de
`combatmap N = array pos N`, y aquí habría hecho confundir la sala de ch18 con la única
VICTORY sin coartada del censo.

**Doom r7 (array 119), medido**:

| | melé | LOS con tabla del PORT | LOS con tabla del BINARIO |
|---|---|---|---|
| entrada east | 3/5 | **5/5** | **5/5** |
| entrada west | 1/5 | **5/5** | **5/5** |
| entrada south | 1/5 | **5/5** | **5/5** |
| entrada north | 3/5 | **5/5** | **5/5** |

Y **no contiene ningún `0x42` ni `0x46`**. ⇒ La victoria a arco de ch18 es **independiente de
la tabla**: sale 5/5 con la correcta y con la equivocada. **Limpio de verdad**, no «limpio por
ausencia de mi barrido».

**Corolario sobre la circularidad**: el #44 justificó abrir `0x42` diciendo que «la sala de
dragones pasa de LOS 0/5 a 5/5, casa con la victoria a arco de ch18». Esa sala **no tiene
`0x42`**, así que el `0/5` no venía de ahí — venía de la aproximación `rangeWeaponPassable`
anterior, que bloqueaba otros tiles de la sala. El razonamiento circular existió, pero **su
conclusión sobre ch18 resulta correcta por otra vía**. Se corrige el argumento, no el
veredicto.

---

## Resumen para el resello

| # | sala | pregunta | flip esperado con el fix |
|---|---|---|---|
| 1 | #103 Hythloth r7 | ¿baja sin melé con `0x42` en medio? | VICTORY → **DEADEND** |
| 2 | #65 Covetous r1 | ¿cae alguien del bolsillo (x≤3, 4≤y≤6)? | DEADEND → **VICTORY** |
| 3 | #125 Doom r13 | ¿todas las bajas con `sceptreUsed`? | sin flip (coartada) |
| 4 | ch18 / Doom r7 | — | sin flip (5/5 en ambas tablas) |

**Dos flips esperados y ninguno es regresión**: son el fix haciendo su trabajo en las dos
direcciones — retirando una victoria que el original no permite y devolviendo una que sí.
