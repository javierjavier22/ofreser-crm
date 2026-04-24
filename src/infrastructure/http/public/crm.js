/**
 * =========================================================
 * OFRESER CRM - LÓGICA PRINCIPAL DEL FRONTEND
 * =========================================================
 *
 * ¿Qué hace este archivo?
 * -----------------------
 * Contiene la lógica JavaScript principal del CRM:
 * - carga y render de leads
 * - filtros
 * - paginación
 * - drawer de conversación
 * - administración de usuarios
 * - auditoría
 * - backups
 * - sonido
 * - acciones contra API
 *
 * Importante:
 * - este archivo fue extraído desde index_crm.html
 * - no cambia comportamiento
 * - no modulariza todavía
 * - solo separa HTML de JavaScript para mejorar mantenimiento
 */
 	/**
 * =========================================================
 * crmFetch
 * Wrapper PRO de fetch con autenticación automática
 * =========================================================
 */



      /**
       * =========================================================
       * CONFIGURACIÓN GENERAL
       * =========================================================
       */
      
      const CRM_SOUND_STORAGE_KEY = "ofreser_crm_sound_enabled";

let allLeads = [];
let currentLeadId = null;
let autoRefreshTimer = null;
let crmCurrentAuth = null;

/**
 * =========================================================
 * ESTADO GLOBAL DE PAGINACIÓN DE LEADS
 * =========================================================
 *
 * Importante:
 * - el tablero ahora consume una página por vez
 * - los filtros actuales siguen funcionando sobre la página cargada
 */
let leadsCurrentOffset = 0;
const LEADS_PAGE_SIZE = 20;
let leadsLastTotal = 0;

let auditCurrentOffset = 0;
const AUDIT_PAGE_SIZE = 20;
let auditLastTotal = 0;

      /**
       * Evita ejecutar el bootstrap del CRM múltiples veces.
       */
      let crmBootstrapStarted = false;

      /**
       * Indica si el CRM ya completó al menos una carga inicial de leads.
       *
       * Regla:
       * - primera carga al abrir el CRM => no sonar
       * - cargas siguientes => si entra lead nuevo, sí sonar
       */
      let crmHasCompletedInitialLoad = false;

      /**
       * Estado persistente del sonido del CRM.
       *
       * Si el usuario ya lo activó antes, lo recordamos.
       */
      let crmAudioUnlocked =
        localStorage.getItem(CRM_SOUND_STORAGE_KEY) === "1";

      /**
       * Contexto de audio reutilizable del CRM.
       */
      let crmAudioContext = null;

      /**
       * Flag simple para evitar doble envío manual
       * si el usuario hace doble click o presiona Enter varias veces.
       */
      let isSendingHumanMessage = false;
	  
	  /**
 * Estado temporal del modal de reset password de usuarios.
 *
 * Guardamos:
 * - id del usuario a resetear
 * - username visible en el título/subtítulo
 */
