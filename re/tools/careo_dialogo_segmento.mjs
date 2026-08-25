#!/usr/bin/env npx tsx
/**
 * CAREO DE DIÁLOGO: ¿emite el PORT las respuestas que el LP obtuvo en un segmento,
 * cuando se le teclean las MISMAS palabras a los MISMOS NPC?
 *
 * Sonda del carril `ad10-minoc` (acta: re/notes/ad10-minoc-acta.md). Nace de una
 * pregunta de adjudicación: los 26 bloques de conversación de `ad10-g21` se caen en el
 * espejo, y el arnés NUNCA LLEGA a esos NPC (planta y posición). Un cero por «no tuvo
 * ocasión» NO es evidencia de que el port fallaría ([[cero-emisiones-no-es-cero-capacidad]]).
 * Esta sonda le pone la conversación DELANTE, sin arnés y sin navegador: instancia el
 * motor `Conversation` del port y le teclea la secuencia del LP.
 *
 *   npx tsx re/tools/careo_dialogo_segmento.mjs <parte> <segmento> [--verboso]
 *   npx tsx re/tools/careo_dialogo_segmento.mjs ad10 ad10-g21
 *   npx tsx re/tools/careo_dialogo_segmento.mjs ad10 ad10-g21 --control-negativo
 *
 * ★ NO RE-DERIVA NADA DEL PORT. Importa `Conversation` de `game/src/core/dialogue/` y
 *   los datos de `game/assets/talk/towne.json`. Si el motor o el .TLK divergen, esta
 *   sonda lo ve; una segunda copia de la lógica no lo vería.
 *
 * ★ DOS CONTROLES, y el segundo es el que le da dientes al comparador:
 *   - POSITIVO (identificación): para los segmentos de la tabla `CONTROL`, el conjunto de
 *     `npcIndex` identificados a partir del «You see …» del OCR debe ser EXACTAMENTE el
 *     pre-registrado. Si no cuadra ABORTA sin imprimir cifras: identificar mal al
 *     interlocutor produciría discrepancias fabricadas.
 *   - NEGATIVO (`--control-negativo`): carea cada respuesta del port contra la ventana OCR
 *     del tecleo SIGUIENTE en vez de la suya. Si la tasa no se desploma, el comparador no
 *     discrimina y sus verdes no valen ([[control-negativo-verde-sin-validar-no-prueba]]).
 *
 * ⚠ VOCABULARIO DELIBERADO. El veredicto por tecleo es CORROBORA / SIN CORROBORAR, no
 *   «coincide/discrepa». La ventana del LP es OCR de vídeo y viene rota a trozos: la
 *   ausencia de corroboración en un canal ilegible NO es refutación
 *   ([[sin-anclar-no-es-refutado]], [[fragmento-truncado-acusa-en-falso]]).
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { Conversation } from "../../game/src/core/dialogue/conversation.ts";

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const TOWNE = join(RAIZ, "game", "assets", "talk", "towne.json");
const RUTAS = join(RAIZ, "game", "e2e", "espejo-tour", "routes-ad");
const RUTAS_P = join(RAIZ, "game", "e2e", "espejo-tour", "routes");

/** Nombre del Avatar en la partida del tour (`saves/*.gam`, primer miembro). */
const AVATAR = "Barnabas";

/**
 * Control POSITIVO de identificación, pre-registrado por segmento. `npcIndex` del .TLK
 * (NO la posición del array — [[talk-npcindex-no-array-pos]]).
 */
const CONTROL = {
  "ad10-g21": { npcIndex: [25, 26, 27, 28, 29], tiendas: 1 },
};

