/**
 * ============================================
 * CONTACT PARSER (detección automática PRO)
 * ============================================
 *
 * Detecta:
 * - nombre
 * - teléfono
 * - plaga
 * - tipo de lugar
 * - ubicación simple
 *
 * IMPORTANTE:
 * -----------
 * Este parser NO reemplaza al parser final de contacto.
 * Solo enriquece session.data con datos detectados
 * desde texto libre.
 */

function parseContactData(message = '') {
  const text = String(message || '').toLowerCase().trim();

  const result = {};

  /**
   * ============================================
   * TELÉFONO
   * ============================================
   *
   * Detecta secuencias razonables de números:
   * - 387455456
   * - 387 455 456
   * - 387-455-456
   * - +54 387 455456
   */
  const phoneMatch = text.match(/(\+?\d[\d\s\-()]{5,})/);

  if (phoneMatch) {
    const rawPhone = phoneMatch[1].trim();
    const normalizedPhone = rawPhone.replace(/\D/g, '');

    if (normalizedPhone.length >= 6 && normalizedPhone.length <= 13) {
      result.phone = rawPhone;
      result.normalizedPhone = normalizedPhone;
    }
  }

  /**
   * ============================================
   * NOMBRE
   * ============================================
   */
  let nameMatch = text.match(/\bsoy\s+([a-záéíóúñ]+)/i);

  if (!nameMatch) {
    nameMatch = text.match(/\bmi nombre es\s+([a-záéíóúñ]+)/i);
  }

  /**
   * Fallback:
   * si vino "javier 387455456", intentamos tomar
   * la última palabra útil antes del número.
   */
  if (!nameMatch && result.phone) {
    const beforePhone = text.split(phoneMatch[1])[0].trim();
    const words = beforePhone.split(/\s+/).filter(Boolean);

    if (words.length > 0) {
      const possibleName = words[words.length - 1];

      const forbiddenWords = [
        'hola',
        'buenas',
        'tengo',
        'necesito',
        'quiero',
        'para',
        'con',
        'de',
        'en',
        'mi'
      ];

      if (
        possibleName &&
        possibleName.length > 2 &&
        !forbiddenWords.includes(possibleName)
      ) {
        result.name = capitalize(possibleName);
      }
    }
  }

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
    { keywords: ['alacran', 'alacranes', 'alacrán'], value: 'alacranes' },
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
   */
  if (
    text.includes('mi casa') ||
    text.includes('en casa') ||
    /\bcasa\b/.test(text) ||
    /\bhogar\b/.test(text)
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
   * UBICACIÓN SIMPLE
   * ============================================
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