/**
 * FLUJO (R)eady — cadena de PRESENTACIÓN completa (bug del usuario 2026-07-28, con
 * capturas del original en DOSBox: «los mensajes y formato del log cuando se cambian
 * armadura, con ready no va igual que en orig»).
 *
 * Lo que este fichero SELLA es la envoltura de RECHAZO del picker, derivada instrucción
 * a instrucción de ZSTATS.OVL (disasm re/disasm/ZSTATS.OVL.asm; DATA.OVL = imagen del
 * DGROUP, `fileoff = DS + 0x10`, bytes volcados de original/u5/ultima5/DATA.OVL):
 *
 *   0bee: b8d497  mov ax, 0x97d4   ; DS 0x97d4 = "\n\n"
 *   0bf1  push / call 0x3670       ; print
 *   0bf8: ff7604  push [bp+4]      ; el mensaje de rechazo
 *   0bfb  call 0x3670
 *   0bfe: b8d897  mov ax, 0x97d8   ; DS 0x97d8 = "\n\nItem: "
 *   0c02  call 0x3670
 *
 * TODOS los rechazos de `try_equip_or_unequip` (@0x0c5c) llegan aquí: cada rama hace
 * `jmp 0xd2f` y 0xd2f es `push ax; call 0xbee`. Ramas censadas (la FAMILIA entera):
 *   0x0cae → DS 0x97e2 'Thou canst not change armour in heated battle!'
 *   0x0d2c → DS 0x981c 'Thou hast no ammunition for that weapon!'
 *   0x0dd5 → DS 0x9846 'Remove first thy present helm!'
 *   0x0e5a → DS 0x9866 'Thou must first remove thine other armour!'
 *   0x0e7c → DS 0x9892 'Thou must free one of thy hands first!'
 *   0x0eac → DS 0x98ba 'Both hands must be free before thou canst wield that!'
 *   0x0eca → DS 0x98f0 'Thou must remove thine other amulet!'
 *   0x0eec → DS 0x9916 'Only one magic ring may be worn at a time!'
 *   0x0f00 → DS 0x9942 'Thou art not strong enough!'
 * NO pasan por 0xbee (print directo por 0x3670, comprobado en el disasm):
 *   0x0e1f → DS 0x995e '\n\nRing vanishes!\n' (y el controller SALE)
 *   0x12c7 → DS 0x997e 'Thou art empty-\nhanded!\n' (cmd_ready, sin abrir picker)
 *   0x12d0 → DS 0x9998 'Item: ' · 0x1248 → DS 0x9970 'Done\n'
 *
 * El clon imprimía el mensaje PELADO: sin la línea en blanco de separación y sin el
 * re-prompt «Item: » — de ahí que el log «pegue líneas» respecto al original.
 */
import { describe, it, expect } from "vitest";
import { READY_UI, CMD_STRINGS, readyRejectLines } from "../src/core/world/cmd-strings.js";

describe("(R)eady — envoltura de rechazo del picker (ZSTATS 0x0bee)", () => {
  it("separa con línea en blanco y RE-IMPRIME 'Item: ' tras el mensaje", () => {
    // ZSTATS 0x0bee: print(DS 0x97d4 "\n\n") + print(msg) + print(DS 0x97d8 "\n\nItem: ").
    // Sobre la fila viva «Item: » el primer "\n\n" cierra la fila y deja UNA en blanco;
    // el segundo hace lo propio tras el mensaje y abre la fila del re-prompt.
    expect(readyRejectLines("Remove first thy present helm!")).toEqual([
      "",
      "Remove first thy present helm!",
      "",
      "Item: ",
    ]);
  });

  it("la cola del rechazo es el prompt 'Item: ' vivo (DS 0x9998) — el ESC posterior lo completa a 'Item: Done'", () => {
    // El «Done» del ESC (DS 0x9970, item_page_controller @0x123e) se APPENDEA a la fila
    // de mensaje viva; tras un rechazo esa fila debe ser el re-prompt, no el mensaje.
    const lines = readyRejectLines("Thou art not strong enough!"); // DS 0x9942
    expect(lines.at(-1)).toBe(READY_UI.item);
    expect(READY_UI.item + READY_UI.done).toBe("Item: Done");
  });

  it("un rechazo silencioso (mensaje vacío) NO emite envoltura", () => {
    // 0x0c82 (Arrows/Quarrels) y 0x0db2-default RETORNAN sin print: `equipItem` los
    // devuelve con message:"" y el call-site no debe inventar separación ni re-prompt.
    expect(readyRejectLines("")).toEqual([]);
  });

  it("el eco del comando lleva los puntos suspensivos EN la cadena (DS 0xa1f0)", () => {
    // ULTIMA.EXE 0x339a: `mov ax,0xa1f0; push; call 0x1850` ANTES del handler
    // (dispatch_table.py: R @339a 'Ready...' → ZSTATS.OVL:0x1296, stub 0x7e4e). Los «...»
    // son bytes de la cadena, no adorno del renderizador.
    expect(CMD_STRINGS.ready).toBe("Ready...\n\n");
  });
});
