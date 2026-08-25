/**
 * TESTIGOS DEL GATE DE VÍDEOS — carril `gate-videos`.
 *
 * ── POR QUÉ ESTE FICHERO ES EL CENTRO DEL ENCARGO, Y NO EL CLI ───────────────────────
 * El encargo pedía un instrumento que GARANTICE que los vídeos están bien, y el criterio
 * de aceptación que lo hace útil no es «el gate existe» sino «el gate REPRODUCE la lista
 * de defectos que los humanos ya cazaron». Parte de esa lista vive en tomas que YA NO
 * EXISTEN: los once vídeos defectuosos de la auditoría del 22-08 se regrabaron y sus
 * ficheros se sobrescribieron. No se puede correr el gate sobre ellos.
 *
 * Lo que sí se puede —y es lo que hace este fichero— es reconstruir CADA defecto como un
 * sidecar de fixture derivado de su descripción MEDIDA en la auditoría, con la cita, y
 * exigir que el gate se ponga rojo. Es el control positivo obligatorio: una comprobación
 * que sólo puede salir verde no es una comprobación.
 *
 * ── Y POR QUÉ EL PAR VERDE/ROJO EN TODAS ─────────────────────────────────────────────
 * Cada bloque lleva el fixture DEFECTUOSO **y** su gemelo sano, y el sano se construye
 * cambiando SÓLO el rasgo que el defecto describe. Sin el gemelo, un predicado que
 * devolviese FALLO siempre pasaría los rojos y no mediría nada.
 */
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  parseSidecar,
  adjudica,
  resuelveExp,
  verificaExpectativas,
  compruebaDebe,
  compruebaProhibido,
  compruebaCierre,
  compruebaParada,
  compruebaCola,
  compruebaRitmo,
  compruebaCoherencia,
  compruebaIntegridad,
  compruebaVisual,
  compruebaColaViewport,
  instantesDeMovimiento,
  relevoViewport,
  huecoMuerto,
  OCUPACION_SATURA,
  compruebaVacuo,
  compruebaPartyViva,
  compruebaVelocidad,
  compruebaLegibilidad,
  compruebaInformacion,
  compruebaCapitulo,
  OK,
  FALLO,
  SIN_DATO,
  AMBAR,
  // @ts-expect-error — herramienta de autoría en JS puro, sin .d.ts
} from "../tools/videocap/gate-core.mjs";

const AQUI = dirname(fileURLToPath(import.meta.url));
const RAIZ = join(AQUI, "..");
const EXPS = JSON.parse(readFileSync(join(RAIZ, "tools/videocap/expectativas.json"), "utf8"));

// ── constructor de sidecars de fixture ────────────────────────────────────────────────
type Reg = Record<string, unknown>;
function sc(
  lines: [number, string][],
  opts: { keys?: [number, string][]; states?: [number, string][]; fin?: number; sinks?: Reg | null } = {},
) {
  const regs: Reg[] = [{ kind: "meta", video: "fixture.webm" }];
  for (const [t, text] of lines) regs.push({ kind: "line", t, text });
  for (const [t, key] of opts.keys ?? []) regs.push({ kind: "key", t, key });
  for (const [t, s] of opts.states ?? []) regs.push({ kind: "state", t, s });
  regs.push({ kind: "end", t: opts.fin ?? 10, razon: "fixture", sinks: "sinks" in opts ? opts.sinks : {} });
  return parseSidecar(regs.map((r) => JSON.stringify(r)).join("\n"));
}
const RUIDO: string[] = EXPS.defaults.ruido;
const PROHIBIDO: string[] = EXPS.defaults.prohibido;

describe("gate de vídeos · DEBE CONTENER — el evento que el vídeo promete", () => {
  // TABLA.md fila 1 (el caso que motivó el encargo): «Spell name: IN NOX → No effect! →
  // Mix Reagents… → Spell name: None!; Shamino 0D TODO el vídeo — LA RESURRECCIÓN NO
  // OCURRE». Es un vídeo SIN bloqueos de navegación y sin congelaciones: el único
  // instrumento que lo caza es éste.
  const RESU_VIEJA = sc(
    [
      [1.6, "Cast"],
      [2.0, "Spell name: IN NOX"],
      [2.4, "No effect!"],
      [4.1, "Mix Reagents"],
      [5.0, "AN NOX IN"],
      [5.4, "No effect!"],
      [7.2, "Spell name: None!"],
    ],
    { fin: 17 },
  );
  const RESU_NUEVA = sc(
    [
      [1.7, "Use item"],
      [2.9, "Item: Scroll"],
      [2.9, "Resurrection!"],
      [5.4, "On who: Shamino"],
    ],
    { fin: 15.3 },
  );
  const firmas = EXPS.videos["resurreccion-hechizo-shader"].debe;

  it("🔴 CONTROL POSITIVO — la toma vieja de resurrección NO tiene el evento y el gate lo dice", () => {
    const r = compruebaDebe(RESU_VIEJA, firmas);
    expect(r.estado).toBe(FALLO);
    expect(r.detalle).toContain("Resurrection!");
  });

  it("la toma regrabada SÍ lo tiene (mismo predicado, mismas firmas)", () => {
    expect(compruebaDebe(RESU_NUEVA, firmas).estado).toBe(OK);
  });

  it("🔴 CONTROL POSITIVO — el endgame no imprime NI UNA línea `is absorbed!`", () => {
    // VERIFICACION-EVENTOS.md §4.3.b: el testigo EA imprime `Geoffrey is absorbed!` /
    // `Jaana is absorbed!`; el port no imprime ninguna porque el guion ejecuta la absorción
    // desde `page.evaluate` sin aplicar los eventos. MEDIDO además sobre metraje real: el
    // sidecar de la regrabación 22-08 de este carril tampoco lleva ninguna.
    const eg = sc(
      [
        [3.2, "Shamino, armed with Short Sword:"],
        [7.9, "Lord British says:"],
        [8.6, '"Didst thou bring my box?"'],
      ],
      { fin: 46 },
    );
    expect(compruebaDebe(eg, EXPS.videos["endgame-absorcion-shader"].debe).estado).toBe(FALLO);
    const conAbsorcion = sc(
      [
        [3.2, "Geoffrey is absorbed!"],
        [3.6, "Jaana is absorbed!"],
      ],
      { fin: 46 },
    );
    expect(compruebaDebe(conAbsorcion, EXPS.videos["endgame-absorcion-shader"].debe).estado).toBe(OK);
  });

  it("una lista de firmas VACÍA es SIN-DATO, nunca OK (un vídeo que no promete nada no se audita)", () => {
    expect(compruebaDebe(RESU_NUEVA, []).estado).toBe(SIN_DATO);
  });
});

