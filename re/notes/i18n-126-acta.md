# ACTA #126 — plantillas i18n muertas por interpolación NATIVA + LINT del género

Carril `i18n-126`, rama `fix/i18n-126`, worktree propio. Sin e2e (mutex ocupado por la
ventana de re-sello). Gates: `vitest` COMPLETO desde `game/` EXIT 0 (291 ficheros, 3740
tests, 1 skip), `tsc --noEmit` EXIT 0, `tsc --noEmit -p tsconfig.e2e.json` EXIT 0 — los
tres leídos por separado, sin pipe.

---

## 1. El género, dicho con precisión

La key existe en `es.json` con `reviewed:true` y es INALCANZABLE porque el call-site
compone el mensaje con `` `${…}` `` nativo, mientras `t()` es **lookup exacto**: el
compuesto («Position: 123, 45») no casa jamás con la plantilla catalogada («Position: {},
{}»). Bajo `lang='es'` el mensaje sale EN INGLÉS **y todas las guardas siguen verdes** — la
key está traducida y revisada, y nadie medía que alguien la usara.

Ese último punto no es retórica: está MEDIDO abajo (§4, verificación de doble sentido).

## 2. Lo arreglado — 3 instancias, fix mecánico `tf(plantilla verbatim, …args)`

| sitio | plantilla (key de es.json) | cita |
|---|---|---|
| `game/src/core/endgame/use-tools.ts:186` | `Position: {}, {}` | CAST.OVL 0x1a96, DS 0x4a26 |
| `game/src/core/endgame/use-tools.ts:203` | `The pocket watch reads {}:{} {}.` | CAST.OVL 0x1ad4 |
| `game/src/core/world/camp.ts:320` | `Hull now {}!\n\n` | kernel 0x3C9A rama 0x3cf8-0x3d50; DS 0xa2f8+0xa302 |

Byte-idéntico en `lang='en'` **por diseño** (`t()` es identidad estricta en 'en' y cada
arg-string también), y eso no se afirma: se mide. Las 3 entran en `tests/i18n-tf.test.ts`
con su campo `legacy` = la composición nativa EXACTA que había en el call-site, y el test
compara `tf(...)` contra esa composición, no contra un literal escrito a mano.

Failing-first por instancia, con asserts bajo `lang='es'` contra el valor REAL leído de
`es.json` (si alguien re-traduce la key, el test sigue midiendo el CABLEADO y no la
redacción). Rojo previo verificado: 3 de 3.

`es.json` NO se ha tocado — las 3 keys ya existían. Cero valores de aserción movidos.

**La trampa que #133 pagó, y que aquí no aplicó:** el `\n\n` de `Hull now {}!\n\n` es
PÁRRAFO, no wrap interior; `rewrap` lo conserva y la guarda (C) de i18n lo admite en el
valor traducido. La regla («el `\n` INTERIOR va en la key y en el literal pero NO en la
traducción») sólo muerde el `\n` interior suelto, y ninguna de las 3 lo tiene. La guarda
(C) se corrió y quedó verde.

