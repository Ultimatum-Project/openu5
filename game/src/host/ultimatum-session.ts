import type { CoreView, ViewSnapshot } from "../skin/api.js";
import { TILE_INFO } from "../core/tiles.js";
import { defaultTileColor } from "../core/tile-colors.js";

export const ULTIMATUM_U5_SESSION_CONTRACT = 5 as const;

export type UltimatumU5Command = Extract<UltimatumU5Action, { type: "command" }>['command'];
export type UltimatumU5ActionGroup = "primary" | "interaction" | "conversation" | "magic" | "party" | "navigation" | "utility";

export interface UltimatumU5AvailableAction {
  id: UltimatumU5Command;
  label: string;
  group: UltimatumU5ActionGroup;
}

export interface UltimatumU5Prompt {
  kind: "command" | "direction" | "text" | "number" | "choice" | "busy";
  label: string;
  canCancel: boolean;
  maxLength?: number;
  options?: readonly UltimatumU5PromptOption[];
}

export interface UltimatumU5PromptOption {
  id: string;
  label: string;
  detail?: string;
  keys: readonly string[];
}

export type UltimatumU5Direction = "north" | "south" | "east" | "west";
export interface UltimatumU5ContextAction {
  id: string;
  label: string;
  command: UltimatumU5Command;
  direction?: UltimatumU5Direction;
}

export interface UltimatumU5PrimaryAction {
  label: string;
  enabled: boolean;
  options: readonly UltimatumU5ContextAction[];
}

export interface UltimatumU5InteractionState {
  mode: ViewSnapshot["mode"];
  prompt: UltimatumU5Prompt;
  availableActions: readonly UltimatumU5AvailableAction[];
  primaryAction: UltimatumU5PrimaryAction;
}

/**
 * Estado de conversación resuelto por el motor, para la hoja de conversación de
 * la plataforma. Es ADITIVO al contrato v5: un host que lo ignore sigue igual.
 *
 * `source` es la identidad estable del interlocutor y `npc` su nombre mostrado;
 * `askedTopics` son sólo las keywords que el jugador YA ha probado en ESTA
 * conversación, nunca el catálogo .TLK completo (eso revelaría temas no
 * descubiertos). La plataforma acumula esas keywords por `source` para
 * autocompletar y sugerir temas sin espiar el guion.
 */
/**
 * Un botón de conversación que no es una keyword hablada: la opción de una
 * tienda (Buy/Sell/Yes/No…). El host lo pinta y despacha sus `keys` como
 * pulsaciones, igual que la opción equivalente del menú de tienda.
 */
export interface UltimatumU5ConversationOption {
  id: string;
  label: string;
  keys: readonly string[];
}

/**
 * Una línea ya hablada por el NPC, para el diario de conversaciones de la
 * plataforma. `topic` es la keyword que la provocó (null para saludo o
 * autopresentación); `source`/`npc` identifican al hablante para que el host
 * la persista con el lugar y permita buscar «quién dijo qué, dónde y sobre qué».
 */
export interface UltimatumU5ConversationPassage {
  text: string;
  topic: string | null;
  source: string | null;
  npc: string | null;
}

export interface UltimatumU5Conversation {
  active: boolean;
  /**
   * "talk" para una conversación TLK (mercaderes NO: van por "shop"), "shop"
   * para la consola de tienda, que también se presenta en la misma ventana.
   */
  kind: "talk" | "shop";
  source: string | null;
  npc: string | null;
  askedTopics: readonly string[];
  /**
   * Temas OFRECIBLES ahora mismo: keywords válidas del NPC que el jugador ha
   * oído pronunciar (más name/job/work y `bye`). El host los pinta como botones,
   * de modo que teclear queda sólo para palabras no pronunciadas. Nunca lleva
   * una keyword del .TLK sin descubrir.
   */
  topics: readonly string[];
  /**
   * Palabra completa que reveló cada keyword ofrecible (keyword normalizada ->
   * término oído, p. ej. `abbe` -> `abbey`). El host la pinta en el botón en vez
   * de la abreviatura del .TLK. Aditivo: vacío cuando no hay etiqueta mejor.
   */
  topicLabels: Readonly<Record<string, string>>;
  /**
   * Opciones de la consola de tienda vigentes (vacío en una charla). El jugador
   * las pulsa en vez de teclear una letra de menú.
   */
  options: readonly UltimatumU5ConversationOption[];
  /**
   * Líneas ya pronunciadas por el NPC en la conversación viva, o en la que
   * acaba de terminar (con `active:false`), para que el host las persista como
   * diario con hablante, lugar y tema. Aditivo: ignorarlo no cambia nada.
   */
  passages: readonly UltimatumU5ConversationPassage[];
}

