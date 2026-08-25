/**
 * PLANIFICADOR PURO de descenso de mazmorra (extraído de nav.ts para poder unit-testearlo
 * sin arrastrar Playwright). Dijkstra sobre el espacio (planta,x,y) con las transiciones
 * REALES del juego: paso toroidal, foso (cae planta+1), klimb en escaleras, Des Por sobre
 * pasadizo vacío. Las salas 0xF/0xA y los hazards se gobiernan por las opciones de abajo.
 *
 * PAQUETE fields/sceptreKey/crossRooms (OPT-IN, default OFF — carril f2b-resto, derivación
 * canónica en re/notes/wrong-campos-pasabilidad.md, acta del carril f2b-wrong):
 *
 * `fields` — semántica FIEL de pasabilidad del binario en vez del modelo conservador
 *   (todo campo=muro). El clasificador de movimiento (DUNGEON:0x05FF) sólo bloquea muros
 *   hi∈{0xB,0xC,0xD}: los campos sueño/veneno/fuego (sub≠3) SE PISAN (efecto por miembro,
 *   on_enter 0x0C76) y las bombas (trap sub&7==2) también ("Bomb Trap!" + daño + el tile
 *   LIMPIA a suelo). SÓLO el campo de energía EXACTO 0x83 (type 8, sub 3, sin variante
 *   lit — dungeon.ts:307-309, DUNGEON:0x0470/0x05d7) REBOTA. Peso 2 en el hazard pisable
 *   (preferir pasillo limpio).
 *
 * `sceptreKey` — con `fields`: el 0x83 deja de ser muro y se modela la transición
 *   "sceptre" ((U)se Cetro en mazmorra disuelve el campo ENCARADO a suelo — CAST 0x1966
 *   rama residente, use-tools.ts useSceptre → DungeonState.dissolveFacingField). Peso 6:
 *   preferir rutas sin gastar el turno de cetro.
 *
 * `crossRooms` — las salas 0xF NO-goal son TRANSITABLES ("step-room-cross", peso 8): en el
 *   U5 original las salas son PASAJES que se cruzan luchando o HUYENDO (flee-cross fiel:
 *   tras huir por un borde la party queda SOBRE la celda-sala — game.ts:5689, dng_enter_room
 *   0x0084; endCombat no reposiciona — y sale por el lado contrario). El ejecutor
 *   (dungeonDescendTo) pisa → combate → conquerRoom; VICTORY o DEADEND-huye continúan.
 *
 * DEFAULT OFF: con las tres opciones apagadas el comportamiento es BYTE-IDÉNTICO al
 * planificador histórico (unit test de paridad) — cero impacto en capítulos sellados.
 */
export interface DCell {
  type: number;
  sub: number;
}

export const DN = 8; // lado del grid de mazmorra

export interface DescentOpts {
  noDespor?: boolean;
  fields?: boolean;
  sceptreKey?: boolean;
  crossRooms?: boolean;
}

export interface DescentNode {
  f: number;
  x: number;
  y: number;
  how: string;
}

export function planDungeonDescent(
  grid: DCell[][][],
  sf: number,
  sx: number,
  sy: number,
  goalFn: (f: number, x: number, y: number) => boolean,
  opts: DescentOpts = {},
): DescentNode[] | null {
  const cell = (f: number, x: number, y: number) => grid[f]![y]![x]!;
  const isWall = (c: DCell) => c.type === 0xb || c.type === 0xc;
  // Sin `fields`: todo campo 0x8 = muro (modelo conservador histórico). Con `fields`:
  // sólo el 0x83 exacto (sub 3) bloquea el paso normal (el resto se pisa, DUNGEON:0x05FF).
  const isBlockingField = (c: DCell) => (opts.fields ? c.type === 8 && c.sub === 3 : c.type === 8);
  const trapKind = (c: DCell) => (c.type === 6 ? (c.sub & 7) : -1);
  const k = (f: number, x: number, y: number) => `${f}:${x}:${y}`;
  const start = k(sf, sx, sy);
  const dist = new Map([[start, 0]]);
  const prev = new Map<string, { from: string; how: string }>();
  let pq: Array<{ s: string; c: number }> = [{ s: start, c: 0 }];
  const pop = () => { let bi = 0; for (let i = 1; i < pq.length; i++) if (pq[i]!.c < pq[bi]!.c) bi = i; return pq.splice(bi, 1)[0]!; };
  let goal: string | null = null;
  while (pq.length) {
    const { s, c } = pop();
    if (c > (dist.get(s) ?? Infinity)) continue;
    const [f, x, y] = s.split(":").map(Number) as [number, number, number];
    if (goalFn(f, x, y)) { goal = s; break; }
    const cur = cell(f, x, y);
    const relax = (ns: string, w: number, how: string) => { const nc = c + w; if (nc < (dist.get(ns) ?? Infinity)) { dist.set(ns, nc); prev.set(ns, { from: s, how }); pq.push({ s: ns, c: nc }); } };
    for (const [dx, dy] of [[0, -1], [0, 1], [-1, 0], [1, 0]] as const) {
      const nx = (x + dx + DN) % DN, ny = (y + dy + DN) % DN;
      const nc = cell(f, nx, ny);
      // Sala SIN conquistar (0xF): entrable si es el goal (dispara combate) o, con
      // `crossRooms`, como sala de PASO (peso alto: preferir pasillo). Sala CONQUISTADA
      // (0xA RoomsBroke): transitable como pasaje (cae a `step` abajo).
      if (nc.type === 0xf) {
        if (goalFn(f, nx, ny)) relax(k(f, nx, ny), 1, "step-room");
        else if (opts.crossRooms) relax(k(f, nx, ny), 8, "step-room-cross");
        continue;
      }
      if (isWall(nc)) continue;
      if (isBlockingField(nc)) {
        // 0x83 con `sceptreKey`: transición "sceptre" — encarar, (U)se Cetro y pisar.
        if (opts.fields && opts.sceptreKey) relax(k(f, nx, ny), 6, "sceptre");
        continue;
      }
      // Campo pisable (fields ON, sub≠3): "step" con coste de hazard (efecto por miembro).
      if (nc.type === 8) { relax(k(f, nx, ny), 2, "step"); continue; }
      const tk = trapKind(nc);
      if (tk === 1) { if (f < 7) relax(k(f + 1, nx, ny), 5, "pitfall"); continue; }
      if (tk === 2) {
        // Bomba: pisable FIEL (detona + daño + limpia a suelo) SÓLO bajo el opt-in `fields`.
        if (opts.fields) relax(k(f, nx, ny), 2, "step");
        continue;
      }
      relax(k(f, nx, ny), 1, "step");
    }
    if ((cur.type === 2 || cur.type === 3) && f < 7) relax(k(f + 1, x, y), 1, "klimbdown");
    if ((cur.type === 1 || cur.type === 3) && f > 0) relax(k(f - 1, x, y), 1, "klimbup");
    // Des Por (descenso mágico) — INERTE en Doom (game.ts falla en silencio), así que
    // `noDespor` lo desactiva para que el planificador sólo use transiciones FÍSICAS.
    if (!opts.noDespor && f < 7 && cell(f + 1, x, y).type === 0) relax(k(f + 1, x, y), 3, "despor");
  }
  if (!goal) return null;
  const path: DescentNode[] = [];
  let curk = goal;
  while (prev.has(curk)) { const p = prev.get(curk)!; const [f, x, y] = curk.split(":").map(Number) as [number, number, number]; path.unshift({ f, x, y, how: p.how }); curk = p.from; }
  return path;
}

