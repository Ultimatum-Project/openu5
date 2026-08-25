# VERBO DE TRANSPORTE — derivación, fix calcado y medición

> Cierra el hallazgo #1 de la Fase 3f del espejo (`espejo-3f-resultado.md` §4.1).
> Rama `fix/transporte-verbo`. 2026-07-27.

---

## 1. LA DERIVACIÓN — SON **DOS** RUTINAS, Y DIFIEREN EN UNA CLASE

El briefing inicial daba UNA tabla («0x20/0x24→Head») citando `transport.md:45`. Derivadas las
dos rutinas del disasm, la corrección del carril de frontera queda **CONFIRMADA**: el verbo no
es propiedad del vehículo sino del par **(vehículo, CONTEXTO)**, y el único que cambia es el
BARCO.

| clase | overworld `transport_face` **MAINOUT 0x00DA** | pueblo `town_transport_face` **TOWN.OVL 0x057C** |
|---|---|---|
| a pie `0x1C` | — (default 0x0106→0x0129, no imprime) | — (default 0x05A0→0x05FC, no imprime) |
| caballo `0x10` | `"Ride "` DS 0x2946 (file 0x2956) @0x010A | `"Ride "` DS 0x2666 (file 0x2676) @0x05A2 |
| alfombra `0x14` | `"Fly "` DS 0x294C (file 0x295C) @0x0130 | `"Fly "` DS 0x266C (file 0x267C) @0x05C4 |
| esquife `0x28` | `"Row "` DS 0x2951 (file 0x2961) @0x0152 | `"Row "` DS 0x2671 (file 0x2681) @0x05E6 |
| **barco `0x20`/`0x24`** | **`"Head "`** DS 0x2956 (file 0x2966) @0x016A, **sólo si el facing CAMBIÓ** (0x0181), y **`return 1`** que aborta el paso | **SIN VERBO**: 0x0591/0x0596 saltan **DIRECTOS** a 0x05ED, que sólo recompone el tile |

**El RUMBO lo pone el LLAMADOR, y también difiere:**
- overworld `outdoor_move` 0x0490 → 0x0507 push DS 0x29DB `"North\n"` (file 0x29EB), **gateado a
  `g_sail_dir == 0`** (0x0500);
- pueblo `town_move` 0x0600 → 0x0662 push DS 0x2676 `"North\n"` (file 0x2686), **SIN gate**
  (0x065F llama a la rutina del verbo y 0x0662 imprime, sin condición).

**Bytes verificados a mano sobre `DATA.OVL`** (bias DS+0x10): los verbos llevan **espacio final
y NINGÚN `\n`**; los rumbos llevan `\n` ⇒ el original compone **una sola línea**.

**Tercera asimetría, estructural**: `transport_face` **devuelve 0/1** y el 1 aborta el paso
(girar cuesta el turno); `town_transport_face` es **VOID** (`ret 2` sin valor) — en pueblo girar
**no** consume el paso.

Orden del switch de rumbo del giro (0x018D-0x01A1, destinos 0x1A6/0x1D0/0x1CA/0x1D6):
**0=N, 1=E, 2=S, 3=W**.

### 1.1 `transport.md:45` estaba MAL — corregido con cita

Tres defectos, los tres verificados, corregidos en el mismo commit (regla: cita equivocada peor
que ninguna):
1. daba **una** tabla de verbos donde hay **dos rutinas** que difieren en el barco;
2. decía `base+turn_arg` para caballo y alfombra, y esas dos clases **sólo tienen DOS
   orientaciones de sprite** — caballo E→0x12 / O→0x13, alfombra E→0x14 / O→0x15, y **N/S dejan
   el tile intacto** (0x0111-0x0124 y 0x0137-0x014A; idéntico en TOWN 0x05A9-0x05BC / 0x05CB-0x05DE);
