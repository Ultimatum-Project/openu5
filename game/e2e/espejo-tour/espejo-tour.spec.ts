/**
 * WALKTHROUGH-ESPEJO — spec CADENA (Part01→Part06 encadenadas).
 *
 * Cada parte: entrada (boot fresco para part01 / checkpoint del espejo para 02+) →
 * replay de segmentos con resincronización → diff de conformidad → reporte →
 * export del checkpoint PROPIO (entrada de la parte siguiente).
 *
 * Palancas:
 *   · U5_ESPEJO_FROM=partNN   re-arranca la cadena desde esa parte (bisección de
 *     derivas; exige que su checkpoint predecesor exista en saves/).
 *   · U5_ESPEJO_PARTS=part01,part02  subconjunto explícito.
 *   · U5_ESPEJO_SOFT=1        modo calibración: reporta sin asertar conformidad.
 *   · ESPEJO_OUT=<dir>        dónde dejar los reportes (default test-results/espejo-tour).
 *
 * Umbral de conformidad: INICIAL y deliberadamente conservador (0.5) hasta calibrar en
 * Fase B; el objetivo es RATCHET hacia arriba con los patrones de exclusión afinados.
 * Toda divergencia real = TICKET (diff + frame del vídeo + captura del port), no un fix.
 */
import { test, expect } from "@playwright/test";
import { gotoGame } from "../helpers";
import { pacersVivos } from "../tempo-video.mjs";
import {
  loadRoute,
  listParts,
  armAccumulator,
  armKeyLog,
  armSpawnLog,
  spawnLogSlice,
  armRngCount,
  rngCountRead,
  runSegment,
  aggregateAnchors,
  aggregateInterior,
  probeState,
  writeReport,
  writeTranscript,
  summarize,
  ROUTES_AD_DIR,
  ROUTES_LF_DIR,
  ACTIVE_PROFILE,
  type PartReport,
  type SegmentReport,
} from "./runner";
import { exportCheckpoint, importCheckpoint, hasCheckpoint, normalizeAvatarName, SAVES_DIR } from "./checkpoint";
import {
  parseModo,
  evidenciaDeCorpus,
  decideResiembra,
  planMuta,
  sondaResiembra,
  aplicaResiembra,
  reporteResiembra,
  resumenResiembra,
  type ResiembraReport,
} from "./resiembra";
import { reporteVehiculoVacio, resumenVehiculo } from "./vehiculo";
import { newDngFilter, type FloorGrid as DngFloorGrid } from "./dungeon-filter.js";
// @ts-expect-error — herramienta de autoría en JS puro (game/tools/videocap), sin .d.ts;
// el sidecar es OPT-IN y no entra en ningún camino de medición (ver más abajo).
import { armSidecar, readSidecar, escribeSidecar } from "../../tools/videocap/sidecar.mjs";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// CORPUS: `U5_ESPEJO_CORPUS=ad` corre el ESPEJO-2 (LP2 Alex Diener, routes-ad/ ad01..ad25)
// con la MISMA disciplina de cadena (checkpoints propios adNN en saves/, prefijo disjunto
// de partNN). Default = corpus canónico (aulddragon part01..06).
// LF: `U5_ESPEJO_CORPUS=lf` corre el ESPEJO-3 (LP3 Lord Fenton, routes-lf/ lf01..lf33), con
// el mismo contrato. ⚠ A diferencia de AD y LP1, el corpus LF **no tiene cadena de
// checkpoints propia** (no hay saves/lfNN): un episodio suelto entra por el checkpoint que su
// overlay declare, y eso es un ARNÉS DE ESTADO declarado — ver `re/notes/fenton-curacion.md`.
const AD = process.env.U5_ESPEJO_CORPUS === "ad";
const LF = process.env.U5_ESPEJO_CORPUS === "lf";
const ROUTES = AD ? ROUTES_AD_DIR : LF ? ROUTES_LF_DIR : undefined;
const ALL = AD
  ? listParts(ROUTES_AD_DIR)
  : LF
    ? listParts(ROUTES_LF_DIR)
    : ["part01", "part02", "part03", "part04", "part05", "part06"];
const FROM = process.env.U5_ESPEJO_FROM;
const EXPLICIT = process.env.U5_ESPEJO_PARTS?.split(",").map((s) => s.trim());
const SOFT = process.env.U5_ESPEJO_SOFT === "1";
// ESPEJO_DUMP=1 → volcado del transcript del port por segmento (habilitador de la
// calibración OFFLINE del comparador; ver writeTranscript en runner.ts).
const DUMP = process.env.ESPEJO_DUMP === "1";
// ★ carril `gate-videos`: el SIDECAR viaja con la pasada-vídeo y sólo con ella. Misma env
// que enciende `recordVideo` en `playwright.espejo.config.ts:20` — un sidecar sin vídeo no
// tiene a qué alinearse, y la pasada de MEDIDA (la que adjudica conformidad) no debe
// llevar ni un listener de más.
const VIDEO = Boolean(process.env.U5_ESPEJO_VIDEO);

