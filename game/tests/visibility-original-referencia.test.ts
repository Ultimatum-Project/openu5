/**
 * MODELO DE REFERENCIA DEL PASE DE VISIBILIDAD DEL ORIGINAL — los CONTROLES que dicen
 * si el modelo se puede creer, y el careo del port contra él.
 *
 * La transcripción del binario (0x5A28 / 0x5D0A / 0x5E4A) vive en el módulo hermano
 * `visibility-original-referencia.model.ts` desde #256: importar un `.test.ts` ejecuta su
 * suite dentro de la del importador (ficha #240), así que un instrumento que quisiera
 * medir con el modelo tenía que elegir entre duplicarlo o contaminar el cardinal.
 *
 * POR QUÉ VIVE EN EL ÁRBOL (y no en un scratchpad). Este modelo produjo las cifras
 * con las que se refutó la propiedad «el port se queda corto, nunca largo» que el
 * docblock de `core/world/visibility.ts` declaraba desde #219/#220, y es el que
 * necesitará la tanda de las TRES omisiones de visibilidad (ficha #256: el puente,
 * + la escritura de vuelta del buffer, + el protocolo de dos ramas del repintado).
 * Nació en el scratchpad de sesión de un carril que se jubilaba: ahí muere con la
 * sesión y la tanda siguiente lo reconstruye. Se commitea por eso.
 *
 * ★★ CÓMO SE USA SIN QUE TE MIENTA. Un comparador entre dos modelos devuelve 0 con
 * la misma facilidad cuando ambos coinciden que cuando el modelo está roto y no
 * discrimina nada. Los CONTROLES de abajo no son decoración: tres escenas donde el
 * original y el port TIENEN que coincidir (y salen 0-0), más un control POSITIVO con
 * la discrepancia predicha a mano ANTES de correrlo. Al primer intento el control
 * positivo del autor daba 0-0 también — o sea que no discriminaba nada y habría
 * avalado cualquier cifra. Si tocas el modelo, la obligación es re-correr los cuatro:
 * los tres a cero Y el positivo a su valor exacto. Un modelo que sólo pasa los de
 * cero es indistinguible de uno que devuelve cero siempre.
 *
 * La TRANSCRIPCIÓN con sus citas está en la cabecera del `.model.ts`.
 *
 * CIFRAS MEDIDAS CON ESTE MODELO (14-08, sobre el árbol con #252 dentro). «sobre» =
 * celdas que el PORT revela y el original no; «sub» = las que el original revela y
 * el port no. Por posición de party, sumando todas las posiciones de cada escena:
 *
 *   escena                luz   sobre (pre-#252 → post)   sub (pre-#252 → post)
 *   sala sintética          2        1164 →  1476              732 →  0
 *   sala sintética         10         176 →   488             1288 →  0
 *   sala sintética         18           0 →   300             1272 →  0
 *   Blackthorn sótano       2          76 →     0              970 →  0
 *   Blackthorn sótano      10         206 →     0              984 →  0
 *   Blackthorn sótano      18         118 →     0             1004 →  0
 *   LB sótano               2        3824 →  1649              545 →  0
 *   LB sótano              10        2067 →   438              977 →  0
 *   LB sótano              18        1085 →   109             1185 →  0
 *   Cove                    2        3683 →  1086              370 →  0
 *   Cove                   10        2389 →   621              653 →  0
 *   Cove                   18        1320 →   261              955 →  0
 *
 * Los tres mapas reales son `smallmaps.json` (Blackthorn loc 18 z=−1, LB loc 17
 * z=−1, Cove loc 23 z=0), 1024 posiciones de party cada uno; la sala sintética son
 * 180. Las filas de mapa real NO se asertan aquí (cargar los mapas y barrer 3072
 * posiciones cuesta minutos y compraría fragilidad de puerta): se reproducen con el
 * modelo de este fichero. Lo que SÍ se aserta es la propiedad, sobre la escena
 * barata — ver el último bloque.
 *
 * LECTURA DE ESAS CIFRAS, que es lo que no se debe perder:
 *  · La propiedad «corto, nunca largo» que el docblock de visibility.ts declaraba
 *    YA ERA FALSA ANTES de #252 — 3824 celdas de sobre-revelado en el sótano de LB.
 *    La atribución a #219/#220 no se mueve; lo que se fecha es la REFUTACIÓN.
 *  · #252 cierra el lado corto POR COMPLETO (sub = 0 en las doce filas): al igualar
 *    la población de emisores a la del binario, lo revelado pasa a ser SUPERCONJUNTO.
 *  · El sobre-revelado BAJA en los tres mapas reales (a CERO en Blackthorn, donde el
 *    port es hoy exactamente el original) y SUBE en la sala sintética — que es una
 *    sala abierta con antorchas en el anillo de muro, la geometría que MAXIMIZA la
 *    discrepancia del puente, y que no existe en el juego. Por eso el veredicto no
 *    es «#252 rompió una propiedad» sino «cambió la magnitud de una que ya era
 *    falsa, mejorándola en todo lo real».
 *  · La causa ÚNICA del sobre-revelado residual es el puente (ficha #256).
 *
 * ✅ CERRADO EL 16-08 (#256): las cifras de la tabla de arriba son TODAS pre-#256 — se
 * quedan porque fechan la refutación, no porque describan el árbol de hoy. Calcado el
 * puente (el PADRE en 0xAD14, 5c29), la sonda sobre los mismos tres mapas reales da
 * `sobre = 0` Y `sub = 0` en las 1024 posiciones de cada mapa × los CINCO regímenes de
 * luz (2 · 5 · 10 · 18 · 50) = 15.360 posiciones: el port ES el pase de la party del
 * original, no un superconjunto suyo. Esa sonda vive en el scratchpad del carril porque
 * lee `smallmaps.json` (material de EA, gitignored — ficha #307); lo que SÍ se aserta
 * aquí es la misma propiedad sobre la sala sintética, que es barata y viaja.
 * El peor caso que cerró: sótano de LB, party en (22,24) con luz 2 — el original enseña
 * 11 casillas de 121 y el port enseñaba 65.
 *
 * 🔴 CORREGIDO EL 20-08 (#350-resplandor): la lectura de #256 tenía las DOS RAMAS de
 * fuera-del-radio INTERCAMBIADAS (la polaridad de 0x5DFE es 1 = deja pasar; ver la
 * cabecera del `.model.ts` y re/notes/resplandor-350-derivacion.md) y le faltaba el
 * ENCOLADO de las transparentes ocultas (5c74 no toca [bp-0x214] ⇒ el push las empuja
 * igual). En régimen de CONTACTO ambas lecturas coinciden — por eso la sonda de las
 * 15.360 posiciones y el testigo de #350 en px≥21 acreditaron a #256 y sólo el islote
 * a distancia delató la inversión (34 celdas medidas en RAM que la lectura vieja no
 * produce; el modelo corregido reproduce las 726 celdas-posición con CERO mismatches:
 * `visibility-resplandor-350.test.ts`, esperados RAM EN CRUDO). Los controles de abajo
 * se re-derivaron con la corrección: el contrincante del control positivo pasa a ser
 * LA LECTURA VIEJA DE #256 (`ventanaLectura256`), que es la refutada vigente; la regla
 * sin-padre de E1 (dos refutaciones más atrás) salió con su test — en las escenas de
 * este fichero ya no discrimina contra el modelo corregido (deMas = 0 medido), y su
 * papel histórico queda fechado en el docblock de `core/world/visibility.ts`.
 */
