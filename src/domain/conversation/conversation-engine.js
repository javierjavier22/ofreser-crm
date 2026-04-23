/**
 * =========================================================
 * CONVERSATION ENGINE
 * =========================================================
 *
 * ¿Qué hace este archivo?
 * -----------------------
 * Este archivo contiene la lógica conversacional principal del bot.
 *
 * Acá se decide:
 * - cómo interpretar mensajes
 * - en qué paso del flujo está el usuario
 * - qué responder
 * - si hay que guardar un lead
 * - si hay que derivar a un asesor
 *
 * ¿Qué NO hace?
 * -------------
 * - No guarda datos directamente en JSON
 * - No envía mensajes a WhatsApp
 * - No expone endpoints HTTP
 *
 * Rol dentro del sistema:
 * -----------------------
 * Este archivo pertenece a la capa Domain.
 *
 * Es el "motor de conversación" del bot.
 * El resto del sistema gira alrededor de este archivo.
 *
 * En resumen:
 * -----------
 * Recibe una sesión + un mensaje y devuelve:
 * - sesión actualizada
 * - reply
 * - acción a ejecutar (si corresponde)
 */

const { detectFaq, mainMenuOptions } = require('./detect-faq');
const {
  BUSINESS_CONFIG,
  CATALOGS
} = require('../../config/business.config');
const { buildResponse } = require('./response-builder');
const { detectIntent } = require('./detect-intent');
const { parseContactMessage } = require('./parse-contact');

/**
 * Devuelve la fecha actual en formato ISO.
 */
function nowIso() {
  return new Date().toISOString();
}

/**
 * Convierte "HH:MM" a minutos desde 00:00.
 */
function timeToMinutes(timeText) {
  const [hours, minutes] = String(timeText || '00:00')
    .split(':')
    .map(Number);

  return (Number(hours) * 60) + Number(minutes);
}

/**
 * Informa si ahora estamos dentro del horario comercial.
 *
 * Usa la hora local del servidor.
 * Para este proyecto está bien porque trabajás con horario argentino.
 */
function isBusinessHoursNow() {
  const schedule = BUSINESS_CONFIG?.office?.businessHours || {};
  const now = new Date();

  const day = now.getDay();
  const currentMinutes = (now.getHours() * 60) + now.getMinutes();

  const ranges = schedule[day];

  if (!Array.isArray(ranges) || ranges.length === 0) {
    return false;
  }

  return ranges.some(range => {
    const startMinutes = timeToMinutes(range.start);
    const endMinutes = timeToMinutes(range.end);

    return currentMinutes >= startMinutes && currentMinutes <= endMinutes;
  });
}

/**
 * Devuelve el mensaje correcto para derivación a asesor
 * según si estamos dentro o fuera de horario comercial.
 */
function getHumanHandoffMessage() {
  if (isBusinessHoursNow()) {
    return `Perfecto 👍

Voy a derivar tu caso a un asesor.
A partir de este momento un asesor continuará la atención por este mismo chat.`;
  }

  return `Gracias por tu mensaje 👍

Voy a derivar tu caso a un asesor.

Nuestro horario de atención es:
${BUSINESS_CONFIG.office.scheduleText}

Te responderemos por este mismo medio dentro de ese horario.`;
}

/**
 * Actualiza la fecha de modificación de la sesión.
 *
 * Esto sirve para saber cuándo fue el último movimiento
 * dentro de una conversación.
 */
function touchSession(session) {
  session.updatedAt = nowIso();
}

/**
 * Normaliza un texto de entrada para comparaciones:
 * - lo pasa a string
 * - recorta espacios
 * - lo pasa a minúsculas
 */
function normalize(text) {
  return String(text || '').trim().toLowerCase();
}

/**
 * Convierte un catálogo de strings en opciones del bot.
 *
 * Regla:
 * - label: texto visible
 * - value: texto normalizado en minúsculas
 */
function catalogToOptions(list = []) {
  if (!Array.isArray(list)) {
    return [];
  }

  return list.map((item) => ({
    label: String(item),
    value: String(item).toLowerCase()
  }));
}

/**
 * Asegura que la sesión tenga la estructura mínima esperada.
 *
 * NO cambia la lógica del bot.
 * Solo evita errores si la sesión viene nula, vacía o incompleta.
 */
