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
 *
 * ¿Qué NO hace?
 * -------------
 * - No contiene lógica del bot
 * - No maneja conversaciones
 * - No crea archivos JSON legacy
 *
 * En resumen:
 * -----------
 * Este archivo prepara el entorno y levanta el servidor.
 */

require('dotenv').config();

/**
 * Aplicación Express configurada (rutas, middlewares, etc).
 */
const app = require('./src/infrastructure/http/app');

/**
 * Inicializador de base de datos SQLite (crea tablas si no existen).
 */
const { initDb } = require('./src/infrastructure/database/init-db');

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
 * Inicializa la base de datos SQLite.
 * - Crea archivo si no existe
 * - Ejecuta creación de tablas necesarias
 */
initDb();
logger.info('SQLite inicializada correctamente');

/**
 * Levanta el servidor HTTP y queda escuchando requests entrantes.
 */
app.listen(PORT, () => {
  logger.info(`Servidor corriendo en http://localhost:${PORT}`);
});