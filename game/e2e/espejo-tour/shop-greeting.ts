/**
 * SALUDO DE TIENDA = BLOQUE NO-COMPARABLE (ventana `comparador-bandas`).
 *
 * ── EL MECANISMO (adjudicado contra el binario, `re/notes/shop-saludo-acta.md`) ──────────────
 * `SHOPPES.OVL 0x01b6` elige la plantilla del saludo con **`rand_range(0,3)` del stream VIVO,
 * POR VISITA**: el tipo de tienda elige la FILA de la tabla 2D DS `0x3b2a` y el rand la COLUMNA.
 * El port está calcado (`shop-console.ts`, `game.shopGreetingRand(0,3)` sobre el mismo generador).
 * El propio corpus lo confirma: Regina saluda con la variante 0 y con la 3 **dentro de una misma
 * parte**, y 11 de los 13 tenderos con ≥2 saludos cambian de variante.
 *
 * ⇒ con el port PERFECTAMENTE FIEL, la probabilidad de que su tirada coincida con la que grabó el
 * LP es **1/4**. El bloque del saludo tiene por tanto un prior de **3/4 de salir `divergent` por
 * construcción**, y ningún fix lo mejora: sólo lo mejoraría clavar la variante, que es justamente
 * romper la fidelidad. No es deuda del port — es un dado de cuatro caras dentro del denominador.
 *
 * ── EL PREDICADO: ESTRUCTURAL, sin umbrales y sin texto del juego ────────────────────────────
 * No se comparan plantillas contra el bloque. El corpus YA SABE dónde está el saludo:
 * `derive-anchors.mjs` deriva cada ancla de mercader **del propio bloque del saludo**
 * (`{kind:"npc", cmd:"talk", match:"shop:<Tipo>", ocrLn: b.ocrLn}` con `b` = ese bloque). Así que
 * el predicado es un JOIN por `ocrLn` dentro del segmento: cero similitud, cero umbral, y **cero
 * literales del juego en fichero tracked** (REGLA 4 del repo: material de EA jamás va tracked).
 *
 * ── 🔴 EL HERRERO NO ENTRA, Y NO ES UN DETALLE ──────────────────────────────────────────────
 * Un predicado sobre todo `shop:*` sería INCORRECTO. El **Blacksmith** no pasa por `0x01b6`: su
 * fila de la tabla está a CERO y saluda por vía propia (`SHOPPES 0x12b2`) con una plantilla FIJA
 * (`"Good @, and welcome to #!"`, donde `@` es sólo la parte del día). Su saludo **es
 * adjudicable**, y excluirlo borraría material bueno — **12 bloques** del corpus AD. Por eso el
 * predicado se ata a `SHOPPE_GREETING_INDEX`, que es precisamente la tabla de la que el
 * Blacksmith está AUSENTE: el mismo dato que decide que el port tire el dado decide aquí que el
 * bloque no sea comparable.
 *
 * Queda FUERA a propósito (lado conservador, declarado en el pre-registro): los saludos SIN ancla
 * derivada, y la cola `rand(0,1)` del propio saludo del herrero.
 */
import { SHOPPE_GREETING_INDEX } from "../../src/core/shops/shoppe-greetings.js";

/** Tipos con fila de pool en DS 0x3b2a ⇒ su saludo lo elige `rand_range(0,3)`. Sale de la MISMA
 *  tabla que usa el port, así que no puede divergir de él por edición. */
const POOL_TYPES: ReadonlySet<string> = new Set(Object.keys(SHOPPE_GREETING_INDEX));

/** Los tipos de tienda con pool, en orden, para los tests y el censo. PURO. */
export const shopGreetingPoolTypes = (): string[] => [...POOL_TYPES].sort();

/** Forma mínima que necesita el predicado (evita acoplar este módulo al tipo `Op` del runner). */
export interface AnchorLike {
  kind?: string;
  match?: string;
  ocrLn?: number;
}

/**
 * `ocrLn` de los bloques que son SALUDO DE POOL en este segmento: por cada ancla de NPC cuyo
 * `match` es `shop:<Tipo>` con `<Tipo>` en la tabla de pool, la línea de la que se derivó.
 * Devuelve un Set vacío si no hay ninguna — nunca `undefined`, para que un consumidor no pueda
 * fabricar un veredicto con un `?? []` silencioso. PURO.
 */
export function shopGreetingLines(anchors: Iterable<AnchorLike | undefined>): Set<number> {
  const out = new Set<number>();
  for (const a of anchors) {
    if (!a || a.kind !== "npc" || typeof a.ocrLn !== "number") continue;
    const m = a.match;
    if (typeof m !== "string" || !m.startsWith("shop:")) continue;
    if (!POOL_TYPES.has(m.slice(5))) continue; // ← el Blacksmith se cae AQUÍ
    out.add(a.ocrLn);
  }
  return out;
}
