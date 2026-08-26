/**
 * #126 — GÉNERO «plantilla i18n muerta por interpolación NATIVA».
 *
 * La forma del defecto (memoria i18n-quote-wrap-guard-blindspot): la key existe en
 * `es.json` con `reviewed:true` y es INALCANZABLE, porque el call-site compone el
 * mensaje con `` `${…}` `` nativo y `t()` es lookup EXACTO — el compuesto («Position:
 * 123, 45») nunca casa con la plantilla catalogada («Position: {}, {}»). Resultado:
 * bajo lang='es' el mensaje sale en INGLÉS, y las guardas existentes están VERDES (la
 * key está traducida y revisada; nadie mide que alguien la use).
 *
 * Dos familias:
 *
 *  (A) POR INSTANCIA. Cada sitio arreglado se ejercita bajo lang='es' contra el valor
 *      REAL de es.json (leído del JSON, no copiado a mano — si alguien re-traduce la
 *      key el test sigue midiendo el cableado, no la redacción). El byte-igual en 'en'
 *      lo cubre `i18n-tf.test.ts` con su campo `legacy`.
 *
 *  (B) EL LINT TRANSVERSAL. Detector del género entero: toda plantilla `${…}` que
 *      llega a un sink user-facing SIN pasar por `t()`/`tf()` y cuya normalización
 *      (`${…}`→`{}`) EXISTE como key de es.json. Reutiliza el extractor AST de
 *      `tools/extract-user-strings.mjs` en modo "native" — MISMOS SINKS que la guarda
 *      de string-manifest, política de hojas invertida — para que lint y guarda no
 *      puedan derivar.
 *
 * CONTROL POSITIVO (medido antes de tocar código, censo del 29-07): el lint cazaba
 * CINCO — las 3 de este carril MÁS `main.ts:368` y `main.ts:1471`. Las dos de main.ts
 * quedan FUERA a propósito (ver POBLACIÓN RESIDUAL abajo), así que el lint no puede
 * pedir cero: pide EXACTAMENTE ese residuo declarado, y cualquier alta nueva —o una
 * baja no anotada— lo pone rojo.
 */
import { describe, it, expect, afterEach } from "vitest";
import { huella } from "../src/i18n/huella.js";
import { extractNativeInterpolations, shellFiles } from "../tools/extract-user-strings.mjs";
import { join } from "node:path";
import type { CharacterState, ExtractedInitialState, GameState } from "../src/core/state.js";
import { Game, type GameData } from "../src/core/game.js";
import type { WorldData } from "../src/core/world/map.js";
import { setLang, BASE_LANG, t } from "../src/i18n/index.js";
import esTable from "../src/i18n/es.json";

const esStrings = esTable.strings as Record<string, { t: string; by: string; reviewed: boolean }>;

/** Valor español de una key, con aserción de que la key SIGUE existiendo. */
function es(key: string): string {
  const e = esStrings[huella(key)];
  expect(e, `es.json ya no tiene la key ${JSON.stringify(key)}`).toBeDefined();
  return e!.t;
}

afterEach(() => setLang(BASE_LANG, { persist: false }));

// ---------------------------------------------------------------- arnés mínimo
function makeChar(over: Partial<CharacterState> = {}): CharacterState {
  return {
    name: "Test", gender: 0x0b, class: "A", status: "G",
    strength: 20, dexterity: 20, intelligence: 20, currentMp: 10,
    currentHp: 50, maxHp: 60, exp: 0, level: 2, monthsAtInn: 0,
    helmet: 0xff, armor: 0xff, weapon: 0xff, shield: 0xff, ring: 0xff, amulet: 0xff,
    partyStatus: 0, ...over,
  };
}

function makeState(over: Partial<GameState> = {}): GameState {
  const base: Partial<GameState> = {
    version: 1,
    characters: [makeChar()], partySize: 1, activeCharacter: 0,
    food: 100, gold: 100, magicCarpets: 0, skullKeys: 0,
    time: { year: 139, month: 4, day: 7, hour: 12, minute: 5 },
    turnsSinceStart: 0, position: { location: 0, floor: 0, x: 100, y: 80 },
    transport: "foot", torchTurns: 0, torches: 2, prevHour: 12, wind: 0,
    specialItems: { spyglass: false, hmsCape: false, sextant: false, pocketWatch: false, blackBadge: false, woodenBox: false },
    shards: { falsehood: false, hatred: false, cowardice: false },
    lbArtifacts: { amulet: false, crown: false, sceptre: false },
  };
  return { ...base, ...over } as GameState;
}

