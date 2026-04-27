/**
 * ============================================
 * LEADS REPOSITORY (POSTGRESQL VERSION)
 * ============================================
 *
 * Propósito:
 * ----------
 * Versión PostgreSQL del repositorio de leads.
 *
 * IMPORTANTE:
 * -----------
 * - NO reemplaza SQLite
 * - NO está conectado aún al sistema
 * - Se usa solo para pruebas controladas
 *
 * Estrategia:
 * -----------
 * Migración progresiva:
 * 1. Crear versión PostgreSQL
 * 2. Testear en paralelo
 * 3. Recién después integrar
 */

const { query } = require('../../database/postgres');

/**
 * Devuelve fecha ISO actual
 */
function nowIso() {
  return new Date().toISOString();
}

/**
 * Genera ID único de lead
 */
function createLeadId() {
  return `lead_${Date.now()}_${Math.floor(Math.random() * 100000)}`;
}

/**
 * Convierte fila PostgreSQL a objeto JS
 */
function mapRowToLead(row) {
  if (!row) return null;

  return {
    id: row.id,
    sessionId: row.session_id,
    channel: row.channel,
    externalUserId: row.external_user_id,
    source: row.source,

    category: row.category || '',
    name: row.name || '',
    phone: row.phone || '',
    normalizedPhone: row.normalized_phone || '',

    pest: row.pest || '',
    placeType: row.place_type || '',
    zone: row.zone || '',
    product: row.product || '',

    localType: row.local_type || '',
    businessName: row.business_name || '',
    address: row.address || '',

    certificateType: row.certificate_type || '',
    businessType: row.business_type || '',

    adminReason: row.admin_reason || '',

    internalNote: row.internal_note || '',
    status: row.status || 'nuevo',
    requiresHuman: row.requires_human,
    partial: row.partial,
    partialReason: row.partial_reason || '',

    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

/**
 * Inserta un lead en PostgreSQL
 */
async function insertLead(lead) {
  const sql = `
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
      $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,
      $11,$12,$13,$14,$15,$16,$17,$18,
      $19,$20,$21,$22,$23,$24,$25,$26
    )
  `;

  const values = [
    lead.id,
    lead.sessionId,
    lead.channel,
    lead.externalUserId,
    lead.source,
    lead.category,
    lead.name,
    lead.phone,
    lead.normalizedPhone,
    lead.pest,
    lead.placeType,
    lead.zone,
    lead.product,
    lead.localType,
    lead.businessName,
    lead.address,
    lead.certificateType,
    lead.businessType,
    lead.adminReason,
    lead.internalNote,
    lead.status,
    lead.requiresHuman,
    lead.partial,
    lead.partialReason,
    lead.createdAt,
    lead.updatedAt
  ];

  await query(sql, values);

  return lead;
}

/**
 * Guarda lead completo
 */
async function saveLead(session, sessionData) {
  const lead = {
    id: createLeadId(),
    sessionId: session.sessionId,
    channel: session.channel || 'webchat',
    externalUserId: session.externalUserId || session.sessionId,
    source: session.channel || 'webchat',

    category: sessionData.category || '',
    name: sessionData.name || '',
    phone: sessionData.phone || '',
    normalizedPhone: sessionData.normalizedPhone || '',

    pest: sessionData.pest || '',
    placeType: sessionData.placeType || '',
    zone: sessionData.zone || '',
    product: sessionData.product || '',

    localType: sessionData.localType || '',
    businessName: sessionData.businessName || '',
    address: sessionData.address || '',

    certificateType: sessionData.certificateType || '',
    businessType: sessionData.businessType || '',

    adminReason: sessionData.adminReason || '',

    internalNote: '',
    status: 'nuevo',
    requiresHuman: !!sessionData.requiresHuman,
    partial: false,
    partialReason: '',

    createdAt: nowIso(),
    updatedAt: nowIso()
  };

  return insertLead(lead);
}

/**
 * Exportamos funciones
 */
module.exports = {
  saveLead
};