/**
 * ============================================
 * CONTACT PARSER (detección automática)
 * ============================================
 *
 * Extrae datos útiles desde texto libre:
 * - nombre
 * - tipo de plaga
 * - ubicación
 */

function parseContactData(message = '') {
  const text = message.toLowerCase();

  const result = {};

  /**
   * ============================================
   * NOMBRE
   * ============================================
   */
  const nameMatch = text.match(/soy\s+([a-záéíóúñ]+)/i);
  if (nameMatch) {
    result.name = capitalize(nameMatch[1]);
  }

  /**
   * ============================================
   * PLAGA
   * ============================================
   */
  const pests = [
    'cucarachas',
    'ratas',
    'ratones',
    'hormigas',
    'mosquitos',
    'arañas'
  ];

  for (const pest of pests) {
    if (text.includes(pest)) {
      result.pest = pest;
      break;
    }
  }

  /**
   * ============================================
   * UBICACIÓN (simple)
   * ============================================
   */
  const locationMatch = text.match(/en\s+([a-z\s]+)/i);
  if (locationMatch) {
    result.location = capitalize(locationMatch[1].trim());
  }

  return result;
}

function capitalize(text) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

module.exports = {
  parseContactData
};