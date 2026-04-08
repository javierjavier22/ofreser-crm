/**
 * =========================================================
 * PARSEO DE CONTACTO (NOMBRE + TELÉFONO)
 * =========================================================
 *
 * ¿Qué hace este archivo?
 * -----------------------
 * Extrae desde un mensaje:
 * - nombre
 * - teléfono
 *
 * Ejemplo esperado:
 * "Juan Pérez 3875123456"
 *
 * Problema real que resuelve:
 * ---------------------------
 * Los usuarios escriben cualquier cosa:
 * - con espacios
 * - con guiones
 * - con paréntesis
 * - con prefijos
 *
 * Este parser intenta ser:
 * ✔ flexible
 * ✔ tolerante
 * ✔ práctico para ventas
 */

/**
 * Limpia el teléfono dejando solo números.
 *
 * Ej:
 * "(387) 431-6258" → "3874316258"
 */
function cleanPhone(phone) {
  return String(phone || '').replace(/\D/g, '');
}

/**
 * Valida el teléfono de forma flexible.
 *
 * IMPORTANTE:
 * ----------
 * No somos estrictos porque esto es un bot comercial.
 * Preferimos aceptar más y validar después manualmente.
 */
function isValidPhone(phone) {
  const cleaned = cleanPhone(phone);

  // Rango razonable:
  // 6 → mínimo (fijos cortos)
  // 13 → máximo (con prefijo país)
  return cleaned.length >= 6 && cleaned.length <= 13;
}

/**
 * Valida el nombre.
 *
 * Evita casos como:
 * - solo números
 * - texto vacío
 */
function isValidName(name) {
  if (!name) return false;

  // Debe tener al menos una letra
  return /[a-zA-ZáéíóúÁÉÍÓÚñÑ]/.test(name);
}

/**
 * Parsea un mensaje tipo:
 * "Nombre Apellido 3875123456"
 *
 * @param {string} text
 * @returns {object}
 */
function parseContactMessage(text) {
  const raw = String(text || '').trim();

  if (!raw) {
    return { valid: false };
  }

  /**
   * Regex clave:
   *
   * Divide en:
   * - TODO lo de la izquierda → nombre
   * - ÚLTIMO bloque → teléfono
   *
   * Ej:
   * "Juan Pérez 3875123456"
   */
  const match = raw.match(/(.+?)\s+([\d\s\-()+]+)$/);

  if (!match) {
    return { valid: false };
  }

  const name = match[1].trim();
  const rawPhone = match[2].trim();
  const normalizedPhone = cleanPhone(rawPhone);

  /**
   * Validaciones
   */
  if (!isValidName(name)) {
    return { valid: false };
  }

  if (!isValidPhone(rawPhone)) {
    return { valid: false };
  }

  /**
   * Resultado final
   */
  return {
    valid: true,

    // Nombre tal cual lo escribió el usuario
    name,

    // Teléfono como lo escribió
    phone: rawPhone,

    // Teléfono limpio para DB / CRM
    normalizedPhone
  };
}

module.exports = {
  parseContactMessage
};