/**
 * =========================================================
 * OFRESER CRM - ACCIONES GENERALES
 * =========================================================
 *
 * Maneja:
 * - apertura de WhatsApp
 * - exportación a Excel
 * - reset de datos de testing
 *
 * Depende de:
 * - crm-api.js
 * - crm-utils.js
 * - crm-leads.js
 * - crm-drawer.js
 * - crm-toast.js
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