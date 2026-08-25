# #64 — ADJUDICACIÓN: la captura de Blackthorn ES HORARIA (PROBADA por lectura)

> Carril `horaria-64`. Base main **`7f69b7cc`**. Pre-registro: `re/notes/horaria-64-prediccion.md`
> (commit `a8f86d58`, escrito ANTES de abrir el cuerpo de la pasada).
> Continúa y CIERRA `re/notes/tarjeta-64-estado.md` §4. Cero DOSBox: todo es lectura de ASM.

---

## 0. VEREDICTO

**La hipótesis de #64 queda PROBADA.** `[bp-0xc]` de la pasada `NPC.OVL 0x0db4,` **no es
una constante**: es el **valor de retorno de la rutina que convierte la HORA en índice de
ranura de horario**, y esa rutina recibe `g_hour` en TODOS sus llamadores sin excepción.

La cadena está cerrada de punta a punta y **sin ningún eslabón inferido**:

```
TOWN.OVL 1668,  mov al, byte ptr [g_hour]          ; DS 0x587f
TOWN.OVL 166b,  sub ah, ah
TOWN.OVL 166d,  push ax                            ; <- LA HORA, literal
TOWN.OVL 166e,  call 0xfffff8e2                    ; = stub 0x7ab2 -> NPC.OVL 0x0db4 (LA PASADA)
TOWN.OVL 1671,  cmp byte ptr [0x65bf], 0           ; y acto seguido LEE el slot armado

NPC.OVL  1277,  push bx                            ; bx = [bp-2] = npcIndex
NPC.OVL  1278,  push word ptr [bp + 4]             ; = la hora que entró por TOWN 0x166e
NPC.OVL  127b,  call 0x12e0                        ; EL SELECTOR DE RANURA
NPC.OVL  127e,  mov word ptr [bp - 0xc], ax        ; *** LA ÚNICA ESCRITURA DE [bp-0xc] ***

NPC.OVL  125e,  push word ptr [bp - 0xc]           ; -> callee [bp+4] = LA RANURA
NPC.OVL  1261,  call 0xd00
NPC.OVL  0d1f,  mov bx, word ptr [bp + 4]          ; la ranura
NPC.OVL  0d24,  mov al, byte ptr [bx + di]         ; di = 0x5d5e + npcIndex*16 -> aiTypes[RANURA]
NPC.OVL  0d28,  cmp ax, 7 / ja + jump-table        ; aiType 0 -> SALIDA, no arma
NPC.OVL  0d97,  call 0x6e4                         ; el ARMADOR (único llamador)
NPC.OVL  074e,  mov byte ptr [0x65bf], al          ; EL SLOT
```

**La verificación de `[bp-0xc]`:** censo exhaustivo de los 28 accesos a `[bp-0xc]` en
NPC.OVL entero. Dentro del cuerpo de la pasada (`0x0db4,`–`0x12dd,`) hay **13 lecturas y
UNA sola escritura, la de `0x127e,`**. Las otras cuatro escrituras (`0x0334,` `0x0479,`
`0x04ef,` `0x05ca,`) son de OTRAS rutinas, por debajo de `0x0db4,`, y no alcanzan este
marco. ⇒ **R1 del pre-registro (inmediato constante) queda REFUTADA por censo, no por
muestreo.**

---

## 1. LA RUTINA QUE FALTABA: `NPC.OVL 0x12e0,` = hora → ranura

Cuerpo entero, leído (`0x12e0,`–`0x1327,`, prólogo a `ret 4`):

```
12e0,  push bp / mov bp, sp / push si / push di / push ds
12e6,  lea si, [0x5d5e]                 ; base de la tabla de horarios .NPC
12ea,  mov ax, word ptr [bp + 6]        ; npcIndex
12ed,  mov cl, 4 / shl ax, cl           ; *16  (registro de 16 B por NPC)
12f1,  add si, ax
12f3,  add si, 0xc                      ; -> +0xc = times[4]
12f6,  mov ax, word ptr [bp + 4]        ; LA HORA
12f9,  mov ah, al                       ; replica el byte bajo: ax = hora:hora
12fb,  mov bx, ax                       ;                       bx = hora:hora
12fd,  sub al, byte ptr [si]            ; al = (hora - times[0]) & 0xff
12ff,  sub ah, byte ptr [si + 1]        ; ah = (hora - times[1]) & 0xff
1302,  sub bl, byte ptr [si + 2]        ; bl = (hora - times[2]) & 0xff
1305,  sub bh, byte ptr [si + 3]        ; bh = (hora - times[3]) & 0xff
1308,  xor dx, dx
130a,  cmp al, ah / jbe 0x1311 / mov al, ah / inc dx        ; dx = 1
1311,  cmp al, bl / jbe 0x131a / mov al, bl / mov dx, 2     ; dx = 2
131a,  cmp al, bh / jbe 0x1321 / mov dx, 1                  ; dx = 1  (¡no 3!)
1321,  mov ax, dx / pop ds / pop di / pop si / pop bp / ret 4
```

