/**
 * ============================================
 * CRM CONTROLLER
 * ============================================
 *
 * ¿Qué hace este archivo?
 * -----------------------
 * Este archivo expone endpoints HTTP para el CRM interno.
 *
 * Permite que el frontend del CRM consulte y modifique
 * la información comercial generada por el bot.
 *
 * Funciones principales:
 * - Obtener todos los leads.
 * - Obtener todos los mensajes.
 * - Obtener mensajes por sesión.
 * - Obtener detalle de un lead + conversación.
 * - Cambiar estado comercial de un lead.
 * - Guardar nota interna de un lead.
 * - Cambiar control conversacional de una sesión:
 *   bot / human / closed
 * - Enviar mensajes humanos manuales desde el CRM
 *
 * ¿Qué NO hace?
 * -------------
 * - No contiene lógica de negocio del bot.
 * - No decide respuestas automáticas del usuario.
 * - No guarda directamente en archivos JSON:
 *   delega esa responsabilidad a los repositories.
 *
 * Rol dentro del sistema:
 * -----------------------
 * Este archivo pertenece a la capa HTTP / controllers.
 *
 * Actúa como intermediario entre:
 * - el frontend del CRM
 * - y la capa de persistencia / canales
 *
 * En resumen:
 * -----------
 * Este archivo permite ver y gestionar leads
 * desde el CRM interno.
 */

const {
  getEnrichedLeads,
  getLeadById,
  enrichLeadWithConversationData,
  updateLeadStatus,
  updateLeadNote
} = require('../../persistence/sqlite/leads.repository');

const {
  getAllMessages,
  getMessagesBySessionId,
  saveMessage
} = require('../../persistence/sqlite/messages.repository');

const {
  getBySessionId,
  upsertSession
} = require('../../persistence/sqlite/sessions.repository');

const {
  sendWhatsAppText
} = require('../../channels/whatsapp/whatsapp.client');

const {
  saveAuditLog
} = require('../../persistence/sqlite/audit.repository');

/**
 * Devuelve todos los leads enriquecidos.
 *
 * "Enriquecidos" significa que además de los datos básicos del lead,
 * vienen con información adicional de conversación, como:
 * - cantidad de mensajes
 * - último mensaje
 * - fecha del último mensaje
 * - controlMode de la sesión
 */
function getLeads(req, res) {
  const leads = getEnrichedLeads();
  res.json(leads);
}

/**
 * Devuelve todos los mensajes registrados en el sistema.
 *
 * Esto sirve principalmente para:
 * - debugging
 * - revisión general
 * - diagnóstico técnico
 *
 * Endpoint relacionado:
 * GET /messages
 */
function getMessages(req, res) {
  const messages = getAllMessages();
  res.json(messages);
}

/**
 * Devuelve todos los mensajes de una sesión específica.
 *
 * La sesión identifica una conversación completa entre
 * un usuario y el bot.
 *
 * Endpoint relacionado:
 * GET /messages/:sessionId
 */
function getMessagesBySession(req, res) {
  const { sessionId } = req.params;

  const messages = getMessagesBySessionId(sessionId);

  res.json(messages);
}

/**
 * Devuelve el detalle de un lead específico
 * junto con toda su conversación.
 *
 * Este endpoint es muy útil para el modal/drawer del CRM,
 * porque permite mostrar:
 * - datos del lead
 * - historial completo del chat
 * - datos de la sesión operativa
 *
 * Si el lead no existe, devuelve 404.
 *
 * Endpoint relacionado:
 * GET /leads/:id/messages
 */
function getLeadMessages(req, res) {
  const leadId = req.params.id;

  // Buscamos el lead por ID
  const lead = getLeadById(leadId);

  // Si no existe, respondemos con error 404
  if (!lead) {
    return res.status(404).json({
      error: 'Lead no encontrado'
    });
  }

  // Buscamos todos los mensajes asociados a la sesión del lead
  const messages = getMessagesBySessionId(lead.sessionId);

  // Buscamos también la sesión
  const session = getBySessionId(lead.sessionId);

  // Devolvemos:
  // - ok: true
  // - lead enriquecido
  // - historial de mensajes
  // - sesión operativa
  res.json({
    ok: true,
    lead: enrichLeadWithConversationData(lead),
    messages,
    session: session || null
  });
}

/**
 * Actualiza el estado comercial de un lead.
 *
 * Estados válidos actualmente:
 * - nuevo
 * - calificado
 * - seguimiento
 * - cerrado
 *
 * Si el estado no es válido, devuelve 400.
 * Si el lead no existe, devuelve 404.
 *
 * Endpoint relacionado:
 * PATCH /leads/:id/status
 */
