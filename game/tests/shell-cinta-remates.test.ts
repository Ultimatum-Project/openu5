/**
 * #245 — LA CINTA DEL RÓTULO DEL SHELL: reglas EN LOS REMATES, y NO sobre el título.
 *
 * QUÉ VIGILA Y POR QUÉ. El remate ►◄ del marco (glifo 0x02, `bracketCanvas`) supone que las
 * filas 0 y 7 de su celda las pinta la CINTA — es lo que hace que sus dos brazos empalmen en
 * vez de flotar. Aquí se asierta que esas dos reglas existen, que caen en las filas EXACTAS
 * que los brazos esperan, y —lo que costó dos decisiones del usuario— que NO se extienden
 * sobre el pozo del rótulo.
 *
 * ★★ EL ASERTO QUE HABRÍA CAZADO LA DECAPITACIÓN. La primera implementación pasó la regla por
 * encima del título. Medido en vivo (WebKit iPhone, pozo x520..660, dpr 3): la primera fila
 * lógica del rótulo tiene **86 píxeles blancos de trazo** sobre negro; con la regla encima
 * pasa a **140 blancos y 0 negros** — la fila entera tapada, `SYSTEM` ilegible. El pozo mide
 * 8 filas de glifo y las letras USAN la fila 0: no hay hueco. Por eso el tercer `it` vigila
 * que el pozo siga SIN regla; es la guarda de esa cifra.
 *
 * ★ Y ES LO QUE HACE EL ORIGINAL, no un apaño. Medido sobre ►HISTORY◄ en portrait: en las
 * filas 0 y 7 la regla corre ~114 px por el FLANCO y se INTERRUMPE (r0 continúa con los
 * techos de las letras, r7 queda vacío); las filas 1-6 sólo tienen tramos de 9-26 px, que es
 * texto. El juego NO cruza la regla sobre su rótulo.
 *
 * ALCANCE DECLARADO, para que nadie lea de más: esta guarda es de FUENTE. Corre en la puerta
 * pura, sin navegador, y por eso vigila la ESTRUCTURA (qué filas se pintan y cuáles no). Las
 * cifras de píxel de arriba se midieron a mano con la sonda y viven en este docblock: no las
 * re-hace el aserto. Es la misma partición declarada en #244 y #246.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const MARCO = fileURLToPath(new URL("../src/ui/shell/originalFrame.ts", import.meta.url));
const src = readFileSync(MARCO, "utf8");
// 🔴 EL BITMAP YA NO VIVE EN EL MARCO DEL SHELL. Hasta el 14-08 esta guarda leia
// `BRACKET_WHITE` de originalFrame.ts; #263 retiro esa COPIA y dejo un unico pintor
// compartido con el motor (skin/fiel/bandBracket.ts). La guarda no se entero y llevaba
// dos de sus tres asertos ROJOS en main —fuera de la puerta vitest, asi que nadie lo
// veia—, exigiendo ademas que `bracketCanvas` volviese a pintar las reglas: justo el
// defecto que #263 arreglo. Se re-apunta al sujeto vivo (#279).
const PINTOR = fileURLToPath(new URL("../src/skin/fiel/bandBracket.ts", import.meta.url));
const pintor = readFileSync(PINTOR, "utf8");

/** Lee un array de bytes declarado como `const NOMBRE ... = [0x.., ...]`. */
function bitmap(nombre: string): number[] {
  const m = pintor.match(new RegExp(`const ${nombre}[^=]*= \\[([^\\]]+)\\]`));
  if (!m) throw new Error(`no encuentro el bitmap ${nombre} — ¿lo renombraron?`);
  return m[1]!.split(",").map((s) => Number(s.trim()));
}

