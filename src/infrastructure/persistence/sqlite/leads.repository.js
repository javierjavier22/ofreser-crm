/**
 * ============================================
 * LEADS REPOSITORY
 * ============================================
 *
 * ¿Qué hace este archivo?
 * -----------------------
 * Maneja la persistencia de leads (potenciales clientes).
 *
 * Un lead se genera cuando:
 * - el usuario completa un flujo
 * - o la conversación deriva a humano antes de completarse
 *
 * NUEVA REGLA DE NEGOCIO:
 * -----------------------
 * Este repositorio aplica ahora la regla:
 *
 *   1 consulta = 1 lead
 *
 * Es decir:
 * - una misma sesión puede generar múltiples leads
 * - un mismo teléfono puede generar múltiples leads
 * - NO se reutiliza automáticamente el lead anterior
 *
 * Ejemplos:
 * ---------
 * - mismo usuario consulta por certificado -> lead A
 * - luego consulta por fumigación -> lead B
 * - luego consulta por productos -> lead C
 *
 * ¿Qué más hace?
 * --------------
 * - Busca leads
 * - Enriquece leads con datos de conversación
 * - Actualiza estado comercial
 * - Guarda notas internas
 *
 * Importante:
 * -----------
 * Este cambio permite historial comercial real
 * sin sobreescribir consultas anteriores del mismo cliente.
 */

const db = require('../../database/sqlite');
const { getMessagesBySessionId } = require('./messages.repository');
const { getBySessionId } = require('./sessions.repository');
const {
  PAGINATION
} = require('../../../shared/constants/app.constants');

/**
 * Devuelve fecha actual en formato ISO.
 */
function nowIso() {
  return new Date().toISOString();
}

/**
 * Genera ID único de lead.
 */
function createLeadId() {
  return `lead_${Date.now()}_${Math.floor(Math.random() * 100000)}`;
}

/**
 * Convierte 0/1 a booleano JS.
 */
function toBoolean(value) {
  return value === 1;
}

/**
 * Convierte una fila SQLite a objeto lead JS.
 */
