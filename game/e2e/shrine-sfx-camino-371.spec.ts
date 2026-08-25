/**
 * #371 · El CAMINO del sfx del rito de santuario — core → applyEvents → coreview → speaker.
 *
 * EL HUECO QUE PINEA (y por qué existe este fichero y no un test de unidad): los tests de
 * EMISIÓN (shrine-ceremonies) y de CATÁLOGO (speaker.ts) estaban verdes con el juego MUDO,
 * porque el agujero vivía exactamente entre los dos: en `applyEvents` (main.ts) el único
 * enrutador de `{kind:"sfx"}` era el `view.notifyTurn(events)` del FINAL del bucle, y toda
 * rama terminal del rito corta el bucle con `return` (la salida de escena #277, las esperas
 * de tecla #294, el aparcamiento #330(B)) ANTES de llegar ahí. Medido en #371: TONO=0 en
 * donación (#364), WELL DONE (#295/#345 — que NUNCA llegó a sonar en runtime) y melodía del
 * ORDAINED (#364-b), con el ALAKAZAM y el XOR saliendo. El fix es `flushSfxPrefix` en cada
 * corte; esto ejercita el canal VIVO en las tres ramas de la clase.
 *
 * CÓMO MIDE: censo de WebAudio inyectado antes de cargar la página — cada
 * `createOscillator` cuenta, y el discriminante de IDENTIDAD es el grafo del speaker
 * (speaker.ts `scheduleSeg`): los segmentos de RUIDO (pisadas `move-step`, trueno `quake`)
 * crean un WaveShaper inmediatamente después de su oscilador; los TONOS (barridos, melodía)
 * no. Así «TONO» cuenta exactamente los cues del rito y «RUIDO» las pisadas/trueno, sin
 * tocar el código de producción.
 *
 * `?scenebeat=1` es lo que hace al test fiel a la GEOMETRÍA humana bajo automatización:
 * con él `TROLL_UNIT_MS=1` ⇒ las esperas de tecla del rito APARCAN de verdad (no drenan
 * síncrono) y la escena/ventana de inversión corren a 1 ms — es decir, los MISMOS cortes y
 * re-aplicaciones del turno que ve un jugador, en milisegundos.
 *
 * NO-DOBLE (aserto, no prosa): los conteos son de IGUALDAD EXACTA (2 barridos, 7 notas).
 * Si el flush y el `notifyTurn` enrutaran el mismo prefijo, o un tramo re-aplicado
 * re-flusheara lo ya sonado, saldrían 4/14 y el aserto cae. El caso corta-y-re-aplica está
 * ejercido de verdad: con `scenebeat=1` la rama ORDAINED se trocea en TRES tramos por sus
 * dos esperas de tecla y la melodía viaja en el ÚLTIMO tramo re-aplicado (consumeKey →
 * applyEvents(rest) → corte en la escena de salida → flush), y suena UNA vez.
 */
import { test, expect } from "@playwright/test";
import { gotoGame, consoleText } from "./helpers";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type U5Win = Window & { __u5test: any; __sfx371: { tone: number; noise: number } };

/**
 * Censo WebAudio: se inyecta ANTES de cargar la página (addInitScript).
 *
 * 🔴 El shaper reclasifica al ÚLTIMO oscilador SIN «ventana» intermedia: en `scheduleSeg`
 * el orden real es osc → gain → [shaper del ruido] (el gain se crea ANTES del if de ruido),
 * así que cualquier intento de cerrar la decisión en `createGain` clasifica TODO como tono
 * (mordió en el primer borrador de este spec: control de pisadas = 0 con el audio sonando).
 * La reclasificación por-último-oscilador es correcta porque el shaper de un segmento
 * siempre se crea después de SU oscilador y antes del SIGUIENTE.
 */
function censusInit(): void {
  const w = window as unknown as U5Win;
  w.__sfx371 = { tone: 0, noise: 0 };
  const AC = window.AudioContext;
  const origOsc = AC.prototype.createOscillator;
  let lastOscWasTone = false;
  AC.prototype.createOscillator = function (...a: []) {
    // Provisionalmente TONO; si antes del siguiente oscilador aparece un WaveShaper, era RUIDO.
    w.__sfx371.tone++;
    lastOscWasTone = true;
    return origOsc.apply(this, a);
  };
  const origShaper = AC.prototype.createWaveShaper;
  AC.prototype.createWaveShaper = function (...a: []) {
    if (lastOscWasTone) {
      w.__sfx371.tone--;
      w.__sfx371.noise++;
      lastOscWasTone = false;
    }
    return origShaper.apply(this, a);
  };
}

