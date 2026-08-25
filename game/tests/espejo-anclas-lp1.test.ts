/**
 * VENTANA `anclas-lp1` — el corpus LP1 y su PRODUCTOR, pinados por IDENTIDAD.
 *
 * ## Qué defiende, y contra qué
 *
 * `derive-anchors.mjs --all` sobre copias derivaba **19 anclas que el corpus LP1 commiteado no
 * llevaba** (`anchors-cinturon-acta.md` §1.1): el corpus estaba en DERIVA respecto a su
 * productor. Esta ventana cierra la deriva regenerando, y aquí queda lo que no puede volver a
 * abrirse en silencio.
 *
 * ★★ El filo que este fichero cubre y el censo NO: el corpus de anclas **ALIMENTA EL
 * DENOMINADOR** del espejo. `shop-greeting.ts::shopGreetingLines` construye el conjunto de
 * `ocrLn` no-comparables haciendo un JOIN por el `ocrLn` de las anclas de NPC del segmento
 * (ventana `comparador-bandas`). Añadir una ancla de NPC de tipo con fila de pool **retira un
 * bloque de `comparable`**. Un test que sólo contase anclas no vería nada de eso — es la forma
 * fichada [[gate-falso-por-construccion-testigo-equivocado]] evitada a propósito.
 *
 * ## Por qué pina por IDENTIDAD y no por cardinal
 *
 * Todo se lee del `route.json` COMMITEADO. Los deltas de ledger se exigen **por segmento y
 * valor**, no por conteo: un cardinal cuadra por casualidad, una lista no
 * ([[cardinal-cuadra-no-discrimina-la-fuente]]). Y las dos anclas de `expectDelta` se EXIGEN
 * presentes: si el corpus se regenerase mal y las purgara, un `>= 0` daría verde vacío
 * ([[control-verde-sin-dientes]]).
 *
 * ## Dónde corre cada bloque (frontera de `espejo-corpus.ts`)
 *
 * Éste es, de los cuatro ficheros del expediente, el MENOS rescatable — y así se queda. Su
 * sujeto declarado es «el corpus LP1 pinado por IDENTIDAD»: sus diez tests son censos,
 * cardinales calibrados o ids concretos del artefacto commiteado. Los DIEZ van en
 * `describeCorpusReal` y ninguno se mueve al corpus sintético, donde el esperado lo firmaría la
 * misma mano que el sujeto ([[el-aserto-que-calcula-su-esperado-desde-el-sujeto-es-tautologico]]).
 *
 * Lo que SÍ sube al árbol público es la única propiedad de HERRAMIENTA que había aquí dentro: el
 * predicado de enganche `anchorIsShop`. Y sube MEJOR de lo que estaba, porque el corpus real no
 * puede ejercitarlo — sus 20 anclas de NPC casan las 20 por el prefijo `shop:`, así que el brazo
 * `cmd` del predicado nunca decide nada y su rotura pasaría inadvertida (el comentario del
 * bloque P1 ya lo lamentaba). El corpus sintético trae un ancla de PEAJE (`cmd:"toll"`,
 * `match:"d130"`, `sint03-g03`) que cae del lado contrario: por primera vez el predicado tiene
 * las DOS clases pobladas. [[gate-falso-por-construccion-testigo-equivocado]]
 *
 * 🔴 Y la lectura del corpus real ya no vive en el cuerpo de los `describe`. Vivía: cuatro
 * `censo(LP1)` sueltos ahí. El cuerpo de un `describe` corre al RECOLECTAR —también el de un
 * `describe.skip`—, así que eso era un ENOENT garantizado en el árbol público.
 */
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { shopGreetingLines, shopGreetingPoolTypes, type AnchorLike } from "../e2e/espejo-tour/shop-greeting";
import { anchorIsShop } from "../e2e/espejo-tour/runner";
import { describeCorpusReal, ROUTES_SINT_DIR } from "./espejo-corpus";

const TOUR = join(dirname(fileURLToPath(import.meta.url)), "..", "e2e", "espejo-tour");
const LP1 = join(TOUR, "routes");
const AD = join(TOUR, "routes-ad");

interface Anchor { kind: string; cmd?: string; match?: string; ocrLn?: number; expectDelta?: number; sees?: string; tileIds?: number[] }
interface Op { key?: string; src?: string; anchor?: Anchor; ocrLn?: number }
interface Seg { id: string; script?: Op[]; skip?: unknown }
interface Route { segments: Seg[] }

