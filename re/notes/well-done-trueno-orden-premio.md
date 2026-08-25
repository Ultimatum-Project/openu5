# El WELL DONE del Altar: el trueno, el orden de la inversión, y qué sube de verdad (#330)

Derivación de la rama de QUEST COMPLETA de `shrine_visit` (`CAST2.OVL` 0x0c18-0x0d1a) y del
kernel `ULTIMA.EXE:0x3072`, nacida de tres reportes del usuario del 15-08 jugando el deploy
#34: (A) el trueno del WELL DONE no suena, (B) la inversión del viewport se ve cuando ya has
salido del santuario, y (C) «el +1 de inteligencia puede estar bien» — verifícalo.

Base de banda `CAST2` = `0xE1E0` (REGLA A de `quake-harpsichord.md §6`), la misma que usa
`shrine-rito-cadencia-negativo.md §0` y con sus mismos dos hits de control.

## 0. El tramo entero, leído (0x0c18-0x0d1a)

```
0c18  al = 1<<v ; and [g_shrine_quest_bitmap] ; xor 0xff ; and → APAGA el bit de misión
0c29  print_string(0xb6d7)                    ; "WELL DONE!"
0c34  set_color([g_unk_13b0] = 15)            ; ─┐
0c41  rect(8,8,0xb7,0xb7) con `stc`           ; ─┴ INVIERTE el viewport (XOR), SUELTO
0c44  si=0x7d0  … 0c61 jl   → barrido ASCENDENTE  (460 tonos)
0c66  si=0x61a8 … 0c83 jg   → barrido DESCENDENTE (460 tonos)
0c88  call 0x4e92 → kernel 0x3072              ; ★ EL TRUENO (§1)
0c8b  g_karma += 3, clamp 0x63
0c9c  if [v+0x4b7e] → ++g_party_records+12, clamp 0x1e, print 0x95b8   ; STR
0cbd  if [v+0x4b86] → ++g_party_records+13, clamp 0x1e, print 0x95c6   ; DEX
0cde  if [v+0x4b8e] → ++g_party_records+14, clamp 0x1e, print 0x95d4   ; INT
0cff  if v == 7 → g_karma += 3 otra vez        ; Humildad cobra DOBLE
0d16  push 0xa ; 0d1a call 0x5906              ; ★ kernel_flash(10) = RESTAURA (§2)
0d1d  pop/ret
```

## 1. (A) El trueno es `screen_shake_fx`, y las dos cuentas de #300 RECONCILIAN en 1.856

`0x0c88 call 0x4e92` resuelve a `ULTIMA.EXE:0x3072`, que el ledger ya nombra
`screen_shake_fx` (`censo-54-cuerpo-leido-acta.md:99`, 262 B). **No es un efecto distinto de
las tres ráfagas de la ceremonia del Códice** (0x0dc0/0x0dd7/0x0dee): es la MISMA rutina, el
cuarto caller del overlay. Eso zanja la pregunta que #300 dejó abierta («¿es ESE quake ya
portado u OTRO efecto?»): es ése.

**Cardinal REHECHO**, que era la instrucción explícita de #300 («la cuenta hay que REHACERLA,
no heredarla de ningún mensaje»). Cuerpo entero, 0x3072-0x3176:

| nivel | dónde | cuántas |
|---|---|---|
| bucle externo | `[bp-6]=8` en 0x3090, `dec`/`jne` en 0x315d | **8** |
| bucles internos por pasada | 0x3098 (`0x71ca` ↑) · 0x30c9 (`0xace` ↑) · 0x30fd (`0x7200` ↓) · 0x312d (`0xace` ↓) | **4** |
| iteraciones por bucle | `si` de 8 a 0xb3 paso 3 ⇒ ⌊171/3⌋+1 | **58** |

⇒ **8 × 4 × 58 = 1.856** `rand_range` + `set_tone`, una pareja por banda dibujada.

