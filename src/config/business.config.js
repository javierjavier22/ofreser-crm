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
   * Horario comercial estructurado para lógica del bot.
   *
   * Formato:
   * - 0 = domingo
   * - 1 = lunes
   * - 2 = martes
   * - 3 = miércoles
   * - 4 = jueves
   * - 5 = viernes
   * - 6 = sábado
   */
  businessHours: {
1: [{ start: '00:00', end: '23:59' }],
2: [{ start: '00:00', end: '23:59' }],
3: [{ start: '00:00', end: '23:59' }],
4: [{ start: '00:00', end: '23:59' }],
5: [{ start: '00:00', end: '23:59' }],
6: [{ start: '00:00', end: '23:59' }]
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