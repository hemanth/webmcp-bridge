    // Tool execution
    async function executeTool() {
      if (!selectedTool) return;

      const resultsEl = document.getElementById('results');
      const execTimeEl = document.getElementById('execTime');
      const btn = document.getElementById('executeBtn');

      // Build arguments
      let args = {};
      const jsonOverride = document.getElementById('jsonArgs').value.trim();

      try {
        if (jsonOverride) {
          args = JSON.parse(jsonOverride);
        } else {
          const schema = selectedTool.inputSchema;
          const properties = schema?.properties || {};
          const required = schema?.required || [];

          Object.keys(properties).forEach(name => {
            const el = document.getElementById(`param_${name}`);
            if (el && el.value !== '') {
              const type = Array.isArray(properties[name].type) ? properties[name].type[0] : properties[name].type;
              if (type === 'number' || type === 'integer') {
                args[name] = Number(el.value);
              } else if (type === 'boolean') {
                args[name] = el.value === 'true';
              } else if (type === 'array' || type === 'object') {
                try {
                  args[name] = JSON.parse(el.value);
                } catch (parseError) {
                  throw new Error(`Invalid JSON for "${name}": ${parseError.message}`);
                }
              } else {
                args[name] = el.value;
              }
            }
          });

          const missingRequired = required.filter((name) => args[name] === undefined || args[name] === '');
          if (missingRequired.length > 0) {
            updateResults(`Missing required parameter(s): ${missingRequired.join(', ')}`, true);
            return;
          }
        }
      } catch (e) {
        updateResults(`Invalid arguments: ${e.message}`, true);
        return;
      }

      // Execute
      btn.disabled = true;
      resultsEl.innerHTML = '<div class="loading"><div class="spinner"></div>Executing...</div>';

      const startTime = performance.now();

      try {
        const response = await fetch(serverUrl, {
          method: 'POST',
          headers: auth ? auth.getHeaders() : { 'Content-Type': 'application/json', 'Accept': 'application/json, text/event-stream' },
          body: JSON.stringify({
            jsonrpc: '2.0',
            id: Date.now(),
            method: 'tools/call',
            params: { name: selectedTool.name, arguments: args }
          })
        });

        // Handle auth errors
        if (response.status === 401 || response.status === 403) {
          updateResults('Authentication required or token expired. Please reconnect.', true);
          showToast('Authentication failed', 'error');
          if (auth) auth.logout();
          updateAuthBadge();
          btn.disabled = false;
          return;
        }

        const result = await parseSSEorJSON(response);
        const elapsed = (performance.now() - startTime).toFixed(0);
        execTimeEl.textContent = `${elapsed}ms`;

        if (result.error) {
          updateResults(JSON.stringify(result.error, null, 2), true);
          showToast('Tool execution failed', 'error');
        } else {
          // Handle MCP content array format
          let content = result.result;
          if (result.result?.content) {
            content = result.result.content.map(c => c.text || JSON.stringify(c)).join('\n');
            try {
              content = JSON.parse(content);
            } catch {}
          }
          updateResults(content);
          showToast('Tool executed successfully', 'success');
        }
      } catch (error) {
        updateResults(`Error: ${error.message}`, true);
        execTimeEl.textContent = 'Failed';
        showToast('Execution error', 'error');
      }

      btn.disabled = false;
    }

    // Prompt execution
    async function executePrompt() {
      if (!selectedPrompt) return;

      const resultsEl = document.getElementById('results');
      const execTimeEl = document.getElementById('execTime');
      const btn = document.getElementById('executeBtn');

      // Build arguments from form
      let args = {};
      const promptArgs = selectedPrompt.arguments || [];

      promptArgs.forEach(arg => {
        const el = document.getElementById(`param_${arg.name}`);
        if (el && el.value) {
          args[arg.name] = el.value;
        }
      });

      // Execute
      btn.disabled = true;
      resultsEl.innerHTML = '<div class="loading"><div class="spinner"></div>Getting prompt...</div>';

      const startTime = performance.now();

      try {
        debugSeparator('Executing prompt: ' + selectedPrompt.name);
        debugLog('info', 'Args:', args);

        const response = await fetch(serverUrl, {
          method: 'POST',
          headers: auth ? auth.getHeaders() : { 'Content-Type': 'application/json', 'Accept': 'application/json, text/event-stream' },
          body: JSON.stringify({
            jsonrpc: '2.0',
            id: Date.now(),
            method: 'prompts/get',
            params: { name: selectedPrompt.name, arguments: args }
          })
        });

        // Handle auth errors
        if (response.status === 401 || response.status === 403) {
          resultsEl.innerHTML = `<pre style="color: var(--error);">Authentication required or token expired. Please reconnect.</pre>`;
          if (auth) auth.logout();
          updateAuthBadge();
          btn.disabled = false;
          return;
        }

        const result = await parseSSEorJSON(response);
        const elapsed = (performance.now() - startTime).toFixed(0);
        execTimeEl.textContent = `${elapsed}ms`;

        debugLog('info', '← Prompt result', result);

        if (result.error) {
          updateResults(JSON.stringify(result.error, null, 2), true);
        } else {
          // Handle MCP prompt response format (messages array)
          let content = result.result;
          if (result.result?.messages) {
            content = result.result.messages.map(m => {
              if (m.content?.type === 'text') return m.content.text;
              if (typeof m.content === 'string') return m.content;
              return JSON.stringify(m.content);
            }).join('\n\n');
          }
          updateResults(content);
        }
      } catch (error) {
        debugLog('error', 'Prompt execution error:', error.message);
        updateResults(`Error: ${error.message}`, true);
        execTimeEl.textContent = 'Failed';
      }

      btn.disabled = false;
    }

    // Resource reading
    async function readResource() {
      if (!selectedResource) return;

      const resultsEl = document.getElementById('results');
      const execTimeEl = document.getElementById('execTime');
      const btn = document.getElementById('executeBtn');

      // Execute
      btn.disabled = true;
      resultsEl.innerHTML = '<div class="loading"><div class="spinner"></div>Reading resource...</div>';

      const startTime = performance.now();

      try {
        debugSeparator('Reading resource: ' + selectedResource.uri);

        const response = await fetch(serverUrl, {
          method: 'POST',
          headers: auth ? auth.getHeaders() : { 'Content-Type': 'application/json', 'Accept': 'application/json, text/event-stream' },
          body: JSON.stringify({
            jsonrpc: '2.0',
            id: Date.now(),
            method: 'resources/read',
            params: { uri: selectedResource.uri }
          })
        });

        // Handle auth errors
        if (response.status === 401 || response.status === 403) {
          resultsEl.innerHTML = `<pre style="color: var(--error);">Authentication required or token expired. Please reconnect.</pre>`;
          if (auth) auth.logout();
          updateAuthBadge();
          btn.disabled = false;
          return;
        }

        const result = await parseSSEorJSON(response);
        const elapsed = (performance.now() - startTime).toFixed(0);
        execTimeEl.textContent = `${elapsed}ms`;

        debugLog('info', '← Resource result', result);

        if (result.error) {
          updateResults(JSON.stringify(result.error, null, 2), true);
        } else {
          // Handle MCP resource response format (contents array)
          let content = result.result;
          if (result.result?.contents) {
            content = result.result.contents.map(c => {
              if (c.text) return c.text;
              if (c.blob) return `[Binary data: ${c.mimeType || 'unknown type'}]`;
              return JSON.stringify(c);
            }).join('\n\n');
          }
          updateResults(content);
        }
      } catch (error) {
        debugLog('error', 'Resource read error:', error.message);
        updateResults(`Error: ${error.message}`, true);
        execTimeEl.textContent = 'Failed';
      }

      btn.disabled = false;
    }

    // Generic execute function that routes based on current capability
    function executeCurrentCapability() {
      if (currentCapability === 'tools') {
        executeTool();
      } else if (currentCapability === 'prompts') {
        executePrompt();
      } else if (currentCapability === 'resources') {
        readResource();
      }
    }

    function clearResults() {
      document.getElementById('results').innerHTML = `
        <div class="empty-state">
          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>
          </svg>
          <div>Select a tool and execute to see results</div>
        </div>
      `;
      document.getElementById('execTime').textContent = '';
      document.getElementById('jsonArgs').value = '';
    }
