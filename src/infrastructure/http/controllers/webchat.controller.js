/**
 * ============================================
 * WEBCHAT CONTROLLER
 * ============================================
 *
 * ¿Qué hace este archivo?
 * -----------------------
 * Recibe mensajes desde el chat web (frontend)
 * y los envía al motor del bot para obtener una respuesta.
 *
 * Es el equivalente al webhook de WhatsApp,
 * pero para el canal web.
 *
 * Funciones principales:
 * - Recibir mensajes desde el frontend.
 * - Validar datos básicos.
 * - Asegurar la existencia de la sesión.
 * - Reabrir automáticamente sesiones cerradas.
 * - Delegar el procesamiento al caso de uso principal.
 * - Adaptar algunas respuestas del motor al formato comercial
 *   que queremos mostrar en el webchat.
 *
 * Importante:
 * -----------
 * Este controller NO debe bypassear la lógica de asesor.
 * El motor sigue decidiendo:
 * - si se crea lead parcial
 * - si hay handoff humano
 * - qué respuesta corresponde
 *
 * Lo único que hacemos acá es:
 * - igualar la experiencia visual del webchat con WhatsApp
 * - especialmente en menú principal y "Más opciones"
 */

const {
  getOrCreateSession,
  isSessionHumanControlled,
  isSessionClosed,
  markSessionAsBot
} = require('../../persistence/sqlite/sessions.repository');

const { processIncomingMessage } = require('../../../application/use-cases/process-incoming-message');

/**
 * Detecta si la respuesta del engine es el menú principal.
 *
 * Esto nos permite reemplazar el menú base del motor
 * por el mismo menú comercial que usamos en WhatsApp.
 */
 
 const {
  TEXT_LIMITS
} = require('../../../shared/constants/app.constants');

const {
  validateMaxTextLength
} = require('../../../shared/validation/crm.validation');


function isEngineMainMenu(reply) {
  if (!reply?.options) return false;

  const labels = reply.options.map(o => String(o.label || '').toLowerCase());

  return (
    labels.includes('servicios de fumigación') &&
    labels.includes('compra de productos') &&
    labels.includes('certificado de local fumigado') &&
    labels.includes('consultas administrativas')
  );
}

/**
 * Detecta si la respuesta del engine representa
 * una consulta ya registrada / finalizada.
 */
function isEngineCompletedReply(reply) {
  const msg = String(reply?.message || '').toLowerCase();

  return msg.includes('consulta ya fue registrada') || msg.includes('ya registré');
}

/**
 * Menú principal comercial del webchat.
 *
 * Queda alineado con WhatsApp:
 * - Fumigación
 * - Certificado
 * - Más opciones
 */
function buildWebchatWelcomeMenu() {
  return {
    message:
      `Hola 👋 Bienvenido a Ofreser\n\n` +
      `¿En qué podemos ayudarte?`,
    options: [
      { label: 'Servicios de fumigación', value: '1' },
      { label: 'Certificado de local fumigado', value: '3' },
      { label: 'Más opciones', value: 'menu_mas_opciones' }
    ]
  };
}

/**
 * Submenú "Más opciones" del webchat.
 *
 * Esto iguala el comportamiento del canal web
 * con el flujo real de WhatsApp.
 */
function buildWebchatMoreOptionsMenu() {
  return {
    message:
      `Perfecto 👍\n\n` +
      `También puedo ayudarte con:\n\n` +
      `• Compra de productos\n` +
      `• Consultas administrativas\n` +
      `• Contacto con un asesor\n\n` +
      `Elegí cómo querés continuar:`,
    options: [
      { label: 'Compra de productos', value: '2' },
      { label: 'Consultas administrativas', value: '4' },
      { label: 'Hablar con un asesor', value: 'asesor' },
      { label: 'Volver al menú principal', value: 'menu' }
    ]
  };
}

/**
 * Menú de continuación luego de una consulta registrada.
 *
 * También queda alineado con WhatsApp.
 */
