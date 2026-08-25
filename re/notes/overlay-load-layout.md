# Overlay LOAD-LAYOUT — resolver `call 0xffffXXXX` → (fichero, offset) mecánicamente (task #30)

El bloqueador que frenó a intro-demo, camp/bardo y endgame (#20): las llamadas
wrap-negativas `call 0xffffXXXX` (thunks PLINK86) no se resolvían sistemáticamente a un
(fichero de overlay, offset). Aquí está la TABLA CANÓNICA + la regla, derivada del binario y
validada contra 3 anclas independientes.

TL;DR — para una `call 0xffffXXXX` (o `jmp`) DENTRO del overlay `O`:
```
CS_target = (near_call_base(O) + 0xXXXX) & 0xFFFF
  near_call_base(O) = load_seg(O)*16 − reloc_header(O)     ; reloc_header = 0x10 si nreloc>0, si no 0
```
Y para mapear ese `CS_target` a un fichero+offset citable:
- **cae en 0x0000–0x81D0** → RESIDENTE (ULTIMA.EXE): usar el label del disasm
  `re/disasm/ULTIMA.EXE.asm` directamente (= CS offset); byte crudo = `CS + 0x800`.
- **cae en la banda de un overlay** `[load_seg*16, end_seg*16)` → ese `.OVL`:
  `file_off = CS_target − load_seg*16 + reloc_header`  (para una llamada DENTRO del propio
  overlay esto se reduce a `file_off = 0xXXXX`: el disasm del `.OVL` ya usa file offsets).

Fuente canónica en código: `re/tools/dispatch_table.py` (`overlay_table()`,
`overlay_reloc_header()`, `overlay_near_call_base()`, `stubs()`), que parsea la tabla de
registros PLINK86 (imagen 0x7780, 24×16 B) y los 164 stubs kernel→overlay (0x7A16).

---

## 1. Tabla canónica (24 registros PLINK86, imagen ULTIMA.EXE 0x7780)

Los overlays se cargan en **5 bandas ANIDADAS** (niveles) de la ventana única de 64 K que
comparten kernel + overlays. Dentro de una banda los overlays son mutuamente exclusivos
(se paginan uno a uno); entre bandas COEXISTEN (p.ej. TOWN nivel-1 + COMBAT nivel-2 +
CMDS nivel-3 + CAST2 nivel-4 + DATA a la vez).

| # | overlay | load_seg | end_seg | nreloc | reloc_hdr | **near_call_base** | banda/nivel |
|---|---------|----------|---------|--------|-----------|--------------------|-------------|
| 1 | TOWN.OVL     | 0x081d | 0x09a4 | 0 | 0    | **0x81d0** | 1 |
| 2 | MAINOUT.OVL  | 0x081d | 0x09e8 | 0 | 0    | **0x81d0** | 1 |
| 3 | DUNGEON.OVL  | 0x081d | 0x0a12 | 0 | 0    | **0x81d0** | 1 |
| 4 | INTRO.OVL    | 0x081d | 0x0a29 | 2 | 0x10 | **0x81c0** | 1 (con reloc) |
| 5 | FLAMES.OVL   | 0x0a29 | 0x0a2b | 0 | 0    | **0xa290** | 2 |
| 6 | NPC.OVL      | 0x0a29 | 0x0b5c | 0 | 0    | **0xa290** | 2 |
| 7 | COMBAT.OVL   | 0x0a29 | 0x0bf8 | 0 | 0    | **0xa290** | 2 |
| 8 | BLCKTHRN.OVL | 0x0a29 | 0x0af0 | 0 | 0    | **0xa290** | 2 |
| 9 | LOOKOBJ.OVL  | 0x0a29 | 0x0b46 | 0 | 0    | **0xa290** | 2 |
| 10| DNGLOOK.OVL  | 0x0a29 | 0x0b64 | 0 | 0    | **0xa290** | 2 |
| 11| OUTSUBS.OVL  | 0x0a29 | 0x0ac3 | 0 | 0    | **0xa290** | 2 |
| 12| SHOPPES.OVL  | 0x0a29 | 0x0b9c | 0 | 0    | **0xa290** | 2 |
| 13| ENDGAME.OVL  | 0x0a29 | 0x0ad8 | 0 | 0    | **0xa290** | 2 |
| 14| SJOG.OVL     | 0x0bf8 | 0x0e1e | 0 | 0    | **0xbf80** | 3 |
| 15| CMDS.OVL     | 0x0bf8 | 0x0dc9 | 0 | 0    | **0xbf80** | 3 |
| 16| CAST.OVL     | 0x0bf8 | 0x0e0f | 0 | 0    | **0xbf80** | 3 |
| 17| TALK.OVL     | 0x0bf8 | 0x0d29 | 0 | 0    | **0xbf80** | 3 |
| 18| CAST2.OVL    | 0x0e1e | 0x0f3a | 0 | 0    | **0xe1e0** | 4 |
| 19| ZSTATS.OVL   | 0x0e1e | 0x0f4f | 0 | 0    | **0xe1e0** | 4 |
| 20| COMSUBS.OVL  | 0x0e1e | 0x0f64 | 0 | 0    | **0xe1e0** | 4 |
| 21| SHOPPES2.OVL | 0x0e1e | 0x0ed0 | 0 | 0    | **0xe1e0** | 4 |
| 22| SHOPPES3.OVL | 0x0e1e | 0x0ebc | 0 | 0    | **0xe1e0** | 4 |
| 23| FONT.OVL     | 0x0e1e | 0x0f08 | 0 | 0    | **0xe1e0** | 4 |
| 24| DATA.OVL     | 0x0f64 | 0x1bb8 | 3 | 0x10 | **0xf630** | 5 (datos residentes) |

El RESIDENTE (ULTIMA.EXE kernel + gestor PLINK + stubs) ocupa CS `0x0000–0x81D0`; los
overlays de nivel-1 cargan en `0x81D0` PISANDO la zona de stubs/crt0 (0x7A16–0x81C6) tras el
arranque (por eso un thunk que apunta a 0x7cXX resuelve a un STUB del kernel — sólo válido
ANTES de que el nivel-1 lo pise; los thunks los coloca el linker en la imagen residente).

Regla del reloc-header: sólo los overlays con `nreloc>0` (INTRO #4, DATA #24) llevan una
cabecera de reubicación de **0x10 bytes** al inicio del fichero → su base efectiva baja 0x10
(load_seg*16 − 0x10). El resto (nreloc=0) usa `load_seg*16` exacto.

---

## 2. Validación (3 anclas independientes — todas cuadran)

| overlay | `call` | near_call_base | → CS_target | qué es | fuente que confirma |
|---|---|---|---|---|---|
| INTRO.OVL | `0xfffffb1a` | 0x81c0 | **0x7cda** | stub→FONT `font_scene_init` | intro-demo-scene.md §0 |
| FONT.OVL  | (base) | 0xe1e0 | — | load_seg 0x0e1e = base 0xe1e0 | font.md:3 |
| TOWN/MAINOUT | `0xffffaea2` | 0x81d0 | **0x3072** | rutina de TERREMOTO | ver abajo |
| CAST.OVL | `0xffffc10e` | 0xbf80 | **0x808e** | stub→CAST2 `0x00DE` (getstring rúnico) | cast-input.md §1 |
| COMBAT.OVL | `0xffffa11e` | 0xa290 | **0x43ae** | residente `pcspeaker_glide` | speaker.ts (glide 0x43ae) |
| COMBAT.OVL | `0xffffa172` | 0xa290 | **0x4402** | residente `get_tile_ptr` | ambient-audio-audit.md |
| COMBAT.OVL | `0xffffdb46` | 0xa290 | **0x7dd6** | stub→COMSUBS `0x0822` | — |

Cubren los TRES tipos de destino: residente (0x3072/0x43ae/0x4402), stub→otro overlay de
banda superior (0x7cda→FONT, 0x808e→CAST2, 0x7dd6→COMSUBS) e intra/inter-overlay. Que
`0x43ae` caiga EXACTO sobre `pcspeaker_glide` y `0x4402` sobre `get_tile_ptr` (rutinas ya
etiquetadas por otras vías) es confirmación independiente de la base 0xa290 de nivel-2.

**Cierre del caso #29 (quake):** `call 0xffffaea2` (TOWN 0x0ea3 tras abrir el muro del
clavicémbalo; MAINOUT 0x0a7d en el terremoto aleatorio del underworld) → CS `0x3072` en el
RESIDENTE (ULTIMA.EXE.asm label `3072:`, byte crudo file `0x3872`). El contenido CONFIRMA
que es la sacudida+rumble: prólogo con locales, bucle `si=8..0xB3 step 3` que (a) re-blitea
tiras con `call 0x71ca` (la SACUDIDA vertical de la ventana) y (b) emite tonos de
frecuencia ALEATORIA con `call 0x2092` (rand_range) → `call 0x22e2` (pcspeaker_beep = el
RUMBLE). Coincide con el testigo medido en quake-harpsichord.md §2 (sacudida vertical
pulsada + rumble grave de tonos bajos aleatorios). El ⚠ de "offset exacto pendiente" de
quake-harpsichord.md §3 queda RESUELTO: **kernel 0x3072**.

---

## 3. Cómo resolver una `call 0xffffXXXX` cualquiera (receta)

1. Identifica el overlay `O` del fichero `.asm` donde está la llamada.
2. `base = near_call_base(O)` (columna de la tabla; o `dispatch_table.overlay_near_call_base`).
3. `CS = (base + 0xXXXX) & 0xFFFF`.
4. Localiza `CS` en las bandas de §1:
   - `CS < 0x81D0` → RESIDENTE: mira `re/disasm/ULTIMA.EXE.asm` en el label `CS:` (byte
     crudo = `CS + 0x800`).
   - `load_seg(P)*16 ≤ CS < end_seg(P)*16` para algún overlay `P` de una banda SUPERIOR o el
     mismo → fichero `P`: `file_off = CS − load_seg(P)*16 + reloc_header(P)`. (Si `P==O`, es
     una llamada intra-overlay y `file_off = 0xXXXX` directo.)
5. Cita SIEMPRE el `.asm` completo + offset resultante.

Los thunks `0x7cc2–0x7d08` (tabla de 12 B: `lcall 0x72e:0x2ec ; dw sel ; ljmp 0:entry`) son
el caso especial en que `CS` cae en un STUB del kernel: el `ljmp 0:entry` del stub da el
destino ya paginado; `dispatch_table.stubs()` lo tabula (164 stubs) con
`entry_file_off = entry_linear − load_seg*16 + reloc_header`.

---

## 3.bis — NO EXISTE UN SESGO ÚNICO (error a evitar)

Es tentador medir el desfase con un caso y generalizarlo. **No se puede.** El desfase ES
`near_call_base(banda)`, y hay cinco:

| banda | overlays | `near_call_base` | desfase aparente `crudo → CS` |
|---|---|---|---|
| 1 | TOWN, MAINOUT, DUNGEON | `0x81d0` | `−0x7E30` (mod 64K) |
| 1 | INTRO (reloc) | `0x81c0` | `−0x7E40` |
| 2 | FLAMES, NPC, COMBAT, BLCKTHRN, LOOKOBJ, DNGLOOK, OUTSUBS, SHOPPES, ENDGAME | `0xa290` | `−0x5D70` |
| 3 | SJOG, CMDS, CAST, TALK | `0xbf80` | `−0x4080` |
| 4 | CAST2, ZSTATS, COMSUBS, SHOPPES2, SHOPPES3, FONT | `0xe1e0` | `−0x1E20` |

El caso que más se ve escrito (`call 0x58d0` → `print_string` en `0x1850`, desfase
`0x4080`) es **sólo la banda 3**. Aplicarlo a una llamada de BLCKTHRN o de SHOPPES2 da un
offset equivocado que además suele caer dentro de otra rutina — y entonces «el disasm sale
desalineado». Herramienta: `re/tools/verify_cites.py resolve <OVERLAY> <crudo>`, y
`resolve_unique(<crudo>)` cuando no se sabe el llamante (deduce la banda buscando el
literal `call 0xffffXXXX` en los `.asm`; si todos los llamantes caen en la misma banda la
resolución es única).

## 3.ter — Barrido de citas del corpus (2026-07-25)

Barrido de las citas escritas como «kernel `0xNNNN`». Como el residente ocupa
`CS 0x0000–0x81D0`, **toda cita con `NNNN ≥ 0x81D0` es imposible como CS** ⇒ es un destino
crudo mal etiquetado. Resultado: **23 citas en 17 notas**, y **las 23 resuelven de forma
ÚNICA** (ninguna quedó no concluyente; ninguna necesitaba oráculo). Ya llevan su
resolución inline en la propia línea; trinquete en `test_notes_raw_kernel_cites_do_not_grow`.

| cita | destino real |
|---|---|
| `blackthorn.md` / `death-resurrection-audit.md` / `shops.md` `0xdc66` | **CAST2.OVL:0x05e0 `resurrect_apply`** (vía stub 0x7ef6) |
| `use-merchants.md 0x9dfa` | **SHOPPES.OVL:0x019a `shop_falsehood_gold_theft`** (vía stub 0x7fda) — ver §REFUTADO en esa nota |
| `witness-9cb6-bonus.md` / `witness-summon-position.md 0x9cb6` | **COMBAT.OVL:0x120e `random_board_cell`** (vía stub 0x7e96) |
| `interactions-piano-fire-audit.md 0xc232` | `ULTIMA.EXE:0x4402 get_tile_ptr` |
| `npc.md 0xbb02 / 0xbb56 / 0xbb9e / 0xd89a` | TOWN.OVL `0x10da town_possessed_npc_attack` / `0x0958 town_alarm_all_npcs` / `0x011e find_npc_by_objIdx` / `0x1726 npc_place` |
| `combat-ui-spec.md 0x8670 / 0xb680 / 0xdb0a / 0xdbfa` | `draw_status_panel` / `viewport_redraw` / COMSUBS `0x0094 print_combatant_name` / SJOG `0x1b6c sum_flee_edges` |
| `audit-byte-wrap.md 0x9c84` | `ULTIMA.EXE:0x3f14 add_word_capped` |
| `dungeon-input-model.md 0xbeb0` | `ULTIMA.EXE:0x4080 set_active_player_prompt` |
| `intro*.md 0xfb1a / 0x8a62 / 0x8b8c` | FONT `0x04a4 font_scene_init` / `gfx_select_render_target_sel0f` / `gfx_drv_sel4b_wrapper` |
| `top21-triage.md 0x9ec2` | `ULTIMA.EXE:0x2092`, entrada rand DENTRO de `rng_seed_from_dos_clock` |
| `sjog.md 0xbdf6` | COMBAT.OVL:0x0000 — **contradicción declarada**, ver `verify_blocked` de esa rutina en el ledger |

## 4. Reproducción

```bash
cd re/tools
python3 - <<'PY'
import dispatch_table as dt
ovs={o.name:o for o in dt.overlay_table()}
for o in dt.overlay_table():
    print(o.num, o.name, hex(o.load_seg), hex(o.end_seg), o.nreloc,
          hex(dt.overlay_reloc_header(o)), "base=",hex(dt.overlay_near_call_base(o)))
def R(name,wrap):
    o=ovs[name]; cs=(dt.overlay_near_call_base(o)+wrap)&0xffff
    print(name, hex(wrap), "->CS", hex(cs), "file(resid)" , hex(cs+0x800) if cs<0x81d0 else "in-overlay")
R("INTRO.OVL",0xfb1a); R("TOWN.OVL",0xaea2); R("MAINOUT.OVL",0xaea2)
PY
```

---

## 5. Pendiente: cruce con load_seg de RUNTIME (oráculo del camp) + la Δ de COMBAT

La tabla de §1 es ESTÁTICA (parseada de la imagen). Falta contrastar con los `load_seg`
OBSERVADOS en runtime por el oráculo del camp (el agente los va a anotar) para blindar dos
cosas:
1. Que el linker no reubica bandas en runtime (esperado: no; las bases son fijas por nivel).
2. La "Δ0x16 en COMBAT" que motivó la tarea: en la tabla ESTÁTICA COMBAT tiene `nreloc=0`
   → SIN cabecera → `base = 0xa290` exacto. EVIDENCIA de que 0xa290 es correcto SIN Δ: sus
   `call 0xffffXXXX` residentes caen sobre rutinas YA etiquetadas por otras vías —
   `0xffffa11e→0x43ae` = `pcspeaker_glide` (speaker.ts) y `0xffffa172→0x4402` =
   `get_tile_ptr` (ambient-audio-audit.md) — y sus stubs a COMSUBS resuelven a file_off
   válidos. No aparece Δ0x16 (0x16=22) por reloc-header; la única Δ derivada es 0x10 de
   INTRO/DATA. Si el oráculo del camp observa una Δ0x16 REAL en runtime, sería otra cosa
   (¿selector→índice? ¿2º nivel de paginación?) y se añade aquí — pero con la evidencia
   estática, COMBAT NO la necesita (probable: la "Δ0x16" precede a la regla near_call_base
   de dispatch_table.py y quedó obsoleta).

**Runtime observado (oráculo del camp del bardo, 2026-07-16):**
- kernel `load_seg 0x0824` — coincide con la base de carga MZ derivada estáticamente (§1). ✓
- La primitiva de la canción del bardo resultó ser KERNEL `0x2192` (pcspeaker_tone_sweep),
  NO un overlay — el thunk CAST2 `0x7f02` era una pista falsa (ver camp-scene-kernel.md §6).
- La "Δ0x16 de COMBAT" NO se observó en runtime: era una derivación previa a la regla
  `near_call_base`, obsoleta (confirmada la lectura del §5.2). Los thunks "de entrada del
  camp" (0x7c02→DNGLOOK) eran la rama de DUNGEON del comando, no la overworld.

Con esta tabla, #20 (endgame tile-cinematics) y cualquier bardo futuro resuelven sus thunks
mecánicamente.
