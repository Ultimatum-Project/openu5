# El control de #138, adjudicado en ESTÁTICO — 0xb19e son las entradas 0x80-0x83 de la tabla-remap de animación (DS:0xB11E) y las celdas 0x3a-0x3f del compositor son el CASTILLO DE BRITANNIA (carril fix-138, 2026-08-20)

**La pregunta de la ficha #138** (nacida en la degradación de `field-duration-witness.md`,
2026-08-09): el testigo del 07-18 diffeó alrededor de LANZAR In Flam Grav (que consume
turno) sin control de solo-Pass, y concluyó que el registro `DS:0xb19e-0xb1a1` y las
celdas `0x3a-0x3f` del buffer de display `0xab02` eran EL CAMPO. El control que decidía —
un turno de Pass SIN lanzar — nunca se corrió. Criterio escrito en el propio testigo:
*«Si el registro y las celdas del compositor aparecen idénticos, la atribución al campo
muere y la §c pasa a ser el hallazgo bueno de esta nota»*.

**Adjudicación: la atribución al campo MUERE — por un canal más fuerte que el control.**
Los dos sujetos del diff quedan derivados del binario instrucción a instrucción, y ninguno
tiene nada que ver con el hechizo: ambos aparecen idénticos con y sin cast **por
construcción**. El testigo del 08-08 (`field-grav-gate-testigo-20260808.md`: el gate
0x0e8e rechaza In\*Grav fuera de mazmorra/combate) queda SIN revisar que hacer — el
residuo que lo desafiaba («figura 3×2 direccional») se disuelve abajo.

El oráculo dosbox-x de este host NO bootea (medido 19-08, `xit-pila-273.md` §6: cuatro
mecanismos, teclas consumidas, roster nunca en RAM), así que el control VIVO queda además
como sonda lista-para-correr (`re/tools/probe_field_pass_control.py`, §4) — hoy es
cinturón-y-tirantes, no el árbitro: el estático decide solo.

---

## 1. Sujeto A — `0xb19e-0xb1a1` es la tabla-remap de animación de tiles, entradas 0x80-0x83

La tabla `tile_anim_remap[256]` vive en **DS:0xB11E** (los accesos van con desplazamiento
negativo `-0x4ee2`; `(-0x4ee2) & 0xFFFF = 0xB11E` — por eso el barrido del 08-09 encontró
CERO referencias absolutas a `0xb19e`: la entrada se direcciona por índice de tile, no por
dirección absoluta). Tres eslabones, los tres leídos en crudo:

**(a) Inicialización a IDENTIDAD — INTRO.OVL `0x0993-0x09a0`:**
```asm
0993: 2bf6              sub si, si
0995: 8bc6              mov ax, si
0997: 88841eb1          mov byte ptr [si - 0x4ee2], al   ; [0xB11E+i] = i
099b: 46                inc si
099c: 81fe0001          cmp si, 0x100
09a0: 7cf3              jl 0x995                          ; i = 0..0xFF
```
⇒ `[0xb19e..0xb1a1] = [0x80 0x81 0x82 0x83]` **desde el arranque**, antes de ningún
hechizo. La frase del testigo «el cast escribe [0x80,0x81,0x82,0x83]» queda refutada en la
fuente: esos bytes son el contenido-identidad de la tabla (0xb19e = 0xB11E + 0x80).

**(b) Único escritor post-init — el reloj maestro de terreno, ULTIMA.EXE `0x44b8-0x4550`**
(ya catalogado como «reloj MAESTRO de terreno (remap DS:0x4EE2)» en `antim-freeze.md`;
aquí se lee el CUERPO entero y sus grupos):
```asm
44bf: bed400            mov si, 0xd4          ; grupo 0xd4-0xd7 (Waterfall1-4): inc cíclico, CADA tick
44c2: fe841eb1          inc byte ptr [si - 0x4ee2]
44c6: 80bc1eb1d8        cmp ... 0xd8 / reset a 0xd4
44dc: bed800            mov si, 0xd8          ; grupo 0xd8-0xdb (Fountain1-4): ídem, CADA tick
44f9: f6067e6a01        test byte ptr [0x6a7e], 1   ; fase global: bit0 ⇒ cadencia 1/2
44fe: 7448              je 0x4548
4500: be8000            mov si, 0x80          ; ★ grupo 0x80-0x83: XOR 1 — el toggle
4503: 80b41eb101        xor byte ptr [si - 0x4ee2], 1   ;   80↔81, 82↔83 (parejas 2-frame)
4509: 81fe8400          cmp si, 0x84 / loop
4512: beec00            mov si, 0xec          ; grupo 0xec-0xef (SnakeSign1-4): inc, cadencia 1/2
452f: f6067e6a02        test byte ptr [0x6a7e], 2   ; bit1 ⇒ cadencia 1/4
4536: befa00            mov si, 0xfa          ; grupo 0xfa-0xfd (Clock1-2, Bellows1-2): xor 1
4548: fe067e6a          inc byte ptr [0x6a7e] ; avanza la fase global
```
**Ni una sola condición sobre hechizos en el cuerpo.** El `xor …,1` sobre `si=0x80..0x83`
es EXACTAMENTE la firma que el §c del testigo midió en `0xb19e`: alternancia de los dos
pares. Call-site ÚNICO: `0x46f7` (cola del intérprete de animación `0x4552`), llamado
desde `viewport_redraw 0x5910` a `0x5941` — corre con el redibujo del turno, haya cast o
no. (Único gate conocido: el latch de An Tym `0x5933`, `antim-freeze.md` — congela TODO el
reloj, no distingue hechizo de campo.)

