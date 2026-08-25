#!/usr/bin/env node
/**
 * FRONTERAS DE PLANTA y TESTIGO HORARIO de los mercaderes anclados en los DELTAS DE LEDGER
 * SELLADOS.
 *
 * Sonda del carril `fronteras-sellos` (acta: re/notes/fronteras-sellos-acta.md). Contesta la
 * pregunta que dejó `ad06-g34`: **¿es una casualidad de Minoc que el ancla de un sello caiga
 * cerca de una frontera de planta, o es una propiedad común de las anclas de mercader?**
 *
 *   node re/tools/fronteras_sellos.mjs           # los cinco sellos
 *   node re/tools/fronteras_sellos.mjs --todos   # + censo de TODAS las anclas de mercader
 *   node re/tools/fronteras_sellos.mjs --corpus  # + censo del INSTRUMENTAL horario del corpus
 *
 * ★ NO RE-DERIVA NADA. Reutiliza `celdaA` de `censo_horario_npcs.mjs` (que a su vez importa
 * `scheduleIndex` del PORT), y el mapa `dlg → tipo de tienda` sale de `SHOP_TYPES`
 * (`src/main.ts:2279`), transcrito aquí con su cita. Una regla en dos sitios puede divergir;
 * ésta se comprueba contra el fichero real en `control()`.
 *
 * ★ CONTROL POSITIVO INCORPORADO, y con DIENTES: además de re-derivar la frontera del herrero
 * de Minoc, `control()` pasa las **9 líneas REALES de OCR** de los cinco sellos por el
 * reconocedor de plantillas y exige el tipo de tienda CORRECTO en cada una — incluidas **una
 * que debe salir GuildMaster y no Blacksmith** (falso positivo real de la primera versión de
 * esta herramienta) y **dos que deben salir SIN CORROBORAR** por venir truncadas. Si no cuadra,
 * ABORTA sin imprimir.
 */
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { cargarLoc, celdaA } from "./censo_horario_npcs.mjs";
import { partOfDayWord } from "../../game/src/core/shops/shoppe-greetings.ts";

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const TOUR = join(RAIZ, "game", "e2e", "espejo-tour");

/** `SHOP_TYPES` de `game/src/main.ts:2279` — dialogNumber → tipo de tienda. */
export const SHOP_TYPES = {
  0x81: "Blacksmith",
  0x82: "Barkeeper",
  0x83: "HorseSeller",
  0x84: "Shipwright",
  0x85: "MagicSeller",
  0x86: "GuildMaster",
  0x87: "Healer",
  0x88: "InnKeeper",
};

/** Los cinco deltas de ledger SELLADOS del proyecto, con la loc EFECTIVA de su segmento.
 *  ⚠ `ad09-g04` declara `enter.overworld` pero entra a loc 26 por una op de costura interna
 *  (`{"enterLoc":26}`, ocrLn 164), y es la loc 26 la que manda para el horario del mercader. */
export const SELLOS = [
  { seg: "ad06-g34", delta: 220, loc: 5, sitio: "Minoc", ruta: "routes-ad/ad06" },
  { seg: "ad09-g04", delta: -274, loc: 26, sitio: "Bordermarch", ruta: "routes-ad/ad09" },
  { seg: "ad21-g26", delta: -1024, loc: 22, sitio: "Paws", ruta: "routes-ad/ad21" },
  { seg: "part04-g03", delta: 36, loc: 2, sitio: "Britain", ruta: "routes/part04" },
  { seg: "part05-g05", delta: -954, loc: 8, sitio: "New Magincia", ruta: "routes/part05" },
];

/** 🔴 RELOJ MEDIDO en el instante del ancla. Sólo `ad06-g34` lo tiene
 *  (`re/notes/ad06-reloj-acta.md` §1, línea `SONDA-ANCLA … reloj 19:02`). Para los otros
 *  cuatro **no existe la medida**: las corridas de los carriles vivos van deliberadamente SIN
 *  instrumentación, y un margen aproximado valdría menos que un hueco declarado con su receta. */
export const RELOJ_ANCLA = {
  "ad06-g34": { hora: 19, minuto: 2, fuente: "re/notes/ad06-reloj-acta.md §1 (SONDA-ANCLA, corrida R1)" },
};

/** Plantas hora a hora (0..23) de un NPC. */
export function plantas(npc) {
  return [...Array(24).keys()].map((h) => celdaA(npc, h).z);
}