🔴 **Las «dos cifras irreconciliables» de #300 son la misma cifra mal contada una vez.** El
derivador apuntó «~58×2 sin verificar anidamiento»: vio dos de los cuatro bucles internos y
no vio el `[bp-6]=8` externo. Los 1.856 de #249 son exactamente 8×4×58. No hay discrepancia
que adjudicar — hay un anidamiento que faltaba leer. (Y es la lección de #300 en su propio
caso: la cifra se rehace leyendo el cuerpo, no se hereda de ningún mensaje, **ni siquiera del
mensaje que avisa de no heredar cifras**.)

### El PRNG, adjudicado: es el DEL JUEGO

`rand_range` es `0x2092`, que muta `g_rng_seed` en `0x5420`. **No** es el LFSR propio de
`noise_burst` (`0x223c`, estado en `0x545c`) que dejó a #217 sin ventana. O sea: en 1988 este
WELL DONE mueve el stream 1.856 tiradas, y las mueve **con el sonido apagado también** — la
bandera `[0xa9ce]` se comprueba DENTRO de `set_tone`, después del `rand_range` (clase de #94).

### Y aun así NO ABRE VENTANA — la razón es de ALCANCE, no de tamaño

El port **no calca ese consumo en ninguno de los cuatro sitios**: `{kind:"quake"}` es
presentación pura y las tres ráfagas del Códice ya corren a RNG cero desde que se cablearon.
Cablear el cuarto sitio **hereda la divergencia ya declarada**; no estrena una clase nueva ni
cambia el stream del port respecto a ayer. Lo que se DECLARA (doctrina de #329: el consumo
del original se declara, no se «completa») es la asimetría: 1.856 tiradas allí, cero aquí.

★★ La regla que este caso instancia: **«consume RNG en el binario» no implica «mueve stream
en el port».** Lo que abre ventana es que el PORT cambie su propio consumo. Un carril que
lea sólo la primera mitad aplaza un cableado de presentación por una ventana que no hace
falta — que es exactamente lo que le pasó a este sitio durante un día.

## 2. (B) La restauración es un EVENTO, y el port la había vuelto una DURACIÓN

En el binario, `0x0d1a kernel_flash(10)` restaura el viewport **dentro** de `shrine_visit`,
tres instrucciones antes del `ret`. La caminata de salida del envoltorio (`0x1075-0x10bd`, la
escena de #277) corre **después de ese `ret`**. ⇒ inversión y salida están **serializadas por
construcción**, y en 1988 es imposible ver el negativo ya de vuelta en el sobremundo.

El port las tenía en **paralelo**: el mismo `applyEvents` arrancaba dos temporizadores de
reloj de pared independientes — `RitualInvert.run(wellDoneInvertWindowMs())` y
`ShrineScenePacer.run(guiónDeSalida)`. Medido en este árbol:

| ventana | cifra | de dónde |
|---|---|---|
| inversión | **5.347,5 ms** | `wellDoneInvertWindowMs()` = 2 × barrido |
| escena de salida | **2.251 ms** | 9 beats / 41 fotogramas × 54,9 ms |
| **la inversión sobrevive a la salida** | **+3.097 ms** | diferencia |

Ésos son los tres segundos que el usuario ve en negativo estando ya fuera. **El síntoma no
es de duración mal calibrada: es de ORDEN.** Aunque la ventana midiese exactamente lo que
mide 1988, seguiría solapándose con una salida que en el binario no ha empezado todavía.

**Arreglo:** la restauración recupera su papel de evento. `RitualInvert` gana `whenRestored`,
la escena de salida se aparca detrás de ella, y el orden del binario queda reproducido por
construcción en vez de por que las dos cifras casen. Bajo automatización la ventana es 0, la
inversión no llega a montarse y la salida corre en el acto: e2e y digests no se mueven.

★★ Familia de `cablear-una-pausa-derivada-obliga-a-auditar-lo-que-separa`: **cuando el
binario separa dos bloques con un gesto, colocar ese gesto CAREA EL ORDEN del port** — y aquí
el careo salió negativo. Dos efectos de reloj de pared arrancados en el mismo lote no están
«sincronizados»: están en carrera, y quien gana depende de dos constantes que nadie escribió
para compararse.

## 3. (C) El premio: ni es «el +1», ni es siempre de inteligencia

Las tres tablas viven en `DATA.OVL` y el binario las consulta **las tres seguidas**, cada una
con su `cmp byte [bx+tabla],0` (`bx` = índice de santuario). Bytes crudos, verificados contra
`original/u5/ultima5/DATA.OVL` (48.464 B), convención DS+0x10:

| tabla | DS | fileoff | bytes (v = 0..7) |
|---|---|---|---|
| STR | `0x4B7E` | `0x4B8E` | `0 0 1 0 1 1 1 0` |
| DEX | `0x4B86` | `0x4B96` | `0 1 0 1 1 0 1 0` |
| INT | `0x4B8E` | `0x4B9E` | `1 0 0 1 0 1 1 0` |

Leídas por virtud:

| v | virtud | sube |
|---|---|---|
| 0 | Honesty | INT |
| 1 | Compassion | DEX |
| 2 | Valor | STR |
| 3 | Justice | DEX + INT |
| 4 | Sacrifice | STR + DEX |
| 5 | Honor | STR + INT |
| 6 | Spirituality | **STR + DEX + INT** |
| 7 | Humility | **ninguno** (y karma DOBLE, 0x0cff) |

Es la composición clásica de las ocho virtudes sobre los tres principios (Verdad=INT,
Amor=DEX, Valor=STR), pero sale de **los datos**, no de la lore: la lore vale aquí como
segundo canal que cuadra, no como fuente.

Los rótulos son verbatim con su `\n` dentro: DS `0x95B8`/`0x95C6`/`0x95D4` →
`"Strength +1\n"`, `"Dexterity +1\n"`, `"Intelligence +1\n"`. El tope es `0x1E` (30), escrito
por los tres `mov byte [g_party_records+N],0x1e` (0x0cb1/0x0cd2/0x0cf3). El sujeto es el
**Avatar**: los tres destinos son `g_party_records+12/13/14` **sin índice** = registro 0
(+12 STR, +13 DEX, +14 INT en el registro de 32 B).

**Veredicto: el port ya era correcto** (`shrines.ts` `SHRINE_*_FLAG` + `shrineCompleteQuest`).
El reporte se cierra CONFIRMADO, y de paso queda corregida la forma de la pregunta: no hay
«el» premio del rito.

🔴 **Y el handler del CÓDICE no da premio ninguno.** `CAST2 0x0d24-0x0e76` no escribe ni
atributos ni karma — censado con control positivo (el mismo predicado sobre `shrine_visit`
da 18 aciertos; sobre el handler del Códice, 0). Quien busque el «+1» del Códice porque lo
vio jugando el Códice no lo encontrará ahí: el premio es del **santuario** al entregar la
misión, y el Códice sólo enseña la página. El usuario vio las dos cosas en la misma sesión
porque para pasar al Códice hace falta una misión activa.

## 4. Lo que NO se mide aquí (para que nadie lo dé por medido)

- La **duración en fotogramas** del `kernel_flash(10)` como tal (10 redibujos ≈ 549 ms con la
  unidad del troll) NO se cablea: el port trata la restauración como instante. Cambia el
  final de la ventana en medio segundo, no el orden.
- Que la inversión se vea **durante** los barridos y no antes/después es reloj de pared del
  navegador; lo guardado por prueba es la ESTRUCTURA (la salida cuelga de la restauración),
  no el instante.
- El **bracket del Códice** (0x0db3/0x0dca/0x0de1) sigue bloqueado por la doble cerradura de
  #305 (valor de `g_unk_13ae`) y #317 (XOR de paleta de verdad). Este trabajo no lo toca.
