/**
 * Script de prueba manual para generar un backup de SQLite.
 */

const { createBackup } = require('./src/infrastructure/database/backup');

createBackup();