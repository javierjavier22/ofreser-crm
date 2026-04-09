/**
 * lead-scorer.js
 * 
 * Este módulo se encarga de analizar el estado de la conversación
 * y calcular un score de calidad del lead basado en:
 * - intención detectada
 * - historial de conversación
 * - señales claras del usuario (teléfono, dirección, plaga, etc.)
 * 
 * Devuelve:
 * - score numérico (0–100)
 * - categoría del lead (cold, warm, hot)
 */

function scoreLead(sessionData) {
  let score = 0;

  const history = sessionData.conversationHistory || [];
  const lastIntent = sessionData.lastIntent || "unknown";

  // -----------------------------
  // 📌 1. INTENCIÓN
  // -----------------------------
  if (lastIntent === "quote_request") score += 30;
  if (lastIntent === "service_request") score += 40;
  if (lastIntent === "faq") score += 10;

  // -----------------------------
  // 📌 2. LONGITUD DE CONVERSACIÓN
  // -----------------------------
  if (history.length >= 3) score += 10;
  if (history.length >= 6) score += 10;

  // -----------------------------
  // 📌 3. DATOS CLAVE
  // -----------------------------
  const text = history.map(m => m.text).join(" ").toLowerCase();

  if (text.match(/\d{6,}/)) score += 20; // teléfono
  if (text.includes("direccion") || text.includes("domicilio")) score += 15;
  if (text.includes("casa") || text.includes("departamento")) score += 10;
  if (text.includes("cucaracha") || text.includes("rata") || text.includes("plaga")) score += 15;

  // -----------------------------
  // 📌 4. NORMALIZAR
  // -----------------------------
  if (score > 100) score = 100;

  // -----------------------------
  // 📌 5. CATEGORIZACIÓN
  // -----------------------------
  let category = "cold";

  if (score >= 60) category = "hot";
  else if (score >= 30) category = "warm";

  return {
    score,
    category
  };
}

module.exports = {
  scoreLead
};