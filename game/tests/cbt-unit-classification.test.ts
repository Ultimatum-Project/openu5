import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

/**
 * GUARDAS de la clasificación FIEL de unidades del `.CBT` (qué acaba siendo COMBATIENTE).
 *
 * Derivación completa en `re/notes/sprite-frame-drop-tercer-sapo-cargador.md`. Las dos
 * rutinas, leídas ENTERAS (no a fragmentos — la de `0x6506` tiene DOS fases y leerla a
 * trozos daba la respuesta contraria):
 *
 *  - `DNGLOOK.OVL 0x1291` = el cargador de los 16 slots. Identificado por sus
 *    desplazamientos PLEGADOS contra la base del registro `.CBT` (`0xad14`):
 *      [bx-0x524c] = 0xadb4 = offset 160 = fila 5 col 0 → SPRITE
 *      [bx-0x522c] = 0xadd4 = offset 192 = fila 6 col 0 → X
 *      [bx-0x520c] = 0xadf4 = offset 224 = fila 7 col 0 → Y
 *    Clasifica: `sprite==0` saltar · `<0x40` tipo 2 · `(s&0xfc)==0xb4` tipo 2 ·
 *    `(s&0xfc)==0xe8` tipo 2 · resto tipo 0 con índice `(sprite-0x40)>>2`.
 *
 *  - `ULTIMA.EXE 0x6506` = el colocador (llamado vía `DNGLOOK 0x1318`, resuelto por la
 *    regla de banda: `(0xa290 + 0xc276) & 0xFFFF`). FASE 1 = ranura de ACTOR (`0xba14`,
 *    stride 8, enemigos desde la ranura 6); **el tipo 2 se la salta entera** (`0x651d`).
 *    FASE 2 = tabla de OBJETOS (`0x5c5a`) para todos los tipos.
 *
 * ⇒ «tipo 2» = **objeto de arena**, jamás combatiente.
 */
const SRC = fileURLToPath(new URL("../src/core/combat/combat.ts", import.meta.url));
const src = readFileSync(SRC, "utf8");

/** Réplica de la clasificación fiel, para asertar sobre los datos reales. */
function isArenaObjectSprite(sprite: number): boolean {
  if (sprite < 0x40) return true;
  const family = sprite & 0xfc;
  return family === 0xb4 || family === 0xe8;
}

describe("clasificación .CBT: objetos de arena vs combatientes (DNGLOOK 0x12b2-0x12c5)", () => {
  it("los CAMPOS de la familia 0xe8 NO son combatientes (0x12c1)", () => {
    for (const s of [0xe8, 0xe9, 0xea, 0xeb]) expect(isArenaObjectSprite(s)).toBe(true);
  });

  it("la familia 0xb4 NO es combatiente (0x12b8)", () => {
    for (const s of [0xb4, 0xb5, 0xb6, 0xb7]) expect(isArenaObjectSprite(s)).toBe(true);
  });

  it("los sprites < 0x40 NO son combatientes (0x12b2)", () => {
    for (const s of [1, 2, 8, 30, 31, 60, 0x3f]) expect(isArenaObjectSprite(s)).toBe(true);
  });

  it("las familias de MONSTRUO REAL sí son combatientes (no caen en tipo 2)", () => {
    // 0x40 Dragon-base, 0x9c Ghost(i=23), 0xd8 Headless(i=36), 0xdc Daemon(i=38),
    // 0xdc+4 Dragon(i=39)=0xdc… comprobamos los usados por los censos de salas.
    for (const s of [0x40, 0x9c, 0xd8, 0xdc, 0xe0, 0xe4]) expect(isArenaObjectSprite(s)).toBe(false);
  });

  it("la familia 0xec (remolino) NO se clasifica como objeto — el binario la manda a tipo 0", () => {
    // Su índice lo sustituye la rama 0x12ea leyendo el POOL de 4 tiradas rand(0,7) contra
    // la tabla DS 0x385e (el «lectura sin inicializar» que decía este comentario está
    // REFUTADO por cuerpo: DNGLOOK 0x1273-0x128c escribe esos 4 bytes SIEMPRE — ver el
    // describe «familia 0xEC: GRUPO ALEATORIO» de abajo y re/notes/dnglook-117e-body.md).
    // NO la excluimos aquí: eso sería fabricar una regla que el binario no tiene.
    for (const s of [0xec, 0xed, 0xee, 0xef]) expect(isArenaObjectSprite(s)).toBe(false);
  });
});

