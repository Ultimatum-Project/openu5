/**
 * COMANDOS DE MAZMORRA — entrada/salida y despacho del bucle DUNGEON (MAINOUT
 * cmd_enter 0x088f + DUNGEON.OVL 0x1014/0x1C6A/0x1D4A/0x1E10) — extraídos de la
 * clase Game (lote 2 del refactor de monolitos, patrón TRAMO 3/ARQ-3): carga de
 * mazmorra (enterDungeon), consultas de UI (klimb-choice / fuentes), despacho de
 * comandos con turno propio (dungeonCommand), Uus/Des Por (dungeonMagicChangeLevel),
 * turno de Cast sin cambio de planta (dungeonSpellTurn) y salida a Britannia/
 * Underworld (exitDungeonTo). El MOTOR (DungeonState) ya vivía en dungeon/dungeon.ts;
 * aquí va la ORQUESTACIÓN con contexto estrecho. Game delega (fachada, firmas
 * intactas) y conserva el campo `dungeonState` (estado de la partida) + el arranque
 * de combate de sala (startDungeonRoomCombat, acoplado a Combat). Comentarios-cita
 * ÍNTEGROS.
 */
import type { GameState } from "../state.js";
import type { GameEvent } from "../game.js";
import type { RandFn, SkyRefreshCtx } from "../world/survival.js";
import type { OriginalRng } from "../rng-original.js";
import { advanceTurn } from "../world/movement.js";
import { MINUTES_PER_ACTION_DUNGEON } from "../world/survival.js";
import { sfxEvent } from "../sfx.js";
import { FIRST_DUNGEON_LOCATION, LAST_DUNGEON_LOCATION } from "../quest/words.js";
import {
  DungeonState,
  type DungeonData,
  type DungeonEvent,
  type DungeonSearchOpts,
  type Facing,
} from "./dungeon.js";

/** Contexto estrecho de los comandos de mazmorra (lo arma Game.dungeonCmdsCtx()). */
export interface DungeonCmdsCtx {
  state: GameState;
  rand: RandFn;
  /**
   * ★ #176 — contexto del refresco del LATCH de fases lunares que corre en la cola de
   * `advance_clock` (0x514a-0x5161). Lo produce `Game.skyRefreshCtx`. Sin él el latch
   * no se toca (arneses puros).
   */
  sky?: SkyRefreshCtx;
  /** Stream vivo compartido (g_rng_seed): se INYECTA a DungeonState, no un fork. */
  liveRng: OriginalRng;
  dungeons?: DungeonData[];
  /** Coords de superficie por location (data.locationsX/Y) para la salida. */
  locationsX: number[];
  locationsY: number[];
  /** El campo `dungeonState` vive en Game (público, lo consultan piel/tests). */
  getDungeonState(): DungeonState | null;
  setDungeonState(ds: DungeonState | null): void;
  locationNameBanner(id: number, events: GameEvent[]): void;
  hydrateUnderworldPlot(): void;
  /** overworldEnemies.clear() (memset MAINOUT 0x0857). */
  clearOverworldEnemies(): void;
  startDungeonRoomCombat(combatMapIndex: number): GameEvent[];
  /** Combate de PASILLO contra el errante 3D (0x5F86 modo 2; arena procedural). */
  startDungeonCorridorCombat(cause: "ambush" | "attack"): GameEvent[];
  checkDoomRescue(): GameEvent[];
  checkRefuge(): GameEvent[];
}

/** Comandos del despacho de mazmorra (bucle DUNGEON; ver dungeonCommand). */
export type DungeonCmd =
  | "forward"
  | "back"
  | "left"
  | "right"
  | "turnAround"
  | "klimb"
  | "search"
  | "open"
  | "drink"
  | "pass"
  | "attack"
  | "look"
  | "get"
  | "jimmy";

/**
 * Entra en una mazmorra. spokenWord = null si ya estaba abierta;
 * si no, se valida contra la Word of Power (quest/words.ts).
 */
