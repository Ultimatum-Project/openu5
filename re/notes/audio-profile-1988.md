# Perfil de AUDIO FIEL de Ultima V DOS 1988 — ¿hay música de fondo? (task #27)

> Derivación ESTÁTICA (sin oráculo/DOSBox — otro carril tiene el emulador vivo). Cierra
> el reporte del usuario ("yo NUNCA escucho música de fondo en mi original; la canción de
> Iolo en camp SÍ suena"). Método: cita = fichero+offset del binario / ruta+línea del port.
> Fuentes cruzadas: `drivers-drv.md` (los 4 `.DRV`), `sfx-catalog.md` (familia PC-speaker),
> `audio-diff-calibration.md` (hardware del speaker), `intro-attract-loop.md` (idle del menú).

## 0. VEREDICTO

**En un PC estándar (lo que emula el DOSBox del usuario) Ultima V DOS 1988 NO tiene
música de fondo. NO existe ningún subsistema de música ni hardware de música en el juego.**
TODO el audio del original sale por el **PC-speaker** (PIT canal 2 + gate `0x61`): efectos
de sonido y alguna **melodía puntual, monofónica y dirigida por evento** (la canción de Iolo
al acampar, arpegios de aparición, fanfarrias). No hay pista continua/en bucle en ningún
sitio. **El bucle de música ambiental en OGG que reproduce el port es un añadido NO fiel**,
tomado de un parche XMI comunitario / versiones enriquecidas (Amiga/MT-32), no de lo que
producía el DOS-en-PC-estándar. Cinco pruebas independientes convergen (§1–§5).

La hipótesis del brief ("la música solo existía en Tandy vía T1K.DRV") queda **REFUTADA**:
`T1K.DRV` es un driver de **VÍDEO** (Tandy 1000, modo gráfico 9), no de sonido; y no hay
acceso al chip de sonido Tandy (puerto `0xC0`) en ninguna parte del binario (§1, §2).

---

## 1. Inventario de drivers — los 4 son de VÍDEO, ninguno de sonido

Los únicos drivers cargables del juego (`original/u5/ultima5/`) son **4, todos de vídeo**:
`CGA.DRV`, `EGA.DRV`, `HER.DRV`, `T1K.DRV`. Ya desensamblados y clasificados en
`drivers-drv.md` (task #16): ABI uniforme de 38 selectores de **primitivas de píxel**
(set-mode, set-color, línea, fill, blit de tile/imagen, texto). **Ningún selector de audio.**

- **`T1K.DRV`** (`drivers-drv.md §3`) = **Tandy 1000 VÍDEO**: `int 10h` modo **9** (320×200
  16 colores Tandy) + carga de paleta (`AH=10h AL=2`). Es el gemelo de `EGA.DRV` con otro
  mapa de memoria de vídeo. **NO toca el chip de sonido de 3 voces del Tandy** (SN76496,
  puerto `0xC0`) — es un driver gráfico. La hipótesis "T1K = Tandy con sonido" es falsa: el
  `T1K` del nombre es la plataforma, y este `.DRV` es su driver de **imagen**.
- CGA/EGA/HER: idem, gráficos puros (`drivers-drv.md §0.4`: "cero mecánica de gameplay,
  primitivas de píxel por hardware").

No existe ningún `SOUND.DRV`, `MUSIC.*`, `.SND`, `.MID`, `.XMI`, `.VOC`, `.SNG` ni tabla de
canciones en el directorio del juego (§4). El único hardware de audio del original es el
altavoz interno.

## 2. Barrido de I/O de hardware — SOLO PC-speaker en todo el binario

Enumerados TODOS los `out`/`in` a puerto en `ULTIMA.EXE` + los 24 overlays + los 4 `.DRV`
(`re/disasm/*.asm`). Los únicos puertos de audio tocados de forma recurrente:

| puerto | nº `out` | qué es |
|--------|---------:|--------|
| `0x42` | 14 | PIT canal 2 — contador de tono del **PC-speaker** |
| `0x61` | 19 | gate del **PC-speaker** (bits 0-1: enable timer + speaker) |

Casan exactamente con las primitivas ya derivadas (`sfx-catalog.md §1`: `set_tone` programa
`0x1234DE/freq → out 0x42`; el gate se abre/cierra con `out 0x61`). **Ausentes por completo**
(grep dirigido, vacío) los puertos de TODO chip de música de la época:

- `0xC0/0xC1` — **Tandy/PCjr SN76496** (3 voces): ✗ ninguno
- `0x388/0x389` — **AdLib / OPL2**: ✗ ninguno
- `0x220–0x22F` — **Sound Blaster** (DSP `0x22C`): ✗ ninguno
- `0x330/0x331` — **MPU-401 / MT-32 / General MIDI**: ✗ ninguno

Los `out` sueltos que aparecen 1 vez (`0x98/0xec/0xfc/0x74` en `FONT.OVL @0x94d`, `0x26` en
`ULTIMA.EXE @0x2709`, `0x16/0x17` en EGA/HER.DRV) son **ruido de desensamblado**: caen en
regiones de datos/jump-table mal-decodificadas como instrucciones (p.ej. `FONT.OVL @0x949`:
`nop; adc bh,ah; pop ax; out 0x98,ax; …; aam 0xe8; jmp 0xfffff326` — obviamente una tabla,
no código). Ninguno es puerto de música.

**Conclusión dura: el juego no habla con ningún sintetizador de música. Físicamente no puede
sonar música de fondo en el original.**

## 3. Flag global de sonido — uno solo, y es el del speaker

`sfx-catalog.md §1`: la única palanca de audio del binario es **`g_unk_a9ce`** (`[0xa9ce]`).
Si es 0, las primitivas hacen su bucle de temporización **sin abrir el gate** (silencio). Es
el toggle de "sonido on/off" del PC-speaker. **No hay un segundo flag de "música"** — porque
no hay música que apagar. (El port ya modela este toggle: F8 = speaker on/off, `speaker.ts`.)

## 4. Sin música de instalación/configuración — y confirmación de las versiones

`original/u5/ultima5/run.bat` (el lanzador del pack DOSBox del usuario) revela DOS builds:

```
Press 1 to play the original version   → cpu cycles=3000 → @ultima.exe     ← EL QUE JUEGA EL USUARIO
Press 2 to play the updated version    → cpu cycles=5000 → upgrade/ultima5.com
```

- **No hay `INSTALL`/`SETUP`/`.CFG` de sonido** para el original: se arranca `ultima.exe`
  directo, sin selección de hardware de audio (el vídeo lo autodetecta el boot; `drivers-drv.md
  §2.4`). `CHOICE.EXE` es solo el reemplazo Windows del comando DOS `choice` del `.bat`
  (PE32, `strings`: "Prompt string to display"), no un configurador.
- La **"updated version"** (`upgrade/ultima5.com`) es un build ENRIQUECIDO aparte. La música
  del port viene de ahí / de parches comunitarios, NO del `ultima.exe` de 1988. **Tell decisivo:
  el asset `game/assets/music/amiga.ogg`** — el port sirve música rotulada "amiga", i.e.
  proveniente de las versiones enriquecidas (Amiga/MT-32/XMI), no del PC-speaker del DOS.

## 5. La INTRO y el menú (idle) también son mudos de música

El brief pedía verificar la música del idle del menú (supuesta "rutina 0x2090"):

- **`0x2090`/`0x2092` NO es música: es `rand_range` (el RNG)** — `call 0x2092` aparece
  decenas de veces (`ULTIMA.EXE.asm`) y `sfx-catalog.md §3.7` lo cita como el RNG que consume
  `g_rng`. La hipótesis "música del menú en 0x2090" queda refutada.
- **`INTRO.OVL` emite CERO llamadas de speaker** (`sfx-catalog.md §2`): los SFX dramáticos de
  la intro (trueno, etc.) salen por el motor cinemático de `FONT.OVL` como **ráfagas
  one-shot** de PC-speaker (`FONT @0x3ca` = `noise_burst(20,60,10000)`), no una pista.
- El **bucle de attract del título** (`intro-attract-loop.md`, `INTRO.OVL 0x0aa1–0x0c97`) está
  derivado entero: compone logo + camina figuras + espera tecla. **No hay ni una llamada de
  sonido en el bucle.** El menú/attract idle es silencioso.

⇒ Ni in-game, ni intro, ni menú tienen música de fondo. Coherente con el testigo del usuario.

## 6. Lo que SÍ suena (y por qué el usuario oye la canción de Iolo)

El audio real del original, todo por PC-speaker, es **efectos + melodías puntuales por evento**
(catálogo completo en `sfx-catalog.md`). Las "melodías" son secuencias monofónicas one-shot,
no bucles de fondo:

- **Canción de Iolo al acampar / tocar instrumento**: `TOWN.OVL @0xe6d`, `tone_sweep` con nota
  de la tabla `[0x2746]` por tecla-dígito (`sfx-catalog.md §4.1`). Es lo que el usuario SÍ oye
  → confirma que su hardware reproduce las secuencias de speaker del juego, sólo que no hay
  ninguna capa de música continua que reproducir.
- **Arpegio de aparición del level-up de camp** (`OUTSUBS camp_results`, tabla `[0x3a26]`,
  `sfx-catalog.md §4.7`), **fanfarrias del endgame** (`ENDGAME @0x78f/0x987`), **drone del
  Shadowlord** (`TOWN @0x11e9`): todas TS monofónicas puntuales.
- **Ambiente por proximidad** (fuente/cascada/reloj): `ambient_sfx_tick 0x4102`, PC-speaker
  también (`ambient-audio-audit.md`). Es SFX ambiental, no música.

## 7. Auditoría del PORT — qué música añade que el DOS-en-PC no tenía

- **Assets**: `game/assets/music/*.ogg` (15 pistas: `theme, overworld, underworld, stones,
  castle, blackthorn, combat, dungeon, tavern, amiga, fanfare, greyson, ladynan, monarch,
  reunion`). `game/src/ui/music.ts:1-5` lo declara: *"Pistas OGG renderizadas del parche XMI
  comunitario"* → **fuente = MIDI/XMI comunitario, no el binario DOS**.
- **Motor**: `game/src/ui/music.ts` (`MusicPlayer`) — `HTMLAudioElement` en **bucle**
  (`next.loop = true`, línea 128) con crossfade de 1.2 s, volumen 0.55. Contexto por posición
  (`contextFor`, líneas 109-116: overworld/underworld/castle/blackthorn/dungeon/town).
- **Cableado** (`game/src/main.ts`): se instancia en la **raíz de composición**, no en la piel
  (`main.ts:388`), y arranca en `updateMusic()` (`main.ts:390`), combate (`:490`), dungeon
  (`:562`), título (`:579`). Toggle **F7** (`main.ts:1522-1531`). Default **ON**
  (`music.ts:45-51`, `MUSIC_STORAGE_KEY` = "1" salvo que se ponga a "0").
- **Consecuencia de fidelidad**: como vive en la raíz, la **piel fiel 1988 arranca CON música
  en bucle** (`main.ts:1523` lo dice: "Funciona en AMBAS pieles"). Eso es exactamente el
  añadido no-fiel que el usuario detecta: en su `ultima.exe` real ese bucle no existe.

Lista de lo que el port reproduce y el DOS-en-PC-estándar NO reproducía: **las 15 pistas OGG
en bucle**, en todos sus contextos (title/overworld/underworld/town/castle/blackthorn/combat/
dungeon/tavern). El original en esos mismos momentos está en silencio de música (sólo SFX de
speaker + melodías puntuales por evento).

---

## 8. PROPUESTA — "perfil de audio fiel" (NO implementar sin OK del orquestador)

Objetivo: que la **piel 1988** calque el hardware del usuario (PC-speaker, sin música de
fondo), y que la música quede como **opción explícita** (perfil "enhanced/QoL", no default de
la piel fiel). Nada de esto toca estado ni RNG del juego (la música ya es puramente
presentacional, skin-independent). Puntos a tocar, mínimos:

1. **`game/src/ui/music.ts` — default OFF en perfil fiel.** Hoy `musicEnabled()` es ON por
   defecto (línea 45-51). Opción A (mínima): que el default dependa del perfil de audio activo
   (fiel ⇒ OFF; enhanced ⇒ ON), leyendo la piel/preferencia actual en vez de un ON fijo.
2. **`game/src/main.ts` — gatear el arranque por perfil.** Las 4 llamadas `music.play(...)`
   (`:390/:490/:562/:579`) sólo deberían disparar si el perfil de audio ≠ fiel. Con la piel
   1988 activa, `MusicPlayer` no arranca ninguna pista (queda instanciado y disponible por si
   el usuario opta a "enhanced").
3. **Exponer el toggle como elección de PERFIL, no solo F7.** F7 ya existe (`main.ts:1522`) y
   se conserva (QoL, no pisa teclas del original: F1-F10 → "What?"). Añadir que el toggle /
   default se enganche al selector de piel: piel fiel ⇒ "sin música (1988)", piel dev ⇒
   "música enhanced (XMI/OGG)". Persistente en `localStorage u5.music` (ya está).
4. **NO tocar** `game/src/skin/fiel/speaker.ts` ni el catálogo de SFX: los efectos de
   PC-speaker SÍ son fieles y deben seguir sonando en la piel 1988 (incluida la canción de
   Iolo, fanfarrias, ambiente). El toggle F8 del speaker (`g_unk_a9ce` equivalente) se queda.

Resultado esperado: la piel 1988 suena **exactamente** como el `ultima.exe` del usuario —
efectos y melodías por evento del PC-speaker, cero música de fondo — y quien quiera la capa
musical la activa explícitamente (perfil enhanced / F7). Fidelidad por defecto, QoL por opción.

## 9. Cabo honesto

Este análisis es 100% estático + ficheros. Lo NO cubierto: si el original toca una **melodía
de título por PC-speaker** durante la intro cinemática (antes del menú) — el famoso tema por
altavoz — no se ha trazado su emisor (INTRO.OVL no emite; iría por FONT.OVL como secuencia de
`set_tone`). No cambia el veredicto (sería una melodía one-shot de speaker por evento, no el
bucle OGG del port, y no es "música de fondo in-game"). Si se quiere cerrar ese fleco: BP de
oráculo en `set_tone 0x22e2` durante la intro, o traza de la secuencia de FONT.OVL. Fuera del
alcance del reporte del usuario (que es sobre el juego, no la intro).