const load = (dir: string, part: string): Route => JSON.parse(readFileSync(join(dir, `${part}.route.json`), "utf8")) as Route;
const parts = (dir: string) => readdirSync(dir).filter((f) => f.endsWith(".route.json")).map((f) => f.replace(".route.json", "")).sort();

interface Fila {
  part: string;
  seg: string;
  op: number;
  src?: string;
  a: Anchor;
}

/**
 * Todas las anclas del corpus, con su dirección (parte, segmento, índice de op).
 * 🔴 MEMOIZADO Y PEREZOSO: se invoca SÓLO desde dentro de un `it`. Ver la cabecera.
 */
const cacheCenso = new Map<string, Fila[]>();
function censo(dir: string): Fila[] {
  let out = cacheCenso.get(dir);
  if (out) return out;
  out = [];
  for (const p of parts(dir)) {
    for (const s of load(dir, p).segments) {
      (s.script ?? []).forEach((op, i) => {
        if (op.anchor) out!.push({ part: p, seg: s.id, op: i, src: op.src, a: op.anchor });
      });
    }
  }
  cacheCenso.set(dir, out);
  return out;
}

/** Forma que `anchorIsShop` (runner.ts:2130) espera: los dos campos, nunca `undefined`. */
const esEnganche = (a: Anchor): boolean => anchorIsShop({ cmd: String(a.cmd ?? ""), match: String(a.match ?? "") });

/**
 * ★★ EL PREDICADO DE ENGANCHE, sobre el corpus SINTÉTICO (corre en el árbol PÚBLICO).
 *
 * `runner.ts::anchorIsShop` decide qué anclas de NPC exigen `shopOpen` y reintento. Es una
 * propiedad de la HERRAMIENTA: no depende de qué mercader saludó a quién, sino de la forma del
 * ancla. Y sobre el corpus REAL no se puede probar bien — las 20 anclas de NPC de LP1 casan las
 * 20 por el prefijo `shop:`, así que el predicado nunca se ve obligado a separar nada y
 * `every(startsWith("shop:"))` pasaría igual con `anchorIsShop` roto de par en par.
 */
describe("anclas-lp1 · el predicado de ENGANCHE del runner, sobre el corpus SINTÉTICO (público)", () => {
  const npcSint = (): Fila[] => censo(ROUTES_SINT_DIR).filter((x) => x.a.kind === "npc");

  it("★★ `anchorIsShop` separa DOS clases y las dos están POBLADAS (el corpus real sólo puebla una)", () => {
    const npc = npcSint();
    expect(npc.length, "guarda de población: contaba anclas de NPC del corpus sintético").toBeGreaterThan(0);

    // Lado que ENTRA al bucle de enganche: las transacciones de tienda.
    const transacciones = npc.filter((x) => x.a.cmd === "buy" || x.a.cmd === "sell");
    expect(transacciones.length, "guarda de población: contaba anclas de compra/venta").toBeGreaterThan(0);
    expect(transacciones.filter((x) => !esEnganche(x.a)).map((x) => `${x.seg}#${x.op}`)).toEqual([]);

    // Lado que NO entra: el PEAJE. No hay mercader que abrir, y exigirle `shopOpen` colgaría el
    // resync. Éste es el testigo que el corpus real no tiene.
    const peajes = npc.filter((x) => x.a.cmd === "toll");
    expect(peajes.length, "guarda de población: el sintético trae el ancla de peaje de `sint03-g03`").toBeGreaterThan(0);
    expect(peajes.filter((x) => esEnganche(x.a)).map((x) => `${x.seg}#${x.op}`)).toEqual([]);
  });

  it("★★ el brazo `cmd` del predicado, que en el corpus real NUNCA decide: una compra sin `shop:`", () => {
    // El mutante se construye sobre una COPIA EN MEMORIA de un ancla del corpus sintético (el
    // fichero no se toca: es punto fijo de las tres herramientas). Se le quita el prefijo
    // `shop:` al `match` y se le deja el `cmd`. Si alguien borrase el brazo `/^(buy|sell)$/` de
    // `anchorIsShop`, en LP1 no se enteraría nadie; aquí se pone rojo.
    const compra = npcSint().find((x) => x.a.cmd === "buy");
    expect(compra, "guarda de población: sin un ancla de compra no hay mutante que construir").toBeDefined();
    expect(String(compra!.a.match)).toMatch(/^shop:/); // el original SÍ lleva prefijo…

    const sinPrefijo: Anchor = { ...compra!.a, match: "d200" }; // …y el mutante NO
    expect(esEnganche(sinPrefijo), "entra por el `cmd`, que es el brazo que aquí queda solo").toBe(true);
    // CONTROL: quitado también el `cmd` de transacción, el mismo `match` ya no engancha. Sin
    // esto, un `anchorIsShop` que devolviera `true` a todo pasaría el aserto de arriba.
    expect(esEnganche({ ...sinPrefijo, cmd: "toll" })).toBe(false);
  });
});

