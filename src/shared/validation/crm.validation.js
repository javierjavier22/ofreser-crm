/**
 * =========================================================
 * CRM VALIDATION HELPERS
 * =========================================================
 *
 * ¿Qué hace este archivo?
 * -----------------------
 * Centraliza helpers de validación y normalización
 * reutilizables del sistema CRM.
 *
 * Objetivo:
 * ---------
 * Evitar validaciones repetidas en múltiples archivos.
 *
 * Importante:
 * -----------
 * Este archivo NO toca base de datos.
 * Este archivo NO decide permisos.
 * Solo ayuda a validar y normalizar entradas.
 */

const {
  CRM_ROLES,
  CRM_ALLOWED_ROLES,
  CRM_USERNAME,
  CRM_PASSWORD
} = require('../constants/app.constants');

/**
 * Normaliza un username.
 *
 * Regla:
 * - trim
 * - no forzamos lowercase para no cambiar comportamiento actual
 */
function normalizeUsername(username) {
  return String(username || '').trim();
}

/**
 * Normaliza un role entrante.
 *
 * Si no viene nada, usa "user".
 */
function normalizeRole(role) {
  return String(role || CRM_ROLES.USER).trim().toLowerCase();
}

/**
 * Devuelve true si el role es válido.
 */
function isAllowedRole(role) {
  return CRM_ALLOWED_ROLES.includes(normalizeRole(role));
}

/**
 * Devuelve error de username.
 *
 * Si no hay error, devuelve string vacío.
 */
function getUsernameValidationError(username) {
  const value = normalizeUsername(username);

  if (!value) {
    return 'username requerido';
  }

  if (value.length < CRM_USERNAME.MIN_LENGTH) {
    return `username debe tener al menos ${CRM_USERNAME.MIN_LENGTH} caracteres`;
  }

  if (value.length > CRM_USERNAME.MAX_LENGTH) {
    return `username no puede superar ${CRM_USERNAME.MAX_LENGTH} caracteres`;
  }

  if (!CRM_USERNAME.REGEX.test(value)) {
    return 'username solo puede contener letras, números, punto, guion y guion bajo';
  }

  return '';
}

/**
 * Devuelve true si el username es válido.
 */
function isValidUsername(username) {
  return !getUsernameValidationError(username);
}

/**
 * Devuelve error de password.
 *
 * Si no hay error, devuelve string vacío.
 */
function getPasswordValidationError(password, fieldName = 'password') {
  const value = String(password || '');

  if (!value) {
    return `${fieldName} requerido`;
  }

  if (value.length < CRM_PASSWORD.MIN_LENGTH) {
    return `${fieldName} debe tener al menos ${CRM_PASSWORD.MIN_LENGTH} caracteres`;
  }

  if (value.length > CRM_PASSWORD.MAX_LENGTH) {
    return `${fieldName} no puede superar ${CRM_PASSWORD.MAX_LENGTH} caracteres`;
  }

  return '';
}

/**
 * Devuelve true si la password es válida.
 */
function isValidPassword(password) {
  return !getPasswordValidationError(password);
}

/**
 * Normaliza un texto libre:
 * - convierte a string
 * - aplica trim
 */
function normalizeTrimmedText(value) {
  return String(value || '').trim();
}

/**
 * Valida un texto libre con máximo.
 *
 * Devuelve:
 * - ok: boolean
 * - value: string normalizado
 * - error: string vacío o mensaje
 */
function validateMaxTextLength(value, maxLength, emptyMessage, tooLongMessage) {
  const normalized = normalizeTrimmedText(value);

  if (!normalized) {
    return {
      ok: false,
      value: normalized,
      error: emptyMessage || 'El texto es obligatorio'
    };
  }

  if (normalized.length > Number(maxLength || 0)) {
    return {
      ok: false,
      value: normalized,
      error:
        tooLongMessage ||
        `El texto no puede superar los ${Number(maxLength || 0)} caracteres`
    };
  }

  return {
    ok: true,
    value: normalized,
    error: ''
  };
}

/**
 * Interpreta booleanos flexibles comunes.
 *
 * Acepta:
 * - true
 * - 1
 * - "1"
 * - "true"
 *
 * Todo lo demás => false
 */
function parseBooleanLike(value) {
  return (
    value === true ||
    value === 1 ||
    value === '1' ||
    value === 'true'
  );
}

module.exports = {
  normalizeUsername,
  normalizeRole,
  isAllowedRole,
  getUsernameValidationError,
  isValidUsername,
  getPasswordValidationError,
  isValidPassword,
  normalizeTrimmedText,
  validateMaxTextLength,
  parseBooleanLike
};