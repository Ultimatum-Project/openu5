/**
 * FICHA #234 — **el guardia del Palacio es `dialogNumber === 0xFF` EXACTO, no `>= 0xFD`.**
 *
 * El binario reparte los TRES dialogNumber altos en tres handlers distintos
 * (`re/notes/talk-031e-resolucion.md:34`, TALK.OVL):
 *
 *   0xFD → «Don't hurt me!\nPlease go away!» (DS 0x9176), `ret 0`
 *   0xFE → far 0xbb02 (el NPC ataca), `ret 0`
 *   0xFF → `call 0x1e2` — EL GUARDIA, y la única rama que propaga el retorno del hijo
 *
 * `tryTalkGuard` gateaba con `dialogNumber < 0xfd → null`, o sea aceptaba los TRES y le
 * robaba su handler a 0xFD/0xFE. El MISMO fichero ya usaba el predicado exacto en la otra
 * vía (`guard-encounters.ts`, rama de tributo: `dialogNumber !== 0xff`): eran dos formas
 * para una sola pregunta, y la floja es la que corría primero.
 *
 * ── POR QUÉ ESTE TEST EXISTE AUNQUE EL DEFECTO NO SEA ALCANZABLE HOY ───────────────────
 * 🔴 La alcanzabilidad es NEGATIVA, y lo es por DATOS Y POR UN RANGO DE SORTEO — no por
 * ninguna línea de código que alguien vaya a leer al tocar esto:
 *   · `game/assets/npcs.json` no trae ni un 0xFD/0xFE estático. Censo medido sobre el
 *     fichero: 1024 NPC con `dialogNumber`, 0 con 0xFD, 0 con 0xFE, 13 con 0xFF.
 *   · Los únicos que los escriben en runtime son los Shadowlords urbanos, y su sorteo es
 *     `rand(1, 8)` sobre las 8 ciudades de la virtud (`core/world/survival.ts:214`), que
 *     nunca da loc 0x12 (el Palacio).
 * Un invariante que vive en un fichero de datos y en un rango de sorteo no está vigilado
 * por nada: cambiar `npcs.json` lo instancia sin tocar una línea de lógica. Este test es
 * lo que lo convierte en vigilado — documenta el REPARTO, no sólo el caso del guardia.
 *
 * NO se toca el orden de los `tryTalk*` de `main.ts` (tryTalkGuard corre antes que
 * tryTalkPossessed): eso es la ficha #237. Con el predicado exacto, el orden deja de
 * importar para estos tres valores, que es justamente lo que se asierta abajo.
 */
import { describe, it, expect } from "vitest";
import type { GameState } from "../src/core/state.js";
import type { NpcManager, NpcRuntime } from "../src/core/npc/manager.js";
import { tryTalkGuard, type GuardCtx, type GuardPromptHolder } from "../src/core/world/guard-encounters.js";
import { LOC_BLACKTHORN, TIME_SPELL_BADGE, PALACE_GUARD_TYPE } from "../src/core/world/blackthorn.js";

/** NPC de mentira adyacente, con el `dialogNumber` que se quiera instanciar. */
function npcCon(dialogNumber: number): NpcRuntime {
  return {
    slot: 3,
    location: LOC_BLACKTHORN,
    type: PALACE_GUARD_TYPE,
    dialogNumber,
    aiTypes: [0, 0, 0],
    schedX: [5, 5, 5],
    schedY: [5, 5, 5],
    schedZ: [0, 0, 0],
    times: [0, 6, 12, 18],
    x: 5,
    y: 4,
    z: 0,
    state: 1,
    servedSlot: 0,
    pathBuf: new Array(32).fill(0),
    pathIdx: -1,
    stuck: 0,
  };
}

/**
 * Contexto mínimo. `timeSpell` va con la insignia puesta A PROPÓSITO: sin ella el handler
 * devuelve `[]` (ret 1 silencioso del binario, 0x216) y `[]` es tan «no-null» como el
 * prompt — un ctx sin insignia haría pasar el test con el predicado ROTO, porque los tres
 * dialogNumber darían `[]` y ninguno `null`. El testigo tiene que instanciar la diferencia
 * DONDE EXISTE, y sólo existe con la insignia.
 */
function ctxCon(dialogNumber: number): { ctx: GuardCtx; prompts: GuardPromptHolder } {
  const prompts: GuardPromptHolder = { password: null, tribute: null, arrest: false };
  const npc = npcCon(dialogNumber);
  const ctx: GuardCtx = {
    state: {
      position: { location: LOC_BLACKTHORN, floor: 0, x: 5, y: 5 },
      timeSpell: TIME_SPELL_BADGE,
    } as unknown as GameState,
    npcManager: { npcAt: () => npc } as unknown as NpcManager,
    rand: () => 1,
    targetCoord: () => ({ nx: 5, ny: 4 }),
    prompts,
  };
  return { ctx, prompts };
}

describe("#234 · el reparto de los TRES dialogNumber altos (TALK.OVL)", () => {
  it("0xFF ES el guardia: arma el reto de password", () => {
    const { ctx, prompts } = ctxCon(0xff);
    const ev = tryTalkGuard(ctx, "north");

    expect(ev).not.toBeNull();
    expect(ev?.[0]?.kind).toBe("blackthorn-guard-password-prompt");
    expect(prompts.password).toEqual({ from: "talk" });
  });

  // Parametrizado y NO en un bucle con el expect dentro: con un bucle, el primer fallo
  // dejaría el otro dialogNumber sin evaluar y el informe diría «1 roja» donde hay dos.
  // El rótulo lleva el hex YA FORMATEADO y el valor crudo AL FINAL: los `%s` del título se
  // consumen POSICIONALMENTE, así que un `0x%s` sobre 0xfd imprime «0x253» (el decimal tras
  // un «0x» literal) y un valor numérico intercalado se come el hueco del texto siguiente.
  // Las dos versiones daban un nombre de test que contradice al dato que prueba.
  it.each([
    ["0xFD", "«Don't hurt me!» (TALK 0x03a6)", 0xfd],
    ["0xFE", "far 0xbb02, el NPC ataca (TALK 0x03cc)", 0xfe],
  ])(
    "%s NO es del guardia — devuelve null y deja pasar a su handler: %s",
    (_hex, _handler, dialogNumber) => {
      const { ctx, prompts } = ctxCon(dialogNumber as number);
      const ev = tryTalkGuard(ctx, "north");

      // ÉSTE es el aserto que mata al `< 0xfd`: con el predicado viejo saldría el prompt
      // del guardia y el poseído se quedaría sin su respuesta hardcodeada.
      expect(ev).toBeNull();
      // Y no debe haber armado máquina de estado por el camino.
      expect(prompts.password).toBeNull();
    },
  );

  it("CONTROL · un dialogNumber normal (script TLK) tampoco es del guardia", () => {
    // Sin este control, un `tryTalkGuard` que devolviera null SIEMPRE pasaría los dos
    // asertos de arriba. El de 0xFF es quien lo impide por el otro lado; éste cubre la
    // banda baja, que es la que de verdad recorre el juego.
    const { ctx, prompts } = ctxCon(0x2a);
    expect(tryTalkGuard(ctx, "north")).toBeNull();
    expect(prompts.password).toBeNull();
  });

  it("CONTROL · fuera del Palacio, ni siquiera 0xFF arma el reto", () => {
    const { ctx, prompts } = ctxCon(0xff);
    (ctx.state as { position: { location: number } }).position.location = 1; // Moonglow
    expect(tryTalkGuard(ctx, "north")).toBeNull();
    expect(prompts.password).toBeNull();
  });
});
