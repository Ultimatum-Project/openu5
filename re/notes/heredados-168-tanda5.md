# heredados-168 · TANDA 5 — los 3 renombres, y el contador vuelve a decir la verdad

Carril `heredados-168` · 2026-07-28 · rama `re/frontera-verified-26`.
Contador `verified_inherited_without_cite`: **134 → 131**.

> Verificada con `re/tools/seed_diff.py` (que nace en esta tanda): 0 sembradas, 0 cambiadas.

---

## 1. Qué se ha hecho

Las tres filas que la tanda 2 dejó **con cita pero sin `verified`** —porque el cuerpo
refutaba su nombre— pasan a llevar el nombre correcto. Decisión del lead: **renombrar**, en
vez de añadir un campo `verified_refuted` al esquema.

| rutina | antes | ahora | qué estaba mal |
|---|---|---|---|
| `SJOG.OVL:0x1b6c` | `sum_flee_edges` | `count_live_sides` | no suma bordes ni tiene que ver con huir: cuenta bandos vivos |
| `ULTIMA.EXE:0x3f6e` | `los_opacity_test` | `los_transparent_test` | polaridad invertida: devuelve 1 para TRANSPARENTE |
| `ULTIMA.EXE:0x2bd4` | `tile_flag_bit` | `tile_passable_for` | devuelve el complemento del bit, y depende de un 2º tile |

Cada una lleva ahora `renamed_from` + `naming_verified` + `verified` y la cita nueva. **El
contador baja por la puerta de delante**: sin tocar `apply_manual`, sin campo nuevo, y
volviendo a significar «filas sin adjudicar» en vez de «filas sin `verified` manual».

### 1.1. La cadena de renombres, preservada

No sobrescribí el `renamed_from` que dos de ellas ya traían: lo encadené.

```
ULTIMA.EXE:0x3f6e   pacidad  ->  los_opacity_test  ->  los_transparent_test
ULTIMA.EXE:0x2bd4   kernel   ->  tile_flag_bit     ->  tile_passable_for
```

Y ahí se ve **por qué el renombre anterior no bastó**: los nombres de partida eran
`pacidad` (un fragmento de prosa truncado) y `kernel` (un marcador). El barrido de
2026-07-25 sustituyó basura por nombres legibles — pero **con el sentido del retorno al
revés en los dos casos**. Corregir la forma sin mirar qué devuelve el cuerpo deja el error
intacto con mejor aspecto.

### 1.2. ★ Enmienda declarada de las citas de la tanda 2

Las citas viejas decían literalmente «NO se acredita `verified`» y «TICKET DE RENOMBRE».
Dejarlas intactas con un `verified: true` encima habría convertido al ledger en una fuente
**que se contradice a sí misma a dos líneas** — exactamente el defecto que este carril lleva
todo el día encontrando en otros sitios. Sustituí **sólo la frase del veredicto** de cada
una (6 parches, contados por aserción en el script); la derivación, los offsets y los
hallazgos siguen intactos, y la enmienda queda declarada dentro de la cita nueva.

---

## 2. `re/tools/seed_diff.py` — el comprobador, ya no en un scratchpad

Mide qué **nombres siembra en el censo** un fichero de `re/notes/`, comparando
`build_name_seeds()` con y sin él. Sale a `0 / 0` o falla.

**Las cifras que justifican que exista**, todas del 2026-07-28:

| suceso | efecto |
|---|---|
| un párrafo editado en `kernel-sweep-3.md` | 7 semillas re-atribuidas entre ficheros; gate ROJO en main |
| el acta de prólogos-80 | re-sembró `ULTIMA.EXE:0x72fa` a `call`; 5º huérfano del día |
| **mis propias actas** | **8 nombres sembrados por accidente**, uno encima del nombre curado de `0x4dea` |

El caso que zanja el argumento: la frase que sembró `'menciona'` encima de CS `0x4dea` **era
la que documentaba este mismo defecto**. Yo conocía la convención, la estaba explicando por
escrito, y aun así la incumplí en la misma frase.

Y volvió a pasar **al escribir esta nota**: la primera versión del párrafo de arriba sembraba
`'sobre'` encima del nombre curado de esa misma rutina. La cazó `seed_diff.py` en su estreno,
sobre el acta que lo presenta. Van **tres veces la misma rutina**, las tres desde una frase
que hablaba del defecto. **La convención no basta; hace falta el gate.**

`test_seed_diff.py` trae **control positivo y negativo**, que es lo que separa un detector de
un adorno: una nota sucia fabricada a propósito tiene que salir en rojo, y la misma
información escrita con la convención no puede dar falso positivo. Sin haber visto el
detector ponerse rojo, el trinquete de las actas no valdría nada.

La **integración como gate del flujo** es de #84 (`frontera-26`), que lo recogerá de main:
aquí sólo entra el fichero nuevo y su test, que no toca instrumento compartido.

---

## 3. Estado del carril

**37 filas adjudicadas** en cinco tandas; contador **168 → 131**.
34 acreditadas · 3 renombradas-y-acreditadas · 1 nombre recortado (`0x4dea`) · 1 rescate
fuera de carril (`0x72fa`) · 2 merges de main resueltos por unión verificada.

**Quedan 131:** 18 del bucket FUERTE (lista por tamaño en la tanda 3 §3), 86 DÉBIL, 26 SIN
RASTRO. Los dos atajos ya pagados siguen en pie, y uno se cobró en la tanda 4: la predicción
sobre `COMBAT.OVL:0x13e2` se confirmó al leer el cuerpo.
