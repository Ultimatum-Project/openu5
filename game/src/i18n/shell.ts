/**
 * CAPA DE IDIOMA DEL SHELL (UI EXTERNO al juego) — SEPARADA del calco del binario.
 *
 * Los textos del shell moderno (menú SISTEMA, switchers ◧/idioma, botón ⚙, enlace
 * de ayuda) son CONTENIDO AUTORADO nuevo: NO salen del binario de EA. Por eso NO
 * viven en `es.json` — esa tabla está keyed por el corpus INGLÉS del original y la
 * guarda `i18n-manifest.test.ts §A` (anti-fabricación) exige que TODA su key exista
 * en el binario. Un string de shell ("System", "Video"…) no está en el binario, así
 * que pertenece a esta capa aparte.
 *
 * CONTRATO idéntico al de `i18n.t()` para que el shell y el juego se comporten igual:
 *   - `lang === 'en'`  ⇒ IDENTIDAD ESTRICTA (el inglés es la base autorada del shell).
 *   - `lang !== 'en'`  ⇒ `tabla[str] ?? str` (degradación string a string al inglés).
 *
 * La FUENTE ÚNICA del idioma activo es el módulo `i18n` (`getLang`); este módulo NO
 * guarda estado propio. Sin `\n` de wrap (los textos de shell son etiquetas cortas),
 * así que no necesita `rewrap`. Añadir un idioma = otra tabla en `TABLES`.
 *
 * Los NOMBRES PROPIOS de piel ("1988 (fiel)", "Shader (xBR)") NO se traducen: no
 * pasan por aquí (los provee el SkinManager como etiqueta de display).
 */
import { getLang, BASE_LANG } from "./index.js";

