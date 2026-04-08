/**
 * ============================================
 * SESSIONS REPOSITORY
 * ============================================
 *
 * ¿Qué hace este archivo?
 * -----------------------
 * Maneja la persistencia de sesiones conversacionales.
 *
 * Una sesión representa una conversación activa con un usuario.
 *
 * Guarda:
 * - paso actual del flujo (step)
 * - datos recolectados (data)
 * - canal (webchat / whatsapp)
 * - estado de control conversacional (bot / human / closed)
 *
 * ¿Para qué sirve?
 * ----------------
 * Permite que el bot:
 * - recuerde en qué parte del flujo está el usuario
 * - continúe conversaciones
 * - no empiece desde cero en cada mensaje
 * - se silencie cuando la conversación queda en manos humanas
 *
 * IMPORTANTE:
 * -----------
 * Esta implementación usa SQLite como persistencia real.
 *
 * Mantiene la misma API pública que la versión anterior
 * para no romper el resto del proyecto.
 *
 * En resumen:
 * -----------
 * Es la "memoria" del bot durante la conversación.
 */

const db = require('../../database/sqlite');

/**
 * Devuelve fecha actual en formato ISO.
 *
 * Esto se usa para:
 * - createdAt
 * - updatedAt
 * - timestamps operativos de takeover humano
 */
function nowIso() {
  return new Date().toISOString();
}

/**
 * Parsea JSON de forma segura.
 *
 * Si por algún motivo el texto viene vacío o corrupto,
 * devolvemos un fallback para evitar que el sistema se rompa.
 */
function safeParseJson(value, fallback = {}) {
  try {
    if (!value) return fallback;
    return JSON.parse(value);
  } catch (error) {
    console.error('❌ Error parseando data_json de sesión:', error.message);
    return fallback;
  }
}

/**
 * Convierte una fila de SQLite en un objeto sesión
 * con el mismo formato que usa el resto del sistema.
 *
 * Notas:
 * ------
 * - data_json se parsea a objeto JS
 * - invalid_count pasa a invalidCount
 * - nombres snake_case se transforman a camelCase
 */
