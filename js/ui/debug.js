    // ============================================
    // Debug Console
    // ============================================
    function toggleDebug() {
      const console = document.getElementById('debugConsole');
      const toggle = document.getElementById('debugToggle');
      const isActive = console.classList.toggle('active');
      toggle.classList.toggle('active', isActive);
      document.body.classList.toggle('debug-open', isActive);
    }

    function clearDebugLogs() {
      debugLogs = [];
      document.getElementById('debugLogs').innerHTML = `
        <div style="color: var(--text-secondary); text-align: center; padding: 20px;">
          Logs cleared
        </div>
      `;
    }

    function debugLog(type, message, data = null) {
      const time = new Date().toLocaleTimeString('en-US', { hour12: false });
      const entry = { time, type, message, data };
      debugLogs.push(entry);
      if (debugLogs.length > MAX_DEBUG_LOGS) {
        debugLogs = debugLogs.slice(-MAX_DEBUG_LOGS);
      }

      // Also log to browser console
      const colors = {
        step: '#be3e82',
        info: '#dfbbb1',
        success: '#be3e82',
        warn: '#e43f6f',
        error: '#f56476',
        detail: '#5e4352'
      };
      if (data) {
        console.log(`%c[MCP→WebMCP] ${message}`, `color: ${colors[type] || '#dfbbb1'}`, data);
      } else {
        console.log(`%c[MCP→WebMCP] ${message}`, `color: ${colors[type] || '#dfbbb1'}`);
      }

      // Update UI
      renderDebugLogs();
    }

    function debugSeparator(title) {
      debugLogs.push({ separator: true, title });
      if (debugLogs.length > MAX_DEBUG_LOGS) {
        debugLogs = debugLogs.slice(-MAX_DEBUG_LOGS);
      }
      console.log(`%c[MCP→WebMCP] ${'═'.repeat(40)}`, 'color: #be3e82');
      console.log(`%c[MCP→WebMCP] ${title}`, 'color: #be3e82; font-weight: bold');
      renderDebugLogs();
    }

    function renderDebugLogs() {
      const container = document.getElementById('debugLogs');

      container.innerHTML = debugLogs.map(entry => {
        if (entry.separator) {
          return `<div class="debug-separator">═══ ${entry.title} ═══</div>`;
        }

        let dataHtml = '';
        if (entry.data !== null && entry.data !== undefined) {
          const dataStr = typeof entry.data === 'object'
            ? JSON.stringify(entry.data, null, 2)
            : String(entry.data);
          dataHtml = `<pre>${escapeHtml(dataStr)}</pre>`;
        }

        return `
          <div class="debug-log">
            <span class="debug-log-time">${entry.time}</span>
            <span class="debug-log-type ${entry.type}">${entry.type}</span>
            <span class="debug-log-msg">${escapeHtml(entry.message)}${dataHtml}</span>
          </div>
        `;
      }).join('');

      // Auto-scroll to bottom
      container.scrollTop = container.scrollHeight;
    }

