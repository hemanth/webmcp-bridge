    function getPromptApiPollTimer() {
      if (typeof promptApiAvailabilityPollTimer !== 'undefined') return promptApiAvailabilityPollTimer;
      return globalThis.__promptApiAvailabilityPollTimer || null;
    }

    function setPromptApiPollTimer(timerId) {
      if (typeof promptApiAvailabilityPollTimer !== 'undefined') {
        promptApiAvailabilityPollTimer = timerId;
      }
      globalThis.__promptApiAvailabilityPollTimer = timerId;
    }

    function getPromptApiDownloadProgressValue() {
      if (typeof promptApiDownloadProgress !== 'undefined') return promptApiDownloadProgress;
      const fallback = globalThis.__promptApiDownloadProgress;
      return Number.isFinite(fallback) ? fallback : null;
    }

    function stopPromptApiAvailabilityPolling() {
      const timer = getPromptApiPollTimer();
      if (timer) {
        clearInterval(timer);
        setPromptApiPollTimer(null);
      }
    }

    function startPromptApiAvailabilityPolling() {
      if (getPromptApiPollTimer()) return;

      const timerId = setInterval(() => {
        if (document.hidden) return;
        checkAISupport();
      }, 3000);
      setPromptApiPollTimer(timerId);
    }

    function applyChatAvailability(promptState) {
      const chatInput = document.getElementById('chatInput');
      const chatSendBtn = document.getElementById('chatSendBtn');
      if (!chatInput || !chatSendBtn) return;

      chatInput.disabled = !promptState.available;
      chatSendBtn.disabled = !promptState.available;

      if (promptState.available) {
        chatInput.placeholder = 'Ask a question...';
        return;
      }

      if (promptState.availability === 'downloading') {
        const progressValue = getPromptApiDownloadProgressValue();
        const pct = Number.isFinite(progressValue) ? Math.round(progressValue * 100) : null;
        chatInput.placeholder = pct == null
          ? 'Prompt API model is downloading... chat will unlock automatically.'
          : `Prompt API model downloading (${pct}%)... chat will unlock automatically.`;
      } else {
        chatInput.placeholder = `Chat unavailable: ${promptState.reason}`;
      }
    }

    async function checkAISupport() {
      const aiStatus = document.getElementById('aiStatus');
      let statusHtml = '';

      if (navigator.modelContext) {
        statusHtml += `<div style="margin-bottom: 8px; border-left: 2px solid var(--success); padding-left: 10px;">
          <strong>WebMCP Available</strong> - Tools will be registered with navigator.modelContext for browser AI agents.
        </div>`;
      } else {
        statusHtml += `<div style="margin-bottom: 8px; border-left: 2px solid var(--error); padding-left: 10px;">
          <strong>WebMCP Not Available</strong> - Enable in Chrome 146+:
          <ol style="margin: 4px 0 0 16px; line-height: 1.6; font-size: 10px;">
            <li>Go to chrome://flags/#enable-webmcp-testing</li>
            <li>Set to "Enabled" and relaunch</li>
          </ol>
        </div>`;
      }

      if (aiSession) {
        promptApiState = {
          available: true,
          availability: 'session_ready',
          reason: 'Prompt API session is ready.'
        };
      } else if (!window.LanguageModel) {
        promptApiState = {
          available: false,
          availability: 'missing',
          reason: 'window.LanguageModel is missing.'
        };
      } else if (typeof window.LanguageModel.availability === 'function') {
        try {
          const availability = await window.LanguageModel.availability();
          if (availability === 'available') {
            promptApiState = {
              available: true,
              availability,
              reason: 'Prompt API model is ready.'
            };
          } else if (availability === 'downloading') {
            promptApiState = {
              available: false,
              availability,
              reason: 'Prompt API model is downloading in the browser.'
            };
          } else {
            promptApiState = {
              available: false,
              availability,
              reason: `Prompt API availability is "${availability}".`
            };
          }
        } catch (error) {
          promptApiState = {
            available: false,
            availability: 'error',
            reason: `Prompt API availability check failed: ${error.message}`
          };
        }
      } else {
        promptApiState = {
          available: true,
          availability: 'unknown',
          reason: 'window.LanguageModel detected (no availability API exposed).'
        };
      }

      if (promptApiState.availability === 'downloading') {
        startPromptApiAvailabilityPolling();
      } else {
        stopPromptApiAvailabilityPolling();
      }

      if (promptApiState.available) {
        statusHtml += `<div style="border-left: 2px solid var(--success); padding-left: 10px;">
          <strong>Prompt API Ready</strong> - Chat mode uses structured LLM tool calls.
        </div>`;
      } else if (promptApiState.availability === 'downloading') {
        const progressValue = getPromptApiDownloadProgressValue();
        const pct = Number.isFinite(progressValue) ? Math.round(progressValue * 100) : null;
        const progressBlock = pct == null ? '' : `
          <div class="download-progress">
            <div class="download-progress-track">
              <div class="download-progress-fill" style="width: ${pct}%"></div>
            </div>
            <div class="download-progress-label">${pct}%</div>
          </div>`;
        statusHtml += `<div style="border-left: 2px solid var(--warning); padding-left: 10px;">
          <strong>Prompt API Downloading</strong> - ${promptApiState.reason} Chat will unlock automatically when ready.
          ${progressBlock}
        </div>`.trim();
      } else {
        statusHtml += `<div style="border-left: 2px solid var(--error); padding-left: 10px;">
          <strong>Prompt API Not Ready</strong> - ${promptApiState.reason}
        </div>`;
      }

      if (aiStatus) {
        const statusClass = promptApiState.available
          ? 'available'
          : (promptApiState.availability === 'downloading' ? 'downloading' : 'unavailable');
        aiStatus.className = `ai-status ${statusClass}`;
        aiStatus.innerHTML = statusHtml;
      }

      applyChatAvailability(promptApiState);
    }
