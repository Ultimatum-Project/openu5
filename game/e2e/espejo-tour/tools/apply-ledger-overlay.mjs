/**
 * F3b — APLICADOR QUIRÚRGICO de los `insertOps` del ledger, segmento a segmento.
 *
 * ## Por qué NO se usa `curate.mjs` para esto
 *
 * `curate` reconstruye la ruta ENTERA, y su salida de hoy **ya no coincide** con las rutas
 * commiteadas: él mismo lo avisa (`DERIVA: la ruta commiteada NO es la salida de curate hoy`).
 * Medido en `ad01` al poblar este frente: además de mis dos inserciones, la pasada **borraba un
 * `skip: "pendiente-runner"`** de `ad01-g06` — un des-skip silencioso que MUEVE EL DENOMINADOR
 * de la conformidad y contaminaría la medición del ledger con material nuevo sin medir.
 *
 * Es el mismo veneno que `overlay-merge.mjs` documenta una capa más abajo (regenerar borra lo
 * que el generador no re-emite), y la razón por la que aquí el poblado se aplica **sólo a los
 * segmentos nombrados**: el diff de la ruta queda siendo EXACTAMENTE la población del frente, y
 * la deriva pre-existente de `curate` se deja donde está en vez de aterrizarla de polizón.
 *
 * ## ★★ Y `ad01-g06` no era EL caso: era uno de SESENTA Y TRES
 *
 * Al implementar el `--verify` de abajo se censó el corpus entero (49 rutas · 1052 segmentos, ver
 * `re/notes/curate-verify-acta.md`): una regeneración de hoy borraría **63** `skip:
 * "pendiente-runner"`, todos en AD, todos de una misma CLASE (`ctx: "post-combat"`, sin
 * `openedBy`, sin `enter`). La DERIVA que `curate --check` marca en 19 rutas de AD son
 * exactamente esos 63 y nada más: 2142 B de delta = 63 × 34 B, sin residuo.
 *
 * El mecanismo NO es «la clave ausente se pierde» —`applyPatchKeys` conserva lo que el overlay
 * no menciona, y por eso las 2621 claves que sólo viven en las rutas están a salvo—: es el
 * TOMBSTONE `skip: false` que `mkoverlay-ad.mjs` emite en su rama `else` para todo segmento que
 * su clasificador no ve como interior. Un `post-combat` no lo es. Es el agujero que #23/#43 ya
 * taparon para las costuras `enter.underworld` (8 segmentos de clase B), en la clase de al lado.
 *
 * ⇒ Corolario que deroga el enunciado viejo: «curate NUNCA borra; regenerar = INERTE» describía
 * main `cc4a3b8a`. Desde #43 ruling 2, curate SÍ borra — y sobre el corpus de hoy borraría 63.
 *
 * ## Por qué es EQUIVALENTE a curate para lo que sí toca
 *
 * Usa la MISMA `insertAt` de `overlay-merge.mjs` y el MISMO estampado (`src:"overlay"`,
 * `ocrLn: afterOcrLn`) y el MISMO serializador (`JSON.stringify(route, null, 2) + "\n"`). No es
 * una re-implementación: es curate recortado a una lista blanca de segmentos.
 *
 * ⚠ ALCANCE HONESTO DE `--verify`. Lo que verifica es la RECONCILIACIÓN OVERLAY↔RUTA: qué
 * campos perdería una regeneración. NO corre curate en memoria ni compara los guiones op a op —
 * ESA era la promesa fantasma que este fichero llevaba escrita y que nadie implementó (auditoría
 * final, 01-08). La equivalencia del GUION sigue ARGUMENTADA, no comprobada, y se dice aquí en
 * vez de dejar que un flag suene a más de lo que hace.
 *
 * ## Los dos modos
 *
 *   node tools/apply-ledger-overlay.mjs [--routes <dir>] [--claves] <part> <segId>...   ESCRIBE
 *   node tools/apply-ledger-overlay.mjs --verify [--routes <dir>] <part>...             SÓLO LEE
 *
 * `--claves` (ventana `banner-ad19`) aplica además las claves `PATCHABLE` del overlay a los
 * segmentos nombrados, con `applyPatchKeys` — la función de PRODUCCIÓN que usa `curate`. Existe
 * porque una CURACIÓN de dato (`ad19-g17.enter.loc = 36`, el banner `WRUNG`≠`WRONG`) no puede
 * entrar por `curate`: su pasada sobre `ad19` se lleva por delante 2 de los 63 `skip` pendientes,
 * y eso metería DOS causas en el mismo delta del corpus. Ver `re/notes/banner-ad19-acta.md`.
 *
 * El modo de escritura lleva un CINTURÓN: compara sus claves PATCHABLE antes y después de su
 * propia mutación y **aborta sin escribir** si alguna se fue. Hoy no puede irse ninguna (este
 * script sólo empalma ops en `seg.script`), y ése es justo el punto: la propiedad «no borra»
 * deja de ser un accidente de la implementación y pasa a estar atada por un aserto que un
 * refactor futuro tiene que romper a la vista.
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  insertAt,
  camposPerdidos,
  camposEnRiesgo,
  opsDeOverlayHuerfanas,
  applyPatchKeys,
  clasificarPerdidas,
} from "./overlay-merge.mjs";
import { segAnchor } from "./anchor.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const routesArg = argv.includes("--routes") ? argv.splice(argv.indexOf("--routes"), 2)[1] : "routes";
const ROUTES = routesArg.startsWith("/") ? routesArg : join(HERE, "..", routesArg);
const VERIFY = argv.includes("--verify");
if (VERIFY) argv.splice(argv.indexOf("--verify"), 1);
/** `--claves`: aplicar también las claves PATCHABLE del overlay a los segmentos NOMBRADOS. */
const CLAVES = argv.includes("--claves");
if (CLAVES) argv.splice(argv.indexOf("--claves"), 1);
// ★ FLAGS DESCONOCIDAS = ERROR, Y ANTES DE ESCRIBIR NADA. El filtro era
// `argv.filter((a) => !a.startsWith("--"))`, que se tragaba en SILENCIO cualquier `--loquesea`
// y seguía adelante ESCRIBIENDO la ruta igual. Combinado con el `--verify` fantasma que este
// fichero documentaba, un `--verify` de buena fe no verificaba nada: modificaba el disco y
// decía que todo bien (auditoría final, 01-08).
const desconocidas = argv.filter((a) => a.startsWith("--"));
if (desconocidas.length) {
  console.error(`flag no reconocida: ${desconocidas.join(", ")}`);
  console.error("uso: apply-ledger-overlay.mjs [--routes <dir>] [--claves] <part> <segId>...");
  console.error("     apply-ledger-overlay.mjs --verify [--routes <dir>] <part>...");
  console.error("(las flags son --routes, --verify y --claves. No se ha tocado nada.)");
  process.exit(1);
}

