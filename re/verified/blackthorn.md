# Verificado: Guardias, cárcel y Blackthorn (Task 3.10)

Reglas re-derivadas del asm con citas (`re/notes/blackthorn.md`) y portadas al clon
(`game/src/core/world/blackthorn.ts`; estado nuevo `shadowlordLocs` en `core/state.ts`).
El arnés `re/tools/test_blackthorn_parity.py` cruza dos modelos INDEPENDIENTES: la
predicción asm-derivada en Python (`blackthorn_parity.py`) y la reproducción del core
del clon (`game/src/core/__parity__/blackthorn-run.ts`). **Salvo la merma de la
Falsedad (1 `rand(1,64)` del kernel por compra), NADA consume RNG** → la paridad es de
VALOR, no de stream. Misma filosofía que test_shrines_parity / test_transport_parity.

## Convención de fidelidad

- ✅✅ **RUNTIME-VERIFICADO** en DOSBox (valor byte-a-byte en vivo).
- ✅ **asm-directo** (regla leída de las instrucciones, con cita) y/o cruce
  modelo↔clon verde.
- ⚠️ pendiente / no cableado al bucle del juego.

## Estado de la verificación (2026-07-11)

VERDE:
- `re/tools/test_blackthorn_parity.py` — **45 passed** (16 unidades del modelo + 29
  escenarios cruzados clon↔modelo: consciencia, disparo, selección de santuario,
  interrogatorio correcto/negado/tardío, captura+depósito, refuge, merma, guardias).
- `npm test -w game` — **484 passed** (incluye `tests/blackthorn.test.ts`, 20 tests) —  <!-- F.1 2026-07-11: total de la suite completa (484) -->
  sin regresiones (era 375+).
- `tsc --noEmit` en `game/` — limpio.
- Ledger: **BLCKTHRN.OVL 100% cubierto** (10 segmentos, 3184 B, 0 gaps) vía
  `re/tools/blackthorn_catalog.py`; `test_ledger` verde.

## ✅ asm-directo (leído del disasm, con cita en re/notes/blackthorn.md)

- **Disparo de la captura** (TOWN 0x12b9-0x12ca): loc **0x12** + `party_conscious_state
  >= 0`. `party_conscious_state` (kernel 0x39fc): 0='G'/'P' consciente, 1=sólo 'S',
  −1=todos muertos.
- **Selección de santuario** (0x0659): primer `g_shrine_destroyed[i]==0`; los 8 caídos
  → sin interrogatorio.
- **Interrogatorio** (0x054a): mantra correcto = **karma −5 (suelo 0)** +
  `g_shrine_destroyed[subj]=0xff` + sacrificio del 1er compañero si numLiving>1 (else
  "rewarded with thy life"); Avatar solo fallando = "To the dungeon!"; party>1 fallando
  = péndulo en la 4ª ronda (advance_clock(2) por ronda tras el 1er aviso).
- **Monólogo de apertura / escena del trono** (0x060e, prints 0x0652→0x08ca; #23,
  2026-07-14): entre la captura y la 1ª pregunta el original imprime, EN ORDEN, DATA.OVL
  (fileoff = DS_off + 0x10) + MISCMSG rec11 (DS 0xb54a):
  1. `0x0652`→DATA.OVL 0x6fbc `"\nThou art subdued and blindfolded!"` (antes del bucle de
     santuarios → también en la vía de depósito directo; 0x0665 salta a 0x08e7).
  2. `0x06b0`→0x6fe0 `"\n\nStrong guards drag thee away!"` (sólo vía interrogatorio).
  3. `0x07dc`→0x7024 `"\n\nThou hast been chained and manacled!"`.
  4. `0x07ea`→0x704c `"\n\nFootsteps!"`.
  5. `0x0883`+`0x088a`+`0x0891`→0x705a+`{nombre PJ0 DS 0x55a8}`+0x7074 =
     `"\n\nBlackthorn says:\n\n\"Ah, {nombre}!\n'Tis indeed an honour to meet thee at last! "`.
  6. `0x089b`+género+`0x08bc`→0x70a4+(`0x70c8 "man "`/`0x70c0 " lady "` según
     g_party_records+9==0x0b/0x0c)+0x70ce = `"\n\nGUARD! Release this good{man/ lady }at once!\""`.
  7. `0x08ca`→MISCMSG rec11 `"\n\n\"Wait!\"\n\n\"«Since I myself seek …» (118 B, sha1 d2551f92 — recortado; verifica contra tu copia)" "`.
  Sprites (0xbe @0x3702/0x370e) y pausas (0x83dc) = L3/UI, no texto. El clon lo emite como
  eventos `message` antes del prompt de la 1ª pregunta (game.ts `captureSceneMonologue`).
  Cotejo conductual: captura del usuario 2026-07-13 ("...this goodman at once!" / "Wait!" /
  "Since I myself seek Avatarhood…") — coincide byte a byte; el usuario recordó "Seize" pero
  el binario dice **"Release"** (Blackthorn ordena soltar al Avatar para hablarle).
