/**
 * ============================================
 * CRM SESSIONS REPOSITORY
 * ============================================
 *
 * ¿Qué hace este archivo?
 * -----------------------
 * Centraliza el acceso a la tabla crm_sessions.
 *
 * Responsabilidades:
 * - crear sesión CRM
 * - buscar sesión por token
 * - borrar sesión por token
 * - purgar sesiones expiradas
 *
 * Importante:
 * -----------
 * Este archivo NO decide autenticación.
 * Solo encapsula acceso a base de datos.
 */

const db = require('../../database/sqlite');

/**
 * Elimina sesiones expiradas.
 */
function purgeExpiredCrmSessions(nowTs) {
  return db.prepare(`
    DELETE FROM crm_sessions
    WHERE expires_at <= ?
  `).run(Number(nowTs) || 0);
}

/**
 * Crea sesión CRM persistente.
 */
function createCrmSession({
  token,
  userId,
  username,
  role,
  issuedAt,
  expiresAt
}) {
  return db.prepare(`
    INSERT INTO crm_sessions (
      token,
      user_id,
      username,
      role,
      issued_at,
      expires_at
    ) VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    String(token || '').trim(),
    userId || null,
    String(username || '').trim(),
    String(role || 'admin').trim(),
    Number(issuedAt) || 0,
    Number(expiresAt) || 0
  );
}

/**
 * Busca sesión por token.
 */
function getCrmSessionByTokenRow(token) {
  return (
    db.prepare(`
      SELECT
        token,
        user_id,
        username,
        role,
        issued_at,
        expires_at
      FROM crm_sessions
      WHERE token = ?
      LIMIT 1
    `).get(String(token || '').trim()) || null
  );
}

/**
 * Borra sesión por token.
 */
function deleteCrmSessionByToken(token) {
  return db.prepare(`
    DELETE FROM crm_sessions
    WHERE token = ?
  `).run(String(token || '').trim());
}

module.exports = {
  purgeExpiredCrmSessions,
  createCrmSession,
  getCrmSessionByTokenRow,
  deleteCrmSessionByToken
};