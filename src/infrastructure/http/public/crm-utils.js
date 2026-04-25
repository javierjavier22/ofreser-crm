/**
 * =========================================================
 * OFRESER CRM - UTILIDADES GENERALES DEL FRONTEND
 * =========================================================
 *
 * Este archivo contiene funciones puras de formato y ayuda.
 *
 * Importante:
 * - no hace llamadas API
 * - no maneja estado global
 * - no renderiza componentes completos
 * - debe cargarse antes de crm.js
 */

function escapeHtml(text) {
  return String(text || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatCategory(lead) {
  if (lead.category === "servicios") return "Servicios";
  if (lead.category === "productos") return "Productos";
  if (lead.category === "certificados") return "Certificados";
  if (lead.category === "administracion") return "Administración";
  if (lead.category === "sin_categoria") return "Sin categoría";
  return lead.category || "Sin categoría";
}

function formatDate(dateString) {
  if (!dateString) return "-";

  const date = new Date(dateString);

  if (isNaN(date)) return "-";

  return date.toLocaleString("es-AR");
}

function formatControlMode(controlMode) {
  const mode = String(controlMode || "bot").toLowerCase();

  if (mode === "human") return "HUMANO";
  if (mode === "closed") return "CERRADO";

  return "BOT";
}

function buildWhatsAppUrl(phone, normalizedPhone) {
  const raw = String(normalizedPhone || phone || "").replace(/\D/g, "");

  if (!raw) return "";

  if (raw.startsWith("54")) {
    return `https://wa.me/${raw}`;
  }

  return `https://wa.me/54${raw}`;
}

function formatBooleanLabel(value) {
  return value ? "Sí" : "No";
}

function formatStatusLabel(status) {
  const map = {
    nuevo: "Nuevo",
    calificado: "Calificado",
    seguimiento: "Seguimiento",
    cerrado: "Cerrado",
    human: "Humano",
    bot: "Bot",
    closed: "Cerrado"
  };

  return map[String(status || "").toLowerCase()] || String(status || "-");
}