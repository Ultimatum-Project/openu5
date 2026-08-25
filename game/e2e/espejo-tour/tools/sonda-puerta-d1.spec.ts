/**
 * SONDA de la PUERTA #D1 en el NAVEGADOR (carril npc-gate-plan, instrumento de careo).
 *
 * Dos cosas, y las dos hacen falta:
 *  1. ¿Llegó la env AL BUNDLE? La env de la shell y la puerta del bundle son dos cosas
 *     distintas: `VITE_*` se hornea en el vite AL ARRANCAR, y la config del espejo REUSA
 *     servidor cuando `U5_E2E_PORT` está puesta. Sin este careo, tres brazos en el mismo
 *     puerto miden el PRIMERO tres veces (pasó, 25-08).
 *  2. ¿Cuántos NPC pinta el port al cargar la semilla? Se carga por la MISMA vía que
 *     `importCheckpoint` del espejo (`__u5test.loadNativeSave`) y se cuenta la lista viva.
 *     Es la medida DIRECTA del mecanismo, independiente del OCR del tour.
 */
import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { gotoGame } from "../../helpers";

const SAVES = process.env.U5_SONDA_SAVES ?? "";
const PART = process.env.U5_SONDA_PART ?? "part07";

test("puerta #D1 dentro de la pagina", async ({ page }) => {
  await gotoGame(page, {});
  const dentro = await page.evaluate(
    () => (window as unknown as { __u5test?: { cargaFielActiva?: () => boolean } }).__u5test?.cargaFielActiva?.() ?? "HOOK-AUSENTE",
  );
  const esperado = process.env.U5_ESPERADO === "abierta";
  console.log(`PUERTA-EN-PAGINA=${String(dentro)}  ESPERADO=${String(esperado)}`);
  expect(dentro).toBe(esperado);

  if (!SAVES) return;
  const gam = Array.from(new Uint8Array(readFileSync(join(SAVES, `${PART}.gam`))));
  const sidecar: unknown = JSON.parse(readFileSync(join(SAVES, `${PART}.sidecar.json`), "utf8"));
  const censo = await page.evaluate(
    ([bytes, side]) => {
      const t = window as unknown as {
        __u5test: {
          loadNativeSave: (b: number[], s?: unknown) => void;
          game: { state: { position: { location: number } }; npcManager?: { npcsAt: (l: number, f: number) => unknown[] } };
        };
      };
      t.__u5test.loadNativeSave(bytes as number[], side);
      const g = t.__u5test.game;
      const loc = g.state.position.location;
      const walk = (g.state as unknown as { npcWalk?: { slots: Array<{ slot: number; x: number; y: number; z: number }> } | null }).npcWalk;
      return {
        loc,
        vivos: walk ? walk.slots.length : 0,
        walkNulo: walk === null,
        firma: walk ? walk.slots.map((s) => `${s.slot}@${s.x},${s.y},${s.z}`).sort().join(" ") : "",
      };
    },
    [gam, sidecar] as [number[], unknown],
  );
  console.log(`CENSO-NPC part=${PART} loc=${censo.loc} vivos=${censo.vivos} npcWalk-null=${censo.walkNulo}`);
  console.log(`FIRMA=${censo.firma}`);
});
