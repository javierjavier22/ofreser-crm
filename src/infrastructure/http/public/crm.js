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
       * CONFIGURACIÓN GENERAL
       * =========================================================
       */
      


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
       * =========================================================
       * ROLES Y PERMISOS VISUALES
       * =========================================================
       */

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
       * =========================================================
       * ACCIONES CONTRA API
       * =========================================================
       */
      /**
       * Carga general de leads.
       */
	   







	
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