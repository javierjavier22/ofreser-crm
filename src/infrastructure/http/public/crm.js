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