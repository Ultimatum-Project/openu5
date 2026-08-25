/**
 * Máquina pura de prompts de (H)ole up & camp — flujo hours→watch→guard→dormir +
 * cancelaciones. El guard es ahora un picker NAVEGABLE `select_party_member` (0x2d7a):
 * flechas mueven el cursor (→), 1-N elige, Enter/Space/0 confirma, ESC cancela. Reducers
 * puros (sin DOM/RNG). Deriva: re/notes/cmds.md §5, kernel 0x3C9A (0x3dbc/0x3e2c/0x3eac).
 */
import { describe, expect, it } from "vitest";
import { huella } from "../src/i18n/huella.js";
import esTable from "../src/i18n/es.json" with { type: "json" };
import {
  campPromptStart,
  campHours,
  campWatch,
  campGuardKey,
  bedHours,
  type CampPromptCtx,
} from "../src/core/campPrompt.js";

// Party de 3: idx 0 Avatar (G), 1 Shamino (G), 2 Iolo (P=no válido guardia). partySize 3.
const ctx = (watchCount: number): CampPromptCtx => ({
  watchCount,
  partySize: 3,
  isValidGuard: (idx) => idx >= 0 && idx < 3 && idx !== 2, // 0,1 válidos; 2 es 'P'
});
const guard = (hours: number, cursor: number) => ({ hours, cursor });

describe("campPrompt — arranque", () => {
  it("abre el prompt de horas", () => {
    expect(campPromptStart()).toEqual({
      phase: { kind: "hours" }, prints: ["For how many hours? (1-9) "],
    });
  });
});

describe("campPrompt — horas", () => {
  it("horas válidas con ≥2 despiertos → watch", () => {
    expect(campHours(8, ctx(3))).toEqual({
      phase: { kind: "watch", hours: 8 }, prints: ["\nWilt thou set a watch? "], // \n inicial fiel (0xa348)
    });
  });
  it("horas válidas con <2 despiertos → duerme directo, sin watch", () => {
    expect(campHours(5, ctx(1))).toEqual({
      phase: { kind: "sleep", hours: 5, guardIdx: -1 }, prints: [],
    });
  });
  it("0 horas → cancelado (sin turno), no duerme", () => {
    expect(campHours(0, ctx(3))).toEqual({ phase: { kind: "cancelled" }, prints: [] });
  });
  it("watchCount exactamente 2 → watch (límite 0x3e2c cmp 1; jle)", () => {
    expect(campHours(1, ctx(2)).phase).toEqual({ kind: "watch", hours: 1 });
  });
});

// ECO DEL DÍGITO DE HORAS — reporte del usuario con captura del original como testigo.
// Medido en `ULTIMA.EXE` kernel 0x3C9A: tras romper el bucle de getkey (0x3dbc, que sólo
// acepta dígito o ESPACIO), el CUERPO del comando hace `putchar(carácter)` (0x3dc6-0x3dcc)
// + `putchar('\n')` (0x3dcf-0x3dd3) y SÓLO DESPUÉS mira si cancela (0x3dd6 espacio /
// 0x3ddf '0'). ⇒ el eco PRECEDE a la cancelación y Espacio/'0' ecoan igual. El '\n' no
// viaja en el eco: en el port cada `hud.message` cierra su fila (#108), así que el eco se
// apendiza pelado — mismo trato que el char crudo del peaje de trolls (main.ts:1587).
describe("campPrompt — eco del dígito de horas (0x3dc6, ANTES de cancelar)", () => {
  it("dígito: ecoa el carácter y sigue al watch", () => {
    expect(campHours(8, ctx(3), "8")).toEqual({
      phase: { kind: "watch", hours: 8 }, prints: ["\nWilt thou set a watch? "], echo: "8",
    });
  });

  it("el eco acompaña también al paso directo a dormir (<2 despiertos)", () => {
    expect(campHours(5, ctx(1), "5")).toEqual({
      phase: { kind: "sleep", hours: 5, guardIdx: -1 }, prints: [], echo: "5",
    });
  });

  it("🔴 ESPACIO cancela pero ECOA IGUAL — el eco 0x3dc6 precede al test 0x3dd6", () => {
    expect(campHours(0, ctx(3), " ")).toEqual({
      phase: { kind: "cancelled" }, prints: [], echo: " ",
    });
  });

  it("🔴 '0' cancela pero ECOA IGUAL — el eco precede al test 0x3ddf", () => {
    expect(campHours(0, ctx(3), "0")).toEqual({
      phase: { kind: "cancelled" }, prints: [], echo: "0",
    });
  });

  it("ESC no ecoa: el getkey 0x3dbc no lo decodifica (cancelar con ESC es QoL del port)", () => {
    expect(campHours(0, ctx(3), "")).toEqual({ phase: { kind: "cancelled" }, prints: [] });
  });
});