export const EMPTY_U5_CONVERSATION: UltimatumU5Conversation = Object.freeze({
  active: false,
  kind: "talk",
  source: null,
  npc: null,
  askedTopics: Object.freeze([]),
  topics: Object.freeze([]),
  topicLabels: Object.freeze({}),
  options: Object.freeze([]),
  passages: Object.freeze([]),
});

const TERRAIN_PALETTE: readonly number[] = Object.freeze(TILE_INFO.map((_info, tile) => defaultTileColor(tile)));

export type UltimatumU5Action =
  | { type: "move"; direction: "north" | "south" | "east" | "west" }
  | { type: "command"; command: "attack" | "board" | "cast" | "enter" | "fire" | "get" | "hole-up" | "ignite" | "jimmy" | "klimb" | "look" | "mix" | "new-order" | "open" | "push" | "quit" | "ready" | "search" | "talk" | "use" | "view" | "yell" | "ztats" }
  | { type: "cancel" }
  | { type: "confirm" }
  | { type: "text"; value: string }
  | { type: "interact"; id: string }
  | { type: "tap-tile"; x: number; y: number }
  | { type: "raw-key"; key: string };

const WORLD_ACTIONS: readonly UltimatumU5AvailableAction[] = [
  { id: "attack", label: "Attack", group: "primary" }, { id: "board", label: "Board", group: "interaction" },
  { id: "cast", label: "Cast", group: "magic" }, { id: "enter", label: "Enter", group: "interaction" },
  { id: "fire", label: "Fire", group: "interaction" }, { id: "get", label: "Get", group: "interaction" },
  { id: "hole-up", label: "Hole up", group: "utility" }, { id: "jimmy", label: "Jimmy", group: "interaction" },
  { id: "look", label: "Look", group: "interaction" }, { id: "mix", label: "Mix", group: "magic" },
  { id: "new-order", label: "New order", group: "party" }, { id: "open", label: "Open", group: "interaction" },
  { id: "push", label: "Push", group: "interaction" }, { id: "quit", label: "Quit", group: "utility" },
  { id: "ready", label: "Ready", group: "party" }, { id: "talk", label: "Talk", group: "conversation" },
  { id: "use", label: "Use", group: "interaction" }, { id: "view", label: "View", group: "navigation" },
  { id: "yell", label: "Yell", group: "conversation" }, { id: "ztats", label: "Ztats", group: "party" },
];
const DUNGEON_ACTIONS: readonly UltimatumU5AvailableAction[] = [
  { id: "attack", label: "Attack", group: "primary" }, { id: "cast", label: "Cast", group: "magic" },
  { id: "get", label: "Get", group: "interaction" }, { id: "ignite", label: "Ignite", group: "interaction" },
  { id: "klimb", label: "Klimb", group: "interaction" }, { id: "look", label: "Look", group: "interaction" },
  { id: "open", label: "Open", group: "interaction" }, { id: "push", label: "Push", group: "interaction" },
  { id: "ready", label: "Ready", group: "party" }, { id: "search", label: "Search", group: "interaction" },
  { id: "use", label: "Use", group: "interaction" }, { id: "ztats", label: "Ztats", group: "party" },
];
const COMBAT_ACTIONS: readonly UltimatumU5AvailableAction[] = [
  { id: "attack", label: "Attack", group: "primary" }, { id: "cast", label: "Cast", group: "magic" },
  { id: "get", label: "Get", group: "interaction" }, { id: "look", label: "Look", group: "interaction" },
  { id: "ready", label: "Ready", group: "party" }, { id: "use", label: "Use", group: "interaction" },
  { id: "view", label: "View", group: "navigation" }, { id: "ztats", label: "Ztats", group: "party" },
];

const DIRECTIONS: readonly { direction: UltimatumU5Direction; col: number; row: number }[] = [
  { direction: "north", col: 5, row: 4 }, { direction: "east", col: 6, row: 5 },
  { direction: "south", col: 5, row: 6 }, { direction: "west", col: 4, row: 5 },
];

function tileName(tile: number | undefined): string {
  return tile === undefined || tile < 0 ? "" : TILE_INFO[tile]?.name || "";
}

