/**
 * =========================================================
 * OFRESER CRM - CAPA DE API
 * =========================================================
 *
 * Responsabilidad:
 * - comunicación con backend
 * - manejo de headers
 * - auth token automático
 *
 * NO contiene lógica de UI
 */

const API_BASE = window.location.origin;

/**
 * Wrapper PRO de fetch con autenticación automática
 */
async function crmFetch(url, options = {}) {
  const token = localStorage.getItem('ofreser_crm_token');

  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {})
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  return fetch(url, {
    ...options,
    headers
  });
}

/**
 * Obtiene conversación de un lead
 */
async function fetchLeadConversation(leadId) {
  const res = await crmFetch(`${API_BASE}/leads/${leadId}/messages`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return await res.json();
}