function ensureSessionStructure(session) {
  const safeSession = session || {};

  if (!safeSession.step) {
    safeSession.step = 'welcome';
  }

  if (!safeSession.data || typeof safeSession.data !== 'object') {
    safeSession.data = {};
  }

  if (typeof safeSession.invalidCount !== 'number') {
    safeSession.invalidCount = 0;
  }

  return safeSession;
}

/**
 * Lista de steps válidos del motor conversacional.
 *
 * Si por algún motivo llega un step corrupto o inexistente,
 * lo corregimos antes del switch.
 */
const VALID_STEPS = new Set([
  'welcome',
  'main_menu',
  'services_pest',
  'services_place_type',
  'services_zone',
  'services_contact',
  'products_item',
  'products_contact',
  'certificates_local_type',
  'certificates_business_name',
  'certificates_address',
  'certificates_contact',
  'admin_reason',
  'admin_contact',
  'completed',
  'handoff',
  'closed'
]);

/**
 * Corrige steps inválidos antes de entrar al switch.
 *
 * Importante:
 * - no rompe la conversación
 * - vuelve al flujo seguro
 */
function normalizeSessionStep(session) {
  if (!VALID_STEPS.has(session.step)) {
    session.step = 'main_menu';
    session.data = {};
    session.invalidCount = 0;
  }

  return session;
}

/**
 * Detecta comandos para volver al menú principal.
 */
function isBackCommand(msg) {
  return ['0', 'menu', 'menú', 'volver', 'volver al menu', 'volver al menú'].includes(msg);
}

/**
 * Detecta comandos para reiniciar la conversación.
 */
function isResetCommand(msg) {
  return ['reset', 'reiniciar', 'inicio', 'start'].includes(msg);
}

/**
 * Detecta saludos simples.
 */
function isGreeting(msg) {
  return [
    'hola',
    'buenas',
    'buen día',
    'buen dia',
    'buenas tardes',
    'buenas noches',
    'hello',
    'hi'
  ].includes(msg);
}

/**
 * Detecta respuestas afirmativas en cierre / continuación.
 */
function isYesCommand(msg) {
  return [
    'si',
    'sí',
    'ok',
    'dale',
    'claro',
    'otra consulta',
    'nueva consulta'
  ].includes(msg);
}

/**
 * Detecta respuestas negativas en cierre / continuación.
 */
function isNoCommand(msg) {
  return [
    'no',
    'no gracias',
    'gracias',
    'nada mas',
    'nada más',
    'eso es todo'
  ].includes(msg);
}

/**
 * Opciones básicas reutilizables durante varios flujos.
 */
function basicTools() {
  return [
    { label: '🔙 Volver al menú principal', value: '0' },
    { label: '🔄 Reiniciar conversación', value: 'reset' }
  ];
}

/**
 * Opciones que se muestran cuando una consulta ya terminó.
 *
 * IMPORTANTE:
 * -----------
 * Acá agregamos explícitamente la opción de hablar con un asesor
 * para que el usuario pueda pasar a atención humana
 * al final del flujo sin necesidad de escribirlo manualmente.
 */
function completedTools() {
  return [
    { label: '✅ Sí, otra consulta', value: 'si' },
    { label: '👤 Hablar con un asesor', value: 'asesor' },
    { label: '🏠 Menú principal', value: 'menu' },
    { label: '🙌 No, gracias', value: 'no' }
  ];
}

/**
 * Construye la respuesta del menú principal.
 */
function mainMenuResponse() {
  return buildResponse(
    `Hola 👋 Bienvenido a ${BUSINESS_CONFIG.companyName}

Somos especialistas en control de plagas y servicios para comercios y hogares.

Podemos ayudarte con fumigación, certificados, venta de productos y consultas administrativas.

¿En qué podemos ayudarte?`,
    mainMenuOptions()
  );
}

/**
 * Reinicia la sesión y devuelve al usuario al menú principal.
 */
function restartToMainMenu(session) {
  session.step = 'main_menu';
  session.data = {};
  session.invalidCount = 0;
  touchSession(session);

  return buildResponse(
    `Volvimos al menú principal ✅

Podemos ayudarte con fumigación, certificados, productos y consultas administrativas.

¿En qué podemos ayudarte?`,
    mainMenuOptions()
  );
}

