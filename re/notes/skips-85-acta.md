# #85 — ACTA: los 5 skips perdidos eran el síntoma; la enfermedad es una capa de artefactos SIN PRODUCTOR

Carril `reocr-77`, rama `re/espejo-skips-85`, commit `91a413a4`. Fecha: 2026-07-28.
Antecedente: `re/notes/reocr-77-acta.md` (§6, cuyo censo de daño **corrijo aquí**).

---

## 1. Veredicto

El encargo era «re-adjudicar 5 decisiones `skip` perdidas en part17/18». **No eran 5, y no
era re-adjudicación.** Eran ~49 decisiones desplazadas en 7 partes, por una causa raíz
estructural: **el generador que produce la capa overlay de LP1 nunca estuvo versionado**.
La solución no es adjudicar a mano — es **restaurar el productor**, cosa que hice con un
control positivo que reproduce los artefactos originales **176/176**.

## 2. ★ Corrección a mi propio censo de #77

En el acta de #77 (§6) reporté «part09/10/11/13/14/15/16: 100 % conservado». **Estaba
medido con el instrumento equivocado.** Medí *«¿la clave del overlay sigue casando con un
id existente?»*. Pregunta equivocada: los ids de segmento son **posicionales** (`gNN` por
orden), así que al cambiar la cuenta de segmentos **la clave sigue casando por nombre y
apunta a otro contenido**.

Ejemplo: `part18-g09` era `ctx=dungeon` con «Fly South / Blocked»; tras regenerar, el
mismo id es `ctx=combat` con «Min armed with Spiked Helm». Un `skip` de *entrada de
mazmorra* cayendo sobre un *combate*.

**Y casi lo mido mal por segunda vez.** Mi primer intento de cuantificarlo comparaba el
TEXTO viejo con el nuevo y daba «56 de 61 mal» — número **basura**, porque compara OCR
corrupta contra OCR limpia y la similitud cae aunque el contenido sea idéntico. Lo tiré.

El instrumento bueno es **inmune al arreglo de la OCR**: la **posición relativa en el
episodio** (fracción de `ocrLn` sobre el total de la ruta), que no depende del
reconocimiento. Resultado: **49 de 54** claves de decisión desplazadas, en gradiente:

| tramo | daño |
|---|---|
| part16 | **catastrófico** — g04 0,9%→23,8% · g05 0,9%→36,6% · g10 39,1%→99,7% |
| part17 | **grave** — g07 48,3%→98,0%, más 2 huérfanas |
| part18 | **mixto** — g02 16,8%→0,1%, g09 72,7%→46,1%; pero g15-g19 dentro de 0,4-4,8 pts |
| part09-12 | **leve-media** — policies 4,7-5,7 pts conservando `ctx combat→combat` |
| part13/14/15 | **sin daño** — sus overlays no llevaban ninguna clave de decisión |

**Caveat del instrumento, declarado:** los logs viejos estaban inflados por repetición de
forma **no uniforme**, así que el mapeo de fracciones no es lineal. Un desplazamiento de
2-5 puntos está dentro de ese ruido y no prueba nada; uno de 20-60 sí.

## 3. ★ La causa raíz

Los overlays de LP1 declaran en su `entry.note` «Generado offline (mkoverlay)». Pero:

```
git log --all -- '*mkoverlay*'   →  sólo mkoverlay-ad.mjs (corpus LP2, commit 0fe1f4ee)
```

**El productor de la capa overlay de LP1 nunca fue un fichero versionado.** Por eso al
regenerar las rutas en #77 sus decisiones quedaron desalineadas *sin forma de reponerlas*:
no había herramienta que las re-emitiera. Los 5 skips huérfanos eran el síntoma visible de
**una capa de artefactos sin productor en el repo**.

## 4. Por qué NO re-adjudiqué a mano (que era el encargo literal)

Dos razones, y la segunda me señala a mí:

1. Esas decisiones son **mecánicas** — salida de un clasificador, no juicios caso por caso.
   Re-emitir a mano habría convertido salida-de-tool en criterio-humano-inventado.
2. La cabecera del generador de LP2 documenta que **`klimb` y los nombres de mazmorra en
   diálogo dan FALSOS POSITIVOS** («lección del espejo-1»). Eso es **exactamente la regla
   ingenua que yo estaba a punto de aplicar** tras ver las marcas en el texto limpio.
   Re-adjudicar a mano habría reproducido el error que el clasificador ya sabía evitar.

## 5. La restauración, y el control que la valida

