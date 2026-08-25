/**
 * AUDITORÍA G2 — cierre del blind-spot del sink `name:` del picker de (U)se.
 *
 * EL AGUJERO (auditoría de calidad, hallazgo G2, ALTA): las filas de
 * `buildUseRows` emiten su nombre por la propiedad `name:`, que el extractor de
 * strings user-facing NO barre (sus sinks son text:/message:/push/hud.*). Con
 * literales inline, un nombre de ítem del picker podía fabricarse o divergir sin
 * ponerse rojo, y los 3 Shards estaban FUERA de approved-strings y de es.json →
 * se pintaban EN INGLÉS bajo lang=es (mismo patrón que la fuga LOOT_OPEN_NAMES
 * que cazó el soak b15).
 *
 * EL CIERRE: los nombres viven en la constante `USE_ITEM_NAMES` (usePicker.ts),
 * ALLOWLISTADA en DISPLAY_CONSTS del extractor → cada nombre queda bajo la
 * guarda anti-fabricación (string-manifest) y es key traducible del choke t().
 *
 * DEMOSTRACIÓN (caso que ANTES pasaba y AHORA falla): con el código pre-fix
 * (literales inline en `name:`), el primer test de este fichero FALLA — el
 * extractor no afloraba "Shard of Falsehood"/"Shard of Hatred"/"Shard of
 * Cowardice" (verificado ejecutando el extractor sobre el árbol pre-fix).
 */
import { describe, it, expect, afterEach } from "vitest";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { extractUserStrings } from "../tools/extract-user-strings.mjs";
import { buildUseRows, type UseRowsState } from "../src/core/usePicker.js";
import { t, setLang } from "../src/i18n/index.js";
import approved from "./fixtures/approved-strings.json";

const HERE = dirname(fileURLToPath(import.meta.url));
const CORE = join(HERE, "..", "src", "core");

/**
 * Los 3 Shards con el nombre de la NAME-TABLE 0x1916 (`Shard/Falsehd`…), no el largo
 * inventado (`Shard of Falsehood`) que el picker emitía antes del careo side-by-side.
 */
const SHARD_NAMES = ["Shard/Falsehd", "Shard/Hatred", "Shard/Cowrdce"];

/** Estado con TODO poseído: aflora todas las filas (y por tanto todos los nombres). */
function fullState(): UseRowsState {
  return {
    scrollQuantities: Array(8).fill(1),
    potionQuantities: Array(8).fill(1),
    magicCarpets: 1,
    skullKeys: 1,
    moonstones: Array.from({ length: 8 }, () => ({ buried: false })),
    shards: { falsehood: true, hatred: true, cowardice: true },
    lbArtifacts: { amulet: true, crown: true, sceptre: true },
    specialItems: {
      spyglass: true,
      hmsCape: true,
      sextant: true,
      pocketWatch: true,
      blackBadge: true,
      woodenBox: true,
    },
  };
}

describe("G2 — nombres del picker de (U)se bajo la guarda anti-fabricación", () => {
  it("el extractor aflora los nombres del picker (incl. los 3 Shards)", () => {
    const live = extractUserStrings(CORE) as Map<string, string>;
    for (const name of SHARD_NAMES) {
      expect(live.has(name), `extractor no aflora ${JSON.stringify(name)}`).toBe(true);
    }
  });

  it("cada nombre de ítem/herramienta de buildUseRows está en approved-strings (con cita)", () => {
    const manifest = approved as Record<string, string>;
    for (const row of buildUseRows(fullState())) {
      // Las filas con SIGILO de formato (`*` pergamino, `!` poción, `(` gema lunar) se
      // excluyen: su `name` NO es prosa, es la entrada codificada de la name-table
      // 0x1916 (`*IS`, `!Yellow`, `(0`) que la piel decodifica en
      // decoración + cadena-lado. Lo user-facing de esas filas —los colores de poción
      // (DS 0x19C2) y el `"Moonstone "` de DS 0x9788— vive en el corpus de datos
      // (data.json) y en la piel, no en el manifiesto del core.
      if (/^[*!(]/.test(row.name)) continue;
      expect(manifest[row.name], `fila ${JSON.stringify(row.name)} sin entrada en approved-strings`).toBeTruthy();
    }
  });

  describe("los 3 Shards se traducen bajo lang=es (antes salían en inglés)", () => {
    afterEach(() => setLang("en", { persist: false }));
    it("t() da castellano para los 3", () => {
      setLang("es", { persist: false });
      expect(t("Shard/Falsehd")).toBe("Fragm/Falsedad");
      expect(t("Shard/Hatred")).toBe("Fragm/Odio");
      expect(t("Shard/Cowrdce")).toBe("Fragm/Cobardía");
    });
  });
});