function patchLeadStatus(req, res) {
  const leadId = req.params.id;
  const { status } = req.body;

  const validStatuses = ['nuevo', 'calificado', 'seguimiento', 'cerrado'];

  if (!validStatuses.includes(status)) {
    return res.status(400).json({
      error: 'Estado inválido'
    });
  }

  /**
   * Leemos el lead actual antes de modificarlo
   * para poder auditar from -> to.
   */
  const currentLead = getLeadById(leadId);

  if (!currentLead) {
    return res.status(404).json({
      error: 'Lead no encontrado'
    });
  }

  const previousStatus = currentLead.status || 'nuevo';

  const updated = updateLeadStatus(leadId, status);

  if (!updated) {
    return res.status(404).json({
      error: 'Lead no encontrado'
    });
  }

  /**
   * Registramos auditoría del movimiento comercial.
   */
  saveAuditLog({
    action: 'LEAD_STATUS_CHANGED',
    entityType: 'lead',
    entityId: leadId,
    req,
    details: {
      from: previousStatus,
      to: status,
      leadName: updated.name || '',
      phone: updated.phone || '',
      category: updated.category || ''
    }
  });

  res.json({
    ok: true,
    lead: updated
  });
}

/**
 * Guarda o actualiza la nota interna de un lead.
 *
 * Esta nota es solo para uso interno del equipo.
 * El cliente nunca la ve.
 *
 * Validaciones:
 * - note debe ser string
 * - el lead debe existir
 *
 * Endpoint relacionado:
 * PATCH /leads/:id/note
 */
function patchLeadNote(req, res) {
  const leadId = req.params.id;
  const { note } = req.body;
  const MAX_NOTE_LENGTH = 2000;

  if (typeof note !== 'string') {
    return res.status(400).json({
      error: 'La nota debe ser texto'
    });
  }

  const nextNote = String(note || '').trim();

  if (nextNote.length > MAX_NOTE_LENGTH) {
    return res.status(400).json({
      error: `La nota no puede superar los ${MAX_NOTE_LENGTH} caracteres`
    });
  }

  /**
   * Leemos el lead actual antes del cambio
   * para poder auditar.
   */
  const currentLead = getLeadById(leadId);

  if (!currentLead) {
    return res.status(404).json({
      error: 'Lead no encontrado'
    });
  }

  const previousNote = String(currentLead.internalNote || '');
  
  const updated = updateLeadNote(leadId, note);

  if (!updated) {
    return res.status(404).json({
      error: 'Lead no encontrado'
    });
  }

  /**
   * Registramos auditoría de nota interna.
   *
   * Guardamos solo previews para no hacer la auditoría
   * innecesariamente pesada.
   */
  saveAuditLog({
    action: 'LEAD_NOTE_UPDATED',
    entityType: 'lead',
    entityId: leadId,
    req,
    details: {
      previousLength: previousNote.length,
      newLength: nextNote.length,
      previousPreview: previousNote.slice(0, 120),
      newPreview: nextNote.slice(0, 120),
      leadName: updated.name || '',
      phone: updated.phone || ''
    }
  });

  res.json({
    ok: true,
    lead: updated
  });
}

/**
 * Cambia el modo de control de una sesión conversacional.
 *
 * Valores válidos:
 * - bot
 * - human
 * - closed
 *
 * Esto permite que el CRM:
 * - tome la conversación como humano
 * - devuelva la conversación al bot
 * - cierre la conversación
 *
 * Endpoint relacionado:
 * PATCH /sessions/:sessionId/control
 */
