/**
 * WALKTHROUGH-ESPEJO Fase C — ANCLAS DE POSICIÓN POR-INTERACCIÓN (guardas OFFLINE).
 *
 * Dos mitades, ambas puras (sin Playwright):
 *   · DERIVACIÓN (tools/derive-anchors.mjs): OCR de (L)ook-DIR + LOOK2 → ancla de cara.
 *   · RESOLUCIÓN (e2e/espejo-tour/anchors.ts): ancla + grid vivo → celda + salto de resync.
 * Más un guard de que las rutas COMMITEADAS llevan las anclas que el pipeline deriva.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  faceCandidates,
  resolveFaceAnchor,
  resolveFaceAnchorAcrossFloors,
  objectFaceCandidates,
  planAnchorResync,
  driftBucket,
  driftHistogram,
  ARROW_TO_DIR,
  ANCHOR_DELTA,
  hourToBand,
  bandMatches,
  bandCanonicalHour,
  resolveNpcAnchor,
  type GridSnapshot,
  type FaceAnchor,
  type NpcAnchor,
  type NpcLive,
} from "../e2e/espejo-tour/anchors";
import {
  normPhrase,
  extractSees,
  parseLookExpect,
  buildLook2Index,
  deriveSegmentAnchors,
  LOCATION_NAMES as DERIVE_LOCATION_NAMES,
  buildShoppeIndex,
  hasWholeWords,
  isTalkExpect,
  matchShoppeType,
  deriveSegmentNpcAnchors,
} from "../e2e/espejo-tour/tools/derive-anchors.mjs";
import { LOCATION_NAMES as PORT_LOCATION_NAMES } from "../src/core/shops/shops.js";
import { loadRoute, listParts } from "../e2e/espejo-tour/runner";

// ------------------------------------------------------------- helpers de grid
/** Grid W×H de tile `fill`, con overrides puntuales `{ "x,y": tileId }`. */
function makeGrid(W: number, H: number, fill: number, over: Record<string, number> = {}): GridSnapshot {
  const grid: number[][] = [];
  for (let y = 0; y < H; y++) {
    const row: number[] = [];
    for (let x = 0; x < W; x++) row.push(over[`${x},${y}`] ?? fill);
    grid.push(row);
  }
  return { W, H, grid };
}
const faceAnchor = (over: Partial<FaceAnchor> = {}): FaceAnchor => ({
  kind: "face",
  cmd: "l",
  dir: "east",
  sees: "a hot stove",
  tileIds: [191],
  ...over,
});

// ============================================================ DERIVACIÓN (.mjs)
describe("derive-anchors — normalización y parseo del OCR", () => {
  it("normPhrase colapsa mayúsculas, 0→o, puntuación y espacios", () => {
    expect(normPhrase("A Hot Stove!")).toBe("a hot stove");
    expect(normPhrase("an 0aken  barrel")).toBe("an oaken barrel");
  });

  it("extractSees quita el eco del comando y el marco «Thou dost see»", () => {
    expect(extractSees("Look-East Thou dost see a hot stove")).toBe("a hot stove");
    expect(extractSees("Look-West an oaken barrel")).toBe("an oaken barrel");
    expect(extractSees(">Look Player: Min Thou dost see a flickering torch")).toBe("a flickering torch");
  });

  it("parseLookExpect exige DIRECCIÓN legible (Look-2 partido por OCR → null)", () => {
    expect(parseLookExpect("Look-East Thou dost see a hot stove")).toEqual({ dir: "east", sees: "a hot stove" });
    expect(parseLookExpect("Look-South a fruit tree")).toEqual({ dir: "south", sees: "a fruit tree" });
    expect(parseLookExpect("Look-2")).toBeNull(); // dirección corrupta → no invertible
    expect(parseLookExpect("Search-East Thou dost find nothing")).toBeNull(); // no es (L)ook
  });
});