async function census(page: import("@playwright/test").Page): Promise<{ tone: number; noise: number }> {
  return page.evaluate(() => (window as unknown as U5Win).__sfx371);
}

async function setShrineBits(page: import("@playwright/test").Page, quest: number, visited: number) {
  await page.evaluate(
    ([q, v]) => {
      const s = (window as unknown as U5Win).__u5test.state();
      s.shrineQuestBitmap = q;
      s.shrineVisitedBitmap = v;
    },
    [quest, visited],
  );
}

/** Entra al santuario de Honesty y deja el interrogatorio en el prompt de virtud. */
async function enterShrine(page: import("@playwright/test").Page, quest: number, visited: number) {
  await page.addInitScript(censusInit);
  await gotoGame(page, { x: 232, y: 66, seed: 1 }, ["scenebeat=1"]);
  await setShrineBits(page, quest, visited);
  const c0 = await census(page);
  await page.keyboard.press("ArrowRight"); // (233,66) = Shrine 0x19
  await page.keyboard.press("e"); // la ceremonia cuelga del (E)nter
  await expect.poll(() => consoleText(page)).toMatch(/kneel before the Altar/);
  // CONTROL POSITIVO en la misma corrida: las pisadas de la escena de entrada van por
  // `view.emitSfx` DIRECTO del pacer (el canal que nunca estuvo roto). Si esto es 0, el
  // instrumento (censo) o el grafo de audio están rotos y ningún otro aserto significa nada.
  await expect.poll(async () => (await census(page)).noise - c0.noise).toBeGreaterThanOrEqual(2);
}

/**
 * Teclea la cadena virtud + mantra×3 sincronizando por el ECO de consola, no por
 * `promptType`: cada Enter re-arma el siguiente prompt DENTRO del mismo keydown, así que
 * `inputSinks().prompt` nunca deja de ser "text" y el `submitPrompt` de helpers no ve el
 * hueco (rojo heredado medido también en main puro d8c083e0 — reportado al lead, no de
 * esta ficha). El eco de cada getstring ("‹texto›" en su línea, "Mantra:" del siguiente)
 * SÍ es observable y es además lo que ve el jugador.
 */
async function typeMeditation(page: import("@playwright/test").Page, virtue: string, mantra: string) {
  await expect
    .poll(() => page.evaluate(() => (window as unknown as U5Win).__u5test?.inputSinks?.().prompt ?? null))
    .toBe("text");
  await page.keyboard.type(virtue);
  await page.keyboard.press("Enter");
  for (let i = 0; i < 3; i++) {
    // El prompt "Mantra:" número i+1 ya está en consola antes de teclear el mantra i+1.
    await expect
      .poll(async () => ((await consoleText(page)).match(/Mantra:/g) ?? []).length)
      .toBeGreaterThanOrEqual(i + 1);
    await page.keyboard.type(mantra);
    await page.keyboard.press("Enter");
  }
}

test("#371 · donación: los dos barridos del ALAKAZAM llegan al speaker (y exactamente una vez)", async ({ page }) => {
  await enterShrine(page, 0, 1); // Codex aprendido + sin quest ⇒ mode=donation
  await typeMeditation(page, "Honesty", "Ahm");
  await expect.poll(() => consoleText(page)).toMatch(/Offer how many hundredweights gold/);
  const before = await census(page);
  await page.keyboard.press("1"); // dona 100 ⇒ eco + ALAKAZAM + XOR + sfx + salida de escena
  await expect.poll(() => consoleText(page)).toMatch(/ALAKAZAM/);
  // Los DOS tramos espejo de CAST2 0x0bd0-0x0c0f = 2 osciladores de TONO, ni cero (el
  // hueco de #371: el corte de la salida de escena se tragaba el cue) ni cuatro (doble
  // enrutado flush+notifyTurn). El turno de la donación no lleva ningún otro tono.
  await expect.poll(async () => (await census(page)).tone - before.tone).toBe(2);
});

