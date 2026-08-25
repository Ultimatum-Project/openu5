# Diagnóstico: piel «smooth» (shader/xBR) × layout PARTIDO (portrait cuadrado)

**Carril:** `skin/smooth-portrait-invest` (worktree `.claude/worktrees/smooth-invest`, base
`skin/portrait-cont` @ `bbe2b315`). **Fecha:** 2026-07-27. **Encargo:** DIAGNÓSTICO, no arreglo.

**Instrumento:** dev server propio `:5231` con `cacheDir` propio, 1 navegador Chromium
headless, emulación iPhone 15 (393×852, dpr 3, `pointer:coarse`). Cero suite e2e, cero
proceso ajeno tocado. Scripts y capturas en el scratchpad de la sesión (no versionados).

---

## 0. TL;DR de la adjudicación

**La imposibilidad de tener smooth+partido es una GUARDA DELIBERADA**, declarada por
escrito en dos sitios (`game/src/main.ts:3562-3568` y `docs/portrait-landing-declaracion.md:282`)
y **verificada en vivo**: por el camino «bueno» (drawer ⚙ → `selectSkin`) la degradación
ocurre y es HONESTA — apaga la preferencia de layout, de modo que el botón ▤ refleja el
estado real.

**Pero lo que el usuario reportó NO es esa guarda: son TRES DEFECTOS encima de ella**, y el
central es que **en móvil el único camino de piel visible NO pasa por la guarda**. El
ítem «◧ Skin» del menú ☰ del deck está cableado a `press("F9")`
(`game/src/ui/touch.ts:581`), que va a `swapSkin()`/`SkinManager.toggle()` en vez de a
`selectSkin()`. Ese camino desmonta el envoltorio EN SILENCIO y deja la preferencia
`u5.layoutPartido` sin escribir — que es exactamente el defecto que el docstring de
`selectSkin` dice haber arreglado, arreglado sólo para el FAB y el drawer.

Y hay una **corrección de tamaño del ticket**: el ticket declarado dice que alojar la
shader «exige exponerle `consoleScrollActive`» (un getter, «ticket menor»). Son **cinco
miembros**, y además hay un segundo bloqueo MEDIDO que el ticket no recoge: alojada en un
host oculto 0×0, la shader colapsa su backbuffer a ×1 y el pase xBR deja de suavizar.

---

## 1. Secuencia reproducida (estados observados)

Arranque limpio (`localStorage` vacío) en `/?nointro&reflow=cuadrado`, iPhone 15.

Detección de estado: `.portrait-skin` en el DOM ⇒ envoltorio partido montado;
`.shader-skin` ⇒ piel shader montada.

### (a) Desde el PARTIDO, ☰ → «◧ Skin» (el único camino de piel en móvil)

| # | acción | piel viva | layout vivo | `u5.skin` | `u5.layoutPartido` |
|---|--------|-----------|-------------|-----------|--------------------|
| 0 | boot `?reflow=cuadrado` | FIEL | **PARTIDO** | `null` | `null` |
| 1 | ☰ → ◧ Skin (1ª) | FIEL | **CLÁSICO** | `faithful` | **`null`** ← no se escribe |
| 2 | ☰ → ◧ Skin (2ª) | **SHADER** | CLÁSICO | `shader` | **`null`** |
| 3 | ☰ → ◧ Skin (3ª) | FIEL | CLÁSICO | `faithful` | **`null`** |

Lectura: la 1ª pulsación **no cambia de piel**, cambia de LAYOUT (cae al clásico con la
misma piel 1988) — literalmente lo que reportó el usuario. Y el envoltorio **nunca vuelve**
por este camino: el ciclo sólo recorre `{faithful, shader}`. La preferencia queda en `null`,
es decir «quiero el partido», mientras la pantalla muestra el clásico: **preferencia
desincronizada de la realidad**.

### (b) Con SHADER puesto en el clásico, ☰ → «▤ Layout»

