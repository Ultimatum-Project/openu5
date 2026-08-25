# Testigos de saludos-shoppe (carril saludos-shoppe)

Derivación desde los dos walkthroughs DOS archivados (aulddragon 360p + Alex Diener 720p).
El PORT aún no emite el saludo del tendero (`@`=parte del día, `$`=nombre tendero, `#`=nombre
tienda, + eco `Yes\n\n` DATA.OVL 0x7a3c del Y/N). Estos testigos derivan lo que el ASM no da
barrido y confirman las plantillas de `game/assets/shoppe.json` con metodología F3-v2.

## Tabla de testigos (batch-1)

| Fuente | ts | Tipo tienda | # (tienda) | $ (tendero) | @ (parte-día) | Fecha en banda | Frame |
|---|---|---|---|---|---|---|---|
| auld P02 | 6:23 | Herrero | «The Arms of...» | chamfort | **morning** | — | blacksmith_morning |
| auld P02 | 10:03 | Taberna | Slaughtered Lamb | Duclas | **morning** («thy host this morning») | — | tavern_morning |
| auld P02 | 12:21 | Reactivos | Healers Herbs | Madam Pendra | **afternoon** | 4-6-139 | reagents_afternoon ✔ |
| auld P05 | 20:48 | Armas | Iolo's Bows | (Iolo) | **morning** | — | — |
| auld P05 | 27:57 | Taberna | Wafer Tavern | Tika | **afternoon** («jolly good afternoon mate») | — | — |
| AD 411 | 29:17 | Taberna | (Bucaneros) | Nikki | **morning** («may I serve thee this morning») | — | — |
| AD 406 | 26:40 | Gremio | (Nemesis?) | — | **evening** («evening to... can I show you fine Wares») | — | — |
| AD 48 | 19:16 | Posada | — | — | (servicios, @ no claro en sub) | — | — |

**@ observados: morning · afternoon · evening.**

## RESUELTO POR ASM (lead, 2026-07-22): tabla @ completa — la correlación por reloj SOBRA

La expansión `@` está DERIVADA del binario, no hacen falta más testigos de hora:

- Tabla de palabras: DATA.OVL `morning\0afternoon\0evening\0` @ **0x7836/0x783e/0x7848**
  (solo estas 3 — no existe «day»/«eve»/«night» para @).
- Umbrales (SHOPPES.OVL **0x00d8-0x00fa**, expansor de plantilla, compara `g_hour` 0x587f):
  `hour < 0x0c (12) → morning` (DS 0x7826) · `hour < 0x12 (18) → afternoon` (DS 0x782e) ·
  `resto (18-23) → evening` (DS 0x7838).
- Los 8 testigos del batch-1 son CONSISTENTES con la tabla (p.ej. Pendra 12:xx→afternoon).