describe("gate de vídeos · NO DEBE CONTENER — vocabulario de toma fallida", () => {
  it("🔴 CONTROL POSITIVO — los 46 s de «South Blocked!» de la toma vieja de dungeon-tesoro", () => {
    // TABLA.md fila dungeon-tesoro: «~48-94s South Blocked! continuo (Avatar martillea la
    // fila de cofres con 1 slime vivo detrás)». El cupo declarado para ese vídeo es 6,
    // calibrado sobre la toma NUEVA («4-5 apariciones sueltas normales de pathing»).
    const lineas: [number, string][] = [];
    for (let i = 0; i < 40; i++) lineas.push([48 + i, "South Blocked!"]);
    const exp = resuelveExp(EXPS, "dungeon-tesoro-shader");
    const r = compruebaProhibido(sc(lineas, { fin: 102 }), exp.prohibido, exp.permitido);
    expect(r.estado).toBe(FALLO);
    expect(r.detalle).toContain("×40");
    // y el gemelo sano: cinco apariciones de pathing pasan el MISMO predicado
    const sano = sc(
      [0, 1, 2, 3, 4].map((i) => [10 + i, "South Blocked!"] as [number, string]),
      { fin: 69 },
    );
    expect(compruebaProhibido(sano, exp.prohibido, exp.permitido).estado).toBe(OK);
  });

  it("🔴 CONTROL POSITIVO — el derrame «Set Active Plr: None!» ×2 de la donación vieja", () => {
    // TABLA.md fila shrine-donacion: `teclea:"100"` — el prompt consume «1» y los dos «0»
    // sobrantes caen al despachador como Set Active Player.
    const d = sc(
      [
        [12.0, "Set active plr:"],
        [12.1, "None!"],
        [13.0, "Set active plr:"],
        [13.1, "None!"],
      ],
      { fin: 21 },
    );
    expect(compruebaProhibido(d, PROHIBIDO, {}).estado).toBe(FALLO);
  });

  it("el cupo declarado tolera N y falla en N+1 (el borde, no el caso cómodo)", () => {
    const con = (n: number) =>
      sc(Array.from({ length: n }, (_, i) => [i, "North Blocked!"] as [number, string]), { fin: 16 });
    expect(compruebaProhibido(con(2), PROHIBIDO, { "Blocked!": 2 }).estado).toBe(OK);
    expect(compruebaProhibido(con(3), PROHIBIDO, { "Blocked!": 2 }).estado).toBe(FALLO);
  });

  it("ANTI-FANTASMA: cada token del vocabulario existe VERBATIM en game/src", () => {
    // Sin esto la lista se puede quedar rancia (una cadena que el port ya no emite deja de
    // vigilar sin que nada se ponga rojo) o llevar un token inventado que no vigila nada.
    const fuentes: string[] = [];
    const barre = (d: string) => {
      for (const e of readdirSync(d, { withFileTypes: true })) {
        const p = join(d, e.name);
        if (e.isDirectory()) barre(p);
        else if (/\.(ts|tsx)$/.test(e.name) && statSync(p).size < 2_000_000) fuentes.push(readFileSync(p, "utf8"));
      }
    };
    barre(join(RAIZ, "src"));
    const todo = fuentes.join("\n");
    const ausentes = PROHIBIDO.filter((t) => !todo.includes(t));
    expect(ausentes, `tokens del vocabulario que game/src ya NO emite: ${ausentes.join(", ")}`).toEqual([]);
    // control positivo del propio censo: un token inventado SÍ debe salir ausente
    expect(["Zorkmid overflow!"].filter((t) => !todo.includes(t))).toHaveLength(1);
  });
});

describe("gate de vídeos · CIERRE — el vídeo no acaba con un prompt abierto", () => {
  it("🔴 CONTROL POSITIVO — healer-flash viejo: «What is the nature of thy need?» ABIERTO al corte", () => {
    // TABLA.md filas healer-flash ×2 y tienda: clase `c`, «~5 s clavado en el prompt».
    // Ningún vocabulario de error lo delata: un prompt abierto no imprime nada.
    const abierto = sc([[15.4, "What is the nature of thy need?"]], {
      fin: 21,
      sinks: { prompt: "keyword", selector: false, save: false, combat: false, camping: false },
    });
    const r = compruebaCierre(abierto, []);
    expect(r.estado).toBe(FALLO);
    expect(r.detalle).toContain("prompt");
  });

  it("el gemelo sano (sesión cerrada) pasa el mismo predicado", () => {
    const cerrado = sc([[15.4, '"May the powers of light guard thy soul" says Regina']], {
      fin: 21,
      sinks: { prompt: null, selector: false, save: false, combat: false, camping: false },
    });
    expect(compruebaCierre(cerrado, []).estado).toBe(OK);
  });

  it("los sumideros a RELOJ DE PARED no son un prompt colgado (escena legítima en curso)", () => {
    const escena = sc([[10, "Party rested!"]], { fin: 25, sinks: { prompt: null, camping: true, moongate: true, endgame: true } });
    expect(compruebaCierre(escena, []).estado).toBe(OK);
  });

  it("sin foto de sumideros es SIN-DATO, no OK", () => {
    expect(compruebaCierre(sc([[1, "x"]], { fin: 5, sinks: null }), []).estado).toBe(SIN_DATO);
  });
});