`game/e2e/espejo-tour/tools/mkoverlay-lp1.mjs`: el **mismo algoritmo** del de LP2 —
`dungeon-enter` ABRE interior · evidencia de superficie CIERRA · `exit` con «Britannia»
cierra y con «Underworld» sigue · «Entering room..» fuera de interior = entrada que el OCR
se comió · interior ⇒ `skip:"pendiente-runner"` (runner.ts:1761 `navOnly = seg.skip != null`)
· combate de superficie ⇒ `policy:"auto"`.

Diferencias **declaradas** (des-LP2-ización, no mejoras): sin `RECRUITS`/`PARTY_ASSERT`
(censos del LP2); **`entry` y `ledger` se PRESERVAN** del overlay existente en vez de
generarse — esa prosa es de LP1 y no me consta derivada, inventarla habría sido fabricar.

### ★ El control positivo, y lo que cazó

Criterio: alimentado con las rutas **PRE-#77** (árbol `3544217a`), el generador restaurado
debe reproducir los overlays originales.

- **Primer intento: 165/176.** Fallaba en part17/18 porque yo **arrastraba el estado de
  interior entre episodios** — el comportamiento del de LP2, cuya cabecera dice «ad09
  acaba dentro de Destard; ad10 arranca ahí».
- El control lo **refutó**: con arrastre, part17/18 daban 10 y 22 skip frente a los 7 y 14
  originales, porque part16 termina dentro de la mazmorra.
- **Sin arrastre: 176/176 exacto.**

Conclusión: el generador de LP1 **no arrastraba**, y encaja con el corpus (aulddragon sale
de la mazmorra entre episodios; el LP2, mazmorra-céntrico, no). **No es una elección de
diseño mía: es lo que los artefactos exigen** — y sin el control me lo habría inventado al
revés, con apariencia de normalidad.

## 6. ★ Segundo defecto cazado AL VERIFICAR (no al diseñar)

Tras regenerar overlays y re-curar, comprobé que los `skip` cayeran sobre evidencia de
mazmorra. Las rutas mostraban **9 y 11** skips donde el overlay decía **8 y 6**.

Causa: **`curate.mjs` copia campos EN SITIO y nunca LIMPIA un `skip` previo**. Las
decisiones de la pasada anterior (la desalineada) **sobrevivían** a la re-curación. El
orden correcto es `segment.mjs` (ruta limpia desde el ocrlog) y **después** `curate.mjs`.
Rehecho así; ahora las 10 partes cuadran ruta↔overlay exactamente.

Si me hubiera fiado de la salida del generador en vez de verificar el artefacto final,
habría cerrado #85 declarando 6 skips en part18 mientras la ruta llevaba 11.

## 7. Resultado

- `skip` **30 → 19** y `policy:auto` **22 → 33** en part09-18, cada decisión derivada de la
  segmentación que **realmente existe**.
- Las **5 huérfanas de part17/18 quedan resueltas por construcción**: el generador
  re-emite sobre los segmentos vivos. Ninguna ancla adivinada, ninguna declarada
  no-casable (la pregunta «¿a qué segmento nuevo corresponde el viejo?» desaparece cuando
  el productor vuelve a existir).
- **`%todo` intacto** (40,5 · 54,3 · 44,8 · 44,6 · 36,9 · 32,4 · 34,3 · 68,4 · 65,7 · 41,5):
  los overlays gobiernan `skip`/`policy`, no la clasificación de ops.
- Ganancia lateral: **part13/14/15 ganan `policy:auto`** (1/2/1) que no tenían — combates
  que la OCR corrupta no dejaba ver.

## 8. Propuesta PRE-REGISTRADA (encargo secundario): casamiento robusto en curate.mjs

**Sin implementar**, a decisión del lead. El defecto de fondo no es que se perdieran 5
decisiones: es que **el mecanismo puede desalinear 49 sin decir una palabra**
(`overlay.segments?.[seg.id] ?? {}` descarta en silencio).

1. **Huella de contenido por clave.** Cada entrada del overlay guarda un `anchor`: texto
   normalizado con el `fuzz` del segmentador (NO `ocrLn`, que cambia con cada re-OCR) de
   las primeras N líneas del segmento.
2. **Fallo RUIDOSO.** `curate.mjs` compara la huella; si no casa, **falla** (o marca
   `stale:true` y lo cuenta en un censo de salida) en vez de aplicar en silencio. Un
   overlay desalineado debe romper el gate, no colarse.
3. **Preferir regenerar a parchear.** Con el productor versionado (`mkoverlay-lp1.mjs`),
   la respuesta correcta a «cambió la segmentación» es re-ejecutar el generador, no
   re-atar claves. La huella es la RED DE SEGURIDAD para cuando alguien no lo haga.
