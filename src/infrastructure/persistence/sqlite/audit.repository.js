/**
 * ============================================
 * AUDIT REPOSITORY
 * ============================================
 *
 * ¿Qué hace este archivo?
 * -----------------------
 * Maneja la persistencia de eventos de auditoría del sistema.
 *
 * Su objetivo es registrar acciones sensibles para poder responder:
 * - quién hizo algo
 * - qué hizo
 * - sobre qué entidad
 * - cuándo
 * - desde qué IP / navegador si aplica
 *
 * Ejemplos de acciones:
 * - login exitoso
 * - logout
 * - cambio de contraseña
 * - creación de usuario
 * - cambio de rol
 * - reset de password
 * - cambio de estado de lead
 * - takeover humano
 * - devolución al bot
 * - cierre de conversación
 * - envío de mensaje humano
 *
 * Importante:
 * -----------
 * Este archivo NO decide permisos.
 * Solo guarda y consulta eventos de auditoría.
 */

const db = require('../../database/sqlite');
const { logger } = require('../../../shared/logger/logger');

/**
 * Devuelve fecha actual en formato ISO.
 */
function nowIso() {
  return new Date().toISOString();
}

/**
 * Genera un ID único para cada evento de auditoría.
 */
function createAuditId() {
  return `audit_${Date.now()}_${Math.floor(Math.random() * 100000)}`;
}

/**
 * Parsea JSON de forma segura.
 */
function safeParseJson(value, fallback = null) {
  try {
    if (!value) return fallback;
    return JSON.parse(value);
  } catch (error) {
    logger.error(`Error parseando details_json de audit log: ${error.message}`);
    return fallback;
  }
}

/**
 * Convierte fila SQLite a objeto de auditoría JS.
 */
function mapRowToAuditLog(row) {
  if (!row) return null;

  return {
    id: row.id,
    actorUserId: row.actor_user_id || null,
    actorUsername: row.actor_username || '',
    actorRole: row.actor_role || '',
    action: row.action,
    entityType: row.entity_type,
    entityId: row.entity_id || null,
    details: safeParseJson(row.details_json, null),
    ipAddress: row.ip_address || '',
    userAgent: row.user_agent || '',
    createdAt: row.created_at
  };
}

/**
 * Extrae IP real del request de forma razonable.
 *
 * Prioridad:
 * - x-forwarded-for (si hay proxy / Render)
 * - req.ip
 * - fallback vacío
 */
function extractIpAddress(req) {
  if (!req) return '';

  const forwardedFor = req.headers?.['x-forwarded-for'];
  if (forwardedFor) {
    return String(forwardedFor).split(',')[0].trim();
  }

  return String(req.ip || '');
}

/**
 * Extrae user-agent desde request.
 */
function extractUserAgent(req) {
  if (!req) return '';
  return String(req.headers?.['user-agent'] || '');
}

/**
 * Construye el actor a partir de req.crmAuth.
 */
function buildActorFromRequest(req) {
  const auth = req?.crmAuth || {};

  return {
    actorUserId: auth.userId || null,
    actorUsername: auth.username || '',
    actorRole: auth.role || ''
  };
}

/**
 * Guarda un evento de auditoría.
 *
 * Parámetros:
 * - action: acción realizada (obligatoria)
 * - entityType: tipo de entidad afectada (obligatorio)
 * - entityId: id de la entidad afectada
 * - details: objeto libre con contexto del cambio
 * - actorUserId / actorUsername / actorRole: actor explícito si se quiere pasar manualmente
 * - req: request HTTP opcional para extraer actor, ip y user-agent
 */
function saveAuditLog({
  action,
  entityType,
  entityId = null,
  details = null,
  actorUserId = null,
  actorUsername = '',
  actorRole = '',
  req = null
}) {
  if (!action) {
    throw new Error('saveAuditLog requiere action');
  }

  if (!entityType) {
    throw new Error('saveAuditLog requiere entityType');
  }

  const actorFromReq = buildActorFromRequest(req);

  const auditLog = {
    id: createAuditId(),
    actorUserId: actorUserId || actorFromReq.actorUserId || null,
    actorUsername: actorUsername || actorFromReq.actorUsername || '',
    actorRole: actorRole || actorFromReq.actorRole || '',
    action: String(action),
    entityType: String(entityType),
    entityId: entityId ? String(entityId) : null,
    details,
    ipAddress: extractIpAddress(req),
    userAgent: extractUserAgent(req),
    createdAt: nowIso()
  };

  db.prepare(`
    INSERT INTO audit_logs (
      id,
      actor_user_id,
      actor_username,
      actor_role,
      action,
      entity_type,
      entity_id,
      details_json,
      ip_address,
      user_agent,
      created_at
    ) VALUES (
      @id,
      @actorUserId,
      @actorUsername,
      @actorRole,
      @action,
      @entityType,
      @entityId,
      @detailsJson,
      @ipAddress,
      @userAgent,
      @createdAt
    )
  `).run({
    id: auditLog.id,
    actorUserId: auditLog.actorUserId,
    actorUsername: auditLog.actorUsername,
    actorRole: auditLog.actorRole,
    action: auditLog.action,
    entityType: auditLog.entityType,
    entityId: auditLog.entityId,
    detailsJson: auditLog.details ? JSON.stringify(auditLog.details) : null,
    ipAddress: auditLog.ipAddress,
    userAgent: auditLog.userAgent,
    createdAt: auditLog.createdAt
  });

  return auditLog;
}