QUEDA para testigos: (obj-#3) selección de variante — evidencia mismo-tendero-≥2-visitas —
y completar tipos sin testigo (caballos/barcos/curandero) para el careo F3-v2 de sus
plantillas. RESUELTO-PARCIAL el selector de variante (lead, adenda-2): SHOPPES usa el kernel
`rand(lo,hi)` = far-call **0x7E02** (identificado en re/notes/shops.md §0) para TODAS sus
elecciones aleatorias (14 call-sites en el OVL; p.ej. la despedida 0x1280 = rand sobre la
tabla 0x3d36, el «rand 1-de-4» de shoppe.json 4-7 que el port ya documenta). El saludo se
compone en un buffer (0x8018 en el herrero @0x12bc) por el setup de entrada — call-site
exacto del rand del saludo AÚN sin trazar, pero la familia es inequívoca: **consume el
stream VIVO del kernel** (como la merma post-compra, shops.md §0.3).

⚠️ NOTA DE PARIDAD PARA LA IMPLEMENTACIÓN: emitir el saludo con variante por `liveRng`
DESPLAZA la semilla en toda ruta que pase por una tienda — si algún sello/soak la cruza,
re-sellar o elegir variante SIN tocar el stream (divergencia Clase-C documentada) hasta
trazar el call-site exacto. Decisión del lead al implementar.

## Careo F3-v2 contra shoppe.json (plantilla citada)

- **Reactivos (Madam Pendra)**: `"«Hail, enchanter, and welcome …» (89 B, sha1 632a4f0f — recortado; verifica contra tu copia)"` = shoppe.json **variante 3 de reactivos** (líneas ~reagent-
  greeting). Sustituido (#=Healers Herbs, $=Madam Pendra, @=afternoon) → **(a) EMITIDA-EXACTA
  byte a byte** (frame confirmado). El port TIENE la plantilla en shoppe.json pero NO la emite
  = hueco «saludos-shoppe» (no ticket de texto: es implementación pendiente).
- **Taberna (Duclas)**: `"Welcome to #! My name is $, thy host this @?"` = variante 4 taberna → (a).
- **Taberna (Tika)**: `"Jolly good @, mate! Welcome to #! I am $..."` = variante 3 taberna → (a).
- **Taberna (Nikki, AD)**: `"Hail, friend! Welcome to #! I'm $, the barkeep. May I serve thee
  this @?"` = variante 1 taberna → (a).
- **Gremio (AD)**: `"...welcome to #! I am $, can I show ye our fine wares?"` = variante 1 gremio
  → (a) (pendiente confirmar $/# del frame).

**Veredicto batch-1: las plantillas de shoppe.json casan BYTE-EXACTO tras sustitución** en los
testigos con frame; el resto (sin frame) confirman el @ por transcripción, pendientes de frame.

## Objetivo #3 — selección de variante

Tres tabernas distintas → **tres variantes distintas** (Duclas=var4, Tika=var3, Nikki=var1).
Sugiere selección por-instancia (aleatoria 1-de-4). **PENDIENTE**: evidencia de un MISMO tendero
saludando ≥2 veces (¿cambia la variante entre visitas?) — no capturado aún.

## Batch-2 (2026-07-22, entregado por mensaje, integrado por el lead)

**Tipos nuevos con testigo:**

| Fuente | Tipo | # (tienda) | $ (tendero) | Plantilla | Veredicto |
|---|---|---|---|---|---|
| auld ~24:37 | Barcos | «rusty bucket» | Jones | shoppe.json[106] ««Ahoy, sailor! Welcome to …» (78 B, sha1 b0b719e1 — recortado; verifica contra tu copia)» (SIN @; verificado …» (341 B, sha1 a3141a57 — recortado; verifica contra tu copia)"» (SIN @; verificado por el lead) | (a) |
| auld 11:30 | Curandero | the spirit healers | Tempus | misma variante | (a) |

**Objetivo #3 (variante), señal nueva:** los 2 barqueros comparten variante y los 2 curanderos
también — consistencia POR TIPO entre tenderos DISTINTOS. NO descarta RNG-por-visita (falta el
par mismo-tendero-≥2-visitas, que sigue siendo el dato fuerte); compatible con rand 0x7E02
muestreando parejo.

**BONUS anotado (cola futura):** testigo de MUERTE en Alex Diener (~ep Deceit, «there's the
death sequence again… restore my previous save») → utilizable para el ítem muerte-para-LFSR
de la cola del usuario cuando toque.

## Batch-2 cierre (2026-07-22) — CARRIL DE TESTIGOS AGOTADO (límite del material)

- **Caballos (parcial)**: AD 18:06-18:37 — pitch de venta casa con shoppe.json (thoroughbreds/
  mountain breeds/high steps); el saludo con @ («Good @, weary travelers!…») no sale limpio
  en el sub. Pendiente frame para $/#.
- **Objetivo #3 = HUECO HONESTO DEL CORPUS**: barridos ambos walkthroughs, NINGÚN tendero
  saluda dos veces (las recompras de reactivos de AD son en pueblos distintos → tenderos
  distintos). La consistencia por-TIPO (2 curanderos misma variante, 2 barqueros misma) no
  distingue «fijo-por-instancia» de «RNG-parejo». ⇒ El selector queda en la derivación
  disasm como AUTORITATIVA (kernel rand 0x7E02, adenda-2); el corpus solo aporta «el pool
  se muestrea, sin default pegado».

**Censo final de testigos**: herrero, taberna×3, reactivos (byte-exacto), armas, gremio,
barcos×2 [106], curandero×2 [167], caballos (parcial), posada (parcial). @ 100% consistente
con la tabla ASM.

## ADENDA-3 (lead, 2026-07-22) — CALL-SITE DEL SALUDO TRAZADO: derivación COMPLETA

La rutina emisora del saludo es **SHOPPES.OVL 0x01b6**, instrucción a instrucción:

```
01b7  putchar 0x22                      ; comilla de apertura «"» del saludo
01c1  rand(0, 3)                        ; kernel 0x7E02 — 4 VARIANTES, índice 0..3, POR VISITA
01cc  bx = [0xb116]                     ; índice de tipo de tienda (global)
01d0  shl bx,3                          ; ×8 = 4 word-ptrs por tipo
01d4  push [bx + var·2 + DS 0x3b2a]     ; tabla 2D [tipo][variante] → nº de registro SHOPPE.DAT
01d8  call 0x017a                       ; carga el registro (loader 0xffff82de, buf 0xb21e,
                                        ;   max 0x5dc) y lo IMPRIME (call 0x26) — la impresión
                                        ;   expande $/#/@ (expansor 0x005b; @ = tabla 0x00d8)
```

CONSECUENCIAS:
- **La variante ES aleatoria POR VISITA**: rand(0,3) en el stream VIVO — resuelve el
  objetivo #3 que el corpus no podía (la consistencia-por-tipo observada era azar parejo).
- **4 variantes por tipo, no 3**: reactivos = shoppe.json **[127..130]** (el careo previo
  se dejaba la 127 «I, $, welcome those of wizardly power…»). Revisar el conteo de los
  demás tipos contra la tabla DS 0x3b2a (DATA.OVL 0x3b3a) al implementar.
- La implementación del port queda TOTALMENTE especificada: comilla + rand(0,3) + plantilla
  [tipo][var] + expansión $/#/@ (@ por g_hour: <12/<18/resto). ÚNICA decisión pendiente =
  paridad RNG (consumir el rand vivo como el original vs divergencia Clase-C documentada;
  ver nota de la adenda-2).

## Huecos residuales (menores, no bloquean implementación)

- @ limpio de caballos/posada — puramente confirmatorio.
- ~~Frame de barcos~~ **CERRADO**: `ship_jones.png` (auld P05 24:44) = shoppe.json[106] con
  #=«The Rusty Bucket», $=«Jones» → (a) EMITIDA-EXACTA byte a byte, frame-confirmado.
  BONUS farewell smithy careable: «"If'n ye haves need of a smithy, gimme a shout, matey!"»
  (frame salida de Buccaneers Booty). Curandero queda en (a)-por-plantilla (frame de Tempus
  descartado por el lead: puramente confirmatorio, plantilla ya verificada por índice [167]).

**Frame-byte-exacto conseguido en: reactivos (Pendra) + barcos (Jones).** Carril de
testigos saludos-shoppe EXPRIMIDO — cerrado.

## Método/régimen
Frames en `original/av-referencia/yt/.../` (gitignored). Este doc = tracked (docs/). Sin tocar
el port; el lead firma contra binario y aterriza.


## RULING DE PARIDAD RNG (lead, 2026-07-22) — FIEL-TOTAL, con ventana de re-sello

**Decisión: se consume el rand VIVO** (rand(0,3) del kernel 0x7E02 al entrar, como el
original). Razones: (1) el mandato es calco fiel — el original consume ese rand y cualquier
careo futuro con oráculo DOSBox por rutas con tienda exigiría la misma cadencia de stream;
(2) precedente firme: P0a/#13/latch/search-wrap también cambiaron digests y se re-selló.
La alternativa Clase-C (variante determinista sin tocar stream) queda RECHAZADA.

**Coste asumido**: los capítulos del grandtour que entran en tienda (ch03 Britain compra y
EXPORTA checkpoint encadenado; censar el resto con `grep -l shopConsole e2e/grandtour/`)
cambian de digest ⇒ VENTANA DE RE-SELLO de la cadena afectada: HOLD de flota (cero
playwright ajeno), re-run aislado byte-idéntico ×2 de todo .gam cambiado antes de commit
([[mutex-cadena-tour]] ampliación 2026-07-21). Momento óptimo: AHORA (ningún carril con
navegador en vuelo).