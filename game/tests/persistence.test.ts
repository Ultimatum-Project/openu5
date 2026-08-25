/**
 * Tests de guardado libre. Vitest corre en node sin `localStorage`, así que
 * instalamos un stub síncrono basado en Map antes de cada test.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createNewGame, type ExtractedInitialState, type GameState } from "../src/core/state.js";
import {
  listSaves,
  saveGame,
  loadGame,
  loadMostRecentSave,
  deleteSave,
  autosave,
  installMomentoSave,
  importNativeSaveFiles,
  type SaveMeta,
  type SaveResult,
} from "../src/core/persistence.js";
import { exportNativeSave, SAVED_GAM_SIZE } from "../src/core/saveNative.js";
import { U5GAM_MARKER } from "../src/core/u5gam.js";

/** Desempaqueta un guardado exitoso; falla el test si devolvió error. */
function expectSaved(res: SaveResult): SaveMeta {
  if (!res.ok) throw new Error(`se esperaba un guardado ok, fue: ${res.reason}`);
  return res.meta;
}

class LocalStorageStub {
  private store = new Map<string, string>();
  getItem(key: string): string | null {
    return this.store.has(key) ? this.store.get(key)! : null;
  }
  setItem(key: string, value: string): void {
    this.store.set(key, String(value));
  }
  removeItem(key: string): void {
    this.store.delete(key);
  }
  clear(): void {
    this.store.clear();
  }
  key(i: number): string | null {
    return [...this.store.keys()][i] ?? null;
  }
  get length(): number {
    return this.store.size;
  }
}

function freshState(): GameState {
  const path = fileURLToPath(new URL("../assets/initial-state.json", import.meta.url));
  const init = JSON.parse(readFileSync(path, "utf8")) as ExtractedInitialState;
  return createNewGame(init);
}

beforeEach(() => {
  (globalThis as { localStorage: Storage }).localStorage =
    new LocalStorageStub() as unknown as Storage;
});

describe("saveGame / listSaves / loadGame / deleteSave", () => {
  it("hace round-trip completo de un GameState real", () => {
    const state = freshState();
    state.gold = 999;
    state.turnsSinceStart = 42;

    expect(listSaves()).toHaveLength(0);
    const meta = expectSaved(saveGame(state, "Before the dungeon", "Britannia"));
    expect(meta.name).toBe("Before the dungeon");
    expect(meta.locationName).toBe("Britannia");
    expect(meta.turns).toBe(42);

    const list = listSaves();
    expect(list).toHaveLength(1);
    expect(list[0]!.id).toBe(meta.id);

    const loaded = loadGame(meta.id);
    expect(loaded.gold).toBe(999);
    expect(loaded.turnsSinceStart).toBe(42);
    expect(loaded.characters).toHaveLength(state.characters.length);

    deleteSave(meta.id);
    expect(listSaves()).toHaveLength(0);
    expect(() => loadGame(meta.id)).toThrow();
  });

  it("mantiene varios slots independientes ordenados por recencia", () => {
    const state = freshState();
    const a = expectSaved(saveGame(state, "Slot A", "Iolo's Hut"));
    const b = expectSaved(saveGame(state, "Slot B", "Britain"));
    const list = listSaves();
    expect(list).toHaveLength(2);
    expect(new Set(list.map((m) => m.id))).toEqual(new Set([a.id, b.id]));
    // El más reciente primero.
    expect(list[0]!.timestamp).toBeGreaterThanOrEqual(list[1]!.timestamp);
  });
});

describe("persistencia de overworldEnemies (#49)", () => {
  it("round-trip: guarda con N enemigos → carga → lista idéntica campo a campo", () => {
    const state = freshState();
    state.overworldEnemies = [
      { defIndex: 4, tile: 0x94, water: false, x: 84, y: 108 },
      // Nave NPC pirata: su casco (obj+5) también debe sobrevivir.
      { defIndex: 8, tile: 0x2c, water: true, x: 90, y: 110, hull: 100 },
    ];

    const meta = expectSaved(saveGame(state, "con un dragón detrás", "Britannia"));
    const loaded = loadGame(meta.id);

    expect(loaded.overworldEnemies).toEqual(state.overworldEnemies);
    expect(loaded.overworldEnemies![1]!.hull).toBe(100);
  });

  it("save viejo sin la sección de enemigos carga como lista vacía (compat)", () => {
    const state = freshState();
    state.overworldEnemies = [{ defIndex: 4, tile: 0x94, water: false, x: 1, y: 2 }];
    const meta = expectSaved(saveGame(state, "pre-fix", "Britannia"));

    // Simula un save anterior al fix: borra el campo del JSON crudo del slot.
    const key = `u5clone:save:${meta.id}`;
    const raw = JSON.parse(localStorage.getItem(key)!);
    delete raw.overworldEnemies;
    localStorage.setItem(key, JSON.stringify(raw));

    expect(loadGame(meta.id).overworldEnemies).toEqual([]);
  });
});

