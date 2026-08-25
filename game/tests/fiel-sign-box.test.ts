/**
 * CAJA DE LETREROS (L)ook — tests del layout puro (skin/fiel/sign-box.ts).
 *
 * Derivación cotejada contra original/u5/play/SIGNS.DAT + RUNES.CH: glifos de caja
 * 0x38/0x39/0x3a/0x3b (esquinas), 0x6c (horizontal), 0x6d/0x6e (púas sup/inf), 0x67
 * (vertical). El DOS dibuja el cartel EN EL FLUJO DE LA CONSOLA con TODO en RUNES.CH:
 * marco + cuerpo (veredicto #25 «igual que en el juego»). La caja se dimensiona al
 * cuerpo RÚNICO ya compuesto (los dígrafos TH/EA/ST/NG/EE colapsan a 1 glifo), de modo
 * que "NORTH BRITAIN" (12 glifos runa) → interior 14 → 16 col = ancho de consola.
 */
import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  layoutSignBox,
  signBoxConsoleRows,
  bakedSignRows,
  bakedRowLatin,
  SIGN_BOX,
  SIGN_MACROS,
  SIGN_WRAP_COLS,
} from "../src/skin/fiel/sign-box.js";

/** Rutas ancladas al PROPIO fichero (no al cwd): el arnés mide SU árbol, no el de otro. */
const HERE = fileURLToPath(new URL(".", import.meta.url));
const SIGNS_JSON = `${HERE}../assets/signs.json`;
const DATA_OVL = `${HERE}../../original/u5/ultima5/DATA.OVL`;

function row(layout: ReturnType<typeof layoutSignBox>, r: number) {
  return layout.cells.slice(r * layout.cols, (r + 1) * layout.cols);
}
function codes(cells: { code: number }[]) {
  return cells.map((c) => c.code);
}
function text(cells: { code: number }[]) {
  return cells.map((c) => String.fromCharCode(c.code)).join("");
}