let resetPasswordTargetUserId = null;
let resetPasswordTargetUsername = '';

      const searchInput = document.getElementById("searchInput");
      const categoryFilter = document.getElementById("categoryFilter");
      const statusFilter = document.getElementById("statusFilter");
      const controlFilter = document.getElementById("controlFilter");

      /**
       * =========================================================
       * UTILIDADES GENERALES
       * =========================================================
       */
      /**
       * Escapa HTML para render seguro.
       */
      function escapeHtml(text) {
        return String(text || "")
          .replaceAll("&", "&amp;")
          .replaceAll("<", "&lt;")
          .replaceAll(">", "&gt;")
          .replaceAll('"', "&quot;")
          .replaceAll("'", "&#039;");
      }

      /**
       * Traduce categoría a formato visible.
       */
      function formatCategory(lead) {
        if (lead.category === "servicios") return "Servicios";
        if (lead.category === "productos") return "Productos";
        if (lead.category === "certificados") return "Certificados";
        if (lead.category === "administracion") return "Administración";
        if (lead.category === "sin_categoria") return "Sin categoría";
        return lead.category || "Sin categoría";
      }

      /**
       * Formatea fecha.
       */
      function formatDate(dateString) {
        if (!dateString) return "-";
        const date = new Date(dateString);
        if (isNaN(date)) return "-";
        return date.toLocaleString("es-AR");
      }

      /**
       * Actualiza hora de sync.
       */
      function updateLastSyncLabel() {
        const now = new Date();
        document.getElementById("lastSyncLabel").textContent =
          `Actualizado: ${now.toLocaleTimeString("es-AR")}`;
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

      /**
       * =========================================================
       * ROLES Y PERMISOS VISUALES
       * =========================================================
       */

      /**
       * Devuelve true si el usuario autenticado es admin.
       */
      /**
       * Determina si el usuario actual tiene rol admin.
       * Prioriza el dato cargado desde /crm/me y luego usa localStorage como respaldo.
       */
function isCrmAdmin() {
  const role =
    crmCurrentAuth?.role ||
    localStorage.getItem("ofreser_crm_role") ||
    window.getStoredCrmRole?.() ||
    "";

  return String(role).toLowerCase() === "admin";
}

      /**
       * Aplica permisos visuales del CRM según role.
       *
       * En esta etapa solo ocultamos acciones sensibles.
       * Más adelante vamos a reforzar esto también en backend.
       */
      /**
       * Muestra u oculta acciones sensibles según el rol actual.
       * Esto es una capa visual; la seguridad real también debe existir en backend.
       */
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
      /**
       * Actualiza el título de la pestaña del navegador.
       *
       * Regla actual:
       * - muestra la cantidad de leads en estado "nuevo"
       * - si no hay nuevos, deja el título normal
       *
       * Ejemplos:
       * - Ofreser CRM
       * - (2) Ofreser CRM
       * - (5) Ofreser CRM
       */
      function updateBrowserTabTitle(newCount) {
        const baseTitle = "Ofreser CRM";

        if (Number(newCount || 0) > 0) {
          document.title = `(${newCount}) ${baseTitle}`;
          return;
        }

        document.title = baseTitle;
      }

      /**
       * =========================================================
       * SONIDO Y NOTIFICACIONES
       * =========================================================
       */
      /**
       * Desbloquea el audio después de una interacción del usuario.
       *
       * Importante:
       * muchos navegadores no solo exigen click,
       * también exigen crear o reanudar el AudioContext
       * dentro de una interacción real.
       */
      /**
       * Actualiza visualmente el botón de sonido del CRM.
       */
      function updateSoundButtonUI() {
        const btn = document.getElementById("soundToggleBtn");
        if (!btn) return;

        if (crmAudioUnlocked) {
          btn.textContent = "🔔 Sonido activo";
          btn.classList.remove("secondary");
          return;
        }

        btn.textContent = "🔔 Activar sonido";
        btn.classList.add("secondary");
      }

      /**
       * Desbloquea el audio del CRM.
       *
       * Esto requiere interacción humana real al menos una vez.
       */
      async function unlockCrmAudio() {
        try {
          const AudioContextClass =
            window.AudioContext || window.webkitAudioContext;
          if (!AudioContextClass) return false;

          if (!crmAudioContext) {
            crmAudioContext = new AudioContextClass();
          }

          if (crmAudioContext.state === "suspended") {
            await crmAudioContext.resume();
          }

          crmAudioUnlocked = true;
          localStorage.setItem(CRM_SOUND_STORAGE_KEY, "1");
          updateSoundButtonUI();

          return true;
        } catch (error) {
          console.error("No se pudo desbloquear el audio del CRM:", error);
          return false;
        }
      }

      /**
       * Sonido de nuevo lead.
       *
       * Está pensado para sonar más fuerte y más "mensaje nuevo"
       * que el beep técnico anterior.
       */
      async function playNewLeadSound() {
        if (!crmAudioUnlocked) return;

        try {
          const AudioContextClass =
            window.AudioContext || window.webkitAudioContext;
          if (!AudioContextClass) return;

          if (!crmAudioContext) {
            crmAudioContext = new AudioContextClass();
          }

          if (crmAudioContext.state === "suspended") {
            await crmAudioContext.resume();
          }

          const now = crmAudioContext.currentTime;

          const osc1 = crmAudioContext.createOscillator();
          const gain1 = crmAudioContext.createGain();

          osc1.type = "triangle";
          osc1.frequency.setValueAtTime(980, now);

          gain1.gain.setValueAtTime(0.0001, now);
          gain1.gain.exponentialRampToValueAtTime(0.3, now + 0.01);
          gain1.gain.exponentialRampToValueAtTime(0.0001, now + 0.17);

          osc1.connect(gain1);
          gain1.connect(crmAudioContext.destination);

          osc1.start(now);
          osc1.stop(now + 0.17);

          const osc2 = crmAudioContext.createOscillator();
          const gain2 = crmAudioContext.createGain();

          osc2.type = "triangle";
          osc2.frequency.setValueAtTime(1320, now + 0.19);

          gain2.gain.setValueAtTime(0.0001, now + 0.19);
          gain2.gain.exponentialRampToValueAtTime(0.26, now + 0.21);
          gain2.gain.exponentialRampToValueAtTime(0.0001, now + 0.36);

          osc2.connect(gain2);
          gain2.connect(crmAudioContext.destination);

          osc2.start(now + 0.19);
          osc2.stop(now + 0.36);
        } catch (error) {
          console.error(
            "No se pudo reproducir el sonido de nuevo lead:",
            error,
          );
        }
      }

      /**
       * Activación manual del sonido.
       *
       * Hace tres cosas:
       * 1. desbloquea audio
       * 2. lo guarda para futuras veces
       * 3. reproduce una prueba inmediata
       */
      async function activateCrmSound() {
        const unlocked = await unlockCrmAudio();

        if (!unlocked) {
          alert("No se pudo activar el sonido en este navegador.");
          return;
        }

        await playNewLeadSound();
      }

      /**
       * Badge visual de controlMode.
       */
      function buildControlBadge(controlMode) {
        const mode = String(controlMode || "bot").toLowerCase();

        if (mode === "human") {
          return `<span class="badge control-human">HUMANO</span>`;
        }

        if (mode === "closed") {
          return `<span class="badge control-closed">CERRADO</span>`;
        }

        return `<span class="badge control-bot">BOT</span>`;
      }

      /**
       * Texto visible de controlMode.
       */
      function formatControlMode(controlMode) {
        const mode = String(controlMode || "bot").toLowerCase();

        if (mode === "human") return "HUMANO";
        if (mode === "closed") return "CERRADO";
        return "BOT";
      }

      /**
       * Resumen visual del lead.
       */
      function buildLeadDetail(lead) {
        const lines = [];

        if (lead.phone) lines.push(`📞 ${lead.phone}`);

        if (lead.category === "servicios") {
          if (lead.pest) lines.push(`🪳 Plaga: ${lead.pest}`);
          if (lead.placeType) lines.push(`🏠 Lugar: ${lead.placeType}`);
          if (lead.zone) lines.push(`📍 Domicilio: ${lead.zone}`);
        }

        if (lead.category === "certificados") {
          if (lead.localType) lines.push(`🏢 Tipo de local: ${lead.localType}`);
          if (lead.businessName)
            lines.push(`🏷️ Nombre del local: ${lead.businessName}`);
          if (lead.address) lines.push(`📍 Domicilio: ${lead.address}`);
        }

        if (lead.category === "productos") {
          if (lead.product) lines.push(`🛒 Producto: ${lead.product}`);
        }

        if (lead.category === "administracion") {
          if (lead.adminReason) lines.push(`📄 Motivo: ${lead.adminReason}`);
        }

        return lines.map((x) => escapeHtml(x)).join("<br>");
      }

      /**
       * Determina si el lead está caliente.
       */
      function isHotLead(lead) {
        if (lead.requiresHuman) return true;
        if (lead.controlMode === "human") return true;
        if (lead.category === "certificados") return true;
        if (lead.status === "nuevo" && lead.name && lead.phone) return true;
        return false;
      }

      /**
       * Arma URL de WhatsApp.
       */
      function buildWhatsAppUrl(phone, normalizedPhone) {
        const raw = String(normalizedPhone || phone || "").replace(/\D/g, "");
        if (!raw) return "";

        if (raw.startsWith("54")) {
          return `https://wa.me/${raw}`;
        }
        return `https://wa.me/54${raw}`;
      }

      /**
       * Botones para mover de estado comercial.
       */
      function nextStatusButtons(currentStatus, leadId) {
        const buttons = [];

        if (currentStatus !== "nuevo") {
          buttons.push(
            `<button class="default-btn" onclick="updateStatus('${leadId}', 'nuevo')">Mover a Nuevo</button>`,
          );
        }
        if (currentStatus !== "calificado") {
          buttons.push(
            `<button class="default-btn" onclick="updateStatus('${leadId}', 'calificado')">Mover a Calificado</button>`,
          );
        }
        if (currentStatus !== "seguimiento") {
          buttons.push(
            `<button class="default-btn" onclick="updateStatus('${leadId}', 'seguimiento')">Mover a Seguimiento</button>`,
          );
        }
        if (currentStatus !== "cerrado") {
          buttons.push(
            `<button class="default-btn" onclick="updateStatus('${leadId}', 'cerrado')">Mover a Cerrado</button>`,
          );
        }

        return buttons.join("");
      }

      /**
       * Botones para cambiar control de sesión.
       */
      function buildSessionControlButtons(lead) {
        const mode = String(lead.controlMode || "bot").toLowerCase();
        const sessionId = lead.sessionId;

        const buttons = [];

        if (mode !== "human") {
          buttons.push(`
          <button class="take-human-btn" onclick="changeSessionControl('${sessionId}', 'human', '${lead.id}')">
            Tomar como humano
          </button>
        `);
        }

        if (mode !== "bot") {
          buttons.push(`
          <button class="return-bot-btn" onclick="changeSessionControl('${sessionId}', 'bot', '${lead.id}')">
            Devolver al bot
          </button>
        `);
        }

        if (mode !== "closed") {
          buttons.push(`
          <button class="close-conversation-btn" onclick="changeSessionControl('${sessionId}', 'closed', '${lead.id}')">
            Cerrar conversación
          </button>
        `);
        }

        return buttons.join("");
      }
      /**
       * =========================================================
       * RENDER DEL TABLERO
       * =========================================================
       */
      /**
       * Card del lead en tablero.
       */
      function createLeadCard(lead) {
        const div = document.createElement("div");
        // Detecta si el lead es nuevo (últimos X segundos)
        const isNewLead = (() => {
          if (!lead.createdAt) return false;
          const created = new Date(lead.createdAt).getTime();
          const now = Date.now();
          return now - created < 60000; // 60 segundos
        })();

        div.className = `
  lead-card 
  status-${lead.status || "nuevo"}
  ${isNewLead ? "lead-new lead-animate" : ""}
`;

        const name = lead.name || lead.businessName || "Sin nombre";
        const messageCount = Number(lead.messageCount || 0);
        const lastSender =
          lead.lastMessageSender === "user"
            ? "Cliente"
            : lead.lastMessageSender === "bot"
              ? "Bot"
              : lead.lastMessageSender === "human"
                ? "Asesor"
                : "";

        const lastText = lead.lastMessageText || "Sin mensajes";
        const previewText =
          lastText.length > 120 ? lastText.slice(0, 120) + "..." : lastText;
        const waUrl = buildWhatsAppUrl(lead.phone, lead.normalizedPhone);

        let badges = `
          ${isNewLead ? '<span class="badge new">Nuevo</span>' : ""}
			<span class="badge category">${escapeHtml(formatCategory(lead))}</span>
        <span class="badge channel">${escapeHtml(lead.channel || lead.source || "webchat")}</span>
        <span class="badge status">${escapeHtml(lead.status || "nuevo")}</span>
        ${buildControlBadge(lead.controlMode)}
      `;

        if (lead.requiresHuman)
          badges += `<span class="badge human">Requiere asesor</span>`;
        if (lead.partial)
          badges += `<span class="badge partial">Parcial</span>`;
        if (isHotLead(lead))
          badges += `<span class="badge hot">Lead caliente</span>`;

        div.innerHTML = `
        <div class="lead-top">
          <div class="lead-title">${escapeHtml(name)}</div>
          <div class="lead-date">${escapeHtml(formatDate(lead.createdAt))}</div>
        </div>

        <div class="badges">${badges}</div>

        <div class="lead-main-summary">
          ${buildLeadDetail(lead) || "Sin datos adicionales"}
        </div>

        <div class="lead-preview">
          <div><strong>Mensajes:</strong> ${messageCount}</div>
          <div><strong>Último:</strong> ${escapeHtml(lastSender ? `${lastSender}: ${previewText}` : previewText)}</div>
          <div><strong>Fecha último:</strong> ${escapeHtml(formatDate(lead.lastMessageAt || ""))}</div>
          <div><strong>Modo operativo:</strong> ${escapeHtml(formatControlMode(lead.controlMode))}</div>
        </div>

        <div class="lead-actions">
		  ${waUrl ? `<button class="default-btn" onclick="openWhatsApp('${waUrl}')">Abrir WhatsApp</button>` : ""}
		  <button class="default-btn" onclick="openDrawer('${lead.id}')">Ver detalle + conversación</button>

		  ${
        lead.status !== "seguimiento" && lead.status !== "cerrado"
          ? `<button class="attended-btn" onclick="markAsAttended('${lead.id}')">✔ Marcar como atendido</button>`
          : ""
      }

		  ${buildSessionControlButtons(lead)}
		  ${nextStatusButtons(lead.status, lead.id)}
		</div>
      `;

        return div;
      }

      function setEmpty(columnId) {
        document.getElementById(columnId).innerHTML =
          '<div class="empty">Sin leads</div>';
      }

      function clearColumns() {
        ["nuevo", "calificado", "seguimiento", "cerrado"].forEach((status) => {
          document.getElementById(`col-${status}`).innerHTML = "";
        });
      }

      /**
       * KPIs superiores.
       */
      function renderStats(leads) {
const nuevo = leads.filter((x) => x.status === "nuevo").length;
const calificado = leads.filter(
  (x) => x.status === "calificado",
).length;
const seguimiento = leads.filter(
  (x) => x.status === "seguimiento",
).length;
const cerrado = leads.filter((x) => x.status === "cerrado").length;

/**
 * TOTAL del tablero:
 * suma solo los estados visibles en las 4 columnas del CRM.
 *
 * Esto evita contar leads internos u ocultos
 * como "expirado", que siguen en base pero no se muestran.
 */
const total = nuevo + calificado + seguimiento + cerrado;

const human = leads.filter((x) => x.controlMode === "human").length;
const bot = leads.filter(
  (x) => (x.controlMode || "bot") === "bot",
).length;

        document.getElementById("stat-total").textContent = total;
        document.getElementById("stat-nuevo").textContent = nuevo;
        document.getElementById("stat-calificado").textContent = calificado;
        document.getElementById("stat-seguimiento").textContent = seguimiento;
        document.getElementById("stat-cerrado").textContent = cerrado;
        document.getElementById("stat-human").textContent = human;
        document.getElementById("stat-bot").textContent = bot;

        document.getElementById("count-nuevo").textContent = nuevo;
        document.getElementById("count-calificado").textContent = calificado;
        document.getElementById("count-seguimiento").textContent = seguimiento;
        document.getElementById("count-cerrado").textContent = cerrado;

        /**
         * El título de la pestaña debe reflejar TODOS los leads nuevos cargados,
         * no solo los visibles por filtros.
         */
        const totalNuevoGlobal = allLeads.filter(
          (x) => x.status === "nuevo",
        ).length;
        updateBrowserTabTitle(totalNuevoGlobal);
      }

      /**
       * Filtros del tablero.
       */
      function getFilteredLeads() {
        const search = searchInput.value.trim().toLowerCase();
        const category = categoryFilter.value;
        const status = statusFilter.value;
        const controlMode = controlFilter.value;

        return allLeads
          .filter((lead) => {
            if (category && lead.category !== category) return false;
            if (status && lead.status !== status) return false;
            if (controlMode && (lead.controlMode || "bot") !== controlMode)
              return false;

            if (!search) return true;

            const haystack = [
              lead.name,
              lead.phone,
              lead.normalizedPhone,
              lead.zone,
              lead.address,
              lead.pest,
              lead.product,
              lead.businessName,
              lead.localType,
              lead.adminReason,
              lead.category,
              lead.status,
              lead.controlMode,
              lead.lastMessageText,
            ]
              .join(" ")
              .toLowerCase();

            return haystack.includes(search);
          })
          .sort((a, b) => {
            /**
             * Orden operativo del CRM:
             * 1. último mensaje
             * 2. updatedAt
             * 3. createdAt
             *
             * Así los leads con actividad reciente suben arriba,
             * aunque hayan sido creados hace más tiempo.
             */
            const dateA = new Date(
              a.lastMessageAt || a.updatedAt || a.createdAt || 0,
            ).getTime();
            const dateB = new Date(
              b.lastMessageAt || b.updatedAt || b.createdAt || 0,
            ).getTime();

            return dateB - dateA;
          });
      }

      /**
       * Render del tablero.
       */
      function renderLeads(leads) {
        clearColumns();
        renderStats(leads);

        const grouped = {
          nuevo: leads.filter((x) => x.status === "nuevo"),
          calificado: leads.filter((x) => x.status === "calificado"),
          seguimiento: leads.filter((x) => x.status === "seguimiento"),
          cerrado: leads.filter((x) => x.status === "cerrado"),
        };

        Object.keys(grouped).forEach((status) => {
          const container = document.getElementById(`col-${status}`);
          const items = grouped[status];

          if (items.length === 0) {
            setEmpty(`col-${status}`);
            return;
          }

          items.forEach((lead) => {
            container.appendChild(createLeadCard(lead));
          });
        });
      }

      function applyFilters() {
        const filtered = getFilteredLeads();
        renderLeads(filtered);
      }
      /**
       * =========================================================
       * ACCIONES CONTRA API
       * =========================================================
       */
      /**
       * Carga general de leads.
       */
	   
	   /**
 * =========================================================
 * HELPERS DE PAGINACIÓN DE LEADS
 * =========================================================
 */

/**
 * Actualiza la UI del paginador del tablero.
 *
 * @param {number} total
 * Total real informado por backend
 *
 * @param {number} returnedCount
 * Cantidad de leads recibidos en esta página
 */
function updateLeadsPaginationUi(total, returnedCount) {
  const info = document.getElementById("leadsPaginationInfo");
  const prevBtn = document.getElementById("leadsPrevBtn");
  const nextBtn = document.getElementById("leadsNextBtn");

  const currentPage = Math.floor(leadsCurrentOffset / LEADS_PAGE_SIZE) + 1;
  const totalPages = Math.max(1, Math.ceil((Number(total) || 0) / LEADS_PAGE_SIZE));

  if (info) {
    info.textContent = `Página ${currentPage} de ${totalPages} · Total leads: ${total}`;
  }

  if (prevBtn) {
    prevBtn.disabled = leadsCurrentOffset <= 0;
  }

  if (nextBtn) {
    nextBtn.disabled = leadsCurrentOffset + returnedCount >= total;
  }
}

/**
 * Va a la página anterior de leads.
 */
function goToLeadsPrevPage() {
  if (leadsCurrentOffset <= 0) return;

  leadsCurrentOffset = Math.max(0, leadsCurrentOffset - LEADS_PAGE_SIZE);
  loadLeads({ silent: false, preserveModal: true });
}

/**
 * Va a la página siguiente de leads.
 */
function goToLeadsNextPage() {
  if (leadsCurrentOffset + LEADS_PAGE_SIZE >= leadsLastTotal) return;

  leadsCurrentOffset += LEADS_PAGE_SIZE;
  loadLeads({ silent: false, preserveModal: true });
}

/**
 * Resetea la paginación del tablero.
 *
 * Se usa cuando cambian filtros locales o al abrir el CRM.
 */
function resetLeadsPagination() {
  leadsCurrentOffset = 0;
}
	   
	   
/**
 * Carga general de leads.
 *
 * Nueva versión:
 * --------------
 * Consume backend paginado.
 *
 * Importante:
 * -----------
 * - no rompe compatibilidad con el drawer
 * - no rompe sonido
 * - no rompe el tablero actual
 * - los filtros siguen siendo locales sobre la página cargada
 */
async function loadLeads({ silent = false, preserveModal = true } = {}) {
  try {
    const params = new URLSearchParams();
    params.set("limit", String(LEADS_PAGE_SIZE));
    params.set("offset", String(leadsCurrentOffset));

    const query = `?${params.toString()}`;
    const res = await crmFetch(`${API_BASE}/leads${query}`);

    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const data = await res.json();

    /**
     * Compatibilidad defensiva:
     * - si backend responde paginado usamos data.leads
     * - si por algún motivo responde legacy, usamos el array directo
     */
    const incomingLeads = Array.isArray(data?.leads)
      ? data.leads
      : Array.isArray(data)
        ? data
        : [];

    /**
     * Total real informado por backend.
     */
    leadsLastTotal = Number(data?.total || incomingLeads.length || 0);

    /**
     * Detectamos IDs nuevos antes de reemplazar el estado local.
     */
    const previousIds = new Set(allLeads.map((lead) => String(lead.id)));
    const newLeadCount = incomingLeads.filter(
      (lead) => !previousIds.has(String(lead.id)),
    ).length;

    allLeads = incomingLeads;

    /**
     * Render local de la página actual.
     */
    applyFilters();

    /**
     * Actualizamos la UI del paginador.
     */
    updateLeadsPaginationUi(leadsLastTotal, incomingLeads.length);

    updateLastSyncLabel();
    updateSessionActivityLabel();
    renderCrmSessionBox();

    const connStatus = document.getElementById("connStatus");
    if (connStatus) {
      connStatus.style.color = "#16a34a";
      connStatus.title = "Conectado";
    }

    /**
     * Regla correcta:
     * - la primera carga del CRM NO debe sonar
     * - cualquier carga posterior con nuevos leads SÍ debe sonar
     */
    if (crmHasCompletedInitialLoad && newLeadCount > 0) {
      if (crmAudioUnlocked) {
        await playNewLeadSound();
      }
    }

    /**
     * Marcamos que la primera carga ya ocurrió.
     */
    crmHasCompletedInitialLoad = true;

    /**
     * Si el drawer está abierto, refrescamos solo si no
     * hay foco en nota o mensaje humano.
     */
    if (
      preserveModal &&
      currentLeadId &&
      document
        .getElementById("leadModalOverlay")
        .classList.contains("open")
    ) {
      const noteFocused =
        document.activeElement &&
        document.activeElement.id === "internalNoteInput";

      const humanFocused =
        document.activeElement &&
        document.activeElement.id === "humanMessageInput";

      if (!noteFocused && !humanFocused) {
        await openDrawer(currentLeadId, true);
      } else {
        document
          .getElementById("modalRefreshBanner")
          .classList.add("show");
      }
    }
  } catch (error) {
    console.error(error);

    const connStatus = document.getElementById("connStatus");
    if (connStatus) {
      connStatus.style.color = "#dc2626";
      connStatus.title = "Error de conexión";
    }

    if (!silent) {
      alert("Error cargando leads: " + error.message);
    }
  }
}

      /**
       * Actualiza estado comercial.
       */
      async function updateStatus(leadId, status) {
        try {
          const res = await crmFetch(`${API_BASE}/leads/${leadId}/status`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status }),
          });

          if (!res.ok) throw new Error(`HTTP ${res.status}`);

          await loadLeads({ silent: false, preserveModal: true });
        } catch (error) {
          console.error(error);
          alert("Error actualizando estado: " + error.message);
        }
      }

      /**
       * Marca un lead como atendido.
       *
       * IMPORTANTE:
       * En la versión actual, "atendido" se implementa usando
       * el estado comercial "seguimiento".
       *
       * Esto NO crea una entidad nueva en backend.
       * Es solo una equivalencia operativa dentro del CRM.
       *
       * Ventajas:
       * - no rompe nada
       * - aprovecha el flujo existente
       * - mejora la operación comercial real
       */

      async function markAsAttended(leadId) {
        await updateStatus(leadId, "seguimiento");
      }

      /**
       * Cambia control de sesión.
       */
      async function changeSessionControl(
        sessionId,
        controlMode,
        leadId = null,
      ) {
        try {
          const payload = { controlMode };

          if (controlMode === "human") {
            payload.takenBy = "CRM";
          }

          const res = await crmFetch(
            `${API_BASE}/sessions/${encodeURIComponent(sessionId)}/control`,
            {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(payload),
            },
          );

          if (!res.ok) throw new Error(`HTTP ${res.status}`);

          await loadLeads({ silent: false, preserveModal: true });

          if (leadId && currentLeadId === leadId) {
            await openDrawer(leadId, true);
          }
        } catch (error) {
          console.error(error);
          alert("Error cambiando control de sesión: " + error.message);
        }
      }



      /**
       * Render interno de mensajes.
       */
      function renderConversationMessages(messages) {
        if (!Array.isArray(messages) || messages.length === 0) {
          return `
          <div class="detail-line">No hay mensajes registrados.</div>
        `;
        }

        return messages
          .map((msg) => {
            let senderClass = "bot";
            let senderLabel = "Bot";

            if (msg.senderType === "user") {
              senderClass = "user";
              senderLabel = "Cliente";
            }

            if (msg.senderType === "human") {
              senderClass = "human";
              senderLabel = "Asesor";
            }

            return `
          <div class="msg ${senderClass}">
            ${escapeHtml(msg.text || "")}
            <div class="msg-meta">${escapeHtml(senderLabel)} · ${escapeHtml(formatDate(msg.createdAt))}</div>
          </div>
        `;
          })
          .join("");
      }

      /**
       * Hace scroll automático al último mensaje.
       */
      function scrollConversationToBottom(force = false) {
        const container = document.getElementById("conversationThread");
        if (!container) return;

        /**
         * Solo forzamos scroll si:
         * - el caller lo pide explícitamente
         * - o el usuario ya estaba cerca del final
         *
         * Esto evita que el CRM "salte" hacia abajo
         * cuando alguien está leyendo mensajes viejos.
         */
        const distanceFromBottom =
          container.scrollHeight - container.scrollTop - container.clientHeight;
        const isNearBottom = distanceFromBottom < 120;

        if (force || isNearBottom) {
          container.scrollTop = container.scrollHeight;
        }
      }

      /**
       * Guarda nota interna.
       */
      async function saveInternalNote(leadId) {
        const textarea = document.getElementById("internalNoteInput");
        const statusBox = document.getElementById("noteSaveStatus");
        if (!textarea || !statusBox) return;

        const note = textarea.value;
        statusBox.textContent = "Guardando nota...";

        try {
          const res = await crmFetch(`${API_BASE}/leads/${leadId}/note`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ note }),
          });

          if (!res.ok) throw new Error(`HTTP ${res.status}`);

          const data = await res.json();
          const updatedLead = data.lead;
          const index = allLeads.findIndex((x) => x.id === leadId);
          if (index !== -1) allLeads[index] = updatedLead;

          statusBox.textContent = "Nota guardada correctamente";
          document
            .getElementById("modalRefreshBanner")
            .classList.remove("show");
          applyFilters();
        } catch (error) {
          console.error(error);
          statusBox.textContent = "Error guardando nota: " + error.message;
        }
      }

      /**
       * Envía mensaje humano desde el CRM.
       *
       * REGLA:
       * Solo se envía si la conversación está en HUMANO.
       */
      async function sendHumanMessage(leadId, sessionId, controlMode) {
        const textarea = document.getElementById("humanMessageInput");
        const statusBox = document.getElementById("humanSendStatus");
        const button = document.getElementById("humanSendButton");

        if (!textarea || !statusBox || !button) return;

        if (isSendingHumanMessage) {
          return;
        }

        const text = textarea.value.trim();

        if (!text) {
          statusBox.textContent = "Escribí un mensaje antes de enviar.";
          return;
        }

        if (String(controlMode || "bot").toLowerCase() !== "human") {
          statusBox.textContent =
            "Solo se puede enviar mensaje manual cuando la conversación está en HUMANO.";
          return;
        }

        isSendingHumanMessage = true;
        statusBox.textContent = "Enviando mensaje al cliente...";
        button.disabled = true;

        try {
          const res = await crmFetch(
            `${API_BASE}/sessions/${encodeURIComponent(sessionId)}/human-message`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ text }),
            },
          );

          const data = await res.json();

          if (!res.ok) {
            throw new Error(data.error || `HTTP ${res.status}`);
          }

          textarea.value = "";
          statusBox.textContent = "Mensaje enviado correctamente.";

          /**
           * Refrescamos datos generales y luego reabrimos
           * el drawer para ver el nuevo mensaje ya persistido.
           */
          await loadLeads({ silent: false, preserveModal: true });
          await openDrawer(leadId, true);

          /**
           * Después del re-render forzamos scroll al final
           * porque este caso sí representa una acción nueva del asesor.
           */
          setTimeout(() => scrollConversationToBottom(true), 30);
        } catch (error) {
          console.error(error);
          statusBox.textContent = "Error enviando mensaje: " + error.message;
        } finally {
          isSendingHumanMessage = false;
          button.disabled = false;
        }
      }

      /**
       * Maneja Enter para enviar y Shift+Enter para salto de línea.
       */
      function attachHumanComposerEvents(leadId, sessionId, controlMode) {
        const textarea = document.getElementById("humanMessageInput");
        if (!textarea) return;

        /**
         * Enter envía
         * Shift + Enter agrega salto de línea
         */
        textarea.addEventListener("keydown", async function (e) {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            await sendHumanMessage(leadId, sessionId, controlMode);
          }
        });
      }
      /**
       * =========================================================
       * DRAWER / DETALLE DEL LEAD
       * =========================================================
       */
      /**
       * Abre drawer/modal de lead.
       */
      async function openDrawer(leadId, silentRefresh = false) {
        const lead = allLeads.find((x) => x.id === leadId);
        if (!lead) return;

        currentLeadId = leadId;

        const overlay = document.getElementById("leadModalOverlay");
        const left = document.getElementById("drawerLeft");
        const right = document.getElementById("drawerRight");
        const banner = document.getElementById("modalRefreshBanner");

        banner.classList.remove("show");
        overlay.classList.add("open");

        if (!silentRefresh) {
          left.innerHTML = `
          <div class="detail-block">
            <div class="detail-title">Cargando</div>
            <div class="loading">Cargando detalle y conversación...</div>
          </div>
        `;
          right.innerHTML = "";
        }

        try {
          const data = await fetchLeadConversation(leadId);
          const fullLead = data.lead || lead;
          const messages = data.messages || [];
          const session = data.session || null;
          const waUrl = buildWhatsAppUrl(
            fullLead.phone,
            fullLead.normalizedPhone,
          );

          document.getElementById("modalLeadTitle").textContent =
            fullLead.name || fullLead.businessName || "Detalle del lead";
          document.getElementById("modalLeadSub").textContent =
            `${formatCategory(fullLead)} · ${fullLead.status || "nuevo"} · ${formatDate(fullLead.createdAt)}`;

          const isHumanMode =
            String(fullLead.controlMode || "bot").toLowerCase() === "human";

          left.innerHTML = `
          <div class="detail-block">
            <div class="detail-title">General</div>
            <div class="detail-grid">
              <div class="detail-line"><strong>ID:</strong> ${escapeHtml(fullLead.id)}</div>
              <div class="detail-line"><strong>Estado comercial:</strong> ${escapeHtml(fullLead.status || "-")}</div>
              <div class="detail-line"><strong>Modo operativo:</strong> ${escapeHtml(formatControlMode(fullLead.controlMode))}</div>
              <div class="detail-line"><strong>Categoría:</strong> ${escapeHtml(formatCategory(fullLead))}</div>
              <div class="detail-line"><strong>Creado:</strong> ${escapeHtml(formatDate(fullLead.createdAt))}</div>
              <div class="detail-line"><strong>Actualizado:</strong> ${escapeHtml(formatDate(fullLead.updatedAt || ""))}</div>
              <div class="detail-line"><strong>Total mensajes:</strong> ${escapeHtml(String(fullLead.messageCount || 0))}</div>
              <div class="detail-line"><strong>Último mensaje:</strong> ${escapeHtml(formatDate(fullLead.lastMessageAt || ""))}</div>
            </div>
          </div>

          <div class="detail-block">
            <div class="detail-title">Control de conversación</div>
            <div class="control-panel">
              <div class="badges">
                ${buildControlBadge(fullLead.controlMode)}
                ${fullLead.requiresHuman ? '<span class="badge human">Requiere asesor</span>' : ""}
              </div>

              <div class="detail-line"><strong>Session ID:</strong> ${escapeHtml(fullLead.sessionId || "-")}</div>
              <div class="detail-line"><strong>Step:</strong> ${escapeHtml(fullLead.sessionStep || session?.step || "-")}</div>
              <div class="detail-line"><strong>Tomado por:</strong> ${escapeHtml(fullLead.takenBy || "-")}</div>
              <div class="detail-line"><strong>Solicitado humano:</strong> ${escapeHtml(formatDate(fullLead.humanRequestedAt || ""))}</div>
              <div class="detail-line"><strong>Tomado humano:</strong> ${escapeHtml(formatDate(fullLead.humanTakenAt || ""))}</div>
              <div class="detail-line"><strong>Devuelto al bot:</strong> ${escapeHtml(formatDate(fullLead.humanReleasedAt || ""))}</div>
              <div class="detail-line"><strong>Cerrado:</strong> ${escapeHtml(formatDate(fullLead.closedAt || ""))}</div>

              <div class="control-actions">
                ${
                  fullLead.controlMode !== "human"
                    ? `
                  <button class="take-human" onclick="changeSessionControl('${fullLead.sessionId}', 'human', '${fullLead.id}')">
                    Tomar como humano
                  </button>
                `
                    : ""
                }

                ${
                  fullLead.controlMode !== "bot"
                    ? `
                  <button class="return-bot" onclick="changeSessionControl('${fullLead.sessionId}', 'bot', '${fullLead.id}')">
                    Devolver al bot
                  </button>
                `
                    : ""
                }

                ${
                  fullLead.controlMode !== "closed"
                    ? `
                  <button class="close-session" onclick="changeSessionControl('${fullLead.sessionId}', 'closed', '${fullLead.id}')">
                    Cerrar conversación
                  </button>
                `
                    : ""
                }
              </div>
            </div>
          </div>

          <div class="detail-block">
            <div class="detail-title">Acciones rápidas</div>
            <div class="toolbar">
              ${waUrl ? `<button class="btn whatsapp small" onclick="openWhatsApp('${waUrl}')">Abrir WhatsApp del cliente</button>` : ""}
              <button class="btn secondary small" onclick="updateStatus('${fullLead.id}', 'seguimiento')">Mover a seguimiento</button>
              <button class="btn secondary small" onclick="updateStatus('${fullLead.id}', 'cerrado')">Cerrar lead</button>
            </div>
          </div>

          <div class="detail-block">
            <div class="detail-title">Cliente</div>
            <div class="detail-line"><strong>Nombre:</strong> ${escapeHtml(fullLead.name || "-")}</div>
            <div class="detail-line"><strong>Teléfono:</strong> ${escapeHtml(fullLead.phone || "-")}</div>
            <div class="detail-line"><strong>Teléfono normalizado:</strong> ${escapeHtml(fullLead.normalizedPhone || "-")}</div>
            <div class="detail-line"><strong>Canal:</strong> ${escapeHtml(fullLead.channel || fullLead.source || "-")}</div>
            <div class="detail-line"><strong>Origen:</strong> ${escapeHtml(fullLead.source || "-")}</div>
          </div>

          <div class="detail-block">
            <div class="detail-title">Detalle de consulta</div>
            <div class="detail-line"><strong>Plaga:</strong> ${escapeHtml(fullLead.pest || "-")}</div>
            <div class="detail-line"><strong>Tipo de lugar:</strong> ${escapeHtml(fullLead.placeType || "-")}</div>
            <div class="detail-line"><strong>Domicilio servicio:</strong> ${escapeHtml(fullLead.zone || "-")}</div>
            <div class="detail-line"><strong>Producto:</strong> ${escapeHtml(fullLead.product || "-")}</div>
            <div class="detail-line"><strong>Tipo de local:</strong> ${escapeHtml(fullLead.localType || "-")}</div>
            <div class="detail-line"><strong>Nombre del local:</strong> ${escapeHtml(fullLead.businessName || "-")}</div>
            <div class="detail-line"><strong>Domicilio del local:</strong> ${escapeHtml(fullLead.address || "-")}</div>
            <div class="detail-line"><strong>Motivo admin:</strong> ${escapeHtml(fullLead.adminReason || "-")}</div>
          </div>

          <div class="detail-block">
            <div class="detail-title">Estado comercial</div>
            <div class="detail-line"><strong>Requiere asesor:</strong> ${fullLead.requiresHuman ? "Sí" : "No"}</div>
            <div class="detail-line"><strong>Lead parcial:</strong> ${fullLead.partial ? "Sí" : "No"}</div>
            <div class="detail-line"><strong>Lead caliente:</strong> ${isHotLead(fullLead) ? "Sí" : "No"}</div>
            <div class="detail-line"><strong>Motivo parcial:</strong> ${escapeHtml(fullLead.partialReason || "-")}</div>
          </div>

          <div class="detail-block">
            <div class="detail-title">Nota interna</div>
            <textarea
              id="internalNoteInput"
              class="note-textarea"
              placeholder="Escribí una nota interna para este lead..."
            >${escapeHtml(fullLead.internalNote || "")}</textarea>

            <div class="note-actions">
              <button class="note-save-btn" onclick="saveInternalNote('${fullLead.id}')">Guardar nota</button>
            </div>

            <div id="noteSaveStatus" class="note-status"></div>
          </div>
        `;

          /**
           * =====================================================
           * COLUMNA DERECHA PRO
           * =====================================================
           *
           * - historial arriba
           * - caja de respuesta abajo
           * - input siempre visible
           *
           * IMPORTANTE:
           * La caja de respuesta humana solo queda habilitada
           * cuando la sesión está en modo HUMANO.
           */
          right.innerHTML = `
          <div class="chat-shell">
            <div class="chat-thread-card">
              <div class="chat-thread-title">Conversación</div>

              <div id="conversationThread" class="conversation">
                ${renderConversationMessages(messages)}
              </div>
            </div>

            <div class="chat-composer-card human-send-block ${isHumanMode ? "" : "disabled"}">
              <div class="detail-title">Responder al cliente</div>

              <div class="chat-composer-help">
                ${
                  isHumanMode
                    ? "La conversación está en modo HUMANO. Escribí abajo y enviá el mensaje al cliente."
                    : "Para responder desde el CRM, primero tomá la conversación como HUMANO."
                }
              </div>

              <textarea
                id="humanMessageInput"
                class="human-textarea"
                placeholder="Escribí acá tu mensaje para el cliente..."
                ${isHumanMode ? "" : "disabled"}
              ></textarea>

              <div class="chat-composer-footer">
                <div class="chat-composer-tip">Enter envía · Shift + Enter hace salto de línea</div>

                <button
                  id="humanSendButton"
                  class="human-send-btn"
                  onclick="sendHumanMessage('${fullLead.id}', '${fullLead.sessionId}', '${fullLead.controlMode || "bot"}')"
                  ${isHumanMode ? "" : "disabled"}
                >
                  Enviar al cliente
                </button>
              </div>

              <div id="humanSendStatus" class="human-status"></div>
            </div>
          </div>
        `;

          /**
           * Después de renderizar:
           * - enganchamos Enter / Shift+Enter
           * - scroll al último mensaje
           */
          attachHumanComposerEvents(
            fullLead.id,
            fullLead.sessionId,
            fullLead.controlMode || "bot",
          );

          /**
           * Al abrir el drawer:
           * - si el operador estaba abajo, mantenemos el scroll al final
           * - si el modo es HUMANO, damos foco al input para responder rápido
           */
          setTimeout(() => {
            scrollConversationToBottom();

            const input = document.getElementById("humanMessageInput");
            if (input && !input.disabled) {
              input.focus();
            }
          }, 30);
        } catch (error) {
          console.error(error);
          left.innerHTML = `
          <div class="detail-block">
            <div class="detail-title">Error</div>
            <div class="detail-line">No se pudo cargar la conversación.</div>
            <div class="detail-line">${escapeHtml(error.message)}</div>
          </div>
        `;
          right.innerHTML = "";
        }
      }

      function closeDrawer() {
        currentLeadId = null;
        document.getElementById("leadModalOverlay").classList.remove("open");
        document.getElementById("modalRefreshBanner").classList.remove("show");
      }

      /**
       * =========================================================
       * ADMINISTRACIÓN DE USUARIOS
       * =========================================================
       */

      function openUsersAdminModal() {
        if (!isCrmAdmin()) {
          alert("Solo un admin puede gestionar usuarios.");
          return;
        }

        const overlay = document.getElementById("usersAdminModalOverlay");
        if (!overlay) return;

        overlay.classList.add("open");
        loadAdminUsers();
      }

      function closeUsersAdminModal() {
        const overlay = document.getElementById("usersAdminModalOverlay");
        if (overlay) {
          overlay.classList.remove("open");
        }
      }

      async function loadAdminUsers() {
        const tableWrap = document.getElementById("adminUsersTableWrap");
        const statusBox = document.getElementById("adminUsersListStatus");

        if (!tableWrap || !statusBox) return;

        tableWrap.innerHTML = '<div class="loading">Cargando usuarios...</div>';
        statusBox.textContent = "";

        try {
          const res = await crmFetch(`${API_BASE}/admin/users`);
          const data = await res.json();

          if (!res.ok) {
            throw new Error(data.error || `HTTP ${res.status}`);
          }

          const users = Array.isArray(data.users) ? data.users : [];

          if (users.length === 0) {
            tableWrap.innerHTML =
              '<div class="empty">No hay usuarios cargados.</div>';
            return;
          }

          tableWrap.innerHTML = `
          <table class="admin-users-table">
            <thead>
              <tr>
                <th>Usuario</th>
                <th>Rol</th>
                <th>Activo</th>
                <th>Creado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              ${users
                .map(
                  (user) => `
                <tr>
                  <td>${escapeHtml(user.username || "")}</td>
                  <td>
                    <select
                      class="admin-inline-select"
                      onchange="changeAdminUserRole('${String(user.id || "").replaceAll("'", "\'")}', this.value, ${Number(user.is_active) === 1 ? "true" : "false"})"
                    >
                      <option value="admin" ${String(user.role) === "admin" ? "selected" : ""}>admin</option>
                      <option value="user" ${String(user.role) === "user" ? "selected" : ""}>user</option>
                    </select>
                  </td>
                  <td>${Number(user.is_active) === 1 ? "Sí" : "No"}</td>
                  <td>${escapeHtml(formatDate(user.created_at || ""))}</td>
                  <td>
                    <div class="admin-users-actions">
                      ${
                        Number(user.is_active) === 1
                          ? `<button class="deactivate-user" onclick="toggleAdminUserActive('${String(user.id || "").replaceAll("'", "\'")}', '${String(user.role || "user").replaceAll("'", "\'")}', false)">Desactivar</button>`
                          : `<button class="activate-user" onclick="toggleAdminUserActive('${String(user.id || "").replaceAll("'", "\'")}', '${String(user.role || "user").replaceAll("'", "\'")}', true)">Activar</button>`
                      }
                      <button class="reset-pass" onclick="resetAdminUserPassword('${String(user.id || "").replaceAll("'", "\'")}', '${String(user.username || "").replaceAll("'", "\'")}')">Reset password</button>
