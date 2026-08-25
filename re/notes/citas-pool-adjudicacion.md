# Adjudicación de las 7 citas del pool (4 «SOSPECHOSAS» + 3 «a-mitad-de-stub»)

Cierra el punto 1 y parte del 2 de `citas-barrido-sistematico.md §4`. Encargo: adjudicar
cada cita contra el binario con el mecanismo entendido — ¿respalda EXACTAMENTE lo que
afirma el código?

**Titular: 6 de las 7 RESPALDAN; 1 NO (`0x7886`). Y ninguna de las 7 era lo que el
barrido creyó que era: no son direcciones de CS del residente ni stubs, son DESTINOS
CRUDOS de near-call — clase C de manual.** Los números estaban BIEN transcritos; lo que
estaba mal era la palabra «kernel» delante y, sobre todo, el clasificador que las fichó.

---

## 0. El defecto que fabricó las 7 — el umbral 0x81D0 no es un oráculo

`scan_code` clasificaba así:

```
addr >= 0x81D0  ->  C: destino CRUDO, exige la regla de banda
addr <  0x81D0  ->  A/E/S/B: se asume que ES un CS del residente
```

La premisa de la segunda línea es **falsa**. Un destino crudo es lo que imprime el
desensamblador de un overlay para un near-call, y vale **cualquier cosa en 0..0xFFFF** —
incluido el tramo por debajo de 0x81D0. Que un número caiga bajo el umbral no dice nada
sobre si es un CS; sólo dice que el umbral no puede descartarlo.

### La prueba está DENTRO del propio barrido

El mismo scan tenía, ya clasificadas y en clases opuestas, dos citas de **la misma rutina**:

| cita | dónde | clase que le tocó |
|---|---|---|
| `kernel 0x8bfe [= CS 0x2e8e → ULTIMA.EXE:0x2e8e]` | `game/e2e/shop.spec.ts:500` | **C**, «ya declarada» ✔ |
| `kernel 0x4cae` | `game/src/ui/pickers.ts:102` | **B**, SOSPECHOSA ✘ |

Las dos apuntan a `select_party_member_default` (CS 0x2e8e). Una desde la banda 0x8bfe,
otra desde la banda 0xe1e0. La única diferencia es que 0x8bfe ≥ 0x81D0 y 0x4cae < 0x81D0.
**Misma rutina, dos veredictos opuestos, y el que decide es el umbral.**

### Por qué el rescate automático no saltaba (causa raíz, en el código)

`resolve_unique()` sí existía para resolver un crudo sin saber el llamante — y no
rescataba a ninguna, porque se apoya en `callers_of()`, que buscaba **una sola forma del
literal**:

```python
lit = f"0xffff{raw:04x}"          # <- sólo la forma con wrap
```

El desensamblador imprime `call 0xffffXXXX` **sólo cuando la suma envuelve**; si no, lo
imprime PLANO (`call 0x7e02`). Todos los crudos por debajo del wrap se imprimen planos ⇒
`callers_of` devolvía `[]` ⇒ `resolve_unique` devolvía `sin-llamante` ⇒ imposible
reclasificar. El propio docstring de `RAW_RE` ya declaraba la regla correcta («o un
`call 0xNNNN` con destino fuera del propio fichero. **Ambas** son DESTINOS CRUDOS») —
estaba escrita y **no implementada**.

Esto es exactamente la patología del acta «cita equivocada > ninguna cita», un piso más
abajo: **instrumento equivocado > ningún instrumento**. El barrido no midió mal por poco;
midió con un detector que no podía ver esta familia entera, y el «0 llamadores» de las 4
sospechosas era del método, no del dato. (Mismo género que el hallazgo §0 del barrido:
sin los `.asm` devolvía ceros silenciosos. Aquí devolvía ceros silenciosos **con** los
`.asm` puestos.)

---

## 1. Las 7, adjudicadas

Cadena de derivación idéntica en todas: se leen del disasm los overlays que contienen el
literal `call 0xNNNN` → se aplica `CS = (near_call_base(overlay) + crudo) & 0xFFFF` →
**todos los llamadores caen en UNA sola banda** (resolución única) → el CS aterriza en una
entrada de rutina, corroborada por los BYTES (prólogo `55 8b ec`) y/o por el censo.