import { describe, expect, it } from "vitest";
import { WINDOW, computeVisibleWindow } from "../src/core/world/visibility.js";
import {
  CENTER,
  type Mapa,
  bloquea,
  buildLightBuffer,
  originalWindow,
  radialOff,
  win,
} from "./visibility-original-referencia.model.js";

/** Compara port vs original en una posición. Devuelve {sobre, sub}. */
function careo(
  light: number,
  at: Mapa,
  px: number,
  py: number,
): { sobre: number; sub: number } {
  const lit = buildLightBuffer(at, px, py, 16);
  const o = originalWindow(light, at, px, py, lit);
  const p = computeVisibleWindow(light, win(at, px, py));
  let sobre = 0, sub = 0;
  for (let i = 0; i < WINDOW * WINDOW; i++) {
    if (p[i] && !o[i]) sobre++;
    if (!p[i] && o[i]) sub++;
  }
  return { sobre, sub };
}

/** Rejilla de posiciones barata y determinista. */
const REJILLA: [number, number][] = [];
for (let y = 4; y <= 20; y += 3) for (let x = 4; x <= 20; x += 3) REJILLA.push([x, y]);

describe("modelo de referencia del original — CONTROLES (léelos antes de creerle una cifra)", () => {
  it("coincide EXACTO donde tiene que coincidir: suelo abierto sin emisores, 4 regímenes", () => {
    // Sin emisores el buffer 0xAD14 está vacío, así que el brazo del puente no se
    // ejecuta nunca y los dos modelos se reducen al mismo flood radial.
    const suelo: Mapa = () => 5;
    const r = [2, 10, 18, 50].map((l) =>
      REJILLA.reduce(
        (a, [x, y]) => {
          const c = careo(l, suelo, x, y);
          return { sobre: a.sobre + c.sobre, sub: a.sub + c.sub };
        },
        { sobre: 0, sub: 0 },
      ),
    );
    expect(r).toEqual([
      { sobre: 0, sub: 0 }, { sobre: 0, sub: 0 },
      { sobre: 0, sub: 0 }, { sobre: 0, sub: 0 },
    ]);
  });

  it("coincide EXACTO con muros y sin emisores: la LOS pura es la misma", () => {
    const muro: Mapa = (x, y) => (x === 8 && y !== 12 ? 0x4f : 5);
    const r = [10, 50].map((l) =>
      REJILLA.reduce(
        (a, [x, y]) => {
          const c = careo(l, muro, x, y);
          return { sobre: a.sobre + c.sobre, sub: a.sub + c.sub };
        },
        { sobre: 0, sub: 0 },
      ),
    );
    expect(r).toEqual([{ sobre: 0, sub: 0 }, { sobre: 0, sub: 0 }]);
  });

  it("coincide EXACTO de DÍA aunque haya antorchas: la ventana cae entera en el disco", () => {
    const conAntorchas: Mapa = (x, y) =>
      (x % 7 === 0 && y % 5 === 0) ? 0xb0 : (x % 11 === 3 ? 0x4f : 5);
    const t = REJILLA.reduce(
      (a, [x, y]) => {
        const c = careo(50, conAntorchas, x, y);
        return { sobre: a.sobre + c.sobre, sub: a.sub + c.sub };
      },
      { sobre: 0, sub: 0 },
    );
    expect(t).toEqual({ sobre: 0, sub: 0 });
  });

  it("★ CONTROL POSITIVO con la discrepancia PREDICHA A MANO — sin él, los tres ceros no valen", () => {
    // Party en (20,20) con luz 10: su disco llega a desplazamiento 3 (radial 9), o
    // sea columnas 2..8 del encuadre. Antorcha en (13,20) = columna −2. Su halo
    // cubre la columna 1 (desplazamiento 3 desde ella, radial ≤ 10: filas 4-6) y
    // la columna 0 (desplazamiento 2: filas 3-7) pero NO la columna 2
    // (desplazamiento 4, radial 16 > 10) ⇒ el halo NO toca el disco.
    // ⇒ el ORIGINAL (con el resplandor de #350) enciende esas 3+5 = 8 celdas
    //   iluminadas: son transparentes y el flood las alcanza cruzando la columna
    //   2 a oscuras (la vía 5c74 encola la oculta y 5c52/5c8c enciende la propia
    //   SIN mirar al padre). LA LECTURA VIEJA DE #256 las deja a oscuras las 8:
    //   su puente exigía PADRE en 0xAD14 y la cadena no podía arrancar (la
    //   columna 2, único contacto con el disco, no está iluminada).
    // Predicho A MANO antes de correrlo (5 de col 0 + 3 de col 1); sale exacto.
    //
    // 🔴 EL SUJETO DE ESTE CONTROL HA CAMBIADO DOS VECES, y la razón importa: el
    // contrincante debe ser siempre LA REGLA REFUTADA VIGENTE. Hasta el 16-08 fue
    // el port (llevaba la regla sin-padre de E1); con #256 pasó a ser la regla
    // sin-padre escrita aquí; con #350-resplandor la refutada es LA PROPIA LECTURA
    // DE #256 —que en esta misma escena predecía el CERO que este control usaba de
    // esperado—. El 8 es el mismo por geometría (las mismas 8 celdas del halo),
    // pero la dirección se INVIERTE: antes «la refutada enciende de más lo que el
    // original apaga», ahora «el original enciende lo que la refutada apagaba».
    const px = 20, py = 20;
    const antorcha: Mapa = (x, y) => (x === 13 && y === 20 ? 0xb0 : 5);
    const lit = buildLightBuffer(antorcha, px, py, 16);
    expect(lit.has(`${px - CENTER + 2},${py}`)).toBe(false); // el contacto con el disco, a oscuras
    expect(lit.has(`${px - CENTER + 1},${py}`)).toBe(true); // la col 1, iluminada
    const o = originalWindow(10, antorcha, px, py, lit);
    const refutada = ventanaLectura256(10, antorcha, px, py, lit);
    expect(o[5 * WINDOW + 1]).toBe(1); // el original la enciende (resplandor)
    expect(refutada[5 * WINDOW + 1]).toBe(0); // la lectura de #256 no
    let resplandor = 0, alReves = 0;
    for (let i = 0; i < WINDOW * WINDOW; i++) {
      if (o[i] && !refutada[i]) resplandor++;
      if (refutada[i] && !o[i]) alReves++;
    }
    expect({ resplandor, alReves }).toEqual({ resplandor: 8, alReves: 0 });
  });
});