/** Tabla ES del shell: inglés base → español. Keys = el literal inglés del código. */
const ES: Record<string, string> = {
  // Chrome del drawer SISTEMA
  "SYSTEM": "SISTEMA",
  "MENU": "MENÚ",
  "Filter fields…": "Filtrar campos…",
  // Secciones
  "Commands (original)": "Comandos (original)",
  // Referencia de comandos (censo #35)
  "Attack": "Atacar",
  "Board (horse/carpet/ship)": "Abordar (caballo/alfombra/barco)",
  "Cast a spell": "Lanzar un hechizo",
  "Enter (town/dungeon/shrine)": "Entrar (ciudad/mazmorra/santuario)",
  "Fire cannon": "Disparar cañón",
  "Ignite a torch": "Encender antorcha",
  "Jimmy a lock": "Forzar cerradura",
  "Klimb (ladders/mountains)": "Trepar (escaleras/montañas)",
  "Mix reagents": "Mezclar reactivos",
  "New order (party)": "Reordenar (grupo)",
  "Push/pull": "Empujar/tirar",
  // «Salir y guardar» → «Dejar y guardar» al ejecutar #209 (acta-209-171-decisiones.md):
  // la divergencia declarada abajo (deck vs esta referencia) se adjudica al vocablo del
  // ECO — «Salir» además colisiona con el rótulo de Xit (abajo).
  "Quit & save (original)": "Dejar y guardar (original)",
  "Ready weapons/armour": "Equipar armas/armadura",
  "Talk (also shops)": "Hablar (también tiendas)",
  "Use an item": "Usar un objeto",
  "View (gem)": "Vista (gema)",
  "X-it (dismount)": "Desmontar",
  "Yell (word of power)": "Gritar (palabra de poder)",
  "Ztats (stats/inventory)": "Ztats (estado/inventario)",
  "move / aim": "mover / apuntar",
  "pass a turn": "pasar turno",
  "Saves & panels": "Partidas y paneles",
  // Deck táctil: botón ⛶ (encargo móvil 2026-07-24). "Fullscreen"/"Skin"/"Language"
  // ya existen en esta tabla (sección Vídeo / tooltips FAB) y se REUTILIZAN.
  "Exit full screen": "Salir de pantalla completa",
  // Forma CORTA del ⛶ (bug 3a, 01-08): es el RÓTULO VISIBLE del botón, que sólo dispone
  // de 95 px. "Fullscreen" → "Pantalla completa" sigue siendo el title / nombre accesible.
  "Screen": "Pantalla",
  // Deck táctil: popover ☰ (ruling apaisado #5 — sustituye a los FAB en juego)
  "Shell menu": "Menú del shell",
  // Salida del menú SIN elegir nada (27-07 noche). El scrim ya cerraba con un toque
  // fuera; este ítem es lo que lo hace ALCANZABLE para un lector de pantalla.
  "Close": "Cerrar",
  "Close this menu": "Cerrar este menú",
  "Also with Escape, or by tapping outside the panel.":
    "También con Escape, o tocando fuera del panel.",
  "System": "Sistema",
  "Video": "Vídeo",
  "Audio": "Audio",
  "Keys": "Teclas",
  "Help": "Ayuda",
  "Debug (QA)": "Debug (QA)",
  // Rótulo del modo scrollback de consola (carril log-scroll; overlay QoL de piel)
  "HISTORY": "HISTORIAL",
  // Sección Partidas y paneles
  "Save / Load (F5)": "Guardar / Cargar (F5)",
  "Not available in dungeons or combat (same as F5).":
    "No disponible en mazmorra ni combate (igual que F5).",
  "Not available in dungeons or combat (same as F6).":
    "No disponible en mazmorra ni combate (igual que F6).",
  "Not available in dungeons or combat (same as Tab).":
    "No disponible en mazmorra ni combate (igual que Tab).",
  // Sección Vídeo
  "Active skin": "Piel activa",
  "Skin": "Piel",
  "4:3 period aspect (1988 skin)": "Aspecto 4:3 época (piel 1988)",
  "Split layout (portrait)": "Layout partido (vertical)",
  "Splits the screen in portrait: square map on top, players and log below, buttons at the bottom. Changing it remounts the skin.":
    "Parte la pantalla en vertical: mapa cuadrado arriba, jugadores y log debajo, y los botones al pie. Cambiarlo vuelve a montar la piel.",
  "Layout: split / original": "Layout: partido / original",
  "Stretches 320×200 to 4:3 like a CRT of the era (1:1.2 pixel). Default: square pixel (F-0 decision). Applied live with the 1988 skin mounted.":
    "Estira 320×200 a 4:3 como un CRT de la época (píxel 1:1,2). Default: píxel cuadrado (decisión F-0). Se aplica en vivo con la piel 1988 montada.",
  "Fullscreen": "Pantalla completa",
  // Sección Audio
  "Music (F7)": "Música (F7)",
  "'Enhanced' tracks (XMI→OGG patch). On the 1988 skin the profile default is OFF; turning it on here is the same explicit opt-in as F7.":
    "Pistas 'enhanced' (parche XMI→OGG). En la piel 1988 el default de perfil es OFF; encenderla aquí es el mismo opt-in explícito que F7.",
  "Music volume (%)": "Volumen música (%)",
  "PC speaker 1988 (F8)": "PC-speaker 1988 (F8)",
  // Sección Ayuda
  "Atlas & guide (new tab)": "Atlas y guía (pestaña nueva)",
  "Interactive map of Britannia and the Underworld, interiors, NPCs, game controls and walkthrough. Opens outside the game.":
    "Mapa interactivo de Britannia y el inframundo, interiores, NPCs, controles del juego y walkthrough. Se abre fuera del juego.",
  // Sección Privacidad (carril 1: consentimiento y revocación)
  "Privacy": "Privacidad",
  "Privacy & data": "Privacidad y datos",
  "What this site sends and with what permission. Your game files never leave your device. You can withdraw any permission here.":
    "Qué envía este sitio y con qué permiso. Tus ficheros del juego nunca salen de tu dispositivo. Aquí puedes retirar cualquier permiso.",
  // Sección Debug (QA) — sólo DEV
  "Open debug menu (` / F4)": "Abrir menú debug (` / F4)",
  // Filas de la sección Teclas (qué hace cada tecla)
  "open/close this menu": "abrir/cerrar este menú",
  "close this menu or an open panel": "cerrar este menú o un panel abierto",
  "save / load game": "guardar / cargar partida",
  "music on/off": "música on/off",
  "PC speaker on/off": "PC-speaker on/off",
  "change skin (1988 ↔ shader)": "cambiar de piel (1988 ↔ shader)",
  "debug menu (QA)": "menú debug (QA)",
  // Tooltips de los FAB
  "System menu (F10)": "Menú sistema (F10)",
  "Change skin": "Cambiar piel",
  "Language": "Idioma",
  // Repeticiones (carril 2 del lanzamiento) — ui/replay-ui.ts
  "Replays": "Repeticiones",
  "Record your keys and watch your game again. Stays on this device.":
    "Graba tus teclas y vuelve a ver tu partida. Se queda en este dispositivo.",
  "A game is its starting state plus the keys you pressed. Nothing leaves your device.":
    "Una partida es su estado inicial más las teclas que pulsaste. Nada sale de tu dispositivo.",
  "Record my game": "Grabar mi partida",
  "Stop recording": "Parar de grabar",
  "Replay": "Reproducir",
  "REC": "GRB",
  "keys": "teclas",
  "turns": "turnos",
  "No recordings yet.": "Aún no hay repeticiones.",
  // Hueco de la miniatura en las grabaciones ANTERIORES a que se capturara fotograma:
  // no pueden tenerlo nunca (el canvas de aquel momento ya no existe). Rótulo corto —
  // vive dentro de un recuadro de 96×60.
  "No preview": "Sin imagen",
  "Could not read the local recordings.": "No se pudieron leer las repeticiones locales.",
  // Llegada con `?replay=<id>` desde /byo con un id que ya no existe (borrado en otra
  // pestaña, o enlace viejo). El juego sigue: sólo se dice por qué no hay repetición.
  "That recording is no longer on this device.":
    "Esa repetición ya no está en este dispositivo.",
  "Local storage is not available in this browser.":
    "El almacenamiento local no está disponible en este navegador.",
  "Recording saved": "Repetición guardada",
  "Recording discarded (no keys).": "Grabación descartada (ninguna tecla).",
  "Could not save the recording.": "No se pudo guardar la repetición.",
  "Recording your game (stays on this device).":
    "Grabando tu partida (se queda en este dispositivo).",
  "Diverged at key": "Divergió en la tecla",
  // Panel de guardado (Journeys) — savepanel.ts
  "Journeys": "Partidas",
  "Name this save…": "Nombra esta partida…",
  "Save": "Guardar",
  "Export": "Exportar",
  "Export .GAM": "Exportar .GAM",
  "Import": "Importar",
  "Load": "Cargar",
  "Delete": "Borrar",
  "No saved journeys yet.": "Aún no hay partidas guardadas.",
  "turn": "turno",
  "Saved:": "Guardada:",
  "Game loaded.": "Partida cargada.",
  "Save deleted.": "Partida borrada.",
  "Save {n}": "Partida {n}", // nombre por defecto al guardar sin nombre (flag del relevo)
  "Save imported.": "Partida importada.",
  "Load failed.": "Fallo al cargar.",
  "Import failed.": "Fallo al importar.",
  "Exported SAVED.GAM + sidecar.": "Exportado SAVED.GAM + sidecar.",
  "Exported SAVED.GAM + SAVED.OOL + sidecar.": "Exportado SAVED.GAM + SAVED.OOL + sidecar.",
  "Native .GAM export unavailable (missing init.gam template).":
    "Exportación .GAM nativa no disponible (falta la plantilla init.gam).",
  "Couldst not save the journey.": "No se pudo guardar la partida.",
  "Couldst not save — storage full! Delete or export a journey.":
    "No se pudo guardar: ¡almacenamiento lleno! Borra o exporta una partida.",
  // Selector genérico de comando (selector.ts) — CHROME moderno, NO del binario (el
  // DOS cancela con Escape y los pickers vacíos imprimen strings concretos; no hay
  // botones clicables). Ver la cabecera de selector.ts. "Speak" es el submit del prompt
  // de texto libre (mantra/deseo/respuesta/creación).
  "Cancel": "Cancelar",
  "Speak": "Hablar",
  "(nothing available)": "(nada disponible)",
  // Panel del diario (journal.ts) — estaba HARDCODEADO en español (rompía la
  // identidad 'en' del shell); ahora base inglesa + ts().
  // Botonera táctil móvil (touch.ts) — estaba MEZCLADA EN/ES (rompía la identidad
  // 'en': bajo inglés se veían "Cofre/Beber/Atacar…"). Base inglesa + ts().
  "Chest": "Cofre",
  "Open chest": "Abrir cofre",
  "Drink": "Beber",
  "Drink from the fountain": "Beber de la fuente",
  // SIN PICTOGRAMA desde el 02-08 (petición del usuario). «Attack» NO se re-declara aquí:
  // la clave ya existe arriba, en la referencia de comandos del drawer, con el MISMO
  // término («Atacar») — ts() es un diccionario plano y una segunda entrada sería una
  // clave duplicada que el linter de objeto rechaza y que, si algún día divergieran, haría
  // que el botón dijese lo que decidiera la ÚLTIMA. «Torch» sí es nueva: la referencia
  // sólo tenía la forma larga del title («Ignite a torch»).
  "Torch": "Antorcha",
  "Attack: tap, then a direction (or tap the enemy)":
    "Atacar: pulsa y luego dirección (o toca al enemigo)",
  // Eco de es.json 'Pass'→'Aguardáis' (el término canónico es AGUARDAR, no «pasar»):
  // el botón usa el infinitivo del MISMO vocablo que la consola ecoará al pulsarlo
  // (regla de coherencia del lote i18n-deck 2026-07-24; antes decía «Pasar»).
  "Pass": "Aguardar",
  // Etiquetas de comando de MUNDO (touch.ts) — pase 3. Cada vocablo es la traducción
  // CANÓNICA que el juego ya usa para el eco de ese comando en es.json (reviewed=true),
  // NO terminología inventada: Talk-→Hablar-, Open-→Abrir-, Look→Mirar, Get-→Coger-,
  // Search-→Buscar-, Jimmy-→Forzar-, Klimb-→Trepar-, Cast…→Lanzar…, Mix→Mezclar,
  // Ready…→Prestar…, Use item→Usar. ~~«Srch» abrevia «Search»: en ES «Buscar» (6) cabe
  // igual que Hablar/Mezclar/Prestar, así que va completo~~ — desde el carril
  // portrait-paridad el EN también va completo («Search»), así que la asimetría que esta
  // nota explicaba ya no existe y la clave «Srch» se retira por huérfana: la medición dice
  // que «Search» sobra +12,8 px en los dos portraits y +13,6 en el clásico.
  // «Ztats»: el eco 'Z-stats...' YA está adjudicado en es.json como 'Z-perfil...'
  // (la nota previa «sin eco» quedó stale) → el botón dice lo que ecoará.
  "Ztats": "Z-perfil",
  "Talk": "Hablar",
  "Open": "Abrir",
  "Look": "Mirar",
  "Get": "Coger",
  "Search": "Buscar", // rótulo Y tooltip del botón de mundo/mazmorra/combate
  "Search: secret doors": "Buscar: puertas secretas",
  "Jimmy": "Forzar",
  "Klimb": "Trepar",
  "Cast": "Lanzar",
  "Mix": "Mezclar",
  "Ready": "Prestar",
  "Use": "Usar",
  "Jimmy: force a lock (tap, then a direction)":
    "Forzar: destrabar puerta/cerradura (pulsa y luego dirección)",
  // Comandos de mundo añadidos a la botonera (touch.ts) — vocablo CANÓNICO del eco en
  // es.json (reviewed=true): Board→Abordar, Enter→Entrar, X-it→S-alir (botón «Salir»),
  // Push-→Empujar, Yell→Vocear, Fire→Disparar, Hole up→Acampar. NO terminología nueva.
  "Board": "Abordar",
  "Enter": "Entrar",
  "Xit": "Salir",
  "Push": "Empujar",
  "Yell": "Vocear",
  "Fire": "Disparar",
  "Hole up": "Acampar",
  "Board a ship, horse or carpet": "Abordar una nave, caballo o alfombra",
  "Enter a dungeon, town or moongate on your tile":
    "Entrar a una mazmorra, ciudad o puerta lunar de tu casilla",
  "eXit: dismount or leave your transport": "Salir: desmonta o abandona tu transporte",
  "Push or pull an object (tap, then a direction)":
    "Empujar o tirar de un objeto (pulsa y luego dirección)",
  "Yell: hoist/furl sail, or a word of power": "Vocear: iza/arría vela, o una palabra de poder",
  "Fire ship cannons (tap, then a direction)":
    "Disparar los cañones de la nave (pulsa y luego dirección)",
  "Hole up & camp": "Acampar y descansar",
  // Los CINCO comandos que el censo del despachador (28-07) encontró sin vía táctil.
  // Vocablo CANÓNICO del eco en es.json, igual que el resto del deck:
  // New Order→«Nuevo Orden», View a gem!→«¡Ver una gema!», Quit:→«Dejar:».
  // ~~Quit:→«Abandonar:»~~ — RE-APUNTADO (#209, acta-209-171-decisiones.md): «Abandonar»
  // (9 letras) era el único rótulo cizallado por ancho de PALABRA en el deck de dos
  // pistas (−7 px partido, −12 px clásico); el eco de es.json y este rótulo cambian
  // JUNTOS a «Dejar» porque la regla del deck es decir lo que la consola va a escribir.
  // «Salir» NO estaba disponible: es el rótulo de Xit (arriba).
  // La divergencia con la REFERENCIA de comandos del shell («Quit & save (original)»,
  // sección «Comandos (original)») quedó adjudicada en el mismo acta: también «Dejar».
  // La de «New order (party)»→«Reordenar (grupo)» sigue declarada y sin unificar.
  "New order": "Nuevo orden",
  "View gem": "Ver gema",
  "Quit": "Dejar",
  "New order: swap two party members": "Nuevo orden: intercambia dos miembros del grupo",
  "View a gem: aerial map of your surroundings": "Ver una gema: mapa aéreo de tu entorno",
  "Quit & Save the journey": "Dejar y guardar la partida",
  // Fila utilitaria (touch.ts): Sí/Espacio con traducción; No/⏎/Esc son idénticos.
  "Yes": "Sí",
  "Space": "Espacio",
  // Barra de modo del deck táctil (móvil)
  // (Los pictogramas de cabecera U+2BD0/U+2328 se retiraron: tofu e ilegible en la
  // familia del deck — auditoría móvil 2026-07-25. El vocablo nombra el modo.)
  "Move": "Mover",
  "A–Z": "A–Z",
  "123": "123",
  "Yes/No": "Sí/No",
  "Movement pad and world commands": "Cruceta y comandos de mundo",
  "Letter keyboard (names, words of power)": "Teclado de letras (nombres, palabras de poder)",
  "Number pad (quantities, donations)": "Numpad (cantidades, donaciones)",
  "Answer a Yes/No prompt": "Responder Sí/No",
  "Swap pad side": "Cambiar el pad de lado",
  // Fila útil, iteración A2 (27-07): activadores de hoja con icono + texto, y el botón
  // del teclado del sistema («ABC»; el glifo de teclado U+2328 está proscrito por el
  // censo de glifos — se pinta a ~7 px, ilegible).
  "✓/✗ Yes/No": "✓/✗ Sí/No",
  "123 Numbers": "123 Números",
  "Show the Yes/No sheet": "Mostrar la hoja Sí/No",
  "Show the number pad": "Mostrar el numpad",
  "ABC": "ABC",
  // Activador de la hoja A–Z PROPIA (sólo en el portrait original, que retira la barra de
  // modo): comparte rótulo con el botón del teclado del sistema a propósito — para el
  // jugador los dos son «el teclado», y nunca se ven a la vez.
  "Show the letter keyboard": "Mostrar el teclado de letras",
  // Formas CORTAS de la fila útil cuando sus teclas se mudan a la cruceta (celda de
  // 44 px). El vocablo largo sigue en la fila útil y en apaisado.
  "Ent": "Ent",
  "Spc": "Esp",
  "Open the system keyboard": "Abrir el teclado del sistema",
  "System keyboard": "Teclado del sistema",
  "Swap cursors side": "Cambiar de lado los cursores",
  // Nombres ACCESIBLES de la cruceta (auditoría móvil 2026-07-25, ítem de
  // accesibilidad): sin ellos el lector de pantalla anuncia «triángulo negro apuntando
  // hacia arriba». El rumbo es como el propio juego nombra las direcciones.
  "Move north": "Mover al norte",
  "Move south": "Mover al sur",
  "Move west": "Mover al oeste",
  "Move east": "Mover al este",
  "Backspace": "Retroceso",
  "Yes (answer a Y/N prompt)": "Sí (responde un prompt S/N)",
  "No (answer a Y/N prompt)": "No (responde un prompt S/N)",
  "Space: pass a turn / advance a prompt": "Espacio: pasa turno / avanza un prompt",
  "Enter: confirm": "Enter: confirmar",
  "Escape: cancel / close a panel": "Escape: cancela / cierra un panel",
  // Botonera de teclas de la INTRO en móvil (ficha #33, `skin/fiel/intro.ts`
  // INTRO_PAD_KEYS). Son nombres de CURSOR, no de rumbo: la cruceta del juego mueve al
  // Avatar por el mapa ("Move north") y ésta mueve el resalte por una lista de 6
  // opciones. 🔴 Y no pueden ser "Enter"/"Escape" a secas: "Enter" ya está en esta misma
  // tabla como el COMANDO del juego (→ «Entrar», entrar en una ciudad).
  "Previous option": "Opción anterior",
  "Next option": "Opción siguiente",
  "Confirm selection": "Confirmar selección",
  "Go back": "Volver atrás",
  // Selector de mapa — vista de mazmorra (teleportPicker: Gem 22×22 vs planta completa).
  "View": "Vista",
  "Full floor": "Planta completa",
  "Gem: flood-fill from": "Gem: flood desde",
  "party": "party",
  "up-ladder": "escalera arriba",
  // Selector de mapa del teletransporte de debug (teleportPicker.ts) — SÓLO DEV.
  "Teleport map": "Mapa de teletransporte",
  "Open map picker…": "Abrir selector de mapa…",
  "Large point-and-click map: overworld (zoom/pan), cities & castles by floor, and full dungeon floors. Click a cell to teleport.":
    "Mapa grande point-and-click: overworld (zoom/pan), ciudades y castillos por planta, y plantas de mazmorra completas. Click en una celda = teletransporte.",
  "Overworld": "Overworld",
  "Cities & castles": "Ciudades y castillos",
  "Dungeons": "Mazmorras",
  "Layer": "Capa",
  "Britannia (overworld)": "Britannia (overworld)",
  "Underworld": "Inframundo",
  "Location": "Localización",
  "Floor": "Planta",
  "Dungeon": "Mazmorra",
  "Go": "Ir",
  "Wheel = zoom · drag = pan · double-click = zoom in · click a cell = teleport":
    "Rueda = zoom · arrastrar = paneo · doble-click = acercar · click en celda = teletransporte",
  "Destination is a wall / impassable (teleport allowed anyway).":
    "El destino es muro / impasable (se permite igualmente).",
  "Last destination:": "Último destino:",
  "Go again": "Ir de nuevo",
  // Etiquetas de tipo de celda de mazmorra (hover del selector). "Chest"/"Open chest"
  // ya están traducidos arriba (botonera táctil): no se re-declaran para no duplicar clave.
  "Corridor": "Pasillo",
  "Ladder up": "Escalera ↑",
  "Ladder down": "Escalera ↓",
  "Ladder up/down": "Escalera ↕",
  "Fountain": "Fuente",
  "Trap": "Trampa",
  "Magic field": "Campo mágico",
  "Marker": "Marcador",
  "Room (cleared)": "Sala (despejada)",
  "Wall": "Muro",
  "Special wall": "Muro especial",
  "Secret door": "Puerta secreta",
  "Door": "Puerta",
  "Room": "Sala",
  // Subtipos de fuente / trampa / campo mágico.
  "Cure poison": "Cura veneno",
  "Heal": "Cura",
  "Poison": "Veneno",
  "Bad taste": "Mal sabor",
  "Pit": "Foso",
  "Pit fall": "Caída",
  "Bomb": "Bomba",
  "Sleep": "Sueño",
  "Flame": "Fuego",
  "Energy": "Energía",
};

const TABLES: Record<string, Record<string, string>> = { es: ES };

/**
 * CHOKE POINT del shell (espejo de `i18n.t()`). Devuelve `str` en el idioma activo:
 * en 'en' TAL CUAL (identidad); en otro idioma, la traducción o `str` como fallback.
 * Puro respecto a `getLang()` → cambio en caliente sin reconstruir el módulo.
 */
export function ts(str: string): string {
  const lang = getLang();
  if (lang === BASE_LANG) return str;
  return TABLES[lang]?.[str] ?? str;
}
