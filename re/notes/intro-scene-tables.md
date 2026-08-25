# intro-scene-tables.md — semántica derivada de las tablas de escena de `play_introduction` (Task #35)

Fecha 2026-07-15. Scout de solo-lectura. Deriva la SEMÁNTICA de las ~12 tablas
paralelas que el secuenciador de "The Summoning" (`play_introduction`, INTRO.OVL
`0x014E`) indexa por número de escena, para poder cablear el mapeo página→escena con
autoridad. Formato de cita `fileoff: instrucción → regla` sobre `re/disasm/INTRO.OVL.asm`;
valores reales leídos de `original/u5/ultima5/DATA.OVL` (`DGROUP = fileoff − 0x10`).
Complementa `intro.md §3` (que anunció las tablas pero no las descifró) y `font.md §Justif`
(el renderer de texto que consume los globals de layout).

**STATUS: derivado + roles de blit CONFIRMADOS.** Las 12 tablas descifradas por USO (a qué
argumento de blit/printer va cada una). Args de `0x8b8c` **resueltos leyendo el driver**
(EGA.DRV `0x12b4` vía `intro-blit-formats.md`): `0x30da`=Y, `0x30c4`=X, `0x3098`=sub-imagen,
param0=flags — corrige la inferencia invertida del insumo (§4). Reconciliación **a tres
bandas cerrada** (21 escenas ↔ 20 registros STORY.DAT ↔ 6 láminas STORY1-6.16): el `'{'` NO
es separador de página (es sangría; separador real = NUL) y `play_introduction` **sí** carga
las 6 STORY*.16 — no hay "segunda secuencia" (§2). Clase C restante: sólo píxel-diff
(recuadros de texto, args exactos de `0x8d86`, cadencias 🎥).

---

## 1. Layout de datos — 12 tablas paralelas, 21 escenas

El bucle recorre `[bp-8] = 0..0x14` (**21 escenas**; `0384: cmp word[bp-8],0x15; jge exit`).
Cada escena indexa tablas paralelas en DATA.OVL. **Dos familias de stride:**

- **9 byte-tables, stride 0x16 (22 slots, 21 usados + 1 de holgura)** — bases contiguas
  `0x3040,0x3056,0x306c,0x3082,0x3098,0x30ae,0x30c4,0x30da,0x30f0`. (El ledger
  `coverage.json:1543` ya las marcó como "7 bases stride 0x16" pero **mislabeladas como
  'creación de personaje'** — son las tablas de escena de la Summoning; ver §7.)
- **3 word-tables empaquetadas (stride 21)** — `0x2f98` (stride 2), `0x2fc2` (stride 4,
  dos words/escena), `0x3016` (stride 2).

| tabla (DS) | fo DATA.OVL | ancho | uso en asm | **semántica derivada** |
|---|---|---|---|---|
| `0x3098` | 0x30a8 | byte | `020d: push` como arg4 del blit | **subimagen** del cartón principal (índice dentro del STORYn.16) |
| `0x30c4` | 0x30d4 | byte | `0204→di`, param2 del blit | **X del cartón** (columna; confirmado en driver, §4) |
| `0x30da` | 0x30ea | byte | `01fc→si`, param1 del blit | **Y del cartón** (scanline; +0x37 en 2º sprite; §4) |
| `0x30f0` | 0x3100 | byte | `03d6/028c/034b/021d` cmp 1/3/2/≥4 | **TIPO de escena** (selector de compositor; ver §3) |
| `0x30ae` | 0x30be | byte | `038d` cmp cache; `03aa` índice de fichero | **índice de STORYn.16** (0→STORY1 … 5→STORY6) |
| `0x3040` | 0x3050 | byte | `026b → g_unk_5150` | banda de texto (top; consumida por el printer) |
| `0x3056` | 0x3066 | byte | `0274 → g_unk_5152` | banda de texto (bottom) |
| `0x306c` | 0x307c | byte | `027b → g_unk_5156` | pen X del texto |
| `0x3082` | 0x3092 | byte | `0285 → g_unk_5158` | pen Y del texto |
| `0x2f98` | 0x2fa8 | word | `0243/024c → g_unk_5146/5148` | margen IZQ del texto (lo=5146, hi=5148) |
| `0x2fc2` | 0x2fd2 | 2×word | `025a/0261 → g_unk_514c/514e` | margen DER del texto (dos words) |
| `0x3016` | 0x3026 | word | `031d: push` a `0xa3ae` (read-file) | **offset de byte en STORY.DAT** del registro de texto de la escena |