// CAMA de pueblo — `CMDS.OVL:0x0552`, que NO es la misma rutina que el camp del kernel
// aunque el diálogo se parezca. Mismo eco `putchar(char)` + `putchar('\n')` (0x058c-0x059d)
// pero colocado AL OTRO LADO de los tests de cancelación (0x057a espacio / 0x0583 '0',
// ambos `jmp 0x6e8`): aquí cancelar sale ANTES de ecoar. La asimetría es el discriminante
// entre las dos rutinas y es lo único que separa este reductor de `campHours`.
describe("bedHours — CAMA de pueblo (CMDS.OVL:0x0552, eco DESPUÉS de cancelar)", () => {
  it("dígito: duerme y ecoa el carácter", () => {
    expect(bedHours(7, "7")).toEqual({ hours: 7, echo: "7" });
  });

  it("🔴 ESPACIO cancela SIN eco — 0x057a salta antes de llegar a 0x058c", () => {
    expect(bedHours(0, " ")).toEqual({ hours: 0 });
  });

  it("🔴 '0' cancela SIN eco — 0x0583 salta antes de llegar a 0x058c", () => {
    expect(bedHours(0, "0")).toEqual({ hours: 0 });
  });

  it("ESC tampoco ecoa (no decodificado en el original)", () => {
    expect(bedHours(0, "")).toEqual({ hours: 0 });
  });
});

// El eco de «Yes»/«No» es INLINE, no una fila. La pregunta (0xa348) acaba en ESPACIO sin
// `\n` y el binario imprime la respuesta (0xa368/0xa362) EN LA MISMA FILA. Estos dos casos
// ANTES exigían `prints: ["Yes", …]` / `["No"]` — es decir, FIJABAN EL DEFECTO: por `prints`
// el eco sale por `hud.message`, que abre fila propia. Se corrigen aquí junto con el fix.
describe("campPrompt — watch (el eco de la respuesta es INLINE, 0xa368/0xa362)", () => {
  it("Sí → eco 'Yes' inline + la pregunta del guardia en su fila", () => {
    expect(campWatch(true, 8)).toEqual({
      phase: { kind: "guard", hours: 8, cursor: 0 },
      echo: "Yes",
      prints: ["Who will stand guard? "],
    });
  });
  it("No → eco 'No' inline y a dormir sin guardia, sin más filas", () => {
    expect(campWatch(false, 8)).toEqual({
      phase: { kind: "sleep", hours: 8, guardIdx: -1 }, echo: "No", prints: [],
    });
  });
  it("🔴 ni 'Yes' ni 'No' viajan por prints (ahí abrirían fila propia)", () => {
    expect(campWatch(true, 8).prints).not.toContain("Yes");
    expect(campWatch(false, 8).prints).not.toContain("No");
  });
});

describe("campPrompt — picker de guardia (navegable, select_party_member 0x2d7a)", () => {
  it("selección directa por número: '2' = Shamino ('G') → duerme con idx 1, SIN eco de nombre", () => {
    expect(campGuardKey(guard(8, 0), "2", ctx(3))).toEqual({
      phase: { kind: "sleep", hours: 8, guardIdx: 1 }, prints: [],
    });
  });

  it("miembro NO-'G' ('3' = Iolo 'P') → 'None posted!' sin guardia", () => {
    expect(campGuardKey(guard(8, 0), "3", ctx(3))).toEqual({
      phase: { kind: "sleep", hours: 8, guardIdx: -1 }, prints: ["None posted!\n\n"],
    });
  });

  it("número fuera de party ('7') → IGNORA y sigue en el picker (fiel: getkey re-lee, NO 'None posted!')", () => {
    expect(campGuardKey(guard(8, 0), "7", ctx(3))).toEqual({
      phase: { kind: "guard", hours: 8, cursor: 0 }, prints: [],
    });
  });

  it("flecha mueve el cursor (→) sin cerrar: Abajo desde 0 → cursor 1", () => {
    expect(campGuardKey(guard(8, 0), "ArrowDown", ctx(3))).toEqual({
      phase: { kind: "guard", hours: 8, cursor: 1 }, prints: [],
    });
  });

  it("flecha envuelve: Arriba desde cursor 0 → cursor 2", () => {
    expect(campGuardKey(guard(8, 0), "ArrowUp", ctx(3)).phase).toEqual({ kind: "guard", hours: 8, cursor: 2 });
  });

  it("Enter confirma el CURSOR actual (cursor 1 = Shamino 'G') → duerme con idx 1", () => {
    expect(campGuardKey(guard(8, 1), "Enter", ctx(3))).toEqual({
      phase: { kind: "sleep", hours: 8, guardIdx: 1 }, prints: [],
    });
  });

  it("Space confirma cursor sobre miembro NO-'G' (cursor 2 = Iolo) → 'None posted!'", () => {
    expect(campGuardKey(guard(8, 2), " ", ctx(3))).toEqual({
      phase: { kind: "sleep", hours: 8, guardIdx: -1 }, prints: ["None posted!\n\n"],
    });
  });

  it("ESC cancela → 'None posted!' sin guardia (0x3ecd)", () => {
    expect(campGuardKey(guard(8, 0), "Escape", ctx(3))).toEqual({
      phase: { kind: "sleep", hours: 8, guardIdx: -1 }, prints: ["None posted!\n\n"],
    });
  });

  // A3 — el binario exige estado 'G' EXACTO y NO avisa de la elección fallida: 0x3ecd es
  // destino COMÚN del cancelar (0x3ebd je) y del no-'G' (0x3ecb je no tomado), y fuerza
  // guardia -1 imprimiendo la MISMA cadena. ⇒ elegir mal y cancelar son INDISTINGUIBLES
  // desde fuera. Un envenenado ('P') cuenta como consciente para otras cosas pero NO vale
  // de vigía. El port ya lo hacía así; este caso lo FIJA para que nadie lo "mejore" con un
  // aviso que el original no da.
  it("elegir a un no-'G' y cancelar producen EXACTAMENTE la misma salida (0x3ecd común)", () => {
    const elegirMal = campGuardKey(guard(8, 0), "3", ctx(3)); // Iolo, 'P'
    const cancelar = campGuardKey(guard(8, 0), "Escape", ctx(3));
    expect(elegirMal).toEqual(cancelar);
    expect(elegirMal.phase).toEqual({ kind: "sleep", hours: 8, guardIdx: -1 });
  });

  it("tecla no reconocida → ignora y sigue en el picker con el mismo cursor", () => {
    expect(campGuardKey(guard(5, 1), "x", ctx(3))).toEqual({
      phase: { kind: "guard", hours: 5, cursor: 1 }, prints: [],
    });
  });
});

