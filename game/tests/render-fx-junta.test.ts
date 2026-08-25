/**
 * #207 §JUNTA — EL PREDICADO DE FX SIGUE A LA PIEL **ACTIVA**.
 *
 * ── POR QUÉ EXISTE ESTE FICHERO, QUE ES LA PARTE QUE IMPORTA ─────────────────────────
 * El arreglo de #207 pasó una batería ENTERA en verde —17 tests, seis mutantes muertos,
 * sello 5c87d6d6 con cardinal 1048/1048— y el grabador seguía cortando los efectos. El
 * re-render lo dijo con todas las letras: `0 de 120 pasos ALARGADOS`.
 *
 * La causa: `ShaderSkin` instancia SU PROPIA `FaithfulSkin` interna (`skin/shader/skin.ts`),
 * y el hook preguntaba a una instancia FIJA de piel fiel (la registrada en `main.ts`). Con
 * la shader activa —que es el régimen del VÍDEO, el canvas compuesto— los fx viven en la
 * interna y la registrada no recibe nada: el predicado devolvía `false` para siempre.
 *
 * 🔴 NINGUNO de los tests que ya existían podía verlo, y por razones que conviene nombrar:
 *  · El careo de `worldFx` conduce un `WorldFxLayer` REAL **construido por el propio test**.
 *    Prueba que la capa se apaga cuando se la pinta. No prueba QUIÉN se la pregunta.
 *    [[el-testigo-elegido-hace-pasar-al-aserto-con-el-codigo-roto]]: instancié la diferencia
 *    donde NO estaba el defecto.
 *  · La guarda estructural comprueba que el grabador LLAMA a `__u5test.fxActive`. Que lo
 *    llame no dice nada de si lo que devuelve significa algo.
 * Lo cazó un control positivo de 40 s en navegador (empujar `quake` por `applyEvents` y
 * mirar si el predicado sube): doce muestras, doce `false`. Estaba disponible desde el
 * primer minuto y quedó para después del sello. Esa es la receta de prevención.
 *
 * ── QUÉ VIGILA ESTE FICHERO, Y QUÉ NO ───────────────────────────────────────────────
 * VIGILA la JUNTA: que el predicado que el grabador consume tenga por sujeto la piel que
 * está montada, y que cambie con ella. Se instancia con pieles de mentira porque el defecto
 * NO está en las capas de fx (ésas ya estaban bien) sino en el CABLEADO — y el cableado se
 * instancia con dos sujetos que dan respuestas distintas, que es exactamente el caso que el
 * código roto no distinguía.
 * NO VIGILA que la piel shader delegue de verdad en su fiel interna EN NAVEGADOR
 * (`ShaderSkin` no monta en jsdom, que no trae `canvas`): eso queda como control vivo,
 * declarado, y es el que hay que correr a mano antes de dar por bueno un re-render.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { SkinManager } from "../src/skin/manager.js";
import type { CoreView, IntentSink, Skin } from "../src/skin/api.js";

const RAIZ_GAME = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const leer = (rel: string): string => readFileSync(resolve(RAIZ_GAME, rel), "utf8");

/** Piel de mentira: sólo id, montaje no-op y el predicado que nos interesa, MUTABLE. */
function pielFalsa(id: string, fx: boolean | undefined): Skin & { fx: boolean | undefined } {
  const s = {
    id,
    fx,
    mount(): void {},
    unmount(): void {},
    get transientFxActive(): boolean | undefined {
      return s.fx;
    },
  };
  return s;
}

function manager(): { m: SkinManager; root: HTMLElement } {
  const root = { appendChild: () => {}, removeChild: () => {} } as unknown as HTMLElement;
  const view = {} as unknown as CoreView;
  const intents = { send: () => {} } as unknown as IntentSink;
  return { m: new SkinManager(root, view, intents), root };
}

describe("#207 §JUNTA — el predicado tiene por sujeto la piel ACTIVA", () => {
  it("sin piel montada devuelve null, NO false", async () => {
    const { m } = manager();
    m.register(pielFalsa("fiel", false));
    // Nadie ha hecho swap: no hay activa. `false` aquí sería una mentira cómoda.
    expect(m.transientFxActive).toBeNull();
  });

  it("EL MUTANTE DE #207: con dos pieles, sigue a la MONTADA y no a la otra", async () => {
    // Instancia el defecto EXACTO: la piel que NO pinta dice `false` para siempre (era
    // `fielSkin`, que con la shader activa no recibe eventos) y la que SÍ pinta tiene un fx
    // vivo (era la fiel INTERNA de la shader). Preguntar a la fija devolvía `false`.
    const { m } = manager();
    const quieta = pielFalsa("fiel", false);
    const pintando = pielFalsa("shader", true);
    m.register(quieta);
    m.register(pintando);

    await m.swap("shader");
    expect(m.currentId).toBe("shader");
    expect(m.transientFxActive, "el predicado leyó la piel que NO pinta").toBe(true);

    await m.swap("fiel");
    expect(m.currentId).toBe("fiel");
    expect(m.transientFxActive, "el predicado se quedó pegado a la piel anterior").toBe(false);
  });

  it("sigue los CAMBIOS de la activa, no una foto del momento del swap", async () => {
    const { m } = manager();
    const p = pielFalsa("shader", false);
    m.register(p);
    await m.swap("shader");
    expect(m.transientFxActive).toBe(false);
    p.fx = true; // arranca un efecto
    expect(m.transientFxActive).toBe(true);
    p.fx = false; // se agota
    expect(m.transientFxActive).toBe(false);
  });

  it("si la piel activa NO declara la propiedad devuelve null — el grabador ABORTA con él", async () => {
    // Una piel sin capas de fx (la `dev`, el prototipo portrait) es un caso legítimo, y
    // `undefined` NO puede colapsar a `false`: el grabador volvería al presupuesto fijo sin
    // avisar. Es la misma decisión que la ausencia del hook.
    const { m } = manager();
    m.register(pielFalsa("dev", undefined));
    await m.swap("dev");
    expect(m.currentId).toBe("dev");
    expect(m.transientFxActive).toBeNull();
  });
});

describe("#207 §JUNTA-b — guardas estructurales del cableado (declaradas: no ejecutan navegador)", () => {
  it("el hook pregunta al MANAGER, no a una instancia fija de piel", () => {
    const main = leer("src/main.ts");
    expect(main).toContain("hooks.fxActive = (): boolean | null => skins.transientFxActive;");
    // El mutante es literalmente el código que tuvo un sello verde encima.
    expect(main).not.toContain("hooks.fxActive = (): boolean => fielSkin.transientFxActive;");
  });

  it("la piel shader DELEGA en su fiel interna (si no, la activa mentiría en el régimen del vídeo)", () => {
    const shader = leer("src/skin/shader/skin.ts");
    expect(shader).toMatch(/get transientFxActive\(\): boolean \{\s*return this\.faithful\.transientFxActive;/);
  });

  it("el grabador exige un BOOLEANO y aborta con null", () => {
    const grabador = leer("tools/partida-render.mjs");
    expect(grabador).toContain('typeof primera !== "boolean"');
    expect(grabador).toContain("window.__u5test.fxActive() === true");
  });
});
