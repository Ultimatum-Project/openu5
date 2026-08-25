/**
 * DEFECTOS DE FÁBRICA DEL ARRANQUE — layout partido en móvil, inglés siempre.
 *
 * ENCARGO DEL USUARIO (02-08): «layout partido por defecto e inglés por defecto siempre».
 *
 * POR QUÉ. Añadió el port a la pantalla de inicio del iPhone y lo vio «con la versión
 * antigua de botones marrones, sin layout partido». No era una versión vieja: la app
 * instalada arranca con una PARTICIÓN DE ALMACENAMIENTO PROPIA, vacía, así que ni el
 * layout ni el idioma persistidos viajan — y lo mismo le pasa a cualquiera que entre por
 * PRIMERA VEZ desde un móvil. El defecto, no la preferencia, es lo que ve el mundo.
 *
 * ★ #333 pieza A1 (16-08) — EL GATE DE RÉGIMEN, encima de todo lo anterior: decisión del
 * usuario (delegada al lead): «en puntero no táctil el partido ni se ofrece ni se
 * restaura». La regla del 02-08 («la preferencia manda siempre, en los dos sentidos»)
 * sigue viva EN TÁCTIL; en escritorio el gate va primero y ni la preferencia ni la
 * bandera lo saltan. §1-bis ata el gate; §1 quedó reescrito con esa procedencia.
 *
 * QUÉ ATA ESTE FICHERO:
 *   §1  Los CUATRO casos del layout: sin preferencia × {móvil, escritorio}, y preferencia
 *       {a favor, en contra}. La preferencia manda sobre el defecto en LOS DOS SENTIDOS
 *       — desde el 16-08, dentro del régimen táctil (§1-bis).
 *   §1-bis  El gate de régimen de #333 A1: escritorio ⇒ ni arranca ni se ofrece, con
 *       preferencia guardada, con `u5.reflow` y con `?reflow=cuadrado` (los tres senderos
 *       MEDIDOS del bug).
 *   §2  La definición MEDIDA de «móvil» (`pointer: coarse`), y que el ESCRITORIO no se mueve.
 *   §3  La bandera como TRI-ESTADO, y su coherencia mecánica con `reflowFlag`.
 *   §4  El invariante arranque ⟹ disponible sobre la rejilla 3×3×2 COMPLETA.
 *   §5  El idioma: inglés de fábrica, SIN detección del navegador — y con la preferencia
 *       persistida y `?lang=` mandando por encima.
 *
 * ⚠ §5 documenta un HALLAZGO, no un cambio: al medir, el inglés YA era el arranque de
 * fábrica (`readStoredLang` → `resolveLang(null)` → `BASE_LANG`) y NO hay ni ha habido
 * detección de `navigator.language`. Lo que aporta este bloque es la GUARDA: si mañana
 * alguien añade esa detección «para ser amable», estos tests se ponen rojos.
 */
import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import {
  esPantallaTactil,
  layoutPartidoBandera,
  layoutPartidoDisponible,
  layoutPartidoInicial,
  reflowFlag,
} from "../src/skin/portrait/skin.js";

/**
 * Fija el ENTORNO que lee el decisor: puntero primario y query string.
 *
 * 🔴 #336 — ANTES estos tests inyectaban un `mm` por parámetro, y ése era un asiento que
 * la PRODUCCIÓN no ocupaba jamás: `esPantallaTactil` sólo se llama sin argumentos. El
 * aserto medía un camino que el jugador no recorre (clase #335). Ahora se fija
 * `window.matchMedia`, que es EL camino real — el mismo arnés que usa
 * `regimen-tactil-vivo.test.ts` sobre la primitiva.
 */
function fijarEntorno(opts: {
  coarse?: boolean;
  search?: string;
  matchMedia?: "ausente" | "lanza";
}): void {
  const win: Record<string, unknown> = { location: { search: opts.search ?? "" } };
  if (opts.matchMedia === "lanza") {
    win.matchMedia = (): never => {
      throw new Error("matchMedia rota");
    };
  } else if (opts.matchMedia !== "ausente") {
    win.matchMedia = (q: string) => ({ matches: q === "(pointer: coarse)" && !!opts.coarse });
  }
  vi.stubGlobal("window", win);
}

