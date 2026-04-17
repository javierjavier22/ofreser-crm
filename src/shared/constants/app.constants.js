/**
 * =========================================================
 * APP CONSTANTS
 * =========================================================
 *
 * ¿Qué hace este archivo?
 * -----------------------
 * Centraliza constantes operativas compartidas del sistema.
 *
 * Objetivo:
 * ---------
 * Evitar valores mágicos repetidos en múltiples archivos.
 *
 * Importante:
 * -----------
 * Este archivo NO contiene lógica de negocio compleja.
 * Solo contiene valores estables reutilizables.
 */

/**
 * Roles válidos del CRM.
 */
const CRM_ROLES = {
  ADMIN: 'admin',
  USER: 'user'
};

const CRM_ALLOWED_ROLES = [
  CRM_ROLES.ADMIN,
  CRM_ROLES.USER
];

/**
 * Reglas de username del CRM.
 */
const CRM_USERNAME = {
  MIN_LENGTH: 3,
  MAX_LENGTH: 40,
  REGEX: /^[a-zA-Z0-9._-]+$/
};

/**
 * Reglas de password del CRM.
 */
const CRM_PASSWORD = {
  MIN_LENGTH: 8,
  MAX_LENGTH: 100
};

/**
 * Estados comerciales válidos de leads.
 */
const LEAD_STATUS = {
  NUEVO: 'nuevo',
  CALIFICADO: 'calificado',
  SEGUIMIENTO: 'seguimiento',
  CERRADO: 'cerrado'
};

const LEAD_ALLOWED_STATUSES = [
  LEAD_STATUS.NUEVO,
  LEAD_STATUS.CALIFICADO,
  LEAD_STATUS.SEGUIMIENTO,
  LEAD_STATUS.CERRADO
];

/**
 * Modos válidos de control de sesión.
 */
const SESSION_CONTROL_MODE = {
  BOT: 'bot',
  HUMAN: 'human',
  CLOSED: 'closed'
};

const SESSION_ALLOWED_CONTROL_MODES = [
  SESSION_CONTROL_MODE.BOT,
  SESSION_CONTROL_MODE.HUMAN,
  SESSION_CONTROL_MODE.CLOSED
];

/**
 * Límites de texto libre.
 */
const TEXT_LIMITS = {
  INTERNAL_NOTE_MAX: 2000,
  HUMAN_MESSAGE_MAX: 2000,
  WEBCHAT_MESSAGE_MAX: 1000
};

/**
 * Paginación.
 */
const PAGINATION = {
  AUDIT_DEFAULT_LIMIT: 20,
  AUDIT_MAX_LIMIT: 100,
  LEADS_DEFAULT_LIMIT: 50,
  LEADS_MAX_LIMIT: 100
};

module.exports = {
  CRM_ROLES,
  CRM_ALLOWED_ROLES,
  CRM_USERNAME,
  CRM_PASSWORD,
  LEAD_STATUS,
  LEAD_ALLOWED_STATUSES,
  SESSION_CONTROL_MODE,
  SESSION_ALLOWED_CONTROL_MODES,
  TEXT_LIMITS,
  PAGINATION
};