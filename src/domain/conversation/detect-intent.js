/**
 * =========================================================
 * DETECCIÓN DE INTENCIÓN DEL USUARIO
 * =========================================================
 *
 * ¿Qué hace este archivo?
 * -----------------------
 * Analiza el mensaje del usuario y trata de inferir
 * qué quiere hacer, sin necesidad de usar el menú.
 *
 * Ejemplos:
 * - "quiero comprar veneno" → productos
 * - "necesito fumigar" → servicios
 * - "quiero un certificado" → certificados
 *
 * Devuelve:
 * - string con la intención detectada
 * - null si no detecta nada
 *
 * IMPORTANTE:
 * -----------
 * Este sistema es basado en palabras clave (keyword matching).
 * No es IA ni NLP avanzado.
 */
 
 function removeAccents(text) {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

 /**
  * Verifica si el texto contiene alguna palabra clave.
  */
function containsAny(text, keywords = []) {
  const normalizedText = removeAccents(text);

  return keywords.some(keyword => {
    const normalizedKeyword = removeAccents(keyword);
    return normalizedText.includes(normalizedKeyword);
  });
}

/**
 * Diccionario de intenciones.
 *
 * Esto permite escalar fácil:
 * solo agregás palabras y listo.
 */
const INTENT_KEYWORDS = {
  productos: [
    'producto',
    'productos',
    'insecticida',
    'insecticidas',
    'rodenticida',
    'rodenticidas',
    'trampa',
    'trampas',
    'veneno',
    'venenos',
    'comprar',
    'compra',
    'venden',
    'equipos',
    'venta'
  ],

  certificados: [
    'certificado',
    'certificados',
    'habilitacion',
    'habilitación',
    'local fumigado'
  ],

  administracion: [
    'factura',
    'pago',
    'comprobante',
    'servicio realizado',
    'administracion',
    'administración'
  ],

  servicios: [
    'fumig',
    'cucaracha',
    'cucarachas',
    'rata',
    'ratas',
    'roedor',
    'roedores',
    'hormiga',
    'hormigas',
    'mosquito',
    'mosquitos',
    'alacran',
    'alacrán',
    'plaga',
    'desinsectacion',
    'desinsectación'
  ],

  asesor: [
    'asesor',
    'persona',
    'humano',
    'vendedor',
    'operador',
    'hablar con alguien'
  ]
};

/**
 * Detecta la intención del usuario.
 *
 * @param {string} msg (ya normalizado en el engine)
 * @returns {string|null}
 */
function detectIntent(msg) {

  /**
   * Orden de evaluación IMPORTANTE:
   *
   * Algunas palabras pueden solaparse.
   * Por ejemplo:
   * "quiero comprar fumigación"
   *
   * En ese caso, priorizamos SERVICIOS antes que PRODUCTOS.
   */

  if (containsAny(msg, INTENT_KEYWORDS.servicios)) {
    return 'servicios';
  }

  if (containsAny(msg, INTENT_KEYWORDS.productos)) {
    return 'productos';
  }

  if (containsAny(msg, INTENT_KEYWORDS.certificados)) {
    return 'certificados';
  }

  if (containsAny(msg, INTENT_KEYWORDS.administracion)) {
    return 'administracion';
  }

  if (containsAny(msg, INTENT_KEYWORDS.asesor)) {
    return 'asesor';
  }

  /**
   * Si no detecta nada → flujo normal (menú)
   */
  return null;
}

module.exports = {
  detectIntent
};