export function enterDungeon(ctx: DungeonCmdsCtx, dungeonId: number, fromFloor = 0): GameEvent[] {
  const events: GameEvent[] = [];
  if (!ctx.dungeons) return events;
  // El sello ya se validó/abrió con (Y)ell (yellWord, CMDS 0x12c8); aquí sólo se
  // carga la mazmorra. Ver enter() y quest/words.ts::yellWordOfPower.
  const dungeon = ctx.dungeons.find((d) => d.location === dungeonId);
  if (!dungeon) return events;
  // Banner del nombre (C1): MAINOUT 0x816-0x83e imprime `\n\n` + 0xFC +
  // [DS 0x1e3a + (loc-1)·2] («DESPISE»…«DOOM») + 0xFB + `\n` tras el gate
  // a-pie/emboscada y ANTES de cargar. Ver locationNameBanner.
  ctx.locationNameBanner(dungeonId, events);
  // Nivel de entrada por planta de origen (MAINOUT cmd_enter 0x088f-0x08be):
  //  · desde SUPERFICIE (fromFloor 0) → CIMA (planta 0), busca la escalera-up de la
  //    planta 0 (comportamiento del port ya sellado en ch14; (1,1) por defecto).
  //  · desde el UNDERWORLD (fromFloor 0xFF) → FONDO (planta 7, nivel 8) en (7,7)
  //    mirando OESTE (`mov [g_dng_facing],3` = O; `party_x=party_y=7`).
  //  · EXCEPCIÓN Doom (id 40 = LAST_DUNGEON_LOCATION): SIEMPRE entra por la cima
  //    (`cmp al,0x28; je 0x8b4`), aunque se venga del Underworld (es su única vía).
  const fromUnderworld = fromFloor === 0xff && dungeonId !== LAST_DUNGEON_LOCATION;
  const entryFloor = fromUnderworld ? 7 : 0;
  let entry = fromUnderworld ? { x: 7, y: 7 } : { x: 1, y: 1 };
  if (!fromUnderworld) {
    // Superficie: la escalera de subida (o up-down) de la planta 0.
    outer: for (let y = 0; y < 8; y++) {
      for (let x = 0; x < 8; x++) {
        const cell = dungeon.floors[0]?.[y]?.[x];
        if (cell && (cell.type === 0x1 || cell.type === 0x3)) {
          entry = { x, y };
          break outer;
        }
      }
    }
  }
  // El binario comparte UN único g_rng_seed entre DUNGEON.OVL y el bucle
  // principal (rand = kernel 0x2092, re/notes/dungeon.md L11-13). La mazmorra
  // VIVA consume el MISMO stream: se le inyecta la instancia liveRng (no un
  // fork), de modo que las trampas/campos/salas avanzan g_rng_seed y el combate
  // de sala (fork liveRng.getSeed() + resync en endCombat) queda sincronizado
  // con el bucle de mazmorra. La paridad byte-exacta del arnés (dungeon-run.ts)
  // sigue inyectando su propio OriginalRng del snapshot — esta rama es sólo el
  // camino vivo.
  const ds = new DungeonState(
    ctx.dungeons,
    {
      dungeon: dungeonId,
      floor: entryFloor,
      x: entry.x,
      y: entry.y,
      facing: fromUnderworld ? "west" : "south",
    },
    ctx.liveRng,
  );
  ctx.setDungeonState(ds);
  // DNGLOOK 0x093a: al cargar el mapa fresco, degrada 0xFn→0xAn las salas ya despejadas
  // en visitas anteriores (bitmap persistente g_dng_room_cleared) → no re-disparan combate.
  ds.applyClearedRooms(ctx.state);
  // Preámbulo del bucle (DUNGEON 0x0F0F call 0x134(arg)): arma el ERRANTE 3D.
  ds.respawnWanderer();
  // "Enter dungeon" ya lo imprimió enter() (ENTER_LINES) y el NOMBRE en mayúsculas
  // lo imprime locationNameBanner (C1, tabla DS 0x1e3a) — el print duplicado de
  // dungeon.name que vivía aquí (pre-C1) causaba el BANNER DOBLE del espejo F2-T1
  // («SHAME» mal indexado + «DECEIT»); retirado: el LP muestra UNA línea.
  events.push({ kind: "dungeon-entered", dungeonId });
  // Entrar a la mazmorra destruye la pool de monstruos errantes del overworld (memset de
  // la tabla de objetos, MAINOUT 0x0857; witness O1 §3) — igual que los towns (loadSmallMap).
  ctx.clearOverworldEnemies();
  return events;
}

