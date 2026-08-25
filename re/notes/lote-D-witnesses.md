# Lote D — witnesses de runtime (carril oráculo, 2026-07-18)

Capturas contra oráculo headless propio (run-dir fuera de `original/u5/play`). Cada
sección adjudica un fleco Clase-C del `asm-frontier-plan.md §LOTE D`.

## 1. `0x400c` — ES ring_regen (Anillo de Regeneración), gateado por el ANILLO · ADJUDICADO

La etiqueta 'ring_regen' era "sospechosa"; el witness la CONFIRMA y **corrige un mislabel**.

**Witness (RAM):** al escribir `0x2c` en `0x55c5` (miembro 0), `parity.read_party()["ring"][0]`
pasó a `0x2c` — es el campo **RING** (`CHAR_RING` +0x1d), NO un "status secundario". Y a
partir de ahí `0x400c` empezó a picar (BP: 38 entradas en 38 turnos de combate del PJ). Si
el gate fuese un status en otra dirección, escribir el anillo no lo dispararía.

- Reconciliación de offsets en vivo: `roster_off = 0x55A6`. `CHAR_STATUS 0x0B → 0x55B3`
  (status primario), `CHAR_HP 0x10 → 0x55B8` (i16), `CHAR_RING 0x1D → 0x55C5`.
  ⇒ el "`di=0x55c5` status secundario" de `kernel-sweep-4.md §3` y `camp-ambush-spec.md`
  es en realidad el **slot de anillo**. CORREGIR ambas notas.
- Valor gatillo `0x2c` = ring id 44 = el otro anillo "que se desvanece" (`equip.ts:213/330`,
  par 42/44; 42 = `RING_INVIS` 0x2a). Por su efecto (regen de HP) es el **Anillo de
  Regeneración**.
- **Dos callers**: tick de estado de combate `0x6794` + secuencia de CAMP `0x0207`
  (`camp-ambush-spec.md:72`) — coherente con regeneración al descansar.
- Mecánica interna (rand(0,7); 1/8 → `0x3f14` counter_add_i16 sobre HP) derivada del §3.
  El **+HP directo no se cazó limpio**: en combate el PJ se envenenó ('G'→'P') y perdió HP
  (60→18) por ataques enemigos, enmascarando el regen. Un witness en CAMP (sin daño) lo
  mostraría. Mecanismo estructuralmente claro.

**Caveat de arnés:** `parse_records()["hp"]` (byte +0 de `0xBA14`) es copia de spawn, NO HP
vivo (PJ vivos leen 0). Para HP usar roster `0x55B8` / `read_party`.

## 2. `0x0d72` dissolve — HELPER GENÉRICO de página de 7 líneas (texto = arg del caller)

Del disasm `ULTIMA.EXE.asm` (0d72–0dd7). NO es un evento concreto: es una PRIMITIVA
"dibuja página de 7 líneas centradas + disuelve":
- `call 0xaa6(0,0,0x13f,0xc7)` = limpia pantalla completa (320×200).
- LOOP si=0..6: `di=0x5306` (tabla ANCHOS, 7 words), `[bp-8]=0x5314` (tabla ALTURAS);
  por línea centra X = `(0x140 − ancho)/2`, `call 0x1044([bp+4], 0, X, Yacum)`; Yacum +=
  altura. **El texto de las 7 líneas es `[bp+4]` = ARGUMENTO del caller**, no embebido.
- `call 0x1140` = blit de disolución final (fn37/sel 0x6f).

⇒ **Por eso "resiste el análisis estático": el evento no vive en `0x0d72`, lo aporta el
caller indirecto.** Para el carril de transiciones: cablear `0x0d72` como helper genérico
(clear → 7 líneas por tablas 0x5306/0x5314 → dissolve 0x1140); los eventos concretos
(muerte / cartas de historia / press-space) son CALLERS que le pasan su texto.

**CALLER (witness) — DEGRADADO A TENTATIVO (2026-07-18, carril transiciones):** el BP en
0x0d72 picó en el resume 7 del título/intro, y se atribuyó a "cartas de historia del arranque".
**Esa atribución NO se sostiene** — ver `dissolve-derivation.md §Fidelidad de FLUJO`: el
0x0d72 no tiene callers DIRECTOS en ULTIMA.EXE (indirecto/overlay) y el intro fiel NO muestra
ninguna carta de 7-líneas-con-melt (attract = título+figuras+escena de IMAGEN Summoning+menú,
video-P + RE previa; las 21 escenas usan texto PROPORCIONAL `0xfb26`, no el 0x0d72). El
CS:IP=F000:FEA5 era misread de pausa. ⇒ el 0x0d72 es primitiva sin superficie VISIBLE
confirmada; su caller real se pincha con captura RUNTIME (BP + screenshot de qué hay en
pantalla). Candidatos: Story-So-Far/recap, muerte, otra pantalla de texto monoespaciado.

Otros callers (muerte / press-space) NO nombrados: la muerte por `HP=0` a pelo NO registra
game-over (BP no picó en 200 resumes) — necesitaría golpe letal real o el flujo de
resurrección de LB. BANCADO (acuerdo con el lead): las primitivas ya están derivadas y
aterrizadas; el naming del resto se hace a demanda del evento que el carril priorice.