describe("layoutSignBox — marco", () => {
  it("una línea sin dígrafos: dimensiones = cuerpo runa + 1 aire por lado + 2 aristas", () => {
    const l = layoutSignBox(["PAWS"]); // 4 glifos runa (sin dígrafos)
    expect(l.cols).toBe(4 + 2 + 2); // interior 6 + 2 verticales
    expect(l.rows).toBe(3); // sup + 1 cuerpo + inf
  });

  it("una línea con dígrafos: la caja se estrecha (NORTH BRITAIN = 12 glifos runa → 16 col)", () => {
    const l = layoutSignBox(["NORTH BRITAIN"]); // NORTH→N,O,R,TH; ' '; BRITAIN=7 → 12 glifos
    expect(l.cols).toBe(12 + 2 + 2); // interior 14 → 16 col = ancho de consola
    expect(l.rows).toBe(3);
  });

  it("esquinas rúnicas en los cuatro vértices", () => {
    const l = layoutSignBox(["NORTH BRITAIN"]);
    const top = row(l, 0);
    const bot = row(l, l.rows - 1);
    expect(top[0]).toEqual({ code: SIGN_BOX.TL, rune: true });
    expect(top[top.length - 1]).toEqual({ code: SIGN_BOX.TR, rune: true });
    expect(bot[0]).toEqual({ code: SIGN_BOX.BL, rune: true });
    expect(bot[bot.length - 1]).toEqual({ code: SIGN_BOX.BR, rune: true });
  });

  it("aristas horizontales rúnicas con púas simétricas (0x6d arriba / 0x6e abajo)", () => {
    const l = layoutSignBox(["NORTH BRITAIN"]); // interior 14 → púas en idx 5 y 8 (byte-verificado)
    const top = codes(row(l, 0)).slice(1, -1); // interior de la fila superior (14 celdas)
    const bot = codes(row(l, l.rows - 1)).slice(1, -1);
    expect(top.filter((c) => c === SIGN_BOX.H_TOP_DEC).length).toBe(2);
    expect(bot.filter((c) => c === SIGN_BOX.H_BOT_DEC).length).toBe(2);
    // simetría: las dos púas equidistan del centro
    const idxs = top.map((c, i) => (c === SIGN_BOX.H_TOP_DEC ? i : -1)).filter((i) => i >= 0);
    const center = (top.length - 1) / 2;
    expect(center - idxs[0]!).toBeCloseTo(idxs[1]! - center, 5);
    expect(idxs).toEqual([5, 8]); // byte-idéntico al registro dumpeado de SIGNS.DAT
    // el resto son horizontales lisas
    expect(top.every((c) => c === SIGN_BOX.H || c === SIGN_BOX.H_TOP_DEC)).toBe(true);
  });

  it("filas de contenido: arista vertical rúnica a cada lado, cuerpo RÚNICO (RUNES.CH)", () => {
    const l = layoutSignBox(["NORTH BRITAIN"]);
    const mid = row(l, 1);
    expect(mid[0]).toEqual({ code: SIGN_BOX.V, rune: true });
    expect(mid[mid.length - 1]).toEqual({ code: SIGN_BOX.V, rune: true });
    // el interior (letras) va con RUNES.CH; sólo los espacios de centrado son rune:false
    expect(mid.slice(1, -1).every((c) => c.rune === true || c.code === 0x20)).toBe(true);
  });

  it("cuerpo CENTRADO dentro del interior", () => {
    const l = layoutSignBox(["PAWS"]); // interior 6, "PAWS"=4 → 1 espacio cada lado
    const inner = text(row(l, 1).slice(1, -1));
    expect(inner).toBe(" PAWS ");
  });

  it("multilínea: ancho = máximo de las líneas runa; cada línea centrada", () => {
    const l = layoutSignBox([" NORTH BRITAIN ", "   EAST PAWS    ", " SOUTH TRINSIC "]);
    // runa: "NORTH BRITAIN"=12, "EAST PAWS"=7 (EA,ST,' ',P,A,W,S), "SOUTH TRINSIC"=12 → max 12
    expect(l.cols).toBe(12 + 2 + 2);
    expect(l.rows).toBe(3 + 2);
    for (let r = 1; r <= 3; r++) {
      const inner = row(l, r).slice(1, -1);
      expect(inner.length).toBe(14);
      // centrado: mismo (±1) relleno de espacios a cada lado
      const lead = inner.findIndex((c) => c.code !== 0x20);
      const trail = [...inner].reverse().findIndex((c) => c.code !== 0x20);
      expect(Math.abs(lead - trail)).toBeLessThanOrEqual(1);
    }
  });

  it("todas las celdas de marco Y de cuerpo van rune:true; sólo los espacios rune:false", () => {
    const l = layoutSignBox(["HELLO"]);
    for (let r = 0; r < l.rows; r++) {
      for (let col = 0; col < l.cols; col++) {
        const cell = l.cells[r * l.cols + col]!;
        if (cell.code === 0x20) expect(cell.rune).toBe(false);
        else expect(cell.rune).toBe(true);
      }
    }
  });

  it("cartel estrecho: sin púas si el interior no llega a 6", () => {
    const l = layoutSignBox(["Y"]); // interior 3
    const top = codes(row(l, 0)).slice(1, -1);
    expect(top.every((c) => c === SIGN_BOX.H)).toBe(true);
  });
});

