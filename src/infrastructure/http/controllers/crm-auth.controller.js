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
const {
  getCrmUserAuthByUsername,
  updateCrmUserPasswordHash
} = require('../../persistence/sqlite/crm-users.repository');

const {
  CRM_ROLES
} = require('../../../shared/constants/app.constants');

const {
  saveAuditLog
} = require('../../persistence/sqlite/audit.repository');

const {
  normalizeUsername,
  getPasswordValidationError
} = require('../../../shared/validation/crm.validation');

/**
 * Verifica password contra hash almacenado.
 *
 * Formato del hash:
 * salt:hash
 */
 
 /**
 * ============================================
 * RATE LIMIT DE LOGIN EN MEMORIA
 * ============================================
 *
 * ¿Qué hace este bloque?
 * ----------------------
 * Protege el endpoint /crm/login contra fuerza bruta simple.
 *
 * Estrategia:
 * -----------
 * - cuenta intentos fallidos por IP
 * - si supera el límite, bloquea temporalmente
 * - si el login es exitoso, limpia el contador
 *
 * Importante:
 * -----------
 * - es en memoria
 * - se reinicia si reinicia el proceso
 * - para este MVP es suficiente y de bajo riesgo
 */

const LOGIN_RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000; // 15 minutos
const LOGIN_RATE_LIMIT_MAX_ATTEMPTS = 5;

/**
 * Estructura:
 * Map<ip, { attempts: number, firstAttemptAt: number, blockedUntil: number }>
 */
const loginAttemptStore = new Map();

/**
 * Devuelve una IP razonable para rate limit.
 *
 * Prioridad:
 * - x-forwarded-for (Render / proxy)
 * - req.ip
 * - fallback genérico
 */
function getClientIp(req) {
  const forwardedFor = String(req.headers['x-forwarded-for'] || '')
    .split(',')[0]
    .trim();

  if (forwardedFor) {
    return forwardedFor;
  }

  return String(req.ip || 'unknown').trim();
}

/**
 * Limpia el estado vencido de una IP.
 */
function normalizeLoginAttemptState(ip) {
  const now = Date.now();
  const current = loginAttemptStore.get(ip);

  if (!current) {
    return null;
  }

  /**
   * Si el bloqueo ya venció y la ventana también venció,
   * limpiamos completamente.
   */
  const windowExpired =
    current.firstAttemptAt &&
    now - current.firstAttemptAt > LOGIN_RATE_LIMIT_WINDOW_MS;

  const blockExpired =
    current.blockedUntil &&
    now >= current.blockedUntil;

  if (windowExpired && blockExpired) {
    loginAttemptStore.delete(ip);
    return null;
  }

  /**
   * Si venció la ventana de intentos pero no estaba bloqueado,
   * reiniciamos contador.
   */
  if (windowExpired && !current.blockedUntil) {
    loginAttemptStore.delete(ip);
    return null;
  }

  /**
   * Si estaba bloqueado y el bloqueo venció,
   * reiniciamos estado para permitir nuevos intentos.
   */
  if (current.blockedUntil && now >= current.blockedUntil) {
    loginAttemptStore.delete(ip);
    return null;
  }

  return current;
}

/**
 * Devuelve si la IP está bloqueada actualmente.
 */
function getLoginBlockStatus(ip) {
  const current = normalizeLoginAttemptState(ip);

  if (!current) {
    return {
      blocked: false,
      retryAfterSeconds: 0
    };
  }

  const now = Date.now();

  if (current.blockedUntil && now < current.blockedUntil) {
    return {
      blocked: true,
      retryAfterSeconds: Math.max(
        1,
        Math.ceil((current.blockedUntil - now) / 1000)
      )
    };
  }

  return {
    blocked: false,
    retryAfterSeconds: 0
  };
}

/**
 * Registra un intento fallido para la IP.
 */
function registerFailedLoginAttempt(ip) {
  const now = Date.now();
  const current = normalizeLoginAttemptState(ip);

  if (!current) {
    loginAttemptStore.set(ip, {
      attempts: 1,
      firstAttemptAt: now,
      blockedUntil: 0
    });
    return;
  }

  /**
   * Si la ventana sigue vigente, sumamos intento.
   */
  current.attempts += 1;

  /**
   * Si alcanza el máximo, bloqueamos.
   */
  if (current.attempts >= LOGIN_RATE_LIMIT_MAX_ATTEMPTS) {
    current.blockedUntil = now + LOGIN_RATE_LIMIT_WINDOW_MS;
  }

  loginAttemptStore.set(ip, current);
}