/**
 * COSTURA DE ARNÉS (E2E, cero-rand): fija la posición de mazmorra COMPLETA — mazmorra,
 * planta, celda y **FACING** — sin recarga ni entrada real. Análogo de `setPosition` para
 * el interior 3D; su único consumidor es el hook DEV `__u5debug.setDungeonPos` (el resync
 * de interior del WALKTHROUGH-ESPEJO, misma clase sancionada que `goToLocation` /
 * `teleportSmallMap` / `teleportOverworld`).
 *
 * POR QUÉ NO SIRVE `teleportDungeon` (el que ya existía), documentado porque la tentación
 * de reutilizarlo es obvia:
 *  1. **No fija el facing** (su JSDoc lo dice: «El facing se conserva») — y dentro de la
 *     mazmorra el facing es estado OCULTO Y LOAD-BEARING: decide qué se ve, qué se abre y
 *     hacia dónde avanza un `Advance`. Resincronizar la celda sin el facing deja la party
 *     alineada y mirando a otro sitio: el paso siguiente vuelve a divergir.
 *  2. **NO es cero-rand**: si no estás ya dentro entra por `enterDungeon`, cuyo epílogo
 *     llama `ds.respawnWanderer()` — y ése SÍ consume el stream (banco `rand(0,7)` + hasta
 *     8 intentos de celda `rand(0,63)` + roll de oculto `rand(0,99)`; wanderer.ts). Todas
 *     las costuras del espejo son cero-rand A PROPÓSITO: el instrumento no debe mover el
 *     stream que la medición compara.
 *
 * Cero-rand aquí es una propiedad VERIFICADA, no una promesa: `respawnWanderer` es el ÚNICO
 * consumidor del camino de entrada y aquí NO se llama, así que el errante nace INACTIVO
 * (`inactiveWanderer()`, el default del campo). `applyClearedRooms` es determinista (lee el
 * bitmap persistente de salas despejadas). Ver el unit test del contador de rand.
 */
export function setDungeonPos(
  ctx: DungeonCmdsCtx,
  dungeonId: number,
  floor: number,
  x: number,
  y: number,
  facing: Facing,
): void {
  if (!ctx.dungeons) return;
  const ds = ctx.getDungeonState();
  if (ds && ds.pos.dungeon === dungeonId) {
    // Ya dentro de ESA mazmorra: mutación pura de la posición (nada que recargar).
    ds.pos.floor = floor;
    ds.pos.x = x;
    ds.pos.y = y;
    ds.pos.facing = facing;
    return;
  }
  if (!ctx.dungeons.some((d) => d.location === dungeonId)) return;
  const fresh = new DungeonState(
    ctx.dungeons,
    { dungeon: dungeonId, floor, x, y, facing },
    ctx.liveRng,
  );
  ctx.setDungeonState(fresh);
  // DNGLOOK 0x093a (determinista): degrada 0xFn→0xAn las salas ya despejadas.
  fresh.applyClearedRooms(ctx.state);
  // Coherencia de la SALIDA: el modo mazmorra deja `state.position` en el tile de
  // SUPERFICIE de la entrada (enterDungeon no lo toca porque la party ya estaba encima).
  // Al fabricar el estado desde fuera hay que ponerlo, o un `Exit to Britannia!` aterrizaría
  // donde la party estuviera antes. MISMA tabla y MISMA celda que exitDungeonTo: locationsX/Y
  // EN CRUDO (DUNGEON 0x1d10-0x1d1b), que es además la celda que la ENTRADA exige pisar
  // (MAINOUT 0x07a8/0x07ae). Aquí no había +1 que justificar: lo heredaba de exitDungeonTo.
  const idx = dungeonId - 1;
  ctx.state.position = {
    location: 0,
    floor: 0,
    x: ctx.locationsX[idx] ?? ctx.state.position.x,
    y: ctx.locationsY[idx] ?? ctx.state.position.y,
  };
}

