/**
 * =========================================================
 * OFRESER CRM - AUDITORÍA
 * =========================================================
 *
 * Este archivo maneja:
 * - presentación amigable de auditoría
 * - filtros de auditoría
 * - paginación de auditoría
 * - carga de eventos desde backend
 *
 * Importante:
 * - depende de crm-api.js
 * - depende de crm-state.js
 * - depende de crm-utils.js
 * - depende de crm-session-ui.js para isCrmAdmin()
 * - debe cargarse antes de crm.js
 */

function formatAuditDetails(details) {
  if (!details) return "-";

  try {
    return JSON.stringify(details, null, 2);
  } catch {
    return String(details);
  }
}

function getAuditFriendlyTitle(log) {
  const action = String(log?.action || "");

  const map = {
    CRM_LOGIN_SUCCESS: "Inicio de sesión exitoso",
    CRM_LOGOUT: "Cierre de sesión",
    CRM_PASSWORD_CHANGED: "Cambio de contraseña propia",
    ADMIN_RESET_SYSTEM: "Reset general del sistema",
    ADMIN_USER_CREATED: "Creación de usuario",
    ADMIN_USER_UPDATED: "Actualización de usuario",
    ADMIN_USER_PASSWORD_RESET: "Reset de contraseña de usuario",
    LEAD_STATUS_CHANGED: "Cambio de estado comercial del lead",
    LEAD_NOTE_UPDATED: "Actualización de nota interna",
    SESSION_TAKEN_BY_HUMAN: "Conversación tomada por humano",
    SESSION_RETURNED_TO_BOT: "Conversación devuelta al bot",
    SESSION_CLOSED: "Conversación cerrada",
	ADMIN_USER_BLOCKED: "Bloqueo de usuario",
ADMIN_USER_UNBLOCKED: "Desbloqueo de usuario",
    HUMAN_MESSAGE_SENT: "Mensaje humano enviado al cliente"
  };

  return map[action] || action || "Evento de auditoría";
}

function getAuditFriendlySubtitle(log) {
  const action = String(log?.action || "");
  const details = log?.details || {};

  if (action === "ADMIN_USER_CREATED") {
    return `Se creó el usuario ${details.createdUsername || "-"}.`;
  }

  if (action === "ADMIN_USER_UPDATED") {
    return `Se actualizó el usuario ${details.targetUsername || "-"}.`;
  }

  if (action === "ADMIN_USER_PASSWORD_RESET") {
    return `Se reseteó la contraseña de ${details.targetUsername || "-"}.`;
  }

  if (action === "LEAD_STATUS_CHANGED") {
    return `El lead ${details.leadName || details.phone || log?.entityId || "-"} cambió de estado.`;
  }

  if (action === "LEAD_NOTE_UPDATED") {
    return `Se actualizó una nota interna del lead ${details.leadName || details.phone || log?.entityId || "-"}.`;
  }

  if (
    action === "SESSION_TAKEN_BY_HUMAN" ||
    action === "SESSION_RETURNED_TO_BOT" ||
    action === "SESSION_CLOSED"
  ) {
    return `Sesión ${log?.entityId || "-"} en canal ${details.channel || "-"}.`;
  }

  if (action === "HUMAN_MESSAGE_SENT") {
    return `Se envió un mensaje manual al cliente ${details.to || "-"}.`;
  }

  if (action === "CRM_LOGIN_SUCCESS") {
    return `Ingreso al CRM del usuario ${details.username || log?.actorUsername || "-"}.`;
  }

  if (action === "CRM_LOGOUT") {
    return `Salida del CRM del usuario ${details.username || log?.actorUsername || "-"}.`;
  }

  if (action === "CRM_PASSWORD_CHANGED") {
    return `El usuario cambió su propia contraseña.`;
  }

  if (action === "ADMIN_RESET_SYSTEM") {
    return `Se ejecutó un borrado general de datos de testing.`;
  }
  
  if (action === "ADMIN_USER_BLOCKED") {
  return `Se bloqueó el usuario ${details.targetUsername || "-"}.`;
}

if (action === "ADMIN_USER_UNBLOCKED") {
  return `Se desbloqueó el usuario ${details.targetUsername || "-"}.`;
}

  return `Entidad: ${log?.entityType || "-"}${log?.entityId ? ` · ID: ${log.entityId}` : ""}`;
}

