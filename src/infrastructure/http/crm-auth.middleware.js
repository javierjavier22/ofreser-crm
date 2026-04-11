/**
 * ============================================
 * CRM AUTH MIDDLEWARE (SQLITE VERSION)
 * ============================================
 *
 * ¿Qué hace este archivo?
 * -----------------------
 * Protege las rutas del CRM usando autenticación persistente en SQLite.
 *
 * Maneja:
 * - emisión de tokens
 * - validación de sesiones
 * - expiración automática
 * - revocación
 *
 * Diferencia clave vs versión anterior:
 * ------------------------------------
 * ANTES:
 * - sesiones en memoria (Map)
 *
 * AHORA:
 * - sesiones persistidas en SQLite (tabla crm_sessions)
 *
 * Beneficios:
 * - no se pierden sesiones al reiniciar
 * - sistema escalable
 * - listo para producción
 */

const crypto = require('crypto');
const db = require('../../infrastructure/database/sqlite');

/**
 * TTL del token (12 horas)
 */
const CRM_TOKEN_TTL_MS = 12 * 60 * 60 * 1000;

/**
 * Genera token seguro
 */
function generateToken() {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Limpia sesiones expiradas de la base
 */
function purgeExpiredTokens() {
  const now = Date.now();

  db.prepare(`
    DELETE FROM crm_sessions
    WHERE expires_at <= ?
  `).run(now);
}

/**
 * Crea una nueva sesión en SQLite.
 *
 * Mejora:
 * -------
 * Persistimos también userId para que luego
 * el middleware pueda exponer req.crmAuth.userId.
 */
function issueCrmToken(userId, username, role = 'admin') {
  purgeExpiredTokens();

  const token = generateToken();
  const now = Date.now();
  const expiresAt = now + CRM_TOKEN_TTL_MS;

  db.prepare(`
    INSERT INTO crm_sessions (
      token,
      user_id,
      username,
      role,
      issued_at,
      expires_at
    ) VALUES (?, ?, ?, ?, ?, ?)
  `).run(token, userId, username, role, now, expiresAt);

  return token;
}

/**
 * Busca sesión por token en SQLite
 */
function getCrmSessionByToken(token) {
  if (!token) return null;

  purgeExpiredTokens();

    const row = db.prepare(`
    SELECT token, user_id, username, role, issued_at, expires_at
    FROM crm_sessions
    WHERE token = ?
    LIMIT 1
  `).get(token);

  if (!row) return null;

  return {
    token: row.token,
    userId: row.user_id || null,
    username: row.username,
    role: row.role,
    issuedAt: row.issued_at,
    expiresAt: row.expires_at
  };
}

/**
 * Revoca sesión (logout)
 */
function revokeCrmToken(token) {
  if (!token) return false;

  const result = db.prepare(`
    DELETE FROM crm_sessions
    WHERE token = ?
  `).run(token);

  return result.changes > 0;
}

/**
 * Extrae token del request
 */
function extractCrmTokenFromRequest(req) {
  const authHeader = req.headers.authorization || '';
  const bearerPrefix = 'Bearer ';

  if (authHeader.startsWith(bearerPrefix)) {
    return authHeader.slice(bearerPrefix.length).trim();
  }

  const crmTokenHeader = req.headers['x-crm-token'];
  if (crmTokenHeader) {
    return String(crmTokenHeader).trim();
  }

  return null;
}

/**
 * Middleware principal
 */
function crmAuthMiddleware(req, res, next) {
  /**
   * 1. API KEY fallback (legacy)
   */
  const apiKey = req.headers['x-api-key'];
  const validApiKey = process.env.CRM_API_KEY;

  if (apiKey && validApiKey && apiKey === validApiKey) {
    req.crmAuth = {
      mode: 'api_key',
      username: 'legacy_api_key',
      role: 'admin'
    };

    return next();
  }

  /**
   * 2. Token desde SQLite
   */
  const token = extractCrmTokenFromRequest(req);
  const session = getCrmSessionByToken(token);

  if (session) {
    req.crmAuth = {
      mode: 'token',
      token,
      userId: session.userId || null,
      username: session.username,
      role: session.role || 'admin'
    };

    return next();
  }

  return res.status(401).json({
    error: 'Unauthorized'
  });
}

/**
 * Middleware de admin
 */
function requireAdmin(req, res, next) {
  if (!req.crmAuth) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (String(req.crmAuth.role || '').toLowerCase() !== 'admin') {
    return res.status(403).json({
      error: 'Forbidden: admin only'
    });
  }

  return next();
}

/**
 * Export público
 */
crmAuthMiddleware.issueCrmToken = issueCrmToken;
crmAuthMiddleware.getCrmSessionByToken = getCrmSessionByToken;
crmAuthMiddleware.revokeCrmToken = revokeCrmToken;
crmAuthMiddleware.extractCrmTokenFromRequest = extractCrmTokenFromRequest;
crmAuthMiddleware.requireAdmin = requireAdmin;

module.exports = crmAuthMiddleware;