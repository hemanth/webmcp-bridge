/**
 * MCP Auth — handles OAuth (PKCE), API key, Basic, and Bearer auth.
 */
export class MCPAuth {
    constructor(serverUrl) {
        this.serverUrl = serverUrl;
        this.token = null;
        this.tokenType = 'Bearer';
        this.clientId = null;
        this.authMeta = null;
        this.sessionId = null;
    }

    async discover() {
        const baseUrl = new URL(this.serverUrl).origin;
        const metaUrl = `${baseUrl}/.well-known/oauth-authorization-server`;

        try {
            const res = await fetch(metaUrl, {
                method: 'GET',
                headers: { Accept: 'application/json' },
            });

            if (res.status === 404 || !res.ok) {
                return { type: 'none', requiresAuth: false };
            }

            const meta = await res.json();
            this.authMeta = meta;

            const thirdParty = meta.identity_providers || meta.supported_identity_providers || [];

            return {
                type: 'oauth',
                requiresAuth: true,
                meta,
                isOwnIdp: thirdParty.length === 0 && !!meta.authorization_endpoint,
                thirdParty,
                supportsRegistration: !!meta.registration_endpoint,
            };
        } catch {
            return { type: 'none', requiresAuth: false };
        }
    }

    async registerClient(redirectUri) {
        if (!this.authMeta?.registration_endpoint) {
            throw new Error('Server does not support dynamic client registration');
        }

        const res = await fetch(this.authMeta.registration_endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                client_name: 'WebMCP Bridge',
                redirect_uris: [redirectUri],
                grant_types: ['authorization_code', 'refresh_token'],
                response_types: ['code'],
                token_endpoint_auth_method: 'none',
                scope: 'openid profile mcp:tools mcp:read mcp:write',
            }),
        });

        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.error_description || 'Client registration failed');
        }

        const data = await res.json();
        this.clientId = data.client_id;
        return data;
    }

    async generatePKCE() {
        const array = new Uint8Array(32);
        crypto.getRandomValues(array);
        const verifier = Array.from(array, b => b.toString(16).padStart(2, '0')).join('');

        const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
        const challenge = btoa(String.fromCharCode(...new Uint8Array(hash)))
            .replace(/\+/g, '-')
            .replace(/\//g, '_')
            .replace(/=+$/, '');

        return { verifier, challenge };
    }

    setApiKey(apiKey) {
        this.token = apiKey;
        this.tokenType = 'X-API-Key';
    }

    setBasicAuth(username, password) {
        this.token = btoa(`${username}:${password}`);
        this.tokenType = 'Basic';
    }

    setBearerToken(token) {
        this.token = token;
        this.tokenType = 'Bearer';
    }

    setSessionId(id) {
        this.sessionId = id;
    }

    getHeaders(includeSession = true) {
        const headers = {
            'Content-Type': 'application/json',
            Accept: 'application/json, text/event-stream',
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

        if (includeSession && this.sessionId) {
            headers['Mcp-Session-Id'] = this.sessionId;
        }

        return headers;
    }

    isAuthenticated() {
        return !!this.token;
    }

    logout() {
        this.token = null;
        this.clientId = null;
        this.sessionId = null;
    }
}