// ─────────────────────────────────────────────────────────────────────────────
// EMBOSCADA de pasillo (errante 3D, DUNGEON 0x0B7E — ver re/notes/dungeon-wanderer.md)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * ESTRATEGIA de detección de emboscada del run (OPT-IN por call-site; ver `nav.ts` _ambushMode):
 *  - `"legacy"` (DEFAULT): emboscada = `inCombat && inDungeon`. Comportamiento pass-1 bajo el que
 *    están sellados ch26 y la MAYORÍA de capítulos. Un combate de SALA que se pisa AL NAVEGAR se
 *    resuelve in-situ en el helper de nav (resolveArenaCombat) — el stream RNG que sellaron.
 *  - `"territory"` (OPT-IN de ch37-doom-cola y ch35): emboscada = SÓLO la arena PROCEDURAL del
 *    pasillo (`territory === "dungeon-corridor"`); un combate de SALA (`territory === "dungeon"`,
 *    .CBT) se deja para conquerRoom + enterRoomThroughAmbush. Necesario para r6/r9 de doom (el
 *    klimb/paso de ENTRADA disparaba dng_enter_room que el modo legacy tragaba como emboscada).
 * Gate por modo para que un fix de un capítulo NO vuelva a mover el stream de capítulos ajenos.
 */
export type AmbushMode = "legacy" | "territory";

/**
 * ¿Combate abierto = EMBOSCADA de pasillo (errante 3D)? Ver `AmbushMode`. En `"territory"` se
 * identifica por el TERRITORIO de la arena (la procedural del pasillo, DNGLOOK 0x0D3E); en
 * `"legacy"` cualquier combate DENTRO de mazmorra cuenta como emboscada (semántica pass-1).
 */
export function isCorridorAmbush(
  s: { inCombat: boolean; territory: string | null; inDungeon?: boolean },
  mode: AmbushMode = "territory",
): boolean {
  if (!s.inCombat) return false;
  return mode === "legacy" ? !!s.inDungeon : s.territory === "dungeon-corridor";
}

/** Acción del caminante de pasillo ambush-aware (decisión PURA, ver `nextWalkAction`). */
export type WalkAction =
  | { kind: "resolveAmbush" }
  | { kind: "arrived" }
  | { kind: "step"; to: [number, number] }
  | { kind: "noRoute" };

/**
 * Decisión PURA del caminante de pasillo tras RE-OBSERVAR el estado (posición/combate) al
 * final de cada acción. El post-combate de una emboscada (58a0) puede haber movido a la
 * party — paso lateral por huida (códigos 1-4) o ±planta por klimb en la arena (5/6) — así
 * que NO se sigue la ruta previa (stale): se RE-PLANIFICA desde la posición real cada paso.
 *
 * Prioridad: (1) emboscada abierta → resolverla ANTES de nada (comería los giros/pasos);
 * (2) ¿llegó? ; (3) re-planificar y dar UN paso; (4) sin ruta. `plan` (BFS pasable) se
 * inyecta para poder unit-testear la lógica sin un grid real.
 */
export function nextWalkAction(
  s: { inCombat: boolean; territory: string | null; inDungeon?: boolean; cur: { x: number; y: number }; goal: { x: number; y: number } },
  plan: (sx: number, sy: number, gx: number, gy: number) => Array<[number, number]> | null,
  mode: AmbushMode = "territory",
): WalkAction {
  if (isCorridorAmbush(s, mode)) return { kind: "resolveAmbush" };
  if (s.cur.x === s.goal.x && s.cur.y === s.goal.y) return { kind: "arrived" };
  const route = plan(s.cur.x, s.cur.y, s.goal.x, s.goal.y);
  if (!route || route.length === 0) return { kind: "noRoute" };
  return { kind: "step", to: route[0]! };
}