| # | acción | piel viva | layout vivo | `u5.skin` | `u5.layoutPartido` |
|---|--------|-----------|-------------|-----------|--------------------|
| 4 | (estado de partida) | SHADER | CLÁSICO | `shader` | `null` |
| 5 | ☰ → ▤ (1ª) | **FIEL** | CLÁSICO | `faithful` | `0` |
| 6 | ☰ → ▤ (2ª) | FIEL | **PARTIDO** | `portrait` | `1` |

Lectura: la 1ª ▤ **no mueve el layout y MATA la piel smooth**. Es la consecuencia directa
de la desincronización de (a): el handler lee la preferencia (`null ?? true` = «partido»),
la niega a `false`, y `toggleLayoutPartido` concluye «el jugador quiere el clásico» → salta
a `faithful`. Un toque desperdiciado que además destruye la elección de piel. La 2ª sí
devuelve el partido, ya con la fiel.

### (c) Recarga con `u5.skin=shader` + `u5.layoutPartido=1`

| # | acción | piel viva | layout vivo | `u5.skin` | `u5.layoutPartido` |
|---|--------|-----------|-------------|-----------|--------------------|
| 7 | recarga `?nointro&reflow=cuadrado` | **FIEL** | PARTIDO | `shader` | `1` |

Lectura: la preferencia de piel persistida se **ignora en silencio** cuando gana el
partido. El `localStorage` dice `shader` y el jugador ve 1988.

### (d) Camino «bueno» — drawer ⚙ → `selectSkin` (contraste)

| # | acción | piel viva | layout vivo | `u5.skin` | `u5.layoutPartido` |
|---|--------|-----------|-------------|-----------|--------------------|
| 0 | boot | FIEL | PARTIDO | `null` | `null` |
| 1 | ⚙ → «Skin: Shader (xBR)» | **SHADER** | CLÁSICO | `shader` | **`0`** ← sí se escribe |
| 2 | ⚙ → «Skin: 1988 (fiel)» | FIEL | CLÁSICO | `faithful` | `0` |

Lectura: **aquí la guarda funciona como está documentada**. Degrada al clásico (no puede
alojar la shader) pero lo hace apagando la preferencia, así que el ▤ queda honesto y una
sola pulsación devuelve el partido. La diferencia con (a) es todo el defecto.

Resultado neto en las cuatro vías: **smooth+partido es inalcanzable**. Correcto por diseño
(guarda), pero por el camino de móvil se llega ahí de forma engañosa y con daño colateral.

---

## 2. Cadena de decisión derivada del código

### 2.1 Elección de layout

- Preferencia persistida `u5.layoutPartido` (`LAYOUT_KEY`), leída/escrita en
  `game/src/skin/portrait/deck-nativo.ts:75,79,89`.
- Bandera de URL `?reflow=cuadrado` → `reflowFlag()` en
  `game/src/skin/portrait/skin.ts:96-108`.
- El envoltorio se INSTANCIA sólo si `quiereLayoutPartido` (`game/src/main.ts:4259-4266`) y
  se registra `userFacing:false` (`game/src/main.ts:4277-4280`) — **fuera del ciclo F9 y del
  switcher**. Esto último es la causa mecánica del punto 2.3.
- Arranque: `game/src/main.ts:4479-4480`
  ```ts
  const arrancarPartido = layoutPartidoGuardado() ?? reflowMode !== "off";
  await skins.swap(portraitSkin && arrancarPartido ? portraitSkin.id : bootSkin);
  ```
  ⇒ **`bootSkin` (la preferencia de piel) se descarta cuando gana el partido**. Testigo (c).

### 2.2 Montaje de la piel y qué aloja el envoltorio

- `PortraitSkin` aloja una instancia **fija** de la fiel: `private readonly faithful = new
  FaithfulSkin();` — `game/src/skin/portrait/skin.ts:157`. No hay inyección: el envoltorio
  no puede alojar otra cosa por construcción.
- La monta en un host **oculto 0×0** y le roba el canvas 320×200 como FUENTE de píxeles:
  `game/src/skin/portrait/skin.ts:203-213`.
- Recompone con 6-9 `drawImage` de rects en coordenadas 320×200:
  `present()` en `game/src/skin/portrait/skin.ts:485-541`, `blit()` en `:704-712`.

Lo que `PortraitSkin` consume del alojado (los cinco miembros):

