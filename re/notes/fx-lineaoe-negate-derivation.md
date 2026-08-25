# FX de combate: abanico de línea (In Vas Grav Corp) + inversión Negate-time — carril fx-combate

Derivación de los dos efectos visuales pendientes del censo de testigos
(`endgame-witness-20260721.md` TESTIGO 5 y TESTIGO 4 BONUS 2). Citas sobre
`re/disasm/CAST.OVL.asm`, `CAST2.OVL.asm`, `EGA.DRV.asm`, `ULTIMA.EXE.asm` y
DATA.OVL crudo. Ambos CALCO (implementados en el port, rama `fiel/fx-combate`).

## 1. ABANICO del hechizo de línea (CAST.OVL 0x1f60 → 0x1c36 → 0x1bb0) — ✅ CALCO

El aplicador 0x1c36 (ya derivado en `cast-line-area-spell-derivation.md` para la
mecánica) ES TAMBIÉN el dibujante del spray: traza **21 rayos** píxel a píxel y
registra de paso las celdas cubiertas.

### Geometría (0x1c36)
- **Origen** (0x1c45-0x1c67): coords de celda del actor (`[si-0x45e6/-0x45e5]`)
  → `px = celda*16 + 8` = esquina sup-izq del tile en pantalla (viewport en +8).
  Ajuste por dirección (0x1c6a-0x1cec): oeste `y+8` / este `x+16,y+8` / norte
  `x+8` / sur `x+8,y+16` ⇒ el abanico nace en el **punto medio del borde** del
  tile que mira a la dirección.
- **21 rayos** = la curva radial de 21 words (DS 0x1cf0, fileoff DATA.OVL
  0x1d00 = `[10,12,14,16,20,25,35,50,80,190,2000,190,80,50,35,25,20,16,14,12,10]`,
  copiada a 0xa9d0 en 0x1caa-0x1cb7). Aquí NO es peso de probabilidad sino
  **acumulador de pendiente**: por paso de eje `weight -= 10` (0x1e7d); al
  agotarse (<1) un paso PERPENDICULAR ±1 px y `weight += curve[i]` (0x1eea-0x1ef4)
  ⇒ pendiente = 10/curve[i]. Rayo 0/20 (10) = diagonal 45°; rayo 10 (2000) =
  recto. Sentido perpendicular: rayos 0-9 a un lado, 10-20 al otro (`si=±1` por
  `cmp [bp-0x5a],0xa`, 0x1ea9-0x1ecb; el eje→qué coord y el signo en
  0x1ecb-0x1f14: norte→x∓1, sur→x±1, oeste→y±1, este→y∓1).
- **Crecimiento**: bucle externo de pasadas; por rayo y pasada `rand(0xf)` pasos
  (0x1d33 `push 0xf; call 0x7b2e`; si 0, el rayo no avanza esa pasada). ⚠ Este
  rand consume el stream de juego una vez POR RAYO Y PASADA — la lectura previa
  del port («longitud del bolt = rand0(15)», combat.ts) es una SIMPLIFICACIÓN:
  en el binario 0x1d33 trocea la ANIMACIÓN, y la longitud real la deciden LOS y
  viewport. (Mecánica: ticket para el lead, NO tocada en este carril.)

### Por píxel (0x1bb0)
1. Clip viewport: `8 ≤ x,y ≤ 0xb6` (0x1bb3-0x1bcb); fuera → return 0 = fin de rayo.
2. `set_color(color)` (0x1bdd → residente 0x0A70 = SEL 0x2d) — el color llega del
   stub del hechizo: In Zu→`[g_unk_13b6]`, In Nox Hur→`[13b4]`, In Flam Hur→
   `[13ae]`, In Vas Grav Corp→`[13b2]` (crack de `bolt-owner-static-crack.md`),
   **+8** en 0x1c88 (`add [bp+8],8`) = variante brillante. Valores EGA: init de
   vídeo INTRO.OVL 0x09ee-0x0a06 (rama EGA/Tandy): `13ae=4 rojo, 13b0=0xF blanco,
   13b2=1 azul, 13b4=2 verde, 13b6=5 magenta` (13b2 = el azul del marco del juego,
   coherencia con frame.ts). ⇒ IVGC = 9 azul-claro ✓ testigo Part 24.