export function contextualActions(view: ViewSnapshot): readonly UltimatumU5ContextAction[] {
  if (view.mode === "combat") return [];
  const options: UltimatumU5ContextAction[] = [];
  for (const { col, row } of [{ col: 5, row: 5 }, ...DIRECTIONS]) {
    const action = contextualActionAt(view, view.center.x - 5 + col, view.center.y - 5 + row);
    if (action && (col === 5 && row === 5 || action.command !== "enter") && !options.some((option) => option.id === action.id)) options.push(action);
  }
  return options;
}

export function contextualActionAt(view: ViewSnapshot, x: number, y: number): UltimatumU5ContextAction | undefined {
  if (view.mode === "combat") return undefined;
  const col = x - (view.center.x - 5);
  const row = y - (view.center.y - 5);
  if (col < 0 || row < 0 || col > 10 || row > 10) return undefined;
  const relative = DIRECTIONS.find((entry) => entry.col === col && entry.row === row);
  const direction = relative?.direction;
  const make = (label: string, command: UltimatumU5Command): UltimatumU5ContextAction => ({
    id: `${command}:${direction || "here"}`,
    label,
    command,
    ...(direction ? { direction } : {}),
  });
  if (view.actors?.some((actor) => actor.id !== "party" && actor.tile >= 320 && actor.tile <= 383 && actor.col === col && actor.row === row)) return make("Talk", "talk");
  const name = tileName((view.terrainWindow || view.window)[row * 11 + col]);
  if (/Sign/.test(name)) return make("Read sign", "look");
  if (view.mode === "world" && /^(Hut|Keep|Village|SmallCastle|LargeCastle|CaveEntrance|MineEntrance|DoomEntrance|Shrine|BrokenShrine|Lighthouse|Oasis|Moongate|EvilCastleEntrance)$/.test(name)) return make("Enter", "enter");
  if (/Door|Portcullis/.test(name)) return make(name.includes("Lock") ? "Jimmy" : "Open", name.includes("Lock") ? "jimmy" : "open");
  if (/Chest|Box$/.test(name)) return make("Open", "open");
  if (/Ship|Skiff|Horse|Carpet/.test(name) && !/^Riding/.test(name)) return make("Board", "board");
  return undefined;
}

export function signLookAction(view: ViewSnapshot, direction: UltimatumU5Direction): UltimatumU5ContextAction | undefined {
  if (view.mode === "combat" || view.awaitingDirection) return undefined;
  const target = DIRECTIONS.find((entry) => entry.direction === direction);
  if (!target) return undefined;
  const action = contextualActionAt(view, view.center.x - 5 + target.col, view.center.y - 5 + target.row);
  return action?.command === "look" && action.label === "Read sign" ? action : undefined;
}

/**
 * Bump-to-interact resolver for Ultima V.
 *
 * A deliberate cardinal movement into an adjacent tile that holds an eligible
 * conversation partner or an unlocked door should express that action instead
 * of reporting blocked movement. It is the U5 counterpart of the Ultima IV
 * `MobileAdjacent` resolver: side-effect free, returning the exact context
 * action an explicit Interact would dispatch so OpenU5's own talk/open rules
 * run unchanged.
 *
 * Conservative by design: world-mode ordinary exploration only; only the exact
 * attempted destination tile (U5 has no talk-over rule); a locked or magic door
 * reuses the engine's Open so it reports "Locked!" without spending a key;
 * chests and other terrain never infer a command.
 */
export function bumpActionFor(view: ViewSnapshot, direction: UltimatumU5Direction): UltimatumU5ContextAction | undefined {
  if (view.mode !== "world") return undefined;
  if (!view.awaitingCommand || view.awaitingDirection || view.awaitingGetstring) return undefined;
  const target = DIRECTIONS.find((entry) => entry.direction === direction);
  if (!target) return undefined;
  const action = contextualActionAt(view, view.center.x - 5 + target.col, view.center.y - 5 + target.row);
  if (!action) return undefined;
  if (action.command === "talk") return action;
  const name = tileName((view.terrainWindow || view.window)[target.row * 11 + target.col]);
  if (!/Door|Portcullis/.test(name)) return undefined;
  if (action.command === "open") return action;
  // A locked or magic door resolves to Jimmy upstream. Bump must not spend a key,
  // so it reuses the engine's Open instead: OpenU5 reports "Locked!" without
  // consuming a key or a turn, giving the locked-door notice rather than the
  // generic blocked message.
  if (action.command === "jimmy") return { id: `locked:${direction}`, label: "Locked door", command: "open", direction };
  return undefined;
}

function primaryAction(view: ViewSnapshot): UltimatumU5PrimaryAction {
  const options = contextualActions(view);
  return { label: options.length === 1 ? options[0]!.label : "Interact", enabled: options.length > 0, options };
}

