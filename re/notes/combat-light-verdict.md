# VEREDICTO — ¿censura por luz en la ARENA de combate? (ADJUDICACIÓN, task #33/#37, 3ª lectura ciega + witness runtime)

**VEREDICTO: NO hay censura por luz en combate.** La arena 11×11 se compone
**ENTERA y 1:1 SIEMPRE** (día, noche, mazmorra), sin flood, sin radio de luz, sin
rombo negro nocturno. El combate corre con `g_location = 0xFF` (≥ 0x80) y las rutinas
de render bifurcan a la rama "arena" (copia cruda, sin máscara radial). La rama
LOS/flood (`0x5910`→`0x5D0A`→`0x5A28`) es la del **MUNDO** (`loc < 0x80`) y **nunca se
alcanza en combate**.

Queda **SUPERSEDED `combat-light-adjudication.md` (#33)** (afirmaba lo contrario:
combate corría `loc < 0x80` con flood centrado en el activo). Queda **CONFIRMADA
`combat-frame-adjudication.md` (R2)** en su totalidad. Este veredicto se decide con
**witness runtime** (abajo), como manda el precedente del flood Moore (#23).

> **Convención de offsets.** `kernel 0xNNNN` = offset de imagen de `ULTIMA.EXE.asm`
> (`re/disasm/ULTIMA.EXE.asm`, direcciones `off: bytes  insn`). `COMBAT 0xNNNN` =
> fileoff de `COMBAT.OVL.asm`. Globals verificados contra `re/ledger/globals.json`:
> `g_location` 0x5893, `g_party_x/y` 0x5896/0x5897, `g_light_level` 0x58A5,
> `g_cmb_actor` 0x589E; arena 0xAD14, buffer pantalla 0xAB02, tabla de combatientes
> DS:0xBA14, tabla de sprites de combate 0x5C5A.

---

## 1. WITNESS RUNTIME (lo decisivo)

Oráculo `re/tools/oracle.py` headless (dosbox-x, `load_seg=0x0824`), save de
referencia `original/u5/ultima5`. Entrada de combate determinista con
`combat_parity.enter_combat()` (inyecta una Giant Rat adyacente en el overworld y la
Ataca; detección por los registros DS:0xBA14). Script:
`scratchpad/combat_light_witness.py`; log crudo: `scratchpad/witness_out.log`.

**Observado (LIVE, leyendo el global `g_location` en gameseg 0x5893):**

| Momento | `g_location` (LIVE) | combat_live (recs DS:0xBA14) |
|---|---|---|
| Mundo (pre-combate, save en pueblo) | `0x11` | — |
| Combate, muestra 0–5 (6 lecturas) | **`0xFF`** ×6 | True (5 recs: party+enemigos) |
| Combate, turno del PJ estabilizado | **`0xFF`** | True |
| Hit de BP en `kernel 0x5910` (compositor) durante combate | **`0xFF`** | True |
| Disparos de `kernel 0x5A28` (flood) durante combate | **0** (nunca observado) | — |

`enter_combat -> True`. **Ocho lecturas independientes de `g_location` durante el
combate = `0xFF`** (seis muestras + turno-PJ + el hit del BP en el propio compositor
`0x5910`). El flood `0x5A28` **no se disparó** en el tramo medido.

> **Alcance del witness / honestidad.** El sub-test de BP (contar hits de `0x5910`
> vs `0x5A28` a lo largo de varios repintados) se cortó tras el 1er hit por el fallo
> conocido "CS:IP ilegibles en pausa" (regla 6 de `re/notes/oracle.md`: respuestas
> `EV` rancias del pty), **agravado por el CONFOUND del dosbox VIVO del usuario**
> (PID 84640, monta `original/u5/play`), que NO se puede matar (comparte CPU freewheel
> y degrada el canal pty). No se repitió porque la lectura PRIMARIA —`g_location=0xFF`
> durante el combate, confirmada 8 veces incl. en un hit del compositor— **ya es
> dispositiva**: a `loc=0xFF` la rama flood es estáticamente inalcanzable (§2-§4).
> El único dosbox tras el run es el del usuario (mi instancia la cerró `quit()`).

## 2. Mi lectura del disasm — el bracket `0x5F86…0x6094` SÍ abraza TODO el combate (crux 1)

Trazado leído de `ULTIMA.EXE.asm` 10134-10276:

`kernel 0x5F86` (dispatcher de "modo especial de pantalla", `ret 6`):
- `5fa8`: guarda `g_location` → `g_unk_5894`.
- **`5fb4`: `mov [g_location], 0xFF`** (fija loc=0xFF ANTES de despachar).
- `5fbe-5fd8`: respalda la tabla de sprites de combate `0x5C5A → 0xA9FC`.
- `5fda`: `cmp [bp+8], 0` (bp+8 = **mode**). mode≠0 → `602e`.
- **`602e`: `test [bp+8], 4` (mode&4); `603d`: `call 0x8076`** = `lcall 0x72e:0x2ec`
  = trampolín far de overlay (**COMBAT.OVL**). El handler de combate corre AQUÍ.
- `0x8076` retorna a `6040` → `605c`/`606c` → bloque de restauración.
- **`6091-6094`: `mov [g_location], [g_unk_5894]`** — RESTAURA loc, **DESPUÉS del
  retorno del handler**. `60c3-60e2`: restaura `0x5C5A` desde `0xA9FC`. `60e9: ret 6`.

Caller = wrapper de combate `kernel 0x6360` (10521-10533):
`6369: mov ax,4; 636c: push ax` (= **mode=4**, [bp+8]), `636d/6370` push args,
**`6373: call 0x5F86`**, y sólo tras volver `6376: call 0x5E4A`. ⇒ **el bucle entero
de combate (COMBAT.OVL vía 0x8076) corre dentro del bracket `loc=0xFF`**. El witness
lo confirma en vivo (loc=0xFF durante todo el combate).

**Aquí está el error de #33**: vio `0x5F86` y lo descartó como "render de mapa
puntual, NO el bucle de combate". Falso: su rama mode&4 ES el despacho far a
COMBAT.OVL, y la restauración de loc ocurre tras retornar. El bracket abraza el
combate.

## 3. Las 3 rutinas de render gatean a la rama ARENA en `loc ≥ 0x80` (crux 2, 3)

Leídas de `ULTIMA.EXE.asm`:

- **`0x5910`** (compositor, 9528-9631): `5954: cmp [g_location],0x80; 5959: jb 0x595e`
  (rama flood) `/ 595b: jmp 0x59f8` (rama directa). Rama directa **`59f8-5a0b`**:
  `cx=0x160` (352B), `di=0xAB02`, `si=0xAD14`, `rep movsw`/`movsb` = **copia CRUDA de
  la arena a pantalla, SIN máscara**; luego `5a0d: call 0x5394`. La rama flood
  (`595e…`) empuja luz + `(g_party-g_chunk_origin)` y llama `5987: call 0x5D0A` (→
  flood). **Con loc=0xFF se toma la copia directa** (witness: hit de 0x5910 con
  loc=0xFF).
- **`0x4402`** (lookup de tile): `4408: cmp [g_location],0x7f; 440d: jbe 0x4420`
  (mundo/pueblo, lee `0x6608`) `/` `440f-4419`: `addr = [bp+4]<<5 + [bp+6] + 0xAD14`
  = **arena, SÓLO direccionable en `loc ≥ 0x80`**. Como el combate dibuja la arena,
  el combate ES `loc ≥ 0x80` (si fuera `<0x80` dibujaría el overworld — absurdo).
- **`0x5394`** (sprites, 9007…): `539c: cmp [g_location],0x80; 53a1: jb 0x53a6`
  (mundo: lee `g_party`, aplica máscara radial `0x6ff0`) `/ 53a3: jmp 0x542a`
  (arena: **salta la lectura de g_party y la máscara**). El recentrado
  `sprite-(g_party-5)` está gateado `5488: jae 0x54b9` = **saltado en combate**.
- Corroboración: el draw-mapper `0x3522` (`3525: cmp [g_location],0x80; 352a: jae
  0x3542`) **también salta la resta `(g_party-5)` en `loc≥0x80`**, y la hit-flash
  `0x3564` (`356b: cmp [g_location],0x7f; jbe`) indexa la tabla de combatientes
  `0xBA14` directamente por índice, **no vía g_party**.

## 4. El flood `0x5A28` no es alcanzable en combate (crux 4)

`0x5A28` tiene **exactamente 2 call-sites**: `0x5D61` (dentro de `0x5D0A`) y `0x5F57`
(dentro de `0x5E4A`, pase de emisores de luz).
- `0x5D0A` tiene **un solo call-site**: `0x5987`, **en la rama `loc<0x80` de
  `0x5910`**. Inalcanzable en combate.
- `0x5E4A` se llama de `0x47DF`, `0x6350` y **`0x6376`**. El `0x6376` está en el
  wrapper de combate `0x6360` **pero DESPUÉS de `6373: call 0x5F86`** — es decir,
  **tras retornar del combate y restaurar loc** (repintado del MUNDO al salir del
  combate), no durante el combate. Los otros dos son de contexto de mundo.

⇒ Ningún camino de render de combate llama al flood ni lee `g_party`. Witness:
`0x5A28` no se disparó en el tramo de combate medido.

## 5. Por qué se ESCRIBE `g_party = activo` si el render no lo lee (crux 5)

`COMBAT 0x0646-065C` copia la celda del combatiente activo (`[0xBA14 + actor*8 + 6/7]`)
a `g_party_x/y`. Censo de `COMBAT.OVL`: `g_party_x/y` **sólo se ESCRIBE (0655/065c),
nunca se LEE** dentro del overlay. Y las rutinas de render en `loc≥0x80` **no leen
g_party** (§3: 0x5910 copia directa; 0x5394/0x3522 saltan la lectura). Por tanto la
escritura es **inerte para el render de combate** (resto vestigial de código
compartido con el mundo, o consumida por una rutina no-render). La inferencia de #33
—"se escribe g_party ⇒ corre la rama flood centrada en el activo"— es un
**non-sequitur**: el flood no lee esa escritura porque el flood no corre en combate.

## 6. Qué debe hacer el PORT

1. **REVERTIR task #37**: el combate **no tiene campo de visibilidad**. La arena y
   todos los combatientes se ven **siempre** (día, noche, mazmorra). Retirar el
   `floodFOV`/`combatVisField`/censura por luz de la vista de combate; el snapshot de
   combate deja la visibilidad **toda a visible** (estado pre-#37).
2. **No portar `floodFOV` a la arena** bajo ningún radio. La tabla radial `0x6ff0`/
   `radialOffset` es maquinaria del MUNDO (party en (5,5)); en combate no interviene.
3. **Encuadre**: arena FIJA 11×11, celda de arena = celda de ventana (modelo (B) de
   R2). Sprites de combatientes en su celda cruda; sólo se omiten celdas fuera de
   arena (`0xFF`) y `0x87`. El motor ya lo modelaba.
4. **`combat-ui-spec §8`**: eliminar la reserva de `combatView.visibility`.

Esto cierra de golpe R1 (sobre-censura diurna), R2 (encuadre: fijo, sin flood) y R3
(fallback de centro) de la review de #37.

## 7. Estado de las notas

- **`combat-frame-adjudication.md` (R2)**: CONFIRMADA (esta nota la ratifica con
  witness). Sigue vigente como la lectura estática de referencia.
- **`combat-light-adjudication.md` (#33)**: **SUPERSEDED** por esta nota (banner
  añadido al inicio). Su maquinaria del flood del MUNDO es correcta; su fallo decisivo
  fue asumir `loc<0x80` en combate sin verificar el bracket `0x5F86`/el gate
  `loc≥0x80`/la inalcanzabilidad de la arena `0xAD14` con `loc<0x80`.
