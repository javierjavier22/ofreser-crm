/**
 * =========================================================
 * OFRESER CRM - AUDIO Y NOTIFICACIONES SONORAS
 * =========================================================
 *
 * Este archivo maneja:
 * - estado visual del botón de sonido
 * - desbloqueo de audio del navegador
 * - sonido de nuevo lead
 * - activación manual de sonido
 *
 * Importante:
 * - depende de variables globales declaradas en crm-state.js
 * - debe cargarse después de crm-state.js
 * - debe cargarse antes de crm.js
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

async function unlockCrmAudio() {
  try {
    const AudioContextClass =
      window.AudioContext || window.webkitAudioContext;

    if (!AudioContextClass) {
      return false;
    }

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

async function playNewLeadSound() {
  if (!crmAudioUnlocked) return;

  try {
    const AudioContextClass =
      window.AudioContext || window.webkitAudioContext;

    if (!AudioContextClass) {
      return;
    }

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
    console.error("No se pudo reproducir el sonido de nuevo lead:", error);
  }
}

async function activateCrmSound() {
  const unlocked = await unlockCrmAudio();

  if (!unlocked) {
    alert("No se pudo activar el sonido en este navegador.");
    return;
  }

  await playNewLeadSound();
}