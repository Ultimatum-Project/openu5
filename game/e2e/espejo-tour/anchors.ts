/**
 * WALKTHROUGH-ESPEJO — ANCLAS DE POSICIÓN POR-INTERACCIÓN (Fase C).
 *
 * PROBLEMA (diagnóstico de Fase B): el replay-por-inputs se desincroniza desde el primer
 * segmento — el RNG de combates/encuentros del port difiere del LP, así que los comandos
 * DIRECCIONALES del guion ((L)ook/(S)earch/(G)et/peajes/compras) pisan CELDAS distintas a
 * las del LP. La deriva de posición congela el ledger (las transacciones no disparan bajo
 * deriva) y hunde la conformidad. El careo por-escena (Fase 2) NO ve esto; el replay sí.
 *
 * PALANCA (Fase C): RESYNC DE POSICIÓN POR-INTERACCIÓN. Antes de cada interacción con
 * ANCLA derivable, si la posición viva ≠ ancla, se teletransporta a la celda del ancla por
 * la costura sancionada cero-rand del arnés (`__u5debug.teleportSmallMap`, misma clase que
 * `goToLocation`/`teleportOverworld`). Así la interacción REAL cae en la celda correcta y el
 * ledger cobra vida. La DERIVA (distancia del salto) es una métrica nueva; lo que quede
 * DIVERGENTE tras el resync es candidato REAL a bug del port.
 *
 * ANCLA DE CARA (`face`): un beat (L)ook-DIR con resultado «...ves <feature>» es INVERTIBLE
 * contra el mapa vivo — la party estaba en la celda cuyo vecino-DIR es el tile de <feature>.
 * La inversión usa LOOK2.DAT (`assets/look2.json`, tile→frase, la MISMA fuente que
 * `game.data.look2`/`describeTile`): frase → ids de tile → celdas candidatas del grid vivo.
 * Los ids se PRECALCULAN offline (derive-anchors.mjs) y viajan en el `anchor` del op; en
 * runtime sólo se escanea el grid. La derivación offline vive en tools/derive-anchors.mjs
 * (fuente única, unit-testeada); ESTE módulo es la RESOLUCIÓN pura en runtime (celda + salto),
 * también unit-testeada, sin tocar Playwright.
 *
 * Ambigüedad: una frase puede mapear a varias celdas vivas (p.ej. dos antorchas). Se resuelve
 * por CERCANÍA a la posición actual (la deriva es incremental, no teletransportes largos) y
 * se declina el resync si hay demasiadas candidatas (`maxCandidates`) — ambiguo se REPORTA,
 * no se adivina. Cero candidatas = «anchor-miss»: la feature del LP no está donde el port la
 * pinta → señal de divergencia real (a investigar, no a fabricar).
 */

/** Direcciones cardinales del juego (las 4 flechas). */
export type Dir4 = "north" | "south" | "east" | "west";

/** Delta (dx,dy) del vecino en cada dirección (y crece hacia abajo, como el grid). */
export const ANCHOR_DELTA: Record<Dir4, [number, number]> = {
  north: [0, -1],
  south: [0, 1],
  east: [1, 0],
  west: [-1, 0],
};

/** Tecla-flecha → dirección del juego (espejo del ARROW map del runner). */
export const ARROW_TO_DIR: Record<string, Dir4> = {
  ArrowUp: "north",
  ArrowDown: "south",
  ArrowLeft: "west",
  ArrowRight: "east",
};

/**
 * Ancla de CARA: la party miró en `dir` y vio `sees`; su celda es la que tiene un vecino-`dir`
 * cuyo tile ∈ `tileIds` (inversión de LOOK2 precalculada offline). `cmd` conserva el comando
 * origen ((l)ook) por si en el futuro se derivan (s)earch/(g)et sobre el mismo feature.
 */
export interface FaceAnchor {
  kind: "face";
  cmd: string;
  dir: Dir4;
  sees: string;
  tileIds: number[];
  /** Banda horaria del beat del LP (derivable del OCR: reloj del panel o día/noche del
   *  contexto). Una feature hora-dependiente (verja nocturna 0x99 vs suelo 0x44) sólo casa
   *  contra el grid COMPUESTO si el reloj está en su banda; el runner reconcilia el reloj a
   *  esta banda antes de resolver (evita el falso anchor-miss por DERIVA DE RELOJ). Ausente
   *  = feature hora-INdependiente (mesa, barril): casa en cualquier banda. */
  hourBand?: HourBand;
  ocrLn?: number;
}