**(c) Consumidor — FONT.OVL `0x02c2` (blit):**
```asm
02b3: 8a800866          mov al, byte ptr [bx + si + 0x6608]  ; tile crudo de la ventana de mapa
02c2: 8a871eb1          mov al, byte ptr [bx - 0x4ee2]       ; remap: tile → frame actual
```
CADA tile dibujado pasa por la tabla; las entradas de tiles no animados son identidad.
Esto explica la observación del testigo de que el registro «retuvo sus 4 entradas incluso
con el campo fuera de pantalla»: la tabla es GLOBAL y el reloj corre siempre.

Corroboración de layout: `ULTIMA.EXE 0x00a1` inicializa el puntero `[0xb11c] = 0xb21e` —
la tabla ocupa exactamente el hueco `0xB11E..0xB21D` (256 bytes) entre esa variable y el
buffer al que apunta.

**Cadencia — cabo declarado, no portante:** el testigo midió 1 toggle por TURNO; la
estructura del reloj da 1 toggle cada 2 invocaciones de `0x44b8` (bit0 de `0x6a7e`).
Compatibles si el redibujo corre 2× por turno de Pass; no lo he contado y NO afecta a la
adjudicación (cualquier cadencia de un reloj global es independiente del cast).

## 2. Sujeto B — las celdas `0x3a-0x3f` del compositor son el Castillo de Britannia

Tiles `0x3a-0x3f` en TileData: `CastleBritian1/2/3/4/Entrace/5` (0x3e = la ENTRADA).
El mapa crudo del sobremundo — BRIT.DAT decodificado con el índice de chunks de
`DATA.OVL:0x3886` (ventana de 256 bytes hallada por barrido exhaustivo: única en todo el
fichero cuyos valores usan cada uno de los 205 chunks de BRIT.DAT exactamente una vez,
con 0xFF = chunk de agua; chunk deduplicado = `52480/256 = 205`) — dice en la zona del
testigo (party en (86,107)):

```
        x=85 86 87
y=106:     3a 3b 3c      ← «fila frontal» del shape medido
y=107:     3d 3e 3f      ← fila del party — 0x3e (la ENTRADA) en (86,107) EXACTO
```

Careo byte a byte contra el testigo:
- El shape estable que midió (tercer boot, con settle): `3a 3b 3c` + `3d _ 3f` **con el
  avatar en el centro** — el hueco `_` es la celda (86,107), que el mapa dice que es
  `0x3e`, la entrada del castillo, TAPADA por el sprite del avatar plantado en ella.
- «El campo se siembra al NORTE del party (86,107) ⇒ ~(85-87,105-106)» — la huella del
  castillo es (85-87,106-107): la fila frontal (y=106) está al norte del party.
- La «persistencia ≥30 turnos», el «no-decay» y el leave/return: es TERRENO del mapa.
  No decae porque los castillos no decaen.
- La «figura 3×2 direccional» que la reconstrucción del 08-09 no explicaba (*«Hierba
  animada no produce una figura direccional»* — cierto): no es hierba ni campo, es la
  geometría fija del castillo, y apuntar al norte fue apuntar AL castillo.

⇒ El save del testigo estaba con el avatar EN LA PUERTA del Castillo de Britannia (la
posición canónica al salir del castillo). Las 6 celdas «de campo» del buffer de display
son los 6 bytes del castillo, presentes en el mapa con o sin hechizo.

## 3. Qué queda de cada pieza

- **MUERE** la atribución al campo de `0xb19e` y de las celdas `0x3a-0x3f` — con ella lo
  que quedaba del TL;DR del testigo (duración/persistencia del campo en overworld).
- **El hallazgo bueno del §c queda CATALOGADO** (era «candidato a registro de fase, sin
  catalogar»): es `tile_anim_remap[0x80..0x83]`, tabla DS:0xB11E, reloj `0x44b8`,
  init INTRO.OVL `0x0993`, consumidor FONT.OVL `0x02c2`.