/** Comando en modo mazmorra; traduce DungeonEvent a GameEvent. */
/**
 * ¿El (K)limb de mazmorra necesita el prompt "Klimb-U/D-" (0x6cba)? Es el caso de
 * escalera ARRIBA Y ABAJO en la misma celda. La UI lo consulta ANTES de despachar:
 * si es true, muestra el prompt y re-despacha `dungeonCommand("klimb", "up"|"down"|
 * "pass")`; si es false, `dungeonCommand("klimb")` resuelve directo (una sola vía).
 */
export function dungeonKlimbNeedsChoice(ctx: DungeonCmdsCtx): boolean {
  const ds = ctx.getDungeonState();
  return ds ? ds.klimbNeedsChoice(ctx.state) : false;
}

/**
 * ¿El (D)rink de mazmorra está sobre una fuente? La UI lo consulta ANTES de
 * despachar para abrir el prompt "Will you drink?" (DNGLOOK 0x013b), fiel al
 * original que sólo pregunta al mirar una fuente. Sin fuente → drink directo.
 */
export function dungeonFountainHere(ctx: DungeonCmdsCtx): boolean {
  const ds = ctx.getDungeonState();
  return ds ? ds.fountainHere() : false;
}

/**
 * ¿La celda MIRADA (target del Dir- del Look, default encarada) es una fuente?
 * La UI lo consulta tras un (L)ook para abrir el prompt "Will you drink?"
 * (DNGLOOK 0x012f: el Look de una fuente encadena la bebida de la fuente MIRADA).
 */
export function dungeonFountainAhead(
  ctx: DungeonCmdsCtx,
  target: NonNullable<DungeonSearchOpts["target"]> = "ahead",
): boolean {
  const ds = ctx.getDungeonState();
  return ds ? ds.fountainAhead(target) : false;
}

/**
 * Bebida de la fuente MIRADA (resolución del prompt del Look, DNGLOOK 0x01f0);
 * `target` = la dirección elegida en el Dir- del Look (default encarada).
 * SIN turno propio: el turno ya lo cobró el (L)ook que abrió el prompt (kernel
 * ret 1 por el comando entero, no dos veces).
 */
export function dungeonDrinkAhead(
  ctx: DungeonCmdsCtx,
  target: NonNullable<DungeonSearchOpts["target"]> = "ahead",
): GameEvent[] {
  const ds = ctx.getDungeonState();
  if (!ds) return [];
  const events: GameEvent[] = [];
  // Traductor COMPLETO compartido (no el filtro message|damage que vivía aquí):
  // el cue del "Bad taste." (kernel 0x2a52 @0x2a68) debe sonar también por la vía
  // fiel del Look, no sólo por el atajo 'd' (re/notes/drink-ahead-fidelity.md §4.2).
  translateDungeonEvents(ctx, ds.drinkFountain(ctx.state, ds.aheadCoords(target)), events);
  events.push(...ctx.checkRefuge());
  return events;
}

/**
 * Traductor DungeonEvent → GameEvent compartido por las tres vías con eventos de
 * motor (dungeonCommand, dungeonMagicChangeLevel, dungeonDrinkAhead): message/damage
 * CON texto → message (los damage sin text son señal interna de refresh y se
 * descartan); sfx → bus del contrato (task #3); exits → exitDungeonTo; combat-room →
 * startDungeonRoomCombat. Muta `events` en sitio (exitDungeonTo empuja varios).
 */