describe("derive-anchors — deriveSegmentAnchors (fuente única CLI+runner)", () => {
  const look2 = buildLook2Index(
    (() => {
      const a: string[] = new Array(512).fill("");
      a[191] = "a hot stove";
      a[45] = "bountiful crops";
      a[46] = "a fruit tree";
      return a;
    })(),
  );

  it("ancla un beat Look-DIR con feature invertible al op de comando, dir de la flecha", () => {
    const seg = {
      script: [
        { key: "l", ocrLn: 5 },
        { key: "ArrowRight", ocrLn: 5 },
      ],
      expect: [{ text: "Look-East Thou dost see a hot stove", ocrLn: 5 }],
    };
    const anchors = deriveSegmentAnchors(seg, look2);
    expect(anchors).toHaveLength(1);
    expect(anchors[0]).toMatchObject({
      opIndex: 0,
      anchor: { kind: "face", dir: "east", sees: "a hot stove", tileIds: [191] },
    });
  });

  it("ancla un beat en un op TODO no-conducido (corrige el trail igual)", () => {
    const seg = {
      script: [{ todo: "Look-N", ocrLn: 9 }],
      expect: [{ text: "Look-North Thou dost see bountiful crops", ocrLn: 9 }],
    };
    const anchors = deriveSegmentAnchors(seg, look2);
    expect(anchors).toHaveLength(1);
    expect(anchors[0]!.anchor).toMatchObject({ dir: "north", sees: "bountiful crops", tileIds: [45] });
  });

  it("NO ancla features no-invertibles (deseo del pozo) ni beats sin op anclable", () => {
    const wish = {
      script: [{ key: "l", ocrLn: 3 }, { key: "ArrowUp", ocrLn: 3 }],
      expect: [{ text: "Look-North Thou dost see CORVETTE No effect...", ocrLn: 3 }],
    };
    expect(deriveSegmentAnchors(wish, look2)).toHaveLength(0);
    const noOp = {
      script: [{ nav: [{ m: "north", v: "walk", n: 1 }] }],
      expect: [{ text: "Look-South a fruit tree", ocrLn: 7 }],
    };
    expect(deriveSegmentAnchors(noOp, look2)).toHaveLength(0); // sólo movimiento en ese ocrLn
  });

  it("NO ancla el cofre-OBJETO «a chest» (capa de objetos) pero SÍ «a chest of drawers» (mueble estático)", () => {
    const look2Chest = buildLook2Index(
      (() => {
        const a: string[] = new Array(512).fill("");
        a[257] = "a chest"; // cofre = objeto (no rejilla) → excluido
        a[300] = "a chest of drawers"; // mueble = tile estático → anclable
        return a;
      })(),
    );
    const chest = {
      script: [{ key: "l", ocrLn: 1 }, { key: "ArrowDown", ocrLn: 1 }],
      expect: [{ text: "Look-South Thou dost see a chest", ocrLn: 1 }],
    };
    expect(deriveSegmentAnchors(chest, look2Chest)).toHaveLength(0); // objeto → SIN ancla (falso MISS evitado)
    const drawers = {
      script: [{ key: "l", ocrLn: 2 }, { key: "ArrowDown", ocrLn: 2 }],
      expect: [{ text: "Look-South Thou dost see a chest of drawers", ocrLn: 2 }],
    };
    expect(deriveSegmentAnchors(drawers, look2Chest)).toHaveLength(1); // mueble → SÍ ancla
  });

  it("NO ancla miradas a ACTORES (sprites NPC 324-383 se mueven) pero SÍ a la alfombra-objeto 283 y al Amulet 439", () => {
    const look2Mix = buildLook2Index(
      (() => {
        const a: string[] = new Array(512).fill("");
        for (let t = 340; t <= 343; t++) a[t] = "a merchant"; // actor → excluido (ad01-g03)
        a[283] = "an odd rug"; // alfombra plot (capa de objetos del runner) → anclable
        a[439] = "the Amulet!"; // ítem de trama sobre el rango de actor → anclable
        return a;
      })(),
    );
    const mk = (text: string, ln: number) => ({
      script: [{ key: "l", ocrLn: ln }, { key: "ArrowDown", ocrLn: ln }],
      expect: [{ text, ocrLn: ln }],
    });
    expect(deriveSegmentAnchors(mk("Look-South Thou dost see a merchant", 1), look2Mix)).toHaveLength(0);
    expect(deriveSegmentAnchors(mk("Look-South Thou dost see an odd rug", 2), look2Mix)).toHaveLength(1);
    expect(deriveSegmentAnchors(mk("Look-South Thou dost see the Amulet!", 3), look2Mix)).toHaveLength(1);
  });
});

