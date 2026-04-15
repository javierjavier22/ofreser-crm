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
const {
  saveAuditLog,
  getAuditLogsFiltered
} = require('../../persistence/sqlite/audit.repository');

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

    return res.json({
      ok: true,
      message: 'Sistema reseteado correctamente. Se borraron messages, leads y sessions.'
    });
  } catch (error) {
    console.error('❌ Error reseteando sistema:', error.message);

    return res.status(500).json({
      error: 'No se pudo resetear el sistema'
    });
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
      entityId = ''
    } = req.query || {};

    const logs = getAuditLogsFiltered({
      username,
      action,
      entityType,
      entityId
    });

    return res.json({
      ok: true,
      total: logs.length,
      logs
    });
  } catch (error) {
    console.error('❌ Error consultando auditoría:', error.message);

    return res.status(500).json({
      error: 'No se pudo consultar la auditoría'
    });
  }
}

module.exports = {
  postResetSystem,
  getAuditLogs
};