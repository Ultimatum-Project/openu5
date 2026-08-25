# Sitios de `screenFlash` (kernel_flash 0x3AE6) — censo derivado

Derivación de TODOS los call-sites del primitivo de **flash de pantalla** del binario,
con el hechizo/escena a que pertenecen y el conteo `n` por sitio. Nace del carril
`fiel/spell-fx` (efectos visuales de casteo, 2026-07-18): al acotar el testigo del
usuario a **An Nox fuera de combate**, hubo que deslindar qué casts producen flash y
cuáles no. Conclusión de cabecera: **el flash 0x3AE6 vive en escenas SCRIPTADAS raras
(meditación al Codex, escena gated por coordenadas, narraciones) + eventos de comando —
NO en el casteo cotidiano, y NO en An Nox / la familia de curas.**

## 1. El primitivo — kernel `0x3AE6` (`kernel_flash(n)`)

`ULTIMA.EXE.asm` 0x3ae6-0x3b18 (`ret 2`, 1 arg = `n`):
```
3aed cmp g_unk_58a4, 0 ; je return      ; gate (flash habilitado)
3af9 if n <= 0 → return
LOOP si=n..1:
  3b07 call 0x5910                        ; REDRAW de la escena
  3b0d push 1; call 0x20fa                ; delay (1 unidad)
  dec si; jne loop
```
Es `n × [redraw + delay]` (`combat.md §12`: "n flashes+beep"). El port ya lo modela como
`CombatFx { kind:"screenFlash", n }` (`game/src/skin/api.ts`), hoy SOLO usado en combate
(daño de terreno/evento). La cadencia wall-clock del `delay 0x20fa` es **Clase C** (no
computable del asm sin timing de ciclos).

**Resolución de banda** (REGLA A, `quake-harpsichord.md §6`): un `call 0xXXXX` a este
kernel resuelve a `(XXXX + near_call_base) & 0xffff = 0x3AE6`:
- CAST2 (banda 4, base 0xe1e0): operando **`0x5906`**  → `(0x5906+0xe1e0)&0xffff = 0x3AE6` ✓
- CMDS  (banda 3, base 0xbf80): operando **`0x7b66`**  → `(0x7b66+0xbf80)&0xffff = 0x3AE6` ✓

## 2. Censo de call-sites (10 en CAST2/CMDS)

Handler = prólogo `55 8bec` más cercano hacia atrás (verificado). `n` = word empujado
justo antes del `call`.

| overlay | site | n | handler | qué es (derivado) | confianza |
|---------|------|---|---------|-------------------|-----------|
| CAST2 | 0x09b7 | 10 | 0x0966 | escena SCRIPTADA gated por coords: compara `g_party_x/y` contra tabla 8× X/Y (`DS:0x1f6e`/`DS:0x1f76`), fija `g_char_anim_states=0x6c`, `g_karma=0x63`; 4 flashes en secuencia | **CONFIRMADO 14-08: RITO DE SANTUARIO** (0x0966 escribe los bitmaps de shrines `0x58ce`/`0x58cc` y el karma `0x63`; la tabla 8× son las coords de los 8 santuarios — derivación completa en shrine-rito-cadencia-negativo.md) |
| CAST2 | 0x09f2 | 6  | 0x0966 | idem (2º flash de la secuencia) | CONFIRMADO idem |
| CAST2 | 0x0a4f | 12 | 0x0966 | idem (3º flash) | CONFIRMADO idem |
| CAST2 | 0x0d1a | 10 | 0x0966 | idem (4º flash; el `mov g_karma,0x63` está en 0x0d11, justo antes) | CONFIRMADO idem — es el flash del WELL DONE, y su negativo queda SOSTENIDO hasta el siguiente redibujo. 🔴 La duración en SEGUNDOS es del DOSBox del grabador, no del juego: 13,0 s en lordfenton y 7,0 s en aulddragon (razón ~1,85-2,2, espejo-barrido-2 paso 2 — TODA la escena escala ×2,2-2,4 entre esos dos corpus). El invariante portable es «hasta el siguiente redibujo», nunca una cifra en ms |
| CAST2 | 0x0e68 | 1  | 0x0d24 | escena de NARRACIÓN: imprime strings `DS:0xb703`/`DS:0xb733` con cursor (`0x448c`/`0x3670`) | **CONFIRMADO 14-08: CÓDICE** (0x0d24 es el handler de la visita al Codex — NUEVE esperas de tecla en su cuerpo + una en 0x110b; shrine-rito-cadencia-negativo.md) |
| CAST2 | 0x0e72 | 4  | 0x0d24 | idem (2º flash) | CONFIRMADO idem |
| CAST2 | 0x1081 | 1  | 0x0e76 | **meditación / peregrinación al Shrine of the Codex** (`magic.md §1`: CAST2:0x0e76 guarda g_location, snapshotea 0x5c5a, escribe bitmap de shrines 0x58CE) | [D] |
| CAST2 | 0x10c3 | 10 | 0x0e76 | idem shrine (2º flash) | [D] |
| CMDS  | 0x018c | **52** (0x34) | (comando) | evento de comando: fija `[DS:0x6a08]=1` antes; flash largo dramático | [D] (es comando, no hechizo) |
| CMDS  | 0x1b9c | 10 | (comando) | evento de comando | [D] (comando) |

