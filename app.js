    // State
    let tools = [];
    let prompts = [];
    let resources = [];
    let selectedTool = null;
    let selectedPrompt = null;
    let selectedResource = null;
    let serverUrl = '';
    let currentMode = 'tools';
    let currentCapability = 'tools';
    let aiSession = null;
    let debugLogs = [];
    let recentConnections = JSON.parse(localStorage.getItem('mcp_recent_connections') || '[]');
    let lastResults = '';
    const MAX_DEBUG_LOGS = 1000;

    function escapeHtml(text) {
      const div = document.createElement('div');
      div.textContent = text == null ? '' : String(text);
      return div.innerHTML;
    }

    function createElement(tag, options = {}) {
      const el = document.createElement(tag);
      if (options.className) el.className = options.className;
      if (options.text != null) el.textContent = options.text;
      if (options.attrs) {
        Object.entries(options.attrs).forEach(([key, value]) => {
          if (value != null) el.setAttribute(key, String(value));
        });
      }
      if (options.dataset) {
        Object.entries(options.dataset).forEach(([key, value]) => {
          if (value != null) el.dataset[key] = String(value);
        });
      }
      if (options.on) {
        Object.entries(options.on).forEach(([eventName, handler]) => {
          el.addEventListener(eventName, handler);
        });
      }
      return el;
    }

    function clearElement(node) {
      while (node.firstChild) {
        node.removeChild(node.firstChild);
      }
    }

    // ============================================
    // Toast Notifications
    // ============================================
    function showToast(message, type = 'info') {
      const container = document.getElementById('toastContainer');
      const toast = document.createElement('div');
      toast.className = `toast ${type}`;

      const icons = {
        success: '<svg class="toast-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>',
        error: '<svg class="toast-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>',
        info: '<svg class="toast-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>'
      };

      toast.innerHTML = icons[type] || icons.info;
      toast.appendChild(createElement('span', { text: message }));
      container.appendChild(toast);

      setTimeout(() => toast.remove(), 3000);
    }

    // ============================================
    // Recent Connections
    // ============================================
    function addToRecentConnections(url) {
      try {
        new URL(url);
      } catch {
        return;
      }
      // Remove if already exists
      recentConnections = recentConnections.filter(c => c.url !== url);
      // Add to beginning
      recentConnections.unshift({ url, timestamp: Date.now() });
      // Keep only last 5
      recentConnections = recentConnections.slice(0, 5);
      localStorage.setItem('mcp_recent_connections', JSON.stringify(recentConnections));
    }

    function showRecentConnections() {
      const container = document.getElementById('recentConnections');
      if (recentConnections.length === 0) {
        container.classList.remove('active');
        return;
      }

      clearElement(container);
      recentConnections.forEach((conn) => {
        const item = createElement('div', {
          className: 'recent-item',
          attrs: { tabindex: '0', role: 'button', 'aria-label': `Connect to ${conn.url}` },
          on: {
            mousedown: () => selectRecentConnection(conn.url),
            keydown: (event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                selectRecentConnection(conn.url);
              }
            }
          }
        });
        item.appendChild(createElement('span', { className: 'recent-item-url', text: conn.url }));
        item.appendChild(createElement('span', { className: 'recent-item-time', text: getTimeAgo(conn.timestamp) }));
        item.appendChild(createElement('button', {
          className: 'recent-item-remove',
          text: '×',
          attrs: { 'aria-label': `Remove ${conn.url} from recent connections` },
          on: {
            mousedown: (event) => {
              event.stopPropagation();
              removeRecentConnection(conn.url);
            }
          }
        }));
        container.appendChild(item);
      });

      container.classList.add('active');
    }

    function hideRecentConnectionsDelayed() {
      setTimeout(() => {
        document.getElementById('recentConnections').classList.remove('active');
      }, 200);
    }

    function selectRecentConnection(url) {
      document.getElementById('serverUrl').value = url;
      document.getElementById('recentConnections').classList.remove('active');
      connectToServer();
    }

    function removeRecentConnection(url) {
      recentConnections = recentConnections.filter(c => c.url !== url);
      localStorage.setItem('mcp_recent_connections', JSON.stringify(recentConnections));
      showRecentConnections();
    }

    function getTimeAgo(timestamp) {
      const seconds = Math.floor((Date.now() - timestamp) / 1000);
      if (seconds < 60) return 'just now';
      if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
      if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
      return `${Math.floor(seconds / 86400)}d ago`;
    }

    // ============================================
    // Keyboard Shortcuts
    // ============================================
    function handleServerInputKeydown(event) {
      if (event.key === 'Enter') {
        event.preventDefault();
        connectToServer();
      } else if (event.key === 'Escape') {
        document.getElementById('recentConnections').classList.remove('active');
      } else if (event.key === 'ArrowDown') {
        const firstItem = document.querySelector('.recent-item');
        if (firstItem) firstItem.focus();
      }
    }

    function bindStaticEventHandlers() {
      document.getElementById('aboutNavLink')?.addEventListener('click', (event) => {
        event.preventDefault();
        openAbout();
      });
      document.getElementById('debugToggle')?.addEventListener('click', () => toggleDebug());
      document.getElementById('closeDebugBtn')?.addEventListener('click', () => toggleDebug());
      document.getElementById('clearDebugLogsBtn')?.addEventListener('click', () => clearDebugLogs());

      document.querySelectorAll('.mode-btn').forEach((btn) => {
        btn.addEventListener('click', () => setMode(btn.dataset.mode));
      });

      const serverUrlInput = document.getElementById('serverUrl');
      serverUrlInput?.addEventListener('keydown', handleServerInputKeydown);
      serverUrlInput?.addEventListener('focus', showRecentConnections);
      serverUrlInput?.addEventListener('blur', hideRecentConnectionsDelayed);
      document.getElementById('connectBtn')?.addEventListener('click', connectToServer);
      document.getElementById('focusServerUrlBtn')?.addEventListener('click', () => {
        document.getElementById('serverUrl')?.focus();
      });

      document.getElementById('authModalCloseBtn')?.addEventListener('click', closeAuthModal);
      document.getElementById('submitApiKeyBtn')?.addEventListener('click', submitApiKey);
      document.getElementById('submitBasicAuthBtn')?.addEventListener('click', submitBasicAuth);
      document.getElementById('submitBearerTokenBtn')?.addEventListener('click', submitBearerToken);
      document.getElementById('skipAuthBtn')?.addEventListener('click', skipAuth);
      document.querySelectorAll('.auth-option').forEach((option) => {
        option.addEventListener('click', (event) => selectAuthType(event, option.dataset.authType));
        option.addEventListener('keydown', (event) => handleAuthTypeKeydown(event, option.dataset.authType));
      });

      document.querySelectorAll('.capability-tab').forEach((tab) => {
        tab.addEventListener('click', () => selectCapability(tab.dataset.cap));
      });
      document.getElementById('searchInput')?.addEventListener('input', filterItems);
      document.getElementById('toolSelect')?.addEventListener('change', selectToolFromDropdown);
      document.getElementById('executeBtn')?.addEventListener('click', executeCurrentCapability);
      document.getElementById('clearResultsBtn')?.addEventListener('click', clearResults);
      document.getElementById('copyBtn')?.addEventListener('click', copyResults);

      document.getElementById('chatInput')?.addEventListener('keydown', handleChatKeydown);
      document.getElementById('chatSendBtn')?.addEventListener('click', sendChatMessage);
      document.getElementById('aboutCloseBtn')?.addEventListener('click', closeAbout);
    }

    // Global keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      const isMod = e.ctrlKey || e.metaKey;
      // Ctrl+Enter to execute
      if (isMod && e.key === 'Enter') {
        e.preventDefault();
        const executeBtn = document.getElementById('executeBtn');
        if (!executeBtn.disabled) {
          executeCurrentCapability();
        }
      }
      // Escape to close modals
      if (e.key === 'Escape') {
        closeAbout();
        closeAuthModal();
      }
      // Ctrl/Cmd+K to focus search
      if (isMod && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        document.getElementById('searchInput').focus();
      }
    });

    // ============================================
    // Search/Filter
    // ============================================
    function filterItems() {
      const query = document.getElementById('searchInput').value.toLowerCase().trim();

      if (currentCapability === 'tools') {
        filterToolList(query);
      } else if (currentCapability === 'prompts') {
        filterPromptList(query);
      } else if (currentCapability === 'resources') {
        filterResourceList(query);
      }
    }

    function filterToolList(query) {
      document.querySelectorAll('.tool-item').forEach(item => {
        const name = item.querySelector('.tool-name')?.textContent.toLowerCase() || '';
        const desc = item.querySelector('.tool-desc')?.textContent.toLowerCase() || '';
        const matches = !query || name.includes(query) || desc.includes(query);
        item.style.display = matches ? '' : 'none';
      });
    }

    function filterPromptList(query) {
      document.querySelectorAll('.prompt-item').forEach(item => {
        const name = item.querySelector('.prompt-name')?.textContent.toLowerCase() || '';
        const desc = item.querySelector('.prompt-desc')?.textContent.toLowerCase() || '';
        const matches = !query || name.includes(query) || desc.includes(query);
        item.style.display = matches ? '' : 'none';
      });
    }

    function filterResourceList(query) {
      document.querySelectorAll('.resource-item').forEach(item => {
        const uri = item.querySelector('.resource-uri')?.textContent.toLowerCase() || '';
        const type = item.querySelector('.resource-type')?.textContent.toLowerCase() || '';
        const matches = !query || uri.includes(query) || type.includes(query);
        item.style.display = matches ? '' : 'none';
      });
    }

    // ============================================
    // Copy to Clipboard
    // ============================================
    async function copyResults() {
      if (!lastResults) return;

      try {
        await navigator.clipboard.writeText(lastResults);
        const btn = document.getElementById('copyBtn');
        btn.classList.add('copied');
        btn.innerHTML = `
          <svg width="12" height="12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
          </svg>
          Copied!
        `;
        showToast('Copied to clipboard', 'success');

        setTimeout(() => {
          btn.classList.remove('copied');
          btn.innerHTML = `
            <svg width="12" height="12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/>
            </svg>
            Copy
          `;
        }, 2000);
      } catch (err) {
        showToast('Failed to copy', 'error');
      }
    }

    // ============================================
    // JSON Syntax Highlighting
    // ============================================
    function highlightJSON(json) {
      if (typeof json !== 'string') {
        json = JSON.stringify(json, null, 2);
      }

      return json
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g, (match) => {
          let cls = 'json-number';
          if (/^"/.test(match)) {
            if (/:$/.test(match)) {
              cls = 'json-key';
            } else {
              cls = 'json-string';
            }
          } else if (/true|false/.test(match)) {
            cls = 'json-boolean';
          } else if (/null/.test(match)) {
            cls = 'json-null';
          }
          return `<span class="${cls}">${match}</span>`;
        });
    }

    function updateResults(content, isError = false) {
      const resultsEl = document.getElementById('results');
      const copyBtn = document.getElementById('copyBtn');

      if (isError) {
        resultsEl.innerHTML = `<pre style="color: var(--error);">${escapeHtml(content)}</pre>`;
        copyBtn.style.display = 'none';
        lastResults = '';
      } else {
        lastResults = typeof content === 'string' ? content : JSON.stringify(content, null, 2);
        resultsEl.innerHTML = `<pre>${highlightJSON(lastResults)}</pre>`;
        copyBtn.style.display = 'flex';
      }
    }

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

    // ============================================
    // MCP Auth Class
    // ============================================
    class MCPAuth {
      constructor(serverUrl) {
        this.serverUrl = serverUrl;
        this.token = null;
        this.tokenType = 'Bearer';
        this.clientId = null;
        this.authMeta = null;
        this.sessionId = null;
      }

      // Discover auth requirements from server
      async discover() {
        const baseUrl = new URL(this.serverUrl).origin;
        const metaUrl = `${baseUrl}/.well-known/oauth-authorization-server`;

        debugLog('info', 'Checking OAuth discovery endpoint...');
        debugLog('detail', 'URL:', metaUrl);

        try {
          const res = await fetch(metaUrl, {
            method: 'GET',
            headers: { 'Accept': 'application/json' }
          });

          if (res.status === 404 || !res.ok) {
            // No OAuth metadata - server may be public or use simple auth
            debugLog('info', 'No OAuth metadata found (server is likely public)');
            return { type: 'none', requiresAuth: false };
          }

          const meta = await res.json();
          this.authMeta = meta;

          debugLog('success', 'OAuth metadata found', meta);

          // Check for third-party IdPs
          const thirdPartyIdps = meta.identity_providers || meta.supported_identity_providers || [];

          // Server supports OAuth - it might be its own IdP or delegate to third parties
          return {
            type: 'oauth',
            requiresAuth: true,
            meta,
            // If no third-party IdPs listed, the server itself is the OAuth provider
            isOwnIdp: thirdPartyIdps.length === 0 && !!meta.authorization_endpoint,
            thirdParty: thirdPartyIdps,
            supportsRegistration: !!meta.registration_endpoint
          };
        } catch (error) {
          // Network error or CORS - this is expected for public servers
          debugLog('info', 'OAuth discovery not available:', error.message);
          return { type: 'none', requiresAuth: false };
        }
      }

      // Dynamic Client Registration (RFC 7591)
      async registerClient() {
        if (!this.authMeta?.registration_endpoint) {
          throw new Error('Server does not support dynamic client registration');
        }

        // Use the current page URL as the redirect URI
        const currentUrl = new URL(window.location.href);
        currentUrl.search = '';
        currentUrl.hash = '';
        const redirectUri = currentUrl.toString();

        console.log('Registering client with redirect_uri:', redirectUri);

        const res = await fetch(this.authMeta.registration_endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            client_name: 'WebMCP Explorer',
            redirect_uris: [redirectUri],
            grant_types: ['authorization_code', 'refresh_token'],
            response_types: ['code'],
            token_endpoint_auth_method: 'none', // Public client
            scope: 'openid profile mcp:tools mcp:read mcp:write'
          })
        });

        if (!res.ok) {
          const error = await res.json().catch(() => ({}));
          throw new Error(error.error_description || 'Client registration failed');
        }

        const data = await res.json();
        this.clientId = data.client_id;

        // Store for session
        sessionStorage.setItem('mcp_client_id', data.client_id);
        if (data.client_secret) {
          sessionStorage.setItem('mcp_client_secret', data.client_secret);
        }

        return data;
      }

      // Generate PKCE challenge (required for public clients)
      async generatePKCE() {
        const array = new Uint8Array(32);
        crypto.getRandomValues(array);
        const verifier = Array.from(array, b => b.toString(16).padStart(2, '0')).join('');

        const hash = await crypto.subtle.digest(
          'SHA-256',
          new TextEncoder().encode(verifier)
        );

        const challenge = btoa(String.fromCharCode(...new Uint8Array(hash)))
          .replace(/\+/g, '-')
          .replace(/\//g, '_')
          .replace(/=+$/, '');

        return { verifier, challenge };
      }

      // First-party: API Key authentication
      setApiKey(apiKey) {
        this.token = apiKey;
        this.tokenType = 'X-API-Key';
      }

      // First-party: Basic Auth
      setBasicAuth(username, password) {
        const encoded = btoa(`${username}:${password}`);
        this.token = encoded;
        this.tokenType = 'Basic';
      }

      // First-party: Bearer Token (direct)
      setBearerToken(token) {
        this.token = token;
        this.tokenType = 'Bearer';
      }

      // Third-party: Start OAuth flow with IdP
      async startOAuthFlow(identityProvider = null) {
        if (!this.authMeta) {
          throw new Error('No auth metadata available. Run discover() first.');
        }

        // Register client if needed
        if (!this.clientId && this.authMeta.registration_endpoint) {
          await this.registerClient();
        } else if (!this.clientId) {
          throw new Error('No client_id available and server does not support registration');
        }

        // Generate PKCE
        const { verifier, challenge } = await this.generatePKCE();
        sessionStorage.setItem('pkce_verifier', verifier);
        sessionStorage.setItem('mcp_server_url', this.serverUrl);

        // Generate state for CSRF protection
        const state = crypto.randomUUID();
        sessionStorage.setItem('oauth_state', state);

        // Determine redirect URI - use current page URL
        const currentUrl = new URL(window.location.href);
        currentUrl.search = ''; // Clear any existing query params
        currentUrl.hash = '';
        const redirectUri = currentUrl.toString();
        sessionStorage.setItem('oauth_redirect_uri', redirectUri);

        // Build authorization URL
        const authUrl = new URL(this.authMeta.authorization_endpoint);
        authUrl.searchParams.set('client_id', this.clientId);
        authUrl.searchParams.set('redirect_uri', redirectUri);
        authUrl.searchParams.set('response_type', 'code');
        authUrl.searchParams.set('scope', 'openid profile mcp:tools');
        authUrl.searchParams.set('code_challenge', challenge);
        authUrl.searchParams.set('code_challenge_method', 'S256');
        authUrl.searchParams.set('state', state);

        // Hint which IdP to use if specified
        if (identityProvider) {
          // Different servers use different params for IdP hint
          authUrl.searchParams.set('identity_provider', identityProvider);
          authUrl.searchParams.set('idp', identityProvider);
          authUrl.searchParams.set('connection', identityProvider); // Auth0 style
        }

        console.log('OAuth redirect URI:', redirectUri);
        console.log('OAuth auth URL:', authUrl.toString());

        // Redirect to authorization server
        window.location.href = authUrl.toString();
      }

      // Handle OAuth callback
      async handleCallback() {
        const params = new URLSearchParams(window.location.search);
        const code = params.get('code');
        const state = params.get('state');
        const error = params.get('error');

        if (error) {
          const errorDesc = params.get('error_description') || error;
          throw new Error(`OAuth error: ${errorDesc}`);
        }

        if (!code) {
          return false; // No callback to handle
        }

        // Verify state
        const savedState = sessionStorage.getItem('oauth_state');
        if (state !== savedState) {
          throw new Error('Invalid state parameter - possible CSRF attack');
        }

        // Restore server URL
        const savedServerUrl = sessionStorage.getItem('mcp_server_url');
        if (savedServerUrl) {
          this.serverUrl = savedServerUrl;
        }

        // Discover auth metadata if needed
        if (!this.authMeta) {
          await this.discover();
        }

        // Exchange code for token
        const verifier = sessionStorage.getItem('pkce_verifier');
        const clientId = sessionStorage.getItem('mcp_client_id');

        // Get the redirect URI we used
        const redirectUri = sessionStorage.getItem('oauth_redirect_uri') || window.location.origin + window.location.pathname;

        const tokenRes = await fetch(this.authMeta.token_endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            grant_type: 'authorization_code',
            code: code,
            redirect_uri: redirectUri,
            client_id: clientId,
            code_verifier: verifier
          })
        });

        if (!tokenRes.ok) {
          const error = await tokenRes.json().catch(() => ({}));
          throw new Error(error.error_description || 'Token exchange failed');
        }

        const tokens = await tokenRes.json();

        // Store tokens
        this.token = tokens.access_token;
        this.tokenType = 'Bearer';
        sessionStorage.setItem('mcp_token', tokens.access_token);
        sessionStorage.setItem('mcp_token_type', 'bearer');

        if (tokens.refresh_token) {
          sessionStorage.setItem('mcp_refresh_token', tokens.refresh_token);
        }

        // Clean up URL and session
        sessionStorage.removeItem('pkce_verifier');
        sessionStorage.removeItem('oauth_state');
        window.history.replaceState({}, '', window.location.pathname);

        return true;
      }

      // Refresh access token
      async refreshToken() {
        const refreshToken = sessionStorage.getItem('mcp_refresh_token');
        if (!refreshToken || !this.authMeta?.token_endpoint) {
          return false;
        }

        const clientId = sessionStorage.getItem('mcp_client_id');

        const res = await fetch(this.authMeta.token_endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            grant_type: 'refresh_token',
            refresh_token: refreshToken,
            client_id: clientId
          })
        });

        if (!res.ok) {
          this.logout();
          return false;
        }

        const tokens = await res.json();
        this.token = tokens.access_token;
        sessionStorage.setItem('mcp_token', tokens.access_token);

        if (tokens.refresh_token) {
          sessionStorage.setItem('mcp_refresh_token', tokens.refresh_token);
        }

        return true;
      }

      // Get headers for MCP requests
      getHeaders(includeSession = true) {
        const headers = {
          'Content-Type': 'application/json',
          'Accept': 'application/json, text/event-stream'
        };

        if (this.token) {
          if (this.tokenType === 'X-API-Key') {
            headers['X-API-Key'] = this.token;
          } else if (this.tokenType === 'Basic') {
            headers['Authorization'] = `Basic ${this.token}`;
          } else {
            headers['Authorization'] = `Bearer ${this.token}`;
          }
        }

        // Add session ID if we have one (but not for initialize)
        if (includeSession && this.sessionId) {
          headers['Mcp-Session-Id'] = this.sessionId;
        }

        return headers;
      }

      // Set session ID (received from server response)
      setSessionId(sessionId) {
        this.sessionId = sessionId;
        sessionStorage.setItem('mcp_session_id', sessionId);
      }

      // Load session ID from storage
      loadSessionId() {
        this.sessionId = sessionStorage.getItem('mcp_session_id');
        return this.sessionId;
      }

      // Check if authenticated
      isAuthenticated() {
        return !!this.token;
      }

      // Load saved auth from session
      loadFromSession() {
        const token = sessionStorage.getItem('mcp_token');
        const tokenType = sessionStorage.getItem('mcp_token_type');
        const clientId = sessionStorage.getItem('mcp_client_id');
        const sessionId = sessionStorage.getItem('mcp_session_id');

        if (token) {
          this.token = token;
          this.tokenType = tokenType === 'apikey' ? 'X-API-Key' :
                          tokenType === 'basic' ? 'Basic' : 'Bearer';
        }

        if (clientId) {
          this.clientId = clientId;
        }

        if (sessionId) {
          this.sessionId = sessionId;
        }

        return this.isAuthenticated();
      }

      // Logout
      logout() {
        this.token = null;
        this.clientId = null;
        this.sessionId = null;
        sessionStorage.removeItem('mcp_token');
        sessionStorage.removeItem('mcp_token_type');
        sessionStorage.removeItem('mcp_client_id');
        sessionStorage.removeItem('mcp_client_secret');
        sessionStorage.removeItem('mcp_refresh_token');
        sessionStorage.removeItem('mcp_server_url');
        sessionStorage.removeItem('mcp_session_id');
      }
    }

    // Global auth instance
    let auth = null;

    // Helper to parse SSE or JSON response
    async function parseSSEorJSON(response) {
      const contentType = response.headers.get('content-type') || '';
      const text = await response.text();

      // If it's JSON, parse directly
      if (contentType.includes('application/json')) {
        return JSON.parse(text);
      }

      // If it's SSE, extract the JSON from the event data
      if (contentType.includes('text/event-stream') || text.startsWith('event:')) {
        const events = text.split('\n\n').map(chunk => chunk.trim()).filter(Boolean);
        const parsedPayloads = [];

        for (const eventChunk of events) {
          const dataLines = eventChunk
            .split('\n')
            .filter(line => line.startsWith('data:'))
            .map(line => line.substring(5).trim())
            .filter(Boolean);
          if (dataLines.length === 0) continue;

          const dataStr = dataLines.join('\n');
          try {
            parsedPayloads.push(JSON.parse(dataStr));
          } catch (e) {
            console.log('SSE data parse error:', e, dataStr);
          }
        }

        if (parsedPayloads.length > 0) {
          return parsedPayloads[parsedPayloads.length - 1];
        }

        // Try parsing the whole text as JSON as fallback
        try {
          return JSON.parse(text);
        } catch (e) {
          throw new Error(`Failed to parse SSE response: ${text.substring(0, 100)}...`);
        }
      }

      // Try JSON parse as fallback
      try {
        return JSON.parse(text);
      } catch (e) {
        throw new Error(`Unexpected response format: ${text.substring(0, 100)}...`);
      }
    }

    // ============================================
    // Auth UI Functions
    // ============================================
    function showAuthModal(authInfo) {
      const modal = document.getElementById('authModal');
      const infoEl = document.getElementById('authInfo');
      const oauthSection = document.getElementById('oauthSection');
      const oauthSectionTitle = document.getElementById('oauthSectionTitle');
      const oauthContent = document.getElementById('oauthContent');
      const firstPartySection = document.getElementById('firstPartySection');
      const skipAuthSection = document.getElementById('skipAuthSection');

      // Reset all forms and selections
      document.querySelectorAll('.auth-form').forEach(f => f.classList.remove('active'));
      document.querySelectorAll('.auth-option').forEach(o => o.classList.remove('selected'));
      infoEl.style.display = 'none';

      // Reset all sections to hidden first
      oauthSection.style.display = 'none';
      firstPartySection.style.display = 'none';
      skipAuthSection.style.display = 'block'; // Always show skip option

      // Determine OAuth configuration
      const hasOAuth = authInfo.type === 'oauth' && authInfo.meta?.authorization_endpoint;
      const hasThirdPartyIdps = authInfo.thirdParty && authInfo.thirdParty.length > 0;

      clearElement(oauthContent);

      if (hasOAuth) {
        // Show OAuth section prominently
        oauthSection.style.display = 'block';

        if (hasThirdPartyIdps) {
          // Multiple IdPs available - also show manual auth as fallback
          oauthSectionTitle.textContent = 'Sign in with';
          const idpGrid = createElement('div', { className: 'idp-grid' });
          authInfo.thirdParty.forEach((idp) => {
            const idpBtn = createElement('button', {
              className: 'idp-btn',
              attrs: { type: 'button' },
              on: { click: () => startOAuth(idp) }
            });
            const iconWrapper = createElement('span');
            iconWrapper.innerHTML = getIdpIcon(idp);
            idpBtn.appendChild(iconWrapper);
            idpBtn.appendChild(createElement('span', { text: formatIdpName(idp) }));
            idpGrid.appendChild(idpBtn);
          });
          oauthContent.appendChild(idpGrid);
          // Show manual auth as alternative
          firstPartySection.style.display = 'block';
        } else {
          // Server is its own OAuth provider (like PayPal)
          const serverName = getServerName(serverUrl);
          oauthSectionTitle.textContent = 'Sign in with ' + serverName;
          const oauthBtn = createElement('button', {
            className: 'btn btn-primary',
            attrs: {
              type: 'button',
              style: 'width: 100%; display: flex; align-items: center; justify-content: center; gap: 10px;'
            },
            on: { click: () => startOAuth() }
          });
          const iconWrapper = createElement('span');
          iconWrapper.innerHTML = getServerIcon(serverUrl);
          oauthBtn.appendChild(iconWrapper);
          oauthBtn.appendChild(createElement('span', { text: `Continue with ${serverName}` }));
          oauthContent.appendChild(oauthBtn);

          oauthContent.appendChild(createElement('div', {
            text: `You'll be redirected to ${serverName} to authenticate.`,
            attrs: { style: 'margin-top: 12px; font-size: 12px; color: var(--text-secondary);' }
          }));
          // Hide manual auth - OAuth is the only option
          firstPartySection.style.display = 'none';
        }

        // Show info about OAuth support
        if (authInfo.supportsRegistration) {
          infoEl.style.display = 'block';
          infoEl.className = 'auth-info success';
          infoEl.textContent = 'This server supports OAuth with automatic client registration.';
        }
      } else {
        // No OAuth - show manual authentication options
        oauthSection.style.display = 'none';
        firstPartySection.style.display = 'block';
      }

      modal.classList.add('active');
    }

    function getServerName(url) {
      try {
        const hostname = new URL(url).hostname;
        // Extract readable name from hostname
        const parts = hostname.split('.');
        if (parts.length >= 2) {
          // mcp.paypal.com -> PayPal
          const name = parts[parts.length - 2];
          return name.charAt(0).toUpperCase() + name.slice(1);
        }
        return hostname;
      } catch {
        return 'Server';
      }
    }

    function getServerIcon(url) {
      try {
        const hostname = new URL(url).hostname.toLowerCase();
        if (hostname.includes('paypal')) {
          return '<svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18"><path d="M7.076 21.337H2.47a.641.641 0 0 1-.633-.74L4.944 3.72a.641.641 0 0 1 .632-.54h6.012c2.657 0 4.527.856 5.432 2.479.398.715.621 1.502.667 2.347.05.9-.058 1.925-.32 3.044-.332 1.418-.863 2.615-1.58 3.556-.67.877-1.502 1.584-2.474 2.1-.923.493-1.943.752-3.034.77H8.074a.641.641 0 0 0-.632.54l-.366 2.32z"/></svg>';
        }
        if (hostname.includes('github')) {
          return getIdpIcon('github');
        }
        if (hostname.includes('google')) {
          return getIdpIcon('google');
        }
        // Default icon
        return '<svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/></svg>';
      } catch {
        return '';
      }
    }

    async function startOAuth(idp = null) {
      try {
        const infoEl = document.getElementById('authInfo');
        infoEl.style.display = 'block';
        infoEl.className = 'auth-info';
        infoEl.textContent = 'Redirecting to login...';

        await auth.startOAuthFlow(idp);
      } catch (error) {
        const infoEl = document.getElementById('authInfo');
        infoEl.style.display = 'block';
        infoEl.className = 'auth-info error';
        infoEl.textContent = `Error: ${error.message}`;
      }
    }

    function closeAuthModal() {
      document.getElementById('authModal').classList.remove('active');
    }

    function handleAuthTypeKeydown(event, type) {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        selectAuthType(event, type);
      }
    }

    function selectAuthType(event, type) {
      // Update selection UI
      document.querySelectorAll('.auth-option').forEach(o => o.classList.remove('selected'));
      document.querySelectorAll('.auth-form').forEach(f => f.classList.remove('active'));

      if (event?.currentTarget) {
        event.currentTarget.classList.add('selected');
      }
      document.getElementById(`${type}Form`).classList.add('active');
    }

    async function submitApiKey() {
      const apiKey = document.getElementById('apiKeyInput').value.trim();
      if (!apiKey) return;

      auth.setApiKey(apiKey);
      closeAuthModal();
      updateAuthBadge();
      await proceedWithConnection();
    }

    async function submitBasicAuth() {
      const username = document.getElementById('basicUsername').value.trim();
      const password = document.getElementById('basicPassword').value;
      if (!username || !password) return;

      auth.setBasicAuth(username, password);
      closeAuthModal();
      updateAuthBadge();
      await proceedWithConnection();
    }

    async function submitBearerToken() {
      const token = document.getElementById('bearerTokenInput').value.trim();
      if (!token) return;

      auth.setBearerToken(token);
      closeAuthModal();
      updateAuthBadge();
      await proceedWithConnection();
    }

    async function skipAuth() {
      closeAuthModal();
      await proceedWithConnection();
    }

    function updateAuthBadge() {
      const badge = document.getElementById('authBadge');
      if (auth && auth.isAuthenticated()) {
        badge.innerHTML = `<span class="auth-badge authenticated">Authenticated</span>`;
      } else {
        badge.innerHTML = '';
      }
    }

    function getIdpIcon(idp) {
      const icons = {
        google: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>',
        github: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/></svg>',
        microsoft: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M11.4 24H0V12.6h11.4V24zM24 24H12.6V12.6H24V24zM11.4 11.4H0V0h11.4v11.4zm12.6 0H12.6V0H24v11.4z"/></svg>',
        okta: '<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="10"/></svg>',
        auth0: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M21.98 7.448L19.62 0H4.347L2.02 7.448c-1.352 4.312.03 9.206 3.815 12.015L12.007 24l6.157-4.552c3.755-2.81 5.182-7.688 3.815-12.015l-6.16 4.58 2.343 7.45-6.157-4.597-6.158 4.58 2.358-7.433-6.188-4.55 7.63-.045L12.008 0l2.356 7.404 7.615.044z"/></svg>'
      };

      const idpLower = idp.toLowerCase();
      return icons[idpLower] || '<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="10"/></svg>';
    }

    function formatIdpName(idp) {
      const names = {
        google: 'Google',
        github: 'GitHub',
        microsoft: 'Microsoft',
        okta: 'Okta',
        auth0: 'Auth0',
        azure: 'Azure AD',
        facebook: 'Facebook'
      };
      return names[idp.toLowerCase()] || idp.charAt(0).toUpperCase() + idp.slice(1);
    }

    // ============================================
    // Initialize
    // ============================================
    async function init() {
      bindStaticEventHandlers();
      checkAISupport();

      // Check for OAuth callback
      if (window.location.search.includes('code=')) {
        try {
          const tempAuth = new MCPAuth('');
          const savedUrl = sessionStorage.getItem('mcp_server_url');
          if (savedUrl) {
            tempAuth.serverUrl = savedUrl;
            document.getElementById('serverUrl').value = savedUrl;
          }
          await tempAuth.discover();
          const success = await tempAuth.handleCallback();
          if (success) {
            auth = tempAuth;
            serverUrl = tempAuth.serverUrl;
            updateAuthBadge();
            await proceedWithConnection();
            return;
          }
        } catch (error) {
          console.error('OAuth callback error:', error);
          showToast(`Authentication failed: ${error.message}`, 'error');
        }
      }

      // Auto-connect if URL is present
      const urlInput = document.getElementById('serverUrl');
      if (urlInput.value) {
        connectToServer();
      }
    }

    // Mode switching
    function setMode(mode) {
      currentMode = mode;

      document.querySelectorAll('.mode-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.mode === mode);
      });

      document.getElementById('toolsContainer').classList.toggle('hidden', mode !== 'tools');
      document.getElementById('chatContainer').classList.toggle('active', mode === 'chat');
      document.getElementById('panelTitle').textContent = mode === 'tools' ? 'Test Tool' : 'Chat with AI';
    }

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

    // Capability tab switching
    function selectCapability(cap) {
      currentCapability = cap;

      // Update tab active states
      document.querySelectorAll('.capability-tab').forEach(tab => {
        tab.classList.toggle('active', tab.dataset.cap === cap);
      });

      // Show/hide content
      document.querySelectorAll('.capability-content').forEach(content => {
        content.classList.toggle('active', content.id === `${cap}Content`);
      });

      // Update panel title and button
      const panelTitle = document.getElementById('panelTitle');
      const executeBtn = document.getElementById('executeBtn');
      const toolSelectGroup = document.getElementById('toolSelect').closest('.form-group');
      const jsonArgsGroup = document.getElementById('jsonArgs').closest('.form-group');

      if (cap === 'tools') {
        panelTitle.textContent = 'Test Tool';
        executeBtn.textContent = 'Execute Tool';
        executeBtn.disabled = tools.length === 0;
        toolSelectGroup.style.display = 'block';
        jsonArgsGroup.style.display = 'block';
        if (selectedTool) renderDynamicParams();
      } else if (cap === 'prompts') {
        panelTitle.textContent = 'Test Prompt';
        executeBtn.textContent = 'Get Prompt';
        executeBtn.disabled = prompts.length === 0;
        toolSelectGroup.style.display = 'none';
        jsonArgsGroup.style.display = 'none';
        if (selectedPrompt) renderPromptParams();
      } else if (cap === 'resources') {
        panelTitle.textContent = 'Read Resource';
        executeBtn.textContent = 'Read Resource';
        executeBtn.disabled = resources.length === 0;
        toolSelectGroup.style.display = 'none';
        jsonArgsGroup.style.display = 'none';
        renderSelectedResourceSummary();
      }
    }

    function renderSelectedResourceSummary() {
      const container = document.getElementById('dynamicParams');
      clearElement(container);
      const wrapper = createElement('div', {
        attrs: { style: 'color: var(--text-secondary); font-size: 13px; margin-bottom: 16px;' }
      });
      wrapper.appendChild(createElement('span', { text: 'Selected: ' }));
      wrapper.appendChild(createElement('strong', {
        text: selectedResource?.name || selectedResource?.uri || 'None'
      }));
      if (selectedResource?.mimeType) {
        wrapper.appendChild(createElement('br'));
        wrapper.appendChild(createElement('span', { text: `Type: ${selectedResource.mimeType}` }));
      }
      if (selectedResource?.description) {
        wrapper.appendChild(createElement('br'));
        wrapper.appendChild(createElement('span', { text: selectedResource.description }));
      }
      container.appendChild(wrapper);
    }

    // Tool list rendering
    function renderToolList() {
      const container = document.getElementById('toolList');
      document.getElementById('toolCount').textContent = tools.length;

      if (tools.length === 0) {
        container.innerHTML = `
          <div class="empty-state">
            <div>No tools available from this server</div>
          </div>
        `;
        return;
      }

      clearElement(container);
      tools.forEach((tool, index) => {
        const item = createElement('div', {
          className: `tool-item ${index === 0 ? 'active' : ''}`,
          dataset: { tool: tool.name },
          attrs: { role: 'button', tabindex: '0', 'aria-label': `Select tool ${tool.name}` },
          on: {
            click: () => selectTool(tool.name),
            keydown: (event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                selectTool(tool.name);
              }
            }
          }
        });
        item.appendChild(createElement('div', { className: 'tool-name', text: tool.name }));
        item.appendChild(createElement('div', { className: 'tool-desc', text: tool.description || 'No description' }));
        container.appendChild(item);
      });

      // Select first tool
      if (tools.length > 0) {
        selectTool(tools[0].name);
      }
    }

    // Prompts list rendering
    function renderPromptList() {
      const container = document.getElementById('promptList');
      document.getElementById('promptCount').textContent = prompts.length;

      if (prompts.length === 0) {
        container.innerHTML = `
          <div class="empty-state">
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"/>
            </svg>
            <div>No prompts available from this server</div>
          </div>
        `;
        return;
      }

      clearElement(container);
      prompts.forEach((prompt, index) => {
        const item = createElement('div', {
          className: `prompt-item ${index === 0 ? 'active' : ''}`,
          dataset: { prompt: prompt.name },
          attrs: { role: 'button', tabindex: '0', 'aria-label': `Select prompt ${prompt.name}` },
          on: {
            click: () => selectPrompt(prompt.name),
            keydown: (event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                selectPrompt(prompt.name);
              }
            }
          }
        });
        item.appendChild(createElement('div', { className: 'prompt-name', text: prompt.name }));
        item.appendChild(createElement('div', { className: 'prompt-desc', text: prompt.description || 'No description' }));
        if (prompt.arguments && prompt.arguments.length > 0) {
          const args = createElement('div', { className: 'prompt-args' });
          prompt.arguments.forEach((arg) => {
            args.appendChild(createElement('span', {
              className: `prompt-arg ${arg.required ? 'required' : ''}`,
              text: arg.name
            }));
          });
          item.appendChild(args);
        }
        container.appendChild(item);
      });

      // Select first prompt
      if (prompts.length > 0) {
        selectPrompt(prompts[0].name);
      }
    }

    function selectPrompt(promptName) {
      selectedPrompt = prompts.find(p => p.name === promptName);
      if (!selectedPrompt) return;

      // Update active state in list
      document.querySelectorAll('.prompt-item').forEach(el => {
        el.classList.toggle('active', el.dataset.prompt === promptName);
      });

      // Render prompt parameters in the test panel if prompts tab is active
      if (currentCapability === 'prompts') {
        renderPromptParams();
      }
    }

    function renderPromptParams() {
      const container = document.getElementById('dynamicParams');

      if (!selectedPrompt) {
        container.innerHTML = '<div style="color: var(--text-secondary); font-size: 13px; margin-bottom: 16px;">No prompt selected</div>';
        return;
      }

      const args = selectedPrompt.arguments || [];

      if (args.length === 0) {
        container.innerHTML = '<div style="color: var(--text-secondary); font-size: 13px; margin-bottom: 16px;">No arguments required</div>';
        return;
      }

      clearElement(container);
      args.forEach((arg) => {
        const group = createElement('div', { className: 'form-group' });
        const label = createElement('label');
        label.appendChild(createElement('span', { text: arg.name }));
        if (arg.required) {
          label.appendChild(createElement('span', { className: 'required', text: '*' }));
        }
        const input = createElement('input', {
          attrs: {
            type: 'text',
            id: `param_${arg.name}`,
            placeholder: arg.description || ''
          }
        });
        group.appendChild(label);
        group.appendChild(input);
        container.appendChild(group);
      });
    }

    // Resources list rendering
    function renderResourceList() {
      const container = document.getElementById('resourceList');
      document.getElementById('resourceCount').textContent = resources.length;

      if (resources.length === 0) {
        container.innerHTML = `
          <div class="empty-state">
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"/>
            </svg>
            <div>No resources available from this server</div>
          </div>
        `;
        return;
      }

      clearElement(container);
      resources.forEach((resource, index) => {
        const item = createElement('div', {
          className: `resource-item ${index === 0 ? 'active' : ''}`,
          dataset: { resource: resource.uri },
          attrs: { role: 'button', tabindex: '0', 'aria-label': `Select resource ${resource.name || resource.uri}` },
          on: {
            click: () => selectResource(resource.uri),
            keydown: (event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                selectResource(resource.uri);
              }
            }
          }
        });
        item.appendChild(createElement('div', { className: 'resource-uri', text: resource.name || resource.uri }));
        item.appendChild(createElement('div', { className: 'resource-type', text: resource.description || resource.uri }));
        if (resource.mimeType) {
          item.appendChild(createElement('span', { className: 'resource-mime', text: resource.mimeType }));
        }
        container.appendChild(item);
      });

      // Select first resource
      if (resources.length > 0) {
        selectResource(resources[0].uri);
      }
    }

    function selectResource(resourceUri) {
      selectedResource = resources.find(r => r.uri === resourceUri);
      if (!selectedResource) return;

      // Update active state in list
      document.querySelectorAll('.resource-item').forEach(el => {
        el.classList.toggle('active', el.dataset.resource === resourceUri);
      });

      // Update params display if resources tab is active
      if (currentCapability === 'resources') {
        renderSelectedResourceSummary();
      }
    }

    function renderToolSelect() {
      const select = document.getElementById('toolSelect');

      if (tools.length === 0) {
        select.innerHTML = '<option value="">-- No tools available --</option>';
        return;
      }

      clearElement(select);
      tools.forEach((tool) => {
        const option = createElement('option', {
          text: tool.name,
          attrs: { value: tool.name }
        });
        select.appendChild(option);
      });
    }

    function selectTool(toolName) {
      selectedTool = tools.find(t => t.name === toolName);
      if (!selectedTool) return;

      // Update active state in list
      document.querySelectorAll('.tool-item').forEach(el => {
        el.classList.toggle('active', el.dataset.tool === toolName);
      });

      // Update dropdown
      document.getElementById('toolSelect').value = toolName;

      // Render parameters
      renderDynamicParams();
    }

    function selectToolFromDropdown() {
      const select = document.getElementById('toolSelect');
      if (select.value) {
        selectTool(select.value);
      }
    }

    function renderDynamicParams() {
      const container = document.getElementById('dynamicParams');

      if (!selectedTool || !selectedTool.inputSchema) {
        container.innerHTML = '<div style="color: var(--text-secondary); font-size: 13px; margin-bottom: 16px;">No parameters</div>';
        return;
      }

      const schema = selectedTool.inputSchema;
      const properties = schema.properties || {};
      const required = schema.required || [];

      if (Object.keys(properties).length === 0) {
        container.innerHTML = '<div style="color: var(--text-secondary); font-size: 13px; margin-bottom: 16px;">No parameters required</div>';
        return;
      }

      clearElement(container);
      Object.entries(properties).forEach(([name, prop]) => {
        const isRequired = required.includes(name);
        const type = Array.isArray(prop.type) ? prop.type[0] : (prop.type || 'string');

        const group = createElement('div', { className: 'form-group' });
        const label = createElement('label');
        label.appendChild(createElement('span', { text: name }));
        if (isRequired) {
          label.appendChild(createElement('span', { className: 'required', text: '*' }));
        }
        label.appendChild(createElement('span', { className: 'param-type', text: type }));
        group.appendChild(label);

        let inputEl;
        if (Array.isArray(prop.enum) && prop.enum.length > 0) {
          inputEl = createElement('select', { attrs: { id: `param_${name}` } });
          inputEl.appendChild(createElement('option', { text: '-- Select --', attrs: { value: '' } }));
          prop.enum.forEach((optionValue) => {
            inputEl.appendChild(createElement('option', {
              text: String(optionValue),
              attrs: { value: optionValue }
            }));
          });
        } else if (type === 'boolean') {
          inputEl = createElement('select', { attrs: { id: `param_${name}` } });
          inputEl.appendChild(createElement('option', { text: '-- Select --', attrs: { value: '' } }));
          inputEl.appendChild(createElement('option', { text: 'true', attrs: { value: 'true' } }));
          inputEl.appendChild(createElement('option', { text: 'false', attrs: { value: 'false' } }));
        } else if (type === 'array' || type === 'object') {
          inputEl = createElement('textarea', {
            attrs: {
              id: `param_${name}`,
              placeholder: prop.description || `${type} value as JSON`
            }
          });
        } else {
          inputEl = createElement('input', {
            attrs: {
              type: type === 'number' || type === 'integer' ? 'number' : 'text',
              id: `param_${name}`,
              placeholder: prop.description || ''
            }
          });
        }
        group.appendChild(inputEl);
        container.appendChild(group);
      });
    }

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

    // AI Support (window.ai / Prompt API)
    function checkAISupport() {
      const aiStatus = document.getElementById('aiStatus');

      let statusHtml = '';

      // Check WebMCP (navigator.modelContext)
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

      // Check window.ai
      if (window.ai && window.ai.languageModel) {
        statusHtml += `<div style="border-left: 2px solid var(--success); padding-left: 10px;">
          <strong>Prompt API Available</strong> - Chat mode enabled with tool calling.
        </div>`;
      } else {
        statusHtml += `<div style="border-left: 2px solid var(--warning); padding-left: 10px;">
          <strong>Prompt API Not Available</strong> - Chat mode will use simple matching.
        </div>`;
      }

      aiStatus.className = 'ai-status';
      aiStatus.innerHTML = statusHtml;
    }

    // Register tools with WebMCP (navigator.modelContext)
    function registerToolsWithWebMCP(mcpTools) {
      debugLog('info', 'Checking navigator.modelContext...');

      if (!navigator.modelContext) {
        debugLog('error', 'navigator.modelContext is undefined');
        return;
      }

      debugLog('success', 'navigator.modelContext available');
      debugLog('detail', 'API:', navigator.modelContext);

      // Clear existing tools
      try {
        debugLog('info', 'Clearing existing context...');
        navigator.modelContext.clearContext();
        debugLog('success', 'Context cleared');
      } catch (e) {
        debugLog('info', 'clearContext not available:', e.message);
      }

      debugLog('info', 'Converting MCP tools to WebMCP format...');

      // Convert MCP tools to WebMCP format and register
      const webMCPTools = mcpTools.map(tool => {
        debugLog('detail', 'Converting:', tool.name);

        return {
          name: tool.name,
          description: tool.description || '',
          inputSchema: tool.inputSchema || { type: 'object', properties: {} },

          // The execute function is called when a browser AI agent invokes the tool
          execute: async (args) => {
            debugSeparator('Tool execution (via browser agent)');
            debugLog('info', 'Tool:', tool.name);
            debugLog('info', 'Args:', args);

            try {
              // Proxy the call to the remote MCP server
              const payload = {
                jsonrpc: '2.0',
                id: Date.now(),
                method: 'tools/call',
                params: { name: tool.name, arguments: args }
              };

              debugLog('info', '→ Proxying to MCP server:', serverUrl);
              debugLog('detail', 'Payload:', payload);

              const response = await fetch(serverUrl, {
                method: 'POST',
                headers: auth ? auth.getHeaders() : { 'Content-Type': 'application/json', 'Accept': 'application/json, text/event-stream' },
                body: JSON.stringify(payload)
              });

              const result = await parseSSEorJSON(response);
              debugLog('info', '← MCP response', result);

              if (result.error) {
                debugLog('error', 'Tool error:', result.error);
                return { content: [{ type: 'text', text: `Error: ${result.error.message}` }] };
              }

              // Format result for WebMCP
              let content = result.result;
              if (result.result?.content) {
                debugLog('success', 'Returning MCP content format');
                return result.result; // Already in MCP format
              }

              debugLog('success', 'Wrapping result in WebMCP format');
              return {
                content: [{
                  type: 'text',
                  text: typeof content === 'string' ? content : JSON.stringify(content, null, 2)
                }]
              };
            } catch (error) {
              debugLog('error', 'Execution error:', error.message);
              return { content: [{ type: 'text', text: `Error: ${error.message}` }] };
            }
          }
        };
      });

      // Register with provideContext
      debugLog('info', 'Calling navigator.modelContext.provideContext()...');

      try {
        navigator.modelContext.provideContext({ tools: webMCPTools });
        debugLog('success', 'Tools registered with WebMCP!');
        debugLog('success', 'Registered tools:', webMCPTools.map(t => t.name));

      } catch (error) {
        console.error('Failed to register WebMCP tools:', error);
      }
    }

    async function initAISession() {
      if (!window.ai || !window.ai.languageModel) return;

      try {
        // Create AI session with tools
        const toolDefinitions = tools.map(tool => ({
          name: tool.name,
          description: tool.description,
          parameters: tool.inputSchema
        }));

        aiSession = await window.ai.languageModel.create({
          systemPrompt: `You are a helpful assistant with access to MCP tools. When the user asks a question, determine if you need to use a tool to answer it. Available tools: ${tools.map(t => t.name).join(', ')}. Respond naturally and use tools when needed.`,
        });

        console.log('AI session initialized with tools:', toolDefinitions);
      } catch (error) {
        console.error('Failed to initialize AI session:', error);
      }
    }

    // Chat functionality
    function handleChatKeydown(event) {
      if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        sendChatMessage();
      }
    }

    async function sendChatMessage() {
      const input = document.getElementById('chatInput');
      const message = input.value.trim();
      if (!message) return;

      const messagesContainer = document.getElementById('chatMessages');

      // Clear empty state if present
      const emptyState = messagesContainer.querySelector('.empty-state');
      if (emptyState) emptyState.remove();

      // Add user message
      addChatMessage('user', message);
      input.value = '';

      // Process with AI or simple tool matching
      if (aiSession) {
        await processWithAI(message);
      } else {
        await processWithSimpleMatching(message);
      }
    }

    function addChatMessage(role, content, toolName = null) {
      const messagesContainer = document.getElementById('chatMessages');
      const messageEl = document.createElement('div');
      messageEl.className = `chat-message ${role}`;

      if (role === 'tool-call') {
        const toolNameEl = createElement('span', { className: 'tool-name', text: toolName || 'Tool' });
        messageEl.appendChild(toolNameEl);
        messageEl.appendChild(document.createTextNode(`: ${content}`));
      } else if (role === 'assistant') {
        // Render simple markdown: **bold**, - lists
        messageEl.innerHTML = renderSimpleMarkdown(content);
      } else {
        messageEl.textContent = content;
      }

      messagesContainer.appendChild(messageEl);
      messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

    function renderSimpleMarkdown(text) {
      return escapeHtml(text)
        // Bold: **text**
        .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
        // Italic: *text*
        .replace(/\*([^*]+)\*/g, '<em>$1</em>')
        // List items: - item
        .replace(/^- (.+)$/gm, '• $1')
        // Line breaks
        .replace(/\n/g, '<br>');
    }

    async function processWithAI(message) {
      try {
        addChatMessage('assistant', 'Thinking...');

        const response = await aiSession.prompt(message);

        // Remove "Thinking..." message
        const messages = document.querySelectorAll('.chat-message.assistant');
        const lastMsg = messages[messages.length - 1];
        if (lastMsg && lastMsg.textContent === 'Thinking...') {
          lastMsg.textContent = response;
        }


        // Check if AI wants to use a tool (simple heuristic)
        const toolMatch = tools.find(t =>
          response.toLowerCase().includes(t.name.toLowerCase()) ||
          response.toLowerCase().includes('let me search') ||
          response.toLowerCase().includes('i\'ll look')
        );

        if (toolMatch) {
          // Extract potential arguments from context
          await executeToolFromChat(toolMatch.name, {});
        }

      } catch (error) {
        addChatMessage('assistant', `Error: ${error.message}`);
      }
    }

    async function processWithSimpleMatching(message) {
      // Simple keyword matching to find relevant tool
      const lowerMessage = message.toLowerCase();

      let matchedTool = null;
      let args = {};

      // Check for specific tool patterns first
      if (lowerMessage.includes('stage') && lowerMessage.match(/\d/)) {
        // "stage 3 proposals" or "list stage 2"
        matchedTool = tools.find(t => t.name === 'list_proposals_by_stage');
      } else if (lowerMessage.includes('compare') || lowerMessage.includes('vs') || lowerMessage.includes('versus')) {
        matchedTool = tools.find(t => t.name === 'compare_proposals');
      } else if (lowerMessage.includes('champion')) {
        matchedTool = tools.find(t => t.name === 'get_champions');
      } else if (lowerMessage.includes('summary') || lowerMessage.includes('count') || lowerMessage.includes('how many')) {
        matchedTool = tools.find(t => t.name === 'get_stage_summary');
      } else {
        // Try keyword matching from tool names/descriptions
        for (const tool of tools) {
          const toolWords = tool.name.toLowerCase().split('_');
          const descWords = (tool.description || '').toLowerCase().split(' ');

          if (toolWords.some(w => lowerMessage.includes(w)) ||
              descWords.some(w => w.length > 4 && lowerMessage.includes(w))) {
            matchedTool = tool;
            break;
          }
        }
      }

      // Default to search_proposals for any unmatched query
      if (!matchedTool && message.trim().length > 0) {
        matchedTool = tools.find(t => t.name === 'search_proposals') || tools[0];
      }

      if (matchedTool) {
        // Extract search term from natural language query
        args = extractArgsFromMessage(message, matchedTool);

        addChatMessage('tool-call', `Calling with args: ${JSON.stringify(args)}`, matchedTool.name);
        await executeToolFromChat(matchedTool.name, args);
      } else {
        addChatMessage('assistant', `I found ${tools.length} tools available. Try asking about: ${tools.slice(0, 5).map(t => t.name).join(', ')}...`);
      }
    }

    function extractArgsFromMessage(message, tool) {
      const args = {};
      const schema = tool.inputSchema;
      const properties = schema?.properties || {};
      const lowerMessage = message.toLowerCase();

      // Common filler words to remove
      const stopWords = [
        'what', 'are', 'is', 'the', 'a', 'an', 'that', 'which', 'how', 'do', 'does',
        'can', 'could', 'would', 'should', 'will', 'about', 'for', 'with', 'using',
        'uses', 'use', 'find', 'search', 'show', 'me', 'list', 'get', 'proposals',
        'proposal', 'stage', 'by', 'in', 'of', 'to', 'and', 'or', 'any', 'all'
      ];

      // Check if tool needs a 'query' parameter
      if (properties.query) {
        // Extract meaningful words from message
        const words = message.split(/\s+/);
        const meaningful = words.filter(w => {
          const clean = w.toLowerCase().replace(/[^a-z0-9]/g, '');
          return clean.length > 1 && !stopWords.includes(clean);
        });

        // Use the most specific term (often capitalized or quoted)
        const quoted = message.match(/["']([^"']+)["']/);
        if (quoted) {
          args.query = quoted[1];
        } else if (meaningful.length > 0) {
          // Prefer capitalized words as they're likely proper terms
          const capitalized = meaningful.filter(w => /^[A-Z]/.test(w));
          args.query = capitalized.length > 0 ? capitalized.join(' ') : meaningful.join(' ');
        } else {
          args.query = message;
        }
      }

      // Check for 'stage' parameter (number extraction)
      if (properties.stage) {
        const stageMatch = lowerMessage.match(/stage\s*(\d+)/);
        if (stageMatch) {
          args.stage = parseInt(stageMatch[1]);
        }
      }

      // Check for 'id' parameter
      if (properties.id) {
        // Look for quoted strings or specific identifiers
        const quoted = message.match(/["']([^"']+)["']/);
        if (quoted) {
          args.id = quoted[1];
        }
      }

      // Check for comparison parameters (id1, id2)
      if (properties.id1 && properties.id2) {
        const quoted = message.match(/["']([^"']+)["']/g);
        if (quoted && quoted.length >= 2) {
          args.id1 = quoted[0].replace(/["']/g, '');
          args.id2 = quoted[1].replace(/["']/g, '');
        }
      }

      return args;
    }

    async function executeToolFromChat(toolName, args) {
      debugSeparator('Chat mode: Executing tool');
      debugLog('info', 'Tool:', toolName);
      debugLog('info', 'Args:', args);

      try {
        const payload = {
          jsonrpc: '2.0',
          id: Date.now(),
          method: 'tools/call',
          params: { name: toolName, arguments: args }
        };

        debugLog('info', '→ Sending tools/call request');
        debugLog('detail', 'Payload:', payload);

        const response = await fetch(serverUrl, {
          method: 'POST',
          headers: auth ? auth.getHeaders() : { 'Content-Type': 'application/json', 'Accept': 'application/json, text/event-stream' },
          body: JSON.stringify(payload)
        });

        debugLog('info', '← Response status:', response.status);

        // Handle auth errors
        if (response.status === 401 || response.status === 403) {
          debugLog('error', 'Auth error');
          addChatMessage('assistant', 'Authentication required or token expired. Please reconnect.');
          return;
        }

        const result = await parseSSEorJSON(response);
        debugLog('info', '← Tool result', result);

        if (result.error) {
          debugLog('error', 'Tool error:', result.error);
          addChatMessage('assistant', `Tool error: ${result.error.message}`);
        } else {
          debugLog('success', 'Tool success');
          let content = result.result;
          if (result.result?.content) {
            content = result.result.content.map(c => c.text || JSON.stringify(c)).join('\n');
          }

          // Show full results
          const formatted = typeof content === 'string'
            ? content
            : JSON.stringify(content, null, 2);

          addChatMessage('assistant', formatted);
        }
      } catch (error) {
        debugLog('error', 'Execution error:', error.message);
        addChatMessage('assistant', `Error executing tool: ${error.message}`);
      }
    }

    // WebMCP event listeners - fired when external AI agents use our tools
    window.addEventListener('toolactivated', (event) => {
      const toolName = event.toolName || event.detail?.toolName;
      debugSeparator('Event: toolactivated');
      debugLog('info', 'An external AI agent is using tool:', toolName);
      debugLog('detail', 'Event details:', event);

      // Highlight the tool in the list
      document.querySelectorAll('.tool-item').forEach(el => {
        if (el.dataset.tool === toolName) {
          el.style.borderLeftColor = 'var(--success)';
          el.style.background = 'rgba(34, 197, 94, 0.1)';
        }
      });
    });

    window.addEventListener('toolcancel', (event) => {
      const toolName = event.toolName || event.detail?.toolName;
      debugLog('warn', 'Event: toolcancel');
      debugLog('info', 'Tool cancelled:', toolName);

      // Reset tool highlight
      document.querySelectorAll('.tool-item').forEach(el => {
        if (el.dataset.tool === toolName) {
          el.style.borderLeftColor = '';
          el.style.background = '';
        }
      });
    });

    // About modal
    function openAbout() {
      document.getElementById('aboutModal').classList.add('active');
      document.body.style.overflow = 'hidden';
    }

    function closeAbout() {
      document.getElementById('aboutModal').classList.remove('active');
      document.body.style.overflow = '';
    }

    // Close about modal when clicking outside
    document.getElementById('aboutModal').addEventListener('click', (e) => {
      if (e.target.id === 'aboutModal') {
        closeAbout();
      }
    });

    // Initialize on load
    init();