/**
 * EL MUTANTE DE LOS DOS ESTADOS: idéntico a `originalWindow` salvo que una celda OPACA que
 * falla el test del padre (5c05-5c45) se marca OCULTA en vez de dejarse NO DECIDIDA — es
 * decir, pierde el reintento de 5c47. (Con la corrección de #350-resplandor el reintento
 * vive SOLO en la rama opaca: la transparente decide en los dos sentidos, 5c93/5c74.)
 * Vive aquí por la regla de siempre: el `.model.ts` transcribe el binario y no debe llevar
 * interruptores para producir conductas que el binario no tiene.
 */
function ventanaDosEstados(
  light: number,
  at: Mapa,
  px: number,
  py: number,
  lit: Set<string>,
): Uint8Array {
  const NO_VISTO = 0, OCULTA = 1, VISIBLE = 2;
  const N8 = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]] as const;
  const st = new Uint8Array(WINDOW * WINDOW);
  const idx = (c: number, r: number): number => r * WINDOW + c;
  st[idx(CENTER, CENTER)] = VISIBLE;
  const q: [number, number][] = [[CENTER, CENTER]];
  for (let h = 0; h < q.length; h++) {
    const [pc, pr] = q[h]!;
    const padreVisible = st[idx(pc, pr)] === VISIBLE;
    const padreEnBuffer = lit.has(`${px - CENTER + pc},${py - CENTER + pr}`);
    for (const [ox, oy] of N8) {
      const c = pc + ox, r = pr + oy;
      if (c < 0 || r < 0 || c >= WINDOW || r >= WINDOW) continue;
      if (st[idx(c, r)] !== NO_VISTO) continue;
      const rad = radialOff(Math.abs(c - CENTER), Math.abs(r - CENTER));
      const tile = at(px - CENTER + c, py - CENTER + r);
      const propiaEnBuffer = lit.has(`${px - CENTER + c},${py - CENTER + r}`);
      if (rad <= light) {
        st[idx(c, r)] = VISIBLE;
        if (!bloquea(tile, rad)) q.push([c, r]);
        continue;
      }
      if (!bloquea(tile, rad)) {
        st[idx(c, r)] = propiaEnBuffer ? VISIBLE : OCULTA;
        q.push([c, r]);
        continue;
      }
      st[idx(c, r)] =
        padreVisible && padreEnBuffer && propiaEnBuffer
          ? VISIBLE
          : OCULTA; // ← EL MUTANTE: cierra la opaca al primer fallo; el binario la deja 0xFF
    }
  }
  return st.map((v) => (v === VISIBLE ? 1 : 0));
}

