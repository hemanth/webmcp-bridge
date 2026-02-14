    function normalizeChatToolArgs(toolName, args) {
      const safeArgs = (args && typeof args === 'object' && !Array.isArray(args)) ? { ...args } : {};

      // Guardrail: stage must be an integer [0..4]. Drop invalid values.
      if (Object.prototype.hasOwnProperty.call(safeArgs, 'stage')) {
        const stageValue = Number(safeArgs.stage);
        if (!Number.isInteger(stageValue) || stageValue < 0 || stageValue > 4) {
          debugLog('warn', `Dropping invalid stage "${safeArgs.stage}" for tool ${toolName}`);
          delete safeArgs.stage;
        } else {
          safeArgs.stage = stageValue;
        }
      }

      return safeArgs;
    }

    async function executeToolFromChat(toolName, args, options = {}) {
      const { echoResultToChat = true } = options;
      const normalizedArgs = normalizeChatToolArgs(toolName, args);
      debugSeparator('Chat mode: Executing tool');
      debugLog('info', 'Tool:', toolName);
      debugLog('info', 'Args:', normalizedArgs);

      try {
        const payload = {
          jsonrpc: '2.0',
          id: Date.now(),
          method: 'tools/call',
          params: { name: toolName, arguments: normalizedArgs }
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
          const errorMessage = 'Authentication required or token expired. Please reconnect.';
          if (echoResultToChat) {
            addChatMessage('assistant', errorMessage);
          }
          return { ok: false, error: errorMessage };
        }

        const result = await parseSSEorJSON(response);
        debugLog('info', '← Tool result', result);

        if (result.error) {
          debugLog('error', 'Tool error:', result.error);
          const errorMessage = `Tool error: ${result.error.message}`;
          if (echoResultToChat) {
            addChatMessage('assistant', errorMessage);
          }
          return { ok: false, error: errorMessage, raw: result.error };
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

          if (echoResultToChat) {
            addChatMessage('assistant', formatted);
          }
          return { ok: true, content: formatted, raw: result.result };
        }
      } catch (error) {
        debugLog('error', 'Execution error:', error.message);
        const errorMessage = `Error executing tool: ${error.message}`;
        if (echoResultToChat) {
          addChatMessage('assistant', errorMessage);
        }
        return { ok: false, error: errorMessage };
      }
    }
