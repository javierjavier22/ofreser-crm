/**
 * ============================================
 * WHATSAPP CLIENT
 * ============================================
 *
 * ¿Qué hace este archivo?
 * -----------------------
 * Envía mensajes desde el sistema hacia WhatsApp Cloud API.
 *
 * Es el adaptador de salida del canal WhatsApp.
 *
 * Responsabilidades:
 * ------------------
 * - enviar texto simple
 * - enviar botones
 * - enviar listas
 * - elegir el formato más adecuado según la cantidad de opciones
 *
 * Mejora aplicada:
 * ----------------
 * - logging profesional con Winston
 * - sin exponer token ni phone number id
 * - sin exponer contenido completo sensible
 *
 * En resumen:
 * -----------
 * Este archivo traduce respuestas internas del bot
 * al formato que espera WhatsApp Cloud API.
 */

const axios = require('axios');
const { logger, maskPhone } = require('../../../shared/logger/logger');

/**
 * Variables de entorno necesarias para WhatsApp Cloud API.
 */
const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;
const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID;

/**
 * Deja un string con solo dígitos.
 */
function normalizeDigits(value) {
  return String(value || '').replace(/[^\d]/g, '');
}

/**
 * Ajusta números argentinos en entorno de prueba (sandbox).
 *
 * IMPORTANTE:
 * -----------
 * Esto es una adaptación específica para testing.
 * No debe asumirse como formato universal de producción.
 */
/**
 * Ajusta números argentinos según entorno.
 *
 * Reglas:
 * - producción real: devuelve el número limpio, sin tocarlo
 * - sandbox/testing: mantiene la lógica especial con "15"
 *
 * Importante:
 * process.env.WA_PRODUCTION debe ser 'true'
 * únicamente cuando ya querés usar formato real de producción.
 */
function convertArgentinaTestRecipient(to) {
  const digits = normalizeDigits(to);

  /**
   * En producción real NO aplicamos la adaptación sandbox.
   */
  if (process.env.WA_PRODUCTION === 'true') {
    return digits;
  }

  /**
   * Si no es un número argentino en formato 549...
   * lo dejamos como está.
   */
  if (!digits.startsWith('549')) {
    return digits;
  }

  const country = '54';
  const withoutCountryAndMobile9 = digits.slice(3);
  const areaCode = withoutCountryAndMobile9.slice(0, 3);
  const localNumber = withoutCountryAndMobile9.slice(3);

  return `${country}${areaCode}15${localNumber}`;
}

/**
 * Recorta un texto si supera un tamaño máximo.
 */
function truncateText(text, max = 1024) {
  const value = String(text || '');
  return value.length <= max ? value : value.slice(0, max - 3) + '...';
}

/**
 * Limpia un valor para usarlo como ID interno de botón/lista.
 */
function sanitizeId(value, fallback = 'opt') {
  return String(value || fallback)
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^\w-]/g, '')
    .slice(0, 200);
}

/**
 * Convierte opciones internas del bot
 * al formato que usa WhatsApp.
 */
function mapOptionsForWhatsApp(options = []) {
  return options
    .filter(opt => opt && opt.label && opt.value)
    .map(opt => ({
      id: sanitizeId(opt.value),
      title: String(opt.label).slice(0, 20),
      value: String(opt.value),
      label: String(opt.label)
    }));
}

/**
 * Decide automáticamente qué tipo de mensaje interactivo usar.
 */
function chooseInteractiveMode(options = []) {
  const mapped = mapOptionsForWhatsApp(options);

  if (mapped.length === 0) {
    return { mode: 'text', items: [] };
  }

  if (mapped.length <= 3) {
    return { mode: 'buttons', items: mapped };
  }

  return { mode: 'list', items: mapped.slice(0, 10) };
}

/**
 * Hace el POST real contra WhatsApp Cloud API.
 */
async function postWhatsAppPayload(payload) {
  const response = await axios.post(
    `https://graph.facebook.com/v25.0/${PHONE_NUMBER_ID}/messages`,
    payload,
    {
      headers: {
        Authorization: `Bearer ${WHATSAPP_TOKEN}`,
        'Content-Type': 'application/json'
      }
    }
  );

  return response.data;
}