3. ponía `rema ("Rowing!")` en la columna VERBO de la fragata arriada, mezclando el verbo de
   `transport_face` con un print de `ship_try_move` (0x020E) que es otra cosa: en overworld
   **0x24 también imprime `"Head "`** (0x00FC `cmp 0x24` → je 0x16A).

## 2. EL HUECO DEL PORT (lo que había)

`game/src/core/game.ts:958` empujaba `DIR_NAMES[dir]` pelado para todo lo que no fuese
skiff/fragata ⇒ **montado en caballo o alfombra el port decía «North» donde el original dice
«Ride North» / «Fly North»**. Y el esquife no emitía eco de rumbo en absoluto.

**Segundo hueco, encontrado al calcar**: el port emitía **«Head <rumbo>» para el ESQUIFE** al
virar (`navalMove`). El esquife no pasa por esa rama — la clase 0x28 despacha a 0x0152 («Row »);
«Head » es de 0x20/0x24 → 0x016A. El test `naval-live.test.ts` sellaba ese «Head South» y se ha
**ADJUDICADO CONTRA EL BINARIO** (no re-baselineado): ahora asierta «Row South» y la ausencia de
«Head South», con la cita en el comentario.

## 3. EL FIX

- `core/world/transport.ts`: **`faceVerb(tile)`** — la tabla de despacho de 0x00DA, pura, con la
  derivación y los offsets en el JSDoc. Devuelve `null` a pie y en fragata (su «Head » vive en su
  propia rama).
- `core/game.ts`: **`moveEcho(dir)`** compone `<verbo><rumbo>` por `tf()` con plantillas
  LITERALES (`"Ride {}"`, `"Fly {}"`, `"Row {}"`) — no concatenación, para que el compuesto sea
  corpus posicional que el manifest ve y que otro idioma puede reordenar. En `en` es
  byte-idéntico a la concatenación del binario, que es el contrato.
- El esquife emite su `walk-echo` «Row <rumbo>» en TODO pulsado (vire o no) y ya no duplica un
  «Head». La fragata queda **intacta**.
- `approved-strings.json`: las 3 plantillas con clase `[D]` y cita ASM + offset de DATA.OVL.

## 4. LA MEDICIÓN — y por qué el número es ~0

`tools/medir-verbo-transporte.ts`. **No es un re-run**: los transcripts de `.espejo-lp1/` son
salida SELLADA de un port que aún no imprimía el verbo, y este carril tiene prohibido playwright
y regenerar derivados. Se mide un **TECHO**: se inyecta en cada segmento la línea ideal que el
port arreglado emitiría y se vuelve a diffear — la hipótesis más generosa posible.

| verbo | divergentes | recuperados (TECHO) | |
|---|---|---|---|
| `fly` | 2 794 | **0** | 0.0% |
| `head` | 466 | 5 | 1.1% |
| `row` | 145 | **0** | 0.0% |
| **TOTAL** | **3 405** | **5** | **0.1%** |

Contaminación (bloques ajenos que casan por la inyección): 7.

**LA CAUSA, verificada carácter a carácter**: el comparador no puede casarlos ni con la línea
ideal delante, porque el colapso de `LP1_PROFILE` (identidad) no pliega la firma del OCR tardío:

```
"F]v Nvrth"  → fivnvrth      vs  port "Fly North"  → fiynorth
"Rvw Nvrth"  → rvwnvrth      vs  port "Row North"  → rownorth
"Hcad gouth" → hcadgouth     vs  port "Head South" → headsouth
```

**BRAZO DIAGNÓSTICO** (perfil con las clases del corpus tardío `v/y→u`, `g→s`, `c/6→o`; NO se
propone aterrizar, porque plegar glifos SUBE el numerador y exige pre-registración propia):
los mismos 3 405 divergentes → **994 recuperados (29.2%)**.

### 4.1 El delta POR CONTEXTO

