import { describe, it, expect } from "vitest";
import { unlockDoorTile } from "../src/core/magic/cast.js";

/**
 * An Sanct — `CAST.OVL:0x02d2 an_sanct_unlock_disarm`, rama de puerta (0x03c0-0x03db).
 *
 * El binario hace `cmp al,0xb9` / `cmp al,0xbb` y luego **`dec byte [bx]`**. Un `dec`,
 * no un «abrir»: 0xB9→0xB8 y 0xBB→0xBA. El vocabulario de la familia está fijado en
 * `game/src/core/game.ts:3215` (`REG=0xb8, LOCKED=0xb9, REG_VIEW=0xba, LOCKED_VIEW=0xbb`)
 * y la mágica es 0x97/0x98 (`unmagicDoorTile`, game.ts:3138).
 *
 * 🔴 LO QUE ESTE FICHERO DEFIENDE, y por qué es un test y no un comentario: la glosa que
 * circuló durante meses en DOS citas del ledger decía «0xB9/0xBB (puerta cerrada/mágica)
 * → dec = puerta ABIERTA». Los dos términos eran falsos. Si alguien vuelve a leerlo así e
 * implementa «abrir», estos asertos se ponen rojos.
 *
 * Canal del BINARIO para «0xB8 está CERRADA» (dos filas ya selladas, no el port):
 *  · `cmd_search` (SJOG.OVL:0x095c) al revelar una puerta secreta ESCRIBE 0xB9/0xB8 —
 *    una puerta recién revelada está cerrada.
 *  · `cmd_fire` (CMDS.OVL:0x0aea) para el proyectil en 0x97..0x99 O 0xB8..0xBB con
 *    DS 0x42fa 'Door destroyed!' — una puerta ABIERTA no pararía el proyectil, y las dos
 *    familias van SEPARADAS (segunda prueba de que 0xBB no es la mágica).
 */
describe("An Sanct — quita el cerrojo, NO abre (CAST.OVL:0x02d2, 0x03c0-0x03db)", () => {
  it("0xB9 (con cerrojo) → 0xB8 (cerrada, sin cerrojo)", () => {
    expect(unlockDoorTile(0xb9)).toBe(0xb8);
  });

  it("0xBB (con cerrojo, con ventana) → 0xBA (cerrada con ventana, sin cerrojo)", () => {
    expect(unlockDoorTile(0xbb)).toBe(0xba);
  });

  it("es EXACTAMENTE un `dec`: destino = origen − 1 en los dos casos", () => {
    expect(unlockDoorTile(0xb9)).toBe(0xb9 - 1);
    expect(unlockDoorTile(0xbb)).toBe(0xbb - 1);
  });

  it("NO deja la puerta abierta: el destino sigue siendo un tile de la familia PUERTA 0xB8..0xBB", () => {
    for (const t of [0xb9, 0xbb]) {
      const out = unlockDoorTile(t)!;
      expect(out).toBeGreaterThanOrEqual(0xb8);
      expect(out).toBeLessThanOrEqual(0xbb);
    }
  });

  it("NO toca las puertas MÁGICAS 0x97/0x98 — ésas son de (U)se Skull Key / An Ex Por", () => {
    expect(unlockDoorTile(0x97)).toBeNull();
    expect(unlockDoorTile(0x98)).toBeNull();
  });

  it("NO toca las puertas que ya están sin cerrojo (0xB8 / 0xBA): sin efecto", () => {
    expect(unlockDoorTile(0xb8)).toBeNull();
    expect(unlockDoorTile(0xba)).toBeNull();
  });

  it("no dispara en tiles ajenos a la familia (barrido 0x00..0xFF: sólo 0xB9 y 0xBB)", () => {
    const disparan = [];
    for (let t = 0; t <= 0xff; t++) if (unlockDoorTile(t) !== null) disparan.push(t);
    expect(disparan).toEqual([0xb9, 0xbb]);
  });
});
