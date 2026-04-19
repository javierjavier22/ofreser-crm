/**
 * ============================================
 * ADMIN USERS ROUTES
 * ============================================
 *
 * ¿Qué hace este archivo?
 * -----------------------
 * Maneja la administración de usuarios del sistema CRM.
 *
 * Permite:
 * - listar usuarios
 * - crear usuario
 * - editar usuario
 * - activar/desactivar usuario
 * - cambiar rol
 * - resetear contraseña
 *
 * IMPORTANTE:
 * -----------
 * - Estas rutas deben montarse detrás de crmAuthMiddleware
 * - Además, cada endpoint valida que el usuario sea admin
 * - Usa la tabla crm_users en SQLite
 *
 * Blindajes agregados:
 * --------------------
 * - No permite desactivarte a vos mismo
 * - No permite quitarte a vos mismo el rol admin
 * - No permite dejar al sistema sin admins activos
 * - Verifica que el usuario objetivo exista antes de modificarlo
 *
 * Mejora aplicada en esta versión:
 * --------------------------------
 * - validación de username
 * - validación mínima de contraseña
 * - límites razonables de longitud
 */

const express = require('express');
const crypto = require('crypto');

/**
 * Conexión central a SQLite.
 *
 * OJO:
 * Este archivo vive en src/routes,
 * por eso la ruta correcta hacia sqlite es esta.
 */
const {
  getCrmUserById,
  listCrmUsers,
  createCrmUser,
  updateCrmUserRoleAndActive,
  updateCrmUserPasswordHash,
  countActiveCrmAdmins
} = require('../infrastructure/persistence/sqlite/crm-users.repository');
const {
  saveAuditLog
} = require('../infrastructure/persistence/sqlite/audit.repository');

const {
  CRM_ROLES
} = require('../shared/constants/app.constants');

const {
  normalizeUsername,
  normalizeRole,
  isAllowedRole,
  getUsernameValidationError,
  getPasswordValidationError,
  parseBooleanLike
} = require('../shared/validation/crm.validation');

const router = express.Router();

const {
  unlockCrmUserController,
  blockCrmUserController
} = require('../infrastructure/http/controllers/admin.controller');

router.post('/:username/unlock', requireAdmin, unlockCrmUserController);
router.post('/:username/block', requireAdmin, blockCrmUserController);
/**
 * En esta etapa mantenemos importadas las constantes compartidas
 * para referencia del archivo, pero la validación real ya vive
 * en shared/validation/crm.validation.
 */
 
/**
 * ============================================
 * MIDDLEWARE DE AUTORIZACIÓN
 * ============================================
 */

/**
 * Valida que el usuario autenticado tenga rol admin.
 *
 * IMPORTANTE:
 * El proyecto actual carga la auth en req.crmAuth,
 * no en req.user.
 */
function requireAdmin(req, res, next) {
  if (!req.crmAuth) {
    return res.status(401).json({
      error: 'Unauthorized'
    });
  }

  if (String(req.crmAuth.role || '').toLowerCase() !== 'admin') {
    return res.status(403).json({
      error: 'Forbidden: admin only'
    });
  }

  return next();
}

/**
 * Bloquear un usuario del CRM por username.
 *
 * Ruta final real:
 * POST /admin/users/:username/block
 */
router.post('/:username/block', requireAdmin, blockCrmUserController);

/**
 * Desbloquear un usuario del CRM por username.
 *
 * Ruta final real:
 * POST /admin/users/:username/unlock
 */
router.post('/:username/unlock', requireAdmin, unlockCrmUserController);

/**
 * ============================================
 * HELPERS DE SEGURIDAD
 * ============================================
 */

/**
 * Genera hash de contraseña usando scrypt,
 * alineado con el esquema actual del proyecto.
 *
 * Formato:
 * salt:hash
 */
function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto
    .scryptSync(String(password || ''), salt, 64)
    .toString('hex');

  return `${salt}:${hash}`;
}

