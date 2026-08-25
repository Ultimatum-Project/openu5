/**
 * MODELO DE REFERENCIA DEL PASE DE VISIBILIDAD DEL ORIGINAL — la TRANSCRIPCIÓN, sin
 * asertos. Los controles que dicen si este modelo se puede creer viven en el fichero
 * hermano `visibility-original-referencia.test.ts`, y su cabecera es de lectura
 * OBLIGATORIA antes de usar cualquier cifra que salga de aquí.
 *
 * POR QUÉ ESTÁ PARTIDO EN DOS (#256). Hasta el 16-08 estas funciones vivían dentro del
 * `.test.ts` y se exportaban desde ahí. Importar un `.test.ts` EJECUTA su suite dentro de
 * la del importador (ficha #240: 80 tests fantasma en la batería por esa vía), así que
 * cualquier instrumento que quisiera medir con el modelo —la sonda de alcance de #256,
 * por ejemplo— o duplicaba la transcripción o contaminaba el cardinal. Un modelo
 * duplicado es dos modelos que divergen en silencio, que es exactamente lo que este
 * fichero existe para impedir.
 *
 * ★ LAS TABLAS ESTÁN COPIADAS A PROPÓSITO, no importadas de `core/world/visibility.ts`.
 * Este modelo mide AL PORT: si tomara del port su tabla de opacidad o su tabla radial, un
 * error en ellas sería invisible para la comparación (los dos lados moverían a la vez).
 * La duplicación es el instrumento, no un descuido — no la «arregles» importando.
 *
 * TRANSCRIPCIÓN (citas de re/disasm/ULTIMA.EXE.asm, verificadas leyendo el cuerpo):
 *   0x5E4A  colector de emisores del CHUNK 32x32 en coordenadas de MAPA (5e72-5ee9)
 *           → un flood por emisor con origen `emisor − 5` (5f09/5f1d `sub ax,5`) y
 *           radio 10 (5f3f `mov ax,0xa`) hacia el buffer de luces 0xAD14.
 *   0x5D0A  siembra las 121 celdas del destino 0xAB02 a 0xFF (5d17-5d27) y llama a
 *           0x5A28 con el centinela 0xff91 (5d52) = modo PASE DE LA PARTY.
 *   0x5A28  modo 1. DENTRO del radio (5bd9 `cmp ax,[bp+0x10]`, umbral light+1) la
 *           celda es visible y propaga si es transparente.
 *           🔴 LAS DOS RAMAS DE FUERA DEL RADIO ESTABAN INTERCAMBIADAS en la
 *           transcripción de #256 (y en §3 del acta #350): la polaridad de 0x5DFE
 *           es 1 = DEJA PASAR (0x402 es memchr — `0418 repne scasb`, halla → ptr≠0;
 *           0x5DFE lo mapea hallado→0 en 5e2a, no-hallado→1 en 5e25), así que el
 *           `jne 0x5c52` de 5c03 lo toma la TRANSPARENTE. Corregida por la
 *           derivación del resplandor (re/notes/resplandor-350-derivacion.md,
 *           validada 726/726 celdas contra la RAM de #350):
 *           FUERA del radio y TRANSPARENTE (5c52-5c91): visible ⟺ la PROPIA está
 *           en 0xAD14 (5c8c), SIN mirar al padre; decidida en los dos sentidos
 *           (5c93 tile / 5c74 cero) — y EMPUJADA IGUAL aunque quede oculta: el
 *           push (5ca1-5cd8) decide con 0x5DFE sobre [bp-0x214], que 5c74 no
 *           toca y conserva el TILE. Ése es el RESPLANDOR A DISTANCIA: el flood
 *           recorre la región transparente alcanzable aunque esté a oscuras y
 *           enciende por sí sola cada celda iluminada que toca.
 *           FUERA del radio y OPACA (5c05-5c45): visible ⟺ el PADRE ≠ 0 (5c14) Y
 *           el PADRE está en 0xAD14 (5c29) Y la PROPIA está en 0xAD14 (5c40). Si
 *           no, 5c47 escribe 0xFF — el centinela de NO DECIDIDA, no de oculta: la
 *           celda vuelve a intentarse desde OTRO vecino (sin empujar: 0xFF está
 *           en la tabla de opacas y el push lo descarta). Ese REINTENTO está
 *           modelado abajo.
 *           (En régimen de CONTACTO las dos lecturas coinciden — por eso #256 y
 *           las 15.360 posiciones de su sonda no podían ver la inversión, y sólo
 *           la delató el islote a distancia de #350.)
 */

/** Lado de la ventana de juego (11×11) y centro, en local para no depender del port. */
export const WINDOW = 11;
export const CENTER = 5;

/** Tabla radial 6×6 (DATA.OVL 0x6AB8) — transcrita, NO importada (ver cabecera). */
const RAD: readonly number[] = [
  50, 41, 34, 29, 26, 25, 41, 32, 25, 20, 17, 16, 34, 25, 18, 13, 10, 9,
  29, 20, 13, 8, 5, 4, 26, 17, 10, 5, 2, 1, 25, 16, 9, 4, 1, 0,
];
export const radialOff = (adx: number, ady: number): number =>
  adx > CENTER || ady > CENTER ? 51 : RAD[CENTER - adx + 6 * (CENTER - ady)]!;

const OPAQUE = new Set([
  0x09, 0x0a, 0x0c, 0x0d, 0x4d, 0x4e, 0x4f, 0x5a, 0x97, 0xb8, 0xb9, 0xbc, 0xd0,
  0xd1, 0xd2, 0xd3, 0xf8, 0xfe, 0xff,
]);
const VISOR = new Set([0x4a, 0x4b, 0xba, 0xbb, 0x98]);
/** 0x5DFE: ¿corta la vista? Se exporta para que el control positivo del `.test.ts`
 *  pueda escribir la regla REFUTADA sin volver a copiar las dos tablas. */
