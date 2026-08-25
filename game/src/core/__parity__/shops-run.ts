/**
 * Runner de paridad de TIENDAS (Task 3.6). Ejecuta en el core del clon el
 * cálculo EXACTO de precios/grants de cada tipo de tienda y emite los resultados
 * numéricos, para cruzarlos contra el modelo asm-derivado en Python
 * (`re/tools/shops_parity.py`). No hay RNG: las tiendas son deterministas salvo
 * la merma post-compra 0x019A (rand(1,64), fuera de alcance — ver notes/shops.md)
 * y las 3 tiradas cosméticas de la taberna.
 *
 * Entrada (argv[2], JSON): { cases: [ {op, ...args}, ... ] }
 *   ops: buy | sell | reagent | guild | horse | frigate | skiff |
 *        innRest | innPickup | tavernRound | wine | rations | rumor
 * Salida (stdout, última línea): { results: [ number|null|[..], ... ] }
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  shopBuyPrice,
  shopSellPrice,
  reagentPriceAt,
  reagentGrantQty,
  guildPrice,
  healerPrices,
  horsePrice,
  shipwrightPrice,
  innAt,
  innRestPrice,
  innPickupPrice,
  tavernRoundPrice,
  winePrice,
  rationPrice,
  rumorPrice,
  type GuildItem,
} from "../shops/shops.js";
import { HORSE_PRICES } from "../shops/shop-tables.js";

declare const process: {
  argv: string[];
  stdout: { write(c: string): void };
  stderr: { write(c: string): void };
  exit(c?: number): never;
};

interface Case {
  op: string;
  base?: number;
  int?: number;
  magicTown?: number;
  slot?: number;
  guildTown?: number;
  item?: number;
  horseTown?: number;
  shipTown?: number;
  location?: number;
  partySize?: number;
  months?: number;
  barTown?: number;
  living?: number;
  wineIdx?: number;
  keyword?: string;
}

interface DataOvl {
  reagentBasePrices: number[];
  reagentQuantities: number[];
  healPrices: number[];
  curePrices: number[];
  resurrectPrices: number[];
}

const data = JSON.parse(
  readFileSync(
    fileURLToPath(new URL("../../../assets/data.json", import.meta.url)),
    "utf8",
  ).replace(/^﻿/, ""),
) as DataOvl;

function runCase(c: Case): number | null | number[] {
  const i = c.int ?? 0;
  switch (c.op) {
    case "buy":
      return shopBuyPrice(c.base ?? 0, i);
    case "sell":
      return shopSellPrice(c.base ?? 0, i);
    case "reagent": {
      const price = reagentPriceAt(c.magicTown ?? 0, c.slot ?? 0, i, data.reagentBasePrices);
      const qty = reagentGrantQty(c.magicTown ?? 0, c.slot ?? 0, data.reagentQuantities);
      return [price ?? -1, qty];
    }
    case "guild":
      return guildPrice(c.guildTown ?? 0, (c.item ?? 0) as GuildItem, i);
    case "horse":
      return horsePrice(HORSE_PRICES[c.horseTown ?? 0] ?? 0, i);
    case "frigate":
      return shipwrightPrice(c.shipTown ?? 0, "frigate", i);
    case "skiff":
      return shipwrightPrice(c.shipTown ?? 0, "skiff", i);
    case "innRest": {
      const inn = innAt(c.location ?? 0);
      return inn ? innRestPrice(inn, c.partySize ?? 1, i) : null;
    }
    case "innPickup": {
      const inn = innAt(c.location ?? 0);
      return inn ? innPickupPrice(inn, i, c.months ?? 1) : null;
    }
    case "tavernRound":
      return tavernRoundPrice(c.barTown ?? 0, c.living ?? 0);
    case "wine":
      return winePrice(c.wineIdx ?? 0);
    case "rations":
      return rationPrice(c.barTown ?? 0, i);
    case "rumor":
      return rumorPrice(c.keyword ?? "");
    case "healer": {
      const p = healerPrices(
        c.location ?? 0,
        data.healPrices,
        data.curePrices,
        data.resurrectPrices,
      );
      return p ? [p.heal, p.cure, p.resurrect] : null;
    }
    default:
      return null;
  }
}

function main(): void {
  const input = JSON.parse(process.argv[2] ?? "{}") as { cases?: Case[] };
  const results = (input.cases ?? []).map(runCase);
  process.stdout.write(JSON.stringify({ results }) + "\n");
}

main();
