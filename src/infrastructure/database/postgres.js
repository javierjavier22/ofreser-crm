/**
 * Archivo: src/infrastructure/database/postgres.js
 *
 * Propósito:
 * Este archivo prepara una conexión segura a PostgreSQL usando la librería "pg".
 *
 * Estado actual:
 * - PostgreSQL queda preparado en paralelo.
 * - NO reemplaza SQLite.
 * - NO modifica repositorios existentes.
 * - NO se conecta automáticamente al iniciar el sistema, salvo que otro archivo lo importe y llame explícitamente.
 * - Si no existe DATABASE_URL, no rompe el sistema.
 *
 * Uso futuro:
 * Este archivo se usará más adelante para hacer pruebas de conexión y luego migrar repositories
 * de forma controlada, empezando por leads.
 */

const { Pool } = require('pg');

// Variable interna para guardar una única instancia del pool.
// Esto evita crear múltiples conexiones innecesarias a PostgreSQL.
let pool = null;

/**
 * Verifica si PostgreSQL está configurado.
 *
 * PostgreSQL se considera configurado solamente si existe DATABASE_URL.
 * Si DATABASE_URL no existe, el sistema debe seguir funcionando normalmente con SQLite.
 */
function isPostgresConfigured() {
  return Boolean(process.env.DATABASE_URL);
}

/**
 * Devuelve el pool de conexión a PostgreSQL.
 *
 * Importante:
 * - No crea conexión si DATABASE_URL no existe.
 * - No lanza error por falta de configuración.
 * - No activa PostgreSQL por sí solo.
 */
function getPostgresPool() {
  if (!isPostgresConfigured()) {
    return null;
  }

  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,

      // SSL se activa solamente si estamos en producción.
      // Esto evita problemas locales y deja preparado Render/PostgreSQL para más adelante.
      ssl:
        process.env.NODE_ENV === 'production'
          ? { rejectUnauthorized: false }
          : false,
    });
  }

  return pool;
}

/**
 * Ejecuta una consulta SQL en PostgreSQL.
 *
 * Esta función será útil más adelante para repositories PostgreSQL.
 * Por ahora no se usa en el sistema.
 */
async function query(text, params = []) {
  const currentPool = getPostgresPool();

  if (!currentPool) {
    throw new Error(
      'PostgreSQL no está configurado. Falta la variable de entorno DATABASE_URL.'
    );
  }

  return currentPool.query(text, params);
}

/**
 * Prueba la conexión a PostgreSQL.
 *
 * Esta función no debe llamarse todavía desde server.js.
 * La vamos a usar después en un test controlado.
 */
async function testPostgresConnection() {
  const currentPool = getPostgresPool();

  if (!currentPool) {
    return {
      ok: false,
      configured: false,
      message: 'PostgreSQL no está configurado. Falta DATABASE_URL.',
    };
  }

  const result = await currentPool.query('SELECT NOW() AS current_time');

  return {
    ok: true,
    configured: true,
    currentTime: result.rows[0].current_time,
  };
}

/**
 * Cierra el pool de PostgreSQL.
 *
 * Será útil más adelante para apagado ordenado o scripts de prueba.
 */
async function closePostgresPool() {
  if (pool) {
    await pool.end();
    pool = null;
  }
}

module.exports = {
  isPostgresConfigured,
  getPostgresPool,
  query,
  testPostgresConnection,
  closePostgresPool,
};