## 3. `0x0f46` — CORRECCIÓN: NO es "fizzle", es `gfx_blit_sel66` (blit de imagen grande, SEL 0x66)

> ⚠️ **MISLABEL corregido (relevo 2026-07-18, `lote-D-witnesses-relevo.md §Obj 5`):** el
> nombre "fizzle" era conjetura. `0x0f46` está derivado byte-a-byte como **`gfx_blit_sel66`**
> — el blit de IMAGEN GRANDE a pantalla completa vía driver SEL 0x66 — en
> `intro-blit-formats.md §1` (`0x8d86→0x0f46`), `kernel-sweep-4.md:222` e
> `intro-scene-tables.md:308`. No hay "modo blit-vs-fizzle": `0x0f46` SIEMPRE blittea una
> imagen; el intro lo usa para sus escenas full-screen 4bpp. Los "candidatos: efectos de
> hechizo / enter-exit de localización / retratos" de abajo quedan **descartados como marco**
> — el trigger correcto son escenas de imagen a pantalla completa (intro/endgame/story).
> Dos intentos de runtime en el arnés headless EGA (BP tras `wait_kbd_poll` y BP tras `boot()`)
> dieron 0 hits: el intro que el oráculo recorre no exhibe SEL 0x66 (confirmación runtime a
> demanda). El texto original se conserva abajo como registro del método.

Disasm (`ULTIMA.EXE.asm`): 4 args (rect ax=[bp+0xa] bx=[bp+8] cx=[bp+6] dx=[bp+4]) →
`call 0x8e6` → lcall driver **sel 0x66 = fn34**. El modo blit-vs-fizzle vive DENTRO de
fn34, no en el wrapper.

**Witness de triggers (BP en 0x0f46):** 0 hits en idle overworld (60 resumes) Y 0 en
entrada a combate (80 resumes). El BP funciona (ring_regen picó 38×), así que esto
**DESCARTA idle-overworld y entrada-a-combate** como triggers. Otros eventos lo usan
(candidatos: efectos de hechizo, moongate, enter/exit de localización, retratos). Naming
concreto pendiente de dar con el escenario.

## 3b. Moongate reveal — SCRAMBLE-LFSR (poly 0x9248), NO rect-creciente · estático

El EGA.DRV implementa TODA su familia de reveal/transición con el LFSR de polinomio
**0x9248**; **no existe primitiva de rect-creciente** en el driver. Tres sitios:
- `0x1fac` (fn32 @0x1f98, ruido): `seed = ror3(seed+0x9248) xor 0x9248 + 0x11` → bytes
  pseudo-aleatorios en el bitmap del tile (llama/agua; `flag-fire-anim-runtime.md:64`).
- `0x27c0`: mismo LFSR → `div cx` (cx=(cs:[0x27a7]>>1)−0x64+1) → `dx=resto+0x64` =
  **posición pseudo-aleatoria en rango** (position-scramble de un reveal) + PC-speaker.
- `0x2a07`: mismo LFSR + `int 0x16` + galois sobre cs:[0x2541] = transición de pantalla.

El moongate entra por wrapper `0x1112` → sel 0x60 = fn32 @0x1f98 → dispatch `0x24d6`
(esta familia). Los 3 candidatos son scramble-LFSR, cero rect ⇒ veredicto binario
**SCRAMBLE-LFSR (0x9248)**. Encaja con "el forense de vídeo no converge a 16×16".
CAVEAT: no trazado el bucle EXACTO (cuál de los 3) ni capturado el orden pixel-a-pixel;
para la decisión scramble-vs-rect no hace falta. Orden exacto = captura runtime si el
carril lo pide.

## 5. Chrome EGA — índices runtime 13b0/13b2/13b8/13ba · WITNESS CERRADO

`drivers-drv.md §2.4` dejaba Clase-C el VALOR runtime que el kernel escribe en cada
global (índice→RGB ya resuelto @0x52ee). Leídos en vivo (gameseg, `game_ds=0x1788`;
validado: paleta @0x52de = `000102030405060738393a3b3c3d3e3f00` exacta):

| global | valor | RGB (tabla §2.5) | color |
|---|---:|---|---|
| `0x13b0` | 15 | `#FFFFFF` | blanco |
| `0x13b2` | 1  | `#0000AA` | azul |
| `0x13b8` | 14 | `#FFFF55` | amarillo |
| `0x13ba` | 7  | `#AAAAAA` | gris claro |

Globals de 16 bits (índice + `00`). Los 4 en 0..15 (índices EGA válidos). **Clase-C
cerrada**: el chrome EGA usa índices 15/1/14/7 → blanco/azul/amarillo/gris-claro.

## 4. Notas de método (triggers de transición resisten los escenarios fáciles)

Los triggers de dissolve (0x0d72) y fizzle (0x0f46) tienen callers INDIRECTOS (overlay).
Descartados por witness en vivo: muerte-por-HP=0-a-pelo (no registra game-over), idle
overworld y entrada a combate. El BP-en-kernel está PROBADO (ring_regen 38 hits limpios),
así que los ceros son datos reales de descarte, no fallo técnico. Las PRIMITIVAS quedan
caracterizadas (helper genérico / wrapper sel-0x66); el naming de cada caller es
trial-and-error de escenarios, a demanda del evento que el carril priorice.