describe("layoutSignBox — cuerpo rúnico por defecto (veredicto #25)", () => {
  it("colapsa dígrafos a glifos RUNES.CH (TH/EA/ST/NG/EE)", () => {
    // "NORTH" → N,O,R,[TH]  · "EAST" → [EA],[ST]
    const l = layoutSignBox(["NORTH", "EAST"]);
    const r1 = row(l, 1).slice(1, -1).filter((c) => c.code !== 0x20);
    const r2 = row(l, 2).slice(1, -1).filter((c) => c.code !== 0x20);
    expect(r1.map((c) => c.code)).toEqual([0x4e, 0x4f, 0x52, 0x5b]); // N O R TH
    expect(r2.map((c) => c.code)).toEqual([0x5e, 0x5f]); // EA ST
    expect(r1.every((c) => c.rune === true)).toBe(true);
    expect(r2.every((c) => c.rune === true)).toBe(true);
  });

  it("hueco ENTRE PALABRAS = rombo 0x40 rúnico (SIGNS.DAT `@`), NO blanco 0x20", () => {
    const l = layoutSignBox(["NORTH BRITAIN"]);
    const body = row(l, 1).slice(1, -1); // interior de la fila de cuerpo
    // el separador de palabras entre NORTH y BRITAIN es 0x40 rúnico
    const sep = body.find((c) => c.code === 0x40);
    expect(sep).toEqual({ code: 0x40, rune: true });
    // el relleno de centrado sigue siendo 0x20 blanco (rune:false)
    expect(body.some((c) => c.code === 0x20 && c.rune === false)).toBe(true);
  });

  it("ANCHO topado al panel: contenido de 14 glifos → interior 14 (no 16, sin desbordar)", () => {
    // "PRIVATE ISLAND" = P,R,I,V,A,T,E,@,I,S,L,A,N,D = 14 glifos runa; el cap (14) evita el
    // 14+2=16 que desbordaría la consola. Byte-fiel al horneado (interior 14, aire 0).
    const rows = signBoxConsoleRows(["PRIVATE ISLAND"], 16);
    expect(rows[0]!.cells.length).toBe(16); // cabe EXACTO en la consola de 16 col
    // sin cap (layoutSignBox directo) sí daría 16 de interior
    expect(layoutSignBox(["PRIVATE ISLAND"], { maxInterior: 14 }).cols).toBe(16); // 14+2
    expect(layoutSignBox(["PRIVATE ISLAND"]).cols).toBe(18); // sin cap = 16+2 (sólo fuera de consola)
  });

  it("variante legible (runicBody:false): cuerpo latín en IBM (rune:false)", () => {
    const l = layoutSignBox(["NORTH BRITAIN"], { runicBody: false });
    const mid = row(l, 1).slice(1, -1);
    expect(text(mid).trim()).toBe("NORTH BRITAIN");
    expect(mid.every((c) => c.rune === false)).toBe(true);
    // en latín NO colapsa dígrafos → la caja es más ancha (13 chars → interior 15)
    expect(l.cols).toBe(13 + 2 + 2);
  });
});