- **sacrifice_member** (0x03ae): quita el **2º miembro vivo** (nunca el Avatar);
  party_size--.
- **check_mantra** (0x02ea): substring toupper de 14 chars.
- **Depósito post-captura** (0x08f6-0x0905): **(10,7) loc 0x12, keys=0, a pie**.
- **Refuge** (0x0bfd-0x0c4d): **karma restaurado a suelo 75**; wake en **LB (loc 0x11),
  planta 1, (10,10)**, a pie; time_spell limpio; light/torch a 0; comida 63 si estaba a
  0; **currHp:=maxHp por miembro** (0x0b98, incondicional). Party revivido.
- **Guardias TALK 0xFF** (0x01e2): el prompt "Dost thou pay?" (helper 0x00ac) **paga al
  aceptar ('Y'→ret 0)**, no al rehusar. loc 0x12 password "IMPE" (ret 0 correcto); loc 5
  (Minoc) 'Y' → `gold/=2`; otras 'Y' + `tributo<=oro` → 10 gp/miembro vivo. `ret`:
  0=satisfecho, 1=escalada (rehúsa/no-paga/password malo → reacción del caller de 3.13).
- **Merma de la Falsedad** (SHOPPES 0x019a): con Shadowlord 0 (Falsehood) en la ciudad,
  `gold -= rand(1,64)` con suelo 0 tras cada compra.

## ⚠️ Pendiente / no cableado (declarado, no oculto)

- **HP del revive del refuge = asm-directo** (0x0b98: `word[rec+0x10]:=word[rec+0x12]`,
  currHp:=maxHp; el __ldiv de 0x0b6f era la FRECUENCIA del sonido, no HP). El clon ya lo
  hacía. Sólo queda ⚠️ el **byte de status** que fija kernel 0xdc66(i,0xff) (el clon usa
  'G'). Localización/karma/comida/HP son asm-directos.
- **Minuto/día exacto del refuge**: el bucle advance_clock(9) hasta hora==6 deja un
  minuto (y posible avance de día) dependiente de la hora de entrada; el clon fija
  (hora=6, minuto=0) como canónico.
- **g_floor del depósito de captura**: 0x08e7 escribe g_floor=0xff y el depósito NO lo
  re-fija; el clon no toca floor. ⚠️ riesgo para el cableado de 3.13 si la captura se
  dispara desde planta alta (sin evidencia asm de normalización — declarado como riesgo).
- **Slot 15 del ejecutado** (0x5788): el sacrificado PERSISTE en g_party_records[15] con
  byte final 0x7f (no es scratch); el clon lo elimina del array. Byte-exactitud del
  roster → Task F.
- **Gate del password** `g_time_spell==0x1d` y requisito del Black Badge en inventario:
  el clon modela la comparación del password, no el gate previo (oráculo).
- **Cableado al bucle**: el disparo de la captura/refuge desde el town-turn, y la
  llamada a `postPurchaseGoldDrain` desde el bucle de tienda, son enganches de Task
  3.13/3.6. Este task entrega funciones PURAS + hooks documentados.
- **Thunks de alerta 0x7B06/0x7B12/0x7B1E** (cañón, CMDS 0x0d70): PLINK a código
  overlay-resident; cuerpos exactos no desensamblados. NO añadidos al ledger de
  ULTIMA.EXE (evita segmentos especulativos que romperían el invariante 202800). La
  cadena observable (karma −5 + hostilidad del dueño) queda documentada; cableado en 3.9.

## Notas de método

- Los 9 prólogos y el padding final se verificaron directamente en
  `re/disasm/BLCKTHRN.OVL.asm` (grep de `55` + `8bec`); la partición del ledger no deja
  huecos ni solapes (assert en `blackthorn_catalog.build_segments`).
- Los mantras del modelo Python se leen de DATA.OVL 0x0BE0 (no se duplican como
  constante), evitando la circularidad constante-vs-constante en el cruce.
- `g_shadowlord_locs@0x58C8`, `g_shrine_destroyed@0x58D8` y `g_shadowlord_here_idx@0x5958`
  ya estaban en `globals.json` (Task 3.6/3.8); 0x5788 (scratch del sacrificado) es el
  slot 15 de `g_party_records`, no un global nuevo.