/** Horas en las que el NPC CAMBIA DE PLANTA (la hora H tal que z(H) !== z(H-1)). */
export function fronteras(npc) {
  const z = plantas(npc);
  const out = [];
  for (let h = 0; h < 24; h++) if (z[h] !== z[(h + 23) % 24]) out.push({ hora: h, de: z[(h + 23) % 24], a: z[h] });
  return out;
}

/** Los NPC de `loc` cuyo dialogNumber es del tipo pedido. Puede haber 0, 1 o varios. */
export function mercaderes(loc, tipo) {
  return cargarLoc(loc).filter((n) => SHOP_TYPES[n.dialogNumber] === tipo);
}

/** Distancia en horas HACIA ATRÁS desde `hora` hasta la frontera más reciente, y hacia delante
 *  hasta la siguiente. Devuelve null si el NPC no tiene ninguna frontera de planta. */
export function margen(npc, hora) {
  const fr = fronteras(npc);
  if (fr.length === 0) return null;
  const atras = Math.min(...fr.map((f) => (hora - f.hora + 24) % 24));
  const delante = Math.min(...fr.map((f) => (f.hora - hora + 24) % 24));
  return { atras, delante, fronteras: fr.map((f) => f.hora) };
}

// ── TESTIGO HORARIO ──────────────────────────────────────────────────────────────────────
//
// 🔴 LA TRAMPA, y por qué esto es un CÁLCULO y no un juicio (corrige `fa3` §5, ver el acta):
// el `@` de las plantillas de saludo es la parte del día (`partOfDayWord`,
// `shoppe-greetings.ts:438`, SHOPPES 0x00d8: `<12 morning · <18 afternoon · resto evening`) y
// **NO es exclusivo del Blacksmith**: lo llevan **17 de las 28** variantes del pool. Pero las
// bandas del `@` **NO coinciden** con las bandas de horario del NPC, así que un testigo
// **acota** y sólo **adjudica la planta** si su banda **no interseca las dos**. Hay que
// calcular la intersección, no leer la palabra.
// ★ NO SE TRANSCRIBE: se DERIVA llamando a `partOfDayWord` del port hora a hora. Una tabla
// copiada a mano aquí es una regla en dos sitios, y un mutante que le corriera la frontera una
// hora (`afternoon: [12,18]`) SOBREVIVÍA a todos los controles — el control leía el fuente pero
// nunca ataba el fuente a la tabla. Derivándola, ese mutante deja de ser expresable.
export const BANDA_AT = (() => {
  const b = {};
  for (let h = 0; h < 24; h++) {
    const w = partOfDayWord(h);
    b[w] = b[w] ? [Math.min(b[w][0], h), Math.max(b[w][1], h)] : [h, h];
  }
  return b;
})();

/** Plantilla del Blacksmith (SHOPPES 0x12b2, DS 0x8018) — vía propia, FUERA del pool. */
export const PLANTILLA_HERRERO = "Good @, and welcome to #!";

/** `SHOPPE_GREETING_INDEX` de `src/core/shops/shoppe-greetings.ts:36`. El Blacksmith NO está. */
export const POOL_INDEX = {
  Barkeeper: [57, 58, 59, 60],
  HorseSeller: [92, 93, 94, 95],
  Shipwright: [105, 106, 107, 108],
  MagicSeller: [127, 128, 129, 130],
  GuildMaster: [148, 149, 150, 151],
  Healer: [165, 166, 167, 168],
  InnKeeper: [174, 175, 176, 177],
};

/** Normaliza para OCR: minúsculas y **se comen** los no-alfanuméricos SIN partir la palabra
 *  (`we[come → wecome`, `Jol]y → joly`, `Iolo/s → iolos`). Partirla en dos —que es lo que hace
 *  un `replace(/[^a-z ]/g," ")`— destruiría justo la palabra que el OCR ensució. */
const norm = (s) => String(s).toLowerCase().replace(/[^a-z0-9\s]+/g, "").replace(/\s+/g, " ").trim();
const palabras = (s) => norm(s).split(" ").filter(Boolean);

/** ¿Misma palabra salvo UN carácter (sustitución, inserción o borrado)? Ruido típico del OCR.
 *  Las palabras de menos de 4 letras exigen igualdad exacta: con 3 letras, «distancia 1» empareja
 *  cualquier cosa con cualquier cosa. */