| ctx del segmento | ecos con verbo divergentes | recuperados |
|---|---|---|
| `smallmap` | 2 149 | 1 (0.0%) |
| `overworld` | 595 | 3 (0.5%) |
| `shrine` | 262 | 1 (0.4%) |
| `start` | 215 | 0 |
| `combat` | 184 | 0 |

Cruce **verbo × contexto** (los racimos que importan): `fly × smallmap` **1 940** ·
`fly × overworld` 377 · `head × overworld` 188 · `fly × combat` 184 · `fly × start` 176 ·
`head × shrine` 127 · **`head × smallmap` 118** · `row × smallmap` 91 · `row × overworld` 30.

⚠ **CAVEAT DE INSTRUMENTO, y no es menor**: `ctx` es la etiqueta de ESCENA del segmento, **no el
estado de mapa por bloque**. Un segmento con `ctx:"smallmap"` y `seam:"enter"` contiene el
trayecto de llegada, que ocurre en el overworld. Así que este reparto es INDICATIVO, no
autoritativo.

**CRUCE DE VALIDACIÓN de la derivación contra el LP** — los 118 `head × smallmap` parecían
contradecirla (en pueblo el barco NO dice verbo). Los perseguí hasta el segmento: son **dos
segmentos, `part13-g02` (98) y `part12-g11` (20), los DOS con `seam:"enter"` y los dos con la
nota «Thou dost approach the tranquil Shrine…»** — es el LP navegando la fragata por el
overworld para llegar al santuario, dentro de un segmento etiquetado por su destino. **No hay
un solo «Head» del LP dentro de un pueblo**, así que el corpus es CONSISTENTE con la derivación
de que `town_transport_face` no imprime verbo para el barco.

⇒ **El fix es correcto y el espejo no puede verlo todavía.** La calibración del OCR del corpus
tardío (la tercera palanca de 3f §4.3) es **precondición de MEDICIÓN** para éste y para 3g: sin
ella, cualquier arreglo de la salida del port en part07-24 sigue contándose como divergente.

## 5. LO QUE NO SE TOCÓ (declarado, con cita)

0. **El SPRITE de caballo y alfombra sólo tiene DOS orientaciones.** Las dos rutinas asignan
   tiles fijos (caballo E→0x12 / O→0x13; alfombra E→0x14 / O→0x15) y **dejan el tile intacto al
   ir al norte o al sur**. El port no modela nada de esto: `faceTile` es
   `(tile & 0xFC) + turn_arg` para todas las clases y sólo lo usan los caminos navales, así que
   el caballo y la alfombra **nunca giran su sprite**. Es VISUAL/mecánica, no el verbo, y no
   afecta a `faceVerb` (que clasifica por `tile & 0xFC`). **Ticket abierto.**
1. **El esquife VIRA consumiendo el turno.** `shipFacingStep` le da `turned:true` y bloquea el
   paso; el binario manda 0x28 a 0x0152, que **siempre devuelve 0** ⇒ el esquife debería girar
   **y** avanzar en el mismo pulsado. Es MECÁNICA (cambia posiciones y podría propagarse a la
   cadena del tour), no presentación: fuera del encargo del verbo. **Ticket abierto.**
2. **La fragata ARRIADA no ecoa el rumbo pelado.** Con facing igual, `transport_face` cae en
   0x01DC→return 0 sin imprimir, y `outdoor_move` sí imprime el rumbo si `g_sail_dir == 0`; el
   port sólo emite «Rowing!». Depende de modelar cuándo `g_sail_dir` vale 0 en fragata arriada
   (lo pone a 0 `ship_try_move` al atracar/colisionar, 0x0306) — **sin derivar del todo**.
3. **El town homólogo TOWN 0x057F** (mismo despacho Ride/Fly/Row, llamado 4× por `town_move`
   0x065F/0x0710/0x0732/0x0754): el fix vive en el mover compartido, así que el eco sale también
   dentro de pueblo, pero **no se ha verificado el gate del interior por separado**.