${Number(user.is_blocked) === 1
  ? `<button onclick="setUserBlockedState('${String(user.id || "").replaceAll("'", "\\'")}', '${String(user.role || "user").replaceAll("'", "\\'")}', ${Number(user.is_active) === 1 ? "true" : "false"}, false)">Desbloquear</button>`
  : `<button onclick="setUserBlockedState('${String(user.id || "").replaceAll("'", "\\'")}', '${String(user.role || "user").replaceAll("'", "\\'")}', ${Number(user.is_active) === 1 ? "true" : "false"}, true)">Bloquear</button>`
}
                    </div>
                  </td>
                </tr>
              `,
                )
                .join("")}
            </tbody>
          </table>
        `;
        } catch (error) {
          console.error(error);
          tableWrap.innerHTML =
            '<div class="empty">Error cargando usuarios.</div>';
          statusBox.textContent = "Error cargando usuarios: " + error.message;
        }
      }

      async function createAdminUser() {
        const usernameInput = document.getElementById("adminNewUsername");
        const passwordInput = document.getElementById("adminNewPassword");
        const roleSelect = document.getElementById("adminNewRole");
        const statusBox = document.getElementById("adminUsersCreateStatus");

        if (!usernameInput || !passwordInput || !roleSelect || !statusBox)
          return;

        const username = usernameInput.value.trim();
        const password = passwordInput.value;
        const role = roleSelect.value;

        if (!username || !password) {
          statusBox.textContent = "Usuario y contraseña son obligatorios.";
          return;
        }

        statusBox.textContent = "Creando usuario...";

        try {
          const res = await crmFetch(`${API_BASE}/admin/users`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              username,
              password,
              role,
            }),
          });

          const data = await res.json();

          if (!res.ok) {
            throw new Error(data.error || `HTTP ${res.status}`);
          }

          usernameInput.value = "";
          passwordInput.value = "";
          roleSelect.value = "user";

          statusBox.textContent = "Usuario creado correctamente.";
          await loadAdminUsers();
        } catch (error) {
          console.error(error);
          statusBox.textContent = "Error creando usuario: " + error.message;
        }
      }

      async function changeAdminUserRole(userId, role, isActive) {
        try {
          const res = await crmFetch(
            `${API_BASE}/admin/users/${encodeURIComponent(userId)}`,
            {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                role,
                is_active: isActive,
              }),
            },
          );

          const data = await res.json();

          if (!res.ok) {
            throw new Error(data.error || `HTTP ${res.status}`);
          }

          await loadAdminUsers();
        } catch (error) {
          console.error(error);
          alert("Error actualizando rol: " + error.message);
        }
      }

      async function toggleAdminUserActive(userId, role, nextIsActive) {
        try {
          const res = await crmFetch(
            `${API_BASE}/admin/users/${encodeURIComponent(userId)}`,
            {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                role,
                is_active: nextIsActive,
              }),
            },
          );

          const data = await res.json();

          if (!res.ok) {
            throw new Error(data.error || `HTTP ${res.status}`);
          }

          await loadAdminUsers();
        } catch (error) {
          console.error(error);
          alert("Error actualizando usuario: " + error.message);
        }
      }

