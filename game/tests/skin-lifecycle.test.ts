/**
 * CICLO DE VIDA DE PIELES (banco «present()/mount() pieles», PLAN-VIVO §BANCOS;
 * auditoría R4/MANT-7) — el contrato que api.ts §Skin documenta y el SkinManager
 * asume, ejecutable sin navegador:
 *
 *  1. `unmount` TOLERANTE A MOUNT PARCIAL: llamable sin mount previo (o tras un
 *     mount que lanzó a medias, o dos veces) sin lanzar. Es la pieza que permite
 *     al manager limpiar una piel cuyo mount falló.
 *  2. El manager DESMONTA la piel cuyo mount falló ANTES del rollback R4 — sin
 *     esto el DOM/listeners parciales de la fallida quedaban apilados bajo root
 *     junto a la piel re-montada.
 *  3. Tras `unmount` la piel NO retiene referencias vivas (api.ts: «tras unmount
 *     la piel no retiene referencias vivas»): la fiel ya soltaba `view`; la
 *     shader retenía `view` + snapshots memoizados del gate PERF-2 + el estado
 *     de tween de actores del motion (estado RANCIO en el re-mount F9).
 *
 * Las clases reales se construyen en node (sus field-initializers están guardados
 * para entorno sin DOM); `mount` no se llama — lo que se verifica es exactamente
 * la semántica pre/post-mount. TS `private` es solo de compilación: los campos se
 * siembran/inspeccionan por índice para el punto 3.
 */
import { describe, expect, it, vi } from "vitest";
import { SkinManager } from "../src/skin/manager.js";
import type { CoreView, IntentSink, Skin } from "../src/skin/api.js";
import { FaithfulSkin } from "../src/skin/fiel/skin.js";
import { ShaderSkin } from "../src/skin/shader/skin.js";

function makeManager(skins: Skin[]): SkinManager {
  const m = new SkinManager(
    {} as unknown as HTMLElement,
    {} as unknown as CoreView,
    {} as unknown as IntentSink,
  );
  for (const s of skins) m.register(s);
  return m;
}

describe("ciclo de vida de pieles — unmount tolerante a mount parcial (api.ts §Skin)", () => {
  it("FaithfulSkin: unmount sin mount previo no lanza, y es idempotente (×2)", () => {
    const skin = new FaithfulSkin();
    expect(() => skin.unmount()).not.toThrow();
    expect(() => skin.unmount()).not.toThrow();
  });

  it("ShaderSkin: unmount sin mount previo no lanza, y es idempotente (×2)", () => {
    const skin = new ShaderSkin();
    expect(() => skin.unmount()).not.toThrow();
    expect(() => skin.unmount()).not.toThrow();
  });
});

describe("SkinManager.swap — limpieza del mount parcial antes del rollback (R4)", () => {
  it("si mount(next) lanza: unmount(next) ANTES de re-montar prev, y el error se propaga", async () => {
    const calls: string[] = [];
    const prev: Skin = {
      id: "prev",
      mount: () => {
        calls.push("prev.mount");
      },
      unmount: () => {
        calls.push("prev.unmount");
      },
    };
    const bad: Skin = {
      id: "bad",
      mount: () => {
        calls.push("bad.mount");
        throw new Error("assets rotos");
      },
      unmount: () => {
        calls.push("bad.unmount");
      },
    };
    const m = makeManager([prev, bad]);
    await m.swap("prev");
    calls.length = 0;

    await expect(m.swap("bad")).rejects.toThrow("assets rotos");
    // Orden completo del swap fallido: desmonta prev, intenta bad, LIMPIA bad,
    // re-monta prev (rollback). La fallida no queda apilada bajo root.
    expect(calls).toEqual(["prev.unmount", "bad.mount", "bad.unmount", "prev.mount"]);
    expect(m.currentId).toBe("prev");
  });

  it("si además unmount(next) lanza, el rollback sigue y se propaga el error ORIGINAL", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      const calls: string[] = [];
      const prev: Skin = {
        id: "prev",
        mount: () => {
          calls.push("prev.mount");
        },
        unmount: () => {
          calls.push("prev.unmount");
        },
      };
      const doubleBad: Skin = {
        id: "doubleBad",
        mount: () => {
          throw new Error("mount roto");
        },
        unmount: () => {
          throw new Error("unmount tambien roto");
        },
      };
      const m = makeManager([prev, doubleBad]);
      await m.swap("prev");
      calls.length = 0;

      await expect(m.swap("doubleBad")).rejects.toThrow("mount roto");
      expect(calls).toEqual(["prev.unmount", "prev.mount"]); // rollback intacto
      expect(m.currentId).toBe("prev");
    } finally {
      warn.mockRestore();
    }
  });

  it("mount inicial fallido (sin prev): también limpia la fallida y propaga", async () => {
    const calls: string[] = [];
    const bad: Skin = {
      id: "bad",
      mount: () => {
        throw new Error("boot roto");
      },
      unmount: () => {
        calls.push("bad.unmount");
      },
    };
    const m = makeManager([bad]);
    await expect(m.swap("bad")).rejects.toThrow("boot roto");
    expect(calls).toEqual(["bad.unmount"]);
  });
});

describe("unmount no retiene referencias vivas (simetría fiel↔shader, api.ts §Skin)", () => {
  /** Siembra un campo privado (TS private = solo compilación) y devuelve el lector. */
  function fields(skin: object): Record<string, unknown> {
    return skin as unknown as Record<string, unknown>;
  }

  it("FaithfulSkin.unmount suelta view y los packs de assets (incl. endgamePack)", () => {
    const skin = new FaithfulSkin();
    const f = fields(skin);
    f["view"] = { fake: "coreview" };
    f["endgamePack"] = { fake: "pack" };
    f["atlas"] = { fake: "atlas" };
    skin.unmount();
    expect(f["view"]).toBeNull();
    expect(f["endgamePack"]).toBeNull();
    expect(f["atlas"]).toBeNull();
  });

  it("ShaderSkin.unmount suelta view + memos del gate PERF-2 + estado de motion", () => {
    const skin = new ShaderSkin();
    const f = fields(skin);
    f["view"] = { fake: "coreview" };
    f["lastSnapRef"] = { fake: "snapshot" };
    f["lastMotionSnap"] = { fake: "snapshot" };
    f["lastActors"] = [{ id: "a", tile: 0, col: 0, row: 0 }];
    f["hdRunes"] = { fake: "hdfont" };
    f["waterAtlas"] = { fake: "img" };
    (f["actorFrom"] as Map<string, unknown>).set("npc", { col: 1, row: 1 });
    (f["actorTo"] as Map<string, unknown>).set("npc", { col: 2, row: 1 });
    skin.unmount();
    expect(f["view"]).toBeNull();
    expect(f["lastSnapRef"]).toBeNull();
    expect(f["lastMotionSnap"]).toBeNull();
    expect(f["lastActors"]).toEqual([]);
    expect(f["hdRunes"]).toBeNull();
    expect(f["waterAtlas"]).toBeNull();
    expect((f["actorFrom"] as Map<string, unknown>).size).toBe(0);
    expect((f["actorTo"] as Map<string, unknown>).size).toBe(0);
  });
});
