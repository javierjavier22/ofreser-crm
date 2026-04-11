/**
 * ============================================
 * CRM AUTH CONTROLLER (VERSIÓN FINAL)
 * ============================================
 *
 * ¿Qué hace este archivo?
 * -----------------------
 * Maneja toda la autenticación del CRM usando
 * exclusivamente usuarios almacenados en SQLite.
 *
 * Endpoints:
 * - POST /crm/login
 * - GET /crm/me
 * - POST /crm/logout
 * - POST /crm/change-password
 *
 * CAMBIO IMPORTANTE:
 * ------------------
 * ❌ Eliminado fallback a .env
 * ✅ Solo autenticación contra base de datos
 *
 * Esto hace el sistema:
 * - Más seguro
 * - Más consistente
 * - Más vendible
 */

const crypto = require('crypto');
const crmAuthMiddleware = require('../crm-auth.middleware');
const db = require('../../database/sqlite');

/**
 * Verifica password contra hash almacenado.
 *
 * Formato del hash:
 * salt:hash
 */
function verifyPassword(plainPassword, storedHash) {
  try {
    const [salt, originalHash] = String(storedHash || '').split(':');

    if (!salt || !originalHash) return false;

    const computedHash = crypto
      .scryptSync(String(plainPassword || ''), salt, 64)
      .toString('hex');

    return crypto.timingSafeEqual(
      Buffer.from(originalHash, 'hex'),
      Buffer.from(computedHash, 'hex')
    );
  } catch {
    return false;
  }
}

/**
 * Genera hash seguro de contraseña
 */
function hashPassword(plainPassword) {
  const salt = crypto.randomBytes(16).toString('hex');

  const hash = crypto
    .scryptSync(String(plainPassword || ''), salt, 64)
    .toString('hex');

  return `${salt}:${hash}`;
}

/**
 * ============================================
 * LOGIN
 * ============================================
 */
function postCrmLogin(req, res) {
  const { username, password } = req.body || {};

  const normalizedUsername = String(username || '').trim();
  const rawPassword = String(password || '');

  if (!normalizedUsername || !rawPassword) {
    return res.status(400).json({
      error: 'Usuario y contraseña son obligatorios'
    });
  }

  /**
   * 🔎 Buscar usuario en DB
   */
  const dbUser = db.prepare(`
    SELECT
      id,
      username,
      password_hash,
      is_active,
      role
    FROM crm_users
    WHERE username = ?
    LIMIT 1
  `).get(normalizedUsername);

  /**
   * ❌ Usuario no existe
   */
  if (!dbUser) {
    return res.status(401).json({
      error: 'Credenciales inválidas'
    });
  }

  /**
   * ❌ Usuario inactivo
   */
  if (Number(dbUser.is_active) !== 1) {
    return res.status(403).json({
      error: 'Usuario inactivo'
    });
  }

  /**
   * 🔐 Validar contraseña
   */
  const validPassword = verifyPassword(
    rawPassword,
    dbUser.password_hash
  );

  if (!validPassword) {
    return res.status(401).json({
      error: 'Credenciales inválidas'
    });
  }

  /**
   * 🎟️ Emitir token
   */
  const token = crmAuthMiddleware.issueCrmToken(
    dbUser.id,
    dbUser.username,
    dbUser.role || 'admin'
  );

  return res.json({
    ok: true,
    token,
    username: dbUser.username,
    role: dbUser.role || 'admin'
  });
}

/**
 * ============================================
 * SESIÓN ACTUAL
 * ============================================
 */
function getCrmMe(req, res) {
  return res.json({
    ok: true,
    auth: {
      username: req.crmAuth?.username || null,
      role: req.crmAuth?.role || null
    }
  });
}

/**
 * ============================================
 * CAMBIO DE PASSWORD
 * ============================================
 */
function postCrmChangePassword(req, res) {
  const { currentPassword, newPassword } = req.body || {};

  const currentUsername = String(req.crmAuth?.username || '').trim();

  if (!currentUsername) {
    return res.status(401).json({
      error: 'Sesión inválida'
    });
  }

  if (!currentPassword || !newPassword) {
    return res.status(400).json({
      error: 'Datos incompletos'
    });
  }

  if (newPassword.length < 6) {
    return res.status(400).json({
      error: 'Mínimo 6 caracteres'
    });
  }

  /**
   * 🔎 Buscar usuario
   */
  const dbUser = db.prepare(`
    SELECT id, password_hash, is_active
    FROM crm_users
    WHERE username = ?
  `).get(currentUsername);

  if (!dbUser) {
    return res.status(400).json({
      error: 'Usuario inválido'
    });
  }

  if (Number(dbUser.is_active) !== 1) {
    return res.status(403).json({
      error: 'Usuario inactivo'
    });
  }

  /**
   * 🔐 Validar password actual
   */
  const valid = verifyPassword(
    currentPassword,
    dbUser.password_hash
  );

  if (!valid) {
    return res.status(401).json({
      error: 'Password actual incorrecto'
    });
  }

  /**
   * 🔁 Actualizar password
   */
  const newHash = hashPassword(newPassword);

  db.prepare(`
    UPDATE crm_users
    SET password_hash = ?, updated_at = datetime('now')
    WHERE id = ?
  `).run(newHash, dbUser.id);

  return res.json({
    ok: true
  });
}

/**
 * ============================================
 * LOGOUT
 * ============================================
 */
function postCrmLogout(req, res) {
  const token = crmAuthMiddleware.extractCrmTokenFromRequest(req);

  if (token) {
    crmAuthMiddleware.revokeCrmToken(token);
  }

  return res.json({ ok: true });
}

module.exports = {
  postCrmLogin,
  getCrmMe,
  postCrmLogout,
  postCrmChangePassword
};