function cargar(partId) {
  const routePath = join(ROUTES, `${partId}.route.json`);
  const ovPath = join(ROUTES, "overlays", `${partId}.json`);
  return {
    routePath,
    route: JSON.parse(readFileSync(routePath, "utf8")),
    overlay: existsSync(ovPath) ? JSON.parse(readFileSync(ovPath, "utf8")) : {},
  };
}

/**
 * Ids cuyo patch `curate` NO aplicará por huella desalineada (#85). Se calcula con la MISMA
 * `segAnchor` que curate: reportar un patch rancio como pérdida sería un falso positivo, y un
 * gate que cría falsos positivos acaba corriéndose con la flag que lo apaga.
 */
function rancios(route, overlay) {
  return new Set(
    route.segments
      .filter((seg) => {
        const p = overlay.segments?.[seg.id];
        return p && p.anchor !== undefined && p.anchor !== segAnchor(seg);
      })
      .map((seg) => seg.id),
  );
}

/** Reconciliación de UNA parte. Devuelve los hallazgos; no escribe ni muta nada. */
function reconciliar(partId) {
  const { route, overlay } = cargar(partId);
  return {
    campos: camposEnRiesgo(route, overlay, { rancios: rancios(route, overlay) }),
    ops: opsDeOverlayHuerfanas(route, overlay),
    segmentos: route.segments.length,
  };
}