function mapRowToSession(row) {
  if (!row) return null;

  return {
    sessionId: row.session_id,
    channel: row.channel,
    externalUserId: row.external_user_id,
    step: row.step,
    data: safeParseJson(row.data_json, {}),
    invalidCount: typeof row.invalid_count === 'number' ? row.invalid_count : 0,
    controlMode: row.control_mode || 'bot',
    humanRequestedAt: row.human_requested_at || null,
    humanTakenAt: row.human_taken_at || null,
    humanReleasedAt: row.human_released_at || null,
    humanNoticeSentAt: row.human_notice_sent_at || null,
    closedAt: row.closed_at || null,
    takenBy: row.taken_by || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

/**
 * Crea una nueva sesión base.
 *
 * Parámetros:
 * - sessionId: identificador único
 * - channel: webchat o whatsapp
 * - externalUserId: id externo (ej número de teléfono)
 *
 * OJO:
 * ----
 * Esta función solo construye el objeto.
 * No guarda todavía en la base.
 */
function createNewSession({ sessionId, channel = 'webchat', externalUserId = null }) {
  return {
    sessionId,

    // Canal de origen
    channel,

    // Identificador externo del usuario
    externalUserId: externalUserId || sessionId,

    // Paso actual del flujo conversacional
    step: 'welcome',

    // Datos recolectados durante la conversación
    data: {},

    // Contador de respuestas inválidas
    invalidCount: 0,

    // Estado de control conversacional
    // Valores posibles:
    // - bot
    // - human
    // - closed
    controlMode: 'bot',

    // Metadata de takeover humano
    humanRequestedAt: null,
    humanTakenAt: null,
    humanReleasedAt: null,
    closedAt: null,
    takenBy: null,

    // Fechas
    createdAt: nowIso(),
    updatedAt: nowIso()
  };
}

/**
 * Devuelve todas las sesiones.
 *
 * Esto sirve para:
 * - debugging
 * - diagnóstico
 * - posibles pantallas administrativas futuras
 */
function getAllSessions() {
  const rows = db.prepare(`
    SELECT
      session_id,
      channel,
      external_user_id,
      step,
      data_json,
      invalid_count,
      control_mode,
      human_requested_at,
      human_taken_at,
      human_released_at,
      human_notice_sent_at,
      closed_at,
      taken_by,
      created_at,
      updated_at
    FROM sessions
    ORDER BY datetime(updated_at) DESC
  `).all();

  return rows.map(mapRowToSession);
}

/**
 * Busca una sesión por sessionId.
 *
 * Si no existe, devuelve null.
 */
function getBySessionId(sessionId) {
  const row = db.prepare(`
    SELECT
      session_id,
      channel,
      external_user_id,
      step,
      data_json,
      invalid_count,
      control_mode,
      human_requested_at,
      human_taken_at,
      human_released_at,
      human_notice_sent_at,
      closed_at,
      taken_by,
      created_at,
      updated_at
    FROM sessions
    WHERE session_id = ?
    LIMIT 1
  `).get(sessionId);

  return mapRowToSession(row);
}

/**
 * Inserta o actualiza una sesión (UPSERT).
 *
 * Si no existe:
 * - la crea
 *
 * Si ya existe:
 * - la actualiza
 *
 * IMPORTANTE:
 * Siempre actualiza updatedAt.
 */
function upsertSession(session) {
  /**
   * Normalizamos la sesión antes de guardarla
   * para evitar nulls o formatos inconsistentes.
   */
  const normalizedSession = {
    sessionId: session.sessionId,
    channel: session.channel || 'webchat',
    externalUserId: session.externalUserId || session.sessionId,
    step: session.step || 'welcome',
    data: session.data || {},
    invalidCount: typeof session.invalidCount === 'number' ? session.invalidCount : 0,
    controlMode: session.controlMode || 'bot',
    humanRequestedAt: session.humanRequestedAt || null,
    humanTakenAt: session.humanTakenAt || null,
    humanReleasedAt: session.humanReleasedAt || null,
    humanNoticeSentAt: session.humanNoticeSentAt || null,
    closedAt: session.closedAt || null,
    takenBy: session.takenBy || null,
    createdAt: session.createdAt || nowIso(),
    updatedAt: nowIso()
  };

  /**
   * UPSERT nativo de SQLite.
   *
   * - inserta si no existe
   * - actualiza si ya existe
   */
  db.prepare(`
    INSERT INTO sessions (
      session_id,
      channel,
      external_user_id,
      step,
      data_json,
      invalid_count,
      control_mode,
      human_requested_at,
      human_taken_at,
      human_released_at,
      human_notice_sent_at,
      closed_at,
      taken_by,
      created_at,
      updated_at
    ) VALUES (
      @sessionId,
      @channel,
      @externalUserId,
      @step,
      @dataJson,
      @invalidCount,
      @controlMode,
      @humanRequestedAt,
      @humanTakenAt,
      @humanReleasedAt,
      @humanNoticeSentAt,
      @closedAt,
      @takenBy,
      @createdAt,
      @updatedAt
    )
    ON CONFLICT(session_id) DO UPDATE SET
      channel = excluded.channel,
      external_user_id = excluded.external_user_id,
      step = excluded.step,
      data_json = excluded.data_json,
      invalid_count = excluded.invalid_count,
      control_mode = excluded.control_mode,
      human_requested_at = excluded.human_requested_at,
      human_taken_at = excluded.human_taken_at,
      human_released_at = excluded.human_released_at,
      human_notice_sent_at = excluded.human_notice_sent_at,
      closed_at = excluded.closed_at,
      taken_by = excluded.taken_by,
      updated_at = excluded.updated_at
  `).run({
    sessionId: normalizedSession.sessionId,
    channel: normalizedSession.channel,
    externalUserId: normalizedSession.externalUserId,
    step: normalizedSession.step,
    dataJson: JSON.stringify(normalizedSession.data || {}),
    invalidCount: normalizedSession.invalidCount,
    controlMode: normalizedSession.controlMode,
    humanRequestedAt: normalizedSession.humanRequestedAt,
    humanTakenAt: normalizedSession.humanTakenAt,
    humanReleasedAt: normalizedSession.humanReleasedAt,
    humanNoticeSentAt: normalizedSession.humanNoticeSentAt,
    closedAt: normalizedSession.closedAt,
    takenBy: normalizedSession.takenBy,
    createdAt: normalizedSession.createdAt,
    updatedAt: normalizedSession.updatedAt
  });

  /**
   * Releemos desde la base para devolver
   * el estado realmente persistido.
   */
  return getBySessionId(normalizedSession.sessionId);
}

/**
 * Devuelve una sesión existente o la crea si no existe.
 *
 * Esta función es usada por:
 * - webhook de WhatsApp
 * - webchat
 * - cualquier flujo que necesite asegurar contexto
 */
function getOrCreateSession({ sessionId, channel = 'webchat', externalUserId = null }) {
  const existing = getBySessionId(sessionId);

  if (existing) {
    return existing;
  }

  const created = createNewSession({
    sessionId,
    channel,
    externalUserId
  });

  return upsertSession(created);
}

/**
 * Cambia la sesión a control humano.
 *
 * Esto hace que el bot deje de responder.
 *
 * Parámetros:
 * - sessionId: id de la sesión
 * - takenBy: identificador opcional de quién tomó la conversación
 */
function markSessionAsHuman(sessionId, takenBy = null) {
  const session = getOrCreateSession({ sessionId });

  session.controlMode = 'human';
  session.step = 'handoff';
  session.humanRequestedAt = session.humanRequestedAt || nowIso();

  if (takenBy) {
    session.humanTakenAt = nowIso();
    session.takenBy = takenBy;
  }

  return upsertSession(session);
}

/**
 * Devuelve la conversación al bot.
 *
 * No borra la data recolectada.
 * Solo remueve el bloqueo humano y reubica el flujo.
 */
function markSessionAsBot(sessionId) {
  const session = getOrCreateSession({ sessionId });

  session.controlMode = 'bot';
  session.humanReleasedAt = nowIso();

  /**
   * Cuando la conversación vuelve al bot,
   * reseteamos el aviso humano para que
   * una futura derivación pueda volver a notificar una sola vez.
   */
  session.humanNoticeSentAt = null;

  /**
   * Si la sesión estaba en handoff,
   * la devolvemos al menú principal.
   */
  if (session.step === 'handoff' || session.step === 'human_handoff') {
    session.step = 'main_menu';
  }

  session.invalidCount = 0;

  return upsertSession(session);
}

/**
 * Cierra la conversación.
 *
 * Esto deja la sesión en estado cerrado.
 */
function markSessionAsClosed(sessionId) {
  const session = getOrCreateSession({ sessionId });

  session.controlMode = 'closed';
  session.step = 'closed';
  session.closedAt = nowIso();

  /**
   * Al cerrar la conversación, limpiamos también
   * el estado de aviso humano para evitar arrastres raros.
   */
  session.humanNoticeSentAt = null;

  return upsertSession(session);
}

/**
 * Informa si la sesión está bajo control humano.
 *
 * Devuelve:
 * - true si controlMode === 'human'
 * - false en cualquier otro caso
 */
function isSessionHumanControlled(sessionId) {
  const session = getBySessionId(sessionId);
  return !!session && session.controlMode === 'human';
}

/**
 * Informa si la sesión está cerrada.
 *
 * Devuelve:
 * - true si controlMode === 'closed'
 * - false en cualquier otro caso
 */
function isSessionClosed(sessionId) {
  const session = getBySessionId(sessionId);
  return !!session && session.controlMode === 'closed';
}

/**
 * Elimina una sesión.
 *
 * OJO:
 * ----
 * Esto borra físicamente el registro de la base.
 * No debería usarse en flujos normales del bot,
 * solo en tareas de mantenimiento o debugging.
 */
function deleteSession(sessionId) {
  db.prepare(`
    DELETE FROM sessions
    WHERE session_id = ?
  `).run(sessionId);
}

/**
 * Exportamos funciones públicas.
 *
 * Mantenemos exactamente la misma interfaz pública
 * para que el resto del proyecto no tenga que cambiar.
 */
module.exports = {
  createNewSession,
  getAllSessions,
  getBySessionId,
  getOrCreateSession,
  upsertSession,
  markSessionAsHuman,
  markSessionAsBot,
  markSessionAsClosed,
  isSessionHumanControlled,
  isSessionClosed,
  deleteSession
};