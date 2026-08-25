/**
 * Guardas de `e2e/espejo-tour/vehiculo.ts` — conducir el `v` que la ruta ya declara.
 *
 * Los asertos que IMPORTAN (los demás son cobertura de forma):
 *  1. **`walk` no conduce** — y va con su CONTROL POSITIVO: el MISMO estado con `v="fly"`
 *     SÍ dispara. Sin ese par, un `walk` que no dispara no distingue «la guarda funciona»
 *     de «la decisión no dispara nunca».
 *  2. **`ride` → 0x12, no 0x10** — 0x10 es el caballo SIN JINETE. Los dos dan el mismo
 *     `transportBase` y el mismo modo, así que el aserto tiene que mirar el TILE: un test
 *     que comparase `modoDeseado` pasaría con el bug puesto.
 *  3. **caballo y alfombra NO giran con `+facing`** — Norte y Sur dejan el tile intacto y
 *     Oeste escribe un literal. `+facing` daría 0x16/0x17, que no son alfombra.
 *  4. **el vehículo FABRICADO se marca** — es lo que rompe la comparabilidad.
 */
import { describe, it, expect } from "vitest";
import {
  decideVehiculo,
  tileParaVehiculo,
  acumulaVehiculo,
  acumulaInventario,
  HULL_MAX,
  reporteVehiculoVacio,
  resumenVehiculo,
  AVISO_NO_COMPARABLE,
  VEH_A_MODO,
  type TransporteVivo,
} from "../e2e/espejo-tour/vehiculo";

/** Estado vivo típico de las semillas que mueren: ahogado, sin alfombra y sin esquife. */
const AHOGADO: TransporteVivo = {
  transport: "foot",
  transportTile: 0x00,
  magicCarpets: 0,
  shipSkiffs: 0,
  shipHull: 0,
};
const EN_ALFOMBRA: TransporteVivo = { ...AHOGADO, transport: "carpet", transportTile: 0x14, magicCarpets: 1 };

describe("vocabulario de `v` — derivado del corpus, cerrado", () => {
  it("las cinco etiquetas mapean a las cinco clases del binario", () => {
    expect(VEH_A_MODO).toEqual({
      walk: "foot",
      fly: "carpet",
      ride: "horse",
      row: "skiff",
      head: "ship",
    });
  });
});

describe("★ `walk` NO se conduce (y su control positivo)", () => {
  it("walk sobre una party ahogada NO dispara resync", () => {
    const p = decideVehiculo("walk", AHOGADO, "south", true);
    expect(p.aplica).toBe(false);
    expect(p.motivo).toMatch(/walk-no-es-observacion/);
  });

  it("CONTROL POSITIVO: el MISMO estado con v=fly SÍ dispara", () => {
    const p = decideVehiculo("fly", AHOGADO, "south", true);
    expect(p.aplica).toBe(true);
    expect(p.modoDeseado).toBe("carpet");
  });

  it("una etiqueta fuera del vocabulario tampoco conduce (no invento una clase)", () => {
    const p = decideVehiculo("teleport", AHOGADO, "south", true);
    expect(p.aplica).toBe(false);
    expect(p.motivo).toMatch(/vocabulario-desconocido:teleport/);
  });
});

describe("★ el tile del caballo montado es 0x12, no el caballo suelto 0x10", () => {
  it("ride al este monta (0x12) y NO deja el caballo del mundo (0x10)", () => {
    expect(tileParaVehiculo("ride", "east")).toBe(0x12);
    expect(tileParaVehiculo("ride", "east")).not.toBe(0x10);
  });
  it("ride al oeste es 0x13", () => {
    expect(tileParaVehiculo("ride", "west")).toBe(0x13);
  });
});

describe("★ dos sprites (caballo/alfombra) vs cuatro (barcos)", () => {
  it("la alfombra sólo tiene Este (0x14) y Oeste (0x15): N y S no fabrican 0x16/0x17", () => {
    expect(tileParaVehiculo("fly", "east")).toBe(0x14);
    expect(tileParaVehiculo("fly", "west")).toBe(0x15);
    expect(tileParaVehiculo("fly", "north")).toBe(0x14);
    expect(tileParaVehiculo("fly", "south")).toBe(0x14);
    // el mutante que este aserto mata: `base + TURN_ARG[dir]`
    expect([tileParaVehiculo("fly", "south"), tileParaVehiculo("fly", "west")]).not.toContain(0x16);
  });

  it("el caballo tampoco gira con +facing (N/S intactos)", () => {
    expect(tileParaVehiculo("ride", "north")).toBe(0x12);
    expect(tileParaVehiculo("ride", "south")).toBe(0x12);
  });

  it("los barcos SÍ giran con (tile & 0xFC) + facing", () => {
    expect(tileParaVehiculo("head", "north")).toBe(0x20);
    expect(tileParaVehiculo("head", "east")).toBe(0x21);
    expect(tileParaVehiculo("head", "south")).toBe(0x22);
    expect(tileParaVehiculo("head", "west")).toBe(0x23);
    expect(tileParaVehiculo("row", "west")).toBe(0x2b);
  });
});

describe("no tocar lo que ya casa", () => {
  it("fly con la alfombra ya puesta es no-op", () => {
    const p = decideVehiculo("fly", EN_ALFOMBRA, "east", true);
    expect(p.aplica).toBe(false);
    expect(p.motivo).toBe("ya-conforme:carpet");
  });
  it("con el modo apagado no se aplica NADA (camino histórico)", () => {
    const p = decideVehiculo("fly", AHOGADO, "east", false);
    expect(p.aplica).toBe(false);
    expect(p.motivo).toBe("modo-off");
  });
});