- **El testigo del 08-08 queda en pie sin revisar**: nada pasó el gate; el residuo que
  obligaba a dudar era el castillo.
- **`FIELD_WALL_TILE` del port NO se toca**: su cita es la tabla estática DS:0x4596
  (`magic/tables.ts:72`), independiente de este testigo. Nota: en TileData los tiles
  0x80-0x83 se llaman TortureChair/TortureTable (parejas animadas 2-frame) — la
  coincidencia de rango con los valores de DS:0x4596 es del espacio de tiles de
  mazmorra/combate donde el gate 0x03 sí deja castear; no se adjudica aquí.
- **La regla de flota de #107 sigue vigente**: un diff alrededor de una acción necesita
  un control que haga sólo lo compartido. Aquí el control resultó decidible en estático
  porque los DOS sujetos del diff tenían escritor/fuente derivables.

## 4. El control VIVO — CORRIDO EL 2026-08-20, 01:06-01:08 · VEREDICTO: PASA

`re/tools/probe_field_pass_control.py`, oráculo headless propio de este host. El «no
bootea» de `xit-pila-273.md` §6 resultó ser la DETECCIÓN, no el boot: `_find_roster()`
busca los primeros 0x20 bytes de SAVED.GAM en RAM y el juego los muta al cargar, con lo
que `send_keys_until_main_menu()` declara fracaso YA EN EL MUNDO y las teclas restantes
del guion se consumen como comandos de juego (la 'j' tecleaba Jimmy — verificado con
capturas del framebuffer por el diag de #343 esta misma noche). La sonda navega con
Enters y detecta el mundo por los globals (`0x5893/0x5896/0x5897`) contra un SAVED.GAM
del run-dir parcheado a **sobremundo (86,107) — la puerta del castillo, el escenario
exacto del testigo**, con CERO casts en toda la sesión. Acta:

```
[01:07:24] enter 3: MUNDO (DS=1788)          ← el mismo game_ds que el testigo del 08-08
[01:07:37] PRE-Pass : 0xb19e=81 80 83 82  celdas[3a-3f]=4   → P1 PASA (permutación toggled, SIN cast)
[01:08:02] POST-Pass: 0xb19e=81 80 83 82  celdas[3a-3f]=4   → P2 PASA (sin toggle: fase par) · P3 PASA
[01:08:02] diff de UN turno de Pass: 63 bytes
VEREDICTO: PASA — la atribución al campo muere (registro y celdas aparecen sin cast)
```

Y el diff del turno de Pass corrobora el §1 en dos piezas NO pedidas: contiene
`0x6a7e` (el contador de fase del reloj, +1) y `0xb1f2-0xb1f9` **= 0xB11E+0xd4..0xdb, las
entradas de cascadas/fuentes** — los grupos de CADA tick avanzaron en el mismo turno en
que 0x80-0x83 no tocó (bit0 de fase a 0), exactamente la estructura leída en `0x44b8`.
Dato para el cabo de cadencia: UN turno de Pass = UNA llamada al reloj (fase +1) — el
«toggle por turno» del testigo implicaría 2 redibujos/turno en su secuencia con cast;
sigue declarado, sigue sin ser portante. Las 4 celdas (vs 5 settled del testigo) son
recomposición del viewport (sprite/censura tapando una); el predicado es >0 estable, y
lo es.

## Evidencia

- `re/disasm/ULTIMA.EXE.asm` 0x44b8-0x4550 (reloj), 0x00a1 (puntero 0xb11c), 0x5941/0x46f7
  (cadena de llamada); `re/disasm/INTRO.OVL.asm` 0x0986/0x0993-0x09a0 (init identidad);
  `re/disasm/FONT.OVL.asm` 0x02b3-0x02c8 (remap en blit); `re/disasm/NPC.OVL.asm` (usos de
  `[0xb11c]` como puntero, layout).
- `original/u5/play/DATA.OVL:0x3886` (índice de chunks, hallado por barrido exhaustivo con
  unicidad) + `original/u5/play/BRIT.DAT` (205 chunks × 256 B); volcado (82-90,103-110) en §2.
- `game/src/core/data/TileData.json` (nombres 0x3a-0x3f, 0x80-0x83, 0xd4-0xd7, 0xd8-0xdb,
  0xec-0xef, 0xfa-0xfd).
- `re/notes/field-duration-witness.md` (el testigo, con su criterio de decisión),
  `re/notes/field-grav-gate-testigo-20260808.md` (el gate), `re/notes/antim-freeze.md`
  (reloj maestro + latch An Tym), `re/notes/ui-render-map.md` (compositor 0x5910/0xab02),
  `re/notes/xit-pila-273.md` §6 (oráculo de este host caído).
