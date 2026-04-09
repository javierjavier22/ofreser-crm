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
 * Normaliza un destinatario de WhatsApp de forma segura.
 *
 * Casos que corrige:
 * - wa_549...
 * - +54 ...
 * - espacios
 * - guiones
 * - paréntesis
 *
 * Importante:
 * - NO bloquea el envío
 * - si el número parece raro, solo loguea warning
 */
function normalizeWhatsAppRecipient(to) {
  const raw = String(to || '').trim();

  /**
   * Quitamos prefijo interno si existe.
   * Ejemplo:
   * wa_5493872213583 -> 5493872213583
   */
  const withoutPrefix = raw.replace(/^wa_/i, '');

  /**
   * Dejamos solo dígitos.
   */
  const digits = normalizeDigits(withoutPrefix);

  /**
   * Warning defensivo:
   * no frenamos el envío, solo dejamos trazabilidad.
   */
  if (!digits) {
    logger.warn('Destinatario WhatsApp vacío o inválido tras normalización', {
      original: raw
    });
  } else if (digits.length < 10 || digits.length > 15) {
    logger.warn('Destinatario WhatsApp con longitud inusual', {
      original: raw,
      normalized: maskPhone(digits),
      digitsLength: digits.length
    });
  }

  return digits;
}

/**
 * Ajusta números argentinos en entorno de prueba (sandbox).
 *
 * IMPORTANTE:
 * -----------
 * Esto es una adaptación específica para testing.
 * No debe asumirse como formato universal de producción.
 */
function convertArgentinaTestRecipient(to) {
  const digits = normalizeWhatsAppRecipient(to);

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
  to: maskPhone(normalizeWhatsAppRecipient(to)),
  error: error.response?.data || error.message,
  status: error.response?.status || null,
  metaTraceId:
    error.response?.data?.fbtrace_id ||
    error.response?.headers?.['x-fb-trace-id'] ||
    null
});	

    return await sendWhatsAppText(to, message);
  }
}

module.exports = {
  sendWhatsAppText,
  sendWhatsAppReply
};