// FASE 3e-a: conmutador del filtro de localización (OFF por defecto = comportamiento de 3d).
// Es el brazo A/B del experimento interno; ver el comentario en el bucle de segmentos.
const FILTER_ON = process.env.U5_ESPEJO_FILTER === "1";

// ══════════════════════════════════════════════════════════════════════════════════════════
// RE-SIEMBRA (carril `espejo-resiembra`) — `U5_ESPEJO_RESIEMBRA=off|wipe|roster`.
// ══════════════════════════════════════════════════════════════════════════════════════════
// MISMO contrato opt-in que `U5_ESPEJO_FILTER`, y por la misma razón: los dos brazos corren
// en la MISMA ventana sobre el MISMO árbol y se distinguen por UNA variable, así que el
// pareado es válido POR CONSTRUCCIÓN (el ruido entre corridas distintas del espejo está
// medido en ×2.00, mayor que casi cualquier efecto). Sin la env NO hay ni un `page.evaluate`
// de más: `decideResiembra` devuelve `modo-off` antes de tocar nada, y el único coste es
// leer el corpus que la ruta ya tiene cargada en memoria.
//
// El PORQUÉ, el reparo que respeta y el recorte de `party_refuge` que aplica están en la
// cabecera de `resiembra.ts` — aquí sólo se cablea.
const RESIEMBRA = parseModo(process.env.U5_ESPEJO_RESIEMBRA);
/** bloques `expect` mínimos que deben mencionar a un miembro para contar como evidencia. */
const RESIEMBRA_MIN = Number(process.env.U5_ESPEJO_RESIEMBRA_MIN ?? "1");
/** INTERRUPTOR PROPIO de la siembra de alfombra (`U5_ESPEJO_RESIEMBRA_CARPET=0` la apaga).
 *  Aparte del modo porque los dos efectos se miden por SEPARADO: el brazo «party sembrada y
 *  SIN alfombra» es el que demostró que revivir a la party sola no arregla nada. */
const RESIEMBRA_CARPET = process.env.U5_ESPEJO_RESIEMBRA_CARPET !== "0";

/** CONDUCIR EL VEHÍCULO que la ruta ya declara en `nav[].v` (carril `espejo-vuelo`).
 *  OFF por defecto ⇒ camino idéntico al de main, bit a bit. El porqué, la derivación del
 *  vocabulario y por qué `walk` NO se conduce están en la cabecera de `vehiculo.ts`. */
const VEHICULO_ON = process.env.U5_ESPEJO_VEHICULO === "1";

/** ¿Se repone el INVENTARIO del vehículo fabricado (casco de fragata, esquife)? Default SÍ —
 *  fabricar una fragata sin casco es fabricar una nave que se hunde al primer daño (medido:
 *  10 `Ship sunk!` y 8 `DROWNING!!!` en UNA parte encadenada; ver la cabecera de `HULL_MAX`
 *  en `vehiculo.ts`). `U5_ESPEJO_VEHICULO_CASCO=0` reproduce la conducta histórica, y existe
 *  para poder correr el brazo pareado que la mide — no es una opción de uso. */
const VEHICULO_INVENTARIO = process.env.U5_ESPEJO_VEHICULO_CASCO !== "0";

/** Grid estático de mazmorras (assets/maps/dungeons.json) indexado por `location` y planta. */
function makeDngGrid(): (dungeon: number, floor: number) => DngFloorGrid | null {
  const raw = JSON.parse(
    readFileSync(join(dirname(fileURLToPath(import.meta.url)), "..", "..", "assets", "maps", "dungeons.json"), "utf8"),
  ) as Array<{ location: number; floors: DngFloorGrid[] }>;
  const byLoc = new Map(raw.map((d) => [d.location, d.floors]));
  return (dungeon, floor) => byLoc.get(dungeon)?.[floor] ?? null;
}
const THRESHOLD = Number(process.env.U5_ESPEJO_THRESHOLD ?? "0.5");

