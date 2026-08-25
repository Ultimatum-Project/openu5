/**
 * LA GUARDA EA-LIMPIA del formato de récord, y sus mutantes.
 *
 * Sujeto: `demo-byo/src/records-formato.ts`. Lo que se prueba no es «el validador acepta un
 * récord válido» —eso lo pasaría un `return true`— sino QUÉ RECHAZA, y en particular el
 * caso por el que el módulo existe: **una repetición local entera, con su ancla dentro**.
 *
 * Vive en `game/tests` porque es la única raíz de vitest del repo (game/vite.config.ts) y
 * porque así corre en `npm test -w game` con todo lo demás: un test de esta guarda que
 * hubiera que acordarse de lanzar aparte es una guarda que un día no corre.
 */
import { describe, expect, it } from "vitest";
import {
  FORMATO_RECORD,
  LIMITES,
  canonizaRecord,
  idDeRecord,
  medidaDeStream,
  validaRecord,
  type RecordSubida,
} from "../../demo-byo/src/records-formato.js";
import { encodeEvents } from "../src/replay/codec.js";
import type { ReplayEvent, ReplayLog } from "../src/replay/types.js";

/** Una secuencia de teclas realista: movimiento, comandos y algo escrito. */
function eventos(n: number): ReplayEvent[] {
  const teclas = ["ArrowUp", "ArrowRight", "ArrowDown", "ArrowLeft", "k", "z", "Enter", "a", "b"];
  const out: ReplayEvent[] = [];
  let turno = 0;
  for (let i = 0; i < n; i++) {
    if (i % 3 !== 0) turno += 1; // no toda tecla gasta turno
    out.push({ key: teclas[i % teclas.length]!, turn: turno });
  }
  return out;
}

function recordValido(n = 50): RecordSubida {
  const evs = eventos(n);
  const s = encodeEvents(evs);
  return {
    v: FORMATO_RECORD,
    alias: "Kokoima",
    base: { tipo: "momento", id: "01-fuga" },
    anclaHash: "a".repeat(64),
    semilla: 12345,
    keys: s.keys,
    turns: s.turns,
    mods: s.mods,
    count: evs.length,
    lastTurn: evs[evs.length - 1]!.turn,
    motor: "0f92f03d",
    desenlaceReclamado: false,
  };
}

describe("formato de récord: lo que pasa", () => {
  it("acepta un récord bien formado", () => {
    const v = validaRecord(JSON.parse(JSON.stringify(recordValido())));
    expect(v.ok).toBe(true);
  });

  it("recorta el alias y conserva letras acentuadas", () => {
    const r = { ...recordValido(), alias: "  Águeda del Bosque  " };
    const v = validaRecord(JSON.parse(JSON.stringify(r)));
    expect(v.ok && v.record.alias).toBe("Águeda del Bosque");
  });

  it("el id es del CONTENIDO: dos envíos idénticos dan el mismo id, y uno distinto no", async () => {
    const a = recordValido();
    const b = { ...recordValido(), alias: "Otro" };
    expect(await idDeRecord(a)).toBe(await idDeRecord(recordValido()));
    expect(await idDeRecord(a)).not.toBe(await idDeRecord(b));
  });

  it("la forma canónica no depende del orden en que se construyó el objeto", () => {
    const r = recordValido();
    const alReves = Object.fromEntries(Object.entries(r).reverse()) as unknown as RecordSubida;
    expect(canonizaRecord(alReves)).toBe(canonizaRecord(r));
  });
});

