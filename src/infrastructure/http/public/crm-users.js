/**
 * =========================================================
 * OFRESER CRM - ADMINISTRACIÓN DE USUARIOS
 * =========================================================
 *
 * Maneja:
 * - listado de usuarios
 * - creación de usuarios
 * - cambio de rol
 * - activar/desactivar usuario
 * - bloquear/desbloquear
 * - reset de contraseña (modal)
 *
 * Depende de:
 * - crm-api.js
 * - crm-utils.js
 * - crm-session-ui.js (isCrmAdmin)
 * - crm-toast.js
 * - crm-state.js (variables globales)
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