describe("gate de vídeos · PARADA — el guion detenido", () => {
  it("🔴 CONTROL POSITIVO — part04: 63 s con la consola idéntica y el reloj congelado", () => {
    // TABLA-REPLAYS.md §4.4: las flechas del route alimentan el cursor del roster; el
    // realce recorre Min→…→Julia durante 63 s con `4-5-139 / F:55 / G:150` clavado.
    // Lo que hace de esto una PARADA y no un paseo silencioso es justamente que el estado
    // TAMPOCO cambia: por eso el predicado mira las dos cosas.
    const parado = sc([[13, "Search-North"], [76, "Player: None!"]], {
      states: [[13, "0/0/40,40|12:0|g150|v4/6"]],
      fin: 145,
    });
    expect(compruebaParada(parado, 8, 145).estado).toBe(FALLO);
  });

  it("caminar EN SILENCIO no es una parada — el estado se mueve aunque la consola calle", () => {
    const andando = sc([[1, "North"]], {
      states: Array.from({ length: 79 }, (_, i) => [1 + i, `0/0/${40 + i},40|12:0|g150|v4/6`] as [number, string]),
      fin: 80,
    });
    expect(compruebaParada(andando, 8, 80).estado).toBe(OK);
    // y el silencio INICIAL sí cuenta: 13 s sin una fila ni un cambio de estado al arrancar
    // es el guion detenido igual que en medio (el hueco se mide desde t=0, no desde la 1ª marca).
    const arranqueMudo = sc([[13, "North"]], { states: [[13, "0/0/40,40|12:0|g150|v4/6"]], fin: 20 });
    expect(compruebaParada(arranqueMudo, 8, 20).estado).toBe(FALLO);
  });
});

describe("gate de vídeos · COLA MUERTA", () => {
  it("🔴 CONTROL POSITIVO — whirlpool: el evento a los 3 s y 8 s de nada (72 % medido)", () => {
    const w = sc(
      [
        [1.7, "Ship"],
        [2.7, "Pass"],
        [3.3, "WHIRLPOOL!"],
        [3.4, "Pass"],
      ],
      { fin: 11.3 },
    );
    const r = compruebaCola(w, 30, 11.3, RUIDO);
    expect(r.estado).toBe(FALLO);
    expect(r.detalle).toContain("WHIRLPOOL!");
  });

  it("🔴 CONTROL POSITIVO — shadowlord-shard: la consola CAMBIA en cada paso y aun así es cola", () => {
    // VERIFICACION-EVENTOS.md §2 y nota final del §6: el ritual acaba en t≈11 de 35,8 y los
    // 25 s restantes son la ruta paseando. La sonda de estático NO lo delata (la consola no
    // se congela); lo delata la lista de RUIDO — que es lo que convierte «paseo» en predicado.
    const lineas: [number, string][] = [[10.6, "The doom of the Shadowlord Faulinei is wrought!"]];
    const paseo: string[] = ["North", "South", "East", "West", "Blocked!"];
    for (let i = 0; i < 40; i++) lineas.push([11 + i * 0.6, paseo[i % 5] as string]);
    const s = sc(lineas, { fin: 35.8 });
    expect(compruebaCola(s, 30, 35.8, RUIDO).estado).toBe(FALLO);
    // control de la lista de ruido: si `North`/`Blocked!` contasen como significativos, el
    // mismo material saldría verde — que es exactamente lo que le pasó a la auditoría del 22-08
    expect(compruebaCola(s, 30, 35.8, []).estado).toBe(OK);
  });

  it("el SUELO ABSOLUTO evita el falso rojo de los clips cortos (torch-borrowed, 6 s)", () => {
    const t = sc([[2.2, "Borrowed!"], [3.4, "West"]], { fin: 5.9 });
    expect(compruebaCola(t, 30, 5.9, RUIDO, 5).estado).toBe(OK); // 3,7 s de cola: por debajo del suelo
    expect(compruebaCola(t, 30, 5.9, RUIDO, 0).estado).toBe(FALLO); // sin suelo, el % solo la condena
  });

  it("un clip sin NI UNA fila significativa es FALLO, no SIN-DATO", () => {
    const nada = sc([[1, "North"], [2, "Blocked!"]], { fin: 25 });
    expect(compruebaCola(nada, 30, 25, RUIDO).estado).toBe(FALLO);
  });
});