/**
 * Maneja respuestas inválidas con fallback a asesor.
 *
 * Estrategia aplicada:
 * --------------------
 * - Primer error:
 *   el bot simplemente vuelve a orientar al usuario
 *
 * - Segundo error:
 *   el bot ofrece explícitamente hablar con un asesor
 *
 * - Tercer error o más:
 *   el bot deriva automáticamente a un asesor
 *   y marca la conversación para handoff
 *
 * IMPORTANTE:
 * -----------
 * Cuando ya se deriva a asesor, NO mostramos botones.
 * Esto evita dejar botones del bot visibles en una conversación
 * que ya quedó bloqueada en modo humano.
 */
function invalidWithFallback(session, normalMessage, normalOptions = []) {
  session.invalidCount += 1;

  /**
   * Caso 1:
   * Primer error.
   */
  if (session.invalidCount === 1) {
    return buildResponse(normalMessage, normalOptions);
  }

  /**
   * Caso 2:
   * Segundo error.
   */
  if (session.invalidCount === 2) {
    return buildResponse(
      `${normalMessage}

Si preferís, también puedo derivarte con un asesor.`,
      [
        ...normalOptions,
        { label: '👤 Hablar con un asesor', value: 'asesor' }
      ],
      { offerHumanFallback: true }
    );
  }

  /**
   * Caso 3:
   * Tercer error o más.
   *
   * Acá derivamos automáticamente y NO dejamos botones.
   */
  session.data.requiresHuman = true;
  session.step = 'handoff';

  return buildResponse(
    `Para poder ayudarte mejor, te vamos a derivar con un asesor 👍

A partir de este momento un asesor continuará la atención por este mismo chat.`,
    [],
    {
      humanHandoff: true,
      completed: true,
      locked: true,
      autoHumanHandoff: true
    }
  );
}

/**
 * Pide nombre + teléfono en un solo mensaje.
 *
 * Esto se usa en varios flujos para capturar contacto.
 */
function askCombinedContactMessage(contextText) {
  return buildResponse(
    `${contextText}

Para continuar, pasame por favor:
Nombre + teléfono

Ejemplo:
Juan Pérez 3875123456`,
    basicTools()
  );
}

/**
 * Construye respuestas directas según intención detectada.
 *
 * Esto permite que si el usuario escribe algo como:
 * - "quiero un certificado"
 * - "necesito fumigar"
 *
 * el bot entre directamente al flujo correcto.
 */
function buildDirectFlowReply(intent, session) {
  if (intent === 'servicios') {
    session.data.category = 'servicios';
    session.step = 'services_pest';

    return buildResponse(
      `Perfecto 👍

Vamos a ayudarte con tu consulta de fumigación.

¿Qué problema o plaga necesitás tratar?`,
      [
        ...catalogToOptions(CATALOGS.pests),
        ...basicTools()
      ]
    );
  }

  if (intent === 'productos') {
    session.data.category = 'productos';
    session.step = 'products_item';

    return buildResponse(
      `Perfecto 👍

¿Qué producto estás buscando?`,
      [
        ...catalogToOptions(CATALOGS.products),
        ...basicTools()
      ]
    );
  }

  if (intent === 'certificados') {
    session.data.category = 'certificados';
    session.step = 'certificates_local_type';

    return buildResponse(
      `Perfecto 👍

${BUSINESS_CONFIG.certificate.explanation}

Vamos a ayudarte con el certificado.

¿Qué tipo de local es?`,
      [
        ...catalogToOptions(CATALOGS.certificateLocalTypes),
        ...basicTools()
      ]
    );
  }

  if (intent === 'administracion') {
    session.data.category = 'administracion';
    session.step = 'admin_reason';

       return buildResponse(
      `Perfecto 👍

Vamos a registrar tu consulta administrativa.

¿Sobre qué tema es?`,
      [
        ...catalogToOptions(CATALOGS.adminReasons),
        ...basicTools()
      ]
    );
  }

  return null;
}

/**
 * Función principal del motor conversacional.
 *
 * Recibe:
 * - session
 * - rawMessage
 *
 * Devuelve:
 * - session actualizada
 * - reply
 * - action opcional
 * - partialReason opcional
 */
