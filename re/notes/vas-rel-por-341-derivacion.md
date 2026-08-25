# Vas Rel Por (idx 46) — derivación completa y el retorno de TRES valores (ficha #341)

Sujeto: el BINARIO. Cierra el último pendiente de `hechizos-inertes-319.md §6` y hermana de
`in-quas-xen-340-derivacion.md`, cuya receta de resolución de cruces se usa aquí TAL CUAL.
Rutina: `vas_rel_por_phase_gate`, **CAST.OVL:`0x0cf0` → `ret` en `0x0d4b`**.

## 0. El span, RE-MEDIDO (el aviso heredado de #340)

#340 encontró que el acta de #319 había cortado `in_quas_xen_clone_creature` a media rutina
y que su censo de llamadas era el del TRAMO, no el del cuerpo. Aquí se aplica el mismo
control ANTES de fiarse de nada:

| control | resultado |
|---|---|
| `ret` real | `0x0d4b`, con `mov sp,bp` / `pop bp` delante (`0x0d48`) |
| prólogo siguiente | `0x0d4c: push bp` / `0x0d4d: mov bp,sp` — frontera limpia, sin relleno |
| filas del cuerpo | **32** (0x0cf0-0x0d4b) |
| `call` del cuerpo entero | **6** (`0x58d0`, `0x66ec`, `0x573a`×2, `0xffffc186`, `0x8874`) |
| `call` del tramo hasta el primer `ret`-aparente | los mismos 6 — no hay tramo corto que confunda |