describe("gate de vídeos · RITMO LEGIBLE — la prosa a 700 ms", () => {
  const paginas = (paso: number) =>
    sc([[14.3, '"FOLLOW!" cries Lord British, as he extracts a small, red sphere']], {
      keys: Array.from({ length: 8 }, (_, i) => [14.3 + (i + 1) * paso, " "] as [number, string]),
      fin: 46,
    });
  const RITMO = EXPS.videos["endgame-absorcion-shader"].ritmo;

  it("🔴 CONTROL POSITIVO — 0,70 s por página: ILEGIBLE (el `waitForTimeout(700)` del guion)", () => {
    const r = compruebaRitmo(paginas(0.7), RITMO);
    expect(r.estado).toBe(FALLO);
    expect(r.detalle).toContain("0.70");
  });

  it("al ritmo del TESTIGO EA (2,6-3,8 s/página) el mismo predicado pasa", () => {
    expect(compruebaRitmo(paginas(3.1), RITMO).estado).toBe(OK);
  });

  it("el umbral es el del testigo, no un redondeo: 2,59 falla y 2,61 pasa", () => {
    expect(compruebaRitmo(paginas(2.59), RITMO).estado).toBe(FALLO);
    expect(compruebaRitmo(paginas(2.61), RITMO).estado).toBe(OK);
  });

  it("si no se alcanzó el marcador de la escena, es SIN-DATO (no se midió) y NO verde", () => {
    const sinMarcador = sc([[3, "otra cosa"]], { keys: [[4, " "], [4.7, " "]], fin: 10 });
    expect(compruebaRitmo(sinMarcador, RITMO).estado).toBe(SIN_DATO);
  });
});

describe("gate de vídeos · INTEGRIDAD y COHERENCIA", () => {
  it("🔴 CONTROL POSITIVO — part18: 3 670 016 B y ffprobe sin duración = TRUNCADO", () => {
    const r = compruebaIntegridad({ bytes: 3_670_016, durS: null, errores: ["File ended prematurely"] });
    expect(r.estado).toBe(FALLO);
    expect(r.detalle).toContain("TRUNCADO");
  });

  it("0 bytes es FALLO, y un vídeo sano con duración es OK", () => {
    expect(compruebaIntegridad({ bytes: 0, durS: null, errores: [] }).estado).toBe(FALLO);
    expect(compruebaIntegridad({ bytes: 900_000, durS: 11.4, errores: [] }).estado).toBe(OK);
  });

  it("un error de decodificación a mitad tampoco pasa aunque haya duración", () => {
    expect(compruebaIntegridad({ bytes: 900_000, durS: 11.4, errores: ["Invalid data found"] }).estado).toBe(FALLO);
  });

  it("COHERENCIA caza un sidecar que no es de este metraje", () => {
    const s = sc([[1, "x"]], { fin: 80 });
    expect(compruebaCoherencia(s, 30.04, 3).estado).toBe(FALLO); // el caso part18: sidecar 80 s, vídeo 30
    expect(compruebaCoherencia(s, 79.2, 3).estado).toBe(OK);
  });
});

describe("gate de vídeos · sonda VISUAL", () => {
  const T = (pares: [number, number | null][]) => pares.map(([a, b]) => ({ start: a, end: b }));

  it("🔴 LA TRAMPA DEL `-v error`: sin salida de ffmpeg el veredicto es SIN-DATO, NUNCA OK", () => {
    // TABLA-REPLAYS.md §0: `freezedetect` emite a nivel INFO y una primera pasada con
    // `-v error` dio CERO en los 25 vídeos — un censo-cero que habría firmado «no hay ni una
    // parada» sobre 491 s de paradas reales. Aquí la sonda muda se representa como `null`.
    const [p, c] = compruebaVisual(null, 11.4, { paradaMaxS: 8, colaMaxPct: 30 });
    expect(p.estado).toBe(SIN_DATO);
    expect(c.estado).toBe(SIN_DATO);
  });

  it("los tramos ADYACENTES no se funden — fundirlos daba 61 % donde la tabla mide 24 %", () => {
    // healer-flash-faithful, medido: 8,08→15,92 y 15,92→EOF(20,9). Que un tramo acabe y otro
    // empiece en el MISMO instante significa que un fotograma difirió: el panel escribió.
    const [, cola] = compruebaVisual(T([[8.08, 15.92], [15.92, null]]), 20.9, { paradaMaxS: 12, colaMaxPct: 30 });
    expect(cola.detalle).toContain("5.0"); // 20,9 − 15,92 ≈ 4,98 s = la cola de la tabla
    expect(cola.estado).toBe(OK);
  });

  it("el filtro ≥1,5 s recupera el conjunto de `d=1.5` a partir de la pasada `d=0.2`", () => {
    // Propiedad de subconjunto comprobada en gate.mjs. Los tramos cortos son para VELOCIDAD.
    const todos = T([[1.0, 1.3], [3.28, 5.12], [5.12, null], [6.0, 6.1]]);
    const [parada] = compruebaVisual(todos, 11.44, { paradaMaxS: 5, colaMaxPct: 100 });
    expect(parada.detalle).toContain("6.3"); // 11,44 − 5,12: el tramo largo, no los cortos
  });

  it("🔴 CONTROL POSITIVO — whirlpool: cola visual del 55 % sobre 11,4 s", () => {
    const [, cola] = compruebaVisual(T([[3.28, 5.12], [5.12, null]]), 11.44, { paradaMaxS: 12, colaMaxPct: 30 });
    expect(cola.estado).toBe(FALLO);
  });
});

