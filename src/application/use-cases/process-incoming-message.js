/**
 * ============================================
 * PROCESS INCOMING MESSAGE
 * ============================================
 *
 * ¿Qué hace este archivo?
 * -----------------------
 * Este archivo coordina el procesamiento completo
 * de un mensaje entrante del usuario.
 *
 * Es uno de los puntos más importantes del sistema,
 * porque conecta:
 * - la sesión
 * - el historial de mensajes
 * - el motor conversacional
 * - la creación de leads
 *
 * Responsabilidades principales:
 * ------------------------------
 * 1. Buscar o crear la sesión del usuario.
 * 2. Guardar el mensaje entrante.
 * 3. Ejecutar el motor conversacional.
 * 4. Guardar la sesión actualizada.
 * 5. Crear lead si corresponde.
 * 6. Guardar la respuesta del bot.
 * 7. Persistir handoff humano si corresponde.
 * 8. Devolver un resultado uniforme al controller.
 *
 * ¿Qué NO hace?
 * -------------
 * - No define la lógica del flujo conversacional.
 * - No decide textos del bot.
 * - No habla directo con WhatsApp o con el frontend.
 *
 * Rol dentro del sistema:
 * -----------------------
 * Este archivo pertenece a la capa Application / Use Cases.
 *
 * En resumen:
 * -----------
 * Recibe un mensaje, coordina todo el procesamiento,
 * y devuelve la respuesta final lista para el canal.
 */

const { processConversation } = require('../../domain/conversation/conversation-engine');
const { detectIntent } = require('../../domain/conversation/detect-intent');
const { scoreLead } = require('../../domain/lead/lead-scorer');

const {
  createNewSession,
  getBySessionId,
  upsertSession,
  markSessionAsHuman,
  isSessionHumanControlled
} = require('../../infrastructure/persistence/sqlite/sessions.repository');

const {
  saveMessage
} = require('../../infrastructure/persistence/sqlite/messages.repository');

const {
  saveLead,
  savePartialLead
} = require('../../infrastructure/persistence/sqlite/leads.repository');

/**
 * Procesa un mensaje entrante sin importar el canal.
 *
 * Parámetros:
 * -----------
 * - sessionId: identifica la conversación
 * - message: texto recibido del usuario
 * - channel: webchat / whatsapp
 * - externalUserId: identificador externo del usuario
 *
 * Devuelve:
 * ---------
 * Un objeto uniforme con:
 * - estado OK
 * - sesión actualizada
 * - lead guardado si corresponde
 * - reply del bot
 */