**Qué hace**: `argmin` sobre la resta de BYTE SIN SIGNO `(hora - times[k]) & 0xff`, es
decir **el periodo empezado más recientemente en aritmética circular**. Hay CUATRO tiempos
y sólo TRES posiciones: el periodo del 4º **remapea a la ranura 1** (`0x131e,` `mov dx, 1`
en vez de 3). Empates: gana el índice MENOR (`jbe` mantiene el actual).

**Layout del registro de 16 bytes en `0x5d5e`**, derivado de los consumidores (no supuesto):

| desplazamiento | campo | cita del consumidor |
|---|---|---|
| +0,1,2 | `aiTypes[3]` | `0x0703,` `mov al, byte ptr [bx + si + 0x5d5e]` (bx = ranura) |
| +3,4,5 | `x[3]` | `0x0d50,` `mov al, byte ptr [si + 3]` (si = base + ranura) |
| +6,7,8 | `y[3]` | `0x0d54,` `mov al, byte ptr [si + 6]` |
| +9,10,11 | `z[3]` (planta) | `0x1109,` `cmp byte ptr [bx + si + 0x5d67], al` (al = `g_floor`) |
| +12..15 | `times[4]` | `0x12f3,` `add si, 0xc` + `[si]`..`[si+3]` |

⇒ **P3 del pre-registro CONFIRMADA**: los `aiTypes` están en el desplazamiento 0, así que
«ARG = ranura» y «ARG = desplazamiento dentro del registro» coinciden numéricamente. La
lectura por ranura de `tarjeta-64-estado.md` §3 era correcta y ahora está apuntalada.

---

## 2. CENSO DE LLAMADORES — la hora entra por TODAS las puertas

`NPC.OVL 0x12e0,` está EXPORTADO al kernel (stub PLINK `0x7b36`), así que el censo
tiene que cruzar overlays. Hecho con `re/tools/dispatch_table.py`
(`near_calls_to_kernel` / `overlay_near_call_base`, base de NPC.OVL = `0xa290`), más un
barrido propio de `E8 rel16` sobre el kernel:

| llamador | qué empuja como hora | cómo |
|---|---|---|
| `TOWN.OVL 0x16d7,` | `g_hour` | `0x16d1,` `mov al, byte ptr [g_hour]` — LITERAL |
| `TALK.OVL 0x03f7,` | `g_hour` | `0x03f1,` `mov al, byte ptr [g_hour]` — LITERAL |
| `NPC.OVL 0x01f7,` | `g_hour` | `0x01f1,` `mov al, byte ptr [g_hour]` — LITERAL |
| `NPC.OVL 0x0112,` | `[bp+4]` del INIT `0x00d6,` | su llamador `TOWN.OVL 0x122b,` empuja `g_hour` en `0x1225,` |
| `NPC.OVL 0x097d,` | `[bp+4]` de `0x0938,` | la pasada se lo pasa en `0x1298,` (= su `[bp+4]`) |
| `NPC.OVL 0x10fa,` | `[bp+4]` de la pasada | = la hora de `TOWN 0x166e,` |
| `NPC.OVL 0x127b,` | `[bp+4]` de la pasada | **el que escribe `[bp-0xc]`** |

Y los llamadores de **la pasada** `0x0db4,` (stub `0x7ab2`): **exactamente dos**, ambos
empujando `g_hour` literal —

```
TOWN.OVL 1668,  mov al, byte ptr [g_hour] / push ax / 166e,  call ... (stub 0x7ab2)
CMDS.OVL 05b6,  mov al, byte ptr [g_hour] / push ax / 05bc,  call ... (stub 0x7ab2)
```

**Kernel: CERO llamadores** de ambos stubs (barrido de `E8 rel16` sobre los 0x86f0 B).
⇒ el censo es COMPLETO, no una muestra. **No existe ninguna vía por la que la ranura se
calcule sin la hora.**

