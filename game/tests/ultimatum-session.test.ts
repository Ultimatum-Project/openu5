import { describe, expect, it, vi } from "vitest";
import type { CoreView, ViewListener, ViewSnapshot } from "../src/skin/api.js";
import type { UltimatumU5Action, UltimatumU5ContextAction } from "../src/host/ultimatum-session.js";
import { bumpActionFor, contextualActionAt, contextualActions, createUltimatumU5SessionBridge, installUltimatumU5SessionBridge, interactionState, signLookAction } from "../src/host/ultimatum-session.js";

const visible = {
  mode: "world",
  window: new Int16Array(121),
  center: { x: 10, y: 20 },
  console: [],
  awaitingInput: true,
  awaitingCommand: true,
  awaitingDirection: false,
  awaitingGetstring: false,
  party: [],
  activeCharacter: 0,
} as unknown as ViewSnapshot;

function fixture() {
  const dispatched: UltimatumU5Action[] = [];
  const contextDispatched: UltimatumU5ContextAction[] = [];
  const cancelTransientInput = vi.fn();
  const validateState = vi.fn((payload: string) => JSON.parse(payload));
  const restoreState = vi.fn();
  const bridge = createUltimatumU5SessionBridge({
    view: { snapshot: () => visible } as unknown as CoreView,
    dispatchAction: (action) => dispatched.push(action),
    dispatchContextAction: (action) => contextDispatched.push(action),
    serializeState: () => '{"version":1,"position":{"x":10,"y":20}}',
    validateState,
    restoreState,
    cancelTransientInput,
  });
  return { bridge, dispatched, contextDispatched, cancelTransientInput, validateState, restoreState };
}

