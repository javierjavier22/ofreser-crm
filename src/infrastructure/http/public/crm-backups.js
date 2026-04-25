/**
 * =========================================================
 * OFRESER CRM - BACKUPS
 * =========================================================
 *
 * Maneja:
 * - modal de backups
 * - creación de backup
 * - listado de backups
 * - restore de backup
 *
 * Depende de:
 * - crm-api.js
 * - crm-utils.js
 * - crm-session-ui.js (isCrmAdmin)
 * - crm-toast.js
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