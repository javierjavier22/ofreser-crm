/**
 * =========================================================
 * BACKUP SQLITE - SISTEMA DE RESPALDO
 * =========================================================
 *
 * ¿Qué hace este archivo?
 * -----------------------
 * Permite generar backups seguros de la base SQLite.
 *
 * IMPORTANTE:
 * -----------
 * No copiamos el archivo manualmente.
 * Usamos "VACUUM INTO" para generar una copia consistente.
 *
 * Funcionalidades:
 * ----------------
 * - crear backup con timestamp
 * - crear carpeta /backups si no existe
 * - listar backups existentes
 *
 * En resumen:
 * -----------
 * Este archivo centraliza la lógica de respaldo de la base.
 */
const { logger } = require('../../../shared/logger/logger');
const path = require('path');
const fs = require('fs');
const db = require('./sqlite');

/**
 * Devuelve la ruta absoluta de la carpeta de backups.
 */
function getBackupsDir() {
  return path.join(process.cwd(), 'backups');
}

/**
 * Crea la carpeta de backups si no existe.
 */
function ensureBackupsDirExists() {
  const backupsDir = getBackupsDir();

  if (!fs.existsSync(backupsDir)) {
    fs.mkdirSync(backupsDir, { recursive: true });
  }

  return backupsDir;
}

/**
 * Genera timestamp para el nombre del backup.
 *
 * Formato:
 * YYYY-MM-DD_HH-MM-SS
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
 * Crea un backup consistente de la base SQLite.
 *
 * Devuelve:
 * - ruta absoluta del backup generado
 */
function createBackup() {
  try {
    const backupsDir = ensureBackupsDirExists();

    const fileName = `ofreser_${getTimestamp()}.db`;
    const backupPath = path.join(backupsDir, fileName);

    /**
     * SQLite requiere barras "/" dentro del string SQL.
     */
    const sqliteSafePath = backupPath.replace(/\\/g, '/');

    db.exec(`VACUUM INTO '${sqliteSafePath}'`);

    logger.info('Backup creado correctamente', {
	backupPath
	});

    return backupPath;
  } catch (error) {
    logger.error(`Error creando backup: ${error.message}`, {
  stack: error.stack || null
});
    throw error;
  }
}

/**
 * Lista backups existentes ordenados del más nuevo al más viejo.
 */
function listBackups() {
  const backupsDir = ensureBackupsDirExists();

  const files = fs
    .readdirSync(backupsDir)
    .filter(file => file.toLowerCase().endsWith('.db'))
    .map(file => {
      const fullPath = path.join(backupsDir, file);
      const stats = fs.statSync(fullPath);

      return {
        fileName: file,
        fullPath,
        sizeBytes: stats.size,
        modifiedAt: stats.mtime
      };
    })
    .sort((a, b) => b.modifiedAt - a.modifiedAt);

  return files;
}

module.exports = {
  createBackup,
  listBackups
};