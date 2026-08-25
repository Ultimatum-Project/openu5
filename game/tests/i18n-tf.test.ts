/**
 * i18n «cableado» (A) — CONTRATO de `tf()` (traduce-y-compone plantillas `{}`).
 *
 * Tres familias de aserción, las tres condiciones que el lead puso al aprobar tf()
 * sobre mensajes estructurados:
 *
 *  (1) HOJA DE DEPENDENCIAS. `src/i18n/*` no importa de `skin/` ni de `core/` (sólo
 *      su propio JSON + utilidades puras). Así `core → i18n` no crea ciclos ni
 *      contamina el guard de pieles.
 *
 *  (2) BYTE-IGUAL EN 'en'. Para cada una de las plantillas REALES de los ~40 sitios
 *      de composición, `tf(tpl, ...args)` con lang='en' produce EXACTAMENTE el mismo
 *      string que la interpolación nativa `` `${a} … ${b}` `` que había hoy. Cada
 *      caso lleva su forma NATIVA (`legacy`) y se compara contra ella — no contra un
 *      literal a mano — así el test compara tf-en vs composición legacy de verdad.
 *
 *  (3) IDEMPOTENCIA + COMPUESTO-INERTE. `t(t(x)) === t(x)` para toda key (las piezas
 *      se traducen una sola vez), y `t(tf(...)) === tf(...)` (el compuesto que sale de
 *      tf nunca es key, así que la 2ª pasada por el choke de la consola lo deja igual).
 */
import { describe, it, expect, afterEach } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { t, tf, setLang, rewrap, BASE_LANG } from "../src/i18n/index.js";
import { huella } from "../src/i18n/huella.js";
import { lootItemName } from "../src/core/world/commands.js";
import esTable from "../src/i18n/es.json";

const esStrings = esTable.strings as Record<string, { t: string; by: string; reviewed: boolean }>;

// El estado de idioma es de módulo: cada test lo restaura a 'en' (default).
afterEach(() => setLang(BASE_LANG, { persist: false }));

/**
 * Las ~40 plantillas REALES de los sitios de composición (core + main.ts), cada una
 * con args representativos y su interpolación NATIVA exacta (la que había en el sitio
 * antes del cableado). `tf(tpl, ...args)` en 'en' debe igualar `legacy`.
 */