// ------------------------------------------- DERIVACIÓN de anclas de NPC (mercader)
const loadAsset = <T>(rel: string): T =>
  JSON.parse(readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8").replace(/^﻿/, "")) as T;

describe("derive-anchors — censo invertible de mercaderes (assets del port)", () => {
  const data = loadAsset<{ storeNames: string[]; shoppeKeeperNames: string[] }>("../assets/data.json");
  const map = loadAsset<Record<string, { Location: string; ShoppeKeeperType: string }>>(
    "../src/core/data/ShoppeKeeperMap.json",
  );
  const shoppe = buildShoppeIndex(map, data.storeNames, data.shoppeKeeperNames);

  it("la copia de LOCATION_NAMES del derivador es IDÉNTICA a la del port", () => {
    // El derivador es .mjs y no puede importar shops.ts: su tabla es una COPIA. Este pin es lo
    // que impide que derive en silencio (una location renombrada en el port dejaría de casar la
    // guarda y las anclas desaparecerían sin que nadie lo notara).
    expect(DERIVE_LOCATION_NAMES).toEqual(PORT_LOCATION_NAMES);
  });

  it("el emparejamiento posicional casa los tríos conocidos del corpus AD", () => {
    // Los tres que el OCR del LP2 transcribe literalmente (ad01-g03, ad01-g03, ad01-g07).
    const at = (loc: string, type: string) => shoppe.find((s) => s.locName === loc && s.type === type);
    expect(at("Britain", "Blacksmith")).toMatchObject({ keeper: "Gwenneth", store: "Iolo's Bows" });
    expect(at("Britain", "Barkeeper")).toMatchObject({ keeper: "Tika", store: "The Wayfarer Tavern" });
    expect(at("East_Britanny", "Shipwright")).toMatchObject({ keeper: "Master Hawkins", store: "The Oaken Oar" });
  });

  it("elimina el nombre basura «Simplon» (mismo desfase que shoppeKeeperAt)", () => {
    expect(data.shoppeKeeperNames).toContain("Simplon");
    expect(shoppe.map((s) => s.keeper)).not.toContain("Simplon");
    expect(shoppe.every((s) => s.keeper !== "" && s.store !== "")).toBe(true);
  });
});

describe("derive-anchors — matchShoppeType (beat de Talk → tipo de tienda)", () => {
  const shoppe = [
    { index: 0, locName: "Britain", type: "Blacksmith", store: "Iolo's Bows", keeper: "Gwenneth" },
    { index: 10, locName: "Britain", type: "Barkeeper", store: "The Wayfarer Tavern", keeper: "Tika" },
    { index: 23, locName: "East_Britanny", type: "Shipwright", store: "The Oaken Oar", keeper: "Master Hawkins" },
    { index: 17, locName: "Lycaeum", type: "Barkeeper", store: "The Folley Tap", keeper: "Rob" },
  ];

  it("casa por nombre de NEGOCIO y por nombre de MERCADER (los dos canales del saludo)", () => {
    expect(matchShoppeType('Talk-North "Good morning, and welcome to Iolo\'s Bows!"', shoppe, "Britain")).toBe("Blacksmith");
    expect(matchShoppeType('Talk-North "My name is Tika thy host this morning."', shoppe, "Britain")).toBe("Barkeeper");
  });

  it("tolera la corrupción OCR que normPhrase ya pliega (o→0)", () => {
    // ad01-g07 OCR 3164, literal: «Welcome to The 0aken 0ar!».
    expect(matchShoppeType('Talk-South "Ahoy, gailor! Welcome to The 0aken 0ar!"', shoppe, "East_Britanny")).toBe("Shipwright");
  });

  it("FRONTERA DE PALABRA: «black robes» no es el mercader «Rob» (falso positivo MEDIDO)", () => {
    // ad05-g02 / ad06-g12 / ad23-g03: con substring pelado, "Rob" casaba dentro de «robes» y
    // anclaba a la taberna del Lycaeum. Control opuesto: el nombre entero SÍ casa.
    expect(matchShoppeType('Talk-North You see a man flowing black robes.', shoppe, "Lycaeum")).toBeNull();
    expect(matchShoppeType('Talk-North "I am Rob, thy host."', shoppe, "Lycaeum")).toBe("Barkeeper");
  });

  it("NO ancla sin location legible, ni con la location DISCORDANTE, ni fuera de un beat de Talk", () => {
    expect(matchShoppeType('Talk-North "welcome to Iolo\'s Bows!"', shoppe, undefined)).toBeNull();
    // El saludo es de Britain pero la party está en East Britanny → engancharía otro herrero.
    expect(matchShoppeType('Talk-North "welcome to Iolo\'s Bows!"', shoppe, "East_Britanny")).toBeNull();
    // Mención sin (T)alk: un cartel o un rumor NO es una conversación abierta.
    expect(matchShoppeType('Look-North Thou dost see Iolo\'s Bows', shoppe, "Britain")).toBeNull();
  });

  it("NO ancla si el beat casa DOS tipos en la misma location (ambiguo, no se adivina)", () => {
    expect(matchShoppeType('Talk-North "Iolo\'s Bows" ... "The Wayfarer Tavern"', shoppe, "Britain")).toBeNull();
  });

  it("hasWholeWords / isTalkExpect: los primitivos", () => {
    expect(hasWholeWords("a man in black robes", "rob")).toBe(false);
    expect(hasWholeWords("i am called maxwell", "max")).toBe(false);
    expect(hasWholeWords("i am rob", "rob")).toBe(true);
    expect(hasWholeWords("welcome to iolo s bows", "iolo s bows")).toBe(true);
    // La dirección NO se exige: el ancla de NPC no lleva dir (la calcula el runner).
    expect(isTalkExpect("Talk-5outh algo")).toBe(true);
    expect(isTalkExpect("Talk-d")).toBe(true);
    expect(isTalkExpect("they talked about it")).toBe(false);
  });
});

describe("derive-anchors — deriveSegmentNpcAnchors (fuente única CLI+units)", () => {
  const shoppe = [
    { index: 0, locName: "Britain", type: "Blacksmith", store: "Iolo's Bows", keeper: "Gwenneth" },
  ];
  const greet = 'Talk-North "Good morning, and welcome to Iolo\'s Bows!" Gwenneth says,';

  it("ancla el beat de (T)alk al op de comando `t` del mismo ocrLn, SIN expectDelta", () => {
    const seg = {
      enter: { loc: 2 },
      script: [{ key: "t", ocrLn: 5 }, { key: "ArrowUp", ocrLn: 5 }],
      expect: [{ text: greet, ocrLn: 5 }],
    };
    const out = deriveSegmentNpcAnchors(seg, shoppe);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ opIndex: 0, anchor: { kind: "npc", cmd: "talk", match: "shop:Blacksmith", ocrLn: 5 } });
    // El delta NO se deriva aquí: exige el seedInt triangulado del avatar del LP2 (carril E-2).
    expect(out[0]!.anchor).not.toHaveProperty("expectDelta");
  });

  it("ancla también en un op TODO no-conducido (el resync corrige el trail igual)", () => {
    const seg = { enter: { loc: 2 }, script: [{ todo: "Talk-N", ocrLn: 9 }], expect: [{ text: greet, ocrLn: 9 }] };
    expect(deriveSegmentNpcAnchors(seg, shoppe)).toHaveLength(1);
  });

  it("NO ancla sin location, ni en MAZMORRA, ni cuando el ocrLn sólo tiene movimiento", () => {
    const mk = (enter: unknown, script: unknown[]) => ({ enter, script, expect: [{ text: greet, ocrLn: 1 }] });
    expect(deriveSegmentNpcAnchors(mk({ overworld: true }, [{ key: "t", ocrLn: 1 }]) as never, shoppe)).toHaveLength(0);
    expect(deriveSegmentNpcAnchors(mk({ loc: 2, dungeon: true }, [{ key: "t", ocrLn: 1 }]) as never, shoppe)).toHaveLength(0);
    // loc 25 no está en LOCATION_NAMES (no es una location con mercaderes) → sin ancla.
    expect(deriveSegmentNpcAnchors(mk({ loc: 25 }, [{ key: "t", ocrLn: 1 }]) as never, shoppe)).toHaveLength(0);
    // Sólo un `nav` en ese ocrLn: anclar a mitad de un run de movimiento rompe la costura.
    expect(deriveSegmentNpcAnchors(mk({ loc: 2 }, [{ nav: [{ m: "north", v: "walk", n: 1 }], ocrLn: 1 }]) as never, shoppe)).toHaveLength(0);
  });
});

