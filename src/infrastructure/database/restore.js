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
 * Mejoras aplicadas:
 * ------------------
 * - validación de existencia del archivo origen
 * - validación de extensión .db
 * - validación de tamaño mínimo
 * - validación de cabecera SQLite
 * - confirmación obligatoria antes de sobrescribir
 * - logger centralizado
 *
 * En resumen:
 * -----------
 * Este archivo sirve para recuperar el sistema
 * si la base principal se daña o si querés volver
 * a un estado anterior.
 */

const path = require('path');
const fs = require('fs');
const { logger } = require('../../shared/logger/logger');

/**
 * Ruta actual de la base activa.
 */
const activeDbPath = path.join(process.cwd(), 'storage', 'ofreser.db');

/**
 * Tamaño mínimo razonable para una base SQLite.
 *
 * No pretende ser una validación matemática exacta,
 * solo evita restaurar archivos vacíos o absurdamente pequeños.
 */
const MIN_SQLITE_FILE_SIZE_BYTES = 100;

/**
 * Cabecera esperada de un archivo SQLite válido.
 *
 * SQLite usa al inicio:
 * "SQLite format 3"
 */
const SQLITE_HEADER_PREFIX = 'SQLite format 3';

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
 * Valida que el archivo tenga extensión .db.
 */
function hasValidBackupExtension(filePath) {
  return String(filePath || '').toLowerCase().endsWith('.db');
}

/**
 * Valida que el archivo exista y sea un archivo real.
 */
function validateBackupFileExists(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`No existe el archivo backup: ${filePath}`);
  }

  const stats = fs.statSync(filePath);

  if (!stats.isFile()) {
    throw new Error(`La ruta indicada no es un archivo válido: ${filePath}`);
  }

  return stats;
}

/**
 * Valida tamaño mínimo razonable.
 */
function validateBackupFileSize(stats, filePath) {
  if (!stats || typeof stats.size !== 'number') {
    throw new Error(`No se pudo obtener el tamaño del archivo backup: ${filePath}`);
  }

  if (stats.size < MIN_SQLITE_FILE_SIZE_BYTES) {
    throw new Error(
      `El archivo backup es demasiado pequeño para ser una base SQLite válida: ${filePath}`
    );
  }
}

/**
 * Valida la cabecera del archivo para descartar basura evidente.
 *
 * Esto NO garantiza al 100% que la base esté perfecta,
 * pero sí reduce mucho el riesgo de restaurar un archivo cualquiera.
 */
function validateSQLiteHeader(filePath) {
  const fd = fs.openSync(filePath, 'r');

  try {
    const buffer = Buffer.alloc(16);
    fs.readSync(fd, buffer, 0, 16, 0);

    const header = buffer.toString('utf8').replace(/\0/g, '').trim();

    if (!header.startsWith(SQLITE_HEADER_PREFIX)) {
      throw new Error(
        `El archivo no parece ser una base SQLite válida: ${filePath}`
      );
    }
  } finally {
    fs.closeSync(fd);
  }
}

/**
 * Valida confirmación explícita antes de sobrescribir.
 */
function validateRestoreConfirmation(options = {}) {
  if (!options || options.confirmRestore !== true) {
    throw new Error(
      'Restore cancelado: debés confirmar explícitamente con { confirmRestore: true }'
    );
  }
}

/**
 * Restaura la base desde un backup.
 *
 * @param {string} backupFilePath
 * Ruta absoluta o relativa del archivo .db a restaurar
 *
 * @param {object} options
 * Opciones de seguridad:
 * - confirmRestore: boolean obligatorio para permitir el restore
 */
function restoreBackup(backupFilePath, options = {}) {
  try {
    validateRestoreConfirmation(options);

    const resolvedBackupPath = path.resolve(backupFilePath);

    /**
     * Validaciones del backup origen.
     */
    if (!hasValidBackupExtension(resolvedBackupPath)) {
      throw new Error(`El archivo backup debe tener extensión .db: ${resolvedBackupPath}`);
    }

    const stats = validateBackupFileExists(resolvedBackupPath);
    validateBackupFileSize(stats, resolvedBackupPath);
    validateSQLiteHeader(resolvedBackupPath);

    /**
     * Verificamos que exista la carpeta storage.
     */
    const storageDir = path.dirname(activeDbPath);

    if (!fs.existsSync(storageDir)) {
      fs.mkdirSync(storageDir, { recursive: true });

      logger.info('Carpeta storage creada automáticamente', {
        storageDir
      });
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

      logger.warn('Backup de seguridad previo a restore creado', {
        emergencyBackupPath
      });
    }

    /**
     * Restauramos reemplazando la base activa.
     */
    fs.copyFileSync(resolvedBackupPath, activeDbPath);

    logger.info('Restore completado correctamente', {
      restoredFrom: resolvedBackupPath,
      activeDbPath
    });

    return {
      ok: true,
      restoredFrom: resolvedBackupPath,
      activeDbPath
    };
  } catch (error) {
    logger.error(`Error restaurando backup: ${error.message}`, {
      backupFilePath,
      stack: error.stack || null
    });

    throw error;
  }
}

module.exports = {
  restoreBackup
};