---

## 3. LA SEGUNDA VÍA (`0x1243,`-`0x124c,`) — también horaria, pero CACHEADA

El aviso de la tarjeta era correcto y había que mirarlo aparte. Lo que empuja es
`[bx + 0xe]` con `bx = [bp-6]`, y `[bp-6]` se fija en `0x128b,` como
`0x5f5e + npcIndex*16` — o sea, **otra** estructura (el estado RUNTIME del NPC), no la
tabla de horarios. Su campo `+0xe` es la dirección absoluta DS `0x5f6c + npcIndex*16`.

**Censo de escritores de ese campo sobre los 28 overlays** (`0x5f6c` + los `[bx + 0xe]`
con base `[bp-6]` dentro de la pasada) — son TRES, y los tres escriben una ranura horaria:

```
NPC.OVL  0152,  mov word ptr [si + 0x5f6c], ax   ; ax = [bp-4], retorno de 0x12e0 con la hora  (rutina INIT 0x00d6,)
NPC.OVL  0ee6,  mov word ptr [bx + 0xe], ax      ; ax = [bp-0xc]  (la ranura FRESCA)
NPC.OVL  1089,  mov word ptr [bx + 0xe], ax      ; ax = [bp-0xc]  (idem)
TOWN.OVL 1705,  mov word ptr [di + 0x5f6c], ax   ; ax = retorno de 0x12e0 con g_hour   (desde TOWN 0x16d7,)
```

⇒ **P2 CONFIRMADA con matiz**: la segunda vía no empuja «otra cosa», empuja **la MISMA
magnitud** — una ranura salida del mismo selector, `0x12e0,`, a partir de `g_hour` — sólo
que **recordada de un tick anterior** en vez de recalculada. **R4 (naturalezas distintas ⇒
no fusionar) NO se activa**: las dos vías son horarias y el `if` de `armaElSlot()` sí se
puede levantar en bloque.

**Corroboración independiente del dominio**: la propia pasada compara `[bp-0xc]` contra
`1`, `2` y `0` y nada más (`0x121b,` `0x1221,` `0x122e,`) ⇒ su dominio observado es
`{0,1,2}`, que es el de una ranura, no el de una coordenada ni un puntero.
**⇒ R2 refutada.**

**Reparto de las dos vías** (por si alguien lo necesita después):
```
12a0,  je 0x124e   ; estado <= 1 Y 0x0938,(hora,npc) == 0  -> VÍA 1 (ranura FRESCA, 0x125e,)
112a,  jmp 0x120e  ; desde la maquinaria de movimiento     -> VÍA 2 (ranura GUARDADA, 0x1249,)
```
⚠ **Hallazgo lateral: `[bp-0xe]` calculado y TIRADO.** El tramo que va de `0x121b,` a `0x1240,`
calcula un «índice anterior» en `[bp-0xe]` (1/2→0, 0→2, si no `-1`) y **`0x1243,` no lo
usa**: los pushes son `[bp-2]` y `[bx+0xe]`, y `[bp-0xe]` se sobrescribe en la siguiente
vuelta sin leerse. Es código muerto del compilador. **No es un tercer camino** — que es lo
que podría parecerle a quien lo lea con prisa.

---

## 4. LA TABLA DE SALTO POR aiType (`0x0d30,`) — decodificada desde los BYTES

`0x0d30,` es `jmp word ptr cs:[bx - 0x4fd4]` con `bx = aiType*2`. El desplazamiento
`-0x4fd4` = CS `0xb02c`, que con la base de NPC.OVL (`0xa290`) cae en `0x0d9c,`
— justo el bloque que el listado desincroniza como basura (`3c b0 f0 af c8 af 06 b0 d0 af
21 b0 06 b0 21 b0`). Decodificado como 8 words:

| aiType | destino | qué hace |
|---|---|---|
| **0** | `0x0dac,` | **SALIDA inmediata — NO arma** |
| 1 | `0x0d60,` | `push 3` → `call 0xc50` (mover hacia el horario) |
| 2 | `0x0d38,` | `push 0` → `call 0xc50` (mover) |
| 3 | `0x0d76,` | dist(posición ACTUAL, party) < 4 → `0x0d91,` |
| **4** | `0x0d40,` | dist(**`x/y[RANURA]`**, party) < 4 → `0x0d91,`; si no, mover |
| 5 | `0x0d91,` | → armador DIRECTO |
| 6 | `0x0d76,` | dist(posición ACTUAL, party) < 4 → `0x0d91,` |
| 7 | `0x0d91,` | → armador DIRECTO |