describe("gate de vídeos · sonda del VIEWPORT — la cola que la consola no ve", () => {
  /** Sonda de viewport de fixture: `movs` son los instantes CON movimiento (> umbral). */
  const vp = (movs: number[], durS: number, nTotal = Math.round(durS * 25)) => {
    const quietos: { start: number; end: number }[] = [];
    let prev = 0;
    for (const m of movs) {
      if (m - prev > 0) quietos.push({ start: prev, end: m });
      prev = m;
    }
    quietos.push({ start: prev, end: durS });
    return { n: nTotal, ocupacion: movs.length / nTotal, tUltimoMov: movs.length ? movs[movs.length - 1]! : 0, quietos, max: 40, umbral: 0.35 };
  };

  it("🔴 EL ARTEFACTO DE KEYFRAME — sin descontarlo, la sonda NO PUEDE medir más de 5,12 s de quietud", () => {
    // El defecto que casi convierte a COLA-VP en una comprobación que sólo puede salir
    // verde. Playwright graba VP8 con keyframe cada 128 fotogramas = 5,12 s a 25 fps, y un
    // keyframe re-codifica el cuadro entero: sobre contenido IDÉNTICO da una diferencia
    // media de 1,6-1,9, muy por encima del umbral 0,35. Fixture con la forma medida sobre
    // `ch03-britain`: 20 s de imagen congelada, con el par de muestras del keyframe cada
    // 5,12 s (el keyframe y el fotograma siguiente).
    const ts: number[] = [];
    const ys: number[] = [];
    for (let i = 0; i < 500; i++) ts.push(Number((i * 0.04).toFixed(2)));
    const kfs = [0, 5.12, 10.24, 15.36];
    for (const t of ts) ys.push(kfs.some((k) => t >= k && t < k + 0.08) ? 1.79 : 0.002);
    // SIN descontar keyframes: cada 5,12 s hay «movimiento» ⇒ la quietud máxima medible es 5,12
    const crudo = instantesDeMovimiento(ts, ys, [], { umbral: 0.35 });
    const huecoMax = (m: number[]) => m.reduce((acc, t, i) => Math.max(acc, i ? t - m[i - 1]! : t), 0);
    expect(huecoMax(crudo)).toBeCloseTo(5.12, 1);
    // DESCONTÁNDOLOS: no queda ni un instante de movimiento — los 20 s son quietud
    const limpio = instantesDeMovimiento(ts, ys, kfs, { umbral: 0.35 });
    expect(limpio).toEqual([]);
    // y el movimiento REAL sigue detectándose (control negativo del filtro: no borra todo)
    const conReal = [...ys];
    conReal[300] = 12.4; // t=12,00 — lejos de todo keyframe
    expect(instantesDeMovimiento(ts, conReal, kfs, { umbral: 0.35 })).toEqual([12.0]);
    // y un movimiento real que CAE en un keyframe se pierde: coste declarado del filtro
    const enKf = [...ys];
    enKf[128] = 40; // t=5,12 exactamente
    expect(instantesDeMovimiento(ts, enKf, kfs, { umbral: 0.35 })).toEqual([]);
  });

  it("🔴 CONTROL POSITIVO — un clip cuya IMAGEN se para a mitad y no vuelve: COLA-VP en rojo", () => {
    // Es la clase que la sonda de consola NO puede ver cuando no hay sidecar (23 de los 42
    // eventos): la imagen congelada mientras el fichero sigue grabando. Aquí, 22 s de clip
    // con el último movimiento en t=9 ⇒ 13 s = 59 %.
    const r = compruebaColaViewport(vp([1, 4, 9], 22), 22, { colaMaxPct: 30, colaMinS: 5 });
    expect(r.estado).toBe(FALLO);
    expect(r.detalle).toContain("59 %");
  });

  it("el gemelo sano — misma duración, la imagen paga hasta el final", () => {
    expect(compruebaColaViewport(vp([1, 4, 9, 20.5], 22), 22, { colaMaxPct: 30, colaMinS: 5 }).estado).toBe(OK);
  });

  it("los CUATRO shadowlord-shard: 54-55 % de cola de CONSOLA y 7-8 % de cola real de imagen", () => {
    // Cifras MEDIDAS por este carril con `sondaViewport` (keyframes ya descontados) sobre los
    // .webm de la colección, y careadas contra las que `_shadowlordShard` dejó escritas
    // (1,66 · 1,86 · 1,70 · 1,62 s): las cuatro dentro de ±0,15 s. Control de PROCEDENCIA.
    const medido: [string, number, number, number][] = [
      ["faulinei-faithful", 22.2, 9.98, 20.4],
      ["faulinei-shader", 22.76, 10.49, 20.9],
      ["astaroth-shader", 22.44, 10.29, 20.7],
      ["nosfentor-shader", 22.4, 10.22, 20.8],
    ];
    for (const [id, dur, tDoom, tMov] of medido) {
      const s = sc([[tDoom, "The doom of the Shadowlord is wrought!"]], { fin: dur });
      // SIN relevo (la conducta de antes de este carril): la cola de consola condena
      expect(compruebaCola(s, 30, dur, RUIDO, 5).estado, `${id} sin relevo`).toBe(FALLO);
      // CON relevo: la imagen pinta los quakes + la explosión hasta t≈20,7 ⇒ 1,6-1,9 s reales
      const r = compruebaCola(s, 30, dur, RUIDO, 5, Infinity, relevoViewport(vp([tDoom, tMov], dur)));
      expect(r.estado, `${id} con relevo`).toBe(OK);
      expect(r.detalle).toContain("el VIEWPORT pinta hasta");
      expect(compruebaColaViewport(vp([tDoom, tMov], dur), dur, { colaMaxPct: 30, colaMinS: 5 }).estado).toBe(OK);
    }
  });

  it("🔴 EL RELEVO NO ABSUELVE: si la imagen TAMBIÉN está muerta, el rojo se mantiene", () => {
    // El control que impide que esta sonda sea un indulto general. Mismo sidecar mudo que
    // arriba, misma duración — sólo cambia que el viewport se para con la consola.
    const s = sc([[9.98, "The doom of the Shadowlord is wrought!"]], { fin: 22.2 });
    const r = compruebaCola(s, 30, 22.2, RUIDO, 5, Infinity, relevoViewport(vp([2, 9.98], 22.2)));
    expect(r.estado).toBe(FALLO);
  });

  it("🔴 SATURACIÓN POR ANIMACIÓN DE TERRENO — ch34: la lava se mueve sola y el relevo se RETIRA", () => {
    // Aviso del carril `grandtour-cine`: en `ch34-doom-r8-sceptre` hay 40 s en los que el
    // juego no hace NADA y la métrica a pantalla completa marca 18,6 cambios/s contra 0,6 en
    // el panel. Medido con ESTA sonda: 74 % de ocupación (contra 11-17 % de los clímax mudos).
    // Con la sonda saturada, «el viewport se movió» no informa ⇒ ni releva ni da verde.
    const saturada = { n: 1000, ocupacion: 0.74, tUltimoMov: 81.9, quietos: [{ start: 81.9, end: 82 }], max: 71, umbral: 0.35 };
    expect(relevoViewport(saturada)).toBeNull();
    const r = compruebaColaViewport(saturada, 82, { colaMaxPct: 30, colaMinS: 5 });
    expect(r.estado).toBe(SIN_DATO); // NO OK: no medir no es pasar
    expect(r.detalle).toContain("SATURADA");
    // y el sidecar mudo de un clip así sigue condenado, que es lo correcto
    const s = sc([[5, "Entering room..."]], { fin: 82 });
    expect(compruebaCola(s, 30, 82, RUIDO, 5, Infinity, relevoViewport(saturada)).estado).toBe(FALLO);
  });

  it("el borde de la saturación es la MEDIANA, no una constante nueva", () => {
    // ocupación > 50 % ⇔ el fotograma mediano ya supera el umbral de movimiento (0,35).
    expect(OCUPACION_SATURA).toBe(0.5);
    expect(relevoViewport({ n: 100, ocupacion: 0.5, tUltimoMov: 1, quietos: [] })).not.toBeNull();
    expect(relevoViewport({ n: 100, ocupacion: 0.51, tUltimoMov: 1, quietos: [] })).toBeNull();
  });

  it("sin sonda NO hay relevo — el fallo seguro es comportarse como antes de este carril", () => {
    expect(relevoViewport(null)).toBeNull();
    expect(relevoViewport({ n: 0, ocupacion: 0, tUltimoMov: 0, quietos: [] })).toBeNull();
    expect(compruebaColaViewport(null, 22, {}).estado).toBe(SIN_DATO);
    // y `huecoMuerto` sin relevo devuelve el hueco ENTERO (conducta previa, no relajada)
    expect(huecoMuerto(4, 19, null).largo).toBe(15);
  });

  it("PARADA-VIS: los 14,4 s de panel congelado de camp-aparición son LA ESCENA, no una parada", () => {
    // Medido: `camp-aparicion-faithful` vuelca toda la prosa a t≈5,0 y el pago (la figura en
    // la hoguera + los pulsos de inversión) es 100 % mudo. PARADA-VIS daba 14,4 s contra un
    // `paradaMaxS` por defecto de 12 ⇒ el carril anterior le puso 16 a mano. La imagen no se
    // queda quieta hasta t=18,28 de 19,28: el hueco realmente muerto es de 1,0 s.
    const tramos = [{ start: 4.88, end: null as number | null }];
    const [sinRelevo] = compruebaVisual(tramos, 19.28, { paradaMaxS: 12, colaMaxPct: 30 });
    expect(sinRelevo.estado).toBe(FALLO);
    const rel = relevoViewport(vp([2, 5.2, 12.5, 18.28], 19.28));
    const [conRelevo, colaVis] = compruebaVisual(tramos, 19.28, { paradaMaxS: 12, colaMaxPct: 30 }, rel);
    expect(conRelevo.estado).toBe(OK);
    expect(conRelevo.detalle).toContain("con la imagen viva");
    expect(colaVis.estado).toBe(OK);
    expect(colaVis.detalle).toContain("1.0 s");
  });

  it("PARADA (sidecar) también se releva, y el hueco muerto es el SOLAPE de los dos planos", () => {
    // 20 s sin una fila ni un cambio de estado, con la imagen pintando en el medio: el
    // solape más largo son los dos tramos de 5 s, no los 20 s del hueco de consola.
    const s = sc([[2, "An apparition!"], [22, "Party rested!"]], { states: [[2, "a"], [22, "b"]], fin: 24 });
    expect(compruebaParada(s, 12, 24).estado).toBe(FALLO);
    const rel = relevoViewport(vp([1, 7, 12, 17, 23], 24));
    const r = compruebaParada(s, 12, 24, Infinity, rel);
    expect(r.estado).toBe(OK);
    expect(r.detalle).toContain("5.0");
  });

  it("ANTI-REGRESIÓN: ningún vídeo declara ya un umbral de cola/parada sin su cifra", () => {
    // La guarda que impide que los 22 umbrales a mano vuelvan por la puerta de atrás. No
    // prohíbe subirlos: obliga a escribir el porqué, que es lo que permitió auditarlos.
    const ids = Object.keys(EXPS.videos as Record<string, unknown>);
    const problemas = verificaExpectativas(EXPS, ids, { censoCompleto: false }) as string[];
    expect(problemas.filter((p) => /colaMaxPct|paradaMaxS|colaMinS/.test(p))).toEqual([]);
    // control positivo de la propia guarda: un umbral sin porqué SÍ se reporta
    const sucio = { ...EXPS, videos: { x: { debe: ["a"], colaMaxPct: 70 } } };
    expect((verificaExpectativas(sucio, ["x"], { censoCompleto: false }) as string[]).some((p) => p.includes("colaMaxPct"))).toBe(true);
  });
});

