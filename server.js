/**
 * =========================================================
 * SERVER PRINCIPAL
 * =========================================================
 *
 * ¿Qué hace este archivo?
 * -----------------------
 * Es el punto de arranque del backend.
 *
 * Sus responsabilidades son:
 * - cargar variables de entorno
 * - inicializar SQLite
 * - levantar la aplicación HTTP
 * - registrar en logs el arranque del sistema
 * - cerrar el servidor y la base de datos de forma ordenada
 *
 * ¿Qué NO hace?
 * -------------
 * - No contiene lógica del bot
 * - No maneja conversaciones
 * - No crea archivos JSON legacy
 *
 * En resumen:
 * -----------
 * Este archivo prepara el entorno, levanta el servidor
 * y además gestiona un cierre limpio del proceso.
 */
require('dotenv').config();

/**
 * Validación central de variables de entorno.
 */
const { validateEnvironment } = require('./src/config/env');

/**
 * Aplicación Express configurada (rutas, middlewares, etc).
 */
const app = require('./src/infrastructure/http/app');

/**
 * Inicializador de base de datos SQLite (crea tablas si no existen).
 */
const { initDb } = require('./src/infrastructure/database/init-db');

/**
 * Conexión central a SQLite.
 *
 * IMPORTANTE:
 * Este módulo debería exportar la instancia viva de la base.
 * La usamos para poder cerrarla correctamente al apagar el proceso.
 */
const db = require('./src/infrastructure/database/sqlite');

/**
 * Logger centralizado del sistema (Winston).
 */
const { logger } = require('./src/shared/logger/logger');

/**
 * Puerto HTTP donde se expone la API.
 * Puede ser configurado por variable de entorno.
 */
const PORT = process.env.PORT || 3000;

/**
 * Flag simple para evitar intentar cerrar el proceso más de una vez.
 *
 * Esto protege contra señales duplicadas como:
 * - SIGINT
 * - SIGTERM
 * - errores fatales
 */
let isShuttingDown = false;

/**
 * Validamos entorno ANTES de inicializar DB y servidor.
 */
validateEnvironment();

/**
 * Inicializa la base de datos SQLite.
 * - Crea archivo si no existe
 * - Ejecuta creación de tablas necesarias
 */
initDb();
logger.info('SQLite inicializada correctamente');

/**
 * Levanta el servidor HTTP y queda escuchando requests entrantes.
 */
const server = app.listen(PORT, () => {
  logger.info(`Servidor corriendo en http://localhost:${PORT}`);
});

/**
 * Cierra la base de datos SQLite de forma segura.
 *
 * Esta función:
 * - valida que exista método close()
 * - captura errores para no romper el shutdown
 */
function closeDatabaseSafely() {
  try {
    if (db && typeof db.close === 'function') {
      db.close();
      logger.info('Conexión SQLite cerrada correctamente');
    } else {
      logger.warn('SQLite no expone un método close(); se omite cierre explícito');
    }
  } catch (error) {
    logger.error(`Error cerrando SQLite: ${error.message}`);
  }
}

/**
 * Ejecuta un apagado limpio del sistema.
 *
 * Pasos:
 * 1. Evita doble ejecución
 * 2. Registra la razón del cierre
 * 3. Cierra el servidor HTTP
 * 4. Cierra SQLite
 * 5. Sale del proceso con código correspondiente
 */
function shutdown(signalOrReason, exitCode = 0) {
  if (isShuttingDown) {
    return;
  }

  isShuttingDown = true;

  logger.warn(`Iniciando cierre ordenado del sistema. Motivo: ${signalOrReason}`);

  /**
   * Intentamos cerrar primero el servidor HTTP.
   * Eso evita aceptar nuevas conexiones mientras apagamos el proceso.
   */
  server.close((serverError) => {
    if (serverError) {
      logger.error(`Error cerrando servidor HTTP: ${serverError.message}`);
    } else {
      logger.info('Servidor HTTP cerrado correctamente');
    }

    /**
     * Después cerramos la base de datos.
     */
    closeDatabaseSafely();

    /**
     * Salimos del proceso al final del cierre.
     */
    process.exit(serverError ? 1 : exitCode);
  });

  /**
   * Failsafe:
   * si por algún motivo server.close() quedara colgado,
   * forzamos la salida después de unos segundos.
   */
  setTimeout(() => {
    logger.error('Forzando cierre del proceso por timeout de shutdown');
    closeDatabaseSafely();
    process.exit(1);
  }, 5000);
}

/**
 * Señales estándar del sistema operativo.
 *
 * - SIGINT: Ctrl + C / cierre manual
 * - SIGTERM: cierre ordenado del contenedor o plataforma
 */
process.on('SIGINT', () => shutdown('SIGINT', 0));
process.on('SIGTERM', () => shutdown('SIGTERM', 0));

/**
 * Errores fatales del proceso.
 *
 * IMPORTANTE:
 * Los registramos y luego apagamos ordenadamente.
 */
process.on('uncaughtException', (error) => {
  logger.error(`Uncaught Exception: ${error.stack || error.message}`);
  shutdown('uncaughtException', 1);
});

process.on('unhandledRejection', (reason) => {
  const message =
    reason instanceof Error ? reason.stack || reason.message : String(reason);

  logger.error(`Unhandled Rejection: ${message}`);
  shutdown('unhandledRejection', 1);
});