function translateDungeonEvents(
  ctx: DungeonCmdsCtx,
  dEvents: DungeonEvent[],
  events: GameEvent[],
): void {
  for (const e of dEvents) {
    if (e.kind === "message" || e.kind === "damage") {
      if (e.text) events.push({ kind: "message", text: e.text });
    } else if (e.kind === "sfx" && e.sfx) {
      events.push(sfxEvent(e.sfx)); // cue de mazmorra → bus del contrato (task #3)
    } else if (e.kind === "damage-script" && e.slots && e.slots.length > 0) {
      // ★ #328 — guión de kernel_apply_damage 0x2a52 (flash de fila + blip por
      // slot): al bus "poison-tick" (#213), que ya pacea exactamente esa cadena.
      events.push({ kind: "poison-tick", poisonTick: { slots: e.slots } });
    } else if (e.kind === "exit-overworld") {
      exitDungeonTo(ctx, events, false);
    } else if (e.kind === "exit-underworld") {
      exitDungeonTo(ctx, events, true);
    } else if (e.kind === "combat-room" && e.roomCombatMapIndex !== undefined) {
      events.push(...ctx.startDungeonRoomCombat(e.roomCombatMapIndex));
    } else if (e.kind === "combat-corridor") {
      events.push(...ctx.startDungeonCorridorCombat(e.corridorCause ?? "ambush"));
    }
  }
}

export function dungeonCommand(
  ctx: DungeonCmdsCtx,
  cmd: DungeonCmd,
  klimbDir?: "up" | "down" | "pass",
  searchOpts?: DungeonSearchOpts,
): GameEvent[] {
  const ds = ctx.getDungeonState();
  if (!ds) return [];
  // (A)ttack de mazmorra devuelve 0 = SIN turno (DUNGEON 0x1D4A `[bp-2]=0`):
  // no corre reloj ni housekeeping — en AMBAS ramas (con errante encarado arranca
  // el combate de pasillo, que es su propio tiempo). Sin advanceTurn.
  if (cmd === "attack") {
    const events: GameEvent[] = [];
    translateDungeonEvents(ctx, ds.attack(), events);
    return events;
  }
  // El bucle DUNGEON es propio y NO pasa por el world-turn de overworld/pueblo;
  // sólo se enruta el reloj+housekeeping por el stream vivo (this.rand).
  // El coste es 1 minuto (DUNGEON 0x0fef `jmp 0xf2e` → `push 1` / `call advance_clock`,
  // #159): NO se pasa `undefined`, que caería en minutesPerAction(position.location) y,
  // como el clon deja esa location en 0 dentro de la mazmorra, cobraría los 2 de exterior.
  const turnMessages = advanceTurn(ctx.state, MINUTES_PER_ACTION_DUNGEON, ctx.rand, ctx.sky);
  let dEvents: DungeonEvent[];
  switch (cmd) {
    case "forward":
      dEvents = ds.forward(ctx.state);
      break;
    case "back":
      dEvents = ds.back(ctx.state);
      break;
    case "left":
      dEvents = ds.turnLeft();
      break;
    case "right":
      dEvents = ds.turnRight();
      break;
    case "turnAround":
      dEvents = ds.turnAround();
      break;
    case "klimb":
      dEvents = ds.klimb(ctx.state, klimbDir);
      break;
    case "search":
      // Cadena F2-T7: celda objetivo (prompt Dir-) + miembro del selector 0x8a08.
      dEvents = ds.search(ctx.state, searchOpts);
      break;
    case "open":
      dEvents = ds.openChest(ctx.state);
      break;
    case "drink":
      dEvents = ds.drinkFountain(ctx.state);
      break;
    case "pass":
      dEvents = ds.pass();
      break;
    case "look":
      // F3: la celda descrita viene del prompt «Dir-» (DNGLOOK 0x0028); el target
      // viaja en searchOpts.target (mismo canal que el Search — default "ahead").
      dEvents = ds.lookAhead(ctx.state, searchOpts?.target ?? "ahead");
      break;
    case "get":
      dEvents = ds.getHere(ctx.state);
      break;
    case "jimmy":
      dEvents = ds.jimmyHere(ctx.state);
      break;
  }
  // on_enter tras CUALQUIER acción con turno (bucle DUNGEON 0x0F84): los comandos
  // que NO pisaron celda (giros, search, pass, look… y los pasos BLOQUEADOS)
  // corren aquí el despertar + el turno del ERRANTE. Los que sí pisaron
  // (moved/floor-changed) ya lo corrieron dentro de onEnterCell; las salidas de
  // mazmorra no rolan (binario: location<0x21 → si=0).
  const alreadyTicked = dEvents.some(
    (e) =>
      e.kind === "moved" ||
      e.kind === "floor-changed" ||
      e.kind === "exit-overworld" ||
      e.kind === "exit-underworld",
  );
  if (!alreadyTicked && ctx.getDungeonState()) dEvents.push(...ds.turnTick(ctx.state));
  const events: GameEvent[] = [];
  for (const text of turnMessages) events.push({ kind: "message", text });
  translateDungeonEvents(ctx, dEvents, events);
  events.push(...ctx.checkDoomRescue());
  // Refuge (DUNGEON 0x1014): party entero muerto (veneno/hazard/fuente) tras el
  // turno de mazmorra → despertar en LB en vez de game-over.
  events.push(...ctx.checkRefuge());
  return events;
}