describe("★ lo FABRICADO se marca (es lo que rompe la comparabilidad)", () => {
  it("montar alfombra sin alfombra en el estado se marca fabricado", () => {
    const p = decideVehiculo("fly", AHOGADO, "east", true);
    expect(p.fabricado).toMatch(/alfombra/);
    expect(p.via).toBe("use-carpet");
  });
  it("con g_carpets ≥ 1 se monta SIN fabricar nada", () => {
    const p = decideVehiculo("fly", { ...AHOGADO, magicCarpets: 1 }, "east", true);
    expect(p.aplica).toBe(true);
    expect(p.fabricado).toBeNull();
  });
  it("la fragata sin casco se marca fabricada y va por la vía del tile", () => {
    const p = decideVehiculo("head", AHOGADO, "north", true);
    expect(p.fabricado).toMatch(/fragata/);
    expect(p.via).toBe("tile");
    expect(p.tile).toBe(0x20);
  });
});

describe("el reporte declara, y sólo cuando hay algo que declarar", () => {
  it("sin resyncs no hay aviso de no-comparabilidad", () => {
    const rep = reporteVehiculoVacio(true);
    acumulaVehiculo(rep, decideVehiculo("walk", AHOGADO, "north", true));
    expect(rep.aplicados).toBe(0);
    expect(rep.aviso).toBeNull();
    expect(rep.pasosPorVehiculo).toEqual({ walk: 1 });
  });

  it("con un resync aparece el aviso literal del §(b)", () => {
    const rep = reporteVehiculoVacio(true);
    acumulaVehiculo(rep, decideVehiculo("fly", AHOGADO, "east", true));
    expect(rep.aplicados).toBe(1);
    expect(rep.aviso).toBe(AVISO_NO_COMPARABLE);
    expect(rep.transiciones).toEqual({ "foot→carpet": 1 });
    expect(rep.fabricados["alfombra (g_carpets=0 en la semilla)"]).toBe(1);
    expect(resumenVehiculo(rep)).toMatch(/FABRICADO/);
  });

  it("el modo apagado se ve en el resumen (un reporte sin bloque sería ambiguo)", () => {
    expect(resumenVehiculo(reporteVehiculoVacio(false))).toMatch(/modo-off/);
  });
});

// ══════════════════════════════════════════════════════════════════════════════════════════
// EL INVENTARIO DEL VEHÍCULO FABRICADO (carril `espejo-cadena-limpia`).
// ══════════════════════════════════════════════════════════════════════════════════════════
// Lo que se guarda aquí es la avería que hundió la cadena: `HULL_MAX` estaba DECLARADA en
// este módulo y no la usaba nadie, así que la fragata fabricada nacía con `shipHull = 0` y se
// hundía con el primer daño (medido: 10 `Ship sunk!` y 8 `DROWNING!!!` en part07 encadenada,
// contra 2 y 0 en TODO el corpus del LP). El contador se cuenta sobre lo APLICADO —no sobre
// el plan— porque un contador que sigue dando la cifra correcta con el escritor borrado no
// mide nada; el mutante de abajo es lo que lo acredita.
describe("inventario del vehículo fabricado", () => {
  const aplicado = (hullAntes: number, hullDespues: number, skAntes = 0, skDespues = 0) => ({
    tileAntes: 0x1c,
    tileDespues: 0x20,
    carpetsAntes: 0,
    carpetsDespues: 0,
    hullAntes,
    hullDespues,
    skiffsAntes: skAntes,
    skiffsDespues: skDespues,
    echo: [] as string[],
  });

  it("★ el default es REPONER — quien llame sin el argumento obtiene la conducta correcta", () => {
    // Si el default fuese el histórico, olvidarse del parámetro reintroduciría la avería en
    // silencio, que es exactamente cómo entró la primera vez.
    expect(reporteVehiculoVacio(true).reponInventario).toBe(true);
    expect(reporteVehiculoVacio(true, false).reponInventario).toBe(false);
  });

  it("cuenta la reposición que OCURRIÓ (casco 0→99) y no la que no (99→99)", () => {
    const rep = reporteVehiculoVacio(true);
    acumulaInventario(rep, aplicado(0, HULL_MAX)); // fragata fabricada: se repone
    expect(rep.inventarioRepuesto).toBe(1);
    acumulaInventario(rep, aplicado(HULL_MAX, HULL_MAX)); // nave que YA existía: no se toca
    expect(rep.inventarioRepuesto).toBe(1);
    acumulaInventario(rep, aplicado(0, 0, 0, 1)); // esquife fabricado: también cuenta
    expect(rep.inventarioRepuesto).toBe(2);
  });

  it("★ el brazo histórico se DECLARA en el resumen (si no, los dos brazos serían iguales)", () => {
    const roto = reporteVehiculoVacio(true, false);
    acumulaVehiculo(roto, decideVehiculo("head", AHOGADO, "north", true));
    expect(resumenVehiculo(roto)).toMatch(/NO repuesto/);
    const bueno = reporteVehiculoVacio(true, true);
    acumulaVehiculo(bueno, decideVehiculo("head", AHOGADO, "north", true));
    acumulaInventario(bueno, aplicado(0, HULL_MAX));
    expect(resumenVehiculo(bueno)).toMatch(/REPUESTO×1/);
    // control positivo del par: los dos resúmenes describen el MISMO resync y difieren
    expect(resumenVehiculo(roto)).not.toBe(resumenVehiculo(bueno));
  });

  it("HULL_MAX es 99 = el casco que escribe el port al abordar (game.ts:4552), no un número elegido", () => {
    expect(HULL_MAX).toBe(0x63);
  });
});
