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
  if (!sessionData || !Array.isArray(sessionData.history)) {
    return [];
  }

  return sessionData.history;
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

  switch (intent) {
    case 'servicios':
      return 40;

    case 'certificados':
      return 35;

    case 'productos':
      return 25;

    case 'administracion':
      return 15;

    case 'asesor':
      return 20;

    default:
      return 0;
  }
}

/**
 * Puntúa profundidad básica de conversación.
 *
 * Supuesto comercial:
 * - más interacción suele implicar más interés
 */
function scoreHistoryLength(history) {
  let score = 0;

  if (history.length >= 3) {
    score += 10;
  }

  if (history.length >= 6) {
    score += 10;
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

  if (sessionData.normalizedPhone || sessionData.phone) {
    score += 20;
  }

  if (sessionData.address || sessionData.zone || sessionData.location) {
    score += 15;
  }

  if (sessionData.placeType || sessionData.localType) {
    score += 10;
  }

  if (sessionData.pest) {
    score += 15;
  }

  if (sessionData.product) {
    score += 10;
  }

  if (sessionData.businessName) {
    score += 10;
  }

  if (sessionData.name) {
    score += 10;
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

  /**
   * Solo sumamos si NO tenemos ya teléfono estructurado.
   * Evita duplicar demasiado el score por el mismo dato.
   */
  if (!sessionData.normalizedPhone && !sessionData.phone && hasPhoneLikeText(text)) {
    score += 10;
  }

  /**
   * Señales de dirección / ubicación.
   */
  if (!sessionData.address && !sessionData.zone && !sessionData.location) {
    if (
      text.includes('domicilio') ||
      text.includes('direccion') ||
      text.includes('dirección') ||
      text.includes('zona') ||
      text.includes('barrio') ||
      text.includes('calle')
    ) {
      score += 8;
    }
  }

  /**
   * Señales de tipo de lugar.
   */
  if (!sessionData.placeType && !sessionData.localType) {
    if (
      text.includes('casa') ||
      text.includes('hogar') ||
      text.includes('departamento') ||
      text.includes('local') ||
      text.includes('negocio') ||
      text.includes('comercio')
    ) {
      score += 8;
    }
  }

  /**
   * Señales de plaga.
   */
  if (!sessionData.pest) {
    if (
      text.includes('cucaracha') ||
      text.includes('cucarachas') ||
      text.includes('rata') ||
      text.includes('ratas') ||
      text.includes('raton') ||
      text.includes('ratones') ||
      text.includes('ratón') ||
      text.includes('ratones') ||
      text.includes('hormiga') ||
      text.includes('hormigas') ||
      text.includes('alacran') ||
      text.includes('alacrán') ||
      text.includes('alacranes') ||
      text.includes('murcielago') ||
      text.includes('murciélago') ||
      text.includes('plaga') ||
      text.includes('plagas')
    ) {
      score += 10;
    }
  }

  /**
   * Señales de urgencia o contacto humano.
   */
  if (
    text.includes('urgente') ||
    text.includes('asesor') ||
    text.includes('persona') ||
    text.includes('humano')
  ) {
    score += 5;
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