/**
 * ============================================
 * HELPERS DE USUARIOS
 * ============================================
 */



/**
 * ============================================
 * RUTAS
 * ============================================
 */

/**
 * GET /admin/users
 *
 * Lista todos los usuarios del CRM.
 *
 * Devuelve información segura:
 * - NO devuelve password_hash
 */
router.get('/', requireAdmin, (req, res) => {
  try {
const users = listCrmUsers();

    return res.json({
      ok: true,
      users
    });
  } catch (error) {
    return res.status(500).json({
      error: 'Error listando usuarios'
    });
  }
});

/**
 * POST /admin/users
 *
 * Crea un nuevo usuario del CRM.
 *
 * Body esperado:
 * {
 *   username: string,
 *   password: string,
 *   role: 'admin' | 'user'
 * }
 */
router.post('/', requireAdmin, (req, res) => {
  try {
    const { username, password, role } = req.body || {};

    const normalizedUsername = normalizeUsername(username);
    const rawPassword = String(password || '');
    const normalizedRole = normalizeRole(role);

    /**
     * Validación fuerte de username.
     */
    const usernameError = getUsernameValidationError(normalizedUsername);
    if (usernameError) {
      return res.status(400).json({
        error: usernameError
      });
    }

    /**
     * Validación fuerte de password.
     */
    const passwordError = getPasswordValidationError(rawPassword, 'password');
    if (passwordError) {
      return res.status(400).json({
        error: passwordError
      });
    }

    /**
     * Validación de role.
     */
    if (!isAllowedRole(normalizedRole)) {
      return res.status(400).json({
        error: 'role inválido'
      });
    }

    const id = `user_${Date.now()}`;
    const passwordHash = hashPassword(rawPassword);

createCrmUser({
  id,
  username: normalizedUsername,
  passwordHash,
  role: normalizedRole,
  isActive: 1
});

    /**
     * Registramos creación de usuario.
     */
    saveAuditLog({
      action: 'ADMIN_USER_CREATED',
      entityType: 'user',
      entityId: id,
      req,
      details: {
        createdUsername: normalizedUsername,
        createdRole: normalizedRole,
        isActive: true
      }
    });

    return res.json({
      ok: true,
      message: 'Usuario creado correctamente'
    });
  } catch (error) {
    if (String(error.message || '').includes('UNIQUE')) {
      return res.status(400).json({
        error: 'Usuario ya existe'
      });
    }

    return res.status(500).json({
      error: 'Error creando usuario'
    });
  }
});

/**
 * PUT /admin/users/:id
 *
 * Edita rol y estado activo del usuario.
 *
 * Body esperado:
 * {
 *   role: 'admin' | 'user',
 *   is_active: true | false
 * }
 *
 * Blindajes:
 * ----------
 * - No permite desactivarte a vos mismo
 * - No permite bajarte tu propio rol admin
 * - No permite dejar al sistema sin admins activos
 */