// ══════════════════════════════════════════════════════════════════════════════════════════
// PERTURBACIÓN NEUTRA DEL GENERADOR — instrumento del carril `loteria-sellos`.
// ══════════════════════════════════════════════════════════════════════════════════════════
// Contesta «¿cuántos de los cinco sellos son BILLETES DE LOTERÍA?», donde lotería significa
// FRÁGIL AL DESPLAZAMIENTO DEL STREAM (no estocástico corrida a corrida — eso ya está refutado
// en `veredicto_sellos.mjs`). Pre-registro: `re/notes/loteria-sellos-preregistro.md`.
//
// ★ POR QUÉ ESTO ES NEUTRO POR CONSTRUCCIÓN, Y NO POR OPINIÓN MÍA.
// El estado del generador vivo (`OriginalRng`, réplica de g_rng_seed DS:0x5420) es UNA SOLA
// PALABRA DE 16 BITS, la transición add·ror·xor·add es BIYECTIVA, y `next(lo,hi)` consume
// EXACTAMENTE un `nextRaw16()`. ⇒ avanzar el estado k pasos **es** consumir k tiradas, exacto,
// y no toca NADA más: ni posición, ni reloj, ni oro, ni inventario, ni una pulsación. Es una
// perturbación estrictamente MÁS LIMPIA que la que produjo el hallazgo (F-A3 movía la party de
// celda **y además** desplazaba el stream: dos canales a la vez).
//
// 🔴 Y ES INERTE SI LA VARIABLE NO ESTÁ. `U5_SELLOS_PERTURBA` sin poner ⇒ ni un `page.evaluate`
// de más, o sea camino IDÉNTICO al de main. Eso es lo que hace válido el control C0. El control
// que de verdad valida el instrumento es el otro: **k=0 con el hook activo** tiene que dar lo
// mismo que C0 — si no, el hook perturba por sí mismo y la tanda entera es nula.
//
// Dos puntos de inyección, porque contestan preguntas distintas:
//  · sin `U5_SELLOS_PERTURBA_EN` → a la ENTRADA DE LA PARTE. Es el brazo ecológicamente válido:
//    es donde actúa un fix real, y arrastra todo lo que venga aguas abajo.
//  · con `U5_SELLOS_PERTURBA_EN=<segId>` → a la entrada de ESE segmento. Aísla la tirada del
//    propio tramo: distingue «frágil por su propia tirada» de «frágil por arrastre».
const PERTURBA = process.env.U5_SELLOS_PERTURBA;
const PERTURBA_EN = process.env.U5_SELLOS_PERTURBA_EN;

/**
 * Avanza el stream vivo `k` pasos DENTRO de la página y devuelve `{antes, despues}`.
 *
 * El LCG se replica aquí (no se importa) porque el cuerpo de `page.evaluate` se serializa al
 * navegador: no puede cerrar sobre nada del proceso de node. La réplica es de 4 líneas y está
 * cubierta por su propio testigo — `antes`/`despues` se imprimen, y con k=0 tienen que ser
 * IGUALES, que es la comprobación de que la aritmética no se ha ido.
 */
async function perturbaGenerador(page: import("@playwright/test").Page, k: number) {
  return page.evaluate((pasos: number) => {
    const t = (window as unknown as { __u5test?: { game?: { liveSeed?: () => number }; reseed?: (n: number) => void } })
      .__u5test;
    if (!t?.game?.liveSeed || !t.reseed) throw new Error("PERTURBA: __u5test.game.liveSeed/reseed no expuestos");
    const antes = t.game.liveSeed();
    let s = antes;
    for (let i = 0; i < pasos; i++) {
      let x = (s + 0x9248) & 0xffff; // add ax, 0x9248
      x = ((x >>> 3) | (x << 13)) & 0xffff; // ror ax,1 ×3
      x ^= 0x9248; // xor ax, 0x9248
      x = (x + 0x11) & 0xffff; // add ax, 0x11
      s = x;
    }
    t.reseed(s);
    return { antes, despues: t.game.liveSeed() };
  }, k);
}

const PARTS = EXPLICIT ?? (FROM ? ALL.slice(ALL.indexOf(FROM)) : ALL);

