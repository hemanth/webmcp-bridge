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
