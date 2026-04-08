/**
 * ============================================
 * WHATSAPP WEBHOOK CONTROLLER
 * ============================================
 *
 * ¿Qué hace este archivo?
 * -----------------------
 * Es el puente entre WhatsApp Cloud API y el motor interno del bot.
 *
 * Responsabilidades:
 * - verificar webhook
 * - recibir mensajes
 * - normalizar input
 * - asegurar sesión
 * - reabrir sesiones cerradas cuando entra un mensaje nuevo
 * - delegar al caso de uso principal
 * - adaptar la respuesta al formato ideal para WhatsApp
 *
 * Importante:
 * -----------
 * Este archivo NO debe bypassear al motor en casos
 * como "asesor", porque eso haría perder la creación
 * de leads parciales y rompería la consistencia del flujo.
 */

const { getBySessionId, upsertSession } = require('../../persistence/sqlite/sessions.repository');

const VERIFY_TOKEN = process.env.VERIFY_TOKEN;

const { sendWhatsAppReply } = require('../../channels/whatsapp/whatsapp.client');
const { processIncomingMessage } = require('../../../application/use-cases/process-incoming-message');

const {
  getOrCreateSession,
  isSessionHumanControlled,
  isSessionClosed,
  markSessionAsBot
} = require('../../persistence/sqlite/sessions.repository');

const { logger, maskPhone } = require('../../../shared/logger/logger');

/**
 * Verificación del webhook con Meta.
 */
function verifyWhatsappWebhook(req, res) {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    logger.info('Webhook de WhatsApp verificado correctamente');
    return res.status(200).send(challenge);
  }

  logger.warn('Intento fallido de verificación de webhook');
  return res.sendStatus(403);
}

/**
 * Mapea entradas de WhatsApp a comandos internos del bot.
 */
function mapWhatsAppInput(text) {
  const t = String(text || '').toLowerCase().trim();

  // MENÚ PRINCIPAL
  if (t.includes('fumigación') || t.includes('fumigacion')) return '1';
  if (t.includes('certificado')) return '3';
  if (t.includes('más opciones') || t.includes('mas opciones')) return 'menu_mas_opciones';

  // SUBMENÚ
  if (t.includes('productos')) return '2';
  if (t.includes('administrativa')) return '4';
  if (t.includes('asesor') || t.includes('humano')) return 'asesor';

  // NAVEGACIÓN
  if (t.includes('volver') || t === 'menu') return 'menu';
  if (t.includes('reiniciar')) return 'reset';

  // CIERRE
  if (t === 'si' || t === 'sí') return 'si';
  if (t === 'no') return 'no';

  return text;
}

/**
 * Extrae el texto real enviado por el usuario.
 */
function extractIncomingUserText(message) {
  if (!message) return null;

  if (message.type === 'text') {
    return message.text?.body?.trim() || null;
  }

  if (message.type === 'interactive') {
    const interactive = message.interactive;

    if (interactive?.type === 'button_reply') {
      return interactive.button_reply?.id || interactive.button_reply?.title || null;
    }

    if (interactive?.type === 'list_reply') {
      return interactive.list_reply?.id || interactive.list_reply?.title || null;
    }
  }

  return null;
}

/**
 * Detecta si la respuesta del engine es el menú principal.
 */
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
 * un flujo ya registrado.
 */
function isEngineCompletedReply(reply) {
  const msg = String(reply?.message || '').toLowerCase();

  return msg.includes('consulta ya fue registrada') || msg.includes('ya registré');
}

/**
 * Menú principal custom para WhatsApp.
 */
function buildWhatsAppWelcomeMenu() {
  return {
    message:
      `Hola 👋\n\n` +
      `Bienvenido a Ofreser - Grupo Morón Control de Plagas.\n\n` +
      `Somos especialistas en control de plagas para hogares, comercios e industrias.\n\n` +
      `Podemos ayudarte con:\n` +
      `• Fumigación\n` +
      `• Certificados de local fumigado\n` +
      `• Venta de productos\n` +
      `• Consultas administrativas\n\n` +
      `Elegí una opción para comenzar:`,
    options: [
      { label: 'Fumigación', value: '1' },
      { label: 'Certificado', value: '3' },
      { label: 'Más opciones', value: 'menu_mas_opciones' }
    ]
  };
}

/**
 * Submenú "Más opciones".
 */
function buildWhatsAppMoreOptionsMenu() {
  return {
    message:
      `Perfecto 👍\n\n` +
      `También puedo ayudarte con:\n` +
      `• Compra de productos\n` +
      `• Consultas administrativas\n` +
      `• Contacto con un asesor\n\n` +
      `Elegí cómo querés continuar:`,
    options: [
      { label: 'Productos', value: '2' },
      { label: 'Administrativas', value: '4' },
      { label: 'Asesor', value: 'asesor' },
      { label: 'Volver al menú', value: 'menu' }
    ]
  };
}

/**
 * Menú de continuación luego de una consulta registrada.
 */
function buildWhatsAppCompletedMenu(originalMessage = '') {
  return {
    message:
      `${originalMessage}\n\n` +
      `¿Querés hacer otra consulta o necesitás ayuda con algo más?`,
    options: [
      { label: 'Sí', value: 'si' },
      { label: 'Asesor', value: 'asesor' },
      { label: 'Menú', value: 'menu' },
      { label: 'No', value: 'no' }
    ]
  };
}

/**
 * Menú de fallback con opción de asesor.
 */
