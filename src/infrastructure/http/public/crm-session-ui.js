/**
 * =========================================================
 * OFRESER CRM - SESIÓN, PERMISOS Y CABECERA VISUAL
 * =========================================================
 *
 * Este archivo maneja:
 * - hora de última actualización
 * - actividad visible del usuario
 * - caja de sesión del CRM
 * - permisos visuales por rol
 * - título de la pestaña del navegador
 *
 * Importante:
 * - depende de crm-state.js
 * - debe cargarse antes de crm.js
 */

function updateLastSyncLabel() {
  const label = document.getElementById("lastSyncLabel");
  if (!label) return;

  const now = new Date();
  label.textContent = `Actualizado: ${now.toLocaleTimeString("es-AR")}`;
}

function updateSessionActivityLabel() {
  const label = document.getElementById("crmSessionActivityLabel");
  if (!label) return;

  const now = new Date();
  label.textContent = `Última actividad: ${now.toLocaleTimeString("es-AR")}`;
  localStorage.setItem("ofreser_crm_last_activity", String(Date.now()));
}

function renderCrmSessionBox() {
  const userLabel = document.getElementById("crmSessionUserLabel");
  const roleLabel = document.getElementById("crmSessionRoleLabel");
  const activityLabel = document.getElementById("crmSessionActivityLabel");

  if (!userLabel || !roleLabel || !activityLabel) return;

  const username =
    crmCurrentAuth?.username ||
    localStorage.getItem("ofreser_crm_username") ||
    "--";

  const role =
    crmCurrentAuth?.role ||
    localStorage.getItem("ofreser_crm_role") ||
    window.getStoredCrmRole?.() ||
    "--";

  const lastActivityTs = Number(
    localStorage.getItem("ofreser_crm_last_activity") || 0
  );

  userLabel.textContent = `Usuario: ${username}`;
  roleLabel.textContent = `Rol: ${role}`;

  if (lastActivityTs > 0) {
    activityLabel.textContent =
      `Última actividad: ${new Date(lastActivityTs).toLocaleTimeString("es-AR")}`;
  } else {
    activityLabel.textContent = "Última actividad: --";
  }
}

function isCrmAdmin() {
  const role =
    crmCurrentAuth?.role ||
    localStorage.getItem("ofreser_crm_role") ||
    window.getStoredCrmRole?.() ||
    "";

  return String(role).toLowerCase() === "admin";
}

function applyCrmRolePermissions() {
  const resetBtn = document.getElementById("resetTestingBtn");
  const usersBtn = document.getElementById("usersAdminBtn");
  const auditBtn = document.getElementById("auditAdminBtn");
  const backupsBtn = document.getElementById("backupsAdminBtn");
  const isAdmin = isCrmAdmin();

  if (resetBtn) {
    resetBtn.style.display = isAdmin ? "" : "none";
  }

  if (usersBtn) {
    usersBtn.style.display = isAdmin ? "" : "none";
  }

  if (auditBtn) {
    auditBtn.style.display = isAdmin ? "" : "none";
  }

  if (backupsBtn) {
    backupsBtn.style.display = isAdmin ? "" : "none";
  }
}

function updateBrowserTabTitle(newCount) {
  const baseTitle = "Ofreser CRM";

  if (Number(newCount || 0) > 0) {
    document.title = `(${newCount}) ${baseTitle}`;
    return;
  }

  document.title = baseTitle;
}