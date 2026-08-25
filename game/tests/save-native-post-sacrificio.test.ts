/**
 * EXPORT POST-SACRIFICIO — la ficha 2 del acta de regeneración AD, con su causa cazada,
 * y el APARCAMIENTO SLOT-15 (ex-Task F) ya cerrado.
 *
 * Historia: `sacrificeFirstCompanion` (BLCKTHRN 0x03ae, world/blackthorn.ts) hacía sólo
 * `splice(victim, 1)` y `exportNativeSave` recorría los 16 slots fijos con
 * `state.characters[i]!` — el `!` le esconde el hueco a tsc (la clase de
 * `vitest-no-typechequea-el-fixture`) y en runtime era `undefined.name`: la excepción
 * moría como unhandled rejection del click y el export quedaba en **0 de 3 descargas
 * sin mensaje** (`espejo-ad-regeneracion.md` §5, transcript `[DIAG ad12] pageerror`).
 *
 * Cierre fiel (carril save-residuos): el binario 0x046c-0x04d4 compacta los 16 records
 * (0x04ab-0x04c0, bucle hasta `cmp si,0x57a8`) y APARCA el record entero del ejecutado
 * en el slot 15 (0x04c2 `di=0x5788` = g_party_records[15]) con el byte final a 0x7f
 * (0x04cf `mov [0x57A7],0x7f` = offset 0x1F, partyStatus). El port hace lo mismo:
 * splice (= compactación) + characters[15] = víctima con partyStatus 0x7f. Los
 * esperados de abajo van EN CRUDO (nombres de plantilla y byte 0x7f), no derivados
 * del sujeto.
 *
 * Mutantes que enrojecen: quitar el aparcamiento ⇒ caen los asertos del slot 15;
 * revertir la guarda `!c` de exportNativeSave a `state.characters[i]!` ⇒ estados
 * sintéticos cortos vuelven a lanzar (cubierto por el estado de 16 de este test sólo
 * en su rama; la guarda queda para huecos sintéticos).
 */
import { describe, it, expect } from "vitest";
import {
  exportNativeSave,
  parseSaveWindow,
  SAVED_GAM_SIZE,
} from "../src/core/saveNative.js";
import { createNewGame } from "../src/core/state.js";
import { sacrificeFirstCompanion } from "../src/core/world/blackthorn.js";

const CHAR_RECORDS_OFFSET = 0x02;
const CHAR_RECORD_SIZE = 0x20;

/** Plantilla sintética: 16 records con nombre y status vivo, bytes oscuros marcados. */
function template16(): Uint8Array {
  const gam = new Uint8Array(SAVED_GAM_SIZE).fill(0xa5); // huella de plantilla
  for (let i = 0; i < 16; i++) {
    const base = CHAR_RECORDS_OFFSET + i * CHAR_RECORD_SIZE;
    const name = `PJ${i}`;
    for (let j = 0; j < 9; j++) gam[base + j] = j < name.length ? name.charCodeAt(j) : 0;
    gam[base + 0x0b] = "G".charCodeAt(0); // status vivo (Good)
    gam[base + 0x1f] = i < 6 ? 0 : 0xff; // 6 en party
  }
  gam[0x2b5] = 6; // partySize
  return gam;
}

describe("exportNativeSave tras sacrificeFirstCompanion (aparcamiento slot 15)", () => {
  it("exporta SIN lanzar; la víctima viaja en el slot 15 con partyStatus 0x7f y el roster compactado", () => {
    const template = template16();
    const state = createNewGame(parseSaveWindow(template));
    const victima = sacrificeFirstCompanion(state);
    expect(victima).toBe("PJ1"); // el 2º miembro vivo, nunca el Avatar
    // compactación + aparcamiento: los 16 records siguen ahí (15 corridos + parqueado)
    expect(state.characters.length).toBe(16);

    const { gam } = exportNativeSave(state, template);

    // slot 15 (0x04c2-0x04cf): el record ENTERO de la víctima, byte final 0x7f
    const base15 = CHAR_RECORDS_OFFSET + 15 * CHAR_RECORD_SIZE;
    expect(String.fromCharCode(...gam.slice(base15, base15 + 3))).toBe("PJ1");
    expect(gam[base15 + 3]).toBe(0); // "PJ1" y no "PJ15": el 4º byte del nombre es NUL
    expect(gam[base15 + 0x1f]).toBe(0x7f); // [0x57A7]=0x7f — retira también el 0x00 «en party»
    // la compactación 0x04ab-0x04c0 corre los 16 records, no sólo el party:
    // el PJ15 de la plantilla queda en el slot 14
    const base14 = CHAR_RECORDS_OFFSET + 14 * CHAR_RECORD_SIZE;
    expect(String.fromCharCode(...gam.slice(base14, base14 + 4))).toBe("PJ15");
    // y el roster quedó DESPLAZADO: el slot 1 ya no es la víctima (PJ1), es PJ2
    const base1 = CHAR_RECORDS_OFFSET + 1 * CHAR_RECORD_SIZE;
    expect(String.fromCharCode(...gam.slice(base1, base1 + 3))).toBe("PJ2");
  });

  it("estado sintético CORTO (sin los 16 records): el hueco conserva los bytes de la plantilla, sin lanzar", () => {
    const template = template16();
    const state = createNewGame(parseSaveWindow(template));
    // recorta a 4 records (estado sintético tipo test): quedan huecos 4..14 tras aparcar
    state.characters = state.characters.slice(0, 4);
    state.partySize = 4;
    const victima = sacrificeFirstCompanion(state);
    expect(victima).toBe("PJ1");

    // ANTES del arreglo original esto lanzaba «Cannot read properties of undefined (reading 'name')»
    const { gam } = exportNativeSave(state, template);
    // hueco (slot 5): bytes de plantilla intactos
    const base5 = CHAR_RECORDS_OFFSET + 5 * CHAR_RECORD_SIZE;
    expect(String.fromCharCode(...gam.slice(base5, base5 + 3))).toBe("PJ5");
    // y el aparcamiento sigue siendo el slot 15 ABSOLUTO (0x5788 es dirección fija)
    const base15 = CHAR_RECORDS_OFFSET + 15 * CHAR_RECORD_SIZE;
    expect(String.fromCharCode(...gam.slice(base15, base15 + 3))).toBe("PJ1");
    expect(gam[base15 + 0x1f]).toBe(0x7f);
  });
});
