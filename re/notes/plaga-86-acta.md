# #86 — Las 5 cadenas de plaga + el hueco del detector #47

Encargo en dos mitades: (1) adjudicar las 5 cadenas huérfanas de `es.json` declaradas por
frontera-73 en #74 (D2); (2) cerrar el hueco del detector de #47 que dejó que se escaparan.

**VEREDICTO CORTO.** Las 5 son **HUECO DEL PORT**, no familia-de-datos: su vía de emisión
existe en el original, está derivada del cuerpo entero y verificada byte a byte contra
`DATA.OVL`; el port no tiene el flujo. NO se implementa nada (es la pieza 6 del lote #54) y
NO se fabrica emisor. El detector tenía **cuatro** puntos ciegos, no uno, y las 5 los
delatan uno a uno: corregidos, el censo pasa de **12 huérfanos a 134**.

---

## 1. Las 5 — derivación verificada de nuevo, no heredada

Cuerpo entero `SJOG.OVL 0x01F2-0x02E9` (`search_remains_outcome`, `ret 4`) leído en
`re/disasm/SJOG.OVL.asm`. Los cinco call-sites y su verificación:

| cadena | call-site | DS | fileoff DATA.OVL | bytes leídos del binario |
|---|---|---|---|---|
| `Plague!\n` | 0x0224 | 0x8606 | 0x8616 | `b'Plague!\n\x00'` ✅ |
| `nothing!\n` | 0x0272 | 0x8610 | 0x8620 | `b'nothing!\n\x00'` ✅ |
| `worms!\n` | 0x027c | 0x861a | 0x862a | `b'worms!\n\x00'` ✅ |
| `guts!\n` | 0x0282 | 0x8622 | 0x8632 | `b'guts!\n\x00'` ✅ |
| `a bloody pulp!\n` | 0x0288 | 0x862a | 0x863a | `b'a bloody pulp!\n\x00'` ✅ |

**Consumo-como-puntero (regla de `verify_show`): satisfecho en los 5.** El idiom es
`mov ax, <DS>` / `push ax` / `call 0x58d0`, con los cuatro últimos compartiendo el tail de
`0x275`. `call 0x58d0` = `print_string` (kernel 0x1850) — atribución ya establecida en el
corpus (`camp-ambush-spec.md`, `overlay-load-layout.md`, `cannon-fire.md`, `klimb-grapple.md`,
`esc-sala-derivacion.md`, `anillos-nombres-cierre.md`). No es «el offset existe»: es el
offset empujado como único argumento del emisor.

**Doble comprobación independiente de los offsets.** Además de leer el binario, la
aritmética del volcado cuadra sola: el pool `textShopLookGather` arranca en fileoff `0x84de`
y, sumando `len+1` entrada a entrada, los índices 43/45/46/47/49 caen exactamente en
`0x8616/0x8620/0x862a/0x8632/0x863a`. Dos vías, mismo resultado.

**Careo con el port: el flujo no existe.** `game/src/core/world/search.ts` no modela los
kinds de cadáver (30/31); no hay `searchRemains` ni equivalente. Coincide con el veredicto
de #74 y con lo que el propio port declara en `core/sfx.ts:126` («SIN emisor hoy, flujo no
portado»). **No hay hueco de fidelidad que adjudicar: hay mecánica ausente.** Por eso el
veredicto por cadena es idéntico para las cinco, y por eso no hay fix calcable que quepa
aquí: portar esto es RNG (incluida la tirada ANIDADA que reutiliza el `0` de la pila),
reescritura del registro de actor y estado `'P'` — la pieza 6, fuera del encargo.

**Destino decidido: SE QUEDAN en `es.json`, como huérfanas CONSCIENTES.** Son traducciones
de cadenas reales del binario y son el corpus de la pieza 6; borrarlas tiraría trabajo y
volvería a dejar el hueco sin rastro. La marca NO va en prosa: va en
`re/ledger/orphan-strings.json`, con veredicto + cita + emisor + estado del port por cadena,
y el detector la lee para separar ADJUDICADOS de SIN ADJUDICAR. `es.json` no se toca (cero
riesgo de la trampa de clave duplicada).

## 2. El hueco del detector — eran CUATRO, y el «no se ha vuelto a correr» es falso

Lo primero, para descartar la hipótesis barata de #74: **el detector de `main` corre hoy sin
tocar nada y devuelve los mismos 12**. No es que no se hubiera re-corrido; es que las
exclusiones se las tragaban. Instrumentado clave a clave, cada una cayó por una rama
distinta — y ahí estaba la pista de que no había un defecto sino varios.

