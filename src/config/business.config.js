/**
 * =========================================================
 * CONFIGURACIÓN DEL NEGOCIO
 * =========================================================
 *
 * ¿Qué hace este archivo?
 * -----------------------
 * Centraliza toda la configuración específica del negocio.
 *
 * Permite:
 * - Adaptar el bot a otra empresa
 * - Cambiar textos sin tocar lógica
 * - Mantener separada la lógica del contenido comercial
 *
 * Ejemplo de uso:
 * ---------------
 * Cambiando este archivo podés reutilizar el bot para:
 * - otra empresa de fumigación
 * - otro rubro
 * - otra ciudad
 *
 * Sin modificar:
 * - conversation-engine
 * - controllers
 * - repositorios
 *
 * IMPORTANTE:
 * -----------
 * Este archivo debe contener SOLO configuración,
 * nunca lógica.
 */

const BUSINESS_CONFIG = {
  /**
   * ============================================
   * IDENTIDAD DEL NEGOCIO
   * ============================================
   */
  companyName: 'Ofreser',

  /**
   * Título del asistente (puede usarse en mensajes)
   */
  assistantTitle: 'Asistente virtual comercial',

  /**
   * ============================================
   * LOCAL DE ATENCIÓN AL PÚBLICO
   * ============================================
   */
  publicStore: {
    enabled: true,

    /**
     * Dirección física del local
     */
    address: 'Gral. Martin Güemes 1340',

    /**
     * Horarios en formato texto (se muestra al usuario)
     */
    scheduleText:
      'Lunes a viernes de 9 a 13 y de 16 a 20\n' +
      'Sábados de 9 a 13'
  },

  /**
   * ============================================
   * OFICINA / ADMINISTRACIÓN
   * ============================================
   */
office: {
  enabled: true,

  scheduleText:
    'Lunes a viernes de 9 a 18\n' +
    'Sábados de 9 a 13',

  /**
   * Horario comercial para lógica del bot
   */
  businessHours: {
    1: [{ start: '09:00', end: '18:00' }], // lunes
    2: [{ start: '09:00', end: '18:00' }], // martes
    3: [{ start: '09:00', end: '18:00' }], // miércoles
    4: [{ start: '09:00', end: '18:00' }], // jueves
    5: [{ start: '09:00', end: '18:00' }], // viernes
    6: [{ start: '09:00', end: '13:00' }]  // sábado
    // domingo (0) no se define → cerrado
  }
},

  /**
   * ============================================
   * CERTIFICADOS
   * ============================================
   */
  certificate: {
    /**
     * Nombre comercial que se muestra al usuario
     */
    label: 'Certificado de local fumigado',

    /**
     * Explicación breve del servicio
     */
    explanation:
      'El certificado es de local fumigado y requiere coordinar una visita previa.'
  },

  /**
   * ============================================
   * MENSAJES / TEXTOS REUTILIZABLES (FUTURO)
   * ============================================
   *
   * Esto te deja preparado para:
   * - cambiar copy sin tocar el engine
   * - tener distintos tonos comerciales
   */
  messages: {
    welcome:
      'Bienvenido a Ofreser - Grupo Morón Control de Plagas.',

    humanHandoff:
      'Un asesor se va a comunicar con vos a la brevedad.',

    thanks:
      'Gracias por contactarte con nosotros.'
  }
};

module.exports = BUSINESS_CONFIG;