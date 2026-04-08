/**
 * =========================================================
 * SQLITE - CONEXIÓN CENTRAL
 * =========================================================
 *
 * ¿Qué hace este archivo?
 * -----------------------
 * Este archivo crea y exporta una única conexión
 * central a la base SQLite del proyecto.
 *
 * Objetivo:
 * ---------
 * - Tener un solo punto de acceso a la DB
 * - Evitar abrir conexiones repetidas
 * - Mantener ordenada la capa de infraestructura
 *
 * Importante:
 * -----------
 * - La base se guarda en /storage/ofreser.db
 * - Si el archivo no existe, SQLite lo crea automáticamente
 */

const path = require('path');
const Database = require('better-sqlite3');

/**
 * Ruta absoluta al archivo físico de la base.
 *
 * Queda dentro de /storage para mantener la coherencia
 * con el resto del proyecto.
 */
const dbPath = path.join(process.cwd(), 'storage', 'ofreser.db');

/**
 * Creamos una única conexión compartida.
 *
 * verbose: null
 * -------------
 * No activamos logs SQL automáticos por ahora
 * para no ensuciar consola.
 */
const db = new Database(dbPath);

/**
 * Activamos claves foráneas.
 *
 * Esto es buena práctica en SQLite cuando en el futuro
 * relacionemos tablas entre sí.
 */
db.pragma('foreign_keys = ON');

/**
 * Exportamos la conexión central.
 */
module.exports = db;