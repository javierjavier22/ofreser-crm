/**
 * =========================================================
 * INIT DB
 * =========================================================
 *
 * ¿Qué hace este archivo?
 * -----------------------
 * Este archivo crea las tablas base del sistema
 * si todavía no existen.
 *
 * Lo ejecutamos una vez al arrancar el backend,
 * para asegurarnos de que la base tenga la estructura mínima.
 *
 * Tablas iniciales:
 * -----------------
 * - sessions
 * - messages
 * - leads
 * - crm_users
 *
 * Importante:
 * -----------
 * Además de crear tablas, este archivo también puede
 * ejecutar pequeñas migraciones seguras y sembrar
 * un usuario inicial del CRM si todavía no existe.
 */

const crypto = require('crypto');
const db = require('./sqlite');

/**
 * Crea la tabla de sesiones.
 *
 * Esta tabla reemplaza la vieja persistencia temporal
 * y guarda el estado conversacional del bot.
 */
function createSessionsTable() {
  db.prepare(`
    CREATE TABLE IF NOT EXISTS sessions (
      session_id TEXT PRIMARY KEY,
      channel TEXT NOT NULL,
      external_user_id TEXT,
      step TEXT NOT NULL,
      data_json TEXT NOT NULL,
      invalid_count INTEGER NOT NULL DEFAULT 0,
      control_mode TEXT NOT NULL DEFAULT 'bot',
      human_requested_at TEXT,
      human_taken_at TEXT,
      human_released_at TEXT,
      human_notice_sent_at TEXT,
      closed_at TEXT,
      taken_by TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `).run();
}

/**
 * Crea la tabla de mensajes.
 *
 * Guarda historial completo de conversación:
 * - mensajes del usuario
 * - respuestas del bot
 * - mensajes humanos enviados desde CRM
 */
function createMessagesTable() {
  db.prepare(`
    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      channel TEXT NOT NULL,
      external_user_id TEXT,
      direction TEXT NOT NULL,
      sender_type TEXT NOT NULL,
      text TEXT NOT NULL,
      external_message_id TEXT,
      raw_payload_json TEXT,
      created_at TEXT NOT NULL
    )
  `).run();

  /**
   * Índice para recuperar rápido mensajes por sesión.
   */
  db.prepare(`
    CREATE INDEX IF NOT EXISTS idx_messages_session_id
    ON messages(session_id)
  `).run();
}

/**
 * Crea la tabla de leads.
 *
 * Guarda los datos comerciales capturados por el bot.
 */
function createLeadsTable() {
  db.prepare(`
    CREATE TABLE IF NOT EXISTS leads (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      channel TEXT NOT NULL,
      external_user_id TEXT,
      source TEXT,
      category TEXT,
      name TEXT,
      phone TEXT,
      normalized_phone TEXT,
      pest TEXT,
      place_type TEXT,
      zone TEXT,
      product TEXT,
      local_type TEXT,
      business_name TEXT,
      address TEXT,
      certificate_type TEXT,
      business_type TEXT,
      admin_reason TEXT,
      internal_note TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'nuevo',
      requires_human INTEGER NOT NULL DEFAULT 0,
      partial INTEGER NOT NULL DEFAULT 0,
      partial_reason TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `).run();

  /**
   * Índice por session_id para lookup rápido desde CRM.
   */
  db.prepare(`
    CREATE INDEX IF NOT EXISTS idx_leads_session_id
    ON leads(session_id)
  `).run();
}

/**
 * Crea la tabla de usuarios del CRM.
 *
 * Objetivo:
 * - dejar de depender solamente de usuario/clave en .env
 * - permitir múltiples usuarios reales más adelante
 * - preparar el terreno para roles y cambio de clave
 *
 * Campos:
 * - id: identificador único
 * - username: nombre de usuario único
 * - password_hash: contraseña hasheada
 * - is_active: 1 activo / 0 inactivo
 * - role: rol base del usuario
 * - created_at: fecha de creación
 * - updated_at: fecha de última modificación
 */
