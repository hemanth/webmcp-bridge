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