function informar(partId, { campos, ops, segmentos }) {
  for (const c of campos)
    console.log(
      `  ${c.motivo}  ${c.segId} · ${c.clave} = ${JSON.stringify(c.enRuta)}` +
        (c.motivo === "PISADO" ? ` → ${JSON.stringify(c.enOverlay)}` : "  (el overlay lo TOMBSTONEA)"),
    );
  for (const o of ops) console.log(`  HUÉRFANA  ${o.segId} · op src=overlay sin ancla ${o.ocrLn} en el overlay`);
  console.log(
    `${partId}: ${campos.length} campo(s) + ${ops.length} op(s) que una REGENERACIÓN perdería` +
      ` (sobre ${segmentos} segmentos)`,
  );
}

// ── MODO --verify: SÓLO LEE. Ni un writeFileSync en esta rama. ──────────────────────────────
if (VERIFY) {
  if (!argv.length) {
    console.error("uso: apply-ledger-overlay.mjs --verify [--routes <dir>] <part>...");
    process.exit(2);
  }
  let total = 0;
  for (const p of argv) {
    const r = reconciliar(p);
    informar(p, r);
    total += r.campos.length + r.ops.length;
  }
  if (total) {
    console.error(
      `\n★ RECONCILIACIÓN OVERLAY↔RUTA: ${total} hallazgo(s) que una regeneración se llevaría.` +
        `\n  El runner lee la RUTA, no el overlay: cada uno de éstos cambia lo que se EJECUTA.` +
        `\n  No se adjudican aquí — o se corrige el overlay (que es quien tombstonea), o se quita` +
        `\n  el campo de la ruta a sabiendas. Lo que NO vale es regenerar y que se vayan callando.`,
    );
    process.exit(1);
  }
  console.log("\nreconciliación LIMPIA: regenerar estas rutas no perdería ningún campo.");
  process.exit(0);
}

// ── MODO ESCRITURA ──────────────────────────────────────────────────────────────────────────
const [partId, ...segIds] = argv;
if (!partId || !segIds.length) {
  console.error("uso: apply-ledger-overlay.mjs [--routes <dir>] <part> <segId>...");
  console.error("     apply-ledger-overlay.mjs --verify [--routes <dir>] <part>...");
  process.exit(2);
}

const { routePath, route, overlay } = cargar(partId);
/** Foto ANTES de tocar nada — el cinturón de abajo se mide contra ésta. */
const antes = structuredClone(route);

let touched = 0;
for (const seg of route.segments) {
  if (!segIds.includes(seg.id)) continue;
  const patch = overlay.segments?.[seg.id];
  // ★ `--claves`: las claves PATCHABLE del overlay, aplicadas con `applyPatchKeys` — la MISMA
  // función que usa `curate.mjs`, no una réplica. Sólo sobre los segmentos NOMBRADOS, que es lo
  // que hace que el diff de la ruta siga siendo exactamente la lista blanca.
  if (CLAVES && patch) applyPatchKeys(seg, patch);
  if (!patch?.insertOps?.length) {
    if (!CLAVES) console.error(`  ${seg.id}: SIN insertOps en el overlay — nada que aplicar`);
    continue;
  }
  // Idempotencia: si el guion ya trae ops del overlay ancladas en esa línea, no se re-inserta.
  const out = seg.script ?? [];
  for (const ins of patch.insertOps) {
    const already = out.some((o) => o.src === "overlay" && o.ocrLn === ins.afterOcrLn);
    if (already) {
      console.error(`  ${seg.id}: ya aplicado en ${ins.afterOcrLn} (idempotente)`);
      continue;
    }
    const at = insertAt(out, ins.afterOcrLn, ins.at);
    out.splice(at, 0, ...ins.ops.map((o) => ({ ...o, src: "overlay", ocrLn: ins.afterOcrLn })));
    console.log(`  ${seg.id}: +${ins.ops.length} ops en el índice ${at} (afterOcrLn ${ins.afterOcrLn}, at=${ins.at ?? "last"})`);
    touched++;
  }
  seg.script = out;
}

