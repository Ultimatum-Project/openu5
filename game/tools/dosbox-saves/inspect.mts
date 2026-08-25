import { readFileSync } from "node:fs";
import { parseSaveWindow } from "../../src/core/saveNative.js";
const path = process.argv[2] ?? "original/u5/ultima5/SAVED.GAM";
const gam = new Uint8Array(readFileSync(path));
const s = parseSaveWindow(gam);
console.log("file", path, "len", gam.length);
console.log("partySize", s.partySize, "activeChar", s.activeCharacter);
console.log("loc", s.location, "floor", "0x"+s.floor.toString(16), "x", s.x, "y", s.y);
console.log("gold", s.gold, "food", s.food, "keys", s.keys, "torches", s.torches, "gems", s.gems, "skullKeys", s.skullKeys);
console.log("transportTile 0x2d6 = 0x"+gam[0x2d6]!.toString(16));
console.log("specialItems", JSON.stringify(s.specialItems));
console.log("shards", JSON.stringify(s.shards), "lbArtifacts", JSON.stringify(s.lbArtifacts));
console.log("shrineQuest 0x326=0x"+gam[0x326]!.toString(16), "shrineVisited 0x328=0x"+gam[0x328]!.toString(16));
console.log("time y"+s.year, "m"+s.month, "d"+s.day, s.hour+":"+s.minute, "karma", s.karma);
for (let i=0;i<Math.min(s.partySize,6);i++){const c=s.characters[i]!; console.log(`  #${i}`, c.name.padEnd(10), "cls="+c.class, "st="+c.status, "hp="+c.currentHp+"/"+c.maxHp, "lvl="+c.level, "str="+c.strength+" dex="+c.dexterity+" int="+c.intelligence);}
