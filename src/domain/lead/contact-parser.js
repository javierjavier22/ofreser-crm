/**
 * ============================================
 * CONTACT PARSER (detección automática PRO)
 * ============================================
 *
 * Extrae datos útiles desde texto libre:
 * - nombre
 * - tipo de plaga
 * - tipo de lugar
 * - ubicación simple
 *
 * IMPORTANTE:
 * -----------
 * Este parser NO reemplaza al parser de contacto final
 * de nombre + teléfono.
 *
 * Su objetivo es enriquecer la sesión en mensajes libres
 * para evitar preguntas repetidas.
 */

function parseContactData(message = '') {
  const text = String(message || '').toLowerCase().trim();

  const result = {};

  /**
   * ============================================
   * NOMBRE
   * ============================================
   *
   * Ejemplo:
   * - "soy javier"
   */
  const nameMatch = text.match(/\bsoy\s+([a-záéíóúñ]+)/i);
  if (nameMatch) {
    result.name = capitalize(nameMatch[1]);
  }

  /**
   * ============================================
   * PLAGA
   * ============================================
   */
  const pestEntries = [
    { keywords: ['cucaracha', 'cucarachas'], value: 'cucarachas' },
    { keywords: ['rata', 'ratas', 'raton', 'ratones'], value: 'roedores' },
    { keywords: ['hormiga', 'hormigas'], value: 'hormigas' },
    { keywords: ['mosquito', 'mosquitos'], value: 'mosquitos' },
    { keywords: ['alacran', 'alacranes', 'alacrán', 'alacranes'], value: 'alacranes' },
    { keywords: ['arana', 'aranas', 'araña', 'arañas'], value: 'arañas' }
  ];

  for (const entry of pestEntries) {
    if (entry.keywords.some(keyword => text.includes(keyword))) {
      result.pest = entry.value;
      break;
    }
  }

  /**
   * ============================================
   * TIPO DE LUGAR
   * ============================================
   *
   * Estos valores se alinean con el motor conversacional:
   * - casa
   * - departamento
   * - comercio
   * - oficina
   * - industria
   * - galpon
   */
  if (
    text.includes('mi casa') ||
    text.includes('en casa') ||
    /\bcasa\b/.test(text) ||
    /\bhogar\b/.test(text) ||
    /\bvivienda\b/.test(text)
  ) {
    result.placeType = 'casa';
  } else if (
    /\bdepartamento\b/.test(text) ||
    /\bdepto\b/.test(text) ||
    /\bdepa\b/.test(text)
  ) {
    result.placeType = 'departamento';
  } else if (
    /\bcomercio\b/.test(text) ||
    /\blocal\b/.test(text) ||
    /\bnegocio\b/.test(text)
  ) {
    result.placeType = 'comercio';
  } else if (
    /\boficina\b/.test(text)
  ) {
    result.placeType = 'oficina';
  } else if (
    /\bindustria\b/.test(text) ||
    /\bfabrica\b/.test(text) ||
    /\bfábrica\b/.test(text)
  ) {
    result.placeType = 'industria';
  } else if (
    /\bgalpon\b/.test(text) ||
    /\bgalpón\b/.test(text)
  ) {
    result.placeType = 'galpon';
  }

  /**
   * ============================================
   * UBICACIÓN / ZONA SIMPLE
   * ============================================
   *
   * Intentamos detectar frases tipo:
   * - en el centro
   * - en zona sur
   * - por tres cerritos
   *
   * Pero evitamos tomar "en mi casa" como ubicación.
   */
  const locationPatterns = [
    /\ben el ([a-záéíóúñ\s]+)$/i,
    /\ben la ([a-záéíóúñ\s]+)$/i,
    /\bpor ([a-záéíóúñ\s]+)$/i,
    /\bzona ([a-záéíóúñ\s]+)$/i
  ];

  for (const pattern of locationPatterns) {
    const match = text.match(pattern);

    if (match) {
      const candidate = match[1].trim().toLowerCase();

      const forbidden = [
        'casa',
        'hogar',
        'vivienda',
        'departamento',
        'depto',
        'depa',
        'comercio',
        'local',
        'negocio',
        'oficina',
        'industria',
        'fabrica',
        'fábrica',
        'galpon',
        'galpón'
      ];

      if (!forbidden.includes(candidate)) {
        result.location = capitalizeWords(candidate);
        break;
      }
    }
  }

  return result;
}

function capitalize(text) {
  const value = String(text || '').trim();
  if (!value) return '';
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function capitalizeWords(text) {
  return String(text || '')
    .trim()
    .split(/\s+/)
    .map(word => capitalize(word))
    .join(' ');
}

module.exports = {
  parseContactData
};