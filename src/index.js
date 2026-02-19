import { MCPAuth } from './auth.js';
import { parseSSEorJSON } from './parser.js';

export { MCPAuth } from './auth.js';
export { parseSSEorJSON } from './parser.js';

/**
 * WebMCP Bridge — connect any MCP server to Chrome's WebMCP API.
 *
 * @example
 * const bridge = new WebMCPBridge('https://mcp.example.com');
 * await bridge.connect();
 * // Tools are now registered with navigator.modelContext
 */
export class WebMCPBridge {
    constructor(serverUrl, options = {}) {
        this.serverUrl = serverUrl;
        this.auth = new MCPAuth(serverUrl);
        this.tools = [];
        this.prompts = [];
        this.resources = [];
        this.serverInfo = null;
        this.capabilities = null;

        // Custom headers merged into every request
        this.headers = options.headers || {};

        // Hooks
        this.onToolCall = options.onToolCall || null;
        this.onResponse = options.onResponse || null;
        this.onError = options.onError || null;
        this.enrichContext = options.enrichContext || null;
        this.logger = options.logger || console;
    }

    /**
     * Set auth credentials before connecting.
     */
    setAuth({ type, token, username, password }) {
        if (type === 'bearer') this.auth.setBearerToken(token);
        else if (type === 'apikey') this.auth.setApiKey(token);
        else if (type === 'basic') this.auth.setBasicAuth(username, password);
    }

    /**
     * Connect to the MCP server, discover capabilities, register with WebMCP.
     */
    async connect() {
        // 1. Initialize session
        const initPayload = {
            jsonrpc: '2.0',
            id: 1,
            method: 'initialize',
            params: {
                protocolVersion: '2024-11-05',
                capabilities: { tools: {} },
                clientInfo: { name: 'webmcp-bridge', version: '1.0.0' },
            },
        };

        const initResponse = await fetch(this.serverUrl, {
            method: 'POST',
            headers: this._getHeaders(false),
            body: JSON.stringify(initPayload),
        });

        if (initResponse.status === 401 || initResponse.status === 403) {
            throw new Error('Authentication required');
        }

        const initData = await parseSSEorJSON(initResponse);
        if (initData.error) throw new Error(initData.error.message || 'Initialize failed');

        // Capture session ID
        const sessionId = initResponse.headers.get('Mcp-Session-Id');
        if (sessionId) this.auth.setSessionId(sessionId);

        this.serverInfo = initData.result?.serverInfo || null;
        this.capabilities = initData.result?.capabilities || null;

        // 2. Discover tools, prompts, resources
        this.tools = await this._list('tools/list', 'tools');
        this.prompts = await this._list('prompts/list', 'prompts');
        this.resources = await this._list('resources/list', 'resources');

        this.logger.log(`[webmcp-bridge] Connected. ${this.tools.length} tools, ${this.prompts.length} prompts, ${this.resources.length} resources.`);

        return {
            serverInfo: this.serverInfo,
            capabilities: this.capabilities,
            tools: this.tools,
            prompts: this.prompts,
            resources: this.resources,
        };
    }

    /**
     * Register discovered tools with navigator.modelContext (WebMCP).
     * Call after connect(). Optionally pass extra page-local tools.
     */
    register(extraTools = []) {
        if (!navigator.modelContext) {
            throw new Error('navigator.modelContext not available. Enable chrome://flags/#enable-webmcp-testing');
        }

        const webMCPTools = this.tools.map(tool => ({
            name: tool.name,
            description: tool.description || '',
            inputSchema: tool.inputSchema || { type: 'object', properties: {} },
            execute: async (args) => this.callTool(tool.name, args),
        }));

        const allTools = [...webMCPTools, ...extraTools];

        navigator.modelContext.provideContext({ tools: allTools });
        this.logger.log(`[webmcp-bridge] Registered ${allTools.length} tools with WebMCP.`);

        return allTools;
    }

    /**
     * Call a tool on the remote MCP server.
     */
    async callTool(name, args = {}) {
        // Enrich args if hook is provided
        const enriched = this.enrichContext ? await this.enrichContext(name, args) : args;

        // Notify onToolCall hook
        if (this.onToolCall) this.onToolCall(name, enriched);

        const payload = {
            jsonrpc: '2.0',
            id: Date.now(),
            method: 'tools/call',
            params: { name, arguments: enriched },
        };

        try {
            const response = await fetch(this.serverUrl, {
                method: 'POST',
                headers: this._getHeaders(),
                body: JSON.stringify(payload),
            });

            const result = await parseSSEorJSON(response);

            if (result.error) {
                const err = new Error(result.error.message || 'Tool call failed');
                if (this.onError) this.onError(name, err);
                return { content: [{ type: 'text', text: `Error: ${result.error.message}` }] };
            }

            // Transform response if hook is provided
            let output = result.result?.content ? result.result : {
                content: [{
                    type: 'text',
                    text: typeof result.result === 'string' ? result.result : JSON.stringify(result.result, null, 2),
                }],
            };

            if (this.onResponse) output = await this.onResponse(name, output) || output;

            return output;
        } catch (error) {
            if (this.onError) this.onError(name, error);
            return { content: [{ type: 'text', text: `Error: ${error.message}` }] };
        }
    }

    /**
     * Get a prompt from the server.
     */
    async getPrompt(name, args = {}) {
        return this._rpc('prompts/get', { name, arguments: args });
    }

    /**
     * Read a resource from the server.
     */
    async readResource(uri) {
        return this._rpc('resources/read', { uri });
    }

    /**
     * Disconnect — clear context.
     */
    disconnect() {
        if (navigator.modelContext?.clearContext) {
            navigator.modelContext.clearContext();
        }
        this.tools = [];
        this.prompts = [];
        this.resources = [];
        this.auth.logout();
        this.logger.log('[webmcp-bridge] Disconnected.');
    }

    // --- Internal ---

    _getHeaders(includeSession = true) {
        return { ...this.auth.getHeaders(includeSession), ...this.headers };
    }

    async _list(method, key) {
        try {
            const result = await this._rpc(method, {});
            return result?.[key] || [];
        } catch {
            return [];
        }
    }

    async _rpc(method, params) {
        const response = await fetch(this.serverUrl, {
            method: 'POST',
            headers: this._getHeaders(),
            body: JSON.stringify({
                jsonrpc: '2.0',
                id: Date.now(),
                method,
                params,
            }),
        });

        if (response.status === 401 || response.status === 403) {
            throw new Error('Authentication failed');
        }

        const data = await parseSSEorJSON(response);
        if (data.error) throw new Error(data.error.message || `${method} failed`);
        return data.result;
    }
}

export default WebMCPBridge;
