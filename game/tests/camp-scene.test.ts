/**
 * Escena de ACAMPADA (H)ole up & camp — derivación pura de la formación del party +
 * ronda del guardia + hook del bardo. La formación NO es una tabla horneada: es el
 * `playerStarts["south"]` de la arena CampFire (lo que el kernel carga en runtime;
 * 0x256e→0x60ec→0x6936/0x6a52). Estos tests la pasan por `input.formation` y blindan:
 * el gate a overworld a pie, el salto de los muertos, el durmiente tumbado (0x11e), la
 * ronda del guardia (puesto ↔ vecino HORARIO, medido (6,4)↔(6,5) en CAMP.mov) y el bardo.
 * Autoridad: re/notes/camp-scene-kernel.md + testigo CAMP.mov (arena CampFire idx 0).
 */
import { describe, expect, it } from "vitest";
import { CAMP_FIRE_CELL as CORE_CAMP_FIRE_CELL } from "../src/core/world/camp.js";
import {
  buildCampScene,
  CAMP_FIRE_CELL,
  CAMP_SLEEPER_TILE,
  CAMP_BARD_PLAYING_TILE,
  CAMP_BARD_SEED,
  campBardActor,
  type CampSceneInput,
} from "../src/skin/campScene.js";

/**
 * playerStarts["south"] de la arena CampFire (game/assets/maps/combatmaps.json idx 0),
 * en coords de arena {col,row}, por índice de miembro. Los 3 primeros — (6,6),(4,4),(6,4)
 * — están MEDIDOS en CAMP.mov (party de 3: durmientes en (6,6)/(4,4), guardia en (6,4)).
 */
const SOUTH_STARTS: readonly { col: number; row: number }[] = [
  { col: 6, row: 6 }, { col: 4, row: 4 }, { col: 6, row: 4 },
  { col: 4, row: 6 }, { col: 5, row: 3 }, { col: 3, row: 5 },
];

/** Party de N miembros vivos (status 'G', clase 'A'), tile = 100+idx para distinguirlos. */
function party(n: number): CampSceneInput["members"] {
  return Array.from({ length: n }, (_, i) => ({ status: "G", tile: 100 + i, charClass: "A" }));
}

/** Entrada por defecto: acampando en overworld a pie, formación = south starts, sin guardia. */
function input(over: Partial<CampSceneInput> & { members: CampSceneInput["members"] }): CampSceneInput {
  return {
    active: true,
    overworldFoot: true,
    formation: SOUTH_STARTS,
    partySize: over.members.length,
    guardIdx: -1,
    guardCell: null,
    songPhase: false,
    ...over,
  };
}

describe("campScene — gate de activación", () => {
  it("null cuando no se acampa (active=false)", () => {
    expect(buildCampScene(input({ active: false, members: party(3) }))).toBeNull();
  });
  it("null fuera del overworld a pie (mazmorra/pueblo/combate)", () => {
    expect(buildCampScene(input({ overworldFoot: false, members: party(3) }))).toBeNull();
  });
  it("monta la escena en overworld a pie acampando", () => {
    const scene = buildCampScene(input({ members: party(3) }));
    expect(scene).not.toBeNull();
    expect(scene!.members).toHaveLength(3);
  });
});