function resetAdminUserPassword(userId, username) {
  openResetPasswordModal(userId, username);
}
	  
	  /**
 * Abre el modal interno para resetear contraseña de un usuario.
 */
function openResetPasswordModal(userId, username) {
  resetPasswordTargetUserId = userId;
  resetPasswordTargetUsername = username || '';

  const overlay = document.getElementById('resetPasswordModalOverlay');
  const input = document.getElementById('resetPasswordInput');
  const statusBox = document.getElementById('resetPasswordStatus');
  const sub = document.getElementById('resetPasswordModalSub');

  if (!overlay || !input || !statusBox || !sub) return;

  sub.textContent = `Definí una nueva contraseña para ${resetPasswordTargetUsername}`;
  input.value = '';
  statusBox.textContent = '';
  overlay.classList.add('open');

  setTimeout(() => {
    input.focus();
  }, 30);
}

/**
 * Cierra el modal de reset password.
 */
function closeResetPasswordModal() {
  const overlay = document.getElementById('resetPasswordModalOverlay');
  const input = document.getElementById('resetPasswordInput');
  const statusBox = document.getElementById('resetPasswordStatus');

  if (overlay) {
    overlay.classList.remove('open');
  }

  if (input) {
    input.value = '';
  }

  if (statusBox) {
    statusBox.textContent = '';
  }

  resetPasswordTargetUserId = null;
  resetPasswordTargetUsername = '';
}

