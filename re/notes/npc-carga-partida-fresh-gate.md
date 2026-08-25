# Al CARGAR partida el binario NO relee el `.NPC` — el gate `fresh` de `town_load_map`

Carril `npcs-save-sintetico` · 2026-08-25 · sobre main `c50d16db`. Origen: la divergencia
**D1** del side-by-side contra DOSBox (`~/PROYECTS/OpenU5-videos/lanzamiento/sbs-dosbox/`,
README §«Divergencias REALES»): con `blackthorn-pruebas/SAVED.GAM` el original **no pinta
NPCs** en la muralla del Palacio y el port pinta **dos guardias**.

Convención de las actas hermanas: desplazamientos en la forma `FICHERO.OVL:0x…`; nombres de
rutina en backticks aislados.

**Veredicto en una línea:** la hipótesis del carril `sbs-dosbox` era CORRECTA en su
conclusión y hay que afinarla en su mecanismo — el binario no «toma los NPC del bloque del
save» *en vez de* derivarlos: los deriva **exactamente igual que el port**, pero **sólo al
ENTRAR al mapa**. Al cargar partida un argumento vale 0 y se salta la derivación entera. El
contenido NPC del port es FIEL (mismos dos guardias, mismas casillas — medido); lo que
diverge es **CUÁNDO** se corre.

---

## §1 — El gate, en crudo: `town_load_map` TOWN.OVL:0x11F0

Un solo argumento decide. Transcrito verbatim del listado:

```
11f0: 55                push bp
11f1: 8bec              mov bp, sp
11f3: 83ec06            sub sp, 6
11f6: 56                push si
11f7: b001              mov al, 1
11f9: a2e624            mov byte ptr [g_unk_24e6], al
11fc: a2bca9            mov byte ptr [0xa9bc], al
11ff: 837e0400          cmp word ptr [bp + 4], 0      ; ★ EL ARGUMENTO — llámese `fresh`
1203: 7429              je 0x122e                     ; ★ fresh == 0 → SE SALTA TODO EL BLOQUE
1205: c746fe2000        mov word ptr [bp - 2], 0x20
120a: be625c            mov si, 0x5c62                ; 0x5C5A + 8 = registro-objeto slot 1
120d: b91f00            mov cx, 0x1f
1210: c60400            mov byte ptr [si], 0          ; limpia los 31 slots de objeto
1213: 83c608            add si, 8
1216: e2f8              loop 0x1210
1218: c606575900        mov byte ptr [g_drunk_timer], 0
121d: c606a45801        mov byte ptr [g_unk_58a4], 1
1222: e881e6            call 0xfffff8a6               ; ★ = K 0x7A76 → NPC.OVL:0x0000  LEE EL .NPC
1225: a07f58            mov al, byte ptr [g_hour]
1228: 2ae4              sub ah, ah
122a: 50                push ax
122b: e8a8e6            call 0xfffff8d6               ; ★ = K 0x7AA6 → NPC.OVL:0x00D6  npc_activate_all
122e: c6065859ff        mov byte ptr [g_shadowlord_here_idx], 0xff
1233: ff7604            push word ptr [bp + 4]
1236: e8cff1            call 0x408
1239: e872f0            call 0x2ae
123c: 2bf6              sub si, si                    ; barrido de dead-bits:
123e: 56                push si
123f: e8beed            call 0                        ;   npc_dead_bit_test(si)  TOWN.OVL:0x0000
1242: 0bc0              or ax, ax
1244: 7404              je 0x124a
1246: 56                push si
1247: e866ee            call 0xb0                     ;   npc_clear_slot(si)
124a: 46                inc si
124b: 83fe20            cmp si, 0x20
124e: 7cee              jl 0x123e
```

`near_call_base(TOWN.OVL) = 0x81D0` ⇒ `(0xF8A6+0x81D0)&0xFFFF = 0x7A76` y
`(0xF8D6+0x81D0)&0xFFFF = 0x7AA6`, los dos stubs de NPC.OVL.

⇒ **con `fresh = 0` no se limpia el registro-objeto, no se lee el `.NPC` y no se activa
nada.** El mapa se queda con lo que traiga la ventana del save.

## §2 — El censo de llamadores, POR BANDA (no por grep)

