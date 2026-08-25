/**
 * VISIBILIDAD / LOS derivada del kernel (E1-S2) — core/world/visibility.ts.
 *
 * Casos derivados del asm (citas en visibility.ts):
 *   · radio EXACTO: VISIBLE ⇔ radialDistance ≤ lightLevel (0x5A28 con inc en
 *     0x5a66 → umbral light+1). Tabla radial DATA.OVL 0x6AB8.
 *   · noche (radio 2) → 3×3; antorcha (10) y hechizo (18) → discos mayores; día
 *     (50) → toda la ventana.
 *   · FLOOD-FILL MOORE 8-conectado (0x5A28, tabla 5aec-5b26, 8 entradas): la
 *     diagonal es vecino DIRECTO (sin gate de flancos) — el corte de esquina real
 *     REVELA la rendija diagonal entre dos esquinas de muro (adjudicación #23,
 *     witness DOSBox: re/notes/flood-adjudication.md). El muro se ve pero no
 *     propaga; se ve rodeándolo si hay camino en radio.
 *
 * El caso "rendija diagonal" que el review de E1-S2 fijó como OCULTO está
 * INVERTIDO aquí (diagonal REVELADA), conforme al veredicto Moore.
 */
import { describe, expect, it } from "vitest";
import {
  CENTER,
  EMITTER_REACH,
  WINDOW,
  computeRadiusMask,
  computeVisibleWindow,
  isSightBlocking,
  radialDistance,
} from "../src/core/world/visibility.js";

/** Terreno abierto (hierba, tile 5): nada corta la visión. */
const OPEN = (): number => 5;

/** Índice row-major en la máscara para (col,row) de ventana. */
const idx = (col: number, row: number): number => row * WINDOW + col;

function countVisible(mask: Uint8Array): number {
  let n = 0;
  for (const v of mask) n += v;
  return n;
}

describe("radialDistance (0x6FF0 + tabla 0x6AB8)", () => {
  it("centro = 0, esquina = 50, y ≈ dcol²+drow²", () => {
    expect(radialDistance(CENTER, CENTER)).toBe(0);
    expect(radialDistance(0, 0)).toBe(50); // esquina: 5²+5²
    expect(radialDistance(CENTER + 1, CENTER)).toBe(1); // 1 ortogonal
    expect(radialDistance(CENTER, CENTER + 1)).toBe(1);
    expect(radialDistance(CENTER + 1, CENTER + 1)).toBe(2); // 1 diagonal
    expect(radialDistance(CENTER + 3, CENTER + 1)).toBe(10); // 3²+1²
  });
  it("es simétrica al plegar (x>5 → 10-x)", () => {
    expect(radialDistance(CENTER - 2, CENTER)).toBe(radialDistance(CENTER + 2, CENTER));
    expect(radialDistance(0, 3)).toBe(radialDistance(10, 7));
  });
});

describe("isSightBlocking (0x5DFE: tabla 0x6A86 + puertas con visor)", () => {
  it("montañas/bosques/muros/puertas SIN visor cortan la vista (a cualquier radial)", () => {
    for (const t of [0x09, 0x0c, 0x0d, 0x4f, 0x5a, 0xb8, 0xb9, 0x97, 0xff]) {
      expect(isSightBlocking(t, 1)).toBe(true);
      expect(isSightBlocking(t, 4)).toBe(true);
    }
  });
  it("hierba/suelo/puerta abierta NO cortan la vista", () => {
    for (const t of [0x05, 0x03, 0x44]) {
      expect(isSightBlocking(t, 1)).toBe(false);
      expect(isSightBlocking(t, 4)).toBe(false);
    }
  });
  it("puertas CON visor: transparentes pegado (radial 1), opacas de lejos", () => {
    // 0xBA/0xBB/0x98 = RegularDoorView/LockedDoorView/MagicLockDoorWithView;
    // 0x4A/0x4B = ventanas de piedra. Ver a través SÓLO adyacente (0x5DFE).
    for (const t of [0x4a, 0x4b, 0xba, 0xbb, 0x98]) {
      expect(isSightBlocking(t, 1)).toBe(false); // adyacente: se ve a través
      expect(isSightBlocking(t, 2)).toBe(true); // diagonal: tapa
      expect(isSightBlocking(t, 4)).toBe(true); // lejos: tapa
    }
  });
});