function mapRowToLead(row) {
  if (!row) return null;

  return {
    id: row.id,

    // IDENTIDAD
    sessionId: row.session_id,
    channel: row.channel,
    externalUserId: row.external_user_id,
    source: row.source,

    // DATOS PERSONALES
    category: row.category || '',
    name: row.name || '',
    phone: row.phone || '',
    normalizedPhone: row.normalized_phone || '',

    // SERVICIOS
    pest: row.pest || '',
    placeType: row.place_type || '',
    zone: row.zone || '',

    // PRODUCTOS
    product: row.product || '',

    // CERTIFICADOS
    localType: row.local_type || '',
    businessName: row.business_name || '',
    address: row.address || '',

    // LEGACY
    certificateType: row.certificate_type || '',
    businessType: row.business_type || '',

    // ADMIN
    adminReason: row.admin_reason || '',

    internalNote: row.internal_note || '',
    status: row.status || 'nuevo',
    requiresHuman: toBoolean(row.requires_human),
    partial: toBoolean(row.partial),
    partialReason: row.partial_reason || '',
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

/**
 * Obtiene todos los leads.
 */
function getAllLeads() {
  const rows = db.prepare(`
    SELECT
      id,
      session_id,
      channel,
      external_user_id,
      source,
      category,
      name,
      phone,
      normalized_phone,
      pest,
      place_type,
      zone,
      product,
      local_type,
      business_name,
      address,
      certificate_type,
      business_type,
      admin_reason,
      internal_note,
      status,
      requires_human,
      partial,
      partial_reason,
      created_at,
      updated_at
    FROM leads
    ORDER BY datetime(created_at) DESC
  `).all();

  return rows.map(mapRowToLead);
}

/**
 * Busca un lead por ID.
 */
function getLeadById(leadId) {
  const row = db.prepare(`
    SELECT
      id,
      session_id,
      channel,
      external_user_id,
      source,
      category,
      name,
      phone,
      normalized_phone,
      pest,
      place_type,
      zone,
      product,
      local_type,
      business_name,
      address,
      certificate_type,
      business_type,
      admin_reason,
      internal_note,
      status,
      requires_human,
      partial,
      partial_reason,
      created_at,
      updated_at
    FROM leads
    WHERE id = ?
    LIMIT 1
  `).get(leadId);

  return mapRowToLead(row);
}

/**
 * Busca el lead más reciente asociado a una sesión.
 *
 * IMPORTANTE:
 * -----------
 * Desde ahora una misma sesión puede tener múltiples leads.
 * Por eso esta función devuelve el más reciente,
 * pero NO se usa para decidir si crear o no un nuevo lead.
 */
function getLeadBySessionId(sessionId) {
  const row = db.prepare(`
    SELECT
      id,
      session_id,
      channel,
      external_user_id,
      source,
      category,
      name,
      phone,
      normalized_phone,
      pest,
      place_type,
      zone,
      product,
      local_type,
      business_name,
      address,
      certificate_type,
      business_type,
      admin_reason,
      internal_note,
      status,
      requires_human,
      partial,
      partial_reason,
      created_at,
      updated_at
    FROM leads
    WHERE session_id = ?
    ORDER BY datetime(created_at) DESC
    LIMIT 1
  `).get(sessionId);

  return mapRowToLead(row);
}

/**
 * Construye un lead base a partir de sesión + data recolectada.
 */
function buildBaseLead(session, sessionData) {
  return {
    id: createLeadId(),

    // IDENTIDAD
    sessionId: session.sessionId,
    channel: session.channel || 'webchat',
    externalUserId: session.externalUserId || session.sessionId,
    source: session.channel || 'webchat',

    // DATOS PERSONALES
    category: sessionData.category || '',
    name: sessionData.name || '',
    phone: sessionData.phone || '',
    normalizedPhone: sessionData.normalizedPhone || '',

    // SERVICIOS
    pest: sessionData.pest || '',
    placeType: sessionData.placeType || '',
    zone: sessionData.zone || '',

    // PRODUCTOS
    product: sessionData.product || '',

    // CERTIFICADOS
    localType: sessionData.localType || '',
    businessName: sessionData.businessName || '',
    address: sessionData.address || '',

    // LEGACY
    certificateType: sessionData.certificateType || '',
    businessType: sessionData.businessType || '',

    // ADMIN
    adminReason: sessionData.adminReason || '',

    internalNote: '',
    createdAt: nowIso(),
    updatedAt: nowIso()
  };
}

/**
 * Actualiza un lead existente con nueva información.
 *
 * Esta función se mantiene porque el CRM todavía puede necesitar
 * actualizar leads ya creados manualmente.
 *
 * PERO:
 * -----
 * saveLead() y savePartialLead() ya NO reutilizan el lead previo.
 */
function updateLead(existingLead, sessionData, extra = {}) {
  db.prepare(`
    UPDATE leads
    SET
      category = @category,
      name = @name,
      phone = @phone,
      normalized_phone = @normalizedPhone,
      pest = @pest,
      place_type = @placeType,
      zone = @zone,
      product = @product,
      local_type = @localType,
      business_name = @businessName,
      address = @address,
      certificate_type = @certificateType,
      business_type = @businessType,
      admin_reason = @adminReason,
      status = @status,
      requires_human = @requiresHuman,
      partial = @partial,
      partial_reason = @partialReason,
      updated_at = @updatedAt
    WHERE id = @id
  `).run({
    id: existingLead.id,
    category: sessionData.category || existingLead.category,
    name: sessionData.name || existingLead.name,
    phone: sessionData.phone || existingLead.phone,
    normalizedPhone: sessionData.normalizedPhone || existingLead.normalizedPhone,
    pest: sessionData.pest || existingLead.pest,
    placeType: sessionData.placeType || existingLead.placeType,
    zone: sessionData.zone || existingLead.zone,
    product: sessionData.product || existingLead.product,
    localType: sessionData.localType || existingLead.localType,
    businessName: sessionData.businessName || existingLead.businessName,
    address: sessionData.address || existingLead.address,
    certificateType: sessionData.certificateType || existingLead.certificateType,
    businessType: sessionData.businessType || existingLead.businessType,
    adminReason: sessionData.adminReason || existingLead.adminReason,
    status: extra.status || existingLead.status,
    requiresHuman:
      typeof extra.requiresHuman === 'boolean'
        ? (extra.requiresHuman ? 1 : 0)
        : (existingLead.requiresHuman ? 1 : 0),
    partial:
      typeof extra.partial === 'boolean'
        ? (extra.partial ? 1 : 0)
        : (existingLead.partial ? 1 : 0),
    partialReason:
      extra.partialReason !== undefined
        ? extra.partialReason
        : existingLead.partialReason,
    updatedAt: nowIso()
  });

  return getLeadById(existingLead.id);
}

/**
 * Inserta un lead nuevo en la base.
 *
 * Esta función centraliza el INSERT para no repetir lógica.
 */
function insertLead(lead) {
  db.prepare(`
    INSERT INTO leads (
      id,
      session_id,
      channel,
      external_user_id,
      source,
      category,
      name,
      phone,
      normalized_phone,
      pest,
      place_type,
      zone,
      product,
      local_type,
      business_name,
      address,
      certificate_type,
      business_type,
      admin_reason,
      internal_note,
      status,
      requires_human,
      partial,
      partial_reason,
      created_at,
      updated_at
    ) VALUES (
      @id,
      @sessionId,
      @channel,
      @externalUserId,
      @source,
      @category,
      @name,
      @phone,
      @normalizedPhone,
      @pest,
      @placeType,
      @zone,
      @product,
      @localType,
      @businessName,
      @address,
      @certificateType,
      @businessType,
      @adminReason,
      @internalNote,
      @status,
      @requiresHuman,
      @partial,
      @partialReason,
      @createdAt,
      @updatedAt
    )
  `).run({
    ...lead,
    requiresHuman: lead.requiresHuman ? 1 : 0,
    partial: lead.partial ? 1 : 0
  });

  return lead;
}

/**
 * Guarda un lead completo.
 *
 * NUEVA REGLA:
 * ------------
 * SIEMPRE crea un lead nuevo.
 *
 * Ya no reutiliza automáticamente el lead anterior de la sesión.
 * Esto permite que una misma persona genere múltiples consultas
 * independientes dentro de la misma conversación.
 */
function saveLead(session, sessionData) {
  const lead = {
    ...buildBaseLead(session, sessionData),
    status: 'nuevo',
    requiresHuman: !!sessionData.requiresHuman,
    partial: false,
    partialReason: ''
  };

  return insertLead(lead);
}

/**
 * Guarda un lead parcial.
 *
 * NUEVA REGLA:
 * ------------
 * También crea un lead nuevo.
 *
 * Esto evita que un handoff humano o una consulta incompleta
 * sobreescriba otra consulta anterior del mismo usuario.
 */
function savePartialLead(session, sessionData, reason = 'handoff_humano') {
  const lead = {
    ...buildBaseLead(session, sessionData),

    category: sessionData.category || 'sin_categoria',

    status: 'seguimiento',
    requiresHuman: true,

    partial: true,
    partialReason: reason
  };

  return insertLead(lead);
}

/**
 * Enriquece un lead con datos de conversación y sesión.
 *
 * Esta función la usa el CRM para:
 * - tablero principal
 * - detalle del lead
 * - conversación
 */
function enrichLeadWithConversationData(lead) {
  const messages = getMessagesBySessionId(lead.sessionId);
  const lastMessage = messages.length
    ? messages[messages.length - 1]
    : null;

  const session = getBySessionId(lead.sessionId);

  return {
    ...lead,
    messageCount: messages.length,
    lastMessageText: lastMessage ? lastMessage.text : '',
    lastMessageSender: lastMessage ? lastMessage.senderType : '',
    lastMessageAt: lastMessage ? lastMessage.createdAt : '',

    controlMode: session?.controlMode || 'bot',
    sessionStep: session?.step || 'unknown',
    humanRequestedAt: session?.humanRequestedAt || null,
    humanTakenAt: session?.humanTakenAt || null,
    humanReleasedAt: session?.humanReleasedAt || null,
    closedAt: session?.closedAt || null,
    takenBy: session?.takenBy || null
  };
}

/**
 * Devuelve todos los leads enriquecidos.
 */
function getEnrichedLeads() {
  return getAllLeads().map(enrichLeadWithConversationData);
}

/**
 * Actualiza estado comercial.
 */
function updateLeadStatus(leadId, status) {
  const existing = getLeadById(leadId);

  if (!existing) return null;

  db.prepare(`
    UPDATE leads
    SET
      status = ?,
      updated_at = ?
    WHERE id = ?
  `).run(status, nowIso(), leadId);

  return getLeadById(leadId);
}

/**
 * Guarda o actualiza nota interna.
 */
function updateLeadNote(leadId, note) {
  const existing = getLeadById(leadId);

  if (!existing) return null;

  db.prepare(`
    UPDATE leads
    SET
      internal_note = ?,
      updated_at = ?
    WHERE id = ?
  `).run(String(note || '').trim(), nowIso(), leadId);

  const updated = getLeadById(leadId);
  return enrichLeadWithConversationData(updated);
}

/**
 * ============================================
 * PAGINACIÓN DE LEADS (P1.4)
 * ============================================
 *
 * ¿Qué hace esta función?
 * -----------------------
 * Devuelve leads paginados + total de registros.
 *
 * ¿Por qué se agrega?
 * -------------------
 * Para evitar traer todos los leads en memoria,
 * lo cual no escala bien cuando crece la base.
 *
 * Importante:
 * -----------
 * - NO reemplaza funciones existentes
 * - NO rompe el sistema actual
 * - Se usa solo si el controller la invoca
 */
function getEnrichedLeadsPaginated({
  limit = PAGINATION.LEADS_DEFAULT_LIMIT,
  offset = 0
}) {
  // 🔒 Sanitizamos valores para evitar errores o abuso
  const safeLimit = Math.min(
  Number(limit) || PAGINATION.LEADS_DEFAULT_LIMIT,
  PAGINATION.LEADS_MAX_LIMIT
);
  const safeOffset = Number(offset) || 0;

  /**
   * 1. Obtenemos TOTAL de leads (para paginador)
   */
  const totalRow = db.prepare(`
    SELECT COUNT(*) as total FROM leads
  `).get();

  const total = totalRow?.total || 0;

  /**
   * 2. Traemos SOLO la página solicitada
   */
  const rows = db.prepare(`
    SELECT
      id,
      session_id,
      channel,
      external_user_id,
      source,
      category,
      name,
      phone,
      normalized_phone,
      pest,
      place_type,
      zone,
      product,
      local_type,
      business_name,
      address,
      certificate_type,
      business_type,
      admin_reason,
      internal_note,
      status,
      requires_human,
      partial,
      partial_reason,
      created_at,
      updated_at
    FROM leads
    ORDER BY datetime(created_at) DESC
    LIMIT ? OFFSET ?
  `).all(safeLimit, safeOffset);

  /**
   * 3. Mapeamos + enriquecemos (igual que antes)
   */
  const leads = rows
    .map(mapRowToLead)
    .map(enrichLeadWithConversationData);

  /**
   * 4. Devolvemos estructura paginada
   */
  return {
    total,
    limit: safeLimit,
    offset: safeOffset,
    leads
  };
}

/**
 * Exportamos funciones públicas.
 */
module.exports = {
  getAllLeads,
  getEnrichedLeads,
  getEnrichedLeadsPaginated, // 👈 AGREGAR ESTA LÍNEA
  getLeadById,
  getLeadBySessionId,
  saveLead,
  savePartialLead,
  updateLead,
  enrichLeadWithConversationData,
  updateLeadStatus,
  updateLeadNote
};