3. **Plot de (x,y) y (x+1,y)** (0x1be0-0x1bf1 → residente 0x0C64) — rayo de 2 px.
4. Crackle: `set_tone(rand(0x64,0x2710))` (0x1bf4-0x1c00 → rand 0x2092 +
   set_tone 0x22E2). ⚠ TAMBIÉN rand de juego por píxel pintado.
5. Sólo en filas de **y IMPAR** (0x1c03 `test [bp+6],1`): píxel→celda (0x8034 →
   kernel 0x3FB4, scratch 0x5876/0x5878) + LOS de hechizo (0x7fee → kernel
   0x3F6E, tabla 0x6a14) → opaco = return 0 (el muro recibe su último píxel).
   Celdas nuevas se registran para la mecánica (dedupe en mapa 0xab02-, marca
   0xff; cap 63, 0x1dff).
- Sonido de entrada (0x1fb0-0x1fbc → 0x223C noise_burst): `NB(step=0x320,
  dur=modo: 1→0x3e80 / 2→0x4b00 / 3,4→0x5140, band=0x2bc)` (0x1f91-0x1faa/0x2088).

### Testigo (aulddragon Part 24, 1:09-1:13, DOS confirmado)
Frames 30 fps: rayos AZUL-CLARO de 2 px acumulativos, cono ±45° desde el caster
hacia el norte, crecimiento irregular ~300-400 ms, persisten hasta el redraw del
turno. Careo del port: capturas careo-A2/A3 (scratchpad del carril) ✓.

### Port
- Evento `lineSpray` (combat.ts::castLineAoe, sin RNG) → main.ts traza con
  `traceSprayRays` (skin/fiel/combat.ts, curva verbatim duplicada con cita —
  la piel no puede importar valores del core) + `blocksSpellLine` sobre
  `combat.mapTiles`, y emite el fx + cue `line-spray`.
- Animación: crecimiento por pasadas rand(0..15) con LCG LOCAL de presentación
  (sellado por fx; el rng de combate NO se toca). Cadencias Clase-C caladas al
  testigo (`SPRAY_PASS_MS=16`, hold 150 ms).

## 2. Inversión de pantalla del Negate-time (CAST2 0x0000 + EGA.DRV fn21-XOR) — ✅ CALCO

### Cadena (byte a byte)
1. Scroll An Tym en el lector (CAST.OVL 0x1300): gate `g_location==0x1d|0x28` →
   "No effect!"; si aplica, tail común 0x125c: `push 'T'; push 20; push 7` →
   `call 0xffffc132` = **stub 0x80b2 → CAST2.OVL:0x08f8** (resuelto con
   dispatch_table.stubs()). In Sanct pasa (`'P',100,2`) en 0x124a e In An
   (`'N',20,3`) en 0x1264 — mismo tail, MISMO efecto visual.
2. CAST2 0x08f8: escribe `g_time_spell`/`g_time_spell_turns` y llama
   **CAST2:0x0000(idx)** + residente 0x2900 (refresh del panel).
3. CAST2 0x0000 (idx<9):
   - `noise_burst(0x320, 0x1f40+0x640·idx, 0x2bc)` (0x000b-0x001d → 0x223C).
   - `set_color([g_unk_13b0]=0xF blanco)` (0x0020 → 0x0A70 SEL 0x2d).
   - **`0x0b86(8,8,0xb7,0xb7)`** (0x0027-0x0031) — residente 0x0b86 =
     `STC; SEL 0x3f` (0x0b9b-0x0ba2). **EGA.DRV fn21 con CARRY programa el
     Graphics Controller en función XOR** (0x1181 `jae`; 0x118c `ah=0x18 →
     out 0x3ce reg 3`) ⇒ rect XOR blanco de **(8,8)-(183,183)** = inversión
     EGA c→c^15 del VIEWPORT (chrome y paneles fuera del rect).
   - DOS `tone_sweep` espejo (0x0045/0x006d → 0x2192): `inc=[0x4af6+2idx],
     delay=1, count=0x2710+0xfa0·idx, f0=[0x4b08]/[0x4b1a], step=±[0x4b2c]`
     (tablas verbatim en DATA.OVL fileoff DS+0x10: inc=[8810,7830,7060,6550,
     5950,5570,5180,4820,4480], f0↑=[2700,3000,1000,100,5000,4000,2500,1000,1],
     f0↓=[32700,31000,37000,45000,31000,34000,36500,39000,42000],
     step=[3,2,2,2,1,1,1,1,1]).
   - **El MISMO rect XOR otra vez** (0x0070-0x007a) — XOR involutivo ⇒ des-invierte.
   (idx≥9: 0x0080, un solo sweep sin inversión.)