/**
 * Confirma el reset password usando el modal interno.
 */
async function confirmResetAdminUserPassword() {
  const input = document.getElementById('resetPasswordInput');
  const statusBox = document.getElementById('resetPasswordStatus');
  const confirmBtn = document.getElementById('resetPasswordConfirmBtn');

  if (!input || !statusBox || !confirmBtn) return;
  if (!resetPasswordTargetUserId) return;

  const newPassword = input.value.trim();

  if (!newPassword) {
    statusBox.textContent = 'Ingresá una nueva contraseña.';
    return;
  }

  confirmBtn.disabled = true;
  statusBox.textContent = 'Guardando nueva contraseña...';

  try {
    const res = await crmFetch(
      `${API_BASE}/admin/users/${encodeURIComponent(resetPasswordTargetUserId)}/reset-password`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          newPassword
        })
      }
    );

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error || `HTTP ${res.status}`);
    }

    showToast('Contraseña reseteada correctamente', 'success');

    setTimeout(() => {
      closeResetPasswordModal();
    }, 500);
  } catch (error) {
    console.error(error);
    statusBox.textContent = 'Error reseteando contraseña: ' + error.message;
  } finally {
    confirmBtn.disabled = false;
  }
}

/**
 * Cambia el estado de bloqueo de un usuario usando
 * el mismo endpoint PUT /admin/users/:id.
 *
 * Esto unifica la lógica administrativa y evita
 * caminos paralelos inseguros.
 */
