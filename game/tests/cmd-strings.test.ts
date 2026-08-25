/**
 * F1.8-T3 — Copy VERBATIM de los nombres de comando del dispatcher (kernel
 * kernel_cmd_dispatch 0x3178) leídos de DATA.OVL (DS+0x10). Este test fija el
 * copy fiel "<Cmd>-" que sustituye al copy propio del clon ("<Cmd> — which
 * way?"), verificado byte a byte contra `original/u5/ultima5/DATA.OVL`:
 *   Talk-  (DS 0xa210) · Open-  (0xa1ce) · Get-   (0xa16a) · Fire-  (0xa164)
 *   Search-(DS 0xa1fc) · Jimmy- (0xa198) · Klimb- (0xa1a0) · Look   (0xa1a8)
 *   Push-  (DS 0xa1e4) · Attack-(MAINOUT 0x29fe / TOWN 0x26e0).
 *
 * Nota: "Look" NO lleva guión en el original (el resto de direccionales sí).
 *
 * ⚠ ESTOS OFFSETS SON DEL KERNEL Y SÓLO DEL KERNEL. DATA.OVL guarda COPIAS
 * BYTE-IDÉNTICAS de los mismos nombres para los overlays que NO pasan por el
 * despachador, y una cita al offset equivocado cuadra en bytes pero apunta al
 * emisor que no es (es INVISIBLE en ejecución: sólo se caza leyendo el emisor).
 * Mapa derivado — emisor único por columna, verificado sobre re/disasm/:
 *   nombre        kernel(ULTIMA.EXE)   arena(COMBAT.OVL)   pasillo(DUNGEON.OVL)
 *   Cast...\n     0xa142               0x6df6              —
 *   Get-          0xa16a               0x6e14              —
 *   Jimmy-        0xa198               0x6e1a              —
 *   Open-         0xa1ce               0x6e22              —
 *   Push-         0xa1e4               0x6e28              —
 *   Ready...\n\n  0xa1f0               0x6e2e              —
 *   Search-       0xa1fc               0x6e3a              —
 *   Use item\n\n  0xa24c               0x6e42              —
 *   Yell          0xa286               0x6e4e              —
 *   Z-stats...\n  0xa28c               0x6e54              —
 *   Look          0xa1a8               0x6eb0              —
 *   Klimb-        0xa1a0               0x8ede (SJOG)       0x6cce
 * El "Klimb-" del kernel además está tras `cmp byte [g_location],0 / jne`
 * (ULTIMA.EXE 0x32e8) ⇒ 0xa1a0 SÓLO en overworld. Censo y derivación completos
 * en re/notes/citas-109-acta.md; la tabla de la arena, en combat-commands.md.
 */
import { describe, expect, it } from "vitest";
import { ATTACK_NOTHING, CMD_STRINGS, TALK_UI } from "../src/core/world/cmd-strings.js";

describe("CMD_STRINGS — copy fiel del dispatcher (DATA.OVL)", () => {
  it("comandos direccionales imprimen '<Cmd>-' verbatim (5 muestras)", () => {
    expect(CMD_STRINGS.talk).toBe("Talk-"); // DS 0xa210
    expect(CMD_STRINGS.open).toBe("Open-"); // DS 0xa1ce
    expect(CMD_STRINGS.get).toBe("Get-"); // DS 0xa16a
    expect(CMD_STRINGS.fire).toBe("Fire-"); // DS 0xa164
    expect(CMD_STRINGS.search).toBe("Search-"); // DS 0xa1fc (overworld/pueblo)
  });

  it("Jimmy/Klimb/Push llevan guión; Look NO (fiel al binario)", () => {
    expect(CMD_STRINGS.jimmy).toBe("Jimmy-"); // DS 0xa198
    expect(CMD_STRINGS.klimb).toBe("Klimb-"); // DS 0xa1a0
    expect(CMD_STRINGS.push).toBe("Push-"); // DS 0xa1e4
    expect(CMD_STRINGS.look).toBe("Look"); // DS 0xa1a8 (sin guión)
  });

  it("Attack imprime 'Attack-' (overlay MAINOUT/TOWN, no el kernel)", () => {
    expect(CMD_STRINGS.attack).toBe("Attack-");
    expect(ATTACK_NOTHING).toBe("Nothing to attack!\n"); // MAINOUT 0x2a10 / TOWN 0x26fb
  });

  it("TALK_UI: prompts de conversación verbatim de DATA.OVL PHRASES_CONVERSATION", () => {
    // Chunk "Common talking responses" (fileoff 0x9338): [0x0c]="Your interest?\n:",
    // [0x11]="You respond-\n:". El '\n:' se parte: la línea de prompt + el cursor ':'.
    expect(TALK_UI.interest).toBe("Your interest?");
    expect(TALK_UI.respond).toBe("You respond-");
    expect(TALK_UI.cursor).toBe(":");
  });

  it("ninguna cadena de comando conserva el copy propio del clon", () => {
    for (const v of Object.values(CMD_STRINGS)) {
      expect(v).not.toContain("which way");
      expect(v).not.toContain("which item");
    }
  });
});