/**
 * Devuelve todos los eventos de auditoría.
 *
 * Orden:
 * más recientes primero.
 */
function getAllAuditLogs() {
  const rows = db.prepare(`
    SELECT
      id,
      actor_user_id,
      actor_username,
      actor_role,
      action,
      entity_type,
      entity_id,
      details_json,
      ip_address,
      user_agent,
      created_at
    FROM audit_logs
    ORDER BY datetime(created_at) DESC
  `).all();

  return rows.map(mapRowToAuditLog);
}

/**
 * Devuelve auditoría filtrada por usuario.
 */
function getAuditLogsByUsername(username) {
  const rows = db.prepare(`
    SELECT
      id,
      actor_user_id,
      actor_username,
      actor_role,
      action,
      entity_type,
      entity_id,
      details_json,
      ip_address,
      user_agent,
      created_at
    FROM audit_logs
    WHERE actor_username = ?
    ORDER BY datetime(created_at) DESC
  `).all(String(username || '').trim());

  return rows.map(mapRowToAuditLog);
}

/**
 * Devuelve auditoría filtrada por entidad.
 */
function getAuditLogsByEntity(entityType, entityId) {
  const rows = db.prepare(`
    SELECT
      id,
      actor_user_id,
      actor_username,
      actor_role,
      action,
      entity_type,
      entity_id,
      details_json,
      ip_address,
      user_agent,
      created_at
    FROM audit_logs
    WHERE entity_type = ?
      AND entity_id = ?
    ORDER BY datetime(created_at) DESC
  `).all(
    String(entityType || '').trim(),
    String(entityId || '').trim()
  );

  return rows.map(mapRowToAuditLog);
}

/**
 * Devuelve auditoría con filtros opcionales.
 *
 * Filtros soportados:
 * - username
 * - action
 * - entityType
 * - entityId
 *
 * Siempre ordena por fecha descendente.
 */
/**
 * Devuelve auditoría con filtros opcionales y paginación.
 *
 * Filtros soportados:
 * - username
 * - action
 * - entityType
 * - entityId
 *
 * Paginación:
 * - limit
 * - offset
 *
 * Devuelve:
 * {
 *   total,
 *   logs
 * }
 */
function getAuditLogsFiltered({
  username = '',
  action = '',
  entityType = '',
  entityId = '',
  limit = 20,
  offset = 0
} = {}) {
  const conditions = [];
  const params = [];

  if (String(username || '').trim()) {
    conditions.push('actor_username = ?');
    params.push(String(username).trim());
  }

  if (String(action || '').trim()) {
    conditions.push('action = ?');
    params.push(String(action).trim());
  }

  if (String(entityType || '').trim()) {
    conditions.push('entity_type = ?');
    params.push(String(entityType).trim());
  }

  if (String(entityId || '').trim()) {
    conditions.push('entity_id = ?');
    params.push(String(entityId).trim());
  }

  const whereClause = conditions.length
    ? `WHERE ${conditions.join(' AND ')}`
    : '';

  const safeLimit = Math.max(1, Math.min(Number(limit) || 20, 100));
  const safeOffset = Math.max(0, Number(offset) || 0);

  /**
   * Total de eventos que cumplen filtros
   * antes de aplicar paginación.
   */
  const totalRow = db.prepare(`
    SELECT COUNT(*) AS total
    FROM audit_logs
    ${whereClause}
  `).get(...params);

  const total = Number(totalRow?.total || 0);

  /**
   * Datos paginados.
   */
  const rows = db.prepare(`
    SELECT
      id,
      actor_user_id,
      actor_username,
      actor_role,
      action,
      entity_type,
      entity_id,
      details_json,
      ip_address,
      user_agent,
      created_at
    FROM audit_logs
    ${whereClause}
    ORDER BY datetime(created_at) DESC
    LIMIT ?
    OFFSET ?
  `).all(...params, safeLimit, safeOffset);

  return {
    total,
    logs: rows.map(mapRowToAuditLog)
  };
}

module.exports = {
  saveAuditLog,
  getAllAuditLogs,
  getAuditLogsByUsername,
  getAuditLogsByEntity,
  getAuditLogsFiltered
};