// @vitest-environment jsdom
/**
 * FICHA #233 — **una descarga no revoca su object URL en la línea de después del `click()`.**
 *
 * El defecto: `URL.revokeObjectURL(url)` inmediatamente tras `a.click()` funciona en Chrome
 * —que arranca la transferencia dentro del propio `click()`— y en Safari/iOS deja el fichero
 * VACÍO o cancela la descarga SIN error. El remedio (revocar en el turno siguiente) ya estaba
 * escrito y razonado en `demo-byo/src/exporta.ts`, y no había viajado a las dos copias del
 * juego. El caso más expuesto es `downloadNativeSave`: TRES descargas seguidas, tres URL vivas
 * a la vez.
 *
 * ── LO QUE ESTA GUARDA MIDE Y LO QUE NO ────────────────────────────────────────────────────
 * 🔴 Esto NO prueba que Safari descargue el fichero entero. Eso exige Safari REAL con una
 * descarga real, y jsdom no tiene ni transferencia ni disco: aquí `click()` sobre un ancla no
 * descarga nada. Lo que sí es medible —y es exactamente la condición que el motor necesita— es
 * el ORDEN: que el objeto siga VIVO cuando el `click()` retorna. Esa es la propiedad que se
 * asierta. El límite se declara en vez de fabricar un verde que aparente cubrir el navegador.
 *
 * Tres capas, porque ninguna sola bastaría:
 *   1. CONDUCTA sobre el camino REAL (`exportSave`, `downloadNativeSave`): se espía
 *      `URL.revokeObjectURL` y se comprueba que no ha corrido al volver de la llamada, y que
 *      sí corre al vaciar la cola de macrotasks.
 *   2. CONTROL POSITIVO: la forma VIEJA (revocación síncrona), escrita aquí a mano, tiene que
 *      hacer saltar al mismo espía. Sin ella, un espía que no se dispare por cualquier otra
 *      razón (un jsdom sin `URL.createObjectURL`, un stub mal puesto) daría los mismos ceros y
 *      la guarda estaría verde por vacío.
 *   3. CENSO DE CLASE sobre el TEXTO de `game/src` + `demo-byo/src`. Hace falta porque la capa 1
 *      no alcanza a `descarga` de `ui/replay-ui.ts`: es privada y su único llamador vive dentro
 *      de una UI que hay que montar entera con IndexedDB detrás. Antes que dejar ese tercer
 *      sitio sin vigilar —o montar un fixture frágil que mediría el andamio—, se vigila por
 *      FORMA junto con toda su clase, y el censo lleva su propio control positivo.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, relative } from "node:path";
import type { GameState } from "../src/core/state.js";

/**
 * 🔴 EL CÓDEC NATIVO VA EN DOBLE, A PROPÓSITO — y no es pereza de fixture.
 *
 * El sujeto de esta guarda es el CICLO DE VIDA DEL OBJECT URL, no los bytes del .GAM (de
 * ésos ya responde `save-native.test.ts`). Doblar el códec deja a `downloadNativeSave` con lo
 * único que aquí importa: sus TRES llamadas a la primitiva de descarga.
 *
 * Y evita una trampa MEDIDA: la manera «natural» de conseguir un `GameState` era importar
 * `canonicalInit` de `save-native.test.js`, y **importar de un fichero `.test.ts` ejecuta su
 * suite entera dentro de la tuya** — este fichero marcaba 46 tests teniendo 6. Sondeado con un
 * fichero de una línea: 41 = 1 propio + 40 arrastrados.
 *
 * Eso YA está pasando en el árbol y no se toca aquí (cambiaría el cardinal de la batería):
 * `party-roster-contiguity.test.ts` corre 48 = 8 + 40 y `save-native-enemies.test.ts` 53 =
 * 13 + 40; `moonstone-buried-codec.test.ts` se libra sólo porque su import está MUERTO (nunca
 * llama a `canonicalInit`). Reportado como cabo aparte.
 */
vi.mock("../src/core/saveNative.js", () => ({
  SAVED_GAM_SIZE: 4192,
  exportNativeSave: () => ({ gam: new Uint8Array(4192), sidecar: { doble: true } }),
  buildNativeOol: () => new Uint8Array(0x200),
  importNativeSave: () => ({}),
}));

const { exportSave, downloadNativeSave } = await import("../src/core/persistence.js");

/** Estado de mentira: con el códec doblado, nada de aquí se lee salvo por `JSON.stringify`. */
const estadoFalso = { partida: "de prueba" } as unknown as GameState;

/** Vacía la cola de macrotasks — donde vive el `setTimeout(…, 0)` de la revocación. */
const siguienteTurno = (): Promise<void> => new Promise((r) => setTimeout(r, 0));