// ★★ CINTURÓN — «NO BORRA», ATADO EN VEZ DE SUPUESTO.
// Corre SIEMPRE en la ruta de escritura (no dentro de un `if`: un cinturón metido en la rama del
// caso que preocupa es código muerto el día que el defecto llega por otra rama), y ABORTA ANTES
// del writeFileSync.
//
// ★★ EL CINTURÓN HABLA, y por eso `--claves` no lo desarma. Hasta la ventana `banner-ad19` este
// script sólo empalmaba ops en `seg.script`, así que NINGÚN hallazgo era posible y el aserto era
// un seguro para el futuro — futuro que llegó, y el JSDoc de arriba pedía por escrito que ese
// futuro «rompiera el cinturón A LA VISTA en vez de des-skipear segmentos en silencio».
//
// Se cumple separando los DOS motivos en vez de bajando el listón (contrato pre-registrado en
// `re/notes/banner-ad19-preregistro.md` §2):
//
//  · `BORRADO` — una clave DESAPARECE. **Aborta siempre**, con `--claves` o sin él. Nombrar un
//    segmento autoriza a fijarle claves, NO a quitárselas: el tombstone `false` del contrato de
//    `applyPatchKeys` es una BAJA, y este script no adjudica bajas (los 63 `skip` pendientes de
//    `curate-verify-acta.md` son exactamente eso). Default-DENY.
//  · `PISADO` en un segmento **NOMBRADO** — es el efecto que se pidió. Se ENUMERA
//    (`antes → después`) para que la curación viaje al mensaje del commit en vez de esconderse
//    en un diff de 879 KB, y sólo entonces se escribe.
//  · `PISADO` en un segmento **NO nombrado** — imposible por construcción (el bucle filtra por
//    `segIds`). Si aparece, el defecto es del aplicador: aborta.
//
// La REGLA vive en `overlay-merge.mjs` (`clasificarPerdidas`), no aquí: inline era inalcanzable
// para los mutantes —el bucle de arriba ya filtra por la lista blanca, así que la rama «PISADO de
// un segmento NO nombrado» no se puede provocar desde el CLI— y un cinturón que ningún mutante
// puede matar no está probado, está escrito.
const perdidos = camposPerdidos(antes, route);
const { fatales, declarados } = clasificarPerdidas(perdidos, { segIds, claves: CLAVES });
if (fatales.length) {
  console.error("★ ABORTADO SIN ESCRIBIR — esta pasada habría borrado campos de la ruta:");
  for (const c of fatales)
    console.error(
      `   ${c.motivo}  ${c.segId} · ${c.clave} = ${JSON.stringify(c.enRuta)}` +
        (c.motivo === "PISADO" ? ` → ${JSON.stringify(c.enOverlay)}  (segmento NO nombrado)` : "  (el overlay lo TOMBSTONEA)"),
    );
  console.error("  El runner lee la RUTA. Resuélvelo a mano: este script no adjudica bajas.");
  process.exit(3);
}
for (const c of declarados)
  console.log(
    `  ★ CURACIÓN  ${c.segId} · ${c.clave}: ${JSON.stringify(c.enRuta)} → ${JSON.stringify(c.enOverlay)}`,
  );

writeFileSync(routePath, JSON.stringify(route, null, 2) + "\n");
console.log(
  `${partId}: ${touched} bloque(s) de ops + ${declarados.length} clave(s) curada(s)` +
    ` sobre ${segIds.length} segmento(s) nombrado(s)`,
);

// AVISO no fatal: la divergencia PRE-EXISTENTE que este script no causa pero sí hereda. Callarla
// sería dejar la ruta escrita y el des-skip esperando al siguiente `curate` de otro.
const pendiente = reconciliar(partId);
if (pendiente.campos.length || pendiente.ops.length) {
  console.error(`\n⚠ AVISO (no fatal): ${partId} sigue divergiendo de su overlay. Regenerarla perdería:`);
  informar(partId, pendiente);
  console.error("  Correr `--verify` para el detalle. Este script NO la ha tocado.");
}