| # | crudo | dónde vive la cita | qué afirma | resuelve a | veredicto |
|---|---|---|---|---|---|
| 1 | `0x3ee8` | `src/skin/fiel/combat.ts:71` | delay del vuelo de proyectil | CS **0x20c8** `delay_via_timer` | **RESPALDA** |
| 2 | `0x4cae` | `src/ui/pickers.ts:102` (+4 sitios) | abre el select de roster | CS **0x2e8e** `select_party_member_default` | **RESPALDA** |
| 3 | `0x6dd8` | `src/skin/refugeScene.ts:12` (+2 en camp.ts) | `blit(tile,col,row)` | CS **0x1068** (3 args por pila) | **RESPALDA** |
| 4 | `0x7886` | `src/core/combat/combat.ts:408` | «repinta» los objetos de arena | CS **0x1b16** `flush_kbd_buffer` | **NO-RESPALDA** |
| 5 | `0x7b9c` | `cmd-strings.ts:105`, `main.ts`, +4 | getstring, máx 0xF | CS **0x3b1c** `input_string` | **RESPALDA** |
| 6 | `0x7e02` | `shoppe-greetings.ts` ×5, +2 | rand del stream vivo | CS **0x2092** `rand_range` | **RESPALDA** |
| 7 | `0x7f70` | `effects.ts`, `search.ts`, +6 | add con cap 0x63/99 | CS **0x3ef0** `add_byte_clamped_ceiling` | **RESPALDA** |

### 1.1 Las 6 que RESPALDAN — corroboración por call-site, no por el nombre

No basta con que el nombre de la rutina rime con la prosa. En las 6, el **sitio de
llamada concreto** confirma la afirmación:

- **`0x3ee8` → 0x20c8 `delay_via_timer`.** Único llamador: `COMSUBS.OVL:0x13d9`, con
  `push 1` / `push 0x28` justo antes. Y ese offset cae dentro de la rutina que el censo
  llama **`projectile_flight_anim` (COMSUBS 0x12de)**. La cita decía «delay del vuelo del
  proyectil»: el call está literalmente dentro de la animación de vuelo. ✔
- **`0x4cae` → 0x2e8e `select_party_member_default`** (censo `verified: true`). Llamadores
  `CAST2.OVL:0x00ab` y `SHOPPES3.OVL:0x030d`. `cmd-strings.ts:140` ya documentaba
  «`00ab  call kernel select (0x4cae) → idx o -1`» — **el offset del call coincide exacto**.
  Cuerpo (8 B): `sub ax,ax ; push ax ; call 0x2d7a ; ret` = envoltura de argumento por
  defecto. Ver §3 sobre por qué no tiene prólogo. ✔
- **`0x6dd8` → 0x1068.** Llamadores `OUTSUBS.OVL:0x06c2` y `:0x097e`, `BLCKTHRN.OVL` ×4,
  `COMBAT.OVL` ×1. `camp.ts:270` ya citaba «`0x097e 0x6dd8(5,5,[g_unk_adb9])`» — **el
  offset coincide exacto**. El cuerpo lee `[bp+4]`, `[bp+6]` y `[bp+8]`: tres argumentos,
  como el `blit(tile,col,row)` afirmado. ✔
- **`0x7b9c` → 0x3b1c `input_string`.** `CMDS.OVL:0x121e` y `:0x125e` hacen
  `lea ax,[bp-0x10] ; push ax ; mov ax,0xf ; push ax` — **el `máx 0xF` de la cita es un
  `push 0xf` literal**, no una interpretación. (`CMDS:0x1467`, la rama «what?», empuja
  `0x1e`; `TALK:0x02d2` empuja `0xe`. La cita del 0xF es correcta PARA SU SITIO.) ✔
- **`0x7e02` → 0x2092 `rand_range`.** 44 calls desde 7 overlays, **todos** banda 0xa290.
  Es la rutina que el propio barrido (§1.1) había fichado con **171 llamadores** y prólogo.
  Corroboración cruzada: `npc/manager.ts:460` ya cita `kernel 0x9ec2 [= CS 0x2092]` para
  «rand(0,255)» — misma rutina, otra banda, ya anotada. ✔