describe("derive-anchors — rutas COMMITEADAS ya enriquecidas", () => {
  it("part01 lleva las 5 anclas de cara del interior de la choza (stove/barrel/torch/crops/tree)", () => {
    const route = loadRoute("part01");
    const anchors = route.segments.flatMap((s) => s.script.filter((o) => (o as { anchor?: unknown }).anchor));
    expect(anchors.length).toBeGreaterThanOrEqual(5);
    const stove = anchors.find((o) => (o as { anchor: FaceAnchor }).anchor.sees === "a hot stove");
    expect(stove).toBeDefined();
    expect((stove as { anchor: FaceAnchor }).anchor).toMatchObject({ kind: "face", dir: "east", tileIds: [0xbf] });
  });

  it("toda ancla commiteada es FACE (tileIds+dir) o NPC (match no vacío)", () => {
    const dirs = new Set(["north", "south", "east", "west"]);
    let face = 0;
    let npc = 0;
    for (const part of listParts()) {
      for (const seg of loadRoute(part).segments) {
        for (const op of seg.script) {
          const a = (op as { anchor?: FaceAnchor | { kind: "npc"; match: string; expectDelta?: number } }).anchor;
          if (!a) continue;
          if (a.kind === "face") {
            face++;
            expect((a as FaceAnchor).tileIds.length).toBeGreaterThan(0);
            expect(dirs.has((a as FaceAnchor).dir)).toBe(true);
          } else {
            npc++;
            expect(a.kind).toBe("npc");
            expect((a as { match: string }).match.length).toBeGreaterThan(0);
          }
        }
      }
    }
    expect(face).toBeGreaterThanOrEqual(18); // el pipeline deriva ~18 anclas de cara (era ~21;
    //   −2 al excluir el cofre-OBJETO «a chest» de Cove part04-g01 (OBJECT_FEATURES) y −1 al
    //   excluir la mirada al ACTOR «a wizard» de part08-g06 (ACTOR_TILE_MIN..MAX, se mueven);
    //   ver derive-anchors.mjs)
    expect(npc).toBeGreaterThanOrEqual(1); // + anclas NPC de transacción colocadas por overlay
  });

  it("routes-ad lleva las 47 anclas de NPC derivadas del OCR de (T)alk (corpus AD, espejo-2)", () => {
    // El corpus AD tenía CERO anclas de NPC — y del ancla de NPC cuelga el ledger entero
    // (runner.ts sólo lee expectDelta de un anchor.kind === "npc"). Guarda de que las rutas
    // COMMITEADAS llevan lo que el derivador extendido produce.
    const ROUTES_AD = fileURLToPath(new URL("../e2e/espejo-tour/routes-ad", import.meta.url));
    const TYPES = new Set([
      "Blacksmith", "Barkeeper", "HorseSeller", "Shipwright",
      "MagicSeller", "GuildMaster", "Healer", "InnKeeper",
    ]);
    const perPart: Record<string, number> = {};
    let npc = 0;
    for (const part of listParts(ROUTES_AD)) {
      for (const seg of loadRoute(part, ROUTES_AD).segments) {
        for (const op of seg.script) {
          const a = (op as { anchor?: { kind: string; cmd: string; match: string } }).anchor;
          if (a?.kind !== "npc") continue;
          // ★ F3b — las anclas DERIVADAS (del OCR de (T)alk) son las que este candado cuenta.
          // El poblado del ledger añade anclas de TRANSACCIÓN colocadas por overlay, con
          // `cmd: "buy"`/"sell" (misma forma que los dos verdes de LP1): no las produce el
          // derivador, así que contarlas aquí mezclaría dos poblaciones y este número dejaría
          // de decir «lo que el derivador extrae». Se cuentan aparte, abajo.
          if ((op as { src?: string }).src === "overlay") {
            expect(["buy", "sell"]).toContain(a.cmd);
            expect(a.match.startsWith("shop:")).toBe(true);
            continue;
          }
          npc++;
          perPart[part] = (perPart[part] ?? 0) + 1;
          expect(a.cmd).toBe("talk");
          // Todas por TIPO de tienda (`shop:<ShopType>`), el canal robusto de anchors.ts —
          // NUNCA por nombre: liveNpcs() del runner no proyecta `name`, así que un match por
          // nombre daría NPC-ANCHOR-MISS siempre.
          expect(a.match.startsWith("shop:")).toBe(true);
          expect(TYPES.has(a.match.slice(5))).toBe(true);
        }
      }
    }
    expect(npc).toBe(47);
    // Reparto por parte (pre-registrado antes de regenerar; si el OCR se re-segmenta y esto
    // se mueve, es un cambio que hay que MIRAR, no re-sellar a ciegas).
    expect(perPart).toEqual({
      ad01: 6, ad03: 8, ad04: 5, ad05: 6, ad06: 5, ad07: 5,
      ad08: 2, ad10: 1, ad11: 1, ad14: 1, ad16: 1, ad19: 1, ad21: 5,
    });
  });

  // ★ RE-CALIBRADO CON MOTIVO (carril `teclas-ad09`): 1 → 2. `ad09-g04` puebla la compra del
  // herrero de Bordermarch (−274). El candado hace justo lo que prometía — subió aquí y el de
  // las 47 del derivador NO se movió, así que las dos cifras siguen siendo comparables.
  // ★ RE-CALIBRADO CON MOTIVO (carril `poblar-deltas`): 2 → 5. Las TRES ventas `smallmap` de
  // `ad03-g11` (+3), `ad04-g08` (+58) y `ad06-g34` (+220) — las primeras anclas de overlay con
  // `cmd: "sell"` del proyecto. El candado de las 47 del derivador sigue sin moverse.
  it("F3b — routes-ad lleva CINCO anclas de TRANSACCIÓN colocadas por overlay", () => {
    // Candado gemelo del de arriba, en canal PROPIO: separa «lo que el derivador extrae» de
    // «lo que el poblado del ledger coloca». Si alguien puebla otra compra, este número sube
    // aquí y el de las 47 no se mueve — que es justo lo que hace comparables las dos cifras
    // entre ventanas.
    const ROUTES_AD = fileURLToPath(new URL("../e2e/espejo-tour/routes-ad", import.meta.url));
    const txn: string[] = [];
    for (const part of listParts(ROUTES_AD))
      for (const seg of loadRoute(part, ROUTES_AD).segments)
        for (const op of seg.script) {
          const a = (op as { anchor?: { kind: string } }).anchor;
          if (a?.kind === "npc" && (op as { src?: string }).src === "overlay") txn.push(seg.id);
        }
    expect(txn.sort()).toEqual(["ad03-g11", "ad04-g08", "ad06-g34", "ad09-g04", "ad21-g26"]);
  });
});

