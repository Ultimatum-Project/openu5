/**
 * VERBO DE RUMBO del vehículo — `transport_face` MAINOUT **0x00DA**.
 *
 * CLASE DEL SPEC: VEREDICTO-DE-FIDELIDAD. Cada aserto se adjudica contra el binario
 * (offset + string byte-exacto de DATA.OVL), no contra el comportamiento del port.
 *
 * EL HUECO QUE CIERRA: el port imprimía sólo el rumbo (`DIR_NAMES[dir]`) en todo paso,
 * también montado. El original antepone el verbo del vehículo — lo cazó el espejo, donde
 * 2 794 bloques del LP («F]v Nvrth» = «Fly North») divergían por esto y por nada más.
 *
 * ★ SON DOS RUTINAS, Y DIFIEREN EN UNA CLASE. Derivadas las dos del disasm:
 *
 * | clase | overworld `transport_face` MAINOUT 0x00DA | pueblo `town_transport_face` TOWN.OVL 0x057C |
 * |---|---|---|
 * | a pie `0x1C` | — (default 0x0106→0x0129) | — (default 0x05A0→0x05FC) |
 * | caballo `0x10` | «Ride » DS 0x2946 | «Ride » DS 0x2666 |
 * | alfombra `0x14` | «Fly » DS 0x294C | «Fly » DS 0x266C |
 * | esquife `0x28` | «Row » DS 0x2951 | «Row » DS 0x2671 |
 * | **barco `0x20`/`0x24`** | **«Head » DS 0x2956**, sólo si el facing CAMBIÓ, y `return 1` | **SIN VERBO**: 0x0591/0x0596 saltan DIRECTOS a 0x05ED (sólo recompone el tile); rutina VOID |
 *
 * Las palabras coinciden en los dos contextos (otro bloque de strings, mismo texto), así que
 * `faceVerb` es CONTEXT-FREE a propósito y el único reparto por contexto es el del barco, que
 * vive en `navalMove`. El rumbo también difiere: overworld lo gatea con `g_sail_dir==0`
 * (0x0500) y pueblo lo imprime SIEMPRE (0x0662, DS 0x2676).
 *
 * DERIVACIÓN DEL OVERWORLD (leída del disasm, no de las notas):
 *   0x00E5  mov al,[g_transport_tile] · 0x00EA  and ax,0xFC   → despacho por CLASE
 *   0x00ED  cmp 0x10 → 0x010A  push DS 0x2946 → "Ride "   (DATA.OVL file 0x2956)
 *   0x00F2  cmp 0x14 → 0x0130  push DS 0x294C → "Fly "    (file 0x295C)
 *   0x0101  cmp 0x28 → 0x0152  push DS 0x2951 → "Row "    (file 0x2961)
 *   0x00F7/0x00FC cmp 0x20/0x24 → 0x016A  push DS 0x2956 → "Head " (file 0x2966)
 *   0x0106  jmp 0x0129 (default, clase 0x1C a pie) → NO imprime nada
 * y el rumbo lo pone el llamador `outdoor_move` 0x0490 (0x0507 push DS 0x29DB =
 * "North\n", file 0x29EB) si `g_sail_dir == 0` (0x0500).
 *
 * Los verbos NO llevan `\n` y los rumbos SÍ ⇒ el original compone UNA línea.
 */
import { describe, it, expect } from "vitest";
import { faceVerb, TILE_FOOT, TILE_HORSE, TILE_CARPET, TILE_SKIFF, TILE_FRIGATE_SAILS_UP, TILE_FRIGATE_SAILS_DOWN } from "../src/core/world/transport.js";

describe("faceVerb · tabla de despacho de transport_face 0x00DA", () => {
  it("caballo 0x10-0x13 → «Ride » (0x010A, DS 0x2946)", () => {
    for (const t of [0x10, 0x11, 0x12, 0x13]) expect(faceVerb(t)).toBe("Ride ");
    expect(faceVerb(TILE_HORSE)).toBe("Ride ");
  });

  it("alfombra 0x14-0x17 → «Fly » (0x0130, DS 0x294C)", () => {
    for (const t of [0x14, 0x15, 0x16, 0x17]) expect(faceVerb(t)).toBe("Fly ");
    expect(faceVerb(TILE_CARPET)).toBe("Fly ");
  });

  it("esquife 0x28-0x2B → «Row » (0x0152, DS 0x2951)", () => {
    for (const t of [0x28, 0x29, 0x2a, 0x2b]) expect(faceVerb(t)).toBe("Row ");
    expect(faceVerb(TILE_SKIFF)).toBe("Row ");
  });

  it("a pie 0x1C/0x1D → SIN verbo (default 0x0106→0x0129, no imprime)", () => {
    expect(faceVerb(TILE_FOOT)).toBeNull();
    expect(faceVerb(0x1d)).toBeNull();
  });

  it("la fragata NO sale por esta tabla en NINGUNO de los dos contextos", () => {
    // Overworld: 0x20/0x24 imprimen «Head »+rumbo SÓLO si el facing cambió y devuelven 1
    // (abortan el paso) — esa asimetría la modela `headMessage`/`shipFacingStep`.
    // Pueblo: 0x0591/0x0596 saltan DIRECTOS a 0x05ED, que sólo recompone el tile: el barco
    // NO dice verbo en pueblo. Por eso `faceVerb` devuelve null y el reparto por contexto
    // vive en `navalMove` — si alguien «completase» esta tabla con «Head », rompería pueblo.
    for (const t of [TILE_FRIGATE_SAILS_UP, 0x22, TILE_FRIGATE_SAILS_DOWN, 0x26])
      expect(faceVerb(t)).toBeNull();
  });

  it("los verbos llevan ESPACIO final y NINGÚN salto de línea (bytes de DATA.OVL)", () => {
    // «Ride \0» «Fly \0» «Row \0» — el `\n` vive en el rumbo («North\n»), así que la
    // concatenación del original da UNA línea. Si alguien «limpia» el espacio, el eco
    // saldría pegado («FlyNorth») y dejaría de ser byte-exacto.
    for (const t of [TILE_HORSE, TILE_CARPET, TILE_SKIFF]) {
      const v = faceVerb(t)!;
      expect(v.endsWith(" ")).toBe(true);
      expect(v).not.toContain("\n");
    }
  });
});