describe("computeVisibleWindow — radio por nivel de luz", () => {
  it("día (50): toda la ventana 11×11 visible", () => {
    expect(countVisible(computeVisibleWindow(50, OPEN))).toBe(WINDOW * WINDOW);
  });
  it("noche (2): sólo el 3×3 alrededor de la party", () => {
    const mask = computeVisibleWindow(2, OPEN);
    expect(countVisible(mask)).toBe(9);
    // El 3×3 centrado: todas visibles.
    for (let r = CENTER - 1; r <= CENTER + 1; r++)
      for (let c = CENTER - 1; c <= CENTER + 1; c++) expect(mask[r * WINDOW + c]).toBe(1);
    // A 2 casillas (radial 4 > 2): oculto.
    expect(mask[CENTER * WINDOW + (CENTER + 2)]).toBe(0);
  });
  it("antorcha (10) y hechizo de luz (18): discos crecientes", () => {
    expect(countVisible(computeVisibleWindow(10, OPEN))).toBe(37);
    expect(countVisible(computeVisibleWindow(18, OPEN))).toBe(61);
  });
  it("el radio crece monótono con la luz (2 < 10 < 18 < 50)", () => {
    const n = [2, 10, 18, 50].map((l) => countVisible(computeVisibleWindow(l, OPEN)));
    expect(n).toEqual([...n].sort((a, b) => a - b));
  });
});

describe("computeVisibleWindow — flood-fill, corte de esquina emergente (0x5A28)", () => {
  it("MOORE (adj. #23): la rendija diagonal entre dos esquinas de muro SÍ se revela", () => {
    // Muros al ESTE (6,5) y al SUR (5,6) de la party; suelo abierto en (6,6). El
    // modelo cardinal/AND-de-flancos del review de E1-S2 OCULTABA (6,6) (exigía
    // ambos flancos transparentes). REFUTADO por tercera lectura + witness DOSBox:
    // el flood es Moore 8-conectado SIN gate de flancos → (6,6) es vecino DIRECTO
    // del centro y, iluminada (radial 2 ≤ 2), se REVELA (corte de esquina real).
    const cornerWalls = (col: number, row: number): number =>
      (col === 6 && row === 5) || (col === 5 && row === 6) ? 0x4f : 5;
    const night = computeVisibleWindow(2, cornerWalls);
    expect(night[idx(6, 6)]).toBe(1); // ← Moore la revela (era 0 en el modelo refutado)
    // Los muros mismos, adyacentes, sí se ven.
    expect(night[idx(6, 5)]).toBe(1);
    expect(night[idx(5, 6)]).toBe(1);
  });

  it("de día también se ve (6,6): vecino diagonal directo (Moore) + rodeo", () => {
    // Con Moore la diagonal es vecino directo del centro; además con luz plena hay
    // rodeo (…→(6,4)→(7,4)→(7,6)→(6,6)). En ambos casos el original la muestra.
    const cornerWalls = (col: number, row: number): number =>
      (col === 6 && row === 5) || (col === 5 && row === 6) ? 0x4f : 5;
    expect(computeVisibleWindow(50, cornerWalls)[idx(6, 6)]).toBe(1);
  });

  it("REGRESIÓN review: un muro NO oculta lo que se ve rodeándolo", () => {
    // Muro solo en (6,5). (7,4) es visible por el rodeo (5,4)→(6,4)→(7,4); el
    // rayo Bresenham lo ocultaba de más al pasar por (6,5).
    const oneWall = (col: number, row: number): number =>
      col === 6 && row === 5 ? 0x4f : 5;
    const day = computeVisibleWindow(50, oneWall);
    expect(day[idx(7, 4)]).toBe(1); // visible rodeando
    expect(day[idx(6, 5)]).toBe(1); // el muro se ve
    expect(day[idx(7, 5)]).toBe(1); // detrás del muro, pero visible por el rodeo
  });

  it("corredor: un hueco de muro deja pasar la vista; visor pegado sí, muro ciego no", () => {
    // Muro vertical completo en col=6 con un hueco en (6,5): el ESTE (col≥7)
    // sólo es alcanzable por ese hueco → aísla el efecto del tile del hueco.
    const corridor =
      (gap: number) =>
      (col: number, row: number): number =>
        col === 6 ? (row === 5 ? gap : 0x4f) : 5;
    const east = idx(7, 5);
    // Puerta con visor (0xBA) pegada a la party (radial 1) → transparente → este visible.
    expect(computeVisibleWindow(50, corridor(0xba))[east]).toBe(1);
    // Muro/puerta ciega (0xB8) → opaca → el este queda oculto.
    expect(computeVisibleWindow(50, corridor(0xb8))[east]).toBe(0);
  });
});