const world: WorldData = {
  overworld: Array.from({ length: 256 }, () => Array<number>(256).fill(4)),
  underworld: Array.from({ length: 256 }, () => Array<number>(256).fill(4)),
  smallMaps: new Map(),
};
const gameData: GameData = { locationsX: [], locationsY: [], locationNames: [] };
const makeGame = (s: GameState): Game => new Game({} as ExtractedInitialState, world, gameData, s, {});
const msgs = (events: { kind: string; text?: string }[]): string[] =>
  events.filter((e) => e.kind === "message").map((e) => e.text!);

// ------------------------------------------------------- (A) las 3 instancias
describe("#126 (A) — las plantillas llegan traducidas bajo lang='es'", () => {
  it("(U)se Sextant — 'Position: {}, {}' (use-tools.ts, CAST.OVL 0x1a96 / DS 0x4a26)", () => {
    const s = makeState({
      position: { location: 0, floor: 0, x: 123, y: 45 },
      time: { year: 139, month: 4, day: 7, hour: 22, minute: 0 },
    });
    setLang("es", { persist: false });
    const out = msgs(makeGame(s).useSextant());
    expect(out[1]).toBe(es("Position: {}, {}").replace("{}", "123").replace("{}", "45"));
    // y el compuesto NO puede seguir siendo el inglés interpolado
    expect(out[1]).not.toBe("Position: 123, 45");
  });

  it("(U)se Pocket Watch — 'The pocket watch reads {}:{} {}.' (use-tools.ts, CAST.OVL 0x1ad4)", () => {
    const s = makeState({ time: { year: 139, month: 4, day: 7, hour: 13, minute: 30 } });
    setLang("es", { persist: false });
    const out = msgs(makeGame(s).usePocketWatch());
    const want = es("The pocket watch reads {}:{} {}.")
      .replace("{}", "1").replace("{}", "30").replace("{}", "PM");
    expect(out[1]).toBe(want);
    expect(out[1]).not.toBe("The pocket watch reads 1:30 PM.");
  });

  it("(C)amp a bordo, reparar casco — 'Hull now {}!\\n\\n' (camp.ts, kernel 0x3C9A / DS 0xa2f8+0xa302)", () => {
    const s = makeState({ transport: "ship", shipHull: 50 });
    setLang("es", { persist: false });
    const out = msgs(makeGame(s).campRepairShip());
    const hull = /(\d+)/.exec(out[0]!)?.[1];
    expect(hull, `sin número de casco en ${JSON.stringify(out[0])}`).toBeDefined();
    expect(out[0]).toBe(es("Hull now {}!\n\n").replace("{}", hull!));
    expect(out[0]!.startsWith("Hull now")).toBe(false);
  });
});

// -------------------------------------------------------- (B) lint transversal
/**
 * POBLACIÓN RESIDUAL — los sitios del género que este carril NO arregla, cada uno con
 * su motivo. Un residual sin motivo escrito no puede entrar aquí.
 *
 *  - peaje de trolls (`main.ts`): POST-GO por instrucción del lead (hay ramas de
 *    preview vivas sobre main.ts y el conflicto costaría más que el fix). Tarjeta #126.
 *  - `{}? I know of no such person.` (`main.ts`): RETIRADO (ficha E1, fix-espejo-
 *    instrumento). El arnés `innLeave` que el ESPEJO usa para los swaps de party del
 *    LP2 se extrajo de main.ts a `debug/debugApi.ts` (`testHookInnLeave`) para poder
 *    testear su guarda `location !== 0`, y ese fichero está EXCLUIDO del censo del
 *    shell como [interna] (EXCLUDED_SHELL_FILES, misma clase que teleportPicker.ts):
 *    la plantilla salió de la población del lint CON su emisor, así que ya no puede
 *    declararse residual — un `want` sin `got` sería un rojo permanente. La historia
 *    previa de la entrada (el gemelo falso de party.ts, 58413c38) queda en git.
 *
 * ── EL PIN ES POR CONTENIDO, NO POR LÍNEA (04-08) ────────────────────────────────
 * Hasta hoy cada residual se declaraba como `main.ts:<línea>`, y eso lo ponía ROJO cada
 * vez que ALGUIEN INSERTABA CUALQUIER COSA por encima en main.ts — un fichero de 4.800
 * líneas que tocan cinco carriles a la vez. El historial que sustituye este bloque eran
 * cuatro anotaciones seguidas de «+6», «+1», «+7/+21», «+8»: cuatro rojos que no eran
 * regresiones y cuatro re-verificaciones manuales de que la población no había cambiado.
 *
 * Un pin así se paga dos veces y las dos mal: cuesta trabajo, y —peor— ENTRENA a quien
 * lo ve rojo a actualizar el número sin mirar, que es justo la lectura que haría pasar
 * un alta real por un desplazamiento.
 *
 * Lo que el test tiene que fijar es CUÁLES plantillas escapan al lint y en qué FICHERO,
 * no en qué renglón están hoy. La línea nunca fue el invariante: era el ruido alrededor.
 *
 * 🔴 Lo que NO se pierde al quitar la línea: la CARDINALIDAD. Se comparan listas
 * ordenadas, no conjuntos — si la misma plantilla apareciera DOS veces en main.ts, `got`
 * traería dos entradas contra una de `want` y el test se pondría rojo igual. Y si un
 * residual se arregla y desaparece, también. El fichero sigue formando parte de la
 * identidad: la MISMA plantilla emitida desde otro fichero es un alta nueva, no este
 * residual mudándose.
 */