/**
 * LA LECTURA VIEJA DE #256 — la refutada VIGENTE, escrita para que el control positivo
 * tenga contra qué discriminar: las dos ramas de fuera-del-radio intercambiadas
 * (transparente = puente que exige PADRE en 0xAD14 con reintento; opaca = propia sola,
 * decidida) y sin encolado de ocultas. Es EXACTAMENTE lo que `originalWindow` y el port
 * hacían desde el 16-08 hasta #350-resplandor. Vive AQUÍ y no en el `.model.ts` a
 * propósito: el modelo es una transcripción del binario y no debe llevar interruptores
 * para producir conductas que el binario no tiene.
 */
function ventanaLectura256(
  light: number,
  at: Mapa,
  px: number,
  py: number,
  lit: Set<string>,
): Uint8Array {
  const UND = 0, HID = 1, VIS = 2;
  const N8 = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]] as const;
  const st = new Uint8Array(WINDOW * WINDOW).fill(UND);
  const idx = (c: number, r: number): number => r * WINDOW + c;
  st[idx(CENTER, CENTER)] = VIS;
  const q: [number, number][] = [[CENTER, CENTER]];
  for (let h = 0; h < q.length; h++) {
    const [pc, pr] = q[h]!;
    const padreEnBuffer = lit.has(`${px - CENTER + pc},${py - CENTER + pr}`);
    for (const [ox, oy] of N8) {
      const c = pc + ox, r = pr + oy;
      if (c < 0 || r < 0 || c >= WINDOW || r >= WINDOW) continue;
      if (st[idx(c, r)] !== UND) continue;
      const rad = radialOff(Math.abs(c - CENTER), Math.abs(r - CENTER));
      const tile = at(px - CENTER + c, py - CENTER + r);
      const propiaEnBuffer = lit.has(`${px - CENTER + c},${py - CENTER + r}`);
      if (rad <= light) {
        st[idx(c, r)] = VIS;
        if (!bloquea(tile, rad)) q.push([c, r]);
        continue;
      }
      if (bloquea(tile, rad)) {
        st[idx(c, r)] = propiaEnBuffer ? VIS : HID;
        continue;
      }
      if (padreEnBuffer && propiaEnBuffer) {
        st[idx(c, r)] = VIS;
        q.push([c, r]);
      }
    }
  }
  return st.map((v) => (v === VIS ? 1 : 0));
}