describe("gate de vídeos · replays (plano C)", () => {
  it("🔴 CONTROL POSITIVO — part23/part24: verdes VACUOS (comparable=0, conformity=null)", () => {
    const r = compruebaVacuo({ comparable: 0, matched: 0, conformity: null }, 1);
    expect(r.estado).toBe(FALLO);
    expect(r.detalle).toContain("no midió NADA");
  });

  it("conformity=null con comparables>0 también falla (el dato no cuadra consigo mismo)", () => {
    expect(compruebaVacuo({ comparable: 212, conformity: null }, 1).estado).toBe(FALLO);
    expect(compruebaVacuo({ comparable: 212, conformity: 0.288 }, 1).estado).toBe(OK);
  });

  it("🔴 CONTROL POSITIVO — semilla con los SEIS miembros a D:0 (nueve de las 24 lo están)", () => {
    const muertos = ["Min", "Shamino", "Iolo", "Jaana", "Julia", "Gwenno"].map((nombre) => ({ nombre, estado: "D", hp: 0 }));
    expect(compruebaPartyViva(muertos).estado).toBe(FALLO);
    const vivos = muertos.map((m, i) => (i === 0 ? { ...m, estado: "G", hp: 60 } : m));
    expect(compruebaPartyViva(vivos).estado).toBe(OK);
  });

  it("«estado G con 0 HP» no cuenta como vivo (el par estado+HP, no uno solo)", () => {
    expect(compruebaPartyViva([{ nombre: "Min", estado: "G", hp: 0 }]).estado).toBe(FALLO);
  });
});

