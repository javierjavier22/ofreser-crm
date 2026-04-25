/**
 * =========================================================
 * OFRESER CRM - RENDER DEL TABLERO
 * =========================================================
 *
 * Maneja:
 * - render de cards
 * - filtros
 * - agrupación por columnas
 * - stats
 *
 * NO hace llamadas API
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