describe("Ultimatum U5 session bridge", () => {
  it("dispatches semantic actions without synthesizing keyboard intents", () => {
    const { bridge, dispatched } = fixture();
    expect(bridge.dispatch({ sequence: 1, action: { type: "move", direction: "south" } }).accepted).toBe(true);
    expect(bridge.dispatch({ sequence: 2, action: { type: "command", command: "look" } }).accepted).toBe(true);
    expect(bridge.dispatch({ sequence: 3, action: { type: "cancel" } }).accepted).toBe(true);
    expect(dispatched).toEqual([
      { type: "move", direction: "south" },
      { type: "command", command: "look" },
      { type: "cancel" },
    ]);
    expect(bridge.snapshot()).toMatchObject({ contractVersion: 5, revision: 3, lastSequence: 3, lifecycle: "running" });
  });

  it("makes retries idempotent and rejects sequence gaps", () => {
    const { bridge, dispatched } = fixture();
    bridge.dispatch({ sequence: 1, action: { type: "move", direction: "east" } });
    expect(bridge.dispatch({ sequence: 1, action: { type: "move", direction: "west" } })).toMatchObject({ accepted: false, duplicate: true });
    expect(bridge.dispatch({ sequence: 3, action: { type: "move", direction: "west" } })).toMatchObject({ accepted: false, duplicate: false, reason: "sequence-gap" });
    expect(dispatched).toEqual([{ type: "move", direction: "east" }]);
  });

  it("publishes combat readiness when engine-owned enemy turns finish", async () => {
    let current = { ...visible, mode: "combat", awaitingCommand: true } as ViewSnapshot;
    let viewListener: Pick<ViewListener, "onTurn"> | undefined;
    const unsubscribe = vi.fn();
    const bridge = createUltimatumU5SessionBridge({
      view: {
        snapshot: () => current,
        subscribe: (listener: ViewListener) => { viewListener = listener; return unsubscribe; },
      } as unknown as CoreView,
      dispatchAction: () => undefined,
      dispatchContextAction: () => undefined,
      serializeState: () => "{}",
      validateState: () => undefined,
      restoreState: () => undefined,
      cancelTransientInput: () => undefined,
    });
    const prompts: string[] = [];
    bridge.subscribe((snapshot) => prompts.push(snapshot.interaction.prompt.kind));
    current = { ...current, awaitingCommand: false } as ViewSnapshot;
    viewListener?.onTurn?.([]);
    await Promise.resolve();
    current = { ...current, awaitingCommand: true } as ViewSnapshot;
    viewListener?.onTurn?.([]);
    await Promise.resolve();
    expect(prompts).toEqual(["busy", "command"]);
    expect(bridge.snapshot()).toMatchObject({ revision: 2, interaction: { prompt: { kind: "command" } } });
    bridge.shutdown();
    expect(unsubscribe).toHaveBeenCalledOnce();
  });

  it("quiesces before checkpointing and blocks input until resumed", () => {
    const { bridge, dispatched, cancelTransientInput } = fixture();
    const result = bridge.quiesce();
    expect(cancelTransientInput).toHaveBeenCalledOnce();
    expect(result.snapshot.lifecycle).toBe("paused");
    expect(result.checkpoint).toEqual({
      engine: "openu5",
      game: "ultima5",
      payloadFormat: "openu5-state-json-v1",
      payload: '{"version":1,"position":{"x":10,"y":20}}',
    });
    expect(bridge.dispatch({ sequence: 1, action: { type: "cancel" } })).toMatchObject({ accepted: false, reason: "paused" });
    bridge.resume();
    expect(bridge.dispatch({ sequence: 1, action: { type: "cancel" } }).accepted).toBe(true);
    expect(dispatched).toEqual([{ type: "cancel" }]);
  });

  it("validates identity and restores through the engine-owned load path", () => {
    const { bridge, cancelTransientInput, validateState, restoreState } = fixture();
    const checkpoint = bridge.checkpoint();
    expect(bridge.restoreCheckpoint(checkpoint)).toMatchObject({ revision: 1, lifecycle: "running" });
    expect(validateState).toHaveBeenCalledWith(checkpoint.payload);
    expect(restoreState).toHaveBeenCalledWith(checkpoint.payload);
    expect(cancelTransientInput).toHaveBeenCalledOnce();
    expect(() => bridge.restoreCheckpoint({ ...checkpoint, game: "ultima4" } as never)).toThrow(/not compatible/);
  });

  it("publishes and removes the shell readiness marker", () => {
    const dataset: DOMStringMap = {};
    const win = { document: { documentElement: { dataset } } } as unknown as Window;
    const installed = installUltimatumU5SessionBridge(win, {
      view: { snapshot: () => visible } as unknown as CoreView,
      dispatchAction: () => undefined,
      dispatchContextAction: () => undefined,
      serializeState: () => "{}",
      validateState: () => undefined,
      restoreState: () => undefined,
      cancelTransientInput: () => undefined,
    });
    expect(dataset.ultimatumU5Contract).toBe("5");
    expect(win.__ultimatumU5).toBe(installed);
    installed.shutdown();
    expect(dataset.ultimatumU5Contract).toBeUndefined();
    expect(win.__ultimatumU5).toBeUndefined();
  });

  it("publishes normalized prompt and action descriptors for each engine mode", () => {
    const world = interactionState(visible, "running");
    expect(world.prompt).toEqual({ kind: "command", label: "World commands ready.", canCancel: false });
    expect(world.availableActions.find((action) => action.id === "talk")).toEqual({ id: "talk", label: "Talk", group: "conversation" });
    expect(world.availableActions.find((action) => action.id === "open")?.group).toBe("interaction");
    expect(world.primaryAction).toEqual({ label: "Interact", enabled: false, options: [] });
    const direction = interactionState({ ...visible, awaitingDirection: true } as ViewSnapshot, "running");
    expect(direction).toMatchObject({ prompt: { kind: "direction", canCancel: true }, availableActions: [] });
    const text = interactionState({ ...visible, awaitingCommand: false, awaitingGetstring: true } as ViewSnapshot, "running");
    expect(text).toMatchObject({ prompt: { kind: "text", canCancel: true }, availableActions: [] });
    const yesNo = interactionState({ ...visible, awaitingCommand: false, awaitingGetstring: true } as ViewSnapshot, "running", {
      kind: "choice", label: "Wilt thou leave?", canCancel: true,
      options: [{ id: "yes", label: "Yes", keys: ["y"] }, { id: "no", label: "No", keys: ["n"] }],
    });
    expect(yesNo).toMatchObject({ prompt: { kind: "choice", label: "Wilt thou leave?", options: [{ keys: ["y"] }, { keys: ["n"] }] }, availableActions: [] });
    const combat = interactionState({ ...visible, mode: "combat" } as ViewSnapshot, "running");
    expect(combat.availableActions.map((action) => action.id)).toContain("attack");
    expect(combat.availableActions.map((action) => action.id)).not.toContain("talk");
    expect(interactionState(visible, "paused")).toMatchObject({ prompt: { kind: "busy", canCancel: false }, availableActions: [] });
  });

  it("publishes and validates an engine-owned contextual primary action", () => {
    const withNpc = { ...visible, actors: [{ id: "npc-1", tile: 336, col: 5, row: 4 }] } as ViewSnapshot;
    expect(contextualActions(withNpc)).toEqual([{ id: "talk:north", label: "Talk", command: "talk", direction: "north" }]);
    const contextDispatched: UltimatumU5ContextAction[] = [];
    const bridge = createUltimatumU5SessionBridge({
      view: { snapshot: () => withNpc } as unknown as CoreView,
      dispatchAction: () => undefined,
      dispatchContextAction: (action) => contextDispatched.push(action),
      serializeState: () => "{}",
      validateState: () => undefined,
      restoreState: () => undefined,
      cancelTransientInput: () => undefined,
    });
    expect(bridge.dispatch({ sequence: 1, action: { type: "interact", id: "talk:north" } }).accepted).toBe(true);
    expect(contextDispatched).toEqual([{ id: "talk:north", label: "Talk", command: "talk", direction: "north" }]);
    expect(bridge.dispatch({ sequence: 2, action: { type: "interact", id: "open:south" } })).toMatchObject({ accepted: false, reason: "invalid-context" });
  });

  it("derives context from underlying terrain and never treats monsters as conversation targets", () => {
    const terrain = new Int16Array(121);
    terrain[5 * 11 + 5] = 16; // Hut; the painted window center is occupied by the Avatar.
    const atEntrance = { ...visible, terrainWindow: terrain, actors: [{ id: "rat-1", tile: 400, col: 5, row: 4 }] } as ViewSnapshot;
    expect(contextualActions(atEntrance)).toEqual([{ id: "enter:here", label: "Enter", command: "enter" }]);
  });

  it("offers an engine-owned read action when the party nudges a sign", () => {
    const terrain = new Int16Array(121);
    terrain[5 * 11 + 6] = 160; // Sign, immediately east.
    const bySign = { ...visible, terrainWindow: terrain } as ViewSnapshot;
    expect(signLookAction(bySign, "east")).toEqual({ id: "look:east", label: "Read sign", command: "look", direction: "east" });
    expect(signLookAction(bySign, "west")).toBeUndefined();
    expect(contextualActions(bySign)).toContainEqual({ id: "look:east", label: "Read sign", command: "look", direction: "east" });
  });

  it("bumps into an adjacent conversable person to begin talking", () => {
    const withNpc = { ...visible, actors: [{ id: "npc-1", tile: 336, col: 5, row: 4 }] } as ViewSnapshot;
    expect(bumpActionFor(withNpc, "north")).toEqual({ id: "talk:north", label: "Talk", command: "talk", direction: "north" });
    expect(bumpActionFor(withNpc, "south")).toBeUndefined();
    const twoTilesAway = { ...visible, actors: [{ id: "npc-1", tile: 336, col: 7, row: 5 }] } as ViewSnapshot;
    expect(bumpActionFor(twoTilesAway, "east")).toBeUndefined();
  });

  it("bumps an unlocked door open but never a locked door, chest, or empty tile", () => {
    const terrain = new Int16Array(121);
    terrain[5 * 11 + 6] = 184; // RegularDoor, immediately east.
    expect(bumpActionFor({ ...visible, terrainWindow: terrain } as ViewSnapshot, "east")).toEqual({ id: "open:east", label: "Open", command: "open", direction: "east" });
    for (const tile of [185 /* LockedDoor */, 151 /* MagicLockDoor */, 257 /* Chest */, 0]) {
      const other = new Int16Array(121);
      other[5 * 11 + 6] = tile;
      expect(bumpActionFor({ ...visible, terrainWindow: other } as ViewSnapshot, "east")).toBeUndefined();
    }
  });

  it("bumps only during ordinary world exploration", () => {
    const withNpc = { ...visible, actors: [{ id: "npc-1", tile: 336, col: 5, row: 4 }] } as ViewSnapshot;
    expect(bumpActionFor({ ...withNpc, mode: "dungeon" } as ViewSnapshot, "north")).toBeUndefined();
    expect(bumpActionFor({ ...withNpc, mode: "combat" } as ViewSnapshot, "north")).toBeUndefined();
    expect(bumpActionFor({ ...withNpc, awaitingDirection: true } as ViewSnapshot, "north")).toBeUndefined();
    expect(bumpActionFor({ ...withNpc, awaitingCommand: false, awaitingGetstring: true } as ViewSnapshot, "north")).toBeUndefined();
  });

  it("publishes the engine terrain palette for faithful exploration-map colors", () => {
    const { bridge } = fixture();
    expect(bridge.snapshot().terrainPalette[5]).toBe(0x2e7d32);
  });

  it("identifies a visible tapped interaction target without inventing a direction", () => {
    const withNpc = { ...visible, actors: [{ id: "npc-1", tile: 336, col: 8, row: 5 }] } as ViewSnapshot;
    expect(contextualActionAt(withNpc, 13, 20)).toEqual({ id: "talk:here", label: "Talk", command: "talk" });
    expect(contextualActionAt(withNpc, 10, 19)).toBeUndefined();
  });
});
