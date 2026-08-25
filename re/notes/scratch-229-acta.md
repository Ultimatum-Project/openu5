# Acta #229 — `g_cmb_scratch_x/y`: la convención LA FIJA EL PRODUCTOR

Carril `re/scratch-229` (worktree `.claude/worktrees/scratch-229`), rama desde `main`
@`211b4e7d`. Cabo (b) de #149.

**Direcciones:** `g_cmb_scratch_x` = **DS 0x5876**, `g_cmb_scratch_y` = **DS 0x5878**, 2 B cada
una (del catálogo `re/ledger/globals.json`, no supuestas).

---

## 1. La tesis de la tarjeta era CORRECTA pero CORTA

La tarjeta decía «DOS convenciones (DELTA en SJOG, ABSOLUTO en el blink de CAST)». Leídos
los cuerpos: **no son dos convenciones de una ranura, es una ranura de PROPÓSITO GENERAL con
≥3 ROLES, y dentro del rol de dirección hay TRES formas, una de ellas DELEGADA al caller.**

La pregunta «¿cuál es la convención fiel?» sigue mal planteada, como decía la tarjeta — pero
por una razón más fuerte: **la ranura no tiene convención propia en absoluto.** La fija quien
escribe. Cualquier prosa que diga «g_cmb_scratch es el delta» o «es la celda» está afirmando
sin derivar hasta que nombre el PRODUCTOR de ese flujo.

Y la atribución de la tarjeta a «SJOG» era la pieza menos exacta: SJOG.OVL 0x002A es
justamente el productor que **no decide** — recibe la base por argumentos.

---

## 2. Censo — método y cota

**Instrumento: por DESENSAMBLADO, no por texto.** `routine_census.disasm_file` sobre los 30
ficheros de código, filtrando `abs_refs ∩ {0x5876, 0x5878}`. Motivo: un `git grep` del símbolo
pierde los sitios escritos en hex crudo y viceversa (regla `censo-global-hex-y-simbolo`), y
trabajar sobre bytes es inmune a las dos notaciones.