const CASES: Array<{ site: string; tpl: string; args: (string | number)[]; legacy: string }> = [
  // combat.ts — todos vía this.nameOf()
  { site: "combat:833", tpl: "{} slept!", args: ["Troll"], legacy: `${"Troll"} slept!` },
  { site: "combat:870", tpl: "{} grazed!", args: ["Orc"], legacy: `${"Orc"} grazed!` },
  { site: "combat:901", tpl: "{} is poisoned!", args: ["Spider"], legacy: `${"Spider"} is poisoned!` },
  { site: "combat:975", tpl: "{} hits {} for {}.", args: ["Avatar", "Troll", 5], legacy: `${"Avatar"} hits ${"Troll"} for ${5}.` },
  { site: "combat:986", tpl: "{} divides!", args: ["Slime"], legacy: `${"Slime"} divides!` },
  { site: "combat:999", tpl: "{} {}", args: ["Troll", "critical!"], legacy: `${"Troll"} ${"critical!"}` },
  { site: "combat:1051", tpl: "{} killed!", args: ["Rat"], legacy: `${"Rat"} killed!` },
  { site: "combat:1293", tpl: "{} interferes!", args: ["Daemon"], legacy: `${"Daemon"} interferes!` },
  { site: "combat:1319", tpl: "{} missed!", args: ["Troll"], legacy: `${"Troll"} missed!` },
  { site: "combat:1648", tpl: "{} charmed!", args: ["Troll"], legacy: `${"Troll"} charmed!` },
  { site: "combat:1853", tpl: "{} wakes!", args: ["Troll"], legacy: `${"Troll"} wakes!` },
  { site: "combat:1855", tpl: "{} sleeps.", args: ["Troll"], legacy: `${"Troll"} sleeps.` },
  { site: "combat:1920", tpl: "{} possessed!", args: ["Avatar"], legacy: `${"Avatar"} possessed!` },
  { site: "combat:1938a", tpl: "{} disappears!", args: ["Ghost"], legacy: `${"Ghost"} disappears!` },
  { site: "combat:1938b", tpl: "{} reappears!", args: ["Ghost"], legacy: `${"Ghost"} reappears!` },
  { site: "combat:1954", tpl: "{} gates in a daemon!", args: ["Wizard"], legacy: `${"Wizard"} gates in a daemon!` },
  { site: "combat:2033", tpl: "A {} stole some food!", args: ["Rat"], legacy: `A ${"Rat"} stole some food!` },
  { site: "combat:2063", tpl: "{} teleports!", args: ["Mage"], legacy: `${"Mage"} teleports!` },
  { site: "combat:2094", tpl: "{} escapes!", args: ["Troll"], legacy: `${"Troll"} escapes!` },
  // debug/debugApi.ts — arnés e2e `__u5test.innLeave`, hoy `testHookInnLeave` (extraído
  // de main.ts en la ficha E1 y EXCLUIDO del censo del shell como [interna]; su residual
  // del lint #126 se retiró con el traslado — ver i18n-plantillas-nativas.test.ts).
  // 🔴 Las otras TRES plantillas de alistamiento que vivían aquí («{} joins thee!»,
  // «{} is already in thy party.», «Thy party is full.») eran texto FABRICADO: 58413c38
  // las sacó de party.ts al calcar las tres salidas reales de join_party
  // (TALK.OVL:0x080a), y sus keys salieron de es.json con este mismo commit. Un CASE
  // sobre una plantilla que ningún sitio compone es un verde que no mide nada.
  { site: "debugApi:testHookInnLeave", tpl: "{}? I know of no such person.", args: ["Foo"], legacy: `${"Foo"}? I know of no such person.` },
  // cast.ts (genérica {}! — no se traduce)
  { site: "cast:299", tpl: "{}!", args: ["Vas Lor"], legacy: `${"Vas Lor"}!` },
  // commands.ts
  { site: "commands:89", tpl: "{} must lead!", args: ["Iolo"], legacy: `${"Iolo"} must lead!` },
  // main.ts
  { site: "main:684", tpl: "{}, armed with {}:", args: ["Avatar", "Sword"], legacy: `${"Avatar"}, armed with ${"Sword"}:` },
  { site: "main:heal", tpl: "{} is healed!", args: ["Iolo"], legacy: `${"Iolo"} is healed!` },
  { site: "main:cure", tpl: "{} is cured!", args: ["Iolo"], legacy: `${"Iolo"} is cured!` },
  { site: "main:awaken", tpl: "{} awakens!", args: ["Iolo"], legacy: `${"Iolo"} awakens!` },
  // shadowlords.ts
  { site: "sl:56", tpl: "{} is already no more.", args: ["Faulinei"], legacy: `${"Faulinei"} is already no more.` },
  { site: "sl:61", tpl: "Without the Shard of {}, {} cannot be undone.", args: ["Falsehood", "Faulinei"], legacy: `Without the Shard of ${"Falsehood"}, ${"Faulinei"} cannot be undone.` },
  // commands.ts — lootItemName (nombre del (G)et de botín; singular/plural = dos plantillas)
  { site: "loot:gold", tpl: "{} gold!", args: [50], legacy: `${50} gold!` },
  { site: "loot:food", tpl: "{} food!", args: [12], legacy: `${12} food!` },
  { site: "loot:key1", tpl: "{} key!", args: [1], legacy: `${1} key!` },
  { site: "loot:keys", tpl: "{} keys!", args: [2], legacy: `${2} keys!` },
  { site: "loot:gem1", tpl: "{} gem!", args: [1], legacy: `${1} gem!` },
  { site: "loot:gems", tpl: "{} gems!", args: [3], legacy: `${3} gems!` },
  { site: "loot:torch1", tpl: "{} torch!", args: [1], legacy: `${1} torch!` },
  { site: "loot:torches", tpl: "{} torches!", args: [2], legacy: `${2} torches!` },
  // #126 — las 3 plantillas que estaban CATALOGADAS y muertas por `${}` nativo. El
  // `legacy` de cada una es LA COMPOSICIÓN QUE HABÍA en el call-site antes del fix.
  { site: "use-tools:186 sextante", tpl: "Position: {}, {}", args: [123, 45], legacy: `Position: ${123}, ${45}` },
  { site: "use-tools:202 reloj", tpl: "The pocket watch reads {}:{} {}.", args: [1, "30", "PM"], legacy: `The pocket watch reads ${1}:${"30"} ${"PM"}.` },
  { site: "camp:319 casco", tpl: "Hull now {}!\n\n", args: [51], legacy: `Hull now ${51}!\n\n` },
];

