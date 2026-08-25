/**
 * ★★ UN PROMPT Y/N DE FLOW 2 VIVO ES INMUNE AL `Escape ×2`, Y EL ARNÉS DEL ESPEJO NO SABÍA
 * CONTESTARLO — SE TRAGABA LA `t` Y LA FLECHA DEL ANCLA DE MERCADER.
 *
 * El reductor de prompts del port (`src/ui/prompt-manager.ts:202-213`) resuelve el `Escape`
 * SÓLO en el tipo `yesno-esc`. En el tipo `yesno` el ESC se IGNORA y la tecla se CONSUME
 * (`return true`), y eso es lo FIEL: son los getkey Y/N crudos del binario (`getYN` 0x448c
 * «SÓLO Y/N, re-lee cualquier otra»; tributo de guardia TALK 0x01e2; arresto TOWN 0x12ae).
 * El defecto NO estaba en el port: estaba en que la única limpieza del arnés —`Escape ×2`, en
 * `purgeLiveModes` y en la limpieza pre-Talk del resync de ancla-NPC— no puede cerrar eso.
 *
 * MEDIDO EN CORRIDA (carril `tercera-rama`, ficha AH-1 de `ancla-herrero-acta.md` §4; corpus
 * AD, parte `ad04`, puerto 5259, SOFT + NO_EXPORT): a los 4 pasos de entrar en Moonglow el
 * mundo levanta «A guard demands a 60 gp tribute to Blackthorn! / Dost thou pay?» y el prompt
 * se queda vivo el SEGMENTO ENTERO —
 *   · la sonda de ancla lo declara en los DOS resyncs: `sumideros: prompt=yesno`,
 *   · las dos anclas `shop:MagicSeller` fallan con `shopOpen=false tras 2 intentos`,
 *   · el transcript de `ad04-g34` son 15 líneas para 60 beats (conformidad 7 %, 0✓/2✗).
 * Y se le escapó a la ventana anterior porque `npcAt` se lee por `page.evaluate`, no por
 * tecla: la sonda seguía viendo al mercader SOLO en su celda, con la party y la dirección
 * correctas. Medir en la capa equivocada.
 *
 * Este fichero conduce la función REAL (`resolveBlockingYesNo` del runner) contra un `Page`
 * de mentira cuyo mundo modela la regla que importa: el `yesno` sólo se resuelve con `y`/`n`
 * y el `Escape` NO lo toca. LOS DOS BRAZOS son el experimento: sin resolución el prompt
 * sobrevive a los Escape (el comportamiento de antes, que es el que envenenaba), y con ella
 * queda cerrado — y el `arrest` NO se contesta a propósito, que es la decisión sancionada.
 */
import { describe, expect, it } from "vitest";
import type { Page } from "@playwright/test";
import { resolveBlockingYesNo } from "../e2e/espejo-tour/runner";

type Tag = "guard-tribute" | "guard-arrest" | "troll-toll" | null;

/** Mundo mínimo: un prompt `yesno` con su tag, que SÓLO cae con 'y'/'n'. El `Escape` se
 *  registra pero no lo cierra — calco de `prompt-manager.ts` (`yesno`: ESC ignorado). */
function mundo(inicial: { prompt: "yesno" | null; tag: Tag; escalaAArresto?: boolean; eco?: string }) {
  const st = { prompt: inicial.prompt, tag: inicial.tag };
  const teclas: string[] = [];
  const page = {
    keyboard: {
      press(k: string): Promise<void> {
        teclas.push(k);
        if (k === "Escape") return Promise.resolve(); // ← la regla: NO cierra un `yesno`
        if (k === "y" || k === "n") {
          if (inicial.escalaAArresto && st.tag === "guard-tribute") {
            // El pago falla por falta de oro → el mundo ESCALA a arresto (ret 1 → TOWN 0x12ae).
            st.tag = "guard-arrest";
          } else {
            st.prompt = null;
            st.tag = null;
          }
        }
        return Promise.resolve();
      },
    },
    waitForTimeout(): Promise<void> {
      return Promise.resolve();
    },
    evaluate(fn: unknown): Promise<unknown> {
      void fn;
      return Promise.resolve({ prompt: st.prompt, tag: st.tag, eco: st.prompt ? (inicial.eco ?? "") : "" });
    },
  } as unknown as Page;
  return { page, teclas, st };
}