function getAuditFriendlyLines(log) {
  const action = String(log?.action || "");
  const details = log?.details || {};
  const lines = [];

  lines.push(`<div class="audit-friendly-line"><strong>Hecho por:</strong> ${escapeHtml(log?.actorUsername || "sin_usuario")}</div>`);
  lines.push(`<div class="audit-friendly-line"><strong>Rol:</strong> ${escapeHtml(log?.actorRole || "-")}</div>`);

  if (action === "ADMIN_USER_CREATED") {
    lines.push(`<div class="audit-friendly-line"><strong>Usuario creado:</strong> ${escapeHtml(details.createdUsername || "-")}</div>`);
    lines.push(`<div class="audit-friendly-line"><strong>Rol asignado:</strong> ${escapeHtml(details.createdRole || "-")}</div>`);
    lines.push(`<div class="audit-friendly-line"><strong>Activo:</strong> ${escapeHtml(formatBooleanLabel(details.isActive))}</div>`);
  }

  if (action === "ADMIN_USER_UPDATED") {
    lines.push(`<div class="audit-friendly-line"><strong>Usuario afectado:</strong> ${escapeHtml(details.targetUsername || "-")}</div>`);
    lines.push(`<div class="audit-friendly-line"><strong>Rol anterior:</strong> ${escapeHtml(details.from?.role || "-")}</div>`);
    lines.push(`<div class="audit-friendly-line"><strong>Rol nuevo:</strong> ${escapeHtml(details.to?.role || "-")}</div>`);
    lines.push(`<div class="audit-friendly-line"><strong>Activo antes:</strong> ${escapeHtml(formatBooleanLabel(details.from?.isActive))}</div>`);
    lines.push(`<div class="audit-friendly-line"><strong>Activo ahora:</strong> ${escapeHtml(formatBooleanLabel(details.to?.isActive))}</div>`);
  }

  if (action === "ADMIN_USER_PASSWORD_RESET") {
    lines.push(`<div class="audit-friendly-line"><strong>Usuario afectado:</strong> ${escapeHtml(details.targetUsername || "-")}</div>`);
  }

  if (action === "LEAD_STATUS_CHANGED") {
    lines.push(`<div class="audit-friendly-line"><strong>Lead:</strong> ${escapeHtml(details.leadName || "-")}</div>`);
    lines.push(`<div class="audit-friendly-line"><strong>Teléfono:</strong> ${escapeHtml(details.phone || "-")}</div>`);
    lines.push(`<div class="audit-friendly-line"><strong>Categoría:</strong> ${escapeHtml(formatCategory({ category: details.category || "" }))}</div>`);
    lines.push(`<div class="audit-friendly-line"><strong>Estado anterior:</strong> ${escapeHtml(formatStatusLabel(details.from))}</div>`);
    lines.push(`<div class="audit-friendly-line"><strong>Estado nuevo:</strong> ${escapeHtml(formatStatusLabel(details.to))}</div>`);
  }

  if (action === "LEAD_NOTE_UPDATED") {
    lines.push(`<div class="audit-friendly-line"><strong>Lead:</strong> ${escapeHtml(details.leadName || "-")}</div>`);
    lines.push(`<div class="audit-friendly-line"><strong>Teléfono:</strong> ${escapeHtml(details.phone || "-")}</div>`);
    lines.push(`<div class="audit-friendly-line"><strong>Largo anterior:</strong> ${escapeHtml(String(details.previousLength ?? "-"))}</div>`);
    lines.push(`<div class="audit-friendly-line"><strong>Largo nuevo:</strong> ${escapeHtml(String(details.newLength ?? "-"))}</div>`);
  }

  if (
    action === "SESSION_TAKEN_BY_HUMAN" ||
    action === "SESSION_RETURNED_TO_BOT" ||
    action === "SESSION_CLOSED"
  ) {
    lines.push(`<div class="audit-friendly-line"><strong>Sesión:</strong> ${escapeHtml(log?.entityId || "-")}</div>`);
    lines.push(`<div class="audit-friendly-line"><strong>Canal:</strong> ${escapeHtml(details.channel || "-")}</div>`);
    lines.push(`<div class="audit-friendly-line"><strong>Modo anterior:</strong> ${escapeHtml(formatStatusLabel(details.from))}</div>`);
    lines.push(`<div class="audit-friendly-line"><strong>Modo nuevo:</strong> ${escapeHtml(formatStatusLabel(details.to))}</div>`);
    if (details.takenBy) {
      lines.push(`<div class="audit-friendly-line"><strong>Tomado por:</strong> ${escapeHtml(details.takenBy)}</div>`);
    }
  }

  if (action === "HUMAN_MESSAGE_SENT") {
    lines.push(`<div class="audit-friendly-line"><strong>Destino:</strong> ${escapeHtml(details.to || "-")}</div>`);
    lines.push(`<div class="audit-friendly-line"><strong>Canal:</strong> ${escapeHtml(details.channel || "-")}</div>`);
    lines.push(`<div class="audit-friendly-line"><strong>Texto enviado:</strong> ${escapeHtml(details.textPreview || "-")}</div>`);
  }

  if (action === "CRM_LOGIN_SUCCESS" || action === "CRM_LOGOUT") {
    lines.push(`<div class="audit-friendly-line"><strong>Usuario:</strong> ${escapeHtml(details.username || log?.actorUsername || "-")}</div>`);
  }

  if (action === "ADMIN_RESET_SYSTEM") {
    lines.push(`<div class="audit-friendly-line"><strong>Tablas afectadas:</strong> ${escapeHtml((details.deletedTables || []).join(", ") || "-")}</div>`);
  }

  lines.push(`<div class="audit-friendly-line"><strong>Entidad:</strong> ${escapeHtml(log?.entityType || "-")}</div>`);
  if (log?.entityId) {
    lines.push(`<div class="audit-friendly-line"><strong>ID entidad:</strong> ${escapeHtml(log.entityId)}</div>`);
  }

if (action === "ADMIN_USER_BLOCKED" || action === "ADMIN_USER_UNBLOCKED") {
  lines.push(`<div class="audit-friendly-line"><strong>Usuario afectado:</strong> ${escapeHtml(details.targetUsername || "-")}</div>`);
}

  return lines.join("");
}








