/**
 * =========================================================
 * OFRESER CRM - ESTADO GLOBAL DEL FRONTEND
 * =========================================================
 *
 * Este archivo centraliza variables globales usadas por el CRM.
 *
 * Importante:
 * - no contiene lógica
 * - no hace llamadas API
 * - no renderiza UI
 * - debe cargarse antes de crm.js
 */

const CRM_SOUND_STORAGE_KEY = "ofreser_crm_sound_enabled";

let allLeads = [];
let currentLeadId = null;
let autoRefreshTimer = null;
let crmCurrentAuth = null;

let leadsCurrentOffset = 0;
const LEADS_PAGE_SIZE = 20;
let leadsLastTotal = 0;

let auditCurrentOffset = 0;
const AUDIT_PAGE_SIZE = 20;
let auditLastTotal = 0;

let crmBootstrapStarted = false;
let crmHasCompletedInitialLoad = false;

let crmAudioUnlocked =
  localStorage.getItem(CRM_SOUND_STORAGE_KEY) === "1";

let crmAudioContext = null;

let isSendingHumanMessage = false;

let resetPasswordTargetUserId = null;
let resetPasswordTargetUsername = "";