export const bloquea = (t: number, radial: number): boolean =>
  OPAQUE.has(t & 0xff) ? true : VISOR.has(t & 0xff) ? radial !== 1 : false;
const blocks = bloquea;

export const EMITTERS = new Set([0xdc, 0xbd, 0xbe, 0xb2, 0xde, 0xbf, 0xb0, 0xb1, 0xb3, 0xbc]);
const EMIT_R = 10;

const N8: readonly (readonly [number, number])[] = [
  [1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1],
];

export type Mapa = (x: number, y: number) => number;

/**
 * Flood de 0x5A28 en un marco 11×11 centrado en (cx,cy). Claves "dcol,drow".
 * ★ El orden de vecinos de aquí NO es el del binario (que recorre el PERÍMETRO, tabla de
 * saltos 5b16). Es deliberado: el port sí usa el perímetro, así que la coincidencia entre
 * los dos es a la vez el careo del resultado y el control de que el conjunto alcanzable no
 * depende del orden del anillo.
 */
export function floodAt(cx: number, cy: number, light: number, at: Mapa): Set<string> {
  const seen = new Set<string>(["0,0"]);
  const q: [number, number][] = [[0, 0]];
  for (let h = 0; h < q.length; h++) {
    const [dx, dy] = q[h]!;
    for (const [ox, oy] of N8) {
      const nx = dx + ox;
      const ny = dy + oy;
      if (Math.abs(nx) > CENTER || Math.abs(ny) > CENTER) continue;
      const k = `${nx},${ny}`;
      if (seen.has(k)) continue;
      const r = radialOff(Math.abs(nx), Math.abs(ny));
      if (r > light) continue;
      seen.add(k);
      if (!blocks(at(cx + nx, cy + ny), r)) q.push([nx, ny]);
    }
  }
  return seen;
}

/** 0xAD14: celdas del MAPA iluminadas, barriendo emisores en `[-sweep,+sweep]`. */
export function buildLightBuffer(at: Mapa, px: number, py: number, sweep: number): Set<string> {
  const lit = new Set<string>();
  for (let my = py - sweep; my <= py + sweep; my++)
    for (let mx = px - sweep; mx <= px + sweep; mx++) {
      if (!EMITTERS.has(at(mx, my) & 0xff)) continue;
      for (const k of floodAt(mx, my, EMIT_R, at)) {
        const [dx, dy] = k.split(",").map(Number);
        lit.add(`${mx + dx!},${my + dy!}`);
      }
    }
  return lit;
}

/**
 * Pase de la party del ORIGINAL (0x5A28 modo 1), con el reintento del 0xFF y el
 * RESPLANDOR (corregido por la derivación de #350: ramas de fuera-del-radio
 * intercambiadas + encolado de las transparentes ocultas — ver cabecera).
 */
export function originalWindow(
  light: number,
  at: Mapa,
  px: number,
  py: number,
  lit: Set<string>,
): Uint8Array {
  const UND = 0, HID = 1, VIS = 2;
  const st = new Uint8Array(WINDOW * WINDOW).fill(UND);
  const idx = (c: number, r: number): number => r * WINDOW + c;
  st[idx(CENTER, CENTER)] = VIS;
  const q: [number, number][] = [[CENTER, CENTER]];
  for (let h = 0; h < q.length; h++) {
    const [pc, pr] = q[h]!;
    // 5c14 lee el byte del PADRE en el buffer: ≠0 ⟺ decidido VISIBLE (una celda
    // encolada nunca sigue en 0xFF: se decide en la misma visita que la empuja).
    const padreVisible = st[idx(pc, pr)] === VIS;
    const padreEnBuffer = lit.has(`${px - CENTER + pc},${py - CENTER + pr}`);
    for (const [ox, oy] of N8) {
      const c = pc + ox;
      const r = pr + oy;
      if (c < 0 || r < 0 || c >= WINDOW || r >= WINDOW) continue;
      if (st[idx(c, r)] !== UND) continue; // 0xFF re-intenta desde otro vecino
      const rad = radialOff(Math.abs(c - CENTER), Math.abs(r - CENTER));
      const tile = at(px - CENTER + c, py - CENTER + r);
      const propiaEnBuffer = lit.has(`${px - CENTER + c},${py - CENTER + r}`);
      if (rad <= light) {
        st[idx(c, r)] = VIS;
        if (!blocks(tile, rad)) q.push([c, r]);
        continue;
      }
      if (!blocks(tile, rad)) {
        // 5c52-5c91: TRANSPARENTE fuera del radio — la PROPIA sola (5c8c), sin
        // padre; decide en los dos sentidos (5c93/5c74)…
        st[idx(c, r)] = propiaEnBuffer ? VIS : HID;
        // …y EMPUJA TAMBIÉN LA OCULTA (el push evalúa el TILE, no el byte
        // escrito): el resplandor a distancia.
        q.push([c, r]);
        continue;
      }
      // 5c05-5c45: OPACA fuera del radio — padre≠0 Y padre lit Y propia lit;
      // si falla, 5c47 deja 0xFF (reintentable) y no empuja.
      if (padreVisible && padreEnBuffer && propiaEnBuffer) st[idx(c, r)] = VIS;
    }
  }
  return st.map((v) => (v === VIS ? 1 : 0));
}

/** Muestreador de ventana: coordenadas de VENTANA → coordenadas de MAPA. */
export const win = (at: Mapa, px: number, py: number) => (c: number, r: number) =>
  at(px - CENTER + c, py - CENTER + r);