export function interactionState(view: ViewSnapshot, lifecycle: "running" | "paused" | "stopped", enginePrompt?: UltimatumU5Prompt | null): UltimatumU5InteractionState {
  const actions = view.mode === "dungeon" ? DUNGEON_ACTIONS : view.mode === "combat" ? COMBAT_ACTIONS : WORLD_ACTIONS;
  const unavailable = { label: "Interact", enabled: false, options: [] } as const;
  if (lifecycle !== "running") return { mode: view.mode, prompt: { kind: "busy", label: lifecycle === "paused" ? "Play is paused." : "The session has stopped.", canCancel: false }, availableActions: [], primaryAction: unavailable };
  if (view.awaitingDirection) return { mode: view.mode, prompt: { kind: "direction", label: "Choose a direction.", canCancel: true }, availableActions: [], primaryAction: unavailable };
  if (enginePrompt) return { mode: view.mode, prompt: enginePrompt, availableActions: [], primaryAction: unavailable };
  if (view.awaitingGetstring) return { mode: view.mode, prompt: { kind: "text", label: "Enter the requested response.", canCancel: true }, availableActions: [], primaryAction: unavailable };
  if (view.awaitingCommand) return { mode: view.mode, prompt: { kind: "command", label: `${view.mode.charAt(0).toUpperCase()}${view.mode.slice(1)} commands ready.`, canCancel: false }, availableActions: actions, primaryAction: primaryAction(view) };
  return { mode: view.mode, prompt: { kind: "busy", label: "The game is busy.", canCancel: false }, availableActions: [], primaryAction: unavailable };
}

export interface UltimatumU5Dispatch {
  sequence: number;
  action: UltimatumU5Action;
}

export interface UltimatumU5Checkpoint {
  engine: "openu5";
  game: "ultima5";
  payloadFormat: "openu5-state-json-v1";
  payload: string;
}

export interface UltimatumU5Snapshot {
  contractVersion: typeof ULTIMATUM_U5_SESSION_CONTRACT;
  revision: number;
  lastSequence: number;
  lifecycle: "running" | "paused" | "stopped";
  view: ViewSnapshot;
  interaction: UltimatumU5InteractionState;
  conversation: UltimatumU5Conversation;
  terrainPalette: readonly number[];
}

export interface UltimatumU5DispatchResult {
  accepted: boolean;
  duplicate: boolean;
  reason?: "paused" | "stopped" | "sequence-gap" | "invalid-text" | "invalid-context";
  snapshot: UltimatumU5Snapshot;
}

export interface UltimatumU5SessionBridge {
  readonly contractVersion: typeof ULTIMATUM_U5_SESSION_CONTRACT;
  snapshot(): UltimatumU5Snapshot;
  subscribe(listener: (snapshot: UltimatumU5Snapshot) => void): () => void;
  dispatch(request: UltimatumU5Dispatch): UltimatumU5DispatchResult;
  checkpoint(): UltimatumU5Checkpoint;
  validateCheckpoint(checkpoint: UltimatumU5Checkpoint): void;
  restoreCheckpoint(checkpoint: UltimatumU5Checkpoint): UltimatumU5Snapshot;
  pause(): UltimatumU5Snapshot;
  quiesce(): { snapshot: UltimatumU5Snapshot; checkpoint: UltimatumU5Checkpoint };
  resume(): UltimatumU5Snapshot;
  shutdown(): void;
}

export interface UltimatumU5SessionDependencies {
  view: CoreView;
  dispatchAction(action: UltimatumU5Action): void;
  dispatchContextAction(action: UltimatumU5ContextAction): void;
  serializeState(): string;
  validateState(payload: string): void;
  restoreState(payload: string): void;
  cancelTransientInput(): void;
  promptState?(): UltimatumU5Prompt | null;
  conversationState?(): UltimatumU5Conversation | null;
  onShutdown?(): void;
}

