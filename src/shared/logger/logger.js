/**
 * =========================================================
 * LOGGER CENTRAL DEL SISTEMA
 * =========================================================
 *
 * ¿Qué hace este archivo?
 * -----------------------
 * Centraliza el sistema de logs del proyecto usando Winston.
 *
 * Permite:
 * - mostrar logs en consola
 * - guardar logs en archivos
 * - diferenciar niveles de severidad
 * - mantener un formato consistente
 *
 * Niveles principales:
 * --------------------
 * - error: fallos graves o excepciones
 * - warn: situaciones anormales pero no fatales
 * - info: eventos normales importantes del sistema
 * - debug: detalle técnico útil en desarrollo
 *
 * ¿Dónde guarda los logs?
 * -----------------------
 * Dentro de la carpeta /logs en la raíz del proyecto:
 *
 * - logs/app.log
 * - logs/error.log
 *
 * Importante:
 * -----------
 * - La carpeta se crea automáticamente si no existe.
 * - En producción no conviene loguear datos sensibles.
 * - Este logger NO debe imprimir tokens ni secretos.
 *
 * En resumen:
 * -----------
 * Este archivo es la base del logging profesional del sistema.
 */

const fs = require('fs');
const path = require('path');
const { createLogger, format, transports } = require('winston');

/**
 * =========================================================
 * CONFIGURACIÓN BASE
 * =========================================================
 */

/**
 * Detectamos entorno actual.
 *
 * Si no existe NODE_ENV,
 * asumimos que estamos en desarrollo.
 */
const NODE_ENV = process.env.NODE_ENV || 'development';

/**
 * Ruta absoluta a la carpeta de logs.
 *
 * La dejamos en la raíz del proyecto
 * para que sea fácil de encontrar.
 */
const logsDir = path.join(process.cwd(), 'logs');

/**
 * Si la carpeta de logs no existe,
 * la creamos automáticamente.
 */
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

/**
 * =========================================================
 * FORMATO DE LOGS
 * =========================================================
 *
 * Queremos algo legible en consola y también útil en archivo.
 */

/**
 * Formato base con timestamp y stack de errores.
 */
const baseFormat = format.combine(
  format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  format.errors({ stack: true })
);

/**
 * Formato para archivo:
 * JSON estructurado.
 *
 * Esto facilita:
 * - búsquedas futuras
 * - parsing automático
 * - debugging serio
 */
const fileFormat = format.combine(
  baseFormat,
  format.json()
);

/**
 * Formato para consola:
 * más legible para humanos.
 */
const consoleFormat = format.combine(
  baseFormat,
  format.colorize(),
  format.printf(({ timestamp, level, message, stack, ...meta }) => {
    /**
     * Si el log tiene metadata adicional,
     * la mostramos serializada.
     */
    const metaString =
      Object.keys(meta).length > 0
        ? ` ${JSON.stringify(meta)}`
        : '';

    /**
     * Si existe stack, lo mostramos debajo.
     */
    if (stack) {
      return `[${timestamp}] ${level}: ${message}${metaString}\n${stack}`;
    }

    return `[${timestamp}] ${level}: ${message}${metaString}`;
  })
);

/**
 * =========================================================
 * LOGGER PRINCIPAL
 * =========================================================
 */
const logger = createLogger({
  /**
   * En desarrollo permitimos más detalle.
   * En producción usamos info como base.
   */
  level: NODE_ENV === 'development' ? 'debug' : 'info',

  /**
   * Transportes:
   * - consola
   * - archivo general
   * - archivo exclusivo de errores
   */
  transports: [
    new transports.Console({
      format: consoleFormat
    }),

    new transports.File({
      filename: path.join(logsDir, 'app.log'),
      format: fileFormat
    }),

    new transports.File({
      filename: path.join(logsDir, 'error.log'),
      level: 'error',
      format: fileFormat
    })
  ]
});

/**
 * =========================================================
 * FUNCIONES AUXILIARES SEGURAS
 * =========================================================
 */

/**
 * Enmascara un valor sensible.
 *
 * Ejemplo:
 * abcdef123456 -> abc***456
 *
 * Sirve para:
 * - tokens
 * - ids externos
 * - números de teléfono
 */
function maskSensitive(value) {
  const text = String(value || '');

  if (!text) return '';

  if (text.length <= 6) {
    return '***';
  }

  const start = text.slice(0, 3);
  const end = text.slice(-3);

  return `${start}***${end}`;
}

/**
 * Enmascara un teléfono o identificador
 * dejando solo una pequeña parte visible.
 */
function maskPhone(value) {
  const text = String(value || '').replace(/[^\d]/g, '');

  if (!text) return '';

  if (text.length <= 4) {
    return '****';
  }

  return `***${text.slice(-4)}`;
}

/**
 * Exportamos:
 * - logger principal
 * - helpers seguros
 */
module.exports = {
  logger,
  maskSensitive,
  maskPhone
};