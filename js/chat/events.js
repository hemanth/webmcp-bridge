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