// ============================================================ RESOLUCIÓN (.ts)
describe("anchors — mapas de dirección coherentes", () => {
  it("ARROW_TO_DIR y ANCHOR_DELTA son consistentes con el grid (y crece hacia abajo)", () => {
    expect(ARROW_TO_DIR.ArrowUp).toBe("north");
    expect(ARROW_TO_DIR.ArrowRight).toBe("east");
    expect(ANCHOR_DELTA.north).toEqual([0, -1]);
    expect(ANCHOR_DELTA.east).toEqual([1, 0]);
  });
});

describe("anchors — faceCandidates (celdas cuyo vecino-DIR casa)", () => {
  it("encuentra la celda a la OESTE de una feature al este", () => {
    const snap = makeGrid(5, 5, 5, { "3,2": 191 }); // stove en (3,2)
    const cands = faceCandidates(snap, [191], "east");
    expect(cands).toEqual([{ x: 2, y: 2 }]); // (2,2) mira al este → (3,2)
  });

  it("respeta el predicado `standable` (no ancla sobre un muro)", () => {
    const snap = makeGrid(5, 5, 5, { "3,2": 191, "2,2": 0 }); // la celda-mirador (2,2) es muro
    const wall = (t: number): boolean => t !== 0;
    expect(faceCandidates(snap, [191], "east", wall)).toHaveLength(0);
    expect(faceCandidates(snap, [191], "east")).toHaveLength(1); // sin predicado, sí
  });
});

