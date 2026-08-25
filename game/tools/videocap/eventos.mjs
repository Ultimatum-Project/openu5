/**
 * REGISTRO DE EVENTOS del arnés de vídeo (ver CENSO.md, ids = filas del censo).
 * El guion es DATO: siembra + teclas por el handler real + esperas. Cada evento:
 *   pieles      — en cuáles grabar (["shader","faithful"] si el FX distingue)
 *   query       — params extra de URL ({combeat:400} para ritmo humano de combate)
 *   siembra     — {momento:"momento-NN"} | {saveEspejo:"adNN"} | {deeplink:{...}} | null (fresh)
 *   preparar    — async (page) => ajustes post-carga por hooks DEV (__u5test/__u5debug)
 *   guion       — [{press:"k", tras?:ms} | {teclea:"txt", tras?:ms} | {espera:ms}
 *                  | {esperaFn:"js"} | {pulsaHasta:"js", tecla?:" ", cada?:ms, max?:n}
 *                  | {ejecuta:async(page)=>{}}]
 *   cadenciaMs  — pausa default tras cada tecla (220 = la del espejo)
 *   colaMs      — cola final tras drenar fxActive
 *
 * REGLA DE LA TANDA 22-08 (auditoría de la colección, TABLA.md): ningún guion lleva
 * N teclas FIJAS que no lean estado. Donde el guion ya leía estado (tienda vía
 * shopConsole, moongate-piedra vía readyPicker) el vídeo salió limpio; donde no,
 * las teclas sobrantes derramaron al despachador como comandos («>Pass» ×23 s en
 * whirlpool, «Set Active Plr: None!» en shrine-donacion, IN NOX en vez de In Mani
 * Corp). Para eso están `pulsaHasta` (tecla repetida HASTA un predicado de estado),
 * el `teclea` por estado del arnés (espera el getstring y no derrama) y los
 * conductores `conduceEscena`/`conduceCombate` de abajo.
 */

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { lectura, tecla } from "../../e2e/tempo-video.mjs";

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");

