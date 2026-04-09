/**
 * ============================================
 * CRM LOGIN FRONTEND
 * ============================================
 *
 * ¿Qué hace este archivo?
 * -----------------------
 * Implementa el login visual real del CRM.
 *
 * Responsabilidades:
 * - mostrar pantalla de login cuando no hay token
 * - validar token actual
 * - hacer login contra /crm/login
 * - guardar token en localStorage
 * - guardar role del usuario autenticado
 * - manejar inactividad
 * - hacer logout
 * - exponer crmFetch() para el resto del CRM
 * - permitir cambio de contraseña del usuario logueado
 */

(function () {
  const CRM_API_BASE = window.location.origin;
  const CRM_TOKEN_STORAGE_KEY = 'ofreser_crm_token';
  const CRM_ROLE_STORAGE_KEY = 'ofreser_crm_role';
  const CRM_LAST_ACTIVITY_KEY = 'ofreser_crm_last_activity';

  /**
   * 2 horas de inactividad.
   */
  const CRM_INACTIVITY_LIMIT_MS = 2 * 60 * 60 * 1000;

  /**
   * Inserta estilos mínimos del login y del modal de cambio de contraseña.
   */
  function injectLoginStyles() {
    if (document.getElementById('crmLoginStyles')) return;

    const style = document.createElement('style');
    style.id = 'crmLoginStyles';
    style.textContent = `
      .crm-login-overlay,
      .crm-password-overlay {
        position: fixed;
        inset: 0;
        display: none;
        align-items: center;
        justify-content: center;
        background: rgba(2, 8, 23, 0.88);
        backdrop-filter: blur(6px);
        z-index: 99999;
        padding: 20px;
      }

      .crm-login-overlay.open,
      .crm-password-overlay.open {
        display: flex;
      }

      .crm-login-card,
      .crm-password-card {
        width: 100%;
        max-width: 420px;
        background: #0f172a;
        border: 1px solid #1e293b;
        border-radius: 20px;
        box-shadow: 0 24px 80px rgba(0,0,0,.45);
        padding: 24px;
        color: #e5e7eb;
        font-family: Arial, sans-serif;
      }

      .crm-login-title,
      .crm-password-title {
        margin: 0 0 8px;
        font-size: 28px;
        font-weight: 800;
      }

      .crm-login-sub,
      .crm-password-sub {
        margin: 0 0 18px;
        color: #94a3b8;
        font-size: 14px;
        line-height: 1.45;
      }

      .crm-login-field,
      .crm-password-field {
        margin-bottom: 12px;
      }

      .crm-login-label,
      .crm-password-label {
        display: block;
        margin-bottom: 6px;
        font-size: 13px;
        color: #cbd5e1;
        font-weight: 700;
      }

      .crm-login-input,
      .crm-password-input {
        width: 100%;
        padding: 12px 14px;
        border-radius: 12px;
        border: 1px solid #334155;
        background: #111827;
        color: #e5e7eb;
        font-size: 14px;
        outline: none;
      }

      .crm-login-input:focus,
      .crm-password-input:focus {
        border-color: #3b82f6;
        box-shadow: 0 0 0 3px rgba(59,130,246,.15);
      }

      .crm-login-button,
      .crm-password-button {
        width: 100%;
        padding: 12px 14px;
        border-radius: 12px;
        border: none;
        cursor: pointer;
        background: #16a34a;
        color: white;
        font-size: 14px;
        font-weight: 800;
      }

      .crm-login-button:hover,
      .crm-password-button:hover {
        background: #15803d;
      }

      .crm-login-button:disabled,
      .crm-password-button:disabled {
        opacity: .7;
        cursor: not-allowed;
      }

      .crm-login-error,
      .crm-password-error {
        min-height: 20px;
        margin-top: 12px;
        color: #fca5a5;
        font-size: 13px;
      }

      .crm-password-actions {
        display: flex;
        gap: 10px;
        margin-top: 10px;
      }

      .crm-password-cancel {
        width: 100%;
        padding: 12px 14px;
        border-radius: 12px;
        border: none;
        cursor: pointer;
        background: #334155;
        color: white;
        font-size: 14px;
        font-weight: 800;
      }

      .crm-password-cancel:hover {
        background: #3f5168;
      }
    `;
    document.head.appendChild(style);
  }

  /**
   * Inserta el overlay del login.
   */
  function injectLoginOverlay() {
    if (document.getElementById('crmLoginOverlay')) return;

    const wrapper = document.createElement('div');
    wrapper.id = 'crmLoginOverlay';
    wrapper.className = 'crm-login-overlay';
    wrapper.innerHTML = `
      <div class="crm-login-card">
        <h2 class="crm-login-title">Ingresar al CRM</h2>
        <p class="crm-login-sub">
          Acceso restringido al panel interno de Ofreser.
        </p>

        <form id="crmLoginForm">
          <div class="crm-login-field">
            <label class="crm-login-label" for="crmLoginUsername">Usuario</label>
            <input
              id="crmLoginUsername"
              class="crm-login-input"
              type="text"
              autocomplete="username"
              required
            />
          </div>

          <div class="crm-login-field">
            <label class="crm-login-label" for="crmLoginPassword">Contraseña</label>
            <input
              id="crmLoginPassword"
              class="crm-login-input"
              type="password"
              autocomplete="current-password"
              required
            />
          </div>

          <button id="crmLoginSubmit" class="crm-login-button" type="submit">
            Entrar
          </button>

          <div id="crmLoginError" class="crm-login-error"></div>
        </form>
      </div>
    `;

    document.body.appendChild(wrapper);

    const form = document.getElementById('crmLoginForm');
    form.addEventListener('submit', onLoginSubmit);
  }

  /**
   * Inserta el modal de cambio de contraseña.
   */
  function injectChangePasswordOverlay() {
    if (document.getElementById('crmPasswordOverlay')) return;

    const wrapper = document.createElement('div');
    wrapper.id = 'crmPasswordOverlay';
    wrapper.className = 'crm-password-overlay';
    wrapper.innerHTML = `
      <div class="crm-password-card">
        <h2 class="crm-password-title">Cambiar contraseña</h2>
        <p class="crm-password-sub">
          Actualizá tu contraseña de acceso al CRM.
        </p>

        <form id="crmPasswordForm">
          <div class="crm-password-field">
            <label class="crm-password-label" for="crmCurrentPassword">Contraseña actual</label>
            <input
              id="crmCurrentPassword"
              class="crm-password-input"
              type="password"
              autocomplete="current-password"
              required
            />
          </div>

          <div class="crm-password-field">
            <label class="crm-password-label" for="crmNewPassword">Nueva contraseña</label>
            <input
              id="crmNewPassword"
              class="crm-password-input"
              type="password"
              autocomplete="new-password"
              required
            />
          </div>

          <div class="crm-password-field">
            <label class="crm-password-label" for="crmConfirmPassword">Confirmar nueva contraseña</label>
            <input
              id="crmConfirmPassword"
              class="crm-password-input"
              type="password"
              autocomplete="new-password"
              required
            />
          </div>

          <div class="crm-password-actions">
            <button id="crmPasswordSubmit" class="crm-password-button" type="submit">
              Guardar nueva contraseña
            </button>
            <button id="crmPasswordCancel" class="crm-password-cancel" type="button">
              Cancelar
            </button>
          </div>

          <div id="crmPasswordError" class="crm-password-error"></div>
        </form>
      </div>
    `;

    document.body.appendChild(wrapper);

    document
      .getElementById('crmPasswordForm')
      .addEventListener('submit', onChangePasswordSubmit);

    document
      .getElementById('crmPasswordCancel')
      .addEventListener('click', closeChangePasswordOverlay);

    wrapper.addEventListener('click', function (e) {
      if (e.target === wrapper) {
        closeChangePasswordOverlay();
      }
    });
  }

  /**
   * Inserta el botón visual "Mi contraseña" dentro de la barra superior del CRM.
   *
   * No depende de index_crm.html.
   * Si encuentra .top-actions, agrega el botón.
   */
  function injectChangePasswordButton() {
    if (document.getElementById('crmChangePasswordBtn')) return;

    const topActions = document.querySelector('.top-actions');
    if (!topActions) return;

    const btn = document.createElement('button');
    btn.id = 'crmChangePasswordBtn';
    btn.className = 'btn secondary';
    btn.type = 'button';
    btn.textContent = 'Mi contraseña';
    btn.addEventListener('click', openChangePasswordOverlay);

    /**
     * Lo insertamos antes del botón "Salir" si existe.
     */
    const logoutBtn = Array.from(topActions.querySelectorAll('button'))
      .find(button => button.textContent.trim().toLowerCase() === 'salir');

    if (logoutBtn) {
      topActions.insertBefore(btn, logoutBtn);
      return;
    }

    topActions.appendChild(btn);
  }

  function getStoredCrmToken() {
    return localStorage.getItem(CRM_TOKEN_STORAGE_KEY) || '';
  }

  function setStoredCrmToken(token) {
    localStorage.setItem(CRM_TOKEN_STORAGE_KEY, token);
  }

  function clearStoredCrmToken() {
    localStorage.removeItem(CRM_TOKEN_STORAGE_KEY);
  }

  /**
   * Devuelve el role guardado del usuario autenticado.
   */
  function getStoredCrmRole() {
    return localStorage.getItem(CRM_ROLE_STORAGE_KEY) || '';
  }

  /**
   * Guarda el role del usuario autenticado.
   */
  function setStoredCrmRole(role) {
    localStorage.setItem(CRM_ROLE_STORAGE_KEY, String(role || 'user'));
  }

  /**
   * Limpia el role guardado.
   */
  function clearStoredCrmRole() {
    localStorage.removeItem(CRM_ROLE_STORAGE_KEY);
  }

  function updateLastActivity() {
    localStorage.setItem(CRM_LAST_ACTIVITY_KEY, String(Date.now()));
  }

  function getLastActivity() {
    const value = localStorage.getItem(CRM_LAST_ACTIVITY_KEY);
    return value ? Number(value) : 0;
  }

  function clearLastActivity() {
    localStorage.removeItem(CRM_LAST_ACTIVITY_KEY);
  }

  function openLoginOverlay() {
    injectLoginStyles();
    injectLoginOverlay();
    injectChangePasswordOverlay();

    const overlay = document.getElementById('crmLoginOverlay');
    overlay.classList.add('open');

    const usernameInput = document.getElementById('crmLoginUsername');
    if (usernameInput) {
      setTimeout(() => usernameInput.focus(), 30);
    }
  }

  function closeLoginOverlay() {
    const overlay = document.getElementById('crmLoginOverlay');
    if (overlay) {
      overlay.classList.remove('open');
    }
  }

  function openChangePasswordOverlay() {
    injectLoginStyles();
    injectChangePasswordOverlay();

    const overlay = document.getElementById('crmPasswordOverlay');
    const errorBox = document.getElementById('crmPasswordError');

    if (errorBox) {
      errorBox.textContent = '';
    }

    const currentPassword = document.getElementById('crmCurrentPassword');
    const newPassword = document.getElementById('crmNewPassword');
    const confirmPassword = document.getElementById('crmConfirmPassword');

    if (currentPassword) currentPassword.value = '';
    if (newPassword) newPassword.value = '';
    if (confirmPassword) confirmPassword.value = '';

    overlay.classList.add('open');

    if (currentPassword) {
      setTimeout(() => currentPassword.focus(), 30);
    }
  }

  function closeChangePasswordOverlay() {
    const overlay = document.getElementById('crmPasswordOverlay');
    if (overlay) {
      overlay.classList.remove('open');
    }
  }

  /**
   * Fetch autenticado del CRM.
   */
/**
 * Flag defensivo para evitar múltiples recargas
 * si varias requests devuelven 401 al mismo tiempo.
 */
let crmAuthRedirectInProgress = false;

/**
 * Fetch autenticado del CRM.
 *
 * Mejora:
 * - si el backend responde 401, limpiamos sesión local
 * - evitamos loops raros del auto refresh
 * - forzamos recarga para volver al login
 */
async function crmFetch(url, options = {}) {
  const token = getStoredCrmToken();
  const incomingHeaders = options.headers || {};

  const headers = {
    ...incomingHeaders
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(url, {
    ...options,
    headers
  });

  /**
   * Si el backend responde 401, la sesión dejó de ser válida.
   *
   * Hacemos limpieza local y recargamos una sola vez.
   */
  if (response.status === 401 && !crmAuthRedirectInProgress) {
    crmAuthRedirectInProgress = true;

    clearStoredCrmToken();
    clearStoredCrmRole();
    clearLastActivity();

    window.location.reload();
  }

  return response;
}

  /**
   * Valida si el token actual sigue siendo válido.
   */
  async function validateCrmSession() {
    const token = getStoredCrmToken();

    if (!token) return false;

    try {
      const res = await fetch(`${CRM_API_BASE}/crm/me`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      if (!res.ok) {
        return false;
      }

      /**
       * Si el backend devuelve role, lo persistimos
       * para que el CRM pueda adaptar la interfaz.
       */
      const data = await res.json();

      if (data?.auth?.role) {
        setStoredCrmRole(data.auth.role);
      }

      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Garantiza autenticación o muestra login.
   */
  async function ensureCrmAuthOrShowLogin() {
    const token = getStoredCrmToken();

    if (!token) {
      openLoginOverlay();
      return false;
    }

    /**
     * Validación por inactividad.
     */
    const lastActivity = getLastActivity();
    const now = Date.now();

    if (!lastActivity || now - lastActivity > CRM_INACTIVITY_LIMIT_MS) {
      clearStoredCrmToken();
      clearStoredCrmRole();
      clearLastActivity();
      openLoginOverlay();
      return false;
    }

    /**
     * Validación contra backend.
     */
    const isValid = await validateCrmSession();

    if (isValid) {
      updateLastActivity();
      closeLoginOverlay();
      injectChangePasswordButton();
      return true;
    }

    clearStoredCrmToken();
    clearStoredCrmRole();
    clearLastActivity();
    openLoginOverlay();
    return false;
  }

  /**
   * Submit del formulario de login.
   */
  async function onLoginSubmit(event) {
    event.preventDefault();

    const username = document.getElementById('crmLoginUsername').value.trim();
    const password = document.getElementById('crmLoginPassword').value;
    const submitBtn = document.getElementById('crmLoginSubmit');
    const errorBox = document.getElementById('crmLoginError');

    errorBox.textContent = '';
    submitBtn.disabled = true;
    submitBtn.textContent = 'Ingresando...';

    try {
      const res = await fetch(`${CRM_API_BASE}/crm/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ username, password })
      });

      const data = await res.json();

if (!res.ok) {
  throw new Error(
    data.error ||
    data.message ||
    `HTTP ${res.status}`
  );
}

      setStoredCrmToken(data.token);
      setStoredCrmRole(data.role || 'user');
      updateLastActivity();
      closeLoginOverlay();

      /**
       * Recomendación:
       * recargar para reiniciar el flujo del CRM
       * ya autenticado.
       */
      window.location.reload();

    } catch (error) {
      errorBox.textContent = error.message || 'No se pudo iniciar sesión';
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Entrar';
    }
  }

  /**
   * Submit del formulario de cambio de contraseña.
   */
  async function onChangePasswordSubmit(event) {
    event.preventDefault();

    const currentPassword = document.getElementById('crmCurrentPassword').value;
    const newPassword = document.getElementById('crmNewPassword').value;
    const confirmPassword = document.getElementById('crmConfirmPassword').value;

    const submitBtn = document.getElementById('crmPasswordSubmit');
    const errorBox = document.getElementById('crmPasswordError');

    errorBox.textContent = '';

    if (!currentPassword || !newPassword || !confirmPassword) {
      errorBox.textContent = 'Todos los campos son obligatorios.';
      return;
    }

    if (newPassword.length < 6) {
      errorBox.textContent = 'La nueva contraseña debe tener al menos 6 caracteres.';
      return;
    }

    if (newPassword !== confirmPassword) {
      errorBox.textContent = 'La confirmación no coincide con la nueva contraseña.';
      return;
    }

    if (currentPassword === newPassword) {
      errorBox.textContent = 'La nueva contraseña no puede ser igual a la actual.';
      return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = 'Guardando...';

    try {
      const res = await crmFetch(`${CRM_API_BASE}/crm/change-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          currentPassword,
          newPassword
        })
      });

      const data = await res.json();

if (!res.ok) {
  throw new Error(
    data.error ||
    data.message ||
    `HTTP ${res.status}`
  );
}

      closeChangePasswordOverlay();
      alert('Contraseña actualizada correctamente.');
    } catch (error) {
      errorBox.textContent = error.message || 'No se pudo cambiar la contraseña.';
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Guardar nueva contraseña';
    }
  }

  /**
   * Logout del CRM.
   */
  async function logoutCrm() {
    const token = getStoredCrmToken();

    try {
      if (token) {
        await fetch(`${CRM_API_BASE}/crm/logout`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`
          }
        });
      }
    } catch (error) {
      // Ignoramos error de red en logout
    }

    clearStoredCrmToken();
    clearStoredCrmRole();
    clearLastActivity();
    window.location.reload();
  }

  /**
   * Detecta actividad del usuario para timeout por inactividad.
   */
  ['click', 'keydown', 'mousemove'].forEach(eventName => {
    window.addEventListener(eventName, updateLastActivity);
  });

  /**
   * Cuando el DOM está listo:
   * - inyectamos estilos
   * - inyectamos overlays
   * - si existe .top-actions, agregamos el botón de cambio de contraseña
   */
  function bootstrapCrmLoginUi() {
    injectLoginStyles();
    injectLoginOverlay();
    injectChangePasswordOverlay();
    injectChangePasswordButton();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootstrapCrmLoginUi, { once: true });
  } else {
    bootstrapCrmLoginUi();
  }

  /**
   * Exponemos funciones globales para el CRM actual.
   */
  window.crmFetch = crmFetch;
  window.ensureCrmAuthOrShowLogin = ensureCrmAuthOrShowLogin;
  window.logoutCrm = logoutCrm;
  window.getStoredCrmRole = getStoredCrmRole;
})();