describe("bakedSignRows — calco byte-exacto de SIGNS.DAT", () => {
  // Registro 0 crudo (NORTH BRITAIN, verificado en original/u5/play/SIGNS.DAT):
  // 8lllllmllmlllll9 g NOR[@BRITAIN g g ...  — sin saltos → grid W=16 por auto-wrap.
  const NORTH_BRITAIN = [
    0x38, 0x6c, 0x6c, 0x6c, 0x6c, 0x6c, 0x6d, 0x6c, 0x6c, 0x6d, 0x6c, 0x6c, 0x6c, 0x6c, 0x6c, 0x39,
    0x67, 0x20, 0x4e, 0x4f, 0x52, 0x5b, 0x40, 0x42, 0x52, 0x49, 0x54, 0x41, 0x49, 0x4e, 0x20, 0x67,
    0x67, 0x20, 0x20, 0x20, 0x5e, 0x5f, 0x40, 0x50, 0x41, 0x57, 0x53, 0x20, 0x20, 0x20, 0x20, 0x67,
    0x67, 0x20, 0x53, 0x4f, 0x55, 0x5b, 0x40, 0x54, 0x52, 0x49, 0x4e, 0x53, 0x49, 0x43, 0x20, 0x67,
    0x3a, 0x6c, 0x6c, 0x6c, 0x6c, 0x6c, 0x6e, 0x6c, 0x6c, 0x6e, 0x6c, 0x6c, 0x6c, 0x6c, 0x6c, 0x3b,
  ];

  it("sin saltos: auto-wrap al ancho del marco (W=16) → rejilla 16×5", () => {
    const g = bakedSignRows(NORTH_BRITAIN);
    expect(g.length).toBe(5);
    expect(g.every((r) => r.length === 16)).toBe(true);
    // esquinas en su sitio
    expect(g[0]![0]).toEqual({ code: SIGN_BOX.TL, rune: true });
    expect(g[0]![15]).toEqual({ code: SIGN_BOX.TR, rune: true });
    expect(g[4]![0]).toEqual({ code: SIGN_BOX.BL, rune: true });
    // el hueco inter-palabra (0x40) va rúnico (rombo), no blanco
    expect(g[1]!.some((c) => c.code === 0x40 && c.rune)).toBe(true);
  });

  it("byte con bit alto → IBM.CH (font 0) con el valor a 7 bits; 0x8a abre fila", () => {
    // 'A'(runa) + 0xC1('A'|0x80 → IBM) + salto 0x8a + 'B'(runa)
    const g = bakedSignRows([0x41, 0xc1, 0x8a, 0x42]);
    expect(g.length).toBe(2);
    expect(g[0]).toEqual([
      { code: 0x41, rune: true }, // runa
      { code: 0x41, rune: false }, // IBM (0xC1 & 0x7f)
    ]);
    expect(g[1]).toEqual([{ code: 0x42, rune: true }]);
  });

  it("0x0a PELADO abre fila igual que 0x8a — la máscara `and 0x7f` los iguala", () => {
    // 0x8a y 0x0a llegan al mismo putchar tras el `and ax,0x7f` de LOOKOBJ 0x07b3.
    expect(bakedSignRows([0x41, 0x0a, 0x42])).toEqual(bakedSignRows([0x41, 0x8a, 0x42]));
    expect(bakedSignRows([0x41, 0x0a, 0x42]).length).toBe(2);
  });

  it("0x0d NO abre fila: es la pausa por tecla (call 0x83dc), no imprime nada", () => {
    // LOOKOBJ 0x079a-0x07ac: font 0 + `call 0x83dc` (getkey_with_redraw) y salta al avance.
    expect(bakedSignRows([0x41, 0x0d, 0x42])).toEqual([
      [
        { code: 0x41, rune: true },
        { code: 0x42, rune: true },
      ],
    ]);
  });

  it("0x26 y 0x27 emiten la arista horizontal 0x6c (línea divisoria), no su glifo crudo", () => {
    // LOOKOBJ 0x0755-0x0764. En RUNES.CH el 0x26 es un glifo A CEROS: sin esta regla la
    // divisoria de las leyes de Blackthorn sale medio invisible.
    const g = bakedSignRows([0x26, 0x27, 0x26]);
    expect(g).toEqual([
      [
        { code: 0x6c, rune: true },
        { code: 0x6c, rune: true },
        { code: 0x6c, rune: true },
      ],
    ]);
  });

  it("un byte 0x29..0x31 expande su MACRO de 16 bytes = una fila entera, toda rúnica", () => {
    // LOOKOBJ 0x0766-0x0798, tabla DS:0x37be indexada por el BYTE ENTERO ×2.
    for (let b = 0x29; b <= 0x31; b++) {
      const g = bakedSignRows([b]);
      expect(g.length).toBe(1);
      expect(g[0]!.length).toBe(16);
      expect(g[0]!.every((c) => c.rune)).toBe(true);
      expect(codes(g[0]!)).toEqual([...SIGN_MACROS[b]!]);
    }
    // 0x28 y 0x32 quedan FUERA del rango (el `jb`/`ja` del binario): se pintan crudos.
    expect(bakedSignRows([0x28])).toEqual([[{ code: 0x28, rune: true }]]);
    expect(bakedSignRows([0x32])).toEqual([[{ code: 0x32, rune: true }]]);
  });

  it("cabecera: mientras el byte sea 0x0a el puntero avanza DE SEIS EN SEIS", () => {
    // LOOKOBJ 0x072e-0x0736. Ningún cartel del corpus la ejercita (censo: 0 de 79 empiezan
    // por 0x0a), así que se instancia sintéticamente o la regla quedaría sin testigo.
    const g = bakedSignRows([0x0a, 0xff, 0xff, 0xff, 0xff, 0xff, 0x41, 0x42]);
    expect(g).toEqual([
      [
        { code: 0x41, rune: true },
        { code: 0x42, rune: true },
      ],
    ]);
  });

  it("el ancho de envoltura es el ARGUMENTO (la ventana), no un dato del cartel", () => {
    // Mutante de la causa de #198: si el ancho se dedujera de los bytes (p. ej. buscando
    // la esquina 0x39), este cartel sin 0x39 colapsaría en una sola fila.
    const sinEsquina = [...Array<number>(32).fill(0x41)];
    expect(bakedSignRows(sinEsquina, 16).length).toBe(2);
    expect(bakedSignRows(sinEsquina, 8).length).toBe(4);
  });

  it("bakedRowLatin reconstruye el texto legible (dígrafos + rombo, sin marco)", () => {
    const g = bakedSignRows(NORTH_BRITAIN);
    expect(bakedRowLatin(g[1]!)).toBe("NORTH BRITAIN"); // [=TH, @=espacio, verticales fuera
    expect(bakedRowLatin(g[3]!)).toBe("SOUTH TRINSIC");
    expect(bakedRowLatin(g[0]!)).toBe(""); // fila de marco → sin texto
  });

  it("signBoxConsoleRows usa el calco cuando se le pasa `raw` (texto latín conservado)", () => {
    const rows = signBoxConsoleRows([], 16, NORTH_BRITAIN);
    expect(rows.length).toBe(5);
    expect(rows[1]!.text).toBe("NORTH BRITAIN");
    expect(rows[0]!.text).toBe(""); // marco
  });
});

