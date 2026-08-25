/**
 * RE-SIEMBRA DEL ESPEJO — guarda de la parte PURA (decisión + evidencia + declaración).
 *
 * Lo que se ejercita aquí es todo lo que decide SI se siembra y QUÉ se siembra; el
 * aplicador (`aplicaResiembra`) es un `page.evaluate` y lo mide la corrida real.
 *
 * 🔴 EL TEST QUE MÁS IMPORTA ES EL CONTROL POSITIVO DE `RE_MUERTE`. El guard de frontera
 * («si el original TAMBIÉN perdió gente aquí, no se siembra») descansa en un predicado de
 * AUSENCIA sobre el corpus, y un predicado de ausencia con el patrón mal escrito da 0 y se
 * lee como «no hay» — que es exactamente el veredicto que hace disparar la siembra. Con la
 * constante vacía todos los demás asertos de este fichero seguirían pasando.
 */
import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  parseModo,
  evidenciaDeCorpus,
  decideResiembra,
  planMuta,
  reporteResiembra,
  resumenResiembra,
  camposNoSembrados,
  RE_MUERTE,
  RE_CARPET,
  FOOD_REFUGE,
  type EstadoVivo,
} from "../e2e/espejo-tour/resiembra";

const ROUTES = join(dirname(fileURLToPath(import.meta.url)), "..", "e2e", "espejo-tour", "routes");

const SEIS = ["Min", "Shamino", "Iolo", "Jaana", "Julia", "Gwenno"];

function estado(
  statuses: string[],
  food: number | null = 30,
  intrusosEnPrefijo = 0,
  magicCarpets: number | null = 1,
): EstadoVivo {
  return {
    partySize: statuses.length,
    miembros: statuses.map((s, i) => ({ nombre: SEIS[i] ?? `X${i}`, status: s, currentHp: s === "D" ? 0 : 40, maxHp: 60 })),
    intrusosEnPrefijo,
    food,
    magicCarpets,
  };
}
/** aplicado NEUTRO (nada cambió) — para los tests de la declaración. */
function nada() {
  return { revividos: [], noEncontrados: [], foodAntes: 30, foodDespues: 30, carpetAntes: 1, carpetDespues: 1 };
}
const VIVA = () => estado(["G", "G", "G", "G", "G", "G"]);
const MUERTA = () => estado(["D", "D", "D", "D", "D", "D"]);
const CORPUS_VIVO = () => evidenciaDeCorpus(["Ready... Player: Iolo", "Julia, armed with Bow:"], SEIS);

describe("re-siembra — control positivo del patrón de muerte", () => {
  // El texto del binario, no una paráfrasis: `BLCKTHRN.OVL:0x0910` narra el refuge con esta
  // línea, y es la que el carril `saves-party-muerta` contó 0 veces en los 24 ocrlogs.
  it("RE_MUERTE casa con las frases de muerte del original", () => {
    for (const frase of [
      "An unending darkness engulfs thee...",
      "Julia is dead!",
      "BATTLE IS LOST!",
      "Gwenno has fallen!",
      "Shamino slain!",
    ]) {
      expect(RE_MUERTE.test(frase), frase).toBe(true);
    }
  });
  // 🔴 FALSOS POSITIVOS MEDIDOS, y por qué se dejan. El censo del corpus AD encuentra DOS
  // bloques que casan sin ser muertes: prosa de tienda («0ur Slings hav slain giants!»,
  // ad01) y una profecía TLK («And then will Shamino die!» + «has fallen», ad12). Un falso
  // positivo aquí sólo puede BLOQUEAR una siembra, nunca provocarla — el fallo cae del lado
  // conservador — así que se prefiere a afinar el patrón y arriesgar el fallo contrario.
  // Este test FIJA esa dirección: si alguien afina el regex, tiene que verlo aquí.
  it("los falsos positivos medidos siguen casando — el fallo cae del lado que NO siembra", () => {
    expect(RE_MUERTE.test("0ur Slings hav slain giants!")).toBe(true);
    expect(RE_MUERTE.test("until the sand has fallen. And then will Shamino die!")).toBe(true);
    const p = decideResiembra("wipe", MUERTA(), evidenciaDeCorpus(["Iolo", "0ur Slings hav slain giants!"], SEIS), 1, false);
    expect(p.disparo).toBe("corpus-con-muertes");
    expect(planMuta(p)).toBe(false);
  });
  it("y NO casa con la prosa corriente del corpus (si casara, no se sembraría nunca)", () => {
    for (const frase of [
      "Ready... Player: Min Item: Done",
      "Get-South Nothing to get!",
      "Thou dost find a torch!",
      "Min is poisoned",
    ]) {
      expect(RE_MUERTE.test(frase), frase).toBe(false);
    }
  });
});

