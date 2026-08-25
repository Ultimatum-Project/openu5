# El RUMOR de taberna (#320) — SHOPPES2.OVL:0x0508, cuerpo entero y sus SEIS tablas

Ficha #320 del censo de paridad por escenas (#278): «la taberna COBRA el rumor y no lo
dice — el port devuelve la cadena literal *Rumor has it...*». Esa cadena **no existe en
el binario**: es una fabricación del clon (estaba en `approved-strings.json` con clase
`[C]`, «texto sin transcripción»). Aquí queda derivado lo que el original hace de verdad.

Base de lectura: `SHOPPES2.OVL:0x0508-0x0663` (348 B, 139 insn, `ret` pelado), leído
entero. El cuerpo ya estaba sellado por asm-shoppes tanda 11 (`asm-shoppes-acta.md` §46,
§48) y esta nota **no lo contradice**: lo completa con las tablas, que el §49 dejó
explícitamente sin derivar («no he derivado las tablas … las uso por su rol»), y con dos
correcciones de corpus.

## 1. Las SEIS tablas, transcritas de DATA.OVL

Régimen de lectura: `fileoff = DS_off + 0x10` (cabecera MZ-overlay de 3 reubicaciones;
`re/tools/dataovl_catalog.py` cabecera). Todas leídas de `original/u5/ultima5/DATA.OVL`.

| tabla | DS | forma | contenido |
|---|---|---|---|
| claves | `0x4C74` | 26 punteros → `0x9CD4`, stride 6 | `hone comp valo just sacr hono spir humi dece desp dest wron cove sham hyth crow scep amul fals hatr cowa astr oppr brit resi unde` |
| precios | `0x4D10` | 26 words | `50 75 50 50 75 75 25 50 100 150 75 150 75 100 100 200 200 200 250 250 250 100 50 50 200 100` |
| sujetos | `0x4CA8` | 26 punteros → `0x9D70`… | `Malik Greyson Trian Jeremy Rew Gruman Saul Shirita Malifora Annon Trian Felespar` · `the mother of Rew` · `Sindar Kaiko Terrance Greymarch` · `Simon and Tessa` · `Shalineth` · `a daemon` · `Lord Malone Zachariah Tactus` · `a daemon` · `Terrance Jotham` |
| mapa de cotilleo | `0x4CDC` | **26 bytes** | `0 1 2 3 4 5 6 7 0 1 2 3 4 5 7 1 3 9 11 10 12 0 4 10 1 8` |
| plazas | `0x4CF6` | **13** punteros → `0x9E58`… | `Moonglow Britain Jhelom Yew Minoc Trinsic` · `Skara Brae` · `New Magincia` · `a lighthouse south of Britain` · `a hidden mountain keep` · `the desert` · `the Lycaeum` · `Serpent's Hold` |
| formulaciones | `0x4D44` | 4 punteros a SHOPPE.DAT | `0x13a2 0x13ae 0x13d9 0x13f3` |

🔴 **Las claves son de CUATRO letras, no palabras completas.** El port llevaba
`honesty/compassion/…`; el binario guarda `hone/comp/valo/…` con stride 6 (4 + NUL +
relleno). No es cosmético: cambia qué entradas casan (§2).

🔴 **La tabla de plazas tiene TRECE entradas y se indexa con el mapa de cotilleo, no con
el índice de clave.** Leerla con el índice de clave (0..25) se sale por el final: las
posiciones 13..25 de esa zona de DATA.OVL ya son otra tabla (los words que salen —
`0x32 0x4b 0x19 0x64 0x96` = 50/75/25/100/150 — tienen pinta de precios).

**Mapeo puntero → registro de SHOPPE.DAT**: por orden monótono del búfer (mismo método
que las anclas del astillero de `shoppe-greetings.ts`), con base 0 derivada del ancla
`0x18eb → 119` y **verificada con las otras seis anclas ya escritas en el port como
controles positivos** (`0x183e→117`, `0x188c→118`, `0x1a50→126`, `0x198e→122`,
`0x19ab→123`, `0x19da→124`; las seis cuadran). Resultado:

| puntero | registro | texto (decodificado en `shoppe.json`) |
|---|--:|---|
| `0x134E` | 84 | `«"Well now, my memory …» (107 B, sha1 f109ea25 — recortado; verifica contra tu copia)` |
| `0x13a2` | **85** | `"Seek ye & in *!"` |
| `0x13ae` | **86** | `"Rumour has it that &, who lives in *, doth possess such knowledge."` |
| `0x13d9` | **87** | `"It may be that &, of *, may be able to help thee!"` |
| `0x13f3` | **88** | `"Mayhap & in * wilt see fit to aid thee!"` |
| `0x146A` | 91 | `,\nI must attend my PAYING customers!"\nsays $.\n` |

Los cuatro registros de formulación son **consecutivos**, y su ORDEN en `0x4D44` es el
que indexa la tirada: `rand → 0` da el 85, `rand → 3` da el 88. Las longitudes en disco
(12/43/26 B entre punteros) no casan con las de `shoppe.json` porque los registros van
**comprimidos** (bytes ≥0x80 = palabra del diccionario `DS 0x23EA`, §50.1 del acta).