describe("signBoxConsoleRows — cartel como filas de consola", () => {
  it("una fila de marco por borde + una por línea de cuerpo; texto latín conservado", () => {
    const rows = signBoxConsoleRows(["NORTH BRITAIN"], 16);
    expect(rows.length).toBe(3); // marco sup + cuerpo + marco inf
    // filas de marco: text vacío
    expect(rows[0]!.text).toBe("");
    expect(rows[2]!.text).toBe("");
    // fila de cuerpo: text LATÍN (para el log/e2e), celdas RÚNICAS
    expect(rows[1]!.text).toBe("NORTH BRITAIN");
    expect(rows[1]!.cells.some((c) => c.code === SIGN_BOX.V && c.rune)).toBe(true);
    expect(rows[1]!.cells.some((c) => c.code === 0x4e && c.rune)).toBe(true); // 'N' rúnica
  });

  it("centra la caja dentro del ancho de consola (offset por espacios de cabeza)", () => {
    const rows = signBoxConsoleRows(["PAWS"], 16); // caja de 8 col en consola de 16 → offset 4
    const leadBlanks = rows[0]!.cells.findIndex((c) => c.code === SIGN_BOX.TL);
    expect(leadBlanks).toBe(Math.floor((16 - 8) / 2)); // 4 espacios a la izquierda
    // "NORTH BRITAIN" llena las 16 col → offset 0
    const full = signBoxConsoleRows(["NORTH BRITAIN"], 16);
    expect(full[0]!.cells[0]!.code).toBe(SIGN_BOX.TL);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// CENSO DE LOS 79 CARTELES (ficha #198) — la guarda no es «el caso del reporte»,
// es LA TABLA ENTERA. Antes del fix, 49 de 79 decodificaban distinto del binario
// y 37 de ellos colapsaban en UNA fila (sólo se veía la primera línea del marco:
// el «9» del reporte = glifo 0x61 de RUNES.CH).
// ─────────────────────────────────────────────────────────────────────────────
interface SignFixture {
  location: number;
  floor: number;
  x: number;
  y: number;
  text: string;
  raw?: number[];
}
const SIGNS: SignFixture[] = JSON.parse(readFileSync(SIGNS_JSON, "utf8").replace(/^﻿/, ""));
const find = (location: number, x: number, y: number): SignFixture => {
  const s = SIGNS.find((e) => e.location === location && e.x === x && e.y === y);
  if (!s) throw new Error(`cartel (loc ${location}, ${x},${y}) ausente del corpus`);
  return s;
};
/** Arte ASCII de una rejilla decodificada — para clavar el calco a la vista. */
const ART: Record<number, string> = {
  0x38: "┌", 0x39: "┐", 0x3a: "└", 0x3b: "┘", 0x6c: "─", 0x6d: "┴", 0x6e: "┬", 0x67: "│",
  0x61: "╒", 0x62: "═", 0x63: "╕", 0x64: "╘", 0x65: "╧", 0x66: "╛",
  0x68: "┌", 0x69: "┐", 0x6a: "└", 0x6b: "┘", 0x40: "·",
  0x5b: "Þ", 0x5e: "Æ", 0x5f: "§", 0x5d: "Ŋ", 0x5c: "Ë",
};
const draw = (raw: readonly number[]): string[] =>
  bakedSignRows(raw).map((r) =>
    r.map((c) => ART[c.code] ?? (c.code >= 0x20 && c.code < 0x7f ? String.fromCharCode(c.code) : "¿")).join(""),
  );

describe("carteles — censo de LOS 79 de signs.json (#198)", () => {
  it("la población es 79 y todas traen bytes crudos", () => {
    expect(SIGNS.length).toBe(79);
    expect(SIGNS.filter((s) => (s.raw?.length ?? 0) > 0).length).toBe(79);
  });

  it("NINGUNO colapsa: los 79 dan ≥3 filas (marco + cuerpo + marco)", () => {
    const colapsados = SIGNS.filter((s) => bakedSignRows(s.raw!).length < 3);
    expect(colapsados.map((s) => `loc${s.location}(${s.x},${s.y})`)).toEqual([]);
  });

  it("ninguna fila desborda el panel de 16 col", () => {
    const anchas: string[] = [];
    for (const s of SIGNS) {
      for (const [i, r] of bakedSignRows(s.raw!).entries()) {
        if (r.length > SIGN_WRAP_COLS) anchas.push(`loc${s.location}(${s.x},${s.y})#${i}=${r.length}`);
      }
    }
    expect(anchas).toEqual([]);
  });

  it("las filas EN BLANCO están donde el binario las pone: sólo Serpent's Hold", () => {
    // 🔴 Este aserto empezó siendo «ninguna fila sale vacía» y el binario lo REFUTÓ.
    // putchar (ULTIMA.EXE:0x16ba) envuelve INMEDIATAMENTE: en 0x1735 incrementa la
    // columna tras pintar el glifo y, si `col + win.x0 > win.x1`, hace ya el row++/col=0
    // (0x1742). O sea, tras 16 caracteres el cursor YA está en la fila siguiente, y un
    // 0x0a a continuación (0x16d5 → 0x1742) suma OTRA fila: en blanco. Sólo un cartel
    // del corpus mete saltos explícitos tras filas llenas — el de Serpent's Hold, que
    // el extractor añade a mano desde DATA.OVL:0x743A y que además no tiene marco
    // inferior. Sale a doble espacio en el original, y así se calca.
    const vacias = SIGNS.flatMap((s) =>
      bakedSignRows(s.raw!)
        .map((r, i) => (r.length === 0 ? `loc${s.location}(${s.x},${s.y})#${i}` : ""))
        .filter(Boolean),
    );
    expect(vacias).toEqual(["loc32(15,19)#1", "loc32(15,19)#3", "loc32(15,19)#5"]);
  });

  it("cada fila corta corresponde a un salto EXPLÍCITO (o al resto final): el resto son 16", () => {
    // Si el ancho de envoltura no fuera 16, aparecerían filas cortas sin salto que las
    // justifique. Se carea fila a fila contra los bytes de salto del propio cartel.
    for (const s of SIGNS) {
      const filas = bakedSignRows(s.raw!);
      const cortas = filas.filter((r) => r.length < SIGN_WRAP_COLS).length;
      const saltos = s.raw!.filter((b) => (b & 0x7f) === 0x0a).length;
      expect({ id: `loc${s.location}(${s.x},${s.y})`, ok: cortas <= saltos + 1 }).toEqual({
        id: `loc${s.location}(${s.x},${s.y})`,
        ok: true,
      });
    }
  });

  it("CALCO A LA VISTA — lápida de Meridin (loc 0, 103,223): cabecera y hombros de macro", () => {
    expect(draw(find(0, 103, 223).raw!)).toEqual([
      "     ┌────┐     ",
      "┌────┘    └────┐",
      "│  HERE LIES A │",
      "│VALIANT KNIGHT│",
      "│              │",
      "│   MERIDIN    │",
      "│              │",
      "│RIP  12/1/137 │",
      "└────┐    ┌────┘",
      "     │    │    ",
      "     │    │    ",
    ]);
  });

  it("CALCO A LA VISTA — Ye Royal Prison (loc 17, 6,13): marco 0x61/0x63 + macro 0x29", () => {
    // Éste es EXACTAMENTE el patrón del reporte: sin 0x39, la regla vieja lo dejaba en
    // una sola fila y de todo el cartel sólo se veía «╒══════════════╕».
    expect(draw(find(17, 6, 13).raw!)).toEqual([
      "╒══════════════╕",
      "│              │",
      "│   YE·ROYAL   │",
      "│    PRISON    │",
      "│              │",
      "╘╧╧╧╧╧╧╧╧╧╧╧╧╧╧╛",
    ]);
  });

  it("CALCO A LA VISTA — ley de Justicia (loc 4, 16,28): divisoria 0x26/0x27 y pausa 0x0d", () => {
    const filas = draw(find(4, 16, 28).raw!);
    expect(filas[3]).toBe("│──────────────│"); // 0x26/0x27 → 0x6c, no glifos crudos
    expect(filas).toHaveLength(12); // el 0x0d NO añade fila
    expect(filas[11]).toBe("╘╧╧╧╧╧╧╧╧╧╧╧╧╧╧╛");
  });

  it("CALCO A LA VISTA — Serpent's Hold (loc 32, 15,19): doble espacio y sin marco inferior", () => {
    expect(draw(find(32, 15, 19).raw!)).toEqual([
      "╒══════════════╕",
      "",
      "│              │",
      "",
      "│  LIVE·BY·ÞE  │",
      "",
    ]);
  });

  it("el texto latín de las filas de cuerpo sale legible en TODO el corpus", () => {
    // Suelo anti-verde-hueco: si el decodificador se rompiera, esto caería a cero.
    const conTexto = SIGNS.filter((s) =>
      bakedSignRows(s.raw!).some((r) => /[A-Za-z]{3}/.test(bakedRowLatin(r))),
    );
    expect(conTexto.length).toBe(79);
    // Y los blancos 0x20 separan palabras (antes se caían: «HERELIESA»).
    expect(bakedSignRows(find(0, 103, 223).raw!).map(bakedRowLatin)).toContain("HERE LIES A");
  });
});

describe("carteles — la tabla de macros NO puede derivar de DATA.OVL (#198)", () => {
  const hayOriginal = existsSync(DATA_OVL);
  it("las 9 cadenas de SIGN_MACROS se re-derivan de DS:0x37be y coinciden byte a byte", () => {
    // Control de PROCEDENCIA: `fileoff = DS + 0x10`. Si alguien toca la constante, o si la
    // convención de direcciones cambia, este careo se pone rojo nombrando el byte.
    expect(hayOriginal).toBe(true); // original/ va symlinkado en todo worktree (REGLA 2)
    const d = readFileSync(DATA_OVL);
    for (let b = 0x29; b <= 0x31; b++) {
      const ptr = d.readUInt16LE(0x37be + 0x10 + 2 * b); // tabla indexada por el BYTE ENTERO
      let off = ptr + 0x10;
      const cadena: number[] = [];
      while (d[off] !== 0) cadena.push(d[off++]!);
      expect({ b, cadena }).toEqual({ b, cadena: [...SIGN_MACROS[b]!] });
      expect(cadena.length).toBe(SIGN_WRAP_COLS); // una fila ENTERA, ni más ni menos
    }
  });

  it("el bloque de macros termina justo donde empieza el cartel de Serpent's Hold", () => {
    // Control INDEPENDIENTE de que la resolución cae donde debe: el extractor lee ese
    // cartel en DATA.OVL:0x743A y la última macro acaba en 0x7439.
    const d = readFileSync(DATA_OVL);
    const ptr = d.readUInt16LE(0x37be + 0x10 + 2 * 0x31);
    expect(ptr + 0x10 + SIGN_WRAP_COLS + 2).toBe(0x743a); // NUL + 1 de relleno
  });
});
