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
 * Busca usuario por username incluyendo password_hash.
 *
 * Se usa en login y cambio de contraseña.
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
 */
function listCrmUsers() {
  return db.prepare(`
    SELECT
      id,
      username,
      role,
      is_active,
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

module.exports = {
  getCrmUserAuthByUsername,
  getCrmUserById,
  listCrmUsers,
  createCrmUser,
  updateCrmUserRoleAndActive,
  updateCrmUserPasswordHash,
  countActiveCrmAdmins
};