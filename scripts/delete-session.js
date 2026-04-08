/**
 * Script para eliminar una sesión específica de SQLite
 */

const db = require('./src/infrastructure/database/sqlite');

const sessionId = 'wa_5493872213583';

db.prepare(`
  DELETE FROM sessions
  WHERE session_id = ?
`).run(sessionId);

console.log('✅ Sesión eliminada:', sessionId);