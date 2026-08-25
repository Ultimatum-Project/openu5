# ZSTATS.OVL — Z-stats display + Ready/equipar (Task 3.12)

Overlay #23, 4880 B (0x1310), load_seg 0x0e1e. 17 funciones (prólogos `55 8bec`
verificados) + 1 byte nop de padding; catálogo `re/tools/zstats_catalog.py`
(ledger 100%, 18 segmentos, 0 huecos). Regla de rebase de kernel VERIFICADA:
`K = (T − 0x1e20) mod 0x10000` (p.ej. 0x3670→0x1850 print, 0x3eb2→0x2092 rand_range,
0x8c80→0x6e60 unequip).

Las TABLAS que consulta viven en DATA.OVL (imagen del DGROUP, `fileoff = DS + 0x10`),
NO en el overlay: tabla de TIPOS `DS 0x1a7e` y de PESOS `DS 0x1aae` (48 bytes c/u).

## Mapa de funciones (offsets de fichero)

| off | nombre | qué hace |
|---|---|---|
| 0x0000 | resolve_display_char | elige party-index a mostrar; en combate (loc>0x80) lee el actor activo; −1='None!' |
| 0x0082 | draw_stat_page | clase "AMBFDTPRS"(+0xA), status "GPDSC"(+0xB), género(+0x9 CP437 ♂/♀), Str/HP/Int/HM/Dex/Ex |
| 0x0278 | print_padded_string | nombre de tabla DS 0x1962 (idx*2); 0xFF limpia |
| 0x02a8 | draw_magic_or_equipment_panel | 2ª pantalla por personaje (equipo +0x19..+0x1E / spellbook) + consumibles |
| 0x045e | draw_list_frame | marco de lista (glifos 0x10/0x11/0x13/0x14/0x15/0x16) |
| 0x0518 | is_item_equipped | ¿itemId en alguno de los 6 slots +0x19..+0x1E? |
| 0x056c | find_prev_owned | scan hacia atrás de slots con qty>0 |
| 0x05a4 | find_next_owned | scan hacia delante de slots con qty>0 |
| 0x05e2 | print_list_row | '*'→readied '!'→cursed '('→numérico; qty right-pad |
| 0x06e8 | render_item_list | renderer genérico de las 4 sub-páginas y del picker de Ready |
| 0x099a | build_extended_item_table | aplana flags (carpets/skull_keys/amulet_lb/crown/…) en 0xB9EE (38 entradas) |
| 0x0a3a | **cmd_zstats** ENTRY (Z) | páginas por-personaje, consumibles, 4 listas scroll |
| 0x0bee | print_msg_line | helper de una línea de mensaje |
| 0x0c0a | **hand_state** | 2=ambas libres, 0=solo arma, 1=solo escudo (arma≠dos-manos), 0xFF=ninguna |
| 0x0c5c | **try_equip_or_unequip** | núcleo de Ready — §Ready |
| 0x0f2e | item_page_controller | loop interactivo (PgUp/PgDn/flechas, ENTER; mode 'R'→equip) |
| 0x1296 | **cmd_ready** ENTRY (R) | resuelve personaje, picker, invoca try_equip_or_unequip |

## Layout del record de personaje (base 0x55a8, stride 32)

`hand_state`/`is_item_equipped` usan base **0x55a8** (roster+2) → los 6 slots de
equipo caen en el layout DOCUMENTADO: +0x19 helmet, +0x1a armor, +0x1b weapon(manoA),
+0x1c shield(manoB), +0x1d ring, +0x1e amulet. Clase = +0x0a.

Atributos (cita: draw_stat_page imprime las etiquetas): **Str = +0x0c**, **Dex =
+0x0d** ('Dex=' DS 0x96f4 desde [bx+0x0d]), **Int = +0x0e** ('Int=' DS 0x96e8 desde
[bx+0x0e]). Esto cierra la pregunta abierta del scout: el encumbrance compara contra
**Str** (+0x0c) y el trap-detect de SJOG lee **Int** (+0x0e).

## Ready — try_equip_or_unequip @0x0c5c (REGLAS EXACTAS)

Orden de comprobaciones (citas de fichero):

1. **0x0c82**: itemId ∈ {0x1b(Arrows), 0x1d(Quarrels)} → `return 0` (munición, rechazo
   silencioso). Corresponde a **type 0x00** en la tabla 0x1a7e.
2. **0x0c94**: 9 ≤ itemId ≤ 15 (armadura) ∧ loc>0x7f (combate mazmorra) ∧
   `g_cmb_victory_flag==0` → "Thou canst not change armour in heated battle!" (0x97e2).
3. **0x0cbf**: `is_item_equipped` → **toggle-off**: unequip (kernel 0x6e60),
   `g_equip_qty[item]++` (cap 99); si loc>0x7f ∧ item==0x2a (Ring of Invisibility) →
   restaura visibilidad (tabla de clase DS 0x1ade). `return 0`.
