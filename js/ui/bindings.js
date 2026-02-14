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