| miembro | uso en `portrait/skin.ts` | ¿lo publica `ShaderSkin`? |
|---|---|---|
| `consoleScrollActive` | `:428`, `:491` (enruta la costura de la fila 10) | **NO** |
| `sourceFrameGen` | `:490` (gate de suciedad del present) | **NO** |
| `panelListOpen` | `:746` (hit-test del panel) | **NO** |
| `consoleScrollLines(n)` | `:296`, `:322` (rueda/arrastre del log) | **NO** |
| `panelScrollLines(n)` | `:295`, `:321` | **NO** |
| `transiting` | `:198` | SÍ (`shader/skin.ts:363`) |
| `mount`/`unmount` | `:212`, `:381` | SÍ (interfaz `Skin`) |

Superficie pública completa de `ShaderSkin`: `id`, `transiting`, `mount`, `unmount`
(`game/src/skin/shader/skin.ts:353,363,606,2530`). Los cinco de arriba existen como
`private readonly faithful` dentro de ella (`shader/skin.ts:356`) pero no se reexportan.

### 2.3 Los tres puntos EXACTOS donde se pierde la combinación

**PUNTO 1 — el camino de piel de móvil no pasa por la guarda.**
`game/src/ui/touch.ts:581`:
```ts
mkShellItem(() => "◧ " + ts("Skin"), "Skin", () => press("F9"));
```
`F9` → `swapSkin()` (`game/src/main.ts:3529-3536`) → `SkinManager.toggle()`
(`game/src/skin/manager.ts:125-140`):
```ts
const idx = this.userOrder.indexOf(this.current.id);
return this.swap(this.userOrder[(idx + 1) % this.userOrder.length]!);
```
Con el envoltorio montado, `this.current.id === "portrait"`, que **no está en `userOrder`**
(registrado `userFacing:false`) ⇒ `indexOf` da `-1` ⇒ `(-1+1) % 2 === 0` ⇒ salta a
`userOrder[0]` = **`faithful`**. El comentario de `toggle()` describe ese `-1` como
comportamiento intencionado para «la actual no es user-facing (p.ej. dev vía `?skin=dev`)»,
pero con el envoltorio significa: **desmonta el layout partido y deja la preferencia
mintiendo**. Testigo: fila 1 de la tabla (a).

Y este camino es el ÚNICO visible en móvil: el FAB ◧ se oculta con
`display:none !important` en táctil — `game/index.html:690`
(`html.u5-touch .u5shell-gear, html.u5-touch .u5skinsw, html.u5-touch .u5langsw`), decisión
del «ruling apaisado #5» (`game/src/ui/touch.ts:530-534`). **Medido**: `.u5skinsw` presente
con clase `visible`, `getComputedStyle().display === "none"`, rect `0×0`.

**PUNTO 2 — ▤ toggle-a-ciegas de una preferencia posiblemente rancia.**
`game/src/main.ts:4273-4276`:
```ts
installLayoutToggleButton(() => {
  guardarLayoutPartido(!(layoutPartidoGuardado() ?? true));
  toggleLayoutPartido();
});
```
Niega la PREFERENCIA, no el layout VIVO. Si el punto 1 la dejó rancia, la 1ª pulsación es
un no-op de layout y una destrucción de piel. Testigo: fila 5 de la tabla (b).

**PUNTO 3 — el arranque tira `u5.skin`** cuando gana el partido (`main.ts:4480`, §2.1).
Testigo: fila 7 de la tabla (c).

### 2.4 La guarda deliberada, para que conste

`game/src/main.ts:3562-3568` (docstring de `selectSkin`), literal:

> LÍMITE DECLARADO: el envoltorio hoy sólo puede alojar la FIEL — la shader no expone
> `consoleScrollActive`, que el layout necesita para enrutar la costura. Así que elegir
> «shader» SÍ sale del layout partido, pero ya no en silencio: se apaga la preferencia, de
> modo que el botón ▤ refleja el estado real y el jugador puede volver con un toque.

Implementado en `game/src/main.ts:3582`: `if (partido && id !== portraitSkin!.id)
guardarLayoutPartido(false);`. **Verificado en vivo** — tabla (d). Y en
`docs/portrait-landing-declaracion.md:282-287` como cola declarada, «ticket menor».