- **`0x7f70` → 0x3ef0 `add_byte_clamped_ceiling`** (censo `verified: true`).
  `SJOG.OVL:0x168b` empuja `&[0x57C0+code]`, `5`, `0x63` — que es EXACTAMENTE la firma que
  `commands.ts:597` ya escribía: `call 0x7f70(&[0x57C0+code], 5, 0x63)`. Y `SJOG:0x1536`
  empuja `0x57ae` (g_torches) y `0x63`, con el `mov ax,0x63 @0x1532` que cita
  `torch-object.test.ts:12`. Corroboración cruzada: `counters.ts:6` ya cita
  `kernel 0x9C60 [= CS 0x3ef0]` — misma rutina, otra banda, ya anotada. ✔

### 1.2 La que NO respalda — `0x7886` (`combat/combat.ts:408`)

Afirmaba: *«El original los escribe en el buffer 11×11 y `kernel 0x7886` los repinta»*.

Derivación: `0x7886` sólo lo llama `COMBAT.OVL`, en `0x0bac`, `0x0d05` y `0x0d1f` →
banda 0xa290 → **CS 0x1b16**, que el censo llama `flush_kbd_buffer`. Verificado por bytes,
no por el nombre:

```
1b16: 55 8b ec        push bp ; mov bp, sp
1b1c: e8 05 00        call 0x1b24
1b24: 1e              push ds
1b25: ba 40 00        mov dx, 0x40
1b28: 8e da           mov ds, dx
1b2a: c7 06 1a 00 1e 00   mov word ptr [0x1a], 0x1e
```

`0040:001A` es la **cabeza del buffer de teclado de la BIOS**; ponerla a 0x1E es vaciarlo.
No repinta nada. Y los 3 call-sites están en el bucle de turnos (junto a
`g_cmb_victory_flag` y `inc g_cmb_actor`), no en la rutina de botín: **`COMBAT:0x1574` no
llama a `0x7886` ni una vez**.

**La derivación correcta SÍ existe**, así que se corrige en vez de degradarse a lenguaje de
port. La rutina de botín, leída entera (0x16c0-0x1770):

- escribe el tile en la **tabla de objetos**, registros de 8 B en `DS:0x5C5A + 8*idx`
  (`0x16d4` sangre 0x1F, `0x1744` cofre 1), el rating en `+5 = DS:0x5C5F` (`0x174f`) y el
  bit de trampa `0x80` (`0x175e`) — lo que ya decía el comentario de al lado y **queda
  confirmado**;
- siembra el objeto con `0x16ef` → CS **0x6506** `kernel_spawn_actor`;
- y repinta con `0x16f2` `call 0xffffb680` → CS **0x5910** `viewport_redraw`.

O sea: el mecanismo que la cita describía existe y está una línea más allá; lo que fallaba
era el número. Se sustituye por la cadena `0x16f2 → CS 0x5910 viewport_redraw`, y se
matiza «buffer 11×11» → tabla de objetos con sus offsets exactos. Nótese que el repintado
es del **viewport entero**, no de los objetos uno a uno: la prosa vieja insinuaba un
repintado selectivo que el binario no hace.

---

## 2. Qué se ha tocado

**Instrumento** (`re/tools/verify_cites.py`) — 3 cambios, ninguno cosmético:

1. `callers_of()` busca **las dos formas** del literal (`call 0xffffXXXX` y `call 0xNNNN`),
   que es lo que el docstring de `RAW_RE` ya prometía. Causa raíz.
2. `resolve_unique()` deja de resolver por texto con la forma `0xffff` hard-codeada y pasa
   por `_landing()`, extraída de `kernel_refs_for` para que ambos caminos compartan UNA
   implementación (regla de banda + segundo salto de stub + nombre del censo).