describe("re-siembra — evidencia del corpus", () => {
  it("cuenta BLOQUES por nombre, no ocurrencias, y con frontera de palabra", () => {
    const e = evidenciaDeCorpus(["Min y Min otra vez", "Iolo", "Minotaur ataca"], SEIS);
    expect(e.menciones.Min).toBe(1); // dos ocurrencias en UN bloque = 1; "Minotaur" no cuenta
    expect(e.menciones.Iolo).toBe(1);
    expect(e.menciones.Gwenno).toBe(0);
    expect(e.bloques).toBe(3);
  });
  it("cuenta las muertes del corpus aparte", () => {
    const e = evidenciaDeCorpus(["Iolo", "An unending darkness engulfs thee"], SEIS);
    expect(e.muertes).toBe(1);
  });
});

describe("re-siembra — la decisión", () => {
  it("modo off: no muta nada ni con la party entera muerta", () => {
    const p = decideResiembra("off", MUERTA(), CORPUS_VIVO(), 1, false);
    expect(p.disparo).toBe("modo-off");
    expect(planMuta(p)).toBe(false);
  });

  it("wipe: dispara con la party 100% muerta y revive el GRUPO ENTERO (cota 0x0b54)", () => {
    const p = decideResiembra("wipe", MUERTA(), CORPUS_VIVO(), 1, false);
    expect(p.disparo).toBe("party-muerta");
    expect(p.revivir).toEqual(SEIS); // los `partySize` primeros, no sólo los del corpus
    expect(planMuta(p)).toBe(true);
  });

  it("wipe: NO dispara si la cadena entrega la party viva (en cadena sana es inerte)", () => {
    const p = decideResiembra("wipe", VIVA(), CORPUS_VIVO(), 1, false);
    expect(p.disparo).toBe("sin-contradiccion");
    expect(planMuta(p)).toBe(false);
  });

  it("★ frontera: si el corpus trae muertes, NO se siembra aunque la party esté aniquilada", () => {
    const conMuerte = evidenciaDeCorpus(["Ready... Player: Iolo", "An unending darkness engulfs thee"], SEIS);
    const p = decideResiembra("wipe", MUERTA(), conMuerte, 1, false);
    expect(p.disparo).toBe("corpus-con-muertes");
    expect(planMuta(p)).toBe(false);
  });

  it("★ frontera: sin evidencia en el corpus tampoco se siembra (no se inventa el original)", () => {
    const mudo = evidenciaDeCorpus(["Blocked!", "Blocked!"], SEIS);
    const p = decideResiembra("wipe", MUERTA(), mudo, 1, false);
    expect(p.disparo).toBe("corpus-sin-evidencia");
    expect(planMuta(p)).toBe(false);
  });

  it("la comida sólo se repone desde 0, y al 0x3f del binario (0x0c47)", () => {
    expect(FOOD_REFUGE).toBe(63);
    const cero = decideResiembra("wipe", estado(["D", "D", "D", "D", "D", "D"], 0), CORPUS_VIVO(), 1, false);
    expect(cero.reponerComida).toBe(true);
    const conComida = decideResiembra("wipe", estado(["D", "D", "D", "D", "D", "D"], 26), CORPUS_VIVO(), 1, false);
    expect(conComida.reponerComida).toBe(false);
    // y cuando NO se repone, la comida tiene que salir en la lista de NO-SEMBRADOS
    expect(conComida.noSembrados.some((c) => c.campo.startsWith("comida"))).toBe(true);
  });

  it("roster: revive sólo a los caídos CON evidencia, y no toca a los que no la tienen", () => {
    // Julia y Gwenno caídas; el corpus sólo nombra a Julia.
    const e = evidenciaDeCorpus(["Ready... Player: Julia"], SEIS);
    const p = decideResiembra("roster", estado(["G", "G", "G", "G", "D", "D"]), e, 1, false);
    expect(p.disparo).toBe("miembros-caidos-con-evidencia");
    expect(p.revivir).toEqual(["Julia"]);
    expect(p.motivo).toMatch(/EXTRAPOLACI/);
  });

  it("wipe NO hace lo de roster: con miembros caídos sueltos se queda quieto", () => {
    const e = evidenciaDeCorpus(["Ready... Player: Julia"], SEIS);
    const p = decideResiembra("wipe", estado(["G", "G", "G", "G", "D", "D"]), e, 1, false);
    expect(p.disparo).toBe("sin-contradiccion");
    expect(planMuta(p)).toBe(false);
  });

  it("el umbral se respeta: 1 mención no basta si se piden 3", () => {
    const e = evidenciaDeCorpus(["Ready... Player: Iolo"], SEIS);
    expect(decideResiembra("wipe", MUERTA(), e, 3, false).disparo).toBe("corpus-sin-evidencia");
    expect(decideResiembra("wipe", MUERTA(), e, 1, false).disparo).toBe("party-muerta");
  });
});

