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
 */

const db = require('../../database/sqlite');

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

module.exports = {
  postResetSystem
};