describe("campScene — formación = playerStarts south de la arena (medida en CAMP.mov)", () => {
  it("hoguera en (5,5), tile 179", () => {
    const scene = buildCampScene(input({ members: party(1) }))!;
    expect(scene.fire).toEqual({ col: 5, row: 5, tile: 179 });
  });

  it("los 3 miembros medidos caen en (6,6),(4,4),(6,4) = south[0..2]", () => {
    const scene = buildCampScene(input({ members: party(3) }))!;
    expect([scene.members[0]!.col, scene.members[0]!.row]).toEqual([6, 6]);
    expect([scene.members[1]!.col, scene.members[1]!.row]).toEqual([4, 4]);
    expect([scene.members[2]!.col, scene.members[2]!.row]).toEqual([6, 4]);
  });

  for (let n = 1; n <= 6; n++) {
    it(`party de ${n} SIN guardia: todos tumbados (0x11e) en formation[idx]`, () => {
      const scene = buildCampScene(input({ members: party(n) }))!;
      expect(scene.members).toHaveLength(n);
      scene.members.forEach((m, idx) => {
        expect(m.charIdx).toBe(idx);
        expect(m.col).toBe(SOUTH_STARTS[idx]!.col);
        expect(m.row).toBe(SOUTH_STARTS[idx]!.row);
        expect(m.tile).toBe(CAMP_SLEEPER_TILE); // durmiente tumbado
        expect(m.guard).toBe(false);
        expect(m.bard).toBe(false);
      });
    });
  }

  it("acota a la longitud de la formación aunque partySize sea mayor", () => {
    const scene = buildCampScene(input({ members: party(6), partySize: 8 }))!;
    expect(scene.members).toHaveLength(6);
  });
});

describe("campScene — guardia: pasea entre puesto y vecino horario + sprite", () => {
  it("hora par → el guardia está en SU puesto (su slot de formación)", () => {
    // guardIdx=2 → slot 2 = (6,4). En hora par (0) está ahí (medido en CAMP.mov).
    const scene = buildCampScene(input({ members: party(3), guardIdx: 2, guardCell: null }))!;
    const guard = scene.members[2]!;
    expect(guard.guard).toBe(true);
    expect(guard.tile).toBe(102); // sprite de clase (no bardo)
    expect([guard.col, guard.row]).toEqual([6, 4]);
    // Los durmientes idx 0,1 en sus slots (6,6),(4,4), tumbados.
    expect([scene.members[0]!.col, scene.members[0]!.row]).toEqual([6, 6]);
    expect([scene.members[1]!.col, scene.members[1]!.row]).toEqual([4, 4]);
    expect(scene.members[0]!.tile).toBe(CAMP_SLEEPER_TILE);
  });

  // Los TRES casos que vivían aquí (oscilación par/impar, «siempre en el anillo», puesto
  // fuera del anillo) FIJABAN EL DEFECTO: exigían que la celda del vigía se derivara de la
  // PARIDAD DE LA HORA con `campGuardPatrolCell`, que alternaba dos celdas fijas sin tirar
  // dados. Esa función ya no existe: el paseo es aleatorio (dos tiradas + dos guardas) y lo
  // calcula el NÚCLEO (`campGuardWalk`, cubierto en camp-guard-walk.test.ts). Aquí sólo
  // queda lo que le toca a la piel: LEER la celda que le den.
  it("la escena COLOCA al vigía en la celda que recibe, sin derivarla de nada", () => {
    const scene = buildCampScene(input({ members: party(3), guardIdx: 2, guardCell: { col: 3, row: 7 } }))!;
    const guard = scene.members.find((m) => m.guard)!;
    expect([guard.col, guard.row]).toEqual([3, 7]);
  });

  it("sin celda de vigía (null) se queda en su puesto de formación (defensivo)", () => {
    const scene = buildCampScene(input({ members: party(3), guardIdx: 2, guardCell: null }))!;
    const guard = scene.members.find((m) => m.guard)!;
    expect([guard.col, guard.row]).toEqual([6, 4]); // south[2]
  });

  it("guardIdx=-1 (nadie vela) ⇒ ningún guardia; todos duermen", () => {
    const scene = buildCampScene(input({ members: party(3), guardIdx: -1 }))!;
    expect(scene.members.every((m) => !m.guard && m.tile === CAMP_SLEEPER_TILE)).toBe(true);
  });
});