function patchSessionControl(req, res) {
  const sessionId = req.params.sessionId;
  const { controlMode, takenBy } = req.body;

  const validModes = ['bot', 'human', 'closed'];

  if (!validModes.includes(controlMode)) {
    return res.status(400).json({
      error: 'controlMode inválido'
    });
  }

  const session = getBySessionId(sessionId);

  if (!session) {
    return res.status(404).json({
      error: 'Sesión no encontrada'
    });
  }

  /**
   * Guardamos el modo anterior para auditoría.
   */
  const previousMode = session.controlMode || 'bot';

  if (controlMode === 'human') {
    session.controlMode = 'human';
    session.step = 'handoff';
    session.data = session.data || {};
    session.data.requiresHuman = true;
    session.humanRequestedAt = session.humanRequestedAt || new Date().toISOString();
    session.humanTakenAt = new Date().toISOString();
    session.takenBy = String(takenBy || 'CRM');
  }

  if (controlMode === 'bot') {
    session.controlMode = 'bot';
    session.step = 'main_menu';
    session.invalidCount = 0;
    session.humanReleasedAt = new Date().toISOString();
  }

  if (controlMode === 'closed') {
    session.controlMode = 'closed';
    session.step = 'closed';
    session.closedAt = new Date().toISOString();
  }

  const updatedSession = upsertSession(session);

  /**
   * Acción de auditoría según destino.
   */
  let action = 'SESSION_CONTROL_CHANGED';

  if (controlMode === 'human') {
    action = 'SESSION_TAKEN_BY_HUMAN';
  } else if (controlMode === 'bot') {
    action = 'SESSION_RETURNED_TO_BOT';
  } else if (controlMode === 'closed') {
    action = 'SESSION_CLOSED';
  }

  saveAuditLog({
    action,
    entityType: 'session',
    entityId: sessionId,
    req,
    details: {
      from: previousMode,
      to: controlMode,
      step: updatedSession.step || '',
      takenBy: updatedSession.takenBy || null,
      externalUserId: updatedSession.externalUserId || null,
      channel: updatedSession.channel || ''
    }
  });

  return res.json({
    ok: true,
    session: updatedSession
  });
}

/**
 * Envía un mensaje manual del asesor al cliente.
 *
 * REGLA DE NEGOCIO:
 * -----------------
 * Solo se permite enviar si la conversación está en modo HUMANO.
 *
 * Esto evita mezclar:
 * - respuestas automáticas del bot
 * - respuestas del operador humano
 *
 * Endpoint relacionado:
 * POST /sessions/:sessionId/human-message
 */
async function postHumanMessage(req, res) {
  const sessionId = req.params.sessionId;
  const { text } = req.body;
  const MAX_HUMAN_MESSAGE_LENGTH = 2000;

  if (typeof text !== 'string' || !text.trim()) {
    return res.status(400).json({
      error: 'El mensaje es obligatorio'
    });
  }

  const cleanText = String(text || '').trim();

  if (cleanText.length > MAX_HUMAN_MESSAGE_LENGTH) {
    return res.status(400).json({
      error: `El mensaje no puede superar los ${MAX_HUMAN_MESSAGE_LENGTH} caracteres`
    });
  }

  const session = getBySessionId(sessionId);

  if (!session) {
    return res.status(404).json({
      error: 'Sesión no encontrada'
    });
  }

  if (session.controlMode !== 'human') {
    return res.status(400).json({
      error: 'Solo se puede enviar mensaje manual cuando la conversación está en modo HUMANO'
    });
  }

  if (session.channel !== 'whatsapp') {
    return res.status(400).json({
      error: 'El envío manual desde CRM solo está habilitado para WhatsApp'
    });
  }

  const to = session.externalUserId;

  if (!to) {
    return res.status(400).json({
      error: 'La sesión no tiene externalUserId para envío'
    });
  }

  try {
    /**
     * 1. Enviamos mensaje real al proveedor.
     */
    const providerResponse = await sendWhatsAppText(to, cleanText);

    /**
     * 2. Guardamos mensaje en historial como humano.
     */
    const savedMessage = saveMessage({
      sessionId: session.sessionId,
      channel: session.channel,
      externalUserId: session.externalUserId,
      direction: 'outbound',
      senderType: 'human',
      text: cleanText,
      externalMessageId: null,
      rawPayload: providerResponse || null
    });

    /**
     * 3. Registramos auditoría del envío manual.
     */
    saveAuditLog({
      action: 'HUMAN_MESSAGE_SENT',
      entityType: 'message',
      entityId: savedMessage.id,
      req,
      details: {
        sessionId: session.sessionId,
        channel: session.channel,
        to: session.externalUserId,
        textPreview: cleanText.slice(0, 160),
        textLength: cleanText.length
      }
    });

    return res.json({
      ok: true,
      message: savedMessage
    });

  } catch (error) {
    console.error('❌ Error enviando mensaje humano desde CRM:', error.response?.data || error.message);

    return res.status(500).json({
      error: 'No se pudo enviar el mensaje humano'
    });
  }
}

/**
 * Exportamos las funciones del controller
 * para que app.js pueda conectarlas a rutas HTTP.
 */
module.exports = {
  getLeads,
  getMessages,
  getMessagesBySession,
  getLeadMessages,
  patchLeadStatus,
  patchLeadNote,
  patchSessionControl,
  postHumanMessage
};