/**
 * Limpia intentos fallidos luego de login exitoso.
 */
function clearFailedLoginAttempts(ip) {
  loginAttemptStore.delete(ip);
}


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
/**
 * ============================================
 * LOGIN
 * ============================================
 *
 * Protecciones:
 * - valida usuario/password obligatorios
 * - aplica rate limit por IP
 * - limpia contador en login exitoso
 */
function postCrmLogin(req, res) {
  const { username, password } = req.body || {};

  const normalizedUsername = normalizeUsername(username);
  const rawPassword = String(password || '');
  const clientIp = getClientIp(req);

  /**
   * 1. Revisamos si la IP está temporalmente bloqueada.
   */
  const blockStatus = getLoginBlockStatus(clientIp);

  if (blockStatus.blocked) {
    return res.status(429).json({
      error: `Demasiados intentos fallidos. Intentá de nuevo en ${blockStatus.retryAfterSeconds} segundos.`
    });
  }

  if (!normalizedUsername || !rawPassword) {
    return res.status(400).json({
      error: 'Usuario y contraseña son obligatorios'
    });
  }

  /**
   * 2. Buscar usuario en DB.
   */
  const dbUser = getCrmUserAuthByUsername(normalizedUsername);

  /**
   * 3. Usuario inexistente.
   */
  if (!dbUser) {
    registerFailedLoginAttempt(clientIp);

    return res.status(401).json({
      error: 'Credenciales inválidas'
    });
  }

  /**
   * 4. Usuario inactivo.
   *
   * Nota:
   * también cuenta como intento fallido para no filtrar demasiado.
   */
  if (Number(dbUser.is_active) !== 1) {
    registerFailedLoginAttempt(clientIp);

    return res.status(403).json({
      error: 'Usuario inactivo'
    });
  }

  /**
   * 5. Validar contraseña.
   */
  const validPassword = verifyPassword(
    rawPassword,
    dbUser.password_hash
  );

  if (!validPassword) {
    registerFailedLoginAttempt(clientIp);

    return res.status(401).json({
      error: 'Credenciales inválidas'
    });
  }

  /**
   * 6. Si el login fue correcto, limpiamos intentos fallidos.
   */
  clearFailedLoginAttempts(clientIp);

  /**
   * 7. Emitir token.
   */
  const token = crmAuthMiddleware.issueCrmToken(
    dbUser.id,
    dbUser.username,
    dbUser.role || CRM_ROLES.ADMIN
  );

  /**
   * 8. Registramos login exitoso en auditoría.
   */
  saveAuditLog({
    action: 'CRM_LOGIN_SUCCESS',
    entityType: 'auth',
    entityId: dbUser.id,
    actorUserId: dbUser.id,
    actorUsername: dbUser.username,
    actorRole: dbUser.role || CRM_ROLES.ADMIN,
    req,
    details: {
      username: dbUser.username
    }
  });

  return res.json({
    ok: true,
    token,
    username: dbUser.username,
    role: dbUser.role || CRM_ROLES.ADMIN
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

  const currentUsername = normalizeUsername(req.crmAuth?.username);

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

const newPasswordError = getPasswordValidationError(newPassword, 'newPassword');

if (newPasswordError) {
  return res.status(400).json({
    error: newPasswordError
  });
}

  /**
   * 🔎 Buscar usuario
   */
const dbUser = getCrmUserAuthByUsername(currentUsername);

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

updateCrmUserPasswordHash({
  id: dbUser.id,
  passwordHash: newHash
});

  /**
   * Registramos cambio de contraseña propia.
   */
  saveAuditLog({
    action: 'CRM_PASSWORD_CHANGED',
    entityType: 'user',
    entityId: dbUser.id,
    req,
    details: {
      username: currentUsername
    }
  });

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

  /**
   * Registramos logout del usuario autenticado.
   */
  saveAuditLog({
    action: 'CRM_LOGOUT',
    entityType: 'auth',
    entityId: req.crmAuth?.userId || null,
    req,
    details: {
      username: req.crmAuth?.username || null
    }
  });

  return res.json({ ok: true });
}

module.exports = {
  postCrmLogin,
  getCrmMe,
  postCrmLogout,
  postCrmChangePassword
};