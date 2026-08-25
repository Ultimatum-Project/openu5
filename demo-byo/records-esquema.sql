-- ESQUEMA D1 de la tabla de récords (carril 2 del diseño de lanzamiento).
--
-- Se aplica UNA vez por entorno, y es idempotente:
--   npx wrangler d1 execute openu5-records --remote --file=demo-byo/records-esquema.sql
--
-- ── POR QUÉ HAY DOS ALMACENES Y NO UNO ──────────────────────────────────────────────
-- El REGISTRO (las teclas) vive en KV: es un valor por clave, se lee por id y se cachea en
-- el borde. Esta tabla es sólo el ÍNDICE, y existe porque KV no sabe ORDENAR POR TURNOS ni
-- filtrar por momento, que es lo único que una tabla de récords tiene que hacer.
--
-- ── LO QUE NO HAY EN ESTA TABLA, Y ES LO IMPORTANTE ─────────────────────────────────
-- No hay estado de partida, no hay nombres de personaje, no hay diario, no hay un solo byte
-- que venga de los ficheros de EA. Las columnas son cifras, huellas y el apodo que eligió
-- quien subió. Ver `demo-byo/src/records-formato.ts` para el porqué medido.
--
-- Tampoco hay IP ni nada que identifique al visitante: el limitador de frecuencia guarda
-- SHA-256(sal + ip) en KV con caducidad de dos horas, y aquí no llega.

CREATE TABLE IF NOT EXISTS records (
  -- Hash del contenido canónico (20 hex). Subir dos veces lo mismo da el mismo id ⇒ no
  -- duplica fila, y el registro de KV se puede cachear como inmutable.
  id                  TEXT    PRIMARY KEY,
  alias               TEXT    NOT NULL,

  -- ARRANQUE. `base_tipo` es hoy siempre 'momento' y la columna existe igual: el día que
  -- haya otra clase reproducible (una partida nueva canónica), las filas viejas siguen
  -- diciendo cuál eran. Un tipo implícito obligaría a adivinarlo por la forma del id.
  base_tipo           TEXT    NOT NULL,
  base_id             TEXT    NOT NULL,
  -- SHA-256 del ancla de quien subió. Quien verifica compone SU base, la hashea, y compara
  -- antes de reproducir nada.
  ancla_hash          TEXT    NOT NULL,
  motor               TEXT    NOT NULL,

  turnos              INTEGER NOT NULL,   -- lastTurn: la cifra por la que se ordena
  teclas              INTEGER NOT NULL,   -- count
  -- 🔴 EL NOMBRE LLEVA EL «RECLAMADO» DENTRO. El servidor NO puede comprobar que la partida
  -- llegara al desenlace (haría falta ejecutar el motor, y ejecutarlo exige los datos de EA
  -- que este servidor no tiene). Es lo que afirmó quien subió, y así se llama en el
  -- esquema, en el JSON y en la pantalla.
  desenlace_reclamado INTEGER NOT NULL,
  bytes               INTEGER NOT NULL,   -- tamaño del registro en KV (medido al guardar)
  creado              INTEGER NOT NULL,   -- reloj del SERVIDOR en ms

  -- ── EL HUECO DE IDENTIDAD (§6 del encargo: el login de Google va en otro carril) ─────
  -- Hoy toda fila es 'anonima' con `identidad_sub` a NULL, y el `alias` es un rótulo que
  -- cualquiera puede repetir: NO identifica a nadie y la pantalla no dice lo contrario.
  -- Cuando haya login, el proveedor entra en `identidad_tipo` ('google') y el `sub` del
  -- token —que es el identificador estable y opaco, nunca el correo— en `identidad_sub`.
  -- Las filas anónimas de hoy siguen siendo válidas y siguen diciendo lo que son.
  identidad_tipo      TEXT    NOT NULL DEFAULT 'anonima',
  identidad_sub       TEXT
);

-- El índice ES la consulta de la tabla: filtrar por momento y ordenar por turnos con
-- desempate por antigüedad. Con él, la paginación por clave no toca más filas que las que
-- devuelve.
CREATE INDEX IF NOT EXISTS idx_records_tabla
  ON records (base_id, turnos ASC, creado ASC);
