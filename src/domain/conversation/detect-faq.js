/**
 * =========================================================
 * DETECCIÓN DE FAQ (PREGUNTAS FRECUENTES)
 * =========================================================
 *
 * ¿Qué hace este archivo?
 * -----------------------
 * Detecta si el mensaje del usuario corresponde a una
 * pregunta frecuente (FAQ), como por ejemplo:
 *
 * - horarios
 * - dirección
 * - ubicación
 *
 * Si detecta una coincidencia:
 * - devuelve una respuesta directa
 * - NO continúa con el flujo conversacional
 *
 * Si no detecta nada:
 * - devuelve null
 * - el flujo sigue normalmente en el conversation-engine
 */

const BUSINESS_CONFIG = require('../../config/business.config');
const { buildResponse } = require('./response-builder');

/**
 * Verifica si el mensaje contiene alguna palabra clave.
 *
 * @param {string} text
 * @param {string[]} keywords
 * @returns {boolean}
 */
function containsAny(text, keywords = []) {
  return keywords.some(keyword => text.includes(keyword));
}

/**
 * Opciones del menú principal reutilizables.
 *
 * Esto se usa en respuestas FAQ para que el usuario
 * pueda continuar navegando sin fricción.
 */
function mainMenuOptions() {
  return [
    { label: 'Servicios de fumigación', value: '1' },
    { label: 'Compra de productos', value: '2' },
    { label: BUSINESS_CONFIG.certificate.label, value: '3' },
    { label: 'Consultas administrativas', value: '4' }
  ];
}

/**
 * Detecta si el mensaje corresponde a una FAQ.
 *
 * @param {string} msg (ya viene normalizado desde el engine)
 * @returns {object|null} respuesta del bot o null
 */
function detectFaq(msg) {

  /**
   * =========================================================
   * FAQ: HORARIO DEL LOCAL
   * =========================================================
   */
  if (
    containsAny(msg, [
      'horario local',
      'horarios local',
      'local abierto',
      'horario del local',
      'horarios del local'
    ])
  ) {
    return buildResponse(
      `🛍️ Local de venta al público

📍 Dirección: ${BUSINESS_CONFIG.publicStore.address}
🕘 ${BUSINESS_CONFIG.publicStore.scheduleText}`,
      mainMenuOptions()
    );
  }

  /**
   * =========================================================
   * FAQ: HORARIO DE OFICINAS
   * =========================================================
   */
  if (
    containsAny(msg, [
      'horario oficina',
      'horarios oficina',
      'horario de oficina',
      'horarios de oficina',
      'oficina abierta'
    ])
  ) {
    return buildResponse(
      `🏢 Oficinas

🕘 ${BUSINESS_CONFIG.office.scheduleText}`,
      mainMenuOptions()
    );
  }

  /**
   * =========================================================
   * FAQ: DIRECCIÓN / UBICACIÓN
   * =========================================================
   */
  if (
    containsAny(msg, [
      'direccion',
      'dirección',
      'donde estan',
      'dónde están',
      'ubicacion',
      'ubicación',
      'donde queda el local',
      'dónde queda el local'
    ])
  ) {
    return buildResponse(
      `📍 Nuestro local de venta al público está en:

${BUSINESS_CONFIG.publicStore.address}

🕘 Horario:
${BUSINESS_CONFIG.publicStore.scheduleText}`,
      mainMenuOptions()
    );
  }

  /**
   * Si no matchea ninguna FAQ → seguimos flujo normal
   */
  return null;
}

module.exports = {
  detectFaq,
  mainMenuOptions
};