describe("guardas de CONSUMIDOR: el core aplica la clasificación", () => {
  const cuerpo = src.slice(src.indexOf("private isArenaObjectSprite"), src.indexOf("private spriteToEnemyIndex"));

  it("isArenaObjectSprite existe y cita DNGLOOK", () => {
    expect(cuerpo).toContain("0x12b2");
    expect(cuerpo).toContain("sprite < 0x40");
    expect(cuerpo).toContain("0xb4");
    expect(cuerpo).toContain("0xe8");
  });

  it("el bucle de unidades de mazmorra DESCARTA los objetos antes de crear combatientes", () => {
    const loop = src.slice(src.indexOf("for (const u of this.map.units)"), src.indexOf("private shuffle"));
    expect(loop).toContain("this.isArenaObjectSprite(u.sprite)");
    expect(loop).toContain("u.sprite === 0"); // ranura vacía, DNGLOOK 0x12ab
  });

  it("la divergencia del resto %4 queda DECLARADA, no silenciada", () => {
    const desde = src.indexOf("private spriteToEnemyIndex");
    const cuerpoIdx = src.slice(desde, src.indexOf("private isActive", desde));
    expect(cuerpoIdx).toContain("DIVERGENCIA CONOCIDA");
    expect(cuerpoIdx).toContain("0x12dc"); // la cita del desplazamiento del original
  });
});

describe("impacto medido sobre los 128 combatmaps", () => {
  const maps = JSON.parse(
    readFileSync(fileURLToPath(new URL("../assets/maps/combatmaps.json", import.meta.url)), "utf8"),
  ) as Array<{ units?: Array<{ sprite: number }> }>;

  it("retira EXACTAMENTE los 26 falsos combatientes de la familia 0xe8", () => {
    const objetos = maps.flatMap((m) => (m.units ?? []).filter((u) => (u.sprite & 0xfc) === 0xe8));
    expect(objetos.length, "14 del sprite 232 + 12 del 235").toBe(26);
    // De ésos, los que ANTES pasaban el filtro viejo (resto 0) y se volvían «enemigo 42»:
    const falsosAntes = objetos.filter((u) => (u.sprite + 0x100 - 320) % 4 === 0);
    expect(falsosAntes.length, "el sprite 232 se convertía en el enemigo 42 PoisonField/x").toBe(14);
  });

  it("la familia 0xb4 no aparece en ningún mapa (la regla se deriva igual, sin efecto hoy)", () => {
    const b4 = maps.flatMap((m) => (m.units ?? []).filter((u) => (u.sprite & 0xfc) === 0xb4));
    expect(b4.length).toBe(0);
  });
});