⇒ Aquí NO hay corte: la rutina es corta y el `ret` es el primero que aparece. El control se
deja escrito porque su AUSENCIA de hallazgo también es información (#340 lo tuvo, ésta no).

## 1. Los cruces, resueltos con `dispatch_table` (y sus controles positivos)

Base near-call de CAST.OVL = `0xbf80` (`dispatch_table.overlay_near_call_base`), y
`resuelto = (destino + base) mod 0x10000` (§LA FÓRMULA de #319):

| en CAST.OVL | resuelve a | qué es |
|---|---|---|
| `call 0x58d0` | kernel `0x1850` | **print string** |
| `call 0x66ec` | kernel `0x266c` | **getkey** |
| `call 0x573a` ×2 | kernel `0x16ba` | **putchar** |
| `call 0xffffc186` | stub `0x8106` → CAST2.OVL:`0x0000` | jingle (arg **8**) |
| `call 0x8874` | kernel `0x47f4` | **`kernel_moongate_teleport`** |

**CUATRO CONTROLES POSITIVOS, cada uno por una vía AJENA a esta aritmética** (y tres de
ellos cruzan de BANDA, que es lo que hace que no puedan ser el mismo error repetido):

| control | acreditado aparte por | |
|---|---|---|
| `0x1850` = print string | #340 §1 y #319 §2-quinquies, los dos con otro llamador | ✓ |
| `0x16ba` = putchar | #319 §2-quinquies: **CAST2**`:0x34da` + base `0xe1e0` = `0x16ba` — otra banda | ✓ |
| `0x266c` = getkey | #340 §2: **COMSUBS**`:0x448c` es el getkey del cursor de apuntado; `0x448c + 0xe1e0 = 0x266c` — otra banda | ✓ |
| `0x8106` → CAST2:`0x0000` | #319 §2-quater: el despachador de jingle | ✓ |

**Corroboración por contigüidad de cadenas** (la vía que #319 usó para In Wis/An Grav y que
#340 dejó anunciada para ésta): la cadena que emite `0x0cff` es DS `0x45e7` → DATA.OVL
fileoff `0x45f7` = **`"To phase: "`**, y la ANTERIOR es DS `0x45dc` = `"Creature: "`, la de
In Quas Xen. `0x45dc + 10 caracteres + NUL = 0x45e7` **exacto**: los prompts de los dos
hechizos del mismo bloque de CAST.OVL están pegados en los datos, por una vía que no pasa
por el trampolín ni por la fórmula.

## 2. El cuerpo

```
0cf6  if ((g_transport_tile & 0xf0) == 0x20) → ret 0    ; a bordo de un BARCO
0cff  print "To phase: "                                ; DS 0x45e7
0d06  al = getkey()                                     ; kernel 0x266c
0d0c  if (al >= 0x20) putchar(al)                       ; eco SÓLO si imprimible
0d16  putchar('\n')                                     ; SIEMPRE
0d1d  if (al < '1' || al > '8') → ret 0                 ; SIN bucle de reintento
0d29  al -= '1'                                         ; fase 0..7
0d2d  jingle 8                                          ; CAST2:0x0000
0d3a  res = moonstone_teleport(al)                      ; kernel 0x47f4
0d3f  return res ? -1 : 0
```

**El gate del barco** cubre la banda `0x20`-`0x2F` = fragata (0x20-0x27) + esquife
(0x28-0x2B) + nave NPC (0x2C-0x2F). A pie (`0x1C`), a caballo (`0x10`) y en alfombra
(`0x14`) el hechizo SÍ se lanza. Va ANTES del prompt: a bordo ni pregunta.

**El getkey es PELADO**: una lectura, sin bucle. Una tecla fuera de `'1'`..`'8'` —incluido
ESC— termina el hechizo por el mismo `sub ax,ax` de `0x0d46`. Quien lo porte como un prompt
de dígito que RE-LEE deja al jugador atrapado donde el original ya había contestado.

## 3. 🔴 EL RETORNO TIENE TRES VALORES — y ése era el pendiente de #319 §6

#319 cerró su acta con: «hay que derivar por qué el brazo pone `[bp-6] = 0` cuando
`res != 0`: altera el retorno del despachador». **La pregunta era del DESPACHADOR, no de
la rutina** — `[bp-6]` no existe en `0x0cf0`, que sólo usa `[bp-2]`. El brazo vive en
`cmd_cast` (CAST.OVL:`0x0dba`), case idx 46:

```
112e  call 0xcf0            ; vas_rel_por
1131  mov [bp-0xa], ax      ; res
1134  or ax,ax
1136  je 0x11a6             ; res == 0 → a la cola SIN tocar [bp-6]
1138  mov word [bp-6], 0    ; res != 0 → [bp-6] = 0
113d  jmp 0x11a6
```

y la COLA COMÚN del Cast, que lee `[bp-0xa]`:

```
11a6  cmp word [bp-0xa], 1
11aa  jne 0x11b6
11ac  print "Success!\n"    ; DS 0x4656
11b3  jmp 0x11d6
11b6  cmp word [bp-0xa], 0
11ba  jne 0x11d6
11bc  print "Failed!\n"     ; DS 0x4660  + beep 0x842e(0x32,1,0x7d0,0x320)
11d6  mov ax, [bp-6]        ; ← LO QUE cmd_cast DEVUELVE
11d9  ret
```

⇒ la cola tiene **tres casos**: `1` → "Success!", `0` → "Failed!" + beep, **cualquier otro
valor → NADA**. Y `[bp-6]` arranca en **1** (`0x0dc4`).

Vas Rel Por devuelve `-1` al ACERTAR. Por tanto, al acertar:
1. la cola no imprime nada — el éxito es **MUDO**;
2. `[bp-6]` pasa a **0**, y `cmd_cast` devuelve 0 en vez de su 1 por defecto.

★★ Lo que el `[bp-6] = 0` significa NO es «el hechizo falló» sino **«el hechizo te movió de
sitio»**: el llamador de `cmd_cast` recibe un retorno distinto justo en el caso en que el
mapa y la localización han cambiado bajo sus pies. Leerlo como fracaso —que es lo que
sugiere la forma del brazo— invertiría el hechizo entero. La lectura de #319 («huele a que
consume el turno de otra forma») apuntaba en la dirección correcta y no podía cerrarse sin
abrir la cola: es el mismo patrón de §2-quinquies-bis, un brazo plausible que sólo se
adjudica leyendo a quien lo consume.

## 4. `kernel_moongate_teleport` (`ULTIMA.EXE:0x47f4`, `ret 2`, arg = fase 0..7)

Span `0x47f4`-`0x48a4` (`ret 2`), 70 filas, prólogo siguiente en `0x48a8`. Es la rutina que
COMPARTEN el hechizo y la moongate FÍSICA (`0x48a8` la llama en `0x4977`).

**Las cuatro tablas paralelas de 8 bytes**, en el orden en que las lee:

| DS | qué | escritura |
|---|---|---|
| `0x5840` | **location** de destino, `0xFF` = en la mochila | `0x483d`/`0x4841` |
| `0x5830` | x | `0x4844`/`0x4848` |
| `0x5838` | y | `0x484b`/`0x484f` |
| `0x5848` | floor (`0` Britannia · `0xFF` Underworld) | `0x4852`/`0x4856` |

**El único gate es `!= 0xFF`** (`0x47fd cmp byte [bx+0x5840],0xff` → `0x4804 sub ax,ax`):
no compara contra `g_location`. Ése es el gate de DIBUJO de la puerta (`0x4713`), y
confundirlos rompe el viaje entre localizaciones, que es todo el hechizo.

### 4-bis. 🔴 El binario deja el MAPA VIEJO montado en dos de los cuatro cruces

Tras escribir los cuatro campos, `0x4859`-`0x4898` elige entre cuatro brazos comparando la
location de ORIGEN (`[bp-2]`, leída en `0x4837`) con la de DESTINO:

| de → a | qué carga |
|---|---|
| pueblo → pueblo (ambos en 1..0x20) | `0x4872 push 1; call 0x7a46` = **TOWN.OVL:`0x11f0`**, el cargador de small map |
| sobremundo → sobremundo (ambos 0) | `0x4889`-`0x489b`: restaura los 0x100 B de `0x5c5a` (`call 0x256e`) + **MAINOUT.OVL:`0x0000`** |
| sobremundo → pueblo | `0x487c jne 0x489e` → **NADA** |
| pueblo → sobremundo | `0x4883 jne 0x489e` → **NADA** |

En los dos últimos `g_location` ya vale el destino y el mapa residente sigue siendo el de
origen. Alcanzable sólo con una piedra re-enterrada DENTRO de un pueblo — la puerta del
(U)se sólo rechaza `location >= 0x21` (#143a), así que enterrar en pueblo está permitido; y
las ocho de fábrica traen `location = 0` (los 70 saves del corpus, `parseSaveWindow`).

Y **el pool de errantes es neto CERO en el cruce sobremundo→sobremundo**: `0x480a`-`0x482f`
lo GUARDA a disco (`call 0x25d8`) al salir del sobremundo y `0x4889`-`0x4898` lo RESTAURA
acto seguido sobre los mismos bytes. No es que no se toque: es que se toca dos veces en
sentidos opuestos.

### 4-ter. TOWN.OVL:`0x11f0` NO reposiciona

El cargador de pueblo (leído entero, `0x11f0`-`0x12a7`) limpia la tabla de objetos, el
contador de borrachera y el flag de Shadowlord, llama a `0x408` (mapa) y a `0x2ae`
(colocación de Shadowlord)… y **no escribe `g_party_x`/`g_party_y` en ningún punto**. Las
coordenadas las puso el LLAMADOR desde la piedra (`0x4844`/`0x484b`). ⇒ tras el teleport a
un pueblo apareces SOBRE LA PIEDRA, no en la entrada estándar. Un port que reutilice su
cargador del (E)nter tal cual te deja en la puerta del pueblo.

## 5. RNG

**El hechizo NO tira por sí mismo**: ni `0x0cf0` ni `0x47f4` llaman a `rand_range`
(`0x2092`), ni directamente ni a través de sus callees de kernel (`0x1674`, `0x251e`,
`0x256e`, `0x25d8`, barrido transitivo a profundidad 6).

🔴 Pero SÍ mueve stream **transitivamente y sólo por un brazo**: el cruce pueblo→pueblo
entra en TOWN.OVL:`0x11f0`, cuya cola coloca al Shadowlord urbano y posee NPCs — consumo ya
medido y modelado en el port (`applyUrbanShadowlord`, 32 `rand(0,1)`). Los otros tres brazos
no cargan nada y no consumen. ⇒ **el cardinal por lanzamiento no es constante: es 0 o el del
cargador de pueblo**, y depende de dónde estés y de dónde esté la piedra. Se acredita QUE
puede consumir; el número no se estima (familia #31/#101).

## 6. Port

Cableado en esta ficha:

- `moonstoneDestination` (`game/src/core/world/moongates.ts`) — la lectura de las cuatro
  tablas con el centinela `0xFF`, separada de `moongateDestination` (que elige por HORA y
  descarta el campo `location`).
- `Game.moonstoneTeleport` (`game/src/core/game.ts`) — el calco de `0x47f4`.
- El prompt `getkey` PELADO en `PromptManager` + `castGateTravel` en `main.ts`, con el gate
  del barco, la banda `'1'`..`'8'`, el jingle y el silencio del éxito.
- Tests: `game/tests/vas-rel-por-341.test.ts` (13, esperados en crudo).

**DIVERGENCIA DECLARADA:** el port no puede representar el estado «`g_location` cambiado con
el mapa viejo montado» de §4-bis — `activeMap` es un getter DERIVADO de `position.location`,
no un búfer cargado. Los cuatro cruces cargan el mapa del destino. Es la divergencia
conservadora (el port se queda con el estado coherente) y arrastra la del stream: en
sobremundo→pueblo el binario no consume y el port sí (el cargador). Declarada aquí y en el
docblock de `moonstoneTeleport`.

**CABO, NO tocado:** la moongate FÍSICA del port (`checkMoongate`) llama en el binario a
ESTA MISMA rutina, y el port le pasa `moongateDestination`, que descarta `location` — o sea,
la puerta física nunca te cambia de localización aunque la piedra esté enterrada en un
pueblo. Es anterior a esta ficha, de la familia de #149, y se deja escrito para que quien lo
arregle no lo redescubra. (Cerrado después en #352, `a9bc5acb`.)

## 7. Careo contra el ÚNICO testigo de vídeo (carril careo-tophase-341, 23-08)

El censo de beats de `fenton-curacion.md §6` dio que el prompt `To phase:` tiene **0 rutas
testigo en LP1, 0 en AD y 3 en Lord Fenton** — es el único tesoro exclusivo de la tercera
playlist. Este careo extrajo y leyó A OJO (fotogramas ffmpeg, no OCR) las **cinco**
ocurrencias de esas 3 rutas:

| episodio | t (s) | tecla | contexto |
|---|---|---|---|
| lf29 (Hythloth) | ≈1655-1662 | `2` | tras recoger el Shard of Cowardice |
| lf30 (Death of the Shadowlords) | ≈372-384 | `4` | tras salir de un pueblo |
| lf30 | ≈517-527 | `5` | encadenado al anterior |
| lf30 | ≈531-546 | `6` | encadenado, recién llegado del salto a fase 5 |
| lf31 (Destard) | ≈1252-1264 | `2` | tras recoger el Amulet of Lord British |

**La secuencia, idéntica en los cinco** (y es la del cuerpo de §2):

```
>Cast...            ← eco del comando, CON bullet
Player: Fenton      ← sólo lf31 (sin jugador activo); lf30 va directo — corrobora el
                      gate 0x4988 del caster-select (#78-activo) por la vía del vídeo
Spell name:         ← fila PLANA: sin bullet y sin línea en blanco delante
:VAS REL POR
To phase: ▓         ← prompt esperando, cursor PARPADEANDO detrás del espacio
To phase: 4         ← eco de la tecla DETRÁS, misma fila
                    ← NADA más: ni "Success!" ni "Failed!" — el éxito MUDO de §3,
                      confirmado por PERSISTENCIA (la consola desplaza, no borra: en los
                      fotogramas posteriores la historia entre casts no contiene Success)
>West               ← siguiente comando
```

**El viaje**: tras el eco, **~~~8-9 s~~ 6,37-6,47 s de pantalla con la paleta INVERTIDA
sobre el mapa de ORIGEN** (viewport en rosa/blanco, mapa sin cambiar), y al terminar
aparece el mapa del DESTINO. 🔴 CIFRA RE-MEDIDA (cabos-tanda2, 23-08): la «~8-9 s» era
lectura a ojo; medida a FOTOGRAMA (30 fps, luminancia media del viewport, umbral 140,
control de continuidad sin valles interiores) sobre los CINCO casts: lf29 6,433 s ·
lf30 6,367 / 6,400 / 6,467 s · lf31 6,400 s — **media 6,41 s, banda ±0,05 s**. Una sola
ventana continua (sin hueco a mitad: descarta doble jingle). Es la ceremonia del jingle 8 (`CAST2:0x0000`, familia de los pares set_color+rect
XOR que e4525b83 derivó para el Códice); el port lo aproxima con el `cast-spell` genérico
SIN inversión y teleporta al instante — aproximación YA DECLARADA en
`hechizos-inertes-319-cableado.md §4` («la aproximación vigente para todos los jingles del
Cast»). El testigo deja MEDIDO qué omite esa aproximación: la ventana invertida de ~8-9 s.

### 7.1 Divergencia encontrada y CORREGIDA: bullets y grupo en las filas de prompt

El port empujaba «Spell name:» (pickSpellTyped, #107) y «To phase: » (castGateTravel) por
`hud.echo` ⇒ bullet ► delante y línea en blanco de grupo — el vídeo muestra las cinco veces
filas planas y consecutivas, y el ASM lo respalda: las dos cadenas las imprime
`print_string` (0x0cff → kernel 0x1850; DS 0x4603/0x45e7), no el eco del despachador. El ►
del port marca «eco de comando» (console.ts:115) y estas filas no lo son. Fix: las dos van
por `echoCursor` (eco `cont`: sin bullet, sin abrir grupo, y `echoSetLast` sigue ecoando la
tecla detrás — la misma fila del «:» de Yell/Talk). De paso el prefix del getkey pasa
TRADUCIDO (antes el prefix crudo EN pisaba la fila traducida al ecoar la tecla en ES).
⚠ La analogía con Yell que adjudicó el bullet en el merge de mix-flow-fidel no aplicaba:
en Yell «Yell what?» SÍ es la fila del eco del comando (el handler APENDA "what?" al eco
"Yell "); en Cast/Mix la etiqueta abre fila nueva por print_string. Re-adjudicado en
`pickers-unit.test.ts` con el tachado.
Guardas: `pickers-unit.test.ts` (etiquetas por el canal sin bullet) y el e2e
`vas-rel-por-tophase.spec.ts` (la secuencia entera contra el testigo, con la metadata
`kind`/`cont` expuesta por el hook read-only `consoleMeta`). Mutante: revertir
`echoCursor`→`echo` en cualquiera de los dos call-sites enrojece su guarda.

### 7.2 Divergencias observadas y NO tocadas (dueño ajeno)

1. **El cursor del getkey no parpadea en el port**: con el prompt `To phase:` abierto, el
   vídeo muestra ▓ parpadeando tras el espacio; el port no pinta cursor ninguno (medido con
   3 capturas a 300 ms). Es el gate de #329 (`awaiting-gate.ts`): `promptOpen` cuenta como
   modal y APAGA el cursor — pero el criterio ★ de esa misma cabecera dice «NO entra si el
   motor está parado esperando una tecla — ahí el cursor es exactamente el mensaje
   correcto», y el `getkey` de 0x0d06 es exactamente eso. Afecta a TODOS los prompts
   modales (Y/N, dígito…), no sólo a éste: es una re-adjudicación de #329, no un fix de
   esta ficha. (Cerrado por el carril cursor-getkey: derivación, censo de los 100
   llamadores de 0x266c y careo del testigo en `getkey-cursor-derivacion.md`; el gate
   queda re-adjudicado y el port pinta la ola en la fila viva de toda la clase.)
2. **La ventana invertida del jingle 8** (arriba): aproximación declarada de
   `hechizos-inertes-319-cableado.md §4`, ahora con la medida del testigo (~~~8-9 s~~
   6,41 s ±0,05 — cinco hitos a fotograma, ver §7). **Y la constante del port ya
   existe, DERIVADA con cero grados de libertad nuevos** (cabos-tanda2, 23-08): las
   tablas del jingle de CAST2:0x0000 en `speaker.ts` tienen 9 entradas y
   `timeSpellFlashWindowMs(8)` da **delay 1 209 ms (NB de entrada) + dur 3 255 ms (los
   2 sweeps de count=0x2710+0xfa0·8=42 000)** bajo la unidad calibrada U=0,93 ms
   (ancla WAV de task #72, máquina del usuario). El testigo de Fenton mide ×1,97 esa
   ventana: el sweep es un BUSY-LOOP — el ASM fija ITERACIONES, no ms, y la máquina de
   Fenton corre ~2× más lenta que el ancla (hipótesis de causa: cycles de su DOSBox;
   el FACTOR ×1,97 sí está medido, cinco hitos σ≈0,03 s — exactamente la clase de
   `compartir-la-primitiva-del-asm-no-es-compartir-su-constante-calibrada`). ⇒ El día
   que se cablee la ventana, la constante es `timeSpellFlashWindowMs(8)` — NO los
   6,4 s del reloj de pared de Fenton. El cableado en sí sigue con dueño ajeno: exige
   congelar el snapshot de ORIGEN durante la ventana (el core teleporta al instante),
   pintor doble fiel+shader (#295) y auditoría de orden de la pausa (clase #294).