test("#371 · WELL DONE: barridos + trueno encadenado llegan al speaker", async ({ page }) => {
  await enterShrine(page, 1, 1); // Codex + quest activa ⇒ quest-complete
  const before = await census(page);
  await typeMeditation(page, "Honesty", "Ahm"); // el WELL DONE dispara en el Enter del 3er mantra
  await expect.poll(() => consoleText(page)).toMatch(/WELL DONE/);
  // Dos tramos espejo de 0x0c44-0x0c85 = 2 TONOS exactos (no-doble) …
  await expect.poll(async () => (await census(page)).tone - before.tone).toBe(2);
  // … y la sacudida de 0x0c88 (cue `quake`, encadenado detrás por CHAINED_CUES #345):
  // 8 pulsos × 3 sub-ráfagas = 24 osciladores de RUIDO como MÍNIMO (las pisadas de la
  // escena de salida se suman por encima).
  await expect.poll(async () => (await census(page)).noise - before.noise).toBeGreaterThanOrEqual(24);
});

test("#371 · ORDAINED: la melodía viaja en un tramo RE-APLICADO tras dos esperas y suena UNA vez", async ({ page }) => {
  await enterShrine(page, 0, 0); // sin Codex ⇒ show-mantra (rama ORDAINED, #364-b)
  await typeMeditation(page, "Honesty", "Ahm");
  await expect.poll(() => consoleText(page)).toMatch(/a Quest is ordained!/);
  const before = await census(page);
  // Con scenebeat=1 las DOS esperas de tecla (0x0a9b/0x0abc) APARCAN de verdad: cada
  // tecla re-aplica el resto (consumeKey → applyEvents(rest)). La melodía va en el
  // TERCER tramo y su corte (salida de escena) es quien la flushea.
  await page.keyboard.press(" ");
  await expect.poll(() => consoleText(page)).toMatch(/thy sacred Quest/);
  await page.keyboard.press(" ");
  await expect.poll(() => consoleText(page)).toMatch(/Return again when thy Quest is done!/);
  // Las 7 notas de las tablas DS 0x4be6/0x4bf4/0x4c02/0x4c10 = 7 TONOS exactos: ni 0
  // (hueco #371) ni 14 (doble enrutado en el tramo re-aplicado).
  await expect.poll(async () => (await census(page)).tone - before.tone).toBe(7);
});

test("#371 · corte por espera de tecla: el prefijo suena al cortar y el resto UNA vez al re-aplicar", async ({ page }) => {
  // El cuarto corte de la clase — `shrine-key-wait` (los quake sonoros del Códice viajan
  // troceados entre sus NUEVE esperas) — no se alcanza barato por teclado (exige la
  // ceremonia de las 8 virtudes), así que se empuja un turno REAL-shaped por el hook
  // `__u5test.applyEvents`, que ES el pipeline vivo de presentación (mismo camino que usa
  // el endgame #20 L4). Con `scenebeat=1` la espera APARCA de verdad:
  //   [sfx A, key-wait, sfx B] ⇒ al cortar suena A (flush del prefijo, 2 tonos) y B espera;
  //   la tecla re-aplica el resto ⇒ B suena UNA vez (7 tonos) por el notifyTurn del tramo
  //   que completa. Igualdades exactas: cualquier doble enrutado (4/14) cae aquí.
  await page.addInitScript(censusInit);
  await gotoGame(page, { x: 232, y: 66, seed: 1 }, ["scenebeat=1"]);
  const c0 = await census(page);
  await page.evaluate(() => {
    (window as unknown as U5Win).__u5test.applyEvents([
      { kind: "sfx", sfx: { id: "shrine-donation" } }, // 2 tonos (los dos barridos espejo)
      { kind: "shrine-key-wait" },
      { kind: "sfx", sfx: { id: "shrine-ordained" } }, // 7 tonos (la melodía)
    ]);
  });
  // El corte flushea el PREFIJO: exactamente los 2 tonos de A, ninguno de B.
  await expect.poll(async () => (await census(page)).tone - c0.tone).toBe(2);
  await page.keyboard.press(" "); // consumeKey → applyEvents(rest)
  // El resto completa el bucle y pasa por notifyTurn: los 7 tonos de B, una sola vez.
  await expect.poll(async () => (await census(page)).tone - c0.tone).toBe(9);
});
