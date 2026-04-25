/**
 * =========================================================
 * OFRESER CRM - LEADS / API CORE
 * =========================================================
 *
 * Maneja:
 * - carga de leads
 * - paginación
 * - cambio de estado comercial
 * - control de sesión (bot/humano/cerrado)
 *
 * Depende de:
 * - crm-api.js
 * - crm-state.js
 * - crm-render.js
 * - crm-session-ui.js
 * - crm-audio.js
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