3. `scan_code()` intenta la resolución de crudo **antes** de fichar en B o S, vía
   `_raw_landing_entry()`: prueba conjuntiva (resolución única **y** aterrizaje en entrada
   real). Además, caer en el rango del pool de stubs ya no basta para ser clase S: hay que
   caer en una **base** de stub, porque el pool es una rejilla estricta de 12 B (lo
   garantiza el `assert` de `dispatch_table.stubs()`) — y ninguna de las 3 «a-mitad-de-stub»
   caía en una base (offsets +6, +8 y +2). **Nunca fueron stubs.**

*No-regresión medida*, no supuesta: se corrió `resolve_all` con la versión de `main` y con
la parcheada sobre el mismo árbol; `frontier-manual.json` sale **byte-idéntico**.

**Citas**: 12 sitios anotados con la convención ya vigente (`kernel 0xNNNN [= CS 0xMMMM →
FILE:0xOOOO]`) + la corrección de `combat.ts:408`. **Cero valores de aserción tocados**:
todas las líneas añadidas y borradas en `game/` son comentario (verificado sobre el diff).

Efecto en el censo: **B 4 → 0** · **S 10 → 1** · C 27 → 39 (37 con la regla declarada).

---

## 3. Honestidad sobre esta adjudicación

- **Un corroborador tuvo que ampliarse, y podría haber tapado un fallo.** El test de
  «aterriza en entrada real» empezó siendo sólo el prólogo `55 8b ec`, y con él `0x4cae`
  seguía fichada: `select_party_member_default` son 8 bytes sin marco (`sub ax,ax; push
  ax; call; ret`), una envoltura de argumento por defecto. Se añadió como alternativa
  «inicio exacto de rutina del censo». Es un oráculo **más débil** que los bytes: el censo
  es nuestro, no del binario. Mitiga: esa entrada está `verified: true` y la misma rutina
  ya estaba citada y anotada desde otra banda (`shop.spec.ts:500`). Si alguien quiere
  tensar esto, el sitio es `_raw_landing_entry`.
- **`0x2092` no es entrada en `frontier.json`.** El censo lo mete dentro de
  `rng_seed_from_dos_clock` (0x2056 +60), fundiendo `srand`(0x207e) y `rand`(0x2092) en un
  bloque. Los bytes y los 171 llamadores dicen que 0x2092 es entrada propia. La cita se
  sostiene; **el que necesita un arreglo es el censo**, no la cita. No lo he tocado: es el
  pase de `verified` (ticket #23). Mismo caso, más leve, en `0x1068` (dentro de
  `resource_op_sel48` +116, con prólogo propio).
- **Dos citas quedan sin anotar A PROPÓSITO**, por el precedente que el propio barrido fijó
  en su §2: están dentro del **título** de un `it(...)`, que es la identidad del test y no
  prosa (`dialogue-effects.test.ts:20` con `0x7f70`, y la ya conocida `:174` con `0xbb56`).
  Anotarlas renombra el test. Quedan dichas aquí, que es donde toca.
- **`0x7d8e` es el único stub de verdad** de todo el corpus de código (→ `CMDS.OVL:0x17ec`,
  tabulado). El «3 stubs no tabulados» del barrido §4.2 **se disuelve**: no había tabla
  incompleta que completar, había 3 crudos mal clasificados. El punto 2 de §4 se cierra
  sin trabajo pendiente.
- **`frontier-manual.json` está desactualizado en `main`** (una entrada `kernel_refs` que
  `resolve_all` añadiría, en `NPC.OVL:0x0076`). Lo detecté al medir la no-regresión y lo
  he dejado **intacto**: no es de este carril. Queda apuntado.
- **Lo que esta adjudicación NO cierra**: las **119** citas «no alineadas» del barrido de
  NOTAS (`scan`). Ese barrido sigue usando `routine_starts` como criterio y por tanto sufre
  EL MISMO defecto que acabo de arreglar en `scan-code`; su 119 está inflado por la misma
  causa y ahora hay instrumento para desinflarlo. No lo he hecho aquí para no mezclar el
  barrido de notas con el de código (§4.3 del barrido pedía justo eso).
- Ninguna de las 7 necesitó el oráculo DOSBox: las 7 se adjudican con bytes y grafo de
  llamadas, offline. **Cero PENDIENTE-ORÁCULO.**