describe("familia 0xEC: GRUPO ALEATORIO — el binario sustituye el índice por una tirada", () => {
  const maps = JSON.parse(
    readFileSync(fileURLToPath(new URL("../assets/maps/combatmaps.json", import.meta.url)), "utf8"),
  ) as Array<{ units?: Array<{ sprite: number; x: number; y: number }> }>;
  /** Réplica de la clasificación del cargador SIN la rama 0xEC (para medir qué haría sin ella). */
  const pasaElFiltroGenerico = (s: number): boolean =>
    s !== 0 && s >= 0x40 && s <= 252 && (s - 0x40) % 4 === 0 && !isArenaObjectSprite(s);

  it("el sprite base 236 PASA el %4 y NO es objeto — por eso la familia necesita rama propia", () => {
    expect((236 - 0x40) % 4).toBe(0); // pasa el resto
    expect(isArenaObjectSprite(236)).toBe(false); // y no cae en la lista de objetos
    // Sin la rama de 0xEC, el 236 entraría por el filtro genérico como (236-0x40)>>2 = 43,
    // la ranura PLACEHOLDER `Whirpool1/x` de stats cero. La rama de DNGLOOK 0x12ea existe
    // justamente para que no llegue ahí.
    expect(pasaElFiltroGenerico(236)).toBe(true);
    expect((236 - 0x40) >> 2).toBe(43);
  });

  it("CENSO de la familia en los 128 combatmaps: 144 unidades en 15 salas", () => {
    // El denominador del radio de la pieza: cuántas unidades cambian de identidad al
    // cablear el grupo aleatorio (DNGLOOK 0x1273-0x128c + 0x12ee-0x12f7).
    let salas = 0;
    let unidades = 0;
    for (const m of maps) {
      const n = (m.units ?? []).filter((u) => (u.sprite & 0xfc) === 0xec).length;
      if (n > 0) salas++;
      unidades += n;
    }
    expect(unidades, "unidades de la familia 0xEC en el corpus").toBe(144);
    expect(salas, "salas que contienen al menos una").toBe(15);
  });

  it("en cm49/50/68/69 TODO el bando enemigo lo decide la tirada (0 combatientes fuera de 0xEC)", () => {
    // Precisión que la versión anterior de este fichero se dejaba: esas salas no son «100 %
    // unidades 0xEC» —llevan además objetos de arena, sprites <0x40 y de la familia 0xe8—
    // sino que NINGÚN combatiente suyo viene de otra familia. Composición medida:
    // cm49 9 unidades = 7×0xEC + 2 objetos · cm50 16 = 14+2 · cm68 16 = 14+2 · cm69 16 = 15+1.
    for (const pos of [49, 50, 68, 69]) {
      const us = (maps[pos]!.units ?? []).filter((u) => u.sprite !== 0);
      const ec = us.filter((u) => (u.sprite & 0xfc) === 0xec);
      const otrosCombatientes = us.filter(
        (u) => (u.sprite & 0xfc) !== 0xec && pasaElFiltroGenerico(u.sprite),
      );
      expect(ec.length, `cm${pos} tiene unidades 0xEC`).toBeGreaterThan(0);
      expect(
        otrosCombatientes.length,
        `cm${pos}: ningún combatiente fuera de la familia 0xEC ⇒ su bando enemigo entero sale del grupo aleatorio`,
      ).toBe(0);
    }
  });

  it("los CUATRO slots del pool se consumen: 236×84 · 237×56 · 238×3 · 239×1", () => {
    // Reproduce la tabla de `re/notes/0xec-mecanismo-derivado.md` §3 desde los datos, como
    // control cruzado. El grueso del efecto está en la pareja 236/237 —la distinción que el
    // port borraba tratando el 237 igual que el 236— pero los slots 2 y 3 también se leen.
    const cuenta = new Map<number, number>();
    for (const m of maps) {
      for (const u of m.units ?? []) {
        if ((u.sprite & 0xfc) === 0xec) cuenta.set(u.sprite, (cuenta.get(u.sprite) ?? 0) + 1);
      }
    }
    expect(Object.fromEntries([...cuenta].sort((a, b) => a[0] - b[0]))).toEqual({
      236: 84,
      237: 56,
      238: 3,
      239: 1,
    });
  });

  it("NO-REGRESIÓN: cm71 (16 Ghost, la sala que SÍ se gana) no tiene ninguna 0xEC", () => {
    const us = (maps[71]!.units ?? []).filter((u) => u.sprite !== 0);
    expect(us.length).toBe(16);
    expect(us.filter((u) => (u.sprite & 0xfc) === 0xec).length).toBe(0);
  });

  it("la tabla del grupo aleatorio está en el core VERBATIM del binario (DATA.OVL 0x386e)", () => {
    // `14 15 16 22 21 18 1f 18`, volcada con xxd de DATA.OVL fileoff 0x386e = DS 0x385e.
    expect(src).toContain("[0x14, 0x15, 0x16, 0x22, 0x21, 0x18, 0x1f, 0x18]");
    expect(src).toContain("0x385e"); // la cita de la tabla
    expect(src).toContain("EC_FAMILY");
  });
});
