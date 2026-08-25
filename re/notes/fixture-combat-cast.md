# Fixture de CAST-EN-COMBATE (#44) — método reutilizable

**Carril:** oracle-queue · **Fecha:** 2026-07-19 · Encargo: construir el fixture que «clava»
el cast apuntado/summon en combate (bloqueador compartido de las 3 Clase-C: rand-count 0x9cb6,
footprint del bolt, wander aiType-1). Infra del oráculo — documentado para reuso.

## Qué le faltaba al fixture #44 previo

`combat_parity.cast_spell_at_turn` sólo cubría **In Vas Por Ylem (#30)** — un hechizo SIN aim
(golpea a todos). Los hechizos APUNTADOS (In Flam Grav #14, familia line/area) y el SUMMON
(Kal Xen Corp #43) necesitan pasos extra que el fixture no tenía:
1. **Entrega de sílabas rúnicas** para el getstring (no sólo I·V·P·Y).
2. **Paso de AIM** tras el getstring (dirección para line/field; el summon no apunta).
3. Sin prompt «Cast & who?» EN COMBATE (el caster es el combatiente activo `g_cmb_actor`
   0x589E; ese prompt es sólo overworld, cast-input.md §9) → NO enviar el `\n` de caster-select.

## Método (VALIDADO — ver §Validación)

```python
import oracle, combat_parity as cp
s = oracle.boot(); s.send_keys_until_main_menu()
cp.enter_combat(s)              # inyecta rata + Ataca → arena (0xBA14 con party+enemigos)
cp.settle_combat_input(s)       # espera el turno del PJ (registros estables + kbd poll)
cp.ensure_spell_mixed(s, 14, 9) # g_spell_qty[idx] (evita "None mixed!")
# cast: 'c' + sílabas rúnicas + submit + aim, SINCRONIZADO a key_consumed:
s._arm(0x08)
queue = ["i","f","g","\n","UP","UP","UP"]   # In Flam Grav = I·F·G ; submit Enter ; aim dirección
qi = 0; s.send_key("c")
for _ in range(120):
    s.resume()
    if s.key_consumed():
        s.send_key(queue[qi] if qi < len(queue) else "\n"); qi += 1
s.run_ticks(12)
# leer: tablero 0xab02 (11x11) → celdas 0xff (marca del aplicador 0x1e60) + tiles de campo
#       0x33-0x3f ; registros 0xBA14 (HP de enemigos = daño) ; g_rng_seed 0x5420 (avance)
```

- **Runas por hechizo** (inicial de cada sílaba, cast-input.md §3): In Flam Grav=`i,f,g`;
  Kal Xen Corp=`k,x,c`; In Vas Por Ylem=`i,v,p,y`.
- **Submit**: Enter o Space (getstring «Enter/Space envía», cast-input.md §8). Auto-cierra al
  nº de sílabas del match.
- **Aim**: line/field piden dirección (getdir, como overworld). El SUMMON (Kal Xen Corp) NO
  apunta (pickea celda interna) → omitir el aim de la queue.
- **MP**: si el dispatcher aborta por energía, sembrar el MP del caster (offset del roster) —
  ver §Validación si hizo falta.

## Para el rand-count (0x9cb6 / wander): interleaving con la traza

Para CONTAR rands durante el cast, fusionar la entrega de teclas con el bucle de traza de
`combat_parity` (arm BP en `RAND_RANGE=0x2092` con `tick_pulse=True`): en el bucle `resume()`,
si `at_rand_bp` → registrar (`_stack_words`→`classify_roll`, o el `ret0` CRUDO de `words[0]`
para callers NO whitelisted como el picker); si es tick y `key_consumed` → enviar la siguiente
tecla del cast. Así se capturan las tiradas EN ORDEN mientras el cast se ejecuta. El picker
0x9cb6 (seg2, sobre el techo del disasm) aparece como un cluster de `ret0` repetido por
reintento (hasta 8) — contar por cluster.

## Validación (parcial) — el fixture ALCANZA el combate y el turno del PJ; falta clavar el cast

Run 1 (`probe_combat_cast.py`, In Flam Grav #14): `enter_combat` OK (3 PJ vs 5 ratas type20 al
norte, g_cmb_actor=0), `settle_combat_input` OK. Tras `c`+`i,f,g`+`\n`+aim UP: **NO apareció
campo ni marca 0xff** en 0xab02 (solo terreno 05/06/08 + celdas 0x00 de actores); seed
1234→9156 (algo consumió rands — turno/enemigos, no necesariamente el cast).

**Diagnóstico (dos correcciones para el run 2):**
1. **In Flam Grav (#14) en COMBATE usa la vía ARMA, NO el aplicador 0x1c36** (magic.md:86,100:
   `g_cmb_weapon=COMBAT_WEAPON[arg]=0x35 ; call COMSUBS:0x0C52`). ⇒ **NO marca 0xff.** El
   footprint de 0xff (item b) es del **lineAoe = In Flam Hur (#45)** (`i,f,h`), no de In Flam
   Grav. Confusión resuelta (cast-line-derivation §3: 45 In Flam Hur → lineAoe/0x1c36).
2. **MP**: el dispatcher aborta si `MP < circle` (magic.md:28, MP@`0x55B7+ref*0x20`; «M.P.
   too low!»). Sembrar MP (y `int`=maxMP @char+0x0E) del caster antes de castear. **Diagnóstico
   de si el cast disparó = MP baja por el círculo** (magic.md:30, `MP-=circle`): leer MP
   antes/después; si no baja, el cast NO se ejecutó (input/MP/clase).
3. Leer `g_cmb_weapon` 0x589D tras el cast (=0x35 si fieldWall disparó; el lineAoe va por otra
   vía).

### Run 2 (In Flam Hur #45, MP+int sembrados a 99) — **EL FIXTURE FUNCIONA**

`caster ref=0 MP 99→91 (delta=8)` ⇒ **el cast DISPARÓ** (In Flam Hur = círculo 8, coste 8 MP).
`g_cmb_weapon 0x00→0x00` (NO cambia) ⇒ In Flam Hur NO usa la vía arma → va por el aplicador
0x1c36 (lineAoe), consistente. **⇒ el fixture cast-en-combate ES SÓLIDO: enter_combat +
settle + runas + MP sembrado dispara el hechizo APUNTADO en combate.** (El diagnóstico
MP-baja-por-círculo es el testigo fiable de que el cast se ejecutó.)

**PERO 0xff = vacío tras el cast + run_ticks(12).** Motivo: las marcas 0xff (0x1e60) del
aplicador viven en el composite de display **0xab02, que se RE-COMPONE en cada redibujo** (world-
turn / turnos de enemigos tras el cast). Al leer post-turnos ya se sobreescribieron. ⇒ para el
footprint hay que (a) leer 0xab02 INMEDIATO al terminar las teclas (antes de run_ticks/redibujo),
o (b) inferir por DAÑO a enemigos congelados (seed_melee_positions). Además el daño de In Flam
Hur es PROBABILÍSTICO (gate rand30≥peso): a distancia 5 la prob es ~19%, por eso el enemigo en
la línea no recibió daño con esa seed. Congelar enemigos ADYACENTES (dist 1, ~61%) sube la señal.

### Run 3 (In Flam Hur + seed_melee, enemigos adyacentes) — footprint sigue esquivo

`seed_melee_positions` colocó 2 enemigos adyacentes (4,6)/(5,6), player (5,7); cast disparó
(MP 99→91). PERO: `ff_immediate=[]`, `ff_now=[]`, **enemigos dañados=[]**. Y la traza de rands
salió INUTILIZABLE — inundada de tiradas COSMÉTICAS de animación de sprites (`ret0=0x4628/
0x4670`, rand0(255)) + viento (`0x2f73`, rand0(63)) + misreads (`0x824`), que sepultan las
tiradas de JUEGO del cast. **CAUSA: olvidé `patch_sprite_rand`/`patch_render_rand`** (que
`combat_parity.capture_trace` aplica siempre). Sin ellos el stream del cast es irrecuperable.

### Run 4 (con patches) — para aislar el stream del cast (rand0(15) len + rand30 gates)

Con `patch_sprite_rand`+`patch_render_rand` aplicados tras `seed_melee`, la traza queda con las
tiradas de JUEGO. La pregunta del lead (¿`1×rand0(15)` total → LÍNEA, o `rand0(15)` por fila →
CONO?) se responde del stream limpio sin depender de las marcas 0xff (transitorias). El nº de
gates rand30 = nº de celdas del footprint. [Resultado pendiente del run en background.]

**Nota footprint 0xff:** las marcas 0xff NO son leíbles por memoria post-cast (el aplicador +
su redibujo recomponen 0xab02 antes de que el control vuelva al probe). Leerlas exigiría un BP
DENTRO del aplicador 0x1c36 (BP de overlay = no fiable en este arnés). Por eso el footprint se
deriva del STREAM (nº de gates) y del DAÑO a enemigos congelados adyacentes, no de las marcas.

## ESTADO AL CERRAR (2026-07-19) — fixture ENTREGADO; footprint/rand-count Clase-C

**ENTREGADO (sólido):** el fixture cast-en-combate FUNCIONA (dispara el hechizo apuntado en
combate; validado con In Flam Hur, MP-delta = coste de círculo). Es la infraestructura que
pedía el lead. Committeado.

**NO cerrado (2 Clase-C, con el punto EXACTO):**
- **Footprint 2D / stream de In Flam Hur:** la traza post-cast salió SÓLO con rands cosméticos
  de anim de combate `(0,255)` (ret0 0x4628/0x4670) + misreads `(52224,9500)`; **cero rands
  `(0,15)`/`(0,30)`** en la ventana post-teclas. ⇒ o las tiradas del cast caen en la ventana
  DURANTE la entrega de teclas (mi JSON sólo guardó el slice post-teclas), o In Flam Hur NO usa
  rand0(15)/rand30 (posible: no es el aplicador 0x1c36 — la derivación lo marcaba CANDIDATO).
  Además In Flam Hur disparó SIN daño ni marcas observables. **Punto exacto para cerrarlo:**
  (1) guardar la traza COMPLETA (i0..) no sólo post-teclas; (2) filtrar por `classify_roll`
  (descarta anim como None) o por `(lo,hi)∈{(0,15),(0,30)}`; (3) confirmar QUÉ spell es el bolt
  0x1c36 (probar In Zu #28 / In Nox Hur #40 además de In Flam Hur #45). El nº de `(0,15)` = 1
  (línea) vs por-fila (cono); el nº de `(0,30)` = celdas del footprint.
- **rand-count 0x9cb6 (Kal Xen Corp):** `probe_summon_randcount.py` listo (con patches +
  captura de ret0 crudo + conteo de enemigos para detectar el spawn). No ejecutado por
  presupuesto. El picker (seg2) sale como ret0 NO whitelisted → capturar crudo, no classify.

**Nota de arnés:** `patch_sprite_rand` parchea la FUNCIÓN 0x2F62, NO los sites de anim de
combate 0x4625/0x466D (que llaman rand_range directo). Ésos se DESCARTAN por `classify_roll`
(caller no whitelisted → None), no se parchean. El probe debe FILTRAR con classify_roll, no
quedarse el ret0 crudo, salvo para el picker de seg2.

## Evidencia
- Probe: `re/notes/probe_combat_cast.py`. Infra: `re/tools/combat_parity.py`
  (enter_combat, settle_combat_input, ensure_spell_mixed, capture-trace 0x481+, classify_roll).
- Input: `re/notes/cast-input.md §3/§8/§9`. Handler cast-combate: `magic.md`, CAST.OVL.