/**
 * Aplica Uus Por (dir −1, sube) / Des Por (dir +1, baja) en la vista 3D — el
 * cambio de planta mágico (DUNGEON:0x1C6A con mode=1). El dispatcher de Cast y
 * sus gates (ventana temporal / mezclado / maná / nivel) ya corrieron en la capa
 * de UI (castSpell); aquí sólo se cobra el turno de mazmorra y se aplica el
 * efecto, como `dungeonCommand`. Doom (location 0x28) falla en silencio dentro de
 * `magicChangeLevel`. Ver `re/notes/dungeon.md §4` y `re/notes/magic.md §7`.
 */
export function dungeonMagicChangeLevel(ctx: DungeonCmdsCtx, dir: -1 | 1): GameEvent[] {
  const ds = ctx.getDungeonState();
  if (!ds) return [];
  // Mismo coste de mazmorra que `dungeonCommand`, 1 minuto (#159): este flujo vuelve
  // al mismo bucle DUNGEON, y su cola cobra el reloj por 0x0fef `jmp 0xf2e` → `push 1`
  // / `call advance_clock`. Con `undefined` caía en minutesPerAction(position.location)
  // y cobraba los 2 de exterior, como los otros cuatro.
  const turnMessages = advanceTurn(ctx.state, MINUTES_PER_ACTION_DUNGEON, ctx.rand, ctx.sky);
  const dEvents = ds.magicChangeLevel(ctx.state, dir);
  // on_enter tras el turno (0x0F84): en fallo/Doom-silencioso no hubo cambio de
  // planta (onEnterCell no corrió) → tick del despertar + errante aquí.
  const changed = dEvents.some(
    (e) => e.kind === "floor-changed" || e.kind === "exit-overworld" || e.kind === "exit-underworld",
  );
  if (!changed && ctx.getDungeonState()) dEvents.push(...ds.turnTick(ctx.state));
  const events: GameEvent[] = [];
  for (const text of turnMessages) events.push({ kind: "message", text });
  // sfx aquí = «Failed!» de Uus/Des Por → glide 0x1cfb (vía el traductor común).
  translateDungeonEvents(ctx, dEvents, events);
  events.push(...ctx.checkDoomRescue());
  events.push(...ctx.checkRefuge());
  return events;
}