`data-shell-skin` (`applyShellTheme`, `game/src/ui/shell/theme.ts`) resultó **no ser parte
del mecanismo**: es sólo tematización del drawer y siguió a la piel correctamente en las
siete transiciones. Descartado como sospechoso.

---

## 3. Adjudicación

**GUARDA DELIBERADA en cuanto al fondo; BUG en cuanto al camino de móvil.** Las dos cosas,
sin empatar:

1. Que smooth+partido no exista **es guarda**, declarada por escrito antes del reporte y
   coherente con el código (el envoltorio sólo puede alojar la fiel: `portrait/skin.ts:157`).
   No es una carrera ni una regresión.
2. Que desde móvil se llegue ahí **de forma engañosa es bug**, con tres manifestaciones
   independientes y todas medidas: degradación silenciosa sin escribir la preferencia
   (punto 1), la ▤ que gasta un toque y mata la piel (punto 2), y `u5.skin` ignorado al
   arrancar (punto 3). No son «la guarda vista de cerca»: por el camino del drawer, la
   MISMA guarda se comporta bien.

**Evidencia de que 2 es bug y no diseño:** el docstring de `selectSkin` declara que el
arreglo consiste precisamente en no degradar en silencio. `selectSkin` lo cumple; el ítem
«◧ Skin» del deck no lo llama. Es un call-site que se quedó fuera del arreglo, no una
decisión distinta.

**Corrección al ticket declarado.** `docs/portrait-landing-declaracion.md:282` dice «exige
exponerle `consoleScrollActive`» y lo llama ticket menor. Está **infra-dimensionado**: son
cinco miembros (§2.2) y, sobre todo, hay un segundo bloqueo que el ticket no menciona:

> **MEDIDO (probe3):** con la shader montada normalmente en móvil su backbuffer es
> **640×400** (escala entera ×2, de `container.clientWidth` 393 →
> `Math.ceil(393/320)` = 2 — `game/src/skin/shader/skin.ts:678-698`). Al mover su
> contenedor dentro de un host `width:0;height:0` (exactamente como `PortraitSkin` aloja a
> la fiel, `portrait/skin.ts:206-210`) y disparar `resize`, el backbuffer **colapsa a
> 320×200** = ×1.
>
> Consecuencia: alojar la `ShaderSkin` con el patrón actual daría xBR a ×1, o sea **cero
> suavizado**. Exponer los getters no basta; hay que darle al host un tamaño real (o un
> canal para forzar la escala).

Lo que SÍ juega a favor: la geometría es compatible. El backbuffer de la shader es
`SCREEN_W*s × SCREEN_H*s` (`shader/skin.ts:280,697-700`), el MISMO layout 320×200 escalado
por un entero, así que los rects fuente de `blit()` sólo necesitarían multiplicarse por `s`.

---

## 4. Propuesta de arreglo, dimensionada

Tres lotes independientes. **Los dos primeros no tocan el ticket `consoleScrollActive`.**

### LOTE A — honestidad del camino de móvil (RIESGO BAJO, ~15 líneas)

Cierra el reporte del usuario tal y como lo vivió, sin habilitar smooth+partido.

- `game/src/ui/touch.ts:581`: que «◧ Skin» deje de ser `press("F9")` y llame al mismo
  `selectSkin` que el FAB y el drawer. Dos formas: (i) inyectar las deps del switcher en el
  deck y abrir la MISMA lista de pieles que `.u5skinsw-menu` (coherente con que el ítem se
  llama «Skin», no «cambiar piel»); o (ii) mínimo: exponer un `swapSkinUserFacing()` que
  ruta por `selectSkin(siguiente)` en vez de por `toggle()`. La (i) es la que además arregla
  que un ciclo de 2 pieles se recorra a ciegas en un menú que ya lista opciones.
- `game/src/main.ts:4273-4276` (handler ▤): decidir por el LAYOUT VIVO
  (`skins.currentId === portraitSkin.id`) en vez de por la preferencia, y escribir la
  preferencia a partir de esa lectura. Deja de existir el toque desperdiciado aunque algún
  otro camino vuelva a desincronizar.