function processConversation({ session, rawMessage }) {

  try {
    session = ensureSessionStructure(session);
    session = normalizeSessionStep(session);

    const msg = normalize(rawMessage);

    touchSession(session);

  /**
   * 1. Intentamos detectar primero una FAQ directa.
   * Si coincide, respondemos eso y no seguimos con el flujo.
   */
  const faqReply = detectFaq(msg);
  if (faqReply) {
    return {
      session,
      reply: faqReply,
      action: null
    };
  }

  /**
   * 2. Detectamos si el mensaje encaja con una intención general.
   */
  const directIntent = detectIntent(msg);

  /**
   * 3. Si pide asesor directamente, derivamos.
   *
   * IMPORTANTE:
   * -----------
   * Como la conversación va a quedar en modo humano,
   * NO dejamos botones del bot visibles.
   */
  if (msg === 'asesor' || directIntent === 'asesor') {
    session.data.requiresHuman = true;
    session.step = 'handoff';

    const reply = buildResponse(
      getHumanHandoffMessage(),
      [],
      { humanHandoff: true, completed: true, locked: true }
    );

    return {
      session,
      reply,
      action: 'save_partial_lead',
      partialReason: 'solicitud_directa_asesor'
    };
  }

  /**
   * 4. Si quiere reiniciar, reseteamos toda la conversación.
   */
  if (isResetCommand(msg)) {
    session.step = 'main_menu';
    session.data = {};
    session.invalidCount = 0;
    touchSession(session);

    return {
      session,
      reply: mainMenuResponse(),
      action: null
    };
  }

  /**
   * 5. Si pide volver al menú, lo hacemos.
   */
  if (isBackCommand(msg)) {
    return {
      session,
      reply: restartToMainMenu(session),
      action: null
    };
  }

  let reply = null;
  let action = null;
  let partialReason = null;

  switch (session.step) {

    case 'welcome': {
      session.invalidCount = 0;

      if (isGreeting(msg)) {
        session.step = 'main_menu';
        reply = mainMenuResponse();
        break;
      }

      const directReply = buildDirectFlowReply(directIntent, session);

      if (directReply) {
        reply = directReply;
      } else {
        session.step = 'main_menu';
        reply = mainMenuResponse();
      }
      break;
    }

    /**
     * IMPORTANTE:
     * -----------
     * En menú principal NO reseteamos invalidCount al inicio.
     * Solo se resetea cuando el usuario entra correctamente a un flujo.
     */
    case 'main_menu': {
      if (isGreeting(msg)) {
        session.invalidCount = 0;
        reply = mainMenuResponse();
        break;
      }

      if (msg === '1') {
        session.invalidCount = 0;
        reply = buildDirectFlowReply('servicios', session);
      } else if (msg === '2') {
        session.invalidCount = 0;
        reply = buildDirectFlowReply('productos', session);
      } else if (msg === '3') {
        session.invalidCount = 0;
        reply = buildDirectFlowReply('certificados', session);
      } else if (msg === '4') {
        session.invalidCount = 0;
        reply = buildDirectFlowReply('administracion', session);
      } else if (directIntent) {
        session.invalidCount = 0;
        reply = buildDirectFlowReply(directIntent, session);
      } else {
        reply = invalidWithFallback(
          session,
          `No pude interpretar tu respuesta.

Por favor elegí una de las opciones del menú para poder ayudarte mejor.`,
          mainMenuOptions()
        );

        if (reply.autoHumanHandoff) {
          action = 'save_partial_lead';
          partialReason = 'errores_repetidos_menu_principal';
        }
      }
      break;
    }

    case 'services_pest': {
      session.invalidCount = 0;
      session.data.pest = rawMessage.trim();
      session.step = 'services_place_type';

            reply = buildResponse(
        `Bien 👍

¿Para qué tipo de lugar es el servicio?`,
        [
          ...catalogToOptions(CATALOGS.placeTypes),
          ...basicTools()
        ]
      );
      break;
    }

    case 'services_place_type': {
      session.invalidCount = 0;
      session.data.placeType = rawMessage.trim();
      session.step = 'services_zone';

      reply = buildResponse(
        `Perfecto.

Pasame por favor el domicilio completo donde se realizará el servicio.

Ejemplo:
Calle, número y barrio`,
        basicTools()
      );
      break;
    }

    case 'services_zone': {
      session.invalidCount = 0;
      session.data.zone = rawMessage.trim();
      session.step = 'services_contact';

      reply = askCombinedContactMessage(
        `Gracias.

Con estos datos ya podemos registrar tu solicitud:
• Plaga: ${session.data.pest}
• Lugar: ${session.data.placeType}
• Domicilio: ${session.data.zone}`
      );
      break;
    }

    case 'services_contact': {
      const contact = parseContactMessage(rawMessage);

      if (!contact.valid) {
        reply = invalidWithFallback(
          session,
          `No pude identificar correctamente el nombre y el teléfono.

Pasamelos juntos, por ejemplo:
Juan Pérez 3875123456`,
          basicTools()
        );

        if (reply.autoHumanHandoff) {
          action = 'save_partial_lead';
          partialReason = 'errores_repetidos_contacto_servicios';
        }
        break;
      }

      session.invalidCount = 0;
      session.data.name = contact.name;
      session.data.phone = contact.phone;
      session.data.normalizedPhone = contact.normalizedPhone || '';
      session.step = 'completed';
      action = 'save_lead';

      reply = buildResponse(
        `Gracias. Ya registré tu solicitud de fumigación ✅

Resumen:
• Categoría: Servicios de fumigación
• Plaga: ${session.data.pest}
• Lugar: ${session.data.placeType}
• Domicilio: ${session.data.zone}
• Nombre: ${session.data.name}
• Teléfono: ${session.data.phone}

Un asesor de ${BUSINESS_CONFIG.companyName} te va a contactar a la brevedad para coordinar el servicio.`,
        completedTools(),
        { completed: true, leadSaved: true, locked: true }
      );
      break;
    }

    case 'products_item': {
      session.invalidCount = 0;
      session.data.product = rawMessage.trim();
      session.step = 'products_contact';

      reply = askCombinedContactMessage(
        `Perfecto.

Registré tu interés en:
• Producto: ${session.data.product}

También podés acercarte directamente a nuestro local:
📍 ${BUSINESS_CONFIG.publicStore.address}
🕘 ${BUSINESS_CONFIG.publicStore.scheduleText}`
      );
      break;
    }

    case 'products_contact': {
      const contact = parseContactMessage(rawMessage);

      if (!contact.valid) {
        reply = invalidWithFallback(
          session,
          `No pude identificar correctamente el nombre y el teléfono.

Pasamelos juntos, por ejemplo:
Juan Pérez 3875123456`,
          basicTools()
        );

        if (reply.autoHumanHandoff) {
          action = 'save_partial_lead';
          partialReason = 'errores_repetidos_contacto_productos';
        }
        break;
      }

      session.invalidCount = 0;
      session.data.name = contact.name;
      session.data.phone = contact.phone;
      session.data.normalizedPhone = contact.normalizedPhone || '';
      session.step = 'completed';
      action = 'save_lead';

      reply = buildResponse(
        `Gracias. Ya registré tu consulta de productos ✅

Resumen:
• Producto: ${session.data.product}
• Nombre: ${session.data.name}
• Teléfono: ${session.data.phone}

Te van a contactar desde el local a la brevedad.

📍 Local: ${BUSINESS_CONFIG.publicStore.address}
🕘 ${BUSINESS_CONFIG.publicStore.scheduleText}`,
        completedTools(),
        { completed: true, leadSaved: true, locked: true }
      );
      break;
    }

    case 'certificates_local_type': {
      session.invalidCount = 0;
      session.data.localType = rawMessage.trim();
      session.step = 'certificates_business_name';

      reply = buildResponse(
        `Perfecto.

¿Cómo se llama el local? (nombre de fantasía)

Ejemplo:
Bar La Juntada`,
        basicTools()
      );
      break;
    }

    case 'certificates_business_name': {
      session.invalidCount = 0;
      session.data.businessName = rawMessage.trim();
      session.step = 'certificates_address';

      reply = buildResponse(
        `Perfecto.

Pasame el domicilio completo del local.

Ejemplo:
Calle, número y barrio`,
        basicTools()
      );
      break;
    }

    case 'certificates_address': {
      session.invalidCount = 0;
      session.data.address = rawMessage.trim();
      session.step = 'certificates_contact';

      reply = askCombinedContactMessage(
        `Gracias.

Estos son los datos del local:
• Tipo de local: ${session.data.localType}
• Nombre del local: ${session.data.businessName}
• Domicilio: ${session.data.address}`
      );
      break;
    }

    case 'certificates_contact': {
      const contact = parseContactMessage(rawMessage);

      if (!contact.valid) {
        reply = invalidWithFallback(
          session,
          `No pude identificar correctamente el nombre y el teléfono.

Pasamelos juntos, por ejemplo:
Juan Pérez 3875123456`,
          basicTools()
        );

        if (reply.autoHumanHandoff) {
          action = 'save_partial_lead';
          partialReason = 'errores_repetidos_contacto_certificados';
        }
        break;
      }

      session.invalidCount = 0;
      session.data.name = contact.name;
      session.data.phone = contact.phone;
      session.data.normalizedPhone = contact.normalizedPhone || '';
      session.step = 'completed';
      action = 'save_lead';

      reply = buildResponse(
        `Gracias. Ya registré tu consulta por ${BUSINESS_CONFIG.certificate.label.toLowerCase()} ✅

Resumen:
• Tipo de local: ${session.data.localType}
• Nombre del local: ${session.data.businessName}
• Domicilio: ${session.data.address}
• Nombre: ${session.data.name}
• Teléfono: ${session.data.phone}

Un asesor de ${BUSINESS_CONFIG.companyName} te va a contactar para coordinar la visita y explicarte el proceso.`,
        completedTools(),
        { completed: true, leadSaved: true, locked: true }
      );
      break;
    }

    case 'admin_reason': {
      session.invalidCount = 0;
      session.data.adminReason = rawMessage.trim();
      session.step = 'admin_contact';

      reply = askCombinedContactMessage(
        `Entendido.

Registré tu consulta administrativa:
• Motivo: ${session.data.adminReason}`
      );
      break;
    }

    case 'admin_contact': {
      const contact = parseContactMessage(rawMessage);

      if (!contact.valid) {
        reply = invalidWithFallback(
          session,
          `No pude identificar correctamente el nombre y el teléfono.

Pasamelos juntos, por ejemplo:
Juan Pérez 3875123456`,
          basicTools()
        );

        if (reply.autoHumanHandoff) {
          action = 'save_partial_lead';
          partialReason = 'errores_repetidos_contacto_administracion';
        }
        break;
      }

      session.invalidCount = 0;
      session.data.name = contact.name;
      session.data.phone = contact.phone;
      session.data.normalizedPhone = contact.normalizedPhone || '';
      session.step = 'completed';
      action = 'save_lead';

      reply = buildResponse(
        `Gracias. Tu consulta administrativa fue registrada ✅

Resumen:
• Motivo: ${session.data.adminReason}
• Nombre: ${session.data.name}
• Teléfono: ${session.data.phone}

Un asesor la revisará y te responderá a la brevedad.`,
        completedTools(),
        { completed: true, leadSaved: true, locked: true }
      );
      break;
    }

    case 'completed': {
      if (isGreeting(msg)) {
        session.step = 'main_menu';
        session.data = {};
        session.invalidCount = 0;

        reply = buildResponse(
          `Hola 👋 Bienvenido a ${BUSINESS_CONFIG.companyName}

¿En qué podemos ayudarte?`,
          mainMenuOptions()
        );
        break;
      }

      if (msg === '1') {
        session.invalidCount = 0;
        reply = buildDirectFlowReply('servicios', session);
        break;
      }

      if (msg === '2') {
        session.invalidCount = 0;
        reply = buildDirectFlowReply('productos', session);
        break;
      }

      if (msg === '3') {
        session.invalidCount = 0;
        reply = buildDirectFlowReply('certificados', session);
        break;
      }

      if (msg === '4') {
        session.invalidCount = 0;
        reply = buildDirectFlowReply('administracion', session);
        break;
      }

      if (directIntent) {
        session.invalidCount = 0;
        reply = buildDirectFlowReply(directIntent, session);
        break;
      }

      if (isYesCommand(msg)) {
        session.step = 'main_menu';
        session.data = {};
        session.invalidCount = 0;

        reply = buildResponse(
          `Perfecto ✅

Volvimos al menú principal.

¿En qué podemos ayudarte?`,
          mainMenuOptions()
        );
        break;
      }

      /**
       * Si el usuario pide asesor estando en el cierre,
       * lo derivamos directamente y sin botones.
       */
      if (msg === 'asesor') {
        session.data.requiresHuman = true;
        session.step = 'handoff';
        action = 'save_partial_lead';
        partialReason = 'solicitud_asesor_post_consulta';

        reply = buildResponse(
          getHumanHandoffMessage(),
          [],
          { humanHandoff: true, completed: true, locked: true }
        );
        break;
      }

      if (isNoCommand(msg)) {
        session.step = 'closed';
        session.invalidCount = 0;

        reply = buildResponse(
          `Perfecto 🙌

Gracias por comunicarte con ${BUSINESS_CONFIG.companyName}.

Cuando necesites, podés escribirnos nuevamente.`,
          [
            { label: '🏠 Volver al menú', value: 'menu' }
          ],
          { completed: true, locked: true }
        );
        break;
      }

      if (isBackCommand(msg) || isResetCommand(msg)) {
        session.step = 'main_menu';
        session.data = {};
        session.invalidCount = 0;

        reply = buildResponse(
          `Volvimos al menú principal ✅

¿En qué podemos ayudarte?`,
          mainMenuOptions()
        );
        break;
      }

      reply = buildResponse(
        `La consulta ya fue registrada ✅

Si querés, podemos iniciar otra consulta o derivarte con un asesor.

¿Cómo querés continuar?`,
        completedTools(),
        { completed: true, locked: true }
      );
      break;
    }

    /**
     * Estado de handoff a asesor.
     *
     * IMPORTANTE:
     * -----------
     * Tampoco mostramos botones acá.
     * Una vez derivado, el bot ya no debe invitar a acciones
     * que después no va a poder procesar porque la sesión
     * quedó en control humano.
     */
    case 'handoff': {
      reply = buildResponse(
        `Tu caso ya fue derivado a un asesor ✅`,
        [],
        { completed: true, locked: true, humanHandoff: true }
      );
      break;
    }

    case 'closed': {
      if (isGreeting(msg)) {
        session.step = 'main_menu';
        session.data = {};
        session.invalidCount = 0;

        reply = buildResponse(
          `Hola 👋 Bienvenido a ${BUSINESS_CONFIG.companyName}

¿En qué podemos ayudarte?`,
          mainMenuOptions()
        );
        break;
      }

      if (msg === '1') {
        session.invalidCount = 0;
        reply = buildDirectFlowReply('servicios', session);
        break;
      }

      if (msg === '2') {
        session.invalidCount = 0;
        reply = buildDirectFlowReply('productos', session);
        break;
      }

      if (msg === '3') {
        session.invalidCount = 0;
        reply = buildDirectFlowReply('certificados', session);
        break;
      }

      if (msg === '4') {
        session.invalidCount = 0;
        reply = buildDirectFlowReply('administracion', session);
        break;
      }

      if (directIntent) {
        session.invalidCount = 0;
        reply = buildDirectFlowReply(directIntent, session);
        break;
      }

      if (isYesCommand(msg) || isBackCommand(msg) || isResetCommand(msg)) {
        session.step = 'main_menu';
        session.data = {};
        session.invalidCount = 0;

        reply = buildResponse(
          `Volvimos al menú principal ✅

¿En qué podemos ayudarte?`,
          mainMenuOptions()
        );
        break;
      }

      if (isNoCommand(msg)) {
        reply = buildResponse(
          `Gracias por tu consulta 🙌

Si necesitás algo más, escribí "menu" o tocá el botón de abajo.`,
          [
            { label: '🏠 Volver al menú', value: 'menu' }
          ],
          { completed: true, locked: true }
        );
        break;
      }

      reply = buildResponse(
        `Gracias por tu consulta 🙌

Si necesitás algo más, escribí "menu" o tocá el botón de abajo.`,
        [
          { label: '🏠 Volver al menú', value: 'menu' }
        ],
        { completed: true, locked: true }
      );
      break;
    }

    default: {
      session.step = 'main_menu';
      session.data = {};
      session.invalidCount = 0;

      reply = buildResponse(
        `Ocurrió un problema con la conversación. Volvimos al menú principal.`,
        mainMenuOptions()
      );
      break;
    }
  }

touchSession(session);

return {
  session,
  reply,
  action,
  partialReason
};

  } catch (err) {
    console.error('🔥 ERROR ENGINE:', err);

    return {
      session: {
        step: 'main_menu',
        data: {},
        invalidCount: 0
      },
      reply: buildResponse(
        `Ocurrió un error. Volvimos al inicio.`,
        mainMenuOptions()
      ),
      action: null
    };
  }
}

module.exports = {
  processConversation,
  getHumanHandoffMessage
};