describe("computeVisibleWindow — fuentes de luz ambientales (0x6A9A + 0x5E4A)", () => {
  it("una antorcha de pared ilumina su entorno de noche (radio 10, más allá del 3×3)", () => {
    // De noche (radio 2) la party sólo ve su 3×3. Una antorcha (RightSconce 0xB0)
    // 2 casillas al norte queda fuera de ese radio SIN luz propia, pero con ella
    // se ve, y su halo alrededor (radio 10 desde la antorcha).
    const noTorch = computeVisibleWindow(2, OPEN);
    expect(noTorch[idx(5, 3)]).toBe(0); // fuera del radio nocturno de la party
    const torch = (col: number, row: number): number => (col === 5 && row === 3 ? 0xb0 : 5);
    const lit = computeVisibleWindow(2, torch);
    expect(lit[idx(5, 3)]).toBe(1); // la antorcha se ve
    expect(lit[idx(5, 2)]).toBe(1); // su halo, más al norte
    expect(countVisible(lit)).toBeGreaterThan(countVisible(noTorch));
    // El halo está ACOTADO a radio 10 (dcol²+drow² ≤ 10) desde la antorcha (5,3),
    // no es luz infinita: (8,4) está a 3²+1²=10 → iluminado; (8,5) a 3²+2²=13 →
    // a oscuras. La party (radio 2 de noche) no alcanza ninguna de las dos.
    expect(lit[idx(8, 4)]).toBe(1);
    expect(lit[idx(8, 5)]).toBe(0);
  });

  it("EMITTER_REACH = 3 y es AJUSTADA: a 3 casillas el emisor toca, a 4 no", () => {
    // La cota se DERIVA de la tabla radial (dcol²+drow² ≤ 10 ⇒ |d| ≤ 3), no es un
    // literal. Aquí se comprueba que vale 3 Y que es ajustada por los dos lados: un
    // emisor a REACH del borde tiene que contribuir, y uno a REACH+1 no puede.
    expect(EMITTER_REACH).toBe(3);
    // Emisor a `d` columnas POR FUERA del borde oeste, en la fila del centro: su halo
    // llega 3 casillas ⇒ la columna MÁS AL ESTE que toca es la `3−d`, luego alcanza la
    // columna 0 del encuadre sólo si d ≤ 3. El régimen que hace observable la cota es
    // el del hechizo LIGHT (18): la party enciende hasta la columna 1 (radial 16), y la
    // columna 0 (radial 25) cae FUERA de su disco, así que sólo la puede encender el
    // emisor. Con radio 10 la cota NO se ve — la party se queda en la columna 2 y ni
    // siquiera se llega a mirar la 0. La cota es del EMISOR; que se note depende del
    // régimen.
    //
    // 🔴 LA SONDA ES UN MURO EN LA COLUMNA 0, Y ESO NO ES UN DETALLE (#256). Hasta el
    // 16-08 la columna 0 era hierba, y entonces esta prueba medía DOS cosas a la vez: la
    // cota del emisor y el PUENTE. Calcado el puente —una celda transparente fuera del
    // radio exige que su PADRE esté en el buffer de luces, 5c29—, con el emisor a 3 el
    // padre (columna 1, a distancia 4 del emisor) ya no está en el buffer y la columna 0
    // se apaga: la sonda daba [1,1,0,0] y dejaba de discriminar 3 de 4. Un MURO la
    // arregla porque la rama OPACA de 0x5A28 (5c52-5c91) decide mirando SÓLO si la
    // propia celda está en 0xAD14, sin condición sobre el padre — que es exactamente el
    // observable que aísla la cota del emisor de todo lo demás.
    const conEmisorA =
      (d: number) =>
      (col: number, row: number): number =>
        col === -d && row === CENTER ? 0xb0 : col === 0 && row === CENTER ? 0x4f : 5;
    expect(computeVisibleWindow(18, conEmisorA(99))[idx(0, CENTER)]).toBe(0); // control
    const tocaCol0 = [1, 2, 3, 4].map(
      (d) => computeVisibleWindow(18, conEmisorA(d))[idx(0, CENTER)],
    );
    expect(tocaCol0).toEqual([1, 1, 1, 0]); // d=4 ya no alcanza: la cota no se pasa
  });

  it("un emisor FUERA del encuadre SIGUE iluminando (#252) — y de día no cambia nada", () => {
    // 🔴 REPORTE DEL USUARIO 14-08: «¿las antorchas no deberían iluminar aunque no
    // estén en pantalla?». El barrido de emisores del original es del CHUNK 32x32 en
    // coordenadas de MAPA (0x5E4A, 5e72-5ee9) — la ventana de la party no participa.
    // Antorcha en la columna −1 (UNA casilla fuera del encuadre por el oeste), fila
    // del centro. Con radio de party 10 (antorcha portada) la columna 2 está dentro
    // del disco (radial 9) y hace de PUENTE; la columna 1 (radial 16) sólo la puede
    // encender el emisor de fuera.
    const fuera = (col: number, row: number): number =>
      col === -1 && row === CENTER ? 0xb0 : 5;
    const sinEmisor = computeVisibleWindow(10, () => 5);
    const conEmisor = computeVisibleWindow(10, fuera);
    expect(sinEmisor[idx(1, CENTER)]).toBe(0); // control: sin la antorcha, a oscuras
    expect(conEmisor[idx(1, CENTER)]).toBe(1); // con ella, encendida DESDE FUERA
    expect(conEmisor[idx(0, CENTER)]).toBe(1); // y la columna 0, pegada al emisor
    // De DÍA (radio 50) la ventana entera está dentro del disco de la party: el
    // emisor no puede añadir nada. Control que separa «barro más lejos» de «enciendo
    // de más» — si este pasara a fallar, el fix estaría revelando por su cuenta.
    expect(countVisible(computeVisibleWindow(50, fuera))).toBe(
      countVisible(computeVisibleWindow(50, () => 5)),
    );
  });

  it("SALA CON ANTORCHAS DE PARED: la luz no salta al andar, en los 5 regímenes", () => {
    // La escena del reporte (#252): sala rectangular con antorchas empotradas en los
    // cuatro muros. Se compara el campo de luz contra el de un muestreador CIEGO fuera
    // del encuadre (= el barrido por viewport de antes del 14-08). Los cinco regímenes
    // de `survival.ts::lightLevel`: 2 noche/subterráneo · 5 rampa del alba (DS 0x6A80)
    // · 10 antorcha portada · 18 hechizo Light · 50 día.
    const SCONCE = 0xb0;
    const paredes = new Set(
      [
        [1, 4],
        [1, 11],
        [22, 4],
        [22, 11],
        [6, 1],
        [17, 1],
        [6, 14],
        [17, 14],
      ].map(([x, y]) => `${x},${y}`),
    );
    const mapa = (mx: number, my: number): number =>
      paredes.has(`${mx},${my}`)
        ? SCONCE
        : mx < 2 || my < 2 || mx > 21 || my > 13
          ? 0x4f
          : 5;
    const desdeMapa = (px: number, py: number) => (col: number, row: number) =>
      mapa(px - 5 + col, py - 5 + row);
    const soloEncuadre = (px: number, py: number) => (col: number, row: number) =>
      col < 0 || row < 0 || col >= WINDOW || row >= WINDOW
        ? 5
        : mapa(px - 5 + col, py - 5 + row);

    // Un `expect` por régimen DENTRO del bucle dejaría los siguientes sin evaluar al
    // primer fallo: se acumula y se asserta una vez (misma disciplina que #34).
    const observado = [2, 5, 10, 18, 50].map((light) => {
      let posicionesQueGanan = 0;
      for (let py = 3; py <= 12; py++) {
        for (let px = 3; px <= 20; px++) {
          const conMapa = countVisible(computeVisibleWindow(light, desdeMapa(px, py)));
          const cegado = countVisible(
            computeVisibleWindow(light, soloEncuadre(px, py)),
          );
          // Nunca puede iluminar MENOS: el barrido del mapa es un superconjunto.
          if (conMapa < cegado) return `${light}:REGRESION`;
          if (conMapa > cegado) posicionesQueGanan++;
        }
      }
      return `${light}:${posicionesQueGanan > 0 ? "GANA" : "IGUAL"}`;
    });
    // Los cuatro regímenes con oscuridad ganan celdas; el de DÍA no puede ganar
    // ninguna (la ventana entera ya está dentro del disco de la party) — ése es el
    // control que distingue el fix de una iluminación indiscriminada.
    expect(observado).toEqual([
      "2:GANA",
      "5:GANA",
      "10:GANA",
      "18:GANA",
      "50:IGUAL",
    ]);
  });

  it("una antorcha tras un muro SELLADO no revela lo de detrás (regla dura #2)", () => {
    // Fila de muro completa en row=4 sella el norte; antorcha en (5,2) al otro
    // lado. Aunque la antorcha ilumina su zona, el flood de la party no cruza el
    // muro → no se revela (nunca se enseña más que el original).
    const sealed = (col: number, row: number): number =>
      row === 4 ? 0x4f : col === 5 && row === 2 ? 0xb0 : 5;
    const m = computeVisibleWindow(50, sealed); // día: sólo el muro limita
    expect(m[idx(5, 2)]).toBe(0); // antorcha sellada: oculta
    expect(m[idx(5, 4)]).toBe(1); // el muro sur del sellado sí se ve
  });
});

