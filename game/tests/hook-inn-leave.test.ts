/**
 * ★★ EL HOOK `__u5test.innLeave` NO PUEDE EJECUTAR EL LEAVE EN LOCATION 0 (ficha E1,
 * espejo-auditor 21-08).
 *
 * El hook (main.ts → `testHookInnLeave`, debug/debugApi.ts) es el arnés de SWAP de party
 * del espejo: llama al CORE `core/shops.innLeave` (calco de SHOPPES3 0x02AE-0x047D, la
 * tecla L del posadero: `partyStatus = g_location` @0x040f, monthsAtInn=0, party−1). En el
 * BINARIO la precondición la garantiza la sesión: la tecla L sólo existe dentro de la
 * conversación del posadero (SHOPPES3), que sólo corre en un settlement — g_location nunca
 * es 0 ahí. Y el modelo de datos RESERVA el 0: `partyStatus` usa 0 como sentinel «en party»
 * (`state.ts` CharacterState: «0x00=en party, 0xFF=no unido, otro=settlement de posada»).
 *
 * El hook se saltaba esa precondición: un `dismiss` con la party en un SANTUARIO
 * (location 0 = Britannia/Underworld — caso ad13-g21 de la ruta AD) ejecutaba
 * `rosterLeaveCompact` con location=0 → partyStatus=0 (¡sigue «en party»!) con
 * partySize−1: **partySize=5 con 6 activos**, y el `join` de reincorporación rebotaba por
 * la rama `partyStatus === 0` de `joinByName` («Geoffrey rebota»). Este fichero REPRODUCE
 * esa corrupción (pre-guarda, los asertos de intacto salían 5-con-6) y queda como guarda:
 * NIEGA el error (el estado no se muta en location 0) y AFIRMA el rasgo correcto (la misma
 * llamada EN una posada sí ejecuta el leave fiel de SHOPPES3).
 *
 * Esperados EN CRUDO (literales, no derivados del sujeto): roster inicial de
 * `initial-state.json` = Avatar+Shamino+Iolo en party (0..2) y Mariah/Geoffrey/Jaana
 * (3..5) unidos a mano ⇒ party de 6 con Geoffrey en el índice 4.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { createNewGame, type ExtractedInitialState, type GameState } from "../src/core/state.js";
import { testHookInnLeave } from "../src/debug/debugApi.js";

function readJson<T>(url: string): T {
  const path = fileURLToPath(new URL(url, import.meta.url));
  return JSON.parse(readFileSync(path, "utf8").replace(/^﻿/, "")) as T;
}

/** Party de 6 (la del tramo ad13 del LP2): los 3 iniciales + Mariah, Geoffrey y Jaana. */
function partyDeSeis(): GameState {
  const s = createNewGame(readJson<ExtractedInitialState>("../assets/initial-state.json"));
  for (const idx of [3, 4, 5]) s.characters[idx]!.partyStatus = 0; // Mariah, Geoffrey, Jaana
  s.partySize = 6;
  return s;
}

const activos = (s: GameState): number => s.characters.filter((c) => c.partyStatus === 0).length;

describe("hook innLeave — guarda location !== 0 (ficha E1)", () => {
  it("★★ dismiss en un SANTUARIO (location 0): rechaza SIN tocar el roster — nada de partySize=5 con 6 activos", () => {
    const s = partyDeSeis();
    s.position.location = 0; // Britannia/Underworld: donde viven los santuarios
    // Precondición del propio test, en crudo:
    expect(s.partySize).toBe(6);
    expect(activos(s)).toBe(6);
    expect(s.characters[4]!.name).toBe("Geoffrey");

    const r = testHookInnLeave(s, "Geoffrey");

    // NIEGA el error: ni el ok, ni el partySize huérfano, ni el roster movido.
    expect(r.ok).toBe(false);
    expect(s.partySize).toBe(6); // la corrupción medida era 5…
    expect(activos(s)).toBe(6); // …con 6 activos; intacto = 6 y 6
    expect(r.partySize).toBe(6);
    expect(s.characters[4]!.name).toBe("Geoffrey"); // sin compactar: sigue en su slot
    expect(s.characters[4]!.partyStatus).toBe(0); // y sigue EN PARTY (no «hospedado en 0»)
    expect(s.characters).toHaveLength(16);
    // El mensaje es del INSTRUMENTO (esta rama no existe en el binario: no se fabrica texto EA).
    expect(r.message).toBe(
      "innLeave rechazado: location=0 (overworld/santuario) — la tecla L del posadero (SHOPPES3) solo existe dentro de una posada, y partyStatus=0 es el sentinel 'en party': hospedar aqui corromperia el roster",
    );
  });

  it("AFIRMA el rasgo — la MISMA llamada en una posada (location 2) ejecuta el leave fiel de SHOPPES3", () => {
    const s = partyDeSeis();
    s.position.location = 2; // settlement con posada (la misma location que usa shops.test.ts)
    const geoffrey = s.characters[4]!;

    const r = testHookInnLeave(s, "Geoffrey");

    expect(r.ok).toBe(true);
    expect(r.message).toBe("It shall be done.");
    expect(r.partySize).toBe(5);
    expect(s.partySize).toBe(5);
    expect(activos(s)).toBe(5); // partySize y activos se mueven JUNTOS: 5 y 5
    expect(geoffrey.partyStatus).toBe(2); // hospedado EN la settlement (0x040f)
    expect(geoffrey.monthsAtInn).toBe(0); // 0x0413
    expect(s.characters.indexOf(geoffrey)).toBe(15); // compactado al último slot (0x0465)
    expect(s.characters).toHaveLength(16);
  });

  it("nombre desconocido: rechaza sin tocar nada (rama previa a la guarda, conducta histórica del hook)", () => {
    const s = partyDeSeis();
    s.position.location = 0;
    const r = testHookInnLeave(s, "Nadie");
    expect(r.ok).toBe(false);
    expect(r.message).toBe("Nadie? I know of no such person.");
    expect(s.partySize).toBe(6);
    expect(activos(s)).toBe(6);
  });
});