describe("§1 layout partido: los cuatro casos del defecto de fábrica", () => {
  it("SIN preferencia + MÓVIL → arranca PARTIDO (el cambio que pide el encargo)", () => {
    expect(layoutPartidoInicial(null, null, true)).toBe(true);
  });

  it("SIN preferencia + ESCRITORIO → arranca CLÁSICO (el escritorio NO se toca)", () => {
    expect(layoutPartidoInicial(null, null, false)).toBe(false);
  });

  it("CON preferencia A FAVOR → partido EN TÁCTIL; en escritorio ya no (decisión 16-08)", () => {
    // ~~«partido, esté donde esté»~~ — así lo fijó la regla del 02-08, y así estuvo hasta
    // el 16-08: la decisión del usuario (delegada al lead, ficha #333) es que en puntero
    // no táctil el partido ni se ofrece ni se restaura — sin deck (que es táctil) el
    // partido es una pantalla a medias, y restaurarlo en escritorio era el bug #333.
    // La preferencia sigue mandando EN TÁCTIL; el caso escritorio pasa a §1-bis.
    expect(layoutPartidoInicial(true, null, true)).toBe(true);
    expect(layoutPartidoInicial(true, null, false)).toBe(false);
  });

  it("CON preferencia EN CONTRA → clásico, esté donde esté (el ▤ apaga y el apagado manda)", () => {
    // ÉSTE es el caso que hace del ▤ un interruptor de verdad: en un móvil, donde el
    // defecto dice «partido», la preferencia en contra tiene que ganar. Si no, el botón
    // parecería roto tras recargar — que es justo el defecto que se arregló el 28-07 con
    // la bandera y que este encargo no puede reintroducir por la puerta del defecto.
    expect(layoutPartidoInicial(false, null, true)).toBe(false);
    expect(layoutPartidoInicial(false, null, false)).toBe(false);
  });

  it("la preferencia manda también sobre la BANDERA (regla del 28-07, intacta EN TÁCTIL)", () => {
    // La URL del deploy lleva `reflow=cuadrado`: sin esta precedencia el apagado no
    // sobrevivía a la recarga.
    // ~~`layoutPartidoInicial(true, false, false) === true`~~ — el segundo aserto vivía
    // en escritorio y lo reescribe la decisión del 16-08 (#333 A1): la precedencia
    // preferencia>bandera se afirma ahora donde sigue existiendo, en táctil.
    expect(layoutPartidoInicial(false, true, true)).toBe(false);
    expect(layoutPartidoInicial(true, false, true)).toBe(true);
  });
});

describe("§1-bis el gate de régimen de #333 A1: en escritorio el partido ni arranca ni se ofrece", () => {
  // Los tres senderos MEDIDOS del bug (Chromium 1440×900, pointer:fine — docblock de
  // `layoutPartidoDisponible`): u5.layoutPartido=1 → guardado=true · u5.reflow=1 y
  // ?reflow=cuadrado → bandera=true. Con el puntero fino los TRES tienen que quedarse
  // fuera, en las DOS funciones. Esperados en crudo.
  it("preferencia guardada A FAVOR + escritorio → ni arranca ni se ofrece", () => {
    expect(layoutPartidoInicial(true, null, false)).toBe(false);
    expect(layoutPartidoDisponible(true, null, false)).toBe(false);
  });

  it("bandera A FAVOR (`?reflow=cuadrado`, la URL del deploy) + escritorio → ni arranca ni se ofrece", () => {
    expect(layoutPartidoInicial(null, true, false)).toBe(false);
    expect(layoutPartidoDisponible(null, true, false)).toBe(false);
  });

  it("preferencia Y bandera a favor + escritorio → el gate va primero", () => {
    expect(layoutPartidoInicial(true, true, false)).toBe(false);
    expect(layoutPartidoDisponible(true, true, false)).toBe(false);
  });

  it("`?touch=1` NO es este caso: fuerza el RÉGIMEN y entra por `tactil` (la puerta que queda)", () => {
    // El override documentado del caso ambiguo (ui/regimen-tactil.ts) llega aquí como
    // tactil=true — el gate no lo toca y la preferencia vuelve a mandar.
    expect(layoutPartidoInicial(true, null, true)).toBe(true);
    expect(layoutPartidoDisponible(true, null, true)).toBe(true);
  });
});