function buildWhatsAppHumanFallbackMenu(originalMessage = '') {
  return {
    message:
      `${originalMessage}\n\n` +
      `Si querés, puedo derivarte con un asesor para una atención más personalizada.`,
    options: [
      { label: 'Asesor', value: 'asesor' },
      { label: 'Menú', value: 'menu' },
      { label: 'No', value: 'no' }
    ]
  };
}

/**
 * Ajustes de tono.
 */
function makeReplyMoreHuman(reply) {
  if (!reply?.message) return reply;

  let msg = reply.message;
  msg = msg.replace('Perfecto.', 'Perfecto 👍');
  msg = msg.replace('Gracias.', 'Gracias 👍');

  return { ...reply, message: msg };
}

function makeReplyCommercial(reply) {
  if (!reply?.message) return reply;

  let msg = reply.message;
  msg = msg.replace('te va a contactar', 'te va a contactar a la brevedad');

  return { ...reply, message: msg };
}

/**
 * Webhook principal.
 */
async function receiveWhatsappWebhook(req, res) {
  try {
    const body = req.body;
    const changeValue = body?.entry?.[0]?.changes?.[0]?.value;

    /**
     * Ignoramos status updates que no son mensajes del usuario.
     */
    if (changeValue?.statuses) {
      logger.debug('Webhook de WhatsApp recibido: status update ignorado');
      return res.sendStatus(200);
    }

    const message = changeValue?.messages?.[0];

    if (!message) {
      logger.debug('Webhook de WhatsApp recibido sin mensaje utilizable');
      return res.sendStatus(200);
    }

    const from = message.from;
    const text = extractIncomingUserText(message);

    if (!from || !text) {
      logger.warn('Webhook de WhatsApp con datos incompletos', {
        hasFrom: !!from,
        hasText: !!text
      });
      return res.sendStatus(200);
    }

    const sessionId = `wa_${from}`;

    logger.info('Mensaje entrante de WhatsApp recibido', {
      sessionId,
      from: maskPhone(from),
      messageType: message.type || 'unknown'
    });

    /**
     * Aseguramos existencia de sesión.
     */
    getOrCreateSession({
      sessionId,
      channel: 'whatsapp',
      externalUserId: from
    });

    /**
     * Si la sesión está en control humano,
     * el bot no responde.
     */
/**
 * Manejo de modo humano con aviso único.
 */
if (isSessionHumanControlled(sessionId)) {

  const session = getBySessionId(sessionId);

  logger.info('Sesión en modo humano detectada', {
    sessionId,
    from: maskPhone(from),
    humanNoticeSentAt: session?.humanNoticeSentAt || null
  });

  /**
   * Si todavía no enviamos el aviso humano,
   * lo mandamos UNA sola vez.
   */
  if (!session?.humanNoticeSentAt) {

    const humanNoticeMessage =
      'Tu consulta fue derivada a un asesor. En breve te responderemos por este medio.';

    /**
     * Guardamos timestamp para no repetirlo
     */
    session.humanNoticeSentAt = new Date().toISOString();
    upsertSession(session);

    await sendWhatsAppReply(from, {
      message: humanNoticeMessage
    });

    logger.info('Aviso humano enviado (único)', {
      sessionId,
      from: maskPhone(from)
    });
  }

  /**
   * Después del primer aviso → silencio total
   */
  return res.sendStatus(200);
}

    /**
     * Si la sesión está cerrada,
     * la reabrimos automáticamente para no perder al cliente.
     *
     * Política aplicada:
     * - closed + mensaje nuevo = volver al bot
     * - después de reabrir, procesamos el mensaje normalmente
     */
    if (isSessionClosed(sessionId)) {
      logger.info('Sesión cerrada detectada. Se reabre automáticamente.', {
        sessionId,
        from: maskPhone(from)
      });

      markSessionAsBot(sessionId);
    }

    const normalizedInput = mapWhatsAppInput(text);

    /**
     * Submenú "Más opciones".
     *
     * Esto sí lo seguimos resolviendo a nivel controller
     * porque es solo una adaptación visual del canal.
     */
    if (normalizedInput === 'menu_mas_opciones') {
      logger.info('Usuario ingresó a Más opciones', {
        sessionId,
        from: maskPhone(from)
      });

      await sendWhatsAppReply(from, buildWhatsAppMoreOptionsMenu());
      return res.sendStatus(200);
    }

    /**
     * NO interceptamos "asesor" acá.
     * Lo delegamos al caso de uso principal.
     */
    const response = processIncomingMessage({
      sessionId,
      message: normalizedInput,
      channel: 'whatsapp',
      externalUserId: from
    });

    /**
     * Si el motor devolvió reply,
     * lo adaptamos al canal WhatsApp.
     */
    if (response?.reply) {
      let reply = response.reply;

      if (isEngineMainMenu(reply)) {
        reply = buildWhatsAppWelcomeMenu();
      } else if (isEngineCompletedReply(reply)) {
        reply = buildWhatsAppCompletedMenu(reply.message);
      } else if (reply.offerHumanFallback) {
        reply = buildWhatsAppHumanFallbackMenu(reply.message);
      } else {
        reply = makeReplyCommercial(makeReplyMoreHuman(reply));
      }

      await sendWhatsAppReply(from, reply);

      logger.info('Reply enviado por WhatsApp correctamente', {
        sessionId,
        from: maskPhone(from)
      });
    }

    return res.sendStatus(200);

  } catch (error) {
    logger.error('Error procesando webhook de WhatsApp', {
      error: error.response?.data || error.message
    });

    return res.sendStatus(500);
  }
}

module.exports = {
  verifyWhatsappWebhook,
  receiveWhatsappWebhook
};