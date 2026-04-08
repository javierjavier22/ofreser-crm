/**
 * =========================================================
 * RESTORE SQLITE - SISTEMA DE RECUPERACIÓN
 * =========================================================
 *
 * ¿Qué hace este archivo?
 * -----------------------
 * Permite restaurar la base activa del sistema
 * a partir de un archivo de backup previamente generado.
 *
 * IMPORTANTE:
 * -----------
 * Este script debe ejecutarse con el servidor apagado.
 *
 * ¿Qué hace exactamente?
 * ----------------------
 * - valida que exista el archivo backup origen
 * - valida que exista la carpeta /storage
 * - hace una copia de seguridad extra del archivo actual
 * - reemplaza la base activa por el backup elegido
 *
 * En resumen:
 * -----------
 * Este archivo sirve para recuperar el sistema
 * si la base principal se daña o si querés volver
 * a un estado anterior.
 */

const path = require('path');
const fs = require('fs');

/**
 * Ruta actual de la base activa.
 */
const activeDbPath = path.join(process.cwd(), 'storage', 'ofreser.db');

/**
 * Genera timestamp para respaldos previos a restauración.
 */
function getTimestamp() {
  const now = new Date();

  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');

  const hh = String(now.getHours()).padStart(2, '0');
  const min = String(now.getMinutes()).padStart(2, '0');
  const ss = String(now.getSeconds()).padStart(2, '0');

  return `${yyyy}-${mm}-${dd}_${hh}-${min}-${ss}`;
}

/**
 * Restaura la base desde un backup.
 *
 * @param {string} backupFilePath
 * Ruta absoluta o relativa del archivo .db a restaurar
 */
function restoreBackup(backupFilePath) {
  try {
    const resolvedBackupPath = path.resolve(backupFilePath);

    /**
     * Verificamos que exista el backup origen.
     */
    if (!fs.existsSync(resolvedBackupPath)) {
      throw new Error(`No existe el archivo backup: ${resolvedBackupPath}`);
    }

    /**
     * Verificamos que exista la carpeta storage.
     */
    const storageDir = path.dirname(activeDbPath);

    if (!fs.existsSync(storageDir)) {
      fs.mkdirSync(storageDir, { recursive: true });
    }

    /**
     * Si ya existe una base activa,
     * hacemos una copia de seguridad previa
     * antes de sobrescribirla.
     */
    if (fs.existsSync(activeDbPath)) {
      const emergencyBackupPath = path.join(
        storageDir,
        `ofreser_before_restore_${getTimestamp()}.db`
      );

      fs.copyFileSync(activeDbPath, emergencyBackupPath);

      console.log('🛟 Backup de seguridad previo a restore creado:', emergencyBackupPath);
    }

    /**
     * Restauramos reemplazando la base activa.
     */
    fs.copyFileSync(resolvedBackupPath, activeDbPath);

    console.log('♻️ Restore completado correctamente.');
    console.log('📂 Base restaurada desde:', resolvedBackupPath);
    console.log('📂 Base activa actual:', activeDbPath);

    return {
      ok: true,
      restoredFrom: resolvedBackupPath,
      activeDbPath
    };
  } catch (error) {
    console.error('❌ Error restaurando backup:', error.message);
    throw error;
  }
}

module.exports = {
  restoreBackup
};