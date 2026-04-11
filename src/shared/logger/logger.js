/**
 * =========================================================
 * LOGGER CENTRAL CON ROTACIÓN DE LOGS (VERSIÓN PRO)
 * =========================================================
 *
 * ¿Qué hace este archivo?
 * -----------------------
 * - Maneja logs del sistema con Winston
 * - Guarda logs en archivos ROTATIVOS por día
 * - Elimina automáticamente logs viejos
 * - Mantiene consola para desarrollo
 *
 * Mejoras implementadas:
 * ----------------------
 * - Rotación diaria de logs
 * - Separación de logs generales y errores
 * - Limpieza automática (retención)
 *
 * En resumen:
 * -----------
 * Logger listo para producción real
 */

const fs = require('fs');
const path = require('path');
const { createLogger, format, transports } = require('winston');
require('winston-daily-rotate-file');

/**
 * =========================================================
 * CONFIGURACIÓN BASE
 * =========================================================
 */

const NODE_ENV = process.env.NODE_ENV || 'development';

const logsDir = path.join(process.cwd(), 'logs');

if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

/**
 * =========================================================
 * FORMATOS
 * =========================================================
 */

const baseFormat = format.combine(
  format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  format.errors({ stack: true })
);

const fileFormat = format.combine(
  baseFormat,
  format.json()
);

const consoleFormat = format.combine(
  baseFormat,
  format.colorize(),
  format.printf(({ timestamp, level, message, stack, ...meta }) => {
    const metaString =
      Object.keys(meta).length > 0
        ? ` ${JSON.stringify(meta)}`
        : '';

    if (stack) {
      return `[${timestamp}] ${level}: ${message}${metaString}\n${stack}`;
    }

    return `[${timestamp}] ${level}: ${message}${metaString}`;
  })
);

/**
 * =========================================================
 * ROTACIÓN DE LOGS
 * =========================================================
 */

/**
 * Logs generales (todo)
 */
const appRotateTransport = new transports.DailyRotateFile({
  filename: path.join(logsDir, 'app-%DATE%.log'),
  datePattern: 'YYYY-MM-DD',
  maxFiles: '14d', // guarda 14 días
  format: fileFormat
});

/**
 * Logs de error solamente
 */
const errorRotateTransport = new transports.DailyRotateFile({
  filename: path.join(logsDir, 'error-%DATE%.log'),
  datePattern: 'YYYY-MM-DD',
  level: 'error',
  maxFiles: '30d', // errores se guardan más tiempo
  format: fileFormat
});

/**
 * =========================================================
 * LOGGER PRINCIPAL
 * =========================================================
 */

const logger = createLogger({
  level: NODE_ENV === 'development' ? 'debug' : 'info',
  transports: [
    new transports.Console({
      format: consoleFormat
    }),
    appRotateTransport,
    errorRotateTransport
  ]
});

/**
 * =========================================================
 * HELPERS DE SEGURIDAD
 * =========================================================
 */

function maskSensitive(value) {
  const text = String(value || '');
  if (!text) return '';
  if (text.length <= 6) return '***';

  return `${text.slice(0, 3)}***${text.slice(-3)}`;
}

function maskPhone(value) {
  const text = String(value || '').replace(/[^\d]/g, '');
  if (!text) return '';
  if (text.length <= 4) return '****';

  return `***${text.slice(-4)}`;
}

module.exports = {
  logger,
  maskSensitive,
  maskPhone
};