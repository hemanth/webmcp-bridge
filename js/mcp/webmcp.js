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