// ── Normalización tolerante al OCR ───────────────────────────────────────────
// El corpus es OCR de vídeo: pierde letras y confunde glifos. Las confusiones vivas y
// MEDIDAS en este corpus son 0/O, 1/I y **U/V** (`Vpen-North`, `Klimb-Vp!`, `Svul` por
// *soul*, `JVB` por *JOB*): se pliegan a un solo glifo. Se compara por PALABRAS LARGAS
// presentes, no por cadena — exigir la cadena entera daría 0 siempre.
// ⚠ Un plegado NO es un `/i`: la mayúscula no arregla un glifo mal leído
// ([[regex-i-pliega-mayusculas-no-glifos-ocr]]). Por eso el plegado va explícito, y por
// eso el CONTROL NEGATIVO es obligatorio: cada aflojada del comparador se paga midiendo
// que sigue discriminando.
const norm = (s) =>
  String(s || "")
    .toUpperCase()
    .replace(/0/g, "O")
    .replace(/1/g, "I")
    .replace(/U/g, "V")
    .replace(/[^A-Z ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const palabras = (s) => norm(s).split(" ").filter((w) => w.length >= 4);

/** Distancia de edición acotada a 1 (basta para el ruido de este OCR). */
function dist1(a, b) {
  if (a === b) return true;
  if (Math.abs(a.length - b.length) > 1) return false;
  let i = 0;
  let j = 0;
  let fallos = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      i++;
      j++;
      continue;
    }
    if (++fallos > 1) return false;
    if (a.length > b.length) i++;
    else if (b.length > a.length) j++;
    else {
      i++;
      j++;
    }
  }
  return fallos + (a.length - i) + (b.length - j) <= 1;
}

/** ¿Está la palabra del port en la ventana del LP? Igual, prefijo (≥4) o a distancia 1. */
function presente(w, lista) {
  for (const l of lista) {
    if (l === w) return true;
    if (l.length >= 4 && w.length >= 4 && (l.startsWith(w) || w.startsWith(l))) return true;
    if (dist1(w, l)) return true;
  }
  return false;
}

/**
 * Corroboración de la respuesta del PORT por la ventana OCR del LP: fracción de las
 * palabras largas del port que aparecen en la ventana. Sin palabras largas ⇒ null
 * (no adjudicable, no «falla»).
 */
function corrobora(respPort, ventanaLP) {
  const w = palabras(respPort);
  if (w.length < 2) return { score: null, hits: 0, total: w.length };
  const v = palabras(ventanaLP);
  const hits = w.filter((x) => presente(x, v)).length;
  return { score: hits / w.length, hits, total: w.length };
}

const UMBRAL = 0.5;

// ── Carga del corpus ─────────────────────────────────────────────────────────
function cargarSegmento(parte, segId) {
  let p = join(RUTAS, `${parte}.route.json`);
  try {
    readFileSync(p);
  } catch {
    p = join(RUTAS_P, `${parte}.route.json`);
  }
  const d = JSON.parse(readFileSync(p, "utf8"));
  const s = (d.segments || []).find((x) => x.id === segId);
  if (!s) throw new Error(`no existe el segmento ${segId} en ${p}`);
  return s;
}

const textoDe = (linea) =>
  (Array.isArray(linea) ? linea : []).filter((i) => i && i.kind === "text").map((i) => i.text).join("");

/** Ventana OCR del LP: todo el `expect` con ocrLn en [ln, ln+ancho]. */
function ventana(expect, ln, ancho = 8) {
  return expect.filter((e) => e.ocrLn >= ln && e.ocrLn <= ln + ancho).map((e) => e.text).join(" ");
}

/**
 * Ops de Talk del segmento: cada `key:'t'` abre una op, y los `typed` posteriores le
 * pertenecen hasta la siguiente. Es la segmentación que trae la RUTA, no una mía.
 */
function opsDeTalk(seg) {
  const ops = [];
  for (const st of seg.script || []) {
    if (st.key === "t") ops.push({ ocrLn: st.ocrLn, typed: [] });
    else if (st.typed !== undefined && ops.length) ops[ops.length - 1].typed.push(st);
  }
  return ops;
}

/**
 * Cuerpo de la descripción: lo que va DESPUÉS de «You see» y ANTES de la primera comilla
 * (ahí empieza el saludo). Acotar importa: con la línea entera, el `Talk-South` del propio
 * comando casaba «a strong **youth**» a distancia 1 de «**south**» y empataba con la
 * descripción correcta — el identificador se negaba a adivinar y perdía un interlocutor.
 * El ruido no venía del OCR sino de MI ventana ([[medir-en-la-capa-equivocada]]).
 */
function cuerpoDescripcion(textoOCR) {
  const m = /Y[o06]u see/i.exec(String(textoOCR || ""));
  const resto = m ? textoOCR.slice(m.index + m[0].length) : textoOCR;
  const q = resto.indexOf('"');
  return q >= 0 ? resto.slice(0, q) : resto;
}