describe("espejo — el yesno de Flow 2 que el Escape ×2 no puede cerrar", () => {
  it("BRAZO 'ANTES': el Escape ×2 solo NO cierra un yesno vivo (es lo que envenenaba el segmento)", async () => {
    const { page, st } = mundo({ prompt: "yesno", tag: "guard-tribute" });
    await page.keyboard.press("Escape");
    await page.keyboard.press("Escape");
    expect(st.prompt, "sigue vivo: cualquier tecla posterior se la traga él").toBe("yesno");
  });

  it("BRAZO 'DESPUÉS': el tributo de guardia se resuelve pagando ('y') y el prompt cae", async () => {
    const { page, teclas, st } = mundo({ prompt: "yesno", tag: "guard-tribute" });
    const log: string[] = [];
    const visto = await resolveBlockingYesNo(page, log);
    expect(visto).toBe("guard-tribute");
    expect(teclas, "paga con 'y' — la decisión sancionada de guardPromptAction").toEqual(["y"]);
    expect(st.prompt, "el prompt queda cerrado: la 't' y la flecha del ancla ya llegan al mapa").toBeNull();
    expect(log.join("\n")).toMatch(/guard-tribute.*RESUELTO pagando/);
  });

  it("ARRESTO: NO se contesta (aceptar la cárcel mide el capítulo en Yew) y se DECLARA", async () => {
    const { page, teclas, st } = mundo({ prompt: "yesno", tag: "guard-arrest" });
    const log: string[] = [];
    const visto = await resolveBlockingYesNo(page, log);
    expect(visto).toBe("guard-arrest");
    expect(teclas, "ni una tecla: ni 'y' (cárcel) ni 'n' (combate)").toEqual([]);
    expect(st.prompt, "sigue vivo — y eso queda DECLARADO, que es lo que faltaba").toBe("yesno");
    expect(log.join("\n")).toMatch(/guard-arrest.*NO se contesta/);
  });

  it("ESCALADA: si el pago falla por oro, el tributo se vuelve arresto y ahí se PARA", async () => {
    const { page, teclas, st } = mundo({ prompt: "yesno", tag: "guard-tribute", escalaAArresto: true });
    const log: string[] = [];
    const visto = await resolveBlockingYesNo(page, log);
    expect(visto, "la cota de 2 vueltas ve la escalada y devuelve el estado FINAL").toBe("guard-arrest");
    expect(teclas, "pagó una vez; al arresto NO le contesta").toEqual(["y"]);
    expect(st.tag).toBe("guard-arrest");
    expect(log.join("\n")).toMatch(/RESUELTO pagando[\s\S]*guard-arrest/);
  });

  it("SIN TAG (Quit&Save / exit-to-DOS): no se contesta a ciegas, pero se DECLARA", async () => {
    const { page, teclas, st } = mundo({ prompt: "yesno", tag: null });
    const log: string[] = [];
    const visto = await resolveBlockingYesNo(page, log);
    expect(visto).toBe("yesno-sin-tag");
    expect(teclas, "contestar a ciegas fabricaría un guardado o pisaría el y/n del guion del LP").toEqual([]);
    expect(st.prompt).toBe("yesno");
    expect(log.join("\n")).toMatch(/sin tag.*NO se contesta a ciegas/);
  });

  it("SIN TAG: el aviso NOMBRA el prompt con su eco de consola (sin eso, 161 avisos son ANÓNIMOS)", async () => {
    const { page } = mundo({ prompt: "yesno", tag: null, eco: "Exit to DOS? " });
    const log: string[] = [];
    await resolveBlockingYesNo(page, log);
    expect(
      log.join("\n"),
      "el aviso ciego costó una ventana entera: 161 avisos atribuidos a Quit&Save que eran el PEAJE DE TROLLS",
    ).toContain("Exit to DOS?");
  });
});