export function casiIgual(a, b) {
  if (a === b) return true;
  if (a.length < 4 || b.length < 4) return false;
  const [s, l] = a.length <= b.length ? [a, b] : [b, a];
  if (l.length - s.length > 1) return false;
  let i = 0, j = 0, d = 0;
  while (i < s.length && j < l.length) {
    if (s[i] === l[j]) { i++; j++; continue; }
    if (++d > 1) return false;
    if (s.length === l.length) { i++; j++; } else j++;
  }
  return d + (l.length - j) <= 1;
}

/** ★ PUNTUACIÓN de una plantilla contra un texto de OCR.
 *
 *  Se parte la plantilla por los marcadores (`@ $ #` — los huecos: parte del día, tendero,
 *  tienda) y se empareja **en ORDEN** su lista de palabras literales contra las del OCR.
 *
 *  `puntos = caracteres ACERTADOS − caracteres de las palabras SALTADAS DENTRO DEL TRAMO`.
 *  El castigo se limita al tramo emparejado a propósito: los `expect[].text` del corpus vienen
 *  **truncados** a mitad de frase, y castigar la cola convertiría cada truncamiento en un fallo
 *  ([[fragmento-truncado-acusa-en-falso]]). Sólo cuentan palabras de ≥3 letras: `to`, `i`, `am`
 *  aparecen en todas las plantillas y no discriminan nada. */