describe("anchors — resolveFaceAnchor (celda + deriva o veredicto)", () => {
  it("resuelve único y calcula la deriva Manhattan al mirador", () => {
    const snap = makeGrid(6, 6, 5, { "3,2": 191 });
    const res = resolveFaceAnchor(snap, faceAnchor(), { x: 0, y: 2 });
    expect(res.status).toBe("resolved");
    expect(res.cell).toEqual({ x: 2, y: 2 });
    expect(res.drift).toBe(2); // de (0,2) a (2,2)
  });

  it("con varias candidatas elige la MÁS CERCANA (deriva incremental)", () => {
    const snap = makeGrid(6, 8, 5, { "3,2": 191, "3,6": 191 }); // miradores (2,2) y (2,6)
    const res = resolveFaceAnchor(snap, faceAnchor(), { x: 2, y: 1 });
    expect(res.status).toBe("resolved");
    expect(res.cell).toEqual({ x: 2, y: 2 }); // más cerca de (2,1)
  });

  it("0 candidatas → miss (feature ausente = candidato a divergencia)", () => {
    const snap = makeGrid(5, 5, 5);
    expect(resolveFaceAnchor(snap, faceAnchor({ tileIds: [999] }), { x: 0, y: 0 }).status).toBe("miss");
  });

  it("demasiadas candidatas → ambiguous (resync declinado)", () => {
    const snap = makeGrid(5, 5, 191); // TODO es stove → muchísimos miradores
    const res = resolveFaceAnchor(snap, faceAnchor(), { x: 0, y: 0 }, { maxCandidates: 3 });
    expect(res.status).toBe("ambiguous");
    expect(res.candidates).toBeGreaterThan(3);
  });
});