describe("loadMostRecentSave (Journey Onward = cargar SAVED.GAM, #28)", () => {
  // Reloj monótono para que cada guardado tenga un timestamp estrictamente creciente
  // (evita empates de Date.now() entre escrituras rápidas en el mismo ms).
  let clock = 1_000_000;
  beforeEach(() => {
    clock = 1_000_000;
    vi.spyOn(Date, "now").mockImplementation(() => (clock += 1000));
  });
  afterEach(() => vi.restoreAllMocks());

  it("sin ningún save → null (arranque fresco)", () => {
    expect(loadMostRecentSave()).toBeNull();
  });

  it("devuelve el slot con mayor timestamp (manual escrito DESPUÉS del autosave)", () => {
    const s1 = freshState();
    s1.gold = 111;
    autosave(s1, "Autosave viejo"); // t = 1_001_000

    const s2 = freshState();
    s2.gold = 222;
    s2.turnsSinceStart = 99;
    const manual = expectSaved(saveGame(s2, "Manual reciente", "Britain")); // t mayor

    expect(listSaves()[0]!.id).toBe(manual.id);
    const loaded = loadMostRecentSave();
    expect(loaded).not.toBeNull();
    expect(loaded!.gold).toBe(222);
    expect(loaded!.turnsSinceStart).toBe(99);
  });

  it("un autosave posterior gana a un manual anterior", () => {
    const older = freshState();
    older.gold = 1;
    expectSaved(saveGame(older, "Manual antiguo", "Iolo's Hut")); // t menor

    const newer = freshState();
    newer.gold = 2;
    autosave(newer, "Autosave nuevo"); // t mayor

    const loaded = loadMostRecentSave();
    expect(loaded!.gold).toBe(2);
  });
});

describe("autosave", () => {
  it("rota entre 3 slots round-robin", () => {
    const state = freshState();
    autosave(state, "L1");
    autosave(state, "L2");
    autosave(state, "L3");
    let ids = listSaves().map((m) => m.id).sort();
    expect(ids).toEqual(["autosave-1", "autosave-2", "autosave-3"]);
    expect(listSaves()).toHaveLength(3);

    // La 4ª vuelta reutiliza autosave-1 sin crear un slot nuevo.
    autosave(state, "L4");
    ids = listSaves().map((m) => m.id).sort();
    expect(ids).toEqual(["autosave-1", "autosave-2", "autosave-3"]);
    expect(listSaves().find((m) => m.id === "autosave-1")!.locationName).toBe("L4");
  });
});

describe("QuotaExceededError (hallazgo soak #35)", () => {
  /** Fuerza que las escrituras de slot (`u5clone:save:*`) lancen quota. */
  function fillStorageOnSlotWrites(): void {
    const stub = localStorage as unknown as LocalStorageStub;
    const realSet = stub.setItem.bind(stub);
    stub.setItem = (key: string, value: string): void => {
      if (key.startsWith("u5clone:save:")) {
        throw new DOMException("localStorage is full", "QuotaExceededError");
      }
      realSet(key, value);
    };
  }

  it("saveGame con storage lleno devuelve error, no lanza", () => {
    const state = freshState();
    fillStorageOnSlotWrites();

    let res: SaveResult | undefined;
    expect(() => {
      res = saveGame(state, "no cabe", "Britannia");
    }).not.toThrow();

    expect(res).toEqual({ ok: false, reason: "quota" });
    // No dejó una entrada de índice colgando de un slot que no se escribió.
    expect(listSaves()).toHaveLength(0);
  });

  it("autosave (arranque) con storage lleno devuelve error, no lanza — el boot puede seguir", () => {
    const state = freshState();
    fillStorageOnSlotWrites();

    let res: SaveResult | undefined;
    expect(() => {
      res = autosave(state, "Overworld");
    }).not.toThrow();

    expect(res).toEqual({ ok: false, reason: "quota" });
  });

  it("un autosave previo bueno sobrevive a un autosave posterior que falla por quota", () => {
    const state = freshState();
    const good = autosave(state, "Antes");
    expect(good.ok).toBe(true);

    fillStorageOnSlotWrites();
    const failed = autosave(state, "Después");
    expect(failed.ok).toBe(false);

    // El slot bueno sigue cargando (setItem atómico: al lanzar no pisa el valor).
    expect(listSaves().length).toBeGreaterThan(0);
    expect(() => loadGame(listSaves()[0]!.id)).not.toThrow();
  });
});