const RESIDUAL: ReadonlyArray<{ fichero: string; tpl: string }> = [
  { fichero: "main.ts", tpl: "Caught!\n\nThe trolls demand a {} gp toll!\n\nDost thou pay?" },
];

/** `main.ts:1542` → `main.ts`. El extractor da `<fichero>:<línea>`. */
function ficheroDe(loc: string): string {
  return loc.split(":")[0]!;
}

describe("#126 (B) — LINT: ninguna plantilla catalogada se compone con ${} nativo", () => {
  const SRC = join(__dirname, "..", "src");
  const hits = extractNativeInterpolations(join(SRC, "core"), shellFiles(SRC)).filter((f) =>
    Object.prototype.hasOwnProperty.call(esStrings, huella(f.text)),
  );

  it("los sitios cazados son EXACTAMENTE la población residual declarada", () => {
    // Por FICHERO + PLANTILLA, nunca por línea (ver el bloque de RESIDUAL): un número
    // de línea se mueve con cualquier inserción de otro carril y produce rojos que no
    // son regresiones. Listas ordenadas y no conjuntos ⇒ un duplicado también salta.
    const got = hits.map((h) => `${ficheroDe(h.loc)}  ${JSON.stringify(h.text)}`).sort();
    const want = RESIDUAL.map((r) => `${r.fichero}  ${JSON.stringify(r.tpl)}`).sort();
    expect(
      got,
      `\nPlantilla(s) de es.json compuestas con \`\${…}\` NATIVO: el call-site nunca casa\n` +
        `con la key (t() es lookup exacto) ⇒ bajo lang='es' salen EN INGLÉS y las guardas\n` +
        `siguen verdes. FIX: tf(<plantilla verbatim>, ...args) — byte-idéntico en 'en'.\n` +
        `Si un sitio debe quedarse, va a RESIDUAL en este fichero CON su motivo.\n` +
        `Ubicación EXACTA de lo cazado ahora mismo: ${hits.map((h) => h.loc).join(", ")}\n`,
    ).toEqual(want);
  });

  it("las nativas SIN key del santuario siguen ahí (control NEGATIVO del lint)", () => {
    // Si estas dejaran de aparecer, el lint habría perdido alcance sin avisar: son
    // plantillas nativas REALES que el barrido ve y que NO son del género (§C).
    //
    // 🔴 `"{}"\n\n` ENTRA el 25-08 (FICHA β) y NO es una regresión del género: es
    // `codexPage()`, que compone la comilla y el `\n\n` que el original imprime con
    // putchar/DS alrededor del record de MISCMSG.DAT. No es del género porque el género
    // exige que la NORMALIZACIÓN sea una key VIVA de es.json (plantilla catalogada que el
    // compuesto nunca alcanzaría), y `huella('"{}"\n\n')` no está en es.json — verificado
    // al añadirla, junto con las otras tres. Lo que sí está catalogado es el compuesto
    // ENTERO (record + comillas), que es lo que recibe `t()` al pintar el mensaje: por eso
    // la lección del Códice se sigue traduciendo, y lo carea
    // `ds-strings-compuestas.test.ts` contra el corpus.
    const shrine = extractNativeInterpolations(join(SRC, "core"), shellFiles(SRC))
      .filter((f) => f.loc.startsWith("core/world/shrine-ceremonies.ts"))
      .map((f) => f.text)
      .sort();
    expect(shrine).toEqual(['"{}"\n\n', "{} gp\n\n", "{} +1\n", "{}\n"].sort());
  });

  it("el instrumento no está muerto: en modo nativo ve plantillas y en catálogo no las poda", () => {
    // Control de que el extractor sigue barriendo material (un cambio que dejara el
    // barrido en cero pondría el test de arriba verde EN FALSO — el género de
    // «instrumento equivocado»). El total incluye las que NO tienen key en es.json.
    const all = extractNativeInterpolations(join(SRC, "core"), shellFiles(SRC));
    expect(all.length).toBeGreaterThanOrEqual(RESIDUAL.length + 3);
  });
});