⇒ **hay DOS gates de aiType en serie, no uno**: esta tabla (aiType 0 ni siquiera llega al
armador) y el `jle` de `0x072c,` DENTRO del armador. Y nótese que la rama del aiType 4 —la
de los guardias— mide la distancia contra **la posición programada de la ranura**
(`0x0d50,` `[si+3]` / `0x0d54,` `[si+6]`, con `si = base + RANURA`): otra dependencia de la
hora, esta en la geometría.

El ARMADOR `0x06e4,` (cuerpo entero leído, `0x06e4,`–`0x0756,`) exige después:
`0x0723,` `cmp ax, 1` (adyacencia manhattan EXACTA) · `0x0728,` `cmp [bp-2], 3` / `jle`
(aiType > 3) · `0x073d,`-`0x0744,` (aiType 4/5 exigen `[bx+0xa]` = dlgNum ≠ 0).
**Un solo llamador, `0x0d97,`** — re-verificado por barrido propio de `E8 rel16`, no
heredado de la tarjeta.

---

## 5. LA CONSECUENCIA, EN HORAS

Aplicando el selector derivado a `game/assets/npcs.json` clave `"18"` (los ocho guardias
del Palacio, todos `type` 112 = 0x70):

| npc | aiTypes | times | arma (aiType > 3) en las horas |
|---|---|---|---|
| 8, 9, 15 | `[0,4,0]` | `[21,5,11,13]` | 5–10, 13–20 (14/24 h) |
| 10, 11 | `[0,4,0]` | `[19,5,11,13]` | 5–10, 13–18 (12/24 h) |
| 12, 13 | `[0,4,4]` | `[21,5,11,13]` | 5–20 (16/24 h) |
| 14 | `[0,4,0]` | `[21,5,13,15]` | 5–12, 15–20 (14/24 h) |

**Los ocho comparten la ranura 0 con `aiType 0`.** ⇒ la predicción falsable de la mecánica:
**entre las 21:00 y las 04:59 NINGÚN guardia del Palacio arma el slot** — no hay captura
posible por adyacencia en esa franja (régimen PRE-arresto). Unión de horas con al menos un
guardia armado: **5–20**.

Régimen POST-arresto (`tarjeta-64-estado.md` §2.1): `aiTypes [7,7,7]`, `times [0,0,0,0]`.
Con los cuatro tiempos a 0 las cuatro restas son iguales, `jbe` se cumple siempre y el
selector devuelve **0 a cualquier hora** ⇒ aiType 7 ⇒ tabla → `0x0d91,` → armador →
`0x0728,` pasa (7 > 3) → `0x073a,` `jmp 0x7be` (el marcador 0x61, **sin** gate de diálogo).
**Incondicional a las 24 horas, derivado, no supuesto.** Los DOS REGÍMENES de §2.1 quedan
confirmados por lectura.

---

## 6. QUÉ SIGNIFICA PARA EL PORT (sin tocar código — decide el lead)

**El port ya tiene el selector, y es un calco byte-exacto.** `game/src/core/time.ts:67`
`scheduleIndex(times, hour)` es un calco de `0x12e0,` incluido el remapeo 3→1 y la resta de byte
sin signo; lo comprobé línea a línea contra el listado. No hay que escribirlo.

1. **`game/src/core/world/blackthorn.ts:159`** — `if ((g.type & 0xff) === PALACE_GUARD_TYPE)
   return true;`. **Es lo único que queda.** Su comentario (`:149`-`:155`) declara como
   pendiente exactamente lo que esta acta cierra, y nombra como riesgo abierto el
   `guard_wander` de TOWN `0x0c78,` — que `tarjeta-64-estado.md` §2.2 ya había cerrado por
   censo (TOWN sólo LEE `[0x65bf]`; re-verificado aquí: los únicos escritores en los 28
   overlays son `NPC.OVL 0x074e,` y `0x0dc6,`). Quitado el `if`, `armaElSlot()` cae en el
   camino general de `:160`-`:163`, que ya es fiel.

