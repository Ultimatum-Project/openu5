/**
 * Fabricación de SAVED.GAM nativos para las CAPTURAS del usuario en DOSBox (carril
 * tools/dosbox-saves). Un .gam por escena, listo-para-jugar: el usuario sólo copia el
 * fichero a original/u5/play/SAVED.GAM y hace J)ourney Onward.
 *
 * MÉTODO (idéntico al del Grand Tour): plantilla = el SAVED.GAM de REFERENCIA del
 * original (party sana de 3, a pie, 16 llaves / 15 antorchas, 717 oro) →
 * parseSaveWindow → createNewGame → se MUTA el estado por escena → exportNativeSave →
 * se escribe .gam + .sidecar.json en original/capturas-saves/. Cada save se VALIDA
 * re-importándolo con importNativeSave (loader nativo del port) y comprobando
 * posición/inventario/flags.
 *
 * Coordenadas y flags DERIVADOS de los datos del propio port (data.json, mapas,
 * TileData) y de re/verified/{shrines,endgame,dungeon}.md — citados en cada escena.
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  exportNativeSave,
  importNativeSave,
  parseSaveWindow,
  SAVED_GAM_SIZE,
} from "../../src/core/saveNative.js";
import { createNewGame, type GameState } from "../../src/core/state.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, "..", "..", ".."); // worktree root
const TEMPLATE_PATH = join(REPO, "original/u5/ultima5/SAVED.GAM"); // REFERENCIA (solo lectura)
const OUT_DIR = join(REPO, "original/capturas-saves");

/** Tabla de objetos activa (0x6B4): 32 slots × 8 B. Slot 0 = avatar. */
const OBJECT_TABLE_OFFSET = 0x6b4;

/** Pone a foot + hora diurna (12:00) — party sana, sin curfew de town, sin runtime naval. */
function baseScene(state: GameState): void {
  state.transport = "foot";
  state.transportTile = 0x1c; // avatar a pie (world/transport.ts)
  state.time.hour = 12;
  state.time.minute = 0;
  // Party sana: la referencia ya trae 3 miembros status 'G' a HP lleno; reafirmamos.
  for (let i = 0; i < state.partySize; i++) {
    const c = state.characters[i]!;
    c.status = "G";
    c.currentHp = c.maxHp;
  }
  // Antorchas/llaves "de sobra" (la referencia ya trae 15/16; garantizamos mínimos).
  if (state.torches < 10) state.torches = 20;
  if (state.keys < 10) state.keys = 20;
}

interface Scene {
  name: string;
  desc: string;
  mutate: (s: GameState) => void;
  /** Limpia los slots 1..31 de la tabla de objetos tras exportar (towns: el DOS
   *  recarga NPCs frescos por loc, así que la tabla heredada de la plantilla —loc 17—
   *  se anula para no filtrar sus NPCs). */
  clearObjectTable?: boolean;
  /** Aserciones extra sobre el estado re-importado. */
  check?: (s: GameState) => void;
}

