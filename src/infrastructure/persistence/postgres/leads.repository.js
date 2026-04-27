/**
 * ============================================
 * LEADS REPOSITORY (POSTGRESQL VERSION - DEBUG)
 * ============================================
 */

const { query } = require('../../database/postgres');

function nowIso() {
  return new Date().toISOString();
}

function createLeadId() {
  return `lead_${Date.now()}_${Math.floor(Math.random() * 100000)}`;
}

async function insertLead(lead) {
  try {
    console.log('[Postgres] Intentando insertar lead:', lead.id);

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

    console.log('[Postgres] Lead insertado correctamente:', lead.id);

    return lead;

  } catch (error) {
    console.error('[Postgres ERROR] Fallo insertLead:', error.message);
    throw error;
  }
}

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

module.exports = {
  saveLead
};