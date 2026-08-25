# Re-sellado post-lote — 2 baselines movidos, y ★ UN DEFECTO NUEVO: VICTORIA SIN BIT

Ventana del 26-07. Criterios de entrada verificados juntos (load 4,63 · `pgrep -f 'playwright [t]est'`
= 0 · puerto 5298 libre). Run: 21 tests, **31,5 min**, **13 passed / 4 failed**.

## 0. Procedencia del asset — CONFIRMADA sin tocar nada compartido

`game/assets` del worktree es un **symlink al checkout principal**, que sirve el dev server del
usuario (:5199). En vez de regenerar encima, regeneré a un **dir temporal** y comparé:

```
shasum combatmaps.json  vivo = regenerado = ecc9c0286d4f625e…   ★ BYTE-IDÉNTICOS
31 ficheros de contenido: 31 idénticos
```
La única diferencia era `manifest.json`, y es **artefacto de mis propios `--skip-music --skip-tiles`**,
no un hueco de procedencia. ⇒ **El asset vivo ES lo que produce el código aterrizado.** No hubo que
escribir en el recurso compartido — el dev server del usuario intacto.

## 1. Los dos baselines que SÍ se movieron (detector funcionando)

**`ch23` Wrong** — `1:DEADEND→VICTORY`, `2:DEADEND→VICTORY`. Son **cm49 y cm50**, las dos salas que
el fix `0xEC` deja **SIN enemigos**. Predicción declarada **cumplida**.
`3:DEADEND` se mantiene: cm51 conserva 6 enemigos reales (3 Skeleton + 3 Ghost).

**`ch24` Covetous** — victorias `[7,8,9]` → **`[4,6,7,8,9]`**:
- **r4 (cm68)**: emptied ⇒ VICTORY del PORT. Predicho.
- **r6 (cm70)**: pierde 9 remolinos y quedan **4 Rat REALES** ⇒ **victoria JUGADA**, no de vacío.

Ambos actualizados **con la formulación obligatoria del ruling** («el PORT la gana con el roster
ACTUAL… el original coloca una entidad sin identificar — PENDIENTE-ORÁCULO»). Re-corridos:
**0 fallos** (la determinismo ×2 de ch24 quedó en vuelo al cortar mi timeout de shell: **no
verificada**, se declara).

### ⚠ Mi hipótesis de `#65`, REFUTADA por la medida

Dije que sin los remolinos `#65` (r1/cm65) tendría «1 enemigo real y sería ganable». **Falso**:
sigue **DEADEND** con su Ghost. Igual r0, r2 y r3. ⇒ **la contabilidad de los remolinos explicaba
por qué el veredicto era inalcanzable, pero NO era lo único que impedía ganar.** La causa-única
sigue siendo correcta como *diagnóstico del atasco*; mi extrapolación a «⇒ ganable» era mía y no
se sostiene.

## 2. ★ EL HALLAZGO: victoria SIN bit de sala-despejada

Los otros dos rojos **NO son baselines movidos y NO se re-baselinean**:

```
[ch24b] r4-west (cm68) -> VICTORY | bit=false      ← invariante VICTORY ⟺ bit ROTA
[ch24b] r4-east (cm68) -> VICTORY | bit=false
[ch47 ] r5 (cm69)  digest=VICTORY:e0:d0 bit=false
[ch47 ] r13        digest=VICTORY:e0:d0 bit=true   ← control: victoria normal SÍ pone el bit
[ch47 ] r14        digest=VICTORY:en-transito bit=true
```

**Las salas que empiezan VACÍAS se «ganan» sin marcarse como despejadas.** El control de `r13`
descarta que sea cosa de «0 enemigos al final» (`e0:d0` **con** bit): lo decisivo es **empezar sin
enemigos**, porque el latch de victoria (`maybeLatchVictory` → `onVictoryLatch`, que pone el bit)
sólo se alcanza avanzando turno, y una sala vacía se resuelve antes.

**Consecuencias**: se rompe el invariante de fusión de ch24b (`VICTORY ⟺ bit (loc,roomNo)`); la
sala **nunca degrada a `RoomsBroke`** ⇒ **volvería a disparar combate en cada re-entrada**; y su
persistencia en `.gam` queda mal.

**Y esto es EVIDENCIA A FAVOR DEL RULING**: un tablero vacío produce un estado que **el original no
puede producir** (él coloca algo para la familia `0xEC`). No es sólo que no sepamos el veredicto:
es que el estado intermedio ya es incoherente. **Refuerza que la sonda-oráculo es la vía, no un
parche al latch** — «arreglar» el bit para salas vacías sería consolidar un tablero que sabemos
incompleto.

## 3. Sin cambios (control)

`ch20` (Deceit, cm20 pierde 8 PoisonField): digest **idéntico**, r4 seguía y sigue VICTORY.
`ch27` Doom: **idéntico**. `ch32`: todo `SIN-ENTRADA`, idéntico. `ch37b`, `ch37-doom-cola`: verdes.
⇒ **ningún digest se movió fuera de la lista prevista** — mi regla («fuera de la lista = RNG, no
roster») no se disparó: el desplazamiento de RNG del extractor **no** movió veredictos.
