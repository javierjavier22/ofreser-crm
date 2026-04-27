/**
 * Archivo: scripts/test-postgres-leads-insert.js
 *
 * Propósito:
 * Probar manualmente la inserción de un lead en PostgreSQL.
 *
 * Importante:
 * - No modifica SQLite.
 * - No modifica repositories SQLite.
 * - No modifica server.js.
 * - No modifica app.js.
 * - No se ejecuta automáticamente.
 * - Solo sirve para validar que el repository PostgreSQL de leads funciona.
 */

require('dotenv').config();

const {
  closePostgresPool,
} = require('../src/infrastructure/database/postgres');

const {
  saveLead,
} = require('../src/infrastructure/persistence/postgres/leads.repository');

async function main() {
  console.log('Probando inserción manual de lead en PostgreSQL...');

  try {
    const fakeSession = {
      sessionId: `test_session_${Date.now()}`,
      channel: 'webchat',
      externalUserId: `test_user_${Date.now()}`,
    };

    const fakeSessionData = {
      category: 'servicio_fumigacion',
      name: 'Lead Test PostgreSQL',
      phone: '3870000000',
      normalizedPhone: '3870000000',
      pest: 'cucarachas',
      placeType: 'local comercial',
      zone: 'Salta Capital',
      requiresHuman: false,
    };

    const lead = await saveLead(fakeSession, fakeSessionData);

    console.log('Lead insertado correctamente en PostgreSQL.');
    console.log('ID del lead:', lead.id);

    process.exitCode = 0;
  } catch (error) {
    console.error('Error insertando lead en PostgreSQL:');
    console.error(error.message);
    process.exitCode = 1;
  } finally {
    await closePostgresPool();
  }
}

main();