async function setUserBlockedState(userId, role, isActive, shouldBlock) {
  const actionLabel = shouldBlock ? 'bloquear' : 'desbloquear';

  if (!confirm(`¿Querés ${actionLabel} este usuario?`)) return;

  try {
    const res = await crmFetch(
      `${API_BASE}/admin/users/${encodeURIComponent(userId)}`,
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          role,
          is_active: isActive,
          is_blocked: shouldBlock
        })
      }
    );

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error || `Error al ${actionLabel} usuario`);
    }

    showToast(
      shouldBlock
        ? 'Usuario bloqueado correctamente'
        : 'Usuario desbloqueado correctamente',
      'success'
    );

    await loadAdminUsers();
  } catch (error) {
    console.error(error);
    alert(error.message);
  }
}
	
      function openWhatsApp(url) {
        if (!url) return;
        window.open(url, "_blank");
      }
	  
	        /**
       * Exporta los leads actualmente cargados en memoria a un archivo Excel.
       *
       * Fuente de datos:
       * - usa el array global allLeads
       *
       * Importante:
       * - exporta todos los leads cargados en el CRM
       * - no solo los visibles por filtros
       */
      function exportLeadsToExcel() {
        try {
          if (!Array.isArray(allLeads) || allLeads.length === 0) {
            alert("No hay leads para exportar.");
            return;
          }

          const rows = allLeads.map((lead) => ({
            ID: lead.id || "",
            Nombre: lead.name || lead.businessName || "",
            Telefono: lead.phone || "",
            Telefono_normalizado: lead.normalizedPhone || "",
            Categoria: formatCategory(lead),
            Estado_comercial: lead.status || "",
            Modo_operativo: formatControlMode(lead.controlMode),
            Canal: lead.channel || lead.source || "",
            Fuente: lead.source || "",
            Requiere_asesor: lead.requiresHuman ? "Sí" : "No",
            Lead_parcial: lead.partial ? "Sí" : "No",
            Lead_caliente: isHotLead(lead) ? "Sí" : "No",
            Plaga: lead.pest || "",
            Tipo_de_lugar: lead.placeType || "",
            Domicilio_servicio: lead.zone || "",
            Producto: lead.product || "",
            Tipo_de_local: lead.localType || "",
            Nombre_del_local: lead.businessName || "",
            Domicilio_del_local: lead.address || "",
            Motivo_admin: lead.adminReason || "",
            Nota_interna: lead.internalNote || "",
            Cantidad_mensajes: lead.messageCount || 0,
            Ultimo_mensaje: lead.lastMessageText || "",
            Ultimo_remitente: lead.lastMessageSender || "",
            Fecha_ultimo_mensaje: lead.lastMessageAt || "",
            Tomado_por: lead.takenBy || "",
            Session_ID: lead.sessionId || "",
            Step_sesion: lead.sessionStep || "",
            Creado: lead.createdAt || "",
            Actualizado: lead.updatedAt || ""
          }));

          const worksheet = XLSX.utils.json_to_sheet(rows);

          const columnWidths = [
            { wch: 18 }, // ID
            { wch: 24 }, // Nombre
            { wch: 18 }, // Telefono
            { wch: 20 }, // Telefono_normalizado
            { wch: 18 }, // Categoria
            { wch: 18 }, // Estado_comercial
            { wch: 18 }, // Modo_operativo
            { wch: 14 }, // Canal
            { wch: 14 }, // Fuente
            { wch: 16 }, // Requiere_asesor
            { wch: 14 }, // Lead_parcial
            { wch: 14 }, // Lead_caliente
            { wch: 20 }, // Plaga
            { wch: 20 }, // Tipo_de_lugar
            { wch: 28 }, // Domicilio_servicio
            { wch: 20 }, // Producto
            { wch: 20 }, // Tipo_de_local
            { wch: 24 }, // Nombre_del_local
            { wch: 28 }, // Domicilio_del_local
            { wch: 22 }, // Motivo_admin
            { wch: 30 }, // Nota_interna
            { wch: 16 }, // Cantidad_mensajes
            { wch: 40 }, // Ultimo_mensaje
            { wch: 18 }, // Ultimo_remitente
            { wch: 22 }, // Fecha_ultimo_mensaje
            { wch: 18 }, // Tomado_por
            { wch: 22 }, // Session_ID
            { wch: 18 }, // Step_sesion
            { wch: 22 }, // Creado
            { wch: 22 }  // Actualizado
          ];

          worksheet["!cols"] = columnWidths;

          const workbook = XLSX.utils.book_new();
          XLSX.utils.book_append_sheet(workbook, worksheet, "Leads");

          const now = new Date();
          const safeDate = now.toISOString().slice(0, 19).replace(/[:T]/g, "-");
          const fileName = `ofreser_leads_${safeDate}.xlsx`;

          XLSX.writeFile(workbook, fileName);

          showToast("Leads exportados correctamente.", "success");
        } catch (error) {
          console.error("Error exportando leads a Excel:", error);
          alert("Error exportando leads a Excel.");
        }
      }
	  
      /**
       * =========================================================
       * AUDITORÍA - UTILIDADES DE PRESENTACIÓN
       * =========================================================
       */