/**
 * ★★ EL PEAJE DE TROLLS: los 161 avisos «sin tag» de la ventana `agregado-23` eran ESTE
 * prompt, no Quit&Save — y su respuesta está PRE-REGISTRADA EN EL CORPUS.
 *
 * MEDIDO (sonda de eco de consola sobre las 3 partes de AD que disparan el aviso, corridas
 * SOFT+NO_EXPORT propias que reproducen el brazo H byte-idéntico — ad05 55/706, ad08 49/682,
 * ad11 29/411): **161 de 161** avisos «sin tag» son `The trolls demand a NN gp toll! / Dost
 * thou pay?` (MAINOUT 0x1B3E, `main.ts` `troll-toll-prompt`). CERO Quit&Save, CERO
 * exit-to-DOS, CERO fuente. Y son **3 prompts**, no 161: uno por parte (36 gp en `ad05`,
 * 42 en `ad11`, 54 en `ad08`), re-declarado una vez por op mientras sigue vivo.
 *
 * LA DECISIÓN NO SE INVENTA — la trae el corpus con su cita de ledger. Los CUATRO overlays
 * de peaje de los dos corpus llevan `expectDelta: 0` y dicen literalmente «el LP no pagó»:
 *   · `ad01-g04` 39 gp · `ad04-g10` 39 gp · `ad04-g17` 39 gp · `ad05-g03` 36 gp
 * (el importe es `99 − 3×STR`, determinista; el 36 gp que la sonda mide en `ad05` es
 * EXACTAMENTE el de su propia cita). El LP rehusó las cuatro veces, y `*** CONFLICT ***`
 * —el combate de trolls— es la consecuencia que su propio transcript registra.
 *
 * Por qué `n` y no `y`, con las dos propiedades que lo deciden:
 *  1. **`n` no puede mover un delta de ledger**: `resolveTrollToll` (core/game.ts, MAINOUT
 *     0x1B3E) sólo toca el oro en la rama `pay && paidWord >= 0`. Rehusar cuesta CERO oro,
 *     que es justo lo que los cuatro `expectDelta: 0` exigen. Pagar los CONTRADIRÍA.
 *  2. **No hay tercera salida**: el getkey es crudo (ESC ignorado) y `resolveTrollToll`
 *     sólo tiene dos ramas (pagar → sigue el turno; rehusar/no-poder → combate). «Cerrar
 *     sin fabricar estado» es IMPOSIBLE POR CONSTRUCCIÓN para este prompt.
 *
 * La guarda del `yesno` SIN TAG **no se quita**: sigue sin contestarse a ciegas. Lo que
 * cambia es que el peaje deja de ser «sin tag».
 */
describe("espejo — el PEAJE DE TROLLS: el prompt que el corpus ya sabía contestar", () => {
  it("BRAZO 'ANTES' (el que envenenaba): sin tag, el peaje sobrevive y se traga el segmento", async () => {
    const { page, teclas, st } = mundo({ prompt: "yesno", tag: null, eco: "The trolls demand a 36 gp toll!" });
    const log: string[] = [];
    expect(await resolveBlockingYesNo(page, log)).toBe("yesno-sin-tag");
    expect(teclas, "ninguna tecla: el prompt sigue vivo").toEqual([]);
    expect(st.prompt, "y de aquí salen los 148 avisos de ad05-g25 (7 → 299 resyncs)").toBe("yesno");
  });

  it("BRAZO 'DESPUÉS': el peaje ETIQUETADO se rehúsa con 'n' y el prompt CAE", async () => {
    const { page, teclas, st } = mundo({ prompt: "yesno", tag: "troll-toll" });
    const log: string[] = [];
    expect(await resolveBlockingYesNo(page, log)).toBe("troll-toll");
    expect(teclas, "'n' = la decisión del LP en los 4 overlays del corpus").toEqual(["n"]);
    expect(st.prompt, "cerrado: las ops del guion vuelven a tener su sumidero").toBeNull();
  });

  it("NUNCA paga: la 'y' contradiría los cuatro `expectDelta: 0` del corpus", async () => {
    const { page, teclas } = mundo({ prompt: "yesno", tag: "troll-toll" });
    await resolveBlockingYesNo(page, [] as string[]);
    expect(teclas, "pagar mueve el oro; rehusar cuesta CERO — y cero es lo pre-registrado").not.toContain("y");
  });

  it("el log DECLARA la decisión y su procedencia (no es una elección del arnés)", async () => {
    const { page } = mundo({ prompt: "yesno", tag: "troll-toll" });
    const log: string[] = [];
    await resolveBlockingYesNo(page, log);
    const linea = log.join("\n");
    expect(linea).toMatch(/troll-toll/);
    expect(linea, "el testigo tiene que nombrar POR QUÉ se rehúsa, no sólo que se rehúsa").toMatch(/no pag/i);
  });

  it("MAPA LIMPIO: sin prompt vivo es no-op de coste cero (ni teclas ni línea de log)", async () => {
    const { page, teclas } = mundo({ prompt: null, tag: null });
    const log: string[] = [];
    expect(await resolveBlockingYesNo(page, log)).toBeNull();
    expect(teclas).toEqual([]);
    expect(log, "no ensucia el informe de los 1052 segmentos que no tienen prompt").toEqual([]);
  });
});