## 2. El matcher: la clave es la AGUJA, y la frontera es el carácter ANTERIOR

`0x0568-0x05a4`. Recorre las 26 entradas (`cmp di,0x1a` @`0x059f`) llamando a
`CS ULTIMA.EXE:0x6f1e stristr` con el búfer tecleado (`DS 0xBCF8`, 15 caracteres
@`0x053f`) como **pajar** y la clave de 4 letras como **aguja**. Se queda con la PRIMERA
que casa: el bucle no busca la mejor, así que el orden de la tabla decide los empates.

- `si == 0` (match al principio) → salta **directo** a la rama de acierto (`je 0x585` @`0x0578`).
- `si < 0` (no casa) → siguiente entrada (`jle 0x59a` @`0x057c`).
- `si > 0` → `cmp byte ptr [si - 0x4309], 0x20` @`0x057e`. Ese desplazamiento es
  `-0x4309` = `0xBCF7` en 16 bits sin signo, es decir **`byte[0xBCF7 + si]` = el carácter
  ANTERIOR al match** (el búfer empieza en `0xBCF8`). Acierta sólo si va tras un espacio.

⇒ La regla es **«la clave abre lo tecleado o va tras un espacio»**, la misma que el
keyword de conversación (#28). Consecuencias medibles: `honesty` y `honeymoon` compran
los dos el rumor de `hone`; `the crown` compra el de `crow`; `dishonesty` no compra nada.

🔴 **ERRATA DE CORPUS.** `re/ledger/frontier.json` (y su espejo `frontier-manual.json`,
fila `SHOPPES2.OVL:0x0508`) describen el predicado como «exigiendo que el carácter
**siguiente** sea espacio (0x057e)». Es falso, y no es un matiz: con claves de 4 letras
ese predicado haría **fallar `honesty`**, que es el caso central del subsistema. El acta
(§46) dice sólo «frontera de palabra (el byte comparado contra 0x20)» — verdadero pero
sin lado, que es como la errata sobrevivió. La dirección citada sí es la correcta.

## 3. La secuencia completa (lo que el port ahora emite)

Eco de la letra de la opción `[g_shop2_type + DS 0x4C30]` (@`0x0516`), y después:

```
DS 0x9EFC  '\n\n"'                                   (0x0520)
DS 0x9F00  'Of what wouldst\nthou hear my\nlore, '   (0x052a)  + sir/milady (call 0xac)
DS 0x9F24  '?"\n\nYou respond:\n'                    (0x0534)
           → input_string(DS 0xBCF8, 15)             (0x0543)
DS 0x9F36  '\n\n'                                    (0x0546)
```

- **Búfer vacío** → devuelve 0 sin más (`0x054d-0x0559`). Es la ÚNICA vía de escape, y
  **cuenta como servicio** (§47 del acta: el `0` cuenta, el `2` es el que no).
- **Sin coincidencia** → `DS 0x9F3A` `"That, I cannot help thee with.\n\n` y **vuelve al
  prompt** (`jmp 0x52a`, @`0x0598`). No hay salida por tecla: sólo aciertas o respondes vacío.
- **Con coincidencia** → precio `[idx*2 + DS 0x4D10]` → `g_shop_accum` (`0x05ab`),
  registro 84 por `shop_expand_and_print_template` (`0x05b2`) y `DS 0x9F5C` `\n\nFair 'nuff?" ` (`0x05b9`).
  Bucle que **sólo** acepta `Y` o `N` (`0x05c2-0x05d1`):
  - **`N`** → `DS 0x9F6C` `No\n\n` y devuelve 0 (rechazar el precio **también** cuenta
    como servicio).
  - **`Y` sin oro** (`g_shop_accum > g_gold`, `0x05f0`) → `DS 0x9F72` `Yes\n\n` +
    `DS 0x9F78` `"Sorry, ` + honorífico + registro 91, y devuelve **1**. **No cobra.**
  - **`Y` pagando** → `g_gold -= accum` (`0x0611`), `draw_status_panel` (`0x0615`), y
    publica el chisme por dos globales (§48): `[DS 0xAB00] = [idx*2 + DS 0x4CA8]` (sujeto,
    token `&`) y `[DS 0xAC62] = [[idx + DS 0x4CDC]*2 + DS 0x4CF6]` (lugar, token `*`);
    formulación `1-de-4` y cierre `DS 0x9F82` `\nsays ` + `[DS 0xAAFE]` + `DS 0x9F8A` `.\n\n`.

## 4. RNG — MUEVE EL STREAM

`0x0636-0x063d`: `push 0` · `push 3` · `call 0x3eb2` = **`rand_range(max=3, min=0)`**
(notación del ledger `(max, min)`, ficha #76 — los argumentos se apilan al revés y el
último apilado es el primero). **UNA tirada por rumor PAGADO**, y sólo ahí: las ramas
`N`, sin-oro, clave-fallada y búfer-vacío no tiran.

El clon no tiraba nunca en este camino ⇒ el fix **desplaza el stream** en toda partida que
compre un rumor. Ventana declarada en el merge. El sorteo va del stream VIVO
(`Game.shopGreetingRand`, ruling FIEL-TOTAL del 2026-07-22), igual que el saludo de
tienda y el pitch de raciones — no un generador aparte.

Cabo abierto, con su ALCANCE: el censo de #316 («el binario tira 17 veces en las tiendas
y el port CERO») queda con **UNA de esas 17 atribuida y cerrada** — ésta. Las otras
dieciséis **no se han re-medido aquí** y siguen exactamente como estaban: ni confirmadas
ni refutadas por este carril. Quien lea «#316 avanzó» no debe leer «#316 se cerró».

