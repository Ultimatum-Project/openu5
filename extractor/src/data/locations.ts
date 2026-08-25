/**
 * Tabla de las 32 localizaciones con mapa pequeño (small map) de Ultima V.
 *
 * El ORDEN de esta tabla (y el orden de plantas dentro de cada location) es
 * significativo: determina el offset de cada planta dentro de su fichero .DAT,
 * ya que las plantas se almacenan consecutivas (1024 bytes cada una) en el
 * orden de aparición de los edificios.
 *
 * ids según el enum Location de SingleMapReference.cs (Moonglow=1 …
 * Serpents_Hold=32). Ver docs/formats/maps.md §2.
 */

export interface LocationInfo {
  id: number;
  name: string;
  datFile: "CASTLE" | "TOWNE" | "DWELLING" | "KEEP";
  /** Lista de plantas z (ej. [-1,0,1,2,3] para Lord British Castle, [0] para Iolo's Hut). */
  floors: number[];
}

export const LOCATIONS: LocationInfo[] = [
  // --- TOWNE.DAT ---
  { id: 1, name: "Moonglow", datFile: "TOWNE", floors: [0, 1] },
  { id: 2, name: "Britain", datFile: "TOWNE", floors: [0, 1] },
  { id: 3, name: "Jhelom", datFile: "TOWNE", floors: [0, 1] },
  { id: 4, name: "Yew", datFile: "TOWNE", floors: [-1, 0] },
  { id: 5, name: "Minoc", datFile: "TOWNE", floors: [0, 1] },
  { id: 6, name: "Trinsic", datFile: "TOWNE", floors: [0, 1] },
  { id: 7, name: "Skara_Brae", datFile: "TOWNE", floors: [0, 1] },
  { id: 8, name: "New_Magincia", datFile: "TOWNE", floors: [0, 1] },

  // --- DWELLING.DAT ---
  { id: 9, name: "Fogsbane", datFile: "DWELLING", floors: [0, 1, 2] },
  { id: 10, name: "Stormcrow", datFile: "DWELLING", floors: [0, 1, 2] },
  { id: 11, name: "Greyhaven", datFile: "DWELLING", floors: [0, 1, 2] },
  { id: 12, name: "Waveguide", datFile: "DWELLING", floors: [0, 1, 2] },
  { id: 13, name: "Iolos_Hut", datFile: "DWELLING", floors: [0] },
  { id: 14, name: "Suteks_Hut", datFile: "DWELLING", floors: [0] },
  { id: 15, name: "SinVraals_Hut", datFile: "DWELLING", floors: [0] },
  { id: 16, name: "Grendels_Hut", datFile: "DWELLING", floors: [0] },

  // --- CASTLE.DAT ---
  { id: 17, name: "Lord_Britishs_Castle", datFile: "CASTLE", floors: [-1, 0, 1, 2, 3] },
  { id: 18, name: "Palace_of_Blackthorn", datFile: "CASTLE", floors: [-1, 0, 1, 2, 3] },
  { id: 19, name: "West_Britanny", datFile: "CASTLE", floors: [0] },
  { id: 20, name: "North_Britanny", datFile: "CASTLE", floors: [0] },
  { id: 21, name: "East_Britanny", datFile: "CASTLE", floors: [0] },
  { id: 22, name: "Paws", datFile: "CASTLE", floors: [0] },
  { id: 23, name: "Cove", datFile: "CASTLE", floors: [0] },
  { id: 24, name: "Buccaneers_Den", datFile: "CASTLE", floors: [0] },

  // --- KEEP.DAT ---
  { id: 25, name: "Ararat", datFile: "KEEP", floors: [0, 1] },
  { id: 26, name: "Bordermarch", datFile: "KEEP", floors: [0, 1] },
  { id: 27, name: "Farthing", datFile: "KEEP", floors: [0] },
  { id: 28, name: "Windemere", datFile: "KEEP", floors: [0] },
  { id: 29, name: "Stonegate", datFile: "KEEP", floors: [0] },
  { id: 30, name: "Lycaeum", datFile: "KEEP", floors: [0, 1, 2] },
  { id: 31, name: "Empath_Abbey", datFile: "KEEP", floors: [0, 1, 2] },
  { id: 32, name: "Serpents_Hold", datFile: "KEEP", floors: [-1, 0, 1] },
];
