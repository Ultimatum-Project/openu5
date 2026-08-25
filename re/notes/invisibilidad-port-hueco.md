# Invisibilidad: el port la modela como «no dibujar», el binario como «cambiar el tile» — hueco NOMBRADO, equivalencia SIN RESOLVER

> **🔒 CERRADA el 2026-08-05 por el testigo DOSBox de la ficha #42 —
> [`invisibilidad-testigo.md`](invisibilidad-testigo.md).** Resultado: el §3.1 (la
> asimetría party/enemigo) **se confirma**; la conjetura del §3 («si el render de combate
> usa esa tabla, el invisible se dibuja como un PUENTE») **se REFUTA**: el campo +1 se
> blitea con el **banco alto** de sprites, así que `0x1d` es el tile `0x11D` —una silueta
> humanoide hueca de contorno cian—, y por el banco de terreno (donde `0x1d` = Bridge) ese
> byte no pasa nunca. El §4 («el experimento que cierra esto, no lo he hecho») está hecho.
> Esta nota se conserva como estaba: **la duda estaba bien planteada, y el mérito de haber
> parado justo donde paró es lo que hizo barato el testigo.**

Carril `asm100` (L0, comprobación de port) · 2026-08-05 · main `91d5fa3d`.
Encargo del lead: comprobar en el port las tres mecánicas que dejaron falsables las lecturas
de `CAST.OVL:0x0afe` (Sanct Lor) y `CAST.OVL:0x074c` (Wis Quas), acotado en tiempo.

**Las tres se comprobaron. Dos pasan. La tercera es un hueco real y NO lo arreglo aquí**
(regla del lead: una causa por rama).

---

## 1. ★ Primero, lo que cambia el marco: la derivación YA ESTABA EN EL PORT

`game/src/core/combat/combat.ts:591-597`, comentario existente:

> «Ring of Invisibility (44→42, 0x2A): el binario lo marca invisible en el … `or [actor+2],0x10`
> = flag de invisibilidad, **el MISMO que Sanct Lor pone y que Wis Quas limpia**»

y en `:2273` / `:2276`, literalmente:

```ts
case "invisibilitySelf":  cur.invisible = true;   // Sanct Lor CAST:0x0afe — sin RNG
case "revealInvisible":   this.castReveal();      // Wis Quas CAST:0x074c — sin RNG
```

**El port ya nombraba `CAST:0x0afe` como Sanct Lor y `0x074c` como Wis Quas.** Mi refutación
del ledger (que las llamaba `self_transform_rat` y `untransform_actors`) es correcta e
independiente, **pero no era nueva para el proyecto: era nueva para el LEDGER.** Es, otra
vez, el género que #51 y #76 encontraron dos veces — *«la lectura existe y nadie la cruzó»*.

> **Consecuencia para la campaña**, y creo que es el hallazgo más útil de esta comprobación:
> las 97 heredadas no son sólo «cuerpos sin leer». Parte de ellas son **cuerpos ya
> derivados en el PORT cuyo nombre el ledger no recogió**. Antes de mandar a nadie a leer
> ASM conviene cruzar contra los comentarios de `game/src/core/**` — es más barato que el
> disasm y ya ha acertado dos veces.

## 2. Las tres comprobaciones

| # | mecánica derivada del binario | ¿el port? | dónde |
|--:|---|---|---|
| 1 | **bit `0x10` = invisible** | ✅ **sí** | `combat.ts:174` (`invisible: boolean`), y el arnés de paridad lo lee del registro real: `combat-run.ts:290` `c.invisible = (rec.flags & 0x10) !== 0` |
| 2 | **Wis Quas EXCLUYE al party** | ✅ **sí** | `combat.ts:2649-2653`: `if (c.kind !== "player" && c.invisible) c.invisible = false;` — excluye jugadores **y** exige que ya fuera invisible, los dos filtros del binario (`[si]&0x80` → saltar; `!([si]&0x10)` → saltar) |
| 3 | **par tile BASE (+0) / tile de RENDER (+1)** | ❌ **NO** | ver §3 |