**AM/PM:** con `tf()` el `ampm` viaja como ARG string, así que además pasa por `t()`. Hoy
es identidad — medido: `AM`, `PM`, `AM.`, `PM.`, ` AM.`, ` PM.` NO tienen key en `es.json`
(coherente con la retractación de `' AM.'` en #139). Queda CABLEADO, no traducido: si
alguien añade la key algún día, el sitio ya la consume.

## 3. ★ EL LINT TRANSVERSAL (lo que mata el género, no la instancia)

`game/tests/i18n-plantillas-nativas.test.ts` familia (B). Detecta toda plantilla `${…}` que
llega a un sink user-facing SIN pasar por `t()`/`tf()` y cuya normalización (`${…}`→`{}`)
EXISTE como key de `es.json` ⇒ error con `fichero:línea`.

**Decisión de diseño, para que lint y guarda no puedan derivar:** en vez de un escáner
nuevo, se parametriza el extractor AST YA compartido (`game/tools/extract-user-strings.mjs`,
el de `string-manifest` + `i18n-corpus`) con un `mode`. Los **SINKS son los mismos** en
ambos modos — `text:`/`message:`/`messages:`, `<builder>.push(…)`, `hud.message/echo/
messageAppend`, `selector.prompt`, constantes-display allowlistadas — y lo que cambia es la
POLÍTICA DE HOJAS, invertida:

- `"catalog"` (el de siempre, intacto): todo literal alcanzable; `t()`/`tf()` se atraviesan
  como identidad.
- `"native"` (nuevo): la plantilla `${…}` es lo que se aflora, el literal plano no, y
  `t(…)`/`tf(…)` se **PODAN** — lo que ya pasa por el choke i18n es justo lo que el género
  NO es.

Si mañana alguien añade un sink al extractor, el lint lo hereda el mismo día.

### Control positivo — OBLIGATORIO, y medido ANTES de tocar código

Censo del 29-07 sobre `main`, con los 3 fixes SIN aplicar: **8 plantillas nativas en sinks
en total, de ellas 5 con key en `es.json`** (= el género):

```
core/endgame/use-tools.ts:186  "Position: {}, {}"
core/endgame/use-tools.ts:202  "The pocket watch reads {}:{} {}."
core/world/camp.ts:319         "Hull now {}!\n\n"
main.ts:368                    "{}? I know of no such person."
main.ts:1471                   "Caught!\n\nThe trolls demand a {} gp toll!\n\nDost thou pay?"
```

El lint cazó las 3 del encargo **antes** de arreglarlas. Después de arreglarlas queda
EXACTAMENTE la población residual declarada (2), y el test la exige por igualdad de
conjunto: un alta nueva lo pone rojo, y una baja NO anotada también.

### La predicción del encargo falló por dos lados, y ambos importan

El encargo pre-registraba **6** (las 3 + main.ts + «las 2 del reloj»). Salieron **5**, y no
por la misma razón en cada extremo:

- **El reloj no son dos.** El de bolsillo y el de PIE no emiten el mismo texto (ver §5).
- **★ Apareció una que nadie había nombrado:** `main.ts:368` `{}? I know of no such
  person.` — la destapó este lint, no la auditoría. Es el GEMELO del emisor real
  `core/party.ts:181`, que ya usa `tf()` con esa misma plantilla; la copia de `main.ts`
  vive en el arnés `innLeave` que el ESPEJO usa para los swaps de party del LP2.

La aritmética casual habría sido 3+1+2 = 6 = «cuadra». No cuadraba: 6 = 3 + 1 + **2 que no
eran las que el encargo creía**.

### Población residual (declarada CON motivo, en el propio fichero del test)

- `main.ts:1471` peaje de trolls — POST-GO por instrucción del lead (ramas de preview vivas
  sobre `main.ts`).
- `main.ts:368` — el hallazgo nuevo. Mismo fichero y mismo motivo de aplazamiento que el
  peaje ⇒ va CON él, no por separado. **No se toca en este carril**, se deja anotado.

Un residual sin motivo escrito no puede entrar en la lista.

### Instrumento vivo

Segundo test de la familia (B): el barrido en modo native debe seguir viendo material
(`total ≥ residual + 3`). Sin él, un cambio que dejara el extractor en cero pondría el lint
VERDE EN FALSO — el género «instrumento equivocado peor que ninguno». El total incluye las
3 plantillas nativas SIN key (`shrine-ceremonies.ts:251/367/432`, genéricas `{}\n`, `{} +1\n`,
`{} gp\n\n`): no son del género (no hay key muerta) y sirven de control negativo.

### Cableado al gate

Es un `*.test.ts` en `game/tests/`, el MISMO runner que las guardas (A)/(B)/(C) de
`i18n-manifest.test.ts`. Corre con `npm test` sin configuración aparte.

## 4. Verificación de doble sentido (era barata, se hizo)

- **Lint sin fixes → ROJO.** Corrida failing-first: 4 fallos (las 3 instancias + el lint,
  que enumeró las 5).
- **Fixes sin lint → las guardas viejas VERDES.** Se restauró el código SIN arreglar desde
  `main` y se corrieron `i18n-tf` + `i18n-manifest` + `string-manifest` + `use-tools` +
  `i18n-corpus-inventory` con el lint EXCLUIDO: **99 tests, 5 ficheros, todo verde**. Ésa es
  la demostración directa de la premisa del género: el defecto vivía en `main` con la suite
  entera en verde.
- **Ambos → verde**, y la suite completa también.

## 5. El testigo independiente — cerrado el de bolsillo, RETIRADO el de pie

El censo de huérfanos dejó dicho que bajo `lang='es'` «el reloj sale en inglés». El fix (b)
—reloj de BOLSILLO, `use-tools.ts:203`— lo cierra: la key `The pocket watch reads {}:{} {}.`
estaba catalogada, revisada y muerta, y ahora se consume.

El **reloj de PIE** (`core/game.ts:475`, tile 0xFA/0xFB, LOOKOBJ 0x0596) el encargo lo daba
por «segundo emisor del mismo texto». **No lo es, y no se ha fabricado un fix para que lo
pareciera.** Medido:

- Compone sólo el SUFIJO `"3:28 PM."` y lo devuelve como `{mode:"concat", suffix}`; el marco
  lo pega `game.ts:4856` con `t(describeTile(tile)) + t(special.suffix)`.
- La base SÍ está traducida: `a grandfather clock, showing: ` → `un reloj de pie, que
  marca: ` (key viva en `es.json`).
- El sufijo NO tiene key: comprobado uno a uno que `{}:{} {}.`, `AM`, `PM`, `AM.`, `PM.`,
  ` AM.` y ` PM.` están AUSENTES de `es.json`.

⇒ No hay key muerta, luego **no es una instancia del género**, y por eso el lint —
correctamente — no lo señala. Lo único no-español que queda es `PM`, que en castellano se
escribe igual. Cambiar eso sería una decisión de traducción/fidelidad, no el defecto de
#126: queda **declarado, no arreglado**.

(De paso: el sufijo llega a `t()` ya COMPUESTO, así que aunque tuviera key tampoco casaría.
Es la firma del punto ciego de #132 — `t()` sobre un compuesto —, no la de #126 — `${}` en
vez de `tf()`. Familia distinta; si alguien quiere cerrarla, es tarjeta propia.)

## 6. Predicciones falsables que deja este carril

1. Si alguien vuelve a componer con `${}` una plantilla catalogada en cualquier sink del
   extractor, el lint lo caza **en el commit**, con `fichero:línea`, sin pasar por soak ni
   por e2e.
2. Cuando se arreglen las 2 de `main.ts` (post-GO), la lista `RESIDUAL` del test debe
   quedar VACÍA y el test debe seguir verde con `[]`. Si al vaciarla se pone rojo, es que
   entró un alta nueva en medio.
3. El total del modo native (8 hoy) puede subir sin que suba el género: sólo las que tengan
   key son defecto. Ese desacople es intencionado y es lo que hace que el lint no sea un
   prohibicionista de plantillas.

## 6bis. APÉNDICE (post-aterrizaje de 0934084d) — el careo con el detector de huérfanos

La tarjeta pedía además «cerrar la instancia que el censo de #86 dejó apuntada —plantillas
del santuario, ya resueltas por E2 en el detector de huérfanos— verificando que el lint y el
detector NO se contradicen». El parte del carril lo sirvió por encima (las mencionó como
control negativo, sin carearlas). Cerrado aquí.

**Veredicto: NO se contradicen.** El motivo vale más que el veredicto, porque nombra una
TERCERA forma distinta de #126 y de #132:

El lint indexa por la plantilla NORMALIZADA (`{} +1\n`). El santuario **no está catalogado
así**: lo están sus formas COMPUESTAS, una por miembro de un conjunto CERRADO de literales
—`Strength +1\n`, `Dexterity +1\n`, `Intelligence +1\n` (DS 0x95b8/0x95c6/0x95d4)—. Como el
argumento interpolado es un literal fijo y no un número, el compuesto que sale del `${}` **ES
la key**, casa en el choke `t()` de la consola y se traduce. Medido en vivo:

```
t("Strength +1\n")   -> "Fuerza +1\n"
t("Dexterity +1\n")  -> "Destreza +1\n"
t("100 gp\n\n")      -> "100 gp\n\n"   (no es key; su ' gp\n' traduce byte-idéntico)
```

No hay key muerta ⇒ el lint acierta al no marcarlo y el detector acierta al absolverlo.
Coinciden porque miden lo mismo desde lados opuestos.

**★ LIMITACIÓN DECLARADA que esto destapa.** Para una familia catalogada en forma
COMPUESTA el lint es CIEGO: si a un miembro le faltara su key saldría en inglés, y la
normalización (`{} +1\n`, que no es key de nada) no lo vería. Cobertura del hueco: familia
(C) del test fija los 3 miembros y exige que los 3 traduzcan — barato, y cubre justo lo que
el instrumento no alcanza. Segundo test: que la forma normalizada NO sea key (si algún día
lo fuera, hay que re-adjudicar §C en vez de asumir).

**Trampa para el próximo que pase.** Aplicar aquí el fix de #126 —`tf("{} +1\n", label)`—
NO es obligatorio y **no sería una corrección sino un cambio de vía**: pasaría a traducir
por la etiqueta suelta en vez de por la frase catalogada y revisada. Hoy funcionaría (las 3
etiquetas sueltas también tienen key: Fuerza/Destreza/Inteligencia), pero es otra
dependencia. No se toca: no está roto.

## 7. Ficheros

- `game/tools/extract-user-strings.mjs` — `mode` + `resolveNative` + export
  `extractNativeInterpolations`. El modo "catalog" queda intacto (probado: `string-manifest`
  e `i18n-corpus-inventory` verdes, manifiesto byte-estable).
- `game/tools/extract-user-strings.d.mts` — tipos del export nuevo.
- `game/tests/i18n-plantillas-nativas.test.ts` — NUEVO: familias (A) por instancia y (B) el
  lint + control de instrumento vivo.
- `game/tests/i18n-tf.test.ts` — 3 casos nuevos al arnés byte-igual-en-'en'.
- `game/src/core/endgame/use-tools.ts`, `game/src/core/world/camp.ts` — los 2 call-sites.
