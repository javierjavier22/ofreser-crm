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
 * NO copiamos el archivo manualmente.
 * Usamos "VACUUM INTO" para garantizar integridad.
 *
 * ¿Qué genera?
 * ------------
 * Archivos .db dentro de /backups con timestamp.
 *
 * Ejemplo:
 * backups/ofreser_2026-04-03_12-30-45.db
 */

const path = require('path');
const fs = require('fs');
const db = require('./sqlite');

/**
 * Genera timestamp para nombre de archivo.
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
 * Ejecuta backup seguro usando VACUUM INTO
 */
function createBackup() {
  try {
    const backupsDir = path.join(process.cwd(), 'backups');

    // Crear carpeta si no existe
    if (!fs.existsSync(backupsDir)) {
      fs.mkdirSync(backupsDir, { recursive: true });
    }

    const fileName = `ofreser_${getTimestamp()}.db`;
    const backupPath = path.join(backupsDir, fileName);

    // BACKUP REAL (clave)
    db.exec(`VACUUM INTO '${backupPath}'`);

    console.log('💾 Backup creado:', backupPath);

    return backupPath;

  } catch (error) {
    console.error('❌ Error creando backup:', error.message);
    throw error;
  }
}

/**
 * Exportamos función
 */
module.exports = {
  createBackup
};