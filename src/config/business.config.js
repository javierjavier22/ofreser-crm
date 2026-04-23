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
  /**
   * BIENVENIDA
   */
  welcome: (companyName) => `Hola 👋 Bienvenido a ${companyName}

Somos especialistas en control de plagas y servicios para comercios y hogares.

Podemos ayudarte con fumigación, certificados, venta de productos y consultas administrativas.

¿En qué podemos ayudarte?`,

  /**
   * MENÚ PRINCIPAL (cuando se reinicia)
   */
  mainMenuIntro: () => `Podemos ayudarte con fumigación, certificados, productos y consultas administrativas.

¿En qué podemos ayudarte?`,

  /**
   * SERVICIOS
   */
  servicesIntro: () => `Perfecto 👍

Vamos a ayudarte con tu consulta de fumigación.

¿Qué problema o plaga necesitás tratar?`,

  /**
   * PRODUCTOS
   */
  productsIntro: () => `Perfecto 👍

¿Qué producto estás buscando?`,

  /**
   * CERTIFICADOS
   */
  certificatesIntro: (explanation) => `Perfecto 👍

${explanation}

Vamos a ayudarte con el certificado.

¿Qué tipo de local es?`,

  /**
   * ADMINISTRACIÓN
   */
  adminIntro: () => `Perfecto 👍

Vamos a registrar tu consulta administrativa.

¿Sobre qué tema es?`,

  /**
   * CIERRE FINAL
   */
  closing: (companyName) => `Perfecto 🙌

Gracias por comunicarte con ${companyName}.

Cuando necesites, podés escribirnos nuevamente.`,

  /**
   * ERROR GENÉRICO
   */
  errorFallback: () => `Ocurrió un error. Volvimos al inicio.`
}
};

/**
 * =========================================================
 * CONFIGURACIÓN PRO MULTIEMPRESA
 * =========================================================
 *
 * IMPORTANTE:
 * - Esto NO reemplaza lo actual
 * - Se usa progresivamente
 * - No rompe nada existente
 */

/**
 * MENÚ PRINCIPAL CONFIGURABLE
 */
const MAIN_MENU = [
  {
    id: 'servicios',
    label: 'Fumigación',
    description: 'Servicio de control de plagas'
  },
  {
    id: 'certificados',
    label: 'Certificado',
    description: 'Certificado de local fumigado'
  },
  {
    id: 'productos',
    label: 'Venta de productos',
    description: 'Compra de insumos'
  },
  {
    id: 'administracion',
    label: 'Consultas administrativas',
    description: 'Facturación, pagos u otras consultas'
  }
];

/**
 * KEYWORDS DE INTENCIÓN CONFIGURABLES
 */
const INTENT_KEYWORDS_CONFIG = {
  servicios: [
    'fumigacion',
    'fumigar',
    'plaga',
    'plagas',
    'cucaracha',
    'rata',
    'hormiga'
  ],
  productos: [
    'producto',
    'veneno',
    'insecticida',
    'trampa'
  ],
  certificados: [
    'certificado',
    'certificacion',
    'habilitacion'
  ],
  administracion: [
    'factura',
    'pago',
    'comprobante',
    'administracion'
  ],
  asesor: [
    'asesor',
    'humano',
    'persona'
  ]
};

/**
 * FAQ CONFIGURABLE
 */
const FAQ_CONFIG = [
  {
    keywords: ['horario', 'atienden'],
    response: () => `Nuestro horario es:\n${BUSINESS_CONFIG.office.scheduleText}`
  },
{
  keywords: ['direccion', 'donde estan'],
  response: () => `Estamos en:\n${BUSINESS_CONFIG.publicStore.address}`
}
];

/**
 * CATÁLOGOS DEL NEGOCIO
 */
const CATALOGS = {
  pests: [
    'Cucarachas',
    'Roedores',
    'Hormigas',
    'Mosquitos',
    'Alacranes',
    'Otra plaga'
  ],
  placeTypes: [
    'Casa',
    'Departamento',
    'Comercio',
    'Oficina',
    'Industria',
    'Galpón',
    'Otro'
  ],
  products: [
    'Insecticidas',
    'Rodenticidas',
    'Trampas',
    'Equipos profesionales',
    'Otro producto'
  ],
  certificateLocalTypes: [
    'Bar / Restaurant',
    'Kiosco / Almacén / Despensa',
    'Industria / Fábricas',
    'Oficina / Local comercial',
    'Otro'
  ],
  adminReasons: [
    'Factura',
    'Pago',
    'Comprobante',
    'Servicio realizado',
    'Otro tema'
  ]
};

module.exports = {
  BUSINESS_CONFIG,
  MAIN_MENU,
  INTENT_KEYWORDS_CONFIG,
  FAQ_CONFIG,
  CATALOGS
};