/**
 * ============================================
 * CRM USERS REPOSITORY
 * ============================================
 *
 * ¿Qué hace este archivo?
 * -----------------------
 * Centraliza el acceso a la tabla crm_users.
 *
 * Responsabilidades:
 * - buscar usuarios
 * - listar usuarios
 * - crear usuarios
 * - actualizar rol / activo
 * - actualizar password hash
 * - contar admins activos
 *
 * Importante:
 * -----------
 * Este archivo NO valida permisos.
 * Solo encapsula acceso a base de datos.
 */

const db = require('../../database/sqlite');

/**
 * Busca usuario por username incluyendo datos sensibles de auth.
 *
 * Se usa en:
 * - login
 * - cambio de contraseña
 * - control de bloqueo
 */
function getCrmUserAuthByUsername(username) {
  return (
    db.prepare(`
      SELECT
        id,
        username,
        password_hash,
        is_active,
        role,
        failed_attempts,
        is_blocked,
        created_at,
        updated_at
      FROM crm_users
      WHERE username = ?
      LIMIT 1
    `).get(String(username || '').trim()) || null
  );
}

/**
 * Busca usuario por ID sin exponer password_hash.
 *
 * Se usa para administración.
 */
function getCrmUserById(id) {
  return (
    db.prepare(`
      SELECT
        id,
        username,
        role,
        is_active,
        created_at,
        updated_at
      FROM crm_users
      WHERE id = ?
      LIMIT 1
    `).get(String(id || '').trim()) || null
  );
}

/**
 * Lista usuarios del CRM sin password_hash.
 *
 * Importante:
 * - devolvemos is_blocked para que el frontend
 *   pueda mostrar correctamente Bloquear / Desbloquear
 * - devolvemos failed_attempts para debugging/admin
 */
function listCrmUsers() {
  return db.prepare(`
    SELECT
      id,
      username,
      role,
      is_active,
      is_blocked,
      failed_attempts,
      created_at,
      updated_at
    FROM crm_users
    ORDER BY datetime(created_at) DESC
  `).all();
}

/**
 * Crea usuario CRM.
 */
function createCrmUser({
  id,
  username,
  passwordHash,
  role,
  isActive = 1
}) {
  return db.prepare(`
    INSERT INTO crm_users (
      id,
      username,
      password_hash,
      role,
      is_active,
      created_at,
      updated_at
    ) VALUES (?, ?, ?, ?, ?, datetime('now'), datetime('now'))
  `).run(
    String(id || '').trim(),
    String(username || '').trim(),
    String(passwordHash || ''),
    String(role || 'user').trim(),
    Number(isActive) === 1 ? 1 : 0
  );
}

/**
 * Actualiza rol y estado activo de usuario.
 */
function updateCrmUserRoleAndActive({
  id,
  role,
  isActive
}) {
  return db.prepare(`
    UPDATE crm_users
    SET
      role = ?,
      is_active = ?,
      updated_at = datetime('now')
    WHERE id = ?
  `).run(
    String(role || 'user').trim(),
    Number(isActive) === 1 ? 1 : 0,
    String(id || '').trim()
  );
}

/**
 * Actualiza password hash de usuario.
 */
function updateCrmUserPasswordHash({
  id,
  passwordHash
}) {
  return db.prepare(`
    UPDATE crm_users
    SET
      password_hash = ?,
      updated_at = datetime('now')
    WHERE id = ?
  `).run(
    String(passwordHash || ''),
    String(id || '').trim()
  );
}

/**
 * Cuenta admins activos.
 */
function countActiveCrmAdmins() {
  const row = db.prepare(`
    SELECT COUNT(*) AS total
    FROM crm_users
    WHERE role = 'admin'
      AND is_active = 1
  `).get();

  return Number(row?.total || 0);
}

/**
 * Incrementa intentos fallidos de login para un usuario.
 */
function incrementCrmUserFailedAttempts(userId) {
  return db.prepare(`
    UPDATE crm_users
    SET
      failed_attempts = COALESCE(failed_attempts, 0) + 1,
      updated_at = datetime('now')
    WHERE id = ?
  `).run(String(userId || '').trim());
}

/**
 * Desbloquea un usuario del CRM.
 *
 * - limpia intentos fallidos
 * - elimina bloqueo
 */
function unlockCrmUser(username) {
  return db.prepare(`
    UPDATE crm_users
    SET
      failed_attempts = 0,
      is_blocked = 0
    WHERE username = ?
  `).run(username);
}

/**
 * Resetea intentos fallidos de login para un usuario.
 *
 * Se usa cuando el login fue correcto.
 */
function resetCrmUserFailedAttempts(userId) {
  return db.prepare(`
    UPDATE crm_users
    SET
      failed_attempts = 0,
      updated_at = datetime('now')
    WHERE id = ?
  `).run(String(userId || '').trim());
}

/**
 * Bloquea un usuario CRM por username.
 *
 * Importante:
 * - no lo desactiva
 * - solo marca is_blocked = 1
 * - resetea updated_at
 */
function blockCrmUser(username) {
  return db.prepare(`
    UPDATE crm_users
    SET
      is_blocked = 1,
      updated_at = datetime('now')
    WHERE username = ?
  `).run(String(username || '').trim());
}

/**
 * Desbloquea un usuario CRM y reinicia intentos fallidos.
 *
 * Esto nos va a servir también más adelante
 * si querés agregar botón "Desbloquear".
 */
function unblockCrmUser(userId) {
  return db.prepare(`
    UPDATE crm_users
    SET
      is_blocked = 0,
      failed_attempts = 0,
      updated_at = datetime('now')
    WHERE id = ?
  `).run(String(userId || '').trim());
}

module.exports = {
  getCrmUserAuthByUsername,
  getCrmUserById,
  listCrmUsers,
  createCrmUser,
  updateCrmUserRoleAndActive,
  updateCrmUserPasswordHash,
  countActiveCrmAdmins,
  incrementCrmUserFailedAttempts,
  resetCrmUserFailedAttempts,
  blockCrmUser,
  unblockCrmUser,
  unlockCrmUser
};