export function puntuaPlantilla(txt, plantilla) {
  const tpl = plantilla.split(/[@$#]/).flatMap(palabras);
  const ocr = palabras(txt);
  const vale = (w) => w.length >= 3;
  let j = 0, acierto = 0, ultimo = -1;
  const estado = tpl.map((w, k) => {
    for (let q = j; q < ocr.length; q++) {
      if (casiIgual(w, ocr[q])) { j = q + 1; ultimo = k; if (vale(w)) acierto += w.length; return true; }
    }
    return false;
  });
  let castigo = 0;
  for (let k = 0; k < ultimo; k++) if (!estado[k] && vale(tpl[k])) castigo += tpl[k].length;
  return { puntos: acierto - castigo, acierto, castigo };
}

/** Puntuación mínima para dar por CORROBORADO el tipo de tienda. Tres palabras sustanciales.
 *  ⚠ Es un umbral, o sea un juicio — por eso este canal es **corroboración y no adjudicación**:
 *  quién es el mercader lo fija el **op de ancla** del corpus (`anchor.match`), que es
 *  estructural. Ver `testigosDelSegmento`. */
export const MIN_PUNTOS = 12;

/** Testigo horario de un texto de OCR: la parte del día (que es lo que ACOTA) y, si se puede,
 *  el tipo de tienda CORROBORADO por la plantilla.
 *
 *  🔴 El tipo NO se decide por «la primera plantilla que case»: la del Blacksmith
 *  (`"Good @, and welcome to #!"`) está **contenida** en la del GuildMaster 148
 *  (`"Good @, matey, and welcome to #!"`), así que el primer-que-case llamaba Blacksmith al
 *  GuildMaster de Paws. Se puntúan **las 18** y gana la mejor; si la segunda mejor de **otro
 *  tipo** empata, se declara AMBIGUO en vez de elegir. */
export function testigoHorario(txt, shoppe) {
  const m = /\b(morning|afternoon|evening)\b/i.exec(String(txt));
  if (!m) return null;
  const parte = m[1].toLowerCase();
  const cands = [{ tipo: "Blacksmith", via: "plantilla propia 0x12b2", pl: PLANTILLA_HERRERO }];
  for (const [tipo, idx] of Object.entries(POOL_INDEX)) {
    for (const i of idx) if (String(shoppe[i]).includes("@")) cands.push({ tipo, via: `pool variante ${i}`, pl: shoppe[i] });
  }
  const puntuados = cands
    .map((c) => ({ ...c, ...puntuaPlantilla(txt, c.pl) }))
    .sort((a, b) => b.puntos - a.puntos);
  const top = puntuados[0];
  if (!top || top.puntos < MIN_PUNTOS) return { parte, tipo: null, motivo: "sin corroborar (puntuación por debajo del mínimo — típicamente un fragmento truncado)", puntos: top ? top.puntos : 0 };
  const rival = puntuados.find((c) => c.tipo !== top.tipo);
  if (rival && rival.puntos >= top.puntos) return { parte, tipo: null, motivo: `AMBIGUO entre ${top.tipo} y ${rival.tipo} (${top.puntos} vs ${rival.puntos})`, puntos: top.puntos };
  return { parte, tipo: top.tipo, via: top.via, puntos: top.puntos, margenRival: rival ? top.puntos - rival.puntos : null };
}

/** ★ EL CÁLCULO. Interseca la banda del testigo con las horas del NPC en cada planta.
 *  - `adjudica: z` → la banda SÓLO cabe en esa planta ⇒ el testigo SÍ decide.
 *  - `adjudica: null` → cabe en las dos ⇒ **acota pero no discrimina** (el caso de `fa3` §5). */
export function interseca(npc, parte) {
  const [a, b] = BANDA_AT[parte];
  const porPlanta = {};
  for (let h = a; h <= b; h++) (porPlanta[celdaA(npc, h).z] ??= []).push(h);
  const zs = Object.keys(porPlanta).map(Number);
  return { banda: `${String(a).padStart(2, "0")}:00-${String(b).padStart(2, "0")}:59`, porPlanta, adjudica: zs.length === 1 ? zs[0] : null };
}

// ── CORPUS ───────────────────────────────────────────────────────────────────────────────

export function cargarRuta(ruta) {
  return JSON.parse(readFileSync(join(TOUR, `${ruta}.route.json`), "utf8"));
}

/** Anclas de mercader de un segmento, del propio corpus (`script[].anchor.match`). **Esto es lo
 *  estructural**: dice qué mercader ancla el segmento sin pasar por ningún reconocedor de texto. */
export function anclasDelSegmento(seg) {
  const out = [];
  for (const op of seg.script || []) {
    const mt = op.anchor && op.anchor.match;
    if (typeof mt === "string" && mt.startsWith("shop:")) out.push({ tipo: mt.slice(5), ocrLn: op.ocrLn, key: op.key });
  }
  return out;
}

/** Bloques del segmento que llevan parte del día, con su testigo. */
export function testigosDelSegmento(seg, shoppe) {
  const out = [];
  for (const e of seg.expect || []) {
    const t = testigoHorario(e.text, shoppe);
    if (t) out.push({ ocrLn: e.ocrLn, texto: String(e.text).replace(/\s+/g, " ").trim(), ...t });
  }
  return out;
}

// ── CONTROL ──────────────────────────────────────────────────────────────────────────────
//
// Las 9 líneas de OCR con parte del día de los cinco sellos, con el tipo que el reconocedor
// DEBE dar. `null` = debe declararse SIN CORROBORAR (fragmento truncado), que es un resultado
// legítimo y no un fallo. Sin los casos `null` y sin `ad21-g26`, un reconocedor que dijera
// «Blacksmith» a todo pasaría el control ([[control-verde-sin-dientes]]).
const CONTROL_OCR = [
  ["ad06-g34", 4993, "afternoon", "Healer"],
  ["ad06-g34", 5089, "afternoon", "Blacksmith"],
  ["ad06-g34", 5249, "afternoon", null],
  ["ad09-g04", 214, "afternoon", "Blacksmith"],
  ["ad21-g26", 4975, "afternoon", "GuildMaster"], // 🔴 la que la v1 llamaba Blacksmith
  ["part04-g03", 1056, "morning", "Blacksmith"],
  ["part04-g03", 1744, "afternoon", "Barkeeper"],
  ["part05-g05", 500, "morning", "GuildMaster"],
  ["part05-g05", 607, "morning", null],
];

export function control() {
  // (1) el mapa dlg→tipo sigue siendo el del port
  const src = readFileSync(join(RAIZ, "game", "src", "main.ts"), "utf8");
  for (const [dlg, tipo] of Object.entries(SHOP_TYPES)) {
    const hex = `0x${Number(dlg).toString(16)}: "${tipo}"`;
    if (!src.includes(hex)) throw new Error(`🔴 CONTROL: SHOP_TYPES ha cambiado en src/main.ts — falta \`${hex}\`. El mapa de esta herramienta ya NO es el del port.`);
  }
  // (2) las bandas del `@` DERIVADAS del port siguen siendo las tres esperadas, y son
  //     CONTIGUAS y EXHAUSTIVAS sobre las 24 h. Si el port cambiara la regla, esto lo dice
  //     con la banda nueva delante en vez de dejar pasar una tabla rancia.
  const esperado = { morning: [0, 11], afternoon: [12, 17], evening: [18, 23] };
  for (const [k, [a, b]] of Object.entries(esperado)) {
    const v = BANDA_AT[k];
    if (!v || v[0] !== a || v[1] !== b) throw new Error(`🔴 CONTROL: la banda «${k}» derivada de partOfDayWord es [${v}] y se esperaba [${a},${b}]. El port ha cambiado la regla del \`@\`.`);
  }
  for (let h = 0; h < 24; h++) {
    const [a, b] = BANDA_AT[partOfDayWord(h)];
    if (h < a || h > b) throw new Error(`🔴 CONTROL: la hora ${h} no cae en su propia banda derivada.`);
  }
  // (3) la frontera del herrero de Minoc contra la hora MEDIDA de ad06-g34.
  //     ★ La hora se lee de `RELOJ_ANCLA`, NO de un 19 escrito aquí: si alguien mueve esa
  //     constante (que es el dato del acta) el control tiene que enterarse. Con un 19 literal,
  //     mover `RELOJ_ANCLA` a las 17:00 no rompía nada y el margen publicado salía falso.
  const rel06 = RELOJ_ANCLA["ad06-g34"];
  if (!rel06 || rel06.hora !== 19 || rel06.minuto !== 2) throw new Error(`🔴 CONTROL: RELOJ_ANCLA['ad06-g34'] debería ser 19:02 (SONDA-ANCLA de ad06-reloj-acta.md §1) y es ${rel06 ? `${rel06.hora}:${rel06.minuto}` : "inexistente"}.`);
  const h = mercaderes(5, "Blacksmith");
  if (h.length !== 1) throw new Error(`🔴 CONTROL: Minoc debería tener 1 Blacksmith y tiene ${h.length}`);
  const fr = fronteras(h[0]).map((f) => f.hora);
  if (!fr.includes(18)) throw new Error(`🔴 CONTROL: el herrero de Minoc debería tener frontera a las 18:00 y sus fronteras son [${fr}]`);
  if (celdaA(h[0], rel06.hora).z !== 1) throw new Error(`🔴 CONTROL: a las ${rel06.hora}:00 el herrero de Minoc debería estar en z1 (hora MEDIDA del ancla de ad06-g34) y está en z${celdaA(h[0], rel06.hora).z}`);
  // …y el Healer, en ESE MISMO instante, en z0. Es el control que hace falsable al anterior:
  // una lectura de planta que dijera z1 para todos no probaría nada (ad06-reloj-acta §1 P3).
  if (celdaA(mercaderes(5, "Healer")[0], rel06.hora).z !== 0) throw new Error("🔴 CONTROL: a las 19:00 el Healer de Minoc debería estar en z0 — mismo instante, planta distinta.");

  // (4) ★ EL CONTROL DEL TESTIGO — el caso que hizo falsa la primera enmienda de `fa3` §5.
  const shoppe = JSON.parse(readFileSync(join(RAIZ, "game", "assets", "shoppe.json"), "utf8"));
  const healer = mercaderes(5, "Healer")[0];
  if (!String(shoppe[168]).includes("@")) throw new Error("🔴 CONTROL: la variante 168 del Healer debería llevar `@`");
  const conAt = Object.values(POOL_INDEX).flat().filter((i) => String(shoppe[i]).includes("@")).length;
  if (conAt !== 17) throw new Error(`🔴 CONTROL: el pool debería tener 17 variantes con \`@\` y tiene ${conAt}`);
  // (4a) «morning» sobre el Healer de Minoc NO adjudica: cabe en las dos plantas.
  if (interseca(healer, "morning").adjudica !== null) throw new Error("🔴 CONTROL: «morning» sobre el Healer de Minoc NO debería adjudicar planta");
  // (4b) …y «afternoon» SÍ: cae entera en z0. Sin este par, un `adjudica` que devolviera
  //      siempre null pasaría (4a) sin tener dientes.
  if (interseca(healer, "afternoon").adjudica !== 0) throw new Error("🔴 CONTROL: «afternoon» sobre el Healer de Minoc debería adjudicar z0");

  // (4c) ★ La rama de AMBIGÜEDAD, con un caso SINTÉTICO — porque en las 9 líneas reales no hay
  //      ningún empate, así que quitar esa rama NO rompía ningún control: era un seguro sin
  //      caso vivo ([[seguro-sin-caso-vivo-mutante-que-no-mata]]). Se le da uno: dos tipos con
  //      la MISMA plantilla y un texto que casa ⇒ tiene que declarar AMBIGUO, no elegir.
  const falso = { ...shoppe };
  falso[57] = "A fine @ to thee, stranger! I am $, keeper of #."; // Barkeeper
  falso[92] = "A fine @ to thee, stranger! I am $, keeper of #."; // HorseSeller, idéntica
  const amb = testigoHorario("A fine morning to thee, stranger! I am Bob, keeper of The Inn.", falso);
  if (amb.tipo !== null || !String(amb.motivo).startsWith("AMBIGUO")) throw new Error(`🔴 CONTROL: dos tipos con la MISMA plantilla deberían dar AMBIGUO y dan ${amb.tipo} (${amb.motivo ?? "sin motivo"}).`);

  // (5) ★ EL RECONOCEDOR, contra las 9 líneas REALES del corpus.
  const porSeg = new Map(SELLOS.map((s) => [s.seg, cargarRuta(s.ruta).segments.find((x) => x.id === s.seg)]));

  // (5a) …y las ANCLAS que el censo va a leer son exactamente las esperadas. Sin esto, aflojar
  //      el filtro `shop:` de `anclasDelSegmento` no rompía nada (mutante equivalente en esta
  //      población) y el censo podría cambiar de denominador en silencio.
  const ANCLAS_ESPERADAS = {
    "ad06-g34": "Healer@4993,Blacksmith@5088,Blacksmith@5089,Healer@5243",
    "ad09-g04": "Blacksmith@213",
    "ad21-g26": "GuildMaster@4858,InnKeeper@4888,GuildMaster@4975",
    "part04-g03": "Blacksmith@1070",
    "part05-g05": "GuildMaster@500,Barkeeper@601,GuildMaster@509",
  };
  for (const [seg, esp] of Object.entries(ANCLAS_ESPERADAS)) {
    const vivo = anclasDelSegmento(porSeg.get(seg)).map((a) => `${a.tipo}@${a.ocrLn}`).join(",");
    if (vivo !== esp) throw new Error(`🔴 CONTROL: las anclas de mercader de ${seg} son [${vivo}] y se esperaban [${esp}]. El corpus cambió o el lector de anclas se aflojó.`);
  }
  for (const [seg, ocrLn, parte, tipo] of CONTROL_OCR) {
    const s = porSeg.get(seg);
    if (!s) throw new Error(`🔴 CONTROL: no encuentro el segmento ${seg}`);
    const e = (s.expect || []).find((x) => x.ocrLn === ocrLn);
    if (!e) throw new Error(`🔴 CONTROL: ${seg} ya no trae el bloque ocrLn ${ocrLn}`);
    const t = testigoHorario(e.text, shoppe);
    if (!t) throw new Error(`🔴 CONTROL: ${seg}/${ocrLn} debería dar testigo «${parte}» y da null`);
    if (t.parte !== parte) throw new Error(`🔴 CONTROL: ${seg}/${ocrLn} debería dar «${parte}» y da «${t.parte}»`);
    if ((t.tipo ?? null) !== tipo) throw new Error(`🔴 CONTROL: ${seg}/${ocrLn} debería corroborar ${tipo ?? "SIN TIPO"} y da ${t.tipo ?? "SIN TIPO"} (puntos ${t.puntos})`);
  }
  return true;
}

// ── SALIDA ───────────────────────────────────────────────────────────────────────────────

const fmtFr = (fr) => (fr.length === 0 ? "SIN frontera de planta (siempre en la misma)" : fr.map((f) => `${String(f.hora).padStart(2, "0")}:00 z${f.de}→z${f.a}`).join(" · "));

function main(argv) {
  control();
  const shoppe = JSON.parse(readFileSync(join(RAIZ, "game", "assets", "shoppe.json"), "utf8"));
  console.log("# FRONTERAS DE PLANTA y TESTIGO HORARIO — los CINCO deltas de ledger SELLADOS");
  console.log("# schedule_index NPC.OVL:0x12E0 vía src/core/time.ts · SHOP_TYPES src/main.ts:2279");
  console.log("# partOfDayWord SHOPPES 0x00d8 vía shoppe-greetings.ts:438 · pool 0x005b · herrero 0x12b2\n");

  let conFrontera = 0, total = 0, adjudicados = 0;
  for (const s of SELLOS) {
    const ruta = cargarRuta(s.ruta);
    const seg = ruta.segments.find((x) => x.id === s.seg);
    const anclas = anclasDelSegmento(seg);
    const tst = testigosDelSegmento(seg, shoppe);
    const reloj = RELOJ_ANCLA[s.seg];
    console.log(`## ${s.seg}  (delta ${s.delta > 0 ? "+" : ""}${s.delta})  —  loc ${s.loc} ${s.sitio}`);

    const tipos = [...new Set(anclas.map((a) => a.tipo))];
    for (const tipo of tipos) {
      const ms = mercaderes(s.loc, tipo);
      if (ms.length === 0) { console.log(`   ${tipo.padEnd(12)} 🔴 NINGÚN NPC de ese tipo en loc ${s.loc}`); continue; }
      for (const n of ms) {
        total++;
        const fr = fronteras(n);
        if (fr.length) conFrontera++;
        const lns = anclas.filter((a) => a.tipo === tipo).map((a) => a.ocrLn).join(",");
        console.log(`   ${tipo.padEnd(12)} slot ${String(n.slot).padStart(2)} dlg 0x${n.dialogNumber.toString(16)}  ancla@ocrLn ${lns}`);
        console.log(`   ${"".padEnd(12)}   ${fr.length ? "★ " : "  "}${fmtFr(fr)}`);
        console.log(`   ${"".padEnd(12)}   00..23  ${plantas(n).map((v) => `z${v}`).join(" ")}`);

        // el testigo del corpus MÁS CERCANO a un ancla de este tipo
        const propios = tst.filter((t) => t.tipo === tipo || anclas.some((a) => a.tipo === tipo && Math.abs(a.ocrLn - t.ocrLn) <= 20));
        if (propios.length === 0) { console.log(`   ${"".padEnd(12)}   testigo: NINGUNO en el segmento`); }
        let adjudicadoAqui = false;
        for (const t of propios) {
          const iv = interseca(n, t.parte);
          const corr = t.tipo ? `plantilla ${t.tipo} (${t.via}, ${t.puntos} pts)` : `SIN corroborar — ${t.motivo}`;
          console.log(`   ${"".padEnd(12)}   testigo ocrLn ${t.ocrLn}: «${t.parte}» ⇒ banda ${iv.banda} · ${corr}`);
          const rep = Object.entries(iv.porPlanta).map(([z, hs]) => `z${z}:${hs.length}h`).join(" + ");
          if (iv.adjudica === null) {
            console.log(`   ${"".padEnd(12)}     → NO ADJUDICA planta (la banda cae en ${rep}) — ACOTA: excluye el resto del día`);
          } else if (fr.length === 0) {
            // Sin frontera hay UNA sola planta en las 24 h: «adjudicar» aquí no es mérito del
            // testigo, es que no había nada que decidir. Decirlo evita contar como discriminación
            // lo que es una tautología ([[control-positivo-caso-degenerado]]).
            console.log(`   ${"".padEnd(12)}     → adjudica z${iv.adjudica} TRIVIALMENTE (el mercader no tiene otra planta en todo el día)`);
          } else {
            adjudicadoAqui = true;
            console.log(`   ${"".padEnd(12)}     → ★ ADJUDICA z${iv.adjudica} NO trivialmente (la banda cae ENTERA en ${rep}, y el mercader SÍ cambia de planta)`);
          }
        }
        if (adjudicadoAqui) adjudicados++;

        if (fr.length === 0) {
          console.log(`   ${"".padEnd(12)}   margen: NO APLICA — sin frontera, ningún reloj puede cambiarle la planta`);
        } else if (!reloj) {
          console.log(`   ${"".padEnd(12)}   margen: 🔴 NO CALCULADO, FALTA EL RELOJ del instante del ancla.`);
          console.log(`   ${"".padEnd(12)}     receta: correr esta parte con \`re/tools/sonda_reloj_espejo.py\` (o`);
          console.log(`   ${"".padEnd(12)}     \`U5_ESPEJO_SONDA_ANCLA=1\`, que ya imprime \`reloj HH:MM\` y \`planta\`) y leer`);
          console.log(`   ${"".padEnd(12)}     la hora en el ancla ocrLn ${lns}. UNA corrida de la parte.`);
        } else {
          const mg = margen(n, reloj.hora);
          const hhmm = `${String(reloj.hora).padStart(2, "0")}:${String(reloj.minuto).padStart(2, "0")}`;
          console.log(`   ${"".padEnd(12)}   margen @${hhmm} (MEDIDO, ${reloj.fuente}):`);
          console.log(`   ${"".padEnd(12)}     frontera anterior hace ${mg.atras} h · siguiente dentro de ${mg.delante} h · planta z${celdaA(n, reloj.hora).z}`);
        }
      }
    }
    // Testigos del segmento que NO se ataron a ningún ancla: no fijan la planta de un mercader,
    // pero acotan el RELOJ del tramo — y si dos de ellos dan bandas disjuntas, el segmento
    // CRUZA una frontera de banda, que es un dato del LP que no está en ningún otro sitio.
    const atados = new Set();
    for (const tipo of tipos) for (const t of tst) if (t.tipo === tipo || anclas.some((a) => a.tipo === tipo && Math.abs(a.ocrLn - t.ocrLn) <= 20)) atados.add(t.ocrLn);
    const sueltos = tst.filter((t) => !atados.has(t.ocrLn));
    if (sueltos.length) {
      console.log(`   ${"otros".padEnd(12)} testigos del segmento SIN ancla propia (acotan el reloj del tramo):`);
      for (const t of sueltos) console.log(`   ${"".padEnd(12)}   ocrLn ${t.ocrLn}: «${t.parte}» ${t.tipo ? `· plantilla ${t.tipo}` : `· ${t.motivo}`}`);
    }
    const bandas = [...new Set(tst.map((t) => t.parte))];
    if (bandas.length > 1) console.log(`   ${"⚠".padEnd(12)} el segmento trae DOS bandas distintas (${bandas.join(", ")}) ⇒ el tramo CRUZA una frontera de banda del \`@\``);
    console.log("");
  }
  console.log(`## CENSO: ${conFrontera} de ${total} mercaderes anclados en los cinco sellos TIENEN frontera de planta.`);
  console.log(`##        ${adjudicados} de esos ${conFrontera} tienen además un testigo del corpus que ADJUDICA la planta NO trivialmente.`);

  if (argv.includes("--todos")) {
    console.log("\n# CENSO ANCHO: todos los NPC de tipo tienda del juego (la TASA BASE)");
    let cf = 0, ct = 0;
    const porTipo = {};
    for (let loc = 1; loc <= 32; loc++) {
      let l; try { l = cargarLoc(loc); } catch { continue; }
      for (const n of l) {
        const tipo = SHOP_TYPES[n.dialogNumber];
        if (!tipo) continue;
        ct++;
        const tiene = fronteras(n).length > 0;
        if (tiene) cf++;
        porTipo[tipo] ??= { con: 0, tot: 0 };
        porTipo[tipo].tot++;
        if (tiene) porTipo[tipo].con++;
      }
    }
    console.log(`  ${cf} de ${ct} mercaderes del juego (${Math.round((100 * cf) / ct)} %) tienen frontera de planta.`);
    for (const [t, v] of Object.entries(porTipo).sort()) console.log(`    ${t.padEnd(12)} ${v.con}/${v.tot}`);
    console.log(`  ⇒ los sellos dan ${conFrontera}/${total}; la tasa base es ${cf}/${ct}. NO hay enriquecimiento.`);
  }

  if (argv.includes("--corpus")) {
    console.log("\n# INSTRUMENTAL HORARIO DEL CORPUS: bloques con parte del día, por vía");
    let herrero = 0, pool = 0, sin = 0;
    const dirs = [["routes-ad", /^ad\d+\.route\.json$/], ["routes", /^part\d+\.route\.json$/]];
    for (const [d, re] of dirs) {
      for (const f of readdirSync(join(TOUR, d)).filter((x) => re.test(x)).sort()) {
        const r = JSON.parse(readFileSync(join(TOUR, d, f), "utf8"));
        for (const s of r.segments || []) for (const e of s.expect || []) {
          const t = testigoHorario(e.text, shoppe);
          if (!t) continue;
          if (t.tipo === "Blacksmith") herrero++; else if (t.tipo) pool++; else sin++;
        }
      }
    }
    console.log(`  vía propia del Blacksmith (0x12b2) : ${herrero}`);
    console.log(`  pool de tienda (17 variantes con @): ${pool}`);
    console.log(`  con parte del día, sin corroborar  : ${sin}   (fragmentos truncados y ecos)`);
    console.log(`  TOTAL de bloques con parte del día : ${herrero + pool + sin}`);
  }
}

if (process.argv[1] && process.argv[1].endsWith("fronteras_sellos.mjs")) main(process.argv.slice(2));