describe("anchors — resolveFaceAnchorAcrossFloors (fallback multi-planta)", () => {
  const empty = makeGrid(6, 6, 5);
  const withStove = makeGrid(6, 6, 5, { "3,2": 191 });

  it("resuelve en OTRA planta cuando la actual no tiene la feature (bookshelf LB f2)", () => {
    const res = resolveFaceAnchorAcrossFloors(
      [
        { z: 0, snap: empty },
        { z: 2, snap: withStove },
      ],
      faceAnchor(),
      { x: 0, y: 2 },
      0,
    );
    expect(res.status).toBe("resolved");
    expect(res.floor).toBe(2);
    expect(res.cell).toEqual({ x: 2, y: 2 });
  });

  it("prefiere la planta ACTUAL si resuelve en varias", () => {
    const res = resolveFaceAnchorAcrossFloors(
      [
        { z: 0, snap: withStove },
        { z: 1, snap: withStove },
      ],
      faceAnchor(),
      { x: 0, y: 2 },
      1,
    );
    expect(res.status).toBe("resolved");
    expect(res.floor).toBe(1);
  });

  it("varias plantas NO-actuales resuelven → ambiguous (no se adivina la planta)", () => {
    const res = resolveFaceAnchorAcrossFloors(
      [
        { z: 1, snap: withStove },
        { z: 2, snap: withStove },
      ],
      faceAnchor(),
      { x: 0, y: 2 },
      0,
    );
    expect(res.status).toBe("ambiguous");
  });

  it("sótano z=-1 también participa (Yew)", () => {
    const res = resolveFaceAnchorAcrossFloors(
      [
        { z: -1, snap: withStove },
        { z: 0, snap: empty },
      ],
      faceAnchor(),
      { x: 0, y: 2 },
      0,
    );
    expect(res.status).toBe("resolved");
    expect(res.floor).toBe(-1);
  });

  it("objectFaceCandidates: la alfombra-objeto (Carpet2 283) invierte al mirador opuesto a dir", () => {
    const objs = [
      { x: 10, y: 12, tile: 283, floor: 2 },
      { x: 3, y: 3, tile: 400, floor: 0 }, // otro objeto: no casa
    ];
    const cands = objectFaceCandidates(objs, [283], "south"); // miró al SUR → mirador al norte del objeto
    expect(cands).toEqual([{ floor: 2, cell: { x: 10, y: 11 } }]);
    expect(objectFaceCandidates(objs, [283], "east")).toEqual([{ floor: 2, cell: { x: 9, y: 12 } }]);
  });

  it("ninguna planta la tiene → miss (feature ausente en TODO el edificio)", () => {
    const res = resolveFaceAnchorAcrossFloors(
      [
        { z: 0, snap: empty },
        { z: 1, snap: empty },
      ],
      faceAnchor(),
      { x: 0, y: 2 },
      0,
    );
    expect(res.status).toBe("miss");
  });
});

describe("anchors — CONSCIENCIA DE HORA (grid COMPUESTO, verja nocturna TOWN 0x0170)", () => {
  // Celda testigo: Yew z=0 (15,28) = 0x99 (portcullis) en banda 20:00-4:59; 0x44 (suelo) de día.
  const PORTCULLIS = 0x99;
  const FLOOR = 0x44;
  const nightGrid = makeGrid(32, 32, FLOOR, { "15,28": PORTCULLIS }); // grid COMPUESTO de noche
  const dayGrid = makeGrid(32, 32, FLOOR, { "15,28": FLOOR }); // de día la verja es suelo
  // party al sur de la verja mirando al NORTE hacia (15,28)
  const portcullisAnchor = (b?: "day" | "night"): FaceAnchor => ({
    kind: "face", cmd: "l", dir: "north", sees: "a portcullis", tileIds: [PORTCULLIS], hourBand: b,
  });

  it("hourToBand: 20:00-4:59 = noche; resto = día", () => {
    expect(hourToBand(22)).toBe("night");
    expect(hourToBand(4)).toBe("night");
    expect(hourToBand(20)).toBe("night");
    expect(hourToBand(5)).toBe("day");
    expect(hourToBand(12)).toBe("day");
    expect(hourToBand(19)).toBe("day");
  });

  it("de NOCHE el grid compuesto lleva la verja 0x99 → el ancla resuelve a la celda al sur", () => {
    const res = resolveFaceAnchor(nightGrid, portcullisAnchor("night"), { x: 15, y: 31 });
    expect(res.status).toBe("resolved");
    expect(res.cell).toEqual({ x: 15, y: 29 }); // vecino-norte de (15,29) es (15,28)=0x99
  });

  it("de DÍA la verja es suelo (0x44) → 0x99 ausente → miss (no un bug: el sapo-Yew era falso)", () => {
    const res = resolveFaceAnchor(dayGrid, portcullisAnchor("night"), { x: 15, y: 31 });
    expect(res.status).toBe("miss");
  });

  it("bandMatches evita el falso anchor-miss por DERIVA DE RELOJ (banda del ancla vs reloj vivo)", () => {
    const nightA = portcullisAnchor("night");
    expect(bandMatches(22, nightA)).toBe(true); // reloj de noche, ancla de noche → resolver
    expect(bandMatches(12, nightA)).toBe(false); // reloj derivó a día → reconciliar antes
    expect(bandMatches(12, portcullisAnchor())).toBe(true); // sin banda = hora-indep, siempre casa
    expect(bandCanonicalHour("night")).toBe(22);
    expect(bandCanonicalHour("day")).toBe(12);
  });
});