const scenes: Scene[] = [
  {
    name: "doom-con-caja",
    desc: "Underworld, party sobre la entrada de Doom (128,128) CON Sandalwood Box",
    // Doom: entrada en el UNDERWORLD (data.json locationsX/Y[39]=128,128; tile 22 en
    // underworld.json). location=0 + floor=0xFF = underworld (map.ts). woodenBox=Sandalwood
    // Box (re/verified/endgame.md §rama de la caja, .gam 0x219).
    mutate: (s) => {
      s.position = { location: 0, floor: 0xff, x: 128, y: 128 };
      s.specialItems.woodenBox = true;
    },
    check: (s) => {
      assert(s.position.floor === 0xff && s.position.x === 128 && s.position.y === 128, "pos Doom");
      assert(s.specialItems.woodenBox === true, "woodenBox=true");
    },
  },
  {
    name: "doom-sin-caja",
    desc: "Underworld, party sobre la entrada de Doom (128,128) SIN Sandalwood Box",
    mutate: (s) => {
      s.position = { location: 0, floor: 0xff, x: 128, y: 128 };
      s.specialItems.woodenBox = false;
    },
    check: (s) => {
      assert(s.position.floor === 0xff && s.position.x === 128 && s.position.y === 128, "pos Doom");
      assert(s.specialItems.woodenBox === false, "woodenBox=false");
    },
  },
  {
    name: "santuario-post-codex",
    desc: "Junto al Shrine of Honesty (233,66), estado POST-Codex (8 lecciones), 717 oro",
    // Shrine of Honesty en (233,66) surface (data.json shrineX/Y[0]). El santuario se
    // dispara ON-STEP (game.ts checkShrineEntry): party al NORTE en (233,65)=Forest2,
    // el usuario pisa al SUR. shrineVisitedBitmap=0xFF = las 8 lecciones del Codex
    // aprendidas (state.ts: 0xFF → ceremonia final / post-Codex). Oro≥200 para donar.
    mutate: (s) => {
      s.position = { location: 0, floor: 0, x: 233, y: 65 };
      s.shrineVisitedBitmap = 0xff;
      s.shrineQuestBitmap = 0x00;
      if (s.gold < 200) s.gold = 500;
    },
    check: (s) => {
      assert(s.position.location === 0 && s.position.x === 233 && s.position.y === 65, "pos shrine");
      assert(s.shrineVisitedBitmap === 0xff, "shrineVisited=0xFF");
      assert(s.gold >= 200, "gold>=200");
    },
  },
  {
    name: "blackthorn-insignia",
    desc: "Dentro del Palacio de Blackthorn (loc 18), en la puerta (15,30), CON la Insignia",
    // Palace_of_Blackthorn = loc 18 (smallmaps id 18). Entrada estándar de town
    // (game.ts SMALL_MAP_ENTRY 15,30) en floor 0 (z=0, planta baja de la puerta con
    // guardias). blackBadge = Insignia (.gam 0x218). El usuario prueba (U)se con/sin.
    mutate: (s) => {
      s.position = { location: 18, floor: 0, x: 15, y: 30 };
      s.specialItems.blackBadge = true;
    },
    clearObjectTable: true,
    check: (s) => {
      assert(s.position.location === 18 && s.position.x === 15 && s.position.y === 30, "pos Blackthorn");
      assert(s.specialItems.blackBadge === true, "blackBadge=true");
    },
  },
  {
    name: "combate-huida",
    desc: "Overworld en campo abierto (85,108) cerca de Britain — provocar encuentro y huir por el borde",
    // APROXIMACIÓN (marcada): el combate de U5 se entra por encuentro ALEATORIO (mapa de
    // combate aparte); no es fabricable como estado de save. Se deja la party a pie en
    // terreno abierto propenso a encuentros (85,108 Path2, 8/9 vecinos pisables) para que
    // el usuario camine hasta un encuentro y capture la HUIDA por el borde del mapa de combate.
    mutate: (s) => {
      s.position = { location: 0, floor: 0, x: 85, y: 108 };
    },
    check: (s) => {
      assert(s.position.location === 0 && s.position.floor === 0, "pos overworld");
      assert(s.position.x === 85 && s.position.y === 108, "pos campo");
    },
  },
  {
    name: "shrine-meditacion",
    desc: "Junto al Shrine of Honesty (233,66) con quest ACTIVA (pre-Codex) — meditar (Enter+mantra)",
    // Mismo santuario (233,66); party al norte (233,65) para pisar al sur. quest ACTIVA:
    // shrineQuestBitmap bit0 (Honesty=virtud 0) = 0x01 (state.ts g_shrine_quest_bitmap).
    // shrineVisitedBitmap=0 (pre-Codex). Mantra de Honesty = "Ahm" (data.json mantras[0]).
    mutate: (s) => {
      s.position = { location: 0, floor: 0, x: 233, y: 65 };
      s.shrineQuestBitmap = 0x01;
      s.shrineVisitedBitmap = 0x00;
    },
    check: (s) => {
      assert(s.position.x === 233 && s.position.y === 65, "pos shrine");
      assert(s.shrineQuestBitmap === 0x01, "shrineQuest=0x01");
      assert(s.shrineVisitedBitmap === 0x00, "shrineVisited=0x00");
    },
  },
  {
    name: "troll-peaje",
    desc: "Overworld a un paso del puente de trolls (53,24) — cruzar para el prompt del peaje",
    // Puente de trolls en (53,24) surface (tile 106 TrollBridgeHoriz). Party a un paso al
    // OESTE en (52,24)=Grass; el usuario pisa al ESTE sobre el puente para el prompt del peaje.
    mutate: (s) => {
      s.position = { location: 0, floor: 0, x: 52, y: 24 };
    },
    check: (s) => {
      assert(s.position.location === 0 && s.position.floor === 0, "pos overworld");
      assert(s.position.x === 52 && s.position.y === 24, "pos junto al puente");
    },
  },
];