### CORRIGE la nota del testigo
`endgame-witness-20260721.md` BONUS 2 suponía «mientras dura el time-stop». La
inversión dura SOLO la ventana de los dos sweeps del jingle (≈1.4 s In Sanct /
≈1.7 s In An / ≈2.9 s An Tym con U=0.93), una vez por (U)se. Verificado en el
propio testigo: barrido 1 fps de doom-n6-combate → ventanas brillantes de 3-4
frames repetidas (f042-45, f109-111, f142-145, …) = un (U)se de An Tym cada una,
con vuelta a colores normales entre medias con el time-stop AÚN activo.
Careo de color: suelo negro→blanco, murallas magenta-claro→verde, lava→cyan =
XOR 15 exacto. Chrome/paneles jamás invertidos ✓ (rect solo-viewport).

### El hechizo (Cast) NO pasa por aquí
An Tym-cast escribe `g_time_spell` directo (CAST.OVL 0x0da4-0x0dae, `'T'/10` +
refresh 0x2900) SIN llamar al setter 0x08f8 ni a CAST2:0x0000 — en la rama
estática no hay call al rect XOR. La inversión del CAST queda SIN AFIRMAR
(banco honesto; el testigo solo cubre el scroll). El port solo la emite en la
ruta del scroll.

### Port
- main.ts: tras `readScroll` con idx∈{2,3,7} aplicado → `emitSfx({id:"time-spell",
  n:idx})` (overworld y arena).
- speaker.ts: catálogo `time-spell` (NB + 2 sweeps, tablas verbatim) +
  `timeSpellFlashWindowMs(idx)` = {delay=NB, dur=2·sweep} (cero constantes
  libres nuevas).
- skin fiel: `TimeSpellFlash` (invert-flash.ts) → composite `difference` blanco
  sobre el viewport (misma aproximación documentada que la aparición del
  campamento; Clase-C: el par EGA 6 marrón ↔ 9 azul-claro no es complementario
  por canal). Divergencia consciente: el original BLOQUEA input durante el
  jingle (rutina síncrona); el port superpone sin pacear.

## 3. MECÁNICA de daño del line-AoE (CAST.OVL 0x1f60, bucle 0x1fed-0x215b) — ✅ CALCO
### (re-derivación 2026-07-22, carril fiel/line-spell-mech — TICKET (a) del punto 3 de Hallazgos)

RESUELVE el ticket del lead: la cobertura mecánica ES el abanico del §1, sin gate
radial alguno. FALSIFICA tres lecturas previas (todas citadas abajo con su ASM):
`witness-combat-radial.md` («bolt rand0(15) + gate rand30>=peso[dist]»),
`cast-line-area-spell-derivation.md` §Semánticas-2 («peso radial = probabilidad»)
y `combat-spells.md` §4-cabecera («0x1c36 traza Bresenham de longitud len»).
La tabla de MODOS de §4 (tiradas por modo) sí era correcta y se conserva.

### 3a. Firma real de 0x1f60 y quién registra las celdas

`0x1f60(color, mode, actor)` — `ret 6`; el dispatch 0x104e empuja color (la
global g_unk_13xx del stub del hechizo), mode 1..4 y `g_cmb_actor`. Dentro:
- `1f87 push actor ; call 0xffffc162` = **getdir** (prompt de dirección) →
  se pasa como `[bp+4]` a 0x1c36 (el switch 1..4 de 0x1c6a es la DIRECCIÓN:
  1=oeste, 2=este, 3=norte, 4=sur — ajustes de origen 0x1cde/0x1cda/0x1c84/0x1ce4).
