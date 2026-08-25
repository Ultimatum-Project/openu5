# intro-demo-scene.md — Stage 2: la DEMO ATTRACT ES el scene-engine de FONT.OVL (kernel 0xfb1a [= CS 0x7cda → FONT.OVL:0x04a4 font_scene_init] resuelto)

Derivación read-only (carril `re/intro-demo`, Stage 2). Objetivo: IDENTIFICAR (no
implementar) qué reproduce el "demo autónomo" del arranque de Ultima V DOS. Hipótesis del
usuario: **es el MOTOR reproduciendo una escena guionizada** (mapa real + actores +
movimientos + sonido), no vídeo ni tiles precocinados.

**VEREDICTO: CONFIRMADA a nivel de código.** El `call 0xfffffb1a` que dispara el demo
resuelve a **`FONT.OVL:0x04a4 = font_scene_init`** — el inicializador/intérprete del
scene-engine (la MISMA función que `intro-summoning-scene-engine.md §1` llamó "intérprete
de SCRIPT"). Carga un mapa de escena, coloca actores y anima con cortina + moongate. Es
**el mismo motor que la task #20** (endgame tile-cinematics). Esto CORRIGE la conclusión
de `intro-summoning-scene-engine.md §5` ("INTRO NO invoca el scene-engine de FONT").

Citas `fileoff: instr` sobre `re/disasm/INTRO.OVL.asm`, `re/disasm/FONT.OVL.asm` y
`re/disasm/ULTIMA.EXE.asm` (imágenes completas, no los `.segments.md`).

---

## 0. Cómo resuelve `call 0xfffffb1a` — la tabla de thunks de overlay

`INTRO.OVL:0x100a call 0xfffffb1a` = `e80deb`, rel16 −0x14F3 (wrap negativo) ⇒ offset
**0xfb1a en el CS único de 64K** que comparten kernel + overlays (`ULTIMA.EXE.seg2.md`,
`command-dispatch.md §1`). Con la **base de carga de INTRO = 0x81C0** (documentada en
`intro-blit-formats.md`), `0xfb1a` cae en el **kernel residente 0x7cda**, dentro de una
**tabla de thunks de overlay PLINK86** (imagen ULTIMA.EXE 0x7cc2–0x7d08). Cada thunk = 12 B:

```
9a ec 02 2e 07    lcall 0x072e:0x02ec   ; el DISPATCHER de overlays (seg 0x072e = el más
                                         ;   referenciado por lcall/ljmp, segments.md)
<sel:word>                               ; selector/nivel de overlay
ea <off16> 00 00  ljmp 0:<off>           ; salto a la rutina ya paginada, off = CS-offset runtime
```

Los tres thunks que usa INTRO, resueltos con base 0x81C0 (todos caen EXACTO sobre el `9a`):

| INTRO call | rol (call-site) | stub kernel | `ljmp 0:off` | FONT.OVL fileoff | función (font.md) |
|---|---|---|---|---|---|
| `call 0xfffffb0e` | 'C' create (0xfa8) | 0x7cce | 0:0xecea | **0x0b0a** | gitana (creación) |
| `call 0xfffffb1a` | **'R'/timeout (0x100a) + fin de attract (0xcc1)** | 0x7cda | 0:0xe684 | **0x04a4** | **font_scene_init (scene-engine)** |
| `call 0xfffffb26` | helpers (0x17a/0x2af/0x32b) | 0x7ce6 | 0:0xe1e0 | **0x0000** | render_justified_text (texto) |

**La clave que cierra el mapeo:** FONT.OVL es el overlay #11, **load_seg 0x0e1e ⇒ base de
carga 0xe1e0** (`font.md:3`). El `ljmp` del thunk de `0xfb1a` apunta a `0:0xe684`, y
`0xe684 − 0xe1e0 = 0x04a4` = **exactamente `font_scene_init`** en el mapa de funciones de
FONT. Los tres targets (0xe1e0/0xe684/0xecea) caen limpios dentro de los 0xEA0 B de FONT
(offsets 0x0000/0x04a4/0x0b0a). (Nota de método: un cálculo previo con base 0x81CC
desplazaba un registro y mislabelaba los thunks; 0x81C0 es la base correcta y reproduce
las etiquetas ya conocidas gitana/texto de `intro-summoning-scene-engine.md §5`.)

---

## 1. Qué monta `font_scene_init` (FONT.OVL 0x04a4) — el mapa, el estado, los actores

Disasm de `re/disasm/FONT.OVL.asm` (fileoffs de FONT; `call 0xXXXX` = kernel vía
+0xe1e0 wrap, p.ej. `0x438e`→kernel `0x256e`):

```
04ac: mov [g_unk_52be],0x10           ; modo de escena ON
04b2: [0xbd27]=[0xbd26]=9 ; [0xbd28]=0 ; contadores de CORTINA de revelado (= scene_tick, §engine)
04bf–04ed: setup de 2 regiones (calls 0x2890/0x28c6/0x2930; coords 0x78=120,0xc7=199,0x7e/0x7f)
04f0: cmp [g_location],0x42 ; je 0x522   ; si 0x42 (endgame) salta la carga
04f7: push 0xa044 ; push 0xb21e ; push 0x7d0(2000) ; push 0x2c0(704)
       └ 04f7: call 0x438e  → kernel 0x256e = kernel_load_dat_record   ; CARGA el mapa → buffer 0xb21e
050a: cmp [g_location],0x40 ; jne 0x522   ; **== 0x40 = modo DEMO/attract**
0511: call 0xe52            ; save-under de pantalla (par con 0xe7b; ver §7 — el rótulo NO se pinta aquí)
0514: push [g_unk_25f0] ; call 0x2e14 ; or ax,ax ; je 0x514   ; BUCLE de playback: tick+poll hasta evento
0522: mov [g_location],0x42 ; [bp-0xc]=0x200 ; jmp 0x974   ; (rama endgame)
0530–0x974: parser de SCRIPT — lee del buffer 0xb21e ([bx-0x4de2] = [bx+0xb21e]) y escribe la
            TABLA DE ACTORES 0x5c5a (stride 8: tile en +0/+1, col/fila en +2/+3, +6=0)
```

Lecturas firmes:

1. **Es el scene-engine** (no una "return-to-view" del kernel): fija el modo de escena
   (`g_unk_52be=0x10`) y los contadores de **cortina** `0xbd26/27=9` que consume
   `scene_tick 0x02fc` para el revelado por columnas — idéntico a
   `intro-summoning-scene-engine.md §1` (donde 0x04a4 = "intérprete de SCRIPT").
2. **El MAPA de la escena** se carga con `kernel_load_dat_record` (kernel 0x256e, 21
   call-sites, `seg2.md`) al buffer **0xb21e** (el mismo del que `load_scene 0x0418` copia
   las filas al grid 0x6608 — `intro-summoning-scene-engine.md §1`). Tamaños 0x7d0=2000 /
   0x2c0=704. La fuente `0xa044` vive en el cluster DGROUP de los **4 títulos del endgame**
   ("The Summoning".."The Welcoming", DATA.OVL 0xa010–0xa044) e **inmediatamente después está
   la cadena literal `"MISCMAPS.DAT"`** (DATA.OVL 0xa054). ⇒ la escena del demo sale del
   MISMO cluster de datos que las escenas del endgame (task #20).
3. **El ESTADO se bifurca por `g_location`** (DS 0x5893): **`0x40` = modo DEMO** (carga +
   rótulo + bucle de playback, 0x50a–0x51d); **`0x42`** = rama endgame (parsea actores,
   0x522+). INTRO fija `g_location=0x40` en `INTRO:0ca3` antes de llamar a `0xfb1a`.
4. **Los ACTORES** se colocan parseando el buffer 0xb21e a la tabla `0x5c5a` (0x530–0x974):
   tile + (col,fila) por actor — el mecanismo de `scene_tick 0x02fc` que los blitea en el
   grid (`idx=fila·32+col`, celda `[0x6688+idx]`). El **moongate = tile 0xdc** lo coloca el
   script y lo anima `scene_tick` modo-3 (8 frames + chime), ver esa nota §1.

**Residuo Clase-C (hereda #20):** el RECORD exacto que carga (`kernel_load_dat_record`
arg `0xa044` + índice) y por tanto la geometría byte-exacta del cuarto. `intro-summoning-
scene-engine.md §6` determinó que MISCMAPS.DAT crudo (mapas de 11-ancho) NO es el cuarto
~19-ancho del witness — así que O bien el demo usa OTRO record/fuente vía ese arg, O el
buffer 0xb21e se rellena distinto para g_location=0x40. Fijarlo = crackear la semántica de
`kernel_load_dat_record(0x256e)` sobre ese arg. **Esto es task #20 puro.**

---

## 2. Las figuras / rutas BRITISH.PTH (el OTRO render: el attract de TÍTULO de INTRO)

Ojo: hay DOS animaciones. La §1 es el demo-escena (FONT). Aparte, INTRO.OVL tiene su
**propio** attract sobre el título (bucle 0xaa1) que camina figuras con `path_walk_anim`
(INTRO 0x50) leyendo `BRITISH.PTH`. El witness (`video-P`) muestra la figura en el cuarto
top-down (la del scene-engine), con el título estático; el port de #19 funde ambos
(persona 284 andando las rutas PTH dentro de la caja).

`original/u5/ultima5/BRITISH.PTH` = 2783 B, partido por sus **4** terminadores `0x00`:

| ruta | pasos (bytes) |
|---|---:|
| 0 | 856 |
| 1 | 548 |
| 2 | 411 |
| 3 | 964 |

### Codec de un byte (INTRO `path_walk_anim` 0x50) — 8 direcciones, no 4

- **dx** = `b&7` (`00af`); si `b&8` → `dx=-dx` (`00bf/00c7`); si `dx>2` → **pluma arriba**
  (no dibuja, `00ba: [bp-0xc]=0`).
- **dy** = `(b>>4)&7` (`00d0/00d4`); si `b&0x80` → `dy=-dy` (`00e3/00ea`); si `dy>2` → pluma
  arriba (`00de`).
- avance `00ee add[bp+6],dy` · `00f1 add[bp+4],dx` (**[bp+4]=x, [bp+6]=y**); `b==0` termina
  (`011e`).

⇒ cardinales `0x10`↓ `0x90`↑ `0x01`→ `0x09`← **+ diagonales** `0x11 0x19 0x91 0x99` +
**reposicionamiento invisible** con nibble>2 (p.ej. `0xf0`=subir 7 sin pintar). Histograma:
`0x10`×1055 `0x90`×621 `0x01`×513 `0x09`×426 `0x19`×45 `0x91`×39 `0x11`×19 `0x99`×16
`0xf0`×10. **Aviso al port:** `pth.ts` puede modelar sólo 4 cardinales — revisar diagonales
y pluma-arriba. Actor = tile `0x113`=275 RidingHorseLeft en el asm (`006d`); el port usa
persona 284 (reconciliación en `intro-attract-loop.md`). Cursor compartido `[0xbb18]` (4
rutas encadenadas); celdas de arranque (pushes 0c07–0c3b, orden y,x): (68,44)(94,64)
(78,143)(105,167).

---

## 3. Cadencia y SFX — quién avanza, cómo termina, qué suena

- **Avance del demo-escena:** el bucle `FONT:0x514` (`call 0x2e14` = tick+poll) corre hasta
  evento; `scene_tick 0x02fc` anima cortina + moongate frame a frame. **TERMINA por tecla**
  → vuelve a INTRO, que hace `INTRO:100d jmp 0xcd0` (redibuja el menú). El menú ocioso
  cuenta **200 ticks** (`INTRO:0d87 cmp si,0xc8`); al agotarse inyecta **'R'**
  (`0dec: [bp-0xe]=0x52`) → `0x100a` → `0xfb1a` = **relanza el demo**. ⇒ **CICLO menú⇄demo**;
  es lo que el usuario describe como "varias escenas donde se reproduce la introducción".
- **Paso de las figuras del attract = MUDO:** `path_walk_anim` hace por paso
  `00f7 call 0x9b9e` → kernel keypoll no bloqueante (`int 21h/AH=6`, ULTIMA.EXE 0x1d86);
  aborta el andar si hay tecla; no toca puertos de speaker.
- **SFX del demo-escena (derivados del motor, `video-P` es mudo −91 dB):**
  - **Trueno/crepitación** del moongate: `FONT:0x3ca` `noise_burst(20,60,10000)` gateado a
    `cmp byte[0xbd29],2` (scene-mode 2), `sfx-catalog §4.10`.
  - **Chime** del moongate: `scene_tick` modo-3 toca tono en frames 0 y 4 (`0x40e0`).
  - Música de intro ticando en el idle del menú (`INTRO:0d83 call 0x2090` intro_music_start).
  Validar contra la captura-con-audio que el lead pidió al usuario (no fabricar).

---

## 4. CONVERGENCIA con la task #20 (es el MISMO trabajo)

`0xfb1a` = `font_scene_init` = FONT `0x04a4` = **exactamente** el "intérprete de SCRIPT" que
`intro-summoning-scene-engine.md §1` documentó para el endgame. El demo del attract y el
endgame ("The Summoning/Journey/Arrival/Welcoming") **comparten**: la función 0x04a4, el
buffer de mapa 0xb21e, la tabla de actores 0x5c5a, la cortina 0xbd26/27, el moongate tile
0xdc (modo-3), y el cluster de datos DATA.OVL 0xa010+ (títulos + "MISCMAPS.DAT"). La ÚNICA
diferencia es el estado: **`g_location=0x40`** (demo, con bucle de playback y rótulo) vs
**`0x42`** (endgame). ⇒ **lo que #20 derive para el motor de escenas sirve tal cual para el
demo del attract, y viceversa.** Recomendación: tratar "demo attract" y "endgame
tile-cinematics" como un solo derivable de motor (0x04a4 + load_scene 0x0418 + scene_tick
0x02fc + kernel_load_dat_record 0x256e + formato de MISCMAPS.DAT/el record del demo).

---

## 5. Plan de Stage 3 (CÓMO reproducirlo — SIN implementar, requiere OK del lead)

1. **Ciclo de estados** (barato): `título → attract(INTRO) → demo-escena(FONT, g_location
   0x40) → menú → (200 ticks) → 'R' → demo → menú`. Tecla interrumpe.
2. **Attract A (INTRO):** 4 figuras `BRITISH.PTH` con el codec de §2 (8 dir + magnitud 0–2 +
   pluma-arriba — ampliar `pth.ts` si sólo hace cardinales). Sprite persona 284 (decisión #19).
3. **Demo-escena B (FONT):** reproducir el scene-engine: cargar el mapa de la escena, colocar
   actores desde el script, animar cortina + moongate (tile 0xdc, 8 frames). **Depende del
   residuo #20**: fijar el record exacto que carga `kernel_load_dat_record(0x256e, 0xa044…)`
   y el formato → mapa byte-exacto. Hasta entonces, el CALCO del witness (#19,
   `summoning-room.ts`) queda como fiel-al-visual, declarado.
4. **SFX:** paso mudo; trueno (noise_burst modo-2) + chime (modo-3) del moongate; música en
   el idle. Validar con captura-con-audio; no fabricar.

---

## 6. Verificación del extractor `british-path.json` (pedida por el lead)

Contraste del codec derivado vs `extractor/src/parsers/pth.ts` + `game/assets/british-path.json`:

- **Geometría: SIN divergencia.** `pth.ts:decodeStep` aplica EXACTAMENTE la misma fórmula
  que `path_walk_anim` (`Δx=b&7` neg si `b&8`; `Δy=(b>>4)&7` neg si `b&0x80`). Re-decodifiqué
  las 4 rutas y comparé con el json: longitudes idénticas (856/548/411/964) y **0 mismatches**
  de (dx,dy). Las **diagonales están presentes** en el json (p.ej. `{dx:1,dy:1}` para `0x11`),
  no colapsadas. Mi aviso previo ("pth.ts quizá sólo modela 4 cardinales") queda REFUTADO:
  el extractor es correcto en geometría; el attract NO dibuja rutas deformadas.
- **Única diferencia = la "pluma arriba" (no-dibujo).** El original **suprime el blit del
  sprite** en todo paso con magnitud de nibble >2 (`0x00b5/0x00d9: cmp ...,2; jle` → `[bp-0xc]=0`,
  gate del blit en `0x0093`); la posición SÍ avanza, pero la figura no se pinta ese frame (son
  saltos de reposicionamiento entre tramos visibles). `pth.ts` no lleva ese flag, así que un
  render ingenuo dibujaría el sprite durante esos saltos.
- **Impacto cuantificado: 35 de 2779 pasos** (route0=**0**, route1=7, route2=9, route3=19).
  Valores byte: `0xf0`×10 (Δ=0,−7), `0xff`×2 (−7,−7), `0x0f`×3 (−7,0), `0x07`×3 (7,0), y varios
  magnitud-3 (`0xb3`,`0xc4`,`0xd5`,`0x3c`,`0x6d`,`0x4e`…). Umbral estricto: magnitud ≥3.

**Veredicto:** NO es un bug de rutas deformadas (la ruta/posiciones son byte-exactas). El
único fleco de fidelidad es visual y menor: en el port las figuras **1–3** dibujarían el
sprite ~35 veces durante saltos que el original hace INVISIBLES (la figura principal, route0,
está limpia). Fix opcional Clase-C: añadir `draw:false` a `PathStep` cuando
`|dx|>2 || |dy|>2` y que el render omita el sprite en esos pasos. Prioridad baja.

---

## 7. CORRECCIÓN (carril flecos-piel 2026-07-22) — el RÓTULO lo pinta `load_scene`, no 0xe52

El comentario original del disasm de §1 etiquetaba `0511: call 0xe52` como
«blit_text_buffer = pinta el rótulo». **Falso.** `0xe52`/`0xe7b` (FONT) son un par
**save/restore de pantalla**: `0xe52` copia `0x1800` words desde el segmento `[0x5354]`
a un buffer alocado (`[0x520c]`, alloc vía `call 0x9b1e` la 1ª vez) y `0xe7b` (llamado a
la SALIDA del playback, FONT `0x051f`) lo restaura. Ningún texto.

**El print real del rótulo está en `load_scene` (FONT 0x0418)** y corre en CADA opcode
SCENE (handler 0x6e0 → `call 0x418`):

- FONT `0425: push [bx+0x515c]` (puntero al título de la escena, §2) + `0429: call
  0x9ae2` → con base FONT 0xe1e0: CS `(0xe1e0+0x9ae2)&0xFFFF =` **`0x7cc2` = STUB** del
  kernel (primero del rango 0x7cc2–0x7d08, `overlay-load-layout.md §3`;
  `dispatch_table.stubs()`: overlay INTRO.OVL, `entry_file_off` 0x43e).
- **INTRO.OVL `0x043e`** = el rotulador (la rutina ya etiquetada `draw_menu_titlebar` por
  el carril del attract; geometría calcada en `paintTitleBand`, faithful-intro.ts):
  - `0x216c` (strlen) → col izq = `0x12 − len/2` (centrado, col 18) [`044c-0456`];
    col der = `left + len + 2` [`045f-0465`].
  - Barra flanqueante: color `[0x13b2]`(=1 azul EGA, set en INTRO `09ee`) → driver-rect
    y=0xc1..0xc7 a ambos lados del texto [`0476-049a`]; color `[0x13b0]`(=0xf blanco,
    `09fa`) → línea 1px y=0xc0 [`04a4-04be`].
  - `0x1bf2` set-cursor `(left, 0x18)` (fila 24, clamp 0x27/0x18 confirma (col,fila)) +
    kernel `0x1850` print-string del título [`04c1-04d1`], entre los wrappers
    `0x4c2a`/`0x4cce`.
- Testigo: video-P f070 (rótulo blanco 8×8 centrado en la fila 24, barra azul con filo
  blanco superior a los lados). ✓ con el port: `renderDemoScene` →
  `paintTitleBand(tr(titles[scene]), fila 24)` (EN byte-exacto del cluster DATA.OVL
  §2; ES vía t(), keys de la lámina f3-demo-titulos) — **cableado desde 67f40e57**; el
  ⚠ «titles sin consumidor» de la lámina/TODO era STALE.

---

## Apéndice — reproducción
```bash
# base 0x81C0: los 3 thunks de INTRO caen en el 9a del stub y mapean a FONT.OVL (base 0xe1e0)
python3 - <<'PY'
d=open('original/u5/ultima5/ULTIMA.EXE','rb').read(); h=2048; FB=0x0e1e*16
for n,b0 in (('fb0e',0xfb0e),('fb1a',0xfb1a),('fb26',0xfb26)):
    r=(b0+0x81c0)&0xffff; x=d[r+h:r+h+12]
    print(n,hex(r),'9a=%s'%(x[:5]==b'\x9a\xec\x02\x2e\x07'),'ljmp0:%#06x'%(x[8]|x[9]<<8),'FONT %#06x'%((x[8]|x[9]<<8)-FB&0xffff))
PY
# fb0e->0x7cce FONT 0x0b0a(gitana) ; fb1a->0x7cda FONT 0x04a4(font_scene_init) ; fb26->0x7ce6 FONT 0x0000(text)

# font_scene_init: carga la escena + bifurca por g_location 0x40/0x42
sed -n '/^04a4:/,/^0522:/p' re/disasm/FONT.OVL.asm

# el cluster de datos: 4 títulos del endgame + "MISCMAPS.DAT"
python3 -c "d=open('original/u5/ultima5/DATA.OVL','rb').read(); print(d[0xa010:0xa062])"

# BRITISH.PTH: 4 rutas, y el codec en path_walk_anim
python3 -c "d=open('original/u5/ultima5/BRITISH.PTH','rb').read(); print(len(d), d.count(0))"   # 2783 4
sed -n '/^0050:/,/^014e:/p' re/disasm/INTRO.OVL.asm
```