describeCorpusReal("anclas-lp1 · los DOS expectDelta de LP1 sobreviven a la regeneración (P3)", () => {
  // Los tres `expectDelta` del proyecto son part04-g03 +36, part05-g05 −954 (LP1) y ad21-g26
  // −1024 (AD). De ellos cuelga el ledger entero de transacciones: `runner.ts::ledgerArm` sólo
  // lee `expectDelta` de un ancla `kind:"npc"`. `derive-anchors` los protege por `src:"overlay*"`
  // — y esa protección es lo único que hay entre ellos y su rama de purga.
  const ESPERADOS = [
    { part: "part04", seg: "part04-g03", op: 12, match: "shop:Blacksmith", delta: 36 },
    // op 248→247 tras el re-colapso de tecleos parciales (fix-tecleos-parciales: retira
    // un typed fantasma ANTERIOR en el segmento; el ancla vive, sólo se desplaza)
    { part: "part05", seg: "part05-g05", op: 247, match: "shop:GuildMaster", delta: -954 },
  ] as const;

  const conDelta = (): Fila[] => censo(LP1).filter((x) => x.a.expectDelta !== undefined);

  it.each(ESPERADOS)("$seg op[$op] sigue llevando expectDelta=$delta y su guardián src:overlay*", (e) => {
    const hit = conDelta().find((x) => x.seg === e.seg && x.op === e.op);
    expect(hit, `${e.seg} op[${e.op}] ha DESAPARECIDO del corpus — la regeneración purgó un ancla a mano`).toBeDefined();
    expect(hit!.a.expectDelta).toBe(e.delta);
    expect(hit!.a.match).toBe(e.match);
    // Sin este `src` el productor la purgaría en la siguiente pasada, en silencio.
    expect(String(hit!.src ?? "")).toMatch(/^overlay/);
  });

  it("y NO hay ningún otro expectDelta en LP1 (la lista es exhaustiva, no un mínimo)", () => {
    expect(conDelta().map((x) => `${x.seg}#${x.op}=${x.a.expectDelta}`).sort()).toEqual(
      ESPERADOS.map((e) => `${e.seg}#${e.op}=${e.delta}`).sort(),
    );
  });
});

describeCorpusReal("anclas-lp1 · la DERIVA está cerrada: el corpus lleva las 19 (P1)", () => {
  it("censo de LP1 = 19 anclas de cara + 20 de NPC", () => {
    const c = censo(LP1);
    expect(c.filter((x) => x.a.kind === "face").length).toBe(19);
    expect(c.filter((x) => x.a.kind === "npc").length).toBe(20);
  });

  it("las 20 de NPC llevan match `shop:<Tipo>` ⇒ TODAS entran al bucle de verificación de enganche", () => {
    // `runner.ts::anchorIsShop` = match.startsWith("shop:") ∪ cmd ∈ {buy,sell}. Ninguna es
    // pasiva: las 20 exigen `shopOpen` y reintento. Que hoy no haya ninguna casada por
    // dialogNumber es justo lo que haría pasar inadvertido el brazo `cmd` de ese predicado
    // — por eso ese brazo se ejercita ARRIBA, contra el corpus sintético, que sí tiene un
    // ancla de NPC del lado contrario. Aquí el aserto sigue siendo lo que era: un hecho de
    // LP1, no una prueba del predicado.
    const npc = censo(LP1).filter((x) => x.a.kind === "npc");
    expect(npc.every((x) => String(x.a.match ?? "").startsWith("shop:"))).toBe(true);
  });

  it("las 18 nuevas caen todas sobre un op de (T)alk — son replay del LP, no arnés", () => {
    // El ancla se deriva del bloque de saludo del LP (`derive-anchors.mjs::deriveSegmentNpcAnchors`,
    // `ocrLn: b.ocrLn`), y se planta en el op de comando `t` de ese mismo `ocrLn`. Si alguna
    // cayera en un op que no es un Talk, el `ocrLn` del join estaría desalineado.
    const nuevas = censo(LP1).filter((x) => x.a.kind === "npc" && !String(x.src ?? "").startsWith("overlay"));
    expect(nuevas.length).toBe(18);
    expect(nuevas.filter((x) => String(x.a.cmd) !== "talk")).toEqual([]);
  });
});