describe("campScene — easter egg de Iolo DOS FASES (witness-derived CAMP_IOLO_MUSICA.mov)", () => {
  const iolo = () => [
    { status: "G", tile: 100, charClass: "A" },
    { status: "G", tile: 101, charClass: "B" }, // Iolo bardo
  ];

  it("FASE 1 (songPhase): el vigía-bardo TOCA (tile 0x15c, bard, QUIETO en su puesto)", () => {
    const scene = buildCampScene(input({ members: iolo(), guardIdx: 1, songPhase: true, guardCell: null }))!;
    const guard = scene.members[1]!;
    expect(guard.bard).toBe(true);
    expect(guard.tile).toBe(CAMP_BARD_PLAYING_TILE);
    // Quieto en su slot south[1]=(4,4), NO patrulla (aunque hour sea impar).
    expect([guard.col, guard.row]).toEqual([4, 4]);
  });

  it("FASE 2 (songPhase=false): el mismo bardo VELA normal (sprite de clase, patrulla, bard=false)", () => {
    const scene = buildCampScene(input({ members: iolo(), guardIdx: 1, songPhase: false, guardCell: null }))!;
    const guard = scene.members[1]!;
    expect(guard.bard).toBe(false);
    expect(guard.tile).toBe(101); // su sprite de clase, no el laúd
    expect([guard.col, guard.row]).toEqual([4, 4]); // hora par → en su puesto
  });

  it("vigía NO bardo en fase canción → sprite de clase, bard=false (la canción no le aplica)", () => {
    const scene = buildCampScene(input({ members: party(2), guardIdx: 0, songPhase: true }))!;
    expect(scene.members[0]!.bard).toBe(false);
    expect(scene.members[0]!.tile).toBe(100);
  });

  it("bardo que DUERME (no es el vigía) NO toca ni en fase canción", () => {
    const members = [
      { status: "G", tile: 100, charClass: "B" }, // bardo durmiendo
      { status: "G", tile: 101, charClass: "A" },
    ];
    const scene = buildCampScene(input({ members, guardIdx: 1, songPhase: true }))!;
    expect(scene.members[0]!.bard).toBe(false);
    expect(scene.members[0]!.tile).toBe(CAMP_SLEEPER_TILE);
  });

  it("DISCRIMINANTE de pureza: la fase canción SÓLO cambia al vigía-bardo; durmientes y hoguera idénticos", () => {
    const on = buildCampScene(input({ members: iolo(), guardIdx: 1, songPhase: true, guardCell: null }))!;
    const off = buildCampScene(input({ members: iolo(), guardIdx: 1, songPhase: false, guardCell: null }))!;
    expect(on.fire).toEqual(off.fire); // hoguera: sin cambio
    // Durmiente idx 0: idéntico en ambas fases (la canción es del vigía, no del que duerme).
    expect(on.members.find((m) => m.charIdx === 0)).toEqual(off.members.find((m) => m.charIdx === 0));
    // Sólo difiere el vigía-bardo (idx 1): tile/bard.
    const gOn = on.members.find((m) => m.charIdx === 1)!;
    const gOff = off.members.find((m) => m.charIdx === 1)!;
    expect(gOn.bard).not.toBe(gOff.bard);
    expect(gOn.tile).not.toBe(gOff.tile);
  });
});

describe("campScene — muertos", () => {
  it("los muertos (status 'D') se saltan dejando su hueco (0x69e1 skip)", () => {
    const members: CampSceneInput["members"] = [
      { status: "G", tile: 100, charClass: "A" },
      { status: "D", tile: 101, charClass: "F" },
      { status: "G", tile: 102, charClass: "A" },
      { status: "P", tile: 103, charClass: "A" },
    ];
    const scene = buildCampScene(input({ members }))!;
    expect(scene.members.map((m) => m.charIdx)).toEqual([0, 2, 3]);
    const m2 = scene.members.find((m) => m.charIdx === 2)!;
    expect([m2.col, m2.row]).toEqual([6, 4]); // idx 2 en su slot south[2], no compacta
  });
});

describe("campScene — formación vacía (arena sin recursos / mock)", () => {
  it("sin formación ⇒ sin miembros, pero la hoguera se pinta", () => {
    const scene = buildCampScene(input({ members: party(3), formation: [] }))!;
    expect(scene.members).toHaveLength(0);
    expect(scene.fire.tile).toBe(179);
  });
});