describe("escritura transaccional cuerpo+índice y puntero del autosave (ficha #236)", () => {
  /** Todas las claves del stub que empiezan por un prefijo (esperados en crudo). */
  function keysConPrefijo(prefix: string): string[] {
    const stub = localStorage as unknown as LocalStorageStub;
    const out: string[] = [];
    for (let i = 0; i < stub.length; i++) {
      const k = stub.key(i)!;
      if (k.startsWith(prefix)) out.push(k);
    }
    return out;
  }

  /** Hace que el setItem del ÍNDICE (`u5clone:saves`) lance quota; el resto pasa. */
  function quotaSoloEnIndice(): void {
    const stub = localStorage as unknown as LocalStorageStub;
    const realSet = stub.setItem.bind(stub);
    stub.setItem = (key: string, value: string): void => {
      if (key === "u5clone:saves") {
        throw new DOMException("localStorage is full", "QuotaExceededError");
      }
      realSet(key, value);
    };
  }

  /** Hace que el setItem de los SLOTS (`u5clone:save:*`) lance quota; índice y puntero pasan. */
  function quotaSoloEnSlots(): () => void {
    const stub = localStorage as unknown as LocalStorageStub;
    const realSet = stub.setItem.bind(stub);
    stub.setItem = (key: string, value: string): void => {
      if (key.startsWith("u5clone:save:")) {
        throw new DOMException("localStorage is full", "QuotaExceededError");
      }
      realSet(key, value);
    };
    return () => {
      stub.setItem = realSet;
    };
  }

  it("defecto 1: si el ÍNDICE revienta por cuota, la ranura NUEVA no queda huérfana", () => {
    const state = freshState();
    quotaSoloEnIndice();

    const res = saveGame(state, "no cabe el índice", "Britannia");
    expect(res).toEqual({ ok: false, reason: "quota" });

    // Sin transacción, el cuerpo ya escrito se queda: bytes en `u5clone:save:<id>` que
    // el índice no lista (fuga de cuota invisible). Con el fix: CERO claves de slot.
    expect(keysConPrefijo("u5clone:save:")).toEqual([]);
    expect(listSaves()).toHaveLength(0);
  });

  it("defecto 1 (upsert): si el índice revienta, el CUERPO ANTERIOR del slot se restaura", () => {
    // Id FIJO (el del momento) para ejercitar el pisado del MISMO slot: con autosave no
    // se puede, porque la rotación mueve el fallo a otra ranura y el cuerpo viejo queda
    // intacto por casualidad, no por transacción.
    const v1 = freshState();
    v1.gold = 111;
    const first = installMomentoSave("momento-01", v1, "Momento", "Britannia");
    expect(first.ok).toBe(true);

    quotaSoloEnIndice();
    const v2 = freshState();
    v2.gold = 222;
    const failed = installMomentoSave("momento-01", v2, "Momento", "Britannia");
    expect(failed).toEqual({ ok: false, reason: "quota" });

    // El índice sigue con la cabecera vieja; el cuerpo debe seguir siendo el VIEJO:
    // una cabecera de la v1 apuntando a un estado de la v2 sería un dato plausible
    // en el sitio equivocado.
    expect(loadGame("momento-01").gold).toBe(111);
  });

  it("defecto 2: un autosave que FALLA no consume el puntero rotatorio", () => {
    const state = freshState();
    const restore = quotaSoloEnSlots();

    const failed = autosave(state, "Overworld");
    expect(failed).toEqual({ ok: false, reason: "quota" });
    // El puntero NO se consumió: sigue sin existir (nunca se escribió).
    expect(localStorage.getItem("u5clone:autosavePtr")).toBeNull();

    // Al volver el hueco, el retry escribe la MISMA ranura que falló (autosave-1),
    // no la siguiente de la rotación.
    restore();
    const ok = autosave(state, "Overworld");
    expect(ok.ok).toBe(true);
    expect(listSaves().map((m) => m.id)).toEqual(["autosave-1"]);
    expect(localStorage.getItem("u5clone:autosavePtr")).toBe("1");
  });

  it("control positivo: sin cuota, el puntero avanza tras cada autosave bueno", () => {
    const state = freshState();
    autosave(state, "L1");
    expect(localStorage.getItem("u5clone:autosavePtr")).toBe("1");
    autosave(state, "L2");
    expect(localStorage.getItem("u5clone:autosavePtr")).toBe("2");
  });
});