describe("🔴 EA-LIMPIO: lo que la guarda RECHAZA", () => {
  /**
   * EL TEST QUE JUSTIFICA EL MÓDULO. Un `ReplayLog` es lo que el juego guarda en IndexedDB
   * y lo que subiría quien implementara esto de la forma obvia (`POST` del log tal cual).
   * Dentro va `anchor.state`, que es el GameState serializado: los 16 registros del roster
   * de INIT.GAM con nombre y stats, y el diario con texto de EA verbatim. Tiene que
   * rebotar, y rebotar NOMBRANDO el campo.
   */
  it("una repetición local ENTERA rebota, y el motivo nombra `anchor`", () => {
    const r = recordValido();
    const log: ReplayLog = {
      v: 1,
      id: "replay-abc",
      label: "mi partida",
      createdAt: 1_700_000_000_000,
      anchor: {
        state: JSON.stringify({
          characters: [{ name: "Shamino", strength: 21, dexterity: 24, intelligence: 12 }],
          journal: [{ turn: 3, location: 1, npc: "Iolo", text: "texto de EA verbatim" }],
        }),
        seed: 999,
      },
      keys: r.keys,
      turns: r.turns,
      mods: r.mods,
      count: r.count,
      lastTurn: r.lastTurn,
    };
    const v = validaRecord(JSON.parse(JSON.stringify(log)));
    expect(v.ok).toBe(false);
    expect(!v.ok && v.motivo).toContain("anchor");
  });

  /**
   * El `.gam` que pide el encargo, por sus DOS caminos posibles: crudo (no es ni JSON) y
   * disfrazado dentro de un campo del formato. No hay un tercero, porque no hay más campos.
   */
  it("un .gam no entra: ni crudo, ni metido en un campo del formato", () => {
    // 4 KB de bytes binarios como los de un SAVED.GAM.
    const gam = Array.from({ length: 4096 }, (_, i) => String.fromCharCode((i * 37) % 256)).join("");
    // (a) el cuerpo entero es el fichero: no es un objeto.
    expect(validaRecord(gam).ok).toBe(false);
    // (b) como campo nuevo: campo no permitido.
    const conCampo = { ...recordValido(), gam } as unknown;
    const va = validaRecord(JSON.parse(JSON.stringify(conCampo)));
    expect(va.ok).toBe(false);
    expect(!va.ok && va.motivo).toContain("gam");
    // (c) escondido en `keys`: los bytes altos no son teclas y, aunque decodificaran, ni el
    //     count cuadraría ni volverían a codificarse igual.
    const enKeys = { ...recordValido(), keys: gam } as unknown;
    expect(validaRecord(JSON.parse(JSON.stringify(enKeys))).ok).toBe(false);
    // (d) en base64 dentro del alias: el alias tiene alfabeto y longitud.
    const enAlias = { ...recordValido(), alias: btoa(gam.slice(0, 100)) } as unknown;
    expect(validaRecord(JSON.parse(JSON.stringify(enAlias))).ok).toBe(false);
  });

  it("un objeto anidado nuevo dentro de `base` tampoco cuela", () => {
    const r = { ...recordValido(), base: { tipo: "momento", id: "01-fuga", extra: { x: 1 } } };
    const v = validaRecord(JSON.parse(JSON.stringify(r)));
    expect(v.ok).toBe(false);
    expect(!v.ok && v.motivo).toContain("extra");
  });
});

/**
 * ── MUTANTES POR CAUSA ───────────────────────────────────────────────────────────────
 * Cada uno rompe UNA condición de la guarda; si el test siguiera verde, esa condición no
 * la está guardando nadie. Se mutan los DATOS (que es lo que llega por la red), no el
 * código: un payload que difiere del válido en exactamente esa condición.
 */