describeCorpusReal("anclas-lp1 · ★★ el corpus de anclas ALIMENTA el denominador (P4)", () => {
  // Éste es el canal que el encargo daba por inerte («las anclas nuevas no tocan comparable»).
  // No se argumenta: se ejecuta el MISMO predicado que el runner (`shopGreetingLines`), sobre el
  // corpus commiteado, segmento a segmento.
  const lineasExcluidas = (dir: string) => {
    const out: { seg: string; ocrLn: number }[] = [];
    for (const p of parts(dir)) {
      for (const s of load(dir, p).segments) {
        const anchors = (s.script ?? []).map((op) => op.anchor as AnchorLike | undefined);
        for (const ln of shopGreetingLines(anchors)) out.push({ seg: s.id, ocrLn: ln });
      }
    }
    return out;
  };

  it("LP1 retira 16 bloques de `comparable` por el join del saludo (antes: CERO)", () => {
    // ★ Y las 16 son EXACTAMENTE las nuevas. Las dos anclas de `expectDelta`, puestas a mano por
    // overlay, no retiran nada NI SIQUIERA la de GuildMaster —cuyo saludo sí es una lotería de
    // pool— porque el `ocrLn` que el join necesita vive DENTRO del ancla y sólo lo estampa el
    // derivador: el overlay lo deja en el op. De ahí el «inerte en LP1 (0 capturas)» de
    // `ocr-profile.ts`, que era cierto y deja de serlo con esta entrega.
    expect(lineasExcluidas(LP1).length).toBe(16);
  });

  it("las 2 de Blacksmith NO retiran nada — su fila de pool está a CERO", () => {
    // El herrero no pasa por `SHOPPES 0x01b6`: saluda por vía propia con plantilla fija, así que
    // su bloque SÍ es adjudicable. Excluirlo borraría material bueno. El predicado se ata a
    // `SHOPPE_GREETING_INDEX`, que es de donde el Blacksmith está ausente.
    expect(shopGreetingPoolTypes()).not.toContain("Blacksmith");
    const blacksmith = censo(LP1).filter((x) => x.a.match === "shop:Blacksmith");
    expect(blacksmith.length).toBe(3); // 1 de overlay (part04-g03) + 2 nuevas (part02-g09, part09-g10)
    const excluidas = new Set(lineasExcluidas(LP1).map((x) => `${x.seg}#${x.ocrLn}`));
    for (const b of blacksmith) expect(excluidas.has(`${b.seg}#${b.a.ocrLn}`)).toBe(false);
  });

  it("y el corpus AD no se mueve: sus exclusiones siguen siendo las mismas (P8)", () => {
    expect(lineasExcluidas(AD).length).toBe(35);
  });
});

describeCorpusReal("anclas-lp1 · el ancla de CARA de part18-g07 es INERTE, y se declara (P7)", () => {
  it("existe, y pide un tileId que el juego vivo NUNCA planta", () => {
    const shard = censo(LP1).find((x) => x.seg === "part18-g07" && x.a.kind === "face");
    expect(shard).toBeDefined();
    expect(shard!.a.tileIds).toEqual([436]);
    // El port siembra los tres shards con el tile RAW 0xb4 = 180 (`underworld-seed.ts::SHARD_TILE`,
    // decisión comentada en game.ts: «los artefactos LB conservan su tile RAW»). El 436 es el
    // índice de LOOK2 de la frase, que es tile+0x100. Ni la rejilla compuesta ni
    // `objectFaceCandidates` pueden contener 436 ⇒ el ancla no puede resolver.
  });
});