describe("#233 · la revocación del object URL va en el TURNO SIGUIENTE, no tras el click()", () => {
  let creadas: string[];
  let revocadas: string[];
  let clicks: number;

  beforeEach(() => {
    creadas = [];
    revocadas = [];
    clicks = 0;
    let n = 0;
    // jsdom no implementa createObjectURL: se instala el par completo para poder CONTAR.
    vi.stubGlobal("URL", {
      ...URL,
      createObjectURL: vi.fn(() => {
        const u = `blob:prueba/${++n}`;
        creadas.push(u);
        return u;
      }),
      revokeObjectURL: vi.fn((u: string) => void revocadas.push(u)),
    });
    // El `click()` de un ancla con `download` en jsdom intentaría navegar; se neutraliza y de
    // paso se cuenta, que es lo que ancla el «después del click» de los asertos.
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: unknown) {
      clicks += 1;
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("exportSave: al volver de la llamada la URL sigue VIVA; se revoca en el macrotask", async () => {
    exportSave(estadoFalso);

    expect(clicks).toBe(1);
    expect(creadas).toHaveLength(1);
    // EL ASERTO DE LA FICHA: nada revocado todavía.
    expect(revocadas).toEqual([]);

    await siguienteTurno();
    expect(revocadas).toEqual(creadas);
  });

  it("downloadNativeSave: las TRES descargas (.GAM + .OOL + sidecar) sobreviven al click", async () => {
    downloadNativeSave(estadoFalso, new Uint8Array(4192), new Uint8Array(0x200));

    // El caso frágil de la ficha: tres transferencias arrancadas y tres objetos que tienen que
    // seguir vivos a la vez. Que sean tres URL DISTINTAS es lo que hace real el solape.
    expect(clicks).toBe(3);
    expect(new Set(creadas).size).toBe(3);
    expect(revocadas).toEqual([]);

    await siguienteTurno();
    expect(new Set(revocadas)).toEqual(new Set(creadas));
  });

  it("CONTROL POSITIVO: la forma VIEJA (revocación síncrona) hace saltar al mismo espía", () => {
    // Réplica literal del código que esta ficha retira. Si esto no se pusiera rojo, los dos
    // asertos de arriba no estarían midiendo nada.
    const url = URL.createObjectURL(new Blob(["x"]));
    const a = document.createElement("a");
    a.href = url;
    a.download = "viejo.json";
    a.click();
    URL.revokeObjectURL(url);

    expect(revocadas).toEqual([url]);
  });
});

describe("#233 · CENSO DE CLASE: ninguna descarga del repo revoca síncrono", () => {
  // 🔴 Anclado a `import.meta.url`, NO al cwd: un censo que resuelve contra el directorio de
  // trabajo mide el árbol de quien lo lance, y desde otro worktree daría un veredicto impecable
  // de la rama equivocada.
  const raiz = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
  const POBLACION = [join(raiz, "game", "src"), join(raiz, "demo-byo", "src")];

  /** Los tres sitios que HOY crean un object URL para descargar. Ver el aserto de suelo. */
  const CONOCIDOS = [
    "game/src/core/persistence.ts",
    "game/src/ui/replay-ui.ts",
    "demo-byo/src/exporta.ts",
  ];

  function ficherosTs(dir: string): string[] {
    const out: string[] = [];
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, e.name);
      if (e.isDirectory()) out.push(...ficherosTs(p));
      else if (e.name.endsWith(".ts")) out.push(p);
    }
    return out;
  }

  /**
   * ¿Hay una revocación SÍNCRONA en este texto? El defecto es `revokeObjectURL` que NO está
   * dentro de un diferidor. Se busca la forma mala directamente en vez de exigir la buena:
   * `setTimeout` no es la única manera correcta de diferir (`queueMicrotask` no valdría aquí,
   * pero `requestAnimationFrame` o un `await` sí), y un predicado que exigiera literalmente
   * `setTimeout` vetaría formas correctas y cementaría UNA redacción.
   */
  function revocacionesSincronas(texto: string): string[] {
    return texto
      .split("\n")
      .filter((l) => {
        if (!l.includes("revokeObjectURL")) return false;
        const codigo = l.trim();
        if (codigo.startsWith("*") || codigo.startsWith("//")) return false; // prosa, no código
        return !/=>|function|then\(/.test(codigo); // sin diferidor en la misma línea
      })
      .map((l) => l.trim());
  }

  const conObjectUrl = POBLACION.flatMap(ficherosTs)
    .map((f) => ({ ruta: relative(raiz, f).replaceAll("\\", "/"), texto: readFileSync(f, "utf8") }))
    .filter((f) => f.texto.includes("createObjectURL"));

  it("SUELO: los tres sitios conocidos siguen en la población censada", () => {
    // Un censo que mide 0 se lee como «no hay defectos» y es indistinguible de un censo roto
    // (glob equivocado, fichero movido, extensión que dejó de casar). Este aserto es lo que
    // separa las dos lecturas. No se asierta el CARDINAL exacto a propósito: una descarga nueva
    // y correcta no debe poner roja la guarda — de ésa ya se ocupa el aserto de abajo, que es
    // universal sobre la población y por tanto la cubre sin que nadie tenga que actualizar nada.
    const rutas = conObjectUrl.map((f) => f.ruta);
    for (const c of CONOCIDOS) expect(rutas).toContain(c);
  });

  it("ninguno de los sitios censados revoca en la línea de después del click", () => {
    const infractores = conObjectUrl
      .flatMap((f) => revocacionesSincronas(f.texto).map((l) => `${f.ruta}: ${l}`));
    expect(infractores).toEqual([]);
  });

  it("CONTROL POSITIVO del censo: el predicado SÍ caza la forma vieja sembrada", () => {
    const sembrado = ["const url = URL.createObjectURL(blob);", "a.click();", "URL.revokeObjectURL(url);"].join("\n");
    expect(revocacionesSincronas(sembrado)).toEqual(["URL.revokeObjectURL(url);"]);
    // …y NO caza la buena, o el censo entero sería un rojo permanente sin información.
    expect(revocacionesSincronas("  setTimeout(() => URL.revokeObjectURL(url), 0);")).toEqual([]);
  });
});