function auditMatchesSearch(log, search) {
  if (!search) return true;

  const haystack = [
    log?.action,
    log?.actorUsername,
    log?.actorRole,
    log?.entityType,
    log?.entityId,
    formatAuditDetails(log?.details),
    getAuditFriendlyTitle(log),
    getAuditFriendlySubtitle(log)
  ]
    .join(" ")
    .toLowerCase();

  return haystack.includes(search.toLowerCase());
}

function toggleAuditTechnicalDetails(button) {
  const targetId = button.getAttribute("data-target");
  const detailsBox = document.getElementById(targetId);
  if (!detailsBox) return;

  const isHidden = detailsBox.classList.contains("hidden");
  detailsBox.classList.toggle("hidden");

  button.textContent = isHidden
    ? "Ocultar detalle técnico"
    : "Ver detalle técnico";
}

function openAuditModal() {
  if (!isCrmAdmin()) {
    alert("Solo un admin puede ver la auditoría.");
    return;
  }

  const overlay = document.getElementById("auditModalOverlay");
  if (!overlay) return;

  auditCurrentOffset = 0;
  overlay.classList.add("open");
  loadAuditLogs();
}


function closeAuditModal() {
  const overlay = document.getElementById("auditModalOverlay");
  const statusBox = document.getElementById("auditStatusBox");
  const listWrap = document.getElementById("auditListWrap");
  const paginationInfo = document.getElementById("auditPaginationInfo");

  if (overlay) {
    overlay.classList.remove("open");
  }

  if (statusBox) {
    statusBox.textContent = "";
  }

  if (listWrap) {
    listWrap.innerHTML = "";
  }

  if (paginationInfo) {
    paginationInfo.textContent = "Página --";
  }

  auditCurrentOffset = 0;
  auditLastTotal = 0;
}

function updateAuditPaginationUi(total, returnedCount) {
  const paginationInfo = document.getElementById("auditPaginationInfo");
  const prevBtn = document.getElementById("auditPrevBtn");
  const nextBtn = document.getElementById("auditNextBtn");

  const currentPage = Math.floor(auditCurrentOffset / AUDIT_PAGE_SIZE) + 1;
  const totalPages = Math.max(1, Math.ceil((Number(total) || 0) / AUDIT_PAGE_SIZE));

  if (paginationInfo) {
    paginationInfo.textContent = `Página ${currentPage} de ${totalPages} · Total eventos: ${total}`;
  }

  if (prevBtn) {
    prevBtn.disabled = auditCurrentOffset <= 0;
  }

  if (nextBtn) {
    nextBtn.disabled = auditCurrentOffset + returnedCount >= total;
  }
}