describe("gate de vídeos · VELOCIDAD (ámbar) y capítulo del tour", () => {
  it("el suelo 1,83 s/op es el DERIVADO del corpus, y por debajo es ÁMBAR — no FALLO", () => {
    const r = compruebaVelocidad(34.9, { ops: 120, fuente: "teclas del sidecar", homologa: true });
    expect(r.estado).toBe(AMBAR);
    expect(r.detalle).toContain("6.3×");
    expect(r.estado).not.toBe(FALLO); // un vídeo rápido NO está roto: no puede tumbar nada
  });

  it("a ritmo humano (2,4 s/op, mediana del corpus) es OK", () => {
    expect(compruebaVelocidad(48, { ops: 20, fuente: "teclas del sidecar", homologa: true }).estado).toBe(OK);
  });

  it("un clip de menos de 5 s es ÁMBAR por DURACIÓN, sin necesitar recuento", () => {
    const r = compruebaVelocidad(1.08, { ops: 0, fuente: "estados visibles del panel", homologa: false });
    expect(r.estado).toBe(AMBAR);
    expect(r.detalle).toContain("1.1 s");
  });

  it("SIN sidecar VELOCIDAD se calla (SIN-DATO): no hay unidad del corpus que medir", () => {
    // Retirada MEDIDA: la primera versión sustituía las teclas por los estados visibles del
    // panel, y sobre los 12 vídeos con las dos sondas la razón estados/tecla va de 0,45 a
    // 2,33 — factor 5. No hay conversión, así que esta comprobación no se pronuncia y la
    // velocidad del material sin sidecar la mide LEGIBLE, en su propia unidad.
    const r = compruebaVelocidad(30, { ops: 100, fuente: "cambios de pantalla", homologa: false });
    expect(r.estado).toBe(SIN_DATO);
    expect(r.detalle).toContain("LEGIBLE");
  });

  it("LEGIBLE: ≥10 cambios/s es ÁMBAR; el ancla ch17-doom-5 (3,1 c/s, pausa 3,9 s) es OK", () => {
    // Umbral y ancla vienen calibrados de la auditoría del Grand Tour, cuyo detector se
    // validó en las DOS direcciones (5 s congelados inyectados en vídeo real = detectados
    // exactos; los 3 s con movimiento = 0 detecciones).
    expect(compruebaLegibilidad({ cambiosS: 24.3, pausaMaxS: 0.08 }).estado).toBe(AMBAR);
    expect(compruebaLegibilidad({ cambiosS: 3.1, pausaMaxS: 3.92 }).estado).toBe(OK);
    // y el segundo disparador, independiente del ritmo medio: nada se sostiene 0,4 s
    const r = compruebaLegibilidad({ cambiosS: 5.0, pausaMaxS: 0.16 });
    expect(r.estado).toBe(AMBAR);
    expect(r.detalle).toContain("0.4");
    expect(compruebaLegibilidad(null).estado).toBe(SIN_DATO);
  });

  it("🔴 INFO: el lienzo NUNCA pintado (los 8 del tour) y la pantalla atenuada bajo modal", () => {
    // Firma medida, idéntica en los ocho: media 15,82 · sd 0,41. Barrido el umbral contra
    // las 91 clases de la auditoría, a 17 y a 20 marca los 8 y NI UNO más.
    const blanco = compruebaInformacion({ n: 27, media: 15.82, sd: 0.414, max: 16.04 });
    expect(blanco.estado).toBe(AMBAR);
    expect(blanco.clase).toBe("LIENZO-EN-BLANCO");
    // ch28-fondo-smoke: atenuado, no en blanco — y la distinción importa (uno no tiene nada
    // que dar; el otro SÍ juega y no se ve).
    const aten = compruebaInformacion({ n: 28, media: 22.16, sd: 2.386, max: 23.51 });
    expect(aten.estado).toBe(AMBAR);
    expect(aten.clase).toBe("MODAL-ATENUADO");
    // contenido real: ch02-lb-castle 43,05 · ch17-doom-5 85,01 · ch20 59,12
    for (const media of [43.05, 85.01, 59.12, 33.57]) {
      expect(compruebaInformacion({ n: 100, media, sd: 7.1, max: media + 20 }).estado).toBe(OK);
    }
    // NUNCA es FALLO: los ocho son tests de re-import sin nada visual que dar
    expect(blanco.estado).not.toBe(FALLO);
    expect(compruebaInformacion(null).estado).toBe(SIN_DATO);
  });

  it("un capítulo ROJO del tour NO se re-ficha: es SIN-DATO con su nota, jamás FALLO", () => {
    expect(compruebaCapitulo("ROJO").estado).toBe(SIN_DATO);
    expect(compruebaCapitulo("ROJO").detalle).toContain("index.md");
    expect(compruebaCapitulo("VERDE").estado).toBe(OK);
  });

  it("🔴 y TAMPOCO por la puerta de atrás: el vídeo de un capítulo ROJO no puede dar FALLO", () => {
    // Medido: ch03-britain (capítulo ROJO de 183 s) graba 179,9 s de consola congelada, y
    // ch06-moonglow 296,6 s de 303. Son el MISMO hecho que el capítulo ya fichado: el test
    // se colgó y el vídeo grabó el cuelgue. Sin esta degradación el gate re-ficharía dos de
    // los trece rojos adjudicados y arrastraría un rojo que nadie puede arreglar desde aquí.
    const ev = {
      id: "ch03-britain",
      exp: { ...resuelveExp(EXPS, "ch03-britain"), esTour: true },
      sidecar: null,
      probe: { bytes: 500_000, durS: 183, errores: [] },
      tramos: [{ start: 3.1, end: 183 }],
      report: null,
      party: null,
    };
    const rojo = adjudica({ ...ev, capitulo: "ROJO" });
    expect(rojo.veredicto).not.toBe(FALLO);
    expect(rojo.sinDato.map((c: { id: string }) => c.id)).toContain("PARADA-VIS");
    expect(rojo.sinDato.find((c: { id: string }) => c.id === "PARADA-VIS")!.detalle).toContain("179");
    // …y el MISMO material con el capítulo VERDE sí es un fallo del vídeo: la degradación
    // depende del capítulo, no de haber apagado la comprobación.
    expect(adjudica({ ...ev, capitulo: "VERDE" }).veredicto).toBe(FALLO);
  });
});