2. **⚠ CORRECCIÓN A `tarjeta-64-estado.md` §6.3 — el ARRASTRE del tributo NO existe.**
   `game/src/core/world/guard-encounters.ts:234` **ya aplica el gate horario**:
   `npc.aiTypes?.[scheduleIndex(npc.times ?? [0,0,0,0], ctx.state.time.hour)] ?? 0` seguido
   de `:235` `if (ai <= 3) continue;`, **sin** atajo por `PALACE_GUARD_TYPE`. O sea: el
   tributo lleva la mecánica horaria puesta y la captura no. Quitar el `if` **no introduce
   una mecánica nueva: elimina una asimetría entre dos capas que calcan la misma rutina.**
   Eso baja el riesgo declarado en la tarjeta, no lo sube.

3. **⚠ DISCREPANCIA DE DEFECTO, y ahora es load-bearing.** Un NPC sin `aiTypes` se resuelve
   distinto en cada capa: `guard-encounters.ts:234` usa `?? 0` (**no arma**);
   `blackthorn-capture.ts:164` lo deja `undefined` para que `armaElSlot` aplique `?? 4`
   (**arma**). El comentario de `blackthorn-capture.ts:159`-`163` afirma que «el defecto
   tiene que ser el MISMO en las dos capas» — **y hoy no lo es**. Mientras el `if` de `:159`
   esté puesto da igual para los guardias; en cuanto se quite, el defecto pasa a decidir por
   ellos. Los ocho guardias REALES sí traen `aiTypes`+`times` (`npcs.json` "18" → `manager.ts:192`),
   así que el defecto sólo muerde a actores sintéticos — es decir, **a los fixtures**.

4. **`game/tests/password-live.test.ts:128`-`139`** — `guardSlot()` declara
   `aiTypes: [0,0,0]` con `times: [0,0,0,0]`. Con esos datos `scheduleIndex` da 0 a
   cualquier hora ⇒ aiType 0 ⇒ **no arma** ⇒ el fixture se pone rojo en cuanto se quite el
   `if`. Dos arreglos legítimos, y **la elección no es cosmética**:
   - `aiTypes: [4,4,4]` — guardia armado a las 24 h. Conserva el asunto del test (el reto de
     password), que no es el horario.
   - `aiTypes: [0,4,0]` + `times: [21,5,11,13]` (el dato real) + fijar la hora del test en
     5–10 o 13–20. Más fiel, pero mete el horario como precondición de un test que no lo
     estudia.

5. **Frente residual, NO bloqueante** (nombrado para que no se descubra como sorpresa): el
   binario tiene DOS vías con ranura **fresca** y **recordada** (§3), y el port siempre
   calcula la fresca. La recordada puede ir un tick retrasada respecto a `g_hour` si el NPC
   no ha pasado por `0x0ee6,`/`0x1089,` desde que cambió la hora. Es una diferencia de
   fidelidad **de un tick en la frontera de hora**, no de mecánica, y ninguna de las dos
   vías deja de ser horaria. Sale barato dejarlo así; si alguna vez hay ventana e2e en el
   filo de la hora, este es el sospechoso.