function formatAuditDetails(details) {
  if (!details) return "-";

  try {
    return JSON.stringify(details, null, 2);
  } catch {
    return String(details);
  }
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
 * =========================================================
 * BACKUPS - MODAL Y ACCIONES ADMIN
 * =========================================================
 */

/**
 * Abre el modal de backups.
 */
function openBackupsModal() {
  if (!isCrmAdmin()) {
    alert("Solo un admin puede gestionar backups.");
    return;
  }

  const overlay = document.getElementById("backupsModalOverlay");
  if (!overlay) return;

  overlay.classList.add("open");
  loadBackups();
}

/**
 * Cierra el modal de backups.
 */
function closeBackupsModal() {
  const overlay = document.getElementById("backupsModalOverlay");
  const statusBox = document.getElementById("backupsStatusBox");
  const listWrap = document.getElementById("backupsListWrap");

  if (overlay) {
    overlay.classList.remove("open");
  }

  if (statusBox) {
    statusBox.textContent = "";
  }

  if (listWrap) {
    listWrap.innerHTML = "";
  }
}

/**
 * Crea un backup manual desde el CRM.
 */
async function createSystemBackup() {
  const statusBox = document.getElementById("backupsStatusBox");
  if (!statusBox) return;

  statusBox.textContent = "Creando backup...";

  try {
    const res = await crmFetch(`${API_BASE}/admin/backup`, {
      method: "POST"
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error || `HTTP ${res.status}`);
    }

    statusBox.textContent = "Backup creado correctamente.";
    showToast("Backup creado correctamente", "success");

    await loadBackups();
  } catch (error) {
    console.error(error);
    statusBox.textContent = "Error creando backup: " + error.message;
  }
}

/**
 * Lista backups disponibles.
 */
async function loadBackups() {
  const statusBox = document.getElementById("backupsStatusBox");
  const listWrap = document.getElementById("backupsListWrap");

  if (!statusBox || !listWrap) return;

  statusBox.textContent = "Cargando backups...";
  listWrap.innerHTML = '<div class="loading">Cargando backups...</div>';

  try {
    const res = await crmFetch(`${API_BASE}/admin/backups`);
    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error || `HTTP ${res.status}`);
    }

    const backups = Array.isArray(data.backups) ? data.backups : [];

    statusBox.textContent = `Backups encontrados: ${backups.length}`;

    if (backups.length === 0) {
      listWrap.innerHTML = '<div class="empty">No hay backups disponibles.</div>';
      return;
    }

    listWrap.innerHTML = `
      <div class="audit-list">
        ${backups.map((backup) => `
          <div class="audit-item">
            <div class="audit-item-top">
              <div class="audit-action">${escapeHtml(backup.fileName || "")}</div>
              <div class="audit-date">${escapeHtml(formatDate(backup.modifiedAt || ""))}</div>
            </div>

            <div class="audit-friendly-lines">
              <div class="audit-friendly-line"><strong>Ruta:</strong> ${escapeHtml(backup.fullPath || "")}</div>
              <div class="audit-friendly-line"><strong>Tamaño:</strong> ${escapeHtml(String(backup.sizeBytes || 0))} bytes</div>
            </div>

            <div class="note-actions" style="margin-top:10px;">
              <button
                class="btn secondary"
                type="button"
                onclick="restoreSystemBackup('${String(backup.fullPath || "").replaceAll("\\", "\\\\").replaceAll("'", "\\'")}')"
              >
                Restaurar este backup
              </button>
            </div>
          </div>
        `).join("")}
      </div>
    `;
  } catch (error) {
    console.error(error);
    statusBox.textContent = "Error cargando backups: " + error.message;
    listWrap.innerHTML = '<div class="empty">No se pudieron cargar los backups.</div>';
  }
}

/**
 * Ejecuta un restore desde el CRM.
 *
 * IMPORTANTE:
 * - esto es delicado
 * - se recomienda usar solo en testing
 */