router.put('/:id', requireAdmin, (req, res) => {
  try {
    const { id } = req.params;
    const { role, is_active } = req.body || {};

    /**
     * Usuario autenticado actual.
     *
     * Viene del middleware CRM.
     */
    const currentUserId = String(
      req.crmAuth?.userId || req.crmAuth?.id || ''
    ).trim();

    /**
     * Normalizamos el rol entrante.
     */
    const normalizedRole = normalizeRole(role);

    if (!isAllowedRole(normalizedRole)) {
      return res.status(400).json({
        error: 'role inválido'
      });
    }

    /**
     * Verificamos que el usuario objetivo exista.
     */
    const targetUser = getCrmUserById(id);

    if (!targetUser) {
      return res.status(404).json({
        error: 'Usuario no encontrado'
      });
    }

    /**
     * Normalizamos el estado activo entrante.
     *
     * Aceptamos boolean, 0/1 o equivalentes truthy/falsy.
     */
const nextIsActive = parseBooleanLike(is_active) ? 1 : 0;

    /**
     * Blindaje 1:
     * No permitir que el admin actual se desactive a sí mismo.
     */
    if (
      currentUserId &&
      currentUserId === String(targetUser.id) &&
      nextIsActive === 0
    ) {
      return res.status(400).json({
        error: 'No podés desactivarte a vos mismo'
      });
    }

    /**
     * Blindaje 2:
     * No permitir que el admin actual se quite a sí mismo el rol admin.
     */
    if (
      currentUserId &&
      currentUserId === String(targetUser.id) &&
      String(targetUser.role).toLowerCase() === 'admin' &&
      normalizedRole !== 'admin'
    ) {
      return res.status(400).json({
        error: 'No podés quitarte a vos mismo el rol admin'
      });
    }

    /**
     * Blindaje 3:
     * Si el usuario objetivo es admin activo y el cambio lo desactiva
     * o lo baja a user, verificamos que no sea el último admin activo.
     */
    const targetIsAdmin =
      String(targetUser.role || '').toLowerCase() === 'admin';

    const targetIsActive = Number(targetUser.is_active || 0) === 1;

    const adminWouldBeRemoved =
      targetIsAdmin &&
      targetIsActive &&
      (nextIsActive === 0 || normalizedRole !== 'admin');

    if (adminWouldBeRemoved) {
      const activeAdmins = countActiveCrmAdmins();

      if (activeAdmins <= 1) {
        return res.status(400).json({
          error: 'No podés dejar al sistema sin un admin activo'
        });
      }
    }

    /**
     * Ejecutamos actualización.
     */
updateCrmUserRoleAndActive({
  id,
  role: normalizedRole,
  isActive: nextIsActive
});

    /**
     * Registramos cambio administrativo sobre usuario.
     */
    saveAuditLog({
      action: 'ADMIN_USER_UPDATED',
      entityType: 'user',
      entityId: id,
      req,
      details: {
        targetUsername: targetUser.username,
        from: {
          role: targetUser.role,
          isActive: Number(targetUser.is_active) === 1
        },
        to: {
          role: normalizedRole,
          isActive: nextIsActive === 1
        }
      }
    });

    return res.json({
      ok: true,
      message: 'Usuario actualizado correctamente'
    });
  } catch (error) {
    return res.status(500).json({
      error: 'Error actualizando usuario'
    });
  }
});

/**
 * POST /admin/users/:id/reset-password
 *
 * Resetea la contraseña de un usuario.
 *
 * Body esperado:
 * {
 *   newPassword: string
 * }
 */
router.post('/:id/reset-password', requireAdmin, (req, res) => {
  try {
    const { id } = req.params;
    const { newPassword } = req.body || {};

    const rawPassword = String(newPassword || '');

    /**
     * Validación fuerte de nueva contraseña.
     */
    const passwordError = getPasswordValidationError(
      rawPassword,
      'newPassword'
    );

    if (passwordError) {
      return res.status(400).json({
        error: passwordError
      });
    }

    /**
     * Verificamos que el usuario exista antes de tocar la contraseña.
     */
    const targetUser = getCrmUserById(id);

    if (!targetUser) {
      return res.status(404).json({
        error: 'Usuario no encontrado'
      });
    }

    const passwordHash = hashPassword(rawPassword);

    updateCrmUserPasswordHash({
  id,
  passwordHash
});

    /**
     * Registramos reset de contraseña por admin.
     */
    saveAuditLog({
      action: 'ADMIN_USER_PASSWORD_RESET',
      entityType: 'user',
      entityId: id,
      req,
      details: {
        targetUsername: targetUser.username
      }
    });

    return res.json({
      ok: true,
      message: 'Contraseña reseteada correctamente'
    });
  } catch (error) {
    return res.status(500).json({
      error: 'Error reseteando contraseña'
    });
  }
});

module.exports = router;