describe("i18n cableado (1) — src/i18n es hoja de dependencias (sin skin/core)", () => {
  it("ningún fichero de src/i18n importa de ../skin ni ../core", () => {
    const dir = join(__dirname, "..", "src", "i18n");
    // SUELO anti-verde-hueco (#178): el censo quantifica sobre lo que el readdirSync ve.
    // Si i18n se reorganizara en subdirectorios (readdirSync NO recursa) o el filtro
    // dejara de casar, offenders=[] diría «hoja limpia» con población CERO. Hoy son 4
    // .ts (index, keyword-alias-es, shell, huella —esta última entró con #380) y el
    // módulo raíz tiene que estar.
    const escaneados = readdirSync(dir).filter((f) => f.endsWith(".ts"));
    expect(escaneados.length, "el barrido de src/i18n colapsó").toBeGreaterThanOrEqual(3);
    expect(escaneados, "el módulo raíz de i18n no está en el barrido").toContain("index.ts");
    const offenders: string[] = [];
    for (const f of readdirSync(dir)) {
      if (!f.endsWith(".ts")) continue;
      const src = readFileSync(join(dir, f), "utf8");
      // imports estáticos y dinámicos que salgan hacia skin/ o core/
      for (const m of src.matchAll(/(?:from|import)\s*\(?\s*["']([^"']+)["']/g)) {
        const spec = m[1]!;
        if (/(^|\/)(skin|core)(\/|$)/.test(spec)) offenders.push(`${f} → ${spec}`);
      }
    }
    expect(offenders, `src/i18n debe ser hoja: ${offenders.join(", ")}`).toEqual([]);
  });
});

describe("i18n cableado (2) — tf() byte-igual a la interpolación nativa en 'en'", () => {
  for (const c of CASES) {
    it(`${c.site}: tf(${JSON.stringify(c.tpl)}) === legacy`, () => {
      setLang(BASE_LANG, { persist: false });
      expect(tf(c.tpl, ...c.args)).toBe(c.legacy);
    });
  }

  it("un número se compone como String() (idéntico a `${n}`)", () => {
    setLang(BASE_LANG, { persist: false });
    expect(tf("{} hits {} for {}.", "A", "B", 12)).toBe(`${"A"} hits ${"B"} for ${12}.`);
  });
});

describe("i18n cableado (3) — idempotencia y compuesto-inerte", () => {
  it("t(t(x)) === t(x) para TODA key de es.json (las piezas se traducen una vez)", () => {
    setLang("es", { persist: false });
    // 🔴 REFORMULADO EN #380, y NO por gusto: las keys son ahora HUELLAS, así que el
    // bucle de antes —`for (k of Object.keys(esStrings)) t(t(k)) !== t(k)`— se habría
    // quedado VERDE SIN MEDIR NADA. `t(huella)` no casa con la tabla y devuelve la
    // huella tal cual, de modo que `t(t(k)) === t(k)` sería cierto por construcción
    // para las 3.998 entradas. Un aserto vacuo que pasa es peor que uno que falla.
    //
    // La propiedad de verdad no necesita el inglés: dice que NINGUNA traducción
    // española es, a su vez, clave de la tabla (si lo fuera, la segunda pasada del
    // choke la volvería a traducir). Eso se pregunta directamente sobre el VALOR, que
    // sí tenemos, y deja el fichero PURO (recuperar el inglés exigiría `game/assets`,
    // que la batería pura no monta).
    const bad: string[] = [];
    for (const [k, v] of Object.entries(esStrings)) {
      const traducida = rewrap(v.t);
      const otra = esStrings[huella(traducida)];
      if (otra !== undefined && rewrap(otra.t) !== traducida) bad.push(`${k} → ${traducida.slice(0, 40)}`);
    }
    expect(bad, `traducciones que vuelven a casar como key (doble traducción): ${bad.slice(0, 5).join(" | ")}`).toEqual([]);
    // CONTROL POSITIVO de que la población no es vacía (el bucle de arriba recorre la
    // tabla entera, pero un `esStrings` vacío también daría `bad === []`).
    expect(Object.keys(esStrings).length).toBeGreaterThan(3000);
  });

  it("t(tf(tpl, ...args)) === tf(tpl, ...args) — el compuesto no es key (2ª pasada inerte)", () => {
    setLang("es", { persist: false });
    for (const c of CASES) {
      const composed = tf(c.tpl, ...c.args);
      expect(t(composed), `compuesto de ${c.site} re-traducido por el choke`).toBe(composed);
    }
  });

  it("en 'es', un arg-nombre pasa por t() una vez; el genérico {} deja la plantilla identidad", () => {
    setLang("es", { persist: false });
    // "{}!" no está en la tabla → plantilla identidad; el arg pasa por t() (aquí, sin hit → identidad)
    expect(tf("{}!", "Vas Lor")).toBe(`${t("Vas Lor")}!`);
  });
});

describe("i18n cableado (4) — lootItemName enruta el botín por tf() (traduce bajo 'es')", () => {
  // Regresión: antes lootItemName componía «50 gold!» con template crudo, y el choke de
  // consola t() sobre el string ENTERO no casaba la key «{} gold!» → inglés en 'es'. Ahora
  // va por tf(plantilla, qty). En 'en' la salida es byte-idéntica (cubierto por CASES);
  // en 'es' la línea completa aparece traducida. Singular/plural = dos plantillas.
  it("'en': byte-idéntico a la interpolación nativa", () => {
    setLang(BASE_LANG, { persist: false });
    expect(lootItemName(2, 50)).toBe("50 gold!");
    expect(lootItemName(7, 1)).toBe("1 key!");
    expect(lootItemName(7, 3)).toBe("3 keys!");
    expect(lootItemName(8, 2)).toBe("2 gems!");
    expect(lootItemName(13, 1)).toBe("1 torch!");
    expect(lootItemName(15, 9)).toBe("9 food!");
  });

  it("'es': el botín numérico sale traducido (no en inglés)", () => {
    setLang("es", { persist: false });
    expect(lootItemName(2, 50)).toBe("¡50 de oro!");
    expect(lootItemName(7, 1)).toBe("¡1 llave!");
    expect(lootItemName(7, 3)).toBe("¡3 llaves!");
    expect(lootItemName(8, 2)).toBe("¡2 gemas!");
    expect(lootItemName(13, 1)).toBe("¡1 antorcha!");
    expect(lootItemName(15, 9)).toBe("¡9 de comida!");
  });
});