function processIncomingMessage({
  sessionId,
  message,
  channel = 'webchat',
  externalUserId = null
}) {

  /**
   * 1. Buscamos la sesión actual.
   *
   * Si no existe, significa que es la primera vez
   * que este usuario escribe en esta conversación.
   */
  let session = getBySessionId(sessionId);

  /**
   * 2. Si la sesión no existe, la creamos.
   *
   * Esto inicializa:
   * - step = welcome
   * - data vacía
   * - invalidCount = 0
   */
  if (!session) {
    session = createNewSession({
      sessionId,
      channel,
      externalUserId: externalUserId || sessionId
    });

    // Guardamos la nueva sesión recién creada
    upsertSession(session);
  }

  /**
   * 3. Guardamos el mensaje entrante del usuario
   * en el historial conversacional.
   *
   * Esto sirve para:
   * - auditoría
   * - CRM
   * - reconstrucción del chat
   */
  saveMessage({
    sessionId: session.sessionId,
    channel: session.channel,
    externalUserId: session.externalUserId,
    direction: 'inbound',
    senderType: 'user',
    text: message,
    externalMessageId: null,
    rawPayload: null
  });
  
    /**
   * 3B. Enriquecemos contexto conversacional liviano.
   *
   * Guardamos:
   * - último mensaje del usuario
   * - historial resumido de conversación
   *
   * Importante:
   * - no cambiamos tablas
   * - esto vive dentro de session.data
   * - mantenemos máximo 10 entradas para no crecer infinito
   */
  if (!session.data) {
    session.data = {};
  }

  session.data.lastUserMessage = message;

  if (!Array.isArray(session.data.conversationHistory)) {
    session.data.conversationHistory = [];
  }

  session.data.conversationHistory.push({
    from: 'user',
    text: message,
    timestamp: new Date().toISOString()
  });

  if (session.data.conversationHistory.length > 10) {
    session.data.conversationHistory = session.data.conversationHistory.slice(-10);
  }
  
    /**
   * 4. Si la sesión ya está bajo control humano,
   * NO ejecutamos el motor conversacional.
   *
   * En su lugar:
   * - enviamos un aviso UNA sola vez
   * - luego dejamos de responder para no interferir
   *   con la atención humana real
   */
  if (isSessionHumanControlled(session.sessionId)) {
    /**
     * Si todavía no se envió el aviso humano,
     * lo generamos y lo dejamos persistido.
     */
    if (!session.humanNoticeSentAt) {
      const humanNoticeMessage =
        'Tu consulta fue derivada a un asesor. En breve te responderemos por este medio.';

      /**
       * Guardamos timestamp del aviso único
       * para que no se repita en próximos mensajes.
       */
      session.humanNoticeSentAt = new Date().toISOString();
      const persistedHumanSession = upsertSession(session);

      /**
       * Guardamos también el mensaje saliente en historial,
       * así el CRM ve la conversación completa.
       */
      saveMessage({
        sessionId: persistedHumanSession.sessionId,
        channel: persistedHumanSession.channel,
        externalUserId: persistedHumanSession.externalUserId,
        direction: 'outbound',
        senderType: 'bot',
        text: humanNoticeMessage,
        externalMessageId: null,
        rawPayload: null
      });

      return {
        ok: true,
        sessionId: persistedHumanSession.sessionId,
        session: persistedHumanSession,
        savedLead: null,
        reply: {
          message: humanNoticeMessage,
          humanHandoff: true,
          locked: true,
          completed: true
        }
      };
    }

    /**
     * Si el aviso ya fue enviado antes,
     * directamente no respondemos nada.
     */
    return {
      ok: true,
      sessionId: session.sessionId,
      session,
      savedLead: null,
      reply: null
    };
  }

/**
 * ============================================
 * DETECCIÓN DE INTENCIÓN
 * ============================================
 */
const intent = detectIntent(message);

/**
 * Inicializar sesión si no existe
 */
if (!session.data) {
  session.data = {};
}

/**
 * Guardamos intención en sesión
 */
session.data.lastIntent = intent;

/**
 * ============================================
 * SCORING DEL LEAD
 * ============================================
 */
const leadAnalysis = scoreLead(session.data);

session.data.leadScore = leadAnalysis.score;
session.data.leadCategory = leadAnalysis.category;

/**
 * Guardar sesión
 */
session = upsertSession(session);
  /**
   * 4. Ejecutamos el motor conversacional.
   *
   * Acá es donde se decide:
   * - qué responder
   * - si cambia el step
   * - si se debe guardar un lead
   * - si hay que derivar a un asesor
   */
  const result = processConversation({
    session,
    rawMessage: message
  });

  /**
   * 5. Guardamos la sesión actualizada que devuelve el motor.
   *
   * Esto es crítico para mantener el contexto
   * de la conversación entre mensajes.
   */
  let persistedSession = upsertSession(result.session);

  /**
   * 6. Si la respuesta del motor indica handoff humano,
   * persistimos también el modo humano real en la sesión.
   *
   * IMPORTANTE:
   * -----------
   * Esto hace que:
   * - el bot quede silenciado en próximos mensajes
   * - el estado sobreviva reinicios del backend
   * - el CRM pueda reconocer que la conversación
   *   pasó a atención humana
   */
  if (result.reply && result.reply.humanHandoff) {
    persistedSession = markSessionAsHuman(result.session.sessionId);
  }

  /**
   * 7. Variable para guardar el lead si el flujo lo requiere.
   */
  let savedLead = null;

  /**
   * 8. Si el motor indicó "save_lead",
   * guardamos un lead completo.
   */
  if (result.action === 'save_lead') {
    savedLead = saveLead(persistedSession, persistedSession.data);
  }

  /**
   * 9. Si el motor indicó "save_partial_lead",
   * guardamos un lead parcial.
   *
   * Esto suele pasar cuando:
   * - el usuario pide un asesor
   * - el sistema deriva automáticamente por errores repetidos
   * - la conversación no se completa del todo
   */
  if (result.action === 'save_partial_lead') {
    savedLead = savePartialLead(
      persistedSession,
      persistedSession.data,
      result.partialReason || 'handoff_humano'
    );
  }

  /**
   * 10. Si el bot generó una respuesta de texto,
   * la guardamos también en el historial.
   *
   * Esto permite que el CRM pueda ver la conversación completa
   * de ambos lados: usuario + bot.
   */
  if (result.reply && result.reply.message) {
    /**
     * Guardamos también contexto conversacional del lado bot.
     */
    if (!persistedSession.data) {
      persistedSession.data = {};
    }

    persistedSession.data.lastBotMessage = result.reply.message;

    if (!Array.isArray(persistedSession.data.conversationHistory)) {
      persistedSession.data.conversationHistory = [];
    }

    persistedSession.data.conversationHistory.push({
      from: 'bot',
      text: result.reply.message,
      timestamp: new Date().toISOString()
    });

    if (persistedSession.data.conversationHistory.length > 10) {
      persistedSession.data.conversationHistory =
        persistedSession.data.conversationHistory.slice(-10);
    }

    /**
     * Persistimos nuevamente la sesión ya enriquecida.
     */
    persistedSession = upsertSession(persistedSession);

    /**
     * Guardamos la respuesta del bot en historial de mensajes.
     */
    saveMessage({
      sessionId: persistedSession.sessionId,
      channel: persistedSession.channel,
      externalUserId: persistedSession.externalUserId,
      direction: 'outbound',
      senderType: 'bot',
      text: result.reply.message,
      externalMessageId: null,
      rawPayload: null
    });
  }

  /**
   * 11. Devolvemos la respuesta final en formato uniforme.
   *
   * Este formato lo consumen los controllers
   * (webchat.controller, whatsapp-webhook.controller, etc.)
   */
  return {
    ok: true,
    sessionId: persistedSession.sessionId,
    session: persistedSession,
    savedLead,
    reply: result.reply
  };
}

/**
 * Exportamos el caso de uso
 * para que otros módulos lo llamen.
 */
module.exports = {
  processIncomingMessage
};