## 5. El token `*` de `shop_expand_and_print_template`

`shop_expand_and_print_template` (`CS SHOPPES.OVL:0x0026`) consume una familia de
ranuras; el §50.1 del acta las enumeró y cerró con «no he comprobado si el clon modela el
token `*` (lugar del chisme) y el `^` (cantidad)». Medido: el clon **no** modelaba el `*`
(`expandShoppeTemplate` cubría `& % ^ $ # @`). Añadido, con su único escritor —esta fila—
como justificación. El `^` sí estaba (pitch de raciones).

## 5-bis. El anuncio del precio es la MITAD RESTANTE de #17, no una ficha nueva

La ficha #17 se enunció como «al clon le falta el anuncio de precio ENTERO de la taberna»
y se cerró para **la cuenta de la taberna**. El registro 84 (`0x134E` @`0x05b2`,
`«"Well now, my memory …» (73 B, sha1 b33b531f — recortado; verifica contra tu copia)`) es el
anuncio de precio del **rumor**, que es el otro sitio donde el mismo hueco existía — y
que ese cierre no tocó.

⇒ Con este commit, #17 queda cubierta en sus DOS sitios. **No se reabre**: lo que faltaba
era este registro, y está puesto. Si alguien encuentra un tercer anuncio de precio sin
emisor en taberna, eso sería ficha nueva, no una reapertura de #17.

Y la razón por la que faltaba importa para no volver a perderlo: sin el registro 84, el
`Fair 'nuff?` que viene detrás pregunta por un precio que nadie ha dicho. Las dos piezas
sólo tienen sentido juntas — quien porte una sin la otra deja un diálogo que no cierra.

## 5-ter. 🔴 Instancia VIVA de #185 que esta nota destapó al escribirse

Escribir esta acta puso el trinquete de género en ROJO, y el diagnóstico no es el que
parece. Medido:

- `re/tools/test_genero.py::test_censo_completo_cero_falsos_positivos_en_tier1` pasa en
  main limpio (control en worktree `--detach` sobre `1e27b6c1`) y fallaba en esta rama
  con **12 disparos donde el trinquete clava 11**. El disparo nuevo era UNO: `expansor`.
- La causa inmediata era mía: la regla `r4b` exige `prose ≥ 20` **y** `nfiles ≥ 10`, y
  esta nota era el **décimo fichero** con la palabra en prosa desnuda. El corpus de prosa
  ignora lo que va entre backticks, así que citar la rutina por su nombre —
  `shop_expand_and_print_template` — devuelve el trinquete a 11. Eso está hecho.
- 🔴 **Pero el trinquete tenía razón sobre el fondo, y ese fondo es de main, no de esta
  rama**: `routine-census.json` lleva la fila `SHOPPES.OVL:0x26` con el nombre
  **`expansor`** — un sustantivo común castellano donde el propio acta de asm-shoppes
  (§50) la llama `shop_expand_and_print_template`. Es exactamente el mecanismo de #185
  (`build_name_seeds()` propone nombres desde el contexto de línea de `re/notes/*.md`):
  un nombre de rutina nacido de la prosa española, ya aterrizado en el censo.

⇒ Lo que esta nota arregla es **su propio disparo**; el nombre de la fila NO se toca aquí
(el censo es territorio de #135, donde regenerar es ADJUDICAR, no correr un script, y de
#80, que midió que el generador revierte anotaciones). Queda **reportado con la fila
exacta** para que #185 tenga por fin un caso con dirección y nombre, en vez de una clase
descrita en abstracto.

## 6. Lo que esta nota NO cubre

- **No he leído el cuerpo de `stristr`** (`CS ULTIMA.EXE:0x6f1e`): lo uso por su rol e
  identidad, resuelto en vivo. Su plegado `& 0x7F` / `0x5f` y el efecto sobre acentos son
  la ficha #51, ajena.
- **No he medido con oráculo**: todo lo de arriba es derivación estática (disasm + DATA.OVL
  + SHOPPE.DAT). Un testigo en DOSBox confirmaría la formulación sorteada y el orden, y
  **no se ha corrido**.
- **No he tocado el diccionario `DS 0x23EA`**: los registros de SHOPPE.DAT los leo ya
  decodificados de `shoppe.json` (extracción existente), no descomprimiéndolos yo.
- **La alcanzabilidad de cada clave no está censada**: las 26 tienen precio y sujeto, pero
  no he comprobado cuáles son pistas vivas de la trama y cuáles restos.
