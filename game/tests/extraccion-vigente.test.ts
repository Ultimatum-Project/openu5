// @vitest-environment jsdom
/**
 * PUERTA DE VERSIÓN DE LA EXTRACCIÓN (#293) — guarda de las tres mitades.
 *
 * (a) el PRODUCTOR no puede emitir un asset sin catalogarlo (`verificaCatalogo`),
 * (b) el CONSUMIDOR echa de menos lo que falta y lo NOMBRA en el aviso,
 * (c) el flujo de assets SERVIDOS no dispara el aviso.
 *
 * El entorno es jsdom porque el aviso es DOM de verdad (no una cadena): lo que se
 * comprueba es que el nodo existe, nombra el asset y lleva la acción a /byo. Cache
 * Storage NO lo trae jsdom — por eso `diagnosticaExtraccion` recibe el almacén como
 * argumento y aquí se le pasa un doble. El careo contra Cache Storage REAL (caché
 * sembrada en un navegador de verdad) es el control de estreno de
 * `demo-byo/verificacion/verifica-extraccion-vieja.mjs`, que corre en playwright.
 */
import { describe, expect, it } from "vitest";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import {
  ASSETS_DE_EXTRACCION,
  ASSETS_EXIGIDOS,
  BYO_CACHE,
  verificaCatalogo,
} from "../../extractor/src/assets-catalog.js";
import {
  assetsQueFaltan,
  diagnosticaExtraccion,
  diagnosticaExtraccion as diagnostica,
  ID_AVISO,
  montaAvisoExtraccion,
  rutasDeClaves,
  type AlmacenDeCaches,
} from "../src/web/extraccion.js";

const BASE = "https://openu5.org/play.html";

/** Sube desde el cwd hasta el directorio que tiene `demo-byo/public/sw.js`. Lanza si no. */
function raizDelArbol(): string {
  let dir = process.cwd();
  for (;;) {
    if (existsSync(resolve(dir, "demo-byo/public/sw.js"))) return `${dir}/`;
    const padre = dirname(dir);
    if (padre === dir) throw new Error("no encuentro la raíz del árbol (demo-byo/public/sw.js)");
    dir = padre;
  }
}

/** Doble de Cache Storage: `existe=false` = no hay extracción (assets del servidor). */
function almacenCon(rutas: readonly string[], existe = true): AlmacenDeCaches {
  return {
    has: (nombre) => Promise.resolve(existe && nombre === BYO_CACHE),
    open: () =>
      Promise.resolve({
        keys: () => Promise.resolve(rutas.map((r) => ({ url: `https://openu5.org/assets/${r}` }))),
      }),
  };
}

/** Todo lo que emite una extracción COMPLETA con una copia que trae hasta lo opcional. */
const TODO = ASSETS_DE_EXTRACCION.map((a) => a.ruta);

describe("(a) el catálogo y el pipeline no pueden divergir", () => {
  it("una emisión COMPLETA cuadra con el catálogo", () => {
    expect(() => verificaCatalogo(new Set(TODO))).not.toThrow();
  });

  it("un asset emitido y NO catalogado aborta la extracción NOMBRÁNDOLO", () => {
    // El mutante es el defecto de #293 exacto: alguien añade `putJson("nuevo.json")` y no
    // toca el catálogo. Sin este aserto la extracción seguiría y el aviso jamás lo echaría
    // de menos — que es como el santuario se quedó sin escena en silencio.
    expect(() => verificaCatalogo(new Set([...TODO, "escena-nueva.json"]))).toThrow(
      /escena-nueva\.json/,
    );
  });

  it("un asset catalogado que el pipeline NO emitió también aborta", () => {
    const sinShrine = TODO.filter((r) => r !== "shrine-scene.json");
    expect(() => verificaCatalogo(new Set(sinShrine))).toThrow(/shrine-scene\.json/);
  });

  it("`--skip-tiles` no acusa a los tiles, y NO exime al resto", () => {
    const sinTiles = TODO.filter((r) => !r.startsWith("tiles-"));
    expect(() => verificaCatalogo(new Set(sinTiles), { skipTiles: true })).not.toThrow();
    // Control de que la exención es de los tiles y no un «no mires nada».
    expect(() =>
      verificaCatalogo(new Set(sinTiles.filter((r) => r !== "data.json")), { skipTiles: true }),
    ).toThrow(/data\.json/);
  });

  it("los OPCIONALES existen y salen del careo de exigidos", () => {
    // Si algún día nadie fuera opcional este test se pondría rojo y habría que releer el
    // catálogo: sin opcionales, una copia legítima sin PROPORT.PCS recibiría el aviso.
    const opcionales = ASSETS_DE_EXTRACCION.filter((a) => a.opcional).map((a) => a.ruta);
    expect(opcionales.length).toBeGreaterThan(0);
    for (const ruta of opcionales) expect(ASSETS_EXIGIDOS).not.toContain(ruta);
    expect(ASSETS_EXIGIDOS).toContain("shrine-scene.json");
  });
});

