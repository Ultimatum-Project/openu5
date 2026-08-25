// Sonda gargolas-alfombra: ¿la gárgola ai=6 del Palacio persigue a la party MONTADA?
// Esperados EN CRUDO (derivados del binario, escritos ANTES de correr):
//  E1 (a pie, party (15,19) z=3 loc18): la gárgola (13,18) tiene un vecino ESTRICTAMENTE
//      mejor (13,19) [dist 3→2] ⇒ SE MUEVE en el 1.er turno.
//  E2 (alfombra 0x14, misma escena, 1.er turno de la visita): TOWN 0x161f toggle 0→1 ⇒
//      la cola de NPC NO corre ⇒ NO se mueve. En el 2.º turno SÍ.
//  E3 (party (15,18), la escena del vídeo de Fenton): dist 2 y el único vecino libre
//      (13,19) da dist 3 ⇒ NO se mueve NUNCA, a pie o en alfombra (geometría).
import { chromium } from "playwright";
import fs from "node:fs";

const PORT = process.env.U5_PORT || "5231";
const OUT = process.argv[2] || "/tmp/gargolas-out";
fs.mkdirSync(OUT, { recursive: true });

const KEY = { N: "ArrowUp", S: "ArrowDown", E: "ArrowRight", W: "ArrowLeft", PASS: " " };

async function escena({ x, y, transport, keys, tag }) {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1024, height: 700 } });
  const errs = [];
  page.on("pageerror", (e) => errs.push(String(e)));
  await page.goto(
    `http://localhost:${PORT}/?loc=18&floor=3&x=${x}&y=${y}&hour=12&nointro=1&seed=1234`,
    { waitUntil: "networkidle" },
  );
  await page.waitForFunction(() => !!window.__u5test, null, { timeout: 20000 });
  // Monta/desmonta escribiendo el estado vivo (misma struct que persiste el save).
  await page.evaluate((t) => {
    const st = window.__u5test.state();
    st.transportTile = t;
    if (t === 0x14) st.transport = "carpet";
  }, transport);
  await page.waitForTimeout(400);

  const leer = () =>
    page.evaluate(() => {
      const g = window.__u5test.game;
      const st = window.__u5test.state();
      const list = g.npcManager?.npcsAt ? g.npcManager.npcsAt(18) : null;
      const raw = g.npcManager?.npcs?.get?.(18) ?? list ?? [];
      return {
        party: { x: st.position.x, y: st.position.y, z: st.position.floor },
        transportTile: st.transportTile,
        garg: raw
          .filter((n) => n.slot === 17 || n.slot === 18)
          .map((n) => ({ slot: n.slot, x: n.x, y: n.y, z: n.z })),
        combat: !!g.combat,
        arena: g.combat ? (g.combat.mapId ?? null) : null,
      };
    });

  const beats = [{ t: 0, key: null, ...(await leer()) }];
  await page.screenshot({ path: `${OUT}/${tag}_t0.png` });
  for (let i = 0; i < keys.length; i++) {
    await page.keyboard.press(KEY[keys[i]]);
    await page.waitForTimeout(450);
    beats.push({ t: i + 1, key: keys[i], ...(await leer()) });
    await page.screenshot({ path: `${OUT}/${tag}_t${i + 1}.png` });
  }
  await page.screenshot({ path: `${OUT}/${tag}_tN.png` });
  await browser.close();
  return { tag, errs, beats };
}

const casos = [
  { tag: "A_pie_15_19", x: 15, y: 19, transport: 0x1c, keys: ["PASS", "PASS", "PASS"] },
  { tag: "B_alfombra_15_19", x: 15, y: 19, transport: 0x14, keys: ["PASS", "PASS", "PASS"] },
  { tag: "C_pie_15_18", x: 15, y: 18, transport: 0x1c, keys: ["PASS", "PASS", "PASS", "PASS"] },
  { tag: "D_alfombra_15_18", x: 15, y: 18, transport: 0x14, keys: ["PASS", "PASS", "PASS", "PASS"] },
  // Aproximación como en el vídeo: desde (15,21) volando al norte.
  { tag: "E_pie_sube", x: 15, y: 21, transport: 0x1c, keys: ["N", "N", "N", "N"] },
  { tag: "F_alfombra_sube", x: 15, y: 21, transport: 0x14, keys: ["N", "N", "N", "N"] },
];

const res = [];
for (const c of casos) res.push(await escena(c));
fs.writeFileSync(`${OUT}/beats.json`, JSON.stringify(res, null, 2));
for (const r of res) {
  console.log("###", r.tag, r.errs.length ? "ERRS:" + r.errs.slice(0, 2) : "");
  for (const b of r.beats) {
    console.log(
      `  t${b.t} key=${b.key ?? "-"} party=(${b.party.x},${b.party.y},z${b.party.z}) ` +
        `tt=0x${(b.transportTile ?? 0).toString(16)} ` +
        `garg=${b.garg.map((g) => `${g.slot}@(${g.x},${g.y},z${g.z})`).join(" ")} combat=${b.combat}`,
    );
  }
}
