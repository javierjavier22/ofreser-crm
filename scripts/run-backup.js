/**
 * =========================================================
 * SCRIPT DE BACKUP MANUAL / AUTOMATIZABLE
 * =========================================================
 *
 * ¿Qué hace este archivo?
 * -----------------------
 * Ejecuta un backup de la base SQLite y muestra
 * el resultado en consola.
 *
 * Uso:
 * ----
 * node run-backup.js
 *
 * Este archivo está pensado para:
 * - ejecución manual
 * - Programador de tareas de Windows
 * - futuros jobs automáticos
 */

const { createBackup } = require('./src/infrastructure/database/backup');

try {
  const backupPath = createBackup();

  console.log('✅ Backup finalizado con éxito');
  console.log('📂 Archivo generado:', backupPath);

  process.exit(0);
} catch (error) {
  console.error('❌ Backup falló:', error.message);
  process.exit(1);
}