describe("gate de vídeos · composición y default-deny", () => {
  it("SIN-DATO no es verde: un vídeo sin sidecar deja DEBE/PROHIBIDO/RITMO/CIERRE sin medir y se DECLARA", () => {
    const r = adjudica({
      id: "x",
      exp: resuelveExp(EXPS, "whirlpool-shader"),
      sidecar: null,
      probe: { bytes: 900_000, durS: 11.4, errores: [] },
      tramos: [],
      report: null,
      party: null,
    });
    const ids = r.sinDato.map((c: { id: string }) => c.id);
    expect(ids).toEqual(expect.arrayContaining(["DEBE", "PROHIBIDO", "RITMO", "CIERRE"]));
    expect(r.veredicto).not.toBe(FALLO); // no se inventa un rojo por no haber medido…
    expect(r.checks.every((c: { estado: string }) => c.estado === OK)).toBe(false); // …ni un verde
  });

  it("DEFAULT-DENY: un .webm sin fila ni patrón en expectativas pone el gate rojo", () => {
    const p = verificaExpectativas(EXPS, ["whirlpool-shader", "invento-que-nadie-declaro"], { censoCompleto: false });
    expect(p.join(" ")).toContain("invento-que-nadie-declaro");
    expect(verificaExpectativas(EXPS, ["whirlpool-shader"], { censoCompleto: false })).toEqual([]);
    // y la OTRA mitad del censo, sobre la colección entera: una fila declarada que ya no
    // está en disco también es un problema (un vídeo retirado sin retirar su expectativa).
    const todos = Object.keys(EXPS.videos);
    expect(verificaExpectativas(EXPS, todos)).toEqual([]);
    expect(verificaExpectativas(EXPS, todos.slice(1)).join(" ")).toContain("AUSENTE de la colección");
  });

  it("los 91 vídeos del tour los cubre el PATRÓN de familia, no 91 filas", () => {
    expect(verificaExpectativas(EXPS, ["ch17-doom-9", "ch37b-wrong-v2-5"], { censoCompleto: false })).toEqual([]);
    expect(resuelveExp(EXPS, "ch17-doom-9").declarado).toBe(true);
  });

  it("toda excepción de vocabulario exige `permitidoPorque` escrito", () => {
    const copia = JSON.parse(JSON.stringify(EXPS));
    copia.videos["whirlpool-shader"].permitido = { "Blocked!": 3 };
    expect(verificaExpectativas(copia, ["whirlpool-shader"], { censoCompleto: false }).join(" ")).toContain("permitidoPorque");
  });

  it("los replays tienen su propia capa de defaults y NO la de eventos", () => {
    expect(resuelveExp(EXPS, "part04").paradaMaxS).toBe(8);
    expect(resuelveExp(EXPS, "whirlpool-shader").paradaMaxS).toBe(12);
  });

  it("el fichero de expectativas cubre las TRES familias sin huecos declarados a medias", () => {
    for (const [id, e] of Object.entries<Record<string, unknown>>(EXPS.videos)) {
      const tieneFirma = Array.isArray(e.debe) && e.debe.length > 0;
      expect(tieneFirma || Boolean(e.debeVacioPorque), `${id}: ni \`debe\` ni \`debeVacioPorque\``).toBe(true);
    }
  });
});