Nombres de los globals de layout tomados de `font.md §Justif` (los consume
`render_justified_text @ FONT 0x0000`, invocado vía el thunk `0xfb26`):
`5146=izq, 514c=der, 5150-5152=banda, 5156=penX, 5158=penY; ancho de línea = der−izq`.

### 1.1 Valores reales (21 escenas, leídos de DATA.OVL)

```
scene:            0   1   2   3   4   5   6   7   8   9  10  11  12  13  14  15  16  17  18  19  20
3098 subimg       0   1   0   1   2   2   2   0   1   0   1   0   1   0   1   2   6   4   2   6   4
30c4 coordA(X)    0   0 136   0 152   0  72   0   0   0   0   0   0 176   0 176   0 176   0 176   0
30da coordB(Y)    0  74   0  38  76   0  38   0  82  82  82  82  82   0   0   0  46  78   0  55  87
30f0 TYPE         1   2   0   0   0   0   3   1   0   0   0   0   0   0   1   4   5   6   5   6   4
30ae storyfile    0   0   1   1   1   1   1   2   2   3   3   4   4   5   5   5   5   5   5   5   5
3040 ->5150(top)180  70 131  32  70 133 200 168 200 200 200 200 200 114 114  96  33  70  96  51  79
3056 ->5152(bot)200 200 200 160 200 200 200 200 200 200 200 200 200 200 200 200 137 200 200 146 200
306c ->5156(penX)180 0   0   0   0 176  32 188   0   0   0   0   0   0 184   0   0   0 174   0   0
3082 ->5158(penY)128 0  40   0   9   0   9 136   0   0   0   0   0   0  32   0   0   0   0   9   0
2f98 izq (lo)   180   0   0   0   0 176   0 188   0   0   0   0   0   0 184   0   0   0 148   0   0
2f98 izq (hi)     0 172   0 210   0   0   0   0   0   0   0   0   0   0   0   0 148   0   0   0 156
2fc2 der A      320 320 132 320 320 320 320 320 320 320 320 320 320 170 320 170 320 320 320 320 320
2fc4 der B      320 320 320 320 148 320 320 320 320 320 320 320 320 320 320 320 320 170 320 170 320
3016 STORY.DAT    0 273 971 1424 2051 2756  0 3437 3619 4022 4467 4906 5310 5678 6443 7066 7803 8562 9291 10112 10903
```

`3016[6]=0` = **no usado** (la escena 6 es TYPE 3, no lee STORY.DAT; ver §3).
Repro: `python3` inline sobre `DATA.OVL` con `DGROUP=fo−0x10` (apéndice).

---

## 2. Mapa STORYn.16 (tabla `0x30ae`)

`0x30ae[scene]` = índice en la tabla de nombres `word[DS 0x260e + 2*idx]`
(`0x260e`=STORY1.16, +2 → STORY2…STORY6). El bucle **cachea** el fichero cargado en
`[bp-6]` y sólo recarga al cambiar de índice (`038d: cmp; je skip; 0398: free; 03b2: load`):

| STORYn.16 | idx | escenas | subimgs usadas (`0x3098`) |
|---|---|---|---|
| STORY1.16 | 0 | 0,1 | 0,1 |
| STORY2.16 | 1 | 2,3,4,5,6 | 0,1,2 |
| STORY3.16 | 2 | 7,8 | 0,1 |
| STORY4.16 | 3 | 9,10 | 0,1 |
| STORY5.16 | 4 | 11,12 | 0,1 |
| STORY6.16 | 5 | 13–20 | 0,1,2,4,6 (+ los sprites bajos 3/5/7, §3) |

Cada `STORYn.16` es un atlas de sub-imágenes; la escena elige cuál con `0x3098` (cartón
principal) y, en las escenas de dos cels, un segundo sprite derivado del TIPO (§3).