describe("computeRadiusMask — disco de radio PURO de la party (center-anchored, sin muros)", () => {
  it("es exactamente radialDistance ≤ lightLevel (mismo umbral que floodFOV, sin flood)", () => {
    const m = computeRadiusMask(2);
    for (let row = 0; row < WINDOW; row++) {
      for (let col = 0; col < WINDOW; col++) {
        expect(m[idx(col, row)]).toBe(radialDistance(col, row) <= 2 ? 1 : 0);
      }
    }
  });

  it("centro SIEMPRE dentro del disco; radio 2 = disco pequeño, radio 50 = ventana entera", () => {
    expect(computeRadiusMask(2)[idx(CENTER, CENTER)]).toBe(1);
    // noche (radio 2): la esquina (0,0) queda fuera; una celda a radial ≤2 dentro.
    expect(computeRadiusMask(2)[idx(0, 0)]).toBe(0);
    expect(computeRadiusMask(2)[idx(CENTER + 1, CENTER)]).toBe(1); // radial 1
    // día (radio 50 = máx de la tabla): TODA la ventana encendida.
    const full = computeRadiusMask(50);
    expect(full.every((v) => v === 1)).toBe(true);
  });

  it("IGNORA muros/terreno (es puro radio): sólo depende de lightLevel", () => {
    // No recibe terrainAt — un muro dentro del radio sigue marcado 1 (la oclusión la
    // resuelve visMask, no el disco). Contraste con computeVisibleWindow (que sí ocluye).
    const disc = computeRadiusMask(2);
    const litInDisc = disc.reduce((n, v) => n + v, 0);
    expect(litInDisc).toBeGreaterThan(1); // más que sólo el centro
  });
});