`re/tools/callers_por_banda.py TOWN.OVL:0x11f0`, con su control positivo obligatorio en
verde (el par de #158, 3 de 3 que el grep pierde). **Cuatro** llamadores, y tres pasan la
constante 1:

| llamador | argumento | qué es |
|---|---|---|
| `TOWN.OVL:0x12d1` | `mov ax,1; push ax` | entrada a mapa desde el bucle de pueblo |
| `BLCKTHRN.OVL:0x0c5d` | `mov ax,1; push ax` | salida de la escena de Blackthorn |
| `ULTIMA.EXE:0x4876` | `mov ax,1; push ax` | teleporte / moongate (gate `g_location < 0x21`) |
| **`ULTIMA.EXE:0x00f7`** | **CALCULADO** | **`main` — la ruta de ARRANQUE** |

El cuarto es el único con argumento no constante, y es la ruta que recorre *Journey Onward*:

```
ULTIMA.EXE  (main)
00b3: c746f80000        mov word ptr [bp - 8], 0     ; ambos locales a 0
00b8: c746fe0000        mov word ptr [bp - 2], 0
00bd: 803e935800        cmp byte ptr [g_location], 0
00c2: 750d              jne 0xd1                     ; ★ arranque DENTRO de pueblo → SALTA
00c4: e87379            call 0x7a3a                  ;   (sólo overworld) MAINOUT.OVL:0x0D22
00c7: c746fe0100        mov word ptr [bp - 2], 1     ;   ★ el ÚNICO sitio que pone [bp-2]=1
00cc: c746f80000        mov word ptr [bp - 8], 0
00d1: 803e935800        cmp byte ptr [g_location], 0
00d6: 7503              jne 0xdb
00d8: e99300            jmp 0x16e                    ; overworld → fuera del bloque de pueblo
00db: 803e935821        cmp byte ptr [g_location], 0x21
00e0: 7322              jae 0x104                    ; ≥0x21 → mazmorra ([bp-8]=1 en 0x0111)
00e2: 837efe00          cmp word ptr [bp - 2], 0
00e6: 7506              jne 0xee
00e8: 837ef800          cmp word ptr [bp - 8], 0
00ec: 7406              je 0xf4
00ee: b80100            mov ax, 1                    ; fresh = 1
00f1: eb03              jmp 0xf6
00f4: 2bc0              sub ax, ax                   ; ★ fresh = 0
00f6: 50                push ax
00f7: e84c79            call 0x7a46                  ; ★ TOWN.OVL:0x11F0
00fa: e85579            call 0x7a52                  ; TOWN.OVL:0x141E, bucle de pueblo
```

★★ **Cargar una partida guardada DENTRO de un pueblo da `fresh = 0`, y es
DETERMINISTA**: `[bp-2]` y `[bp-8]` nacen a 0 en `0x00B3`/`0x00B8`, y el único sitio que
sube `[bp-2]` a 1 (`0x00C7`) está detrás del `jne` de `0x00C2`, que con `g_location ≠ 0` no
se ejecuta. `[bp-8]` sólo sube a 1 en la rama de mazmorra (`0x0111`), inalcanzable con
`g_location < 0x21`. ⇒ los dos ceros llegan a `0x00E2`/`0x00E8` y el `je 0x00F4` cae en
`sub ax,ax`.

**Derivación independiente**: esta misma cadena la re-derivó en paralelo un segundo lector
partiendo de las cadenas de `DATA.OVL` (y de paso cerró la atribución de nombres que
`save-window-writer.md §9` declaraba sin verificar: `fileoff(DATA.OVL) = DS + 0x10`,
corroborada en 12 punteros ⇒ `0x9698` **sí** es `SAVED.GAM`). Las dos lecturas coinciden
instrucción a instrucción.

## §3 — Qué puebla los NPC, y desde dónde

### 3.1 `npc_load_map_data` NPC.OVL:0x0000 — el lector del `.NPC`

Selección de fichero por `(loc−1)>>3` (`0x0008`-`0x0034`: `towne.npc` `0x6D46` /
`dwelling.npc` `0x6D50` / `castle.npc` `0x6D5E` / `keep.npc` `0x6D6A`, punteros DS) y
registro por `(loc−1)&7` con paso **`0x240` = 576 B** (`0x004c: mov ax,0x240; imul`). Tres
lecturas (`call 0xffff82de` = K `0x256E`, el mismo `read_whole_file` de 4 args de
*Journey Onward*):

| destino | longitud | offset en el `.NPC` | qué |
|---|---|---|---|
| `DS:0x5D5E` | `0x200` | `0x240·n` | **horarios** (32 × 16 B) |
| `DS:0x659E` | `0x20` | `+0x200` | **tipos** (1 B por ranura) |
| `[bp-0x24]` (pila) | `0x20` | `+0x220` | dialogNum → trasvasado a `0x5F5E+i·16+0x0A` (`0x0090`-`0x00AD`) |

Dos de los tres bloques aterrizan **dentro de la ventana del save**. La única tabla
intermedia es un buffer de pila que dura 0x20 instrucciones.

### 3.2 `npc_activate_all` NPC.OVL:0x00D6 — el que llena la tabla VIVA

`di = 1` (`0x00DE`: la ranura 0 nunca se activa), y por ranura:

```
0102: 80bd9e6500        cmp byte ptr [di + 0x659e], 0 ; ★ tipo == 0 → ranura vacía, se salta
0107: 7505              jne 0x10e
010e: 57 / ff7604 / e8cb11   push di ; push [bp+4] ; call 0x12e0   ; schedule_index(hora)
011b: c7070100          mov word ptr [bx], 1          ; +0x00 state = 1
0129: 8a87615d          mov al, [bx + 0x5d61]         ; +0x02 X  ← horario +3
0137: 8a87645d          mov al, [bx + 0x5d64]         ; +0x04 Y  ← horario +6
013f: 8a87675d          mov al, [bx + 0x5d67]         ; +0x06 Z  ← horario +9
0147: 8a859e65          mov al, [di + 0x659e]         ; +0x08 tipo  ← la tabla de tipos
0152: 89846c5f          mov word ptr [si + 0x5f6c], ax; +0x0E servedSlot = ranura de la hora
0156: c7846a5f0000      mov word ptr [si + 0x5f6a], 0 ; +0x0C objIdx = 0
015f: c707ffff          mov word ptr [bx], 0xffff     ; pathIdx = −1
```

Es **exactamente** lo que hace `NpcManager.enterMap` del port (que ya lo citaba: «estado=1
(0x011b) · servedSlot=ranura de la hora (0x0152) · pathIdx=−1 (0x015f)»).

### 3.3 La banda entera cae dentro de la ventana `0x55A6..0x6605`

Con `fileoff = DS − 0x55A6` (la ventana es un volcado verbatim de 4192 B, `save-window-writer.md`):

| DS | tamaño | qué | file-offset en el `.GAM` |
|---|---|---|---|
| `0x5C5A` | 32 × 8 | registro-objeto (slot 0 = transporte de la party) | `0x6B4` |
| `0x5D5E` | 32 × 16 | horarios (del `.NPC`) | `0x7B8` |
| `0x5F5E` | 32 × 16 | **tabla VIVA** | `0x9B8` |
| `0x615E` | 32 × 32 | buffer de camino | `0xBB8` |
| `0x655E` | 32 × 2 | índice de camino | `0xFB8` |
| `0x659E` | 32 × 1 | **tipos** (gate de existencia) | `0xFF8` |
| `0x65C2` | 32 × 2 | contador de atasco | `0x101C` |

## §4 — La adjudicación empírica (dosbox-x headless, instancia propia)

Instrumento: `tools/dosbox-capture.sh` del carril `sbs-dosbox`, run-dir propio bajo
`/private/tmp/u5sbs`, `pgrep -f dosbox-x` en verde antes de cada arranque. Fotogramas en
`~/PROYECTS/OpenU5-videos/lanzamiento/sbs-dosbox/careo/d1-npcs/` (material de EA: **fuera
del repo**).

| arma | save | gesto | resultado |
|---|---|---|---|
| **A** (negativo) | `blackthorn-pruebas` tal cual | cargar, 4 pasos al norte | **CERO NPCs** — reproduce D1 sin depender del vídeo |
| **E3** (positivo) | el MISMO save | cargar → 2×sur → `Y` («Exit to Britannia!») → `E` («Enter the palace of Blackthorn!») | ★★ **APARECEN DOS GUARDIAS** en las almenas |
| D | `pruebas` + tabla viva de otro `.GAM` (167 B, sólo `0x9B8..0xBB7`) | cargar, 4 al norte | sin efecto |
| D2 | `pruebas` + horario + viva + tipos + pathIdx (603 B) | cargar, 4 al norte | sin efecto (**PNG byte-idéntico al de D**) |
| B / C | `capturas-saves/blackthorn-insignia` con y sin tabla viva | cargar | sin diferencia (1647 B de píxel = deriva del agua animada) |

★★ **A ⇄ E3 es el par causal**: el MISMO fichero, la MISMA sesión, el MISMO mapa. Al
CARGAR no hay NPCs; al SALIR y VOLVER A ENTRAR aparecen. Eso instancia la diferencia
justo donde el gate dice que vive, y no depende de ninguna lectura mía del layout.

⚠ **D y D2 fallaron y se declaran**: trasplantar bytes a mano NO bastó para que el original
dibujara un NPC. Falta al menos el registro-objeto `0x5C5A` y la asignación de `objIdx`
(`+0x0C`), que `npc_activate_all` deja a 0 y que alguien puebla después. ⇒ **no tengo una
receta validada para SEMBRAR la banda a mano**, y el acta no la finge (§6). B y C tampoco
adjudican: `blackthorn-insignia.gam` tiene la banda de NPC **byte a byte igual** a la de
`original/u5/play/SAVED.GAM`, que es un save de MAZMORRA (loc 40) — es un residuo heredado
al fabricarlo, no estado de palacio. **En todo el árbol no hay ni un solo `.GAM` real
guardado dentro de un pueblo.**

## §5 — El careo con el port: el contenido es FIEL, el gate no

Lo que pinta el port en `careo-t33` (party en (15,26), loc 18, hora 10), derivado de
`game/assets/npcs.json` + `scheduleIndex`: **ranuras 8 y 9, tipo `0x70` (guardia), en
(20,24) y (10,24)** — los dos guardias de las almenas del fotograma. Y es la MISMA
población que el binario materializa en E3 al re-entrar: dos actores de tipo guardia en las
almenas, donde al cargar no había ninguno. ⇒ `npcs.json` y la reimplementación de
`schedule_index` reproducen `npc_activate_all`; el defecto no está ahí.

⚠ **Lo que este careo NO acredita es la igualdad de CASILLA.** Las ranuras 8 y 9 llevan
`aiTypes [0,4,0]`, así que caminan; y entre el `E` de entrada y el fotograma de E3 pasan
turnos (salir del mapa y volver cuesta tiempo de juego, y la hora puede haber cambiado de
ranura de horario). En el fotograma los dos guardias están en filas distintas, no
simétricos como a la hora 10 en frío. Lo medido es **cuántos y de qué tipo aparecen, y que
antes no había ninguno** — que es lo que el gate predice. Una comparación casilla a casilla
exigiría leer `0x5F5E` en vivo con el oráculo (`MEMDUMPBIN`) en el instante de entrar, y no
se ha hecho.

| pieza | binario | port |
|---|---|---|
| leer `.NPC` + activar al ENTRAR al mapa | `fresh=1` (3 llamadores) | ✅ `enterMap(loc, state)` |
| al CARGAR partida en pueblo | **`fresh=0`: no activa; usa la ventana** | ❌ `enterMap(…, restore=true)` **re-deriva** si falta `npcWalk` |
| la ventana de NPC viaja en el `.GAM` | ✅ verbatim, 4192 B | ❌ **no se modela**: `saveNative.ts` no lee ni escribe `0x6B4`(1..31)/`0x7B8`/`0x9B8`/`0xFF8`; el espejo parcial `npcWalk` vive en el **sidecar** |

`manager.ts:568` ya dice la regla del binario correcta («restaura la ventana VERBATIM y NO
relee el `.NPC`») — pero sólo la aplica **dentro** de la rama `if (state.npcWalk && …)`. La
rama de AUSENCIA hace lo contrario: repuebla desde `npcData`. Es la clase
[[heredar-no-deja-el-campo-neutro-lo-deja-en-el-default]]: la ausencia se leyó como «no sé,
re-deriva» cuando en el binario significa «no hay nadie».

## §5-bis — Testigo ejecutable

`re/tools/test_npc_fresh_gate.py` — 12 casos que atan las afirmaciones de §1-§2 al CRUDO
(el gate `0x11FF/0x1203`, la resolución por banda de las dos llamadas de dentro, el censo
de los cuatro llamadores, los tres `mov ax,1` y la determinación del 0 en `main`) más el
censo del corpus de §7. Corre en 0,3 s.

La afirmación fuerte de §2 es un UNIVERSAL sobre llamadores («sólo `main` lo calcula»), y
un universal se cae en silencio en cuanto aparezca un quinto: el test lo enrojece nombrando
el sitio nuevo. El censo va POR BANDA con el control positivo de #158 en verde; y la vara
negativa exige que ningún literal crudo, por sí solo, reproduzca el censo.

Mutantes, predicción escrita antes de correr: M1 (quitar `ULTIMA.EXE:0x00F7` del esperado)
MUERTO · M2 (`0x00F4` = `mov ax,1`) MUERTO · M3 (`0x1203` = `jmp`) MUERTO ·
⚠ **M4 (mover `tipos` de `0x659E` a `0x6600`, zona a cero en todos los saves) SOBREVIVIÓ**
contra la predicción, y el mutante se re-verificó como instrumento: `_banda_a_cero` es un
AND, así que un control positivo que sólo pedía «algún `.gam` con la banda poblada` se
sostenía con `horario` y `viva` aunque el offset de `tipos` fuese falso. Corregido a
control **por bloque** (parametrizado): cada offset es portante por separado, y M4 muere.
Es la clase [[el-testigo-elegido-hace-pasar-al-aserto-con-el-codigo-roto]] dentro del
propio control.

## §6 — Lo que este acta NO hace

- **No siembra la banda de NPC** en el generador de saves: dos intentos de trasplante (§4, D
  y D2) no lograron que el original dibujara nada, así que la receta de siembra **no está
  derivada**. Falta adjudicar quién puebla el registro-objeto `0x5C5A` y el `objIdx` `+0x0C`
  a partir de la lista viva (candidatos sin leer: `TOWN.OVL:0x0408` y `TOWN.OVL:0x02AE`, los
  dos que `town_load_map` llama tras el gate).
- **No cambia el port.** El fix fiel (honrar la ventana vacía al cargar) dejaría VACÍOS los
  29 saves en pueblo del corpus (§7) y mueve mucha población de tests: es pieza con dueño,
  no cabo de este carril. Queda declarada en `re/deliberate-divergences.md`.
- **No mide `INIT.GAM` en vivo**: tiene `party_records = 0` (file `0x02`), o sea es la
  plantilla PRE-creación y *Journey Onward* rebota al menú (medido). Lo que sí se deduce del
  censo de escritores (`INTRO.OVL:0x1DFD` / `FONT.OVL:0x0E32` escriben `SAVED.GAM` al cerrar
  la creación de personaje, con la ventana recién leída de `INIT.GAM`): **la partida nueva
  nace con la banda de NPC a cero en loc 13**, que es el único momento del juego real en que
  ese estado existe. Sin medir en vivo, marcado como tal.
- No adjudica `DS:0x5D5A..0x5D5D`, `DS:0x65BE..0x65C1` ni `DS:0x6602..0x6605`.

## §7 — El corpus de pruebas, con cifras

Predicado: banda de NPC a cero = tabla viva `0x9B8` **y** tipos `0xFF8` **y** horario
`0x7B8` **y** registro-objeto `0x6B4` slots 1..31 (el slot 0 se EXCLUYE: es el transporte de
la party y nunca es cero — con él dentro el censo daba 1 en vez de 82).

| corpus | saves | banda a cero | de ésos, **en mapa poblado** (`loc≠0`) |
|---|---:|---:|---:|
| canónicos `~/PROYECTS/OpenU5-saves-canonicos` | 49 | 31 | **7** — ad12(18), part03/05/10(17), part06(10), part07/09(5) |
| `game/e2e/espejo-tour/saves` (copia de los canónicos) | 49 | 31 | 7 (los mismos) |
| fixtures del port `game/**` | 19 | 19 | **14** — init(13), ch01(13), ch02(17), ch03(2), ch04(6), ch05(5), ch06(1), ch07(3), ch08(4), ch09(8), ch10(30), ch11(26), ch12(7), ch13(19) |
| `original/u5/saves-lib` | 13 | 1 | **1** — `blackthorn-pruebas`(18) |
| `original/capturas-saves` | 7 | 0 | 0 |
| **TOTAL** | **137** | **82** | **29** (22 distintos: espejo-tour duplica los canónicos) |

Y **0 de 49** sidecars canónicos llevan `npcWalk` ⇒ los 49 entran por la rama de ausencia.

⇒ **22 saves distintos del corpus están guardados dentro de un mapa que el binario poblaría
y con la banda de NPC vacía.** En ellos el original pinta CERO NPCs y el port pinta los del
horario: cualquier careo port⇄original sobre uno de ellos que toque un NPC —una
conversación, un guardia, un bloqueo, un conteo de actores— compara contra un estado que el
original sólo tiene al empezar partida nueva. Es información de primer orden para quien
diseñe careos, y **no** la arregla este carril.

## §8 — ¿Toca esto a los tours del espejo? Sí, y **al revés** de lo que se teme

Pregunta del lead: si hay partes del espejo que arrancan DENTRO de un pueblo, ¿su primer
turno estaría midiendo un pueblo vacío contra un LP que lo tenía poblado?

**Las partes existen: siete.** De las 49 semillas de `game/e2e/espejo-tour/saves/`, siete
arrancan en mapa poblado — `ad12`(loc 18), `part03`/`part05`/`part10`(loc 17),
`part06`(loc 10), `part07`/`part09`(loc 5) — y las siete tienen la banda de NPC del `.GAM`
a cero **y** `npcWalk` ausente del sidecar (medido dentro de `gameState`, que es donde
vive: al leerlo del nivel superior el campo no aparece nunca y el censo sale correcto por
la razón equivocada — el sidecar sólo tiene tres claves, `version`/`qol`/`gameState`).
0 de 49 en las dos bibliotecas. ⇒ **las siete entran por la rama de AUSENCIA y re-derivan.**

**Pero el sentido del riesgo es el contrario.** El tour mide **el PORT** contra el OCR del
vídeo del LP, y el port RE-DERIVA: pinta el pueblo poblado. El LP es un humano jugando el
original que había ENTRADO al pueblo, así que su pueblo también estaba poblado. Los dos
lados coinciden — y coinciden **porque el port diverge**. El gate es invisible aquí: no hay
un pueblo vacío midiéndose contra un LP poblado, porque el que se mide no es el binario.

★★ **La consecuencia que sí es portante, y es una dependencia de secuencia, no una
preferencia:** el fix fiel —honrar la ventana vacía al cargar— **rompería el primer turno
de esas siete partes**, y lo haría *con razón*: el port pasaría a pintar el pueblo vacío
que pinta el binario, contra un LP que lo tenía poblado. ⇒ el fix del port **no puede
aterrizar solo**; tiene que ir con la regeneración del corpus por la vía medida (fabricar
entrando al mapa). Eso convierte el «pieza con dueño» de §6 en algo más fuerte: hoy las
siete semillas están sostenidas por la divergencia, así que quitarla sin regenerarlas
cambia 7 partes del espejo de verde a rojo.

⚠ **Residuo declarado, NO medido:** aun coincidiendo en «hay NPCs», el port los coloca en
sus PUESTOS de horario para la hora del save, mientras que en el LP estaban donde el humano
los había dejado (a media caminata, desplazados por sus propias interacciones). Si esa
diferencia de casilla cambia alguna línea comparable por OCR —una intercepción de mercader
(#301), un `Blocked!`, un saludo de tienda— no lo he medido. El tour compara TEXTO de
consola, no sprites, así que la mayoría de las diferencias de posición no registran; pero
«la mayoría» no es «ninguna», y queda como cabo.

---

## 🔴 CORRECCIÓN 25-08 (medida por el carril `npc-gate-plan`, tren #160)

Esta acta atribuye el «**0 de 49**» a que los sidecars no llevan `npcWalk` — como si fuera un
dato observado sobre partidas reales. **No lo es: es una consecuencia DE CONSTRUCCIÓN.** La vía
`.GAM`+sidecar **no puede transportar** el estado de NPC en absoluto: `SaveSidecar` no tenía el
campo y `extractSidecar` no lo extraía, así que ningún sidecar podía llevarlo jamás. `npcWalk`
vive en la vía JSON de `localStorage`, no en el sidecar.

**Por qué importa y no es un matiz:** leído como dato, el «0 de 49» sugiere que las semillas
simplemente no lo traen; leído bien, dice que **arreglar el gate sin añadir antes el transporte
dejaría vacío para siempre todo pueblo cargado por esa vía** — una divergencia nueva y peor que
la que se quería cerrar. De ahí que el arreglo vaya en DOS piezas (transporte + gate) y tras una
puerta cerrada por defecto.

Familia de la ficha de la casa: *la propiedad era cierta y el mecanismo nombrado, falso*.
