/**
 * SkinManager — el ciclo user-facing (task #79). La piel dev se registra como
 * NO user-facing: sigue montable por id (swap directo, p.ej. ?skin=dev) pero
 * desaparece del ciclo (toggle) y del switcher (userFacingSkins).
 */
import { describe, expect, it } from "vitest";
import { SkinManager } from "../src/skin/manager.js";
import type { CoreView, IntentSink, Skin } from "../src/skin/api.js";

function fakeSkin(id: string): Skin {
  return { id, mount: () => {}, unmount: () => {} };
}

function makeManager(): SkinManager {
  const root = {} as unknown as HTMLElement;
  const view = {} as unknown as CoreView;
  const intents = {} as unknown as IntentSink;
  const m = new SkinManager(root, view, intents);
  m.register(fakeSkin("dev"), { userFacing: false, label: "Dev (QA)" });
  m.register(fakeSkin("faithful"), { label: "1988 (fiel)" });
  m.register(fakeSkin("shader"), { label: "Shader (xBR)" });
  return m;
}

describe("SkinManager — jubilación de la piel dev del ciclo", () => {
  it("userFacingSkins excluye dev y conserva etiquetas/orden", () => {
    const m = makeManager();
    expect(m.userFacingSkins).toEqual([
      { id: "faithful", label: "1988 (fiel)" },
      { id: "shader", label: "Shader (xBR)" },
    ]);
  });

  it("toggle cicla SOLO fiel↔shader, nunca dev", async () => {
    const m = makeManager();
    await m.swap("faithful");
    expect(m.currentId).toBe("faithful");
    await m.toggle();
    expect(m.currentId).toBe("shader");
    await m.toggle();
    expect(m.currentId).toBe("faithful");
    await m.toggle();
    expect(m.currentId).toBe("shader");
  });

  it("desde dev (montada por id), toggle entra por la primera user-facing", async () => {
    const m = makeManager();
    await m.swap("dev"); // ?skin=dev sigue montando la dev
    expect(m.currentId).toBe("dev");
    expect(m.currentLabel).toBe("Dev (QA)");
    await m.toggle();
    expect(m.currentId).toBe("faithful"); // (-1+1)%2 = 0
  });

  it("currentLabel devuelve la etiqueta legible de la piel activa", async () => {
    const m = makeManager();
    await m.swap("shader");
    expect(m.currentLabel).toBe("Shader (xBR)");
  });
});