/** La sala del reporte del usuario de #252: antorchas de pared en el anillo de muro. */
const PAREDES_252 = new Set(
  [[1, 4], [1, 11], [22, 4], [22, 11], [6, 1], [17, 1], [6, 14], [17, 14]].map(
    ([x, y]) => `${x},${y}`,
  ),
);
const SALA_252: Mapa = (mx, my) =>
  PAREDES_252.has(`${mx},${my}`)
    ? 0xb0
    : mx < 2 || my < 2 || mx > 21 || my > 13
      ? 0x4f
      : 5;
const POS_252: [number, number][] = [];
for (let y = 4; y <= 12; y += 2) for (let x = 4; x <= 20; x += 2) POS_252.push([x, y]);

describe("el port ES el pase de la party del original (#252 el lado corto, #256 el largo)", () => {
  // 🔴 Este bloque se aserta EN LOS DOS SENTIDOS a la vez y por régimen, porque las dos
  // mitades tienen dueños distintos y se rompen por causas distintas: `sub` vuelve a
  // subir si alguien devuelve el barrido de emisores al encuadre (#252), y `sobre` si
  // alguien quita del puente la condición del PADRE (#256). Un aserto que sumara los
  // cinco regímenes en una cifra dejaría pasar una compensación entre ellos.
  it("sobre = 0 Y sub = 0 en la sala con antorchas de pared, en los 5 regímenes", () => {
    const porRegimen = [2, 5, 10, 18, 50].map((l) =>
      POS_252.reduce(
        (a, [x, y]) => {
          const c = careo(l, SALA_252, x, y);
          return { sobre: a.sobre + c.sobre, sub: a.sub + c.sub };
        },
        { sobre: 0, sub: 0 },
      ),
    );
    expect(porRegimen).toEqual([
      { sobre: 0, sub: 0 }, { sobre: 0, sub: 0 }, { sobre: 0, sub: 0 },
      { sobre: 0, sub: 0 }, { sobre: 0, sub: 0 },
    ]);
  });

  it("★ el REINTENTO del 0xFF es carga útil: con DOS estados en la opaca se pierden 69 celdas", () => {
    // El test del padre que falla escribe 0xFF (5c47) = NO DECIDIDA, y la celda opaca se
    // re-intenta desde otro vecino; sólo 5c74 (0) y 5c93 (el tile) deciden. Un port con DOS
    // estados —«visto / no visto»— cierra el muro en el primer fallo (p. ej. visitado
    // primero desde una celda OCULTA del paseo del resplandor, que tiene padre≠0 en contra)
    // y pierde las que un vecino visible+iluminado habría encendido después. Aquí se mide
    // cuánto: el esperado va EN CRUDO y sobre la MISMA escena y las MISMAS posiciones del
    // bloque de arriba, para que las dos cifras sean comparables.
    // (El 551/82 que este test asertaba hasta #350-resplandor medía el mutante contra la
    // lectura VIEJA, que llevaba el reintento en la rama transparente: cifra de otra
    // semántica, fechada aquí y no comparable con ésta.)
    let perdidas = 0, posiciones = 0;
    for (const l of [2, 5, 10, 18, 50])
      for (const [x, y] of POS_252) {
        const lit = buildLightBuffer(SALA_252, x, y, 16);
        const o = originalWindow(l, SALA_252, x, y, lit);
        const d = ventanaDosEstados(l, SALA_252, x, y, lit);
        let n = 0;
        for (let i = 0; i < WINDOW * WINDOW; i++) if (o[i] && !d[i]) n++;
        perdidas += n;
        if (n > 0) posiciones++;
      }
    expect({ perdidas, posiciones }).toEqual({ perdidas: 69, posiciones: 46 });
  });

  it("★ y esa escena SÍ ejercita el resplandor: la lectura de #256 deja a oscuras 1361 celdas", () => {
    // Sin esta cifra el bloque de arriba es indistinguible de «la escena no llega nunca
    // a los brazos corregidos y por eso sale cero» — el verde hueco de manual. La lectura
    // vieja corre sobre EXACTAMENTE las mismas posiciones y el mismo mapa, y el esperado
    // va EN CRUDO: es lo que revelaban el modelo y el port hasta #350-resplandor, medido
    // como sub-revelado (celdas que el modelo corregido enciende y la lectura vieja no).
    // La dirección es la del acta #350 §4: la vieja JAMÁS enseña de más (alReves = 0 en
    // el control positivo) — sólo se queda corta.
    let aOscuras = 0;
    for (const l of [2, 5, 10, 18, 50])
      for (const [x, y] of POS_252) {
        const lit = buildLightBuffer(SALA_252, x, y, 16);
        const o = originalWindow(l, SALA_252, x, y, lit);
        const v = ventanaLectura256(l, SALA_252, x, y, lit);
        for (let i = 0; i < WINDOW * WINDOW; i++) if (o[i] && !v[i]) aOscuras++;
      }
    expect(aOscuras).toBe(1361);
  });
});