async function restoreSystemBackup(backupPath) {
  if (!backupPath) return;

  const confirmed = window.confirm(
    `Vas a restaurar este backup:\n\n${backupPath}\n\nEsto puede sobrescribir la base actual. ¿Querés continuar?`
  );

  if (!confirmed) {
    return;
  }

  const statusBox = document.getElementById("backupsStatusBox");
  if (statusBox) {
    statusBox.textContent = "Restaurando backup...";
  }

  try {
    const res = await crmFetch(`${API_BASE}/admin/restore`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ backupPath })
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error || `HTTP ${res.status}`);
    }

    if (statusBox) {
      statusBox.textContent = "Restore ejecutado correctamente.";
    }

    showToast("Restore ejecutado correctamente", "success");

    /**
     * Refrescamos leads después del restore.
     */
    closeDrawer();
    await loadLeads({ silent: false, preserveModal: false });
    await loadBackups();
  } catch (error) {
    console.error(error);

    if (statusBox) {
      statusBox.textContent = "Error restaurando backup: " + error.message;
    }
  }
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
	  
	  /**
 * Muestra una notificación tipo toast en pantalla.
 *
 * @param {string} message - Mensaje a mostrar
 * @param {'success'|'error'|'info'} type - Tipo de mensaje
 */
      /**
       * Notificación visual simple para acciones exitosas o errores controlados.
       */
function showToast(message, type = 'info') {
  const container = document.getElementById('toastContainer');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;

  container.appendChild(toast);

  setTimeout(() => {
    toast.remove();
  }, 3000);
}

      /**
       * Resetea completamente los datos de testing del sistema.
       *
       * Qué borra:
       * - leads
       * - mensajes
       * - sesiones
       *
       * Importante:
       * - solo usar para pruebas
       * - pide confirmación antes de ejecutar
       */
      
	  function resetTestingData() {
  openResetTestingModal();
}
	  
	  /**
 * Abre el modal de confirmación para reset de testing.
 */
/**
 * Abre el modal de confirmación antes de borrar datos de testing.
 */
function openResetTestingModal() {
  const overlay = document.getElementById('resetTestingModalOverlay');
  const statusBox = document.getElementById('resetTestingStatus');

  if (!overlay || !statusBox) return;

  statusBox.textContent = '';
  overlay.classList.add('open');
}

/**
 * Cierra el modal de reset testing.
 */
function closeResetTestingModal() {
  const overlay = document.getElementById('resetTestingModalOverlay');
  const statusBox = document.getElementById('resetTestingStatus');

  if (overlay) {
    overlay.classList.remove('open');
  }

  if (statusBox) {
    statusBox.textContent = '';
  }
}

/**
 * Ejecuta el reset real de datos de testing.
 */
async function confirmResetTestingData() {
  const statusBox = document.getElementById('resetTestingStatus');
  const confirmBtn = document.getElementById('resetTestingConfirmBtn');

  if (!statusBox || !confirmBtn) return;

  confirmBtn.disabled = true;
  statusBox.textContent = 'Reseteando datos de testing...';

  try {
    const res = await crmFetch(`${API_BASE}/admin/reset`, {
      method: 'POST'
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error || `HTTP ${res.status}`);
    }

    /**
     * Cerramos modales abiertos si existían.
     */
    closeDrawer();
    closeResetTestingModal();

    /**
     * Limpiamos estado local del CRM.
     */
    allLeads = [];
    currentLeadId = null;

    /**
     * Recargamos tablero ya vacío.
     */
    await loadLeads({ silent: false, preserveModal: false });
	showToast('Reset de testing ejecutado correctamente', 'success');

  } catch (error) {
    console.error(error);
    statusBox.textContent = 'Error reseteando datos de testing: ' + error.message;
  } finally {
    confirmBtn.disabled = false;
  }
}

      function startAutoRefresh() {
        if (autoRefreshTimer) clearInterval(autoRefreshTimer);
        autoRefreshTimer = setInterval(() => {
          loadLeads({ silent: true, preserveModal: true });
        }, 30000);
      }

      /**
       * Click fuera del modal = cerrar.
       */
      document
        .getElementById("leadModalOverlay")
        .addEventListener("click", function (e) {
          if (e.target === this) closeDrawer();
        });

      document
        .getElementById("usersAdminModalOverlay")
        .addEventListener("click", function (e) {
          if (e.target === this) closeUsersAdminModal();
        });
		
		document
  .getElementById("auditModalOverlay")
  .addEventListener("click", function (e) {
    if (e.target === this) closeAuditModal();
  });
		
		document
  .getElementById("backupsModalOverlay")
  .addEventListener("click", function (e) {
    if (e.target === this) closeBackupsModal();
  });
  
		document
  .getElementById('resetPasswordModalOverlay')
  .addEventListener('click', function (e) {
    if (e.target === this) closeResetPasswordModal();
  });
  
  document
  .getElementById('resetTestingModalOverlay')
  .addEventListener('click', function (e) {
    if (e.target === this) closeResetTestingModal();
  });

      /**
       * Filtros.
       */
      /**
 * Filtros del tablero.
 *
 * Regla actual:
 * - resetean paginación visual
 * - aplican filtro local sobre la página cargada
 */
searchInput.addEventListener("input", () => {
  resetLeadsPagination();
  applyFilters();
});

categoryFilter.addEventListener("change", () => {
  resetLeadsPagination();
  applyFilters();
});

statusFilter.addEventListener("change", () => {
  resetLeadsPagination();
  applyFilters();
});

controlFilter.addEventListener("change", () => {
  resetLeadsPagination();
  applyFilters();
});
	  
	 document
  .getElementById("auditUsernameFilter")
  .addEventListener("keydown", function (e) {
    if (e.key === "Enter") {
      loadAuditLogs();
    }
  });

document
  .getElementById("auditSearchFilter")
  .addEventListener("keydown", function (e) {
    if (e.key === "Enter") {
      loadAuditLogs();
    }
  });

document
  .getElementById("auditActionFilter")
  .addEventListener("change", function () {
    auditCurrentOffset = 0;
    loadAuditLogs();
  });

      /**
       * Una interacción mínima habilita audio en la mayoría de navegadores.
       */
      document.addEventListener(
        "click",
        async () => {
          if (!crmAudioUnlocked) {
            await unlockCrmAudio();
          }
        },
        { once: true },
      );

      document.addEventListener(
        "keydown",
        async () => {
          if (!crmAudioUnlocked) {
            await unlockCrmAudio();
          }
        },
        { once: true },
      );

      window.addEventListener("focus", async () => {
        if (crmAudioUnlocked) {
          await unlockCrmAudio();
        }
      });

      document.addEventListener("visibilitychange", async () => {
        if (document.visibilityState === "visible" && crmAudioUnlocked) {
          await unlockCrmAudio();
        }
      });
      /**
       * =========================================================
       * BOOTSTRAP Y AUTO REFRESH
       * =========================================================
       */
      /**
       * Bootstrap inicial.
       */
      async function bootstrapCrm() {
        if (crmBootstrapStarted) {
          return;
        }

        crmBootstrapStarted = true;

        const allowed = await ensureCrmAuthOrShowLogin();

        if (!allowed) {
          crmBootstrapStarted = false;
          return;
        }
        /**
         * Limpiamos el buscador al entrar al CRM.
         *
         * Esto evita que el navegador autocompletar
         * meta el username del login y filtre leads sin querer.
         */
        if (searchInput) {
          searchInput.value = "";
        }

updateSoundButtonUI();

try {
  const meRes = await crmFetch(`${API_BASE}/crm/me`);
  const meData = await meRes.json();

  if (meRes.ok && meData?.auth) {
    crmCurrentAuth = meData.auth;

    if (crmCurrentAuth.username) {
      localStorage.setItem("ofreser_crm_username", crmCurrentAuth.username);
    }

    if (crmCurrentAuth.role) {
      localStorage.setItem("ofreser_crm_role", crmCurrentAuth.role);
    }
  }
} catch (error) {
  console.error("No se pudo cargar /crm/me:", error);
}

renderCrmSessionBox();
applyCrmRolePermissions();
updateSessionActivityLabel();

        /**
         * Si el usuario ya había activado sonido antes,
         * intentamos rehidratar el contexto al abrir.
         * Si falla por política del navegador, no frenamos el CRM.
         */
        if (crmAudioUnlocked) {
          unlockCrmAudio().catch(() => {});
        }

/**
 * Al abrir el CRM arrancamos desde la primera página.
 */
resetLeadsPagination();

        /**
         * Primera carga real del tablero.
         */
        await loadLeads({ silent: false, preserveModal: true });

        /**
         * Fallback defensivo:
         * si por alguna razón el primer arranque no pobló allLeads,
         * reintentamos una vez más apenas después.
         *
         * Esto ayuda en recargas duras F5 donde el navegador termina
         * de estabilizar recursos unos milisegundos después.
         */
        setTimeout(async () => {
          try {
            if (allLeads.length === 0) {
              await loadLeads({ silent: true, preserveModal: true });
            }
          } catch (error) {
            console.error("Fallback de carga inicial del CRM falló:", error);
          }
        }, 400);

        startAutoRefresh();
      }

      /**
       * Arranque robusto:
       * - si el DOM ya está listo, ejecuta directo
       * - si no, espera a DOMContentLoaded
       */
      if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", bootstrapCrm, {
          once: true,
        });
      } else {
        bootstrapCrm();
      }