> **`play_introduction` CARGA LAS 6, no sólo STORY1.16.** El insumo del implementer afirmó
> que "play_introduction SOLO carga STORY1.16 (3 sub-imágenes) → los beats ricos (Codex,
> Ankh, moongate, Shadowlords, Iolo) vienen de OTRA secuencia que carga STORY2-6.16". **Es
> incorrecto.** La carga inicial `01b2: push [0x260e](STORY1.16); call 0x89ee` es sólo la
> primera; el **bucle de escena recarga** por `0x30ae`: `03a1: al=[bx+0x30ae]; 03ae:
> add di,0x260e; 03b4: push [di]; call 0x89ee`. Con `0x30ae` = [0,0,1,1,1,1,1,2,2,3,3,4,4,
> 5,5,5,5,5,5,5,5], eso carga STORY2/3/4/5/**6**.16 en escenas 2–20. Los beats ricos SON
> `play_introduction`: el texto lo confirma — esc.13 "Shamino lies…dark arrow", esc.15
> "Iolo standing framed", esc.19 "Blackthorn…took over the ruling of Britannia". **NO hay
> una segunda secuencia.** Verificado: los únicos sitios que tocan `0x260e`/el cargador de
> STORY en INTRO.OVL son `0x01b2` y `0x03ae` (ambos DENTRO de `play_introduction`); los
> otros `0x89ee` cargan ULTIMA.16 (logo) y STARTSC.16 (acknowledgements), no STORY.

---

## 3. `0x30f0` = TIPO de escena (el selector de compositor) — derivado por USO

Toda escena pasa por el pre-frame `03c0: g_unk_a9be=2; 8a62(1); 94fa(0xff)` (limpia) y
luego `03d6: cmp byte[bx+0x30f0],1`. El TIPO gobierna qué se compone:

- **TYPE 0 — cartón simple** (esc. 2,3,4,8,9,10,11,12,13): sólo el blit principal
  `01f9: blit(0, 30da, 30c4, 3098, STORY)` + registro de layout + texto.
- **TYPE 1 — con marcos TEXT.16 previos** (esc. 0,7,14): `03e0` despacha por número de
  escena a una rutina que **blitea primero 2 sub-imágenes de TEXT.16** (`[bp-2]`, el atlas
  constante cargado de `0x260c`) y luego cae al cartón principal:
  - esc.0 → `0x1d0`: TEXT.16 subimg0 @(A=224,B=30) + subimg1 @(A=168,B=58).
  - esc.7 → `0x2c4`: TEXT.16 subimg0 @(A=232,B=26) + subimg2 @(A=200,B=54).
  - esc.14 → `0x2ea`: TEXT.16 subimg0 @(A=184,B=0) + subimg3 @(A=248,B=0).
  (TEXT.16 = piezas fijas de marco/recuadro superpuestas sólo en estas tres escenas.)
- **TYPE 2 — cartón + revelado posterior** (esc. 1): tras el texto y la tecla,
  `034b: cmp ..,2; 0359: blit(0, 86, 40, subimg2, STORY)` + `037e: 8d86(0x78,0x4b,0x56,0x28)`
  (op de región/animación; opcode exacto = Clase C).
- **TYPE 3 — transición "puerta azul"** (esc. 6): `028c: cmp ..,3; 0293:` blitea STORY
  subimg3 @(A=96,B=39) y **NO lee STORY.DAT**; en su lugar imprime dos strings fijos de
  DATA.OVL: `0x2f31="Instantly, a shimmering blue door springs up!"` y
  `0x2f5f="With heart beating rapidly, you step into it."` (`02a8/02bc → 0xfb26`). Por eso
  `3016[6]=0`.
- **TYPE 4/5/6 — figura de dos cels** (esc. 15–20): en `021d: cmp byte[bx+0x30f0],4; jb`,
  si TYPE≥4 se añade un **segundo sprite bajo el primero**:
  `0224: blit(0, 30da+0x37, 30c4, subimg=2*TYPE−5, STORY)` (55 px por debajo en la coord B).
  El subíndice del sprite bajo = `2*TYPE−5`: TYPE4→3, TYPE5→5, TYPE6→7. Emparejamientos:

  | esc | TYPE | subimg alto (`3098`) | subimg bajo (`2*TYPE−5`) |
  |---|---|---|---|
  | 15 | 4 | 2 | 3 |
  | 16 | 5 | 6 | 5 |
  | 17 | 6 | 4 | 7 |
  | 18 | 5 | 2 | 5 |
  | 19 | 6 | 6 | 7 |
  | 20 | 4 | 4 | 3 |

---

## 4. Semántica de los args de `0x8b8c` (el blit) — RESUELTA (driver EGA.DRV, no inferida)

`0x8b8c` resuelve (base INTRO `0x81C0`, ver `intro-blit-formats.md §1/§4`) a
`gfx_cmd_sel4b` (kernel `0x0d4c`, SEL 0x4b) → **EGA.DRV `0x12b4`**. Leído ese handler, los
roles quedan **citados, no inferidos**. Convención cdecl (param0 = último push). El blit
de escena principal (`0x0217`) tiene forma:

```
0x8b8c(param0=0, param1=[bx+0x30da], param2=[bx+0x30c4], param3=[bx+0x3098], param4=buffer)
```

| param | valor | rol DERIVADO del driver | cita EGA.DRV |
|---|---|---|---|
| param3 | `0x3098` | **índice de sub-imagen** (con bounds-check) | `12bf: cmp es:[si],bx; jg/retf` → `bx`=índice vs word0=count; `12de: si=2+4*bx` indexa la tabla de offsets u32 |
| param1 | `0x30da` | **Y** (scanline) | `12f3: bx=di`; `[0x226]=di`, `[0x22a]=di+height`; `13cc-13e1: di=cs:[Y*2+0x72]` = tabla de base por scanline |
| param2 | `0x30c4` | **X** (columna) | entrada `12bb: ax=si`; `13e6: shr ax,3; 13ea: add di,ax` = base_scanline + X/8 (byte-columna) |
| param0 | `0` (const) | **flags** (bit0=dirección/espejo, bit1=modo) | `12b4: cs:[0x12b2]=cx`; `12d3: test cx,1`; siempre 0 ⇒ sin espejo |
| param4 | buffer | segmento del atlas (`[bp-4]`=STORYn.16 / `[bp-2]`=TEXT.16) | `12b9: es=ax` |

**⇒ `0x30da`=Y, `0x30c4`=X, `0x3098`=sub-imagen, `param0`=flags(=0).** El driver mete Y
en la tabla de scanlines y le SUMA la altura (span vertical), y divide X entre 8 para la
byte-columna — inequívoco. Concuerda con el rango de los frames decorativos TEXT.16, donde
el arg en la posición de `0x30c4` llega a 248 (`0xf8`, escena 14) — imposible como Y en una
pantalla de 200 de alto, obligado a ser X.

> **Corrige la "inferencia natural" del insumo del implementer** (`0x30da`=X, `0x30c4`=Y):
> están **INVERTIDOS**. El driver prueba lo contrario (Y indexa scanlines y recibe +height;
> X se divide entre 8). El 2º sprite (type≥4) suma `+0x37` a `0x30da` = **+55 px en Y** =
> apilado vertical cabeza/torso+piernas (coherente con Y, no con X).

`intro-blit-formats.md §3.1b` describía los args como "x,y,tile/w,h" (orden x-primero); la
lectura del handler los fija como (flags, **Y**, **X**, subimg, buf). Ya NO es Clase C.

### Tail compartido `0x1f2`
`0x1f2` = `push ax; push 0; call 8b8c` (los dos últimos args). Varios blits saltan ahí tras
fijar `ax` = param1(Y) (p.ej. `02e6: jmp 0x1f2`, `0308: jmp 0x1f2`). No es una tabla — es
factorización de código.

---

## 5. Texto de escena: cómo avanza (`0x3016` + STORY.DAT) — RECONCILIACIÓN 21 vs 36

En el camino común (`0x30c`, todos los TIPOs salvo 3):
```
030c: push 0x2f8d(="STORY.DAT")  ; nombre de fichero
030f: push 0xb21e                ; buffer destino
0314: push 0x7d0 (=2000)         ; nº de bytes a leer
0318: push word[bx*2 + 0x3016]   ; OFFSET de la escena en STORY.DAT
0321: call 0xa3ae                ; = kernel_load_dat_record (0x256e; carga+LZW), intro-blit-formats.md §1
0324: push [bp-0xa](PROPORT.PCS); push 0xb21e; call 0xfb26  ; imprime proporcional
032e: cmp [bp-8],0; je skip-wait ; escena 0 no espera
0334: 9956 (reset tecla); 0337: 9b9e (poll) ; espera keypress
033e: 8dae(0,1)                  ; transición de pantalla al pulsar
```

**`0x3016[scene]` = offset de byte dentro de STORY.DAT**, no un índice de página. El printer
lee desde ese offset y renderiza hasta **NUL** (word-wrap justificado, `font.md §Justif`).

**Estructura real de STORY.DAT (11 679 B):**
- **21 bytes NUL** = terminadores de registro (20 registros de texto + relleno final).
- **20 registros terminados en NUL**, uno por escena de texto (las 21 escenas menos la
  escena 6, que es TYPE 3 y usa strings fijos). Cada `0x3016[scene]` apunta al inicio de su
  registro; el byte anterior (`d[off−1]`) es NUL en las 20 → confirma la partición.
- **36 bytes `'{'`** = control de **sangría de párrafo** (`'{'` → +0xF de indent en
  `render_justified_text`), NO separadores de página. Se reparten ~1.8 por registro
  (1–3 por escena). El `'_'` (0x5f) visible en el texto ("be_gin", "moon_lit") = **guión
  discrecional** (break suave, ancho 0) del mismo codec.

**→ La reconciliación (a TRES bandas):** los tres "streams" son índices INDEPENDIENTES,
todos cableados por número de escena vía tablas paralelas:
- **21 escenas** = el bucle `0..0x14`.
- **Texto (STORY.DAT):** **20 registros NUL-terminados** (uno por escena de texto) + **2
  strings fijos en DATA.OVL** para la escena-puerta (6, TYPE 3). Los "**36**" del brief
  contaban los `'{'`, que son **sangrías de párrafo** (no páginas): ~1.8 por registro. NO
  existen 36 páginas. Cada registro = una pantalla que avanza con tecla (salvo la escena 0).
- **Láminas (STORY1-6.16):** 6 atlas LZW; la escena elige atlas (`0x30ae`) + sub-imagen
  (`0x3098`) + (type≥4) 2º sprite. STORY1.16 (3 sub-imgs) sirve esc.0-1; STORY2 esc.2-6; …;
  STORY6 esc.13-20. Ningún "36" es cuenta de escenas ni de láminas.

Es decir: **21 escenas ↔ 20 registros STORY.DAT (+1 door) ↔ 6 láminas STORY1-6.16**. El
desajuste "21 vs 36" se disuelve: 36 = sangrías, no páginas.

Muestras de inicio de registro (tras el NUL previo, con su `'{'` de sangría):
```
sc0  off    0  "{From no_where, smoky wisps of clouds be_gin to form ..."
sc3  off 1424  "{Jump_ing from the bed, you hast_i_ly pull on some clothes ..."
sc9  off 4022  "{\"My friend!\" shouts some_one from be_hind you ..."
sc13 off 5678  "{Shamino lies up_on the ground, body twisted in ag_o_ny ..."
sc15 off 7066  "{The door jerks o_pen to re_veal the fa_mil_iar form of Iolo ..."
sc19 off10112  "{\"Blackthorn, a trust_ed but am_bi_tious sub_ject, took ov_er ..."
```

---

## 6. Pseudocódigo del compositor (`play_introduction`, orden real)

```c
g_location = 0x40;
font   = load(PROPORT.PCS);              // [bp-0xa]  0165
print(font, DS:0x2f30);                  // 0175  (string vacío / setup del printer)
clear_screen(); fade();                  // 8a62/94fa/9a32
text16  = load(TEXT.16);                 // [bp-2]   01a2
story   = load(STORY1.16);               // [bp-4]   01b2
cur_file = 0;                            // [bp-6]
for (scene = 0; scene < 21; scene++) {   // 0384
    file = t_storyfile[scene];           // 0x30ae
    if (file != cur_file) {              // recarga cacheada
        free(story); story = load(name[0x260e + 2*file]); cur_file = file;
    }
    g_unk_a9be = 2; clear_screen();      // 03c0
    type = t_type[scene];                // 0x30f0
    // --- compositor por TIPO ---
    if (type == 1) switch(scene) {       // marcos TEXT.16 previos
        case 0:  blit(text16, sub0,224,30); blit(text16, sub1,168,58); break;
        case 7:  blit(text16, sub0,232,26); blit(text16, sub2,200,54); break;
        case 14: blit(text16, sub0,184, 0); blit(text16, sub3,248, 0); break;
    }
    // cartón principal (todos los tipos salvo el early-return de 3, ver abajo)
    blit(story, t_subimg[scene], X=t_30c4[scene], Y=t_30da[scene]);   // 01f9
    if (type >= 4)                                                     // 2º sprite bajo
        blit(story, sub=2*type-5, X=t_30c4[scene], Y=t_30da[scene]+55);
    // registros de layout de texto -> globals 5146/48/4c/4e/50/52/56/58
    load_text_window(scene);                                          // 023e..0289
    if (type == 3) {                     // escena-puerta 6: strings fijos, sin STORY.DAT
        blit(story, sub3, 96, 39);
        print(font, DS:0x2f31); print(font, DS:0x2f5f);
        goto next;                       // (no lee STORY.DAT)
    }
    read_file(STORY.DAT, buf=0xb21e, 2000, off=t_textoff[scene]);      // 030c 0x3016
    print(font, buf);                                                  // 0321
    if (scene != 0) wait_key();                                        // 032e
    screen_transition(0,1);                                            // 033e 8dae
    if (type == 2) {                     // revelado posterior (esc.1)
        blit(story, sub2, 40, 86); region_op(0x78,0x4b,0x56,0x28);     // 034b 8d86
    }
    next:;
}
free(story); free(text16); free(font); restore(); // 03fc..0434
```
(Coordenadas `(X,Y)` = (`0x30c4`,`0x30da`), confirmadas contra el driver en §4.)

---

## 7. Correcciones al corpus

1. **`coverage.json:1543`** rotula las 7+ byte-tables (`0x3056..0x30da`, stride 0x16) como
   **"creación de personaje"**. Son las **tablas de escena de The Summoning** (`play_introduction`
   0x14e). Sugerido: renombrar a "tablas de escena de la intro (Summoning); 9 byte-tables
   stride 0x16 en [0x3040..0x30f0] + words 0x2f98/0x2fc2/0x3016". (No lo edito: es del ledger.)
2. **`intro.md §3`** listaba `0x30ae` entre las "posiciones/tiles/flags" sin rol y omitía
   `0x3040` de las byte-tables (listaba 9 pero con `0x30ae` en vez de `0x3040`+`0x30f0`
   ambos). Rol real: `0x30ae`=índice STORYn.16; `0x30f0`=TIPO; `0x3040/56/6c/82`=ventana de
   texto. `0x3016` NO es "arg de texto" genérico sino **offset de byte en STORY.DAT**.

---

## 8. Clase C (lo que aún no cierra la lectura estática)

- **X↔Y de `0x8b8c`: RESUELTO** (§4, driver EGA.DRV 0x12b4). Ya no es Clase C.
- `0x8d86` = `gfx_blit_sel66` (SEL 0x66, blit de imagen grande; kernel 0x0f46 →
  EGA.DRV), `intro-blit-formats.md §1`. Su uso en TYPE 2 (`037e: 8d86(0x78,0x4b,0x56,0x28)`)
  es un blit de región; el mapeo exacto de esos 4 args a un rectángulo de pantalla lo
  confirma el píxel-diff (task #26).
- Distinción izq(5146) vs der(514c) y top(5150)/bottom(5152)/penX(5156)/penY(5158) del
  printer: nombres de `font.md §Justif`; los valores por escena están en §1.1, pero cuál
  produce qué recuadro exacto en pantalla lo confirma el píxel-diff.
- Cadencias/fundidos (`9a32`; `8dae`=`gfx_cmd_sel1b` SEL 0x1b; esperas de tecla) = ciclos
  DOSBox → 🎥 catálogo AV (task #4).

---

## Apéndice — verificación
```python
d=open('original/u5/ultima5/DATA.OVL','rb').read()          # DGROUP = fo-0x10
b=lambda ds,i,st=1,k=0: (lambda p:d[p]|(d[p+1]<<8) if k=='w' else d[p])(ds+0x10+i*st)
assert d[0x30f0+0x10:0x30f0+0x10+21] == bytes([1,2,0,0,0,0,3,1,0,0,0,0,0,0,1,4,5,6,5,6,4]) # TYPE
s=open('original/u5/ultima5/STORY.DAT','rb').read()
assert s.count(0x7b)==36 and s.count(0)==21                 # 36 '{' (sangría), 21 NUL
assert s[0:5]==b'{From'                                     # registro escena 0
open('original/u5/ultima5/DATA.OVL','rb').read()[0x2f31+0x10:0x2f31+0x10+45] # blue door str
```