/**
 * Turno de mazmorra de un Cast que NO cambia de planta (In Lor/Vas Lor, curación,
 * etc.): sólo cobra el reloj + housekeeping, como cualquier comando de mazmorra que
 * consume turno (el bucle DUNGEON corre el turno tras el kernel_cmd_dispatch de Cast).
 * El efecto global (p.ej. `lightSpellMins`) ya lo aplicó `castSpell` sobre el estado.
 */
export function dungeonSpellTurn(ctx: DungeonCmdsCtx): GameEvent[] {
  const ds = ctx.getDungeonState();
  if (!ds) return [];
  const events: GameEvent[] = [];
  for (const text of advanceTurn(ctx.state, MINUTES_PER_ACTION_DUNGEON, ctx.rand, ctx.sky))
    events.push({ kind: "message", text });
  // on_enter tras el turno de Cast (0x0F84): despertar + turno del ERRANTE.
  translateDungeonEvents(ctx, ds.turnTick(ctx.state), events);
  events.push(...ctx.checkRefuge());
  return events;
}

export function exitDungeonTo(ctx: DungeonCmdsCtx, events: GameEvent[], underworld: boolean): void {
  const dungeonId = ctx.getDungeonState()?.pos.dungeon ?? FIRST_DUNGEON_LOCATION;
  ctx.setDungeonState(null);
  const idx = dungeonId - 1;
  // ★ COORDENADA DE DEPÓSITO — EN CRUDO, Y LA MISMA EN LAS DOS CAPAS (DUNGEON 0x1d10-0x1d1b):
  //   1d09: mov al,[g_location] / 1d0e: mov si,ax
  //   1d10: mov al,[si + 0x1e89]  → 1d14: mov [g_party_x],al
  //   1d17: mov al,[si + 0x1eb1]  → 1d1b: mov [g_party_y],al
  // Las dos escrituras ocurren ANTES del test de capa (1d25 `cmp [g_floor],0`), que sólo
  // elige planta (0xFF/0) y cadena ("Underworld!"/"Britannia!"): NO hay término por capa ni
  // por costura. Ningún llamador retoca la y después (0x1dce→0x1dd1, 0x1f44→0x1f47).
  // ★★ Y el ajuste es IMPOSIBLE, no sólo ausente: la ENTRADA exige estar sobre esa misma
  // celda —MAINOUT 0x07a8 `cmp [si+0x1e8a],dl` / 0x07ae `cmp [si+0x1eb2],cl` con
  // g_location = si+1 (0x0887 `mov al,[bp-2]` / 0x088a `inc al`)—, así que entrada y salida
  // direccionan EL MISMO BYTE: 0x1e8a+si = 0x1e89+(si+1). Salir devuelve exactamente a la
  // celda desde la que se entró. El `+1` a Britannia que vivía aquí era invención del port
  // (acta: re/notes/britannia-y1-acta.md); la costura hermana de PUEBLO ya lo hacía en crudo
  // (TOWN 0x07f2/0x07f9 → game.ts::exitToOverworld).
  ctx.state.position = {
    location: 0,
    floor: underworld ? 0xff : 0,
    x: ctx.locationsX[idx] ?? 0,
    y: ctx.locationsY[idx] ?? 0,
  };
  // Emerger al Underworld = carga del mapa exterior → siembra la trama (OUTSUBS 0x0566).
  // No-op al salir a Britannia (floor 0). F1.10-T2.
  if (underworld) ctx.hydrateUnderworldPlot();
  // Salir de mazmorra imprime "\nExit to " (DATA.OVL DS 0x6c84) + destino (DUNGEON
  // 0x1d1e-0x1d3f): g_floor!=0 → "Underworld!" (DS 0x6c8e, 0x1d31), g_floor==0 →
  // "Britannia!" (DS 0x6c9c, 0x1d3b). El port lo emite como una línea.
  events.push({
    kind: "message",
    text: underworld ? "Exit to Underworld!" : "Exit to Britannia!",
  });
  events.push({ kind: "dungeon-exited" });
  events.push({ kind: "map-changed" });
}
