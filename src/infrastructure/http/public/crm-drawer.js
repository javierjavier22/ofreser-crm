/**
 * =========================================================
 * OFRESER CRM - DRAWER / DETALLE DE LEAD
 * =========================================================
 *
 * Maneja:
 * - render de conversación
 * - scroll inteligente
 * - nota interna
 * - envío de mensajes humanos
 * - apertura/cierre del drawer
 *
 * Depende de:
 * - crm-api.js
 * - crm-state.js
 * - crm-utils.js
 * - crm-leads.js
 * - crm-render.js
 */
      function renderConversationMessages(messages) {
        if (!Array.isArray(messages) || messages.length === 0) {
          return `
          <div class="detail-line">No hay mensajes registrados.</div>
        `;
        }

        return messages
          .map((msg) => {
            let senderClass = "bot";
            let senderLabel = "Bot";

            if (msg.senderType === "user") {
              senderClass = "user";
              senderLabel = "Cliente";
            }

            if (msg.senderType === "human") {
              senderClass = "human";
              senderLabel = "Asesor";
            }

            return `
          <div class="msg ${senderClass}">
            ${escapeHtml(msg.text || "")}
            <div class="msg-meta">${escapeHtml(senderLabel)} · ${escapeHtml(formatDate(msg.createdAt))}</div>
          </div>
        `;
          })
          .join("");
      }

      /**
       * Hace scroll automático al último mensaje.
       */
      function scrollConversationToBottom(force = false) {
        const container = document.getElementById("conversationThread");
        if (!container) return;

        /**
         * Solo forzamos scroll si:
         * - el caller lo pide explícitamente
         * - o el usuario ya estaba cerca del final
         *
         * Esto evita que el CRM "salte" hacia abajo
         * cuando alguien está leyendo mensajes viejos.
         */
        const distanceFromBottom =
          container.scrollHeight - container.scrollTop - container.clientHeight;
        const isNearBottom = distanceFromBottom < 120;

        if (force || isNearBottom) {
          container.scrollTop = container.scrollHeight;
        }
      }

      /**
       * Guarda nota interna.
       */
      async function saveInternalNote(leadId) {
        const textarea = document.getElementById("internalNoteInput");
        const statusBox = document.getElementById("noteSaveStatus");
        if (!textarea || !statusBox) return;

        const note = textarea.value;
        statusBox.textContent = "Guardando nota...";

        try {
          const res = await crmFetch(`${API_BASE}/leads/${leadId}/note`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ note }),
          });

          if (!res.ok) throw new Error(`HTTP ${res.status}`);

          const data = await res.json();
          const updatedLead = data.lead;
          const index = allLeads.findIndex((x) => x.id === leadId);
          if (index !== -1) allLeads[index] = updatedLead;

          statusBox.textContent = "Nota guardada correctamente";
          document
            .getElementById("modalRefreshBanner")
            .classList.remove("show");
          applyFilters();
        } catch (error) {
          console.error(error);
          statusBox.textContent = "Error guardando nota: " + error.message;
        }
      }

      /**
       * Envía mensaje humano desde el CRM.
       *
       * REGLA:
       * Solo se envía si la conversación está en HUMANO.
       */
      async function sendHumanMessage(leadId, sessionId, controlMode) {
        const textarea = document.getElementById("humanMessageInput");
        const statusBox = document.getElementById("humanSendStatus");
        const button = document.getElementById("humanSendButton");

        if (!textarea || !statusBox || !button) return;

        if (isSendingHumanMessage) {
          return;
        }

        const text = textarea.value.trim();

        if (!text) {
          statusBox.textContent = "Escribí un mensaje antes de enviar.";
          return;
        }

        if (String(controlMode || "bot").toLowerCase() !== "human") {
          statusBox.textContent =
            "Solo se puede enviar mensaje manual cuando la conversación está en HUMANO.";
          return;
        }

        isSendingHumanMessage = true;
        statusBox.textContent = "Enviando mensaje al cliente...";
        button.disabled = true;

        try {
          const res = await crmFetch(
            `${API_BASE}/sessions/${encodeURIComponent(sessionId)}/human-message`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ text }),
            },
          );

          const data = await res.json();

          if (!res.ok) {
            throw new Error(data.error || `HTTP ${res.status}`);
          }

          textarea.value = "";
          statusBox.textContent = "Mensaje enviado correctamente.";

          /**
           * Refrescamos datos generales y luego reabrimos
           * el drawer para ver el nuevo mensaje ya persistido.
           */
          await loadLeads({ silent: false, preserveModal: true });
          await openDrawer(leadId, true);

          /**
           * Después del re-render forzamos scroll al final
           * porque este caso sí representa una acción nueva del asesor.
           */
          setTimeout(() => scrollConversationToBottom(true), 30);
        } catch (error) {
          console.error(error);
          statusBox.textContent = "Error enviando mensaje: " + error.message;
        } finally {
          isSendingHumanMessage = false;
          button.disabled = false;
        }
      }

      /**
       * Maneja Enter para enviar y Shift+Enter para salto de línea.
       */
      function attachHumanComposerEvents(leadId, sessionId, controlMode) {
        const textarea = document.getElementById("humanMessageInput");
        if (!textarea) return;

        /**
         * Enter envía
         * Shift + Enter agrega salto de línea
         */
        textarea.addEventListener("keydown", async function (e) {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            await sendHumanMessage(leadId, sessionId, controlMode);
          }
        });
      }
      /**
       * =========================================================
       * DRAWER / DETALLE DEL LEAD
       * =========================================================
       */
      /**
       * Abre drawer/modal de lead.
       */
      async function openDrawer(leadId, silentRefresh = false) {
        const lead = allLeads.find((x) => x.id === leadId);
        if (!lead) return;

        currentLeadId = leadId;

        const overlay = document.getElementById("leadModalOverlay");
        const left = document.getElementById("drawerLeft");
        const right = document.getElementById("drawerRight");
        const banner = document.getElementById("modalRefreshBanner");

        banner.classList.remove("show");
        overlay.classList.add("open");

        if (!silentRefresh) {
          left.innerHTML = `
          <div class="detail-block">
            <div class="detail-title">Cargando</div>
            <div class="loading">Cargando detalle y conversación...</div>
          </div>
        `;
          right.innerHTML = "";
        }

        try {
          const data = await fetchLeadConversation(leadId);
          const fullLead = data.lead || lead;
          const messages = data.messages || [];
          const session = data.session || null;
          const waUrl = buildWhatsAppUrl(
            fullLead.phone,
            fullLead.normalizedPhone,
          );

          document.getElementById("modalLeadTitle").textContent =
            fullLead.name || fullLead.businessName || "Detalle del lead";
          document.getElementById("modalLeadSub").textContent =
            `${formatCategory(fullLead)} · ${fullLead.status || "nuevo"} · ${formatDate(fullLead.createdAt)}`;

          const isHumanMode =
            String(fullLead.controlMode || "bot").toLowerCase() === "human";

          left.innerHTML = `
          <div class="detail-block">
            <div class="detail-title">General</div>
            <div class="detail-grid">
              <div class="detail-line"><strong>ID:</strong> ${escapeHtml(fullLead.id)}</div>
              <div class="detail-line"><strong>Estado comercial:</strong> ${escapeHtml(fullLead.status || "-")}</div>
              <div class="detail-line"><strong>Modo operativo:</strong> ${escapeHtml(formatControlMode(fullLead.controlMode))}</div>
              <div class="detail-line"><strong>Categoría:</strong> ${escapeHtml(formatCategory(fullLead))}</div>
              <div class="detail-line"><strong>Creado:</strong> ${escapeHtml(formatDate(fullLead.createdAt))}</div>
              <div class="detail-line"><strong>Actualizado:</strong> ${escapeHtml(formatDate(fullLead.updatedAt || ""))}</div>
              <div class="detail-line"><strong>Total mensajes:</strong> ${escapeHtml(String(fullLead.messageCount || 0))}</div>
              <div class="detail-line"><strong>Último mensaje:</strong> ${escapeHtml(formatDate(fullLead.lastMessageAt || ""))}</div>
            </div>
          </div>

          <div class="detail-block">
            <div class="detail-title">Control de conversación</div>
            <div class="control-panel">
              <div class="badges">
                ${buildControlBadge(fullLead.controlMode)}
                ${fullLead.requiresHuman ? '<span class="badge human">Requiere asesor</span>' : ""}
              </div>

              <div class="detail-line"><strong>Session ID:</strong> ${escapeHtml(fullLead.sessionId || "-")}</div>
              <div class="detail-line"><strong>Step:</strong> ${escapeHtml(fullLead.sessionStep || session?.step || "-")}</div>
              <div class="detail-line"><strong>Tomado por:</strong> ${escapeHtml(fullLead.takenBy || "-")}</div>
              <div class="detail-line"><strong>Solicitado humano:</strong> ${escapeHtml(formatDate(fullLead.humanRequestedAt || ""))}</div>
              <div class="detail-line"><strong>Tomado humano:</strong> ${escapeHtml(formatDate(fullLead.humanTakenAt || ""))}</div>
              <div class="detail-line"><strong>Devuelto al bot:</strong> ${escapeHtml(formatDate(fullLead.humanReleasedAt || ""))}</div>
              <div class="detail-line"><strong>Cerrado:</strong> ${escapeHtml(formatDate(fullLead.closedAt || ""))}</div>

              <div class="control-actions">
                ${
                  fullLead.controlMode !== "human"
                    ? `
                  <button class="take-human" onclick="changeSessionControl('${fullLead.sessionId}', 'human', '${fullLead.id}')">
                    Tomar como humano
                  </button>
                `
                    : ""
                }

                ${
                  fullLead.controlMode !== "bot"
                    ? `
                  <button class="return-bot" onclick="changeSessionControl('${fullLead.sessionId}', 'bot', '${fullLead.id}')">
                    Devolver al bot
                  </button>
                `
                    : ""
                }

                ${
                  fullLead.controlMode !== "closed"
                    ? `
                  <button class="close-session" onclick="changeSessionControl('${fullLead.sessionId}', 'closed', '${fullLead.id}')">
                    Cerrar conversación
                  </button>
                `
                    : ""
                }
              </div>
            </div>
          </div>

          <div class="detail-block">
            <div class="detail-title">Acciones rápidas</div>
            <div class="toolbar">
              ${waUrl ? `<button class="btn whatsapp small" onclick="openWhatsApp('${waUrl}')">Abrir WhatsApp del cliente</button>` : ""}
              <button class="btn secondary small" onclick="updateStatus('${fullLead.id}', 'seguimiento')">Mover a seguimiento</button>
              <button class="btn secondary small" onclick="updateStatus('${fullLead.id}', 'cerrado')">Cerrar lead</button>
            </div>
          </div>

          <div class="detail-block">
            <div class="detail-title">Cliente</div>
            <div class="detail-line"><strong>Nombre:</strong> ${escapeHtml(fullLead.name || "-")}</div>
            <div class="detail-line"><strong>Teléfono:</strong> ${escapeHtml(fullLead.phone || "-")}</div>
            <div class="detail-line"><strong>Teléfono normalizado:</strong> ${escapeHtml(fullLead.normalizedPhone || "-")}</div>
            <div class="detail-line"><strong>Canal:</strong> ${escapeHtml(fullLead.channel || fullLead.source || "-")}</div>
            <div class="detail-line"><strong>Origen:</strong> ${escapeHtml(fullLead.source || "-")}</div>
          </div>

          <div class="detail-block">
            <div class="detail-title">Detalle de consulta</div>
            <div class="detail-line"><strong>Plaga:</strong> ${escapeHtml(fullLead.pest || "-")}</div>
            <div class="detail-line"><strong>Tipo de lugar:</strong> ${escapeHtml(fullLead.placeType || "-")}</div>
            <div class="detail-line"><strong>Domicilio servicio:</strong> ${escapeHtml(fullLead.zone || "-")}</div>
            <div class="detail-line"><strong>Producto:</strong> ${escapeHtml(fullLead.product || "-")}</div>
            <div class="detail-line"><strong>Tipo de local:</strong> ${escapeHtml(fullLead.localType || "-")}</div>
            <div class="detail-line"><strong>Nombre del local:</strong> ${escapeHtml(fullLead.businessName || "-")}</div>
            <div class="detail-line"><strong>Domicilio del local:</strong> ${escapeHtml(fullLead.address || "-")}</div>
            <div class="detail-line"><strong>Motivo admin:</strong> ${escapeHtml(fullLead.adminReason || "-")}</div>
          </div>

          <div class="detail-block">
            <div class="detail-title">Estado comercial</div>
            <div class="detail-line"><strong>Requiere asesor:</strong> ${fullLead.requiresHuman ? "Sí" : "No"}</div>
            <div class="detail-line"><strong>Lead parcial:</strong> ${fullLead.partial ? "Sí" : "No"}</div>
            <div class="detail-line"><strong>Lead caliente:</strong> ${isHotLead(fullLead) ? "Sí" : "No"}</div>
            <div class="detail-line"><strong>Motivo parcial:</strong> ${escapeHtml(fullLead.partialReason || "-")}</div>
          </div>

          <div class="detail-block">
            <div class="detail-title">Nota interna</div>
            <textarea
              id="internalNoteInput"
              class="note-textarea"
              placeholder="Escribí una nota interna para este lead..."
            >${escapeHtml(fullLead.internalNote || "")}</textarea>

            <div class="note-actions">
              <button class="note-save-btn" onclick="saveInternalNote('${fullLead.id}')">Guardar nota</button>
            </div>

            <div id="noteSaveStatus" class="note-status"></div>
          </div>
        `;

          /**
           * =====================================================
           * COLUMNA DERECHA PRO
           * =====================================================
           *
           * - historial arriba
           * - caja de respuesta abajo
           * - input siempre visible
           *
           * IMPORTANTE:
           * La caja de respuesta humana solo queda habilitada
           * cuando la sesión está en modo HUMANO.
           */
          right.innerHTML = `
          <div class="chat-shell">
            <div class="chat-thread-card">
              <div class="chat-thread-title">Conversación</div>

              <div id="conversationThread" class="conversation">
                ${renderConversationMessages(messages)}
              </div>
            </div>

            <div class="chat-composer-card human-send-block ${isHumanMode ? "" : "disabled"}">
              <div class="detail-title">Responder al cliente</div>

              <div class="chat-composer-help">
                ${
                  isHumanMode
                    ? "La conversación está en modo HUMANO. Escribí abajo y enviá el mensaje al cliente."
                    : "Para responder desde el CRM, primero tomá la conversación como HUMANO."
                }
              </div>

              <textarea
                id="humanMessageInput"
                class="human-textarea"
                placeholder="Escribí acá tu mensaje para el cliente..."
                ${isHumanMode ? "" : "disabled"}
              ></textarea>

              <div class="chat-composer-footer">
                <div class="chat-composer-tip">Enter envía · Shift + Enter hace salto de línea</div>

                <button
                  id="humanSendButton"
                  class="human-send-btn"
                  onclick="sendHumanMessage('${fullLead.id}', '${fullLead.sessionId}', '${fullLead.controlMode || "bot"}')"
                  ${isHumanMode ? "" : "disabled"}
                >
                  Enviar al cliente
                </button>
              </div>

              <div id="humanSendStatus" class="human-status"></div>
            </div>
          </div>
        `;

          /**
           * Después de renderizar:
           * - enganchamos Enter / Shift+Enter
           * - scroll al último mensaje
           */
          attachHumanComposerEvents(
            fullLead.id,
            fullLead.sessionId,
            fullLead.controlMode || "bot",
          );

          /**
           * Al abrir el drawer:
           * - si el operador estaba abajo, mantenemos el scroll al final
           * - si el modo es HUMANO, damos foco al input para responder rápido
           */
          setTimeout(() => {
            scrollConversationToBottom();

            const input = document.getElementById("humanMessageInput");
            if (input && !input.disabled) {
              input.focus();
            }
          }, 30);
        } catch (error) {
          console.error(error);
          left.innerHTML = `
          <div class="detail-block">
            <div class="detail-title">Error</div>
            <div class="detail-line">No se pudo cargar la conversación.</div>
            <div class="detail-line">${escapeHtml(error.message)}</div>
          </div>
        `;
          right.innerHTML = "";
        }
      }

      function closeDrawer() {
        currentLeadId = null;
        document.getElementById("leadModalOverlay").classList.remove("open");
        document.getElementById("modalRefreshBanner").classList.remove("show");
      }