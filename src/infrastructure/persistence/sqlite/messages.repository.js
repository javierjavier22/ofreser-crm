/**
 * ============================================
 * MESSAGES REPOSITORY
 * ============================================
 *
 * ¿Qué hace este archivo?
 * -----------------------
 * Este archivo maneja la persistencia de mensajes del sistema.
 *
 * Guarda y recupera todos los mensajes intercambiados
 * entre el usuario y el bot, sin importar el canal.
 *
 * Canales posibles:
 * - webchat
 * - whatsapp
 *
 * Funciones principales:
 * - Obtener todos los mensajes.
 * - Guardar un mensaje nuevo.
 * - Obtener mensajes filtrados por sesión.
 *
 * ¿Qué NO hace?
 * -------------
 * - No decide qué responder.
 * - No contiene lógica conversacional.
 * - No sabe qué es un lead.
 *
 * Rol dentro del sistema:
 * -----------------------
 * Este archivo pertenece a la capa de persistencia.
 *
 * Su función es actuar como repositorio de historial conversacional.
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
 * Este archivo es el "historial de chats" del sistema.
 */

const db = require('../../database/sqlite');

/**
 * Devuelve la fecha/hora actual en formato ISO.
 *
 * Esto se usa para guardar timestamps consistentes.
 */
function nowIso() {
  return new Date().toISOString();
}

/**
 * Genera un ID simple y único para cada mensaje.
 *
 * Formato:
 * msg_timestamp_numeroRandom
 *
 * Para esta etapa del proyecto alcanza correctamente.
 */
function createMessageId() {
  return `msg_${Date.now()}_${Math.floor(Math.random() * 100000)}`;
}

/**
 * Parsea JSON de forma segura.
 *
 * Si raw_payload_json viene vacío o corrupto,
 * devolvemos null para no romper el flujo.
 */
function safeParseJson(value, fallback = null) {
  try {
    if (!value) return fallback;
    return JSON.parse(value);
  } catch (error) {
    console.error('❌ Error parseando raw_payload_json del mensaje:', error.message);
    return fallback;
  }
}

/**
 * Convierte una fila de SQLite a la forma
 * que el resto del sistema ya espera.
 *
 * IMPORTANTE:
 * -----------
 * Conservamos exactamente la estructura usada
 * por controllers, CRM y lógica actual.
 */
function mapRowToMessage(row) {
  if (!row) return null;

  return {
    id: row.id,
    sessionId: row.session_id,
    channel: row.channel,
    externalUserId: row.external_user_id,
    direction: row.direction,
    senderType: row.sender_type,
    text: row.text,
    externalMessageId: row.external_message_id,
    rawPayload: safeParseJson(row.raw_payload_json, null),
    createdAt: row.created_at
  };
}

/**
 * Devuelve todos los mensajes guardados en el sistema.
 *
 * Esto ya lee desde SQLite.
 */
function getAllMessages() {
  const rows = db.prepare(`
    SELECT
      id,
      session_id,
      channel,
      external_user_id,
      direction,
      sender_type,
      text,
      external_message_id,
      raw_payload_json,
      created_at
    FROM messages
    ORDER BY datetime(created_at) ASC
  `).all();

  return rows.map(mapRowToMessage);
}

/**
 * Guarda un mensaje nuevo en el historial.
 *
 * Parámetros esperados:
 * - sessionId: identifica la conversación
 * - channel: webchat o whatsapp
 * - externalUserId: id externo del usuario
 * - direction: inbound / outbound
 * - senderType: user / bot / human
 * - text: texto del mensaje
 * - externalMessageId: id externo del proveedor si existe
 * - rawPayload: payload original si queremos auditar/debuggear
 */
function saveMessage({
  sessionId,
  channel = 'webchat',
  externalUserId = null,
  direction,
  senderType,
  text,
  externalMessageId = null,
  rawPayload = null
}) {
  /**
   * Construimos el objeto mensaje normalizado
   * antes de persistirlo.
   */
  const message = {
    id: createMessageId(),
    sessionId,
    channel,
    externalUserId: externalUserId || sessionId,
    direction,
    senderType,
    text: String(text || ''),
    externalMessageId,
    rawPayload,
    createdAt: nowIso()
  };

  /**
   * Insertamos el mensaje en SQLite.
   */
  db.prepare(`
    INSERT INTO messages (
      id,
      session_id,
      channel,
      external_user_id,
      direction,
      sender_type,
      text,
      external_message_id,
      raw_payload_json,
      created_at
    ) VALUES (
      @id,
      @sessionId,
      @channel,
      @externalUserId,
      @direction,
      @senderType,
      @text,
      @externalMessageId,
      @rawPayloadJson,
      @createdAt
    )
  `).run({
    id: message.id,
    sessionId: message.sessionId,
    channel: message.channel,
    externalUserId: message.externalUserId,
    direction: message.direction,
    senderType: message.senderType,
    text: message.text,
    externalMessageId: message.externalMessageId,
    rawPayloadJson: message.rawPayload ? JSON.stringify(message.rawPayload) : null,
    createdAt: message.createdAt
  });

  /**
   * Devolvemos el mensaje recién guardado.
   */
  return message;
}

/**
 * Devuelve todos los mensajes de una sesión específica.
 *
 * Esto sirve para reconstruir la conversación completa
 * de un usuario o lead.
 *
 * Además:
 * - filtra por sessionId
 * - ordena por fecha ascendente
 */
function getMessagesBySessionId(sessionId) {
  const rows = db.prepare(`
    SELECT
      id,
      session_id,
      channel,
      external_user_id,
      direction,
      sender_type,
      text,
      external_message_id,
      raw_payload_json,
      created_at
    FROM messages
    WHERE session_id = ?
    ORDER BY datetime(created_at) ASC
  `).all(sessionId);

  return rows.map(mapRowToMessage);
}

/**
 * Exportamos las funciones del repositorio
 * para que otros módulos puedan usarlas.
 */
module.exports = {
  getAllMessages,
  saveMessage,
  getMessagesBySessionId
};