/** Banda de la reja/puente nocturno (TOWN 0x0170): 20:00-4:59 = NOCHE (verja cerrada,
 *  portcullis 0x99); resto = DÍA (0x44 suelo). El activeMap.tileAt COMPUESTO pinta el tile
 *  de la banda del reloj ACTUAL — de ahí que el ancla lleve la banda del LP y el runner
 *  reconcilie. (El sapo-Yew de Fase B fue un falso positivo: el portcullis es verja-nocturna
 *  FIEL, no un bug — por eso las anclas de esa franja DEBEN ser conscientes de hora.) */
export type HourBand = "day" | "night";
export function hourToBand(hour: number): HourBand {
  return hour >= 20 || hour < 5 ? "night" : "day";
}
/** ¿El reloj vivo casa la banda del ancla? (Sin banda = siempre casa: feature hora-indep.) */
export function bandMatches(gameHour: number, anchor: { hourBand?: HourBand }): boolean {
  return anchor.hourBand == null || hourToBand(gameHour) === anchor.hourBand;
}
/** Hora canónica representativa de una banda, para que el runner nudge el reloj (sancionado,
 *  misma clase que entryClock) antes de resolver un ancla hora-dependiente. */
export function bandCanonicalHour(band: HourBand): number {
  return band === "night" ? 22 : 12;
}

/**
 * Ancla de NPC/TRANSACCIÓN: un beat de transacción (peaje, compra) requiere estar ADYACENTE
 * a un NPC (guardia de peaje, mercader). El grid estático NO lleva NPCs — viven en la capa
 * viva — así que el runner consulta las celdas de NPC vivas y resincroniza la party a la
 * celda PISABLE adyacente al NPC que casa `match`. Con ella los beats de transacción DISPARAN
 * y el ledger (oro/llaves/gemas) cobra vida. GEMELA de T-JOIN-REAL. La derivación marca el
 * beat (p.ej. «demand a 24 gp toll» → match:"troll"); la RESOLUCIÓN (aquí) es pura.
 */
/** Tabla dialogNumber(0x81-0x88) → TIPO de mercader del port (main.ts SHOP_TYPES). Un mercader
 *  abre su tienda por conversación según su dialogNumber; el TIPO es estable por CIUDAD y por rol
 *  (guild, tabernero…), a diferencia de un dialogNumber concreto que se adivina mal (d130 en New
 *  Magincia NO es el guild sino la TABERNERA Felicity; el guild Braunam es d134/GuildMaster). */
export const SHOP_TYPE_BY_DIALOG: Record<number, string> = {
  0x81: "Blacksmith",
  0x82: "Barkeeper",
  0x83: "HorseSeller",
  0x84: "Shipwright",
  0x85: "MagicSeller",
  0x86: "GuildMaster",
  0x87: "Healer",
  0x88: "InnKeeper",
};
/** Tipo de mercader de un NPC por su dialogNumber, o undefined si no es mercader. */
export function shopTypeOf(dialogNumber: number | undefined): string | undefined {
  return dialogNumber == null ? undefined : SHOP_TYPE_BY_DIALOG[dialogNumber];
}

export interface NpcAnchor {
  kind: "npc";
  cmd: string; // comando origen del beat (t/talk, o el disparo de peaje)
  /** Criterio de identidad del NPC (case-insensitive):
   *   · `"shop:<ShopType>"` (PREFERIDO para mercaderes) — casa por TIPO de tienda vía
   *     `shopTypeOf(dialogNumber)`. Robusto y city-independiente: el beat del OCR nombra el
   *     rol/wares del mercader (guild/gems → `shop:GuildMaster`), NO un dialogNumber frágil.
   *   · `"d<N>"` — dialogNumber exacto (guardias de peaje, o mercaderes sin ambigüedad de tipo).
   *   · substring — contra name/type. */
  match: string;
  /** DELTA de oro esperado de esta transacción (con signo: -954 gemas, +36 venta). El ledger
   *  del espejo compara el DELTA por transacción anclada (comparable), NO el balance corrido
   *  (no-comparable: el loot RNG lo hace inalcanzable). El runner captura oro antes/después. */
  expectDelta?: number;
  ocrLn?: number;
}

/** Union de tipos de ancla (extensible: sign/entry en ventanas futuras). */
export type Anchor = FaceAnchor | NpcAnchor;

/** NPC vivo mínimo para la resolución (celda + identidad + floor para el resync multi-planta). */
export interface NpcLive {
  x: number;
  y: number;
  name?: string;
  type?: string;
  dialogNumber?: number; // para casar por shopType (shop:<type>)
  floor?: number; // planta viva del NPC (el resync teleporta a ella; guild en f1, etc.)
}

