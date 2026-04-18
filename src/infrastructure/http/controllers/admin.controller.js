/**
 * ============================================
 * ADMIN CONTROLLER
 * ============================================
 *
 * ¿Qué hace este archivo?
 * -----------------------
 * Expone endpoints administrativos internos
 * para mantenimiento técnico del sistema.
 *
 * En esta etapa incorpora:
 * - reset completo de la base de datos de testing
 * - consulta de auditoría
 *
 * ¿Qué borra el reset?
 * --------------------
 * - messages
 * - leads
 * - sessions
 *
 * ¿Qué NO borra?
 * --------------
 * - estructura de tablas
 * - archivo SQLite
 * - configuración del sistema
 *
 * Importante:
 * -----------
 * Este endpoint debe estar protegido por autenticación del CRM.
 * No debe quedar público.
 *
 * Blindaje extra agregado:
 * ------------------------
 * El reset solo se permite si:
 * - ALLOW_ADMIN_RESET=true
 *
 * Además:
 * - por defecto queda bloqueado
 * - especialmente protege producción
 */

const db = require('../../database/sqlite');
const { logger } = require('../../../shared/logger/logger');
const {
  createBackup,
  listBackups
} = require('../../database/backup');

const {
  restoreBackup
} = require('../../database/restore');
const {
  saveAuditLog,
  getAuditLogsFiltered
} = require('../../persistence/sqlite/audit.repository');

const { unlockCrmUser } = require('../../persistence/sqlite/crm-users.repository');

/**
 * Devuelve true solo si el reset administrativo
 * está explícitamente habilitado.
 *
 * Regla:
 * - debe existir ALLOW_ADMIN_RESET=true
 *
 * Esto evita depender únicamente de:
 * - middleware
 * - entorno
 * - suposiciones de deploy
 */
function isAdminResetAllowed() {
  return String(process.env.ALLOW_ADMIN_RESET || '').trim().toLowerCase() === 'true';
}

/**
 * Devuelve información básica de contexto
 * para explicar por qué el reset fue bloqueado.
 */
function buildResetBlockContext() {
  return {
    nodeEnv: String(process.env.NODE_ENV || 'development'),
    allowAdminReset: String(process.env.ALLOW_ADMIN_RESET || '')
  };
}

/**
 * Resetea completamente los datos operativos del sistema.
 *
 * Uso recomendado:
 * ----------------
 * Antes de una tanda nueva de testing funcional.
 *
 * Resultado:
 * ----------
 * El sistema queda vacío de:
 * - sesiones
 * - mensajes
 * - leads
 *
 * Pero conserva la estructura de la base.
 */
function postResetSystem(req, res) {
  try {
    /**
     * Blindaje crítico:
     * este endpoint solo se ejecuta si está habilitado
     * explícitamente por variable de entorno.
     */
    if (!isAdminResetAllowed()) {
      logger.warn('Intento de reset administrativo bloqueado por configuración de entorno', {
        nodeEnv: String(process.env.NODE_ENV || 'development'),
        allowAdminReset: String(process.env.ALLOW_ADMIN_RESET || ''),
        actorUsername: req?.crmAuth?.username || '',
        actorRole: req?.crmAuth?.role || ''
      });

      return res.status(403).json({
        error: 'Reset administrativo deshabilitado en este entorno',
        code: 'ADMIN_RESET_DISABLED',
        context: buildResetBlockContext()
      });
    }

    /**
     * Usamos transacción explícita para evitar
     * estados parciales si algo falla.
     */
    const resetTransaction = db.transaction(() => {
      /**
       * Desactivamos temporalmente las foreign keys
       * por seguridad durante el borrado.
       */
      db.pragma('foreign_keys = OFF');

      /**
       * Borramos primero mensajes, luego leads,
       * luego sesiones.
       *
       * Este orden reduce riesgo de conflictos
       * si en el futuro hay relaciones entre tablas.
       */
      db.prepare('DELETE FROM messages').run();
      db.prepare('DELETE FROM leads').run();
      db.prepare('DELETE FROM sessions').run();

      /**
       * Reactivamos foreign keys.
       */
      db.pragma('foreign_keys = ON');
    });

    resetTransaction();

    /**
     * Registramos reset del sistema en auditoría.
     */
    saveAuditLog({
      action: 'ADMIN_RESET_SYSTEM',
      entityType: 'system',
      entityId: 'global',
      req,
      details: {
        deletedTables: ['messages', 'leads', 'sessions'],
        nodeEnv: String(process.env.NODE_ENV || 'development')
      }
    });

    logger.warn('Reset administrativo ejecutado correctamente', {
      actorUsername: req?.crmAuth?.username || '',
      actorRole: req?.crmAuth?.role || '',
      deletedTables: ['messages', 'leads', 'sessions']
    });

    return res.json({
      ok: true,
      message: 'Sistema reseteado correctamente. Se borraron messages, leads y sessions.'
    });
  } catch (error) {
    logger.error(`Error reseteando sistema: ${error.message}`, {
      actorUsername: req?.crmAuth?.username || '',
      actorRole: req?.crmAuth?.role || '',
      stack: error.stack || null
    });

    return res.status(500).json({
      error: 'No se pudo resetear el sistema'
    });
  }
}

/**
 * Desbloquea un usuario CRM (solo admin).
 */