// ------------------------- (C) careo lint ↔ detector de huérfanos (santuario)
/**
 * CAREO PEDIDO POR LA TARJETA: la instancia que el censo de #86 dejó apuntada son las
 * plantillas del SANTUARIO, que el detector de huérfanos ya absolvió por cobertura (E2).
 * ¿Se contradicen el detector y este lint? **NO**, y el motivo es exacto y vale más que
 * el veredicto, porque nombra una TERCERA forma:
 *
 *   El lint indexa por la plantilla NORMALIZADA (`{} +1\n`). El santuario NO está
 *   catalogado así: lo están sus formas COMPUESTAS, una por miembro de un conjunto
 *   CERRADO de literales (`Strength +1\n`, `Dexterity +1\n`, `Intelligence +1\n`,
 *   DS 0x95b8/0x95c6/0x95d4). Como el arg es un literal fijo y no un número, el
 *   compuesto que sale del `${}` ES la key, casa en el choke `t()` de la consola y se
 *   traduce. No hay key muerta ⇒ el lint hace bien en no marcarlo y el detector hace
 *   bien en absolverlo. Coinciden.
 *
 * ★ LIMITACIÓN DECLARADA que esto destapa: para una familia catalogada en forma
 * COMPUESTA, el lint es CIEGO — si a un miembro le faltara su key, saldría en inglés y
 * la normalización (`{} +1\n`, que no es key de nada) no lo vería. La cobertura de esa
 * forma es este test: fija los 3 miembros y exige que los 3 traduzcan. Es barato y
 * cubre justo el hueco que el instrumento no alcanza.
 *
 * Y AL REVÉS (la trampa para el próximo que pase por aquí): aplicar aquí el fix de #126
 * —`tf("{} +1\n", label)`— NO es obligatorio y es un cambio de vía, no una corrección:
 * pasaría a traducir por la etiqueta suelta en vez de por la frase catalogada y
 * revisada. Hoy funcionaría (las 3 etiquetas sueltas también tienen key), pero es una
 * dependencia distinta. No se toca: no está roto.
 */
const SHRINE_COMPOSED: ReadonlyArray<[string, string]> = [
  ["Strength", "Strength +1\n"],
  ["Dexterity", "Dexterity +1\n"],
  ["Intelligence", "Intelligence +1\n"],
];

describe("#126 (C) — santuario: lint y detector de huérfanos NO se contradicen", () => {
  it("las formas COMPUESTAS están catalogadas y traducen bajo 'es' (no son huérfanas)", () => {
    setLang("es", { persist: false });
    for (const [label, composed] of SHRINE_COMPOSED) {
      const tr = es(composed); // exige que la key siga existiendo
      // lo que el call-site compone HOY, tal cual, pasado por el choke de la consola
      expect(t(`${label} +1\n`), `«${composed}» dejó de casar con su key`).toBe(tr);
      expect(t(`${label} +1\n`)).not.toBe(`${label} +1\n`); // y no es identidad
    }
  });

  it("su forma NORMALIZADA no es key — por eso el lint no las marca (y acierta)", () => {
    for (const tpl of ["{} +1\n", "{} gp\n\n", "{}\n"]) {
      expect(Object.prototype.hasOwnProperty.call(esStrings, tpl), `${JSON.stringify(tpl)} pasó a ser key: re-adjudicar §C`).toBe(false);
    }
  });
});