describe("anchors — ANCLA NPC/TRANSACCIÓN (resync a la celda del guardia/mercader)", () => {
  const standable = (t: number) => t !== 0; // 0 = muro en estos tests
  const snap = makeGrid(10, 10, 5, { "4,4": 0 }); // muro al norte del troll (no plantarse ahí)
  const npcs: NpcLive[] = [
    { x: 4, y: 5, type: "troll", name: "Toll Troll" },
    { x: 8, y: 1, type: "merchant" },
  ];
  const tollAnchor: NpcAnchor = { kind: "npc", cmd: "toll", match: "troll" };

  it("resuelve a la celda PISABLE adyacente al NPC que casa, más cercana a la party", () => {
    const res = resolveNpcAnchor(npcs, tollAnchor, { x: 4, y: 8 }, { snap, standable });
    expect(res.status).toBe("resolved");
    expect(res.npcCell).toEqual({ x: 4, y: 5 });
    expect(res.cell).toEqual({ x: 4, y: 6 }); // sur del troll (norte 4,4 es muro; sur es lo más cercano a y=8)
  });

  it("0 NPCs que casan → miss (el guardia del LP no está: beat no alcanzado, no se fabrica)", () => {
    expect(resolveNpcAnchor(npcs, { kind: "npc", cmd: "toll", match: "dragon" }, { x: 0, y: 0 }).status).toBe("miss");
  });

  it("varios NPCs iguales por encima de maxCandidates → ambiguous (declina, reporta)", () => {
    const many: NpcLive[] = [
      { x: 1, y: 1, type: "guard" }, { x: 2, y: 2, type: "guard" }, { x: 3, y: 3, type: "guard" },
    ];
    expect(resolveNpcAnchor(many, { kind: "npc", cmd: "t", match: "guard" }, { x: 0, y: 0 }, { maxCandidates: 2 }).status).toBe("ambiguous");
  });

  it("casa por shopType (shop:<tipo>) vía dialogNumber, y devuelve la PLANTA del NPC (guild en f1)", () => {
    const merchants: NpcLive[] = [
      { x: 9, y: 17, type: "t84 d130", dialogNumber: 0x82, floor: 0 }, // Barkeeper (Felicity) f0
      { x: 23, y: 21, type: "t84 d134", dialogNumber: 0x86, floor: 1 }, // GuildMaster (Braunam) f1
    ];
    const res = resolveNpcAnchor(merchants, { kind: "npc", cmd: "buy", match: "shop:GuildMaster" }, { x: 15, y: 30 });
    expect(res.status).toBe("resolved");
    expect(res.npcCell).toEqual({ x: 23, y: 21 }); // Braunam (GuildMaster), NO Felicity (Barkeeper)
    expect(res.npcFloor).toBe(1); // el resync teleporta a la planta del guild
  });

  it("shop:<tipo> NO casa a la tabernera cuando se busca el guild (bug d130=Felicity evitado)", () => {
    const onlyTavern: NpcLive[] = [{ x: 9, y: 17, type: "t84 d130", dialogNumber: 0x82, floor: 0 }];
    expect(resolveNpcAnchor(onlyTavern, { kind: "npc", cmd: "buy", match: "shop:GuildMaster" }, { x: 0, y: 0 }).status).toBe("miss");
  });
});

describe("anchors — planAnchorResync + histograma de deriva", () => {
  it("salta sólo si la celda difiere; reporta la deriva", () => {
    expect(planAnchorResync({ x: 2, y: 2 }, { x: 2, y: 2 })).toEqual({ jump: false, drift: 0 });
    expect(planAnchorResync({ x: 0, y: 0 }, { x: 3, y: 1 })).toEqual({ jump: true, drift: 4 });
  });

  it("driftBucket clasifica por cubos y el histograma cuenta", () => {
    expect(["0", "1", "2", "3-5", "6-10", "11+"].map(() => 0)).toBeDefined();
    expect(driftBucket(0)).toBe("0");
    expect(driftBucket(4)).toBe("3-5");
    expect(driftBucket(12)).toBe("11+");
    const h = driftHistogram([0, 1, 1, 4, 9, 20]);
    expect(h).toMatchObject({ "0": 1, "1": 2, "3-5": 1, "6-10": 1, "11+": 1 });
  });
});

describe("checkpoint — sumideros de entrada que se comen el F5 del export", () => {
  it("livePacers aísla SÓLO los pacers a reloj de pared (los demás se despejan con teclas)", async () => {
    const { livePacers } = await import("../e2e/espejo-tour/checkpoint");
    // Caso ad21 del relevo-3b: la escena de party-wipe estaba corriendo.
    expect(livePacers({ refuging: true, drawerOpen: false, prompt: null })).toEqual(["refuging"]);
    // Prompts/paneles/drawers NO son pacers: la ráfaga de teclas sí los despeja.
    expect(livePacers({ prompt: "yesno", journal: true, drawerOpen: true, focusInDrawer: true })).toEqual([]);
    // Varios a la vez, en orden declarado.
    expect(livePacers({ camping: true, moongate: true })).toEqual(["camping", "moongate"]);
    // Build sin el hook → sinks vacío: no se inventa un bloqueador.
    expect(livePacers({})).toEqual([]);
  });
});