describe("#245 — cinta del rótulo del shell", () => {
  it("el remate deja LIBRES las filas 0 y 7, y pone sus brazos en la 1 y la 6", () => {
    const blanco = bitmap("BAND_BRACKET_WHITE");
    expect(blanco, "el glifo debe seguir siendo de 8 filas").toHaveLength(8);
    // Las filas de la CINTA: el glifo no las ocupa (en el juego las pinta el marco).
    expect(blanco[0], "fila 0 del glifo debe estar libre para la regla").toBe(0x00);
    expect(blanco[7], "fila 7 del glifo debe estar libre para la regla").toBe(0x00);
    // Los BRAZOS: adyacentes a las reglas. Esto es la coplanaridad en el descriptor —
    // si el brazo no toca la fila de la regla, el remate vuelve a flotar (#245/#246).
    expect(blanco[1], "brazo superior ausente").not.toBe(0x00);
    expect(blanco[6], "brazo inferior ausente").not.toBe(0x00);
  });

  it("las DOS reglas son del MARCO (de lado a lado), no del remate", () => {
    // 🔴 ESTE ASERTO DECÍA LO CONTRARIO Y ERA EL DEFECTO. Exigía
    // `fillRect(0,0,8,1)` / `fillRect(0,7,8,1)` dentro de `bracketCanvas`, o sea reglas
    // de UNA CELDA pintadas por el propio remate: con eso el chevron flota en mitad de
    // la banda (reporte #245) y #263 lo retiró midiendo la banda nativa de Winds — la
    // regla corre por el ANCHO DEL MARCO y el remate sólo aporta pico y muesca. Quien
    // hiciera verde el aserto viejo reintroduciría el defecto.
    expect(src, "el marco monta DOS reglas de cinta").toMatch(
      /bandRule\(false\),\s*bandRule\(true\)/,
    );
    // De lado a lado: la regla se estira a los dos flancos del panel.
    const regla = src.match(/\.u5of-rule\{([\s\S]*?)\}\s*$/m);
    expect(regla, "no encuentro la regla CSS de .u5of-rule").not.toBeNull();
    expect(regla![1]!, "la cinta debe ir de lado a lado (left:0;right:0)").toMatch(
      /left:0;\s*right:0/,
    );
    // Y el remate NO repinta las filas de la cinta: es lo que las deja empalmar.
    expect(pintor, "el remate no debe pintar la fila 0 (es del marco)").not.toMatch(
      /fillRect\([^)]*,\s*0,\s*8,\s*1\)/,
    );
  });

  it("#279 — la CINTA es el borde superior: nada de chrome propio por encima", () => {
    // Las tres mitades del arreglo de #279, cada una con el defecto que evita.
    // (a) la banda arranca en el canto: si vuelve a centrarse deja filo azul arriba y
    //     el filo del contenedor se ve como una SEGUNDA línea sobre el rótulo.
    expect(src, "la cinta debe ir pegada al canto superior").toMatch(
      /const BAND_ROW_TOP = 0;/,
    );
    // (b) el borde superior mide UNA CELDA: la cinta y nada más.
    expect(src, "el borde superior es exactamente la cinta").toMatch(
      /const BAND_H = CELL;/,
    );
    // (c) el host NO pinta anillo blanco: el filo exterior lo pone .u5of-edge por tres
    //     lados y el cuarto es la regla 0. Un box-shadow blanco aquí = doble línea.
    const host = src.match(/\.u5of-host\{[^\n]*\n?[\s\S]*?box-shadow:([^;]*);/);
    expect(host, "no encuentro el box-shadow del host").not.toBeNull();
    expect(
      host![1]!,
      "el host volvió a pintar filo blanco: eso es la doble línea de #279",
    ).not.toMatch(/EGA_WHITE|#fff/i);
    expect(src, "el filo exterior no lleva borde superior").toMatch(/border-top:0/);
  });

  it("el POZO DEL TÍTULO no lleva regla — la guarda de la decapitación medida", () => {
    // La regla del pozo se intentó con `box-shadow:inset` sobre `.u5of-title` y tapó la
    // primera fila de las letras (86 blancos de trazo -> 140 blancos / 0 negros). Decisión
    // del usuario, segunda vuelta y con las capturas delante: el pozo va SIN regla.
    // 🔴 EL PRIMER PREDICADO DE ESTE ASERTO ERA VACUO, y lo cazó el mutante sembrado (no la
    // lectura). Decía `\.u5of-title\{([^}]*)\}` — pero esto vive en un TEMPLATE LITERAL y la
    // regla contiene `${CELL}px`: la clase negada paraba en la llave de la INTERPOLACIÓN, así
    // que el grupo capturado era `display:flex;align-items:center;height:${CELL` y jamás
    // llegaba a ver la sombra. Con la decapitación sembrada el test seguía VERDE.
    // Aquí se cierra en `};` o `}` a fin de línea, que es donde acaba la regla de verdad.
    // ★ La lección, para quien toque esto: en CSS dentro de template literal, `[^}]` NO
    //   delimita una regla — `${…}` mete llaves que no son las del bloque.
    const regla = src.match(/\.u5of-title\{([\s\S]*?)\}\s*$/m);
    expect(regla, "no encuentro la regla CSS de .u5of-title").not.toBeNull();
    expect(
      regla![1]!,
      "el pozo del título volvió a llevar sombra/borde: eso DECAPITA el rótulo (#245)",
    ).not.toMatch(/box-shadow|border-top|border-bottom/);
  });
});
