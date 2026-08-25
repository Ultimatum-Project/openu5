/**
 * DE QUÉ RANURA SALIÓ EL ESTADO QUE SE ESTÁ USANDO (ficha #153, mitad de la re-captura).
 *
 * POR QUÉ ES UN FICHERO APARTE. Su gemelo `miniatura-nativa.test.ts` corre bajo `jsdom`
 * porque monta pieles y canvas; esto no necesita DOM y sí necesita LEER UN ASSET del disco,
 * y bajo jsdom `import.meta.url` no es una URL `file:` — `fileURLToPath` revienta con «The
 * URL must be of scheme file». Medido, no supuesto: la primera versión vivía en el fichero
 * jsdom y daba ese error en los cuatro casos. Aquí, en el entorno node por defecto, va el
 * mismo patrón que `persistence.test.ts` usa desde siempre.
 *
 * QUÉ VIGILA. La re-captura de miniaturas viejas (`ui/shot-refresh.ts`) necesita saber a qué
 * clave `u5clone:shot:<id>` re-escribir, y el callback `onLoad` del panel de partidas entrega
 * el GameState SIN su id. Pasarlo por ese callback sería lo limpio, pero `ui/savepanel.ts`
 * tiene OTRO DUEÑO en esta ola, así que el dato se anota en `persistence.ts`, que es donde de
 * verdad se conoce.
 *
 * 🔴 LA MITAD QUE PUEDE FALLAR EN SILENCIO ES EL BORRADO, NO LA ANOTACIÓN. Si `importSave` no
 * limpiara la variable, cargar la partida A y luego importar un fichero dejaría el id de A
 * anotado, y la re-captura escribiría la foto de LO IMPORTADO encima de la miniatura de A. No
 * da error y produce una foto plausible en la partida equivocada — la clase de fallo que
 * nadie mira. Por eso ese caso lleva su CONTROL POSITIVO delante (que ANTES sí estaba
 * anotada): sin él, una variable que valiera `null` siempre pasaría el aserto sin medir nada.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { beforeEach, describe, expect, it } from "vitest";
import { importSave, loadGame, saveGame, slotDeLaUltimaCarga } from "../src/core/persistence.js";
import { SAVE_SLOT_PREFIX } from "../src/core/save-keys.js";
import { createNewGame, type ExtractedInitialState } from "../src/core/state.js";

class LocalStorageStub {
  private store = new Map<string, string>();
  getItem(k: string): string | null {
    return this.store.has(k) ? this.store.get(k)! : null;
  }
  setItem(k: string, v: string): void {
    this.store.set(k, String(v));
  }
  removeItem(k: string): void {
    this.store.delete(k);
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

function estadoNuevo(): ReturnType<typeof createNewGame> {
  const p = fileURLToPath(new URL("../assets/initial-state.json", import.meta.url));
  return createNewGame(JSON.parse(readFileSync(p, "utf8")) as ExtractedInitialState);
}

/** Guarda una partida y devuelve su id + el JSON exacto que quedó en la ranura. */
function sembrarPartida(nombre: string): { id: string; json: string } {
  const res = saveGame(estadoNuevo(), nombre, "Britannia", null);
  if (!res.ok) throw new Error(`no se pudo sembrar la partida: ${res.reason}`);
  const json = localStorage.getItem(SAVE_SLOT_PREFIX + res.meta.id);
  if (json === null) throw new Error("la ranura sembrada no tiene contenido");
  return { id: res.meta.id, json };
}

describe("la ranura de la última carga (#153)", () => {
  beforeEach(() => {
    (globalThis as unknown as { localStorage: Storage }).localStorage =
      new LocalStorageStub() as unknown as Storage;
  });

  it("`loadGame` la anota", () => {
    const a = sembrarPartida("A");
    loadGame(a.id);
    expect(slotDeLaUltimaCarga()).toBe(a.id);
  });

  it("distingue entre dos ranuras (no es un booleano disfrazado)", () => {
    const a = sembrarPartida("A");
    const b = sembrarPartida("B");
    loadGame(a.id);
    loadGame(b.id);
    expect(slotDeLaUltimaCarga()).toBe(b.id);
  });

  it("🔴 IMPORTAR la BORRA — si no, la foto de lo importado pisa la miniatura de otra", async () => {
    const a = sembrarPartida("A");
    loadGame(a.id); // el jugador venía de la partida A
    expect(slotDeLaUltimaCarga()).toBe(a.id); // control: estaba anotada
    await importSave(new File([a.json], "otra.json"));
    expect(
      slotDeLaUltimaCarga(),
      "lo importado no viene de ninguna ranura: cualquier id aquí es el de OTRA partida",
    ).toBeNull();
  });

  it("un JSON corrupto no anota una carga que no ocurrió", () => {
    const a = sembrarPartida("A");
    loadGame(a.id);
    localStorage.setItem(SAVE_SLOT_PREFIX + "rota", "{ esto no es un GameState");
    expect(() => loadGame("rota")).toThrow();
    expect(slotDeLaUltimaCarga(), "quedó anotada una ranura que no llegó a cargarse").toBe(a.id);
  });
});
