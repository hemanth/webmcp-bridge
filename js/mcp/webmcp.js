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

    function getPromptApiInitInFlight() {
      if (typeof promptApiInitInFlight !== 'undefined') return promptApiInitInFlight;
      return globalThis.__promptApiInitInFlight || null;
    }

    function setPromptApiInitInFlight(promiseOrNull) {
      if (typeof promptApiInitInFlight !== 'undefined') {
        promptApiInitInFlight = promiseOrNull;
      }
      globalThis.__promptApiInitInFlight = promiseOrNull;
    }

    function setPromptApiDownloadProgressValue(value) {
      if (typeof promptApiDownloadProgress !== 'undefined') {
        promptApiDownloadProgress = value;
      }
      globalThis.__promptApiDownloadProgress = value;
    }

    function getPromptApiDownloadProgressValue() {
      if (typeof promptApiDownloadProgress !== 'undefined') return promptApiDownloadProgress;
      const fallback = globalThis.__promptApiDownloadProgress;
      return Number.isFinite(fallback) ? fallback : null;
    }

    async function initAISession() {
      if (aiSession) {
        promptApiState = {
          available: true,
          availability: 'session_ready',
          reason: 'Prompt API session is ready.'
        };
        setPromptApiDownloadProgressValue(1);
        return true;
      }
      const inFlight = getPromptApiInitInFlight();
      if (inFlight) return await inFlight;

      const createSessionPromise = (async () => {
        if (!window.LanguageModel) {
          promptApiState = {
            available: false,
            availability: 'missing',
            reason: 'window.LanguageModel is missing.'
          };
          setPromptApiDownloadProgressValue(null);
          return false;
        }

        try {
          let availability = 'unknown';
          if (typeof window.LanguageModel.availability === 'function') {
            availability = await window.LanguageModel.availability();
          }

          if (availability === 'unavailable') {
            promptApiState = {
              available: false,
              availability: 'unavailable',
              reason: 'LanguageModel availability is "unavailable".'
            };
            aiSession = null;
            setPromptApiDownloadProgressValue(null);
            return false;
          }

          // "downloadable" / "downloading" means create() can trigger/continue download.
          if (availability === 'downloadable' || availability === 'downloading') {
            promptApiState = {
              available: false,
              availability: 'downloading',
              reason: 'Prompt API model is downloading in the browser.'
            };
            if (getPromptApiDownloadProgressValue() == null) setPromptApiDownloadProgressValue(0);
            if (typeof checkAISupport === 'function') checkAISupport();
          }

          let lastProgress = getPromptApiDownloadProgressValue() ?? 0;
          aiSession = await window.LanguageModel.create({
            systemPrompt: 'You are a precise assistant that uses tools through strict JSON actions.',
            monitor(monitor) {
              monitor.addEventListener('downloadprogress', (event) => {
                const value = Number(event.loaded);
                if (!Number.isFinite(value)) return;
                // Avoid noisy renders for tiny increments.
                if (Math.abs(value - lastProgress) < 0.01 && value !== 1) return;
                lastProgress = value;
                setPromptApiDownloadProgressValue(Math.max(0, Math.min(1, value)));
                promptApiState = {
                  available: false,
                  availability: 'downloading',
                  reason: 'Prompt API model is downloading in the browser.'
                };
                if (typeof checkAISupport === 'function') checkAISupport();
              });
            }
          });

          console.log('AI session initialized for structured tool calling.');
          promptApiState = {
            available: true,
            availability: 'session_ready',
            reason: 'Prompt API session is ready.'
          };
          setPromptApiDownloadProgressValue(1);
          return true;
        } catch (error) {
          console.error('Failed to initialize AI session:', error);
          promptApiState = {
            available: false,
            availability: 'error',
            reason: `Session creation failed: ${error.message}`
          };
          aiSession = null;
          setPromptApiDownloadProgressValue(null);
          return false;
        } finally {
          setPromptApiInitInFlight(null);
        }
      })();

      setPromptApiInitInFlight(createSessionPromise);
      return await createSessionPromise;
    }
