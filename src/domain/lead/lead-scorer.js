/**
 * =========================================================
 * LEAD SCORER
 * =========================================================
 *
 * ¿Qué hace este archivo?
 * -----------------------
 * Calcula un score comercial para cada lead en función de:
 * - la intención detectada
 * - la cantidad de interacción
 * - los datos relevantes capturados
 * - algunas señales dentro del texto conversacional
 *
 * Objetivo:
 * ---------
 * Priorizar mejor los leads dentro del CRM.
 *
 * IMPORTANTE:
 * -----------
 * Este archivo usa las categorías REALES del sistema:
 * - servicios
 * - productos
 * - certificados
 * - administracion
 * - asesor
 *
 * No usar categorías viejas o inventadas como:
 * - quote_request
 * - service_request
 * - faq
 */
 
 const {
  LEAD_SCORING_CONFIG
} = require('../../config/business.config');

/**
 * Convierte cualquier valor a texto seguro en minúsculas.
 */
function normalizeText(value) {
  return String(value || '').toLowerCase().trim();
}

/**
 * Devuelve el historial de la sesión como arreglo seguro.
 */
function getHistory(sessionData) {
  if (!sessionData) {
    return [];
  }

  if (Array.isArray(sessionData.conversationHistory)) {
    return sessionData.conversationHistory;
  }

  if (Array.isArray(sessionData.history)) {
    return sessionData.history;
  }

  return [];
}

/**
 * Une todos los textos del historial en un solo string.
 *
 * Esto sirve para buscar señales débiles
 * aunque no estén guardadas de forma estructurada.
 */
function buildHistoryText(history) {
  return history
    .map((item) => normalizeText(item?.text))
    .filter(Boolean)
    .join(' ');
}

/**
 * Detecta si dentro del texto aparece algo parecido a un teléfono.
 *
 * Regla simple:
 * - bloque numérico de al menos 6 dígitos
 */
function hasPhoneLikeText(text) {
  return /\d{6,}/.test(text);
}

/**
 * Puntúa la intención comercial real del lead.
 *
 * IMPORTANTE:
 * Se usan las categorías actuales del sistema.
 */
function scoreIntent(lastIntent) {
  const intent = normalizeText(lastIntent);
  const intentScores = LEAD_SCORING_CONFIG?.intentScores || {};

  return Number(intentScores[intent] || 0);
}

/**
 * Puntúa profundidad básica de conversación.
 *
 * Supuesto comercial:
 * - más interacción suele implicar más interés
 */
function scoreHistoryLength(history) {
  let score = 0;
  const rules = LEAD_SCORING_CONFIG?.historyRules || {};

  if (history.length >= 3) {
    score += Number(rules.min3 || 0);
  }

  if (history.length >= 6) {
    score += Number(rules.min6 || 0);
  }

  return score;
}

/**
 * Puntúa los datos estructurados ya capturados por el sistema.
 *
 * Este bloque es muy importante porque indica
 * intención comercial más concreta.
 */
function scoreStructuredData(sessionData) {
  let score = 0;
  const weights = LEAD_SCORING_CONFIG?.structuredDataScores || {};

  if (sessionData.normalizedPhone || sessionData.phone) {
    score += Number(weights.phone || 0);
  }

  if (sessionData.address || sessionData.zone || sessionData.location) {
    score += Number(weights.address || 0);
  }

  if (sessionData.placeType || sessionData.localType) {
    score += Number(weights.placeType || 0);
  }

  if (sessionData.pest) {
    score += Number(weights.pest || 0);
  }

  if (sessionData.product) {
    score += Number(weights.product || 0);
  }

  if (sessionData.businessName) {
    score += Number(weights.businessName || 0);
  }

  if (sessionData.name) {
    score += Number(weights.name || 0);
  }

  return score;
}

/**
 * Puntúa señales débiles encontradas en texto libre.
 *
 * Esto ayuda cuando el dato todavía no quedó bien estructurado.
 */
function scoreFallbackText(text, sessionData) {
  let score = 0;

  const fallbackSignals = LEAD_SCORING_CONFIG?.fallbackSignals || {};
  const fallbackScores = LEAD_SCORING_CONFIG?.fallbackScores || {};

  const addressKeywords = Array.isArray(fallbackSignals.addressKeywords)
    ? fallbackSignals.addressKeywords
    : [];

  const placeKeywords = Array.isArray(fallbackSignals.placeKeywords)
    ? fallbackSignals.placeKeywords
    : [];

  const pestKeywords = Array.isArray(fallbackSignals.pestKeywords)
    ? fallbackSignals.pestKeywords
    : [];

  const urgencyKeywords = Array.isArray(fallbackSignals.urgencyKeywords)
    ? fallbackSignals.urgencyKeywords
    : [];

  if (!sessionData.normalizedPhone && !sessionData.phone && hasPhoneLikeText(text)) {
    score += Number(fallbackScores.phoneLikeText || 0);
  }

  if (!sessionData.address && !sessionData.zone && !sessionData.location) {
    if (addressKeywords.some((keyword) => text.includes(keyword))) {
      score += Number(fallbackScores.addressSignal || 0);
    }
  }

  if (!sessionData.placeType && !sessionData.localType) {
    if (placeKeywords.some((keyword) => text.includes(keyword))) {
      score += Number(fallbackScores.placeSignal || 0);
    }
  }

  if (!sessionData.pest) {
    if (pestKeywords.some((keyword) => text.includes(keyword))) {
      score += Number(fallbackScores.pestSignal || 0);
    }
  }

  if (urgencyKeywords.some((keyword) => text.includes(keyword))) {
    score += Number(fallbackScores.urgencySignal || 0);
  }

  return score;
}

/**
 * Normaliza score final entre 0 y 100.
 */
function clampScore(score) {
  if (score < 0) return 0;
  if (score > 100) return 100;
  return score;
}

/**
 * Convierte score numérico a categoría comercial.
 */
function getLeadCategory(score) {
  if (score >= 60) {
    return 'hot';
  }

  if (score >= 30) {
    return 'warm';
  }

  return 'cold';
}

/**
 * Función principal.
 *
 * Entrada:
 * - sessionData: data acumulada de la sesión
 *
 * Salida:
 * {
 *   score: number,
 *   category: 'cold' | 'warm' | 'hot'
 * }
 */
function scoreLead(sessionData = {}) {
  const history = getHistory(sessionData);
  const historyText = buildHistoryText(history);

  let score = 0;

  /**
   * 1. Intención comercial detectada
   */
  score += scoreIntent(sessionData.lastIntent);

  /**
   * 2. Profundidad de conversación
   */
  score += scoreHistoryLength(history);

  /**
   * 3. Datos estructurados
   */
  score += scoreStructuredData(sessionData);

  /**
   * 4. Señales débiles en texto libre
   */
  score += scoreFallbackText(historyText, sessionData);

  /**
   * 5. Normalización final
   */
  const normalizedScore = clampScore(score);
  const category = getLeadCategory(normalizedScore);

  return {
    score: normalizedScore,
    category
  };
}

module.exports = {
  scoreLead
};