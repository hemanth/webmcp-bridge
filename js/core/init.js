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
