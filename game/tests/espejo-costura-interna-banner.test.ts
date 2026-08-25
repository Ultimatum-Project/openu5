/**
 * ★★ EL NÚMERO DE `enterLoc` NO ESTÁ ESCRITO A MANO: sale del BANNER del propio corpus.
 *
 * Vive APARTE de `espejo-costura-interna.test.ts` por una razón mecánica, no estética: este
 * aserto lee `assets/data.json` (la tabla `locationNames`, material de EA que NO viaja al árbol
 * público), así que el fichero tiene que quedar fuera de `test:pure` — y los otros 17 tests del
 * carril, que no leen nada de `assets/`, **se quedan dentro del CI público**. Meter los 18 en un
 * solo fichero habría exiliado también la guarda del ORDEN DEL BUCLE, que es la única que caza el
 * mutante m4a (la mutación que deja el ticket inerte con todo en verde).
 *
 * Medido con la sonda del árbol desnudo (worktree detached sin `game/assets` + `test:pure`), que
 * es lo que destapó el reparto: de los 18, sólo éste caía.
 * [[control-negativo-enumera-lo-que-se-le-ocurrio-al-autor]]
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { seamLocationFromBanner, type Route } from "../e2e/espejo-tour/runner";

const HERE = dirname(fileURLToPath(import.meta.url));
const ESPEJO = join(HERE, "..", "e2e", "espejo-tour");
const AD09 = JSON.parse(readFileSync(join(ESPEJO, "routes-ad", "ad09.route.json"), "utf8")) as Route;
const DATA = JSON.parse(readFileSync(join(HERE, "..", "assets", "data.json"), "utf8")) as {
  locationNames: string[];
};

describe("cableado en el corpus — el `enterLoc` de `ad09-g04` se DERIVA, no se teclea", () => {
  const seg = AD09.segments.find((s) => s.id === "ad09-g04")!;

  it("★★ el 26 es el que `seamLocationFromBanner` saca del BANNER del bloque 164", () => {
    // El bloque 164 del LP: «Enter keep B0RDERMARCH BVRDERMARCH». La location se resuelve con el
    // MISMO resolvedor que usan las costuras de segmento, contra la tabla viva de `locationNames`.
    // Dos artefactos independientes: el OCR de la ruta y el número del overlay. Si alguien teclea
    // otro id (o el segmentador re-deriva el banner), esto cae.
    const banner = seg.expect.find((b) => b.ocrLn === 164)!.text;
    const derivada = seamLocationFromBanner(banner, DATA.locationNames);

    expect(derivada, "el banner del LP tiene que resolver a una location").not.toBeNull();
    expect(seg.script.find((o) => o.enterLoc != null)!.enterLoc).toBe(derivada);
    // Y el mismo 26 que ya citan el `ledgerCite` del bloque de compra y el
    // `shopTownIndex("Blacksmith", 26)` del herrero — tres canales que no se hablan entre sí.
    expect(derivada).toBe(26);
  });

  it("CONTROL — el resolvedor NO devuelve 26 para un banner cualquiera (no casa por casualidad)", () => {
    expect(seamLocationFromBanner("Enter towne MINOC", DATA.locationNames)).toBe(5);
    expect(seamLocationFromBanner("zzzz qqqq", DATA.locationNames)).toBeNull();
  });
});