describe("(b) el consumidor echa de menos lo que falta", () => {
  it("una extracción SIN shrine-scene.json lo nombra (el caso del usuario, 14-08)", async () => {
    const vieja = TODO.filter((r) => r !== "shrine-scene.json");
    const d = await diagnostica(almacenCon(vieja), BASE);
    expect(d.esExtraccionDelVisitante).toBe(true);
    expect(d.faltan).toEqual(["shrine-scene.json"]);
  });

  it("una extracción COMPLETA no echa nada de menos", async () => {
    const d = await diagnostica(almacenCon(TODO), BASE);
    expect(d.esExtraccionDelVisitante).toBe(true);
    expect(d.faltan).toEqual([]);
  });

  it("una copia SIN los ficheros opcionales tampoco recibe aviso", async () => {
    const soloExigidos = [...ASSETS_EXIGIDOS];
    const d = await diagnostica(almacenCon(soloExigidos), BASE);
    expect(d.faltan).toEqual([]);
  });

  it("las claves ajenas al prefijo /assets/ no cuentan como assets", () => {
    const rutas = rutasDeClaves(
      [
        { url: "https://openu5.org/assets/data.json" },
        { url: "https://openu5.org/momentos/momentos.json" },
        { url: "no es una url" },
      ],
      BASE,
    );
    expect(rutas).toEqual(["data.json"]);
  });

  it("el careo puro nombra TODOS los que faltan, no sólo el primero", () => {
    expect(assetsQueFaltan(["data.json"], ["data.json", "story.json", "shrine-scene.json"])).toEqual(
      ["story.json", "shrine-scene.json"],
    );
  });
});

describe("(c) los assets SERVIDOS no disparan el aviso", () => {
  it("sin caché de /byo no hay veredicto, aunque no se vea ni un asset", async () => {
    // 🔴 EL CONTROL QUE IMPORTA: la lista de presentes está VACÍA. Un predicado que
    // sólo mirara «¿faltan assets?» acusaría aquí al 100 % del catálogo — y este es el
    // caso de staging, de `npm run dev` y de cualquiera que juegue con assets servidos.
    const d = await diagnostica(almacenCon([], false), BASE);
    expect(d.esExtraccionDelVisitante).toBe(false);
    expect(d.faltan).toEqual([]);
  });

  it("sin Cache Storage (modo privado / contexto inseguro) se calla", async () => {
    const d = await diagnosticaExtraccion(undefined, BASE);
    expect(d.faltan).toEqual([]);
  });

  it("un almacén que revienta se calla en vez de tumbar el arranque", async () => {
    const roto: AlmacenDeCaches = {
      has: () => Promise.reject(new Error("SecurityError")),
      open: () => Promise.reject(new Error("SecurityError")),
    };
    await expect(diagnosticaExtraccion(roto, BASE)).resolves.toEqual({
      esExtraccionDelVisitante: false,
      faltan: [],
    });
  });
});