El tercer filtro del binario (`[si]==0`, ranura vacía) queda satisfecho por construcción: el
port itera `this.combatants`, que sólo contiene ranuras vivas.

**Corroboración lateral**: `combat.ts:92` define `SHADOWLORD_TYPE = 0x2f  // ve invisibles`
citando `COMBAT:0x0D30`. El `0x2f` es **la primera comparación** de
`actor_type_immune_to_status_magic` (`CAST.OVL:0x0`, leída en la tanda 1). Dos rutas
distintas del binario, el mismo tipo especial.

## 3. El hueco: dos mecanismos distintos, equivalencia NO establecida

- **El binario NO oculta al actor.** `0x0afe` escribe `0x1d` en el campo `+1` de la entrada
  de la tabla de actores de mundo (`0x5C5A`, paso 8) — el **tile de render** —, dejando el
  `+0` (tile base) intacto. `0x074c` deshace justamente eso copiando `+0 → +1`. El actor
  **se sigue dibujando**; lo que cambia es CON QUÉ.
- **El port sí lo oculta.** `skin/coreview.ts:860` y `:1519` filtran el actor fuera de la
  lista de dibujo: `.filter((c) => !(c.kind === "enemy" && c.invisible))`. No existe ningún
  campo de tile-de-render separado del tile base.

**¿Es equivalente?** No lo sé, y no lo voy a suponer. Medido: en `TileData.json` el índice
**`0x1d` (29) se llama `"Bridge"`** — no es un tile en blanco ni transparente. Si el
combate del original interpreta ese campo por la misma tabla, un actor invisible se dibuja
**como un puente**, no desaparece — y entonces port y binario se ven distinto. **No he
verificado que la ruta de render de combate use esa misma tabla**, y ahí es donde paro.

### 3.1 Y hay una ASIMETRÍA que sí es concreta, sin depender de qué pinte `0x1d`

`0x0afe` escribe el tile de render **sin mirar el bit de party**: se lo aplica a quien lo
lance. El port, en cambio, sólo esconde **enemigos** (`c.kind === "enemy"` en los dos
filtros de `coreview`). Como `cur.invisible = true` sí se le pone a un **jugador** que lance
Sanct Lor (`combat.ts:2273`):

> **Un PJ que lanza Sanct Lor: en el binario cambia lo que se dibuja de él; en el port se
> sigue dibujando igual.** El efecto de ocultación del port es asimétrico entre party y
> enemigos, y el del binario no lo es.

Esto no depende de qué sea `0x1d`: depende sólo de que el binario no comprueba el party al
escribir y el port sí al dibujar.

## 4. El experimento que cierra esto (barato, no lo he hecho)

Testigo en DOSBox: entrar en combate, lanzar **Sanct Lor** con un PJ y **mirar qué se
dibuja** en su casilla —¿desaparece, se vuelve puente, parpadea?—; luego **Wis Quas** sobre
un enemigo invisible y comprobar que vuelve su sprite original. Una corrida resuelve a la
vez qué pinta `0x1d` y la asimetría del §3.1. Instancia headless propia, run-dir propio
(nunca el DOSBox del usuario).

## 5. Lo que esta ficha NO hace

- **No arregla nada.** Una causa por rama; el arreglo, si lo hay, va aparte y después del
  testigo.
- **No declara un defecto.** Declara **dos mecanismos distintos** y una asimetría concreta.
  Llamarlo «defecto» exige el testigo del §4 — y las tres rutinas están marcadas
  `coverage` PARCIAL/AUSENTE precisamente porque nadie lo había mirado.
- **No revisa Ring of Invisibility ni la poción negra** (`usePotion.ts:116` pone el mismo
  flag), que llegan al mismo estado por otras dos vías y heredarían el mismo hueco.
- **No mide el overworld**: todo lo de arriba es la arena de combate.