// ══════════════════════════════════════════════════════════════════════════════════════
// SIEMBRA DE ALFOMBRA — la que la VALIDACIÓN encontró y que decidía de verdad.
// ══════════════════════════════════════════════════════════════════════════════════════
describe("re-siembra — la alfombra (transporte)", () => {
  const CON_CARPET = () => evidenciaDeCorpus(["Ready... Player: Iolo", "Use item Item: Carpet Boarded!"], SEIS);
  it("RE_CARPET casa con el embarque del original y no con la prosa vecina", () => {
    expect(RE_CARPET.test("Use item Item: Carpet Boarded!")).toBe(true);
    expect(RE_CARPET.test('A"magic"carpet!')).toBe(false); // hallazgo/mención, NO embarque
    expect(RE_CARPET.test("Board-North Boarded!")).toBe(false); // barco, no alfombra
  });
  it("dispara sólo si el corpus la usa Y el puerto no la tiene", () => {
    const sinAlfombra = estado(["G", "G", "G", "G", "G", "G"], 30, 0, 0);
    const p = decideResiembra("wipe", sinAlfombra, CON_CARPET(), 1, true);
    expect(p.disparoCarpet).toBe("alfombra-perdida");
    expect(p.sembrarCarpet).toBe(true);
    expect(planMuta(p)).toBe(true); // muta AUNQUE la party esté sana: es otra siembra
  });
  it("no dispara si el puerto ya la tiene", () => {
    const p = decideResiembra("wipe", estado(["G", "G", "G", "G", "G", "G"], 30, 0, 1), CON_CARPET(), 1, true);
    expect(p.disparoCarpet).toBe("ya-la-tiene");
    expect(p.sembrarCarpet).toBe(false);
  });
  it("no dispara si el corpus no la usa (no se regala transporte que el LP no usó)", () => {
    const p = decideResiembra("wipe", estado(["G", "G", "G", "G", "G", "G"], 30, 0, 0), CORPUS_VIVO(), 1, true);
    expect(p.disparoCarpet).toBe("corpus-sin-alfombra");
    expect(p.sembrarCarpet).toBe(false);
  });
  it("★ el interruptor propio la apaga sin tocar la de la party (el brazo que refutó)", () => {
    const sinAlfombra = estado(["D", "D", "D", "D", "D", "D"], 30, 0, 0);
    const off = decideResiembra("wipe", sinAlfombra, CON_CARPET(), 1, false);
    expect(off.disparoCarpet).toBe("apagada");
    expect(off.sembrarCarpet).toBe(false);
    expect(off.disparo).toBe("party-muerta"); // la de la party sigue disparando
    expect(off.revivir).toEqual(SEIS);
  });
  it("y con el modo apagado no dispara ninguna de las dos", () => {
    const p = decideResiembra("off", estado(["D", "D", "D", "D", "D", "D"], 30, 0, 0), CON_CARPET(), 1, true);
    expect(p.disparoCarpet).toBe("modo-off");
    expect(planMuta(p)).toBe(false);
  });
});