/** Reusa un guion de partida (#158): una tecla por línea, `#` comentario. */
function guionPartida(id) {
  return readFileSync(resolve(RAIZ, "game/partidas/guiones", `${id}.txt`), "utf8")
    .split("\n")
    .map((l) => l.replace(/#.*$/, "").trim())
    .filter(Boolean)
    .map((k) => ({ press: k }));
}

/**
 * Reproduce un guion de partida PERO CORTA en cuanto la consola dice que el evento
 * ocurrió — el `pulsaHasta` de la auditoría 22-08 aplicado a los guiones grabados.
 *
 * 🔴 POR QUÉ HACE FALTA (medido con sidecar, tanda cine 22-08): los `.txt` de #158 son
 * partidas ENTERAS, y el evento que el vídeo promete ocurre a la mitad. En
 * `shadowlord-shard-nosfentor` la fila «The doom of the Shadowlord … is wrought» sale en
 * **t=13,1 s** y el guion sigue andando **31 s más** — 22 `North/South/East/West
 * Blocked!` incluidos, porque una ruta grabada en otra partida choca contra paredes aquí.
 * Sin sidecar eso era INVISIBLE: el gate lo marcaba sólo como cola (69 %) y la auditoría
 * lo adjudicó «recorte, no regrabación». Esto es el recorte, hecho en el origen.
 *
 * El corte es POR ESTADO (la fila real en `__u5test.consoleLines()`, el mismo embudo que
 * lee el sidecar), no por un número de teclas contadas: un índice fijo volvería a mentir
 * en cuanto el guion o el mapa cambien.
 *
 * @param {string} id        guion de `game/partidas/guiones/<id>.txt`
 * @param {RegExp} reParada  fila de consola que declara el evento consumado
 * @param {{extraPasos?: number}} opts teclas que se dejan correr TRAS el corte (0 = ninguna)
 */
function guionPartidaHasta(id, reParada, { extraPasos = 0 } = {}) {
  const teclas = guionPartida(id).map((p) => p.press);
  return {
    ejecuta: async (page) => {
      const espera = tecla(220);
      let restantes = null;
      for (const k of teclas) {
        if (restantes !== null && restantes <= 0) break;
        await page.locator("body").press(k);
        await page.waitForTimeout(espera);
        if (restantes === null) {
          const visto = await page.evaluate((src) => {
            const filas = window.__u5test?.consoleLines?.() ?? [];
            const re = new RegExp(src);
            return filas.some((f) => re.test(String(f)));
          }, reParada.source);
          if (visto) restantes = extraPasos;
        } else {
          restantes -= 1;
        }
      }
    },
  };
}

/**
 * Conductor de ESCENA por estado (rito de santuario / captura de Blackthorn).
 * Sustituye a las tandas de espacios fijos (auditoría 22-08: los sobrantes caían
 * como «>Pass» — ~12 s en codice-ceremonia, ~8 s en blackthorn-captura). Reglas:
 *   · keywait vivo (`scenePacers().shrineKeyWait`, el getkey_with_redraw de #294)
 *     → deja respirar el cuadro y pulsa Espacio;
 *   · escena avanzando sola o FX pintándose → espera sin teclear;
 *   · se abre un getstring (el mantra del interrogatorio) → DEVUELVE el control
 *     al guion (el paso siguiente lo teclea);
 *   · todo drenado durante `quietoMs` → fin. Ni un >Pass de sobra.
 */
function conduceEscena({ maxMs = 90000, quietoMs = 1800, pollMs = 300, keywaitMs = 900, minMs = 2500 } = {}) {
  return {
    ejecuta: async (page) => {
      const t0 = Date.now();
      let quietoDesde = null;
      while (Date.now() - t0 < maxMs) {
        const st = await page.evaluate(() => {
          const t = window.__u5test;
          const p = t.scenePacers?.() ?? {};
          return {
            keyWait: Boolean(p.shrineKeyWait),
            escena: Boolean(p.shrineScene) || Boolean(p.blackthornScene),
            fx: Boolean(t.fxActive?.()),
            prompt: t.promptType?.() ?? null,
          };
        });
        if (st.prompt === "text" || st.prompt === "rune" || st.prompt === "number") return;
        if (st.keyWait) {
          quietoDesde = null;
          await page.waitForTimeout(keywaitMs);
          await page.locator("body").press(" ");
          continue;
        }
        if (st.escena || st.fx) {
          quietoDesde = null;
          await page.waitForTimeout(pollMs);
          continue;
        }
        // `minMs` = gracia de arranque: la escena puede tardar unos beats en armarse
        // y un corte por «quieto» ANTES de eso la dejaría sin conducir.
        if (Date.now() - t0 >= minMs) {
          quietoDesde ??= Date.now();
          if (Date.now() - quietoDesde >= quietoMs) return;
        }
        await page.waitForTimeout(pollMs);
      }
      console.warn("  (conduceEscena agotó su presupuesto de tiempo)");
    },
  };
}

/**
 * Conductor de COMBATE con puntería y PRESUPUESTO DE ATASCO por objetivo
 * (auditoría 22-08, dungeon-tesoro: el desatasco por cruce de eje OSCILABA contra
 * un slime inalcanzable tras la fila de cofres — 46 s de «South Blocked!» y la
 * fase de botín llegó con el combate vivo). Cada golpe va POR EL HANDLER
 * (a + flecha); la flecha mira al enemigo vivo más próximo CUYO presupuesto no
 * esté agotado. Un atasco (la tecla no movió y d>1) consume presupuesto del
 * objetivo y ROTA la dirección probada (eje mayor → menor → sus inversas = rodear,
 * no oscilar). Agotados TODOS los presupuestos, último recurso: la costura
 * declarada del endgame («colocar, no navegar») — poner al PJ activo adyacente al
 * objetivo y atacar por el handler, para que el combate TERMINE dentro del clip.
 * `debilita` mantiene el bando enemigo a hp=1 (los slimes divididos nacen sin
 * debilitar) y re-blinda el HP del party (el veneno pica por turno).
 */
function conduceCombate({ iter = 40, beatMs = 650, golpeMs = 150, presupuesto = 5, debilita = false } = {}) {
  return async (page) => {
    let prev = null;
    let rot = 0;
    const atascos = new Map(); // idx del enemigo → atascos acumulados
    // Techo de esperas por estado (ver la rama `pasa`): acota el bucle si la tanda
    // enemiga nunca cediera el turno. 128 = la guarda `pumpGuard` de combat-pacer.ts.
    let esperas = 0;
    for (let i = 0; i < iter; i++) {
      const st = await page.evaluate((deb) => {
        const c = window.__u5test.game.combat;
        if (!c || c.over) return null;
        if (deb)
          for (const u of c.combatants)
            if (u.kind === "player" && u.hp > 0) u.hp = Math.max(u.hp, 60);
        const cur = c.currentUnit;
        if (!cur || cur.kind !== "player") return { pasa: true };
        const vivos = [];
        c.combatants.forEach((u, idx) => {
          if (u.kind === "enemy" && u.hp > 0) {
            if (deb && u.hp > 1) u.hp = 1;
            vivos.push({ idx, x: u.x, y: u.y });
          }
        });
        if (!vivos.length) return null;
        return { x: cur.x, y: cur.y, vivos };
      }, debilita);
      if (!st) break;
      if (st.pasa) {
        // 🔴 `iter` ES UN PRESUPUESTO DE TURNOS DE JUGADOR, Y ESTA RAMA SE LO COMÍA
        // (carril video-novedades, 25-08). Con beat 0 (webdriver) la tanda enemiga drena
        // SÍNCRONA y esta rama casi no se toca; con los pacers VIVOS (`pacersVivos` →
        // beat 400, o `?combeat`) la tanda dura beat × nº de enemigos y CADA vuelta de
        // espera gastaba una unidad del presupuesto. MEDIDO en la azotea del Palacio
        // (loc 18 z=3, gárgolas #114/#122), `iter=40`:
        //
        //   beat 0     →  0/40 vueltas en espera · 40 turnos de PJ · gárgolas 1→3
        //   beat 400   →  1/40 vueltas en espera · 39 turnos de PJ · gárgolas 1→5
        //   beat 1000  → 10/40 vueltas en espera · 30 turnos de PJ · gárgolas 1→2  ← rota
        //
        // Ésa es la causa MEDIDA del «el guion se queda sin turnos» que el carril
        // video-espejo-sbs reportó al subir `?combeat` a 1000. Aquí se espera POR ESTADO
        // a que el pacer quede ocioso y la vuelta NO gasta presupuesto (`i--`). Tras el
        // arreglo: beat 1000 → 40 turnos de PJ y gárgolas 1→5, y beat 0 queda BYTE-IGUAL
        // (la sonda es siempre falsa bajo webdriver: 40 turnos, 1→3, 30,1 s vs 30,2 s).
        //
        // 🔴 Y lo que NO se añade, porque se midió DAÑINO: cerrar con ESC el Aim
        // encadenado (`__u5test.combatAim`, el remedio de nav.ts §8.1-bis). Aquí la
        // cadena de armas re-abre el Aim tras CADA ataque, y el ESC CONSUME el golpe
        // pendiente (COMSUBS 0x0504 @0x06ea) ⇒ cancela el arma siguiente de cada actor:
        // medido 31 ESC y CERO divisiones. El remedio de nav.ts es de SU bucle, no de éste.
        const sonda = await page.evaluate(() => {
          const t = window.__u5test;
          return t?.combatPacer ? t.combatPacer().active : null;
        });
        if (sonda === null) {
          // Build sin el hook DEV: degrada al comportamiento histórico (gasta vuelta).
          await page.waitForTimeout(500);
          continue;
        }
        if (esperas++ < 128) {
          await page
            .waitForFunction(
              () => {
                const t = window.__u5test;
                const c = t?.game?.combat;
                if (!c || c.over) return true;
                return !t.combatPacer().active && c.currentUnit?.kind === "player";
              },
              undefined,
              { timeout: 30_000 },
            )
            .catch(() => {});
          i--; // la espera NO es un turno: no gasta presupuesto
          continue;
        }
        await page.waitForTimeout(500);
        continue;
      }
      const conDist = st.vivos
        .map((e) => ({ ...e, d: Math.abs(e.x - st.x) + Math.abs(e.y - st.y) }))
        .sort((a, b) => a.d - b.d);
      let obj = conDist.find((e) => (atascos.get(e.idx) ?? 0) < presupuesto);
      if (!obj) {
        // Último recurso: colocar (costura declarada, como endgame-absorcion) y atacar.
        obj = conDist[0];
        await page.evaluate((tIdx) => {
          const c = window.__u5test.game.combat;
          const cur = c?.currentUnit;
          const e = c?.combatants[tIdx];
          if (!c || !cur || cur.kind !== "player" || !e) return;
          cur.x = e.x;
          cur.y = e.y + 1; // adyacente por el sur: el ataque va al norte
        }, obj.idx);
        atascos.clear();
        prev = null;
        await page.waitForTimeout(300);
        await page.locator("body").press("a");
        await page.waitForTimeout(golpeMs);
        await page.locator("body").press("ArrowUp");
        await page.waitForTimeout(beatMs);
        continue;
      }
      const dx = obj.x - st.x;
      const dy = obj.y - st.y;
      const atascado = prev && prev.x === st.x && prev.y === st.y && prev.obj === obj.idx && prev.d > 1;
      if (atascado) {
        atascos.set(obj.idx, (atascos.get(obj.idx) ?? 0) + 1);
        rot++;
      } else {
        rot = 0;
      }
      const mayorEjeX = Math.abs(dx) >= Math.abs(dy);
      const haciaX = dx > 0 ? "ArrowRight" : "ArrowLeft";
      const haciaY = dy > 0 ? "ArrowDown" : "ArrowUp";
      const inversaX = dx > 0 ? "ArrowLeft" : "ArrowRight";
      const inversaY = dy > 0 ? "ArrowUp" : "ArrowDown";
      const orden = mayorEjeX ? [haciaX, haciaY, inversaY, inversaX] : [haciaY, haciaX, inversaX, inversaY];
      const dir = orden[rot % 4];
      prev = { x: st.x, y: st.y, obj: obj.idx, d: obj.d };
      if (obj.d <= 1) {
        await page.locator("body").press("a");
        await page.waitForTimeout(golpeMs);
      }
      await page.locator("body").press(dir);
      await page.waitForTimeout(beatMs);
    }
    // El modelo de Attack es de CURSOR DE AIM (main.ts handleCombatKey, COMSUBS
    // 0x0504): 'a' abre la cruz y las flechas la MUEVEN EN SILENCIO. El alternado
    // a→flecha→a del bucle remata, pero al caer el último enemigo puede quedar un
    // «Attack-Aim!» ABIERTO que se traga todas las flechas de la fase siguiente sin
    // eco alguno (medido 22-08 con la sonda probe-tesoro-loot: el PJ clavado en
    // (8,7) y 18 flechas mudas). Se cancela SIEMPRE al salir.
    await page.locator("body").press("Escape");
    await page.waitForTimeout(400);
  };
}

export const EVENTOS = {
  // ─── humo del pipeline: pasear desde el momento-01 (Iolo's Hut) ───
  "humo-paseo": {
    titulo: "Humo: paseo desde Iolo's Hut",
    pieles: ["shader"],
    siembra: { momento: "momento-01" },
    guion: [
      { press: "ArrowUp" },
      { press: "ArrowUp" },
      { press: "ArrowRight" },
      { press: "ArrowRight" },
      { press: "ArrowDown" },
      { press: "ArrowLeft" },
      { espera: 1000 },
    ],
    colaMs: 1000,
  },

  // ─── censo P2 #24: intro/atract — logos, título, gitana en el menú ───
  // La cinemática es fiel en AMBAS pieles (main.ts:640-648): se graba una vez.
  "intro-atract": {
    titulo: "Intro fiel: logos, título y menú",
    pieles: ["faithful"],
    siembra: { url: "?", sinMundo: true },
    calienteMs: 500,
    guion: [
      { espera: 60000 }, // logos + título + attract corren solos
    ],
    colaMs: 2000,
  },

  // ─── censo #8: destrucción de Shadowlord con el shard (ritual completo) ───
  // Guiones ya verificados por #158/#222 (comentarios de derivación en cada .txt).
  "shadowlord-shard-faulinei": {
    titulo: "Faulinei destruido con el Shard (Lycaeum)",
    pieles: ["shader", "faithful"],
    siembra: { momento: "momento-03" },
    // Corta en el doom (t≈13,7 s medido): los 31 s siguientes del guion grabado eran
    // paseo con 11 `Blocked!`, TODOS posteriores al doom (sidecar de la tanda cine).
    guion: [guionPartidaHasta("faulinei", /doom of the Shadowlord/i)],
    // 🔴 EL COMENTARIO QUE HABÍA AQUÍ ERA FALSO Y SE RETIRA (carril fx-ritual-shard, 22-08).
    // Decía: «El ritual del shard NO tiene FX portado (ritual.ts:170-183, AV Clase C):
    // `fxActive` se queda arriba 12,1 s sin pintar nada. Se acota el drenaje en vez de
    // grabar la espera» — y contradecía al comentario de DOS LÍNEAS más arriba, en la misma
    // entrada, que decía lo contrario («los 3 quakes + explosión + fanfarria duran de
    // verdad»). Los FX SÍ están portados: los emite `use-tools.ts:106-137` (3 `{kind:"quake"}`
    // + `cell-explosion` bursts 7) y los pintan LAS DOS pieles (`world-fx.ts` +
    // `shader/skin.ts` (2e-bis)/(2f), pareados por #243). Lo que `ritual.ts:170-183` marca
    // como AV es el docblock de la MÁQUINA DE ESTADOS PURA, que efectivamente no pinta: la
    // coreografía vive en el manejador, no en el reductor.
    //
    // Y `fxActive` arriba ~12 s SIN PINTAR NADA es FIEL, no un flag colgado: es el `leadMs`
    // de #208. `planTurnPhase` (ejecutado, no estimado) sobre el lote REAL de `useShard`:
    //   quakes=3 · quakeStartMs=7130 · quakeEnd=9938 · explosión lead=9938 end=10523
    // Los 7130 ms son el `shard-sweep` de `CAST 0x15dd-0x162a`, que en el binario BLOQUEA el
    // hilo antes de que nada visual ocurra (0x1674 `push 7; call 0x7b66` va DESPUÉS del
    // barrido). ⇒ el último píxel en movimiento cae en t₀+10,5 s.
    //
    // ⇒ CON `drenajeMaxMs: 1500` el clip cortaba en t₀+1,5 s: 6,3 s ANTES de que empezara la
    // sacudida. Medido sobre la toma de 18:52 (25 fps, crop del viewport 760:800:0:0): doom en
    // t=12,97 · fin en 17,16 · movimiento máximo tras el doom = 1,69 en DOS fotogramas
    // sueltos (t=15,36-15,40) y ≤0,13 en todo lo demás. No es que no se pinte: es que el clip
    // se acaba antes. El propio grabador lo avisaba en cada corrida —«fxActive no drenó en
    // 1500 ms — corte con FX vivo»— y ese aviso se leyó como confirmación de la ausencia.
    // El drenaje cubre ahora los 10,5 s + margen; la cola muda que eso deja es la CLASE
    // `_climaxMudo` de `expectativas.json`, declarada allí con su cifra (como camp-aparición
    // y codice-ceremonia), no recortada aquí.
    drenajeMaxMs: 14000,
    colaMs: 800,
  },
  "shadowlord-shard-astaroth": {
    titulo: "Astaroth destruido con el Shard (Empath Abbey)",
    pieles: ["shader"],
    siembra: { momento: "momento-04" },
    guion: [guionPartidaHasta("astaroth", /doom of the Shadowlord/i)],
    drenajeMaxMs: 14000, // idem faulinei: el clip tiene que llegar a t₀+10,5 s
    colaMs: 800,
  },
  "shadowlord-shard-nosfentor": {
    titulo: "Nosfentor destruido con el Shard (Serpent's Hold)",
    pieles: ["shader"],
    siembra: { momento: "momento-05" },
    guion: [guionPartidaHasta("nosfentor", /doom of the Shadowlord/i)],
    drenajeMaxMs: 14000, // idem faulinei: el clip tiene que llegar a t₀+10,5 s
    colaMs: 800,
  },

  // ─── censo #2 (parte A): la cámara de Blackthorn — puerta mágica + skull key ───
  "blackthorn-camara": {
    titulo: "La cámara de Blackthorn (skull key)",
    pieles: ["shader", "faithful"],
    siembra: { momento: "momento-06" },
    // Corta 6 teclas después del «Opened!» (t≈14,0 s medido) — lo justo para VER entrar a
    // la cámara. El guion grabado seguía 29 s más de paseo por el tejado, con el único
    // `Blocked!` del clip dentro (t=24,6 s): el 61 % de cola que la verificación anotó
    // como «no declarado» desaparece en el origen en vez de excusarse con un umbral.
    guion: [guionPartidaHasta("blackthorn", /Opened!/, { extraPasos: 6 })],
    colaMs: 2000,
  },

  // ─── censo #19: antorcha «Borrowed!» — sconce real del castillo de LB (10,8) ───
  "torch-borrowed": {
    titulo: "Antorcha Borrowed! (sconce del castillo)",
    pieles: ["shader"],
    siembra: { deeplink: { loc: 17, floor: 0, x: 9, y: 8 } },
    guion: [{ press: "g" }, { press: "ArrowRight", tras: 1200 }, { press: "ArrowLeft" }, { press: "ArrowLeft" }],
    colaMs: 1500,
  },

  // ─── censo P2 #31: espejo roto — tile 0x9D del castillo de LB (8,7) ───
  "espejo-roto": {
    titulo: "Espejo roto (Attack al espejo)",
    pieles: ["shader"],
    siembra: { deeplink: { loc: 17, floor: 0, x: 7, y: 7 } },
    guion: [
      { press: "ArrowRight", tras: 600 }, // asomarse (el espejo refleja)
      { press: "a" },
      { press: "ArrowRight", tras: 1500 },
      { press: "ArrowDown" },
    ],
    colaMs: 1500,
  },

  // ─── censo P2 #27: clavicémbalo → melodía 6789878767653 → quake + pasadizo ───
  "clavicembalo-pasadizo": {
    titulo: "Clavicémbalo: la melodía del pasadizo",
    pieles: ["shader"],
    siembra: { deeplink: { loc: 17, floor: 2, x: 17, y: 17 } },
    guion: [
      ..."6789878767653".split("").map((d) => ({ press: d, tras: 450 })),
      { espera: 2500 }, // terremoto + pasadizo (17,13)
      { press: "ArrowUp" },
      { press: "ArrowUp" },
      { press: "ArrowUp" },
      { press: "ArrowUp", tras: 800 },
      { press: "ArrowUp", tras: 800 }, // cruza el hueco del muro (17,13) hacia el cuarto secreto
      { press: "ArrowUp", tras: 800 },
    ],
    colaMs: 2000,
  },

  // ─── censo P2 #29: cataratas F-A-L-L-S!!! en esquife — (54,137) es LA entrada al Underworld ───
  cataratas: {
    titulo: "Cataratas: FALLS! y caída al Underworld",
    pieles: ["shader"],
    siembra: { deeplink: { loc: 0, x: 54, y: 135 } },
    preparar: async (page) => {
      // Esquife bajo el party en el río (patrón seedShipAndBoard de naval.spec.ts:51).
      await page.evaluate(() => {
        const g = window.__u5test.game;
        const p = g.state.position;
        window.__u5test.addWorldObject({
          location: p.location,
          floor: p.floor,
          x: p.x,
          y: p.y,
          tile: 0x28 + 0x100,
          kind: "ship",
          hull: 99,
          skiffs: 0,
        });
      });
    },
    guion: [
      { press: "b", tras: 1200 }, // aborda el esquife
      { press: "ArrowDown", tras: 2000 }, // (54,136): la catarata queda al sur → F-A-L-L-S!!!
      { espera: 2500 }, // arrastre +2 → (54,138) = «Falling into underworld!!»
      { press: "ArrowDown", tras: 1200 },
      { press: "ArrowDown", tras: 1200 },
    ],
    colaMs: 2500,
  },

  // ─── censo #9: moongate — puerta activa de noche (fase 0 en 224,133), cruce con FX ───
  "moongate-transit": {
    titulo: "Moongate: cruce nocturno con FX",
    pieles: ["shader", "faithful"],
    siembra: { deeplink: { loc: 0, x: 225, y: 133, hour: 2 } },
    guion: [
      { espera: 2500 }, // la puerta anima en pantalla (a un paso)
      { press: "ArrowLeft", tras: 1000 },
      { press: "ArrowLeft", tras: 1000 },
      { press: "ArrowLeft", tras: 4000 }, // pisa la puerta → cierre 16 etapas + hold 650 ms + destino (38,224)
      { press: "ArrowRight", tras: 800 },
      { press: "ArrowRight" },
    ],
    colaMs: 2500,
  },

  // ─── censo #4: santuario ORDAINED — Honestidad (233,66), virtud + mantra ×3 ───
  "shrine-ordained": {
    titulo: "Santuario de la Honestidad: ORDAINED",
    pieles: ["shader"],
    siembra: { deeplink: { loc: 0, x: 233, y: 66 } },
    guion: [
      { press: "e", tras: 2500 }, // escena de aproximación
      { teclea: "honesty", tras: 800 },
      { teclea: "ahm", tras: 800 },
      { teclea: "ahm", tras: 800 },
      { teclea: "ahm", tras: 4000 }, // ORDAINED: la quest dictada (melodía de 7 notas)
      { press: " ", tras: 1500 }, // un solo keywait de cierre
    ],
    colaMs: 3000,
  },

  // ─── censo #5: WELL DONE — lección del Códice + Sacred Quest activa ───
  "shrine-well-done": {
    titulo: "Santuario: WELL DONE (inversión + quake)",
    pieles: ["shader", "faithful"],
    siembra: { deeplink: { loc: 0, x: 233, y: 66 } },
    preparar: async (page) => {
      await page.evaluate(() => {
        window.__u5debug.setOptionalNumber("shrineVisitedBitmap", 0x01);
        window.__u5debug.setOptionalNumber("shrineQuestBitmap", 0x01);
      });
    },
    guion: [
      { press: "e", tras: 2500 },
      { teclea: "honesty", tras: 800 },
      { teclea: "ahm", tras: 800 },
      { teclea: "ahm", tras: 800 },
      { teclea: "ahm", tras: 8500 }, // WELL DONE: inversión 6 277 ms + quake
      { press: " ", tras: 1500 },
    ],
    colaMs: 3000,
  },

  // ─── censo #6: donación — lección aprendida, sin quest ───
  "shrine-donacion": {
    titulo: "Santuario: donación (inversión)",
    pieles: ["shader"],
    siembra: { deeplink: { loc: 0, x: 233, y: 66 } },
    preparar: async (page) => {
      await page.evaluate(() => {
        window.__u5debug.setOptionalNumber("shrineVisitedBitmap", 0x01);
        window.__u5debug.setOptionalNumber("shrineQuestBitmap", 0x00);
      });
    },
    guion: [
      { press: "e", tras: 2500 },
      { teclea: "honesty", tras: 800 },
      { teclea: "ahm", tras: 800 },
      { teclea: "ahm", tras: 800 },
      { teclea: "ahm", tras: 1500 },
      // El prompt de donación es un getkey de UN dígito (CAST2 0x0B1D, submitDonation:
      // dona 100·n gp) — NO un getstring: el `teclea:"100"` de la toma auditada dejó
      // que los dos ceros sobrantes cayeran al despachador como Set Active Player
      // («Set Active Plr: None!» ×2, TABLA.md 22-08). Un solo '1' = 100 gp.
      // El `7000` NO se toca: es la ventana de la INVERSIÓN, medida en la hoja de contacto
      // a 1 fps de la toma cine (pantalla en negativo de t≈13,0 a t≈19,5 = 6,5 s, del
      // orden de los 6 277 ms de shrine-well-done). Lo que sobraba era la cola de después.
      { press: "1", tras: 7000 }, // donación → ALAKAZAM! + inversión de pantalla
    ],
    colaMs: 1200,
  },

  // ─── censo #1: ceremonia del Códice — 7/8 + quest de Humildad, se completa ante el atril ───
  "codice-ceremonia": {
    titulo: "Ceremonia del Códice (bracket XOR + quakes)",
    pieles: ["shader", "faithful"],
    siembra: { deeplink: { loc: 0, x: 233, y: 233 } },
    preparar: async (page) => {
      await page.evaluate(() => {
        window.__u5debug.setOptionalNumber("shrineVisitedBitmap", 0x7f);
        window.__u5debug.setOptionalNumber("shrineQuestBitmap", 0x80);
      });
    },
    guion: [
      { press: "e", tras: 3000 }, // aproximación al atril (7 pasos)
      // Keywaits + bracket ×3 POR ESTADO: la tanda fija de 10 espacios ×1800 ms de la
      // toma auditada sobraba en ~5 y la mitad del clip era «>Pass» ante el santuario
      // (TABLA.md 22-08). El conductor pulsa SOLO en keywait real y corta al drenar.
      conduceEscena({ maxMs: 60000, keywaitMs: 1500 }),
    ],
    // Con los pacers del rito VIVOS la ceremonia dura 37 s (era 14): el bracket XOR y los
    // quakes ya ocupan la cola que estos 4000 rellenaban a mano. Recortada a 1500.
    colaMs: 1500,
  },

  // ─── censo #18: Bad taste — fuente sembrada (sub 3) bajo el party en Deceit ───
  "bad-taste": {
    titulo: "Bad taste (fuente de mazmorra)",
    pieles: ["shader"],
    siembra: { deeplink: { loc: 0, x: 100, y: 100 } },
    preparar: async (page) => {
      await page.evaluate(() => {
        const t = window.__u5test;
        window.__u5debug.setResource("torchTurns", 100);
        t.game.enterDungeon(33);
        const ds = t.game.dungeonState;
        ds.setCell(ds.pos.floor, ds.pos.x, ds.pos.y, { type: 0x5, sub: 3 });
      });
    },
    guion: [
      { espera: 1500 },
      { press: "d", tras: 800 },
      { press: "y", tras: 2500 }, // Gulp! → Bad taste + damage-script
      { press: "d", tras: 800 },
      { press: "y", tras: 2500 },
    ],
    colaMs: 2000,
  },

  // ─── censo #21: combate base — enemigo sembrado, A+dirección, VICTORY ───
  "combate-base": {
    titulo: "Combate en el overworld (inicio → VICTORY)",
    pieles: ["shader", "faithful"],
    query: { combeat: 400 },
    siembra: { deeplink: { loc: 0, x: 60, y: 60 } },
    preparar: async (page) => {
      await page.evaluate(() => {
        window.__u5test.game.overworldEnemies.enemies.push({
          defIndex: 0,
          tile: 0x94,
          water: false,
          x: 61,
          y: 60,
        });
      });
    },
    guion: [
      { espera: 800 },
      { press: "a" },
      { press: "ArrowRight", tras: 2000 }, // entra al combate
      {
        ejecuta: async (page) => {
          // Combate REAL por el handler; se debilita al bando enemigo para que el
          // desenlace quepa en el clip (los golpes siguen siendo los del port), y se
          // blinda el HP del party (22-08: en la toma fiel Shamino (5 HP de plantilla)
          // cayó al segundo golpe y el clip acabó con un muerto y sin VICTORY).
          await page.evaluate(() => {
            const c = window.__u5test.game.combat;
            if (c)
              for (const u of c.combatants) {
                if (u.kind === "enemy") u.hp = 1;
                else u.hp = Math.max(u.hp, 60);
              }
          });
        },
      },
      {
        // Conductor compartido con puntería + presupuesto de atasco (ver conduceCombate:
        // sustituye al cruce-de-eje simple, que oscilaba contra bloqueos persistentes).
        ejecuta: conduceCombate({ iter: 40, beatMs: 650, golpeMs: 150, debilita: true }),
      },
      { espera: 3500 }, // VICTORY + fanfarria + botín + vuelta al mundo
    ],
    colaMs: 2500,
  },

  // ─── censo #14: refuge — party entera caída → escena + despertar con LB ───
  "refuge-resurreccion": {
    titulo: "Refuge: muerte total y despertar con Lord British",
    pieles: ["shader", "faithful"],
    siembra: { deeplink: { loc: 0, x: 100, y: 100 } },
    preparar: async (page) => {
      await page.evaluate(() => {
        const s = window.__u5test.state();
        for (let i = 0; i < s.partySize; i++) {
          s.characters[i].status = "D";
          s.characters[i].currentHp = 0;
        }
      });
    },
    guion: [
      { press: " ", tras: 2000 }, // el turno siguiente dispara checkRefuge
      // ★ CORTE POR ESTADO (ficha gate-viewport 23-08: 10,9 s de imagen congelada en la
      // toma FIEL). La escena es un MODAL a reloj de pared (runRefugeScene, main.ts) y su
      // duración REAL depende de la piel/beats — la espera fija de 15 s sobraba varios
      // segundos y, sumada al «espera 4000» + colaMs 2500 del despertar, dejaba una cola
      // muerta que el gate mide sobre la IMAGEN. Se espera el DESENLACE (resolveRefuge →
      // partyRefuge: status 'G' + castillo de LB), no un número de ms — la regla 22-08 de
      // este fichero: ningún paso fijo que no lea estado.
      { esperaFn: "window.__u5test.state().characters[0].status === 'G'", timeout: 45000 },
      { espera: 1500 }, // el castillo recién revelado se LEE (transición visible)
      { press: " ", tras: 1200 }, // dos turnos: los NPC del castillo se mueven (imagen viva)
      { press: " ", tras: 1200 },
    ],
    colaMs: 1500,
  },

  // ─── censo #7: Shadowlord urbano — Minoc con Falsehood localizado: anuncio + wither ───
  "shadowlord-ciudad": {
    titulo: "Shadowlord en Minoc: anuncio y marchitación",
    pieles: ["shader"],
    siembra: { deeplink: { loc: 0, x: 159, y: 20 } }, // tile de Minoc (verificado con E → loc 5)
    preparar: async (page) => {
      await page.evaluate(() => {
        window.__u5debug.setWorldArrayElement("shadowlordLocs", 0, 5); // Falsehood en Minoc
      });
    },
    guion: [
      { press: "e", tras: 4000 }, // entra → «An air of Falsehood doth surround thee...» + sprite 0xFC
      { press: "ArrowUp", tras: 800 },
      { press: "ArrowUp", tras: 800 },
      { press: "ArrowUp", tras: 800 },
      { press: "ArrowRight", tras: 800 },
      { press: "ArrowRight", tras: 800 },
      { press: "ArrowUp", tras: 800 },
    ],
    colaMs: 2000,
  },

  // ─── censo P2 #33: vista de gema ───
  "gema-vista": {
    titulo: "View a gem (mapa de gema)",
    pieles: ["shader"],
    siembra: { deeplink: { loc: 0, x: 81, y: 104 } }, // ante Britain
    preparar: async (page) => {
      await page.evaluate(() => window.__u5debug.setResource("gems", 3));
    },
    guion: [
      { press: "v", tras: 4000 }, // el mapa de gema se pinta
      { press: " ", tras: 1500 },
      { press: "ArrowUp", tras: 600 },
    ],
    colaMs: 1500,
  },

  // ─── censo #16: fragata + X-it round-trip en la costa (naval.spec COAST 245,61) ───
  "naval-xit": {
    titulo: "Fragata: velas, navegación y X-it",
    pieles: ["shader"],
    siembra: { deeplink: { loc: 0, x: 245, y: 61 } },
    preparar: async (page) => {
      await page.evaluate(() => {
        const g = window.__u5test.game;
        const p = g.state.position;
        window.__u5test.addWorldObject({
          location: p.location,
          floor: p.floor,
          x: p.x,
          y: p.y,
          tile: 0x24 + 0x100,
          kind: "ship",
          hull: 99,
          skiffs: 1,
        });
      });
    },
    guion: [
      { press: "b", tras: 1200 }, // Board — fragata velas arriadas
      { press: "y", tras: 1200 }, // HOIST!
      { press: "ArrowUp", tras: 800 },
      { press: "ArrowUp", tras: 800 },
      { press: "ArrowDown", tras: 800 },
      { press: "ArrowDown", tras: 800 },
      { press: "y", tras: 1200 }, // FURL!
      { press: "x", tras: 1500 }, // X-it → tierra (243,61 al oeste)
      { press: "ArrowLeft", tras: 800 },
      { press: "ArrowLeft", tras: 800 },
    ],
    colaMs: 2000,
  },

  // ─── censo #11: remolino — persigue a la fragata y traga al party ───
  whirlpool: {
    titulo: "Remolino: succión al Underworld",
    pieles: ["shader"],
    siembra: { deeplink: { loc: 0, x: 250, y: 120 } },
    preparar: async (page) => {
      await page.evaluate(() => {
        const g = window.__u5test.game;
        const p = g.state.position;
        window.__u5test.addWorldObject({
          location: p.location,
          floor: p.floor,
          x: p.x,
          y: p.y,
          tile: 0x24 + 0x100,
          kind: "ship",
          hull: 99,
          skiffs: 1,
        });
        // Remolinos ADYACENTES que persiguen (defIndex 43, sprite 0x1ec — bug #63: 0xec
        // es ID de encuentro, no defIndex; el despacho es por sprite, enemies.ts:80-86).
        // Dos, flanqueando: el chase es rand(0,1) en el turno ON — dos duplican la caza.
        g.overworldEnemies.enemies.push({ defIndex: 43, tile: 0x1ec, water: true, x: 252, y: 120, phase: 0 });
        g.overworldEnemies.enemies.push({ defIndex: 43, tile: 0x1ec, water: true, x: 249, y: 121, phase: 1 });
      });
    },
    guion: [
      { press: "b", tras: 1000 },
      // Pasar turnos SOLO hasta que la succión ocurra: el remolino escribe
      // position.floor=0xff (whirlpoolRelocate, hazards.ts:207). La tanda fija de 30
      // espacios de la toma auditada siguió pasando turnos EN el Underworld — 23 s
      // (79 % del clip) de «>Pass» (TABLA.md 22-08).
      {
        pulsaHasta: "window.__u5test.state().position.floor === 0xff",
        tecla: " ",
        cada: 600,
        max: 40,
      },
      // COLA DE MONTAJE (tanda cine 22-08): el `4000` heredado dejaba 8,0 s de nada tras
      // «WHIRLPOOL!» (70 % del clip, medido por el sidecar: última fila t=3,36 · fin
      // t=11,3). La llegada al Underworld se lee de sobra en 1,5 s — muy por encima del
      // `pausaMinS` 0,4 del gate — y la cola cae por debajo del suelo absoluto de 5 s.
      { espera: 1000 }, // WHIRLPOOL! + llegada al Underworld (34,18), que se vea
    ],
    colaMs: 800,
  },

  // ─── censo #12: healer de Minoc — cura de pago con HealerLightFlash ───
  "healer-flash": {
    titulo: "Healer de Minoc: cura con destello",
    pieles: ["shader", "faithful"],
    siembra: { deeplink: { loc: 5, floor: 0, x: 10, y: 26, hour: 9 } },
    preparar: async (page) => {
      await page.evaluate(() => {
        window.__u5debug.setCharacterNumber(0, "currentHp", 5); // que la cura se vea
        window.__u5debug.setResource("gold", 500);
        window.__u5debug.teleportSmallMap(5, 0, 6, 25); // al norte del puesto (6,26)
      });
    },
    guion: [
      { espera: 1200 },
      { press: "t" },
      { press: "ArrowDown", tras: 2000 }, // Talk al healer
      {
        ejecuta: async (page) => {
          // Conductor POR FASE de la consola del curandero (shop-console.ts): la toma
          // auditada iba a tiempos fijos y la «y» de pagar cayó en «any other way?» —
          // el clip acabó con «What is the nature of thy need?» ABIERTO 5 s
          // (TABLA.md 22-08). Cada respuesta se da cuando SU fase está en pantalla:
          //   greet-yn → y · healer-need → h · «Who needs my aid?» (party-select) → 1
          //   healer-pay → y (pago → jingle + flash XOR) · healer-again → n (cierra).
          const respuestas = { "greet-yn": "y", "healer-need": "h", "healer-pay": "y", "healer-again": "n" };
          let ultima = null;
          let ultimaT = 0;
          const t0 = Date.now();
          while (Date.now() - t0 < 45000) {
            const st = await page.evaluate(() => ({
              abierta: window.__u5test.shopOpen?.() ?? false,
              fase: window.__u5test.shopConsole?.()?.phase ?? null,
              prompt: window.__u5test.promptType?.() ?? null,
              fx: Boolean(window.__u5test.fxActive?.()),
            }));
            if (!st.abierta) break; // despedida impresa: la sesión cerró sola
            if (st.prompt === "party-select") {
              await page.waitForTimeout(800); // «Who needs my aid?» legible
              await page.locator("body").press("1"); // el Avatar (5 HP sembrados)
              await page.waitForTimeout(1200);
              continue;
            }
            const k = st.fase ? respuestas[st.fase] : null;
            const repite = st.fase === ultima && Date.now() - ultimaT > 4000;
            if (k && (st.fase !== ultima || repite)) {
              // El adiós espera al flash: el pago dispara las 3 ventanas XOR y el
              // «n» solo va cuando el FX drenó (el destello se ve ENTERO).
              if (st.fase === "healer-again" && st.fx) {
                await page.waitForTimeout(300);
                continue;
              }
              await page.waitForTimeout(st.fase === "healer-again" ? 1500 : 1200); // ritmo humano
              await page.locator("body").press(k);
              ultima = st.fase;
              ultimaT = Date.now();
              continue;
            }
            await page.waitForTimeout(350);
          }
        },
      },
      { espera: 1500 }, // la despedida del healer en pantalla
    ],
    colaMs: 2500,
  },

  // ─── censo #13: resurrección por In Mani Corp (pergamino) ───
  // 22-08 (regrabación): la toma auditada tecleaba `"in mani corp"` CON ESPACIOS y el
  // getstring confirmaba por iniciales en el primer espacio (IN NOX) mientras el resto
  // derramaba como comandos — el evento titulado NO estaba en el vídeo (TABLA.md).
  // El tecleo correcto por (C)ast sería `imc` (matchSpellByInitials, como el `vrp` de
  // moongate-piedra), PERO la rama `resurrect` del (C)ast de overworld NO está portada:
  // doCast (main.ts:3898-3947) enumera healTarget/cure/awaken/gateTravel/… y `resurrect`
  // cae al vacío — consume hechizo+MP y no abre el «On who:» (cast.ts:288 sí devuelve el
  // efecto; el aplicador de combate main.ts:2888 y el de PERGAMINO main.ts:4295 sí lo
  // manejan; la ventana temporal 0x0e de tables.ts:23 permite lanzarlo en exterior).
  // DEFECTO DE PORT FICHADO (no del arnés — no se arregla desde este carril): el vídeo
  // va por la ruta portada, el pergamino de In Mani Corp (useScroll.ts caso 6:
  // «Resurrection!» + picker), que es el MISMO hechizo en el campo.
  "resurreccion-hechizo": {
    titulo: "In Mani Corp: resurrección en el campo",
    pieles: ["shader"],
    siembra: { deeplink: { loc: 0, x: 100, y: 100 } },
    preparar: async (page) => {
      await page.evaluate(() => {
        window.__u5debug.maximizeAll(); // MP + reagentes + hechizos mezclados
        const s = window.__u5test.state();
        s.characters[1].status = "D"; // Shamino caído
        s.characters[1].currentHp = 0;
        if (Array.isArray(s.scrollQuantities)) s.scrollQuantities.fill(0);
        if (Array.isArray(s.potionQuantities)) s.potionQuantities.fill(0);
        s.scrollQuantities[6] = 1; // el pergamino de In Mani Corp, y solo ése
      });
    },
    guion: [
      { press: "u", tras: 1200 },
      {
        ejecuta: async (page) => {
          // Bajar la barra del picker hasta la fila del pergamino (patrón moongate-piedra).
          for (let i = 0; i < 20; i++) {
            const pk = await page.evaluate(() => window.__u5test.readyPicker?.() ?? null);
            if (!pk || /Mani Corp/.test(pk.rows[pk.cursor]?.name ?? "")) break;
            await page.locator("body").press("ArrowDown");
            await page.waitForTimeout(250);
          }
        },
      },
      { press: "Enter", tras: 2500 }, // "Scroll … Resurrection!" (DS 0x46d2) + On who
      // La resurrección se VE en el roster (Shamino `0D` → `1G`, hoja 1 fps: cambia al
      // cuadro siguiente al «On who: Shamino») y no tiene FX propio, así que los
      // 5000+1500+2500 heredados eran 9,9 s de pantalla congelada — la mayor congelación
      // que midió PARADA-VIS en toda la colección. 2,5 s bastan para leer el roster nuevo.
      { press: "2", tras: 2000 }, // On who? → Shamino (caído) → resucita (applyResurrect)
      { espera: 400 },
    ],
    colaMs: 1000,
  },

  // ─── censo #2 (parte B): captura de Blackthorn — sin insignia, junto a un guardia ───
  // Adyacencia manhattan==1 a un guardia del palacio sin la insignia (blackthorn-capture.ts:267);
  // guardias medidos por sonda en planta 0: (14,6)/(16,6) flanquean el trono.
  "blackthorn-captura": {
    titulo: "Captura en el palacio de Blackthorn",
    pieles: ["shader", "faithful"],
    siembra: { deeplink: { loc: 0, x: 100, y: 100 } },
    preparar: async (page) => {
      await page.evaluate(() => {
        window.__u5debug.setSpecialItem("blackBadge", false);
        window.__u5debug.goToLocation(18, 0);
        window.__u5debug.teleportSmallMap(18, 0, 14, 8);
      });
    },
    guion: [
      { espera: 1500 },
      { press: "ArrowUp", tras: 1500 }, // (14,7): adyacente al guardia de (14,6) → captura
      { press: "ArrowUp", tras: 2000 },
      // Venda + trono + cadenas + keywaits, POR ESTADO hasta que se abra el getstring
      // del mantra (el conductor devuelve el control al ver el prompt). La tanda fija
      // heredada (espera 6000 + espacios contados) dejó ~7 s de «>Pass» en la celda en
      // la toma auditada (TABLA.md 22-08, ya recortada el 22-08 de 30 s a 8 s).
      conduceEscena({ maxMs: 60000, keywaitMs: 2000, minMs: 6000 }),
      { teclea: "ahm", tras: 1000 }, // el mantra CORRECTO cierra el interrogatorio
      // «Merciful death» + sacrificio de Iolo + despertar en la celda: mismos keywaits
      // por estado; el conductor corta al drenar la escena — ni un Pass en la celda.
      conduceEscena({ maxMs: 90000, keywaitMs: 2000 }),
      { espera: 800 },
    ],
    // Cola de montaje recortada en la tanda cine 22-08: con los keywaits del rito VIVOS
    // (pacersVivos) la escena de la celda ya dura lo suyo, y los 2000+3000 heredados
    // quedaban como cola muerta (11,6 s = 63 % en la toma anterior).
    colaMs: 1200,
  },

  // ─── censo #17: sala de mazmorra — combate top-down + siembra de tesoro + Get ───
  "dungeon-tesoro": {
    titulo: "Sala de mazmorra: combate y cofre",
    pieles: ["shader"],
    query: { combeat: 400 },
    siembra: { deeplink: { loc: 0, x: 100, y: 100 } },
    preparar: async (page) => {
      await page.evaluate(() => {
        const t = window.__u5test;
        window.__u5debug.setResource("torchTurns", 240);
        t.game.enterDungeon(33); // Deceit
        const ds = t.game.dungeonState;
        ds.pos.floor = 3;
        ds.pos.x = 3;
        ds.pos.y = 3;
        ds.pos.facing = "south";
        ds.setCell(3, 3, 4, { type: 0xf, sub: 0 }); // Room delante (receta dungeon-room-escape)
      });
    },
    guion: [
      { espera: 1200 },
      { press: "ArrowUp", tras: 2500 }, // «Entering room...» → combate de sala
      {
        ejecuta: async (page) => {
          // 22-08: se debilita al bando (los SLIMES se DIVIDEN al ser golpeados — la
          // toma heredada acabó a los 50 s aún en combate y sin botín) y se blinda el
          // HP del party (Iolo cayó envenenado en esa misma toma). La sala siembra
          // DOCE slimes (medido por sonda): todos a hp=1 — hp=0 NO vale (el turnero
          // se queda esperando el turno del muerto y el combate se congela en «pasa»
          // perpetuo, medido en una toma). `debilita` del conductor mantiene ambas
          // cosas por iteración (divididos incluidos).
          await page.evaluate(() => {
            const c = window.__u5test.game.combat;
            if (c)
              for (const u of c.combatants) {
                if (u.kind === "enemy") u.hp = 1;
                else u.hp = Math.max(u.hp, 60);
              }
          });
          // Conductor compartido: puntería + presupuesto de atasco por objetivo y salto
          // al siguiente alcanzable (la toma auditada: 46 s de «South Blocked!» contra
          // el slime tras la fila de cofres, TABLA.md 22-08). Último recurso: colocar.
          await conduceCombate({ iter: 190, beatMs: 360, golpeMs: 120, presupuesto: 4, debilita: true })(page);
        },
      },
      { espera: 2500 },
      {
        ejecuta: async (page) => {
          // Recoger el botín sembrado: caminar hasta el cofre MÁS CERCANO y G hacia él
          // (22-08: la versión anterior iba a loot[0] con 6 pasos — no llegaba nunca).
          // 🔴 En combate un movimiento BLOQUEADO no consume el turno (Blocked! → sigues
          // tú): un miembro ACORRALADO retiene el turno para siempre y el cruce simple
          // de eje oscila entre sus dos paredes (medido 22-08 con probe-tesoro-loot5:
          // Iolo en (8,7) con oeste Y sur bloqueados). Por eso: rotación de 4
          // direcciones (rodear) y, agotadas, Pass — que camine otro miembro.
          let prev = null;
          let rot = 0;
          let seguidos = 0;
          for (let i = 0; i < 40; i++) {
            const st = await page.evaluate(() => {
              const c = window.__u5test.game.combat;
              if (!c) return null;
              // Re-blindaje: el VENENO de los slimes sigue picando por turno — sin esto
              // Iolo murió en la fase de botín de una toma (22-08, «Iolo killed!»).
              for (const u of c.combatants) if (u.kind === "player" && u.hp > 0) u.hp = Math.max(u.hp, 60);
              // GUARDA de la auditoría 22-08: la fase de botín NO se camina con el
              // combate vivo (la toma auditada cerró con «Nothing to get!» y slime
              // en pie) — con enemigos vivos se cede el turno y punto.
              if (c.combatants.some((u) => u.kind === "enemy" && u.hp > 0)) return { pasa: true };
              const cur = c.currentUnit;
              if (!cur || cur.kind !== "player") return { pasa: true };
              const loot = c.lootTiles ? c.lootTiles() : [];
              if (!loot.length) return null;
              let l = loot[0];
              let dMin = 1e9;
              for (const t of loot) {
                const d = Math.abs(t.x - cur.x) + Math.abs(t.y - cur.y);
                if (d < dMin) { dMin = d; l = t; }
              }
              return { x: cur.x, y: cur.y, dx: l.x - cur.x, dy: l.y - cur.y, d: dMin };
            });
            if (!st) break;
            if (st.pasa) { await page.waitForTimeout(400); continue; }
            const atascado = prev && prev.x === st.x && prev.y === st.y && st.d > 1;
            if (atascado) { rot++; seguidos++; } else { rot = 0; seguidos = 0; }
            if (seguidos >= 4) {
              // Las 4 direcciones probadas y sin moverse: acorralado. Pass, y que
              // el turno pase a un miembro mejor colocado hacia su cofre.
              await page.locator("body").press(" ");
              await page.waitForTimeout(500);
              prev = null;
              seguidos = 0;
              continue;
            }
            const mayorEjeX = Math.abs(st.dx) >= Math.abs(st.dy);
            const haciaX = st.dx > 0 ? "ArrowRight" : "ArrowLeft";
            const haciaY = st.dy > 0 ? "ArrowDown" : "ArrowUp";
            const invX = st.dx > 0 ? "ArrowLeft" : "ArrowRight";
            const invY = st.dy > 0 ? "ArrowUp" : "ArrowDown";
            const orden = mayorEjeX ? [haciaX, haciaY, invY, invX] : [haciaY, haciaX, invX, invY];
            const dir = orden[rot % 4];
            prev = st;
            if (st.d <= 1) {
              const dirCofre = mayorEjeX ? haciaX : haciaY; // SIEMPRE hacia el cofre (no la rotación)
              await page.locator("body").press("o"); // Open al cofre
              await page.waitForTimeout(300);
              await page.locator("body").press(dirCofre);
              await page.waitForTimeout(2500); // «Open-South Found: some food! … a sack of gold!»
              // El Open del port ENTREGA el contenido del cofre (la lista «Found:» con el
              // oro del chestRoll incluido) — el «G» del guion heredado siempre caía en
              // vacío: «Get-South Nothing to get!» en la toma auditada (TABLA.md 22-08)
              // Y en las dos regrabaciones de careo (la celda abierta sigue listada en
              // lootTiles(), así que ni el gate global ni el por-celda lo salvan). El
              // evento del censo (#17, cofre por chestRoll) queda contado por el Open.
              break;
            }
            await page.locator("body").press(dir);
            await page.waitForTimeout(360);
          }
        },
      },
      { espera: 2000 },
    ],
    colaMs: 2500,
  },

  // ─── censo #15: acampada con aparición de Lord British (semilla cazada por sonda) ───
  // Sonda 22-08 (probe-videos.mjs camp): el prompt del vigía es Y/N («Wilt thou set a
  // watch?» → n), NO «0»; y con este deeplink la seed 20 cruza el gate del 25 %
  // (rand(0,99)<25, camp.ts:380) — «An apparition!» medido en consola.
  // 🔴 LAS DOS PIELES desde el 22-08, y NO por gusto: la aparición era la 3ª instancia de
  // la clase #253 (lo que la fiel hornea y la shader pisa al recomponer el viewport) —
  // grabada sólo en shader, el defecto era invisible en la entrega. El careo A/B es lo
  // que lo destapó y lo que vigilaría una reincidencia.
  "camp-aparicion": {
    titulo: "Acampada: la aparición de Lord British",
    pieles: ["shader", "faithful"],
    siembra: { deeplink: { loc: 0, x: 100, y: 100, seed: 20 } },
    guion: [
      { press: "h", tras: 1200 },
      { press: "2", tras: 1200 }, // 2 horas
      { press: "n", tras: 2500 }, // sin vigía → duerme (fogata + durmientes)
      // Las horas a 360 ms + la aparición + los pulsos de inversión. Con los pacers vivos
      // la escena se pinta ENTERA aquí: medido, el viewport no se queda quieto hasta
      // t≈18 s (la figura en la hoguera y los pulsos por miembro, leídos en la hoja a 1 fps).
      { espera: 10000 },
      // Los TRES espacios que había aquí no esperaban a nada: la escena termina sola, y
      // cada uno caía en el despachador como un turno — «Pass» a t=15,2 · 17,3 · 19,4 en
      // el sidecar de la toma cine. Es exactamente el derrame que la auditoría 22-08 quitó
      // de los demás guiones y que a éste se le había quedado.
    ],
    colaMs: 1500,
  },

  // ─── censo #22: tienda de armas — Iolo's Bows (Britain), compra de un Bow ───
  // Receta de shop.spec.ts:85-93 (herrero Gwenneth anclado en (4,19); Talk-Oeste desde
  // (5,19) abre la tienda; pausa de pacing SHOPPES 0x12c3 → menú). Las teclas del menú
  // se leen del snapshot lógico `__u5test.shopConsole()` (mismo canal que pinta la piel).
  tienda: {
    titulo: "Iolo's Bows: comprar un arco al herrero",
    pieles: ["shader"],
    siembra: { deeplink: { loc: 2, floor: 0, x: 5, y: 19, hour: 10 } },
    preparar: async (page) => {
      await page.evaluate(() => window.__u5debug.setResource("gold", 400));
    },
    guion: [
      { espera: 1000 },
      { press: "t", tras: 400 },
      { press: "ArrowLeft", tras: 2500 }, // Talk al herrero de (4,19) → welcome
      { press: "Enter", tras: 2000 }, // getkey de pacing (0x83dc) → Buy/Sell
      {
        ejecuta: async (page) => {
          // Tecla de una opción del menú por label (patrón optionKey de shop.spec.ts).
          const tecla = async (re) => {
            for (let i = 0; i < 20; i++) {
              const k = await page.evaluate((src) => {
                const snap = window.__u5test.shopConsole?.();
                const rx = new RegExp(src);
                return snap?.options.find((o) => rx.test(o.label))?.key ?? null;
              }, re.source);
              if (k) return k;
              await page.waitForTimeout(400);
            }
            return null;
          };
          const buy = await tecla(/^Buy$/);
          if (buy) {
            await page.locator("body").press(buy);
            await page.waitForTimeout(2500); // charla 1-de-4 + lista
            const bow = await tecla(/^Bow/);
            if (bow) {
              await page.locator("body").press(bow);
              await page.waitForTimeout(2500); // pitch del ítem + Y/N
              await page.locator("body").press("y");
              // El pago RE-LISTA («Sold!… Anything else, sir? … Which would ye see?»):
              // la fase vuelve a buy-list y la salida REAL es Space/Escape → leave()
              // (shop-console.ts:1481-1485). La «n» de la toma auditada caía en
              // pickBuy y no cerraba nada — el clip acabó con el prompt colgado ~9 s
              // (TABLA.md 22-08). Se espera la fase por estado y se sale de verdad.
              for (let i = 0; i < 20; i++) {
                const fase = await page.evaluate(() => window.__u5test.shopConsole?.()?.phase ?? null);
                if (fase === "buy-list") break;
                await page.waitForTimeout(400);
              }
              await page.waitForTimeout(2000); // que el Sold! y la re-lista se lean
              await page.locator("body").press("Escape"); // despedida del herrero
              for (let i = 0; i < 20; i++) {
                const abierta = await page.evaluate(() => window.__u5test.shopOpen?.() ?? false);
                if (!abierta) break;
                await page.waitForTimeout(300);
              }
              await page.waitForTimeout(1500); // la despedida en pantalla
            }
          }
        },
      },
      { espera: 1500 },
    ],
    colaMs: 2000,
  },

  // ─── censo #23: conversación NPC por keywords — el granjero del huerto de Britain ───
  // Talk-dirigido: el NPC PASEA (los townsfolk mueven por turno), así que la posición se
  // lee EN VIVO y el teleport adyacente va justo antes del Talk (sonda 22-08: el granjero
  // responde a name/job/bye con el motor de keywords real, conversation.ts stristr).
  conversacion: {
    titulo: "Conversación con un NPC (name/job/bye)",
    pieles: ["shader"],
    siembra: { deeplink: { loc: 2, floor: 0, x: 15, y: 15 } },
    guion: [
      { espera: 1000 },
      {
        ejecuta: async (page) => {
          // Colocarse bajo el granjero (índice 3 del roster de loc 2) y hablar hacia arriba.
          await page.evaluate(() => {
            const n = window.__u5test.game.npcManager.npcsAt(2, 0)[3];
            window.__u5debug.teleportSmallMap(2, 0, n.x, n.y + 1);
          });
          await page.waitForTimeout(800);
          await page.locator("body").press("t");
          await page.waitForTimeout(400);
          await page.locator("body").press("ArrowUp");
          await page.waitForTimeout(2500); // "You see a sweaty, soiled farmer. Your interest?"
        },
      },
      { teclea: "name", tras: 2500 },
      { teclea: "job", tras: 2500 },
      { teclea: "bye", tras: 2500 },
    ],
    colaMs: 2000,
  },

  // ─── censo #10: piedra lunar — (U)se Moonstone entierra + Vas Rel Por teleporta ───
  // Sonda 22-08: (100,100) es enterrable (pasto 0x04-0x0a, use-tools.ts:482); el picker
  // se navega hasta la fila "Moonstone" (readyPicker) y el hechizo se teclea por
  // INICIALES de sílaba ("vrp" → VAS REL POR, matchSpellByInitials) + fase '2' →
  // moonstone_teleport(1) = kernel 0x47f4, la MISMA rutina que pisar la puerta (#352).
  "moongate-piedra": {
    titulo: "Piedra lunar: enterrar y Vas Rel Por",
    pieles: ["shader"],
    siembra: { deeplink: { loc: 0, x: 100, y: 100 } },
    preparar: async (page) => {
      await page.evaluate(() => {
        window.__u5debug.maximizeAll(); // MP + reagentes + hechizos mezclados
        const s = window.__u5test.state();
        if (Array.isArray(s.scrollQuantities)) s.scrollQuantities.fill(0);
        if (Array.isArray(s.potionQuantities)) s.potionQuantities.fill(0);
        s.moonstones[0].buried = false; // la piedra de fase 0 va en la mochila
      });
    },
    guion: [
      { press: "u", tras: 1200 },
      {
        ejecuta: async (page) => {
          // Bajar la barra del picker hasta "Moonstone" (patrón pickerUse de use-item.spec).
          for (let i = 0; i < 20; i++) {
            const pk = await page.evaluate(() => window.__u5test.readyPicker?.() ?? null);
            if (!pk || pk.rows[pk.cursor]?.name === "Moonstone") break;
            await page.locator("body").press("ArrowDown");
            await page.waitForTimeout(250);
          }
        },
      },
      { press: "Enter", tras: 2500 }, // "Moonstone buried!" (CAST.OVL 0x153c)
      { press: "c", tras: 1200 },
      { press: "1", tras: 1200 }, // Cast & who? → el Avatar
      { teclea: "vrp", tras: 2500 }, // VAS REL POR
      // El teleport es INSTANTÁNEO (hoja de contacto 1 fps: el mapa ya ha cambiado en el
      // cuadro siguiente a «To phase: 2»), así que los 4000+1500+2500 heredados eran 9,0 s
      // de party quieta en el destino — PARADA-VIS lo midió como congelación de 9,0 s.
      { press: "2", tras: 2000 }, // To phase: 2 → jingle + teleport a la piedra de fase 1
      { espera: 600 },
    ],
    colaMs: 1200,
  },

  // ─── censo #3+#20: absorción en Doom + desenlace con Lord British (endgame completo) ───
  // Receta CANÓNICA de endgame.spec.ts:36-86 (siembra declarada + foso por el pipeline
  // real + paso absorbente real); el ritmo es el de pared (sin scenebeat) para el vídeo.
  // 22-08 (encargo del lead): AMBAS pieles — es EL vídeo de la liberación de Lord British
  // (el Grand Tour para en N7 sin dispararla) y se carea contra el testigo EA
  // endgame-victoria-box-20260721.mov.
  "endgame-absorcion": {
    titulo: "Absorción en Doom y desenlace con Lord British",
    pieles: ["shader", "faithful"],
    siembra: { deeplink: { loc: 0, x: 100, y: 100 } },
    preparar: async (page) => {
      await page.evaluate(() => {
        const t = window.__u5test;
        const g = t.game;
        g.state.questFlags["shadowlord-dead:falsehood"] = true;
        g.state.questFlags["shadowlord-dead:hatred"] = true;
        g.state.questFlags["shadowlord-dead:cowardice"] = true;
        g.state.lbArtifacts = { amulet: true, crown: true, sceptre: true };
        g.state.specialItems.woodenBox = true; // final de VICTORIA
        window.__u5debug.setResource("torchTurns", 240);
        g.enterDungeon(40);
        const ds = g.dungeonState;
        ds.pos.floor = 6;
        ds.pos.x = 4;
        ds.pos.y = 7;
        ds.pos.facing = "east";
        t.applyEvents(g.checkDoomRescue());
      });
    },
    guion: [
      { espera: 1500 },
      { press: "ArrowUp", tras: 2500 }, // cae al foso → «Entering room...» → cm127
      {
        ejecuta: async (page) => {
          // ── LA ABSORCIÓN SE CONDUCE CON TECLAS REALES (carril `gate-viewport`, 22-08) ──
          //
          // 🔴 Esto ANTES era un `page.evaluate` que colocaba a cada miembro en (5,3) y
          // llamaba `c.playerMove("north")` DESCARTANDO los eventos devueltos. Por eso el
          // vídeo se llamaba «absorción» y no imprimía ni un `is absorbed!`: el mensaje
          // NACE (combat.ts:1574, `maybeAbsorb` → DS 0x8f02) pero nadie lo aplicaba.
          // `expectativas.json` lo tenía fichado como «LA FIRMA QUE FALTA … el gate DEBE
          // ponerse rojo aquí en cuanto haya sidecar», y el spec canónico
          // (`endgame.spec.ts:70-83`) hereda la misma costura muda — el vídeo no estaba
          // copiando un patrón que imprimiera, estaba copiando el que lo silencia.
          //
          // La cadena que SÍ imprime es la del despachador real: keydown →
          // `handleCombatKey` (main.ts:3106-3117) → `combatOut(combat.playerMove(dir))`
          // (main.ts:3114) → `hud.message` (main.ts:2567-2571) + el cue `combat-absorbed`
          // (sfx.ts:442 vía `routeCombatSfx`) + el banner de turno. Aplicar los eventos a
          // mano con `__u5test.applyEvents` habría impreso el texto por el BRIDGE
          // EQUIVOCADO (es el de mundo: ignora `turn`/`echo`, no emite sfx de combate y
          // mete un `notifyTurn` de turno-de-mundo por cada paso de arena).
          //
          // Paseo greedy portado de `game/e2e/grandtour/ch19-endgame.spec.ts:186-247`, que
          // ya lo conduce así y ASSERTA el print (`:397`, «el print fiel … apareció en
          // consola»). Se conserva lo que la receta protegía a propósito: NO se llama
          // `endCombat` por el hook — lo llama el pacer del port al ver `over` con la
          // primera tecla del driver, que es lo que evita volcar el transcript entero del
          // desenlace de golpe a t≈6 s.
          //
          // Tablero VERBATIM de DUNGEON.CBT sala 15 (0x44 cobble = pisable); sólo se usa
          // la pasabilidad para el paseo. El alma 0x3c vive en (5,1) como decorado.
          const CM127 = [
            "ff ff 4d 4d 4d 4d 4d 4d 4d ff ff",
            "ff 4d 4d 44 44 9d 44 44 4d 4d ff",
            "4d 4d b1 44 44 44 44 44 b0 4d 4d",
            "4d 44 44 44 44 44 44 44 44 44 4d",
            "4d 5c 5d 44 44 44 44 44 92 44 4d",
            "4d 44 44 44 44 44 44 94 9a 96 4d",
            "4d 5c 5d 44 44 44 44 44 90 44 4d",
            "4d 44 44 44 44 44 44 44 44 44 4d",
            "4d 4d b1 44 44 44 44 44 b0 4d 4d",
            "ff 4d 4d 44 ab ac af 44 4d 4d ff",
            "ff ff 4d 4d 4d 4d 4d 4d 4d ff ff",
          ].map((f) => f.split(" ").map((h) => h === "44"));
          for (let guard = 0; guard < 400; guard++) {
            const snap = await page.evaluate(() => {
              const c = window.__u5test.game.combat;
              if (!c) return null;
              const cur = c.currentUnit;
              return {
                over: c.over,
                cur: cur && cur.kind === "player" ? { x: cur.x, y: cur.y } : null,
                ocupadas: c.combatants
                  .filter((u) => u.status !== "dead" && u.status !== "fled" && u.status !== "absorbed")
                  .map((u) => `${u.x},${u.y}`),
              };
            });
            if (!snap || snap.over || !snap.cur) break;
            const { x, y } = snap.cur;
            const occ = new Set(snap.ocupadas);
            const libre = (tx, ty) => ty >= 0 && ty < 11 && tx >= 0 && tx < 11 && CM127[ty][tx] && !occ.has(`${tx},${ty}`);
            // Preferencia: norte (hacia la fila 2, donde `maybeAbsorb` mira) → lateral
            // (hacia la columna 5, bajo el alma) → sur para desatascar.
            const prefs = [];
            if (y > 2) prefs.push(["ArrowUp", x, y - 1]);
            if (x > 5) prefs.push(["ArrowLeft", x - 1, y]);
            if (x < 5) prefs.push(["ArrowRight", x + 1, y]);
            if (y > 2) prefs.push(["ArrowLeft", x - 1, y], ["ArrowRight", x + 1, y]);
            prefs.push(["ArrowDown", x, y + 1]);
            const mov = prefs.find(([, tx, ty]) => libre(tx, ty));
            await page.locator("body").press(mov ? mov[0] : " "); // sin hueco: pass
            await page.waitForTimeout(tecla(120));
          }
        },
      },
      {
        ejecuta: async (page) => {
          // Conduce la escena a ritmo de pared: Espacio periódico hasta el freeze
          // terminal (driveToPhase de endgame.spec, con paciencia de vídeo).
          const t0 = Date.now();
          while (Date.now() - t0 < 150000) {
            const fase = await page.evaluate(() => window.__u5test.endgamePhase?.() ?? null);
            if (fase === "terminalFreeze" || fase === "terminalPrison") break;
            await page.locator("body").press(" ");
            // PAUSA DE LECTURA de la página de prosa. Los 700 ms de aquí son los que
            // hacían que las páginas del desenlace duraran 0,68-0,76 s medidos: el
            // pacer del port avanza POR TECLA (endgame-pacer.ts:260), así que la
            // duración de una página es EXACTAMENTE esta espera. En cine, la del
            // testigo real del original. Ver ../../e2e/tempo-video.mjs.
            await page.waitForTimeout(lectura(700));
          }
          await page.waitForTimeout(4000); // dejar respirar el freeze final
        },
      },
    ],
    colaMs: 3000,
  },
};
