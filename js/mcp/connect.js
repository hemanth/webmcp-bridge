    // Server connection
    async function connectToServer() {
      const urlInput = document.getElementById('serverUrl');
      const connectBtn = document.getElementById('connectBtn');
      const statusDot = document.getElementById('statusDot');
      const statusText = document.getElementById('statusText');

      serverUrl = urlInput.value.trim();
      if (!serverUrl) return;

      connectBtn.disabled = true;
      statusDot.className = 'status-dot connecting';
      statusText.textContent = 'Discovering...';

      // Initialize auth
      auth = new MCPAuth(serverUrl);

      // Check if we have saved credentials
      if (auth.loadFromSession()) {
        updateAuthBadge();
        await proceedWithConnection();
        connectBtn.disabled = false;
        return;
      }

      try {
        // Discover auth requirements
        debugSeparator('Step 1: Discovering auth requirements');
        const authInfo = await auth.discover();
        debugLog('info', 'Auth discovery result', authInfo);

        // Check if auth is required (safely handle undefined thirdParty)
        const hasThirdParty = authInfo.thirdParty && authInfo.thirdParty.length > 0;

        if (authInfo.requiresAuth || hasThirdParty) {
          debugLog('warn', 'Authentication required - showing auth modal');
          statusText.textContent = 'Auth Required';
          showAuthModal(authInfo);
          connectBtn.disabled = false;
          return;
        }

        debugLog('success', 'No auth required - proceeding with connection');
        // No auth required - proceed directly
        await proceedWithConnection();

      } catch (error) {
        debugLog('warn', 'Auth discovery failed (server may not support OAuth)', error.message);
        debugLog('info', 'Attempting direct connection without auth...');
        // If discovery fails, try connecting anyway (server might not support discovery)
        await proceedWithConnection();
      }

      connectBtn.disabled = false;
    }

    // Proceed with actual MCP connection after auth
    async function proceedWithConnection() {
      const statusDot = document.getElementById('statusDot');
      const statusText = document.getElementById('statusText');

      statusDot.className = 'status-dot connecting';
      statusText.textContent = 'Initializing...';

      debugSeparator('Step 2: Initializing MCP session');
      debugLog('info', 'Server URL:', serverUrl);

      try {
        // Clear any existing session ID before initializing
        if (auth) {
          auth.sessionId = null;
          sessionStorage.removeItem('mcp_session_id');
        }

        // First, initialize the MCP session (without session ID)
        const initPayload = {
          jsonrpc: '2.0',
          id: 1,
          method: 'initialize',
          params: {
            protocolVersion: '2024-11-05',
            capabilities: {
              tools: {}
            },
            clientInfo: {
              name: 'WebMCP Explorer',
              version: '1.0.0'
            }
          }
        };

        debugLog('info', '→ Sending initialize request');
        debugLog('detail', 'Method: POST');
        debugLog('detail', 'Headers:', auth ? auth.getHeaders(false) : { 'Content-Type': 'application/json' });
        debugLog('detail', 'Payload:', initPayload);

        const initResponse = await fetch(serverUrl, {
          method: 'POST',
          headers: auth ? auth.getHeaders(false) : { 'Content-Type': 'application/json', 'Accept': 'application/json, text/event-stream' },
          body: JSON.stringify(initPayload)
        });

        debugLog('info', '← Response status:', `${initResponse.status} ${initResponse.statusText}`);

        // Check for auth errors on initialize
        if (initResponse.status === 401 || initResponse.status === 403) {
          debugLog('error', 'Authentication required (HTTP 401/403)');
          statusDot.className = 'status-dot disconnected';
          statusText.textContent = 'Auth Required';
          const authInfo = await auth.discover();
          showAuthModal(authInfo);
          return;
        }

        const initData = await parseSSEorJSON(initResponse);
        debugLog('info', '← Initialize response', initData);

        if (initData.error) {
          debugLog('error', 'Initialize error:', initData.error);
          throw new Error(initData.error.message || 'Failed to initialize session');
        }

        // Extract session ID from response header
        const sessionId = initResponse.headers.get('Mcp-Session-Id');
        if (sessionId && auth) {
          auth.setSessionId(sessionId);
          debugLog('success', 'Session ID received:', sessionId);
        } else {
          debugLog('info', 'No session ID in response (stateless server)');
        }

        // Log server info
        if (initData.result?.serverInfo) {
          debugLog('success', 'Server info', initData.result.serverInfo);
        }
        if (initData.result?.capabilities) {
          debugLog('success', 'Server capabilities', initData.result.capabilities);
        }

        debugSeparator('Step 3: Fetching tools list');

        statusText.textContent = 'Fetching tools...';

        const toolsPayload = {
          jsonrpc: '2.0',
          id: 2,
          method: 'tools/list',
          params: {}
        };

        debugLog('info', '→ Sending tools/list request');
        debugLog('detail', 'Payload:', toolsPayload);

        // Now fetch tools list
        const response = await fetch(serverUrl, {
          method: 'POST',
          headers: auth ? auth.getHeaders() : { 'Content-Type': 'application/json', 'Accept': 'application/json, text/event-stream' },
          body: JSON.stringify(toolsPayload)
        });

        debugLog('info', '← Response status:', `${response.status} ${response.statusText}`);

        // Check for auth errors
        if (response.status === 401 || response.status === 403) {
          debugLog('error', 'Authentication failed');
          statusDot.className = 'status-dot disconnected';
          statusText.textContent = 'Auth Failed';

          // Clear invalid credentials
          if (auth) auth.logout();
          updateAuthBadge();

          // Show auth modal
          const authInfo = await auth.discover();
          showAuthModal(authInfo);
          return;
        }

        const data = await parseSSEorJSON(response);
        debugLog('info', '← Tools list response', data);

        if (data.error) {
          debugLog('error', 'Tools list error:', data.error);
          // Check if it's an auth error in JSON-RPC
          if (data.error.code === -32001 || data.error.message?.toLowerCase().includes('auth')) {
            statusDot.className = 'status-dot disconnected';
            statusText.textContent = 'Auth Required';
            const authInfo = await auth.discover();
            showAuthModal(authInfo);
            return;
          }
          throw new Error(data.error.message || 'Failed to fetch tools');
        }

        tools = data.result?.tools || [];

        debugLog('success', `Tools discovered: ${tools.length}`);
        tools.forEach((tool, i) => {
          debugLog('success', `  ${i + 1}. ${tool.name}`, tool.description || '(no description)');
        });

        renderToolList();
        renderToolSelect();
        document.getElementById('executeBtn').disabled = tools.length === 0;

        // Fetch prompts if server supports them
        debugSeparator('Step 3b: Fetching prompts list');
        statusText.textContent = 'Fetching prompts...';

        try {
          const promptsPayload = {
            jsonrpc: '2.0',
            id: 3,
            method: 'prompts/list',
            params: {}
          };

          debugLog('info', '→ Sending prompts/list request');

          const promptsResponse = await fetch(serverUrl, {
            method: 'POST',
            headers: auth ? auth.getHeaders() : { 'Content-Type': 'application/json', 'Accept': 'application/json, text/event-stream' },
            body: JSON.stringify(promptsPayload)
          });

          if (promptsResponse.ok) {
            const promptsData = await parseSSEorJSON(promptsResponse);
            if (!promptsData.error) {
              prompts = promptsData.result?.prompts || [];
              debugLog('success', `Prompts discovered: ${prompts.length}`);
              prompts.forEach((prompt, i) => {
                debugLog('success', `  ${i + 1}. ${prompt.name}`, prompt.description || '(no description)');
              });
            } else {
              debugLog('info', 'Server does not support prompts or returned error');
              prompts = [];
            }
          } else {
            debugLog('info', 'prompts/list not supported (HTTP ' + promptsResponse.status + ')');
            prompts = [];
          }
        } catch (e) {
          debugLog('info', 'prompts/list failed:', e.message);
          prompts = [];
        }

        renderPromptList();

        // Fetch resources if server supports them
        debugSeparator('Step 3c: Fetching resources list');
        statusText.textContent = 'Fetching resources...';

        try {
          const resourcesPayload = {
            jsonrpc: '2.0',
            id: 4,
            method: 'resources/list',
            params: {}
          };

          debugLog('info', '→ Sending resources/list request');

          const resourcesResponse = await fetch(serverUrl, {
            method: 'POST',
            headers: auth ? auth.getHeaders() : { 'Content-Type': 'application/json', 'Accept': 'application/json, text/event-stream' },
            body: JSON.stringify(resourcesPayload)
          });

          if (resourcesResponse.ok) {
            const resourcesData = await parseSSEorJSON(resourcesResponse);
            if (!resourcesData.error) {
              resources = resourcesData.result?.resources || [];
              debugLog('success', `Resources discovered: ${resources.length}`);
              resources.forEach((resource, i) => {
                debugLog('success', `  ${i + 1}. ${resource.uri}`, resource.name || '(no name)');
              });
            } else {
              debugLog('info', 'Server does not support resources or returned error');
              resources = [];
            }
          } else {
            debugLog('info', 'resources/list not supported (HTTP ' + resourcesResponse.status + ')');
            resources = [];
          }
        } catch (e) {
          debugLog('info', 'resources/list failed:', e.message);
          resources = [];
        }

        renderResourceList();

        statusDot.className = 'status-dot';
        statusText.textContent = 'Connected';

        // Save to recent connections
        addToRecentConnections(serverUrl);

        // Initialize AI session with tools if available
        if (window.ai) {
          debugSeparator('Step 4a: Initializing Prompt API session');
          initAISession();
        }

        // Register tools with WebMCP (navigator.modelContext) if available
        debugSeparator('Step 4b: Registering tools with WebMCP');

        if (navigator.modelContext) {
          registerToolsWithWebMCP(tools);
        } else {
          debugLog('warn', 'navigator.modelContext not available');
          debugLog('info', 'To enable WebMCP in Chrome 146+:');
          debugLog('info', '  1. Go to chrome://flags/#enable-webmcp-testing');
          debugLog('info', '  2. Set to "Enabled"');
          debugLog('info', '  3. Relaunch Chrome');
        }

        debugSeparator('Connection complete!');

      } catch (error) {
        debugLog('error', 'Connection failed:', error.message);
        statusDot.className = 'status-dot disconnected';
        statusText.textContent = 'Error';
        showToast('Connection failed: ' + error.message, 'error');

        const toolList = document.getElementById('toolList');
        clearElement(toolList);
        const state = createElement('div', { className: 'empty-state' });
        state.appendChild(createElement('div', {
          text: `Failed to connect: ${error.message}`,
          attrs: { style: 'color: var(--error);' }
        }));
        toolList.appendChild(state);
      }
    }