describe("mutantes: cada condición mata a la suya", () => {
  const casos: [string, unknown, string][] = [
    ["M1 falta un campo", (() => { const r = recordValido() as unknown as Record<string, unknown>; delete r["motor"]; return r; })(), "motor"],
    ["M2 versión de formato futura", { ...recordValido(), v: 2 }, "formato"],
    ["M3 count que no cuadra con el stream", { ...recordValido(), count: 7 }, "count"],
    ["M4 lastTurn que no es el de la última tecla", { ...recordValido(), lastTurn: 99_999 }, "lastTurn"],
    // 🔴 M5 ES EL MUTANTE MÁS FINO Y EL QUE ESTUVO A PUNTO DE NO EXISTIR. La primera
    // versión metía basura en `turns` («ÿ»×50) y la mataba el aserto de `lastTurn`, no el
    // de forma canónica: habría dejado sin vigilar justo la condición que separa esta
    // guarda de un parser. Éste decodifica a LOS MISMOS eventos —mismo count, mismo
    // lastTurn— y sólo difiere en que un delta va escapado sin necesidad. Sobrevive a todo
    // menos al punto fijo del codec.
    ["M5 un turno escapado sin necesidad: mismos eventos, forma no canónica",
      (() => {
        const r = recordValido();
        const d = r.turns.charCodeAt(0) - 0x30;
        return { ...r, turns: `\x7f${d.toString(36)}\x00${r.turns.slice(1)}` };
      })(),
      "canónica"],
    ["M6 semilla negativa", { ...recordValido(), semilla: -1 }, "semilla"],
    ["M7 hash que no es SHA-256", { ...recordValido(), anclaHash: "abc" }, "anclaHash"],
    ["M8 alias vacío", { ...recordValido(), alias: "   " }, "alias"],
    ["M9 base.tipo inventado", { ...recordValido(), base: { tipo: "partida-mia", id: "x" } }, "base.tipo"],
    ["M10 motor con espacios y barras", { ...recordValido(), motor: "mi motor/2" }, "motor"],
  ];
  for (const [nombre, payload, esperado] of casos) {
    it(nombre, () => {
      const v = validaRecord(JSON.parse(JSON.stringify(payload)));
      expect(v.ok).toBe(false);
      expect(!v.ok && v.motivo).toContain(esperado);
    });
  }

  /**
   * 🔴 EL MUTANTE DEL PUNTO FIJO, que es el que separa esta guarda de un parser. `mods`
   * describe modificadores por índice; uno que apunta a una tecla que existe pero con
   * flags a 0 DECODIFICA sin problema y produce los mismos eventos… y al re-codificar
   * desaparece. Es un payload que «pasa el parser» y no es un registro.
   */
  it("M11 un sidecar de modificadores que no re-emerge al codificar", () => {
    const r = { ...recordValido(), mods: "3:0" };
    const v = validaRecord(JSON.parse(JSON.stringify(r)));
    expect(v.ok).toBe(false);
    expect(!v.ok && v.motivo).toContain("canónica");
  });
});

/**
 * ── LA COTA DE TAMAÑO, DERIVADA AQUÍ Y NO COPIADA ───────────────────────────────────
 * ⚠ La secuencia es SINTÉTICA (la mezcla de `eventos()`), así que lo que mide es el CODEC y
 * no una partida real. Con eso basta para lo que la cota tiene que garantizar: que el tope
 * del endpoint no recorte una partida legítima.
 */
describe("cota de tamaño", () => {
  it("MAX_BYTES deja sitio de sobra para el máximo de teclas permitido", () => {
    const m = medidaDeStream(eventos(10_000));
    // Extrapolación lineal al tope de teclas (el codec es de coste constante por tecla en
    // esta mezcla; si dejara de serlo, este mismo aserto se pondría rojo al subir la cota).
    const alTope = (m.bytes / 10_000) * LIMITES.MAX_TECLAS;
    expect(m.porTecla).toBeLessThan(3);
    expect(alTope).toBeLessThan(LIMITES.MAX_BYTES);
    // Y el payload COMPLETO de una partida de 10 000 teclas, serializado tal cual viaja:
    const evs = eventos(10_000);
    const s = encodeEvents(evs);
    const completo = canonizaRecord({
      ...recordValido(),
      keys: s.keys,
      turns: s.turns,
      mods: s.mods,
      count: evs.length,
      lastTurn: evs[evs.length - 1]!.turn,
    });
    expect(new TextEncoder().encode(completo).length).toBeLessThan(LIMITES.MAX_BYTES);
  });
});
