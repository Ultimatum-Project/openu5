/**
 * ── CLASE DEL SPEC (RULING 2026-07-26, `specs-detector-vs-veredicto`) ──────────────
 * **CAPACIDAD-DE-ARNÉS** (la tercera clase, `re/notes/censo-clases-specs-salas.md`).
 * NO juzga la fidelidad del port ni sella ninguna sala: valida que el HELPER
 * `enterFromUnderworld` (nav.ts:1480) sabe meter a la party por el FONDO en las 7
 * mazmorras-con-salas. Un rojo dice **«el arnés se rompió»** — con el matiz del párrafo
 * siguiente, que hay que leer antes de adjudicar ningún rojo de aquí.
 *
 * ★ MATIZ QUE ESTA ETIQUETA NO DEBE TAPAR: los valores que se asertan —planta 7, (7,7),
 * mirando OESTE— **SÍ tienen derivación del binario**, sólo que la cita no vive aquí:
 * vive en el PORT, `src/core/dungeon/dungeon-cmds.ts:88-93`, «Nivel de entrada por planta
 * de origen (MAINOUT cmd_enter 0x088f-0x08be): desde el UNDERWORLD (fromFloor 0xFF) →
 * FONDO (planta 7) en (7,7) mirando OESTE (`mov [g_dng_facing],3` = O; `party_x=party_y=7`)»
 * + la excepción Doom (`cmp al,0x28; je 0x8b4`), que es justo por lo que Doom se excluye de
 * la lista de abajo. Consecuencia práctica: un rojo aquí puede significar «el arnés se
 * rompió» **o** «la entrada-por-Underworld del port cambió», y lo segundo se adjudica
 * contra MAINOUT 0x088f. Quien quiera ASCENDERLO a VEREDICTO-DE-FIDELIDAD ya tiene la cita
 * localizada; hoy no lo es porque el spec no la enuncia y porque su trabajo declarado es
 * otro (ver abajo).
 *
 * ★ Y EL ASERTO DE ESTE FICHERO ES REDUNDANTE: `enterFromUnderworld` YA asserta lo mismo
 * por dentro (nav.ts:1493-1494, `toMatchObject({floor:7,x:7,y:7,facing:"west"})`). El
 * `expect` de la línea de abajo no puede ser NUNCA el primero en fallar. Lo que este
 * fichero aporta de verdad no es el aserto: es EJECUTAR el helper sobre las 7 mazmorras.
 * ──────────────────────────────────────────────────────────────────────────────────
 * SMOKE — `enterFromUnderworld` (infra de la pasada de FONDO, Fase 2b). Valida que el helper
 * entra a cada una de las 7 mazmorras-con-salas por el FONDO desde el Underworld (floor 7, (7,7),
 * OESTE), reusando `locationsX/Y` + `underworld=true` (dato derivado: entrada-Underworld == posición
 * overworld, 8/8; ver `docs/plan-fase2b-stubs.md`). Doom (id 40) se EXCLUYE (siempre entra por cima).
 *
 * Es un SMOKE de infraestructura, no una pasada de conquista: sólo confirma la ENTRADA por el fondo.
 * La conquista de las salas FONDO (navegar floor7 + klimb-up, o sellar inaccesibilidad como #29) es
 * el siguiente paso por-mazmorra.
 *
 * [MARCADOR RANCIO CORREGIDO 2026-07-27: esta cabecera decía «NO se corrió bajo el hold de e2e
 * (ventana de salas-destard); pendiente de ventana del lead para su primera corrida aislada».
 * Ya no es verdad y llevaba así desde su propio aterrizaje: el merge que lo trajo, `25c67049`,
 * declara en su asunto «ch28 smoke **7/7 ×2**». Corrió, en las 7 mazmorras y por duplicado.]
 */
import { test, expect } from "@playwright/test";
import { importCheckpoint } from "./fixture";
import { bootWorld, chapterTimeout, enterFromUnderworld } from "./nav";

const PREV_CHAPTER = "ch13";
// Las 7 mazmorras-con-salas (Despise incluida: tiene entrada Underworld aunque 0 salas). Doom NO.
const DUNGEONS: Array<{ id: number; name: string }> = [
  { id: 33, name: "Deceit" },
  { id: 34, name: "Despise" },
  { id: 35, name: "Destard" },
  { id: 36, name: "Wrong" },
  { id: 37, name: "Covetous" },
  { id: 38, name: "Shame" },
  { id: 39, name: "Hythloth" },
];

test.describe.serial("FASE 2b — smoke: enterFromUnderworld (entrada por el FONDO)", () => {
  for (const d of DUNGEONS) {
    test(`(E) desde el Underworld entra a ${d.name} (${d.id}) por el FONDO — floor 7, (7,7), oeste`, async ({ page }) => {
      test.setTimeout(chapterTimeout(120_000));
      await bootWorld(page);
      await importCheckpoint(page, PREV_CHAPTER, { entryClock: { hour: 10, minute: 0 } });
      const ds = await enterFromUnderworld(page, d.id); // aserta {floor:7, x:7, y:7, facing:"west"} dentro
      expect(ds, `${d.name} FONDO`).toMatchObject({ dungeon: d.id, floor: 7, x: 7, y: 7, facing: "west" });
    });
  }
});
