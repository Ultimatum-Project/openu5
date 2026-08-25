# Escena COMPLETA de la APARICIÓN de acampada — OUTSUBS `camp_results` 0x0658 (carril aparición)

Derivación instrucción-a-instrucción de TODO `camp_results` (OUTSUBS.OVL 0x0658-0x099b),
disparada por el reporte del usuario: «en cada paso va despertando a cada uno de los
jugadores». Cierra los huecos que `camp-scene-kernel.md` dejó (su §4 describía la escena
como «figura estática + N pulsos» — correcto en lo estático, INCOMPLETO en el resto).

**Citas** = `re/disasm/OUTSUBS.OVL.asm` + offset (OUTSUBS.OVL son 2464 B de código puro;
sus datos viven en DATA.OVL, `fileoff = DS+0x10`). Resolución de near-calls:
`overlay-load-layout.md` — OUTSUBS es banda 2, `near_call_base = 0xA290` ⇒
`target_real = (0xA290 + offset_impreso) & 0xFFFF`.

## 0. Tabla de resoluciones (verificadas contra notas/kernel)

| call impreso | real | rutina | verificación |
|---|---|---|---|
| 0x75c0 | 0x1850 | kernel_print_ds | camp-scene-kernel §1 (0x3ea9) |
| 0x7f02 | 0x2192 | pcspeaker_tone_sweep | camp-scene-kernel §6 |
| 0x7e02 | 0x2092 | **rand** | camp-scene.md (call 0x2092) |
| 0x8670 | 0x2900 | kernel_status_redraw (panel party) | combat-light-adjudication |
| 0x82de | 0x256e | cargador de registros de fichero | camp-scene-kernel §2 (0x6104) |
| 0x83dc | 0x266c | **getkey_with_redraw** (¡espera tecla!) | kernel-sweep-3 |
| 0x742a | 0x16ba | putchar | kernel-sweep-3 §127 |
| 0x77ae | 0x1a3e | print número justificado | kernel-sweep-3 §118 |
| 0x6dd8 | 0x1068 | fx_tile_fizzle_in (revelado LFSR de un tile en celda) | kernel-sweep-4 §174 | ⟵ nombre corregido (frontera-29, #71): NO barre la pantalla, revela UN tile; el paréntesis siempre estuvo bien. El barrido de una REGIÓN es su hermano CLC `fx_rect_dissolve 0x0f46`.
| 0x67e0 | 0x0a70 | set_color (SEL 0x2d) | fx-lineaoe §2, endgame-derivation §D |
| 0x68f6 | 0x0b86 | rect **XOR** (STC + fn21) | fx-lineaoe §2 (mismos args) |
| 0xffff9856 | 0x3ae6 | beep de duración (gate sonido-ON) | endgame-derivation GAP 8 |
| 0xffff9c60 | 0x3ef0 | add_byte_clamped_ceiling | inferible-sweep-f3 |
| 0xffffaae6 | 0x4d76 | strchr_index | kernel-sweep-3 §349 |
| 0xffffacec | 0x4f7c | advance_clock | sfx-catalog §advance_clock |

## 1. Prólogo (0x0658-0x06cd)

- `0x0660` print DS 0x7750 = `"An apparition!\n"` — el TEXTO va ANTES del sonido.
- `0x067b` tone_sweep(6, 0x9c4, 0x2710, 1, 0xa3c) = sweep de MATERIALIZACIÓN.
- `0x0683-0x06a2` bucle `si=0x3a26..0x3a32` (6 words): por cada uno
  `tone_sweep([si], 1, 0x1388, 0xc8, 0xd)` (0x0698) = **arpegio de 6 notas**.
  Tabla DS 0x3a26 → DATA.OVL fo 0x3a36 = `2620, 2620, 2620, 3700, 3900, 4160`
  (= 0x0A3C ×3 + 0x0E74, 0x0F3C, 0x1040). El placeholder de 3 notas del port era
  nominal; QUEDA DERIVADO.
- `0x06a4-0x06b6`: escribe el slot de anim `0x5caa` (= `g_char_anim_states 0x5c5a` +
  80, entrada 10, stride 8 — el slot del actor de la HOGUERA en (5,5)):
  frames `+80/+81 := 0x16` (tile transitorio del wipe, banco alto 0x116) y
  `+82/+83 := 5`.
- `0x06b9-0x06c2` `fx_tile_fizzle_in(5, 5, 0x174)` — la figura (tile 0x174) se
  **materializa EN LA CELDA DE LA HOGUERA (5,5)**, revelado LFSR.
- `0x06c5-0x06ca`: frames `+80/+81 := 0x74` (⇒ tile 0x174 banco alto, queda animando).
- `0x06cd` `[bp-6] := 0` (índice de miembro) y `0x06d2 jmp 0x7fb` → bucle.

**⚠ Los bloques 0x06d6-0x06e6 y 0x06ea-0x06f1 NO son una "marcha":** son colas de bucle
a las que se SALTA desde abajo — 0x06d6 es el paso del ESCANEO de la tabla de actores
(`di/si += 8; inc dx; cmp si,0xbb18`, entrado desde 0x083e) y 0x06ea es el shift del
cálculo de nivel (`inc dx; sar cx,1`, entrado desde 0x08f9). **La figura NO se desplaza
en ningún punto: no hay ni una escritura de posición en toda la rutina.** Casa con los
2 testigos independientes (materialize-in-place, sin marcha).

## 2. BUCLE POR MIEMBRO (0x07fb condición; cuerpo 0x0808-0x08f9)

`while [bp-6] < g_party_size` (0x07fb-0x0803; al agotar → 0x090e discurso).
Por miembro `i` (registro roster = `i<<5 + 0x55a8`):

1. `0x080f` si status (`+0x55b3`) == 'D' → **salta a 0x079c** (sólo MP+panel, sin nada más).
2. `0x0816-0x0824` **cura total**: `currentHP (+0x55b8) := maxHP (+0x55ba)`.
3. `0x0828` **status := 'G'** (0x47).
4. `0x082d-0x084a` localiza el ACTOR del miembro: escanea la tabla de actores de escena
   (entradas de 8 B; campo `[0xba17+k*8]` = índice de roster, `[0xba18+k*8]` = nº de slot
   de anim) → puntero de anim = `0x5c5a + slot*8`.
5. `0x0850-0x0874` **DESPERTAR VISUAL**: `strchr_index("AMBFDTPRS" DS 0x7760, clase)`
   (clase en `+0x55b2`) indexa la tabla de bytes DS 0x1ade (DATA.OVL fo 0x1aee) =
   `4c 40 44 48 4c 4c 4c 4c 4c` → escribe ese byte en LOS DOS frames del slot de anim
   (banco alto): el durmiente 0x11e se pone DE PIE con A→0x14c, M→0x140, B→0x144,
   F→0x148, resto→0x14c (Avatar — quirk fiel; en saves reales sólo hay A/B/F/M).
6. `0x0876-0x087f` anim`+86 := 0`; beep(1) (0x3ae6).
7. `0x0882-0x0896` tone_sweep(0xd, 0xc8, 0x1388, 1, 0x157c) = **campanilla** (por miembro).
8. `0x0899-0x08aa` `set_color([g_unk_13b0]=15 blanco)` + `rect_XOR(8,8,0xb7,0xb7)` =
   **flash de inversión EGA del viewport** (8,8)-(183,183) — MISMO par de calls que el
   negate-time (fx-lineaoe §2). Un XOR por miembro; el repintado continuo del compositor
   lo convierte en pulso.
9. `0x08ad-0x08c1` tone_sweep(1, 0x9c4, 0xea60, 1, 0x157c) = **ACORDE LARGO — POR
   MIEMBRO** (el port lo tenía una sola vez al final: corregido).
10. `0x08c4-0x08d9` ×3: anim`+86 := 1`; beep(1).
11. `0x08db-0x08f9 → 0x06ed-0x0708` **nivel** = `bit_length(exp/100)+1`; si == actual →
    0x079c. Si sube (0x070b-0x0795): fija nivel, `maxHP=curHP=30·nivel`, imprime
    `\n"Hail, `(0x776a) + nombre + `!\nFor thy valiant deeds…\n`(0x7774) +
    `Thou art now level `(0x77a4) + N + `, and\n`(0x77b8) + `rand(1,3)`(0x0752) →
    stronger!/quicker!/wiser! (0x77c0/0x77ca/0x77d4) con +1 capado a 30 (0x3ef0), +
    `" `(0x77dc) + **getkey 0x266c** (0x0792) + putchar('\n').
12. `0x079c-0x07b6` **recálculo de MP por clase** (TODOS los caminos caen aquí, muertos
    incluidos): 'A'/'M' → `MP := INT` (0x07e6, `+0x55b6`→`+0x55b7`); 'B' → `MP := INT>>1`
    (0x08fc); resto intacto (0x07bb).
13. `0x07f5` kernel_status_redraw (panel); `0x07f8` i++.

**⇒ VEREDICTO del claim del usuario: PARCIALMENTE CIERTO.** La aparición **SÍ despierta
a los miembros UNO A UNO, en orden de roster (vivos)** — cada "paso" percibido es una
iteración del bucle: el miembro se pone de pie (paso 5) y suena campanilla+flash+acorde.
Pero la figura **NO camina**: está fija en (5,5) sobre la hoguera (casa con los 2
testigos). El port no pintaba NINGÚN despertar — de ahí el reporte.

## 3. Sonidos (todos ya identificables con la partitura del port)

materialize = 0x067b · arpegio ×6 = 0x0698 (tabla derivada §1) · campanilla = 0x0896
**por miembro** · acorde = 0x08c1 **por miembro** · beeps 0x3ae6(1) en 0x087b y ×3 en
0x08d1 (Clase C, sin cue propio).

## 4. Curación/level-up: ¿atómico o por paso?

**POR MIEMBRO, dentro de la secuencia**: cura+wake (pasos 2-5) ANTES de la fanfarria del
miembro, y el level-up (paso 11) DESPUÉS de su acorde, con su arenga y su pausa de tecla.
NO es un bloque atómico al final. Consumo de rands sin cambio: 1×`rand(1,3)` por miembro
que sube, en orden de roster (= lo ya sellado en tests; el resto de la escena es 0-RNG).

## 5. Epílogo: discurso de KARMA + desvanecimiento (0x090e-0x099b)

- `0x090e` print DS 0x77e0 = `\n"`.
- `0x0915-0x0920` `index = g_karma / 20` (div 0x14).
- `0x0923 jge`: si `index < 4` → offset de la tabla DS 0x1a74 = `[0,132,269,410]`
  (= records 0-3 de KARMA.DAT, los MISMOS del refuge); si `index ≥ 4` (karma 80-99) →
  **offset FIJO 0x29f=671** (0x094c) = **record 5**: `"Well armed art thou to fight
  Death's embrace, O enlightened one! Thy destiny awaits thee!"` (byte-exacto del
  fichero; KARMA.DAT mide 761 B, rec5 671-760). ⇒ el rec5 que death-resurrection-audit
  declaró «inalcanzable» por el refuge **SÍ es alcanzable — por la acampada**. (El
  refuge con 80-99 recita el rec4 "Return once more…"; el camp, el rec5.)
- `0x0950` loader 0x256e("KARMA.DAT" DS 0x77e4/0x77ee, buf 0xb21e, max 0x7d0, offset);
  `0x0953` print del buffer; `0x095a` putchar('"'); `0x0961` **getkey**.
- `0x0964` print DS 0x77f8 = `\n\nThe strangely familiar old man vanishes...\n`.
- `0x096b-0x097e` frames := 0x16; `fx_tile_fizzle_in(5, 5, [g_unk_adb9])` — **la figura se
  disuelve al tile guardado de la HOGUERA** (g_unk_adb9=0xdc, ver camp-scene.md §2c);
  `0x0981-0x0986` frames := 0; beep(1); `0x0993` advance_clock(0); ret.

## 6. Estado del port (carril aparición, rama fiel/aparicion-camp)

- **Core**: `campApparition` → pasos por miembro (`steps`) + **MP por clase (nuevo)**;
  `Game.campWake` → orden fiel (campanilla+acorde POR miembro, arengas intercaladas) +
  **discurso de karma (nuevo, `campKarmaMessage`: recs 0-3 compartidos con refuge +
  rec5 nuevo)** + «vanishes…». Texto en 2 mensajes (`\n` + record entrecomillado) para
  reusar las keys i18n del refuge.
- **Piel**: despertar por-miembro visual — `CampSceneMember.awakeTile` (tabla 0x1ade),
  el pintor fiel pone de pie a `members[0..pulso]` al ritmo de los pulsos de
  `ApparitionFlash` (+ nueva cola de discurso `APPARITION_SPEECH_HOLD_MS` con todos de
  pie antes del desmonte). Arpegio del speaker = tabla real de 6 notas.
- **Clase C declarado**: beeps 0x3ae6 entre pasos; pausas por tecla (getkey 0x266c) tras
  arenga/discurso (el port pacea a reloj de pared); duración del hold; el wipe LFSR de
  celda del materialize/dissolve de la figura (la piel hace aparición directa);
  advance_clock(0) del teardown.