test.describe.serial(`walkthrough-espejo ${AD ? "AD01→25 (espejo-2)" : LF ? "LF (espejo-3, Lord Fenton)" : "Part01→06"}`, () => {
  for (const part of PARTS) {
    test(`${part} — replay + conformidad`, async ({ page }) => {
      // ── DIAGNÓSTICO DE MUERTE DE PÁGINA (`ESPEJO_DIAG=1`).
      // Nació de una rotura real: `Execution context was destroyed, most likely because of a
      // navigation`. Ese mensaje es la SUPOSICIÓN de Playwright — sólo ve el contexto desaparecer,
      // así que no distingue entre navegación de verdad y renderer MUERTO. El discriminador son
      // los eventos: `framenavigated` = navegó · `crash` = el renderer se fue · `pageerror` =
      // excepción no capturada. Sin esto se bisecta a ciegas.
      if (process.env.ESPEJO_DIAG === "1") {
        page.on("crash", () => console.log(`[DIAG ${part}] ★ CRASH del renderer (la página murió, NO navegó)`));
        page.on("framenavigated", (f) => {
          if (f === page.mainFrame()) console.log(`[DIAG ${part}] ★ NAVEGACIÓN del frame principal → ${f.url()}`);
        });
        page.on("pageerror", (e) => console.log(`[DIAG ${part}] pageerror: ${String(e.message).slice(0, 200)}`));
        page.on("console", (m) => {
          if (m.type() === "error" || m.type() === "warning") console.log(`[DIAG ${part}] console.${m.type()}: ${m.text().slice(0, 200)}`);
        });
      }
      test.setTimeout(45 * 60_000); // combate lento (cofre-fiel item-by-item)
      // DECLARACIÓN DEL DIRECTORIO DE SEMILLAS. Va en el log de TODAS las corridas, también
      // sin redirigir: una corrida que no diga de dónde lee y a dónde escribe sus checkpoints
      // es indistinguible de la que pisó las semillas compartidas el 20-08.
      console.log(`[${part}] saves-dir: ${SAVES_DIR}${process.env.U5_ESPEJO_SAVES_DIR ? " (REDIRIGIDO por U5_ESPEJO_SAVES_DIR)" : " (canónico)"}`);
      const route = loadRoute(part, ROUTES);
      await armAccumulator(page);
      // ★ carril `tempo-cinematico`: bajo `U5_VIDEO_TEMPO=cine` el port deja de apagar sus
      // seis pacers calibrados (los apaga al detectar automatización). Mismo contrato
      // opt-in que los de abajo: sin la env NO se instala ni un `addInitScript`, o sea
      // camino idéntico al de main. Ver ../tempo-video.mjs.
      await pacersVivos(page);
      // ★ carril `gate-videos`: SIDECAR DE GRABACIÓN. Se instala SÓLO en la pasada-vídeo
      // (`U5_ESPEJO_VIDEO`, la misma env que enciende `recordVideo` en la config) — sin
      // ella no hay ni un `addInitScript` de más y la pasada de MEDIDA queda byte-idéntica
      // a la histórica, que es la que adjudica conformidad. El ancla de tiempo se toma
      // AQUÍ, lo más cerca posible del `newPage` que abrió el .webm (ver `sidecar.mjs`:
      // el ancla no puede vivir en la página porque `addInitScript` se reinicia al navegar).
      const t0Wall = Date.now();
      if (VIDEO) await armSidecar(page);
      // ★ carril `ad06-teclas` (ficha #12): registro page-side de teclas. Se instala SÓLO con
      // `U5_TECLAS_SEG` puesto — sin ella no hay ni un `addInitScript` de más, o sea camino
      // idéntico al de main. Ver `armKeyLog` para el porqué de la capa.
      if (process.env.U5_TECLAS_SEG) await armKeyLog(page);
      // ★ ficha #31: sumidero del ancla de spawn (`k = party − chunk_origin`). Mismo
      // contrato que armKeyLog — sin `U5_SPAWN_K` no se instala NI un addInitScript, o sea
      // camino idéntico al de main. Se vuelca al cerrar la parte (ver más abajo).
      if (process.env.U5_SPAWN_K) await armSpawnLog(page);
      // ★ ficha #31-bis: contador de PASOS del stream de RNG. Los sellos comparan TEXTO,
      // así que no distinguen «el stream no se movió» de «se movió y no llegó a lo
      // impreso»; este contador sí. Mismo contrato opt-in: sin `U5_RNG_N`, nada.
      if (process.env.U5_RNG_N) await armRngCount(page);

      // ---- ENTRADA (costura de cadena)
      if (route.entry.boot === "fresh") {
        await gotoGame(page, {});
        if (route.entry.normalizeAvatarName) await normalizeAvatarName(page, route.entry.normalizeAvatarName);
      } else {
        const prev = route.entry.checkpoint;
        if (!prev) throw new Error(`${part}: entry.checkpoint no curado (overlay)`);
        if (!hasCheckpoint(prev)) {
          throw new Error(
            `${part}: falta el checkpoint ${prev} en e2e/espejo-tour/saves/ — corre la cadena desde ${prev} (U5_ESPEJO_FROM) o completa la anterior`,
          );
        }
        await gotoGame(page, {});
        await importCheckpoint(page, prev, route.entry.entryClock);
        await page.waitForTimeout(400);
      }

      // ---- RE-SIEMBRA DECLARADA (ver cabecera de `resiembra.ts`)
      // VA AQUÍ y no antes: `importCheckpoint` pisa el estado entero, así que sembrar antes
      // se borraría (misma razón por la que la PERTURBACIÓN de abajo va después). Y va
      // ANTES de la perturbación y de los segmentos porque re-ancla el PUNTO DE PARTIDA de
      // la parte: sembrar a mitad mezclaría dos puntos de partida en una sola conformidad.
      //
      // La evidencia sale del corpus de ESTA parte (`route.segments[].expect[].text`, que es
      // OCR del vídeo del LP) y los nombres, del estado VIVO — no de una lista cableada: si
      // el roster del LP cambia, la evidencia sigue midiéndose sobre quien esté en el grupo.
      const estadoResiembra = await sondaResiembra(page);
      const textosCorpus = route.segments.flatMap((s) => (s.expect ?? []).map((b) => b.text));
      const evidencia = evidenciaDeCorpus(
        textosCorpus,
        estadoResiembra.miembros.map((m) => m.nombre),
      );
      const planResiembra = decideResiembra(RESIEMBRA, estadoResiembra, evidencia, RESIEMBRA_MIN, RESIEMBRA_CARPET);
      const aplicadoResiembra = planMuta(planResiembra) ? await aplicaResiembra(page, planResiembra) : null;
      const reseed: ResiembraReport = reporteResiembra(planResiembra, RESIEMBRA_MIN, aplicadoResiembra);
      console.log(`[${part}] ${resumenResiembra(reseed)}`);
      if (reseed.noEncontrados.length > 0) {
        console.log(`[${part}] ⚠ re-siembra: nombres del plan NO hallados en el grupo: ${reseed.noEncontrados.join(", ")}`);
      }

      // ---- PERTURBACIÓN NEUTRA (brazo «entrada de la parte»). Va DESPUÉS de la entrada
      // porque `importCheckpoint` corre turnos; sembrar antes lo borraría.
      if (PERTURBA !== undefined && PERTURBA_EN === undefined) {
        const k = Number(PERTURBA);
        const { antes, despues } = await perturbaGenerador(page, k);
        console.log(`[${part}] PERTURBA-PARTE k=${k} seed 0x${antes.toString(16)} → 0x${despues.toString(16)}`);
      }

      // ---- SEGMENTOS
      //
      // FASE 3e-a — EL CONMUTADOR DEL FILTRO, que es a la vez el mecanismo del A/B.
      // `U5_ESPEJO_FILTER=1` enciende el filtro de localización; sin él queda DORMIDO y el runner
      // se comporta exactamente como en 3d. Que el brazo A y el brazo B se distingan por UNA
      // variable de entorno es lo que permite correr los dos en la MISMA ventana sobre el MISMO
      // core — pareado válido POR CONSTRUCCIÓN, sin arqueología de fechas ni censos de superficie
      // (el ruido de cadena entre runs distintos está medido en ×2.00, mayor que el efecto).
      //
      // El acumulador es POR PARTE, no por segmento: el presupuesto del filtro (40 observaciones
      // informativas) no lo da un segmento suelto — ad17-g04 aporta 35.
      // ---- CONDUCCIÓN DEL VEHÍCULO (carril `espejo-vuelo`), `U5_ESPEJO_VEHICULO=1`.
      // El acumulador es POR PARTE y se pasa a los DOS bucles de nav de `runSegment`.
      // Se crea SIEMPRE (también apagado) para que el bloque salga en todos los reportes.
      const vehiculoRep = reporteVehiculoVacio(VEHICULO_ON, VEHICULO_INVENTARIO);
      const dngFilter = FILTER_ON ? newDngFilter() : undefined;
      const dngGrid = FILTER_ON ? makeDngGrid() : undefined;
      const segReports: SegmentReport[] = [];
      const vivosPorSegmento: Array<{ seg: string; alive: number | null; size: number | null }> = [];
      const transcripts: Record<string, string[]> = {};
      for (const seg of route.segments) {
        // ★ tarjeta `ad18-g11`: la costura de salida no puede saber POR QUÉ la party está fuera del
        // 3D — una expulsión (`PLANTA-DESCONOCIDA`) deja el mismo `location 0 / floor 0` que una
        // salida legítima. El único que tiene el dato es este bucle, que ve el report anterior.
        const prev = segReports[segReports.length - 1];
        const interiorAbandonedBefore = prev && prev.floorUnknown > 0 ? { abandonedIn: prev.id } : undefined;
        // SONDA read-only del stream vivo a la entrada de un segmento. `liveSeed()` es un
        // getter: no consume ni un paso, así que no puede mover nada. Existe para contestar
        // «¿mi perturbación de la entrada de la parte SIGUE VIVA aquí?», que es la pregunta
        // que decide si el instrumento tiene dientes o es inerte.
        if (process.env.U5_SELLOS_SONDA_SEG === seg.id || process.env.U5_SELLOS_SONDA_SEG === "*") {
          const s = await page.evaluate(() =>
            (window as unknown as { __u5test: { game: { liveSeed: () => number } } }).__u5test.game.liveSeed(),
          );
          console.log(`[${part}] SONDA-SEED ${seg.id} liveSeed=0x${s.toString(16)}`);
        }
        // Brazo «entrada del segmento»: aísla la tirada del propio tramo (ver cabecera).
        if (PERTURBA !== undefined && PERTURBA_EN === seg.id) {
          const k = Number(PERTURBA);
          const { antes, despues } = await perturbaGenerador(page, k);
          console.log(`[${part}] PERTURBA-SEG ${seg.id} k=${k} seed 0x${antes.toString(16)} → 0x${despues.toString(16)}`);
        }
        const { report, portLines } = await runSegment(page, seg, {
          dngFilter,
          dngGrid,
          interiorAbandonedBefore,
          vehiculo: vehiculoRep,
        });
        segReports.push(report);
        // ── TRAYECTORIA DE VIVOS, segmento a segmento (carril `espejo-resiembra`).
        // `partyAlive` de FIN DE PARTE no distingue «llegó muerta» de «se murió aquí», y esa
        // diferencia es la que decide si una re-siembra sirve de algo: en la validación de
        // este carril las tres partes re-ancladas arrancan con 6/6 y dos de ellas terminan
        // otra vez en 0/6, y sin esta serie no se puede decir en qué tramo se fueron. Sonda
        // READ-ONLY (`probeState`), así que no puede mover el estado ni el generador.
        const vs = await probeState(page);
        vivosPorSegmento.push({
          seg: seg.id,
          alive: typeof vs.partyAlive === "number" ? vs.partyAlive : null,
          size: typeof vs.partySize === "number" ? vs.partySize : null,
        });
        if (DUMP) transcripts[seg.id] = portLines;
        console.log(
          `[${part}] ${seg.id} conf=${report.conformity ?? "—"} matched=${report.matched}/${report.comparable}` +
            (report.resyncs.length ? ` resyncs=${report.resyncs.length}` : ""),
        );
      }

      console.log(`[${part}] ${resumenVehiculo(vehiculoRep)}`);

      // ---- LEDGER + reporte
      const state = await probeState(page);
      // MÉTRICA APARTE (ruling del lead, FASE 3): el número de arriba es SMALLMAP — los
      // segmentos de INTERIOR abiertos (`openedBy`) NO entran en él. Mezclarlos antes de
      // recalibrar el RNG de combate (3c) hunde el global por instrumento y hace ilegible el
      // progreso (la lección del estreno AD). `report.interior` lleva su propia línea.
      const outer = segReports.filter((s) => !s.interior);
      const interior = aggregateInterior(segReports);
      const comparable = outer.reduce((a, s) => a + s.comparable, 0);
      const matched = outer.reduce((a, s) => a + s.matched, 0);
      const divergent = outer.reduce(
        (a, s) => a + s.blocks.filter((b) => b.verdict === "divergent").length,
        0,
      );
      const presentacion = segReports.reduce((a, s) => a + s.presentacion, 0);
      const ocrPartial = segReports.reduce((a, s) => a + s.ocrPartial, 0);
      const ocrGhost = segReports.reduce((a, s) => a + s.ocrGhost, 0);
      const ocrGarbage = segReports.reduce((a, s) => a + s.ocrGarbage, 0);
      const covered = segReports.reduce((a, s) => a + s.covered, 0);
      // VENTANA `comparador-bandas`: los dos billetes de lotería retirados del denominador, en
      // canal PROPIO y por parte. Sin esto la exclusión sería un recorte silencioso.
      const combatOutcomeRng = segReports.reduce((a, s) => a + s.combatOutcomeRng, 0);
      const shopGreetingRng = segReports.reduce((a, s) => a + s.shopGreetingRng, 0);
      // DELTAS de transacción anclada (comparable del ledger; balance corrido = no-comparable)
      const ledgerDeltas = segReports
        .filter((s) => s.ledgerDelta)
        .map((s) => ({ seg: s.id, ...s.ledgerDelta! }));
      const gapsClosed = segReports.reduce(
        (a, s) => a + s.blocks.filter((b) => b.verdict === "gap-cerrado").length,
        0,
      );
      const numericDeltas = segReports.flatMap((s) =>
        s.blocks
          .filter((b) => b.numbers && b.numbers.expected.join(",") !== b.numbers.got.join(","))
          .map((b) => ({ seg: s.id, ocrLn: b.ocrLn, ...b.numbers! })),
      );
      const anchors = aggregateAnchors(segReports);
      const report: PartReport = {
        part,
        when: new Date().toISOString(),
        conformity: comparable ? Number((matched / comparable).toFixed(3)) : null,
        comparable,
        matched,
        divergent,
        presentacion,
        ocrPartial,
        ocrProfile: ACTIVE_PROFILE.id,
        ocrGhost,
        ocrGarbage,
        covered,
        combatOutcomeRng,
        shopGreetingRng,
        gapsClosed,
        ...anchors,
        interior,
        ledger: {
          state,
          assert: route.ledger?.assert ?? {},
          numericDeltas,
          ledgerDeltas, // deltas por transacción anclada (comparable); balance = no-comparable
          balanceComparable: false, // el balance corrido NO es comparable (loot RNG) — documentado
          note: route.ledger?.note,
        },
        // SALUD DE LA PARTY + DENOMINADOR REAL, al sello (ver PartReport en runner.ts).
        // `partyAlive`/`partySize` salen de `probeState`; `??  null` y NUNCA `?? 0`, porque un
        // 0 inventado se leería como «party muerta» que es justo lo que esto vigila.
        partyAlive: typeof state.partyAlive === "number" ? state.partyAlive : null,
        partySize: typeof state.partySize === "number" ? state.partySize : null,
        expectTotal: route.segments.reduce((a, s) => a + (s.expect?.length ?? 0), 0),
        // DECLARACIÓN DEL VEHÍCULO — va SIEMPRE, también con el modo apagado (ver PartReport).
        vehiculo: vehiculoRep,
        // DECLARACIÓN DE RE-SIEMBRA — va SIEMPRE, también con el modo apagado (ver PartReport).
        reseed,
        partyAliveBySegment: vivosPorSegmento,
        segments: segReports,
      };
      const path = writeReport(report);
      // CALIBRACIÓN OFFLINE: el transcript por segmento permite re-correr diffSegment (puro)
      // sobre el MISMO material sin gastar otra ventana playwright (ver writeTranscript).
      if (DUMP) console.log(`transcript: ${writeTranscript(part, transcripts)}`);
      // ★ ficha #31: histograma del ancla de spawn. Pares [kx,ky] por intento; el port
      // asume k=16 clavado y el binario usa el k REAL, así que cualquier k≠16 en el corpus
      // es colocación divergente en potencia. Se imprime CRUDO y agregado: el crudo por si
      // hay que re-contar sin re-correr, el agregado para el cuadro preregistrado.
      if (process.env.U5_SPAWN_K) {
        const ks = await spawnLogSlice(page, 0);
        const hist = new Map<number, number>();
        for (const k of ks) hist.set(k, (hist.get(k) ?? 0) + 1);
        const filas = [...hist.entries()].sort((a, b) => a[0] - b[0]);
        const no16 = ks.filter((k) => k !== 16).length;
        console.log(
          `[SPAWNK ${part}] intentos=${ks.length / 2} muestras=${ks.length} k!=16=${no16} ` +
            `hist=${filas.map(([k, n]) => `${k}:${n}`).join(",")}`,
        );
      }
      // ★ ficha #31-bis: pasos del stream consumidos por la parte + semilla viva al cerrar.
      // Es la magnitud que responde «¿se movió el stream?», que NO es la que responden los
      // sellos («¿cambió el texto?»). La semilla va como testigo redundante: es función
      // pura del nº de pasos desde la siembra, así que dos corridas con `tiradas` iguales
      // y `seed` distinta acusarían un fallo del propio instrumento.
      if (process.env.U5_RNG_N) {
        const r = await rngCountRead(page);
        console.log(`[RNGN ${part}] tiradas=${r.n} seed=0x${(r.seed & 0xffff).toString(16)}`);
      }
      console.log(summarize(report));
      // Fase C: los ANCHOR-MISS son candidatos a divergencia REAL del port (feature del LP
      // ausente en el mapa vivo) — se afloran explícitos en el log para el protocolo de ticket.
      for (const s of segReports) {
        for (const r of s.resyncs) if (r.startsWith("ANCHOR-MISS")) console.log(`[${part}] ${s.id} ${r}`);
      }
      console.log(`reporte: ${path}`);

      // ★ carril `gate-videos`: vuelca el sidecar JUNTO al .webm de esta parte. Playwright
      // guarda el vídeo en `<outputDir>/<slug del test>/video.webm` y sólo lo cierra al
      // acabar el test, así que aquí se pregunta por la RUTA (que ya se conoce) y se
      // escribe el sidecar en su MISMO directorio con el nombre de la parte: el paso de
      // recolección que renombra `video.webm` → `partNN.webm` se lleva los dos ficheros.
      // Se lee la página VIVA (tras cerrar no hay contexto que interrogar).
      if (VIDEO) {
        const vpath = await page.video()?.path();
        if (vpath) {
          const datos = await readSidecar(page);
          const dest = `${dirname(vpath)}/${part}.webm.log.jsonl`;
          const n = escribeSidecar(dest, {
            t0Wall,
            razonFin: "fin-parte",
            meta: { video: `${part}.webm`, evento: part, piel: "faithful", arnes: "espejo", sha: report.sha, viewport: "1280x800" },
            datos,
          });
          console.log(`[${part}] sidecar: ${dest} (${n} regs · ${datos.lines.length} filas · ${datos.keys.length} teclas)`);
        } else {
          console.log(`[${part}] ⚠ sidecar NO escrito: page.video() vacío pese a U5_ESPEJO_VIDEO`);
        }
      }

      // ---- SALIDA: checkpoint propio (entrada de la parte siguiente)
      // `U5_ESPEJO_NO_EXPORT=1` = RUN DE MEDICIÓN AISLADA: no reescribe el checkpoint. Sin esto,
      // medir una parte del medio de la cadena (p.ej. ad17 desde el checkpoint de ad16)
      // REESCRIBE saves/ad17.* y rompe la contigüidad de los reportes que ad18+ ya midieron
      // sobre el anterior. Con él, la cadena queda intacta y la medición sigue siendo válida
      // como aislada (la misma clase de medición que el estreno declaró para ad22-25).
      if (process.env.U5_ESPEJO_NO_EXPORT === "1") {
        console.log(`[${part}] checkpoint NO exportado (U5_ESPEJO_NO_EXPORT=1: run de medición aislada)`);
      } else if (reseed.aplicada && process.env.U5_ESPEJO_RESIEMBRA_EXPORT !== "1") {
        // 🔴 UNA CORRIDA RE-ANCLADA NO PISA LA CADENA CANÓNICA SIN QUE ALGUIEN LO PIDA.
        // Es literalmente el accidente del 20-08 (`espejo-cadena-party-muerta` §2): tres
        // corridas dejaron su salida en el mismo directorio gitignored, la costura no salió
        // en ningún diff y nadie la vio en tres semanas. Un checkpoint exportado desde un
        // estado SEMBRADO es peor todavía: no es la salida de un replay, es la salida de un
        // replay que arrancó de un punto que el instrumento se fijó a sí mismo, y encadenar
        // sobre él propagaría la siembra a las partes siguientes SIN que sus reportes lo
        // digan (su bloque `reseed` diría `modo-off`, que sería CIERTO y engañoso — la misma
        // forma exacta del defecto de §4). Se falla en vez de saltar en silencio: saltar
        // dejaría la parte N+1 arrancando de un checkpoint rancio sin avisar.
        throw new Error(
          `${part}: re-siembra APLICADA (${reseed.disparo}) y export de checkpoint ACTIVO. Una corrida ` +
            `re-anclada no debe reescribir las semillas compartidas: corre con U5_ESPEJO_NO_EXPORT=1 ` +
            `(medición aislada, que es para lo que sirve la re-siembra) o, si de verdad quieres re-sembrar ` +
            `la cadena en disco, ponlo por escrito con U5_ESPEJO_RESIEMBRA_EXPORT=1 y actualiza ` +
            `saves-PROCEDENCIA.tsv en el mismo gesto.`,
        );
      } else {
        await exportCheckpoint(page, part);
      }

      // ---- GATES (en SOFT = calibración: se REPORTAN, no se asertan — para que la
      //  cadena corra entera y afloren TODAS las derivas de estado sin abortar en la 1ª)
      for (const [k, v] of Object.entries(route.ledger?.assert ?? {})) {
        const got = (state as Record<string, unknown>)[k];
        if (SOFT) {
          if (got !== v) console.log(`[${part}] LEDGER-DRIFT ${k}: esperado ${v}, obtenido ${got}`);
        } else {
          expect(got, `${part} ledger.${k}`).toBe(v);
        }
      }
      // ★★ `comparable === 0` ⇒ NO-MEDIDA, y NO-MEDIDA NUNCA ES PASA (ruling del lead 22-08,
      // adjudicación `re/notes/espejo-cadena-party-muerta.md` §6).
      //
      // 🔴 LO QUE HABÍA AQUÍ ERA UN VERDE VACUO. El gate de conformidad estaba envuelto en
      // `report.conformity !== null`, y `conformity` es `null` exactamente cuando
      // `comparable === 0` — o sea que **la parte que no medía NI UNA operación se saltaba el
      // único aserto y pasaba**. No es hipotético: part23 y part24 declaran 578 y 351 bloques
      // `expect`, tienen sus 8/8 y 5/5 segmentos marcados `skip:"pendiente-runner"` en la
      // propia ruta, comparan CERO — y el índice de la corrida las dio por buenas («se
      // re-corrieron y las tres pasaron»). Un verde así no es un predicado sobre la fidelidad
      // del port: es la ausencia de predicado, con el color del éxito.
      //
      // El corte va con el DENOMINADOR DECLARADO al lado, para que el rojo diga cuánto material
      // había sin medir y no sólo que no se midió. Una parte legítimamente vacía (corpus sin
      // bloques `expect`) no dispara: ahí no hay nada que reclamar.
      const expectTotal = report.expectTotal;
      if (!SOFT && report.comparable === 0) {
        expect(
          expectTotal,
          `${part}: NO-MEDIDA — 0 bloques comparables sobre ${expectTotal} declarados por el corpus.\n` +
            `  Un verde aquí no diría nada sobre la fidelidad del port (§6 de espejo-cadena-party-muerta).\n` +
            `  Causa habitual: todos los segmentos llevan skip:"pendiente-runner" (contexto que el\n` +
            `  runner aún no reproduce). Reporte en ${path}.`,
        ).toBe(0);
      }
      if (!SOFT && report.conformity !== null) {
        expect(
          report.conformity,
          `${part}: conformidad ${report.conformity} < umbral ${THRESHOLD} — revisa divergentes en ${path}`,
        ).toBeGreaterThanOrEqual(THRESHOLD);
      }
    });
  }
});