4. **0x0d0c ammo-gate**: Bow(0x1a)/MagicBow(0x24) exigen `g_equip_qty[Arrows]>0`;
   Crossbow(0x1c) exige `g_equip_qty[Quarrels]>0`; si no → "Thou hast no ammunition
   for that weapon!" (0x981c).
5. **0x0d36 ENCUMBRANCE**: `total = Σ peso[slot] (6 slots, skip 0xff) + peso[nuevo]`
   con peso = `byte[DS 0x1aae + item]`; flag = `total <= Str(record+0x0c)`.
   **NO usa reqStrength por-item** (grep-verificado: 0x1abe no se referencia; era la
   MISMA tabla 0x1aae leída +16).
6. **0x0d91 slot por tipo** `byte[DS 0x1a7e + item]` (errores de slot ocupado ANTES
   del de fuerza):
   - 0x02 → ring(+0x1d); ocupado → "Only one magic ring may be worn at a time!" (0x9916)
   - 0x04 → amulet(+0x1e); ocupado → "Thou must remove thine other amulet!" (0x98f0)
   - 0x20 → una mano: `hand_state`; 0xff → "Thou must free one of thy hands first!"
     (0x9892); si ==2 usa la mano de arma; slot = manoA(+0x1b) o manoB(+0x1c)
   - 0x30 → dos manos: `hand_state` debe ser 2, si no "Both hands must be free before
     thou canst wield that!" (0x98ba); slot = manoA(+0x1b)
   - 0x40 → armor(+0x1a); ocupado → "Thou must first remove thine other armour!" (0x9866)
   - 0x80 → helmet(+0x19); ocupado → "Remove first thy present helm!" (0x9846)
7. **0x0de9**: si flag de encumbrance == 0 → "Thou art not strong enough!" (0x9942),
   sin equipar.
8. **0x0df2**: coloca el item, `g_equip_qty[item]--`.
9. **0x0e01 "Ring vanishes!"**: si item ∈ {0x2a, 0x2c} → `rand(0,15)==0` (1/16) → imprime
   "\n\nRing vanishes!\n" (0x995e), limpia el slot de anillo (+0x1d), tono; `return 1`.

**RNG**: exactamente 1 tirada — `rand(0,15)` en el 0x0e11 (ring-vanish). El display de
Z-stats consume 0.

## Tablas (DATA.OVL, volcadas)

- **TYPE (DS 0x1a7e, 48 B)**: `80 80 80 80 20 20 20 20 20 40 40 40 40 40 40 40 20 30
  20 30 20 20 20 20 20 20 30 00 30 00 20 30 30 30 30 30 30 20 20 20 20 30 02 02 02 04
  04 04`. 0x00 en 27/29 (Arrows/Quarrels). type 0x30 (dos manos) = {17,19,26,28,31,
  32,33,34,35,36,41}.
- **WEIGHT (DS 0x1aae, 48 B)**: `00 01 02 03 02 03 04 00 00 00 02 04 06 0a 0c 00 01 02
  03 02 03 04 06 05 07 08 08 00 06 00 09 10 0f 0d 12 00 00 08 00 05 00 00 00 00 00 00
  00 00`.
- **Clases (DS 0x9812)**: "AMBFDTPRS" = Avatar/Mage/Bard/Fighter/Druid/Tinker/Paladin/
  Ranger/Shepherd (9, no 4).

## Divergencias con el clon (cerradas en `game/src/core/equip.ts`, `party.ts`)

1. `equip.ts` usaba reqStrength por-item → **ENCUMBRANCE** (suma de pesos vs Str).
2. Faltaba el **ammo-gate** (Bow/Crossbow sin munición).
3. El clon dejaba equipar **Arrows/Quarrels** → el binario los rechaza (type 0x00).
4. Dos-manos **auto-desequipaba** el escudo → el binario EXIGE ambas manos libres.
5. Faltaba el efecto **"Ring vanishes!"** (1/16, ids 42/44).
6. `party.ts CLASS_LABELS` tenía 4 clases → ahora las **9** de "AMBFDTPRS".
7. Slot de una mano ahora vía `hand_state` (manoA primero, manoB si ocupada).

## Pendiente (⚠️ declarado)

- Side-effect de quitarse el Ring of Invisibility en mazmorra (tabla de clase 0x1ade) y
  el bloqueo de armadura en combate: expuestos como `EquipOpts.inDungeonCombat` +
  documentados; su cableado al bucle de combate es de Task 3.2/3.13.
- El display de Z-stats (paginación, símbolos ♂/♀, layout) es UI; el core exacto
  (encumbrance/slots) es lo portado. Paridad de layout pixel-a-pixel → Task F.
- Semántica de la rama especial de tipos y la tabla per-clase DS 0x1a58: no afecta al
  equip; sin derivar del todo.
