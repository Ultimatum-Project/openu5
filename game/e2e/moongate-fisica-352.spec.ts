/**
 * #352 (merge a9bc5acb) — la FÍSICA de la moongate escribe `location`: pisar la puerta
 * llama a LA MISMA rutina que Vas Rel Por (kernel_moongate_teleport 0x47f4, con
 * g_location en 0x4841). El bug que cierra: el port duplicaba el destino vía
 * `moongateDestination`, que DESCARTABA `location` — la puerta física nunca cambiaba
 * de localización aunque la piedra de la fase activa estuviera enterrada en un pueblo.
 *
 * De paso ejerce #149 (merge 9777ed04): la puerta que se PISA aquí es la de una piedra
 * que NO es la de la fase activa — la puerta existe donde está ENTERRADA una piedra
 * (bucle de dibujo 0x475a sin consulta de fase); la fase sólo decide el DESTINO
 * (0x4962-0x4977).
 *
 * Esperados EN CRUDO: coordenadas de piedra sembradas a mano + fases LATCHEADAS
 * (bytes '0'..'7' de 0x5885/0x5886, base 0x30 — #176) para que la fase activa sea
 * determinista sin depender de la tabla del día. Noche = hour 22 ⇒ fase de TRAMMEL
 * (0x4962 `cmp g_hour,0xc`). Terreno verificado (assets/maps/overworld.json): (76,40)
 * y (77,40) son tile 5 (hierba, paso libre) — mismas celdas que saves.spec.
 */
import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";
import { gotoGame, readState, skinCycleReady } from "./helpers";

interface Pos { x: number; y: number; location: number; floor: number }

/**
 * Siembra el tablero lunar: piedra 0 enterrada en (77,40) del sobremundo (la puerta
 * que se pisa) y piedra 3 = destino de la fase activa; latchea Trammel a fase 3 y
 * Felucca a fase 0 (bytes 0x33/0x30, ambos válidos para que el latch mande — #176).
 */
async function seedGates(page: Page, dest: { x: number; y: number; location: number } | null): Promise<void> {
  await page.evaluate((d) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const s = (window as any).__u5test.state();
    s.feluccaPhase = 0x30;
    s.trammelPhase = 0x33; // hour 22 ⇒ fase activa = Trammel = 3
    // La puerta pisada: piedra 0 (fase 0 — NO la activa: eso es #149 en acto).
    s.moonstones[0] = { x: 77, y: 40, z: 0, location: 0, buried: true };
    // El destino: piedra 3 (la de la fase activa) — o en la MOCHILA (location 0xFF).
    s.moonstones[3] = d
      ? { x: d.x, y: d.y, z: 0, location: d.location, buried: true }
      : { x: 0, y: 0, z: 0, location: 0xff, buried: false };
  }, dest);
}

test("#352 · piedra de la fase activa enterrada en un PUEBLO: pisar la puerta física cambia location (el bug exacto)", async ({ page }) => {
  await gotoGame(page, { loc: 0, x: 76, y: 40, hour: 22, seed: 1234 });
  await skinCycleReady(page); // la primera tecla no debe caer en el swap de arranque
  // Destino: interior de Jhelom (loc 2), celda (15,15) — la misma que usa
  // es-live-cobertura.spec como celda interior válida de ese pueblo.
  await seedGates(page, { x: 15, y: 15, location: 2 });

  await page.keyboard.press("ArrowRight"); // pisa la puerta de (77,40)
  await expect.poll(async () => (await readState<Pos>(page, "position")).location).toBe(2);
  const pos = await readState<Pos>(page, "position");
  // Los CUATRO campos del teleport (0x483d-0x4856) desde la piedra, y el cargador
  // NO reposiciona (TOWN 0x11f0 relee mapa/NPCs; g_party_x/y ya son los de la piedra).
  expect(pos).toMatchObject({ x: 15, y: 15, location: 2, floor: 0 });
});

test("#352 · control mundo→mundo: el teleport de la física sigue funcionando dentro de la misma localización", async ({ page }) => {
  await gotoGame(page, { loc: 0, x: 76, y: 40, hour: 22, seed: 1234 });
  await skinCycleReady(page);
  await seedGates(page, { x: 150, y: 50, location: 0 });

  await page.keyboard.press("ArrowRight");
  await expect.poll(async () => (await readState<Pos>(page, "position")).x).toBe(150);
  const pos = await readState<Pos>(page, "position");
  expect(pos).toMatchObject({ x: 150, y: 50, location: 0, floor: 0 });
});

test("#352/#149 · negativo: con la piedra de la fase activa en la MOCHILA la puerta se cierra sobre el party y NO teleporta", async ({ page }) => {
  await gotoGame(page, { loc: 0, x: 76, y: 40, hour: 22, seed: 1234 });
  await skinCycleReady(page);
  await seedGates(page, null); // piedra 3 en la mochila (0x5840 == 0xFF → 0x4804 sub ax,ax)

  await page.keyboard.press("ArrowRight");
  // El party PISÓ la puerta (move() lo dejó encima) y ahí se queda: presentación de
  // cierre sin teleport (0x47fd/0x4804 — mismo desenlace que el edge de medianoche).
  await expect.poll(async () => (await readState<Pos>(page, "position")).x).toBe(77);
  const pos = await readState<Pos>(page, "position");
  expect(pos).toMatchObject({ x: 77, y: 40, location: 0, floor: 0 });
});