describe("campPrompt — flujos completos (encadenado como lo conduce startCamp)", () => {
  it("hours(8) → watch(Sí) → flecha → Enter = dormir con el guardia del cursor movido", () => {
    const s1 = campHours(8, ctx(3));
    expect(s1.phase.kind).toBe("watch");
    const s2 = campWatch(true, (s1.phase as { hours: number }).hours);
    expect(s2.phase).toEqual({ kind: "guard", hours: 8, cursor: 0 });
    const s3 = campGuardKey(s2.phase as { hours: number; cursor: number }, "ArrowDown", ctx(3));
    expect(s3.phase).toEqual({ kind: "guard", hours: 8, cursor: 1 }); // cursor en Shamino
    const s4 = campGuardKey(s3.phase as { hours: number; cursor: number }, "Enter", ctx(3));
    expect(s4.phase).toEqual({ kind: "sleep", hours: 8, guardIdx: 1 });
  });

  it("hours(3) → watch(No) = dormir 3h sin guardia", () => {
    const s1 = campHours(3, ctx(3));
    const s2 = campWatch(false, (s1.phase as { hours: number }).hours);
    expect(s2.phase).toEqual({ kind: "sleep", hours: 3, guardIdx: -1 });
  });

  it("hours(6) con party solitario → dormir 6h directo (sin watch/guard)", () => {
    expect(campHours(6, ctx(1)).phase).toEqual({ kind: "sleep", hours: 6, guardIdx: -1 });
  });

  it("cancelar en horas → cancelado (nunca llega a dormir)", () => {
    expect(campHours(0, ctx(3)).phase).toEqual({ kind: "cancelled" });
  });
});

// GUARDA DE i18n DEL ECO INLINE. Mover «Yes»/«No» de `prints` a `echo` los saca del choke
// `t()` de `pushConsole`: pasan por `hud.messageAppend`, que NO traduce. Por eso main.ts
// aplica `t()` en el sink `printInline`. Este test cubre la mitad que SÍ es testeable sin
// DOM: que los literales del eco sigan siendo CLAVES VIVAS del corpus. Si alguien los
// renombra, la traducción moriría en silencio (t() devuelve la entrada si no es clave) y
// el castellano volvería a decir «Yes».
// ⚠ COTA DECLARADA: esto NO prueba que main.ts llame a `t()` — ese cableado vive en main.ts,
// que no es unit-testable; su pérdida solo la vería un e2e en castellano.
describe("i18n — los literales del eco inline siguen en el corpus", () => {
  const STRINGS = (esTable as { strings: Record<string, { t: string }> }).strings;

  it("«Yes» y «No» son claves vivas de es.json (y traducen a algo distinto)", () => {
    expect(STRINGS[huella("Yes")]?.t).toBe("Sí");
    expect(STRINGS[huella("No")]?.t).toBe("No");
  });

  it("el eco que emite campWatch es EXACTAMENTE una de esas claves", () => {
    expect(STRINGS[huella(campWatch(true, 8).echo!)]).toBeDefined();
    expect(STRINGS[huella(campWatch(false, 8).echo!)]).toBeDefined();
  });

  it("el eco del DÍGITO no es clave del corpus (sería absurdo traducirlo)", () => {
    for (const d of "0123456789 ") expect(STRINGS[huella(d)]).toBeUndefined();
  });
});