/** Instantánea mínima del mapa activo para la resolución (rejilla de tile-ids). */
export interface GridSnapshot {
  W: number;
  H: number;
  grid: number[][];
}

/** Posición 2D en el small map. */
export interface Cell {
  x: number;
  y: number;
}

const manhattan = (a: Cell, b: Cell): number => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);

/**
 * Celdas del grid cuyo vecino-`dir` tiene un tile ∈ `tileIds` y (si se pasa `standable`) que
 * son PISABLES por la party (no se puede resync a un muro). Puro: escaneo O(W·H).
 */
export function faceCandidates(
  snap: GridSnapshot,
  tileIds: readonly number[],
  dir: Dir4,
  standable?: (tile: number) => boolean,
): Cell[] {
  const want = new Set(tileIds);
  const [dx, dy] = ANCHOR_DELTA[dir];
  const out: Cell[] = [];
  for (let y = 0; y < snap.H; y++) {
    const row = snap.grid[y];
    if (!row) continue;
    for (let x = 0; x < snap.W; x++) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= snap.W || ny >= snap.H) continue;
      const neighbor = snap.grid[ny]?.[nx];
      if (neighbor === undefined || !want.has(neighbor)) continue;
      if (standable && !standable(row[x]!)) continue;
      out.push({ x, y });
    }
  }
  return out;
}

export type FaceResolveStatus = "resolved" | "miss" | "ambiguous";

export interface FaceResolution {
  status: FaceResolveStatus;
  cell?: Cell;
  drift?: number;
  candidates: number;
}

/**
 * Resuelve un ancla de cara contra el grid vivo desde `from`:
 *   · 0 candidatas → `miss` (la feature del LP no está → divergencia real a investigar).
 *   · > maxCandidates → `ambiguous` (se declina el resync, se reporta; no se adivina).
 *   · si no → `resolved` a la candidata MÁS CERCANA a `from` (la deriva es incremental),
 *     con la `drift` (distancia Manhattan del salto) para el histograma.
 * Determinista: desempata por orden de escaneo (fila, luego columna).
 */
export function resolveFaceAnchor(
  snap: GridSnapshot,
  anchor: FaceAnchor,
  from: Cell,
  opts: { maxCandidates?: number; standable?: (tile: number) => boolean } = {},
): FaceResolution {
  const maxCandidates = opts.maxCandidates ?? 4;
  const cands = faceCandidates(snap, anchor.tileIds, anchor.dir, opts.standable);
  if (cands.length === 0) return { status: "miss", candidates: 0 };
  if (cands.length > maxCandidates) return { status: "ambiguous", candidates: cands.length };
  let best = cands[0]!;
  let bestD = manhattan(from, best);
  for (const c of cands.slice(1)) {
    const d = manhattan(from, c);
    if (d < bestD) {
      best = c;
      bestD = d;
    }
  }
  return { status: "resolved", cell: best, drift: bestD, candidates: cands.length };
}

export interface NpcResolution {
  status: FaceResolveStatus; // resolved | miss | ambiguous
  cell?: Cell; // celda ADYACENTE al NPC donde plantar la party (para transaccionar)
  npcCell?: Cell; // celda del propio NPC
  npcFloor?: number; // planta viva del NPC (el resync teleporta a ella — guild en f1)
  drift?: number;
  candidates: number;
  /** ★ F-A3 — sólo cuando se pidió `preferDir`: la celda desde la que el LP habló NO era
   *  pisable y se ha caído a la más cercana. Se declara para que el fallback no sea mudo. */
  dirPedidaNoPisable?: boolean;
}

/**
 * Dirección a la que MIRA una party plantada en `cell` para hablarle al NPC de `npcCell`.
 *
 * ★ Es LA MISMA expresión que `resyncToNpcAnchor` usa para elegir la tecla-flecha del (T)alk
 * («Dirección = party→NPC»). Vive aquí, exportada, para que el chooser de celda y el emisor de
 * la tecla no puedan divergir: si se cambia el criterio, se cambia en UN sitio.
 *
 * Ojo al sentido: el lado en el que ESTÁ la party y la dirección a la que MIRA son OPUESTOS —
 * una party al oeste del NPC mira al ESTE.
 */
export function dirFromCellToNpc(cell: Cell, npcCell: Cell): Dir4 {
  const dx = npcCell.x - cell.x;
  const dy = npcCell.y - cell.y;
  return dx > 0 ? "east" : dx < 0 ? "west" : dy > 0 ? "south" : "north";
}