- `1fbf-1fd2`: `call 0x1c36(count←dir, actor, color, &ybuf[bp-0x100], &xbuf[bp-0x80])`.
  0x1c36 es dibujante Y censo: devuelve en ax el Nº DE CELDAS registradas
  (`[bp-0x8e]`: init 1cf3, inc 1e46, ret 1f54) y llena xbuf/ybuf con las celdas.
  El registro PRE-incrementa los punteros (1e34-1e56) ⇒ ocupa los slots 1..count
  (el slot 0 queda libre), cap 63 (`1dde ax=[bp+0xa]+0x7e` → guarda 1dff).
- `1fd5-1fe8`: count==0 → salta directo a la limpieza 0x2148.

### 3b. El bucle de daño (0x1fed-0x2148) — POR CELDA REGISTRADA

Iterador `[bp-0x114]` = bp+2 … bp+2·count (1fed/1ff4-1ffc; avance 2136-2143):
exactamente las entradas 1..count de las listas. Por celda (y=`[bx-0x100]`,
x=`[bx-0x80]`, 2010-201f):
- Barrido de los 32 records de combate de MAYOR a menor (`200d si=0x1f`,
  `2023 [bp-0x112]=0xbb0c`, stride −8 en 2124-212a):
  - `2036/2044`: match de celda contra record `[+6]`=x / `[+7]`=y;
  - `2050 test [+5],0x80` → YA-GOLPEADO en este casteo ⇒ sigue buscando;
  - `2059 test [+2],0x20` y `2062 cmp [+2],0` → ido/vacío ⇒ sigue;
  - match ⇒ `206a or [+5],0x80` (marca ANTES del efecto ⇒ **máx 1 golpe por
    combatiente por casteo**, aunque resista) y switch de modo (206e-2083).
  **SIN filtro de bando**: alcanza aliados y enemigos por igual.
- Limpieza final `2148-215b`: `and byte[record+5],0x7f` para los 32 records.

### 3c. Modos (confirman combat-spells.md §4; RNG solo POR COMBATIENTE golpeado)

- **Modo 1 In Zu (0x2092)**: `push di(actor),si(target),0 ; call 0xffffc19e` =
  saving COMSUBS:0x0000 (1 rand30) → resiste salta; `20a2 call CAST:0x0000` =
  **inmunidad POR TIPO, sin RNG** (0x0006-0x002c: lee `[slot*8-0x45e9]` — defIndex
  del monstruo o índice de roster del PJ — y devuelve 1 si ∈ {0x0e Blackthorn,
  0x0f Lord British, 0x2f Shadow Lord}); luego 0x75e4 (nombre) + 0xffffa92e
  (dormir) + `20b4 0xffffbe32(si,di)` (XP-por-impacto, pendiente de oráculo
  igual que el terremoto §3).
- **Modo 2 In Nox Hur (0x20bc)**: `20c1 call 0xffffbf46(0xfffe, si)` = **lee el
  INT del OBJETIVO** (COMBAT:0x13e2 — el «peso[celda]» de witness-combat-radial
  era ESTE fetch mal leído); `20c8 call 0x7b3e` rand30; `20cb cmp/20cf jl` →
  rand30 < INT ⇒ salta; si no, 0xffffbf6a (ataque de veneno) + 0xbe32.
- **Modo 3 In Flam Hur (0x20dc)**: sin gate; daño `rand0(30)` (`20e9 push 0x1e ;
  call 0x7b2e`) → 0xffffbdae (aplica) + `0x7f94` cap 0x270f + 0xbe32.
- **Modo 4 In Vas Grav Corp (0x20fe)**: saving 0xc19e (1 rand30) → `210b call
  CAST:0x0000` inmunidad-tipo → daño FIJO 0x63=99 (`211f`) por la misma cadena.

### 3d. Y el rand0(15) de 0x1d33 ¿qué era?