function goToAuditPrevPage() {
  if (auditCurrentOffset <= 0) return;

  auditCurrentOffset = Math.max(0, auditCurrentOffset - AUDIT_PAGE_SIZE);
  loadAuditLogs();
}

function goToAuditNextPage() {
  if (auditCurrentOffset + AUDIT_PAGE_SIZE >= auditLastTotal) return;

  auditCurrentOffset += AUDIT_PAGE_SIZE;
  loadAuditLogs();
}

/**
 * Carga los eventos de auditoría desde backend,
 * aplica filtros y renderiza una vista amigable para negocio.
 */
async function loadAuditLogs() {
  const usernameInput = document.getElementById("auditUsernameFilter");
  const actionSelect = document.getElementById("auditActionFilter");
  const searchInput = document.getElementById("auditSearchFilter");
  const statusBox = document.getElementById("auditStatusBox");
  const listWrap = document.getElementById("auditListWrap");

  if (!statusBox || !listWrap) return;

  const username = usernameInput?.value?.trim() || "";
  const action = actionSelect?.value || "";
  const search = searchInput?.value?.trim() || "";

  const params = new URLSearchParams();
if (username) params.set("username", username);
if (action) params.set("action", action);

params.set("limit", String(AUDIT_PAGE_SIZE));
params.set("offset", String(auditCurrentOffset));

const query = params.toString() ? `?${params.toString()}` : "";

  statusBox.textContent = "Cargando auditoría...";
  listWrap.innerHTML = '<div class="loading">Cargando auditoría...</div>';

  try {
    const res = await crmFetch(`${API_BASE}/admin/audit${query}`);
    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error || `HTTP ${res.status}`);
    }

let logs = Array.isArray(data.logs) ? data.logs : [];
logs = logs.filter((log) => auditMatchesSearch(log, search));

auditLastTotal = Number(data.total || 0);

statusBox.textContent = `Eventos encontrados en página: ${logs.length} · Total: ${auditLastTotal}`;
updateAuditPaginationUi(auditLastTotal, logs.length);

    if (logs.length === 0) {
      listWrap.innerHTML = '<div class="empty">No hay eventos de auditoría para esos filtros.</div>';
      return;
    }

    listWrap.innerHTML = `
      <div class="audit-list">
        ${logs
          .map((log, index) => {
            const detailId = `auditTech_${index}_${String(log.id || "").replace(/[^a-zA-Z0-9_-]/g, "")}`;

            return `
              <div class="audit-item">
                <div class="audit-item-top">
                  <div class="audit-friendly-title">${escapeHtml(getAuditFriendlyTitle(log))}</div>
                  <div class="audit-date">${escapeHtml(formatDate(log.createdAt || ""))}</div>
                </div>

                <div class="audit-summary">
                  <div class="audit-friendly-subtitle">${escapeHtml(getAuditFriendlySubtitle(log))}</div>

                  <div class="audit-meta">
                    <span class="badge status">${escapeHtml(log.actorUsername || "sin_usuario")}</span>
                    <span class="badge channel">${escapeHtml(log.actorRole || "-")}</span>
                    <span class="badge category">${escapeHtml(log.entityType || "-")}</span>
                    ${
                      log.entityId
                        ? `<span class="badge control-bot">${escapeHtml(log.entityId)}</span>`
                        : ""
                    }
                  </div>

                  <div class="audit-friendly-lines">
                    ${getAuditFriendlyLines(log)}
                  </div>

                  <div class="audit-technical-wrap">
                    <button
                      class="audit-technical-toggle"
                      data-target="${detailId}"
                      onclick="toggleAuditTechnicalDetails(this)"
                    >
                      Ver detalle técnico
                    </button>

                    <div id="${detailId}" class="audit-details hidden">${escapeHtml(formatAuditDetails(log.details))}</div>
                  </div>
                </div>
              </div>
            `;
          })
          .join("")}
      </div>
    `;
  } catch (error) {
    console.error(error);
    statusBox.textContent = "Error cargando auditoría: " + error.message;
    listWrap.innerHTML = '<div class="empty">No se pudo cargar la auditoría.</div>';
  }
}