- `game/src/main.ts:4480` (arranque): con el partido ganando, seguir montando el envoltorio
  pero **no descartar `bootSkin` en silencio** — o se respeta (imposible hoy, ver lote C) o
  se normaliza `u5.skin` a la piel realmente montada, para que el `localStorage` no mienta.

Riesgo: bajo y acotado a UI de shell. **No** toca `skin/fiel/` ni el pixel-diff. Cuidado
declarado: `main.ts:3573` (`if (partido && id === "faithful" && skins.currentId ===
portraitSkin!.id) return;`) hace que pedir «1988» desde el partido sea un no-op — si el
ítem del deck pasa a listar pieles, el usuario podrá pulsar «1988» estando en el partido y
no pasará nada visible; conviene marcar el ítem activo como el que ALOJA el envoltorio.

### LOTE B — decir la verdad en la UI (RIESGO NULO, ~5 líneas)

Mientras smooth+partido no exista, que la lista de pieles del partido no ofrezca «Shader»
como si fuera un cambio de piel: rotularlo «Shader (xBR) — sale del layout partido» o
pedir confirmación. Cuesta un `ts()` y cierra la sorpresa aunque el lote C nunca se haga.

### LOTE C — habilitar de verdad smooth × partido (RIESGO MEDIO-ALTO, NO es «ticket menor»)

Sólo si el usuario lo quiere como funcionalidad. Dos sub-problemas, en este orden:

1. **Superficie** (mecánico): publicar en `ShaderSkin` los cinco miembros de §2.2 como
   passthrough a su fiel interna, y extraerlos a una interfaz (`HostableSkin`) que
   `PortraitSkin` reciba por inyección en vez del `new FaithfulSkin()` de
   `portrait/skin.ts:157`. ~40 líneas, sin riesgo de píxel.
2. **Escala** (el que el ticket no vio): la shader alojada necesita un host DIMENSIONADO,
   no 0×0, o un `setScale(s)` explícito. Y `blit()` (`portrait/skin.ts:711`) necesita un
   factor `srcScale` sobre `sx/sy/sw/sh`. Aquí está el riesgo real: hay que decidir a qué
   escala renderiza la shader cuando su consumidor es un composer que reparte la imagen en
   regiones de escalas DISTINTAS (`mapScale` ≠ `bandScale`, ver `paintSeparators`), y hay
   coste de memoria/GPU de un backbuffer grande oculto. Los separadores blancos, el
   hit-test (`hitOf`) y `paintSeparators` leen coordenadas 320×200 y todos habría que
   revisarlos.

Estimación honesta del lote C: **no cabe en una tanda corta**, y merece su propio estudio
de diseño antes de tocar código — el mismo tratamiento que tuvo `portrait-reflow-estudio.md`.
Alternativa a valorar en ese estudio: en vez de anidar pieles, aplicar el upscaler xBR sólo
al pane del MAPA dentro del composer del portrait (el crop del viewport de la shader ya es
176×176, `shader/skin.ts:665-667`), renunciando a la fuente HD y al chrome vectorial. Es
menos «shader» pero es donde vive casi todo el suavizado percibido.

### Recomendación

**A + B ahora** (cierran el reporte del usuario, riesgo bajo, sin habilitar nada nuevo);
**C sólo bajo encargo explícito y con estudio previo**, y con el ticket de
`docs/portrait-landing-declaracion.md:282` re-dimensionado — porque hoy dice «menor» y
promete algo que un solo getter no entrega.

---

## 5. Lo que este diagnóstico NO cubre

- **Apaisado**: todo lo medido es vertical (iPhone 15 portrait). La rama de apaisado del
  layout cuadrado (`landscapePanes`, `layout-cuadrado.ts:163`) no se ejercitó.
- **Escritorio**: el FAB ◧ sí es visible sin `u5-touch`, y ahí el camino es `selectSkin`
  (el bueno). No se midió: el reporte era de móvil.
- **La variante «banda»** (`?reflow=auto|force`): sólo se midió `cuadrado`.
- No se ejecutó ni un test de la suite e2e, ni se tocó ningún proceso ajeno.