El nº de PASOS del rayo en ESA pasada del dibujante: bucle de pasadas 1cff-1f4c
(hasta que los 21 rayos están `done`, `[bp-2]`), por rayo no-terminado
`1d33 push 0xf ; call 0x7b2e` → `[bp-4]` pasos (1f16-1f21). El camino de cada
rayo es determinista (acumulador de pendiente §1) ⇒ el troceo NO cambia la
forma final NI el conjunto de celdas — solo la ANIMACIÓN (y el ORDEN de registro
entre rayos, que sí depende del entrelazado). El rayo termina por clip del
viewport o LOS-opaca en fila impar (0x1bb0 1c03 `test [bp+6],1`; 1dfb je 1e68 =
corta SIN registrar la celda opaca). Corolario fiel: un casteo HORIZONTAL corre
su pasillo central por fila de píxel PAR (cy·16+8) ⇒ los rayos casi-rectos
(9/10/11) cruzan la columna ADYACENTE sin consultar la LOS y el muro pegado al
caster «gotea» (el de 2 celdas ya bloquea: la primera fila impar cae en su celda).
El rayo 10 (recto, 2000) de un casteo horizontal no registra NINGUNA celda
(nunca pisa fila impar).

### 3e. Port (rama fiel/line-spell-mech)

- `core/magic/areaSpell.ts::spraySpellCells` = calco del censo de celdas
  (geometría del §1 + registro fila-impar + corte LOS + dedupe + cap 63),
  determinista y sin RNG; orden canonicalizado rayo-a-rayo (delta documentado:
  el orden real del binario depende de los rands de animación no replicados).
- `combat.ts::castLineAoe` = cobertura por `spraySpellCells` + búsqueda de
  ocupante + flag ya-golpeado + modos (sustituye al bolt rand0(15) y su gate
  radial; el port YA NO consume el rand0(15) ni el rand30-por-celda).
  `applyLineCell` añade la inmunidad-por-tipo de los modos 1/4 (CAST:0x0000).
- `areaSpellTables.ts`: `AREA_RADIAL_WEIGHT` renombrada **SPRAY_SLOPE_CURVE**
  (es pendiente, no probabilidad); el esqueleto `traceSpellLine`/`radialHit`
  retirado (falsificado).
- Tests: `tests/spray-spell-cells.test.ts` (cobertura: pasillo, cono, goteo,
  protección a 2 celdas, dedupe, cap, caster excluido) +
  `tests/combat-spells.test.ts` re-baselineado (discriminantes ahora
  deterministas; el «0% a dist ≥6» era artefacto del gate falsificado).
- SELLOS: censo de e2e/grandtour = NINGÚN spec castea 28/40/44/45 (solo In Lor/
  Uus Por/Des Por) y `castLineAoe` es solo-jugador (la IA usa proyectiles) ⇒
  CERO capítulos afectados. Control negativo: ch20-salas-deceit corrido en main
  puro y en la rama ⇒ digest byte-idéntico
  (`4:VICTORY|5:DEADEND|6:DEADEND|7:VICTORY|8:DEADEND|10:VICTORY|12:VICTORY|14:VICTORY` + 8 SKIP).

## Hallazgos colaterales (para el lead)
1. **fn32/fn21 con CARRY**: la entrada de fn21 (0x1181 `jae`) y fn32 (0x1f98
   `jae`) discriminan por el carry del wrapper residente (0x0aa6 CLC normal /
   0x0b86 STC XOR; 0x1113 STC / 0x6fd6 CLC ya en la ADENDA endgame) — patrón
   general del driver.
2. **Paridad RNG del original en lineAoe**: el binario consume `rand(15)` por
   rayo-pasada (0x1d33) y `rand(100,10000)` POR PÍXEL pintado (0x1bf4, kernel
   0x2092) durante el spray. El port no modela ese consumo (su paridad es
   interna); si algún día se busca lock-step con el binario, esto es un delta
   GRANDE documentado.
3. ~~La lectura «rand0(15) = longitud del bolt» del port (combat.ts) es imprecisa
   respecto al binario (ver §1); la cobertura real del efecto es el ABANICO
   completo (hasta 63 celdas), no una línea de ≤15 celdas. Re-derivar la
   mecánica = carril aparte con impacto en sellos (decisión del lead).~~
   **RESUELTO 2026-07-22 — ver §3** (carril fiel/line-spell-mech): mecánica
   re-derivada y cableada; cero sellos afectados (censo + control negativo).