/**
 * Envía un mensaje de texto simple.
 */
async function sendWhatsAppText(to, message) {
  const normalizedTo = convertArgentinaTestRecipient(to);

  logger.info('Enviando texto a WhatsApp', {
    to: maskPhone(normalizedTo),
    type: 'text'
  });

  const payload = {
    messaging_product: 'whatsapp',
    to: normalizedTo,
    type: 'text',
    text: {
      body: truncateText(message, 4096)
    }
  };

  const data = await postWhatsAppPayload(payload);

  logger.info('Texto enviado correctamente a WhatsApp', {
    to: maskPhone(normalizedTo),
    type: 'text'
  });

  return data;
}

/**
 * Envía botones interactivos.
 */
async function sendWhatsAppButtons(to, message, options = []) {
  const normalizedTo = convertArgentinaTestRecipient(to);
  const mapped = mapOptionsForWhatsApp(options).slice(0, 3);

  logger.info('Enviando botones a WhatsApp', {
    to: maskPhone(normalizedTo),
    type: 'buttons',
    optionsCount: mapped.length
  });

  const payload = {
    messaging_product: 'whatsapp',
    to: normalizedTo,
    type: 'interactive',
    interactive: {
      type: 'button',
      body: {
        text: truncateText(message, 1024)
      },
      action: {
        buttons: mapped.map(item => ({
          type: 'reply',
          reply: {
            id: item.id,
            title: item.title
          }
        }))
      }
    }
  };

  const data = await postWhatsAppPayload(payload);

  logger.info('Botones enviados correctamente a WhatsApp', {
    to: maskPhone(normalizedTo),
    type: 'buttons',
    optionsCount: mapped.length
  });

  return data;
}

/**
 * Envía una lista interactiva.
 */
async function sendWhatsAppList(to, message, options = []) {
  const normalizedTo = convertArgentinaTestRecipient(to);
  const mapped = mapOptionsForWhatsApp(options).slice(0, 10);

  logger.info('Enviando lista a WhatsApp', {
    to: maskPhone(normalizedTo),
    type: 'list',
    optionsCount: mapped.length
  });

  const payload = {
    messaging_product: 'whatsapp',
    to: normalizedTo,
    type: 'interactive',
    interactive: {
      type: 'list',
      body: {
        text: truncateText(message, 1024)
      },
      action: {
        button: 'Ver opciones',
        sections: [
          {
            title: 'Opciones disponibles',
            rows: mapped.map(item => ({
              id: item.id,
              title: item.title,
              description: item.value.slice(0, 72)
            }))
          }
        ]
      }
    }
  };

  const data = await postWhatsAppPayload(payload);

  logger.info('Lista enviada correctamente a WhatsApp', {
    to: maskPhone(normalizedTo),
    type: 'list',
    optionsCount: mapped.length
  });

  return data;
}

/**
 * Función principal de salida hacia WhatsApp.
 *
 * Decide automáticamente:
 * - texto
 * - botones
 * - lista
 *
 * Si falla el envío interactivo,
 * hace fallback a texto simple.
 */
async function sendWhatsAppReply(to, reply) {
  const message = reply?.message || '';
  const options = Array.isArray(reply?.options) ? reply.options : [];

  const chosen = chooseInteractiveMode(options);

  try {
    if (chosen.mode === 'buttons') {
      return await sendWhatsAppButtons(
        to,
        message,
        chosen.items.map(item => ({
          label: item.label,
          value: item.value
        }))
      );
    }

    if (chosen.mode === 'list') {
      return await sendWhatsAppList(
        to,
        message,
        chosen.items.map(item => ({
          label: item.label,
          value: item.value
        }))
      );
    }

    return await sendWhatsAppText(to, message);

  } catch (error) {
    logger.error('Error enviando reply interactivo a WhatsApp. Se aplica fallback a texto.', {
      error: error.response?.data || error.message
    });

    return await sendWhatsAppText(to, message);
  }
}

module.exports = {
  sendWhatsAppText,
  sendWhatsAppReply
};