/**
 * =========================================================
 * RESPONSE BUILDER
 * =========================================================
 *
 * ¿Qué hace este archivo?
 * -----------------------
 * Construye el objeto de respuesta estándar del bot.
 *
 * Este archivo existe para que todas las respuestas del sistema
 * tengan la misma estructura base.
 *
 * Estructura esperada:
 * --------------------
 * {
 *   message: 'texto del bot',
 *   options: [...],
 *   ...extra
 * }
 *
 * ¿Por qué sirve?
 * ---------------
 * Porque evita repetir siempre el mismo formato
 * en cada parte del motor conversacional.
 *
 * ¿Qué NO hace?
 * -------------
 * - No decide qué responder.
 * - No valida lógica de negocio.
 * - No guarda datos.
 *
 * Rol dentro del sistema:
 * -----------------------
 * Es una utilidad del dominio conversacional.
 *
 * En resumen:
 * -----------
 * Recibe texto + opciones + extras
 * y devuelve una respuesta uniforme para el resto del sistema.
 */

/**
 * Construye una respuesta estándar del bot.
 *
 * @param {string} message
 * Texto principal que el bot le va a mostrar al usuario.
 *
 * @param {Array} options
 * Lista de opciones/botones sugeridos.
 * Por defecto es un array vacío.
 *
 * @param {Object} extra
 * Propiedades adicionales opcionales.
 *
 * Ejemplos:
 * - completed: true
 * - leadSaved: true
 * - offerHumanFallback: true
 * - locked: true
 *
 * @returns {Object}
 * Devuelve el objeto final de respuesta.
 */
function buildResponse(message, options = [], extra = {}) {
  return {
    // Texto principal del bot
    message,

    // Botones / opciones sugeridas
    options,

    // Flags u otros metadatos adicionales
    ...extra
  };
}

module.exports = {
  buildResponse
};