describe("re-siembra — la DECLARACIÓN (§(b) del reparo)", () => {
  it("el reporte va también con el modo apagado, y dice que no se aplicó", () => {
    const p = decideResiembra("off", MUERTA(), CORPUS_VIVO(), 1, false);
    const r = reporteResiembra(p, 1, null);
    expect(r.aplicada).toBe(false);
    expect(r.aviso).toBeNull();
    expect(r.modo).toBe("off");
    expect(r.noSembrados.length).toBeGreaterThan(0); // la lista de heredados viaja siempre
  });

  it("una parte re-anclada lleva el aviso de NO COMPARABLE en el JSON y en el resumen", () => {
    const p = decideResiembra("wipe", MUERTA(), CORPUS_VIVO(), 1, false);
    const r = reporteResiembra(p, 1, { ...nada(), revividos: SEIS });
    expect(r.aplicada).toBe(true);
    expect(r.aviso).toMatch(/NO es comparable/);
    expect(resumenResiembra(r)).toMatch(/RE-ANCLADA/);
  });

  it("`aplicada` mira lo que CAMBIÓ, no lo que se pidió (nombre del plan ausente del grupo)", () => {
    const p = decideResiembra("wipe", MUERTA(), CORPUS_VIVO(), 1, false);
    const r = reporteResiembra(p, 1, { ...nada(), noEncontrados: SEIS });
    expect(r.aplicada).toBe(false);
    expect(r.noEncontrados).toEqual(SEIS);
  });

  it("el caso frontera del encargo: todo campo sin dato del vídeo sale MARCADO con motivo", () => {
    for (const c of camposNoSembrados()) {
      expect(c.motivo.length, c.campo).toBeGreaterThan(10);
    }
    const campos = camposNoSembrados().map((c) => c.campo).join(" ");
    for (const esperado of ["oro", "fecha", "posicion", "karma", "inventario", "nivel"]) {
      expect(campos, esperado).toContain(esperado);
    }
  });

  // 🔴 La semilla con el invariante de contigüidad roto (#124) es la que explica que el
  // refuge del puerto no dispare sobre part09/10/11/19-24 (43 de las 49 semillas, medido).
  // El dato viaja al reporte y a la línea de resumen; sin eso, un «party 0/6» sin refuge se
  // lee como un fallo del port cuando es la SEMILLA la que rompe la premisa del gate.
  it("la contigüidad rota de la semilla se DECLARA en el resumen y en el reporte", () => {
    const conIntrusos = estado(["D", "D", "D", "D", "D", "D"], 20, 2);
    const p = decideResiembra("wipe", conIntrusos, CORPUS_VIVO(), 1, false);
    expect(p.antes.intrusosEnPrefijo).toBe(2);
    expect(resumenResiembra(reporteResiembra(p, 1, nada()))).toMatch(/CONTIGÜIDAD ROTA/);
    expect(reporteResiembra(p, 1, null).antes.intrusosEnPrefijo).toBe(2);
    // y una semilla sana NO lleva el aviso (si lo llevara siempre, no diría nada)
    expect(
      resumenResiembra(reporteResiembra(decideResiembra("wipe", VIVA(), CORPUS_VIVO(), 1, false), 1, nada())),
    ).not.toMatch(/CONTIGÜIDAD/);
  });

  it("parseModo sólo acepta los tres valores; cualquier basura cae a off", () => {
    expect(parseModo("wipe")).toBe("wipe");
    expect(parseModo("roster")).toBe("roster");
    expect(parseModo(undefined)).toBe("off");
    expect(parseModo("1")).toBe("off"); // ← un `=1` copiado de otra env NO enciende esto
    expect(parseModo("WIPE")).toBe("off");
  });
});

// ── El corpus REAL, si el worktree lo tiene (routes/ está fuera del índice desde #376) ──
describe.skipIf(!existsSync(join(ROUTES, "part20.route.json")))("re-siembra — sobre el corpus real", () => {
  function textos(part: string): string[] {
    const d = JSON.parse(readFileSync(join(ROUTES, `${part}.route.json`), "utf8")) as {
      segments: Array<{ expect?: Array<{ text: string }> }>;
    };
    return d.segments.flatMap((s) => (s.expect ?? []).map((b) => b.text));
  }
  it("el corpus LP1 no tiene NI UN mensaje de muerte (el careo que autoriza la siembra)", () => {
    let muertes = 0;
    let bloques = 0;
    for (let i = 1; i <= 24; i++) {
      const p = `part${String(i).padStart(2, "0")}`;
      const e = evidenciaDeCorpus(textos(p), SEIS);
      muertes += e.muertes;
      bloques += e.bloques;
    }
    expect(bloques).toBeGreaterThan(5000); // control: hubo material que mirar
    expect(muertes).toBe(0);
  });
  it("part20 nombra a cuatro miembros de sobra: la evidencia existe donde se va a usar", () => {
    const e = evidenciaDeCorpus(textos("part20"), SEIS);
    for (const n of ["Min", "Iolo", "Jaana", "Julia", "Gwenno"]) {
      expect(e.menciones[n], n).toBeGreaterThan(10);
    }
  });
});
