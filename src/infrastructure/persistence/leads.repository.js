/**
 * ============================================
 * LEADS REPOSITORY (SELECTOR SEGURO)
 * ============================================
 *
 * Propósito:
 * ----------
 * Elegir dinámicamente qué implementación usar:
 * - SQLite como base principal y fallback seguro.
 * - PostgreSQL solo cuando esté configurado explícitamente.
 *
 * Importante:
 * -----------
 * - No rompe el sistema si PostgreSQL no tiene todavía todas las funciones.
 * - Si una función no existe en PostgreSQL, se usa SQLite.
 * - Permite migración progresiva por partes.
 */

const sqliteRepo = require('./sqlite/leads.repository');
const postgresRepo = require('./postgres/leads.repository');

const { isPostgresConfigured } = require('../database/postgres');

/**
 * Indica si PostgreSQL está habilitado explícitamente.
 */
function shouldUsePostgres() {
  return process.env.USE_POSTGRES === 'true' && isPostgresConfigured();
}

/**
 * Devuelve la función correcta:
 * - PostgreSQL si está habilitado y la función existe.
 * - SQLite como fallback seguro.
 */
function getRepositoryFunction(functionName) {
  if (
    shouldUsePostgres() &&
    typeof postgresRepo[functionName] === 'function'
  ) {
    console.log(`[LeadsRepo] Usando PostgreSQL para ${functionName}`);
    return postgresRepo[functionName].bind(postgresRepo);
  }

  if (typeof sqliteRepo[functionName] === 'function') {
    console.log(`[LeadsRepo] Usando SQLite para ${functionName}`);
    return sqliteRepo[functionName].bind(sqliteRepo);
  }

  return undefined;
}

/**
 * Proxy público del repository.
 */
module.exports = new Proxy({}, {
  get(_, prop) {
    return getRepositoryFunction(prop);
  }
});