| # | defecto | delatora | medida |
|---|---|---|---|
| **A** | El **volcado del pool del binario** cuenta como «familia de datos». `game/assets/data.json` lleva `stringPools`: 22 volcados VERBATIM de `DATA.OVL`. El catálogo SALE de esos mismos pools ⇒ «está en assets» era casi tautológico con «está en el catálogo». | `Plague!`, `worms!`, `guts!`, `a bloody pulp!` — las 4 en el pool `textShopLookGather` (0x84de) | de los 22 pools, **sólo 2** se indexan (`main.ts` → `poolOf("introMenuU4Transfer")` / `("textCreateCharCmdsCrt")`). Los otros 20 son carga muerta. `textShopLookGather` y `textWorldCombatDungeon` **sólo aparecen en comentarios** de `commands.ts`/`hazards.ts` |
| **B** | «un literal de >3 caracteres DENTRO de la clave» absolvía la clave entera. No era composición: era lotería de subcadenas | `nothing!`, absuelta por `'nothing'` = el `case "nothing":` de `game.ts:4605`, un discriminante que nadie imprime | absolvía **1514 de 3998** claves (38 % del catálogo). Al exigir cobertura real sobreviven **2**. Otros ejemplares: `'A shame."'` por `'shame'`; `'…fine Arrows…'` por `'rows'` (dentro de «Arrows»); `'…two-handed Axe…'` por `'estr'` (dentro de «destruction») |
| **C** | `de_datos` comparaba **por subcadena contra un blob** de todos los assets, no por entrada | `nothing!`, absuelta porque `shoppe.json` trae «Thanks for nothing!» — el mismo falso positivo que #74 ya había descartado A MANO | lo que una tabla emite es la entrada ENTERA, no el fragmento ⇒ comparación por conjunto de entradas |
| **D** | sólo se escaneaba `game/assets`; las **10 tablas de `game/src/core/data/*.json`** (importadas y emitidas) eran invisibles | `Dagger`, `Halberd`, `Invisibility Ring`, `Leather Helm` | apareció como **falso positivo de mi propio arreglo B+C**, y lo cacé antes de dar el recuento por bueno leyendo `shop-console.ts:123-160` |

★ El D merece subrayado de método: el arreglo de B+C produjo 170 huérfanos, y 26 tenían
rastro textual en `game/src`. Revisarlos uno a uno —en vez de publicar el 170— es lo que
destapó que faltaba una fuente de datos entera. **El primer recuento de un instrumento
arreglado es del instrumento**, igual que el `'Hull now {}!'` de #47.

## 3. Efecto medido (mismo corpus, mismo día)

| bucket | #47 (main) | #86 |
|---|---|---|
| total catalogado | 3998 | 3998 |
| emitido exacto | 1194 | 1194 |
| clave dentro de literal | \* | 115 |
| compuesta (cobertura real) | \* | 2 |
| de datos | 1163 | 2553 |
| **HUÉRFANOS** | **12** | **134** |
| …con clase+cita en `approved-strings.json` | 0 | **0** |

\* #47 no separaba las dos ramas de composición: sumaba 1629 en `emitido_subcadena`.

**El dato caro no cambia: sigue habiendo CERO huérfanos con clase + cita.** Ningún string
que alguien declarara user-facing del core queda sin emitir. El sapo de #39 sigue sin
familia; lo que aparece es otra cosa —ramas sin cablear— y ahora se ve.

**Control positivo del arreglo, no pedido y por eso más valioso:** los 134 contienen, sin
que yo los buscara, tres poblaciones que el proyecto ya había adjudicado como no-cableadas
por vías independientes — los 3 anillos de #53, `mandrake root!`/`nightshade!`/` sprigs of\n`
de #91, y las 5 de #74. Un detector recalibrado que redescubre solo lo que otros carriles
derivaron a mano es un detector que mide lo que dice medir.

## 4. Corrección al acta de #47 (§3): 4 de los 9 «RUIDO» no eran ruido

#47 declaró RUIDO 9 huérfanos cortos «porque los 9 **sí están** en `game/assets`,
comprobado uno a uno». Estaban en el **blob** como subcadena, no como entrada. Con la
comparación por entrada:

- **5 sí eran datos de verdad** y ahora se excluyen por el motivo correcto: `Bat`, `Ah.`,
  `Oh.`, `Oh. `, `Hi,  `.
