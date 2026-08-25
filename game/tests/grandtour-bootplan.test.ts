/**
 * Grand Tour — política de arranque INDEPENDIENTE DE PIEL (task #16).
 *
 * Unit-testea `bootPlan` (la parte PURA de `bootWorld`): la derivación
 * opts → env → default de piel, y la URL/click que de ahí salen. El driver Playwright
 * (`bootWorld` en nav.ts) queda fuera — lo ejercitan las specs del tour end-to-end.
 *
 * El invariante clave de #16: bajo la piel FIEL el plan NO clica el título DOM
 * (`.title-new` sólo existe en `DevSkin`) y añade `&nointro` para montar el mundo
 * directo; bajo dev conserva el arranque histórico. Tras probar la pureza de render a
 * escala (ch02-ch07 byte-idénticos en ambas pieles), la FIEL es el default y
 * `U5_TOUR_SKIN=dev` conmuta de vuelta.
 */
import { describe, expect, it } from "vitest";
import { bootPlan } from "../e2e/grandtour/bootPlan";

describe("bootPlan — piel efectiva (opts › env › default)", () => {
  it("sin opts ni env: piel FIEL (default post-fase 2, el usuario quiere verlo así)", () => {
    expect(bootPlan().skin).toBe("faithful");
    expect(bootPlan(undefined, undefined).skin).toBe("faithful");
  });

  it("U5_TOUR_SKIN=dev conmuta de vuelta a la piel dev", () => {
    expect(bootPlan(undefined, "dev").skin).toBe("dev");
  });

  it("cualquier otro valor de env cae al default FIEL (no rompe)", () => {
    expect(bootPlan(undefined, "faithful").skin).toBe("faithful");
    expect(bootPlan(undefined, "").skin).toBe("faithful");
    expect(bootPlan(undefined, "1988").skin).toBe("faithful");
  });

  it("opts.skin manda sobre el env en ambos sentidos", () => {
    expect(bootPlan({ skin: "faithful" }, "dev").skin).toBe("faithful");
    expect(bootPlan({ skin: "dev" }, "faithful").skin).toBe("dev");
  });
});

describe("bootPlan — URL y click derivados de la piel", () => {
  it("fiel por defecto: ?skin=faithful&nointro SIN panel debug (no tapa la 1988) y NO clica título", () => {
    // La costura de arnés (__u5debug) se expone SIEMPRE; ?debug=1 sólo abre el panel
    // visual, que bajo la piel 1988 taparía el juego (petición del usuario 2026-07-16).
    expect(bootPlan()).toEqual({
      skin: "faithful",
      lang: "en",
      url: "/?skin=faithful&nointro",
      clickTitle: false,
    });
  });

  it("fiel con debug:true explícito: abre el panel (opt-in)", () => {
    expect(bootPlan({ debug: true })).toEqual({
      skin: "faithful",
      lang: "en",
      url: "/?skin=faithful&debug=1&nointro",
      clickTitle: false,
    });
  });

  it("dev (via env): ?skin=dev&debug=1 y clica el título DOM", () => {
    expect(bootPlan(undefined, "dev")).toEqual({
      skin: "dev",
      lang: "en",
      url: "/?skin=dev&debug=1",
      clickTitle: true,
    });
  });

  it("dev con debug:false: sin panel al arrancar, sigue clicando el título", () => {
    expect(bootPlan({ skin: "dev", debug: false })).toEqual({
      skin: "dev",
      lang: "en",
      url: "/?skin=dev",
      clickTitle: true,
    });
  });

  it("el orden de params es estable skin → debug → nointro (URL determinista)", () => {
    // Determinismo del arnés: la URL no depende del orden de propiedades de opts.
    expect(bootPlan({ debug: true, skin: "faithful" }).url).toBe("/?skin=faithful&debug=1&nointro");
  });
});

describe("bootPlan — idioma (opts › env › default en)", () => {
  it("sin nada: idioma en (el suelo del calco), URL SIN ?lang (byte-idéntica al histórico)", () => {
    expect(bootPlan().lang).toBe("en");
    expect(bootPlan().url).not.toContain("lang");
    expect(bootPlan(undefined, undefined, undefined).lang).toBe("en");
  });

  it("U5_TOUR_LANG=es conmuta a español y añade &lang=es AL FINAL de la URL", () => {
    expect(bootPlan(undefined, undefined, "es")).toEqual({
      skin: "faithful",
      lang: "es",
      url: "/?skin=faithful&nointro&lang=es",
      clickTitle: false,
    });
  });

  it("es es case-insensitive; cualquier otro valor cae a en (no rompe)", () => {
    expect(bootPlan(undefined, undefined, "ES").lang).toBe("es");
    expect(bootPlan(undefined, undefined, "").lang).toBe("en");
    expect(bootPlan(undefined, undefined, "fr").lang).toBe("en");
    expect(bootPlan(undefined, undefined, "en").lang).toBe("en");
  });

  it("opts.lang manda sobre el env en ambos sentidos", () => {
    expect(bootPlan({ lang: "en" }, undefined, "es").lang).toBe("en");
    expect(bootPlan({ lang: "es" }, undefined, undefined).url).toBe("/?skin=faithful&nointro&lang=es");
  });

  it("es con dev: &lang=es tras skin/debug (sin nointro), determinista", () => {
    expect(bootPlan({ lang: "es" }, "dev")).toEqual({
      skin: "dev",
      lang: "es",
      url: "/?skin=dev&debug=1&lang=es",
      clickTitle: true,
    });
  });
});