function buildWebchatCompletedMenu(originalMessage = '') {
  return {
    message:
      `${originalMessage}\n\n` +
      `¿Querés hacer otra consulta o necesitás ayuda con algo más?`,
    options: [
      { label: 'Sí, otra consulta', value: 'si' },
      { label: 'Hablar con un asesor', value: 'asesor' },
      { label: 'Menú principal', value: 'menu' },
      { label: 'No, gracias', value: 'no' }
    ]
  };
}

/**
 * Menú de fallback con asesor.
 *
 * Se usa cuando el engine devuelve offerHumanFallback.
 */
function buildWebchatHumanFallbackMenu(originalMessage = '') {
  return {
    message:
      `${originalMessage}\n\n` +
      `Si querés, también puedo derivarte con un asesor para una atención más personalizada.`,
    options: [
      { label: 'Hablar con un asesor', value: 'asesor' },
      { label: 'Menú principal', value: 'menu' },
      { label: 'No, gracias', value: 'no' }
    ]
  };
}

/**
 * Endpoint principal del chat web.
 *
 * Método: POST /chat
 *
 * Espera:
 * {
 *   sessionId: string,
 *   message: string
 * }
 */
function postChat(req, res) {
  /**
   * Extraemos los datos del body.
   */
  const sessionId = req.body.sessionId;
  const rawMessage = req.body.message;
  const MAX_WEBCHAT_MESSAGE_LENGTH = TEXT_LIMITS.WEBCHAT_MESSAGE_MAX;

  /**
   * Validación básica.
   */
  if (!sessionId || rawMessage === undefined || rawMessage === null) {
    return res.status(400).json({
      error: 'Faltan sessionId o message'
    });
  }

const messageValidation = validateMaxTextLength(
  rawMessage,
  MAX_WEBCHAT_MESSAGE_LENGTH,
  'Faltan sessionId o message',
  `El mensaje no puede superar los ${MAX_WEBCHAT_MESSAGE_LENGTH} caracteres`
);

if (!messageValidation.ok) {
  return res.status(400).json({
    error: messageValidation.error
  });
}

const cleanMessage = messageValidation.value;

  try {
    /**
     * Aseguramos existencia de sesión.
     */
    getOrCreateSession({
      sessionId,
      channel: 'webchat',
      externalUserId: sessionId
    });

    /**
     * Si la conversación ya está en modo humano,
     * el bot no debe responder.
     */
    if (isSessionHumanControlled(sessionId)) {
      return res.json({
        reply: {
          message: 'Esta conversación está siendo atendida por un asesor.',
          options: []
        }
      });
    }

    /**
     * Si la conversación está cerrada,
     * la reabrimos automáticamente para no perder al cliente.
     */
    if (isSessionClosed(sessionId)) {
      markSessionAsBot(sessionId);
    }

    /**
     * Submenú "Más opciones".
     *
     * Igual que en WhatsApp, esto lo resolvemos
     * a nivel controller como adaptación visual del canal.
     */
    if (cleanMessage.toLowerCase() === 'menu_mas_opciones') {
      return res.json({
        ok: true,
        sessionId,
        reply: buildWebchatMoreOptionsMenu()
      });
    }

    /**
     * Delegamos el resto del procesamiento al caso de uso principal.
     */
const result = processIncomingMessage({
  sessionId,
  message: cleanMessage,
  channel: 'webchat',
  externalUserId: sessionId
});

    /**
     * Adaptamos ciertas respuestas del engine para que
     * el webchat tenga la misma experiencia comercial que WhatsApp.
     */
    if (result?.reply) {
      let reply = result.reply;

      if (isEngineMainMenu(reply)) {
        reply = buildWebchatWelcomeMenu();
      } else if (isEngineCompletedReply(reply)) {
        reply = buildWebchatCompletedMenu(reply.message);
      } else if (reply.offerHumanFallback) {
        reply = buildWebchatHumanFallbackMenu(reply.message);
      }

      return res.json({
        ...result,
        reply
      });
    }

    return res.json(result);

  } catch (error) {
    console.error('❌ Error en webchat.controller:', error);

    return res.status(500).json({
      error: 'Error procesando mensaje'
    });
  }
}

module.exports = {
  postChat
};