/**
 * Resuelve un ancla de NPC contra la lista de NPCs vivos desde `from`:
 *   · 0 NPCs que casan `match` → `miss` (el NPC del LP no está → divergencia real / beat no
 *     alcanzado; no se fabrica la transacción).
 *   · > maxCandidates → `ambiguous` (varios NPCs iguales; se declina, se reporta).
 *   · si no → el NPC que casa MÁS CERCANO a `from`, y la celda ADYACENTE PISABLE más cercana
 *     a `from` (donde plantarse para el peaje/compra). Sin celda adyacente pisable → `miss`.
 * Determinista. `match` casa por substring case-insensitive contra name o type.
 */
export function resolveNpcAnchor(
  npcs: readonly NpcLive[],
  anchor: NpcAnchor,
  from: Cell,
  opts: {
    maxCandidates?: number;
    snap?: GridSnapshot;
    standable?: (tile: number) => boolean;
    /** ★ F-A3 — dirección del (T)alk QUE TRAE EL GUION (la tecla-flecha que pulsó el humano,
     *  op siguiente al ancla con el mismo `ocrLn`). Cuando viene, la celda se elige para que la
     *  party quede DONDE ESTUVO EL LP en vez de en la adyacente más cercana al replay. */
    preferDir?: Dir4;
  } = {},
): NpcResolution {
  const key = anchor.match.toLowerCase();
  const shopMatch = key.startsWith("shop:") ? key.slice(5) : null; // "shop:guildmaster" → por tipo
  const hits = npcs.filter((n) =>
    shopMatch
      ? (shopTypeOf(n.dialogNumber) ?? "").toLowerCase() === shopMatch
      : (n.name ?? "").toLowerCase().includes(key) || (n.type ?? "").toLowerCase().includes(key),
  );
  if (hits.length === 0) return { status: "miss", candidates: 0 };
  const maxCandidates = opts.maxCandidates ?? 4;
  if (hits.length > maxCandidates) return { status: "ambiguous", candidates: hits.length };
  // NPC que casa más cercano a `from`
  let npc = hits[0]!;
  let nd = manhattan(from, npc);
  for (const h of hits.slice(1)) {
    const d = manhattan(from, h);
    if (d < nd) {
      nd = d;
      npc = h;
    }
  }
  // celda adyacente PISABLE más cercana a `from` (donde plantarse para transaccionar)
  const npcCell: Cell = { x: npc.x, y: npc.y };
  let best: Cell | null = null;
  let bestD = Infinity;
  let pedida: Cell | null = null;
  for (const dir of ["north", "south", "east", "west"] as Dir4[]) {
    const [dx, dy] = ANCHOR_DELTA[dir];
    const c: Cell = { x: npc.x + dx, y: npc.y + dy };
    if (opts.snap) {
      if (c.x < 0 || c.y < 0 || c.x >= opts.snap.W || c.y >= opts.snap.H) continue;
      const t = opts.snap.grid[c.y]?.[c.x];
      if (t === undefined || (opts.standable && !opts.standable(t))) continue;
    }
    // ★ F-A3 — ¿es ESTA la celda desde la que el LP habló? El criterio es LA MISMA expresión que
    // el runner usa para mandar la tecla (`dir = npcCell − cell`), no una re-derivación: si allí
    // cambia la fórmula, aquí deja de casar y el test lo dice. Ojo al sentido — el lado en el que
    // ESTÁ la party y la dirección a la que MIRA son opuestos.
    if (opts.preferDir && dirFromCellToNpc(c, npcCell) === opts.preferDir) pedida = c;
    const d = manhattan(from, c);
    if (d < bestD) {
      bestD = d;
      best = c;
    }
  }
  if (!best) return { status: "miss", npcCell, npcFloor: npc.floor, candidates: hits.length };
  // La del guion MANDA cuando es pisable; si no lo es, se cae a la más cercana y SE DECLARA (un
  // fallback mudo convertiría «no se pudo» en «no hacía falta»).
  const elegida = pedida ?? best;
  return {
    status: "resolved",
    cell: elegida,
    npcCell,
    npcFloor: npc.floor,
    drift: manhattan(from, elegida),
    candidates: hits.length,
    ...(opts.preferDir ? { dirPedidaNoPisable: pedida === null } : {}),
  };
}

/** Grid estático de UNA planta (world.smallMaps → floors[].tiles) para la resolución
 *  multi-planta. `z` puede ser NEGATIVO (sótanos z=-1 de Yew/LB). */
export interface FloorGrid {
  z: number;
  snap: GridSnapshot;
}

export interface MultiFloorResolution extends FaceResolution {
  /** Planta donde resolvió el ancla (para el teleport de planta del resync). */
  floor?: number;
}