describe("guardado NATIVO — SAVED.GAM + sidecar (task #27 B3)", () => {
  const blankTemplate = (): Uint8Array => new Uint8Array(SAVED_GAM_SIZE);
  const asFile = (u8: Uint8Array, name: string): File =>
    new File([u8.buffer as ArrayBuffer], name);

  it("importNativeSaveFiles reconstruye el GameState desde .GAM + sidecar", async () => {
    const state = freshState();
    state.gold = 4242;
    state.position = { location: 8, floor: 0, x: 20, y: 21 };
    const { gam, sidecar } = exportNativeSave(state, blankTemplate());
    const { state: loaded, sidecarSource } = await importNativeSaveFiles(
      asFile(gam, "SAVED.GAM"),
      new File([JSON.stringify(sidecar)], "SAVED.sidecar.json"),
    );
    expect(sidecarSource).toBe("file");
    expect(loaded.gold).toBe(4242);
    expect(loaded.position).toEqual({ location: 8, floor: 0, x: 20, y: 21 });
    expect(loaded.characters[0]!.name).toBe(state.characters[0]!.name);
    expect(loaded.partySize).toBe(state.partySize);
    expect(loaded.transport).toBe(state.transport);
  });

  it("carga un .GAM SIN sidecar (save del original) con defaults de partida nueva", async () => {
    const state = freshState();
    const { gam } = exportNativeSave(state, blankTemplate());
    const { state: loaded, sidecarSource } = await importNativeSaveFiles(asFile(gam, "SAVED.GAM"));
    expect(sidecarSource).toBe("none");
    expect(loaded.gold).toBe(state.gold);
    expect(loaded.transport).toBe("foot"); // default sin sidecar
    expect(loaded.journal).toEqual([]);
    expect(loaded.questFlags).toEqual({});
  });

  it("rechaza un .GAM de tamaño inválido", async () => {
    await expect(
      importNativeSaveFiles(asFile(new Uint8Array(100), "SAVED.GAM")),
    ).rejects.toThrow(/inválido/);
  });

  // ── EL `.u5gam`: los mismos 4192 B con el SOBRE pegado detrás (#229) ────────────────
  // 🔴 EL TESTIGO INSTANCIA LA DIFERENCIA DONDE EXISTE: lleva a propósito una bandera de
  // TRAMA (`shadowlord-dead:*`) y un diario, que son justo lo que el formato de 1988 NO
  // sabe guardar. Con un estado sin ellos, el test pasaría igual con el sobre ignorado —
  // sería verde por el testigo, no por el código. El CONTROL de abajo lo demuestra: los
  // MISMOS bytes sin la marca dan `none` y pierden las dos cosas.
  const conSobre = (gam: Uint8Array, sidecar: unknown): Uint8Array => {
    const cola = new TextEncoder().encode(
      U5GAM_MARKER +
        JSON.stringify({ formato: "openu5-partida", version: 1, meta: {}, sidecar }),
    );
    const out = new Uint8Array(gam.length + cola.length);
    out.set(gam, 0);
    out.set(cola, gam.length);
    return out;
  };

  it("un .u5gam trae su sidecar EN EL SOBRE: la trama y el diario sobreviven", async () => {
    const state = freshState();
    state.questFlags = { "shadowlord-dead:falsehood": true };
    state.journal = [{ turn: 7, location: 0, npc: "Testigo", text: "una linea de diario" }];
    const { gam, sidecar } = exportNativeSave(state, blankTemplate());
    const { state: loaded, sidecarSource } = await importNativeSaveFiles(
      asFile(conSobre(gam, sidecar), "Testigo-Britannia-2026-08-14.u5gam"),
    );
    expect(sidecarSource).toBe("envelope");
    expect(loaded.questFlags["shadowlord-dead:falsehood"]).toBe(true);
    expect(loaded.journal).toHaveLength(1);
  });

  it("CONTROL: los mismos bytes SIN la marca degradan a sidecar vacío", async () => {
    const state = freshState();
    state.questFlags = { "shadowlord-dead:falsehood": true };
    state.journal = [{ turn: 7, location: 0, npc: "Testigo", text: "una linea de diario" }];
    const { gam } = exportNativeSave(state, blankTemplate());
    const { state: loaded, sidecarSource } = await importNativeSaveFiles(
      asFile(gam, "SAVED.GAM"),
    );
    expect(sidecarSource).toBe("none");
    expect(loaded.questFlags).toEqual({});
    expect(loaded.journal).toEqual([]);
  });

  it("un sobre ILEGIBLE degrada como si no lo hubiera, y no lanza", async () => {
    const state = freshState();
    const { gam } = exportNativeSave(state, blankTemplate());
    const roto = new Uint8Array(gam.length + 30);
    roto.set(gam, 0);
    roto.set(new TextEncoder().encode(U5GAM_MARKER + "{esto no es json"), gam.length);
    const { sidecarSource } = await importNativeSaveFiles(asFile(roto, "roto.u5gam"));
    expect(sidecarSource).toBe("none");
  });
});
