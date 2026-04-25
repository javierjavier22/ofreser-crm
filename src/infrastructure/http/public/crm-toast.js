/**
 * =========================================================
 * OFRESER CRM - TOASTS / NOTIFICACIONES VISUALES
 * =========================================================
 *
 * Este archivo maneja notificaciones flotantes simples del CRM.
 *
 * Importante:
 * - no hace llamadas API
 * - no maneja estado global
 * - depende de que exista #toastContainer en index_crm.html
 */

function showToast(message, type = "info") {
  const container = document.getElementById("toastContainer");
  if (!container) return;

  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.textContent = message;

  container.appendChild(toast);

  setTimeout(() => {
    toast.remove();
  }, 3000);
}