function createCrmUsersTable() {
  db.prepare(`
    CREATE TABLE IF NOT EXISTS crm_users (
      id TEXT PRIMARY KEY,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      is_active INTEGER NOT NULL DEFAULT 1,
      role TEXT NOT NULL DEFAULT 'admin',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `).run();

  /**
   * Índice adicional por username.
   *
   * Aunque username ya es UNIQUE, dejar el nombre del índice
   * explícito ayuda a mantener el esquema más claro.
   */
  db.prepare(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_crm_users_username
    ON crm_users(username)
  `).run();
}

/**
 * Crea la tabla de sesiones del CRM (login).
 *
 * Esto reemplaza el almacenamiento en memoria
 * del middleware de autenticación.
 *
 * Mejora:
 * -------
 * Ahora también persistimos user_id para que
 * req.crmAuth tenga identidad real del usuario,
 * no solo username/role.
 */
function createCrmSessionsTable() {
  db.prepare(`
    CREATE TABLE IF NOT EXISTS crm_sessions (
      token TEXT PRIMARY KEY,
      user_id TEXT,
      username TEXT NOT NULL,
      role TEXT NOT NULL,
      issued_at INTEGER NOT NULL,
      expires_at INTEGER NOT NULL
    )
  `).run();

  /**
   * Índice para limpieza rápida por expiración.
   */
  db.prepare(`
    CREATE INDEX IF NOT EXISTS idx_crm_sessions_expires
    ON crm_sessions(expires_at)
  `).run();

  /**
   * Migración segura para instalaciones ya existentes.
   *
   * Si la columna ya existe, SQLite va a lanzar error
   * y simplemente lo ignoramos.
   */
  try {
    db.prepare(`
      ALTER TABLE crm_sessions
      ADD COLUMN user_id TEXT
    `).run();
  } catch (error) {
    // La columna ya existe o la migración ya fue aplicada.
  }
}

/**
 * Hashea una contraseña usando scrypt nativo de Node.
 *
 * Formato guardado:
 * salt:hash
 *
 * Ventajas:
 * - no requiere dependencias externas
 * - suficientemente sólido para esta etapa
 */
function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const derivedKey = crypto.scryptSync(String(password), salt, 64).toString('hex');
  return `${salt}:${derivedKey}`;
}

/**
 * Crea el usuario inicial del CRM si todavía no existe.
 *
 * Fuente de datos:
 * - CRM_USERNAME desde .env
 * - CRM_PASSWORD desde .env
 *
 * Importante:
 * -----------
 * Esto NO borra ni pisa usuarios existentes.
 * Solo si no existe ese username, lo inserta.
 */
function seedInitialCrmUserFromEnv() {
  const username = String(process.env.CRM_USERNAME || '').trim();
  const password = String(process.env.CRM_PASSWORD || '');

  /**
   * Si el .env no tiene usuario o contraseña,
   * no intentamos sembrar nada.
   */
  if (!username || !password) {
    return;
  }

  /**
   * Verificamos si el usuario ya existe.
   */
  const existingUser = db.prepare(`
    SELECT id
    FROM crm_users
    WHERE username = ?
    LIMIT 1
  `).get(username);

  if (existingUser) {
    return;
  }

  const now = new Date().toISOString();
  const passwordHash = hashPassword(password);

  db.prepare(`
    INSERT INTO crm_users (
      id,
      username,
      password_hash,
      is_active,
      role,
      created_at,
      updated_at
    ) VALUES (
      ?,
      ?,
      ?,
      1,
      'admin',
      ?,
      ?
    )
  `).run(
    crypto.randomUUID(),
    username,
    passwordHash,
    now,
    now
  );

  console.log(`👤 Usuario inicial del CRM creado en SQLite: ${username}`);
}

/**
 * Ejecuta migraciones seguras para instalaciones ya existentes.
 *
 * Regla:
 * - si una columna ya existe, SQLite lanza error
 * - en ese caso lo ignoramos
 */
function runSafeMigrations() {
  /**
   * Migración ya usada antes:
   * agregamos human_notice_sent_at si faltaba.
   */
  try {
    db.prepare(`
      ALTER TABLE sessions
      ADD COLUMN human_notice_sent_at TEXT
    `).run();
  } catch (error) {
    // La columna ya existe o la migración ya fue aplicada.
  }

  /**
   * Posible migración para crm_users:
   * role
   */
  try {
    db.prepare(`
      ALTER TABLE crm_users
      ADD COLUMN role TEXT NOT NULL DEFAULT 'admin'
    `).run();
  } catch (error) {
    // La columna ya existe o la migración ya fue aplicada.
  }

  /**
   * Posible migración para crm_users:
   * updated_at
   */
  try {
    db.prepare(`
      ALTER TABLE crm_users
      ADD COLUMN updated_at TEXT
    `).run();
  } catch (error) {
    // La columna ya existe o la migración ya fue aplicada.
  }

  /**
   * Si hubiese usuarios viejos sin updated_at, los completamos.
   */
  try {
    db.prepare(`
      UPDATE crm_users
      SET updated_at = created_at
      WHERE updated_at IS NULL OR updated_at = ''
    `).run();
  } catch (error) {
    // Si la tabla todavía no existe o algo menor falla, no frenamos.
  }
}

/**
 * Ejecuta toda la creación del esquema base.
 */
function initDb() {
  createSessionsTable();
  createMessagesTable();
  createLeadsTable();
  createCrmUsersTable();
  createCrmSessionsTable();

  runSafeMigrations();
  seedInitialCrmUserFromEnv();

  console.log('✅ SQLite inicializada correctamente');
}

/**
 * Exportamos la función principal.
 */
module.exports = {
  initDb
};