describe("§2 «móvil» se MIDE por el puntero, no por el user-agent", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("puntero GRUESO ⇒ táctil ⇒ el defecto es partido", () => {
    fijarEntorno({ coarse: true });
    expect(esPantallaTactil()).toBe(true);
    expect(layoutPartidoInicial(null, null, esPantallaTactil())).toBe(true);
  });

  it("puntero FINO ⇒ escritorio ⇒ el defecto sigue siendo el clásico", () => {
    fijarEntorno({ coarse: false });
    expect(esPantallaTactil()).toBe(false);
    expect(layoutPartidoInicial(null, null, esPantallaTactil())).toBe(false);
  });

  it("`?touch=1` arrastra al layout (es el override con el que se prueba el deck)", () => {
    fijarEntorno({ coarse: false, search: "?touch=1" });
    expect(esPantallaTactil()).toBe(true);
  });

  it("sin `matchMedia` (navegadores viejos) NO revienta: cae a escritorio", () => {
    // El fallback tiene que ser el defecto SEGURO (escritorio), no una excepción en el boot.
    fijarEntorno({ matchMedia: "ausente" });
    expect(esPantallaTactil()).toBe(false);
  });

  it("un `matchMedia` que LANZA cae a escritorio (no propaga al arranque)", () => {
    fijarEntorno({ matchMedia: "lanza" });
    expect(esPantallaTactil()).toBe(false);
  });
});

describe("§3 la bandera es TRI-ESTADO: pedir, apagar, o no mencionar", () => {
  it("no mencionarla ≠ apagarla", () => {
    expect(layoutPartidoBandera("")).toBe(null); // no la menciona → decide el defecto
    expect(layoutPartidoBandera("?reflow=0")).toBe(false); // la apaga EXPLÍCITAMENTE
    expect(layoutPartidoBandera("?reflow=off")).toBe(false);
  });

  it("`?reflow=0` fija el CLÁSICO incluso en móvil (es la vía del arnés y del que quiera el de antes)", () => {
    expect(layoutPartidoInicial(null, layoutPartidoBandera("?reflow=0"), true)).toBe(false);
  });

  it("las formas que la piden dan `true`", () => {
    for (const q of [
      "?reflow=1",
      "?reflow=2",
      "?reflow=force",
      "?reflow=cuadrado",
      "?reflow=cuadrado-force",
      "?skin=portrait",
      "?skin=cuadrado",
    ]) {
      expect(layoutPartidoBandera(q), q).toBe(true);
    }
  });

  it("lee `u5.reflow` con la MISMA precedencia que reflowFlag (URL > store)", () => {
    const store = (v: string | null): Pick<Storage, "getItem"> => ({ getItem: () => v });
    expect(layoutPartidoBandera("", store("1"))).toBe(true);
    expect(layoutPartidoBandera("", store("0"))).toBe(false);
    expect(layoutPartidoBandera("", store(null))).toBe(null);
    expect(layoutPartidoBandera("?reflow=0", store("1"))).toBe(false); // la URL manda
  });

  it("★ GUARDA CONTRA LA DERIVA: `reflowFlag(…) !== \"off\"` ⟺ la bandera dice `true`", () => {
    // Las dos funciones parsean lo MISMO y podrían separarse en un futuro toque. Este
    // barrido las ata: si alguien añade un alias a una y no a la otra, sale rojo aquí y no
    // en el móvil de un usuario. [[no-fijes-una-coincidencia-como-invariante]] no aplica:
    // no es una coincidencia observada, es que `layoutPartidoBandera` NACIÓ copiando
    // línea a línea la precedencia de `reflowFlag`.
    const store = (v: string | null): Pick<Storage, "getItem"> => ({ getItem: () => v });
    const QUERIES = [
      "",
      "?reflow=1",
      "?reflow=2",
      "?reflow=3",
      "?reflow=0",
      "?reflow=off",
      "?reflow=force",
      "?reflow=square",
      "?reflow=cuadrado",
      "?reflow=cuadradof",
      "?reflow=cuadrado-force",
      "?reflow=loquesea",
      "?skin=portrait",
      "?skin=cuadrado",
      "?skin=faithful",
      "?lang=es&nointro",
    ];
    for (const q of QUERIES) {
      for (const s of [null, "0", "1"]) {
        const st = store(s);
        expect(reflowFlag(q, st) !== "off", `${q} · u5.reflow=${s}`).toBe(
          layoutPartidoBandera(q, st) === true,
        );
      }
    }
  });
});