export function createUltimatumU5SessionBridge(
  deps: UltimatumU5SessionDependencies,
): UltimatumU5SessionBridge {
  let revision = 0;
  let lastSequence = 0;
  let lifecycle: UltimatumU5Snapshot["lifecycle"] = "running";
  const listeners = new Set<(snapshot: UltimatumU5Snapshot) => void>();
  let viewPublishQueued = false;

  const snapshot = (): UltimatumU5Snapshot => {
    const view = deps.view.snapshot();
    return { contractVersion: ULTIMATUM_U5_SESSION_CONTRACT, revision, lastSequence, lifecycle, view, interaction: interactionState(view, lifecycle, deps.promptState?.()), conversation: deps.conversationState?.() ?? EMPTY_U5_CONVERSATION, terrainPalette: TERRAIN_PALETTE };
  };

  const publishViewChange = (): void => {
    if (lifecycle === "stopped" || viewPublishQueued) return;
    viewPublishQueued = true;
    queueMicrotask(() => {
      viewPublishQueued = false;
      if (lifecycle === "stopped") return;
      revision += 1;
      const next = snapshot();
      for (const listener of listeners) listener(next);
    });
  };
  // Combat and other engine-owned sequences continue after the initiating key
  // returns. CoreView is the authoritative notification stream for those turns;
  // forwarding it prevents a host from remaining stuck on the interim busy state.
  const unsubscribeView = deps.view.subscribe?.({
    onTurn: publishViewChange,
    onConsole: publishViewChange,
    onDirty: publishViewChange,
  });

  const validateCheckpoint = (checkpoint: UltimatumU5Checkpoint): void => {
    if (!checkpoint || checkpoint.engine !== "openu5" || checkpoint.game !== "ultima5" ||
        checkpoint.payloadFormat !== "openu5-state-json-v1" || typeof checkpoint.payload !== "string") {
      throw new Error("Ultimatum checkpoint is not compatible with this Ultima V port.");
    }
    deps.validateState(checkpoint.payload);
  };

  return {
    contractVersion: ULTIMATUM_U5_SESSION_CONTRACT,
    snapshot,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    dispatch(request) {
      if (request.sequence <= lastSequence) {
        return { accepted: false, duplicate: true, snapshot: snapshot() };
      }
      if (request.sequence !== lastSequence + 1) {
        return { accepted: false, duplicate: false, reason: "sequence-gap", snapshot: snapshot() };
      }
      if (lifecycle !== "running") {
        return { accepted: false, duplicate: false, reason: lifecycle, snapshot: snapshot() };
      }
      if (request.action.type === "text" && request.action.value.length !== 1) {
        return { accepted: false, duplicate: false, reason: "invalid-text", snapshot: snapshot() };
      }
      if (request.action.type === "interact") {
        const contextActionId = request.action.id;
        const option = contextualActions(deps.view.snapshot()).find((candidate) => candidate.id === contextActionId);
        if (!option) return { accepted: false, duplicate: false, reason: "invalid-context", snapshot: snapshot() };
        deps.dispatchContextAction(option);
      } else deps.dispatchAction(request.action);
      lastSequence = request.sequence;
      revision += 1;
      return { accepted: true, duplicate: false, snapshot: snapshot() };
    },
    checkpoint: () => ({
      engine: "openu5",
      game: "ultima5",
      payloadFormat: "openu5-state-json-v1",
      payload: deps.serializeState(),
    }),
    validateCheckpoint,
    restoreCheckpoint(checkpoint) {
      validateCheckpoint(checkpoint);
      deps.cancelTransientInput();
      deps.restoreState(checkpoint.payload);
      revision += 1;
      return snapshot();
    },
    pause() {
      if (lifecycle === "running") lifecycle = "paused";
      return snapshot();
    },
    quiesce() {
      deps.cancelTransientInput();
      if (lifecycle === "running") lifecycle = "paused";
      return { snapshot: snapshot(), checkpoint: this.checkpoint() };
    },
    resume() {
      if (lifecycle === "paused") lifecycle = "running";
      return snapshot();
    },
    shutdown() {
      if (lifecycle === "stopped") return;
      deps.cancelTransientInput();
      lifecycle = "stopped";
      unsubscribeView?.();
      listeners.clear();
      deps.onShutdown?.();
    },
  };
}

declare global {
  interface Window {
    __ultimatumU5?: UltimatumU5SessionBridge;
  }
}

export function installUltimatumU5SessionBridge(
  win: Window,
  deps: UltimatumU5SessionDependencies,
): UltimatumU5SessionBridge {
  const bridge = createUltimatumU5SessionBridge({
    ...deps,
    onShutdown: () => {
      delete win.document.documentElement.dataset.ultimatumU5Contract;
      delete win.__ultimatumU5;
      deps.onShutdown?.();
    },
  });
  Object.defineProperty(win, "__ultimatumU5", {
    configurable: true,
    enumerable: false,
    value: bridge,
    writable: false,
  });
  win.document.documentElement.dataset.ultimatumU5Contract = String(ULTIMATUM_U5_SESSION_CONTRACT);
  return bridge;
}