describe("campScene — pureza (pintar no muta el core, patrón #71)", () => {
  it("dos derivaciones devuelven objetos equivalentes y frescos", () => {
    const inp = input({ members: party(4), guardIdx: 2, guardCell: null });
    const a = buildCampScene(inp)!;
    const b = buildCampScene(inp)!;
    expect(a).toEqual(b);
    expect(a).not.toBe(b);
    expect(a.members).not.toBe(b.members);
  });

  it("no muta la entrada", () => {
    const inp = input({ members: party(3), guardIdx: 0, guardCell: null });
    const snapshot = JSON.stringify(inp);
    buildCampScene(inp);
    buildCampScene(inp);
    expect(JSON.stringify(inp)).toBe(snapshot);
  });
});

/**
 * ANIMACIÓN del bardo — el eslabón que estaba SIN DERIVAR (`camp-scene-kernel.md §6/§7`
 * lo dejó como «residuo no-bloqueante») y que el usuario reportó como sprite ESTÁTICO.
 * Está en CMDS.OVL 0x0113-0x012d + 0x014f-0x01ad; ver `re/notes/camp-bard-anim.md`.
 */
describe("campScene — el bardo SE ANIMA (CMDS.OVL 0x017c-0x018c)", () => {
  const iolo = () => [
    { status: "G", tile: 100, charClass: "A" },
    { status: "G", tile: 101, charClass: "B" }, // Iolo bardo
  ];

  it("el tile sembrado es 0x15f, el byte que el asm escribe (`b05f mov al,0x5f`)", () => {
    // NO 0x15c: 0x5c es la BASE del grupo (`[reg+0]&0xfc`, gate del motor de sonido
    // 0x4207), pero el byte ESCRITO en los dos campos de anim es 0x5f (0x017c/0x0181).
    expect(CAMP_BARD_PLAYING_TILE).toBe(0x15f);
    expect(CAMP_BARD_SEED).toBe(0x5f);
    expect(CAMP_BARD_SEED & 0xfc).toBe(0x5c); // la base del programa sigue siendo 0x5c
  });

  it("campBardActor da el actor sintético (id estable, tile, semilla y celda del vigía)", () => {
    const scene = buildCampScene(input({ members: iolo(), guardIdx: 1, songPhase: true, guardCell: null }))!;
    const a = campBardActor(scene)!;
    expect(a).toEqual({ id: "camp-bard", tile: 0x15f, seed: 0x5f, col: 4, row: 4 });
  });

  it("sin fase canción (o sin vigía-bardo) NO hay actor que animar", () => {
    const fase2 = buildCampScene(input({ members: iolo(), guardIdx: 1, songPhase: false, guardCell: null }))!;
    expect(campBardActor(fase2)).toBeNull();
    const sinBardo = buildCampScene(input({ members: party(2), guardIdx: 0, songPhase: true }))!;
    expect(campBardActor(sinBardo)).toBeNull();
    expect(campBardActor(null)).toBeNull();
  });
});

// La celda de la HOGUERA está DUPLICADA a los dos lados de la frontera core↔piel: la piel
// la pinta, y `Game` la necesita para la guarda de casilla libre del paseo del vigía. No es
// descuido — `skin-import-guard` PROHÍBE que una piel alcance el core en runtime (sólo por
// tipos), así que compartir la constante por import está vetado por diseño. Lo que hace que
// la duplicación no sea deuda es este test: si las dos copias divergen, se pone rojo.
describe("coherencia core↔piel de la celda de hoguera", () => {
  it("CAMP_FIRE_CELL de la piel y la del núcleo son la MISMA celda", () => {
    expect({ col: CAMP_FIRE_CELL.col, row: CAMP_FIRE_CELL.row })
      .toEqual({ col: CORE_CAMP_FIRE_CELL.col, row: CORE_CAMP_FIRE_CELL.row });
  });
});
