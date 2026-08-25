/**
 * CENSO DE ANCLAS del corpus del espejo — sonda de la ventana `anclas-f4`.
 *
 *   node re/tools/censo_anclas_f4.mjs <dirDeRutas>
 *
 * Cuenta las anclas de `<parte>.route.json` por CLASE, porque `anchorsMissed`
 * (`runner.ts:2580`) es un contador MEZCLADO de tres eventos con causas distintas:
 *
 *   canal 1  — ancla `face`: la feature del LP no está en el mapa vivo (geometría)
 *   canal 2a — ancla `npc`: el NPC no está en el mapa vivo
 *   canal 2b — ancla `npc` de TIENDA: `shopOpen()` falso tras 2 intentos (enganche)
 *
 * Sólo las anclas que `anchorIsShop` declara tienda entran al bucle de verificación, así que
 * el canal 2b tiene una población distinta según la REGLA vigente. La sonda emite las dos:
 *
 *   VIEJA  (hasta `7e7c6ff8`)  /^(buy|sell)$/i sobre `cmd`
 *   NUEVA  (desde `7e7c6ff8`)  match.startsWith("shop:")  ∪  la vieja
 *
 * Correrla sobre el corpus de DOS shas es lo que enseña si un cambio del contador viene de la
 * población o del instrumento (ver `anclas-f4-preregistro.md` §0.1).
 */
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";

const isShopViejo = (a) => /^(buy|sell)$/i.test(a.cmd ?? "");
const isShopNuevo = (a) => (a.match ?? "").toLowerCase().startsWith("shop:") || isShopViejo(a);

export function censarRutas(dir) {
  const out = { face: 0, faceSkip: 0, npc: 0, npcSkip: 0, shopViejo: 0, shopNuevo: 0, shopNuevoVivas: 0, porParte: {}, anclas: [] };
  for (const f of readdirSync(dir).filter((f) => f.endsWith(".route.json")).sort()) {
    const j = JSON.parse(readFileSync(join(dir, f), "utf8"));
    const parte = f.replace(".route.json", "");
    out.porParte[parte] ??= { face: 0, shop: 0 };
    for (const s of j.segments ?? []) {
      const skip = s.skip != null;
      for (const op of s.script ?? []) {
        const a = op.anchor;
        if (!a) continue;
        if (a.kind === "face") {
          out.face++;
          if (skip) out.faceSkip++;
          else out.porParte[parte].face++;
          out.anclas.push({ parte, seg: s.id, kind: "face", match: a.sees ?? "", skip });
          continue;
        }
        if (a.kind !== "npc") continue;
        out.npc++;
        if (skip) out.npcSkip++;
        if (isShopViejo(a)) out.shopViejo++;
        if (isShopNuevo(a)) {
          out.shopNuevo++;
          if (!skip) {
            out.shopNuevoVivas++;
            out.porParte[parte].shop++;
          }
        }
        out.anclas.push({ parte, seg: s.id, kind: "npc", match: a.match ?? "", cmd: a.cmd ?? "", shopViejo: isShopViejo(a), shopNuevo: isShopNuevo(a), skip });
      }
    }
  }
  return out;
}

function main() {
  const dir = process.argv[2];
  if (!dir || !existsSync(dir)) {
    console.error("uso: node re/tools/censo_anclas_f4.mjs <dirDeRutas>");
    process.exit(2);
  }
  const c = censarRutas(dir);
  const conAncla = Object.entries(c.porParte).filter(([, v]) => v.face || v.shop);
  const sinAncla = Object.entries(c.porParte).filter(([, v]) => !v.face && !v.shop).map(([k]) => k);
  console.log(`CORPUS ${dir}`);
  console.log(`  face = ${c.face} (${c.faceSkip} en segmentos skipeados)`);
  console.log(`  npc  = ${c.npc} (${c.npcSkip} en segmentos skipeados)`);
  console.log(`  isShop VIEJO (cmd buy|sell) = ${c.shopViejo}   ·   isShop NUEVO (match shop: ∪ cmd) = ${c.shopNuevo}, VIVAS ${c.shopNuevoVivas}`);
  console.log(`  partes CON ancla: ${conAncla.length} → ${conAncla.map(([k, v]) => `${k}(f${v.face}/s${v.shop})`).join(" ")}`);
  console.log(`  partes SIN ancla (anchorsMissed = 0 POR CONSTRUCCIÓN): ${sinAncla.length} → ${sinAncla.join(" ")}`);
}

if (import.meta.url === `file://${process.argv[1]}`) main();