- **4 NO lo eran** y vuelven a salir: `Two`, `Six`, `Ten`, ` AM.\n` — y con ellos la familia
  entera de numerales en letra (`Three`…`Ninety`, `Second`…`Twelfth`, ` Hundred\n`), que es
  coherente con que `'Watch\n\nThe pocket watch reads '` también salga huérfana: el reloj
  deletreado no está portado. Eran una familia, y la guarda de 3 caracteres la partía.

La guarda `len(n) > 3` desaparece: existía sólo para tapar el defecto C.

## 5. Lo que NO afirmo

- **134 no es un número exacto**, es el recuento del criterio nuevo. Los 129 sin adjudicar
  **no están adjudicados**: nadie ha dicho todavía cuáles son sapo, cuáles rama sin cablear
  y cuáles ruido. Leerlos como «129 defectos» sería exactamente el error que este acta
  corrige en #47.
- **La regla de cobertura no es perfecta.** De las 2 claves que sobreviven como
  «compuesta», una es legítima (`Someone shouts` + `"FORTIS FORTUNA AVENTARI"`) y la otra es
  coincidencia (`foothills` = `foot` + `hills`). Queda declarado, no tuneado a ojo.
- **`emitted_literals()` sigue recogiendo TODO literal del código**, incluidos
  discriminantes de `switch`, claves de objeto y rutas de import. Literal-en-el-código ≠
  literal-EMITIDO; distinguirlos exige seguir el flujo hasta un `print`/`message`, y eso no
  está hecho. Es el techo real del instrumento, y el `case "nothing":` es su ejemplar.
- **Sólo se barre `game/src`**: un string emitido únicamente desde `game/e2e` o
  `game/tests` contaría como huérfano (ninguno de los 134 lo es).
- No afirmo nada sobre la calidad de las traducciones de las 5, ni sobre si portar la pieza
  6 es prioritario.

## 6. Predicciones falsables

1. Si alguien porta `search_remains_outcome` (pieza 6) emitiendo las 5 con `t()`, el censo
   baja de 134 a 129 y las 5 salen del ledger. Si baja de otra forma, algo se emitió mal.
2. Si se retiran del asset los 20 `stringPools` muertos (~carga muerta que nadie lee), el
   recuento de huérfanos **no cambia**: ya no participan en `de_datos`. Si cambiara, mi
   filtro de pools indexados está mal.
3. Ningún cambio futuro debería devolver `..con clase+cita` a un valor > 0 sin que alguien
   lo haya adjudicado antes; si aparece uno, es el perfil exacto del sapo de #39.

## 7. Cola que dejo (NO hecha)

- **Adjudicar los 129 sin adjudicar** — población de trabajo del género de #47. Se ven al
  menos cuatro familias coherentes: numerales en letra + reloj deletreado; diálogo de
  posada/taberna (`GUEST REGISTER`, la carta de vinos); mensajes de `Push`/`Pull`/`Disarm`;
  y los 3 anillos de #53 (ya adjudicados por su carril, pendientes de volcar al ledger).
- `re/notes/detector-huerfanas-47.md` conserva §3 y §4 con los números viejos: quien lo lea
  debe venir aquí. No lo reescribo yo (no es mi fichero de carril y el acta original tiene
  valor histórico), pero queda señalado.

## 8. Gates y procedencia

- `python3 -m pytest re/tools/test_detect_orphan_strings.py -q` → **EXIT 0**, 13 passed.
- **Failing-first demostrado**: el detector de `main`, con el mismo corpus, falla la
  GARANTÍA 1 con 5 de 5 (`no marca ['Plague!\n','nothing!\n','worms!\n','guts!\n','a bloody
  pulp!\n']`) y pasa los dos controles negativos — es decir, el test discrimina y no aprueba
  cualquier cosa. La regla vieja queda escrita dentro del test (`_regla_vieja`) para que la
  diferencia sea visible sin fiarse de este acta.
- `npx tsc --noEmit` en `game/` → **EXIT 0** (no se tocó TypeScript).
- Exits leídos SIN pipe.
- Binario: `original/u5/ultima5/DATA.OVL`. Disasm: `re/disasm/SJOG.OVL.asm`, cuerpo entero
  `0x01F2-0x02E9`. Búsquedas sobre el port con parseo en Python (no `grep -r`: los `.asm`
  del worktree son symlinks y `-r` los salta en silencio).