~~Los DOS `⚠ SIN CONFIRMAR` son los handlers 0x0966 (candidato gate-travel/shrine-reward por
la tabla de 8 coordenadas + karma) y 0x0d24 (narración): identificar el hechizo exacto
requiere resolver la jump-table del dispatcher (CAST.OVL 0x1146 → trampolines → CAST2) o el
oráculo. No se hizo aquí por estar fuera del alcance del carril.~~
**RESUELTO 14-08** (av-rito-efectos, sin jump-table ni oráculo — por el CONTENIDO de los
handlers): 0x0966 = **rito de santuario** (bitmaps de shrines 0x58ce/0x58cc + karma 0x63 +
tabla de 8 coords = los 8 santuarios) y 0x0d24 = **visita al Códice** (nueve esperas de
tecla sobre el par de strings de narración). El «candidato gate-travel» quedaba corto pero
apuntaba bien. Derivación entera y careo con vídeo (13/13 ceremonias):
`shrine-rito-cadencia-negativo.md`.

## 3. Lo que NO flashea — An Nox y la familia de curas (cita firme)

**An Nox** (`CAST.OVL:0x01ae-0x01f8`, leído instrucción a instrucción):
```
01b5 call 0xffffc1aa       ; select_party_member → slot (<0 cancela)
01cd si = slot<<5 + 0x55b3 ; rec+0x0B = STATUS
01d1 cmp [si], 'P'(0x50)   ; ¿envenenado? no → resultado 0
01d6 [si] = 'G'(0x47)      ; CURA
01dd push 1; call 0xffffc186 ; CAST2:0x0000 efecto 1 = GLISSANDO (sonido de casteo)
01e0 g_unk_a9fa = 1        ; DIRTY FLAG del panel de party
```
`g_unk_a9fa` = flag "panel de party sucio": lo leen los bucles principales
(`MAINOUT 0x05a3`, `TOWN 0x0dd3`, `DUNGEON 0x03de`) que **redibujan el panel de roster**
(`0x8670`, `ui-render-map.md`) y lo limpian. El realce de la fila durante el picker es
**vídeo inverso** (`draw_roster_row` control 0xfd @0x2867).

⇒ El efecto de An Nox = **picker(fila inversa) + glissando + redraw del roster con la letra
de estado 'P'→'G'**. NINGÚN `call 0x5906`/0x3AE6 en el handler. La familia Mani/curas
comparte el patrón (p.ej. `CAST2:0x03fb` pone `g_unk_a9fa=1`, sin flash).

**El port ya reproduce esto** (`main.ts` doCast cure → `pickMember`+`applyCure`+`emitSfx('cast-spell')`;
`fiel/roster.ts` letra de estado col 14; `fiel/skin.ts` fila del picker en inverso via
`selectCursor`). Cerrado como YA-FIEL 2026-07-18.

## 4. Implicación para un futuro "screenFlash por-hechizo fuera de combate"

El paquete cubriría solo estas escenas scriptadas raras (candidato gate-travel, meditación
al Codex, narraciones) + eventos de comando; payoff de cara al usuario BAJO. Alimenta dos
carriles: **#10/endgame** (la meditación al Shrine of the Codex) y **moongates** (el
candidato gate-travel de 0x0966). El `screenFlash(n)` primitivo ya existe en la piel; faltaría
emitir el evento desde estos handlers concretos y pintarlo fuera de combate. Los dos handlers
`⚠ SIN CONFIRMAR` deben identificarse (jump-table u oráculo) antes de cablearlos.
