/**
 * =========================================================
 * VALIDACIÓN CENTRAL DE VARIABLES DE ENTORNO
 * =========================================================
 *
 * ¿Qué hace este archivo?
 * -----------------------
 * Valida la configuración crítica del sistema al arrancar.
 *
 * Objetivos:
 * ----------
 * - detectar configuraciones incompletas
 * - detectar configuraciones peligrosas
 * - evitar fallos silenciosos en runtime
 * - centralizar reglas de entorno
 *
 * Filosofía:
 * ----------
 * - errores críticos => frenan el arranque
 * - warnings => informan, pero no frenan
 *
 * Importante:
 * -----------
 * Este archivo NO reemplaza el uso actual de process.env
 * en todo el proyecto.
 *
 * En esta etapa:
 * - valida
 * - protege
 * - documenta la configuración real
 */

/**
 * Devuelve una versión string segura de una variable de entorno.
 */
function getEnv(name) {
  return String(process.env[name] || '').trim();
}

/**
 * Devuelve true si una variable de entorno está seteada
 * con algún valor no vacío.
 */
function hasEnv(name) {
  return getEnv(name) !== '';
}

/**
 * Convierte una variable de entorno a boolean estricto.
 *
 * Solo "true" habilita realmente.
 */
function getEnvBoolean(name) {
  return getEnv(name).toLowerCase() === 'true';
}

/**
 * Arma un mensaje final legible para errores de configuración.
 */
function buildValidationMessage(title, items) {
  return [
    title,
    ...items.map(item => `- ${item}`)
  ].join('\n');
}

/**
 * Valida la configuración general del sistema.
 *
 * Reglas cubiertas en esta versión:
 * ---------------------------------
 * 1. NODE_ENV normalizado
 * 2. No permitir ALLOW_ADMIN_RESET=true en producción
 * 3. CRM_USERNAME y CRM_PASSWORD deben venir juntos si se usan
 * 4. WHATSAPP_TOKEN y PHONE_NUMBER_ID deben venir juntos si se usan
 * 5. genera warnings útiles para features opcionales
 */
function validateEnvironment() {
  const errors = [];
  const warnings = [];

  const nodeEnv = getEnv('NODE_ENV') || 'development';
  const allowAdminReset = getEnvBoolean('ALLOW_ADMIN_RESET');

  const crmUsernameExists = hasEnv('CRM_USERNAME');
  const crmPasswordExists = hasEnv('CRM_PASSWORD');

  const whatsappTokenExists = hasEnv('WHATSAPP_TOKEN');
  const phoneNumberIdExists = hasEnv('PHONE_NUMBER_ID');

  /**
   * =========================================================
   * REGLAS CRÍTICAS
   * =========================================================
   */

  /**
   * Blindaje fuerte:
   * en producción no permitimos reset administrativo habilitado.
   */
  if (nodeEnv === 'production' && allowAdminReset) {
    errors.push(
      'ALLOW_ADMIN_RESET=true no está permitido en producción'
    );
  }

  /**
   * Seed inicial del usuario CRM:
   * si querés usarlo, ambas variables deben existir.
   */
  if (crmUsernameExists && !crmPasswordExists) {
    errors.push(
      'CRM_USERNAME está definido pero CRM_PASSWORD no'
    );
  }

  if (!crmUsernameExists && crmPasswordExists) {
    errors.push(
      'CRM_PASSWORD está definido pero CRM_USERNAME no'
    );
  }

  /**
   * Integración WhatsApp:
   * si se configura una parte, debe venir la otra.
   */
  if (whatsappTokenExists && !phoneNumberIdExists) {
    errors.push(
      'WHATSAPP_TOKEN está definido pero PHONE_NUMBER_ID no'
    );
  }

  if (!whatsappTokenExists && phoneNumberIdExists) {
    errors.push(
      'PHONE_NUMBER_ID está definido pero WHATSAPP_TOKEN no'
    );
  }

  /**
   * =========================================================
   * WARNINGS ÚTILES
   * =========================================================
   */

  if (!crmUsernameExists && !crmPasswordExists) {
    warnings.push(
      'CRM_USERNAME y CRM_PASSWORD no están definidos. No se podrá seedear automáticamente un usuario inicial del CRM.'
    );
  }

  if (!whatsappTokenExists && !phoneNumberIdExists) {
    warnings.push(
      'WHATSAPP_TOKEN y PHONE_NUMBER_ID no están definidos. La salida por WhatsApp quedará deshabilitada hasta configurar esas variables.'
    );
  }

  if (!hasEnv('NODE_ENV')) {
    warnings.push(
      'NODE_ENV no está definido. Se asumirá "development".'
    );
  }

  /**
   * =========================================================
   * RESULTADO FINAL
   * =========================================================
   */

  if (warnings.length > 0) {
    console.warn(
      buildValidationMessage(
        '⚠️ Warnings de configuración detectados:',
        warnings
      )
    );
  }

  if (errors.length > 0) {
    throw new Error(
      buildValidationMessage(
        '❌ Errores críticos de configuración detectados:',
        errors
      )
    );
  }

  console.log('✅ Validación de entorno OK');
}

module.exports = {
  validateEnvironment,
  getEnv,
  hasEnv,
  getEnvBoolean
};