/**
 * Script manual para restaurar la base SQLite
 * desde un backup existente.
 *
 * IMPORTANTE:
 * -----------
 * Ejecutar con el servidor apagado.
 */

const path = require('path');
const { restoreBackup } = require('./src/infrastructure/database/restore');

/**
 * Ajustá este nombre al archivo backup real que quieras restaurar.
 */
const backupFile = path.join(process.cwd(), 'backups', 'ofreser_2026-04-03_18-55-05.db');

restoreBackup(backupFile);