/** Identifica al interlocutor por el «You see <cuerpo>» del OCR. Mejor único ≥0.6. */
function identificar(towne, textoOCR) {
  const v = palabras(cuerpoDescripcion(textoOCR));
  let mejor = null;
  let segundo = 0;
  for (const e of towne) {
    const w = palabras(textoDe(e.description));
    if (w.length < 2) continue;
    const score = w.filter((x) => presente(x, v)).length / w.length;
    if (!mejor || score > mejor.score) {
      segundo = mejor ? mejor.score : 0;
      mejor = { entrada: e, score };
    } else if (score > segundo) segundo = score;
  }
  if (!mejor || mejor.score < 0.6 || mejor.score === segundo) return null;
  return mejor;
}

// ── Careo ────────────────────────────────────────────────────────────────────
function carear(parte, segId, { verboso = false, controlNegativo = false, ventanaAjena = null } = {}) {
  const towne = JSON.parse(readFileSync(TOWNE, "utf8"));
  const seg = cargarSegmento(parte, segId);
  const expect = seg.expect || [];
  // CONTROL NEGATIVO FUERTE: la ventana del LP se toma de OTRO segmento. Si la tasa no
  // se desploma, el comparador está midiendo «inglés parecido», no esta conversación.
  const expectCareo = ventanaAjena ? cargarSegmento(parte, ventanaAjena).expect || [] : expect;
  const desplaz = ventanaAjena
    ? (expectCareo[0]?.ocrLn ?? 0) - (expect[0]?.ocrLn ?? 0)
    : 0;
  const porLn = new Map(expect.map((e) => [e.ocrLn, e.text]));
  const ops = opsDeTalk(seg);

  const identificados = [];
  let tiendas = 0;
  const filas = [];

  for (const op of ops) {
    const cabecera = porLn.get(op.ocrLn) || "";
    if (!/You see|Y6u see|Vou see/i.test(cabecera)) {
      tiendas++; // saludo de TIENDA (shoppe.json), no pasa por el motor de towne
      continue;
    }
    const id = identificar(towne, cabecera);
    if (!id) {
      filas.push({ op: op.ocrLn, npc: "?", kw: "(identificación)", estado: "AMBIGUO", cabecera });
      continue;
    }
    identificados.push(id.entrada.npcIndex);
    const conv = new Conversation(id.entrada, { avatarName: AVATAR, npcKnowsAvatar: false });
    conv.start();
    const nombre = textoDe(id.entrada.name) || `npc${id.entrada.npcIndex}`;

    for (let i = 0; i < op.typed.length; i++) {
      const t = op.typed[i];
      const salida = conv.input(t.typed);
      const resp = salida.filter((o) => o.kind === "line").map((o) => o.text).join(" ");
      const lnVentana = (controlNegativo && op.typed[i + 1] ? op.typed[i + 1].ocrLn : t.ocrLn) + desplaz;
      const v = ventana(expectCareo, lnVentana);
      const c = corrobora(resp, v);
      filas.push({
        op: op.ocrLn,
        npc: nombre,
        kw: t.typed,
        resp,
        ventana: v,
        ...c,
        estado: c.score === null ? "SIN-TEXTO" : c.score >= UMBRAL ? "CORROBORA" : "SIN CORROBORAR",
        cannotHelpPort: /cannot help thee/i.test(resp),
        // ⚠ La sub-métrica de negativos usa una ventana ESTRECHA (2 líneas), no la de
        // careo (8). Con la ancha, un «I cannot help thee» de DOS tecleos más allá caía
        // dentro y contaba como negativo del LP aquí: medido, inflaba 16 negativos donde
        // hay 5 ([[bucket-de-basura-demasiado-ancho]]).
        cannotHelpLP: /cannot help thee/i.test(ventana(expectCareo, lnVentana, 2)),
      });
    }
  }

  // ── CONTROL POSITIVO de identificación ────────────────────────────────────
  const ctrl = CONTROL[segId];
  if (ctrl) {
    const vistos = [...new Set(identificados)].sort((a, b) => a - b).join(",");
    const esp = [...ctrl.npcIndex].sort((a, b) => a - b).join(",");
    if (vistos !== esp || tiendas !== ctrl.tiendas) {
      throw new Error(
        `🔴 CONTROL POSITIVO ROTO — ${segId}: identificados npcIndex [${vistos}] y ${tiendas} ` +
          `tienda(s); pre-registrado [${esp}] y ${ctrl.tiendas}. NO se imprime nada: identificar ` +
          `mal al interlocutor fabrica discrepancias.`,
      );
    }
  }

  return { filas, identificados, tiendas, verboso, controlNegativo, ventanaAjena, segId };
}