describe("el aviso: qué ve quien juega", () => {
  it("NOMBRA el asset y su fichero del original, y lleva a /byo fuera del iframe", () => {
    document.body.innerHTML = "";
    const caja = montaAvisoExtraccion(["shrine-scene.json"], { doc: document, idioma: "es" });
    expect(caja).not.toBeNull();
    const texto = document.getElementById(ID_AVISO)!.textContent ?? "";
    expect(texto).toContain("versión anterior");
    expect(texto).toContain("shrine-scene.json");
    expect(texto).toContain("MISCMAPS.DAT"); // de dónde sale: para que el reporte sea útil
    const enlace = document.querySelector<HTMLAnchorElement>(`#${ID_AVISO} a`)!;
    expect(enlace.getAttribute("href")).toBe("/byo");
    // Dentro del popover de /byo el juego va en un iframe: sin _top la landing se
    // cargaría DENTRO de la partida.
    expect(enlace.getAttribute("target")).toBe("_top");
  });

  it("sin nada que avisar NO deja nodo (el caso de casi todos)", () => {
    document.body.innerHTML = "";
    expect(montaAvisoExtraccion([], { doc: document, idioma: "es" })).toBeNull();
    expect(document.getElementById(ID_AVISO)).toBeNull();
  });

  it("dos llamadas no apilan dos bandas", () => {
    document.body.innerHTML = "";
    montaAvisoExtraccion(["story.json"], { doc: document, idioma: "es" });
    montaAvisoExtraccion(["story.json"], { doc: document, idioma: "es" });
    expect(document.querySelectorAll(`#${ID_AVISO}`)).toHaveLength(1);
  });

  it("habla el idioma de quien juega", () => {
    document.body.innerHTML = "";
    montaAvisoExtraccion(["story.json"], { doc: document, idioma: "en" });
    const texto = document.getElementById(ID_AVISO)!.textContent ?? "";
    expect(texto).toContain("older version");
    expect(texto).not.toContain("versión anterior");
  });
});

describe("el nombre de la caché es UNO en todo el árbol", () => {
  // Si el service worker o la demo miran otra caché que el juego, la puerta entera queda
  // MUDA sin que nada falle: el juego preguntaría por una caché que nadie llena y jamás
  // avisaría. El literal no se puede importar en el SW (no hay bundler), así que se carea
  // el FUENTE. Censo del 14-08: sw.js + 3 módulos de demo-byo/src.
  // 🔴 Ni `import.meta.url` (bajo jsdom es una URL http: y `fileURLToPath` revienta) ni
  // un `../..` desde el cwd: la raíz se BUSCA hacia arriba, para que la guarda valga
  // corriendo desde `game/` (como la batería) o desde la raíz del árbol.
  const raiz = raizDelArbol();

  it("el service worker de /byo usa la misma caché que el catálogo", () => {
    const sw = readFileSync(`${raiz}demo-byo/public/sw.js`, "utf8");
    expect(sw).toContain(`"${BYO_CACHE}"`);
    // Control positivo del predicado: si el fichero no se leyera, el `toContain` de
    // arriba también fallaría — pero un fichero VACÍO pasaría cualquier `not.toContain`.
    expect(sw.length).toBeGreaterThan(200);
  });

  it("ningún módulo de demo-byo/src nombra OTRA caché u5-", () => {
    const dir = `${raiz}demo-byo/src/`;
    const otras: string[] = [];
    for (const nombre of readdirSync(dir)) {
      if (!nombre.endsWith(".ts")) continue;
      const fuente = readFileSync(dir + nombre, "utf8");
      for (const [, cache] of fuente.matchAll(/["'](u5-[a-z0-9-]+)["']/g)) {
        if (cache !== BYO_CACHE) otras.push(`${nombre}: ${cache}`);
      }
    }
    expect(otras).toEqual([]);
  });
});