**Esta acta NO toca código.** El failing-first con careo (quitar el `if`, ver los 22 rojos
de #59 moverse, arreglar el fixture) es la siguiente tarjeta y la decide el lead.

---

## 7. Rendición del pre-registro (`horaria-64-prediccion.md`)

| | resultado |
|---|---|
| **P1** — `[bp-0xc]` es índice de ranura derivado de la hora | **ACERTADA**, por la rama (a): la hora llega ya calculada desde `TOWN.OVL 0x1668,` como argumento de la pasada. Por eso `g_hour` no aparecía en el tramo. |
| **P2** — la 2ª vía empuja lo mismo | **ACERTADA con matiz**: misma magnitud, pero cacheada de un tick anterior (§3). |
| **P3** — `aiTypes` en el desplazamiento 0 | **ACERTADA** (§1, tabla de layout). |
| **R1** — escritura inmediata ⇒ FALSA | no se activa: censo exhaustivo, la única escritura es `0x127e,` (retorno del selector). |
| **R2** — otra cosa del bucle | no se activa: dominio observado `{0,1,2}` (§3). |
| **R3** — cadena abierta ⇒ no adjudicar | no se activa: cadena cerrada con `g_hour` literal y censo de llamadores COMPLETO, kernel incluido. |
| **R4** — vías de naturaleza distinta ⇒ no fusionar | no se activa: las dos son horarias (§3). |

Lo que **NO** predije y salió: los dos gates de aiType en serie (§4), que la rama del
aiType 4 mide la distancia contra la posición programada de la ranura, que el port ya
tenía `scheduleIndex` byte-exacto, y sobre todo **que el arrastre del tributo no existe
porque el tributo ya era horario** (§6.2) — que invierte el signo del riesgo de la tarjeta.

---

## 8. EL FIX, APLICADO (adenda posterior al aterrizaje de la adjudicación)

La adjudicación se aterrizó y el lead dio los tres rulings que §6 dejaba abiertos. Lo
aplicado, con lo que se midió al aplicarlo:

1. **`blackthorn.ts` — fuera el atajo del guardia.** `armaElSlot()` ya no devuelve `true`
   por ser `type` 0x70: el gate corre para todos, como en el binario.
2. **Defecto armonizado a `?? 0` en las dos capas.** `armaElSlot` pasa de `?? 4` a `?? 0` y
   `blackthorn-capture.ts` resuelve a 0 en vez de dejar `undefined`. El `undefined` no
   existe en el binario; la asimetría entre capas ERA el defecto, y el comentario que
   afirmaba simetría se corrigió para prometer lo que hace.
3. **Fixtures**: `password-live.test.ts` a `aiTypes [4,4,4]`, y los tres guardias sintéticos
   de `capture-live.test.ts` con `aiTypes [4,4,4]` + `times [0,0,0,0]`. Criterio del ruling:
   conservar el ASUNTO de cada suite sin convertir el horario en precondición de tests que
   no lo estudian. El horario tiene tests propios (punto 5).

### ⚠ 8.1 LA COLISIÓN QUE LOS DOS PRIMEROS RULINGS PRODUCEN JUNTOS

Por separado son inocuos; **juntos reintroducen exactamente el fallo que el comentario de
#59 documentaba**. Quitar el atajo hace que el guardia vuelva a pasar por el gate; el
defecto `?? 0` hace que un guardia SIN horario declarado no arme; y los guardias sintéticos
de `capture-live` no traían horario ⇒ la captura se apagaba y salían **20 rojos** (18 de
`capture-live`, que es el número exacto que citaba #59, más 2 de `blackthorn.test.ts` y 4 de
`password-live`; 20 tras deduplicar por test). Medido antes de tocar los fixtures, no
predicho: baseline 53/53 verde → 20 rojos → 58/58 verde tras declarar los horarios.

**La lección, que es de método:** el comentario de #59 no describía una manía del fixture,
describía un ACOPLAMIENTO entre el defecto de `aiType` y la conducta de los actores
sintéticos. Un ruling que toca el defecto mueve todos los fixtures que se apoyaban en él, y
la lista de esos fixtures no está en el ruling — está en el comentario que el ruling deroga.

### 8.2 Tests del horario (failing-first, verificados en rojo antes del fix)

En `capture-live.test.ts`, con el horario REAL de los guardias 8/9/15
(`aiTypes [0,4,0]`, `times [21,5,11,13]`) y el post-arresto (`[7,7,7]`, `times [0,0,0,0]`):

- las 24 horas siguen la ranura (comparadas contra la REGLA `aiTypes[ranura] > 3`, no
  contra una lista copiada a mano);
- **cero capturas de 21:00 a 04:59** y captura en 5-10 y 13-20, como listas LITERALES —
  independientes de `scheduleIndex`, para que un fallo del selector no se autoabsuelva;
- **control del MEDIODÍA**: 11 y 12 son de día y NO capturan (ranura 2 = aiType 0). Sin él,
  la suite pasaría con una implementación que sólo mirase si es de noche;
- post-arresto: captura a las 24 horas.

Tres de los cinco fallaron antes del fix con aserto real (`expected true to be false`), no
por error de importación. Los otros dos (captura de día, post-arresto) pasaban ya: son la
guarda contra un fix que apagase la captura entera, que es el modo de fallo de 8.1.

### 8.3 El careo de paridad NO se tocó, y la razón importa

`re/tools/test_blackthorn_parity.py` sigue en **48/48 sin cambios**. No es que su modelo
acertase: es que **no modela esta capa**. Su caso `trigger` llama a
`blackthornCaptureTriggers` (sólo el gate `TOWN 0x12ae,`: location + party consciente) y su
caso `guard` llama a `guardDemand` directo — ninguno pasa por `palaceGuardAdjacent` ni por
`armaElSlot`. ⇒ el careo **no asumía captura incondicional**; el armado del slot le es
invisible. Queda como frente NOMBRADO: si se quiere paridad del armado, hace falta un
`kind` nuevo con el selector modelado en Python, y hoy no existe.