function informe(r) {
  const { filas } = r;
  const conTexto = filas.filter((f) => f.estado !== "SIN-TEXTO" && f.estado !== "AMBIGUO");
  const ok = conTexto.filter((f) => f.estado === "CORROBORA");
  const marca = r.ventanaAjena
    ? `  [🔴 CONTROL NEGATIVO FUERTE: ventana OCR de ${r.ventanaAjena}]`
    : r.controlNegativo
      ? "  [🔴 CONTROL NEGATIVO: ventana DESPLAZADA un tecleo]"
      : "";
  console.log(`# CAREO DE DIÁLOGO — ${r.segId}${marca}`);
  console.log(`# motor: game/src/core/dialogue/conversation.ts · datos: game/assets/talk/towne.json`);
  console.log(`# avatar: ${AVATAR} · interlocutores towne: ${[...new Set(r.identificados)].join(", ")} · tiendas (fuera del careo): ${r.tiendas}`);
  console.log("");
  if (r.verboso) {
    for (const f of filas) {
      const s = typeof f.score === "number" ? f.score.toFixed(2) : " —  ";
      console.log(`${String(f.op).padStart(5)} ${String(f.npc).padEnd(12)} ${String(f.kw).padEnd(14)} ${s} ${f.estado}`);
      if (f.resp !== undefined) console.log(`      PORT: ${f.resp.slice(0, 150)}`);
      if (f.estado === "SIN CORROBORAR") console.log(`      LP  : ${String(f.ventana).slice(0, 150)}`);
    }
    console.log("");
  }
  console.log(`RESPUESTAS CAREADAS      : ${conTexto.length}`);
  console.log(`  CORROBORADAS por el LP : ${ok.length}  (${((100 * ok.length) / (conTexto.length || 1)).toFixed(1)}%)`);
  console.log(`  sin corroborar         : ${conTexto.length - ok.length}`);

  // Sub-métrica de DOS FILOS: los NO-match del LP. Que el port responda de más sería
  // un .TLK demasiado rico; que responda de menos, uno demasiado pobre.
  const lpNo = conTexto.filter((f) => f.cannotHelpLP);
  const ambos = lpNo.filter((f) => f.cannotHelpPort);
  console.log("");
  console.log(`NEGATIVOS DEL LP («I cannot help thee with that.») : ${lpNo.length}`);
  console.log(`  el port TAMPOCO responde                        : ${ambos.length}`);
  const portNo = conTexto.filter((f) => f.cannotHelpPort);
  console.log(`NEGATIVOS DEL PORT                                : ${portNo.length}`);
  console.log(`  el LP TAMPOCO responde                          : ${portNo.filter((f) => f.cannotHelpLP).length}`);
}

function main(argv) {
  const flags = argv.filter((a) => a.startsWith("--"));
  const pos = argv.filter((a) => !a.startsWith("--"));
  if (pos.length < 2) {
    console.error(
      "uso: npx tsx re/tools/careo_dialogo_segmento.mjs <parte> <segmento> [--verboso] " +
        "[--control-negativo] [--ventana-ajena=<segmento>]",
    );
    process.exit(2);
  }
  const ajena = (flags.find((f) => f.startsWith("--ventana-ajena=")) || "").split("=")[1] || null;
  informe(
    carear(pos[0], pos[1], {
      verboso: flags.includes("--verboso"),
      controlNegativo: flags.includes("--control-negativo"),
      ventanaAjena: ajena,
    }),
  );
}

if (process.argv[1] && process.argv[1].endsWith("careo_dialogo_segmento.mjs")) main(process.argv.slice(2));

export { carear, corrobora, identificar, opsDeTalk };