function assert(cond: boolean, msg: string): void {
  if (!cond) throw new Error("ASERCIÓN FALLIDA: " + msg);
}

function main(): void {
  const template = new Uint8Array(readFileSync(TEMPLATE_PATH));
  if (template.length < SAVED_GAM_SIZE) throw new Error("plantilla corta: " + template.length);
  mkdirSync(OUT_DIR, { recursive: true });

  console.log("Plantilla:", TEMPLATE_PATH, "(" + template.length + " B)\n");
  for (const scene of scenes) {
    // Estado fresco desde la plantilla + mutación de escena.
    const state = createNewGame(parseSaveWindow(template));
    baseScene(state);
    scene.mutate(state);

    const { gam, sidecar } = exportNativeSave(state, template);

    // Towns: anula la tabla de objetos heredada (slots 1..31); el DOS recarga NPCs por loc.
    let outGam = gam;
    if (scene.clearObjectTable) {
      outGam = gam.slice();
      for (let i = OBJECT_TABLE_OFFSET + 8; i < OBJECT_TABLE_OFFSET + 32 * 8; i++) outGam[i] = 0;
    }
    if (outGam.length !== SAVED_GAM_SIZE) throw new Error("tamaño .gam != 4192: " + outGam.length);

    const gamPath = join(OUT_DIR, scene.name + ".gam");
    const sidecarPath = join(OUT_DIR, scene.name + ".sidecar.json");
    writeFileSync(gamPath, outGam);
    writeFileSync(sidecarPath, JSON.stringify(sidecar, null, 2) + "\n");

    // VALIDACIÓN: re-importa con el loader nativo del port y corre las aserciones.
    const roundtrip = importNativeSave(new Uint8Array(readFileSync(gamPath)), sidecar);
    scene.check?.(roundtrip);
    // Party sana + recursos, comunes a todas las escenas.
    assert(roundtrip.characters.slice(0, roundtrip.partySize).every((c) => c.status === "G"), "party G");
    assert(roundtrip.torches >= 10 && roundtrip.keys >= 10, "torches/keys>=10");

    console.log(
      "✔ " + scene.name.padEnd(22) + " loc=" + roundtrip.position.location +
        " floor=0x" + roundtrip.position.floor.toString(16) +
        " (" + roundtrip.position.x + "," + roundtrip.position.y + ")" +
        " box=" + roundtrip.specialItems.woodenBox +
        " badge=" + roundtrip.specialItems.blackBadge +
        " gold=" + roundtrip.gold + " keys=" + roundtrip.keys + " torch=" + roundtrip.torches,
    );
    console.log("    " + scene.desc);
  }
  console.log("\n" + scenes.length + " saves fabricados y VALIDADOS en " + OUT_DIR);
}

main();