**Control del punto ciego de segmento** (familia #188/#198): se registró el prefijo de
segmento de cada acceso. **Resultado: `Counter()` — CERO accesos con prefijo `es:`/`cs:`/etc.**
Los 410 son DS. El punto ciego se midió, no se supuso ausente.

| | n |
|---|---:|
| accesos totales a 0x5876/0x5878 | **410** |
| lecturas | 312 |
| escrituras | 96 |
| `imul` (lee-y-escribe AX, clasificado aparte) | 2 |

Reparto por fichero: LOOKOBJ 141 · CAST 51 · NPC 41 · COMBAT 39 · CMDS 24 · COMSUBS 27 ·
SJOG 28 · CAST2 19 · ULTIMA.EXE 15 · MAINOUT 12 · BLCKTHRN 10 · TOWN 7 · TALK 4 · DNGLOOK 2.

---

## 3. Los SEIS productores del rol de dirección, leídos por CUERPO

| productor | base que siembra | convención |
|---|---|---|
| ULTIMA.EXE 0x35EC | **literal 0** (0x35f2/0x35f8) + inc/dec | **DELTA** |
| BLCKTHRN.OVL 0x002E `dir_to_delta` | **literal 0** (`sub ax,ax` @0x005b) + inc/dec | **DELTA** |
| CAST2.OVL 0x0306 | **celda del ACTOR** + inc/dec | **ABSOLUTO** |
| CMDS.OVL 0x0352 | **+6/+7 del record** + inc/dec por `rand(0,3)` | **ABSOLUTO** |
| SJOG.OVL 0x002A | **los ARGS del caller** (`ret 6`) + inc/dec | **DELEGADA** |
| NPC.OVL 0x0632 | **ninguna** — muta lo que haya (`ret 2`) | **ABSOLUTO presupuesto** |

### 3.1 Los dos DELTA — base literal cero, sin ambigüedad posible

ULTIMA.EXE 0x35EC es el getdir interactivo: pone las dos a 0, lee tecla (`call 0x266c`),
imprime el nombre del rumbo (DS 0xa2a0/0xa2a6/0xa2ae/0xa2b6/0xa2bc), aplica un solo
`inc`/`dec` y devuelve 1; con 0x1B/0x20 (ESC/Espacio) devuelve 0 sin tocar el par.
BLCKTHRN.OVL 0x002E es la conversión pura keycode→delta, sin teclado: `and ax,3` sobre el
arg y las mismas cuatro ramas. **Su nombre en el ledger, `dir_to_delta`, queda confirmado por
el cuerpo** (antes era nombre-por-uso).

### 3.2 CAST2.OVL 0x0306 — ABSOLUTO, y con un matiz que `blink.ts` NO dice

```
030e: cmp [g_location],0x7f / jbe 0x32e
  > 0x7f (arena/mazmorra): si = [g_cmb_actor]<<3 ; base = [si-0x45e6] / [si-0x45e5]
  <= 0x7f (exterior):      base = [g_party_x] / [g_party_y]
033e: push 0x9504 ("Direction-") ; 0347: call 0x448c (tecla) ; luego inc/dec
```

⇒ siembra **la celda de la ENTIDAD QUE ACTÚA** y luego la desplaza ⇒ absoluto.
`blink.ts:25` («el getdir dejó party ± 1 en un eje») es **CORRECTO**, y ahora lo está **por
cuerpo del productor** y no sólo por su consumidor — que es lo que #149 dejó pendiente.
★ MATIZ NUEVO: la base es `g_party` **sólo en el exterior**; en arena es la celda de
`g_cmb_actor`. Para blink no cambia nada (`blink.ts:15` ya acota el flujo al exterior), pero
quien reutilice CAST2.OVL 0x0306 para otro flujo NO puede leer «party ± 1» como universal.

### 3.3 SJOG.OVL 0x002A — la que **delega**, y por eso la tarjeta la citó mal

```
002a: push bp / mov bp,sp
002d: ax=[bp+6] → 0030: [g_cmb_scratch_x]=ax     ← base X: ARG del caller
0033: ax=[bp+4] → 0036: [g_cmb_scratch_y]=ax     ← base Y: ARG del caller
0039: ax=[bp+8] → cuatro ramas inc/dec           ← dirección
0069: ret 6
```

Si el caller pasa (0,0) el resultado es un DELTA; si pasa la celda del party, un ABSOLUTO.
**La convención de esta rutina no existe: es un parámetro.** Aquí es donde «DELTA en SJOG»
se rompe como enunciado — lo que hay en SJOG es una rutina neutral, igual que
`find_object_at_xy` lo era en #149. **Mismo patrón de género, segunda instancia: la rutina es
neutral y el sentido lo pone el call-site.**

### 3.4 🔴 NPC.OVL 0x0632 — los CUATRO clamps prueban el eje EQUIVOCADO

Mutador de cursor por rumbo (`ret 2`), con clamp al rango 0..0x20. Y en las cuatro ramas el
clamp **testea el eje que NO acaba de mover**:

| rama | modifica | testea | clampa |
|---|---|---|---|
| 0x064E | `inc X` | `cmp [Y],0x20` | `X=0x20` |
| 0x0662 | `dec Y` | `cmp [X],0` | `Y=0` |
| 0x0676 | `dec X` | `cmp [Y],0` | `X=0` |
| 0x068A | `inc Y` | `cmp [X],0x20` | `Y=0x20` |

Cuatro de cuatro. No es un desliz aislado: es la transposición sistemática de la familia #70,
**pero DENTRO DEL BINARIO**, no en el port. Consecuencia observable: el cursor puede salirse
por un eje mientras el otro está dentro, y ser recortado cuando el otro se sale.

⚠ **NO lo toco y NO lo llamo bug de cara al port.** Un port fiel tendría que REPRODUCIRLO, y
antes de eso hay que saber (i) quién llama a 0x0632, (ii) si el rango 0..0x20 es alcanzable en
juego real, y (iii) si el port modela ese cursor. Alcanzabilidad primero, como en #231. Cabo →
tarjeta propuesta (a).

---

## 4. Consumidores: careo productor→consumidor

**★ CAVEAT DE INSTRUMENTO, medido y corregido a mitad de camino.** Mi primer criterio fue
«consumidor que SUMA la ranura ⇒ supone DELTA». **Es falso**, y lo descubrí leyendo en vez de
confiar: CAST.OVL 0x1E29 hace `add bx, [0x5876]` **con `bx = [0x5878]<<5`** — es la fórmula de
índice `tile_addr = (y<<5)+x` combinando las DOS mitades de un par ABSOLUTO, con cota
`-1 < x,y < 0xb` (la arena 11×11). Sumar la ranura no dice nada; **el discriminador es el OTRO
sumando** (`g_party_x` ⇒ supone delta · `y<<5` ⇒ absoluto). Re-clasifiqué con ese criterio.

| clase | n | sitios |
|---|---:|---|
| SUPONE DELTA (suma `g_party_x/y` 0x5896/0x5897) | **20** | CMDS 0x1C61/0x1C6D · LOOKOBJ 0x09B1/0x09BD · MAINOUT 0x073E/0x074A · SJOG 0x098D/0x0999, 0x0D87/0x0D93, 0x13AE/0x13BA, 0x1E28/0x1E34 · TOWN 0x0A33/0x0A3F, 0x0BEF/0x0BF9 |
| ABSOLUTO (índice `(y<<5)+x` de arena) | **2** | CAST 0x1E29, 0x1E5C |
| SUPONE DELTA sobre celda de ACTOR (adenda §9) | **4** | COMBAT 0x0FDE, 0x100C, 0x1073, 0x107B |

**Veredicto del careo (b): CERO pares cruzados — 26/26 clasificadas (las 4 de COMBAT, en la adenda §9).** Y la razón por la
que el binario puede vivir con la ambigüedad es **SEGREGACIÓN POR OVERLAY**: el rol DELTA vive
en los overlays de comando de exterior/pueblo (CMDS, SJOG, TOWN, MAINOUT, LOOKOBJ), alimentado
por el getdir del kernel; el rol ABSOLUTO vive en CAST/CAST2 en coordenadas de arena. Es la
hipótesis que la tarjeta pedía comprobar ANTES de arreglar nada, y sale confirmada en la
población leída.

⚠ **Lo que esto NO es:** una prueba de imposibilidad. La segregación está medida por
POBLACIÓN (quién suma qué), no por ALCANZABILIDAD del grafo de llamadas. Que ningún flujo
CAST2-sembrado llegue a un consumidor DELTA de CMDS **no está demostrado**, sólo es coherente
con la partición por overlay. Declararlo cerrado sería el error de «cota superior promovida a
mecanismo».

---

## 5. El PORT (punto 4 del encargo): inmune por CONSTRUCCIÓN

`git grep cmb_scratch -- game/src` da **18 aciertos y TODOS son PROSA** (comentarios y
docblocks). **No existe ninguna variable de estado compartida** que espeje la ranura: cada
flujo usa sus propios locales (p. ej. `blink.ts:95-96` `let sx = px + dx`). ⇒ el port **no
puede heredar la ambigüedad**: no hay ranura que reutilizar.

Corolario que importa para el goal: **el riesgo de esta familia en el port es 100% PROSA**, o
sea exactamente el género de #149. No hay mecánica que arreglar aquí.

Careo de la prosa viva: `blink.ts:25` y `:27` **CORRECTOS** (y ahora derivados por cuerpo);
`blink.ts:95-96` empareja `px + dx` con «si = g_cmb_scratch_x», que es coherente porque en ese
flujo el productor sembró party y desplazó — el propio `:25` lo explica. **Sin defecto.**
`game.ts:4883` dice «el binario compara el DELTA de la dirección elegida (`g_cmb_scratch_x/y`»
en el flujo de platos (SJOG 0x18CE): consistente con la clase DELTA de SJOG 0x13AE/0x13BA.

---

## 6. Entregado en el ledger

`re/ledger/globals.json`: ampliado el campo `meaning` de las **dos** entradas con la taxonomía
de roles y los productores citados. **Edición QUIRÚRGICA por sustitución de cadena, sin
`json.load`/`dump`** (un round-trip impondría mi formato al fichero entero). Verificado:
`git diff --numstat` = **2 líneas tocadas, 2 sustituidas**, y el JSON parsea con sus 193
globales intactas.

---

## 7. Declarado y NO cerrado

1. ~~Los 4 consumidores de COMBAT sin leer~~ — **CERRADO en la adenda §9**: leídos, los cuatro
   son DELTA, careo al **26/26**.
2. **NPC.OVL 0x0632, clamps transpuestos** (§3.4) — cabo con tarjeta propuesta; alcanzabilidad
   y callers antes de cualquier decisión de paridad.
3. **Alcanzabilidad del cruce** (§4) — medida por población, no por grafo de llamadas.
4. **Los otros ROLES de la ranura**, censados pero no derivados uno a uno: out-param de índice
   de slot (ULTIMA.EXE 0x36D8, ya derivado en #149), contadores de vivos (SJOG 0x1B76, según el
   ledger), y los ~30 escritores de COMBAT/COMSUBS/LOOKOBJ/NPC del rol «celda de salida». El
   censo de 410 los localiza; este acta no los adjudica.
5. `imul word ptr [0x5876]`/`[0x5878]` (COMBAT 0x0EBB/0x0EC5) quedan como lee-y-escribe-AX;
   no los clasifiqué como escritura de la ranura.

---

## 8. Alcance

Sólo DOCUMENTACIÓN: 1 acta nueva + 2 campos `meaning` del ledger. **Cero código, cero prosa de
`game/src` (no hacía falta: no hay defecto), cero mecánica, cero tests, no `main.ts`, no se
regeneró `routine-census.json`.**

---

## 9. ADENDA — los 4 de COMBAT, leídos: careo al 26/26

Encargo del lead: cerrar el residuo antes de retirar. Leídos los cuatro, **los cuatro son
DELTA** ⇒ **CERO pares cruzados en 26/26** y el careo (b) queda completo.

Los cuatro viven en la MISMA rutina, `COMBAT.OVL 0x0EE4` (prólogo verificado con
`raw_bytes`+`PROLOGUE` para los cuatro offsets):

```
0fd6: bx=[bp-2] ; 0fd9: al=[bx+6]            ← X del ACTOR (record +6)
0fde: add ax,[g_cmb_scratch_x] / push        ← celda base + DELTA
0fe9: push [bp+4] / 0fec: call 0xffffdc12    ← test de la celda destino
0ff3: mov [g_cmb_scratch_y],0                ← si falla, ANULA el otro eje
1000-1014: la simétrica en Y (1009: al=[bx+7] ; 100c: add ax,[g_cmb_scratch_y])
101b: mov [g_cmb_scratch_x],0
1070: ax=[bp-0xc] / 1073: add ax,[x]  ·  1078: ax=[bp-0xa] / 107b: add ax,[y]
```

★ **Es productor Y consumidor del MISMO delta, en la misma rutina.** La banda escribe la
ranura **sólo con literales `0xFFFF`, `0` y `1`** (0x0FF3, 0x101B, 0x1064, 0x106A, 0x1096,
0x109C, 0x10A4, 0x10AC) = **{−1, 0, +1}**, que es la prueba directa de que ahí la ranura es un
vector de paso. La hermana `COMBAT.OVL 0x0D30` hace lo mismo (0x0E7C/0x0E8C/0x0E9C/0x0EAC con
±1, y `imul` por la ranura en 0x0EBB/0x0EC5). ⇒ **SÉPTIMO productor** del rol de dirección, y
segundo DELTA no-getdir.

Y el patrón de las anulaciones es legible: si `(base + delta)` no pasa el test de celda, se
pone a **cero el OTRO eje** y se reintenta — el «deslizarse por la pared» del movimiento
diagonal.

### 9.1 Corrección al criterio de §4 (mi clasificador, otra vez corto)

§4 define la clase como «suma **`g_party_x/y`** ⇒ supone DELTA». **Estos cuatro suman la celda
de un ACTOR** (`[bx+6]`/`[bx+7]` del record, o locales `[bp-0xc]`/`[bp-0xa]`), no la party. El
enunciado correcto es **«suma una CELDA BASE — party O actor — ⇒ supone DELTA»**; el
discriminador sigue siendo el OTRO sumando, pero su dominio es más ancho de lo que escribí.

**Lo que SÍ funcionó:** el clasificador automático **no los adivinó** — los marcó `??? leer` y
por eso llegaron a esta adenda en vez de colarse con una etiqueta inventada. Un instrumento que
declara su ignorancia en vez de rellenarla es la diferencia entre un residuo y un falso verde.

### 9.2 Lo que esto NO cambia

La reserva de §4 sigue **intacta**: la ausencia de cruce está medida por POBLACIÓN (26 de 26
consumidores leídos y clasificados), **no por alcanzabilidad del grafo de llamadas**. 26/26 es
cobertura del censo, no prueba de imposibilidad.