async function unlockCrmUserController(req, res) {
  try {
    const { username } = req.params;

    if (!username) {
      return res.status(400).json({ error: 'username requerido' });
    }

    unlockCrmUser(username);

    return res.json({
      ok: true,
      message: 'Usuario desbloqueado correctamente'
    });

  } catch (error) {
    console.error('unlockCrmUserController error:', error);
    return res.status(500).json({ error: 'Error interno' });
  }
}

/**
 * Devuelve auditoría del sistema.
 *
 * Seguridad:
 * ----------
 * Esta función debe quedar montada solo detrás de:
 * - crmAuthMiddleware
 * - requireAdmin
 *
 * Filtros opcionales por query string:
 * - username
 * - action
 * - entityType
 * - entityId
 */
function getAuditLogs(req, res) {
  try {
    const {
      username = '',
      action = '',
      entityType = '',
      entityId = '',
      limit = '20',
      offset = '0'
    } = req.query || {};

    const result = getAuditLogsFiltered({
      username,
      action,
      entityType,
      entityId,
      limit: Number(limit),
      offset: Number(offset)
    });

    logger.info('Consulta de auditoría ejecutada', {
      actorUsername: req?.crmAuth?.username || '',
      actorRole: req?.crmAuth?.role || '',
      filters: {
        username,
        action,
        entityType,
        entityId
      },
      pagination: {
        limit: Number(limit),
        offset: Number(offset)
      },
      total: result.total,
      returned: result.logs.length
    });

    return res.json({
      ok: true,
      total: result.total,
      limit: Math.max(1, Math.min(Number(limit) || 20, 100)),
      offset: Math.max(0, Number(offset) || 0),
      logs: result.logs
    });
  } catch (error) {
    logger.error(`Error consultando auditoría: ${error.message}`, {
      actorUsername: req?.crmAuth?.username || '',
      actorRole: req?.crmAuth?.role || '',
      stack: error.stack || null
    });

    return res.status(500).json({
      error: 'No se pudo consultar la auditoría'
    });
  }
}

/**
 * Crea un backup manual desde el panel admin.
 *
 * Seguridad:
 * ----------
 * Esta función debe quedar montada solo detrás de:
 * - crmAuthMiddleware
 * - requireAdmin
 */
function postCreateBackup(req, res) {
  try {
    const backupPath = createBackup();

    saveAuditLog({
      action: 'ADMIN_BACKUP_CREATED',
      entityType: 'system',
      entityId: 'backup',
      req,
      details: {
        backupPath
      }
    });

    logger.info('Backup creado desde admin', {
      actorUsername: req?.crmAuth?.username || '',
      actorRole: req?.crmAuth?.role || '',
      backupPath
    });

    return res.json({
      ok: true,
      backupPath
    });
  } catch (error) {
    logger.error(`Error creando backup desde admin: ${error.message}`, {
      actorUsername: req?.crmAuth?.username || '',
      actorRole: req?.crmAuth?.role || '',
      stack: error.stack || null
    });

    return res.status(500).json({
      error: 'No se pudo crear el backup'
    });
  }
}

/**
 * Lista backups disponibles.
 *
 * Seguridad:
 * ----------
 * Esta función debe quedar montada solo detrás de:
 * - crmAuthMiddleware
 * - requireAdmin
 */
function getBackups(req, res) {
  try {
    const backups = listBackups();

    logger.info('Listado de backups consultado', {
      actorUsername: req?.crmAuth?.username || '',
      actorRole: req?.crmAuth?.role || '',
      total: backups.length
    });

    return res.json({
      ok: true,
      total: backups.length,
      backups
    });
  } catch (error) {
    logger.error(`Error listando backups: ${error.message}`, {
      actorUsername: req?.crmAuth?.username || '',
      actorRole: req?.crmAuth?.role || '',
      stack: error.stack || null
    });

    return res.status(500).json({
      error: 'No se pudieron listar los backups'
    });
  }
}

/**
 * Restaura la base activa desde un backup elegido.
 *
 * IMPORTANTE:
 * -----------
 * Esta operación es delicada.
 *
 * Seguridad:
 * ----------
 * Esta función debe quedar montada solo detrás de:
 * - crmAuthMiddleware
 * - requireAdmin
 *
 * Body esperado:
 * {
 *   backupPath: string
 * }
 */
function postRestoreBackup(req, res) {
  try {
    const { backupPath } = req.body || {};

    if (!backupPath) {
      return res.status(400).json({
        error: 'backupPath es requerido'
      });
    }

    const result = restoreBackup(backupPath, {
      confirmRestore: true
    });

    saveAuditLog({
      action: 'ADMIN_RESTORE_EXECUTED',
      entityType: 'system',
      entityId: 'restore',
      req,
      details: {
        restoredFrom: result.restoredFrom
      }
    });

    logger.warn('Restore ejecutado desde admin', {
      actorUsername: req?.crmAuth?.username || '',
      actorRole: req?.crmAuth?.role || '',
      restoredFrom: result.restoredFrom
    });

    return res.json({
      ok: true,
      result
    });
  } catch (error) {
    logger.error(`Error en restore desde admin: ${error.message}`, {
      actorUsername: req?.crmAuth?.username || '',
      actorRole: req?.crmAuth?.role || '',
      stack: error.stack || null
    });

    return res.status(500).json({
      error: error.message || 'No se pudo restaurar el backup'
    });
  }
}


module.exports = {
  postResetSystem,
  unlockCrmUserController,
  getAuditLogs,
  postCreateBackup,
  getBackups,
  postRestoreBackup
};