4. **Predicción falsable si se implementa:** aplicada a los overlays PRE-#77 sobre las
   rutas POST-#77, la guarda debe marcar ~49 claves stale. Si marca ~5 (sólo las
   huérfanas) la huella es demasiado laxa; si marca las 176, demasiado estricta.

### 8bis. IMPLEMENTADA (encargo ascendido a primero por el lead) — y la predicción FALLA

Commit `32e3f346`. `tools/anchor.mjs` (huella compartida, módulo suelto para que generador
y verificador no puedan divergir) · `mkoverlay-lp1.mjs` la emite · `curate.mjs` la verifica
ANTES de aplicar, **no aplica** las claves rancias, cuenta huérfanas, sale con exit 1, y
ofrece `--check` y `--allow-stale`.

| prueba | qué mide | resultado |
|---|---|---|
| **A** control negativo | huellas nuevas vs sus propias rutas | **194 ancladas, 0 rancias, exit 0** ✔ |
| **B** ★ la pre-registrada | overlays PRE-#77 vs rutas POST-#77 | **170 rancias + 6 huérfanas = las 176** ✗ |
| **C** control positivo | re-segmentación SIN re-OCR (borro un segmento y renumero) | **g01-g04 pasan; g05-g18 rancias; g19 huérfana** ✔ |

**La predicción B queda FALSADA por mi propio criterio escrito** («si marca las 176,
demasiado estricta»). No la reinterpreto para salvarla. Lo que falló es **mi prueba, no la
guarda**: el escenario que pre-registré **incluye un re-OCR**, que cambia todo el texto, así
que una huella textual no puede casar aunque el segmento sea el mismo.

★ **Es el MISMO confound que ya había cazado dos veces en este carril** —comparar OCR
corrupta contra OCR limpia— **y lo volví a meter, esta vez dentro de la predicción con la
que iba a juzgar mi propio instrumento.** Tercera vez. Que el error sobreviva a haberlo
diagnosticado dos veces dice algo sobre lo fácil que es: en cuanto el «antes» y el
«después» de una medida no son comparables por una razón que ya conoces, hay que
comprobarlo **en cada instrumento nuevo**, no una vez por carril.

El comportamiento observado, eso sí, **es el correcto para ese escenario**: tras un re-OCR
el overlay hay que regenerarlo entero (lo que hice en #85), y marcarlo todo rancio es el
aviso adecuado. La prueba que de verdad valida la guarda es **C**, que faltaba en el
prerregistro: localiza el desplazamiento con precisión en vez de dar alarma en bloque.

**Alcance honesto** (escrito en la cabecera de `anchor.mjs`): detecta «la ruta se
re-segmentó y las claves bailaron»; **no sobrevive a un re-OCR**, y ahí marcar todo es la
respuesta correcta. **Retrocompatible**: overlays sin huella (part01-08, part19-24, corpus
AD entero) reportan «0 con, N sin», exit 0, sin tocar rutas.

## 9. Lecciones

- **Una clave que «casa» no es una clave que corresponde.** El identificador posicional es
  un falso amigo: sobrevive al cambio y cambia de referente. Verificar CONTENIDO, no
  existencia.
- **El control positivo se busca donde puede refutarte, y funciona cuando duele:** el mío
  tumbó mi propia suposición del arrastre entre episodios. Un control que sólo confirma no
  es un control.
- **Verifica el artefacto FINAL, no la salida de tu herramienta.** El generador decía 6 y
  la ruta llevaba 11.
- **Un artefacto sin productor versionado es deuda invisible** hasta que algo aguas arriba
  cambia. Merece detector propio (§10).
- ★ **Un confound conocido hay que re-comprobarlo en CADA instrumento nuevo, no una vez por
  carril.** Cacé dos veces que comparar OCR-corrupta contra OCR-limpia invalida una medida
  — y lo metí una tercera, dentro de la predicción con la que iba a juzgar mi propia
  guarda (§8bis). Saber el nombre del error no vacuna contra cometerlo.

## 10. Cola abierta

1. **Barrer el repo en busca de más capas sin productor**: artefactos que dicen «generado
   por X» donde X no existe en `git log --all`. Este caso costó una regresión silenciosa
   en main; no hay razón para creer que es el único.
2. **La guarda de huella de §8**, si el lead la aprueba.
3. **`curate.mjs` no limpia campos rancios** (§6): hoy se mitiga con el orden
   segment→curate, pero la idempotencia que su cabecera promete no es tal para `skip`.
4. **part16/17 siguen fuera de banda de `%todo`** (68,4 / 65,7) — cola de #77, es de #17.
5. **#45 puede correr part13/14/15 ya**; part09-12 y 16-18 quedan liberadas por este
   commit, pero conviene que el lead confirme el aterrizaje antes.
