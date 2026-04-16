const { createBackup, listBackups } = require('./src/infrastructure/database/backup');

try {
  const backupPath = createBackup();

  console.log('BACKUP CREADO EN:', backupPath);

  const backups = listBackups();
  console.log('LISTA DE BACKUPS:', backups);

} catch (error) {
  console.error('ERROR:', error.message);
}