describe("§4 disponible ⊇ arranca: el ▤ existe siempre que se pueda volver", () => {
  const TRI: (boolean | null)[] = [null, true, false];

  it("★ INVARIANTE sobre la rejilla 3×3×2 COMPLETA: arrancar partido ⟹ estar disponible", () => {
    // Si se rompiera, el boot montaría un envoltorio que no se ha instanciado.
    for (const guardado of TRI) {
      for (const bandera of TRI) {
        for (const tactil of [true, false]) {
          const arranca = layoutPartidoInicial(guardado, bandera, tactil);
          const disponible = layoutPartidoDisponible(guardado, bandera, tactil);
          if (arranca) {
            expect(disponible, `guardado=${guardado} bandera=${bandera} tactil=${tactil}`).toBe(
              true,
            );
          }
        }
      }
    }
  });

  it("apagado en MÓVIL: NO arranca partido pero SÍ se ofrece (si no, no habría ▤ para volver)", () => {
    expect(layoutPartidoInicial(false, null, true)).toBe(false);
    expect(layoutPartidoDisponible(false, null, true)).toBe(true);
  });

  it("ESCRITORIO limpio: ni arranca ni se ofrece (exactamente como antes del 02-08)", () => {
    expect(layoutPartidoInicial(null, null, false)).toBe(false);
    expect(layoutPartidoDisponible(null, null, false)).toBe(false);
  });

  it("`?reflow=0` apaga TAMBIÉN el envoltorio (el «port de antes», para el arnés móvil)", () => {
    expect(layoutPartidoDisponible(null, false, true)).toBe(false);
  });

  it("la preferencia A FAVOR ofrece el envoltorio aunque la bandera lo apague — EN TÁCTIL", () => {
    // ~~`layoutPartidoDisponible(true, false, false) === true`~~ — el aserto vivía en
    // escritorio y lo reescribe la decisión del 16-08 (#333 A1, ver §1-bis): la
    // precedencia preferencia>bandera del 28-07 se afirma donde sigue existiendo.
    expect(layoutPartidoDisponible(true, false, true)).toBe(true);
    expect(layoutPartidoDisponible(true, false, false)).toBe(false);
  });
});

describe("§5 idioma: el arranque de fábrica es INGLÉS, en cualquier plataforma", () => {
  const store = new Map<string, string>();
  const REAL_NAV = Object.getOwnPropertyDescriptor(globalThis, "navigator");

  /** Importa el módulo i18n FRESCO: su idioma vivo se fija en la carga del módulo. */
  const cargarI18n = async (): Promise<typeof import("../src/i18n/index.js")> => {
    vi.resetModules();
    return import("../src/i18n/index.js");
  };

  beforeEach(() => {
    store.clear();
    vi.stubGlobal("localStorage", {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    if (REAL_NAV) Object.defineProperty(globalThis, "navigator", REAL_NAV);
    vi.resetModules();
  });

  it("SIN preferencia guardada → inglés", async () => {
    const { getLang, BASE_LANG } = await cargarI18n();
    expect(BASE_LANG).toBe("en");
    expect(getLang()).toBe("en");
  });

  it("★ un navegador en ESPAÑOL sigue arrancando en INGLÉS (no hay detección del navegador)", async () => {
    // LA GUARDA DEL ENCARGO. Hoy no existe tal detección — se midió antes de tocar nada —
    // y este test es lo que impide que aparezca: con `navigator.language` en español, el
    // arranque tiene que seguir siendo el suelo del calco.
    vi.stubGlobal("navigator", { language: "es-ES", languages: ["es-ES", "es"] });
    const { getLang } = await cargarI18n();
    expect(getLang()).toBe("en");
  });

  it("un código desconocido o basura cae al inglés, no revienta", async () => {
    const { resolveLang } = await cargarI18n();
    for (const raw of [null, undefined, "", "de", "zz-ZZ", "klingon"]) {
      expect(resolveLang(raw)).toBe("en");
    }
  });

  it("la PREFERENCIA guardada manda sobre el defecto", async () => {
    store.set("u5.lang", "es");
    const { getLang } = await cargarI18n();
    expect(getLang()).toBe("es");
  });

  it("`?lang=` manda y NO ensucia la preferencia (override efímero, como en main.ts)", async () => {
    const { setLang, getLang } = await cargarI18n();
    setLang("es", { persist: false });
    expect(getLang()).toBe("es");
    expect(store.get("u5.lang"), "un override de URL no debe persistirse").toBeUndefined();
  });

  it("`es-ES` (la forma que da un navegador) se pliega a `es` cuando se pide explícitamente", async () => {
    const { resolveLang } = await cargarI18n();
    expect(resolveLang("es-ES")).toBe("es");
  });
});