/**
 * Resolución MULTI-PLANTA de un ancla de cara (fallback del resync cuando la planta
 * actual dio miss): prueba el ancla contra el grid de CADA planta de la location.
 *   · Resuelve en la planta ACTUAL → esa gana (sin salto de planta).
 *   · Resuelve en exactamente UNA planta → esa (el LP estaba en otra planta que el replay:
 *     bookshelf/rug de LB castle viven en f2, el sótano de Yew en z=-1).
 *   · Resuelve en VARIAS plantas → `ambiguous` (no se adivina la planta; se reporta).
 *   · Ninguna resuelve → `miss` real (feature ausente en TODO el edificio → candidato a
 *     divergencia del port) o `ambiguous` si alguna planta declinó por exceso de candidatas.
 * PURA (sin Playwright): los grids llegan del caller; unit-testeable offline.
 */
export function resolveFaceAnchorAcrossFloors(
  floors: readonly FloorGrid[],
  anchor: FaceAnchor,
  from: Cell,
  currentFloor: number,
  opts: { maxCandidates?: number; standable?: (tile: number) => boolean } = {},
): MultiFloorResolution {
  const results = floors.map((f) => ({ z: f.z, res: resolveFaceAnchor(f.snap, anchor, from, opts) }));
  const hits = results.filter((r) => r.res.status === "resolved");
  if (hits.length === 0) {
    const amb = results.find((r) => r.res.status === "ambiguous");
    if (amb) return { status: "ambiguous", candidates: amb.res.candidates, floor: amb.z };
    return { status: "miss", candidates: 0 };
  }
  const cur = hits.find((h) => h.z === currentFloor);
  if (cur) return { ...cur.res, floor: cur.z };
  if (hits.length === 1) return { ...hits[0]!.res, floor: hits[0]!.z };
  return { status: "ambiguous", candidates: hits.reduce((a, h) => a + h.res.candidates, 0) };
}

/** Objeto vivo mínimo de la capa worldObjects (alfombra-plot, cofres, props) para anclas de
 *  cara cuya feature NO es tile del grid base: p.ej. «an odd rug» = Carpet2 283 = la ALFOMBRA
 *  MÁGICA (hydrateInteriorObjects, kind plot type 27+0x100) en el castillo LB. */
export interface ObjLive {
  x: number;
  y: number;
  tile: number;
  floor: number;
}

/**
 * Candidatas de ancla de cara contra la capa de OBJETOS vivos: el mirador es la celda vecina
 * OPUESTA a `dir` del objeto cuyo tile ∈ tileIds. PURA; el caller valida pisabilidad del
 * mirador contra el grid de su planta y desempata (planta actual primero, luego cercanía).
 */
export function objectFaceCandidates(
  objs: readonly ObjLive[],
  tileIds: readonly number[],
  dir: Dir4,
): Array<{ floor: number; cell: Cell }> {
  const want = new Set(tileIds);
  const [dx, dy] = ANCHOR_DELTA[dir];
  return objs.filter((o) => want.has(o.tile)).map((o) => ({ floor: o.floor, cell: { x: o.x - dx, y: o.y - dy } }));
}

export interface ResyncDecision {
  jump: boolean;
  drift: number;
}

/** Decisión pura: ¿saltar? (sólo si la celda difiere de la actual). Devuelve la deriva. */
export function planAnchorResync(from: Cell, cell: Cell): ResyncDecision {
  const drift = manhattan(from, cell);
  return { jump: drift > 0, drift };
}

/**
 * Histograma de deriva por cubos (0 = sin salto; 1; 2; 3-5; 6-10; 11+). Puro; sirve para el
 * reporte de parte (la forma de la deriva: si casi todo es 0-1, el replay va fino; una cola
 * larga señala segmentos donde el RNG desvió mucho al LP respecto del port).
 */
export const DRIFT_BUCKETS = ["0", "1", "2", "3-5", "6-10", "11+"] as const;
export type DriftBucket = (typeof DRIFT_BUCKETS)[number];

export function driftBucket(d: number): DriftBucket {
  if (d <= 0) return "0";
  if (d === 1) return "1";
  if (d === 2) return "2";
  if (d <= 5) return "3-5";
  if (d <= 10) return "6-10";
  return "11+";
}

export function driftHistogram(drifts: readonly number[]): Record<DriftBucket, number> {
  const h: Record<DriftBucket, number> = { "0": 0, "1": 0, "2": 0, "3-5": 0, "6-10": 0, "11+": 0 };
  for (const d of drifts) h[driftBucket(d)]++;
  return h;
}
