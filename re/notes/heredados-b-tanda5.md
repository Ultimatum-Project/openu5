# heredados-b · TANDA 5 — la fila de las once citas, y una disputa que no existía

Carril `heredados-b` · 2026-07-28 · rama `re/heredados-b`.
Contador `verified_inherited_without_cite`: **110 → 109**.

> Verificada con `re/tools/seed_diff.py`: 0 sembradas, 0 cambiadas.

Una sola fila, `DNGLOOK.OVL:0x117e` — la mayor de la clase, 562 B, con nota propia y con
media saga del proyecto encima. El lead avisó de que lleva once citas y de que es el caso
máximo de la variante 23 (*la lectura ya estaba en la fila misma*), así que la leí entera
antes de tocar el binario.

---

## 1. Las once citas están en DOS capas, y sólo cinco se ven desde la capa manual

Conté cinco y el lead decía once. **Los dos números eran correctos**: la capa manual
(`frontier-manual.json`) tiene **5**, y el ledger generado (`frontier.json`) agrega además
**6 automáticas** del barrido de notas, que no existen en el fichero que uno edita.

| capa | cuántas | de dónde |
|---|---|---|
| manual | 5 | `cbt-fila4-reconciliacion` ×2, `pin-anti-huerfano`, `dnglook-117e-body.md`, `gate-117e-adjudicacion` |
| automática | 6 | `cbt-unidades-0-0-y-cruce-movil.md` ×3, `sprite-frame-drop-…` ×2, `ring-expiry-derivation.md` |

**Antes de dar esto por bueno comprobé que no era una pérdida mía**: comparé el recuento de
la capa manual contra `main` y contra mi rama y salían **5 en las dos**, y `main..HEAD`
confirmó que no me faltaba ningún commit. La discrepancia era de capa, no de contenido.

⇒ **Regla para el relevo:** «leer todas las citas» significa leer **las dos capas**. Quien
mire sólo el fichero que edita se deja, en esta fila, seis de once.

---

## 2. El cuerpo confirma las once, sin corregir ninguna

Leído entero, `0x117e`-`0x13af`. No hay enmiendas que hacer; lo que sigue es la
confirmación, no un hallazgo:

- **El gate** (`0x1248`-`0x1266`): corre el bloque B si y sólo si `arg1>0` y
  (`arg1<3` o (`arg1==3` y `arg2>0xEF`)). Un `arg1` mayor que 3 tampoco corre.
- **El bloque A**: `0x1195` lo salta si `arg1==1`; el rumbo elige la fila (0 y 5 → 3,
  1 → 2, 3 → 1, el resto → 4); las columnas son **11** para la X y **17** para la Y sobre la
  base de la rejilla con paso de fila 32; y el bucle corre tantas veces como miembros tenga
  la party, escribiendo **con paso 8** en dos arrays de actores a la vez.
- **El bloque B**: dieciséis ranuras; fila 5 el sprite, fila 6 la X, fila 7 la Y; sprite
  cero salta la ranura; y el mecanismo `0xEC` completo — **cuatro tiradas pre-lanzadas**
  guardadas antes del bucle, de las que los dos bits bajos del sprite eligen una.

**★ De propina, una tercera confirmación independiente del eje.** El bloque A escribe la
columna 11 en `+2` del registro de actor y la 17 en `+3`. La tanda 7 de heredados-168 dejó
esos dos campos sin etiquetar por prudencia; mi tanda 2 los derivó desde el movimiento del
sobremundo; y esta fila, que es otro subsistema entero, los vuelve a fijar igual.
**Tres consumidores independientes, la misma asignación.**

---

## 3. ★★ La disputa de nombre no existía — y eso corrige una clase que abrí yo

En la tanda 2 abrí la clase «sellada por una fila que la llamaba otra cosa» y conté
**cinco**. Esta era la quinta: el anexo la llama `corridor_sprite_overlay` y el ledger
`cbt_scene_populate`.

**No son dos fuentes en desacuerdo.** `corridor_sprite_overlay` **era el nombre del
ledger**, y el lead ya lo renombró por cuerpo. La prueba está en una de las seis citas
automáticas: `ring-expiry-derivation.md:160` escribe literalmente
«`corridor_sprite_overlay` (ledger, verified)». El anexo es una **instantánea congelada de
antes de la corrección**.

⇒ La clase queda en **cuatro desacuerdos vivos y un desfase temporal**. Lo corrijo aquí
porque el error era mío: agrupé por síntoma —dos cadenas distintas— sin comprobar si una de
ellas era la otra en un momento anterior.

Y hay una lección de método que no es sólo contable: **cuando una fila lleva mucha historia,
«el anexo dice X y el ledger dice Y» puede significar simplemente que el anexo es más viejo
que la corrección.** Antes de tratarlo como conflicto hay que datar las dos cadenas.

---

## 4. Una nota que sigue contradiciendo a su propia corrección

`ring-expiry-derivation.md:165` afirma todavía que «los dos sitios llaman con argumento
≠ 1». La cita `gate-117e-adjudicacion` estableció por censo que los call-sites son
**cuatro**, y que los dos que faltaban están en la escena de campamento y son justo los que
**no** aplican el gate.

La corrección existe y está en el ledger; la nota que la contradice sigue viva. **No la
toco** —no es mi fichero y no es mi carril—, pero queda anotada en la cita de la fila para
que quien lea la nota encuentre el desmentido.

---

## 5. Estado

**22 filas adjudicadas** en cinco tandas; contador **128 → 109**.

**Reparto medido el 2026-07-28 a las 09:34 UTC**, antes de esta tanda y sobre 110 filas:
**18 FUERTE · 74 DÉBIL · 18 SIN RASTRO**, cinco de los fuertes por el canal de rangos.

**Cola:** `DNGLOOK.OVL:0x6a8`, el gem de mazmorra —hermano de la familia de la tanda 1 y
confirmado por el lead—, y después los fuertes por tamaño. De la clase anexo-contra-ledger
ya no queda ninguna.
