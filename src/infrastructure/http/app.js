/**
 * ============================================
 * APP HTTP PRINCIPAL (EXPRESS)
 * ============================================
 *
 * ¿Qué hace este archivo?
 * -----------------------
 * Arma la aplicación HTTP principal usando Express.
 *
 * Acá:
 * - se crean los endpoints del sistema
 * - se cargan middlewares globales
 * - se conectan los controllers
 *
 * Mejoras aplicadas:
 * ------------------
 * - protección de rutas del CRM
 * - login visual real del CRM
 * - endpoint admin de reset para testing limpio
 * - rutas administrativas de usuarios
 *
 * Importante:
 * -----------
 * SOLO se protegen rutas del CRM y admin interno.
 * NO se bloquea:
 * - webhook de WhatsApp
 * - webchat
 */

const express = require('express');
const cors = require('cors');
const path = require('path');

/**
 * Middleware de autenticación del CRM.
 */
const crmAuthMiddleware = require('./crm-auth.middleware');

/**
 * Controller de autenticación del CRM.
 */
const {
  postCrmLogin,
  getCrmMe,
  postCrmLogout,
  postCrmChangePassword
} = require('./controllers/crm-auth.controller');

/**
 * Controller administrativo interno.
 */
const {
  postResetSystem,
  getAuditLogs,
  postCreateBackup,
  getBackups,
  postRestoreBackup
} = require('./controllers/admin.controller');

/**
 * Controller del canal WhatsApp.
 */
const {
  verifyWhatsappWebhook,
  receiveWhatsappWebhook
} = require('./controllers/whatsapp-webhook.controller');

/**
 * Controller del canal webchat.
 */
const { postChat } = require('./controllers/webchat.controller');

/**
 * Controller del CRM interno.
 */
const {
  getLeads,
  getMessages,
  getMessagesBySession,
  getLeadMessages,
  patchLeadStatus,
  patchLeadNote,
  patchSessionControl,
  postHumanMessage
} = require('./controllers/crm.controller');

/**
 * Rutas administrativas de usuarios.
 *
 * OJO:
 * Este archivo app.js vive en:
 *   src/infrastructure/http/app.js
 *
 * Y el router vive en:
 *   src/routes/admin.users.routes.js
 *
 * Por eso la ruta relativa correcta es ../../routes/...
 */
const adminUsersRoutes = require('../../routes/admin.users.routes');

/**
 * Creamos la instancia principal de Express.
 */
const app = express();

/**
 * Middleware global CORS.
 */
app.use(cors());

/**
 * Middleware global para parsear JSON.
 */
app.use(express.json());

/**
 * Ruta simple de salud.
 */
app.get('/', (req, res) => {
  res.send('Servidor Ofreser funcionando 🚀');
});

/**
 * ============================================
 * RUTAS DEL LOGIN DEL CRM
 * ============================================
 *
 * Estas rutas NO están protegidas porque justamente
 * se usan para iniciar / validar / cerrar sesión.
 */
app.post('/crm/login', postCrmLogin);
app.get('/crm/me', crmAuthMiddleware, getCrmMe);
app.post('/crm/logout', crmAuthMiddleware, postCrmLogout);
app.post('/crm/change-password', crmAuthMiddleware, postCrmChangePassword);

/**
 * ============================================
 * RUTAS ADMIN INTERNAS
 * ============================================
 *
 * Estas rutas son solo para mantenimiento técnico
 * y testing interno.
 *
 * Reset:
 * - requiere autenticación
 * - requiere rol admin
 */
app.post(
  '/admin/reset',
  crmAuthMiddleware,
  crmAuthMiddleware.requireAdmin,
  postResetSystem
);

app.get(
  '/admin/audit',
  crmAuthMiddleware,
  crmAuthMiddleware.requireAdmin,
  getAuditLogs
);

/**
 * Backup manual del sistema.
 */
app.post(
  '/admin/backup',
  crmAuthMiddleware,
  crmAuthMiddleware.requireAdmin,
  postCreateBackup
);

/**
 * Listado de backups disponibles.
 */
app.get(
  '/admin/backups',
  crmAuthMiddleware,
  crmAuthMiddleware.requireAdmin,
  getBackups
);

/**
 * Restaurar sistema desde backup.
 */
app.post(
  '/admin/restore',
  crmAuthMiddleware,
  crmAuthMiddleware.requireAdmin,
  postRestoreBackup
);

/**
 * ============================================
 * RUTAS ADMIN - USUARIOS
 * ============================================
 *
 * Estas rutas manejan el ABM de usuarios del CRM.
 *
 * Seguridad:
 * - pasan primero por crmAuthMiddleware
 * - adentro del router se valida que el usuario sea admin
 */
app.use('/admin/users', crmAuthMiddleware, adminUsersRoutes);

/**
 * ============================================
 * RUTAS DEL WEBCHAT
 * ============================================
 *
 * NO protegidas por auth de CRM.
 */
app.post('/chat', postChat);

/**
 * ============================================
 * RUTAS DEL CRM
 * ============================================
 *
 * TODAS protegidas por CRM auth.
 */
app.get('/leads', crmAuthMiddleware, getLeads);
app.get('/messages', crmAuthMiddleware, getMessages);
app.get('/messages/:sessionId', crmAuthMiddleware, getMessagesBySession);
app.get('/leads/:id/messages', crmAuthMiddleware, getLeadMessages);
app.patch('/leads/:id/status', crmAuthMiddleware, patchLeadStatus);
app.patch('/leads/:id/note', crmAuthMiddleware, patchLeadNote);
app.patch('/sessions/:sessionId/control', crmAuthMiddleware, patchSessionControl);
app.post('/sessions/:sessionId/human-message', crmAuthMiddleware, postHumanMessage);

/**
 * ============================================
 * RUTAS DE WHATSAPP
 * ============================================
 *
 * NO protegidas por auth de CRM.
 */
app.get('/webhook/whatsapp', verifyWhatsappWebhook);
app.post('/webhook/whatsapp', receiveWhatsappWebhook);

/**
 * Exportamos la app.
 */
 
 /**
 * Servimos archivos estáticos del frontend.
 */
app.use(express.static(path.join(__dirname, 'public')));
module.exports = app;