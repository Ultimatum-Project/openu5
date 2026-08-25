/**
 * Mapeo de las pistas XMI del parche comunitario "The Exodus Project"
 * a contextos de juego del clon.
 *
 * Los nombres provienen de la banda sonora original de Ultima V (Apple II/C64,
 * de Kenneth W. Arnold y otros): Stones, Rule Britannia, etc.
 */
export interface Track {
  xmi: string;
  out: string;
  context: string;
}

export const TRACKS: Track[] = [
  { xmi: "U5THEME.XMI", out: "music/theme.ogg", context: "título / intro" },
  { xmi: "BRITLAND.XMI", out: "music/overworld.ogg", context: "overworld Britannia" },
  { xmi: "WRLDBLW.XMI", out: "music/underworld.ogg", context: "Underworld" },
  { xmi: "STONES.XMI", out: "music/stones.ogg", context: "pueblos (tema Stones)" },
  { xmi: "RULEBRIT.XMI", out: "music/castle.ogg", context: "castillo Lord British" },
  { xmi: "BLCKTHRN.XMI", out: "music/blackthorn.ogg", context: "palacio de Blackthorn" },
  { xmi: "ENGGMNT.XMI", out: "music/combat.ogg", context: "combate (Engagement)" },
  { xmi: "HALLS.XMI", out: "music/dungeon.ogg", context: "mazmorras (Halls of Doom)" },
  { xmi: "FANFARE.XMI", out: "music/fanfare.ogg", context: "victoria / eventos" },
  { xmi: "HORNPIPE.XMI", out: "music/tavern.ogg", context: "tabernas (Hornpipe)" },
  { xmi: "GREYSON.XMI", out: "music/greyson.ogg", context: "tema de personaje" },
  { xmi: "LADYNAN.XMI", out: "music/ladynan.ogg", context: "tema de personaje" },
  { xmi: "MONARCH.XMI", out: "music/monarch.ogg", context: "tema de personaje" },
  { xmi: "REUNION.XMI", out: "music/reunion.ogg", context: "reencuentros" },
  { xmi: "AMIGA.XMI", out: "music/amiga.ogg", context: "extra (versión Amiga)" },
];
